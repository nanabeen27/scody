import type { ReactNode } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { colors, spacing } from '@/theme/tokens';

interface Props {
  title: string;
  subtitle?: string;
  meta?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

/** 조용한 리스트 행. 카드 대신 기본 레이아웃 단위. */
export function Row({
  title,
  subtitle,
  meta,
  leading,
  trailing,
  onPress,
  showChevron,
  accessibilityLabel,
  testID,
}: Props) {
  // 누를 수 없는 행도 testID를 가진다. 예전에는 onPress가 없으면 testID가 사라졌다.
  const body = (
    <View style={styles.row} testID={onPress ? undefined : testID}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.main}>
        <AppText variant="label">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" tone="secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {meta ? (
        <AppText variant="caption" tone="tertiary">
          {meta}
        </AppText>
      ) : null}
      {trailing}
      {showChevron && onPress ? (
        <Icon name="chevron-right" size={18} color={colors.inkTertiary} />
      ) : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [pressed && { backgroundColor: colors.hover }]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
  },
  leading: { justifyContent: 'center' },
  main: { flex: 1, gap: 3 },
});
