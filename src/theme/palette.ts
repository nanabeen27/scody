/**
 * 라이트/다크 팔레트. 실제 값은 여기, tokens의 colors는 CSS 변수를 가리킨다.
 * 강조색은 Perplexity의 True Turquoise 계열(단색). 배경은 Paper/Offblack.
 * AI 그라데이션·과한 색 금지. 강조색은 링크/선택/주요 행동에만.
 */

export type ColorName =
  | 'bg'
  | 'surface'
  | 'offset'
  | 'hover'
  /**
   * **상시 고지 면**(D-147). 화면에 계속 떠 있으면서 "이건 본문이 아니다"를 말해야 하는
   * 자리 — 지금은 대리 보기 배너 하나다.
   *
   * `offset`으로는 풀리지 않는다: 본문과 라이트 1.09:1 · 다크 1.21:1이라 면으로는 구분이
   * 사실상 없었고, 실제 구분을 1px 테두리와 아이콘이 혼자 지고 있었다(A-080). `danger`도
   * 쓸 수 없다 — 오답·오류의 색이라 상시 배너에 쓰면 그 신호가 죽는다(D-071).
   *
   * 그래서 팔레트에 없던 **호박(ochre)** 한 칸을 둔다. 경고로 읽히지만 빨강이 아니고,
   * 출처색(`academy` 테라코타)·`kakao` 노랑과도 명도·채도가 갈린다.
   */
  | 'notice'
  | 'border'
  | 'borderStrong'
  | 'ink'
  | 'inkSecondary'
  | 'inkTertiary'
  | 'accent'
  | 'accentText'
  | 'accentSoft'
  | 'kakao'
  | 'kakaoText'
  | 'personal'
  | 'academy'
  | 'danger'
  | 'success'
  /** 떠 있는 면의 그림자. 다크에서 검정 그림자는 보이지 않아 값을 갈라 둔다. */
  | 'shadow';

export const PALETTE_LIGHT: Record<ColorName, string> = {
  // 종이 느낌의 옅은 베이지. 순백은 눈이 부시고 카드와 배경이 구분되지 않는다.
  bg: '#f7f4ea',
  surface: '#fffdf7',
  offset: '#eeeade',
  hover: '#e5dfd0',
  // 본문(bg)과 1.48:1. ink 11.26:1 · inkSecondary 4.59:1로 어느 글자 톤을 올려도 AA다.
  notice: '#e6c87a',
  // 경계선은 배경과 충분히 차이 나야 목록·표 구분이 보인다.
  border: '#d9d2be',
  borderStrong: '#bdb49b',
  ink: '#091717', // Offblack
  inkSecondary: '#4c5758',
  inkTertiary: '#8a908c',
  accent: '#20808d', // True Turquoise
  accentText: '#ffffff',
  accentSoft: '#e2edee',
  kakao: '#fee500',
  kakaoText: '#191600',
  personal: '#114f56', // Turquoise 700 (개인)
  academy: '#a84b2f', // Terra Cotta (학원)
  danger: '#b3402f',
  success: '#2f7d5b',
  shadow: '#091717',
};

export const PALETTE_DARK: Record<ColorName, string> = {
  bg: '#091717', // Offblack
  surface: '#0e1f1f',
  offset: '#132a2a',
  hover: '#1a3535',
  // 본문(bg)과 1.70:1. ink 9.51:1 · inkSecondary 5.01:1.
  notice: '#4a3c18',
  border: '#213f3f',
  borderStrong: '#315150',
  ink: '#f3f1e8',
  inkSecondary: '#a9b3b1',
  inkTertiary: '#71807d',
  accent: '#3aa7b1', // 밝은 청록(다크 대비)
  accentText: '#04211f',
  accentSoft: '#10302f',
  kakao: '#fee500',
  kakaoText: '#191600',
  personal: '#5bb3b8',
  academy: '#d98a63',
  danger: '#e0715a',
  success: '#5cbf90',
  shadow: '#000000',
};

const NAMES = Object.keys(PALETTE_LIGHT) as ColorName[];

function vars(p: Record<ColorName, string>): string {
  return NAMES.map((n) => `--sc-${n}:${p[n]};`).join('');
}

/**
 * **우리가 그리지 않은 브라우저 표면**을 팔레트로 맞춘다. 한곳에서만 정한다 —
 * 컴포넌트마다 그리면 모양이 갈리고, 브라우저 기본값은 어느 팔레트에도 속하지 않는다.
 * 값이 CSS 변수라 다크에서도 알아서 갈린다.
 *
 * - **키보드 포커스 링**: 기본 링은 색이 맞지 않고 `borderRadius`를 따르지 않는다.
 *   `:focus-visible`이라 마우스 클릭에는 뜨지 않는다.
 * - **선택 영역**: 기본 선택색은 파랑이라, 지문을 드래그해 읽는 순간 우리 색이 아닌 색이
 *   한 덩어리 생긴다. `accentSoft` 위의 `ink`는 라이트·다크 모두 대비가 넉넉하다.
 *
 * 다음 전역 규칙(캐럿 색·`text-size-adjust`·스크롤바)도 여기 넣는다. 이름이 `FOCUS_CSS`였을
 * 때 `::selection`이 들어오면서 상수 이름이 내용보다 좁아졌다.
 */
export const GLOBAL_CSS = `
:focus-visible{outline:2px solid var(--sc-accent);outline-offset:2px;border-radius:inherit}
:focus:not(:focus-visible){outline:none}
::selection{background:var(--sc-accentSoft);color:var(--sc-ink)}
`;

export const THEME_CSS = `
:root{${vars(PALETTE_LIGHT)}}
@media (prefers-color-scheme: dark){:root:not([data-theme]){${vars(PALETTE_DARK)}}}
:root[data-theme="dark"]{${vars(PALETTE_DARK)}}
:root[data-theme="light"]{${vars(PALETTE_LIGHT)}}
`;
