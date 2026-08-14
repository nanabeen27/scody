/**
 * 스코디 디자인 토큰.
 *
 * 참고: Vercel/Geist 계열의 깔끔한 인상 — 순백 배경, 크리스프한 모노크롬,
 * 얇은 경계선, 검은색 주요 행동, 넉넉한 여백, 타이트한 타이포.
 * 로고 워드마크 "Scody"는 Space Grotesk, UI 본문·제목은 Pretendard.
 */
import { FAMILY, SOURCES } from './fonts';


/**
 * 색은 CSS 변수를 가리킨다. 실제 값은 palette.ts(라이트/다크)에 있고
 * ThemeProvider가 data-theme으로 전환한다. 카카오는 브랜드 고정색.
 */
export const colors = {
  bg: 'var(--sc-bg)',
  surface: 'var(--sc-surface)',
  offset: 'var(--sc-offset)',
  hover: 'var(--sc-hover)',
  /** 상시 고지 면(대리 보기 배너). 오답·오류의 `danger`와 갈라 둔다(D-147). */
  notice: 'var(--sc-notice)',

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
  shadow: 'var(--sc-shadow)',
} as const;

export const spacing = {
  /** 한 덩어리 안에서 줄만 갈릴 때(제목·부제, 라벨·값). 떨어뜨리는 여백이 아니다. */
  xxs: 2,
  xs: 4,
  /** 아이콘과 글자, 태그와 태그. 닿으면 안 되지만 떨어져 보여도 안 되는 사이. */
  xs2: 6,
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
 *
 * 패밀리 이름은 플랫폼마다 다르다(`src/theme/fonts.ts` / `fonts.web.ts`) —
 * 웹은 라이선스 때문에 이름을 바꾼 woff2 서브셋을 쓴다. 이름을 여기 직접 쓰지 않는다.
 */
export const typeface = {
  regular: `${FAMILY.regular}, ${FALLBACK}`,
  medium: `${FAMILY.medium}, ${FALLBACK}`,
  semibold: `${FAMILY.semibold}, ${FALLBACK}`,
  bold: `${FAMILY.bold}, ${FALLBACK}`,
  wordmark: `SpaceGrotesk_700Bold, ${FALLBACK}`,
} as const;

/** useFonts로 로드하는 실제 폰트 키. 소스에서 뽑아 `app/_layout.tsx`와 어긋날 수 없게 한다. */
export const FONT_KEYS = [...Object.keys(SOURCES), 'SpaceGrotesk_700Bold'] as const;

export const font = {
  family: typeface.regular,
  /** `reading`은 지문 전용이다 — 길게 읽는 면이라 본문보다 한 칸 크다(§4). */
  size: { xs: 12, sm: 13, base: 15, md: 16, lg: 18, xl: 22, xxl: 27, display: 34, reading: 17 },
  lineHeight: { tight: 1.15, snug: 1.3, normal: 1.55, relaxed: 1.75, reading: 1.9 },
  tracking: { tighter: -0.6, tight: -0.3, normal: 0, wide: 0.4 },
} as const;

/**
 * 선택 컨트롤(`SegmentedControl`)의 치수. 프로젝트의 하나뿐인 선택 UI 표준이라
 * 값을 여기 모아 둔다 — 화면마다 다시 그리면 높이·여백이 갈린다(D-077).
 *
 * `trackRadius`는 `pill`이 아니라 `card(22)`다. 한 줄이면 트랙 높이의 절반(약 18.6)으로
 * 잘려 알약과 같은 모양이 되고, 줄바꿈해서 두 줄이 되면 거대한 알약 대신 둥근 사각형이 된다.
 */
export const control = {
  trackPadding: 3,
  gap: 3,
  paddingX: spacing.lg,
  paddingY: spacing.xs,
  trackRadius: radius.card,
  itemRadius: radius.pill,
  labelSize: font.size.sm,
  /**
   * 라벨 줄높이를 **명시한다.** 예전에는 `fontSize`만 13으로 바꾸고 `AppText body`의
   * 23.25를 상속해 컨트롤 높이가 31.25px이었다 — 아무도 적어 두지 않은 우연이라,
   * 누가 줄높이를 "고치면" 28.15로 조용히 줄었다.
   */
  labelLineHeight: 20,
} as const;

export const layout = {
  contentMaxWidth: 680,
  wideMaxWidth: 960,
  sidebarWidth: 248,
  readingMaxWidth: 620,
  /**
   * 화면 행동 줄(`ActionBar`)의 최대 폭. 본문 컬럼과 같다 —
   * `wide`(960) 화면에서도 버튼 줄은 읽기 폭 안에 머문다.
   */
  actionBarMaxWidth: 680,
} as const;

export const breakpoints = { mobile: 0, tablet: 720, desktop: 1024 } as const;

/**
 * **컬럼 폭** 기준 분기점. 창 폭 분기점(`breakpoints`)과 값이 다르다 —
 * 데스크톱은 사이드바 248과 좌우 여백을 뺀 뒤의 수라 같은 수를 쓸 수 없다.
 * 실측: 390창→358 · 820창→772 · 1024창(wide)→728 · 1280창(wide)→960 · 1280창(기본)→680.
 */
export const columnBreakpoints = { mobile: 0, tablet: 560, desktop: 860 } as const;

/**
 * 손으로 누르는 것의 하한.
 *
 * `min`은 Apple HIG 44pt · Material 48dp · WCAG 2.5.5(AAA) 44px의 하한이다. **기본값이다.**
 * `dense`는 밀집이 곧 정보인 자리(필터 트랙)의 하한 — WCAG 2.5.8(AA) 24는 넘지만 AAA에는
 * 미달이다. **주 행동과 목록 안에서 반복되는 행동에는 쓰지 않는다.**
 */
export const touch = { min: 44, dense: 36 } as const;
