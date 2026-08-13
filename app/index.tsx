import { Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { useSession } from '@/session';
import { homeHrefFor } from '@/session/routing';

/**
 * 진입점: 로그인 상태면 역할 홈으로 보낸다.
 * 로그인 전에는 웹은 소개 페이지, 앱은 로그인 화면으로 간다.
 */
export default function Index() {
  const { account, loading } = useSession();
  // 세션 복원 중에는 판단하지 않는다 — 로그인한 사람을 소개 페이지로 보내게 된다.
  if (loading) return null;
  if (account) return <Redirect href={homeHrefFor(account) as never} />;
  return <Redirect href={(Platform.OS === 'web' ? '/introduce' : '/login') as never} />;
}
