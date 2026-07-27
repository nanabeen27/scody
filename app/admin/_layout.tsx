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
  const { account, signOut } = useSession();
  if (!account || !accountHasRole(account, 'admin')) {
    return <Redirect href={'/login' as never} />;
  }
  return (
    <RoleShell nav={NAV} accountName={account.name} accountMeta="총괄관리자" onSignOut={signOut} tabLabels>
      <Slot />
    </RoleShell>
  );
}
