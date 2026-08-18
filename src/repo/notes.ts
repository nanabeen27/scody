import type { NoteEvidence, NoteState } from '@/data/types';
import { errorMessage, supabase } from '@/lib/supabase';
import type { WriteResult } from './learning';

export type { NoteEvidence, NoteState };

/**
 * 복습 기록.
 *
 * ## 쓰기는 RPC 하나만 지난다
 *
 * `note_reviews`에는 **쓰기 정책이 없다**(`supabase/migrations/0037_note_reviews.sql`). 유일한
 * 문이 `rpc_log_note_review`이고, 그 함수가 로그 한 행과 `wrong_notes` 스케줄 갱신을 한
 * 트랜잭션으로 처리한다. 학생이 이 표에 직접 넣을 수 있으면 정답 3회를 손으로 만들어 졸업할
 * 수 있고, 그러면 이 표가 학습의 사실이 아니라 자기 신고가 된다 — `mastered`가 정확히 그랬다.
 *
 * 스케줄 컬럼(`state`·`due_on`·`streak`·`miss_streak`)도 같은 이유로 클라이언트가 못 바꾼다.
 * DB 트리거가 막고, 남겨 둔 것은 지우기(`dismissed_at`)와 거기서 되돌리기뿐이다 — 화면이
 * 필요한 전부다(D-033).
 *
 * 실측 근거: `npx tsx scripts/verify-note-schedule.ts` (직접 UPDATE·직접 INSERT·물리 DELETE가
 * 모두 거부되는 것을 실제 JWT로 확인한다).
 */

/**
 * 한 번에 읽는 복습 기록 수.
 *
 * PostgREST가 응답을 자르는 지점(`max-rows`, 기본 1000)보다 낮게 잡아 **잘림이 조용히 일어나지
 * 않게** 한다. 한 학생이 하루 상한 5개를 매일 채워도 100일이 500행이다.
 */
const REVIEW_PAGE = 900;

export interface NoteReview {
  id: string;
  noteId: string;
  /** `YYYY-MM-DD`. 이 값이 "서로 다른 세션"의 정의다(하루에 한 행). */
  reviewedOn: string;
  pickedIndex?: number;
  isCorrect: boolean;
  evidence?: NoteEvidence;
  recap?: string;
  /** 한 줄 정리가 **가려져 있다**(대리 보기). 비어 있는 것과 다른 사실이다. */
  recapHidden?: boolean;
}

interface ReviewRow {
  id: string;
  note_id: string;
  reviewed_on: string;
  picked_index: number | null;
  is_correct: boolean;
  evidence: NoteEvidence | null;
  recap: string | null;
}

function toReview(row: ReviewRow): NoteReview {
  return {
    id: row.id,
    noteId: row.note_id,
    reviewedOn: row.reviewed_on.slice(0, 10),
    pickedIndex: row.picked_index ?? undefined,
    isCorrect: row.is_correct,
    evidence: row.evidence ?? undefined,
    recap: row.recap ?? undefined,
  };
}

/**
 * 노트별 복습 기록. 오래된 것부터.
 *
 * 범위는 RLS가 정한다 — 본인 · 연결된 학부모 · 운영자. 선생님에게는 0행이 나간다(정책에
 * 교직원 갈래가 없다).
 */
/**
 * 노트별 복습 기록.
 *
 * **최신부터 읽고 상한을 둔다.** PostgREST의 `max-rows`(기본 1000)가 응답을 조용히 자르는데,
 * 오름차순으로 읽으면 **잘리는 쪽이 오늘 것**이다 — 그러면 화면이 "오늘 본 것"을 못 찾아 이미
 * 복습한 카드를 다시 덱에 올리고, 누르면 서버가 `오늘은 이미 복습했어요.`로 거부한다.
 * 화면에 필요한 것은 최근 기록이므로 내림차순이 옳고, 정렬은 아래에서 되돌린다.
 */
export async function loadNoteReviews(): Promise<Record<string, NoteReview[]>> {
  const { data, error } = await supabase()
    .from('note_reviews')
    .select('id, note_id, reviewed_on, picked_index, is_correct, evidence, recap')
    .order('reviewed_on', { ascending: false })
    .limit(REVIEW_PAGE);
  if (error) throw new Error(errorMessage(error));
  const out: Record<string, NoteReview[]> = {};
  for (const row of (data ?? []) as ReviewRow[]) {
    out[row.note_id] = [...(out[row.note_id] ?? []), toReview(row)];
  }
  // 노트별로는 오래된 것부터 — 화면이 회차를 세고 마지막 한 줄을 찾는다.
  for (const id of Object.keys(out)) {
    out[id] = out[id].slice().reverse();
  }
  return out;
}

/**
 * 서버가 돌려주는 복습 결과. 화면이 이 값으로 그리고 재조회를 기다리지 않는다.
 *
 * `reviewedOn`은 **서버 날짜(KST)** 다. 화면이 기기 로컬 날짜로 "오늘 본 것"을 판정하면 시간대가
 * 다른 기기에서 어긋나 큐에는 보이는데 어떤 복습도 받지 못하는 카드가 생긴다.
 *
 * `scheduled`가 거짓이면 **차례가 아닌 복습**이라 다음 차례를 움직이지 않았다는 뜻이다(별표·영역·
 * 전체 덱). 그 경우에도 기록은 남는다.
 */
export interface LoggedReview {
  reviewedOn: string;
  isCorrect: boolean;
  scheduled: boolean;
  state: NoteState;
  dueOn: string | null;
  streak: number;
  missStreak: number;
}

/**
 * 다시 풀어 본 사실을 남기고 결과를 받는다.
 *
 * **정오를 클라이언트가 정하지 않는다.** 인자에 `isCorrect`가 없는 것이 그 계약이다 — 고른
 * 자리만 보내고 서버가 `questions.answer_index`와 대조한다. 앞선 판본은 `p_is_correct`를 받아
 * 그대로 스케줄에 썼고, 그래서 학생이 문항을 열지도 않고 서로 다른 3일에 `true`를 보내
 * 졸업시킬 수 있었다 — `mastered`를 걷어낸 이유가 그대로 되살아났다(0040).
 *
 * **다음 차례도 클라이언트가 제안하지 않는다.** 인자에 날짜가 없다.
 */
export async function logNoteReview(input: {
  noteId: string;
  pickedIndex: number;
  evidence?: NoteEvidence;
  recap?: string;
}): Promise<WriteResult & { review?: LoggedReview }> {
  const { data, error } = await supabase().rpc('rpc_log_note_review', {
    p_note_id: input.noteId,
    p_picked_index: input.pickedIndex,
    // 기본값이 있는 인자는 생성된 타입이 optional이다 — `null`이 아니라 생략으로 넘긴다.
    p_evidence: input.evidence ?? undefined,
    p_recap: input.recap ?? undefined,
  });
  if (error) return { ok: false, error: errorMessage(error) };
  const row = data as unknown as LoggedReview | null;
  return row ? { ok: true, review: row } : { ok: true };
}

/**
 * 차례가 온 문항을 하루 미룬다. 화면의 `건너뛰기`가 부른다.
 *
 * **미루지 않으면 큐가 교착된다.** 건너뛰기는 기록을 남기지 않으므로 `due_on`이 과거에 남고,
 * 다음 날 밀린 일수가 1 늘어 우선순위에서 **더 앞으로** 간다. 모르는 카드 다섯 장을 건너뛰면
 * 다음 날 덱이 같은 다섯 장이고 `miss_streak`도 늘지 않아 `stuck` 탈출구도 열리지 않는다.
 */
export async function deferNote(noteId: string): Promise<WriteResult & { dueOn?: string }> {
  const { data, error } = await supabase().rpc('rpc_defer_note', { p_note_id: noteId });
  if (error) return { ok: false, error: errorMessage(error) };
  const row = data as unknown as { dueOn: string | null } | null;
  return { ok: true, dueOn: row?.dueOn ?? undefined };
}

/**
 * 멈춘 문항을 다시 복습 목록에 넣는다.
 *
 * `stuck`은 `due_on`이 없어 큐에 나오지 않는다. 돌아올 길이 없으면 그 상태는 조용한 삭제다.
 * 서버가 `stuck`에서만 허용한다 — 다른 상태에서 부르면 학생이 자기 일정을 앞당길 수 있다.
 */
export async function requeueNote(noteId: string): Promise<WriteResult> {
  const { error } = await supabase().rpc('rpc_requeue_note', { p_note_id: noteId });
  return error ? { ok: false, error: errorMessage(error) } : { ok: true };
}

/**
 * 오늘 복습에 한 줄 정리를 채운다.
 *
 * 정오·근거는 `logNoteReview`가 확인을 누른 순간 남겼다. 한 줄은 피드백을 읽은 뒤에 쓰는 값이라
 * 시점이 다르다(`supabase/migrations/0039_note_review_recap.sql`). **스케줄은 바뀌지 않는다.**
 */
export async function setReviewRecap(noteId: string, recap: string): Promise<WriteResult> {
  const { error } = await supabase().rpc('rpc_set_note_review_recap', {
    p_note_id: noteId,
    p_recap: recap,
  });
  return error ? { ok: false, error: errorMessage(error) } : { ok: true };
}
