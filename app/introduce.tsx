import { Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { WebLanding } from '@/features/landing/WebLanding';

/**
 * 서비스 소개 페이지. 웹에서 로그인하지 않은 방문자가 처음 보는 화면이다.
 * 앱(네이티브)에는 소개 페이지를 두지 않고 로그인으로 보낸다(확정 정책 4절).
 * 로그인한 상태로 들어와도 막지 않는다. 상단에서 자기 공간으로 돌아갈 수 있다.
 *
 * **앱에서 "스코디가 뭔지" 보는 자리는 `/legal/about`이다**(서비스 소개 문서 — 고정 소개문,
 * 무엇을 제공하는지, 누가 쓰는지). 그래서 이 라우트를 네이티브에서 그쪽으로 돌리고 싶어지는데,
 * **그러면 되돌이가 생긴다**: `LegalDocView`의 `backFallback`과 `소개 페이지로 돌아가기`가 둘 다
 * `/introduce`를 가리키고 `BackLink`는 히스토리가 없을 때 그 주소로 `replace`한다 — 직접 진입에서
 * 뒤로를 누르면 같은 문서로 되돌아온다. 앱에서 소개로 가는 길은 그 두 곳을 함께 고쳐야 열린다
 * (`src/features/legal/LegalDocView.tsx`).
 */
export default function Introduce() {
  if (Platform.OS !== 'web') return <Redirect href={'/login' as never} />;
  return <WebLanding />;
}
