import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { ProgressBar } from './ProgressBar';
import { colors, spacing, radius, typeface } from '@/theme/tokens';

/** 정답률 지표. 거대 숫자·강한 색 대신 중립 지표 + 얇은 막대(Stripe 지표 감성). */
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
      <ProgressBar value={rate} />
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
