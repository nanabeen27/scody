import { useState } from 'react';
import { useRouter } from 'expo-router';

import { View, StyleSheet } from 'react-native';

import {
  AppText,
  Button,
  DayHeatmap,
  EmptyState,
  Group,
  Icon,
  LoadFailed,
  Row,
  Screen,
  Section,
  SegmentedControl,
  Sparkline,
  sparkLabel,
  SourceTag,
  type SegmentedOption,
} from '@/components';
import { useCurrentAccount } from '@/session';
import { formatDate, formatDuration, useStudentItems } from '@/features/learning';
import { useProgress } from '@/features/progress';
import {
  achievedMilestones,
  completedWeekTrend,
  consistency,
  daysToLongest,
  formatCount,
  milestoneUnit,
  protectionLine,
  streakLine,
  todayLine,
  studyMethodNotice,
  upcomingMilestones,
  weekToDateLine,
} from '@/features/records';
import { colors, spacing } from '@/theme/tokens';

const RECENT = 5;

/** 출처 필터. 이 화면의 유일한 필터다(§8 · D-077). */
type SourceFilter = 'all' | 'academy' | 'personal';


/**
 * 최고 기록을 세운 날.
 *
 * **값도 함께 본다.** 서버의 `(array_agg(day order by 값 desc, day desc))[1]`은 그 학생에게 행이
 * 하나라도 있으면 **값이 전부 0이어도** 가장 최근 날짜를 돌려준다. 그래서 `day === null`만
 * 보던 판본은 오답을 한 번도 다시 풀지 않은 학생에게
 * `하루 최다 오답 해결 · 0개 · 8월 17일에 세웠어요`를 그렸다 — 아무 일도 없었던 날에 기록을
 * 세웠다고 단정하는 문장이다(실측: seed 14명 중 12명이 그 상태였다).
 */
function bestOn(value: number, day: string | null, suffix = '에 세웠어요'): string {
  return value > 0 && day ? `${formatDate(day)}${suffix}` : '아직 없어요';
}

/**
 * 기록: 내가 푼 학습의 출처·날짜·정답률·걸린 시간. 상단에 전체 정답률과 총 학습 시간.
 *
 * **오답노트는 여기 없다.** 기록은 "무엇을 했는지"를 보는 곳이고, 오답을 다시 푸는 것은
 * 앞으로 할 일이라 `학습` 탭에 있다(D-130).
 *
 * **줄마다 출처를 말한다**(확정 정책 2절 · `DESIGN.md` §18). 이 목록에는 학원 과제와 개인
 * 학습이 섞여 서는데, 앱의 다른 자리(홈 히어로·학습 탭·풀이·결과·오답노트·카드 복습·담아 둔
 * 학습)는 전부 `SourceTag`를 붙이고 이 화면만 빼먹고 있었다 — `정답률 60%`가 학원이 내준
 * 과제의 결과인지 내가 고른 학습의 결과인지 구분되지 않았다(둘 다 하는 학생에게는 다른 뜻이다).
 *
 * **날짜도 함께 말한다.** 목록은 제출일 내림차순인데 날짜가 화면에 없어서 왜 이 순서인지
 * 알 수 없었고, "지난주에 얼마나 했는지"를 이 화면에서 셀 수 없었다.
 */
export default function StudentRecords() {
  const router = useRouter();
  const account = useCurrentAccount();
  const { hasPersonal } = useStudentItems();
  const { attempts, records, loading, error, reload } = useProgress();
  const [showAll, setShowAll] = useState(false);
  const [source, setSource] = useState<SourceFilter>('all');
  const list = Object.values(attempts).sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));

  /*
    **읽는 중 · 실패 · 없음을 셋으로 가른다**(D-136 · A-116). 조회가 끝나기 전에도, 조회가
    실패해도 이 화면은 `아직 제출한 학습이 없어요`라고 단정하고 있었다 — 실패하면 `loading`이
    내려가므로 로딩 게이트만으로는 덮이지 않는다. 모양은 학생 화면 넷과 같다
    (`index.tsx` · `learn.tsx` · `pick.tsx` · `review.tsx`).

    **다시 읽는 중에는 실패 문장을 감춘다** — 실패 줄과 `불러오고 있어요`가 한 화면에 함께
    서면 지금 무슨 일이 일어나는지 알 수 없다(§9).
  */
  const reading = loading;
  const loadError = reading ? null : error;

  /*
    **손에 아무 기록도 없을 때만 읽는 중·실패로 갈린다.** 이미 읽어 둔 기록은 지우지 않는다
    (§9) — 다시 읽기가 실패해도 가진 기록은 여전히 사실이라 목록과 정답률은 그대로 둔다.
  */
  const empty = list.length === 0;

  const academyCount = list.filter((a) => a.source === 'academy').length;
  const personalCount = list.length - academyCount;
  /*
    **두 출처가 실제로 섞여 있을 때만 필터를 그린다.** 한쪽만 가진 학생에게 `전체`와
    그 출처 칸은 **같은 목록**이라 고를 것이 없다(§8의 `결과가 0건인 필터 칸은 렌더하지
    않는다` · D-075의 같은 판단). 출처별 개수는 아래 목록 줄의 `SourceTag`가 이미 말한다.
  */
  const canFilter = academyCount > 0 && personalCount > 0;
  /* 칸이 사라진 뒤에도 그 값이 남아 빈 목록이 되지 않게, 그릴 수 없으면 `전체`로 본다. */
  const filter = canFilter ? source : 'all';
  const filtered = filter === 'all' ? list : list.filter((a) => a.source === filter);
  const visible = showAll ? filtered : filtered.slice(0, RECENT);

  const sourceOptions: SegmentedOption<SourceFilter>[] = [
    { value: 'all', label: '전체', count: list.length },
    { value: 'academy', label: '학원 과제', count: academyCount },
    { value: 'personal', label: '개인 학습', count: personalCount },
  ];

  /*
    위 지표는 **필터를 따라가지 않는다.** 이 화면에 온 학생의 질문은 "지금까지 얼마나 했나"라
    그 답이 화면의 머리글자여야 하고, 필터를 누를 때마다 가장 큰 숫자가 튀면 무엇에 대한 값인지
    흐려진다. 필터는 아래 목록에 걸리고, 출처별 규모는 필터 칸의 개수가 말한다.
  */
  const avg = list.length
    ? Math.round(list.reduce((s, a) => s + a.accuracy, 0) / list.length)
    : null;
  /*
    **누적 학습 시간을 여기서 세지 않는다.** 예전에는 `attempts`의 `timeSec` 합이 머리글자에
    있었는데, 그 값은 ①제출한 학습에만 붙고 ②최신 회차만 남으며 ③화면 체류 시간이었다.
    지금은 `records.totals.activeSec`(활동 기반 · 오답 복습 포함)이 그 자리를 말한다.
  */

  /*
    milestone은 **서버 값 위에서 파생된다**(`src/features/records.ts`). 축마다 아직 넘지 않은 첫
    칸 하나만 남고 남은 수가 적은 것부터 선다 — 한 축의 여러 칸을 함께 세우면 같은 말의 반복이다.
  */
  const upcoming = records ? upcomingMilestones(records) : [];
  /**
   * 첫 기록이 있는 날. 없으면 아직 아무 기록도 없는 계정이다.
   *
   * 변수로 뽑아 두는 이유는 두 가지다: ①아래 게이트와 머리글자가 **같은 값**을 본다 ②`string`으로
   * 좁혀져서 `formatDate`에 그대로 넘길 수 있다.
   */
  const firstDay = records?.totals.firstDay ?? null;
  /**
   * 다가오는 기록 세 줄. **두 상태가 같은 줄을 쓴다.**
   *
   * 기록이 있는 계정에서는 `다가오는 기록` 섹션의 몸이고, 아직 아무 기록도 없는 계정에서는 위
   * 규칙 한 줄과 함께 이 화면의 **유일한 기록 블록**이다(그 계정에서도 `upcomingMilestones`는
   * 값을 만든다 — 남은 수가 곧 기준선이다). JSX를 두 벌 적으면 단위·톤을 한쪽만 고치게 된다.
   */
  const upcomingGroup =
    upcoming.length > 0 ? (
      <Group>
        {upcoming.map((m) => (
          <Row
            key={`${m.kind}-${m.threshold}`}
            testID={`records-upcoming-${m.kind}`}
            title={m.label}
            /*
              **단위를 붙인다**(`milestoneUnit`). `96 / 100`만 있으면 무엇이 96인지 줄 제목을 다시
              봐야 하고, 이 화면의 다른 값은 전부 단위를 갖는다. 단위는 기준선 쪽에 한 번만 적는다.
            */
            subtitle={`${formatCount(m.value)} / ${milestoneUnit(m.kind, m.threshold)}`}
            trailing={
              /*
                **`tone="accent"`를 쓰지 않는다.** 강조색은 §18-2가 `고른 항목`에 배정한 표현이라
                이 섹션만 강조색이면 누를 수 있는 줄로 읽힌다 — 그런데 이 줄은 눌리지 않는다.
                강조는 색이 아니라 무게로 한다(§11).
              */
              <AppText variant="label" weight="semibold" numeric>
                {`${milestoneUnit(m.kind, m.remaining)} 남음`}
              </AppText>
            }
          />
        ))}
      </Group>
    ) : null;
  /** 최근 4주 주당 평균 문항. 화면에 적는 값과 비율의 기준을 같게 맞춘다. */
  const avgWeekQuestions = Math.round(records?.avg4Weeks.solvedQuestions ?? 0);
  /** 끝난 주의 주당 푼 문항. 점이 둘 미만이면 비어 있고 그때는 선을 그리지 않는다. */
  const trend = records ? completedWeekTrend(records) : [];
  /** 최근 4주 꾸준함. 세는 자리가 하나다 — 부제와 값이 같은 수를 두 번 세지 않는다. */
  const steady = records ? consistency(records) : { days: 0, studied: 0, percent: 0 };
  /** 최장 기록까지 남은 일수. 한 줄에서 두 번 부르지 않는다. */
  const longestGap = records ? daysToLongest(records) : null;

  const dayCount = (n: number) => `${formatCount(n)}일`;
  const questionCount = (n: number) => `${formatCount(n)}문항`;

  /**
   * 지난주 같은 시점과 비교하는 세 줄. **표로 둔다.**
   *
   * 예전에는 `Row` 세 벌이 12줄 골격을 손으로 반복하면서 **비교 창을 줄마다 골랐다** —
   * 한 줄에서 `lastWeek`(완성된 7일)을 쓰면 그 줄만 월요일에 `-100%`가 된다. 0047이 고친 결함이
   * 한 줄 단위로 돌아올 수 있는 모양이었다. 표로 두면 창을 **한 번** 고른다.
   */
  const weekRows = records
    ? [
        {
          key: 'questions',
          title: '푼 문항',
          now: records.week.solvedQuestions,
          before: records.lastWeekToDate.solvedQuestions,
          fmt: questionCount,
        },
        {
          key: 'time',
          title: '학습 시간',
          now: records.week.activeSec,
          before: records.lastWeekToDate.activeSec,
          fmt: formatDuration,
        },
        {
          key: 'days',
          title: '공부한 날',
          now: records.week.studyDays,
          before: records.lastWeekToDate.studyDays,
          fmt: dayCount,
        },
      ]
    : [];

  /**
   * 실제로 세운 최고 기록만. 값이 0인 축은 줄을 만들지 않는다.
   *
   * 네 축의 값·단위·`세운 날` 문장이 서로 달라서 목록을 데이터로 만든다 — JSX에 네 벌을 적으면
   * `0`을 거르는 조건도 네 벌이 되고, 그중 하나를 빠뜨린 것이 이번 결함이었다.
   */
  const bestRows = records
    ? [
        {
          key: 'questions',
          title: '하루 최다 풀이',
          n: records.bests.questions.value,
          value: `${formatCount(records.bests.questions.value)}문항`,
          subtitle: bestOn(records.bests.questions.value, records.bests.questions.day),
        },
        {
          key: 'time',
          title: '하루 최다 학습 시간',
          n: records.bests.activeSec.value,
          value: formatDuration(records.bests.activeSec.value),
          subtitle: bestOn(records.bests.activeSec.value, records.bests.activeSec.day),
        },
        {
          key: 'reviews',
          title: '하루 최다 오답 해결',
          n: records.bests.reviewsCorrect.value,
          value: `${formatCount(records.bests.reviewsCorrect.value)}개`,
          subtitle: bestOn(records.bests.reviewsCorrect.value, records.bests.reviewsCorrect.day),
        },
        {
          key: 'week',
          title: '주간 최다 풀이',
          n: records.bests.week.value,
          value: `${formatCount(records.bests.week.value)}문항`,
          /* 주간 항목만 `{날짜} 주에`다 — 접미사만 다르고 판단은 위 셋과 같은 함수가 한다. */
          subtitle: bestOn(records.bests.week.value, records.bests.week.monday, ' 주에 세웠어요'),
        },
      ].filter((b) => b.n > 0)
    : [];
  const achieved = records ? achievedMilestones(records) : [];

  /**
   * 새로 고를 수 없는 계정에 그 이유(또는 지금 기다리는 것)를 말하는 한 줄.
   * **홈(`app/student/index.tsx`의 `noPickReason`)과 같은 문장이다** — 같은 학생이 같은 상황을
   * 두 화면에서 다른 말로 듣지 않게 한다.
   */
  const noPickReason = account.academyName
    ? '학원에서 과제를 내주면 여기에서 알려 줘요.'
    : '개인 학습 이용권이 없어서 아직 고를 수 있는 학습이 없어요.';

  return (
    <Screen testID="student-records" title="기록">
      {/*
        조회가 실패하면 기록이 없다고 말하지 않는다(D-136). 인라인 `danger` 캡션 + 다시 시도할
        행동 하나이고, 화면에 실패 면은 하나다 — 지표와 목록이 같은 조회에 매달려 있다.
      */}
      {loadError ? (
        <LoadFailed
          testID="records-load-failed"
          retryTestID="records-load-retry"
          what="기록"
          message={loadError}
          onRetry={() => void reload()}
        />
      ) : null}

      {/*
        ## 나의 기록

        이 화면의 첫 질문이 바뀌었다. 예전에는 `정답률`이 머리글자였는데(`ScoreCard`), 그것은
        **얼마나 잘하나**에 대한 답이다. 학생이 이 탭에 오는 이유는 **내가 얼마나 쌓았나**를 보는
        것이고, 정답률은 그 아래 `지금까지`의 한 줄로 내려간다.

        **머리글자를 카드로 감싸지 않는다.** 여백과 타이포그래피로 위계를 만든다
        (`CLAUDE.md` — 단순한 구분은 카드가 아니다). 아래 지표는 전부 목록 한 줄이고(D-050),
        면을 쓰는 자리는 결과 화면의 축하 블록 하나뿐이다.

        `firstDay`가 없으면 아무 기록도 없는 계정이다 — 0으로 채운 값을 그리지 않고
        **규칙과 첫 목표를 말하는 블록 하나**로 바꾼다(아래 `다가오는 기록` 갈래). 빈 카드 여덟
        개를 남기지 않고(§9), 홈이 `나의 기록 보기`로 보낸 학생이 도착한 화면에 기록이라는 개념이
        사라지지도 않는다.

        ## 머리글자는 아래 목록을 되풀이하지 않는다

        예전에는 eyebrow가 `지금까지`이고 캡션이 `{문항} · {학습 시간} · 오답 {익힘}개 익힘`이었다 —
        `지금까지` 섹션 9행 중 **4행이 같은 필드를 같은 포맷터로 다시 적었고**, 같은 라벨이
        eyebrow와 섹션 제목(h2) 두 곳에 있어서 스크린리더로 제목을 훑으면 나오는 `지금까지` h2가
        큰 숫자가 있는 블록이 아니었다. 지금 캡션은 아래 어느 줄도 말하지 않는 사실
        (**언제부터 쌓았는지**)이고 eyebrow는 섹션 제목과 다른 이름이다.
      */}
      {records && firstDay ? (
        <>
          <View style={styles.headline} testID="records-headline">
            <AppText variant="caption" tone="secondary">
              쌓아 온 기록
            </AppText>
            <View style={styles.headlineRow}>
              {/*
                이 화면에서 가장 큰 글자다. **`variant="display"`가 크기·무게·줄간격·자간을 정한다**
                (§4) — 손으로 쌓은 스타일이 D-166에서 걷어낸 자간(`tracking.tighter`, -0.6)을
                되살리고 있었다.
              */}
              <AppText variant="display" numeric>
                {formatCount(records.totals.studyDays)}
              </AppText>
              <AppText variant="label" tone="secondary">
                일 공부했어요
              </AppText>
            </View>
            <AppText variant="caption" tone="secondary">
              {`${formatDate(firstDay)}에 시작했어요`}
            </AppText>
          </View>

          <Section title="오늘">
            <Group>
              <Row
                testID="records-today"
                title="오늘 한 공부"
                subtitle={todayLine(records) || '아직 시작하지 않았어요'}
              />
              {/*
                **문장과 값이 같은 수를 두 번 말하지 않는다.** 예전에는 `subtitle`이
                `17일째 공부 중`이고 `trailing`이 `17일`이었다. 그리고 연속이 0이면 문장에는 수가
                없는데 `trailing`은 `0일`이었다 — 뜻이 없는 수치다(§13). 지금 문장은 조건만,
                값은 `trailing`만 말하고 0일 때는 값을 그리지 않는다.
              */}
              <Row
                testID="records-streak"
                title="연속 학습"
                subtitle={streakLine(records)}
                trailing={
                  records.streak.current > 0 ? (
                    <AppText variant="label" numeric>
                      {`${formatCount(records.streak.current)}일`}
                    </AppText>
                  ) : null
                }
              />
              {/*
                **보호 장치를 숨기지 않는다.** 하루 빠졌는데 연속이 그대로면 학생은 숫자가
                틀린 것으로 읽는다. 몇 개 남았는지와 어떻게 생기는지를 같은 줄에서 말한다.

                **한 문장이고 마침표가 없다.** 예전에는 이 부제만 두 문장이고 이 화면의 `Row`
                부제 중 유일하게 마침표가 있었다 — 마침표가 남는 슬롯은 `EmptyState` 부제와
                축하 블록의 근거 줄이고 그 둘은 서로 일관된다.
              */}
              <Row
                testID="records-protect"
                title="기록 보호"
                /*
                  얻는 방법과 **쓰인 사실**을 함께 말한다(`protectionLine`). 보호가 쓰인 날을
                  말하지 않으면, 어제 안 했는데 연속이 그대로인 학생은 그 숫자를 틀린 것으로 읽는다.
                */
                subtitle={protectionLine(records)}
                trailing={
                  <AppText variant="label" numeric>
                    {`${records.streak.protections}개`}
                  </AppText>
                }
              />
            </Group>
          </Section>

          {/*
            ## 왜 회고보다 전망이 먼저인가

            이 화면에 **돌아올 이유**를 만드는 것은 근접 목표다(D-179 ③ — 다가오는 것을 먼저
            보여 준다). 그런데 이 섹션은 회고 지표 다섯 덩어리 뒤, 3.5화면 스크롤의 y≈2,100에
            있었다(실측) — 화면을 열어 위쪽만 보는 학생에게는 없는 것과 같다. §19가 학부모
            리포트의 `자세히 보기`를 같은 이유로 y≈2,400에서 y≈374로 올린 선례가 있다.

            그래서 `오늘` 바로 뒤로 올린다. 위 두 섹션이 **지금 상태**(오늘·연속·보호)와
            **다음 한 걸음**(다가오는 기록)이고, 그 뒤가 쌓인 것을 되돌아보는 자리다.
            마스터 플랜 4절의 섹션 순서를 이 판단으로 고쳤다(D-182).
          */}
          {upcomingGroup ? <Section title="다가오는 기록">{upcomingGroup}</Section> : null}

          <Section title="최근 4주">
            <DayHeatmap
              days={records.days}
              studyDayQuestions={records.studyDayQuestions}
              testID="records-heatmap"
            />
            <Group>
              <Row
                testID="records-consistency"
                title="공부한 날"
                subtitle={`${steady.days}일 중 ${steady.studied}일`}
                trailing={
                  <AppText variant="label" numeric>
                    {`${steady.percent}%`}
                  </AppText>
                }
              />
            </Group>
          </Section>

          {/*
            ## 지난주의 나와 비교한다

            **다른 학생과 비교하지 않는다.** 초기 버전에 전체 순위를 두지 않는 것은 제품 결정이고
            (`src/features/records.ts`의 근거) 여기가 그 결정이 화면에 나타나는 자리다.

            **지난 값이 0이면 변화율을 만들지 않는다.** `0 → 12`를 `+1200%`로 말하면 숫자가
            뜻을 잃는다 — 그때는 지난주 값을 그대로 적는다.
          */}
          <Section title="이번 주">
            <Group>
              {weekRows.map((r) => (
                <Row
                  key={r.key}
                  testID={`records-week-${r.key}`}
                  title={r.title}
                  subtitle={weekToDateLine(r.now, r.before, r.fmt)}
                  trailing={
                    <AppText variant="label" numeric>
                      {r.fmt(r.now)}
                    </AppText>
                  }
                />
              ))}
              {/*
                **여기서는 비율을 만들지 않는다.**

                이 값은 **완성된 4주의 주당 평균**이라 진행 중인 이번 주와 나누면 위 세 줄이 피한
                결함이 그대로 돌아온다(월요일에 `-100%`). 지난주 비교는 같은 길이의 창끼리 하지만
                (`lastWeekToDate`) 4주 평균에는 그 창이 없다 — 네 주의 같은 시점을 각각 잘라 평균을
                내는 것은 이 줄이 답하는 질문(`평소 얼마나 하나`)에 필요하지 않다.

                그래서 **두 수를 나란히 적고 학생이 읽게 둔다.** 자기 비교의 뜻은 위 세 줄이 이미
                맡고 있고, 이 줄은 그 배경이다.
              */}
              {/*
                **끝난 주의 추이.** 서버가 최근 8주를 이미 내려보내는데 읽는 화면이 없었다(A-149).
                선은 `trailing`에 둔다 — `Sparkline`은 글자 한 개 크기의 그림이라 **모양만** 보여
                주고 정확한 값은 위 세 줄이 말한다(그 컴포넌트의 docblock이 정한 용도다).
                이번 주는 넣지 않는다(`completedWeekTrend` · §18-0).
              */}
              {trend.length > 0 ? (
                <Row
                  testID="records-trend"
                  title="주당 추이"
                  subtitle={`끝난 ${formatCount(trend.length)}주의 푼 문항이에요`}
                  trailing={
                    <Sparkline values={trend} label={sparkLabel('주당 푼 문항', trend, '문항')} />
                  }
                />
              ) : null}
              <Row
                testID="records-week-avg"
                title="평소 한 주"
                subtitle="최근 4주(이번 주 제외)의 주당 평균이에요"
                trailing={
                  <AppText variant="label" numeric>
                    {avgWeekQuestions > 0
                      ? `${formatCount(avgWeekQuestions)}문항`
                      : '아직 없어요'}
                  </AppText>
                }
              />
            </Group>
          </Section>

          {/*
            **아직 세우지 않은 기록은 줄을 만들지 않는다.**

            예전에는 네 줄을 늘 그렸고, 값이 0인 줄은 `0개` + `{가장 최근 날짜}에 세웠어요`가 됐다.
            지금은 값이 있는 줄만 남기고 하나도 없으면 이 섹션을 그리지 않는다 — §9의
            `빈 카드를 남기지 않는다`이고, 이 파일의 `todayLine`이 이미 같은 규칙을 쓴다
            (`0인 항목은 빼고 말한다`). `최장 연속 학습`은 최고 기록이 아니라 지금 상태의 짝이라
            항상 남는다.
          */}
          {bestRows.length > 0 ? (
          <Section title="나의 최고 기록">
            <Group>
              {bestRows.map((b) => (
                <Row
                  key={b.key}
                  testID={`records-best-${b.key}`}
                  title={b.title}
                  subtitle={b.subtitle}
                  trailing={
                    <AppText variant="label" numeric>
                      {b.value}
                    </AppText>
                  }
                />
              ))}
              <Row
                testID="records-longest"
                title="최장 연속 학습"
                /*
                  **따라잡을 거리를 말한다.** 목표 설정 이론의 근접 목표다 — 최장 기록이 지금
                  기록이면 그 사실을 말하고, 남았으면 며칠인지 말한다.
                */
                subtitle={
                  longestGap == null
                    ? '지금이 가장 긴 기록이에요'
                    : `최장 기록까지 ${longestGap}일 남았어요`
                }
                trailing={
                  <AppText variant="label" numeric>
                    {`${formatCount(records.streak.longest)}일`}
                  </AppText>
                }
              />
            </Group>
          </Section>
          ) : null}

          <Section title="지금까지">
            <Group>
              <Row
                title="총 학습일"
                trailing={
                  <AppText variant="label" numeric>{`${formatCount(records.totals.studyDays)}일`}</AppText>
                }
              />
              <Row
                title="학습 시간"
                trailing={
                  <AppText variant="label" numeric>{formatDuration(records.totals.activeSec)}</AppText>
                }
              />
              <Row
                title="푼 문항"
                trailing={
                  <AppText variant="label" numeric>
                    {`${formatCount(records.totals.solvedQuestions)}문항`}
                  </AppText>
                }
              />
              {/*
                **`완료한 학습`이라고 부르지 않는다.** 서버 뷰는 `(학생, 제출일, 출처, 배정/세트)`별
                1건으로 세므로 **다른 날 다시 푼 세트를 다시 센다**
                (`supabase/migrations/0044_learning_records.sql`가 그것을 의도라고 밝힌다). 아래
                `완료한 학습` 목록은 세트당 최신 회차 하나만 남기므로 두 수가 다르다 — 한 화면에서
                같은 이름이 다른 수를 가리키고 있었다. 이름을 갈라 무엇을 세는지 부제로 말한다.
              */}
              <Row
                testID="records-submitted"
                title="제출한 학습"
                subtitle="다른 날 다시 푼 학습도 따로 세요"
                trailing={
                  <AppText variant="label" numeric>
                    {`${formatCount(records.totals.setsCompleted)}개`}
                  </AppText>
                }
              />
              {/*
                **오답을 세 줄로 나눠 말한다.** 담은 것 · 다시 푼 것 · 익힌 것은 다른 사실이고,
                이 서비스에서 가장 중요한 성취는 세 번째다(D-176의 사다리를 끝까지 오른 것).
              */}
              <Row
                title="담은 오답"
                trailing={
                  <AppText variant="label" numeric>
                    {`${formatCount(records.totals.notesAdded)}개`}
                  </AppText>
                }
              />
              <Row
                title="다시 푼 오답"
                subtitle={`그중 ${formatCount(records.totals.reviewsCorrect)}번 맞혔어요`}
                trailing={
                  <AppText variant="label" numeric>
                    {`${formatCount(records.totals.reviewsDone)}번`}
                  </AppText>
                }
              />
              <Row
                testID="records-mastered"
                title="익힌 오답"
                subtitle="서로 다른 날 세 번 맞힌 오답이에요"
                trailing={
                  <AppText variant="label" numeric>
                    {`${formatCount(records.totals.notesMastered)}개`}
                  </AppText>
                }
              />
              {/*
                정답률은 이 화면의 머리글자에서 내려왔다. 값은 예전과 같은 계산이고
                (`attempts`의 최신 회차 평균) 자리만 바뀌었다.
              */}
              {avg != null ? (
                <Row
                  testID="records-accuracy"
                  title="평균 정답률"
                  /* 세는 대상을 이름으로 못박는다 — 이 수는 아래 `완료한 학습` 목록의 길이다. */
                  subtitle={`아래 완료한 학습 ${list.length}개의 평균이에요`}
                  trailing={<AppText variant="label" numeric>{`${avg}%`}</AppText>}
                />
              ) : null}
            </Group>
            {/*
              **측정 방식을 학생에게도 밝힌다.** 학부모 화면(`StudyProof`)에만 있던 고지다 —
              행동을 바꿔야 하는 쪽은 학생인데 규칙은 학생만 몰랐고, 그러면 위 숫자들은 근거 없는
              수치가 된다(`CLAUDE.md`). 문구는 두 화면이 같은 상수에서 가져온다.
            */}
            <AppText variant="caption" tone="secondary" testID="records-method">
              {studyMethodNotice('student', records)}
            </AppText>
          </Section>


          {achieved.length > 0 ? (
            <Section title="이룬 기록">
              <Group>
                {achieved.map((m) => (
                  <Row
                    key={`${m.kind}-${m.threshold}`}
                    testID={`records-achieved-${m.kind}`}
                    title={m.label}
                    leading={<Icon name="check" size={16} color={colors.success} />}
                  />
                ))}
              </Group>
            </Section>
          ) : null}
        </>
      ) : records ? (
        /*
          ## 아직 아무 기록도 없는 계정

          **빈 카드 여덟 개를 남기지 않는다**(§9). 그런데 예전에는 그 자리에 아무것도 두지 않아서,
          홈이 `나의 기록 보기`로 보낸 학생이 도착한 화면에 **기록이라는 개념이 한 글자도 없었다**.

          그래서 규칙과 첫 목표를 말하는 블록 하나를 둔다: 측정 방식 한 줄(학습일 기준을 함께
          말한다)과 `다가오는 기록` 세 줄이다 — 그 세 줄은 이 계정에서도 값이 있다(남은 수가 곧
          기준선이다). **다음 행동은 두지 않는다**: 아래 `완료한 학습` 빈 상태가 이 화면의 하나뿐인
          행동(`records-empty-start`)을 이미 들고 있고, 행동은 화면에 하나다(§9).
        */
        <Section title="다가오는 기록">
          <AppText variant="caption" tone="secondary" testID="records-method">
            {studyMethodNotice('student', records)}
          </AppText>
          {upcomingGroup}
        </Section>
      ) : null}

      {/*
        읽지 못한 상태에서는 섹션 껍데기를 남기지 않는다(§9 `빈 카드를 남기지 않는다`).
        위 실패 줄이 이미 그 자리를 말했다.
      */}
      {empty && loadError ? null : (
        <Section
          title="완료한 학습"
          action={
            !empty && filtered.length > RECENT ? (
              <Button
                testID="records-more"
                variant="secondary"
                size="sm"
                tone="accent"
                hug
                label={showAll ? '접기' : `${filtered.length - RECENT}개 더 보기`}
                onPress={() => setShowAll((v) => !v)}
              />
            ) : null
          }
        >
          {!empty ? (
            <>
              {canFilter ? (
                <SegmentedControl
                  testID="records-source"
                  options={sourceOptions}
                  value={filter}
                  onChange={setSource}
                />
              ) : null}
              <Group>
                {visible.map((a) => (
                  <Row
                    key={a.itemId}
                    title={a.title}
                    /*
                      날짜를 넣어 정렬 근거를 화면에 남긴다. 형식은 `formatDate` 한곳에서 오고
                      (ISO 원문을 화면에 내보내지 않는다, §8) 제출일이 비어 있는 기록은
                      학부모 리포트와 같은 문장으로 말한다.
                    */
                    subtitle={[
                      '국어',
                      a.area,
                      a.dateISO ? formatDate(a.dateISO) : '제출일 기록 없음',
                      formatDuration(a.timeSec),
                    ].join(' · ')}
                    /* 출처는 손으로 쓴 글이 아니라 `SourceTag`다(§18). 줄의 첫 자리에 둔다. */
                    leading={<SourceTag source={a.source} />}
                    /* 이 화면의 핵심 값이다. `meta`는 `inkTertiary`(3.23:1, AA 미달)라 쓰지 않는다(§8). */
                    trailing={<AppText variant="label" numeric>{`${a.accuracy}%`}</AppText>}
                    /*
                      `trailing`이 있으면 chevron을 두지 않는다(§8·`Row` docblock). `trailing`은 누름
                      영역 밖에 붙어서, 함께 주면 순서가 `[제목 … >][80%]`가 되어 이 화면의 핵심 값이
                      이동 표시 뒤로 밀린다. 화살표가 없어도 행은 그대로 눌린다.
                    */
                    onPress={() => router.push(`/student/result/${a.itemId}` as never)}
                  />
                ))}
              </Group>
            </>
          ) : reading ? (
            /* 읽는 중에는 없다고 말하지 않는다(D-133). 무게는 다른 학생 화면과 같은 한 줄이다. */
            <AppText variant="caption" tone="secondary">
              기록을 불러오고 있어요.
            </AppText>
          ) : (
            /* 빈 상태의 형태는 앱에 하나뿐이다(D-104). 다음 행동도 하나만 둔다. */
            <EmptyState
              title="아직 제출한 학습이 없어요"
              /*
                **고를 수 없는 학생에게는 이유를 말한다**(D-141). 예전에는 누구에게나
                `학습을 제출하면 … 쌓여요.`라고만 하고 `문제 담으러 가기`를 함께 줬다.
              */
              subtitle={
                hasPersonal ? '학습을 제출하면 정답률과 걸린 시간이 여기에 쌓여요.' : noPickReason
              }
              action={
                /*
                  **이용권이 없으면 고르러 가는 행동을 두지 않는다**(D-141). 그 목적지에서 이
                  학생이 누를 수 있는 것은 0개다 — `learn.tsx`는 `hasPersonal`이 false면 고르기
                  진입 줄을 아예 렌더하지 않는다. 홈 세 자리에서 없앤 거짓말의 네 번째 자리였다.

                  남는 경우에도 무게는 앱 어디서나 같다: **강조색 + `hug` + 화살표**
                  (`index.tsx` 두 곳 · `queue.tsx` 두 곳도 같다, D-123). 다른 화면으로 보내기만
                  하는 버튼은 전폭이 아니다(§8).
                */
                hasPersonal ? (
                  <Button
                    testID="records-empty-start"
                    hug
                    label="문제 담으러 가기"
                    trailing={<Icon name="arrow-right" size={16} color={colors.accentText} />}
                    onPress={() => router.push('/student/learn' as never)}
                  />
                ) : null
              }
            />
          )}
        </Section>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  /* 머리글자. 카드가 아니라 여백과 크기로 위계를 만든다. */
  headline: { gap: spacing.xxs },
  headlineRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs2 },
  /*
    큰 숫자에는 스타일이 없다 — `AppText variant="display"`가 크기·무게·줄간격·자간을 정한다(§4).
    손으로 쌓은 `headlineNumber`(1.15 · -0.6)가 §4의 자간 상한(-0.2 정도)을 벗어나 D-166이
    `AppText`에서 걷어낸 값을 이 화면에만 되살리고 있었다.
  */
});
