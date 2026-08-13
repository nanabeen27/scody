import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { BackLink } from './BackLink';
import { useResponsive } from '@/theme/useResponsive';
import { ColumnWidthProvider } from '@/theme/useColumn';
import { colors, layout, spacing } from '@/theme/tokens';

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
  /**
   * 값이 바뀌면 스크롤을 맨 위로 되돌린다. **화면은 그대로인데 안에 든 내용만 갈리는 이동**에 쓴다
   * (문항 페이지, 표의 페이지, 목록 필터). 라우팅으로 화면이 갈리면 `ScrollView`가 새로 생기므로
   * 필요 없다.
   *
   * 페이지 번호처럼 안정된 값을 준다 — 렌더마다 바뀌는 값을 주면 사용자가 맨 위에 붙박인다.
   *
   * **화면을 가득 채우는 목록에만 준다.** 화면 중간에 있는 페이저(리포트의 오답 카드,
   * 성과 분석의 페이저 3개)에 주면 보던 자리를 잃는다.
   */
  scrollResetKey?: string | number;
}

/** 공통 화면: 종이색 배경, 넓은 여백, 좌측 정렬된 본문 폭 컬럼, 선택적 헤더. */
export function Screen({
  children,
  eyebrow,
  title,
  lead,
  wide,
  testID,
  backFallback,
  scrollResetKey,
}: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  /*
    본문 컬럼의 실제 폭. 표와 막대는 창이 아니라 이 값으로 판단해야 한다 —
    데스크톱은 사이드바와 여백을 뺀 뒤 최대폭에서 멈추기 때문이다.
    첫 프레임에는 계산값을 쓰고, 실측이 오면 그 값으로 바꾼다(보통 같다).
  */
  const [measured, setMeasured] = useState(0);
  // 첫 그림에는 움직이지 않는다. 값이 '바뀌었을 때'만 되돌린다.
  const first = useRef(true);
  /*
    `useLayoutEffect`인 이유: 그리기 전에 되돌려야 한다. `useEffect`면 새 내용이
    옛 위치에 한 프레임 보였다가 튄다.
    `animated: false`인 이유: 웹에서 `animated: true`는 `behavior: 'smooth'`가 되어
    Playwright의 안정성 검사와 겹친다(`ask.tsx`도 같은 선택).
  */
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [scrollResetKey]);
  const { width: win, isMobile, isDesktop } = useResponsive();
  const maxWidth = wide ? layout.wideMaxWidth : layout.contentMaxWidth;
  /*
    모바일은 폭이 342px밖에 안 되는데 좌우 24 + 섹션 사이 24를 그대로 쓰면
    본문이 눌리고 화면이 성기게 보인다. 좁은 화면에서만 한 단계씩 줄인다.
    태블릿·데스크톱은 그대로 둔다.
  */
  const pad = isMobile ? spacing.lg : spacing.xl;
  /** 실측이 오기 전 한 프레임 동안 쓸 값. 보통 실측과 같다. */
  const guess = Math.min(maxWidth, win - (isDesktop ? layout.sidebarWidth : 0) - pad * 2);
  return (
    <ScrollView
      ref={scrollRef}
      testID={testID}
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        {
          paddingHorizontal: pad,
          paddingTop: insets.top + (isMobile ? spacing.xl : spacing.xxl),
          paddingBottom: insets.bottom + spacing.huge,
        },
      ]}
    >
      <View
        style={[styles.column, { maxWidth, gap: pad }]}
        onLayout={(e) => setMeasured(Math.round(e.nativeEvent.layout.width))}
      >
        <ColumnWidthProvider value={measured || guess}>
        {backFallback ? <BackLink fallback={backFallback} /> : null}
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
        </ColumnWidthProvider>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { alignItems: 'center' },
  column: { width: '100%' },
  header: { gap: spacing.sm },
});
