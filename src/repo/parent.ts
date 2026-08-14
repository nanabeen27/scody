import { errorMessage, supabase } from '@/lib/supabase';
import { itemIdOf } from './mappers';

/**
 * 학부모 기능: 재풀이 요청 · 칭찬 · 주간 요약.
 *
 * 권한은 RLS가 강제한다 — 쓰기는 `is_my_child()`를 통과해야 하고, 읽기는 본인과 연결된 학부모,
 * 그리고 운영자만이다.
 */

export type PraiseKind = 'steady' | 'submitted' | 'reviewed' | 'thanks';

export interface Praise {
  id: string;
  kind: PraiseKind;
  /** 보낸 날(YYYY-MM-DD). */
  at: string;
  /** 보낸 사람 이름. 자녀 화면에서 누가 보냈는지 말한다. */
  from: string;
  seen?: boolean;
}

export interface WeekSummary {
  text: string;
  at: string;
  byAI: boolean;
}

export interface WriteResult {
  ok: boolean;
  error?: string;
}

function fail(error: unknown): WriteResult {
  return { ok: false, error: errorMessage(error) };
}

// ── 재풀이 요청 ──────────────────────────────────────────────────────────────

/** 학생별 재풀이 요청 대상(`itemId`). 취소한 요청은 빠진다. */
export async function loadRetryRequests(): Promise<Record<string, string[]>> {
  const { data, error } = await supabase()
    .from('retry_requests')
    .select('student_id, source, assignment_id, content_set_id')
    .is('canceled_at', null);
  if (error) throw new Error(errorMessage(error));
  const out: Record<string, string[]> = {};
  for (const r of data ?? []) {
    const itemId = itemIdOf(r.source as 'personal' | 'academy', r.assignment_id, r.content_set_id);
    out[r.student_id] = [...(out[r.student_id] ?? []), itemId];
  }
  return out;
}

export async function requestRetry(input: {
  studentId: string;
  source: 'personal' | 'academy';
  contentId: string;
  assignmentId?: string;
}): Promise<WriteResult> {
  // 세션은 로컬 저장소에서 읽는다 — `getUser()`는 **매번 서버로 왕복한다**(`GoTrueClient._getUser`가
  // 캐시 없이 `GET /auth/v1/user`를 부른다). 여기서 uid는 **컬럼 값**으로만 쓰고, 그 값이 맞는지는
  // RLS가 `= auth.uid()`로 다시 판단한다(0015) — 틀린 값을 보내면 서버가 거부한다. 그래서 신뢰
  // 경계가 로컬 세션으로 내려오지 않는다.
  const uid = (await supabase().auth.getSession()).data.session?.user.id;
  if (!uid) return { ok: false, error: '다시 로그인해 주세요.' };
  const { error } = await supabase()
    .from('retry_requests')
    .insert({
      student_id: input.studentId,
      requested_by: uid,
      source: input.source,
      assignment_id: input.assignmentId ?? null,
      content_set_id: input.contentId,
    });
  // 같은 대상에 살아 있는 요청은 하나뿐이다(부분 유니크). 두 번 눌러도 오류로 보이지 않게 한다.
  if (error && /duplicate key/i.test(String((error as { message?: string }).message))) {
    return { ok: true };
  }
  return error ? fail(error) : { ok: true };
}

// ── 칭찬 ─────────────────────────────────────────────────────────────────────

export async function loadPraises(): Promise<Record<string, Praise[]>> {
  const { data, error } = await supabase()
    .from('praises')
    .select('id, child_id, kind, sent_on, seen_at, profiles!praises_from_user_id_fkey ( name )')
    .order('sent_on');
  if (error) throw new Error(errorMessage(error));
  const out: Record<string, Praise[]> = {};
  for (const p of data ?? []) {
    const row = p as unknown as {
      id: string;
      child_id: string;
      kind: PraiseKind;
      sent_on: string;
      seen_at: string | null;
      profiles: { name: string } | null;
    };
    out[row.child_id] = [
      ...(out[row.child_id] ?? []),
      {
        id: row.id,
        kind: row.kind,
        at: row.sent_on,
        from: row.profiles?.name ?? '',
        seen: !!row.seen_at,
      },
    ];
  }
  return out;
}

export async function sendPraise(childId: string, kind: PraiseKind): Promise<WriteResult> {
  const uid = (await supabase().auth.getSession()).data.session?.user.id;
  if (!uid) return { ok: false, error: '다시 로그인해 주세요.' };
  const { error } = await supabase()
    .from('praises')
    .insert({ child_id: childId, from_user_id: uid, kind });
  // 같은 날 같은 종류를 두 번 보내지 않는다(유니크). 두 번 눌러도 조용히 성공으로 둔다.
  if (error && /duplicate key/i.test(String((error as { message?: string }).message))) {
    return { ok: true };
  }
  return error ? fail(error) : { ok: true };
}

/** 자녀가 자기 칭찬을 확인해 닫는다. */
export async function dismissPraise(id: string): Promise<WriteResult> {
  const { error } = await supabase()
    .from('praises')
    .update({ seen_at: new Date().toISOString() })
    .eq('id', id);
  return error ? fail(error) : { ok: true };
}

// ── 주간 요약 ────────────────────────────────────────────────────────────────

/** `${childId}-${monday}` → 요약. 한 번 만들면 그 주 내내 같은 문장을 보여 준다. */
export async function loadWeekSummaries(): Promise<Record<string, WeekSummary>> {
  const { data, error } = await supabase()
    .from('week_summaries')
    .select('child_id, week_monday, text, by_ai, created_at');
  if (error) throw new Error(errorMessage(error));
  const out: Record<string, WeekSummary> = {};
  for (const s of data ?? []) {
    out[`${s.child_id}-${s.week_monday}`] = {
      text: s.text,
      at: s.created_at.slice(0, 10),
      byAI: s.by_ai,
    };
  }
  return out;
}

export async function setWeekSummary(input: {
  childId: string;
  monday: string;
  text: string;
  byAI: boolean;
}): Promise<WriteResult> {
  // `week_summaries_insert`가 `created_by = auth.uid()`를 요구한다 — 로그인이 없으면
  // 정책 거절 문구가 아니라 다시 로그인하라는 말로 돌려준다.
  const uid = (await supabase().auth.getSession()).data.session?.user.id;
  if (!uid) return { ok: false, error: '다시 로그인해 주세요.' };
  const { error } = await supabase()
    .from('week_summaries')
    .upsert(
      {
        child_id: input.childId,
        week_monday: input.monday,
        text: input.text,
        by_ai: input.byAI,
        created_by: uid,
      },
      { onConflict: 'child_id,week_monday' },
    );
  return error ? fail(error) : { ok: true };
}
