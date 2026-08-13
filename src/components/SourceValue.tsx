import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { SourceBadge, type Source } from './SourceBadge';
import { spacing } from '@/theme/tokens';

/**
 * 값 + 그 값이 어디서 왔는지. **운영자 화면의 모든 숫자에 붙는다.**
 *
 * 합성 데이터로 만든 MAU를 실제 MAU와 구별할 수 있어야 판단에 쓸 수 있다. 예전에는
 * 이 함수가 화면 다섯 곳에 **글자 그대로 복사**돼 있었다.
 *
 * 숫자는 등폭으로 둔다 — 자릿수 선이 맞아야 위아래로 훑으며 비교된다.
 */
export function SourceValue({
  value,
  source,
}: {
  value: string;
  /** 여러 개면 배지를 나란히 둔다(한 값이 여러 출처에서 합쳐진 경우). */
  source: Source | readonly Source[];
}) {
  const sources = Array.isArray(source) ? source : [source as Source];
  return (
    <View style={styles.wrap}>
      <AppText variant="label" numeric>
        {value}
      </AppText>
      {sources.map((s) => (
        <SourceBadge key={s} source={s} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
