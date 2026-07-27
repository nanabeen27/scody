import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { colors, spacing } from '@/theme/tokens';

export type LearningSource = 'personal' | 'academy';

const LABEL: Record<LearningSource, string> = {
  personal: '개인 학습',
  academy: '학원 과제',
};

/** 학습 출처 표시. 작은 점 + 텍스트. 색만으로 구분하지 않음. */
export function SourceTag({ source }: { source: LearningSource }) {
  const color = source === 'personal' ? colors.personal : colors.academy;
  return (
    <View style={styles.wrap}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <AppText variant="eyebrow" style={{ color }}>
        {LABEL[source]}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
