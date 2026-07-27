import type { Account, Role } from '@/data';

export const ROLE_HOME: Record<Role, string> = {
  student: '/student',
  parent: '/parent',
  academy: '/academy',
  admin: '/admin',
};

export const ROLE_LABEL: Record<Role, string> = {
  student: '학생',
  parent: '학부모',
  academy: '학원',
  admin: '총괄관리자',
};

/** 로그인 직후 이동 위치. 다역할이면 공간 선택으로. */
export function homeHrefFor(account: Account): string {
  if (account.roles.length > 1) return '/select-space';
  return ROLE_HOME[account.roles[0]];
}
