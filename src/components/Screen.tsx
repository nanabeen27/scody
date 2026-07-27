import type { ReactNode } from 'react';
import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { colors, layout, radius, spacing } from '@/theme/tokens';

interface Props {
  children: ReactNode;
  eyebrow?: string;
  title?: string;
  lead?: string;
  wide?: boolean;
  testID?: string;
  /**
   * 상세·단계형 화면의 이탈 경로. 값을 주면 좌상단에 '뒤로'가 보인다.
   * 히스토리가 없는 직접 진입에서는 이 경로로 이동한다. 상위 탭 화면에는 쓰지 않는다.
   */
  backFallback?: string;
}

/** 공통 화면: 종이색 배경, 넓은 여백, 좌측 정렬된 본문 폭 컬럼, 선택적 헤더. */
export function Screen({ children, eyebrow, title, lead, wide, testID, backFallback }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const maxWidth = wide ? layout.wideMaxWidth : layout.contentMaxWidth;
  return (
    <ScrollView
      testID={testID}
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.huge },
      ]}
    >
      <View style={[styles.column, { maxWidth }]}>
        {backFallback ? (
          <Pressable
            testID="screen-back"
            accessibilityRole="button"
            accessibilityLabel="뒤로"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace(backFallback as never)
            }
            style={({ pressed }) => [styles.back, pressed && { backgroundColor: colors.hover }]}
          >
            <Icon name="chevron-left" size={16} color={colors.inkSecondary} />
            <AppText variant="caption" tone="secondary">
              뒤로
            </AppText>
          </Pressable>
        ) : null}
        {(eyebrow || title || lead) && (
          <View style={styles.header}>
            {eyebrow ? (
              <AppText variant="eyebrow" tone="tertiary">
                {eyebrow}
              </AppText>
            ) : null}
            {title ? <AppText variant="title">{title}</AppText> : null}
            {lead ? (
              <AppText variant="bodyLg" tone="secondary">
                {lead}
              </AppText>
            ) : null}
          </View>
        )}
        {children}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, alignItems: 'center' },
  column: { width: '100%', gap: spacing.xl },
  header: { gap: spacing.sm },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: -spacing.sm,
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
    borderRadius: radius.md,
  },
});
