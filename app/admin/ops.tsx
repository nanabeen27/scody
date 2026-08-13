import { useMemo, useState } from 'react';
import { Screen, Section, Group, Row, SegmentedControl, AppText, type SegmentedOption } from '@/components';
import { useAudit, auditTime, AUDIT_LIMIT, type AuditAction } from '@/features/audit';
import { usePricing, DEFAULT_PRICING, won, type PricingPolicy } from '@/features/pricing';
import { useContent } from '@/features/content';
import {
  ACTIVITY_WEEKS,
  CHURN_WINDOW_DAYS,
  MAU_WINDOW_DAYS,
  activityStats,
  useActivityData,
  useAdminOverview,
} from '@/features/adminMetrics';

type Filter = '전체' | AuditAction;

/** 필터로 쓸 수 있는 분류. 순서는 칩 순서다. */
const ACTIONS: readonly AuditAction[] = ['요금 정책', '콘텐츠', '계정', '대리 보기', '기타'];

const LABELS: Record<keyof PricingPolicy, string> = {
  studentPaid: '개인 월정액 · 학생 결제',
  parentPaid: '개인 월정액 · 학부모 결제',
  academySeat: '학원 좌석 단가',
  seatDiscountPct: '학원 규모 할인율',
  seatDiscountFrom: '규모 할인 시작 좌석',
  annualDiscountPct: '연 결제 할인율',
  annualSharePct: '연 결제 비율',
};

/** 항목별 단위. 비율을 단위 없이 적으면 "현재 20"처럼 읽혀 무슨 값인지 알 수 없다. */
const UNITS: Record<keyof PricingPolicy, '원' | '%' | '명'> = {
  studentPaid: '원',
  parentPaid: '원',
  academySeat: '원',
  seatDiscountPct: '%',
  seatDiscountFrom: '명',
  annualDiscountPct: '%',
  annualSharePct: '%',
};

function format(key: keyof PricingPolicy, value: number): string {
  const unit = UNITS[key];
  return unit === '원' ? won(value) : `${value}${unit}`;
}

/**
 * 운영 기록. 무엇을 바꿨는지(감사 로그)와 화면의 숫자가 어디서 왔는지(데이터 출처)를 한곳에 둔다.
 * 숫자를 믿을 수 있게 만드는 화면이라 지표 타일을 두지 않는다.
 *
 * **이 화면은 자기 자신에 대해서도 정직해야 한다.**
 * - 필터 칩은 **기록이 실제로 생긴 분류만** 그린다. 모든 분류를 두면 호출부가 없는 분류를
 *   눌렀을 때 빈 목록이 나오는 죽은 버튼이 된다(D-036·D-042와 같은 판단).
 * - 빈 상태 문구는 실제로 기록되는 조작만 말한다. "콘텐츠를 바꾸면 남아요"라고 적어 두고
 *   기록이 없으면 이 화면 전체를 못 믿게 된다.
 * - 값은 `meta`(`inkTertiary`, 대비 3.23:1)에 두지 않는다. 판단에 쓰는 값은 `trailing`의
 *   `label`이고, `meta`에는 값이 아닌 분류만 남긴다.
 *
 * 상위 탭 화면이라 `backFallback`을 두지 않는다(CLAUDE.md 내비게이션).
 */
export default function AdminOps() {
  const { entries, loading: auditLoading } = useAudit();
  const { policy, loading: pricingLoading } = usePricing();
  const { sets } = useContent();
  const [filter, setFilter] = useState<Filter>('전체');

  /** 분류별 건수. 0건인 분류는 칩을 만들지 않는다. */
  const options: readonly SegmentedOption<Filter>[] = useMemo(() => {
    const withCount = ACTIONS.map((a) => ({
      value: a as Filter,
      label: a,
      count: entries.filter((e) => e.action === a).length,
    })).filter((o) => o.count > 0);
    return [{ value: '전체' as Filter, label: '전체', count: entries.length }, ...withCount];
  }, [entries]);

  const shown = filter === '전체' ? entries : entries.filter((e) => e.action === filter);

  // 기본값과 다른 요금 항목. 지금 서비스가 어떤 정책으로 돌고 있는지 한눈에 본다.
  const overrides = (Object.keys(DEFAULT_PRICING) as (keyof PricingPolicy)[])
    .filter((k) => policy[k] !== DEFAULT_PRICING[k])
    .map((k) => ({
      key: k,
      label: LABELS[k],
      from: format(k, DEFAULT_PRICING[k]),
      to: format(k, policy[k]),
    }));

  const questionCount = sets.reduce((n, s) => n + s.questions.length, 0);

  /** 화면의 숫자가 어디서 왔는지 말하려면 그 원천을 실제로 읽어야 한다. */
  const overview = useAdminOverview();
  const activity = useActivityData();
  const stats = useMemo(
    () =>
      activityStats(
        activity.data?.events ?? [],
        activity.data?.daily ?? [],
        overview.data?.students ?? 0,
      ),
    [activity.data, overview.data],
  );

  return (
    <Screen
      wide
      testID="admin-ops"
      title="운영 기록"
      lead="설정을 누가 언제 바꿨는지, 화면의 숫자가 어디서 왔는지 확인해요."
    >
      <Section
        title={
          pricingLoading
            ? '현재 요금 정책'
            : `현재 요금 정책 (기본값과 다른 항목 ${overrides.length}개)`
        }
      >
        <Group>
          {/*
            읽는 동안 `모두 기본값이에요`라고 말하지 않는다 — 정책은 서버에서 오고, 조회가
            끝나기 전 화면에 있는 값은 기준값이라 그 문장이 항상 참으로 보인다.
          */}
          {pricingLoading ? (
            <Row title="요금 정책을 불러오고 있어요" subtitle="잠깐만 기다려 주세요" />
          ) : overrides.length ? (
            overrides.map((o) => (
              <Row
                key={o.key}
                title={o.label}
                subtitle={`기본값 ${o.from}`}
                trailing={<AppText variant="label">{`현재 ${o.to}`}</AppText>}
              />
            ))
          ) : (
            <Row title="모두 기본값이에요" subtitle="요금제 화면에서 바꾼 항목이 없어요" />
          )}
        </Group>
      </Section>

      <Section
        title={
          auditLoading
            ? '변경 기록'
            : `변경 기록 (${entries.length >= AUDIT_LIMIT ? `최근 ${entries.length}` : entries.length}건)`
        }
      >
        {/*
          고를 것이 하나뿐이면 칩을 그리지 않는다. 기록이 0건인 새 세션에는 `전체 0`만 남아
          **이미 선택된 채 놓인 선택 컨트롤**이 된다 — 개수는 섹션 제목이 이미 말한다
          (D-036·D-042가 막으려던 죽은 버튼과 같은 모양).
        */}
        {!auditLoading && options.length > 1 ? (
          <SegmentedControl testID="ops-filter" options={options} value={filter} onChange={setFilter} />
        ) : null}
        <Group>
          {/*
            **읽는 동안 `기록이 없어요`라고 말하지 않는다.** 기록은 서버에서 오고, 첫 조회가
            끝나기 전에는 목록이 빈 배열이다 — 그 순간의 빈 상태는 사실이 아니다.
          */}
          {auditLoading ? (
            <Row title="기록을 불러오고 있어요" subtitle="잠깐만 기다려 주세요" />
          ) : shown.length ? (
            shown.map((e) => (
              <Row
                key={e.id}
                testID={`ops-row-${e.id}`}
                title={e.detail}
                /*
                  시각은 판단에 쓰는 값이라 `meta`(`inkTertiary`, 대비 3.23:1)에 두지 않는다.
                  학부모 리포트가 정답률에 쓴 방식대로 subtitle 맨 앞이다(DESIGN.md 19절).
                  `trailing`으로 옮기면 긴 `detail`이 390에서 눌린다.
                */
                subtitle={`${auditTime(e.atISO)} · ${e.action} · ${e.actor}`}
              />
            ))
          ) : (
            /*
              어느 조작이 남는지 열거하지 않는다 — 열거하면 호출부가 늘 때마다 문구가 낡는다
              (D-065 ④. 실제로 `대리 보기`가 늘면서 이미 낡았다).
            */
            <Row
              title="아직 기록이 없어요"
              subtitle="서비스 전체에 영향을 주는 조작을 하면 여기에 남아요"
            />
          )}
        </Group>
        <AppText variant="caption" tone="tertiary">
          모든 조작이 남는 것은 아니에요.
          {!auditLoading && options.length > 1 ? ' 기록이 생긴 분류만 위에 칩으로 보여 줘요.' : ''}
        </AppText>
        <AppText variant="caption" tone="tertiary">
          기록은 서버에 남고 고치거나 지울 수 없어요. 이 목록은 최근 {AUDIT_LIMIT}건까지 보여
          줘요.
        </AppText>
      </Section>

      <Section title="이 숫자는 어디서 왔나요">
        <Group>
          <Row
            title="계정 · 학원 · 반"
            subtitle="서버의 계정·학원·반 표를 그대로 세요"
            trailing={
              <Val loading={overview.loading}>
                {overview.data
                  ? `계정 ${overview.data.accounts.toLocaleString('en-US')} · 학원 ${
                      overview.data.academies
                    } · 반 ${overview.data.classes}`
                  : '기록 없음'}
              </Val>
            }
          />
          <Row
            title="콘텐츠 · 문항"
            subtitle="서버에 등록된 콘텐츠 세트와 문항이에요"
            trailing={
              <AppText variant="label">{`세트 ${sets.length} · 문항 ${questionCount}`}</AppText>
            }
          />
          <Row
            title="배정 · 제출"
            subtitle="배정 대상 행과 제출된 풀이에서 세요. 새로고침해도 남아요"
            trailing={
              <Val loading={overview.loading}>
                {overview.data
                  ? `풀이 ${overview.data.attemptsTotal.toLocaleString('en-US')}건`
                  : '기록 없음'}
              </Val>
            }
          />
          <Row
            title="활동 기록 · 지표"
            subtitle={
              stats.firstDay
                ? `MAU·리텐션·Activation은 학습 이벤트에서 계산해요. 기록은 ${stats.firstDay}부터 ${stats.recordedDays}일치예요`
                : '아직 학습 이벤트가 없어요. 활성·리텐션은 기록이 모이면 값이 나와요'
            }
            trailing={
              <Val loading={activity.loading}>
                {stats.mau == null ? '기록 없음' : `MAU ${stats.mau.toLocaleString('en-US')}`}
              </Val>
            }
          />
          <Row
            title="지표의 기준일과 창"
            subtitle={`운영자 지표는 실제 오늘을 기준으로 최근 ${ACTIVITY_WEEKS}주를 봐요. 활성은 ${MAU_WINDOW_DAYS}일 rolling, 이탈 판정은 ${CHURN_WINDOW_DAYS}일이에요`}
            meta="실제 시계"
          />
          <Row
            title="풀이 횟수 · 문항 오답률"
            subtitle="실제 풀이와 문항별 정오에서 서버가 세요. 기록이 없으면 값 대신 그 사실을 적어요"
            meta="서버 집계"
          />
          <Row
            title="요금·매출"
            subtitle="요금제 정책으로 계산한 추정값이에요. 실제 결제·정산 기록이 아니에요"
            meta="추정"
          />
        </Group>
        <AppText variant="caption" tone="tertiary">
          기록이 짧아 아직 낼 수 없는 지표는 0으로 채우지 않고 그 이유를 적어요. 정의와 수식은
          개요의 지표 사전에 모아 뒀어요.
        </AppText>
      </Section>

      <Section title="아직 없는 것">
        <Group>
          <Row
            title="실제 인증·서버 권한"
            subtitle="지금은 클라이언트 provider에서만 막고 있어요"
          />
          {/*
            **이 목록도 사실이어야 한다.** 계정·학습·요금 정책·운영 기록은 서버에 남는다 —
            `새로고침하면 사라져요`를 그대로 두면 방금 남은 감사 로그까지 못 믿게 된다(D-065).
            아직 세션에만 남는 것은 화면 안에서만 쓰는 값이다.
          */}
          <Row
            title="세션에만 남는 상태"
            subtitle="학생이 학원 연결을 끊은 상태처럼 화면 안에서만 쓰는 값은 새로고침하면 돌아가요"
          />
          <Row title="결제·정산 연동" subtitle="승인·영수증·갱신·환불이 없어요" />
          <Row
            title="조작 전체를 남기는 감사 로그"
            subtitle="남은 기록은 서버에서 고치거나 지울 수 없어요. 다만 모든 조작이 남는 것은 아니고, 보관 기간 정책도 아직 없어요"
          />
          <Row
            title="기간이 필요한 지표"
            subtitle={`코호트 잔존·Quick Ratio·${CHURN_WINDOW_DAYS}일 이탈은 그만큼의 기록이 쌓여야 나와요. 지금은 값 대신 그 사실을 적어요`}
          />
        </Group>
      </Section>
    </Screen>
  );
}

/** 값 한 칸. 읽는 동안 숫자를 쓰지 않는다 — `계정 0`이 사실처럼 읽힌다. */
function Val({ children, loading }: { children: string; loading: boolean }) {
  return (
    <AppText variant="label" numeric>
      {loading ? '읽고 있어요' : children}
    </AppText>
  );
}
