import { Animated, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Icon, type IconName } from './Icon';
import { useAnimatedTo } from '@/theme/useMotion';
import { colors, radius, spacing, touch } from '@/theme/tokens';

/**
 * 아이콘 하나로 된 행동 버튼.
 *
 * 카드 머리나 목록 줄처럼 라벨을 둘 자리가 없는 곳에 쓴다. 글리프는 16으로 두고
 * **누름 영역만 44px로 키운다**(`DESIGN.md` §10) — 아이콘을 키우면 카드가 무거워진다.
 * `hitSlop`은 react-native-web의 `Pressable`에서 듣지 않아 쓸 수 없다.
 *
 * `inset`을 주면 커진 만큼 위아래 음수 마진으로 되돌린다. 머리 줄의 높이를 그대로 두면서
 * 손가락 영역만 넓힐 때 쓴다(`BackLink`가 같은 방식이다).
 *
 * **이름은 아이콘이 말하지 못한다.** `accessibilityLabel`이 필수인 이유다.
 */
export function IconButton({
  name,
  label,
  onPress,
  active,
  variant = 'plain',
  role = 'button',
  size = 16,
  inset,
  testID,
  style,
}: {
  name: IconName;
  /** 스크린리더가 읽을 이름. 상태에 따라 바뀌면 그대로 넘긴다(`별표 달기`/`별표 빼기`). */
  label: string;
  onPress?: () => void;
  /** 켜진 상태. 아이콘을 강조색으로 바꾼다. 색만으로 뜻을 전하지 않게 이름도 함께 바꾼다. */
  active?: boolean;
  /**
   * `outlined`는 테두리 있는 알약이고 켜지면 `accentSoft`로 찬다.
   * **상태를 가진 토글**(담기·오답노트 담기·다시 풀기 요청)에 쓴다 — 목록 안에서
   * 눌린 것과 안 눌린 것을 훑어야 하는 자리다.
   */
  variant?: 'plain' | 'outlined';
  /**
   * 상태를 가진 토글이면 `'checkbox'`. 그때 `active`가 `aria-checked`가 된다 —
   * `role=checkbox`에 `aria-checked`가 없으면 브라우저가 전부 `false`로 읽는다.
   */
  role?: 'button' | 'checkbox';
  size?: number;
  inset?: boolean;
  testID?: string;
  style?: ViewStyle;
}) {
  // 색만 바뀌면 눌린 것인지 확신이 안 선다. 아주 짧게 커졌다 돌아온다(높이는 그대로).
  const on = useAnimatedTo(active ? 1 : 0);
  const scale = on.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const outlined = variant === 'outlined';
  return (
    <Pressable
      testID={testID}
      accessibilityRole={role}
      accessibilityLabel={label}
      aria-checked={role === 'checkbox' ? !!active : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        outlined && styles.outlined,
        outlined && active && styles.outlinedOn,
        inset && styles.inset,
        pressed && !outlined && { backgroundColor: colors.hover },
        style,
      ]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Icon
          name={name}
          size={size}
          color={active ? colors.accent : outlined ? colors.inkTertiary : colors.inkSecondary}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: touch.min,
    height: touch.min,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlined: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  outlinedOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  // 44px을 그대로 두면 머리 줄이 24px쯤 높아진다. 보이는 높이만 되돌린다.
  inset: { marginVertical: -spacing.md },
});
