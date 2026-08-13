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

type Tone = 'default' | 'secondary' | 'tertiary' | 'accent' | 'danger' | 'success';
type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

interface Props extends TextProps {
  variant?: Variant;
  tone?: Tone;
  /**
   * 변형이 정한 무게를 덮어쓴다. **크기·행간은 그대로 둔다** — 크기를 바꾸려면 변형을 바꾼다.
   * 이것이 없어서 화면들이 `style={{ fontFamily: typeface.semibold }}`를 50곳에 손으로 적었다.
   */
  weight?: Weight;
  /** 등폭 숫자. 자릿수 선이 맞아야 위아래로 훑으며 비교된다. */
  numeric?: boolean;
}

const TONE: Record<Tone, string> = {
  default: colors.ink,
  secondary: colors.inkSecondary,
  tertiary: colors.inkTertiary,
  accent: colors.accent,
  danger: colors.danger,
  success: colors.success,
};

const WEIGHT: Record<Weight, string> = {
  regular: typeface.regular,
  medium: typeface.medium,
  semibold: typeface.semibold,
  bold: typeface.bold,
};

export function AppText({
  variant = 'body',
  tone = 'default',
  weight,
  numeric,
  style,
  ...rest
}: Props) {
  return (
    <Text
      {...rest}
      style={[
        styles[variant],
        { color: TONE[tone] },
        weight ? { fontFamily: WEIGHT[weight] } : null,
        numeric ? styles.numeric : null,
        style,
      ]}
    />
  );
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
  numeric: { fontVariant: ['tabular-nums'] },
});
