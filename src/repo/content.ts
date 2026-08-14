import type { ContentSet, Grade, KoreanArea } from '@/data/types';
import { errorMessage, supabase } from '@/lib/supabase';
import { toContentSet, toQuestion } from './mappers';

/**
 * 콘텐츠 조회·등록.
 *
 * **RLS가 무엇을 볼지 정한다**(`can_read_content`): 공개 세트, 우리 학원 세트, 나에게 배정된
 * 세트, 그리고 운영자는 전부. 그래서 이 함수는 "내가 볼 수 있는 전부"를 그대로 가져온다 —
 * 화면이 다시 걸러 낼 필요가 없다.
 */

/** 세트와 문항을 한 번에 읽는다. 문항이 세트마다 10~25개라 N+1을 만들지 않는다. */
const SELECT = `
  id, subject, area, title, kind, grade, topic, publish_to_students,
  passage_title, passage_body, owner_academy_id,
  academies ( name ),
  questions ( id, prompt, choices, answer_index, explanation, position )
` as const;

interface Row {
  id: string;
  subject: string;
  area: string;
  title: string;
  kind: string;
  grade: number | null;
  topic: string | null;
  publish_to_students: boolean;
  passage_title: string | null;
  passage_body: string | null;
  owner_academy_id: string | null;
  academies: { name: string } | null;
  questions: {
    id: string;
    prompt: string;
    choices: string[];
    answer_index: number;
    explanation: string | null;
    position: number;
  }[];
}

function build(row: Row): ContentSet {
  // 문항 순서는 `position`이 정한다. 화면이 `N번 문항`으로 말하고 오답노트도 이 순서다.
  const questions = [...row.questions]
    .sort((a, b) => a.position - b.position)
    .map(toQuestion);
  return toContentSet(row, questions, row.academies?.name);
}

/** 내가 볼 수 있는 콘텐츠 전부. */
export async function listContent(): Promise<ContentSet[]> {
  const { data, error } = await supabase().from('content_sets').select(SELECT).order('created_at');
  if (error) throw new Error(errorMessage(error));
  return (data as unknown as Row[]).map(build);
}

export interface NewContent {
  area: KoreanArea;
  title: string;
  kind: 'passage' | 'grammar';
  passage?: { title: string; body: string };
  questions: { prompt: string; choices: string[]; answerIndex: number; explanation?: string }[];
  publishToStudents: boolean;
  /** 학원이 등록하면 그 학원 id. 운영자 등록이면 비운다. */
  ownerAcademyId?: string;
  grade?: Grade;
  topic?: string;
}

/**
 * 콘텐츠를 등록한다. 세트와 문항을 나눠 넣는다 — 실패하면 세트만 남을 수 있다.
 *
 * **문항 없는 세트를 만들지 않는다**: 문항 삽입이 실패하면 세트를 지운다. RPC로 감쌀 수도
 * 있지만, 이 경로는 사용자가 한 번에 25문항을 쓰는 화면 하나뿐이고 되돌리기가 단순하다.
 */
export async function createContent(input: NewContent): Promise<ContentSet> {
  const db = supabase();
  // 등록한 사람을 남긴다(`content_sets.created_by`). 이 값이 비면 누가 올린 콘텐츠인지 알 수 없다.
  /*
    세션은 로컬 저장소에서 읽는다 — `getUser()`는 매번 서버로 왕복한다.

    **여기만 다르다**: `content_sets_insert`는 `is_admin() or owner_academy_id = my_academy_id()`만
    보고 `created_by`는 검사하지 않는다(0015). 즉 이 컬럼은 서버가 다시 판단해 주지 않는 값이다 —
    등록자 표시·귀속·정산을 이 값으로 만들려면 그 전에 정책에 `created_by = auth.uid()`를 더해야 한다.
  */
  const uid = (await db.auth.getSession()).data.session?.user.id;
  if (!uid) throw new Error('다시 로그인해 주세요.');
  const { data: set, error } = await db
    .from('content_sets')
    .insert({
      area: input.area,
      created_by: uid,
      title: input.title,
      kind: input.kind,
      grade: input.grade ?? null,
      topic: input.topic ?? null,
      publish_to_students: input.publishToStudents,
      owner_academy_id: input.ownerAcademyId ?? null,
      passage_title: input.kind === 'passage' ? (input.passage?.title ?? null) : null,
      passage_body: input.kind === 'passage' ? (input.passage?.body ?? null) : null,
    })
    .select('id')
    .single();
  if (error) throw new Error(errorMessage(error));

  const { error: qError } = await db.from('questions').insert(
    input.questions.map((q, i) => ({
      content_set_id: set.id,
      position: i + 1,
      prompt: q.prompt,
      choices: q.choices,
      answer_index: q.answerIndex,
      explanation: q.explanation ?? null,
    })),
  );
  if (qError) {
    await db.from('content_sets').delete().eq('id', set.id);
    throw new Error(errorMessage(qError));
  }

  const { data, error: readError } = await db
    .from('content_sets')
    .select(SELECT)
    .eq('id', set.id)
    .single();
  if (readError) throw new Error(errorMessage(readError));
  return build(data as unknown as Row);
}

/** 콘텐츠 한 세트의 사용 집계. 문항 id 해시로 만들던 값을 실제 풀이로 바꾼 자리다. */
export interface ContentUsage {
  contentId: string;
  academySolves: number;
  personalSolves: number;
  avgAccuracy: number | null;
  attempts: number;
  wrongRateByQuestion: { questionId: string; position: number; answered: number; wrongRate: number | null }[];
}

/** 아직 아무도 풀지 않은 세트의 사용 집계. `0회`와 `기록 없음`을 화면이 갈라 말할 수 있게 둔다. */
export function emptyUsage(contentId: string): ContentUsage {
  return {
    contentId,
    academySolves: 0,
    personalSolves: 0,
    avgAccuracy: null,
    attempts: 0,
    wrongRateByQuestion: [],
  };
}

/**
 * 모든 콘텐츠의 사용 집계를 한 번에.
 *
 * **왜 `rpc_content_usage`를 세트마다 부르지 않는가**: 목록 화면과 개요의 `오답률 N% 이상 문항`
 * 알림은 세트 전체를 한꺼번에 본다 — 세트가 13개면 왕복이 13번이고, 콘텐츠가 늘면 그대로 늘어난다.
 *
 * 수식은 RPC와 **같다**: 누적 풀이는 `attempts` 건수, 평균 정답률은 문항 수 가중
 * (`sum(correct)/sum(total)`, D-052), 문항 오답률은 `attempt_answers`의 오답 비율이다.
 * 두 경로가 같은 표에서 같은 식으로 세므로 상세와 목록이 다른 말을 하지 않는다.
 *
 * 문항이 어느 세트의 것인지는 화면이 이미 알고 있어서(`ContentSet.questions`) 여기서는
 * 문항 id별 오답률만 준다.
 */
export interface BulkUsage {
  /** 세트 id → 풀이 집계. 풀이가 없는 세트는 키가 없다. */
  bySet: Map<string, { academySolves: number; personalSolves: number; correct: number; total: number }>;
  /** 문항 id → 오답률(%). 아직 아무도 답하지 않은 문항은 키가 없다. */
  wrongRateByQuestion: Map<string, number>;
}

export async function contentUsageAll(): Promise<BulkUsage> {
  const db = supabase();
  const [attempts, answers] = await Promise.all([
    db.from('attempts').select('content_set_id, source, correct_count, total_count'),
    db.from('attempt_answers').select('question_id, is_correct'),
  ]);
  if (attempts.error) throw new Error(errorMessage(attempts.error));
  if (answers.error) throw new Error(errorMessage(answers.error));

  const bySet: BulkUsage['bySet'] = new Map();
  for (const a of attempts.data ?? []) {
    const cur =
      bySet.get(a.content_set_id) ?? { academySolves: 0, personalSolves: 0, correct: 0, total: 0 };
    if (a.source === 'academy') cur.academySolves += 1;
    else cur.personalSolves += 1;
    cur.correct += a.correct_count ?? 0;
    cur.total += a.total_count ?? 0;
    bySet.set(a.content_set_id, cur);
  }

  const tally = new Map<string, { wrong: number; answered: number }>();
  for (const r of answers.data ?? []) {
    const cur = tally.get(r.question_id) ?? { wrong: 0, answered: 0 };
    cur.answered += 1;
    if (!r.is_correct) cur.wrong += 1;
    tally.set(r.question_id, cur);
  }
  const wrongRateByQuestion = new Map<string, number>();
  for (const [id, t] of tally) {
    if (t.answered > 0) wrongRateByQuestion.set(id, Math.round((t.wrong / t.answered) * 100));
  }
  return { bySet, wrongRateByQuestion };
}

export async function contentUsage(contentSetId: string): Promise<ContentUsage> {
  const { data, error } = await supabase().rpc('rpc_content_usage', {
    p_content_set_id: contentSetId,
  });
  if (error) throw new Error(errorMessage(error));
  const raw = data as {
    content_set_id: string;
    academy_solves: number;
    personal_solves: number;
    avg_accuracy: number | null;
    attempts: number;
    wrong_rate_by_question: {
      question_id: string;
      position: number;
      answered: number;
      wrong_rate: number | null;
    }[];
  };
  return {
    contentId: raw.content_set_id,
    academySolves: raw.academy_solves,
    personalSolves: raw.personal_solves,
    avgAccuracy: raw.avg_accuracy,
    attempts: raw.attempts,
    wrongRateByQuestion: raw.wrong_rate_by_question.map((q) => ({
      questionId: q.question_id,
      position: q.position,
      answered: q.answered,
      wrongRate: q.wrong_rate,
    })),
  };
}
