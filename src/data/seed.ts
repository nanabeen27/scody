/**
 * 개발용 시드 픽스처와 그것을 조회하는 함수들.
 *
 * **화면과 `src/features`·`src/repo`는 이 파일을 읽지 않는다.** 읽는 곳은 테스트와
 * `scripts/gen-seed.ts`뿐이다. 실제 데이터는 Supabase에 있고 `src/repo/*`가 조회한다.
 *
 * 이 파일이 `src/data/index.ts`에서 갈라져 나온 이유는 **번들 크기**다. 예전에는 barrel이
 * `ACCOUNTS`(4,186개)·`ACADEMY_CLASSES`(148개)·로스터 3,000명 그래프를 값으로 re-export해서,
 * 화면이 `findContent` 같은 순수 헬퍼 하나만 가져와도 그 그래프 전체가 모듈 평가 시점에
 * 만들어져 운영 번들에 실렸다(Metro에는 tree shaking이 없다).
 *
 * 그래서 규칙은 하나다 — **`app/`·`src/features/`·`src/repo/`·`src/components/`에서
 * 이 파일을 import하지 않는다.**
 */
import { ACCOUNTS, ACADEMY_CLASSES, DEMO_KAKAO_USER, LEARNING_BY_USER, PARENT_CHILDREN } from './fixtures';
import type { Account, AcademyClass, LearningItem, Role } from './types';

export {
  ACCOUNTS,
  ACADEMY_CLASSES,
  ASSIGNMENTS_SEED,
  DEMO_KAKAO_USER,
  DEMO_PASSWORD,
  DEMO_PHONE_CODE,
} from './fixtures';
export { SEED_CONTENT } from './content';
export { assignmentHistory } from './assignmentHistory';
export { ATTEMPTS_SEED, WRONG_NOTES_SEED, type SeededAttempt, type SeededNote } from './attempts';

// 계정이 4,000명대라 조회는 인덱스로 한다.
const ACCOUNT_BY_ID = new Map(ACCOUNTS.map((a) => [a.userId, a]));

export function getAccount(userId: string): Account | undefined {
  return ACCOUNT_BY_ID.get(userId);
}

export function getAccountsByRole(role: Role): Account[] {
  return ACCOUNTS.filter((a) => a.roles.includes(role));
}

/** 스코디 아이디+비밀번호 검증(시드 픽스처). 성공 시 계정을 반환. */
export function authenticate(scodyId: string, password: string): Account | undefined {
  const id = scodyId.trim().toLowerCase();
  const account = ACCOUNTS.find((a) => a.scodyId.toLowerCase() === id);
  if (!account || account.password !== password) return undefined;
  return account;
}

/** 휴대폰 번호로 시드 계정을 찾는다. 번호가 없는 로스터 계정은 조회되지 않는다. */
export function authenticateByPhone(phone: string): Account | undefined {
  const key = phone.replace(/\D/g, '');
  if (!key) return undefined;
  return ACCOUNTS.find((a) => a.phone && a.phone.replace(/\D/g, '') === key);
}

/** '카카오로 계속하기' 데모: 카카오 연결 계정. */
export function signInWithKakaoDemo(): Account | undefined {
  return getAccount(DEMO_KAKAO_USER);
}

export function getLearningItems(userId: string): readonly LearningItem[] {
  return LEARNING_BY_USER[userId] ?? [];
}

/** 시드에 이미 있는 스코디 아이디인지. */
export function isScodyIdTaken(scodyId: string): boolean {
  const id = scodyId.trim().toLowerCase();
  return ACCOUNTS.some((a) => a.scodyId.toLowerCase() === id);
}

/** 학부모의 연결된 자녀 계정들. */
export function getChildren(parentId: string): Account[] {
  return (PARENT_CHILDREN[parentId] ?? []).map((id) => getAccount(id)).filter(Boolean) as Account[];
}

/** 원장은 학원 전체 반, 선생님은 담당 반만 본다(권한 경계). */
export function getClassesForAccount(account: Account): AcademyClass[] {
  const all = ACADEMY_CLASSES.filter((c) => c.academyName === account.academyName);
  if (account.academyRole === 'director') return all;
  return all.filter((c) => c.teacherId === account.userId);
}

export function getClass(classId: string): AcademyClass | undefined {
  return ACADEMY_CLASSES.find((c) => c.id === classId);
}

/** 학생이 속한 반들. */
export function getStudentClasses(userId: string): AcademyClass[] {
  return ACADEMY_CLASSES.filter((c) => c.studentIds.includes(userId));
}

export function getStudentsInClass(classId: string): Account[] {
  const c = getClass(classId);
  if (!c) return [];
  return c.studentIds.map((id) => getAccount(id)).filter(Boolean) as Account[];
}

export function getTeachersForAcademy(academyName: string): Account[] {
  return ACCOUNTS.filter((a) => a.roles.includes('academy') && a.academyName === academyName);
}
