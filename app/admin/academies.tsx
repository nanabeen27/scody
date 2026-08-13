import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Screen,
  Section,
  Group,
  Row,
  Field,
  Pager,
  useTableSort,
  AppText,
  SourceBadge,
  SourceValue,
  Table,
  type Column,
} from '@/components';
import { usePricing, academyMonthly, won } from '@/features/pricing';
import {
  academyUse,
  asOfLabel,
  useAcademies,
  useAdminOverview,
  useCombined,
  useRevenue,
  type AcademyUse,
} from '@/features/adminMetrics';
import { colors, spacing, typeface } from '@/theme/tokens';

const PAGE_SIZE = 10;

/**
 * 열 정렬. **한 곳에 두고 컬럼과 정렬 훅이 같은 값을 가리킨다.** 오름차순으로 정의하고
 * 내림차순은 표가 뒤집는다. 기본 순서(갱신 임박순)는 `rows`가 이미 세워 둔 그대로다.
 */
const COMPARE: Record<string, (a: AcademyRow, b: AcademyRow) => number> = {
  contract: (a, b) => a.contractSeats - b.contractSeats,
  enrolled: (a, b) => a.enrolled - b.enrolled,
  use: (a, b) => a.usePct - b.usePct,
  // 기록이 없는 값은 어느 방향으로 세워도 맨 뒤다.
  active: (a, b) => (a.active28 ?? -1) - (b.active28 ?? -1),
  renewal: (a, b) => (a.renewalInDays ?? 1e9) - (b.renewalInDays ?? 1e9),
  monthly: (a, b) => a.monthly - b.monthly,
};


/** 이 아래면 갱신 때 이탈로 이어지는 경우가 많다(`adminMetrics`의 `seatUse` 정의와 같은 값). */
const LOW_USE = 60;

interface AcademyRow extends AcademyUse {
  /** 이번 달 청구액 추정. 좌석 단가·규모 할인은 요금제 정책에서 온다. */
  monthly: number;
  low: boolean;
}

/**
 * 학원 목록.
 *
 * **카드를 쓰지 않는다.** 여러 학원을 나란히 비교하는 자리라 값이 같은 x좌표에 서야 읽힌다 —
 * 목록은 `Table`이고 전체 요약만 `Group`+`Row`다. 지표를 타일로 늘어놓으면 비교가 되지 않는다.
 *
 * **기본 정렬은 갱신 임박순**이다. 운영자가 이 화면에 오는 이유는 "다음에 무엇이 만료되는가"이고,
 * 좌석 활용률은 그 판단의 근거다(60% 미만 = 갱신 이탈 선행 신호). 활용률·좌석·청구액 정렬은
 * 열 헤더로 고른다.
 *
 * **행 수는 데이터가 정한다.** 예전에는 `src/data/academies.ts`가 학원 7곳을 생성했다. 지금은
 * `academies` 표가 답하고, 표·정렬·페이저는 행이 하나여도 같은 규칙으로 동작한다.
 */
export default function AdminAcademies() {
  const router = useRouter();
  const { policy } = usePricing();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const academies = useAcademies();
  const overview = useAdminOverview();
  const revenue = useRevenue();
  const { loading, error } = useCombined(academies, overview, revenue);

  const use = useMemo(() => academyUse(academies.data ?? []), [academies.data]);

  const rows = useMemo<AcademyRow[]>(
    () =>
      use
        .map((a) => ({
          ...a,
          monthly: a.status === '이탈' ? 0 : academyMonthly(policy, a.enrolled),
          low: a.status === '계약 중' && a.usePct < LOW_USE,
        }))
        // 이탈한 학원은 갱신할 것이 없어 맨 뒤로 둔다.
        .sort(
          (a, b) =>
            Number(a.status === '이탈') - Number(b.status === '이탈') ||
            (a.renewalInDays ?? 1e9) - (b.renewalInDays ?? 1e9),
        ),
    [use, policy],
  );

  const filtered = useMemo(() => {
    const q = query.trim();
    return q ? rows.filter((a) => a.name.includes(q)) : rows;
  }, [rows, query]);

  const billed = rows.reduce((n, a) => n + a.monthly, 0);
  const lowCount = rows.filter((a) => a.low).length;
  const contractSeats = rows
    .filter((a) => a.status === '계약 중')
    .reduce((n, a) => n + a.contractSeats, 0);
  /**
   * 이탈한 학원의 좌석은 **청구하지 않는다**(A-049).
   *
   * 예전에는 합계에 넣고 문장으로 "아직 들어가 있어요"라고 밝혔다. 이제
   * `rpc_revenue_estimate`가 기본으로 이탈을 빼므로 화면도 빼고, 그 사실을 세어서 말한다 —
   * 이탈 학원이 없으면 문장도 사라진다.
   */
  const churned = rows.filter((a) => a.status === '이탈');
  const churnedSeats = churned.reduce((n, a) => n + a.enrolled, 0);

  const columns: Column<AcademyRow>[] = [
    {
      key: 'name',
      header: '학원',
      // 이름 열은 폭을 고정하지 않는다 — 남는 폭을 이름이 갖는다.
      cell: (r) => (
        <View style={styles.nameCell}>
          <AppText style={styles.name} numberOfLines={1}>
            {r.name}
          </AppText>
          {/* 색만으로 말하지 않는다. 60% 미만은 글자로 밝힌다. */}
          {r.low ? (
            <AppText variant="caption" tone="secondary">
              활용률 낮음
            </AppText>
          ) : null}
        </View>
      ),
    },
    {
      key: 'contract',
      header: '계약 좌석',
      width: 78,
      align: 'right',
      priority: 2,
      // 오름차순으로 정의한다. 내림차순은 표가 뒤집는다(D-074).
      sort: COMPARE.contract,
      cell: (r) => `${r.contractSeats.toLocaleString('en-US')}석`,
    },
    {
      key: 'enrolled',
      header: '재원생',
      width: 72,
      align: 'right',
      priority: 2,
      sort: COMPARE.enrolled,
      cell: (r) => `${r.enrolled.toLocaleString('en-US')}명`,
    },
    {
      key: 'use',
      header: '활용률',
      width: 72,
      align: 'right',
      sort: COMPARE.use,
      cell: (r) => `${r.usePct}%`,
    },
    {
      key: 'active',
      header: '28일 활성',
      width: 96,
      align: 'right',
      priority: 3,
      sort: COMPARE.active,
      // 활동 기록이 아직 없으면 활성 0명이 아니다.
      cell: (r) => (r.active28 == null ? '기록 없음' : `${r.active28.toLocaleString('en-US')}명`),
    },
    {
      key: 'renewal',
      header: '갱신',
      width: 84,
      align: 'right',
      sort: COMPARE.renewal,
      cell: (r) =>
        r.status === '이탈' ? '—' : r.renewalInDays == null ? '기록 없음' : renewalText(r.renewalInDays),
    },
    {
      key: 'monthly',
      header: '월 청구액',
      /*
        좌석 단가를 상한(`PRICING_LIMITS.academySeat.max`)까지 올리면 이 값이
        `₩510,000,000`(13자)까지 자란다 — 요금을 올려 보는 것이 요금제 화면의 목적이라
        기본값 기준으로 폭을 잡으면 그때 조용히 잘린다. 데스크톱 열 합은 여전히 컬럼(960) 안이다.
      */
      width: 132,
      align: 'right',
      priority: 2,
      sort: COMPARE.monthly,
      cell: (r) => (r.status === '이탈' ? '—' : won(r.monthly)),
    },
    { key: 'status', header: '상태', width: 64, cell: (r) => r.status },
  ];

  /**
   * 정렬은 **화면이 쥔다.** 표에 페이지 슬라이스를 넘기므로 표가 스스로 정렬하면 그 10줄
   * 안에서만 줄이 바뀐다(A-050). 이 화면은 `열 이름을 누르면 … 다시 정렬해요`라고 약속하므로
   * 학원이 11곳이 되는 순간 그 문장이 거짓이 됐다.
   */
  const sorted = useTableSort(filtered, COMPARE, () => setPage(0));
  const pageItems = sorted.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <Screen
      wide
      testID="admin-academies"
      title="학원"
      lead="갱신이 가까운 학원부터 봐요."
      scrollResetKey={page}
    >
      <AppText variant="caption" tone="tertiary">
        {asOfLabel(overview.data)} · 청구액은 요금제 설정으로 계산한 추정값이에요.
      </AppText>
      {error ? (
        <AppText variant="caption" tone="secondary">
          학원 목록을 읽지 못했어요. {error}
        </AppText>
      ) : null}

      <Section title="전체 요약">
        <Group>
          <Row
            title="계약 중 학원"
            subtitle="계약이 살아 있는 학원 수예요. 검색과 무관하게 전체를 세요"
            trailing={<Val loading={loading}>{`${overview.data?.academies ?? 0}곳`}</Val>}
          />
          <Row
            title="이탈한 학원"
            subtitle="계약이 끝난 학원이에요. 목록 맨 아래에 둬요"
            trailing={<Val loading={loading}>{`${overview.data?.academiesChurned ?? 0}곳`}</Val>}
          />
          <Row
            title="재원생 합계"
            subtitle="계약 중인 학원의 반에 속한 학생 수(학원별 중복 없이)"
            trailing={
              <Val loading={loading}>{`${(revenue.data?.academySeatCount ?? 0).toLocaleString(
                'en-US',
              )}명`}</Val>
            }
          />
          <Row
            title="계약 좌석 합계"
            subtitle="좌석 활용률의 분모예요"
            trailing={<Val loading={loading}>{`${contractSeats.toLocaleString('en-US')}석`}</Val>}
          />
          <Row
            title="월 청구액 합계"
            subtitle="좌석 × 좌석 단가. 규모 할인을 반영해요"
            trailing={
              loading ? (
                <Val loading>—</Val>
              ) : (
                <SourceValue value={won(billed)} source="추정" />
              )
            }
          />
        </Group>
        {churnedSeats > 0 ? (
          <AppText variant="caption" tone="tertiary">
            이탈한 학원 {churned.length}곳의 재원생 {churnedSeats.toLocaleString('en-US')}명과 그
            좌석 청구액은 합계에서 빼요.
          </AppText>
        ) : null}
      </Section>

      <Field
        testID="academy-search"
        label="학원 이름 검색"
        value={query}
        onChangeText={(t) => {
          setQuery(t);
          setPage(0);
        }}
        placeholder="예: 한빛"
        autoCorrect={false}
      />

      <Section title={`목록 (${filtered.length}곳) · 갱신 임박순`}>
        <AppText variant="caption" tone="secondary">
          좌석 활용률이 {LOW_USE}% 미만이면 갱신에서 이탈로 이어지는 경우가 많아요. 지금{' '}
          {lowCount}곳이고 표에서 활용률 낮음으로 밝혀 뒀어요. 열 이름을 누르면 활용률·좌석·청구액
          기준으로 다시 정렬해요. 28일 활성은 오늘 이전 28일 안에 문항 1개 이상 답을 저장한 학생
          수예요.
        </AppText>
        {/* 좌석·활용률·활성·갱신은 모두 실제 기록이라 배지가 없다. 추정은 월 청구액 하나뿐이다. */}
        <View style={styles.legend}>
          <SourceBadge source="추정" />
          <AppText variant="caption" tone="secondary">
            월 청구액
          </AppText>
        </View>
        <Table
          testID="academy"
          columns={columns}
          rows={pageItems}
          {...sorted.props}
          rowKey={(r) => r.name}
          rowLabel={(r) =>
            `${r.name} ${r.status}, 계약 좌석 ${r.contractSeats}석, 재원생 ${r.enrolled}명, 좌석 활용률 ${r.usePct}%${
              r.low ? ' 활용률 낮음' : ''
            }, 최근 28일 활성 ${r.active28 == null ? '기록 없음' : `${r.active28}명`}, 갱신 ${
              r.status === '이탈'
                ? '없음'
                : r.renewalInDays == null
                  ? '기록 없음'
                  : renewalText(r.renewalInDays)
            }, 월 청구액 ${r.status === '이탈' ? '없음' : won(r.monthly)}`
          }
          // 조인 키는 학원 이름이 아니라 `id`다(D-002의 영구 식별자와 같은 원칙).
          onRowPress={(r) => router.push(`/admin/academy/${r.id}` as never)}
          empty={{
            title: loading ? '학원 목록을 읽고 있어요' : '검색 결과가 없어요',
            subtitle: loading ? '' : '다른 이름으로 찾아 보세요',
          }}
        />
        <Pager
          testID="academies-pager"
          total={filtered.length}
          page={page}
          pageSize={PAGE_SIZE}
          unit="곳"
          onChange={setPage}
        />
      </Section>
    </Screen>
  );
}

/** 값 한 칸. 로딩 중에는 숫자를 쓰지 않는다 — `0곳`이 사실처럼 읽힌다. */
function Val({ children, loading }: { children: string; loading: boolean }) {
  return (
    <AppText variant="label" numeric>
      {loading ? '읽고 있어요' : children}
    </AppText>
  );
}

/** 갱신까지 남은 일수. 지난 것을 `D--3`처럼 쓰지 않는다. */
function renewalText(days: number): string {
  if (days > 0) return `D-${days}`;
  if (days === 0) return '오늘';
  return `지남 ${-days}일`;
}

const styles = StyleSheet.create({
  nameCell: { gap: 2 },
  name: { color: colors.ink, fontFamily: typeface.medium },
  legend: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
});
