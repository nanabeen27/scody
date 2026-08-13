/**
 * 폰트 소스와 패밀리 이름 — **네이티브용**. 웹은 `fonts.web.ts`를 쓴다(Metro가 갈라 준다).
 *
 * 네이티브는 앱 번들에 폰트가 들어 있어 네트워크로 받지 않는다. 그래서 원본 TTF를
 * 그대로 쓴다(약 10.7MB). 웹만 woff2 서브셋으로 줄인다 — 이유는
 * `scripts/build-web-fonts.py` 주석과 `DESIGN.md` 4절에 있다.
 *
 * `FAMILY`는 `src/theme/tokens.ts`의 `typeface`가 쓰고, `SOURCES`는
 * `app/_layout.tsx`의 `useFonts`가 쓴다. 두 값의 키가 어긋나면 글자가 폴백으로 떨어진다.
 */
export const FAMILY = {
  regular: 'Pretendard_400Regular',
  medium: 'Pretendard_500Medium',
  semibold: 'Pretendard_600SemiBold',
  bold: 'Pretendard_700Bold',
} as const;

export const SOURCES: Record<string, number> = {
  [FAMILY.regular]: require('../../assets/fonts/Pretendard-Regular.ttf'),
  [FAMILY.medium]: require('../../assets/fonts/Pretendard-Medium.ttf'),
  [FAMILY.semibold]: require('../../assets/fonts/Pretendard-SemiBold.ttf'),
  [FAMILY.bold]: require('../../assets/fonts/Pretendard-Bold.ttf'),
};
