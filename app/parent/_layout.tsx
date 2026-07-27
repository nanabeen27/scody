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
  const { account, signOut } = useSession();
  if (!account || !accountHasRole(account, 'parent')) {
    return <Redirect href={'/login' as never} />;
  }
  return (
    <RoleShell nav={NAV} accountName={account.name} accountMeta="학부모" onSignOut={signOut} tabLabels>
      <Slot />
    </RoleShell>
  );
}
