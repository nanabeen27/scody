import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { colors, font, radius, spacing } from '@/theme/tokens';

/**
 * 숫자의 출처.
 *
 * **`합성`은 없앴다.** 운영자 화면의 지표가 해시로 만든 활동 데이터 위에서 돌던 동안에는 그
 * 낱말이 필요했지만, 지금은 전부 서버 집계다. 낱말을 남겨 두면 다음 사람이 합성 값을 다시
 * 화면에 올릴 자리가 생긴다 — 원천이 없는 지표는 배지가 아니라 **값 자리에 이유를 적는다**.
 */
export type Source = '실측' | '추정';

/**
 * 출처 배지.
 *
 * **왜 필요한가**: 운영자 화면의 숫자는 성격이 다르다 — 서버가 센 제출과 요금 정책으로 추정한
 * 매출은 신뢰도가 다르다. 화면 맨 위 캡션 한 줄로 덮으면 스크린샷 한 장이 돌아다닐 때 오해를
 * 막을 수 없다. 그래서 **성격이 다른 값에만** 붙인다.
 *
 * 색으로 뜻을 전하지 않는다 — 글자로 적는다(DESIGN.md 11절).
 */
export function SourceBadge({ source, testID }: { source: Source; testID?: string }) {
  return (
    <View style={styles.badge} testID={testID}>
      <AppText variant="caption" tone="tertiary" style={styles.text}>
        {source}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    // 글자를 크기 스케일 안으로 올린 만큼 좌우 패딩을 한 단계 줄여 폭을 지킨다.
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  /**
   * 크기 스케일의 최소값(`xs 12`)을 쓴다. 이 배지는 값의 신뢰도를 **색이 아니라 글자로** 말하는
   * 유일한 장치라서 스케일 밖으로 작게 두지 않는다(DESIGN.md 4절).
   */
  text: { fontSize: font.size.xs, lineHeight: font.size.xs * font.lineHeight.snug },
});
