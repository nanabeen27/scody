import { Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { useSession } from '@/session';
import { homeHrefFor } from '@/session/routing';

/**
 * 진입점: 로그인 상태면 역할 홈으로 보낸다.
 * 로그인 전에는 웹은 소개 페이지, 앱은 로그인 화면으로 간다.
 */
export default function Index() {
  const { account } = useSession();
  if (account) return <Redirect href={homeHrefFor(account) as never} />;
  return <Redirect href={(Platform.OS === 'web' ? '/introduce' : '/login') as never} />;
}
