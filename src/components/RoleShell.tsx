import type { ReactNode } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import {
  SafeAreaInsetsContext,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { Brand } from './Brand';
import { Icon, type IconName } from './Icon';
import { useResponsive } from '@/theme/useResponsive';
import { colors, spacing, radius, layout, font, touch, typeface } from '@/theme/tokens';

/**
 * 본문에게 "위쪽 안전영역은 이미 썼다"고 알린다.
 *
 * 셸은 상단바를 `SafeAreaView edges={['top']}`로 감싸 노치를 소비하는데, 본문은 그
 * **형제**라 컨텍스트로는 여전히 원래 값을 본다. 그대로 두면 `Screen`이 `insets.top`을
 * 한 번 더 더해 노치 폰에서 화면마다 약 47px이 빈다. 셸 밖에서 `Screen`을 쓰는 화면
 * (`select-space`·약관)은 이 래퍼를 지나지 않으므로 원래 값을 그대로 쓴다.
 */
function ShellBody({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
      {children}
    </SafeAreaInsetsContext.Provider>
  );
}

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
  const { isDesktop, isMobile } = useResponsive();
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
  /**
   * 대화 화면은 입력창이 화면 아래에 붙어 있어서 플로팅 탭과 겹친다. 탭만 숨긴다.
   * 풀이 몰입 모드와 달리 데스크톱 사이드바는 그대로 두고, 나가는 길은 화면이 그리는 뒤로가기다.
   */
  const chatting = focusable && pathname.endsWith('/ask');
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
        <View style={styles.mobMain}>
        <ShellBody>{children}</ShellBody>
      </View>
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
                  aria-selected={active}
                  aria-current={active ? 'page' : undefined}
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
        <View style={styles.deskMain}>
          <ShellBody>{children}</ShellBody>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.mobRoot}>
      <SafeAreaView edges={['top']} style={styles.mobTopSafe}>
        <View style={styles.topBar}>{brandHome}</View>
      </SafeAreaView>
      <View style={styles.mobMain}>
        <ShellBody>{children}</ShellBody>
      </View>
      {/* Toss식 플로팅 라운드 내비: 콘텐츠가 아래로 스크롤되고 탭은 떠 있다. */}
      {chatting ? null : (
        <View
          testID="tab-bar"
          pointerEvents="box-none"
          style={[
            styles.tabWrap,
            // 모바일은 화면 아래에 붙이고 위만 둥글게. 태블릿은 떠 있는 알약 그대로 둔다.
            isMobile
              ? { paddingHorizontal: 0, paddingBottom: 0 }
              : { paddingBottom: insets.bottom + spacing.sm },
          ]}
        >
          <View
            style={[
              styles.tabBar,
              isMobile && styles.tabBarDocked,
              isMobile && { paddingBottom: insets.bottom + spacing.xs },
            ]}
          >
            {nav.map((item) => {
              const active = isActive(pathname, item.href, rootHref);
              const color = active ? colors.accent : colors.inkTertiary;
              return (
                <Pressable
                  key={item.href}
                  accessibilityRole="link"
                  accessibilityLabel={item.label}
                  aria-selected={active}
                  aria-current={active ? 'page' : undefined}
                  onPress={() => router.navigate(item.href as never)}
                  style={[styles.tabItem, active && styles.tabItemActive]}
                >
                  <Icon name={item.icon ?? 'chevron-right'} size={isMobile ? 19 : 22} color={color} />
                  {tabLabels ? (
                    <AppText
                      variant="caption"
                      style={{
                        color,
                        fontFamily: active ? typeface.semibold : typeface.regular,
                      }}
                    >
                      {item.label}
                    </AppText>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
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
  /*
    워드마크는 26px이지만 누르는 영역은 44px이다 — 상단바에서 홈으로 가는 유일한 길이다.
    커진 만큼 음수 마진으로 되돌려 상단바 높이는 그대로 둔다.
  */
  brandLink: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: touch.min,
    marginVertical: -spacing.sm,
  },
  navList: { gap: 2, flex: 1 },
  navItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  navItemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  navItemActive: { backgroundColor: colors.accentSoft },
  accountBox: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.xxs,
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
  /*
    풀이 화면에서 **유일한 이탈 장치**다(탭바를 숨긴다). 28px이면 안 된다 —
    `BackLink`가 같은 이유로 44를 지킨다. 커진 만큼 음수 마진으로 되돌려
    상단 줄의 보이는 높이는 그대로 둔다.
  */
  focusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: touch.min,
    paddingHorizontal: spacing.sm,
    marginVertical: -spacing.sm,
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
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  /**
   * 모바일 전용: 화면 아래에 붙이고 위 모서리만 둥글게.
   * 떠 있는 알약은 좌우·아래 여백까지 먹어 좁은 화면에서 본문을 더 밀어낸다.
   */
  tabBarDocked: {
    maxWidth: undefined,
    borderRadius: 0,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.xs,
  },
  // 앱의 주 내비게이션이고 엄지가 닿는 자리다. 학생은 라벨 없는 아이콘뿐이라 더 그렇다.
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    minHeight: touch.min,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  tabItemActive: { backgroundColor: colors.accentSoft },
});
