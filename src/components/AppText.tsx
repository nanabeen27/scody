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
  /**
   * 이 글이 화면의 제목임을 보조기술에 알린다. 1이 화면 제목, 2가 섹션, 3이 그 아래다.
   *
   * **모양은 하나도 바뀌지 않는다** — `variant`가 크기를 정하고 이것은 문서 구조만 정한다.
   * 없으면 크기만 큰 글이라 스크린리더는 제목으로 세지 못하고, 제목 사이를 건너뛰며 훑을 수
   * 없다(실측: 소개·로그인·가입·`/staff` 네 화면에 제목이 0개였다).
   *
   * react-native-web의 `Text`는 `<h1>`이 아니라 `<div role="heading" aria-level>`로 그린다
   * (`Text`가 요소를 `span`/`div`로 고정한다). 보조기술에는 같은 것이고, 굳이 `View`로 감싸
   * 태그를 얻으려 하면 레이아웃이 바뀐다.
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
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
  headingLevel,
  style,
  ...rest
}: Props) {
  return (
    <Text
      {...rest}
      {...(headingLevel ? { role: 'heading' as const, 'aria-level': headingLevel } : null)}
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
  /*
    큰 제목도 본문과 같은 Pretendard. Space Grotesk는 워드마크에만 남긴다.

    **줄간격은 `snug`(1.3)이 하한이다**(`DESIGN.md` §4 — "큰 제목 1.3~1.35 이상"). `tight`(1.15)로
    두었더니 두 줄 제목의 아래위 글자가 거의 붙었고, 소개 페이지가 큰 제목 여섯 곳에서
    `fontSize`·`lineHeight`·`letterSpacing`을 손으로 다시 적어 그것을 되돌리고 있었다 —
    기본값이 규칙과 다르면 화면마다 우회가 생긴다(D-084가 버튼 높이에서 배운 것과 같다).

    자간도 같다: `display`가 `tighter`(-0.6)였는데 §4의 상한은 "-0.2 정도까지"다. 한글은
    자간을 좁히면 금방 뭉친다.
  */
  display: {
    fontFamily: typeface.bold,
    fontSize: font.size.display,
    letterSpacing: font.tracking.tight,
    lineHeight: font.size.display * font.lineHeight.snug,
  },
  title: {
    fontFamily: typeface.bold,
    fontSize: font.size.xxl,
    letterSpacing: font.tracking.tight,
    lineHeight: font.size.xxl * font.lineHeight.snug,
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
