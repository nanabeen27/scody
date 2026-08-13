import { Slot, Redirect } from 'expo-router';
import { RoleShell, type NavItem } from '@/components';
import { useSession, accountHasRole } from '@/session';

const NAV: NavItem[] = [
  { href: '/academy', label: '대시보드', icon: 'grid' },
  { href: '/academy/classes', label: '반·학생', icon: 'users' },
  { href: '/academy/assign', label: '학습 배정', icon: 'edit-3' },
  /*
    메뉴는 '문제 등록'(행동)이 아니라 '문제'(우리 학원 콘텐츠)다 — 등록은 그 화면 안의 행동이다.
    운영자 메뉴도 같은 판단을 이미 했다(D-017). 배정 바로 뒤에 두어 만들고 내는 일이 붙어 있게 한다.
  */
  { href: '/academy/content', label: '문제', icon: 'file-text' },
  { href: '/academy/analytics', label: '성과 분석', icon: 'bar-chart-2' },
  { href: '/academy/manage', label: '학원 관리', icon: 'settings' },
];

export default function AcademyLayout() {
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
  if (!account || !accountHasRole(account, 'academy')) {
    return <Redirect href={'/login' as never} />;
  }
  const meta = `${account.academyName ?? '학원'} · ${account.academyRole === 'director' ? '원장' : '선생님'}`;
  return (
    <RoleShell nav={NAV} accountName={account.name} accountMeta={meta} onSignOut={signOut} tabLabels>
      <Slot />
    </RoleShell>
  );
}
