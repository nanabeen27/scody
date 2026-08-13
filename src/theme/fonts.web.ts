/**
 * 폰트 소스와 패밀리 이름 — **웹용**. 네이티브는 `fonts.ts`를 쓴다.
 *
 * 웹은 폰트를 네트워크로 받는다. 원본 TTF 4종(10.7MB)은 브라우저가 기다려 주는
 * 시간(`font-display: auto`, 약 3초)을 넘겨서 텍스트가 폴백으로 먼저 그려졌다가
 * 뒤늦게 바뀌었다. 그래서 한글 완성형 전체를 담은 woff2 서브셋(4종 2.5MB)을 쓴다.
 * 만드는 방법과 남긴 글자 범위는 `scripts/build-web-fonts.py`에 있다.
 *
 * 이름이 `ScodyKR`인 이유: Pretendard 라이선스(SIL OFL 1.1)에 Reserved Font Name
 * `Pretendard`가 걸려 있고 서브셋은 OFL이 말하는 Modified Version이라 원래 이름을
 * 쓸 수 없다. 글자 모양은 Pretendard 그대로이고 라이선스 파일도 함께 둔다
 * (`assets/fonts/Pretendard-LICENSE.txt`).
 */
export const FAMILY = {
  regular: 'ScodyKR_400Regular',
  medium: 'ScodyKR_500Medium',
  semibold: 'ScodyKR_600SemiBold',
  bold: 'ScodyKR_700Bold',
} as const;

export const SOURCES: Record<string, number> = {
  [FAMILY.regular]: require('../../assets/fonts/web/ScodyKR-Regular.woff2'),
  [FAMILY.medium]: require('../../assets/fonts/web/ScodyKR-Medium.woff2'),
  [FAMILY.semibold]: require('../../assets/fonts/web/ScodyKR-SemiBold.woff2'),
  [FAMILY.bold]: require('../../assets/fonts/web/ScodyKR-Bold.woff2'),
};
