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
 * 키보드 포커스 링. **한곳에서만 정한다** — 컴포넌트마다 그리면 모양이 갈리고,
 * 브라우저 기본 링은 팔레트와 맞지 않고 `borderRadius`를 따르지 않는다.
 * `:focus-visible`이라 마우스 클릭에는 뜨지 않는다.
 */
export const FOCUS_CSS = `
:focus-visible{outline:2px solid var(--sc-accent);outline-offset:2px;border-radius:inherit}
:focus:not(:focus-visible){outline:none}
`;

export const THEME_CSS = `
:root{${vars(PALETTE_LIGHT)}}
@media (prefers-color-scheme: dark){:root:not([data-theme]){${vars(PALETTE_DARK)}}}
:root[data-theme="dark"]{${vars(PALETTE_DARK)}}
:root[data-theme="light"]{${vars(PALETTE_LIGHT)}}
`;
