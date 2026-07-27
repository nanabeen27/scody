import { Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { WebLanding } from '@/features/landing/WebLanding';

/**
 * 서비스 소개 페이지. 웹에서 로그인하지 않은 방문자가 처음 보는 화면이다.
 * 앱(네이티브)에는 소개 페이지를 두지 않고 로그인으로 보낸다.
 * 로그인한 상태로 들어와도 막지 않는다. 상단에서 자기 공간으로 돌아갈 수 있다.
 */
export default function Introduce() {
  if (Platform.OS !== 'web') return <Redirect href={'/login' as never} />;
  return <WebLanding />;
}
