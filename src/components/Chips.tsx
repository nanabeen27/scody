import { Pressable, View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { colors, radius, spacing, typeface } from '@/theme/tokens';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  /** 라벨 뒤 개수. 필터를 누르기 전에 결과 규모를 알 수 있다. */
  count?: number;
}

interface Props<T extends string> {
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** testID 접두사. 각 칩은 `${testID}-${value}`가 된다. */
  testID?: string;
}

/** 한 줄 필터 칩. 선택된 하나만 강조색으로 채운다. */
export function Chips<T extends string>({ options, value, onChange, testID }: Props<T>) {
  return (
    <View style={styles.row}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={testID ? `${testID}-${o.value}` : undefined}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipOn,
              pressed && !active && { backgroundColor: colors.hover },
            ]}
          >
            <AppText
              variant="caption"
              style={{
                fontFamily: active ? typeface.semibold : typeface.regular,
                color: active ? colors.accent : colors.inkSecondary,
              }}
            >
              {o.count == null ? o.label : `${o.label} ${o.count}`}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
});
