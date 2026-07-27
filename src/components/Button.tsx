import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { colors, radius, spacing, font, typeface } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'kakao';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  fullWidth?: boolean;
  leading?: React.ReactNode;
  accessibilityHint?: string;
  style?: ViewStyle;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  fullWidth,
  leading,
  accessibilityHint,
  style,
  testID,
}: Props) {
  const textColor =
    variant === 'primary'
      ? colors.accentText
      : variant === 'kakao'
        ? colors.kakaoText
        : colors.ink;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        stylesByVariant[variant],
        fullWidth && { alignSelf: 'stretch' },
        pressed && { opacity: 0.9 },
        style,
      ]}
    >
      <View style={styles.inner}>
        {leading}
        <AppText style={[styles.label, { color: textColor }]}>{label}</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontFamily: typeface.medium, fontSize: font.size.base },
});

const stylesByVariant: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.accent },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: { backgroundColor: 'transparent' },
  kakao: { backgroundColor: colors.kakao },
};
