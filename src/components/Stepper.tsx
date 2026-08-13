import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { colors, radius, spacing, typeface } from '@/theme/tokens';

/**
 * 값을 한 칸씩 올리거나 내리는 컨트롤.
 *
 * **왜 새로 만드나**: 요금제 화면이 32px 손그림 버튼 14개로 값을 조절하고 있었다
 * (`hitSlop`도 없다). 터치 타깃 최소 44px 규칙에 미달이고, 태블릿에서 옆 값을 잘못 누른다.
 * D-064가 같은 이유로 24px 라디오를 공용 선택 컨트롤(지금은 `SegmentedControl`)로 바꿨다
 * — 선택 컨트롤을 손으로 다시 그리지 않는다.
 *
 * `value`는 이미 서식된 문자열을 받는다(`₩12,000`·`20%`·`30명`). 서식 규칙이 화면마다
 * 다르므로 여기서 정하지 않는다.
 */
export function Stepper({
  label,
  value,
  onStep,
  atMin,
  atMax,
  testID,
}: {
  /** 무엇을 조절하는지. 버튼의 접근성 이름이 여기서 나온다. */
  label: string;
  value: string;
  onStep: (direction: 1 | -1) => void;
  atMin?: boolean;
  atMax?: boolean;
  testID?: string;
}) {
  return (
    <View style={styles.wrap}>
      <StepButton
        icon="minus-circle"
        name={`${label} 낮추기`}
        disabled={!!atMin}
        onPress={() => onStep(-1)}
        testID={testID ? `${testID}-down` : undefined}
      />
      <AppText
        style={styles.value}
        testID={testID ? `${testID}-value` : undefined}
        accessibilityLabel={`${label} ${value}`}
      >
        {value}
      </AppText>
      <StepButton
        icon="plus"
        name={`${label} 올리기`}
        disabled={!!atMax}
        onPress={() => onStep(1)}
        testID={testID ? `${testID}-up` : undefined}
      />
    </View>
  );
}

function StepButton({
  icon,
  name,
  disabled,
  onPress,
  testID,
}: {
  icon: 'plus' | 'minus-circle';
  name: string;
  disabled: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={name}
      // 한계에 닿았음을 색이 아니라 상태로도 알린다.
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        pressed && !disabled && { backgroundColor: colors.hover },
      ]}
    >
      <Icon name={icon} size={16} color={disabled ? colors.inkTertiary : colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  /** 44px. 손가락으로 고르는 컨트롤이라 타깃을 줄이지 않는다(DESIGN.md 10절). */
  btn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    minWidth: 84,
    textAlign: 'right',
    color: colors.ink,
    fontFamily: typeface.semibold,
    // 값이 오르내릴 때 자릿수 때문에 좌우로 흔들리지 않게.
    fontVariant: ['tabular-nums'],
  },
});
