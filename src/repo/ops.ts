import { errorMessage, supabase } from '@/lib/supabase';

/**
 * 운영 기록(감사 로그) 조회·기록.
 *
 * ## append-only다
 *
 * `audit_logs`에는 insert 정책만 있다(`supabase/migrations/0011_ops.sql`). 고치거나 지우는
 * 경로가 서버에 없으므로 이 파일에도 `update`·`delete`가 없다.
 *
 * ## 쓰는 사람은 운영자뿐이다
 *
 * `audit_logs_insert`가 `is_admin() and actor_id = auth.uid()`다(0024). 예전 정책은
 * `actor_id = auth.uid()`만 봐서 학생이 원장 이름으로 `대리 보기` 기록을 만들 수 있었다.
 * 읽기도 `is_admin()`만이다 — 운영자가 아니면 응답이 빈 배열이고, 여기서 역할을 다시
 * 검사하지 않는다.
 */

/**
 * 행동 분류. `audit_action` enum과 같은 값이다.
 *
 * - `요금 정책`: 단가·할인율 변경(`app/admin/billing.tsx`)
 * - `콘텐츠`: 운영자 문제 등록(`app/admin/new.tsx`). 학원 등록 경로에는 붙이지 않는다 —
 *   학원 조작을 운영자 기록에 섞으면 누가 한 일인지 흐려진다.
 * - `계정`: 계정 화면에서 하는 조작
 * - `대리 보기`: 운영자가 사용자 화면을 그 사람 눈으로 볼 때
 * - `기타`: 위에 없는 조작
 */
export type AuditAction = '요금 정책' | '콘텐츠' | '계정' | '대리 보기' | '기타';

export interface AuditEntry {
  id: string;
  /** 발생 시각. `YYYY-MM-DDTHH:mm:ss` 형태의 **로컬** 시간 문자열(`auditTime`이 이 모양을 읽는다). */
  atISO: string;
  /** 행동한 사람(계정 이름). 계정이 지워져도 기록이 남아야 해서 서버에 이름을 함께 박아 둔다. */
  actor: string;
  action: AuditAction;
  /** 사람이 읽는 한 줄 설명. */
  detail: string;
  /**
   * 이 기록이 다룬 사용자의 `user_id`.
   *
   * **설명 문자열을 파싱해 좁히지 않는다.** `detail.includes(userId)`로 좁혔을 때 id가 접두
   * 관계라 다른 계정의 열람 기록이 섞여 보였다. 서버에서 `subject_id`로 좁힌다.
   */
  subjectId?: string;
}

export interface WriteResult {
  ok: boolean;
  error?: string;
}

function fail(error: unknown): WriteResult {
  return { ok: false, error: errorMessage(error) };
}

/**
 * 한 번에 읽는 기록 수 상한.
 *
 * append-only라 이 표는 계속 자란다. 운영 기록 화면은 최근 것부터 보므로 상한을 두고,
 * 화면이 `최근 N건`이라고 말한다.
 */
export const AUDIT_LIMIT = 200;

interface AuditRow {
  id: string;
  at: string;
  actor_name: string;
  action: AuditAction;
  detail: string;
  subject_id: string | null;
}

/**
 * timestamptz를 화면이 읽는 로컬 시간 문자열로 바꾼다.
 *
 * `auditTime()`이 `YYYY-MM-DDTHH:mm:ss`를 잘라 쓴다. 서버 값을 그대로 넘기면 UTC 오프셋이
 * 붙어 있어 한국에서 9시간 전으로 보인다.
 */
function localStamp(at: string): string {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:${p(d.getSeconds())}`;
}

function toEntry(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    atISO: localStamp(row.at),
    actor: row.actor_name,
    action: row.action,
    detail: row.detail,
    subjectId: row.subject_id ?? undefined,
  };
}

const COLUMNS = 'id, at, actor_name, action, detail, subject_id';

/** 최근 기록. 새것부터. 운영자가 아니면 빈 배열이다(RLS). */
export async function listAuditLogs(): Promise<AuditEntry[]> {
  const { data, error } = await supabase()
    .from('audit_logs')
    .select(COLUMNS)
    .order('at', { ascending: false })
    .limit(AUDIT_LIMIT);
  if (error) throw new Error(errorMessage(error));
  return (data ?? []).map((r) => toEntry(r as AuditRow));
}

/**
 * 한 계정을 다룬 기록. 계정 상세의 `이 계정을 누가 열어 봤나`가 쓴다.
 *
 * 최근 목록에서 걸러 내지 않고 **서버에서 좁힌다** — 상한(`AUDIT_LIMIT`)을 넘긴 뒤에는
 * 목록에 없는 기록이 생기고, 그때 계정 상세가 조용히 적게 말한다.
 */
export async function listAuditLogsFor(subjectId: string): Promise<AuditEntry[]> {
  const { data, error } = await supabase()
    .from('audit_logs')
    .select(COLUMNS)
    .eq('subject_id', subjectId)
    .order('at', { ascending: false })
    .limit(AUDIT_LIMIT);
  if (error) throw new Error(errorMessage(error));
  return (data ?? []).map((r) => toEntry(r as AuditRow));
}

/**
 * 기록 한 줄을 남긴다.
 *
 * 시각은 서버가 정한다(`at default now()`) — 클라이언트 시계로 적으면 기록의 순서를 조작할 수
 * 있고, 접속기록은 그러면 안 된다.
 */
export async function writeAuditLog(entry: {
  actor: string;
  action: AuditAction;
  detail: string;
  subjectId?: string;
}): Promise<WriteResult> {
  // 세션은 로컬 저장소에서 읽는다 — `getUser()`는 **매번 서버로 왕복한다**(`GoTrueClient._getUser`가
  // 캐시 없이 `GET /auth/v1/user`를 부른다). 여기서 uid는 **컬럼 값**으로만 쓰고, 그 값이 맞는지는
  // RLS가 `= auth.uid()`로 다시 판단한다(0015) — 틀린 값을 보내면 서버가 거부한다. 그래서 신뢰
  // 경계가 로컬 세션으로 내려오지 않는다.
  const uid = (await supabase().auth.getSession()).data.session?.user.id;
  if (!uid) return { ok: false, error: '다시 로그인해 주세요.' };
  const { error } = await supabase().from('audit_logs').insert({
    actor_id: uid,
    actor_name: entry.actor,
    action: entry.action,
    detail: entry.detail,
    subject_id: entry.subjectId ?? null,
  });
  return error ? fail(error) : { ok: true };
}
