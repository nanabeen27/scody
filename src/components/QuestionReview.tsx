import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import type { Question } from '@/data';
import { colors, spacing, font, typeface } from '@/theme/tokens';

interface Props {
  index: number;
  question: Question;
  pickedIndex?: number;
}

/** 결과 문항 리뷰. 채운 배지 대신 작은 점+텍스트로 정오를 절제 있게 표시. */
export function QuestionReview({ index, question, pickedIndex }: Props) {
  const correct = pickedIndex === question.answerIndex;
  const picked = pickedIndex != null ? question.choices[pickedIndex] : '선택 안 함';
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

      {!correct ? (
        <AppText variant="caption" tone="secondary">
          내 답 · {picked}
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
