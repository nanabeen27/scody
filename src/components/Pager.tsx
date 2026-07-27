import { Pressable, View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { colors, radius, spacing, typeface } from '@/theme/tokens';

interface Props {
  /** 전체 항목 수. */
  total: number;
  /** 0부터 시작하는 현재 페이지. */
  page: number;
  pageSize: number;
  onChange: (page: number) => void;
  /** 항목 단위 이름. "12개 중 1–20" 같은 문장에 쓴다. */
  unit?: string;
  testID?: string;
}

/**
 * 목록 페이지 이동. 수천 건이 되어도 한 화면에 다 쏟지 않는다.
 * 총 개수와 현재 범위를 문장으로 먼저 알려 주고, 이동 버튼은 그다음에 둔다.
 */
export function Pager({ total, page, pageSize, onChange, unit = '개', testID }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages - 1);
  const from = total === 0 ? 0 : current * pageSize + 1;
  const to = Math.min(total, (current + 1) * pageSize);

  return (
    <View style={styles.wrap} testID={testID}>
      <AppText variant="caption" tone="secondary">
        {total}
        {unit} 중 {from}–{to}
      </AppText>
      <View style={styles.buttons}>
        <Step
          testID={testID ? `${testID}-prev` : undefined}
          label="이전"
          icon="chevron-left"
          disabled={current <= 0}
          onPress={() => onChange(current - 1)}
        />
        <AppText variant="caption" tone="tertiary" style={styles.count}>
          {current + 1} / {pages}
        </AppText>
        <Step
          testID={testID ? `${testID}-next` : undefined}
          label="다음"
          icon="chevron-right"
          disabled={current >= pages - 1}
          onPress={() => onChange(current + 1)}
        />
      </View>
    </View>
  );
}

function Step({
  label,
  icon,
  disabled,
  onPress,
  testID,
}: {
  label: string;
  icon: 'chevron-left' | 'chevron-right';
  disabled: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const tint = disabled ? colors.inkTertiary : colors.ink;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.step,
        disabled && styles.stepOff,
        pressed && !disabled && { backgroundColor: colors.hover },
      ]}
    >
      {icon === 'chevron-left' ? <Icon name={icon} size={15} color={tint} /> : null}
      <AppText variant="caption" style={{ fontFamily: typeface.medium, color: tint }}>
        {label}
      </AppText>
      {icon === 'chevron-right' ? <Icon name={icon} size={15} color={tint} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  count: { paddingHorizontal: spacing.sm, minWidth: 56, textAlign: 'center' },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  stepOff: { opacity: 0.5 },
});
