import { Slot, Redirect } from 'expo-router';
import { RoleShell, type NavItem } from '@/components';
import { useSession, accountHasRole } from '@/session';

const NAV: NavItem[] = [
  { href: '/parent', label: '홈', icon: 'home' },
  { href: '/parent/report', label: '리포트', icon: 'bar-chart-2' },
  { href: '/parent/children', label: '자녀', icon: 'users' },
  { href: '/parent/profile', label: '내 정보', icon: 'user' },
];

export default function ParentLayout() {
  const { account, signOut, loading } = useSession();
  /*
    **세션 복원을 기다린다.** Supabase는 저장된 세션을 비동기로 읽어 오므로, 그 사이 `account`는
    `null`이다. 기다리지 않으면 새로고침·직접 URL 진입마다 로그인 화면으로 튄다.
  */
  /*
    **세션 복원을 기다린다.** Supabase는 저장된 세션을 비동기로 읽어 오므로, 그 사이 `account`는
    `null`이다. 기다리지 않으면 새로고침·직접 URL 진입마다 로그인 화면으로 튄다.

    **콘텐츠·학습 기록 로딩까지 함께 기다리게 해 봤지만 되돌렸다**(실측: student-flow 실패가
    13 → 20으로 늘었다). 화면 전체를 `null`로 두는 것이 라우팅과 부딪힌다 — 단계형 화면
    (`/student/pick`)이 쿼리 파라미터를 잃었다. 데이터가 아직 없을 때의 문장은 화면마다
    따로 다뤄야 한다(남은 작업 M-DB-8).
  */
  if (loading) return null;
  if (!account || !accountHasRole(account, 'parent')) {
    return <Redirect href={'/login' as never} />;
  }
  return (
    <RoleShell nav={NAV} accountName={account.name} accountMeta="학부모" onSignOut={signOut} tabLabels>
      <Slot />
    </RoleShell>
  );
}
