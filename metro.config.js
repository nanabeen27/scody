// Metro 기본 설정에 woff2가 자산으로 들어 있지 않다. 웹 폰트 서브셋
// (`assets/fonts/web/*.woff2`, `src/theme/fonts.web.ts`)을 require로 불러오려면 필요하다.
// 네이티브는 ttf만 쓰므로 이 항목이 네이티브 번들을 늘리지 않는다.
//
// `lottie`도 같은 이유다. `.json`은 Metro의 `sourceExts`에 이미 있어 `require`가 파싱된
// 객체를 돌려주지만, `.lottie`(ZIP 컨테이너)는 자산으로 다뤄야 한다. 지금
// `assets/motion/`은 비어 있고(라이선스 미검증) 이 줄은 애셋이 들어올 자리를 열어 둔다.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('woff2', 'lottie');

module.exports = config;
