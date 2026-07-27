/**
 * 스코디 디자인 토큰.
 *
 * 참고: Vercel/Geist 계열의 깔끔한 인상 — 순백 배경, 크리스프한 모노크롬,
 * 얇은 경계선, 검은색 주요 행동, 넉넉한 여백, 타이트한 타이포.
 * 로고 워드마크 "Scody"는 Space Grotesk, UI 본문·제목은 Pretendard.
 */

/**
 * 색은 CSS 변수를 가리킨다. 실제 값은 palette.ts(라이트/다크)에 있고
 * ThemeProvider가 data-theme으로 전환한다. 카카오는 브랜드 고정색.
 */
export const colors = {
  bg: 'var(--sc-bg)',
  surface: 'var(--sc-surface)',
  offset: 'var(--sc-offset)',
  hover: 'var(--sc-hover)',

  border: 'var(--sc-border)',
  borderStrong: 'var(--sc-borderStrong)',

  ink: 'var(--sc-ink)',
  inkSecondary: 'var(--sc-inkSecondary)',
  inkTertiary: 'var(--sc-inkTertiary)',

  // Toss 블루: 주요 행동·활성 상태. 단색 플랫(네온·그라데이션 금지).
  accent: 'var(--sc-accent)',
  accentText: 'var(--sc-accentText)',
  accentSoft: 'var(--sc-accentSoft)',

  kakao: 'var(--sc-kakao)',
  kakaoText: 'var(--sc-kakaoText)',

  // 학습 출처: 낮은 채도 + 항상 텍스트 라벨 병행
  personal: 'var(--sc-personal)',
  academy: 'var(--sc-academy)',

  danger: 'var(--sc-danger)',
  success: 'var(--sc-success)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 36,
  xxxl: 56,
  huge: 88,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  // Toss식 부드러운 표면 전용(히어로 카드·플로팅 내비). 기본 요소는 md/lg 유지.
  xl: 18,
  card: 22,
  pill: 999,
} as const;

/** 폰트 로드 전·실패 시 쓰는 시스템 폴백. 무게별로 같은 값을 쓴다. */
const FALLBACK = '"Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

/**
 * 로드된 폰트 패밀리 이름(무게별). 본문·제목 모두 Pretendard(D-016).
 * 라틴 전용 폰트(Inter)를 쓰면 한글만 시스템 폰트로 떨어져 두 벌이 섞였다.
 * Pretendard는 한글·라틴을 같은 골격으로 덮는다.
 * `wordmark`는 "Scody" 로고 전용(Space Grotesk) — 본문에 쓰지 않는다.
 */
export const typeface = {
  regular: `Pretendard_400Regular, ${FALLBACK}`,
  medium: `Pretendard_500Medium, ${FALLBACK}`,
  semibold: `Pretendard_600SemiBold, ${FALLBACK}`,
  bold: `Pretendard_700Bold, ${FALLBACK}`,
  wordmark: `SpaceGrotesk_700Bold, ${FALLBACK}`,
} as const;

/** useFonts로 로드하는 실제 폰트 키. `app/_layout.tsx`와 짝을 맞춘다. */
export const FONT_KEYS = [
  'Pretendard_400Regular',
  'Pretendard_500Medium',
  'Pretendard_600SemiBold',
  'Pretendard_700Bold',
  'SpaceGrotesk_700Bold',
] as const;

export const font = {
  family: typeface.regular,
  size: { xs: 12, sm: 13, base: 15, md: 16, lg: 18, xl: 22, xxl: 27, display: 34 },
  lineHeight: { tight: 1.15, snug: 1.3, normal: 1.55, relaxed: 1.75 },
  tracking: { tighter: -0.6, tight: -0.3, normal: 0, wide: 0.4 },
} as const;

export const layout = {
  contentMaxWidth: 680,
  wideMaxWidth: 960,
  sidebarWidth: 248,
  readingMaxWidth: 620,
} as const;

export const breakpoints = { mobile: 0, tablet: 720, desktop: 1024 } as const;
