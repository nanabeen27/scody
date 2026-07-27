import type { ReactNode } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { Brand } from './Brand';
import { Icon, type IconName } from './Icon';
import { useResponsive } from '@/theme/useResponsive';
import { colors, spacing, radius, layout, font, typeface } from '@/theme/tokens';

export interface NavItem {
  href: string;
  label: string;
  icon?: IconName;
}

interface Props {
  nav: NavItem[];
  accountName: string;
  accountMeta: string;
  onSignOut?: () => void;
  /** 하단 탭에 아이콘 밑 라벨 표시(학부모·학원). 학생은 아이콘만. */
  tabLabels?: boolean;
  /** true면 문제 풀이 몰입 모드에서 nav를 숨긴다. */
  focusable?: boolean;
  children: ReactNode;
}

function isActive(pathname: string, href: string, rootHref: string): boolean {
  if (href === rootHref) return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

export function RoleShell({ nav, accountName, accountMeta, tabLabels, focusable, children }: Props) {
  const { isDesktop } = useResponsive();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const rootHref = nav[0]?.href ?? '';

  // 워드마크는 역할 홈으로 가는 링크. 어느 뎁스에 있어도 처음으로 돌아올 수 있다.
  const brandHome = (
    <Pressable
      testID="brand-home"
      accessibilityRole="link"
      accessibilityLabel="스코디 홈으로"
      onPress={() => router.navigate(rootHref as never)}
      style={({ pressed }) => [styles.brandLink, pressed && { opacity: 0.6 }]}
    >
      <Brand small />
    </Pressable>
  );

  // 문제 풀이 몰입 모드: nav 숨기고 좌상단 "나중에 다시 풀기"만.
  const focus = focusable && pathname.includes('/solve/');
  if (focus) {
    return (
      <SafeAreaView style={styles.mobRoot} edges={['top', 'bottom']}>
        <View style={styles.focusBar}>
          <Pressable
            testID="focus-exit"
            accessibilityRole="button"
            accessibilityLabel="나중에 다시 풀기"
            // 들어온 화면으로 돌아간다. 직접 URL 진입처럼 히스토리가 없으면 역할 상위 경로로.
            onPress={() =>
              router.canGoBack() ? router.back() : router.navigate(rootHref as never)
            }
            style={({ pressed }) => [styles.focusBtn, pressed && { backgroundColor: colors.hover }]}
          >
            <Icon name="chevron-left" size={16} color={colors.inkSecondary} />
            <AppText variant="caption" tone="secondary">
              나중에 다시 풀기
            </AppText>
          </Pressable>
        </View>
        <View style={styles.mobMain}>{children}</View>
      </SafeAreaView>
    );
  }

  if (isDesktop) {
    return (
      <SafeAreaView style={styles.deskRoot}>
        <View style={styles.sidebar}>
          <View style={styles.brandBox}>{brandHome}</View>
          <View style={styles.navList}>
            {nav.map((item) => {
              const active = isActive(pathname, item.href, rootHref);
              return (
                <Pressable
                  key={item.href}
                  accessibilityRole="link"
                  accessibilityState={{ selected: active }}
                  onPress={() => router.navigate(item.href as never)}
                  style={({ pressed }) => [
                    styles.navItem,
                    active && styles.navItemActive,
                    pressed && !active && { backgroundColor: colors.hover },
                  ]}
                >
                  <View style={styles.navItemRow}>
                    {item.icon ? (
                      <Icon
                        name={item.icon}
                        size={18}
                        color={active ? colors.accent : colors.inkSecondary}
                      />
                    ) : null}
                    <AppText
                      style={{
                        fontFamily: active ? typeface.semibold : typeface.medium,
                        fontSize: font.size.base,
                        color: active ? colors.accent : colors.inkSecondary,
                      }}
                    >
                      {item.label}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.accountBox}>
            <AppText variant="label" numberOfLines={1}>
              {accountName}
            </AppText>
            <AppText variant="caption" tone="tertiary" numberOfLines={1}>
              {accountMeta}
            </AppText>
          </View>
        </View>
        <View style={styles.deskMain}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.mobRoot}>
      <SafeAreaView edges={['top']} style={styles.mobTopSafe}>
        <View style={styles.topBar}>{brandHome}</View>
      </SafeAreaView>
      <View style={styles.mobMain}>{children}</View>
      {/* Toss식 플로팅 라운드 내비: 콘텐츠가 아래로 스크롤되고 탭은 떠 있다. */}
      <View
        pointerEvents="box-none"
        style={[styles.tabWrap, { paddingBottom: insets.bottom + spacing.sm }]}
      >
        <View style={styles.tabBar}>
          {nav.map((item) => {
            const active = isActive(pathname, item.href, rootHref);
            const color = active ? colors.accent : colors.inkTertiary;
            return (
              <Pressable
                key={item.href}
                accessibilityRole="link"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: active }}
                onPress={() => router.navigate(item.href as never)}
                style={[styles.tabItem, active && styles.tabItemActive]}
              >
                <Icon name={item.icon ?? 'chevron-right'} size={22} color={color} />
                {tabLabels ? (
                  <AppText
                    variant="caption"
                    style={{ color, fontFamily: active ? typeface.semibold : typeface.regular }}
                  >
                    {item.label}
                  </AppText>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  deskRoot: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },
  sidebar: {
    width: layout.sidebarWidth,
    backgroundColor: colors.surface,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
    gap: spacing.xl,
  },
  brandBox: { paddingHorizontal: spacing.sm },
  brandLink: { alignSelf: 'flex-start' },
  navList: { gap: 2, flex: 1 },
  navItem: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md },
  navItemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  navItemActive: { backgroundColor: colors.accentSoft },
  accountBox: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 3,
  },
  deskMain: { flex: 1 },

  mobRoot: { flex: 1, backgroundColor: colors.bg },
  mobTopSafe: { backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  focusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  focusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  mobMain: { flex: 1 },
  tabWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  tabBar: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    // §7 예외: 떠 있는 요소에만 아주 옅은 그림자 1단계.
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  tabItemActive: { backgroundColor: colors.accentSoft },
});
