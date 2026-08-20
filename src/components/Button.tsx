import { forwardRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { motion } from '@/theme/motion';
import { useReduceMotion } from '@/theme/useReduceMotion';
import { colors, radius, spacing, font, touch, typeface } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'kakao';
/**
 * `md`(44)가 기본이자 터치 하한이다.
 * `sm`(32)은 **섹션 제목 옆 전용** — 목록 안에서 반복되는 행동에는 쓰지 않는다(§10 예외).
 * `lg`(52)는 인증 화면처럼 화면에 행동이 하나뿐인 곳 전용.
 */
type Size = 'sm' | 'md' | 'lg';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  /** `accent`면 라벨을 강조색으로 쓴다(secondary·ghost 전용). 색만으로 뜻을 전하지 않게 라벨은 그대로 둔다. */
  /**
   * 글자색만 바꾼다(배경은 `variant`가 정한다).
   * `danger`는 되돌릴 수 없는 파괴적 행동 전용 — `취소`와 같은 무게로 두지 않는다.
   */
  tone?: 'default' | 'accent' | 'danger';
  /**
   * 폭을 강제로 늘인다. **거의 필요 없다** — `primary`는 기본이 전폭이다(아래 참고).
   * `secondary`·`ghost`를 늘여야 하는 드문 자리에만 쓴다(인증 화면의 카카오·휴대폰 선택).
   */
  fullWidth?: boolean;
  /**
   * 내용폭으로 줄인다. **`primary`를 곁다리 자리에 둘 때 반드시 필요하다** —
   * 섹션 제목 옆, 목록 줄의 `trailing`, 빈 상태의 다음 행동처럼 화면의 주 행동이
   * 아닌 자리다. 그 밖의 변형은 원래 내용폭이라 굳이 주지 않아도 된다.
   */
  hug?: boolean;
  /**
   * 알약 모양(D-185). **`hug` 폭에만 쓴다.**
   *
   * 조사한 사이트(Vercel·Linear)가 로그인 전 상단 바의 `로그인`·`회원가입` 쌍에 쓰는 모양이다.
   * 쓰는 자리는 그 셋뿐이다(`landing-login`·`landing-signup`·`landing-mine`).
   *
   * **전폭 버튼에는 주지 않는다.** 999는 짧을 때 알약이고 길어지면 캡슐 배너가 된다 — §8이
   * `control.trackRadius`에서 이미 같은 판단을 적어 뒀다(한 줄이면 알약, 두 줄이면 둥근 사각형).
   * 실제 레퍼런스의 전폭 인증 버튼도 8~10px 라운드다. 아래 개발 가드가 그것을 지킨다.
   */
  shape?: 'pill';
  leading?: React.ReactNode;
  /** 라벨 뒤 아이콘. 다음 단계로 넘어가는 행동에 화살표를 둘 때 쓴다. */
  trailing?: React.ReactNode;
  /** 아이콘을 앞에 두면 읽히는 이름이 흐려진다. 그럴 때 이름을 직접 지정한다. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /**
   * 펼침 상태. **`Button`이 직접 받아 넘겨야 한다** — 넘기지 않으면 조용히 사라져서
   * 화면에서는 펼쳐져 있는데 스크린리더와 테스트는 상태를 알 수 없다.
   */
  'aria-expanded'?: boolean;
  style?: ViewStyle;
  testID?: string;
}

/**
 * `ref`를 넘길 수 있다. 확인 단계가 열릴 때 포커스를 옮기는 데 쓴다(`ConfirmStep`) —
 * 트리거 버튼이 사라지면 웹에서 포커스가 `<body>`로 떨어진다.
 */
export const Button = forwardRef<View, Props>(function Button(
  {
    label,
    onPress,
    variant = 'primary',
    size = 'md',
    tone = 'default',
    fullWidth,
    hug,
    shape,
    leading,
    trailing,
    accessibilityLabel,
    accessibilityHint,
    'aria-expanded': ariaExpanded,
    style,
    testID,
  },
  ref,
) {
  /*
    **규칙이 문서에만 있으면 다시 어긴다.** `pill`은 `hug` 폭 전용인데(§8 · D-185) 전폭에 주면
    캡슐 배너가 된다 — `ActionBar`가 같은 이유로 같은 방식의 경고를 둔다.

    `primary && !hug`도 잡는다: 그 조합은 아래에서 `styles.wide`(width 100%)가 붙어 전폭이 된다.
  */
  if (__DEV__ && shape === 'pill' && (fullWidth || (variant === 'primary' && !hug))) {
    console.warn('Button: shape="pill"은 hug 폭에만 쓴다. 전폭 버튼은 radius.lg다(§8).');
  }

  const textColor =
    variant === 'primary'
      ? colors.accentText
      : variant === 'kakao'
        ? colors.kakaoText
        : tone === 'accent'
          ? colors.accent
          : tone === 'danger'
            ? colors.danger
            : colors.ink;
  /*
    누름 반응. 불투명도만 바꾸면 눌렸는지 확신이 안 선다 — 버튼 전체가 아주 살짝 눌리고,
    화살표가 있으면 그 화살표만 가는 쪽으로 한 번 밀린다. 다음 화면으로 간다는 뜻이
    글자보다 먼저 전해진다. 높이·자리는 그대로라 줄이 흔들리지 않는다.
  */
  const [press] = useState(() => new Animated.Value(0));
  const [hover] = useState(() => new Animated.Value(0));
  const reduced = useReduceMotion();
  const move = (value: Animated.Value, to: number) => {
    // 모션 줄이기: 눌린 상태 자체는 남기되 옮겨 가는 과정을 그리지 않는다.
    if (reduced) {
      value.setValue(to);
      return;
    }
    Animated.timing(value, {
      toValue: to,
      duration: motion.duration.quick,
      easing: motion.easing.standard,
      useNativeDriver: false,
    }).start();
  };
  const scale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] });
  // 화살표는 올려놓으면 조금, 누르면 확실히 움직인다. 가는 방향이 손보다 먼저 보인다.
  const nudge = Animated.add(
    hover.interpolate({ inputRange: [0, 1], outputRange: [0, 2] }),
    press.interpolate({ inputRange: [0, 1], outputRange: [0, 4] }),
  );

  return (
    <AnimatedPressable
      ref={ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      aria-expanded={ariaExpanded}
      onPress={onPress}
      onPressIn={() => move(press, 1)}
      onPressOut={() => move(press, 0)}
      onHoverIn={() => move(hover, 1)}
      onHoverOut={() => move(hover, 0)}
      style={[
        styles.base,
        size === 'sm' && styles.sm,
        size === 'lg' && styles.lg,
        // `size` 뒤에 온다 — `base`의 `radius.md`와 `lg`의 `radius.lg`를 덮어야 한다.
        shape === 'pill' && styles.pill,
        stylesByVariant[variant],
        /*
          **주 행동은 좌우로 늘인다.** 강조색이 칠해진 버튼은 그 화면에서 할 일 그 자체라
          폭이 곧 위계다. 여기서 정하지 않고 화면마다 붙이면 같은 종류가 화면마다 다른
          폭으로 뜬다 — 실제로 41개 중 `stretch`가 붙어 있던 것은 4개뿐이었다.

          `alignSelf`가 아니라 `width`인 이유: 가로로 놓인 부모(히어로의 행 등) 안에서
          `alignSelf: stretch`는 **세로**로 늘어나고 폭은 그대로다.

          곁다리 자리(섹션 제목 옆·목록 줄·빈 상태)는 `hug`으로 뺀다.
        */
        variant === 'primary' && !hug && styles.wide,
        hug && { alignSelf: 'flex-start' },
        fullWidth && { alignSelf: 'stretch' as const, width: '100%' as const },
        { transform: [{ scale }] },
        style,
      ]}
    >
      <View style={styles.inner}>
        {leading}
        <AppText style={[styles.label, size === 'lg' && styles.labelLg, { color: textColor }]}>
          {label}
        </AppText>
        {trailing ? (
          <Animated.View style={{ transform: [{ translateX: nudge }] }}>{trailing}</Animated.View>
        ) : null}
      </View>
    </AnimatedPressable>
  );
});

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const styles = StyleSheet.create({
  base: {
    // 손으로 누르는 것의 기본값(§10). 예전에는 40이라 화면들이 `height: 44`로 개별 우회했다.
    height: touch.min,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** 주 행동의 기본 폭. 읽기 폭(680) 상한은 `ActionBar`가 건다 — 960 화면의 960px 버튼은 배너로 읽힌다. */
  wide: { width: '100%' },
  sm: { height: 32, paddingHorizontal: spacing.md },
  lg: { height: 52, borderRadius: radius.lg },
  /*
    좌우 여백을 `lg`(16)에서 `xl`(24)로 함께 올린다 — 높이 44에 radius 999면 16으로는 글자가
    곡선에 붙는다. 모양 결정을 호출부에 흩지 않기 위해 컴포넌트가 함께 정한다(§8: "화면마다
    붙이면 같은 종류가 화면마다 다른 폭이 된다").
  */
  pill: { borderRadius: radius.pill, paddingHorizontal: spacing.xl },
  inner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontFamily: typeface.medium, fontSize: font.size.base },
  labelLg: { fontFamily: typeface.semibold, fontSize: font.size.md },
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
