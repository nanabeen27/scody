import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Screen,
  Section,
  Group,
  Row,
  Button,
  AppText,
  SourceBadge,
  SourceValue,
  Stepper,
  Table,
  type Column,
  ActionBar,
} from '@/components';
import {
  usePricing,
  academyMonthly,
  won,
  PRICING_LIMITS,
  type PricingPolicy,
} from '@/features/pricing';
import { share } from '@/features/revenue';
import { useAcademies, useCombined, useRevenue } from '@/features/adminMetrics';
import { useAudit } from '@/features/audit';
import { useSession } from '@/session';
import { colors, spacing } from '@/theme/tokens';

interface Knob {
  key: keyof PricingPolicy;
  label: string;
  desc: string;
  unit: '원' | '%' | '명';
}

/** 단가 먼저, 비율 나중. 운영자가 바꾸는 빈도 순서다. */
const KNOBS: Knob[] = [
  {
    key: 'studentPaid',
    label: '개인 월정액 · 학생 결제',
    desc: '학생이 직접 결제하는 이용권',
    unit: '원',
  },
  {
    key: 'parentPaid',
    label: '개인 월정액 · 학부모 결제',
    desc: '학부모가 결제하고 관리하는 이용권',
    unit: '원',
  },
  {
    key: 'academySeat',
    label: '학원 좌석 단가',
    desc: '학원이 부담하는 재원생 1인당 월 금액',
    unit: '원',
  },
  {
    key: 'seatDiscountPct',
    label: '학원 규모 할인율',
    desc: '좌석이 기준을 넘는 학원에 적용',
    unit: '%',
  },
  {
    key: 'seatDiscountFrom',
    label: '규모 할인 시작 좌석',
    desc: '이 인원부터 규모 할인을 적용',
    unit: '명',
  },
  {
    key: 'annualDiscountPct',
    label: '연 결제 할인율',
    desc: '연 단위로 결제할 때 깎아 주는 비율',
    unit: '%',
  },
  {
    key: 'annualSharePct',
    label: '연 결제 비율',
    desc: '연 결제를 고른 이용권 비율(추정에 사용)',
    unit: '%',
  },
];

interface BillRow {
  name: string;
  seats: number;
  amount: number;
  discounted: boolean;
  status: string;
}

/**
 * 요금제. 월정액 단가와 할인 비율을 정하고, 바꾼 값이 추정 매출에 즉시 반영되는 것을 보여 준다.
 *
 * **매출을 이 화면에서 다시 계산하지 않는다** — `rpc_revenue_estimate()`가 개요와 같은 값을
 * 준다(예전에는 두 화면이 같은 수식을 각자 들고 있었다). 학원별 청구액은 여러 곳을 나란히
 * 비교하는 자리라 `Table`이고, 정책 한 벌의 결과인 매출 추정은 `Group`+`Row`다.
 *
 * 바꾼 값은 **서버에 새 정책 행으로 쌓인다**(`pricing_policies`) — 새로고침해도 남고 지난 값도
 * 지워지지 않는다. 실제 청구·정산과는 아직 연결되지 않았다(마스터 플랜 5절).
 *
 * **저장이 실패하면 화면도 바뀌지 않고, 운영 기록에도 남지 않는다.** 낙관적으로 먼저 올려 두면
 * 화면은 바뀐 값을 말하는데 서버에는 없다.
 */
export default function AdminBilling() {
  const { policy, loading, bump, reset, changed } = usePricing();
  const { log } = useAudit();
  const { account } = useSession();
  const actor = account?.name ?? '운영자';
  const [error, setError] = useState<string | null>(null);

  /**
   * 매출 추정과 학원 목록은 서버에서 온다.
   *
   * 정책을 바꾸면 서버에 새 `pricing_policies` 행이 쌓이므로 **추정을 다시 읽는다** — 이 화면은
   * `바꾸면 아래 추정 매출이 바로 바뀌어요`라고 약속한다. 학원별 청구액은 좌석과 지금 정책으로
   * 화면에서 바로 계산해 왕복 없이 움직인다.
   */
  const revenueQuery = useRevenue();
  const academies = useAcademies();
  const remote = useCombined(revenueQuery, academies);
  const revenue = revenueQuery.data;

  const bills = useMemo<BillRow[]>(
    () =>
      (academies.data ?? [])
        // 계약이 끝난 학원에는 청구하지 않는다(A-049) — 목록에는 남기고 금액을 비운다.
        .map((a) => ({
          name: a.name,
          seats: a.enrolled,
          amount: a.status === 'churned' ? 0 : academyMonthly(policy, a.enrolled),
          discounted: a.status !== 'churned' && a.enrolled >= policy.seatDiscountFrom,
          status: a.status === 'churned' ? '이탈' : '계약 중',
        }))
        .sort((a, b) => b.amount - a.amount),
    [academies.data, policy],
  );

  /** 청구에서 빠진 이탈 학원. 없으면 고지도 사라진다. */
  const churnedBills = bills.filter((b) => b.status === '이탈');
  const churnedSeats = churnedBills.reduce((n, b) => n + b.seats, 0);

  async function change(knob: Knob, direction: 1 | -1) {
    const before = policy[knob.key];
    const limits = PRICING_LIMITS[knob.key];
    const after = Math.min(limits.max, Math.max(limits.min, before + direction * limits.step));
    if (after === before) return;
    const res = await bump(knob.key, direction);
    if (!res.ok) {
      setError(res.error ?? '요금 정책을 저장하지 못했어요.');
      return;
    }
    setError(null);
    revenueQuery.reload();
    await log({
      actor,
      action: '요금 정책',
      detail: `${knob.label} ${format(before, knob.unit)} → ${format(after, knob.unit)}`,
    });
  }

  async function onReset() {
    const res = await reset();
    if (!res.ok) {
      setError(res.error ?? '요금 정책을 저장하지 못했어요.');
      return;
    }
    setError(null);
    revenueQuery.reload();
    await log({ actor, action: '요금 정책', detail: '기본값으로 되돌림' });
  }

  const columns: Column<BillRow>[] = [
    { key: 'name', header: '학원', cell: (r) => r.name },
    {
      key: 'seats',
      header: '좌석',
      width: 80,
      align: 'right',
      // 오름차순으로 정의한다. 내림차순은 표가 뒤집는다(D-074).
      sort: (a, b) => a.seats - b.seats,
      cell: (r) => `${r.seats.toLocaleString('en-US')}명`,
    },
    {
      key: 'discount',
      header: '규모 할인',
      width: 84,
      align: 'right',
      priority: 2,
      cell: (r) => (r.discounted ? `${policy.seatDiscountPct}%` : '없음'),
    },
    { key: 'status', header: '상태', width: 64, priority: 3, cell: (r) => r.status },
    {
      key: 'amount',
      header: '월 청구액',
      // 좌석 단가를 상한까지 올리면 `₩510,000,000`(13자)이 된다 — 이 화면이 바로 그 조작을
      // 하는 자리라 기본값 기준으로 폭을 잡으면 조용히 잘린다.
      width: 132,
      align: 'right',
      sort: (a, b) => a.amount - b.amount,
      cell: (r) => (r.status === '이탈' ? '—' : won(r.amount)),
    },
  ];

  return (
    <Screen
      wide
      testID="admin-billing"
      title="요금제"
      lead="월정액 단가와 할인 비율을 정해요. 바꾸면 아래 추정 매출이 바로 바뀌어요."
    >
      <AppText variant="caption" tone="tertiary">
        바꾼 값은 서버에 남고 지난 값도 그대로 보관돼요. 실제 결제·정산에는 아직 반영되지 않아요.
      </AppText>
      {/* 값을 읽는 동안에는 기준값이 화면에 있다 — 그것을 서버 값처럼 말하지 않는다. */}
      {loading ? (
        <AppText variant="caption" tone="secondary">
          요금 정책을 불러오고 있어요.
        </AppText>
      ) : null}
      {error ? (
        <AppText variant="caption" style={{ color: colors.danger }}>
          {error}
        </AppText>
      ) : null}

      <Section title="단가와 비율">
        <Group>
          {KNOBS.map((k) => {
            const limits = PRICING_LIMITS[k.key];
            return (
              <Row
                key={k.key}
                title={k.label}
                subtitle={k.desc}
                trailing={
                  <Stepper
                    testID={`billing-${k.key}`}
                    label={k.label}
                    value={format(policy[k.key], k.unit)}
                    atMin={policy[k.key] <= limits.min}
                    atMax={policy[k.key] >= limits.max}
                    onStep={(direction) => void change(k, direction)}
                  />
                }
              />
            );
          })}
        </Group>
        {changed ? (
          <ActionBar>
            <Button
              testID="billing-reset"
              variant="secondary"
              label="기본값으로 되돌리기"
              onPress={() => void onReset()}
            />
          </ActionBar>
        ) : null}
      </Section>

      <Section title="매출 추정">
        {remote.error ? (
          <AppText variant="caption" style={{ color: colors.danger }}>
            매출 추정을 읽지 못했어요. {remote.error}
          </AppText>
        ) : null}
        <Group>
          <Row
            title="추정 MRR"
            subtitle="개인 이용권 월 환산 + 학원 좌석 청구액"
            trailing={<Money loading={remote.loading} value={revenue && won(revenue.mrr)} />}
          />
          <Row
            title="추정 ARR"
            subtitle="MRR × 12"
            trailing={<Money loading={remote.loading} value={revenue && won(revenue.arr)} />}
          />
          <Row
            title="개인 매출"
            subtitle={
              revenue
                ? `이용권 ${revenue.personalCount}건 · 전체의 ${share(revenue.personal, revenue.mrr)}`
                : '살아 있는 개인 이용권의 월 환산 합계예요'
            }
            trailing={<Money loading={remote.loading} value={revenue && won(revenue.personal)} />}
          />
          <Row
            title="학원 매출"
            subtitle={
              revenue
                ? `학원 ${bills.length}곳 · 좌석 ${revenue.academySeatCount.toLocaleString('en-US')}명 · 전체의 ${share(revenue.academy, revenue.mrr)}`
                : '계약 중인 학원의 좌석 청구액 합계예요'
            }
            trailing={<Money loading={remote.loading} value={revenue && won(revenue.academy)} />}
          />
        </Group>
        <AppText variant="caption" tone="tertiary">
          개요 화면과 같은 서버 집계라 두 화면의 MRR이 어긋나지 않아요. 실제 결제·정산 기록이
          아니에요.
        </AppText>
      </Section>

      <Section title={`학원별 월 청구액 (${bills.length}곳)`}>
        {/* 좌석과 상태는 서버 기록이라 배지가 없다. 추정은 금액과 할인뿐이다. */}
        <View style={styles.legend}>
          <SourceBadge source="추정" />
          <AppText variant="caption" tone="secondary">
            월 청구액 · 규모 할인
          </AppText>
        </View>
        <Table
          testID="billing-academy"
          columns={columns}
          rows={bills}
          rowKey={(r) => r.name}
          rowLabel={(r) =>
            `${r.name} ${r.status}, 좌석 ${r.seats}명, 규모 할인 ${
              r.discounted ? `${policy.seatDiscountPct}%` : '없음'
            }, 월 청구액 ${r.status === '이탈' ? '없음' : won(r.amount)}`
          }
          /*
            합계 행은 셀 수 있는 열을 다 채운다 — 좌석을 비워 두면 표가 좌석 합계를 셀 곳이
            없다고 말하는 셈이다. 규모 할인·상태는 더할 수 있는 값이 아니라 비운다.
            좌석과 금액은 둘 다 `rpc_revenue_estimate`에서 와서 표의 행과 같은 집계를 쓴다.
          */
          footer={
            revenue
              ? {
                  name: '합계',
                  seats: `${revenue.academySeatCount.toLocaleString('en-US')}명`,
                  amount: won(revenue.academy),
                }
              : undefined
          }
          empty={{
            title: remote.loading ? '학원 목록을 읽고 있어요' : '청구할 학원이 없어요',
          }}
        />
        {/*
          A-049. 문구를 상수로 박아 두면 청구 규칙이 바뀐 뒤에도 화면이 계속 그렇게 말한다 —
          이탈 행이 실제로 표에 있을 때만 세어 말한다. 학원 목록도 같은 방식이다.
        */}
        {churnedBills.length > 0 ? (
          <AppText variant="caption" tone="tertiary">
            이탈한 학원 {churnedBills.length}곳의 좌석 {churnedSeats.toLocaleString('en-US')}명은
            청구하지 않아요. 목록에는 남겨 두고 금액만 비워요.
          </AppText>
        ) : null}
      </Section>

      <Section title="이 값을 어떻게 쓰나요">
        <Group>
          <Row
            title="개인 이용권 월 환산"
            subtitle="정가 × (1 − 연 결제 비율) + 연 결제가 × 연 결제 비율"
          />
          <Row
            title="학원 청구액"
            subtitle={`좌석 × 좌석 단가. 좌석이 ${policy.seatDiscountFrom}명 이상이면 ${policy.seatDiscountPct}% 할인`}
          />
          <Row title="변경 기록" subtitle="바꾼 값은 운영 기록에 남아요" />
        </Group>
      </Section>
    </Screen>
  );
}

/**
 * 금액 한 칸.
 *
 * 읽는 동안 `₩0`을 쓰지 않는다 — 매출이 0원인 것과 아직 읽지 못한 것은 다른 사실이고,
 * 앞의 것은 사고로 읽힌다.
 */
function Money({ value, loading }: { value: string | null | undefined; loading: boolean }) {
  if (loading || !value) {
    return (
      <AppText variant="label" tone="secondary">
        {loading ? '읽고 있어요' : '기록 없음'}
      </AppText>
    );
  }
  return <SourceValue value={value} source="추정" />;
}

function format(value: number, unit: '원' | '%' | '명'): string {
  if (unit === '원') return won(value);
  return `${value}${unit}`;
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
});
