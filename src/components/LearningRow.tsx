import { Pressable, View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { SourceTag } from './SourceTag';
import type { LearningItem } from '@/data';
import { colors, spacing } from '@/theme/tokens';

interface Props {
  item: LearningItem;
  onPress?: () => void;
}

/** 학습 항목 한 줄. 출처 태그 + 과목·제목 + 부가정보. Group 안에서 사용. */
export function LearningRow({ item, onPress }: Props) {
  const meta = [
    `${item.questionCount}문항`,
    item.dueDate ? `${formatDue(item.dueDate)} 마감` : null,
    item.status === 'done' && item.accuracy != null ? `정답률 ${item.accuracy}%` : null,
    item.status === 'in_progress' ? '이어서 하기' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.subject} ${item.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && onPress && { backgroundColor: colors.hover }]}
    >
      <SourceTag source={item.source} />
      <AppText variant="label">
        {item.subject} · {item.title}
      </AppText>
      <AppText variant="caption" tone="tertiary">
        {meta}
      </AppText>
      {onPress ? <View style={styles.chevron} /> : null}
    </Pressable>
  );
}

function formatDue(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(m)}월 ${Number(d)}일`;
}

const styles = StyleSheet.create({
  row: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: 6 },
  chevron: {
    position: 'absolute',
    right: spacing.lg,
    top: spacing.lg,
    width: 7,
    height: 7,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: colors.inkTertiary,
    transform: [{ rotate: '45deg' }],
  },
});
