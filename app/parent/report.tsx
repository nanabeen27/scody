import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Screen, Group, ChildReport, AppText } from '@/components';
import { useCurrentAccount } from '@/session';
import { getChildren } from '@/data';
import { colors, spacing, radius } from '@/theme/tokens';

/** 리포트: 자녀를 전환하며 개인·학원 학습 리포트를 본다. */
export default function ParentReport() {
  const account = useCurrentAccount();
  const children = getChildren(account.userId);
  const [selected, setSelected] = useState(children[0]?.userId);
  const child = children.find((c) => c.userId === selected);

  if (children.length === 0) {
    return (
      <Screen testID="parent-report" title="리포트">
        <Group>
          <View style={{ padding: spacing.lg }}>
            <AppText tone="secondary">연결된 자녀가 없어요.</AppText>
          </View>
        </Group>
      </Screen>
    );
  }

  return (
    <Screen testID="parent-report" title="리포트">
      <View style={styles.switcher}>
        {children.map((c) => {
          const on = c.userId === selected;
          return (
            <Pressable
              key={c.userId}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => setSelected(c.userId)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <AppText variant="label" style={{ color: on ? colors.accentText : colors.inkSecondary }}>
                {c.name}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {child ? <ChildReport child={child} allowRetry /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  switcher: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
});
