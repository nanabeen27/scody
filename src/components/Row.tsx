import type { ReactNode } from 'react';
import { Pressable, View, StyleSheet, type ViewStyle } from 'react-native';
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
  /**
   * 이동 가능한 행에만 준다.
   * `trailing`과 함께 주지 않는다 — `trailing`은 누르는 영역 밖에 붙으므로
   * chevron이 행동 버튼 왼쪽으로 밀려 순서가 뒤집힌다(`LearningRow`와 같은 이유).
   */
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
  const content = (withTrailing: boolean) => (
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
      {/*
        `Section`의 `action`과 같은 이유로 감싼다 — `hug` 버튼의 `alignSelf: 'flex-start'`가
        이 줄의 `alignItems: center`를 덮어써 위로 붙는다(학원 카드의 `연결 끊기`가 그랬다).
      */}
      {withTrailing ? <View>{trailing}</View> : null}
      {showChevron && onPress ? (
        <Icon name="chevron-right" size={18} color={colors.inkTertiary} />
      ) : null}
    </View>
  );

  const press = (child: ReactNode, style?: ViewStyle) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [style, pressed && { backgroundColor: colors.hover }]}
    >
      {child}
    </Pressable>
  );

  if (!onPress) return content(true);
  // 누를 수 있는 행에 행동이 붙으면, 그 행동은 누르는 영역 밖에 둔다.
  // 안에 넣으면 행동을 눌러도 행 배경이 함께 번쩍인다.
  if (trailing) {
    return (
      <View style={styles.split}>
        {press(content(false), styles.grow)}
        <View style={styles.trail}>{trailing}</View>
      </View>
    );
  }
  return press(content(true));
}

const styles = StyleSheet.create({
  split: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  trail: { paddingRight: spacing.lg, paddingLeft: spacing.sm },
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
