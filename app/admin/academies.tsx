import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Screen,
  Section,
  Group,
  Icon,
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
  type Query,
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
  // 기록이 없는 값은 오름차순에서 맨 뒤다. **내림차순에서는 맨 앞으로 온다**(A-122).
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

  /*
    **읽는 중 · 실패 · 없음을 셋으로 가른다**(D-136 · `DESIGN.md` §9). 예전에는 실패가
    화면 첫 줄의 조용한 한 줄뿐이어서 다시 시도할 방법이 없었고, 표는 실패했을 때도
    `검색 결과가 없어요 · 다른 이름으로 찾아 보세요`라고 말했다 — 원인은 이름이 아니다.
  */
  /**
   * 손에 든 학원 목록이 있는가. **게이트는 `loading`이 아니라 이 값이다**(D-168) —
   * `loading`으로 걸면 `다시 불러오기`를 누르는 동안 목록이 사라져 방금 본 것을 다시 찾아야 한다.
   * 조회가 실패하면 `useQuery`가 `data`를 `null`로 남기므로 이 값도 거짓이 된다.
   */
  const hasList = academies.data != null;
  /**
   * 화면에 띄울 실패 문장. **다시 읽는 중에는 감춘다** — 실패 문장과 `읽고 있어요`가 함께 서면
   * 지금 무슨 일이 일어나는지 알 수 없다.
   */
  const failed = loading ? null : error;
  /**
   * 무엇을 못 읽었는지 밝힌다. 목록은 왔는데 개요·매출이 실패한 경우에 `학원 목록을 읽지
   * 못했어요`라고 하면, 바로 아래에 목록이 보이는 화면이 자기 안에서 다른 말을 한다.
   */
  const failedWhat = academies.error ? '학원 목록' : '전체 요약';
  /** 세 조회를 함께 다시 시도한다. 실패가 어느 쪽에서 왔는지 운영자가 고를 일은 아니다. */
  function retryLoad() {
    academies.reload();
    overview.reload();
    revenue.reload();
  }

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
    /*
      **이 표가 눌린다는 사실을 화면이 말한다**(D-084 ③ · `DESIGN.md` §8·§20). `rowLabel`도
      캡션도 그 말을 하지 않았고, `Table`은 `onRowPress`가 있어도 스스로 표시를 만들지 않는다.
      학원 쪽 표 셋과 같은 열이고, `priority`를 주지 않아 어떤 폭에서도 포기하지 않는다.
      좁은 화면(컬럼 560 미만)은 쌓기로 가고, `header`가 빈 열이라 제목 줄 오른쪽에 붙는다.
    */
    {
      key: 'go',
      header: '',
      width: 24,
      cell: () => <Icon name="chevron-right" size={18} color={colors.inkTertiary} />,
    },
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
      {/*
        기준일은 **읽은 뒤에만 적는다.** `asOfLabel`은 개요가 없으면 오늘 날짜로 떨어지므로,
        조회가 실패한 화면 맨 위에 `2026-08-18 기준`이 사실처럼 남았다. 추정 고지는 요금제
        설정에서 계산하는 값에 대한 말이라 조회와 무관하게 늘 둔다.
      */}
      <AppText variant="caption" tone="tertiary">
        {overview.data ? `${asOfLabel(overview.data)} · ` : ''}청구액은 요금제 설정으로 계산한
        추정값이에요.
      </AppText>
      {/*
        **실패 면은 한 화면에 하나다**(`DESIGN.md` §9). 요약·목록·청구액이 모두 이 세 조회에
        매달려 있어 자리마다 두지 않고 맨 위에 한 줄만 둔다. 인라인 `danger` 캡션 + 다시 시도할
        행동 하나이고, 기준 구현은 `app/student/index.tsx`의 `home-load-failed`다.
      */}
      {failed ? (
        <View testID="academies-load-failed" style={styles.loadFailed}>
          <AppText variant="caption" tone="danger">
            {failedWhat}을 읽지 못했어요. {failed}
          </AppText>
          {/* 다시 시도는 이 화면의 주 행동이 아니다 — `hug`인 보조 버튼이다(§8). */}
          <Button
            testID="academies-load-retry"
            variant="secondary"
            hug
            label="다시 불러오기"
            onPress={retryLoad}
          />
        </View>
      ) : null}

      <Section title="전체 요약">
        <Group>
          <Row
            title="계약 중 학원"
            subtitle="계약이 살아 있는 학원 수예요. 검색과 무관하게 전체를 세요"
            trailing={<Val state={stateOf(overview)}>{`${overview.data?.academies ?? 0}곳`}</Val>}
          />
          <Row
            title="이탈한 학원"
            subtitle="계약이 끝난 학원이에요. 목록 맨 아래에 둬요"
            trailing={
              <Val state={stateOf(overview)}>{`${overview.data?.academiesChurned ?? 0}곳`}</Val>
            }
          />
          <Row
            title="재원생 합계"
            subtitle="계약 중인 학원의 반에 속한 학생 수(학원별 중복 없이)"
            trailing={
              <Val state={stateOf(revenue)}>{`${(revenue.data?.academySeatCount ?? 0).toLocaleString(
                'en-US',
              )}명`}</Val>
            }
          />
          <Row
            title="계약 좌석 합계"
            subtitle="좌석 활용률의 분모예요"
            /* 좌석 합계와 청구액은 학원 목록에서 센다 — 개요·매출이 늦어도 이 값은 사실이다. */
            trailing={
              <Val state={stateOf(academies)}>{`${contractSeats.toLocaleString('en-US')}석`}</Val>
            }
          />
          <Row
            title="월 청구액 합계"
            subtitle="좌석 × 좌석 단가. 규모 할인을 반영해요"
            trailing={
              stateOf(academies) === 'ready' ? (
                <SourceValue value={won(billed)} source="추정" />
              ) : (
                <Val state={stateOf(academies)}>—</Val>
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

      {/* 목록을 아직 읽지 못했으면 제목에 개수를 넣지 않는다 — `목록 (0곳)`이 사실처럼 읽힌다. */}
      <Section title={hasList ? `목록 (${filtered.length}곳) · 갱신 임박순` : '목록 · 갱신 임박순'}>
        <AppText variant="caption" tone="secondary">
          좌석 활용률이 {LOW_USE}% 미만이면 갱신에서 이탈로 이어지는 경우가 많아요.
          {/* 몇 곳인지는 목록을 읽은 뒤에만 말한다 — 읽는 중에 센 `0곳`은 사실이 아니다(D-133). */}
          {hasList ? ` 지금 ${lowCount}곳이고 표에서 활용률 낮음으로 밝혀 뒀어요.` : ''} 열 이름을
          누르면 활용률·좌석·청구액 기준으로 다시 정렬해요. 28일 활성은 오늘 이전 28일 안에 문항
          1개 이상 답을 저장한 학생 수예요.
        </AppText>
        {/*
          **누를 행이 있을 때만 행 누르기를 약속한다.** 위 캡션 안에 끼워 넣으면 한 문장에 여러
          가지가 되고, 표가 비었거나 읽는 중일 때도 그 말이 남는다(`admin/users.tsx`와 같은 형태).
        */}
        {pageItems.length > 0 ? (
          <AppText variant="caption" tone="secondary">
            행을 누르면 학원 상세로 가요.
          </AppText>
        ) : null}
        {/*
          아직 읽은 목록이 없을 때는 표 안 빈 자리가 말한다(`empty`의 첫 갈래). 이 캡션은
          **이미 읽어 둔 목록을 다시 읽는 중**에만 필요하다: 그때는 행이 남아 있어 빈 자리가
          그려지지 않고(D-168), `다시 불러오기`를 누른 운영자에게 아무 말도 하지 않으면
          눌렸는지조차 알 수 없다.
        */}
        {academies.loading && hasList ? (
          <AppText variant="caption" tone="secondary">
            학원 목록을 다시 읽고 있어요.
          </AppText>
        ) : null}
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
          /*
            **빈 자리를 셋으로 가른다.** 실패에 `다른 이름으로 찾아 보세요`라고 하면 화면이
            원인이 아닌 것을 고치라고 시킨다. 실패 갈래는 서버 문장을 다시 적지 않고
            맨 위의 실패 면 하나를 가리킨다 — 같은 실패를 두 번 말하지 않는다(§9).

            **판단은 학원 조회 하나만 본다.** 개요·매출이 실패한 것은 이 표가 비어 있는 이유가
            아니다 — 그때 표가 비었으면 검색 결과가 없는 것이다. 목록을 들고 있으면(`hasList`)
            다시 읽는 중에도 행이 남아 이 자리는 아예 그려지지 않는다(D-168).
          */
          empty={
            academies.loading && !hasList
              ? { title: '학원 목록을 읽고 있어요' }
              : !hasList && academies.error
                ? { title: '학원 목록을 읽지 못했어요', subtitle: '위에서 다시 불러올 수 있어요' }
                : { title: '검색 결과가 없어요', subtitle: '다른 이름으로 찾아 보세요' }
          }
        />
        {/* 개수를 셀 수 없는 동안에는 페이저도 두지 않는다 — `0곳 중 0–0`이 결과처럼 읽힌다. */}
        {hasList ? (
          <Pager
            testID="academies-pager"
            total={filtered.length}
            page={page}
            pageSize={PAGE_SIZE}
            unit="곳"
            onChange={setPage}
          />
        ) : null}
      </Section>
    </Screen>
  );
}

/** 요약 값 한 칸이 말할 수 있는 세 가지. 읽는 중과 실패를 같은 문장으로 말하지 않는다. */
type ValState = 'ready' | 'reading' | 'failed';

/**
 * 조회 하나의 상태를 값 칸이 말할 문장으로 바꾼다.
 *
 * **조회마다 따로 본다.** 세 조회를 묶어서 판단하면 매출 하나가 실패했을 때 개요에서 이미 읽어
 * 둔 학원 수까지 `아직 못 읽었어요`가 된다 — 가진 것은 여전히 사실이다(`DESIGN.md` §9).
 * 값을 들고 있으면 다시 읽는 중에도 그 값을 그대로 보여 준다(D-168).
 */
function stateOf(q: Query<unknown>): ValState {
  if (q.data != null) return 'ready';
  return q.loading ? 'reading' : 'failed';
}

/**
 * 값 한 칸.
 *
 * 읽는 중에는 숫자를 쓰지 않는다 — `0곳`이 사실처럼 읽힌다. **실패했을 때 `읽고 있어요`라고
 * 하지 않는다**: 예전에는 `loading`만 봤으므로 조회가 실패한 화면이 영구히 읽는 중으로 남았다.
 */
function Val({ children, state }: { children: string; state: ValState }) {
  if (state === 'ready') {
    return (
      <AppText variant="label" numeric>
        {children}
      </AppText>
    );
  }
  return (
    <AppText variant="label" tone="secondary">
      {state === 'reading' ? '읽고 있어요' : '아직 못 읽었어요'}
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
  /** 실패 문장과 다시 시도. 폭은 내용만큼이다(`app/student/index.tsx`와 같은 값). */
  loadFailed: { gap: spacing.sm, alignItems: 'flex-start' },
  nameCell: { gap: 2 },
  name: { color: colors.ink, fontFamily: typeface.medium },
  legend: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
});
