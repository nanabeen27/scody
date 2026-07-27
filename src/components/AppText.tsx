import { Text, type TextProps, StyleSheet } from 'react-native';
import { colors, font, typeface } from '@/theme/tokens';

type Variant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodyLg'
  | 'label'
  | 'caption'
  | 'eyebrow';

type Tone = 'default' | 'secondary' | 'tertiary' | 'accent';

interface Props extends TextProps {
  variant?: Variant;
  tone?: Tone;
}

const TONE: Record<Tone, string> = {
  default: colors.ink,
  secondary: colors.inkSecondary,
  tertiary: colors.inkTertiary,
  accent: colors.accent,
};

export function AppText({ variant = 'body', tone = 'default', style, ...rest }: Props) {
  return <Text {...rest} style={[styles[variant], { color: TONE[tone] }, style]} />;
}

const styles = StyleSheet.create({
  // 큰 제목도 본문과 같은 Pretendard. Space Grotesk는 워드마크에만 남긴다.
  display: {
    fontFamily: typeface.bold,
    fontSize: font.size.display,
    letterSpacing: font.tracking.tighter,
    lineHeight: font.size.display * font.lineHeight.tight,
  },
  title: {
    fontFamily: typeface.bold,
    fontSize: font.size.xxl,
    letterSpacing: font.tracking.tight,
    lineHeight: font.size.xxl * font.lineHeight.tight,
  },
  heading: {
    fontFamily: typeface.semibold,
    fontSize: font.size.xl,
    letterSpacing: font.tracking.tight,
    lineHeight: font.size.xl * font.lineHeight.snug,
  },
  subheading: {
    fontFamily: typeface.semibold,
    fontSize: font.size.md,
    lineHeight: font.size.md * font.lineHeight.snug,
  },
  bodyLg: {
    fontFamily: typeface.regular,
    fontSize: font.size.md,
    lineHeight: font.size.md * font.lineHeight.relaxed,
  },
  body: {
    fontFamily: typeface.regular,
    fontSize: font.size.base,
    lineHeight: font.size.base * font.lineHeight.normal,
  },
  label: {
    fontFamily: typeface.medium,
    fontSize: font.size.base,
    lineHeight: font.size.base * font.lineHeight.snug,
  },
  caption: {
    fontFamily: typeface.regular,
    fontSize: font.size.sm,
    lineHeight: font.size.sm * font.lineHeight.normal,
  },
  eyebrow: {
    fontFamily: typeface.semibold,
    fontSize: font.size.xs,
    letterSpacing: font.tracking.wide,
    textTransform: 'uppercase',
    lineHeight: font.size.xs * font.lineHeight.normal,
  },
});
