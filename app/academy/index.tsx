import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  ActionBar,
  BarRow,
  Disclosure,
  Screen,
  Section,
  Group,
  Row,
  Button,
  AppText,
  Icon,
  Pager,
  ProgressBar,
  SegmentedControl,
  Sparkline,
  sparkLabel,
  Table,
  useTableSort,
  type Column,
} from '@/components';
import { useCurrentAccount, useSession } from '@/session';
import { useAcademyStaff } from '@/features/academy';
import { useProgress } from '@/features/progress';
import { useContent } from '@/features/content';
import {
  accuracyDistribution,
  areaBreakdown,
  byClass,
  classNameOf,
  classPerformance,
  deltaOf,
  dueSoon,
  gradeBreakdown,
  hardestQuestions,
  HARD_MIN_ANSWERS,
  lastCompleteWeek,
  overdueAssignments,
  pendingStat,
  scopedAssignments,
  submitStat,
  weeklySeries,
  weightedAccuracy,
  withinWeeks,
  type ClassPerf,
  type GradeStat,
  type HardQuestion,
  type WeekPoint,
} from '@/features/academyStats';
import { dueLabel, formatDate } from '@/features/learning';
import { todayISO } from '@/features/clock';
import { findContent, type AcademyClass, type Assignment, type ContentSet } from '@/data';
import { useColumn } from '@/theme/useColumn';
import { colors, spacing, typeface } from '@/theme/tokens';

/** 한 섹션에 보여 주는 목록 길이. 나머지는 성과 분석·반 목록·학생 목록이 맡는다. */
const PREVIEW = 5;
/** 반별 현황 표 한 페이지. */
const CLASS_PAGE = 10;
/**
 * 이 오답률 이상이면 `해설을 다시 볼 문항이에요`를 글자로 붙인다.
 * 운영자 콘텐츠 상세가 이미 같은 임계를 쓴다(D-075 · DESIGN.md 20절) — 두 화면이 같은 문항을
 * 다른 기준으로 가르면 어느 쪽도 믿을 수 없다.
 */
const HARD_WRONG_RATE = 70;

const RANGES = [
  { value: '4', label: '4주' },
  { value: '12', label: '12주' },
  { value: '26', label: '26주' },
] as const;

/**
 * 학원 대시보드.
 *
 * **맨 위가 지표와 추이다.** 예전에는 `확인이 필요해요` → `학습 배정하기` → `StatTiles` 순서였고,
 * 타일 5개가 390에서 528px·1280에서 오른쪽 620px을 먹어 판단에 쓰는 값이 늘 화면 밖에 있었다.
 * 여러 대상을 나란히 놓는 자리는 표, 시간은 추이선, 비율 비교는 가로 막대다(D-070과 같은 판단).
 *
 * 집계는 전부 `src/features/academyStats.ts`에서 온다 — 대시보드가 따로 계산하면
 * 같은 반에 대해 성과 분석·학부모 리포트와 다른 숫자를 말한다(D-061).
 * **세는 단위를 라벨에 못박는다**: 사람은 `명`, 배정 건은 `건`.
 *
 * 원장과 선생님은 **범위와 시야**가 다르다 — 원장은 학원 전체를 추세로, 선생님은 담당 반을
 * 오늘 기준으로 본다.
 */
export default function AcademyDashboard() {
  const router = useRouter();
  const account = useCurrentAccount();
  const { accountOf } = useSession();
  const { assignments } = useProgress();
  const { classesFor, isActiveTeacher } = useAcademyStaff();
  const { sets } = useContent();
  const isDirector = account.academyRole === 'director';
  const today = todayISO();
  /** 좁은 컬럼(390)인가. 추이를 접을지 판단한다. */
  const { isMobile: narrowCol } = useColumn();
  const [range, setRange] = useState<'4' | '12' | '26'>('12');
  const weeks = Number(range);

  // 원장은 학원 전체 반, 선생님은 담당 반만 본다(`classesFor`가 권한 경계다).
  const classes = useMemo(() => classesFor(account), [account, classesFor]);
  const studentCount = useMemo(() => new Set(classes.flatMap((c) => c.studentIds)).size, [classes]);
  const scoped = useMemo(() => scopedAssignments(classes, assignments), [classes, assignments]);

  /**
   * **기간 토글이 닿는 범위.** 마감주가 최근 `weeks`주 안에 드는 배정만 남긴다.
   *
   * 여기서 나온 값과 추이선은 **같은 축** 위에 선다 — 예전에는 `값`이 전 기간 누적이고
   * `변화`·`추이`만 주간이라 `4주`↔`26주`를 바꿔도 값이 움직이지 않았다(D-076 ⑤).
   * **지금 상태를 말하는 것**(안 낸 학생, 마감이 지난 미제출, 오늘·이번 주 마감, 반·학생 수)은
   * 기간과 무관하므로 `scoped`를 그대로 쓴다.
   */
  const rangeScoped = useMemo(
    () => withinWeeks(scoped, weeks, lastCompleteWeek(today)),
    [scoped, weeks, today],
  );

  const submitRows = useMemo(() => {
    const rows = rangeScoped.flatMap((a) => a.submissions);
    return { total: rows.length, submitted: rows.filter((s) => s.submitted).length };
  }, [rangeScoped]);
  const pending = useMemo(() => pendingStat(scoped), [scoped]);
  const overdue = useMemo(() => overdueAssignments(scoped, today), [scoped, today]);
  const due = useMemo(() => dueSoon(scoped, today), [scoped, today]);
  const dueTodayPending = useMemo(() => pendingStat(due.today), [due.today]);
  const avgAccuracy = useMemo(() => weightedAccuracy(rangeScoped), [rangeScoped]);

  /** 끝난 주까지의 추이. 진행 중인 이번 주를 넣으면 마지막 점이 늘 바닥으로 떨어진다. */
  const series = useMemo(
    () => weeklySeries(rangeScoped, weeks, lastCompleteWeek(today)),
    [rangeScoped, weeks, today],
  );
  const submitRate =
    submitRows.total > 0 ? Math.round((submitRows.submitted / submitRows.total) * 100) : null;

  const perf = useMemo(() => classPerformance(classes, rangeScoped), [classes, rangeScoped]);
  const rated = useMemo(() => perf.filter((p) => p.rate != null), [perf]);
  const noWork = perf.length - rated.length;
  const areas = useMemo(() => areaBreakdown(rangeScoped, sets), [rangeScoped, sets]);
  const dist = useMemo(() => accuracyDistribution(rangeScoped), [rangeScoped]);
  const grades = useMemo(() => gradeBreakdown(classes, rangeScoped), [classes, rangeScoped]);
  const hard = useMemo(() => hardestQuestions(rangeScoped, sets, PREVIEW), [rangeScoped, sets]);
  const classIndex = useMemo(() => byClass(rangeScoped), [rangeScoped]);
  /**
   * 영역별로 우리가 **가진 세트 수**. `areaBreakdown.questions`는 채점된 제출의 문항 수라
   * 배정했지만 아직 아무도 안 낸 영역까지 `콘텐츠 없음`으로 읽혔다. 두 사실을 가른다.
   */
  const setsPerArea = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sets) map.set(s.area, (map.get(s.area) ?? 0) + 1);
    return map;
  }, [sets]);
  /**
   * 반 id → 담당 선생님 이름.
   * **`getClass`(fixture)가 아니라 `classesFor`가 준 목록**을 쓴다 — 이 세션에서 담당을 바꾸거나
   * 선생님을 제외했으면 그 결과가 보여야 한다(`useAcademyStaff`의 오버레이).
   */
  const teacherOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classes) {
      map.set(c.id, (isActiveTeacher(c.teacherId) && accountOf(c.teacherId)?.name) || '미배정');
    }
    return map;
  }, [classes, isActiveTeacher, accountOf]);

  /** 안 낸 과제 중 가장 이른 마감. 급한 정도를 한 줄로 말할 때 쓴다. */
  const nearestDue = useMemo(() => {
    let min: string | undefined;
    for (const s of pending.byStudent) if (s.nearest && (!min || s.nearest < min)) min = s.nearest;
    return min;
  }, [pending]);

  // 다음 행동이 있는 것만 올린다. 갈 곳이 없는 안내는 `href`를 두지 않는다.
  const alerts: { title: string; subtitle: string; href?: string }[] = [];
  if (classes.length === 0) {
    alerts.push(
      isDirector
        ? {
            title: '아직 등록된 반이 없어요',
            subtitle: '반을 만들고 학생을 넣으면 학습을 배정할 수 있어요',
            href: '/academy/classes',
          }
        : {
            title: '담당하는 반이 아직 없어요',
            subtitle: '원장이 반을 배정하면 여기에 보여요',
          },
    );
  }
  if (pending.students > 0) {
    alerts.push({
      title: `안 낸 학생 ${pending.students.toLocaleString('en-US')}명`,
      subtitle: `안 낸 과제 ${pending.count.toLocaleString('en-US')}건${nearestText(nearestDue)}`,
      href: '/academy/analytics?due=all',
    });
  }
  if (isDirector && overdue.length > 0) {
    alerts.push({
      title: `마감이 지난 미제출 ${overdue.length.toLocaleString('en-US')}개`,
      subtitle: '성과 분석에서 마감일을 다시 정할 수 있어요',
      href: '/academy/analytics?due=overdue',
    });
  }
  if (!isDirector && due.today.length > 0) {
    alerts.push({
      title: `오늘 마감인 과제 ${due.today.length}개`,
      subtitle:
        dueTodayPending.students > 0
          ? `안 낸 학생 ${dueTodayPending.students}명`
          : '오늘 마감인 과제는 모두 냈어요',
      href: '/academy/analytics?due=soon',
    });
  }
  /*
    `배정한 학습이 없는 반 N개`는 알림으로 두지 않는다.
    사실이지만 원장이 지금 할 수 있는 일이 아니고, 개발용 로스터가 반 120개를 만들어(5절) 그 수가
    늘 세 자리로 뜬다. 대신 아래 `반별 현황` 캡션이 몇 개인지 한 줄로 말한다.
  */

  /*
    `note` 첫 마디가 **그 행의 축**이다 — 기간 행은 `최근 N주`, 스냅샷 행은 `지금`.
    한 표에 두 축이 섞여 있는데 화면에 적어 두지 않으면 같은 표가 서로 다른 말을 한다.
  */
  const span = `최근 ${weeks}주`;
  const metrics: MetricRow[] = isDirector
    ? [
        {
          key: 'rate',
          label: '제출률',
          note: `${span} · 배정받은 건 중 낸 비율`,
          value: submitRate != null ? `${submitRate}%` : '—',
          values: series.map((w) => w.rate),
          unit: '%',
          ratio: true,
        },
        {
          key: 'accuracy',
          label: '평균 정답률',
          note: `${span} · 문항 수로 가중한 평균`,
          value: avgAccuracy != null ? `${avgAccuracy}%` : '—',
          values: series.map((w) => w.accuracy),
          unit: '%',
          ratio: true,
        },
        {
          key: 'pending',
          label: '안 낸 학생',
          note: `지금 · 안 낸 과제 ${pending.count.toLocaleString('en-US')}건`,
          value: `${pending.students.toLocaleString('en-US')}명`,
          values: [],
          unit: '명',
          alert: pending.students > 0,
        },
        {
          key: 'assigned',
          label: '배정한 학습',
          note: `${span} · 제출 ${submitRows.submitted.toLocaleString('en-US')}/${submitRows.total.toLocaleString('en-US')}건`,
          value: `${rangeScoped.length.toLocaleString('en-US')}개`,
          values: series.map((w) => w.assigned),
          unit: '개',
        },
        {
          key: 'scale',
          label: '학원 반',
          note: `지금 · 학생 ${studentCount.toLocaleString('en-US')}명`,
          value: `${classes.length.toLocaleString('en-US')}개`,
          values: [],
          unit: '개',
        },
      ]
    : [
        {
          key: 'dueToday',
          label: '오늘 마감',
          note: `지금 · 이번 주 ${due.week.length}개`,
          value: `${due.today.length}개`,
          values: [],
          unit: '개',
          alert: dueTodayPending.students > 0,
        },
        {
          key: 'pending',
          label: '안 낸 학생',
          note: `지금 · 안 낸 과제 ${pending.count.toLocaleString('en-US')}건`,
          value: `${pending.students.toLocaleString('en-US')}명`,
          values: [],
          unit: '명',
          alert: pending.students > 0,
        },
        {
          key: 'rate',
          label: '제출률',
          note: `${span} · 배정받은 건 중 낸 비율`,
          value: submitRate != null ? `${submitRate}%` : '—',
          values: series.map((w) => w.rate),
          unit: '%',
          ratio: true,
        },
        {
          key: 'accuracy',
          label: '평균 정답률',
          note: `${span} · 문항 수로 가중한 평균`,
          value: avgAccuracy != null ? `${avgAccuracy}%` : '—',
          values: series.map((w) => w.accuracy),
          unit: '%',
          ratio: true,
        },
        {
          key: 'scale',
          label: '담당 반',
          note: `지금 · 학생 ${studentCount.toLocaleString('en-US')}명`,
          value: `${classes.length}개`,
          values: [],
          unit: '개',
        },
      ];

  /*
    반이 없거나 배정이 한 건도 없으면 **아래 섹션을 아예 그리지 않는다.**
    빈 표 여섯 개와 `모두 냈어요`가 나란히 서면 아무 일도 하지 않은 학원을 칭찬하는 화면이 된다
    (성과 분석이 이미 같은 판단을 한다 — `app/academy/analytics.tsx`).
    기간 토글도 두지 않는다 — 닿을 값이 없다.
  */
  if (classes.length === 0 || scoped.length === 0) {
    const noClass = classes.length === 0;
    /*
      **이 상태에서 할 수 있는 다음 행동은 하나뿐이다.** 반이 없으면 반 만들기(원장만),
      반은 있는데 배정이 없으면 학습 배정하기. 담당 반을 못 받은 선생님은 스스로 할 일이
      없으므로 행동줄 자체를 두지 않는다 — 빈 줄만 남기지 않는다.
      화살표는 여기 남긴다. 이 화면에 할 일이 없다는 것을 방금 읽었고, 다음은 저 화면에서
      이어진다(빈 상태의 다음 행동, §8·§9).
    */
    const cta = noClass
      ? isDirector
        ? { testID: 'academy-goto-classes', label: '반 만들러 가기', href: '/academy/classes' }
        : null
      : { testID: 'academy-assign-cta', label: '학습 배정하러 가기', href: '/academy/assign' };
    return (
      <Screen
        wide
        testID="academy-dashboard"
        title="대시보드"
        lead={`${account.academyName ?? '학원'}에서 지금 확인할 것을 모았어요.`}
      >
        <TestDataNote />
        <Group>
          <View style={styles.empty}>
            <AppText tone="secondary">
              {noClass
                ? isDirector
                  ? '아직 등록된 반이 없어요.'
                  : '담당하는 반이 아직 없어요.'
                : '아직 배정한 학습이 없어요.'}
            </AppText>
            <AppText variant="caption" tone="tertiary">
              {noClass
                ? isDirector
                  ? '반을 만들고 학생을 넣으면 학습을 배정할 수 있어요.'
                  : '원장이 반을 배정하면 여기에 보여요.'
                : '학습을 배정하면 제출률·반별 현황과 주간 추이를 여기서 봐요.'}
            </AppText>
          </View>
        </Group>
        {cta ? (
          <ActionBar>
            <Button
              testID={cta.testID}
              /* 빈 상태의 다음 행동은 `hug`이다(§8) — 다른 화면으로 보내기만 하므로 전폭이 아니고,
                 `hug`을 받은 `ActionBar`가 줄의 오른쪽 끝에 세운다(규칙 ③). */
              hug
              label={cta.label}
              accessibilityLabel={cta.label}
              trailing={<Icon name="arrow-right" size={16} color={colors.accentText} />}
              onPress={() => router.navigate(cta.href as never)}
            />
          </ActionBar>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen
      wide
      testID="academy-dashboard"
      title="대시보드"
      lead={`${account.academyName ?? '학원'}에서 지금 확인할 것을 모았어요.`}
    >
      <TestDataNote />

      <SegmentedControl
        testID="academy-range"
        options={RANGES}
        value={range}
        onChange={(v) => setRange(v)}
      />

      <Section title="지금 학원">
        <MetricTable testID="academy-kpi" rows={metrics} weeks={weeks} />
        {/*
          한 표에 두 축이 있고 `값`과 `추이`가 세는 범위도 다르다 — 이 두 가지를 화면이 말한다.
          `제출률 72%`(최근 12주 전체)와 추이 마지막 점 `75%`(지난주)가 다른 것은 오류가 아니다.
        */}
        <AppText variant="caption" tone="secondary">
          값은 {span}를 합해서 냈고, 변화·추이는 주별 값이에요. 설명이 지금으로 시작하는 행은
          기간과 상관없는 오늘 값이에요.
        </AppText>
      </Section>

      {/*
        390에서는 추이 두 개가 320px을 먹어 `확인이 필요해요`가 화면 밖으로 밀렸다 —
        화면 첫 줄이 "지금 확인할 것을 모았어요"라고 약속하는데 그게 가장 늦게 보였다.
        **순서는 그대로 두고(D-078) 좁은 화면에서만 접는다.** 넓은 화면은 펼친 그대로다.
      */}
      <Section title={`최근 ${weeks}주`}>
        <Disclosure
          testID="academy-trend-toggle"
          label={narrowCol ? `제출률·평균 정답률 추이 보기` : '추이 접기'}
          defaultOpen={!narrowCol}
        >
        <AppText variant="caption" tone="secondary">
          끝난 주까지만 그려요. 진행 중인 이번 주는 아직 넣지 않았어요.
        </AppText>
        <Trend
          label="제출률"
          points={series}
          pick={(w) => w.rate}
          unit="%"
          testID="academy-trend-rate"
        />
        <Trend
          label="평균 정답률"
          points={series}
          pick={(w) => w.accuracy}
          unit="%"
          testID="academy-trend-accuracy"
        />
        <View style={styles.legend}>
          <AppText variant="caption" tone="tertiary" style={styles.legendText}>
            {/*
              합성 배지를 뗐다. 추이는 이제 **실제 제출 기록**에서 계산한다 — 가정한 학사 일정
              위에서 만들던 합성 데이터를 버렸다. 기록이 쌓이기 전에는 점이 적을 뿐 거짓이 아니다.
            */}
            마감일이 그 주에 있는 배정으로 세요. 기록이 쌓일수록 촘촘해져요.
          </AppText>
        </View>
        </Disclosure>
      </Section>

      <Section
        title="확인이 필요해요"
        action={
          <Button
            testID="academy-assign-cta"
            size="sm"
            variant="secondary"
            tone="accent"
            hug
            label="학습 배정하기"
            leading={<Icon name="edit-3" size={15} color={colors.accent} />}
            onPress={() => router.navigate('/academy/assign' as never)}
          />
        }
      >
        <Group>
          {alerts.length ? (
            alerts.map((a) => (
              <Row
                key={a.title}
                title={a.title}
                subtitle={a.subtitle}
                onPress={a.href ? () => router.navigate(a.href as never) : undefined}
                showChevron={!!a.href}
              />
            ))
          ) : (
            <Row
              title="지금 확인할 일이 없어요"
              subtitle={
                isDirector
                  ? '안 낸 학생과 마감이 지난 과제가 없어요'
                  : '안 낸 학생과 오늘 마감인 과제가 없어요'
              }
            />
          )}
        </Group>
      </Section>

      {isDirector ? null : (
        <Section title="오늘·이번 주 마감">
          <DueTable rows={due.week} testID="academy-due" classes={classes} />
        </Section>
      )}

      <Section
        title={`${span} 반별 현황`}
        action={
          <Button
            testID="academy-goto-classes"
            size="sm"
            variant="secondary"
            tone="accent"
            hug
            label="반 전체 보기"
            accessibilityLabel="반 전체 보기"
            leading={<Icon name="users" size={15} color={colors.accent} />}
            onPress={() => router.navigate('/academy/classes' as never)}
          />
        }
      >
        <AppText variant="caption" tone="secondary">
          제출률이 낮은 반부터 보여 줘요.
          {noWork > 0
            ? ` ${span}에 배정이 없는 반 ${noWork.toLocaleString('en-US')}개는 맨 뒤에 둬요.`
            : ''}{' '}
          행을 누르면 반 상세로 가요.
        </AppText>
        <ClassTable
          rows={perf}
          index={classIndex}
          teacherOf={teacherOf}
          weeks={weeks}
          today={today}
          onOpen={(id) => router.push(`/academy/classes/${id}` as never)}
        />
      </Section>

      <Section title={`${span} 영역별 정답률`}>
        <AppText variant="caption" tone="secondary">
          배정 학습의 문항 수로 가중해 냈어요. 문항 20개 미만인 영역은 아직 단정하지 않아요.
        </AppText>
        <View style={styles.bars} testID="academy-areas">
          {areas.map((a) => (
            <BarRow
              key={a.area}
              label={a.area}
              value={a.accuracy ?? 0}
              /*
                값이 없는 이유는 둘이고 할 일이 다르다 — 세트가 0개면 콘텐츠를 만들 일이고,
                세트는 있는데 기록이 없으면 배정하거나 기다릴 일이다.
              */
              note={
                a.questions === 0
                  ? (setsPerArea.get(a.area) ?? 0) === 0
                    ? '아직 준비 중이에요'
                    : '아직 낸 기록이 없어요'
                  : `${a.accuracy}% · ${a.questions.toLocaleString('en-US')}문항${a.enough ? '' : ' · 표본 적음'}`
              }
              muted={a.questions === 0}
            />
          ))}
        </View>
      </Section>

      {isDirector ? (
        <Section title={`${span} 학년별`}>
          <GradeTable rows={grades} />
        </Section>
      ) : (
        /* 앞이 가로 막대, 여기가 목록 — 둘 다 테두리가 없어 사이에 선을 둔다. */
        <Section separated title={`${span} 다시 다룰 문항`}>
          <AppText variant="caption" tone="secondary">
            담당 반에서 오답이 많았던 문항이에요. {HARD_MIN_ANSWERS}명 넘게 푼 문항을 먼저 보여 줘요.
          </AppText>
          {/*
            가로 막대가 아니라 목록이다. 라벨 자리(92px · 한 줄)에 문항 발문을 넣으면
            **문법 은행 세트는 세트 안 모든 문항이 같은 발문**이라 다섯 줄이 같은 일곱 글자가 됐다
            (`src/data/grammarBank.ts`의 `build(id, prompt, items)`). 발문은 행 제목으로 올리고
            어느 세트의 문항인지를 부제가 말한다.
          */}
          <View testID="academy-hard">
            {hard.length ? (
              <Group>
                {hard.map((q) => (
                  <Row
                    key={q.questionId}
                    title={q.prompt}
                    subtitle={[
                      // **정답 선지를 함께 적는다**(DESIGN.md §17). 문법 은행 세트는 세트 안 모든
                      // 문항이 같은 발문을 써서, 발문만 두면 상위 5개가 같은 줄로 보인다.
                      answerOf(sets, q),
                      findContent(sets, q.contentId)?.title ?? '삭제된 학습',
                      `${q.answered}명 중 ${q.wrong}명`,
                      // 표본이 적으면 오답률을 단정하지 않는다(영역별의 `표본 적음`과 같은 규칙).
                      q.answered < HARD_MIN_ANSWERS ? '표본 적음' : null,
                      q.answered >= HARD_MIN_ANSWERS && q.rate >= HARD_WRONG_RATE
                        ? '해설을 다시 볼 문항이에요'
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    trailing={<AppText variant="label">오답률 {q.rate}%</AppText>}
                  />
                ))}
              </Group>
            ) : (
              <AppText variant="caption" tone="tertiary">
                아직 채점된 제출이 없어 문항별 오답률을 낼 수 없어요.
              </AppText>
            )}
          </View>
        </Section>
      )}

      {/* 원장은 앞이 학년별 표(스스로 경계가 있다)라 선을 두지 않는다. 선생님은 앞이 목록이다. */}
      <Section separated={!isDirector} title={`${span} 정답률 분포`}>
        <AppText variant="caption" tone="secondary">
          학생 {dist.reduce((n, b) => n + b.students, 0).toLocaleString('en-US')}명을 정답률 10점
          구간으로 나눈 거예요. 낸 기록이 없는 학생은 세지 않아요.
        </AppText>
        <View style={styles.bars} testID="academy-distribution">
          {dist.map((b) => (
            <BarRow
              key={b.label}
              label={b.label}
              value={
                dist.some((x) => x.students > 0)
                  ? (b.students / Math.max(...dist.map((x) => x.students))) * 100
                  : 0
              }
              note={`${b.students.toLocaleString('en-US')}명`}
              muted={b.students === 0}
            />
          ))}
        </View>
      </Section>

      <Section
        title={isDirector ? '학원 전체에서 안 낸 학생' : '담당 반에서 안 낸 학생'}
        action={
          <Button
            testID="academy-goto-students"
            size="sm"
            variant="secondary"
            tone="accent"
            hug
            label="학생 전체 보기"
            accessibilityLabel="학생 전체 보기"
            leading={<Icon name="users" size={15} color={colors.accent} />}
            onPress={() => router.push('/academy/classes/students' as never)}
          />
        }
      >
        <Group>
          {pending.byStudent.length ? (
            pending.byStudent.slice(0, PREVIEW).map((s) => (
              <Row
                key={s.studentId}
                title={accountOf(s.studentId)?.name ?? '학생'}
                subtitle={`안 낸 과제 ${s.count}건${nearestText(s.nearest)}`}
                onPress={() => router.push(`/academy/classes/student/${s.studentId}` as never)}
                showChevron
              />
            ))
          ) : (
            <Row title="모두 냈어요" subtitle="안 낸 과제가 없어요" />
          )}
        </Group>
        {pending.students > PREVIEW ? (
          <AppText variant="caption" tone="tertiary">
            안 낸 학생 {pending.students.toLocaleString('en-US')}명 중 안 낸 과제가 많은 {PREVIEW}
            명이에요.
          </AppText>
        ) : null}
      </Section>

      {isDirector ? (
        <Section title="마감이 지난 미제출">
          <Group>
            {overdue.length ? (
              overdue.slice(0, PREVIEW).map(({ assignment: a, missing }) => (
                <Row
                  key={a.id}
                  title={a.title}
                  subtitle={`${classNameOf(a, classes)}${
                    a.dueDate ? ` · ${formatDate(a.dueDate)} 마감` : ''
                  } · 안 낸 학생 ${missing}명`}
                  onPress={() => router.navigate('/academy/analytics?due=overdue' as never)}
                  showChevron
                />
              ))
            ) : (
              <Row title="마감이 지난 미제출이 없어요" subtitle="마감일을 다시 정할 과제가 없어요" />
            )}
          </Group>
          {overdue.length > PREVIEW ? (
            <AppText variant="caption" tone="tertiary">
              마감이 지난 미제출 {overdue.length.toLocaleString('en-US')}개 중 마감이 이른{' '}
              {PREVIEW}개예요. 전체는 성과 분석에서 볼 수 있어요.
            </AppText>
          ) : null}
        </Section>
      ) : null}

      <Section title="지표를 어떻게 세나요">
        <View style={styles.defs}>
          <Def
            term="안 낸 학생"
            desc="사람 수로 세요. 한 학생이 과제를 세 개 안 냈어도 1명이에요."
          />
          <Def term="안 낸 과제" desc="배정 × 학생 건 수로 세요. 같은 학생이 여러 번 세져요." />
          <Def
            term="평균 정답률"
            desc="제출한 답안을 문항 수로 가중해 내요. 25문항 세트와 10문항 세트를 같은 무게로 두지 않아요. 학부모 리포트와 같은 방법이에요."
          />
          <Def
            term="반 제출률"
            desc="반에 배정된 건 중 제출한 비율이에요. 배정이 없는 반은 세지 않아요."
          />
          <Def
            term="주간 추이"
            desc="마감일이 그 주에 있는 배정으로 세요. 마감일을 미뤄도 처음 마감한 주에 남아요."
          />
        </View>
      </Section>
    </Screen>
  );
}

/**
 * 화면 첫 줄 고지. 빈 상태와 평상시 화면이 **같은 문장**을 쓰도록 한 곳에 둔다.
 * 로스터가 반 120개·학생 3,000명을 만들어(마스터 플랜 5절) 고지가 없으면 실제 재원생으로 읽힌다.
 */
function TestDataNote() {
  return (
    <AppText variant="caption" tone="tertiary">
개발·테스트 계정 기준입니다. 실제 재원생 기록이 아니에요. 값은 실제 제출 기록에서 계산해요.
    </AppText>
  );
}

/**
 * 안 낸 과제 중 가장 이른 마감을 말하는 꼬리말.
 *
 * `formatDate`는 `2월 4일`만 내놔서 **지난 마감이 다가오는 마감처럼** 읽혔다.
 * 지남 여부까지 말하는 `dueLabel`을 쓰고(성과 분석·반 상세와 같은 문장), 앞말은
 * `가장 이른 마감`이 아니라 `가장 이른 것은`으로 둔다 —
 * `가장 이른 마감 마감이 지났어요`가 되지 않게.
 */
function nearestText(iso?: string): string {
  const label = dueLabel(iso);
  return label ? ` · 가장 이른 것은 ${label.text}` : '';
}

/* ----------------------------- 지표 표 ----------------------------- */

interface MetricRow {
  key: string;
  label: string;
  note: string;
  value: string;
  /** 주간 추이. 값이 둘 미만이면 `추이 없음`이라고 적는다. */
  values: (number | null)[];
  unit: string;
  ratio?: boolean;
  alert?: boolean;
}

/**
 * 지표 표. 열은 지표 / 값 / 변화 / 추이다.
 * **표 전체에 추이가 없으면 `변화`·`추이` 열을 만들지 않는다** — 빈 칸 두 줄은 잡음이다(D-076).
 */
function MetricTable({
  rows,
  weeks,
  testID,
}: {
  rows: MetricRow[];
  weeks: number;
  testID: string;
}) {
  const hasTrend = rows.some((r) => known(r.values).length > 1);
  const columns: Column<MetricRow>[] = [
    {
      key: 'name',
      header: '지표',
      cell: (r) => (
        <View style={styles.nameCell}>
          <AppText variant="label">{r.label}</AppText>
          <AppText variant="caption" tone="tertiary" numberOfLines={2}>
            {noteText(r)}
          </AppText>
        </View>
      ),
    },
    {
      key: 'value',
      header: '값',
      width: 96,
      align: 'right',
      cell: (r) => (
        <AppText variant="label" style={[styles.num, r.alert ? { color: colors.danger } : null]}>
          {r.value}
        </AppText>
      ),
    },
    ...(hasTrend
      ? ([
          {
            key: 'delta',
            header: '변화',
            width: 78,
            align: 'right',
            cell: (r) => <Delta row={r} />,
          },
          {
            key: 'trend',
            header: `추이(${weeks}주)`,
            width: 84,
            priority: 2,
            cell: (r) =>
              known(r.values).length > 1 ? (
                <Sparkline
                  values={known(r.values)}
                  label={sparkLabel(r.label, known(r.values), r.unit)}
                />
              ) : (
                // 빈 칸으로 두면 "추이가 없다"는 사실조차 전달되지 않는다.
                <AppText variant="caption" tone="tertiary">
                  추이 없음
                </AppText>
              ),
          },
        ] as Column<MetricRow>[])
      : []),
  ];
  return (
    <Table
      testID={testID}
      columns={columns}
      rows={rows}
      rowKey={(r) => r.key}
      rowLabel={(r) =>
        [`${r.label} ${r.value}`, noteText(r), hasTrend ? `변화 ${deltaText(r)}` : null]
          .filter(Boolean)
          .join(', ')
      }
      empty={{ title: '보여 줄 지표가 없어요' }}
    />
  );
}

/**
 * `지표` 열의 보조 문장. **경고를 글자로도 말한다** — `alert`는 값 색만 바꿔서
 * 화면에는 `확인이 필요해요`가 어디에도 없고 스크린리더만 그 말을 들었다(DESIGN.md 11·20절).
 * 셀과 `rowLabel`이 같은 함수를 부르게 해 두 문장이 갈리지 않게 한다.
 */
function noteText(row: MetricRow): string {
  return row.alert ? `${row.note} · 확인이 필요해요` : row.note;
}

function known(values: readonly (number | null)[]): number[] {
  return values.filter((v): v is number => v != null);
}

function deltaText(row: MetricRow): string {
  const d = deltaOf(row.values);
  if (d == null) return '—';
  return `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)}${row.ratio ? '%p' : row.unit}`;
}

/**
 * 직전 주와의 차이.
 * 0일 때도 단위를 붙인다 — 단위 없는 `0`은 비율인지 사람 수인지 알 수 없다.
 * 색은 부호 위에 얹는 보조 신호다(DESIGN.md 11절). 좋아진 값은 `accent`(링크·주요 행동 색)가
 * 아니라 `success`다 — 옆 열의 링크와 같은 색이면 누르는 곳으로 읽힌다.
 * **등폭을 옆 `값` 열과 맞춘다** — 한쪽만 비례폭이면 자릿수 선이 어긋난다.
 */
function Delta({ row }: { row: MetricRow }) {
  const d = deltaOf(row.values);
  if (d == null) {
    return (
      <AppText variant="caption" tone="tertiary" style={styles.num}>
        —
      </AppText>
    );
  }
  const body = `${Math.abs(d)}${row.ratio ? '%p' : row.unit}`;
  if (d === 0) {
    return (
      <AppText tone="secondary" style={styles.num}>
        {body}
      </AppText>
    );
  }
  return (
    <AppText style={[styles.num, { color: d > 0 ? colors.success : colors.danger }]}>
      {d > 0 ? '+' : '−'}
      {body}
    </AppText>
  );
}

/* ----------------------------- 추이선 ----------------------------- */

/** 한 지표의 주간 추이. 축·격자를 두지 않고 양 끝 값을 글자로 적는다. */
function Trend({
  label,
  points,
  pick,
  unit,
  testID,
}: {
  label: string;
  points: WeekPoint[];
  pick: (w: WeekPoint) => number | null;
  unit: string;
  testID: string;
}) {
  const values = points.map(pick).filter((v): v is number => v != null);
  const first = points.find((w) => pick(w) != null);
  const last = [...points].reverse().find((w) => pick(w) != null);
  if (values.length < 2) {
    return (
      <View style={styles.trend} testID={testID}>
        <AppText variant="label">{label}</AppText>
        <AppText variant="caption" tone="tertiary">
          추이를 그릴 만큼 기록이 없어요
        </AppText>
      </View>
    );
  }
  return (
    <View style={styles.trend} testID={testID}>
      <View style={styles.trendHead}>
        <AppText variant="label">{label}</AppText>
        <AppText variant="caption" tone="secondary" style={styles.num}>
          {values[0]}
          {unit} → {values[values.length - 1]}
          {unit}
        </AppText>
      </View>
      <Sparkline
        values={values}
        width={320}
        height={44}
        label={sparkLabel(label, values, unit)}
      />
      <AppText variant="caption" tone="tertiary">
        {spanLabel(first?.monday, last?.monday)}
      </AppText>
    </View>
  );
}

/**
 * 추이가 덮는 기간. **연도가 갈릴 때만 연도를 적는다** — 26주 창은 해를 넘기는데
 * `9월 1일 ~ 2월 16일`은 5개월인지 17개월인지 말하지 않는다. 같은 해면 연도는 잡음이다.
 */
function spanLabel(from?: string, to?: string): string {
  if (!from || !to) return '';
  const withYear = from.slice(0, 4) !== to.slice(0, 4);
  return `${dayLabel(from, withYear)} ~ ${dayLabel(to, withYear)}`;
}

function dayLabel(monday: string, withYear: boolean): string {
  const [y, m, d] = monday.split('-');
  return `${withYear ? `${Number(y)}년 ` : ''}${Number(m)}월 ${Number(d)}일`;
}

/* ----------------------------- 반별 현황 ----------------------------- */

/**
 * 반별 표. **정렬은 화면이 쥔다** — 표에 페이지 슬라이스를 넘기면 헤더 정렬이 그 페이지
 * 안에서만 일어나 반 122개에서 화면이 거짓말을 한다(A-050).
 */
function ClassTable({
  rows,
  index,
  teacherOf,
  weeks,
  today,
  onOpen,
}: {
  rows: ClassPerf[];
  index: Map<string, Assignment[]>;
  teacherOf: Map<string, string>;
  weeks: number;
  today: string;
  onOpen: (classId: string) => void;
}) {
  const [page, setPage] = useState(0);



  /**
   * 정렬은 **화면이 쥔다** — 표에 페이지 슬라이스를 넘기기 때문이다(A-050).
   * 기본 순서(제출률 낮은 순)는 `classPerformance`가 준 그대로다.
   */
  const sorted = useTableSort(rows, CLASS_COMPARE, () => setPage(0));
  const start =
    Math.min(page, Math.max(0, Math.ceil(sorted.rows.length / CLASS_PAGE) - 1)) * CLASS_PAGE;
  const shown = useMemo(() => sorted.rows.slice(start, start + CLASS_PAGE), [sorted.rows, start]);

  /**
   * 추이는 **이 페이지에 보이는 반만** 낸다. 반 122개 전부에 `weeklySeries`를 돌리면
   * 화면에 그리지도 않을 112개를 매번 26주치 훑는다 — 정렬·페이지를 바꿀 때마다.
   */
  const trend = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const r of shown) {
      const series = weeklySeries(index.get(r.classId) ?? [], weeks, lastCompleteWeek(today));
      map.set(
        r.classId,
        series.map((w) => w.rate).filter((v): v is number => v != null),
      );
    }
    return map;
  }, [shown, index, weeks, today]);

  const columns: Column<ClassPerf>[] = [
    { key: 'name', header: '반', cell: (r) => r.name, sort: CLASS_COMPARE.name },
    {
      key: 'teacher',
      header: '담당',
      width: 88,
      // ④ 누구에게 말할지가 이 값으로 갈린다.
      priority: 1,
      cell: (r) => teacherOf.get(r.classId) ?? '미배정',
    },
    {
      key: 'students',
      header: '학생',
      width: 68,
      align: 'right',
      // ① 제출률의 분모다.
      priority: 1,
      cell: (r) => `${r.students.toLocaleString('en-US')}명`,
      sort: CLASS_COMPARE.students,
    },
    {
      key: 'assigned',
      header: '배정',
      width: 72,
      align: 'right',
      priority: 2,
      cell: (r) => `${r.assigned.toLocaleString('en-US')}건`,
      sort: CLASS_COMPARE.assigned,
    },
    {
      key: 'rate',
      header: '제출률',
      width: 76,
      align: 'right',
      cell: (r) => (r.rate != null ? `${r.rate}%` : '배정 없음'),
      sort: CLASS_COMPARE.rate,
    },
    {
      key: 'accuracy',
      header: '평균 정답률',
      width: 92,
      align: 'right',
      // ① 표 위 캡션이 약속한 비교축이다.
      priority: 1,
      cell: (r) => (r.avgAccuracy != null ? `${r.avgAccuracy}%` : '—'),
      sort: CLASS_COMPARE.accuracy,
    },
    {
      key: 'trend',
      header: '추이',
      width: 80,
      priority: 2,
      cell: (r) => {
        const values = trend.get(r.classId) ?? [];
        return values.length > 1 ? (
          <Sparkline values={values} label={sparkLabel(`${r.name} 제출률`, values, '%')} />
        ) : (
          <AppText variant="caption" tone="tertiary">
            추이 없음
          </AppText>
        );
      },
    },
    /*
      **이 표만 눌린다는 사실을 화면이 말한다.** 같은 화면의 지표 표·학년별·마감 표와
      시각적으로 똑같아서 어디를 눌러야 하는지 알 수 없었다. `Row`의 `showChevron`과 같은 뜻이다.
    */
    {
      key: 'go',
      header: '',
      width: 24,
      cell: () => <Icon name="chevron-right" size={18} color={colors.inkTertiary} />,
    },
  ];

  return (
    <>
      <Table
        testID="academy-class-table"
        columns={columns}
        rows={shown}
        {...sorted.props}
        rowKey={(r) => r.classId}
        onRowPress={(r) => onOpen(r.classId)}
        rowLabel={(r) =>
          [
            r.name,
            `학생 ${r.students}명`,
            `배정 ${r.assigned}건`,
            r.rate != null ? `제출률 ${r.rate}%` : '배정 없음',
            r.avgAccuracy != null ? `평균 정답률 ${r.avgAccuracy}%` : null,
          ]
            .filter(Boolean)
            .join(', ')
        }
        empty={{ title: '아직 반이 없어요', subtitle: '반을 만들면 여기에 보여요' }}
      />
      {sorted.rows.length > CLASS_PAGE ? (
        <Pager
          testID="academy-class-pager"
          total={sorted.rows.length}
          page={start / CLASS_PAGE}
          pageSize={CLASS_PAGE}
          onChange={setPage}
          unit="개"
        />
      ) : null}
    </>
  );
}

/**
 * 반별 현황의 열 정렬. **한 곳에 두고 컬럼과 정렬 훅이 같은 값을 가리킨다** — 두 벌이면
 * 헤더는 눌리는데 다른 기준으로 도는 일이 생긴다. 오름차순으로 정의하고 표가 뒤집는다.
 */
const CLASS_COMPARE: Record<string, (a: ClassPerf, b: ClassPerf) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  students: (a, b) => a.students - b.students,
  assigned: (a, b) => a.assigned - b.assigned,
  rate: (a, b) => nullLast(a.rate) - nullLast(b.rate),
  accuracy: (a, b) => nullLast(a.avgAccuracy) - nullLast(b.avgAccuracy),
};

/** 정렬용. `null`(배정 없음)은 항상 맨 뒤로 보낸다. */
function nullLast(v: number | null): number {
  return v == null ? Number.POSITIVE_INFINITY : v;
}

/* ----------------------------- 학년별 · 마감 ----------------------------- */

function GradeTable({ rows }: { rows: GradeStat[] }) {
  const columns: Column<GradeStat>[] = [
    { key: 'grade', header: '학년', cell: (r) => r.label },
    {
      key: 'classes',
      header: '반',
      width: 64,
      align: 'right',
      cell: (r) => `${r.classes.toLocaleString('en-US')}개`,
    },
    {
      key: 'students',
      header: '학생',
      width: 76,
      align: 'right',
      // ① `학년별`이라는 제목의 절반이다.
      priority: 1,
      cell: (r) => `${r.students.toLocaleString('en-US')}명`,
    },
    {
      key: 'rate',
      header: '제출률',
      width: 76,
      align: 'right',
      cell: (r) => (r.rate != null ? `${r.rate}%` : '배정 없음'),
    },
    {
      key: 'accuracy',
      header: '평균 정답률',
      width: 92,
      align: 'right',
      // ①
      priority: 1,
      cell: (r) => (r.accuracy != null ? `${r.accuracy}%` : '—'),
    },
  ];
  return (
    <Table
      testID="academy-grade-table"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.label}
      empty={{ title: '학년을 나눌 반이 없어요' }}
    />
  );
}

/** 선생님이 아침에 먼저 보는 표. 제출 진행을 막대로 함께 그린다. */
function DueTable({
  rows,
  testID,
  classes,
}: {
  rows: Assignment[];
  testID: string;
  /** 반 이름을 붙이려면 살아 있는 반 목록이 필요하다(`classNameOf`). */
  classes: AcademyClass[];
}) {
  const columns: Column<Assignment>[] = [
    { key: 'title', header: '과제', cell: (r) => r.title },
    // ③ 선생님이 여러 반을 맡으면 이 값 없이는 어느 반 과제인지 모른다. 흐름의 첫 판단점이다.
    { key: 'class', header: '반', width: 108, priority: 1, cell: (r) => classNameOf(r, classes) },
    {
      key: 'due',
      header: '마감',
      width: 84,
      cell: (r) => dueLabel(r.dueDate)?.text ?? '마감 없음',
    },
    {
      key: 'submit',
      header: '제출',
      width: 120,
      cell: (r) => {
        const s = submitStat(r);
        return (
          <View style={styles.dueCell}>
            <AppText variant="caption" tone="secondary" style={styles.num}>
              {s.submitted}/{s.total}
            </AppText>
            <ProgressBar value={s.total ? (s.submitted / s.total) * 100 : 0} />
          </View>
        );
      },
    },
  ];
  return (
    <Table
      testID={testID}
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      rowLabel={(r) => {
        const s = submitStat(r);
        return `${r.title}, ${classNameOf(r, classes)}, ${dueLabel(r.dueDate)?.text ?? '마감 없음'}, 제출 ${s.submitted}/${s.total}`;
      }}
      empty={{ title: '이번 주 마감인 과제가 없어요', subtitle: '마감일을 정한 과제만 세요' }}
    />
  );
}

/** 그 문항의 정답 선지. 같은 발문을 쓰는 세트에서 어느 문제인지 가르는 유일한 단서다. */
function answerOf(sets: readonly ContentSet[], q: HardQuestion): string | null {
  const set = findContent(sets, q.contentId);
  const found = set?.questions.find((x) => x.id === q.questionId);
  return found ? `정답 ${found.choices[found.answerIndex]}` : null;
}

function Def({ term, desc }: { term: string; desc: string }) {
  return (
    <View style={styles.def}>
      <AppText variant="caption" style={styles.defTerm}>
        {term}
      </AppText>
      <AppText variant="caption" tone="secondary" style={styles.defDesc}>
        {desc}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { padding: spacing.lg, gap: spacing.xs },
  defs: { gap: spacing.sm },
  def: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  defTerm: { fontFamily: typeface.semibold, color: colors.ink, width: 92 },
  defDesc: { flex: 1 },
  nameCell: { gap: 1 },
  num: { fontVariant: ['tabular-nums'] },
  trend: { gap: spacing.xs },
  trendHead: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendText: { flex: 1 },
  /** 가로 막대 목록. 한 줄의 모양·쌓기는 `BarRow`가 쥔다(기본 폭 92/148이 이 화면 값이다). */
  bars: { gap: spacing.xs },
  dueCell: { gap: 3 },
});
