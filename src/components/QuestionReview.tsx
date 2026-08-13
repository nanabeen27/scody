import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import type { Question } from '@/data';
import { colors, spacing, font, typeface } from '@/theme/tokens';

interface Props {
  index: number;
  question: Question;
  pickedIndex?: number;
  /**
   * 정오를 직접 넘긴다. 학원 제출 기록처럼 **틀린 문항은 아는데 무엇을 골랐는지는
   * 남아 있지 않은** 경우에 쓴다. 주지 않으면 `pickedIndex`로 판정한다.
   */
  correct?: boolean;
  /** 고른 답 줄의 이름. 학부모 화면에서는 `자녀가 고른 답`. */
  pickedLabel?: string;
}

/** 결과 문항 리뷰. 채운 배지 대신 작은 점+텍스트로 정오를 절제 있게 표시. */
export function QuestionReview({
  index,
  question,
  pickedIndex,
  correct: correctProp,
  pickedLabel = '내 답',
}: Props) {
  const correct = correctProp ?? pickedIndex === question.answerIndex;
  const picked = pickedIndex != null ? question.choices[pickedIndex] : null;
  const answer = question.choices[question.answerIndex];
  const statusColor = correct ? colors.success : colors.danger;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <AppText variant="caption" tone="tertiary">
          {index + 1}번
        </AppText>
        <View style={styles.status}>
          <View style={[styles.dot, { backgroundColor: statusColor }]} />
          <AppText variant="caption" style={{ color: statusColor, fontFamily: typeface.medium }}>
            {correct ? '정답' : '오답'}
          </AppText>
        </View>
      </View>

      <AppText variant="label">{question.prompt}</AppText>

      {/* 고른 답을 모르면 그 줄을 그리지 않는다. 없는 기록을 '선택 안 함'으로 말하지 않는다. */}
      {!correct && picked != null ? (
        <AppText variant="caption" tone="secondary">
          {pickedLabel} · {picked}
        </AppText>
      ) : null}
      <AppText variant="caption" tone="secondary">
        정답 · {answer}
      </AppText>

      {question.explanation ? (
        <View style={styles.explain}>
          <AppText variant="caption" tone="tertiary" style={{ fontFamily: typeface.medium }}>
            해설
          </AppText>
          <AppText style={styles.explainText}>{question.explanation}</AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: spacing.lg, paddingHorizontal: spacing.lg, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  explain: {
    marginTop: spacing.xs,
    gap: 2,
  },
  explainText: {
    fontFamily: typeface.regular,
    color: colors.inkSecondary,
    fontSize: font.size.base,
    lineHeight: font.size.base * font.lineHeight.relaxed,
  },
});
