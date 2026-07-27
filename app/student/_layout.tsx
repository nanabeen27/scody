import { Slot, Redirect } from 'expo-router';
import { RoleShell, type NavItem } from '@/components';
import { useSession, accountHasRole } from '@/session';

const NAV: NavItem[] = [
  { href: '/student', label: '홈', icon: 'home' },
  { href: '/student/learn', label: '학습', icon: 'book-open' },
  { href: '/student/records', label: '기록', icon: 'bar-chart-2' },
  { href: '/student/profile', label: '내 정보', icon: 'user' },
];

export default function StudentLayout() {
  const { account, signOut } = useSession();
  if (!account || !accountHasRole(account, 'student')) {
    return <Redirect href={'/login' as never} />;
  }
  const meta = account.academyName ?? '개인 학습';
  return (
    <RoleShell nav={NAV} accountName={account.name} accountMeta={meta} onSignOut={signOut} focusable>
      <Slot />
    </RoleShell>
  );
}
