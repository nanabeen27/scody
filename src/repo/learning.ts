import type { Assignment, NoteState, Submission } from '@/data/types';
import { errorMessage, supabase } from '@/lib/supabase';
import { itemIdOf, toAssignment, toSubmission } from './mappers';

/**
 * 배정 · 풀이 · 오답노트 · 담아 둔 학습.
 *
 * ## 쓰기는 대부분 RPC를 지난다
 *
 * 제출·배정·재배정·삭제는 여러 표를 함께 바꿔야 해서 `security definer` 함수 하나가 유일한
 * 문이다(`supabase/migrations/0013_functions.sql`). RLS에 쓰기 정책을 두지 않았으므로,
 * 화면이 표 하나만 고치는 우회로가 없다.
 *
 * 오답노트·담아 둔 학습은 본인 소유의 한 행이라 PostgREST로 직접 쓰고 RLS가 막는다.
 */

// ── 화면이 쓰는 형태 ─────────────────────────────────────────────────────────

export interface PerQuestion {
  qId: string;
  prompt: string;
  choices: string[];
  answerIndex: number;
  pickedIndex?: number;
  correct: boolean;
}

export interface Attempt {
  itemId: string;
  title: string;
  area: string;
  source: 'personal' | 'academy';
  timeSec: number;
  correct: number;
  total: number;
  accuracy: number;
  dateISO: string;
  perQuestion: PerQuestion[];
}

export interface WrongNote {
  id: string;
  itemId: string;
  contentId?: string;
  source: 'personal' | 'academy';
  area: string;
  title: string;
  qId: string;
  prompt: string;
  choices: string[];
  answerIndex: number;
  pickedIndex?: number;
  dig?: string;
  /**
   * 메모가 **가려져 있다**(대리 보기). `dig`가 없는 것과 다른 사실이다 — 화면이 이 값을 보지
   * 않으면 "아직 정리하지 않았어요"로 단정하고, 그것이 거짓이 된다.
   */
  digHidden?: boolean;
  starred?: boolean;
  /**
   * 학생이 눌렀던 `이해 완료`.
   *
   * **학생 화면에서는 쓰지 않는다.** 자기 예측은 실제 성과와 무상관이고(Karpicke & Roediger
   * 2008, Science 319:966) 이 값은 어떤 화면도 바꾸지 않았다(A-087). 이제 숙달은
   * `state`·`streak`이 말한다. 컬럼과 필드는 남긴다 — 확정 정책 2절이 이 이름으로 학원 공개
   * 여부를 정하고 `__tests__/report.test.ts`가 학부모 리포트에서의 부재를 고정한다.
   */
  mastered?: boolean;
  createdAt?: string;
  /** 복습 스케줄. **서버만 쓴다**(`src/repo/notes.ts`). */
  state: NoteState;
  /** 다시 볼 날(`YYYY-MM-DD`). `stuck`이면 없고, 그때만 없다. */
  dueOn?: string;
  /** 서로 다른 날 연속으로 맞힌 횟수. 3이면 졸업이다. */
  streak: number;
  /** 서로 다른 날 연속으로 틀린 횟수. 3이면 `stuck`이다. */
  missStreak: number;
}

/**
 * 학원에 주는 오답 한 줄.
 *
 * **뺀 필드를 `?: never`로 못박는다** — 빼기만 하면 `WrongNote`가 그대로 이 자리에 들어가도
 * 타입 검사를 통과한다(구조적 타이핑). DB 쪽에서도 뷰에 그 컬럼이 아예 없다
 * (`v_academy_visible_notes`). 두 겹으로 막는다.
 */
export type AcademyNote = Omit<
  WrongNote,
  'starred' | 'mastered' | 'pickedIndex' | 'state' | 'dueOn' | 'streak' | 'missStreak'
> & {
  starred?: never;
  mastered?: never;
  pickedIndex?: never;
  state?: never;
  dueOn?: never;
  streak?: never;
  missStreak?: never;
};

export interface QueueEntry {
  itemId: string;
  contentId: string;
}

export interface WriteResult {
  ok: boolean;
  error?: string;
}

function fail(error: unknown): WriteResult {
  return { ok: false, error: errorMessage(error) };
}

// ── 배정 ─────────────────────────────────────────────────────────────────────

/**
 * 내가 볼 수 있는 배정 전부와 제출 현황.
 *
 * 제출은 `v_assignment_submissions` 뷰에서 온다 — `submitted`는 컬럼이 아니라
 * `attempt_id is not null`이고, 틀린 문항은 뷰가 `attempt_answers`에서 모아 준다.
 */
export async function loadAssignments(): Promise<Assignment[]> {
  const db = supabase();
  const [rows, subs] = await Promise.all([
    db
      .from('assignments')
      .select('id, class_id, content_set_id, title, due_date, original_due_date, content_sets ( questions ( id ) )')
      .order('due_date', { nullsFirst: false }),
    db.from('v_assignment_submissions').select('*'),
  ]);
  if (rows.error) throw new Error(errorMessage(rows.error));
  if (subs.error) throw new Error(errorMessage(subs.error));

  const byAssignment = new Map<string, Submission[]>();
  for (const s of subs.data ?? []) {
    const row = s as Parameters<typeof toSubmission>[0] & { assignment_id: string };
    byAssignment.set(row.assignment_id, [
      ...(byAssignment.get(row.assignment_id) ?? []),
      toSubmission(row),
    ]);
  }

  return (rows.data ?? []).map((r) => {
    const embedded = r as unknown as { content_sets: { questions: { id: string }[] } | null };
    return toAssignment(r, embedded.content_sets?.questions.length ?? 0, byAssignment.get(r.id) ?? []);
  });
}

export async function addAssignment(input: {
  classId: string;
  contentId: string;
  title: string;
  dueDate?: string;
}): Promise<WriteResult & { id?: string }> {
  const { data, error } = await supabase().rpc('rpc_add_assignment', {
    p_class_id: input.classId,
    p_content_set_id: input.contentId,
    p_title: input.title,
    // 기본값이 있는 인자는 생성된 타입이 optional이다 — `null`이 아니라 생략으로 넘긴다.
    p_due_date: input.dueDate ?? undefined,
  });
  if (error) return fail(error);
  return { ok: true, id: data as string };
}

export async function reassign(assignmentId: string, dueDate: string): Promise<WriteResult> {
  const { error } = await supabase().rpc('rpc_reassign', {
    p_assignment_id: assignmentId,
    p_due_date: dueDate,
  });
  return error ? fail(error) : { ok: true };
}

export async function removeAssignment(assignmentId: string): Promise<WriteResult> {
  const { error } = await supabase().rpc('rpc_remove_assignment', {
    p_assignment_id: assignmentId,
  });
  return error ? fail(error) : { ok: true };
}

// ── 풀이 ─────────────────────────────────────────────────────────────────────

const ATTEMPT_SELECT = `
  id, student_id, content_set_id, source, assignment_id, attempt_no,
  time_sec, submitted_on, correct_count, total_count, accuracy,
  content_sets ( title, area ),
  assignments ( title ),
  attempt_answers ( question_id, picked_index, is_correct,
    questions ( prompt, choices, answer_index, position ) )
` as const;

interface AttemptRow {
  id: string;
  student_id: string;
  content_set_id: string;
  source: 'personal' | 'academy';
  assignment_id: string | null;
  attempt_no: number;
  time_sec: number;
  submitted_on: string;
  correct_count: number;
  total_count: number;
  accuracy: number;
  content_sets: { title: string; area: string } | null;
  assignments: { title: string } | null;
  attempt_answers: {
    question_id: string;
    picked_index: number | null;
    is_correct: boolean;
    questions: { prompt: string; choices: string[]; answer_index: number; position: number } | null;
  }[];
}

function toAttempt(row: AttemptRow): Attempt {
  const perQuestion = [...row.attempt_answers]
    .sort((a, b) => (a.questions?.position ?? 0) - (b.questions?.position ?? 0))
    .map((a) => ({
      qId: a.question_id,
      prompt: a.questions?.prompt ?? '',
      choices: a.questions?.choices ?? [],
      answerIndex: a.questions?.answer_index ?? 0,
      pickedIndex: a.picked_index ?? undefined,
      correct: a.is_correct,
    }));
  return {
    itemId: itemIdOf(row.source, row.assignment_id, row.content_set_id),
    /*
      **학원 학습은 과제 이름을 쓴다.** 학원이 붙인 이름(`현대소설 점검`)과 콘텐츠 제목
      (`현대소설 - 인물의 심리`)은 다르다 — 학생·학부모 화면은 받은 과제 이름으로 기억한다.
      개인 학습은 콘텐츠 제목이 그 학습의 이름이다.
    */
    title: row.assignments?.title ?? row.content_sets?.title ?? '',
    area: row.content_sets?.area ?? '',
    source: row.source,
    timeSec: row.time_sec,
    correct: row.correct_count,
    total: row.total_count,
    accuracy: row.accuracy,
    dateISO: row.submitted_on,
    perQuestion,
  };
}

/**
 * 학생별 풀이 기록. **최신 회차만** 남긴다.
 *
 * 재풀이하면 회차가 쌓이는데(`attempt_no`) 화면은 늘 최신 결과를 본다. 이전 회차는 DB에 남아
 * 있어 재풀이 전후를 비교할 수 있다(A-036이 열려 있던 자리).
 *
 * RLS가 범위를 정한다: 본인과 연결된 자녀, 운영자. 학원은 여기로 오지 않는다.
 */
export async function loadAttempts(): Promise<Record<string, Record<string, Attempt>>> {
  const { data, error } = await supabase().from('attempts').select(ATTEMPT_SELECT);
  if (error) throw new Error(errorMessage(error));

  const latest = new Map<string, AttemptRow>();
  for (const row of (data ?? []) as unknown as AttemptRow[]) {
    const key = `${row.student_id}|${row.source}|${row.assignment_id ?? row.content_set_id}`;
    const cur = latest.get(key);
    if (!cur || row.attempt_no > cur.attempt_no) latest.set(key, row);
  }

  const out: Record<string, Record<string, Attempt>> = {};
  for (const row of latest.values()) {
    const attempt = toAttempt(row);
    out[row.student_id] = { ...out[row.student_id], [attempt.itemId]: attempt };
  }
  return out;
}

/**
 * 풀이를 제출한다. **채점은 서버가 한다** — 보낸 정답 수를 믿지 않는다.
 *
 * 한 트랜잭션에서 시도·문항별 정오·배정 제출 표시·초안 정리·담아 둔 목록 정리가 함께 일어난다.
 */
export async function submitAttempt(input: {
  source: 'personal' | 'academy';
  contentId: string;
  assignmentId?: string;
  timeSec: number;
  /** 문항 id → 고른 선지. 안 고른 문항은 빼도 되고, 그 문항은 오답으로 채점된다. */
  picked: Record<string, number>;
}): Promise<WriteResult & { attemptId?: string }> {
  const { data, error } = await supabase().rpc('rpc_submit_attempt', {
    p_source: input.source,
    p_content_set_id: input.contentId,
    p_answers: Object.entries(input.picked).map(([question_id, picked_index]) => ({
      question_id,
      picked_index,
    })),
    p_time_sec: input.timeSec,
    p_assignment_id: input.assignmentId ?? undefined,
  });
  if (error) return fail(error);
  return { ok: true, attemptId: data as string };
}

// ── 답안 초안(자동 저장) ─────────────────────────────────────────────────────

/**
 * 제출 전 자동 저장 답안. 학습 목록의 `이어서 하기`가 이 값을 근거로 말한다.
 *
 * 화면은 `itemId → { qId: 고른 선지 }` 형태로 들고 있었다(`session.answers`). 그 형태를 유지한다.
 */
export async function loadDrafts(): Promise<Record<string, Record<string, number>>> {
  const { data, error } = await supabase()
    .from('answer_drafts')
    .select('source, assignment_id, content_set_id, question_id, picked_index');
  if (error) throw new Error(errorMessage(error));
  const out: Record<string, Record<string, number>> = {};
  for (const d of data ?? []) {
    const itemId = itemIdOf(d.source as 'personal' | 'academy', d.assignment_id, d.content_set_id);
    out[itemId] = { ...out[itemId], [d.question_id]: d.picked_index };
  }
  return out;
}

export async function saveDraft(input: {
  source: 'personal' | 'academy';
  contentId: string;
  assignmentId?: string;
  questionId: string;
  pickedIndex: number;
}): Promise<WriteResult> {
  // 세션은 로컬 저장소에서 읽는다 — `getUser()`는 **매번 서버로 왕복한다**(`GoTrueClient._getUser`가
  // 캐시 없이 `GET /auth/v1/user`를 부른다). 여기서 uid는 **컬럼 값**으로만 쓰고, 그 값이 맞는지는
  // RLS가 `= auth.uid()`로 다시 판단한다(0015) — 틀린 값을 보내면 서버가 거부한다. 그래서 신뢰
  // 경계가 로컬 세션으로 내려오지 않는다. `saveDraft`는 답을 고를 때마다 불려서 이 왕복이 가장 비쌌다.
  const uid = (await supabase().auth.getSession()).data.session?.user.id;
  if (!uid) return { ok: false, error: '다시 로그인해 주세요.' };
  const { error } = await supabase()
    .from('answer_drafts')
    .upsert(
      {
        student_id: uid,
        source: input.source,
        assignment_id: input.assignmentId ?? null,
        content_set_id: input.contentId,
        question_id: input.questionId,
        picked_index: input.pickedIndex,
        updated_at: new Date().toISOString(),
      },
      // 유니크 키는 `(student_id, question_id, source, coalesce(assignment_id, content_set_id))`다.
      // PostgREST에는 표현식 인덱스를 줄 수 없어 컬럼 목록으로 지정한다.
      { onConflict: 'student_id,question_id,source,assignment_id,content_set_id' },
    );
  return error ? fail(error) : { ok: true };
}

// ── 오답노트 ─────────────────────────────────────────────────────────────────

const NOTE_SELECT = `
  id, student_id, question_id, content_set_id, source, assignment_id, picked_index,
  dig, starred, mastered, created_at, state, due_on, streak, miss_streak,
  questions ( prompt, choices, answer_index, position ),
  content_sets ( title, area )
` as const;

interface NoteRow {
  id: string;
  student_id: string;
  question_id: string;
  content_set_id: string;
  source: 'personal' | 'academy';
  assignment_id: string | null;
  picked_index: number | null;
  dig: string | null;
  starred: boolean;
  mastered: boolean;
  created_at: string;
  state: NoteState;
  due_on: string | null;
  streak: number;
  miss_streak: number;
  questions: { prompt: string; choices: string[]; answer_index: number; position: number } | null;
  content_sets: { title: string; area: string } | null;
}

function toNote(row: NoteRow): WrongNote {
  return {
    id: row.id,
    itemId: itemIdOf(row.source, row.assignment_id, row.content_set_id),
    contentId: row.content_set_id,
    source: row.source,
    area: row.content_sets?.area ?? '',
    title: row.content_sets?.title ?? '',
    qId: row.question_id,
    prompt: row.questions?.prompt ?? '',
    choices: row.questions?.choices ?? [],
    answerIndex: row.questions?.answer_index ?? 0,
    pickedIndex: row.picked_index ?? undefined,
    dig: row.dig ?? undefined,
    starred: row.starred,
    mastered: row.mastered,
    createdAt: row.created_at.slice(0, 10),
    state: row.state,
    dueOn: row.due_on ?? undefined,
    streak: row.streak,
    missStreak: row.miss_streak,
  };
}

/**
 * 오답노트 전부. **지운 것은 빼고 읽는다.**
 *
 * 지우기가 물리 삭제에서 소프트 삭제로 바뀌었다(0037) — 복습 로그가 자식 표라, 물리 삭제는
 * 되돌리기가 정답 3회의 근거를 되살릴 수 없게 만든다. 그래서 목록에서 빼는 것은 여기다.
 */
export async function loadNotes(): Promise<Record<string, WrongNote[]>> {
  const { data, error } = await supabase()
    .from('wrong_notes')
    .select(NOTE_SELECT)
    .is('dismissed_at', null)
    .order('created_at');
  if (error) throw new Error(errorMessage(error));
  const out: Record<string, WrongNote[]> = {};
  for (const row of (data ?? []) as unknown as NoteRow[]) {
    out[row.student_id] = [...(out[row.student_id] ?? []), toNote(row)];
  }
  return out;
}

/**
 * 학원 응답 한 줄. **뷰가 주는 8개 컬럼만 적는다**.
 *
 * `NoteRow`를 재사용하면 별표·이해 완료·고른 답이 타입에 남아 `row.starred`가 타입 검사를
 * 통과하고 값은 `undefined`로 조용히 흐른다. 응답 스키마를 그대로 적어 그 실수를 막는다(D-054).
 */
interface AcademyNoteRow {
  id: string;
  student_id: string;
  question_id: string;
  content_set_id: string;
  source: 'personal' | 'academy';
  assignment_id: string | null;
  dig: string | null;
  created_at: string;
  questions: { prompt: string; choices: string[]; answer_index: number } | null;
  content_sets: { title: string; area: string } | null;
}

/**
 * 학원이 볼 수 있는 오답노트.
 *
 * **별표·이해 완료·고른 답은 응답에 담기지 않는다** — 뷰에 그 컬럼이 아예 없다.
 * 담당 반이 아닌 학생, 개인 학습에서 담은 오답도 뷰가 걸러 준다.
 */
export async function loadAcademyNotes(): Promise<Record<string, AcademyNote[]>> {
  const { data, error } = await supabase()
    .from('v_academy_visible_notes')
    .select('id, student_id, question_id, content_set_id, source, assignment_id, dig, created_at, questions ( prompt, choices, answer_index ), content_sets ( title, area )');
  if (error) throw new Error(errorMessage(error));
  const out: Record<string, AcademyNote[]> = {};
  for (const row of (data ?? []) as unknown as AcademyNoteRow[]) {
    const note: AcademyNote = {
      id: row.id,
      itemId: itemIdOf(row.source, row.assignment_id, row.content_set_id),
      contentId: row.content_set_id,
      source: row.source,
      area: row.content_sets?.area ?? '',
      title: row.content_sets?.title ?? '',
      qId: row.question_id,
      prompt: row.questions?.prompt ?? '',
      choices: row.questions?.choices ?? [],
      answerIndex: row.questions?.answer_index ?? 0,
      dig: row.dig ?? undefined,
      createdAt: row.created_at.slice(0, 10),
    };
    out[row.student_id] = [...(out[row.student_id] ?? []), note];
  }
  return out;
}

/**
 * 오답을 담는다. **담기와 되살리기가 한 함수다**(`rpc_add_wrong_note`).
 *
 * **개인 학습과 학원 과제를 다른 행으로 둔다**(A-085): 유니크 키가
 * `(student_id, question_id, source, coalesce(assignment_id, content_set_id))`라, 개인 학습에서
 * 담은 것을 지워도 학원 배정 오답과 메모가 남는다.
 *
 * **플레인 INSERT일 수 없다**: 지우기가 소프트 삭제라, 지웠던 문항을 다시 담으면 그 유니크
 * 키에 걸린다(23505). 표현식 인덱스라 PostgREST의 `onConflict`로 지정할 수 없어 클라이언트에서
 * 원자적으로 처리할 방법이 없다. 서버 함수가 없으면 담을 때마다 실패한다.
 */
export async function addNote(input: {
  questionId: string;
  contentId: string;
  source: 'personal' | 'academy';
  assignmentId?: string;
  pickedIndex?: number;
}): Promise<WriteResult & { id?: string; restored?: boolean }> {
  const { data, error } = await supabase().rpc('rpc_add_wrong_note', {
    p_question_id: input.questionId,
    p_content_set_id: input.contentId,
    p_source: input.source,
    // 기본값이 있는 인자는 생성된 타입이 optional이다 — `null`이 아니라 생략으로 넘긴다.
    p_assignment_id: input.assignmentId ?? undefined,
    p_picked_index: input.pickedIndex ?? undefined,
  });
  if (error) return fail(error);
  const row = data as unknown as { id?: string; restored?: boolean } | null;
  /*
    **`restored`를 화면까지 넘긴다.** 되살린 것은 스케줄이 그대로 보존되므로(D-033) 오늘 복습에
    나오지 않을 수 있다 — 그것을 `담았어요`라고 말하면 일어나지 않은 일을 알리는 셈이다.
  */
  return { ok: true, id: row?.id, restored: row?.restored ?? false };
}

/**
 * 지운 오답을 되돌린다.
 *
 * 메모·별표는 물론 **복습 스케줄과 복습 기록까지 그대로 있다** — 행을 지우지 않았으므로
 * 되돌릴 것이 없다. 지우기 되돌리기가 "없던 일"이 되는 것이 D-033이고, 물리 삭제로는 그것이
 * 성립하지 않았다(자식 로그가 cascade로 함께 사라진다).
 *
 * 인자로 노트를 통째로 받는 시그니처를 유지한다 — 화면이 되돌리기 배너에서 그 값을 들고 있고,
 * 목록의 자리도 그것으로 맞춘다.
 */
export async function restoreNote(note: WrongNote): Promise<WriteResult> {
  const { error } = await supabase()
    .from('wrong_notes')
    .update({ dismissed_at: null })
    .eq('id', note.id);
  return error ? fail(error) : { ok: true };
}

/**
 * 오답노트에서 뺀다. **물리 삭제가 아니다.**
 *
 * DB에서 `delete` 권한을 회수했으므로(0037) 이 경로가 유일하다. 되돌리기가 복습 기록을
 * 되살릴 수 있어야 하고, `graduated` 판정의 근거가 그 기록이다.
 */
export async function removeNote(id: string): Promise<WriteResult> {
  const { error } = await supabase()
    .from('wrong_notes')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id);
  return error ? fail(error) : { ok: true };
}

/**
 * 메모와 별표. **스케줄은 여기로 못 쓴다** — DB 트리거가 막는다(0037 §5).
 *
 * `mastered`는 화이트리스트에서 뺐다. 쓰는 화면이 없어졌고(A-087), 남겨 두면 다음 사람이
 * 숙달 판정에 다시 끌어 쓸 수 있는 자리가 된다.
 */
export async function setNoteFields(
  id: string,
  fields: { dig?: string; starred?: boolean },
): Promise<WriteResult> {
  const { error } = await supabase().from('wrong_notes').update(fields).eq('id', id);
  return error ? fail(error) : { ok: true };
}

// ── 담아 둔 학습 ─────────────────────────────────────────────────────────────

/** 담은 순서대로. **개인 학습만 담긴다**(D-012) — 그래서 `source` 컬럼이 없다. */
export async function loadQueue(): Promise<QueueEntry[]> {
  const { data, error } = await supabase()
    .from('study_queue')
    .select('content_set_id, position')
    .order('position');
  if (error) throw new Error(errorMessage(error));
  return (data ?? []).map((q) => ({ itemId: `li_${q.content_set_id}`, contentId: q.content_set_id }));
}

export async function addToQueue(contentId: string, position: number): Promise<WriteResult> {
  const uid = (await supabase().auth.getSession()).data.session?.user.id;
  if (!uid) return { ok: false, error: '다시 로그인해 주세요.' };
  const { error } = await supabase()
    .from('study_queue')
    .upsert({ student_id: uid, content_set_id: contentId, position }, { onConflict: 'student_id,content_set_id' });
  return error ? fail(error) : { ok: true };
}

export async function removeFromQueue(contentIds: readonly string[]): Promise<WriteResult> {
  if (contentIds.length === 0) return { ok: true };
  const { error } = await supabase()
    .from('study_queue')
    .delete()
    .in('content_set_id', [...contentIds]);
  return error ? fail(error) : { ok: true };
}

/** 순서를 다시 쓴다. 화면이 정한 배열 순서를 그대로 `position`에 넣는다. */
export async function setQueueOrder(contentIds: readonly string[]): Promise<WriteResult> {
  const uid = (await supabase().auth.getSession()).data.session?.user.id;
  if (!uid) return { ok: false, error: '다시 로그인해 주세요.' };
  const { error } = await supabase()
    .from('study_queue')
    .upsert(
      contentIds.map((id, i) => ({ student_id: uid, content_set_id: id, position: i })),
      { onConflict: 'student_id,content_set_id' },
    );
  return error ? fail(error) : { ok: true };
}

// ── 반 비교 ──────────────────────────────────────────────────────────────────

/**
 * 학원 과제 하나의 반 평균·순위.
 *
 * **집계만 받는다**(`rpc_class_comparisons`). 학부모는 RLS상 다른 학생의 제출을 볼 수 없고,
 * 그것이 맞다 — 개별 정답률을 열지 않고 평균과 순위만 내려받는다.
 */
export interface ClassComparison {
  submitters: number;
  rank: number | null;
  avg: number | null;
  mine: number | null;
}

/**
 * 한 학생의 모든 학원 과제 반 비교. **한 번의 왕복이다.**
 * 배정마다 따로 부르면 자녀 수 × 과제 수만큼 왕복한다.
 */
export async function classComparisons(
  studentId: string,
): Promise<Record<string, ClassComparison>> {
  const { data, error } = await supabase().rpc('rpc_class_comparisons', {
    p_student_id: studentId,
  });
  if (error) throw new Error(errorMessage(error));
  return (data ?? {}) as unknown as Record<string, ClassComparison>;
}
