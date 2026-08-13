import { Platform } from 'react-native';

/**
 * 웹 문서 <head>에 파비콘 링크를 붙인다.
 *
 * `expo.web.output`이 `single`이면 Expo가 자기 HTML 템플릿을 쓰고 `app/+html.tsx`를 읽지 않는다.
 * 문서 제목은 `app.json`의 `web.name`으로 정해지지만 아이콘 링크는 넣어 주지 않아서,
 * 브라우저 기본 동작(`/favicon.ico` 요청)에만 의존하게 된다. SVG 마크를 쓰려면 여기서 붙인다.
 *
 * 파일은 `public/`에 있고 빌드 시 배포 루트로 복사된다(`public/favicon.svg`, `public/favicon.ico`).
 * 테마 CSS 변수를 넣는 `ThemeProvider`와 같은 방식이다.
 */
export function applyWebIcons() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const icons: { id: string; rel: string; href: string; type?: string }[] = [
    { id: 'sc-icon-svg', rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    { id: 'sc-icon-ico', rel: 'alternate icon', href: '/favicon.ico', type: 'image/x-icon' },
  ];
  for (const icon of icons) {
    if (document.getElementById(icon.id)) continue;
    const link = document.createElement('link');
    link.id = icon.id;
    link.rel = icon.rel;
    link.href = icon.href;
    if (icon.type) link.type = icon.type;
    document.head.appendChild(link);
  }
}
