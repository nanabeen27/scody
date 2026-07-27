import { Slot, Redirect } from 'expo-router';
import { RoleShell, type NavItem } from '@/components';
import { useSession, accountHasRole } from '@/session';

const NAV: NavItem[] = [
  { href: '/academy', label: '대시보드', icon: 'grid' },
  { href: '/academy/classes', label: '반·학생', icon: 'users' },
  { href: '/academy/assign', label: '학습 배정', icon: 'edit-3' },
  { href: '/academy/new', label: '문제 등록', icon: 'plus' },
  { href: '/academy/analytics', label: '성과 분석', icon: 'bar-chart-2' },
  { href: '/academy/manage', label: '학원 관리', icon: 'settings' },
];

export default function AcademyLayout() {
  const { account, signOut } = useSession();
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
