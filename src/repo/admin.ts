import type { AcademyClass, Account, Grade } from '@/data/types';
import { errorMessage, supabase } from '@/lib/supabase';
import { toAccount } from './mappers';

/**
 * 운영자용 조회.
 *
 * ## 왜 따로 두는가
 *
 * 세션 스냅샷(`src/repo/directory.ts`)은 **내 범위만** 담는다. 운영자는 전체를 봐야 하지만 그것을
 * 세션 스냅샷에 넣으면 프로토타입이 브라우저에서 4천 개 계정을 훑던 자리로 돌아간다. 그래서
 * 운영자 화면이 필요할 때만 이 함수를 부르고, **상한을 둔다.**
 *
 * 권한은 RLS가 정한다 — 운영자가 아니면 자기 것만 나온다. 여기서 다시 역할을 검사하지 않는다.
 */

/** 한 번에 읽는 계정 수 상한. 화면은 검색으로 좁힌다. */
const ACCOUNT_LIMIT = 500;

export interface AdminAccount extends Account {
  /** 마지막 학습 활동일(`YYYY-MM-DD`). 기록이 없으면 `undefined`. */
  lastActiveOn?: string;
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

/**
 * 계정 목록.
 *
 * 마지막 활동일은 `learning_events`에서 사람별 최댓값으로 낸다 — 합성 활동을 파생하던
 * `accountMeta.lastActiveLabelOf` 자리다. 기록이 없으면 값이 없고, 화면이 그대로 말한다.
 */
export async function listAccounts(): Promise<AdminAccount[]> {
  const db = supabase();
  const [profiles, roles, members, academies, entitlements, events] = await Promise.all([
    db
      .from('profiles')
      .select('id, name, scody_id, phone, grade, kakao_linked, created_at, support_code')
      .order('created_at')
      .limit(ACCOUNT_LIMIT),
    db.from('user_roles').select('user_id, role'),
    db.from('academy_members').select('academy_id, user_id, member_role').is('left_at', null),
    db.from('academies').select('id, name'),
    db.from('entitlements').select('user_id, kind, payer, label, started_on, canceled_at'),
    db.from('learning_events').select('student_id, occurred_on').eq('kind', 'answer_saved'),
  ]);
  for (const r of [profiles, roles, members, academies, entitlements, events]) {
    if (r.error) throw new Error(errorMessage(r.error));
  }

  const roleBy = new Map<string, string[]>();
  for (const r of roles.data ?? []) roleBy.set(r.user_id, [...(roleBy.get(r.user_id) ?? []), r.role]);

  const entBy = new Map<string, NonNullable<typeof entitlements.data>>();
  for (const e of entitlements.data ?? []) {
    entBy.set(e.user_id, [...(entBy.get(e.user_id) ?? []), e]);
  }

  const academyName = new Map((academies.data ?? []).map((a) => [a.id, a.name] as const));
  const memberBy = new Map((members.data ?? []).map((m) => [m.user_id, m] as const));

  /** 사람별 마지막 활동일. 같은 사람의 여러 날 중 가장 나중 날만 남긴다. */
  const lastActive = new Map<string, string>();
  for (const e of events.data ?? []) {
    const cur = lastActive.get(e.student_id);
    if (!cur || e.occurred_on > cur) lastActive.set(e.student_id, e.occurred_on);
  }

  return ((profiles.data ?? []) as ProfileRow[]).map((p) => {
    const member = memberBy.get(p.id);
    return {
      ...toAccount({
        ...p,
        roles: roleBy.get(p.id) ?? [],
        academyName: member ? academyName.get(member.academy_id) : undefined,
        academyRole:
          member && member.member_role !== 'student'
            ? (member.member_role as 'director' | 'teacher')
            : undefined,
        entitlements: entBy.get(p.id) ?? [],
      }),
      lastActiveOn: lastActive.get(p.id),
    };
  });
}

/** 그 계정이 속한 반 이름. 계정 상세가 학년을 반에서 읽을 때 쓴다. */
export async function classNamesOf(userId: string): Promise<string[]> {
  const { data, error } = await supabase()
    .from('class_students')
    .select('classes ( name )')
    .eq('student_id', userId)
    .is('removed_at', null);
  if (error) throw new Error(errorMessage(error));
  return (data ?? [])
    .map((r) => (r as unknown as { classes: { name: string } | null }).classes?.name)
    .filter((n): n is string => !!n);
}

/** 학년. 저장된 값이 있으면 그것, 없으면 소속 반 이름에서 읽는다. 학생이 아니면 없다. */
export function gradeOf(account: Account, className?: string): Grade | undefined {
  if (!account.roles.includes('student')) return undefined;
  if (account.grade) return account.grade;
  const fromClass = className?.match(/고([123])/)?.[1];
  return fromClass ? (Number(fromClass) as Grade) : undefined;
}

/**
 * 한 사람의 최근 `weeks`주 주별 활동일 수.
 *
 * 활동 = **그 날 문항 1개 이상 답을 저장한 날**(D-1). `learning_events`에서 센다 —
 * `src/data/activity.ts`가 해시로 합성하던 자리다. 기록이 없으면 전부 0이고, 그것이 사실이다.
 *
 * 학습하지 않는 역할에는 부르지 않는다(화면이 판단한다) — 원장 계정에 주별 활동일 그래프가
 * 생기면 그 사람이 국어 문항을 풀었다는 뜻이 된다.
 */
export interface WeeklyActivity {
  /** 주별 활동일 수. 마지막 칸이 이번 주다. */
  days: number[];
  /** 그중 학습을 끝낸(제출한) 날 수. */
  done: number[];
  dayTotal: number;
  doneTotal: number;
}

export async function weeklyActivity(userId: string, weeks: number): Promise<WeeklyActivity> {
  const since = new Date();
  since.setDate(since.getDate() - (weeks * 7 - 1));
  const from = since.toISOString().slice(0, 10);

  const { data, error } = await supabase()
    .from('learning_events')
    .select('occurred_on, kind')
    .eq('student_id', userId)
    .gte('occurred_on', from);
  if (error) throw new Error(errorMessage(error));

  const days = Array.from({ length: weeks }, () => 0);
  const done = Array.from({ length: weeks }, () => 0);
  /** 같은 날 여러 이벤트를 하루로 센다. */
  const seen = { answered: new Set<string>(), completed: new Set<string>() };

  for (const e of data ?? []) {
    const at = new Date(`${e.occurred_on}T00:00:00`);
    const offset = Math.floor((at.getTime() - since.getTime()) / 86_400_000);
    const week = Math.floor(offset / 7);
    if (week < 0 || week >= weeks) continue;
    const key = `${week}|${e.occurred_on}`;
    if (e.kind === 'answer_saved' && !seen.answered.has(key)) {
      seen.answered.add(key);
      days[week] += 1;
    }
    if (e.kind === 'attempt_submitted' && !seen.completed.has(key)) {
      seen.completed.add(key);
      done[week] += 1;
    }
  }
  return {
    days,
    done,
    dayTotal: days.reduce((a, b) => a + b, 0),
    doneTotal: done.reduce((a, b) => a + b, 0),
  };
}

/* ────────────────────────── 운영자 지표 원천 ────────────────────────── */

/**
 * 지표의 창(일).
 *
 * **여기 두는 이유**: 질의가 이 값으로 날짜 하한을 만들고, 지표 사전이 같은 값을 화면에서
 * 말한다. 두 곳에 적으면 화면이 `28일`이라고 하면서 21일치를 세는 일이 생긴다.
 * `src/features/adminMetrics.ts`가 이 값을 다시 내보낸다 — 화면은 그쪽만 import한다.
 */
export const MAU_WINDOW_DAYS = 28;
/** 이탈 판정 창. 7·14일로 두면 방학·시험 주가 이탈로 잡힌다. */
export const CHURN_WINDOW_DAYS = 28;
/** 주간 지표(WAU·WAL)의 창. */
export const WEEK_DAYS = 7;

/** `days`일 전 날짜(`YYYY-MM-DD`). 로컬 시간대 기준이다(`todayISO()`와 같은 규칙). */
export function daysAgoISO(days: number): string {
  const at = new Date();
  at.setDate(at.getDate() - days);
  const m = `${at.getMonth() + 1}`.padStart(2, '0');
  const d = `${at.getDate()}`.padStart(2, '0');
  return `${at.getFullYear()}-${m}-${d}`;
}

/**
 * 운영자 개요.
 *
 * `rpc_admin_overview()`가 주는 값을 그대로 담는다 — **집계는 서버가 한다.** 프로토타입은
 * 4천 개 계정을 브라우저에서 훑었고, 그 자리로 돌아가지 않으려고 화면은 결과만 받는다.
 *
 * `mau`·`wau`·`completed28`은 **활동 기록이 아직 없으면 `null`이다**(0이 아니다). "활동이
 * 없다"와 "아직 모른다"는 다른 말이라 화면이 갈라서 말한다.
 */
export interface AdminOverview {
  /** 서버가 본 오늘(KST). 화면 첫 줄이 기준을 밝힐 때 쓴다. */
  asOf: string;
  /** 활동 기록이 시작된 날. 없으면 `undefined` — 아직 아무 기록도 없다. */
  eventsSince?: string;
  accounts: number;
  students: number;
  parents: number;
  academyStaff: number;
  academies: number;
  academiesChurned: number;
  classes: number;
  contentSets: number;
  contentPublished: number;
  personalActive: number;
  personalCanceled: number;
  attemptsTotal: number;
  /** 28일 rolling 활성. 기록이 없으면 `null`. */
  mau: number | null;
  /** 7일 활성. `rpc_admin_overview`의 `wal` 필드가 이 정의다(필드 이름과 뜻이 어긋나 있다). */
  wau: number | null;
  /** 28일 안에 학습을 완료한 학생 수. */
  completed28: number | null;
}

export async function adminOverview(): Promise<AdminOverview> {
  const { data, error } = await supabase().rpc('rpc_admin_overview');
  if (error) throw new Error(errorMessage(error));
  const r = data as {
    as_of: string;
    events_since: string | null;
    accounts: number;
    students: number;
    parents: number;
    academy_staff: number;
    academies: number;
    academies_churned: number;
    classes: number;
    content_sets: number;
    content_published: number;
    personal_active: number;
    personal_canceled: number;
    attempts_total: number;
    mau: number | null;
    /*
      서버 필드 이름은 `wal`인데 정의는 **7일 활성**(`answer_saved` 중복 제거)이다 —
      지표 사전의 `wau`가 그 정의다. 이름을 그대로 따라가면 화면이 북극성(주간 학습 완료)
      자리에 활성 수를 쓰게 되므로 여기서 한 번만 바로잡는다.
    */
    wal: number | null;
    completed_28d: number | null;
  };
  return {
    asOf: r.as_of,
    eventsSince: r.events_since ?? undefined,
    accounts: r.accounts,
    students: r.students,
    parents: r.parents,
    academyStaff: r.academy_staff,
    academies: r.academies,
    academiesChurned: r.academies_churned,
    classes: r.classes,
    contentSets: r.content_sets,
    contentPublished: r.content_published,
    personalActive: r.personal_active,
    personalCanceled: r.personal_canceled,
    attemptsTotal: r.attempts_total,
    mau: r.mau,
    wau: r.wal,
    completed28: r.completed_28d,
  };
}

/**
 * 매출 추정.
 *
 * 여기 있는 값은 전부 **추정**이다. 실제 결제·정산 기록이 아니다(마스터 플랜 5절).
 * 화면에서는 `추정` 출처와 함께 보여 준다.
 */
export interface RevenueEstimate {
  personal: number;
  academy: number;
  mrr: number;
  arr: number;
  /** **살아 있는** 개인 이용권 건수. 한 계정이 두 건을 가질 수 있다. */
  personalCount: number;
  academySeatCount: number;
  /** 돈을 내는 **사람** 수(중복 제거). 건과 명을 더하지 않는다. */
  payingPeople: number;
  arppu: number;
  /** 이탈한 학원의 좌석을 포함했는지. 기본은 포함하지 않는다(A-049). */
  includesChurned: boolean;
}

export async function revenueEstimate(includeChurned = false): Promise<RevenueEstimate> {
  const { data, error } = await supabase().rpc('rpc_revenue_estimate', {
    p_include_churned: includeChurned,
  });
  if (error) throw new Error(errorMessage(error));
  const r = data as {
    personal: number;
    academy: number;
    mrr: number;
    arr: number;
    personal_count: number;
    academy_seat_count: number;
    paying_people: number;
    arppu: number;
    includes_churned: boolean;
  };
  return {
    personal: r.personal,
    academy: r.academy,
    mrr: r.mrr,
    arr: r.arr,
    personalCount: r.personal_count,
    academySeatCount: r.academy_seat_count,
    payingPeople: r.paying_people,
    arppu: r.arppu,
    includesChurned: r.includes_churned,
  };
}

/** 원장·선생님 수. `rpc_admin_overview`는 교직원을 합쳐 주므로 갈라 세는 곳이 필요하다. */
export interface StaffCounts {
  directors: number;
  teachers: number;
}

export async function staffCounts(): Promise<StaffCounts> {
  const { data, error } = await supabase()
    .from('academy_members')
    .select('user_id, member_role')
    .is('left_at', null)
    .neq('member_role', 'student');
  if (error) throw new Error(errorMessage(error));
  const directors = new Set<string>();
  const teachers = new Set<string>();
  for (const m of data ?? []) {
    if (m.member_role === 'director') directors.add(m.user_id);
    if (m.member_role === 'teacher') teachers.add(m.user_id);
  }
  return { directors: directors.size, teachers: teachers.size };
}

/** 하루치 활동. `v_daily_activity`가 세어 준 값이다. */
export interface DailyActivity {
  day: string;
  activeStudents: number;
  completedStudents: number;
  notesAdded: number;
  reviewsDone: number;
}

/**
 * 일별 활동.
 *
 * **하루 단위 수는 이 뷰가 답한다.** 기간 안에서 중복을 제거한 수(WAU·MAU)는 하루치를 더해
 * 낼 수 없어서 `activityEvents`가 따로 답한다 — 둘 다 `learning_events` 한 표에서 나오므로
 * 두 값이 어긋날 자리가 없다.
 */
export async function dailyActivity(fromISO: string): Promise<DailyActivity[]> {
  const { data, error } = await supabase()
    .from('v_daily_activity')
    .select('occurred_on, active_students, completed_students, notes_added, reviews_done')
    .gte('occurred_on', fromISO)
    .order('occurred_on');
  if (error) throw new Error(errorMessage(error));
  return (data ?? [])
    .filter((r): r is typeof r & { occurred_on: string } => r.occurred_on != null)
    .map((r) => ({
      day: r.occurred_on,
      activeStudents: r.active_students ?? 0,
      completedStudents: r.completed_students ?? 0,
      notesAdded: r.notes_added ?? 0,
      reviewsDone: r.reviews_done ?? 0,
    }));
}

/** 활동 이벤트 한 건. 사람×날 중복을 제거하는 계산에만 쓴다. */
export interface ActivityEvent {
  studentId: string;
  day: string;
  kind: string;
}

/**
 * 창 안의 활동 이벤트.
 *
 * **창을 반드시 좁힌다.** `learning_events`는 append-only라 무한히 자란다 — 지표가 보는 기간
 * 밖의 행을 브라우저로 가져오면 4천 계정을 훑던 자리로 돌아간다.
 */
export async function activityEvents(fromISO: string): Promise<ActivityEvent[]> {
  const { data, error } = await supabase()
    .from('learning_events')
    .select('student_id, occurred_on, kind')
    .gte('occurred_on', fromISO);
  if (error) throw new Error(errorMessage(error));
  return (data ?? []).map((r) => ({ studentId: r.student_id, day: r.occurred_on, kind: r.kind }));
}

/** 학생 한 명의 가입일. 코호트는 **사람 단위**라 id가 함께 있어야 한다. */
export interface Signup {
  userId: string;
  /** 가입일(`YYYY-MM-DD`). */
  day: string;
}

/**
 * 학생 계정의 가입일.
 *
 * 코호트와 신규 가입 추이의 분모다. 예전에는 `accountMeta.createdAtOf`가 활동 데이터와 같은
 * 해시에서 파생했다 — 이제 `profiles.created_at`이 답한다.
 */
export async function studentSignups(): Promise<Signup[]> {
  const db = supabase();
  const [roles, profiles] = await Promise.all([
    db.from('user_roles').select('user_id').eq('role', 'student'),
    db.from('profiles').select('id, created_at').order('created_at').limit(ACCOUNT_LIMIT),
  ]);
  if (roles.error) throw new Error(errorMessage(roles.error));
  if (profiles.error) throw new Error(errorMessage(profiles.error));
  const students = new Set((roles.data ?? []).map((r) => r.user_id));
  return (profiles.data ?? [])
    .filter((p) => students.has(p.id))
    .map((p) => ({ userId: p.id, day: p.created_at.slice(0, 10) }));
}

/* ────────────────────────── 학원 ────────────────────────── */

/** 학원 한 곳의 계약·규모. 이름이 아니라 `id`가 조인 키다. */
export interface AcademySummary {
  id: string;
  name: string;
  contractSeats: number;
  renewalDate?: string;
  status: 'active' | 'churned';
  createdAt: string;
  /** 살아 있는 반에 속한 학생 수(중복 없이). */
  enrolled: number;
  /** 살아 있는 반 수. */
  classCount: number;
  /** 반을 맡고 있는 선생님 수(원장은 세지 않는다). */
  teacherCount: number;
  /** 최근 28일 안에 문항 1개 이상 답을 저장한 재원생 수. 기록이 없으면 `null`. */
  active28: number | null;
}

/**
 * 학원 목록.
 *
 * `src/data/academies.ts`가 만들던 학원 7곳을 대신한다. **행 수가 실제 계약 수**다 —
 * 표·정렬·페이저는 그대로 남고 행이 몇 개인지만 데이터가 정한다.
 */
export async function listAcademies(): Promise<AcademySummary[]> {
  const db = supabase();
  const since = daysAgoISO(MAU_WINDOW_DAYS - 1);
  const [academies, classes, roster, events] = await Promise.all([
    db.from('academies').select('id, name, contract_seats, renewal_date, status, created_at'),
    db.from('classes').select('id, academy_id, teacher_id').is('archived_at', null),
    db.from('v_class_roster').select('class_id, student_id'),
    db
      .from('learning_events')
      .select('student_id')
      .eq('kind', 'answer_saved')
      .gte('occurred_on', since),
  ]);
  for (const r of [academies, classes, roster, events]) {
    if (r.error) throw new Error(errorMessage(r.error));
  }

  const studentsByClass = new Map<string, string[]>();
  for (const r of roster.data ?? []) {
    if (!r.class_id || !r.student_id) continue;
    studentsByClass.set(r.class_id, [...(studentsByClass.get(r.class_id) ?? []), r.student_id]);
  }
  const active = new Set((events.data ?? []).map((e) => e.student_id));
  /** 기록이 아예 없으면 활성 0이 아니라 "아직 모른다"다. */
  const hasEvents = (events.data ?? []).length > 0;

  return (academies.data ?? []).map((ac) => {
    const mine = (classes.data ?? []).filter((c) => c.academy_id === ac.id);
    const students = new Set(mine.flatMap((c) => studentsByClass.get(c.id) ?? []));
    return {
      id: ac.id,
      name: ac.name,
      contractSeats: ac.contract_seats,
      renewalDate: ac.renewal_date ?? undefined,
      status: ac.status as 'active' | 'churned',
      createdAt: ac.created_at,
      enrolled: students.size,
      classCount: mine.length,
      teacherCount: new Set(mine.map((c) => c.teacher_id).filter(Boolean)).size,
      active28: hasEvents ? [...students].filter((id) => active.has(id)).length : null,
    };
  });
}

/**
 * 학원 한 곳의 반과 학생.
 *
 * 예전에는 `ACADEMY_CLASSES.filter(c => c.academyName === name)`이었다 — 학원 이름 문자열이
 * 조인 키였고, 학원이 세션에서 만든 반은 provider 오버레이에만 있어 여기 오지 않았다.
 * 이제 `classes.academy_id`가 키다.
 */
export async function academyClasses(academyId: string): Promise<AcademyClass[]> {
  const db = supabase();
  const [academy, classes] = await Promise.all([
    db.from('academies').select('name').eq('id', academyId).maybeSingle(),
    db
      .from('classes')
      .select('id, name, grade, teacher_id, academy_id')
      .eq('academy_id', academyId)
      .is('archived_at', null)
      .order('name'),
  ]);
  if (academy.error) throw new Error(errorMessage(academy.error));
  if (classes.error) throw new Error(errorMessage(classes.error));
  const ids = (classes.data ?? []).map((c) => c.id);
  if (ids.length === 0) return [];

  const roster = await db.from('v_class_roster').select('class_id, student_id').in('class_id', ids);
  if (roster.error) throw new Error(errorMessage(roster.error));
  const byClass = new Map<string, string[]>();
  for (const r of roster.data ?? []) {
    if (!r.class_id || !r.student_id) continue;
    byClass.set(r.class_id, [...(byClass.get(r.class_id) ?? []), r.student_id]);
  }
  const name = academy.data?.name ?? '';
  return (classes.data ?? []).map((c) => ({
    id: c.id,
    academyName: name,
    name: c.name,
    teacherId: c.teacher_id ?? '',
    grade: (c.grade ?? undefined) as Grade | undefined,
    studentIds: byClass.get(c.id) ?? [],
  }));
}

/**
 * 이 콘텐츠를 배정한 학원 이름.
 *
 * 예전에는 세션 메모리의 배정 목록을 `ACADEMY_CLASSES`에서 이름으로 조인했다 — 운영자 세션에는
 * 그 목록이 없어서 언제나 빈 값이었다. 이제 `assignments → classes → academies`를 따라간다.
 */
export async function academiesAssigning(contentSetId: string): Promise<string[]> {
  const { data, error } = await supabase()
    .from('assignments')
    .select('classes ( academies ( name ) )')
    .eq('content_set_id', contentSetId);
  if (error) throw new Error(errorMessage(error));
  const names = new Set<string>();
  for (const row of data ?? []) {
    const name = (row as unknown as { classes: { academies: { name: string } | null } | null })
      .classes?.academies?.name;
    if (name) names.add(name);
  }
  return [...names].sort();
}

/** 반 하나의 제출 현황. `academyStats.ClassPerf`와 같은 모양이라 표를 그대로 쓴다. */
export interface ClassSubmission {
  classId: string;
  /** 내야 할 건(배정×학생 행). */
  assigned: number;
  submitted: number;
  /** 배정이 없으면 `null` — 화면이 `배정 없음`으로 말한다. */
  rate: number | null;
  /** 문항 수로 가중한 평균 정답률(D-052). 제출이 없으면 `null`. */
  avgAccuracy: number | null;
  /** 배정 건 수(학생 수와 곱하지 않은 값). */
  assignmentCount: number;
  /**
   * 맞힌 문항 수와 푼 문항 수.
   *
   * **여러 반을 합칠 때 필요하다.** 반별 정답률을 다시 평균하면 문항 수 가중이 무너져
   * 25문항 반과 10문항 반이 같은 무게가 된다(D-052가 막으려던 것). 합계는 이 두 값으로 낸다.
   */
  correctCount: number;
  questionCount: number;
}

/**
 * 반별 제출 현황.
 *
 * **`rpc_class_stats`를 쓰지 않는다.** 그 함수는 `my_class_ids()`로 범위를 좁히는데 운영자는
 * 어느 학원에도 소속되지 않아 그 목록이 비어 있다 — 운영자가 부르면 항상 `[]`가 돌아온다.
 * 대신 운영자에게 열려 있는 `assignments`·`v_assignment_submissions`에서 같은 수식으로 낸다:
 * 제출률은 **사람×배정 행** 기준이고 정답률은 **문항 수 가중**이다(`weightedAccuracy`와 같은 뜻).
 */
export async function classSubmissions(classIds: readonly string[]): Promise<ClassSubmission[]> {
  if (classIds.length === 0) return [];
  const db = supabase();
  const assignments = await db
    .from('assignments')
    .select('id, class_id')
    .in('class_id', [...classIds]);
  if (assignments.error) throw new Error(errorMessage(assignments.error));

  const classOf = new Map((assignments.data ?? []).map((a) => [a.id, a.class_id] as const));
  const empty = (): ClassSubmission => ({
    classId: '',
    assigned: 0,
    submitted: 0,
    rate: null,
    avgAccuracy: null,
    assignmentCount: 0,
    correctCount: 0,
    questionCount: 0,
  });
  const acc = new Map<string, ClassSubmission>();
  for (const id of classIds) acc.set(id, { ...empty(), classId: id });
  for (const a of assignments.data ?? []) {
    const row = acc.get(a.class_id);
    if (row) row.assignmentCount += 1;
  }

  const ids = (assignments.data ?? []).map((a) => a.id);
  if (ids.length > 0) {
    const subs = await db
      .from('v_assignment_submissions')
      .select('assignment_id, submitted, correct_count, total_count')
      .in('assignment_id', ids);
    if (subs.error) throw new Error(errorMessage(subs.error));
    for (const s of subs.data ?? []) {
      const classId = s.assignment_id ? classOf.get(s.assignment_id) : undefined;
      const row = classId ? acc.get(classId) : undefined;
      if (!row) continue;
      row.assigned += 1;
      if (!s.submitted) continue;
      row.submitted += 1;
      row.correctCount += s.correct_count ?? 0;
      row.questionCount += s.total_count ?? 0;
    }
  }

  return [...acc.values()].map((r) => ({
    ...r,
    rate: r.assigned ? Math.round((r.submitted / r.assigned) * 100) : null,
    avgAccuracy: r.questionCount
      ? Math.round((r.correctCount / r.questionCount) * 100)
      : null,
  }));
}
