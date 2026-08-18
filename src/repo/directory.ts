import type { AcademyClass, Account, Invite } from '@/data/types';
import { errorMessage, supabase } from '@/lib/supabase';
import { toAccount, toClass, toInvite } from './mappers';

/**
 * 사람·학원·반 스냅샷.
 *
 * ## 왜 스냅샷인가
 *
 * 화면 20여 곳이 `getAccount(id)`·`getClass(id)`·`getStudentsInClass(id)`·`getChildren(id)`를
 * **동기로** 부른다. 전부 async로 바꾸면 화면 57개에 로딩·오류 상태가 들어간다. 대신 로그인
 * 직후 한 번 읽어 두고 동기 조회를 그대로 유지한다.
 *
 * ## 범위를 반드시 좁힌다
 *
 * **"전부 읽기"를 하지 않는다.** RLS가 이미 내가 볼 수 있는 것만 주지만, 운영자로 로그인하면
 * 그게 전체 계정이다. 프로토타입이 브라우저에서 4,186개 계정을 훑던 자리로 돌아가지 않으려고,
 * 운영자에게는 이 스냅샷을 **만들지 않는다**(`loadDirectory`의 `admin` 분기) — 운영자 화면은
 * 목록마다 페이지 단위로 따로 조회한다.
 */

export interface AcademyInfo {
  id: string;
  name: string;
  contractSeats: number;
  renewalDate?: string;
  status: 'active' | 'churned';
  createdAt: string;
}

export interface Directory {
  me: Account;
  /** 내가 볼 수 있는 사람. `userId` → `Account`. 나 자신도 들어 있다. */
  people: Map<string, Account>;
  /** 교직원으로 속한 학원. 학생·학부모에게는 없다. */
  academy?: AcademyInfo;
  /** 내가 볼 수 있는 반(원장은 학원 전체, 선생님은 담당 반). 학생은 자기 반. */
  classes: AcademyClass[];
  /** 학부모의 자녀 `userId`. 승인된 연결만. */
  childIds: string[];
  /**
   * 운영자 여부. 참이면 `people`·`classes`는 **비어 있다** — 전체를 담지 않는다.
   * 운영자 화면은 목록마다 따로 조회한다.
   */
  isAdmin: boolean;
}

interface ProfileRow {
  id: string;
  name: string;
  scody_id: string;
  phone: string | null;
  grade: number | null;
  kakao_linked: boolean;
  created_at: string;
  support_code: string;
}

interface EntitlementRow {
  user_id: string;
  kind: string;
  payer: string;
  label: string;
  started_on: string;
  canceled_at: string | null;
}

/**
 * 내 역할만 먼저 읽는다.
 *
 * 스냅샷을 얼마나 크게 읽을지 정하려면 운영자인지를 먼저 알아야 하는데, 그걸 알려면 역할을
 * 읽어야 한다. `user_roles`의 본인 행은 언제나 열려 있어서 이 질의는 값싸다.
 */
export async function loadSelfRoles(uid: string): Promise<string[]> {
  const { data, error } = await supabase()
    .from('user_roles')
    .select('role')
    .eq('user_id', uid);
  if (error) throw new Error(errorMessage(error));
  return (data ?? []).map((r) => r.role);
}

/**
 * 계정 기준 스냅샷을 읽는다.
 *
 * 질의는 병렬로 던진다 — 서로 의존하지 않고, 원격 DB라 왕복이 곧 로딩 시간이다.
 * 각 질의는 RLS가 걸러 주므로 `where`를 손으로 적지 않는다(경계를 두 곳에 두지 않는다).
 *
 * `uid`는 **화면이 보여 줄 사람**이다. 대리 보기 중에는 대상 계정이 온다 — 운영자 권한으로
 * 읽되 그 사람 기준으로 스냅샷을 조립한다.
 *
 * **운영자에게는 이 함수를 쓰지 않는다**(`minimal`). RLS가 운영자에게 전체 계정을 주기 때문에,
 * 프로토타입이 브라우저에서 4,186개 계정을 훑던 자리로 그대로 돌아간다. 운영자 화면은 목록마다
 * 페이지 단위로 따로 조회한다. 대리 보기 중에는 대상의 화면을 그려야 하므로 전체를 읽는다.
 */
export async function loadDirectory(
  uid: string,
  opts: { minimal?: boolean } = {},
): Promise<Directory> {
  const db = supabase();

  if (opts.minimal) {
    const [profile, roles] = await Promise.all([
      db
        .from('profiles')
        .select('id, name, scody_id, phone, grade, kakao_linked, created_at, support_code')
        .eq('id', uid)
        .single(),
      db.from('user_roles').select('role').eq('user_id', uid),
    ]);
    if (profile.error) throw new Error(errorMessage(profile.error));
    if (roles.error) throw new Error(errorMessage(roles.error));
    const me = toAccount({
      ...(profile.data as ProfileRow),
      roles: (roles.data ?? []).map((r) => r.role),
      entitlements: [],
    });
    return {
      me,
      people: new Map([[me.userId, me]]),
      classes: [],
      childIds: [],
      isAdmin: me.roles.includes('admin'),
    };
  }

  const [profiles, roles, members, academies, classes, classStudents, children, entitlements] =
    await Promise.all([
      db.from('profiles').select('id, name, scody_id, phone, grade, kakao_linked, created_at, support_code'),
      db.from('user_roles').select('user_id, role'),
      db.from('academy_members').select('academy_id, user_id, member_role').is('left_at', null),
      db.from('academies').select('id, name, contract_seats, renewal_date, status, created_at'),
      db.from('classes').select('id, academy_id, name, grade, teacher_id').is('archived_at', null),
      db.from('class_students').select('class_id, student_id').is('removed_at', null),
      db.from('parent_children').select('parent_id, student_id').eq('status', 'linked'),
      db.from('entitlements').select('user_id, kind, payer, label, started_on, canceled_at'),
    ]);

  for (const r of [profiles, roles, members, academies, classes, classStudents, children, entitlements]) {
    if (r.error) throw new Error(errorMessage(r.error));
  }

  const roleByUser = new Map<string, string[]>();
  for (const r of roles.data ?? []) {
    roleByUser.set(r.user_id, [...(roleByUser.get(r.user_id) ?? []), r.role]);
  }

  const entitlementsByUser = new Map<string, EntitlementRow[]>();
  for (const e of (entitlements.data ?? []) as EntitlementRow[]) {
    entitlementsByUser.set(e.user_id, [...(entitlementsByUser.get(e.user_id) ?? []), e]);
  }

  const academyById = new Map((academies.data ?? []).map((a) => [a.id, a] as const));
  /**
   * 사람 → 소속 학원. 학생도 교직원도 같은 표에서 온다.
   *
   * **서버와 같은 순서로 접는다.** 한 사람이 여러 학원에 속하면 `Map`은 마지막 행만 남기는데,
   * PostgREST는 `order`가 없으면 순서를 보장하지 않아 **어느 학원이 이길지 호출마다 달라질 수
   * 있었다.** 서버는 그 모호함을 `my_academy_id()`에서 이미 없앴다 —
   * `order by (member_role = 'director') desc, joined_at, academy_id`(0024). 같은 규칙을 쓴다.
   * (지금 seed에는 다중 소속 계정이 없어 결과는 그대로다.)
   */
  const RANK: Record<string, number> = { director: 0, teacher: 1, student: 2 };
  const memberByUser = new Map(
    [...(members.data ?? [])]
      .sort(
        (a, b) =>
          (RANK[a.member_role] ?? 9) - (RANK[b.member_role] ?? 9) ||
          a.academy_id.localeCompare(b.academy_id),
      )
      .reverse()
      .map((m) => [m.user_id, m] as const),
  );

  const people = new Map<string, Account>();
  for (const p of (profiles.data ?? []) as ProfileRow[]) {
    const member = memberByUser.get(p.id);
    const academy = member ? academyById.get(member.academy_id) : undefined;
    people.set(
      p.id,
      toAccount({
        ...p,
        roles: roleByUser.get(p.id) ?? [],
        academyName: academy?.name,
        // 학생 소속은 `academyRole`을 만들지 않는다 — 그 값은 원장·선생님만의 구분이다.
        academyRole:
          member && member.member_role !== 'student'
            ? (member.member_role as 'director' | 'teacher')
            : undefined,
        entitlements: entitlementsByUser.get(p.id) ?? [],
      }),
    );
  }

  const me = people.get(uid);
  if (!me) {
    throw new Error('내 프로필을 찾을 수 없어요. 다시 로그인해 주세요.');
  }

  const studentsByClass = new Map<string, string[]>();
  for (const cs of classStudents.data ?? []) {
    studentsByClass.set(cs.class_id, [...(studentsByClass.get(cs.class_id) ?? []), cs.student_id]);
  }

  const myMember = memberByUser.get(uid);
  const myAcademyRow = myMember && myMember.member_role !== 'student'
    ? academyById.get(myMember.academy_id)
    : undefined;

  const isAdmin = me.roles.includes('admin');

  return {
    me,
    people,
    academy: myAcademyRow
      ? {
          id: myAcademyRow.id,
          name: myAcademyRow.name,
          contractSeats: myAcademyRow.contract_seats,
          renewalDate: myAcademyRow.renewal_date ?? undefined,
          status: myAcademyRow.status as 'active' | 'churned',
          createdAt: myAcademyRow.created_at.slice(0, 10),
        }
      : undefined,
    classes: (classes.data ?? []).map((c) =>
      toClass(c, academyById.get(c.academy_id)?.name ?? '', studentsByClass.get(c.id) ?? []),
    ),
    childIds: (children.data ?? [])
      .filter((c) => c.parent_id === uid)
      .map((c) => c.student_id),
    isAdmin,
  };
}

/** 고객지원 코드. 프로토타입은 `userId` 해시로 파생했지만 지금은 저장된 값이다. */
export async function supportCodeOf(userId: string): Promise<string | undefined> {
  const { data, error } = await supabase()
    .from('profiles')
    .select('support_code')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(errorMessage(error));
  return data?.support_code ?? undefined;
}

// ── 가입 화면의 중복 검사 ────────────────────────────────────────────────────
//
// 예전에는 번들에 실린 픽스처 배열(`ACCOUNTS` 4,186개)을 뒤져서, 합성 로스터 번호를
// `이미 가입된 번호예요`라고 말하고 실제 `profiles`의 번호는 통과시켰다. 이제 서버가 답한다
// (`rpc_signup_phone_taken`·`rpc_signup_scody_id_taken`, 0025).
//
// **모른다와 비어 있다를 가르는 이유:** 조회가 실패했을 때 `false`로 떨어지면 화면이
// "쓸 수 있는 번호예요"라고 **틀린 말**을 한다. 그래서 실패는 `null`로 돌려주고, 화면은
// 검사하지 못했다는 사실을 말한다.

/** 이 번호로 만든 프로필이 있는지. 조회 자체가 실패하면 `null`(모른다). */
export async function isPhoneTaken(phone: string): Promise<boolean | null> {
  try {
    const { data, error } = await supabase().rpc('rpc_signup_phone_taken', { p_phone: phone });
    if (error) return null;
    return data === true;
  } catch {
    // 설정이 없으면 `supabase()`가 던진다.
    return null;
  }
}

/** 이 스코디 아이디를 쓰는 프로필이 있는지. 조회 자체가 실패하면 `null`(모른다). */
export async function isScodyIdTaken(scodyId: string): Promise<boolean | null> {
  try {
    const { data, error } = await supabase().rpc('rpc_signup_scody_id_taken', {
      p_scody_id: scodyId,
    });
    if (error) return null;
    return data === true;
  } catch {
    return null;
  }
}

// ── 학원 인사·반 관리(원장) ──────────────────────────────────────────────────
//
// 규칙은 RLS가 강제한다(`classes_write`·`class_students_write`: 원장만). 여기서는 화면이 쓰던
// `{ ok, error }` 계약에 맞춰 결과를 돌려준다.

export interface WriteResult {
  ok: boolean;
  error?: string;
}

function ok(): WriteResult {
  return { ok: true };
}

function fail(error: unknown): WriteResult {
  return { ok: false, error: errorMessage(error) };
}

export async function createClass(input: {
  academyId: string;
  name: string;
  teacherId?: string;
  grade?: number;
}): Promise<WriteResult & { id?: string }> {
  const { data, error } = await supabase()
    .from('classes')
    .insert({
      academy_id: input.academyId,
      name: input.name.trim(),
      teacher_id: input.teacherId || null,
      grade: input.grade ?? null,
    })
    .select('id')
    .single();
  if (error) {
    // 같은 이름의 반은 부분 유니크 인덱스가 막는다(살아 있는 반끼리만).
    if (/duplicate key/i.test(String((error as { message?: string }).message))) {
      return { ok: false, error: '같은 이름의 반이 이미 있어요.' };
    }
    return fail(error);
  }
  return { ok: true, id: data.id };
}

export async function renameClass(classId: string, name: string): Promise<WriteResult> {
  const { error } = await supabase().from('classes').update({ name: name.trim() }).eq('id', classId);
  if (error) {
    if (/duplicate key/i.test(String((error as { message?: string }).message))) {
      return { ok: false, error: '같은 이름의 반이 이미 있어요.' };
    }
    return fail(error);
  }
  return ok();
}

/** 폐강. **삭제가 아니다** — 배정·제출 기록은 그대로 남는다(D-013). */
export async function archiveClass(classId: string): Promise<WriteResult> {
  const { error } = await supabase()
    .from('classes')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', classId);
  return error ? fail(error) : ok();
}

export async function setClassTeacher(classId: string, teacherId: string): Promise<WriteResult> {
  const { error } = await supabase()
    .from('classes')
    .update({ teacher_id: teacherId || null })
    .eq('id', classId);
  return error ? fail(error) : ok();
}

/**
 * 반에 학생을 넣는다. 이미 있었다가 빠진 학생은 `removed_at`을 비워 되살린다 —
 * 새 행을 넣으면 PK가 충돌한다.
 */
export async function addStudentsToClass(
  classId: string,
  studentIds: readonly string[],
): Promise<WriteResult> {
  if (studentIds.length === 0) return { ok: false, error: '추가할 학생을 고르지 못했어요.' };
  const { error } = await supabase()
    .from('class_students')
    .upsert(
      studentIds.map((id) => ({ class_id: classId, student_id: id, removed_at: null })),
      { onConflict: 'class_id,student_id' },
    );
  return error ? fail(error) : ok();
}

/** 반에서 뺀다. 행은 남는다 — 그 학생이 이 반에서 낸 제출의 근거다. */
export async function removeStudentFromClass(
  classId: string,
  studentId: string,
): Promise<WriteResult> {
  const { error } = await supabase()
    .from('class_students')
    .update({ removed_at: new Date().toISOString() })
    .eq('class_id', classId)
    .eq('student_id', studentId);
  return error ? fail(error) : ok();
}

/** 초대 대상 역할. 서버의 `invite_role` enum과 같은 값이다(0001). */
export type InviteeRole = 'student' | 'parent' | 'teacher';

export interface CreateInviteInput {
  academyId: string;
  invitee: InviteeRole;
  /**
   * 학부모 초대의 대상 학생(`userId`).
   *
   * **학부모 초대에만 넣는다.** 학원이 자녀 관계를 확인하는 자리가 여기다(확정 정책 3절) —
   * 수락하면 이 학생과 연결이 생긴다. 다른 역할에 넣으면 서버가 거부하고, 학부모 초대에
   * 빼면 역시 거부한다(`rpc_create_invite`, 0036).
   */
  targetStudentId?: string;
}

/**
 * 학원 초대를 만든다.
 *
 * **프로토타입의 `addTeacher`를 대체한다.** 그 함수는 이름과 아이디만으로 로그인할 수 없는
 * 가짜 계정을 메모리에 만들었는데, 실제 인증에서는 `auth.users` 없이 프로필을 만들 수 없다.
 * 마스터 플랜 3절도 "원장이 선생님을 **초대**하면 소속과 역할을 승인한다"고 정한다.
 *
 * **역할이 리터럴이 아니라 인자다.** 예전에는 이 함수가 `p_invitee_role: 'teacher'`를 박아 두어,
 * 3절이 정한 학생·학부모 초대를 만들 길이 앱 전체에 없었다 — 그런데 초대 목록은 그 두 종류를
 * 표시할 준비만 해 두었고(`INVITE_LABEL`), 학부모 화면들은 없는 자녀 연결을 가리켰다.
 *
 * 토큰은 사람이 읽고 전달할 수 있는 형태로 만든다.
 */
export async function createInvite(
  input: CreateInviteInput,
): Promise<WriteResult & { token?: string }> {
  /*
    **토큰은 서버가 만든다**(`rpc_create_invite`, 0027). 예전에는 이 자리에서
    `Math.random().toString(36).slice(2, 8)`로 만들었다 — base36 6자(≈2.2×10⁹)에 암호용이
    아닌 난수였고, `expires_at`·`inviter_id`를 쓰지 않아 **기간 없는 초대**가 남았다.

    그 토큰은 `rpc_accept_invite`의 유일한 자격 증명이고(소속과 `academy` 역할이, 학부모
    초대에서는 자녀 연결이 함께 붙는다), `rpc_invite_info`는 초대 링크가 로그인 전에 열려야
    해서 일부러 anon이 부를 수 있다. 추측을 확인할 창구가 열려 있으므로 엔트로피는 서버에 있어야
    한다.

    권한도 서버가 판단한다 — 원장은 자기 학원만, 대상 학생은 **우리 학원 재적 학생**만이다
    (`rpc_create_invite`의 소속 검사). 화면의 검사는 말할 문장을 만들기 위한 것이다.
  */
  const { data, error } = await supabase().rpc('rpc_create_invite', {
    p_academy_id: input.academyId,
    p_invitee_role: input.invitee,
    // 대상 학생은 학부모 초대에만 보낸다. 다른 역할에 실어 보내면 서버가 거부한다(0036).
    ...(input.invitee === 'parent' ? { p_target_student: input.targetStudentId } : {}),
  });
  if (error) return fail(error);
  if (!data) return { ok: false, error: '초대 링크를 만들지 못했어요.' };
  return { ok: true, token: data };
}

/**
 * 선생님을 초대한다. `useAcademyStaff().addTeacher`가 이 이름으로 부른다 —
 * 역할을 인자로 받게 바꾼 뒤에도 기존 호출부가 그대로 동작하게 남긴다.
 */
export async function inviteTeacher(academyId: string): Promise<WriteResult & { token?: string }> {
  return createInvite({ academyId, invitee: 'teacher' });
}

/** 초대 상태. 아직 전달해서 쓸 수 있는 초대만 `pending`이다. */
export type InviteStatus = 'pending' | 'accepted' | 'expired';

export interface AcademyInvite {
  token: string;
  /** 초대 대상 역할. */
  invitee: InviteeRole;
  status: InviteStatus;
  createdAt: string;
  /**
   * 학부모 초대의 대상 학생(`userId`). 학부모 초대에만 있다.
   *
   * 이 컬럼이 생기기 전에 만든 학부모 초대(개발 seed의 초대가 그렇다)는 비어 있다 — 그 초대는
   * 서버가 예전처럼 수락을 거부한다(`rpc_accept_invite`). 화면은 두 경우를 구분해 말한다.
   */
  targetStudentId?: string;
}

/**
 * 우리 학원 초대 목록.
 *
 * **프로토타입은 `INVITES` fixture 3개를 보여 줬다.** 그 토큰은 한빛학원에만 붙어 있어서 다른
 * 학원은 아무것도 볼 수 없었고, 원장이 방금 만든 초대(`inviteTeacher`)는 목록에 나타나지 않았다.
 *
 * 권한은 RLS가 강제한다(`invites_select`: 자기 학원 또는 운영자). `academy_id`를 함께 적는 것은
 * 권한 검사가 아니라 **범위 좁히기**다 — 운영자 권한으로 읽을 때 남의 학원 초대까지 오지 않게 한다.
 */
export async function loadInvites(academyId: string): Promise<AcademyInvite[]> {
  const { data, error } = await supabase()
    .from('invites')
    .select('token, invitee_role, target_student_id, expires_at, accepted_at, created_at')
    .eq('academy_id', academyId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(errorMessage(error));
  const now = Date.now();
  const rows: AcademyInvite[] = (data ?? []).map((r) => ({
    token: r.token,
    invitee: r.invitee_role,
    status: r.accepted_at
      ? 'accepted'
      : r.expires_at && Date.parse(r.expires_at) < now
        ? 'expired'
        : 'pending',
    createdAt: r.created_at,
    targetStudentId: r.target_student_id ?? undefined,
  }));
  /*
    아직 전달할 수 있는 초대가 위로 온다 — 원장이 이 화면에 오는 이유가 그것이다.
    `sort`는 안정 정렬이라 같은 상태 안에서는 위 `order`의 최근순이 그대로 남는다.
  */
  return rows.sort(
    (a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'),
  );
}

/** 선생님을 학원에서 제외한다. 담당 반은 미배정으로 남는다(반 행의 `teacher_id`는 그대로). */
export async function removeMember(academyId: string, userId: string): Promise<WriteResult> {
  const { error } = await supabase()
    .from('academy_members')
    .update({ left_at: new Date().toISOString() })
    .eq('academy_id', academyId)
    .eq('user_id', userId);
  return error ? fail(error) : ok();
}

// ── 초대 확인·수락(초대 링크로 들어온 사람) ─────────────────────────────────
//
// `invites` 표는 익명에게 닫혀 있고(`invites_select`: 자기 학원 또는 운영자), 초대 링크를 받은
// 사람은 아직 그 학원 사람이 아니다. 그래서 두 함수 모두 `security definer` RPC를 거친다 —
// 토큰을 아는 사람에게 **학원 이름과 대상 역할만** 준다(`0013_functions.sql`).

/** 초대 링크 조회 결과. `status`로 화면이 무엇을 말할지 정한다. */
export interface InviteLookup {
  /**
   * - `pending`: 아직 쓸 수 있는 초대다. 수락으로 이어진다.
   * - `accepted`·`expired`: 초대는 있지만 쓸 수 없다. 두 경우를 구분해 말한다.
   * - `missing`: 그런 토큰이 없다(잘못된 링크).
   * - `failed`: 조회 자체를 못 했다. `error`에 이유가 있다 — **`missing`과 섞지 않는다.**
   */
  status: InviteStatus | 'missing' | 'failed';
  /** 토큰이 실제로 있을 때만 채운다. */
  invite?: Invite;
  error?: string;
}

/**
 * 토큰이 가리키는 초대를 읽는다. **로그인 전에도 부를 수 있다.**
 *
 * 예외를 던지지 않는다 — 부르는 쪽이 초대 링크 화면 하나뿐이고, 그 화면은 `없는 초대`와
 * `조회 실패`를 다르게 말해야 한다. 던지면 두 경우가 한 `catch`에서 합쳐진다.
 */
export async function inviteInfo(token: string): Promise<InviteLookup> {
  const value = token.trim();
  if (!value) return { status: 'missing' };
  try {
    const { data, error } = await supabase().rpc('rpc_invite_info', { p_token: value });
    if (error) return { status: 'failed', error: errorMessage(error) };
    // 없는 토큰이면 함수가 `null`을 준다(질의 결과가 0행).
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { status: 'missing' };
    const row = data as unknown as {
      token: string;
      academy_name: string;
      invitee_role: string;
      accepted: boolean;
      expired: boolean;
    };
    const invite = toInvite(row);
    if (row.accepted) return { status: 'accepted', invite };
    if (row.expired) return { status: 'expired', invite };
    return { status: 'pending', invite };
  } catch (e) {
    // 설정이 없으면 `supabase()`가 던진다. 화면이 그 문장을 그대로 보여 준다.
    return { status: 'failed', error: errorMessage(e) };
  }
}

/**
 * 초대를 수락한다. 학생·선생님 초대는 `academy_members`에 소속이 생기고 역할이 붙는다
 * (`rpc_accept_invite`). 이미 있는 계정에 **소속만** 추가한다 — 이용권은 건드리지 않는다.
 *
 * 학부모 초대는 소속이 아니라 **자녀 연결**이다. 대상 학생이 적힌 초대(0036 이후에 만든 것)는
 * 그 학생과의 연결이 생기고, 대상 학생이 없는 옛 초대는 서버가 예전처럼 거부한다
 * (`학부모 초대는 자녀 확인이 필요해요.`). 그 문장도 사용자에게 보여 줄 말이라 `errorMessage`가
 * 그대로 넘긴다.
 *
 * 소속이 화면에 나타나려면 세션 스냅샷을 다시 읽어야 한다(`useSession().reload`).
 */
export async function acceptInvite(token: string): Promise<WriteResult & { academyId?: string }> {
  const { data, error } = await supabase().rpc('rpc_accept_invite', { p_token: token.trim() });
  return error ? fail(error) : { ok: true, academyId: data ?? undefined };
}
