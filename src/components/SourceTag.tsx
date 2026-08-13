import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { colors, spacing } from '@/theme/tokens';

export type LearningSource = 'personal' | 'academy';

const LABEL: Record<LearningSource, string> = {
  personal: '개인 학습',
  academy: '학원 과제',
};

/**
 * 학습 출처 표시. 작은 점 + 텍스트. 색만으로 구분하지 않음.
 *
 * 글자는 `caption` + semibold다. `eyebrow`를 쓰지 않는 이유는 그 변형이 대문자 변환 +
 * 넓은 자간(0.4)의 라틴 전용이라(§4 — 한글에는 쓰지 않는다) `학 원 과 제`처럼 벌어져
 * 훑기가 더 어렵기 때문이다. 이 앱에서 가장 중요한 구분(개인 학습 vs 학원 과제, §18)이
 * 화면에서 가장 작은 글자(12)일 이유도 없다.
 */
export function SourceTag({ source }: { source: LearningSource }) {
  const color = source === 'personal' ? colors.personal : colors.academy;
  return (
    <View style={styles.wrap}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <AppText variant="caption" weight="semibold" style={{ color }}>
        {LABEL[source]}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
