import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Screen,
  Section,
  Group,
  Row,
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
} from '@/features/adminMetrics';
import { errorMessage } from '@/lib/supabase';
import { academyClasses, classSubmissions } from '@/repo/admin';
import { spacing } from '@/theme/tokens';

const PAGE_SIZE = 10;

/** 반 한 줄. 반 정보(이름·학생 수)와 제출 집계를 합친 값이다. */
interface ClassRow {
  classId: string;
  name: string;
  students: number;
  assigned: number;
  submitted: number;
  /** 제출률(%). 배정이 없으면 `null`이라 화면에서 `배정 없음`으로 말한다. */
  rate: number | null;
}

/**
 * 열 정렬. **한 곳에 두고 컬럼과 정렬 훅이 같은 값을 가리킨다.** 오름차순으로 정의하고
 * 내림차순은 표가 뒤집는다. **그래서 배정이 없는 반(`rate == null`)은 내림차순에서 맨 앞으로 온다**
 * (A-122) — 이 화면의 기본 정렬에서는 맨 뒤가 맞다.
 */
const COMPARE: Record<string, (a: ClassRow, b: ClassRow) => number> = {
  students: (a, b) => a.students - b.students,
  assigned: (a, b) => a.assigned - b.assigned,
  rate: (a, b) => (a.rate ?? 101) - (b.rate ?? 101),
};

const LOW_USE = 60;

/**
 * 학원 한 곳의 운영 현황.
 *
 * **좌석 활용률이 주 지표다.** 재원생 ÷ 계약 좌석이 60% 미만이면 갱신에서 이탈로 이어진다 —
 * 제출률보다 먼저 봐야 하는 값이라 위에 둔다. 제출률은 그 학원이 제품을 실제로 쓰는지의 증거로
 * 아래에 남긴다.
 *
 * **URL 키는 학원 `id`(uuid)다.** 예전에는 이름 문자열이었고 반·학생도
 * `ACADEMY_CLASSES.filter(c => c.academyName === name)`으로 찾았다 — 학원이 세션에서 만든 반은
 * provider 오버레이에만 있어 여기 오지 않았고, 그래서 제출률·정답률이 **구조적으로 언제나 0**인데
 * 화면은 그 값에 `실측` 배지를 달고 있었다. 지금은 `classes.academy_id`로 조인하고 제출 집계도
 * 서버(`v_assignment_submissions`)에서 온다.
 *
 * 학생 개인 학습 상세는 여기서 열지 않는다(D-014).
 */
export default function AdminAcademyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const academyId = String(id);
  const { policy } = usePricing();
  const [page, setPage] = useState(0);

  const academies = useAcademies();
  const overview = useAdminOverview();
  const head = useCombined(academies, overview);

  const [rows, setRows] = useState<ClassRow[] | null>(null);
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [teachers, setTeachers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  /*
    반·학생·제출을 한 번에 읽는다. 조회를 시작할 때 다시 `loading`으로 올려, 학원을 옮겨 가는
    동안 앞 학원의 제출률이 새 제목 아래에 남지 않게 한다(`ContentProvider`와 같은 순서).
  */
  useEffect(() => {
    let alive = true;
    void (async () => {
      await Promise.resolve();
      if (!alive) return;
      setLoading(true);
      setError(undefined);
      try {
        const classes = await academyClasses(academyId);
        const stats = await classSubmissions(classes.map((c) => c.id));
        if (!alive) return;
        const statOf = new Map(stats.map((s) => [s.classId, s] as const));
        setRows(
          classes
            .map((c) => {
              const s = statOf.get(c.id);
              return {
                classId: c.id,
                name: c.name,
                students: c.studentIds.length,
                assigned: s?.assigned ?? 0,
                submitted: s?.submitted ?? 0,
                rate: s?.rate ?? null,
              };
            })
            // 기본 순서는 제출률 낮은 순. 배정이 없는 반은 판단할 것이 없어 맨 뒤로.
            .sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101)),
        );
        setAssignmentCount(stats.reduce((n, s) => n + s.assignmentCount, 0));
        /*
          학원 전체 평균 정답률은 **반별 정답률을 다시 평균하지 않는다** — 그러면 문항 수 가중이
          무너져 작은 반이 결과를 뒤집는다(D-052). 맞힌 문항과 푼 문항을 그대로 합친다.
        */
        const correct = stats.reduce((n, s) => n + s.correctCount, 0);
        const questions = stats.reduce((n, s) => n + s.questionCount, 0);
        setAccuracy(questions === 0 ? null : Math.round((correct / questions) * 100));
        setTeachers(new Set(classes.map((c) => c.teacherId).filter(Boolean)).size);
      } catch (e) {
        if (alive) setError(errorMessage(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [academyId]);

  const summary = useMemo(
    () => (academies.data ?? []).find((a) => a.id === academyId),
    [academies.data, academyId],
  );
  const use = useMemo(
    () => academyUse(summary ? [summary] : [])[0],
    [summary],
  );

  const totals = useMemo(() => {
    const list = rows ?? [];
    const assigned = list.reduce((n, r) => n + r.assigned, 0);
    const submitted = list.reduce((n, r) => n + r.submitted, 0);
    return {
      assigned,
      submitted,
      rate: assigned ? Math.round((submitted / assigned) * 100) : null,
    };
  }, [rows]);

  const columns: Column<ClassRow>[] = [
    { key: 'name', header: '반', cell: (r) => r.name },
    {
      key: 'students',
      header: '학생',
      width: 72,
      align: 'right',
      priority: 2,
      // 오름차순으로 정의한다. 내림차순은 표가 뒤집는다(D-074).
      sort: COMPARE.students,
      cell: (r) => `${r.students}명`,
    },
    {
      key: 'assigned',
      header: '배정',
      width: 72,
      align: 'right',
      priority: 2,
      sort: COMPARE.assigned,
      cell: (r) => `${r.assigned}건`,
    },
    {
      key: 'submitted',
      header: '제출',
      width: 72,
      align: 'right',
      priority: 2,
      cell: (r) => `${r.submitted}건`,
    },
    {
      key: 'rate',
      header: '제출률',
      width: 84,
      align: 'right',
      sort: COMPARE.rate,
      cell: (r) => (r.rate == null ? '배정 없음' : `${r.rate}%`),
    },
  ];

  /**
   * 정렬은 **화면이 쥔다** — 표에 페이지 슬라이스를 넘기기 때문이다(A-050).
   */
  const sorted = useTableSort(rows ?? [], COMPARE, () => setPage(0));
  const pageItems = sorted.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (!head.loading && !summary) {
    return (
      <Screen testID="admin-academy" backFallback="/admin/academies" title="학원을 찾을 수 없어요">
        <Group>
          <Row title="목록에서 다시 골라 주세요" subtitle="계약이 지워졌거나 잘못된 주소예요" />
        </Group>
      </Screen>
    );
  }

  const usePct = use?.usePct ?? null;
  const low = usePct != null && usePct < LOW_USE;
  const enrolled = summary?.enrolled ?? 0;
  const monthly = summary && summary.status === 'active' ? academyMonthly(policy, enrolled) : 0;

  return (
    <Screen
      wide
      testID="admin-academy"
      backFallback="/admin/academies"
      title={summary?.name ?? '학원'}
      lead="좌석 활용률과 갱신을 먼저 보고, 반별 제출률로 내려가요."
      scrollResetKey={page}
    >
      <AppText variant="caption" tone="tertiary">
        {asOfLabel(overview.data)} · 학생 개인 학습 상세는 여기서 보지 않아요.
      </AppText>
      {error ? (
        <AppText variant="caption" tone="secondary">
          반과 제출 기록을 읽지 못했어요. {error}
        </AppText>
      ) : null}

      <Section title="좌석과 계약">
        <Group>
          <Row
            title="계약 좌석"
            subtitle="좌석 활용률의 분모예요"
            trailing={
              <Val loading={head.loading}>
                {summary ? `${summary.contractSeats.toLocaleString('en-US')}석` : '기록 없음'}
              </Val>
            }
          />
          <Row
            title="재원생"
            subtitle="학원 반에 속한 학생 수(중복 없이)"
            trailing={
              <Val loading={head.loading}>{`${enrolled.toLocaleString('en-US')}명`}</Val>
            }
          />
          <Row
            title="좌석 활용률"
            subtitle={
              low
                ? `재원생 ÷ 계약 좌석. ${LOW_USE}% 미만이라 갱신을 먼저 확인해요`
                : `재원생 ÷ 계약 좌석. ${LOW_USE}% 미만이면 갱신 이탈 선행 신호예요`
            }
            trailing={
              <Val loading={head.loading}>
                {usePct == null ? '기록 없음' : `${usePct}%${low ? ' · 낮음' : ''}`}
              </Val>
            }
          />
          <Row
            title="최근 28일 활성"
            subtitle="오늘 이전 28일 안에 문항 1개 이상 답을 저장한 학생 수예요"
            trailing={
              <Val loading={head.loading}>
                {use?.active28 == null
                  ? '기록 없음'
                  : `${use.active28.toLocaleString('en-US')}명`}
              </Val>
            }
          />
          <Row
            title="갱신일"
            subtitle={`계약 상태 ${use?.status ?? '기록 없음'}`}
            trailing={
              <Val loading={head.loading}>
                {summary?.renewalDate
                  ? `${summary.renewalDate}${
                      use && use.status === '계약 중' && use.renewalInDays != null
                        ? ` · ${renewalText(use.renewalInDays)}`
                        : ''
                    }`
                  : '기록 없음'}
              </Val>
            }
          />
          <Row
            title="월 청구액"
            subtitle={
              summary?.status === 'churned'
                ? '계약이 끝나 청구하지 않아요'
                : enrolled >= policy.seatDiscountFrom
                  ? `좌석 × 단가 · 규모 할인 ${policy.seatDiscountPct}% 적용`
                  : '좌석 × 단가 · 할인 없음'
            }
            trailing={
              head.loading ? (
                <Val loading>—</Val>
              ) : (
                <SourceValue value={summary?.status === 'churned' ? '없음' : won(monthly)} source="추정" />
              )
            }
          />
          <Row
            title="반"
            subtitle="이 학원의 반 수예요"
            trailing={
              <Val loading={loading}>{`${(rows?.length ?? 0).toLocaleString('en-US')}개`}</Val>
            }
          />
          <Row
            title="선생님"
            subtitle="반을 맡고 있는 선생님 수예요(원장은 세지 않아요)"
            trailing={<Val loading={loading}>{`${teachers.toLocaleString('en-US')}명`}</Val>}
          />
        </Group>
      </Section>

      <Section title="배정 학습 제출률">
        <Group>
          <Row
            title="제출한 배정"
            subtitle={`배정 ${assignmentCount}건 · 학생 한 명이 낼 것을 한 건으로 세요`}
            trailing={
              <Val loading={loading}>
                {totals.assigned ? `${totals.submitted}/${totals.assigned}건` : '배정 없음'}
              </Val>
            }
          />
          <Row
            title="제출률"
            subtitle="낸 건 ÷ 내야 할 건"
            trailing={
              <Val loading={loading}>{totals.rate == null ? '배정 없음' : `${totals.rate}%`}</Val>
            }
          />
          <Row
            title="평균 정답률"
            subtitle="문항 수로 가중한 값이라 학부모 리포트와 같은 값을 말해요"
            trailing={
              <Val loading={loading}>{accuracy == null ? '기록 없음' : `${accuracy}%`}</Val>
            }
          />
        </Group>
        <AppText variant="caption" tone="tertiary">
          배정과 제출은 서버 기록이에요. 이 학원이 실제로 낸 것만 세요.
        </AppText>
      </Section>

      <Section title={`반 (${rows?.length ?? 0}개) · 제출률 낮은 순`}>
        {/* 학생 수·배정·제출·제출률이 모두 서버 기록이라 배지를 두지 않는다. */}
        <View style={styles.legend}>
          <SourceBadge source="추정" />
          <AppText variant="caption" tone="secondary">
            월 청구액만 추정이에요
          </AppText>
        </View>
        <Table
          testID="academy-class"
          columns={columns}
          rows={pageItems}
          {...sorted.props}
          rowKey={(r) => r.classId}
          rowLabel={(r) =>
            `${r.name} 학생 ${r.students}명, 배정 ${r.assigned}건, 제출 ${r.submitted}건, 제출률 ${
              r.rate == null ? '배정 없음' : `${r.rate}%`
            }`
          }
          empty={{
            title: loading ? '반을 읽고 있어요' : '아직 반이 없어요',
            subtitle: loading ? '' : '학원이 반을 만들면 여기에 나와요',
          }}
        />
        <Pager
          testID="academy-class-pager"
          total={rows?.length ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          onChange={setPage}
        />
      </Section>
    </Screen>
  );
}

/** 값 한 칸. 로딩 중에는 숫자를 쓰지 않는다 — `0명`이 사실처럼 읽힌다. */
function Val({ children, loading }: { children: string; loading: boolean }) {
  return (
    <AppText variant="label" numeric>
      {loading ? '읽고 있어요' : children}
    </AppText>
  );
}

function renewalText(days: number): string {
  if (days > 0) return `D-${days}`;
  if (days === 0) return '오늘';
  return `지남 ${-days}일`;
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
});
