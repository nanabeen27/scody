import { View, StyleSheet } from 'react-native';

import { AppText } from './AppText';
import { DayHeatmap } from './DayHeatmap';
import { Group } from './Group';
import { Icon } from './Icon';
import { Row } from './Row';
import { Section } from './Section';
import { formatDuration } from '@/features/learning';
import {
  achievedMilestones,
  consistency,
  formatCount,
  studyMethodNotice,
  weekToDateLine,
} from '@/features/records';
import type { StudentRecords } from '@/repo/records';
import { colors, spacing } from '@/theme/tokens';

/**
 * 학습 증명. **학부모가 5초 안에 "이번 주에 얼마나, 얼마나 꾸준히, 무엇이 나아졌나"를 읽는다.**
 *
 * ## 학생 화면을 그대로 보여 주지 않는다
 *
 * 학생 쪽에는 축하·다가오는 목표·개인 최고 갱신이 있다. 그것은 학생을 계속하게 만드는 장치이고
 * 학부모가 볼 것이 아니다 — 학부모가 이 화면에서 얻어야 하는 것은 **신뢰**다. 그래서 여기에는
 * 축하 문구도, 다가오는 목표도, 갱신 알림도 없다. 세어진 수와 그 수가 무엇을 세는지만 있다.
 *
 * ## 측정 방식을 화면에서 밝힌다
 *
 * 아래 마지막 캡션이 이 컴포넌트에서 가장 중요한 줄이다. `학습 시간 3시간 20분`은 학부모가
 * 자녀를 판단하는 근거가 되므로, 그 값이 **무엇을 세고 무엇을 세지 않는지** 화면이 말해야 한다.
 * 밝히지 않으면 그 숫자는 근거 없는 수치가 된다(`CLAUDE.md`가 금지하는 자리다).
 *
 * ## 지표는 카드가 아니라 목록 한 줄이다
 *
 * D-050 그대로다. 값은 `trailing`, 비교와 정의는 `subtitle`이다.
 */
export function StudyProof({ records }: { records: StudentRecords }) {
  const { week, lastWeekToDate, streak, totals } = records;
  const goalMet = week.studyDays >= streak.weekGoal;
  const recent7 = records.days.slice(-7).filter((d) => d.isStudyDay).length;
  const achieved = achievedMilestones(records).slice(0, 2);
  const steady = consistency(records);

  const days = (n: number) => `${formatCount(n)}일`;
  const sets = (n: number) => `${formatCount(n)}개`;
  const questions = (n: number) => `${formatCount(n)}문항`;

  /**
   * 지난주 같은 시점과 비교하는 네 줄. **표로 둔다.**
   *
   * 예전에는 `Row` 네 벌이 12줄 골격을 손으로 반복하면서 **비교 창을 줄마다 골랐다** —
   * `week.X`와 `lastWeekToDate.X`를 짝지어 적는 자리가 넷이고, 한 줄에서 `lastWeek`(완성된 7일)을
   * 쓰면 그 줄만 월요일에 `-100%`가 된다. 0047이 고친 결함이 한 줄 단위로 돌아올 수 있는
   * 모양이었다. 표로 두면 창을 **한 번** 고른다.
   */
  const weekRows = [
    { key: 'days', title: '공부한 날', now: week.studyDays, before: lastWeekToDate.studyDays, fmt: days },
    {
      key: 'time',
      title: '실제 학습 시간',
      now: week.activeSec,
      before: lastWeekToDate.activeSec,
      fmt: formatDuration,
    },
    {
      key: 'questions',
      title: '푼 문항',
      now: week.solvedQuestions,
      before: lastWeekToDate.solvedQuestions,
      fmt: questions,
    },
    {
      key: 'sets',
      title: '완료한 학습',
      now: week.setsCompleted,
      before: lastWeekToDate.setsCompleted,
      fmt: sets,
    },
  ];

  /**
   * 머리 문장. **셋만 담는다** — 일수·시간·문항이 `얼마나 공부했나`의 답이고, 그 이상은
   * 5초 안에 읽히지 않는다.
   */
  const headline = [
    `${formatCount(week.studyDays)}일`,
    formatDuration(week.activeSec),
    `${formatCount(week.solvedQuestions)}문항`,
  ].join(' · ');

  return (
    <Section title="이번 주 학습 증명">
      <View style={styles.head}>
        <AppText variant="subheading" testID="proof-headline">
          {headline}
        </AppText>
        <AppText variant="caption" tone="secondary">
          {goalMet
            ? `주간 목표 ${streak.weekGoal}일을 채웠어요.`
            : `주간 목표 ${streak.weekGoal}일 중 ${formatCount(week.studyDays)}일을 채웠어요.`}
        </AppText>
      </View>

      {/* 최근 4주. 주간 숫자 하나로는 `꾸준함`이 보이지 않는다. */}
      <DayHeatmap
        days={records.days}
        studyDayQuestions={records.studyDayQuestions}
        testID="proof-heatmap"
      />

      <Group>
        {weekRows.map((r) => (
          <Row
            key={r.key}
            testID={`proof-${r.key}`}
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
          **오답은 두 줄로 말한다.** `다시 본 것`과 `맞힌 것`은 다른 사실이고, 학부모가 보고
          싶은 것은 틀린 문제를 실제로 해결했는지다.
        */}
        <Row
          testID="proof-reviews"
          title="오답 다시 학습"
          subtitle={`그중 ${formatCount(week.reviewsCorrect)}번 맞혔어요`}
          trailing={<AppText variant="label" numeric>{`${formatCount(week.reviewsDone)}번`}</AppText>}
        />
        <Row
          testID="proof-mastered"
          title="익힌 오답"
          subtitle="서로 다른 날 세 번 맞혀서 익힘에 닿은 오답이에요"
          trailing={
            <AppText variant="label" numeric>{`${formatCount(week.notesMastered)}개`}</AppText>
          }
        />
        <Row
          testID="proof-streak"
          title="연속 학습"
          subtitle={
            streak.longest > streak.current
              ? `가장 길었던 기록은 ${formatCount(streak.longest)}일이에요`
              : '지금이 가장 긴 기록이에요'
          }
          trailing={<AppText variant="label" numeric>{`${formatCount(streak.current)}일`}</AppText>}
        />
        <Row
          testID="proof-consistency"
          title="최근 4주 꾸준함"
          subtitle={`${steady.days}일 중 ${steady.studied}일 · 최근 7일은 ${recent7}일`}
          trailing={<AppText variant="label" numeric>{`${steady.percent}%`}</AppText>}
        />
      </Group>

      {/*
        **`지금까지`는 한 줄로만 둔다.** 학부모 리포트는 한 달이 하나이고 누적 총합을 두지 않는
        것이 확정된 구성이다(마스터 플랜 4절) — 그 규칙을 깨지 않으면서도 `얼마나 오래 해 왔나`는
        신뢰의 근거라, 지표 목록이 아니라 캡션 한 줄로 말한다.
      */}
      {totals.firstDay ? (
        <AppText variant="caption" tone="tertiary" testID="proof-since">
          {`${formatCount(totals.studyDays)}일 동안 ${formatCount(totals.solvedQuestions)}문항을 풀었어요.`}
        </AppText>
      ) : null}

      {achieved.length > 0 ? (
        <Group>
          {achieved.map((m) => (
            <Row
              key={`${m.kind}-${m.threshold}`}
              testID={`proof-achieved-${m.kind}`}
              title={m.label}
              subtitle="자녀가 달성한 기록이에요"
              leading={<Icon name="check" size={16} color={colors.success} />}
            />
          ))}
        </Group>
      ) : null}

      {/*
        이 화면에서 가장 중요한 한 줄이다. 위 숫자들이 무엇을 세는지 밝히지 않으면 학부모는
        그 값을 믿을 근거가 없다.

        **문구는 화면에 적지 않는다**(`studyMethodNotice`). 같은 규칙을 학생 기록 화면도
        말하는데, 두 곳에 손으로 적어 두면 한쪽만 고쳐진다 — 그러면 자녀와 학부모가 같은 숫자를
        다른 규칙으로 이해한다.
      */}
      <AppText variant="caption" tone="secondary" testID="proof-method">
        {studyMethodNotice('parent', records)}
      </AppText>
    </Section>
  );
}

const styles = StyleSheet.create({
  /* 머리 문장과 목표 한 줄. 한 덩어리 안에서 줄만 갈린다. */
  head: { gap: spacing.xxs },
});
