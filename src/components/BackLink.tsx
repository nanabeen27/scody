import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { colors, radius, spacing } from '@/theme/tokens';

/**
 * 상세·단계형 화면의 이탈 경로. 히스토리가 없는 직접 진입에서는 `fallback`으로 보낸다.
 * `Screen`이 쓰고, `Screen`을 쓰지 않는 화면(대화 화면 등)도 같은 모양을 쓰도록 따로 뒀다.
 */
export function BackLink({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <Pressable
      testID="screen-back"
      accessibilityRole="button"
      accessibilityLabel="뒤로"
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as never))}
      style={({ pressed }) => [styles.back, pressed && { backgroundColor: colors.hover }]}
    >
      <Icon name="chevron-left" size={16} color={colors.inkSecondary} />
      <AppText variant="caption" tone="secondary">
        뒤로
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /**
   * 누름 영역 44px(§10). 단계형 화면에서 뒤로가기가 유일한 이탈 장치라 작으면 안 된다.
   * 캡션 한 줄(약 20)에 위아래 12를 더해 44를 만든다.
   * 커진 만큼 위아래 마진으로 되돌려 이 컴포넌트를 쓰는 화면들의 여백은 그대로 둔다
   * (`Screen` 컬럼의 gap이 24라 아래는 -16, 위는 늘어난 패딩만큼 -8).
   */
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: -spacing.sm,
    marginBottom: -spacing.lg,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    borderRadius: radius.md,
  },
});
