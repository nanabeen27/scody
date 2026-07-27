import { Pressable, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { useTheme, THEME_LABEL } from '@/theme/ThemeProvider';
import { colors, radius, spacing } from '@/theme/tokens';

/** 테마 전환 버튼(시스템→라이트→다크 순환). */
export function ThemeToggle({ compact }: { compact?: boolean }) {
  const { mode, cycle } = useTheme();
  return (
    <Pressable
      testID="theme-toggle"
      accessibilityRole="button"
      accessibilityLabel={`테마 ${THEME_LABEL[mode]}, 눌러서 전환`}
      onPress={cycle}
      style={({ pressed }) => [styles.btn, pressed && { backgroundColor: colors.hover }]}
    >
      <AppText variant="caption" tone="secondary">
        {compact ? THEME_LABEL[mode] : `테마 · ${THEME_LABEL[mode]}`}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
