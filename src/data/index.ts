import {
  ACCOUNTS,
  INVITES,
  LEARNING_BY_USER,
  PARENT_CHILDREN,
  ACADEMY_CLASSES,
  DEMO_KAKAO_USER,
} from './fixtures';
import type { Account, ContentSet, Invite, LearningItem, Role } from './types';

export * from './types';
export {
  ACCOUNTS,
  INVITES,
  DEMO_PASSWORD,
  DEMO_PHONE_CODE,
  DEMO_KAKAO_USER,
  ACADEMY_CLASSES,
  ASSIGNMENTS_SEED,
} from './fixtures';
export { SEED_CONTENT } from './content';
export { GRADES, AREAS, TOPICS, topicsFor, gradeLabel } from './taxonomy';

// 계정이 1000명대라 조회는 인덱스로 한다(반 상세에서 학생마다 조회한다).
const ACCOUNT_BY_ID = new Map(ACCOUNTS.map((a) => [a.userId, a]));

export function getAccount(userId: string): Account | undefined {
  return ACCOUNT_BY_ID.get(userId);
}

export function getAccountsByRole(role: Role): Account[] {
  return ACCOUNTS.filter((a) => a.roles.includes(role));
}

/** 스코디 아이디+비밀번호 검증(프로토타입). 성공 시 계정을 반환. */
export function authenticate(scodyId: string, password: string): Account | undefined {
  const id = scodyId.trim().toLowerCase();
  const account = ACCOUNTS.find((a) => a.scodyId.toLowerCase() === id);
  if (!account || account.password !== password) return undefined;
  return account;
}

/** 번호 비교용 정규화. 하이픈·공백 차이로 로그인이 실패하지 않게 숫자만 남긴다. */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * 휴대폰 번호로 계정을 찾는다(프로토타입). 인증번호 검증은 `DEMO_PHONE_CODE`로 대체한다.
 * 번호가 없는 로스터 계정은 조회되지 않는다.
 */
export function authenticateByPhone(phone: string): Account | undefined {
  const key = normalizePhone(phone);
  if (!key) return undefined;
  return ACCOUNTS.find((a) => a.phone && normalizePhone(a.phone) === key);
}

/** 이미 가입된 번호인지(중복 가입 방지). */
export function isPhoneTaken(phone: string): boolean {
  return authenticateByPhone(phone) != null;
}

/** '카카오로 계속하기' 데모: 카카오 연결 계정으로 로그인. */
export function signInWithKakaoDemo(): Account | undefined {
  return getAccount(DEMO_KAKAO_USER);
}

export function getInvite(token: string): Invite | undefined {
  return INVITES.find((i) => i.token.toLowerCase() === token.trim().toLowerCase());
}

export function getLearningItems(userId: string): readonly LearningItem[] {
  return LEARNING_BY_USER[userId] ?? [];
}

/** 콘텐츠 세트를 id로 찾는다(시드 + 총괄관리자 등록분). */
export function findContent(sets: readonly ContentSet[], id: string): ContentSet | undefined {
  return sets.find((s) => s.id === id);
}

/** 공개된 콘텐츠 세트를 학생 개인 학습 항목으로 변환. */
export function contentToPersonalItem(set: ContentSet): LearningItem {
  return {
    id: `li_${set.id}`,
    source: 'personal',
    subject: set.subject,
    area: set.area,
    title: set.title,
    contentId: set.id,
    questionCount: set.questions.length,
    status: 'todo',
  };
}

/** 학생에게 공개된 개인 학습 목록(공개 콘텐츠에서 파생). */
export function personalItems(sets: readonly ContentSet[]): LearningItem[] {
  return sets.filter((s) => s.publishToStudents).map(contentToPersonalItem);
}

/** 이미 사용 중인 스코디 아이디인지(중복 계정 방지). */
export function isScodyIdTaken(scodyId: string): boolean {
  const id = scodyId.trim().toLowerCase();
  return ACCOUNTS.some((a) => a.scodyId.toLowerCase() === id);
}

/** 신규 가입 계정 생성(프로토타입: 메모리 전용). */
export function makeAccount(input: {
  name: string;
  scodyId: string;
  password: string;
  roles: import('./types').Role[];
  academyName?: string;
  /** 휴대폰으로 가입한 경우의 번호. 카카오로 가입하면 비어 있다. */
  phone?: string;
  kakaoLinked?: boolean;
}): Account {
  const roles = input.roles;
  return {
    userId: `u_new_${input.scodyId.trim().toLowerCase()}`,
    name: input.name.trim(),
    scodyId: input.scodyId.trim(),
    phone: input.phone?.trim() || undefined,
    kakaoLinked: input.kakaoLinked,
    password: input.password,
    roles,
    academyRole: roles.includes('academy') ? 'director' : undefined,
    academyName: roles.includes('academy') ? input.academyName?.trim() || undefined : undefined,
    entitlements: [],
  };
}

/** 학부모의 연결된 자녀 계정들. */
export function getChildren(parentId: string): Account[] {
  return (PARENT_CHILDREN[parentId] ?? []).map((id) => getAccount(id)).filter(Boolean) as Account[];
}

export interface ChildSummary {
  incomplete: number;
  recentAccuracy: number | null;
  repeatWrong: number; // 정답률 80% 미만으로 완료한 학습 수
}

/** 자녀 학습 요약(학부모 리포트용). */
export function getChildSummary(childId: string): ChildSummary {
  const items = getLearningItems(childId);
  const done = items.filter((i) => i.status === 'done' && i.accuracy != null);
  const incomplete = items.filter((i) => i.status !== 'done').length;
  const recentAccuracy = done.length
    ? Math.round(done.reduce((a, i) => a + (i.accuracy ?? 0), 0) / done.length)
    : null;
  const repeatWrong = done.filter((i) => (i.accuracy ?? 100) < 80).length;
  return { incomplete, recentAccuracy, repeatWrong };
}

/** 원장은 학원 전체 반, 선생님은 담당 반만 본다(권한 경계). */
export function getClassesForAccount(account: Account): import('./types').AcademyClass[] {
  const all = ACADEMY_CLASSES.filter((c) => c.academyName === account.academyName);
  if (account.academyRole === 'director') return all;
  return all.filter((c) => c.teacherId === account.userId);
}

export function getClass(classId: string): import('./types').AcademyClass | undefined {
  return ACADEMY_CLASSES.find((c) => c.id === classId);
}

/** 학생이 속한 반들. */
export function getStudentClasses(userId: string): import('./types').AcademyClass[] {
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

export interface SubmissionStat {
  submitted: number;
  total: number;
  avgAccuracy: number | null;
}

export function submissionStat(a: import('./types').Assignment): SubmissionStat {
  const total = a.submissions.length;
  const done = a.submissions.filter((s) => s.submitted);
  const avg = done.length
    ? Math.round(done.reduce((x, s) => x + (s.accuracy ?? 0), 0) / done.length)
    : null;
  return { submitted: done.length, total, avgAccuracy: avg };
}
