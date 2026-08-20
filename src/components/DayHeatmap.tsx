import { View, StyleSheet } from 'react-native';

import { AppText } from './AppText';
import { formatDate } from '@/features/clock';
import { colors, radius, spacing } from '@/theme/tokens';

/** 한 칸이 하루. 화면이 넘겨주는 형태는 `rpc_student_records`의 `days`와 같다. */
export interface HeatmapDay {
  day: string;
  gradedQuestions: number;
  isStudyDay: boolean;
}

/**
 * 최근 며칠을 공부했는지 한눈에.
 *
 * ## 왜 단계가 셋인가
 *
 * 잔디를 다섯 단계로 칠하면 `12문항`과 `18문항`이 다른 색이 되는데, 그 차이는 이 화면이 답하는
 * 질문(`꾸준히 했나`)과 관계가 없다. 그리고 단계가 많아지면 색만 보고 값을 되짚을 수 없어
 * **장식이 내용보다 먼저 보이는 화면**이 된다(`CLAUDE.md` 디자인 규칙).
 *
 * 세 단계는 각각 사실 하나에 대응한다.
 * - 빈 칸: 아무 기록이 없는 날
 * - 테두리 칸: 손을 댔지만 학습일 기준(`studyDayQuestions`)에 닿지 않은 날
 * - 진한 칸: 학습일
 *
 * ## 단계를 색으로만 가르지 않는다
 *
 * 중간 단계는 처음에 `accentSoft` 면이었다 — 그런데 빈 칸(`offset`)과 **명도 대비가 라이트
 * 1.01:1 · 다크 1.07:1**이다(실측). 색조만 다르고 명도가 같아 셋째 단계가 화면에서 사라졌고,
 * 색 인지에 차이가 있는 사람에게는 아예 없는 단계였다(§11 — 색만으로 뜻을 전하지 않는다).
 * 지금은 **모양이 먼저 바뀐다**: 면은 빈 칸과 같은 `offset`으로 두고 강조색 테두리를 두른다
 * (`offset` 위 `accent`는 라이트 3.85:1 · 다크 5.27:1로 비문자 요소 기준 3:1을 넘는다).
 *
 * ## 칸 크기에 상한을 둔다
 *
 * `flex: 1`만 두었을 때는 **컬럼 폭이 곧 칸 크기**였다 — 390에서 47.7px인 칸이 820·1280에서
 * 93.7px이 되고 블록 높이가 387px이 되어, 이 화면에서 가장 큰 요소가 잔디였다
 * (`CLAUDE.md`의 `장식이 내용보다 먼저 보이는 화면` · §13의 `의미 없는 그래프`).
 *
 * ## 날짜 형식은 앱에 하나다
 *
 * 이 파일에 `dayLabel` 사본이 있었다 — `formatDate`(`src/features/clock.ts`)와 같은 출력이고
 * 차이는 잘못된 문자열 가드 한 줄뿐이었다. 그 가드를 `formatDate`로 옮기고 여기서는 그것을
 * 부른다. D-178·A-147이 정리한 결함(같은 값이 화면마다 다른 글자)이 다시 시작될 자리였고,
 * 하필 `formatDate`의 docblock이 그 근거로 **이 캡션**을 인용하고 있었다.
 *
 * ## 왜 요일을 맞추지 않는가
 *
 * 요일에 맞추면 앞줄에 최대 6개의 빈 자리가 생기고, 그 빈 자리와 `공부하지 않은 날`이 같은
 * 모양이 된다 — 세지 못하는 격자가 된다. 여기서는 **오래된 날부터 순서대로** 채우고 기간을
 * 글로 밝힌다.
 *
 * ## 접근성
 *
 * 칸마다 초점을 두지 않는다. 28번 탭해서 얻는 것이 없고, 스크린리더에게 필요한 것은 요약
 * 한 문장이다(`Sparkline`과 같은 판단).
 */
export function DayHeatmap({
  days,
  studyDayQuestions,
  perRow = 7,
  testID,
}: {
  days: readonly HeatmapDay[];
  /**
   * 학습일로 인정되는 최소 채점 문항. **서버가 준 값을 화면이 넘겨준다**
   * (`records.studyDayQuestions`).
   *
   * 예전에는 이 컴포넌트가 `@/features/records`의 상수를 직접 읽었다. 값은 같았지만 그 규칙의
   * 진실이 두 곳(DB 판정과 클라이언트 상수)에 있었고, 공용 컴포넌트가 도메인 모듈에 의존할
   * 이유도 그 상수 하나였다.
   */
  studyDayQuestions: number;
  perRow?: number;
  testID?: string;
}) {
  if (days.length === 0) return null;

  const studied = days.filter((d) => d.isStudyDay).length;
  /* 손은 댔지만 학습일에 닿지 않은 날. 캡션과 스크린리더 문장이 이 수를 함께 쓴다. */
  const partial = days.filter((d) => !d.isStudyDay && d.gradedQuestions > 0).length;
  const rows: HeatmapDay[][] = [];
  for (let i = 0; i < days.length; i += perRow) rows.push([...days.slice(i, i + perRow)]);

  return (
    <View style={styles.wrap} testID={testID}>
      <View
        accessible
        accessibilityRole="image"
        /*
          중간 단계도 말한다. 예전에는 `학습일`만 세어서, 화면에는 있는 단계 하나가 스크린리더
          쪽에서 통째로 빠졌다. **0인 단계는 세지 않는다** — 하지 않은 일을 굳이 세는 문장이
          되고(`todayLine`과 같은 규칙) 뜻 없는 수치가 남는다(§13).
        */
        accessibilityLabel={
          partial > 0
            ? `최근 ${days.length}일 중 ${studied}일 공부했어요. ${partial}일은 ${studyDayQuestions}문항에 닿지 않았어요.`
            : `최근 ${days.length}일 중 ${studied}일 공부했어요.`
        }
        style={styles.grid}
      >
        {rows.map((row) => (
          <View key={row[0].day} style={styles.row}>
            {row.map((d) => (
              <View
                key={d.day}
                testID={`heat-${d.day}`}
                style={[
                  styles.cell,
                  d.isStudyDay
                    ? styles.cellStudy
                    : d.gradedQuestions > 0
                      ? styles.cellSome
                      : null,
                ]}
              />
            ))}
          </View>
        ))}
      </View>
      {/*
        기간과 뜻을 글로 밝힌다. 색만으로 뜻을 전하지 않는다(§11 — 글자가 먼저 바뀌고 색은
        그다음이다). 날짜는 `M월 D일`로 짧게 — 이 줄은 값이 아니라 축이다.

        **두 단계를 다 말한다.** 예전에는 `진한 칸이 공부한 날이에요` 하나뿐이라 테두리 칸의
        뜻을 화면 어디서도 알 수 없었다. 학습일 기준 문항 수는 상수에서 온다 — 화면에 다시
        적으면 DB 값(`v_daily_learning_stats`)과 갈린다.
      */}
      <AppText variant="caption" tone="tertiary">
        {`${formatDate(days[0].day)} ~ ${formatDate(days[days.length - 1].day)} · 진한 칸은 ${studyDayQuestions}문항 이상 푼 날${
          partial > 0 ? ', 테두리 칸은 그보다 적게 푼 날이에요' : '이에요'
        }`}
      </AppText>
    </View>
  );
}

/**
 * 칸 한 변의 상한(px).
 *
 * **모바일에서 컬럼을 꽉 채우는 크기다** — 390에서 한 줄 7칸 + `spacing.xs` 간격 6개가
 * 컬럼(약 342px)을 나눠 쓰면 한 변이 47.7px이다(실측). 그 값을 상한으로 삼으면 모바일 모양은
 * 그대로이고, 컬럼이 680px인 820·1280에서만 칸이 커지는 것을 막는다(그때 93.7px · 블록 높이
 * 387px이었다).
 */
const CELL_MAX = 48;

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  grid: { gap: spacing.xs },
  /* 남는 폭은 오른쪽에 둔다 — 상한에 걸린 칸이 넓은 화면에서 흩어지지 않게 왼쪽으로 붙인다. */
  row: { flexDirection: 'row', gap: spacing.xs, justifyContent: 'flex-start' },
  /*
    칸은 늘어나서 화면 폭을 채우되 **한 변이 `CELL_MAX`를 넘지 않는다** — 고정 px로 두면
    모바일에서 오른쪽이 비고, 상한이 없으면 넓은 화면에서 잔디가 화면의 주인공이 된다.
    `aspectRatio`가 정사각을 지킨다.
  */
  cell: {
    flex: 1,
    maxWidth: CELL_MAX,
    aspectRatio: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.offset,
    /* 빈 칸도 경계가 있어야 '칸'으로 보인다. 없으면 배경과 붙어 격자가 사라진다. */
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  /*
    중간 단계. **면을 바꾸지 않고 테두리를 두른다**(위 docblock의 실측 근거). `hairline`이 아니라
    1px이다 — 0.5px 선은 이 크기에서 빈 칸과 구분되지 않았다.
  */
  cellSome: { borderWidth: 1, borderColor: colors.accent },
  cellStudy: { backgroundColor: colors.accent, borderColor: colors.accent },
});
