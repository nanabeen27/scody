import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { colors, spacing, radius, typeface } from '@/theme/tokens';

/**
 * 정답률 지표.
 *
 * **막대를 두지 않는다.** 숫자가 `80%`라고 말하고 아래 줄이 `10문항 중 8문항 정답`이라고
 * 또 말하는데, 같은 비율을 막대로 한 번 더 그리면 같은 말이 세 번이 된다
 * (§13 `의미 없는 배지·수치·그래프`). 막대는 **여러 값을 나란히 비교할 때만** 쓴다(`BarRow`).
 */
export function ScoreCard({ rate, detail }: { rate: number; detail: string }) {
  return (
    <View style={styles.card}>
      <AppText variant="caption" tone="secondary">
        정답률
      </AppText>
      <View style={styles.row}>
        <AppText style={styles.number}>{rate}</AppText>
        <AppText variant="label" tone="tertiary" style={{ marginBottom: 4 }}>
          %
        </AppText>
      </View>
      <AppText variant="caption" tone="tertiary">
        {detail}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  number: {
    fontFamily: typeface.bold,
    color: colors.ink,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
});
