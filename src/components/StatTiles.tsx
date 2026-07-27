import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { colors, radius, spacing, typeface } from '@/theme/tokens';

export interface Stat {
  label: string;
  value: string;
  /** 값 아래 한 줄 보조 설명. 지표의 뜻을 밝혀 오해를 막는다. */
  hint?: string;
  /** 강조할 지표 하나(확인이 필요한 값). */
  alert?: boolean;
}

/**
 * 지표 타일 묶음. 라벨(회색 작게) → 값(굵게 크게) → 뜻(더 작게) 순서.
 * 값만 굵게, 설명은 조용히 — 목록 규칙과 같다.
 */
export function StatTiles({ stats, testID }: { stats: Stat[]; testID?: string }) {
  return (
    <View style={styles.grid} testID={testID}>
      {stats.map((s) => (
        <View key={s.label} style={styles.tile}>
          <AppText variant="caption" tone="secondary">
            {s.label}
          </AppText>
          <AppText style={[styles.value, s.alert && { color: colors.danger }]}>{s.value}</AppText>
          {s.hint ? (
            <AppText variant="caption" tone="tertiary">
              {s.hint}
            </AppText>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  tile: {
    // maxWidth가 없으면 마지막 줄에 하나만 남을 때 그 타일이 전폭으로 늘어난다.
    flexGrow: 1,
    flexBasis: 220,
    maxWidth: 340,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: 2,
  },
  value: {
    fontFamily: typeface.bold,
    color: colors.ink,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
});
