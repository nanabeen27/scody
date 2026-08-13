import type { ReactNode } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { SourceTag } from './SourceTag';
import type { LearningItem } from '@/data';
import { formatDate } from '@/features/learning';
import { colors, spacing } from '@/theme/tokens';

interface Props {
  item: LearningItem;
  onPress?: () => void;
  /**
   * 행 왼쪽에 붙는 표시(순번 등). 누르는 영역 **안**에 둔다 — 행동이 아니라 정보이므로
   * 행과 함께 눌려도 된다. 행동을 왼쪽에 두지 않는다.
   */
  leading?: ReactNode;
  /**
   * 행 오른쪽에 붙는 행동(담기 토글 등).
   * 누르는 영역 **밖**에 둔다 — 안에 넣으면 누를 때 행 배경이 함께 번쩍인다.
   */
  trailing?: ReactNode;
  /** 이 학습에 대해 한 줄 더 알릴 것(예: 학원 과제로도 받았다는 사실). */
  note?: string;
  testID?: string;
}

/** 학습 항목 한 줄. 출처 태그 + 과목·제목 + 부가정보. Group 안에서 사용. */
export function LearningRow({ item, onPress, leading, trailing, note, testID }: Props) {
  const meta = [
    `${item.questionCount}문항`,
    item.dueDate ? `${formatDate(item.dueDate)} 마감` : null,
    item.status === 'done' && item.accuracy != null ? `정답률 ${item.accuracy}%` : null,
    item.status === 'in_progress' ? '이어서 하기' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.wrap} testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.subject} ${item.title}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          leading != null && styles.rowWithLeading,
          pressed && onPress && { backgroundColor: colors.hover },
        ]}
      >
        {leading != null ? <View style={styles.leading}>{leading}</View> : null}
        <View style={styles.main}>
          <SourceTag source={item.source} />
          <AppText variant="label">
            {item.subject} · {item.title}
          </AppText>
          <AppText variant="caption" tone="tertiary">
            {meta}
          </AppText>
          {note ? (
            <AppText variant="caption" tone="secondary">
              {note}
            </AppText>
          ) : null}
        </View>
        {/*
          chevron은 누르는 영역 기준 absolute right다. `trailing`이 붙으면 그 영역의
          오른쪽 경계가 안으로 밀려 chevron이 행동 버튼 왼쪽으로 끌려 들어온다.
          오른쪽에 행동이 있으면 chevron을 두지 않는다 — 누를 곳은 행 자체로 남는다.
        */}
        {onPress && !trailing ? <View style={styles.chevron} /> : null}
      </Pressable>
      {trailing ? <View style={styles.trail}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center' },
  row: { flex: 1, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: 6 },
  // leading이 있으면 가로로 나눈다. 세로 gap은 안쪽 main이 갖는다.
  rowWithLeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  leading: { minWidth: 20, alignItems: 'center' },
  main: { flex: 1, gap: 6 },
  trail: { paddingRight: spacing.lg, paddingLeft: spacing.sm },
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
