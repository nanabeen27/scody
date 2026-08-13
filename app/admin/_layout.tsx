import { Slot, Redirect } from 'expo-router';
import { RoleShell, type NavItem } from '@/components';
import { useSession, accountHasRole } from '@/session';

/**
 * 총괄관리자 메뉴. 운영자가 하는 일 순서대로 둔다.
 * 개요(무슨 일이 있나) → 학원·계정(누가 쓰나) → 요금제(얼마 받나) → 콘텐츠(무엇을 주나) → 운영 기록(무엇을 바꿨나).
 * 문제 등록은 콘텐츠 화면 안의 행동이라 메뉴에 두지 않는다.
 */
const NAV: NavItem[] = [
  { href: '/admin', label: '개요', icon: 'grid' },
  { href: '/admin/academies', label: '학원', icon: 'users' },
  { href: '/admin/users', label: '계정', icon: 'user' },
  { href: '/admin/billing', label: '요금제', icon: 'credit-card' },
  { href: '/admin/content', label: '콘텐츠', icon: 'file-text' },
  { href: '/admin/ops', label: '운영 기록', icon: 'activity' },
];

/** 총괄관리자 공간. 운영자만 접근한다. */
export default function AdminLayout() {
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
  if (!account || !accountHasRole(account, 'admin')) {
    return <Redirect href={'/login' as never} />;
  }
  return (
    <RoleShell nav={NAV} accountName={account.name} accountMeta="총괄관리자" onSignOut={signOut} tabLabels>
      <Slot />
    </RoleShell>
  );
}
