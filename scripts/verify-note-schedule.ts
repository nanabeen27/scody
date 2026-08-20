/**
 * 복습 스케줄 검증. **상태 기계가 SQL 안에 있어서 단위 테스트로 닿지 않는다.**
 *
 *     npx tsx scripts/verify-note-schedule.ts
 *
 * `verify-rls.ts`와 같은 방식이다 — seed 계정으로 **실제 로그인해서** 진짜 JWT로 RPC를 부른다.
 * `auth.uid()`를 보는 함수라 JWT 없이는 아무것도 검증되지 않는다.
 *
 * **하루 한 번 제약을 어떻게 넘는가**: `rpc_log_note_review`는 같은 날 두 번째 복습을 거부한다
 * (그것이 "서로 다른 세션"의 정의다). 사다리를 걸어 보려면 날짜가 달라야 하므로, 한 걸음마다
 * 소유자 연결(`pg`)로 방금 남은 로그의 `reviewed_on`을 하루 뒤로 물린다. 클라이언트에는 없는
 * 권한이고, 그래서 이 스크립트가 필요하다.
 *
 * **끝나면 만든 것을 전부 치운다**(`try/finally`). 이 검증은 실제 DB에 쓴다 — 복습 로그와 한
 * 노트의 스케줄 컬럼. 남겨 두면 다음 실행과 `npm run db:verify`의 총계 단정이 어긋난다
 * (`verify-rls.ts`가 같은 실수를 실측으로 기록해 두었다).
 *
 * **`npm test`에 넣지 않는다.** 네트워크와 원격 DB 자격 증명이 필요하다.
 */
import { type Client } from 'pg';
import { check, eq, ownerClient, requireEnv, results, signIn } from './_verify';
import { GRADUATE_STREAK } from '../src/features/review';

requireEnv();

/**
 * 가드를 잠깐 열고 스케줄을 직접 쓴다. **소유자 연결에서만 되는 일이라 이 스크립트가 필요하다.**
 *
 * `try/finally`가 핵심이다 — 예전에는 여닫는 3줄이 아홉 자리에 복제돼 있었고, 중간 쿼리가 던지면
 * 플래그가 이 연결에 켜진 채 남았다.
 *
 * **가드 검사가 거짓으로 통과하는 것은 아니다** — 아래 `state 직접 UPDATE 거부` 같은 단정은 전부
 * `student`(PostgREST)로 보내고 그쪽은 다른 연결이라 이 세션 GUC가 닿지 않는다. 새는 범위는 이
 * 스크립트가 뒤이어 보내는 **소유자 쓰기**이고, 그러면 `backdate`가 손대지 않기로 한 `stuck`의
 * `due_on`까지 함께 움직여 뒤따르는 시작점이 조용히 달라진다.
 */
async function asOwner(db: Client, sql: string, params: unknown[] = []): Promise<void> {
  await db.query(`select set_config('scody.note_schedule', 'on', false)`);
  try {
    await db.query(sql, params);
  } finally {
    await db.query(`select set_config('scody.note_schedule', '', false)`);
  }
}

/**
 * **다음 세션으로 시간을 넘긴다.**
 *
 * 두 가지를 함께 한다.
 * 1. 남긴 로그를 하루 뒤로 물린다 — 그래야 다음 복습이 "다른 세션"이 된다(`(note_id,
 *    reviewed_on)` 유니크가 그 정의다).
 * 2. **차례를 오늘로 당긴다** — 0040부터 서버는 차례가 아닌 복습에 스케줄을 움직이지 않는다.
 *    실제로는 7일·21일이 지나야 그날이 오지만 테스트에서 시간은 흐르지 않으므로, "그날이 왔다"를
 *    소유자 권한으로 재현한다. 이것을 하지 않으면 사다리가 첫 칸에서 멈춘다.
 *
 * `stuck`(due_on이 null)은 건드리지 않는다 — 그 상태를 시험하는 단정이 있다.
 */
async function backdate(db: Client, noteId: string) {
  await db.query(
    `update public.note_reviews
       set reviewed_on = reviewed_on - 1
       where note_id = $1`,
    [noteId],
  );
  await asOwner(
    db,
    `update public.wrong_notes
       set due_on = public.today_kst()
       where id = $1 and due_on is not null`,
    [noteId],
  );
}

/**
 * 이 노트의 정답 자리. **정오는 서버가 판정하므로 테스트도 고른 자리로 말해야 한다.**
 *
 * 앞선 판본의 RPC는 `p_is_correct`를 받았고, 그래서 학생이 문항을 열지도 않고 서로 다른 3일에
 * `true`를 보내 졸업시킬 수 있었다(0040이 고쳤다).
 */
async function answerOf(db: Client, noteId: string): Promise<{ answer: number; wrong: number }> {
  const r = await db.query<{ answer_index: number; n: number }>(
    `select q.answer_index, coalesce(array_length(q.choices, 1), 0) as n
       from public.wrong_notes w join public.questions q on q.id = w.question_id
       where w.id = $1`,
    [noteId],
  );
  const { answer_index: answer, n } = r.rows[0];
  return { answer, wrong: (answer + 1) % Math.max(1, n) };
}

type Sched = { state: string; due_on: string | null; streak: number; miss_streak: number };

async function sched(db: Client, noteId: string): Promise<Sched> {
  const r = await db.query<Sched>(
    `select state, due_on::text as due_on, streak, miss_streak
       from public.wrong_notes where id = $1`,
    [noteId],
  );
  return r.rows[0];
}

/** `today_kst()` 기준으로 며칠 뒤인가. 서버 날짜로 계산해 로컬 시간대에 기대지 않는다. */
async function daysFromToday(db: Client, due: string | null): Promise<number | null> {
  if (due === null) return null;
  const r = await db.query<{ d: number }>(
    `select ($1::date - public.today_kst())::int as d`,
    [due],
  );
  return r.rows[0].d;
}

async function main() {
  const db = ownerClient();
  await db.connect();
  const student = await signIn('yerin');
  const { data: me } = await student.auth.getUser();
  const uid = me.user!.id;

  // 검증에 쓸 노트 하나. **개인 학습 노트를 고른다** — 학원 노트는 선생님이 보는 값이라
  // 스케줄을 흔들었다가 되돌리는 대상으로 삼지 않는다.
  const picked = await db.query<{ id: string }>(
    `select id from public.wrong_notes
       where student_id = $1 and source = 'personal' and dismissed_at is null
       order by created_at limit 1`,
    [uid],
  );
  if (picked.rowCount === 0) throw new Error('정예린의 개인 학습 오답노트가 없어요. seed를 먼저 넣어 주세요.');
  const noteId = picked.rows[0].id;
  const before = await sched(db, noteId);
  /*
    **seed가 이 노트에 넣어 둔 복습 로그를 그대로 떠 둔다**(A-151).

    이 스크립트는 세 자리에서 `delete from note_reviews where note_id = $1`을 부르고, `backdate`는
    그 노트의 **모든** 행의 `reviewed_on`을 하루씩 뒤로 물린다 — 둘 다 seed 행을 함께 건드린다.
    그래서 이 스크립트를 돌린 뒤 `verify-rls.ts`가 3건 실패했다(`복습 기록 6건` · `정예린에게
    6건` · `학부모는 자녀 기록을 읽는다`). 재시드하면 사라지므로 오래 눈에 띄지 않았다.

    지우기를 좁히는 대신 **되돌린다.** 중간 삭제는 각 시나리오의 시작점을 맞추는 의도된 동작이고,
    좁히려면 세 자리 모두에 조건을 달아야 하는데 그중 하나만 빠뜨리면 같은 결함이 돌아온다.
    끝에서 행을 그대로 다시 넣으면 `reviewed_on`이 물러난 것까지 함께 복구된다.
  */
  const seedReviews = await db.query<{
    id: string;
    student_id: string;
    reviewed_on: string;
    picked_index: number | null;
    is_correct: boolean;
    evidence: string | null;
    recap: string | null;
    created_at: string;
  }>(
    `select id, student_id, reviewed_on::text as reviewed_on, picked_index, is_correct,
            evidence::text as evidence, recap, created_at::text as created_at
       from public.note_reviews where note_id = $1 order by reviewed_on`,
    [noteId],
  );
  console.log(`검증 대상 노트 ${noteId}`);
  console.log(`시작 상태 ${JSON.stringify(before)}`);
  console.log(`seed 복습 로그 ${seedReviews.rowCount}건\n`);

  try {
    /*
      ── 0. 시작점을 맞춘다 ───────────────────────────────────────────────────

      **시작 상태를 단정하지 않는다.** seed는 화면 확인을 위해 졸업·멈춤 상태를 섞어 넣으므로
      (`src/data/attempts.ts`의 `NOTE_SEEDS`) 어떤 노트가 뽑히느냐에 따라 값이 달라진다. 이
      스크립트가 검증하는 것은 **전이**이지 seed 내용이 아니다.

      그래서 소유자 권한으로 `queued · 오늘 · 0 · 0`으로 맞춘 뒤 사다리를 걷는다. 끝에서
      `before`로 되돌리므로 seed 상태는 보존된다.
    */
    console.log('[시작점 맞추기]');
    await asOwner(
      db,
      `update public.wrong_notes
         set state = 'queued', due_on = public.today_kst(), streak = 0, miss_streak = 0,
             dismissed_at = null
         where id = $1`,
      [noteId],
    );
    await db.query(`delete from public.note_reviews where note_id = $1`, [noteId]);
    /** 다른 학생의 노트. 소유 검사 단정에 쓴다. */
    const other = await db.query<{ id: string }>(
      `select id from public.wrong_notes where student_id <> $1 and dismissed_at is null limit 1`,
      [uid],
    );
    const start = await sched(db, noteId);
    eq('state queued', start.state, 'queued');
    eq('due_on이 오늘', await daysFromToday(db, start.due_on), 0);
    eq('streak 0', start.streak, 0);
    eq('miss_streak 0', start.miss_streak, 0);
    check('오늘 남은 복습 기록이 없다',
      (await db.query(`select 1 from public.note_reviews where note_id = $1`, [noteId])).rowCount === 0);

    // ── 2. 정답 사다리: 7 → 21 → 졸업(30) ──────────────────────────────────
    console.log('\n[정답 사다리]');
    const { answer, wrong } = await answerOf(db, noteId);
    const r1 = await student.rpc('rpc_log_note_review', {
      p_note_id: noteId, p_picked_index: answer, p_evidence: 'passage',
      p_recap: '지문 3단락이 근거였어요',
    });
    check('1회 정답 RPC 성공', !r1.error, r1.error?.message);
    let s = await sched(db, noteId);
    eq('streak 1', s.streak, 1);
    eq('1회 정답 → 7일 뒤', await daysFromToday(db, s.due_on), 7);
    eq('state queued', s.state, 'queued');

    check('같은 날 두 번째 복습은 거부된다',
      (await student.rpc('rpc_log_note_review', { p_note_id: noteId, p_picked_index: answer })).error !== null);

    await backdate(db, noteId);
    const r2 = await student.rpc('rpc_log_note_review', {
      p_note_id: noteId, p_picked_index: answer, p_evidence: 'choices',
    });
    check('2회 정답 RPC 성공', !r2.error, r2.error?.message);
    s = await sched(db, noteId);
    eq('streak 2', s.streak, 2);
    eq('2회 정답 → 21일 뒤', await daysFromToday(db, s.due_on), 21);

    await backdate(db, noteId);
    const r3 = await student.rpc('rpc_log_note_review', { p_note_id: noteId, p_picked_index: answer });
    check('3회 정답 RPC 성공', !r3.error, r3.error?.message);
    s = await sched(db, noteId);
    // 졸업 기준은 TS(`GRADUATE_STREAK`)와 SQL(0040)에 각각 적혀 있다. 상수로 단언해 둬야
    // 한쪽만 바뀌면 여기서 걸린다.
    eq(`연속 정답 ${GRADUATE_STREAK}회`, s.streak, GRADUATE_STREAK);
    eq(`${GRADUATE_STREAK}회 연속 정답 → graduated`, s.state, 'graduated');
    eq('졸업 → 30일 뒤', await daysFromToday(db, s.due_on), 30);
    check('졸업해도 due_on이 있다(큐에서 빠지지 않는다)', s.due_on !== null);

    // ── 3. 졸업 뒤 오답 한 번은 stuck이 아니다 ──────────────────────────────
    console.log('\n[졸업 뒤 오답]');
    await backdate(db, noteId);
    await student.rpc('rpc_log_note_review', { p_note_id: noteId, p_picked_index: wrong });
    s = await sched(db, noteId);
    eq('졸업 뒤 오답 → queued', s.state, 'queued');
    eq('streak 0으로 초기화', s.streak, 0);
    eq('miss_streak 1', s.miss_streak, 1);
    eq('오답 → 1일 뒤', await daysFromToday(db, s.due_on), 1);

    // ── 4. 오답 3회 연속 → stuck ────────────────────────────────────────────
    console.log('\n[연속 오답]');
    await backdate(db, noteId);
    await student.rpc('rpc_log_note_review', { p_note_id: noteId, p_picked_index: wrong });
    s = await sched(db, noteId);
    eq('2회 연속 오답에서는 아직 queued', s.state, 'queued');
    eq('miss_streak 2', s.miss_streak, 2);

    await backdate(db, noteId);
    await student.rpc('rpc_log_note_review', { p_note_id: noteId, p_picked_index: wrong });
    s = await sched(db, noteId);
    eq('3회 연속 오답 → stuck', s.state, 'stuck');
    eq('stuck은 due_on이 null', s.due_on, null);

    // ── 5. 큐 복귀 ──────────────────────────────────────────────────────────
    console.log('\n[큐 복귀]');
    const rq = await student.rpc('rpc_requeue_note', { p_note_id: noteId });
    check('stuck에서 rpc_requeue_note 성공', !rq.error, rq.error?.message);
    s = await sched(db, noteId);
    eq('queued로 돌아온다', s.state, 'queued');
    eq('내일로 잡힌다', await daysFromToday(db, s.due_on), 1);
    eq('miss_streak 초기화', s.miss_streak, 0);
    check('stuck이 아닐 때 rpc_requeue_note는 거부된다',
      (await student.rpc('rpc_requeue_note', { p_note_id: noteId })).error !== null);

    // ── 6. 스케줄을 클라이언트가 못 쓴다 ────────────────────────────────────
    console.log('\n[가드]');
    check('state 직접 UPDATE 거부',
      (await student.from('wrong_notes').update({ state: 'graduated' }).eq('id', noteId)).error !== null);
    check('due_on 직접 UPDATE 거부',
      (await student.from('wrong_notes').update({ due_on: '2099-01-01' }).eq('id', noteId)).error !== null);
    check('streak 직접 UPDATE 거부',
      (await student.from('wrong_notes').update({ streak: 3 }).eq('id', noteId)).error !== null);
    check('메모(dig) UPDATE는 통과한다',
      (await student.from('wrong_notes').update({ dig: null }).eq('id', noteId)).error === null);

    check('note_reviews 직접 INSERT 거부',
      (await student.from('note_reviews')
        .insert({ note_id: noteId, student_id: uid, is_correct: true }).select()).error !== null);
    check('wrong_notes 물리 DELETE 거부',
      (await student.from('wrong_notes').delete().eq('id', noteId)).error !== null);

    // ── 7. 남의 노트 ────────────────────────────────────────────────────────
    console.log('\n[남의 노트]');
    if (other.rowCount) {
      const r = await student.rpc('rpc_log_note_review', {
        p_note_id: other.rows[0].id, p_picked_index: 0,
      });
      check('남의 노트에 복습을 남길 수 없다', r.error !== null, r.error?.message);
    } else {
      console.log('  - 다른 학생의 노트가 없어 건너뜀');
    }

    // ── 8. 지운 노트 ────────────────────────────────────────────────────────
    console.log('\n[지운 노트]');
    await student.from('wrong_notes').update({ dismissed_at: new Date().toISOString() }).eq('id', noteId);
    check('지운 노트에는 복습을 남길 수 없다',
      (await student.rpc('rpc_log_note_review', { p_note_id: noteId, p_picked_index: answer })).error !== null);
    const readd = await db.query<{ state: string; streak: number }>(
      `select state, streak from public.wrong_notes where id = $1`, [noteId]);
    const keptState = readd.rows[0];
    const { data: addBack, error: addErr } = await student.rpc('rpc_add_wrong_note', {
      p_question_id: (await db.query<{ question_id: string }>(
        `select question_id from public.wrong_notes where id = $1`, [noteId])).rows[0].question_id,
      p_content_set_id: (await db.query<{ content_set_id: string }>(
        `select content_set_id from public.wrong_notes where id = $1`, [noteId])).rows[0].content_set_id,
      p_source: 'personal',
    });
    check('다시 담기가 유니크 위반 없이 되살린다', !addErr, addErr?.message);
    check('되살린 것이 같은 행이다', (addBack as { id?: string } | null)?.id === noteId);
    const after = await sched(db, noteId);
    eq('되살려도 state가 그대로다', after.state, keptState.state);
    eq('되살려도 streak이 그대로다', after.streak, keptState.streak);
    const alive = await db.query(`select 1 from public.wrong_notes where id = $1 and dismissed_at is null`, [noteId]);
    check('dismissed_at이 비워졌다', alive.rowCount === 1);

    // ── 8-1. 정오를 서버가 판정한다 ─────────────────────────────────────────
    /*
      **이 스크립트가 놓치고 있던 가장 큰 구멍이다.** 앞선 판본의 RPC는 `p_is_correct`를 받아 그대로
      스케줄에 썼고, 학생이 문항을 열지도 않고 서로 다른 3일에 `true`를 보내 졸업시킬 수 있었다.
      54개 단정이 전부 통과하면서 그것을 잡지 못한 이유는 **정오를 단정하지 않았기** 때문이다.
    */
    console.log('\n[서버 채점]');
    await asOwner(
      db,
      `update public.wrong_notes
         set state = 'queued', due_on = public.today_kst(), streak = 0, miss_streak = 0
         where id = $1`,
      [noteId],
    );
    await db.query(`delete from public.note_reviews where note_id = $1`, [noteId]);

    const { answer: ans2, wrong: wrong2 } = await answerOf(db, noteId);
    const graded = await student.rpc('rpc_log_note_review', {
      p_note_id: noteId, p_picked_index: wrong2,
    });
    check('오답을 보내면 서버가 오답으로 판정한다',
      (graded.data as { isCorrect?: boolean } | null)?.isCorrect === false, graded.error?.message);
    eq('오답이므로 다음은 내일', await daysFromToday(db, (await sched(db, noteId)).due_on), 1);
    check('정오를 인자로 넘길 수 없다(옛 시그니처가 사라졌다)',
      (await student.rpc('rpc_log_note_review',
        { p_note_id: noteId, p_is_correct: true } as never)).error !== null);
    check('선지 범위를 벗어난 답은 거부된다',
      (await student.rpc('rpc_log_note_review', { p_note_id: noteId, p_picked_index: 99 })).error !== null);
    check('음수 답은 거부된다',
      (await student.rpc('rpc_log_note_review', { p_note_id: noteId, p_picked_index: -1 })).error !== null);
    check('고른 답이 없으면 거부된다',
      (await student.rpc('rpc_log_note_review', { p_note_id: noteId })).error !== null);

    // ── 8-2. 차례가 아닌 복습은 일정을 앞당기지 못한다 ──────────────────────
    /*
      `scopedDeck`(별표·영역·전체 덱)은 차례를 보지 않고 열린다. 그 복습이 스케줄을 전진시키면
      3일 연속 전체 복습으로 `1 → 7 → 21`을 3일로 압축해 전부 졸업시킬 수 있었다.
    */
    console.log('\n[차례가 아닌 복습]');
    await backdate(db, noteId);
    await asOwner(
      db,
      `update public.wrong_notes set due_on = public.today_kst() + 10 where id = $1`,
      [noteId],
    );
    const notDue = await student.rpc('rpc_log_note_review', {
      p_note_id: noteId, p_picked_index: ans2, p_evidence: 'passage',
    });
    check('차례가 아니어도 기록은 남는다', !notDue.error, notDue.error?.message);
    check('스케줄을 움직이지 않았다고 알려 준다',
      (notDue.data as { scheduled?: boolean } | null)?.scheduled === false);
    eq('다음 차례가 그대로다', await daysFromToday(db, (await sched(db, noteId)).due_on), 10);
    eq('연속 정답도 오르지 않았다', (await sched(db, noteId)).streak, 0);

    // ── 8-3. 찍어서 맞힌 것은 연속으로 세지 않는다 ──────────────────────────
    console.log('\n[찍어서 맞힘]');
    await backdate(db, noteId);
    await asOwner(
      db,
      `update public.wrong_notes set due_on = public.today_kst() where id = $1`,
      [noteId],
    );
    const guessed = await student.rpc('rpc_log_note_review', {
      p_note_id: noteId, p_picked_index: ans2, p_evidence: 'unsure',
    });
    check('`잘 모르겠어요`로 맞혀도 기록은 남는다', !guessed.error, guessed.error?.message);
    eq('연속 정답이 오르지 않는다', (await sched(db, noteId)).streak, 0);
    eq('내일 다시 본다', await daysFromToday(db, (await sched(db, noteId)).due_on), 1);

    // ── 8-4. 멈춘 문항은 복습을 받지 않는다 ─────────────────────────────────
    console.log('\n[멈춘 문항]');
    await asOwner(
      db,
      `update public.wrong_notes set state = 'stuck', due_on = null, miss_streak = 3 where id = $1`,
      [noteId],
    );
    await backdate(db, noteId);
    check('멈춘 문항에는 복습을 남길 수 없다',
      (await student.rpc('rpc_log_note_review', { p_note_id: noteId, p_picked_index: ans2 })).error !== null);
    check('멈춘 문항은 미룰 수도 없다',
      ((await student.rpc('rpc_defer_note', { p_note_id: noteId })).data as
        { deferred?: boolean } | null)?.deferred === false);

    // ── 8-5. 건너뛰기가 하루 미룬다 ─────────────────────────────────────────
    console.log('\n[건너뛰기]');
    await student.rpc('rpc_requeue_note', { p_note_id: noteId });
    await asOwner(
      db,
      `update public.wrong_notes set due_on = public.today_kst() - 4 where id = $1`,
      [noteId],
    );
    const deferred = await student.rpc('rpc_defer_note', { p_note_id: noteId });
    check('차례가 온 문항을 미룬다',
      (deferred.data as { deferred?: boolean } | null)?.deferred === true, deferred.error?.message);
    eq('내일로 잡힌다', await daysFromToday(db, (await sched(db, noteId)).due_on), 1);
    check('미루기는 복습 기록을 남기지 않는다',
      (await db.query(
        `select 1 from public.note_reviews where note_id = $1 and reviewed_on = public.today_kst()`,
        [noteId])).rowCount === 0);
    check('차례가 아닌 문항은 미뤄지지 않는다',
      ((await student.rpc('rpc_defer_note', { p_note_id: noteId })).data as
        { deferred?: boolean } | null)?.deferred === false);
    check('남의 노트는 미룰 수 없다',
      other.rowCount
        ? (await student.rpc('rpc_defer_note', { p_note_id: other.rows[0].id })).error !== null
        : true);

    // ── 8-6. 한 줄 정리 ─────────────────────────────────────────────────────
    /* 0039에 대한 단정이 하나도 없었다. */
    console.log('\n[한 줄 정리]');
    await asOwner(
      db,
      `update public.wrong_notes set due_on = public.today_kst() where id = $1`,
      [noteId],
    );
    check('오늘 복습 기록이 없으면 한 줄을 쓸 수 없다',
      (await student.rpc('rpc_set_note_review_recap',
        { p_note_id: noteId, p_recap: '없는 기록' })).error !== null);
    await student.rpc('rpc_log_note_review', { p_note_id: noteId, p_picked_index: ans2 });
    const beforeRecap = await sched(db, noteId);
    check('오늘 기록에 한 줄을 채운다',
      !(await student.rpc('rpc_set_note_review_recap',
        { p_note_id: noteId, p_recap: '선지 3번이 지문과 어긋난다' })).error);
    eq('저장된 값이 그것이다',
      (await db.query<{ recap: string | null }>(
        `select recap from public.note_reviews
           where note_id = $1 and reviewed_on = public.today_kst()`, [noteId])).rows[0].recap,
      '선지 3번이 지문과 어긋난다');
    const afterRecap = await sched(db, noteId);
    check('한 줄은 스케줄을 바꾸지 않는다',
      afterRecap.state === beforeRecap.state && afterRecap.due_on === beforeRecap.due_on
        && afterRecap.streak === beforeRecap.streak);
    check('남의 노트에는 한 줄을 쓸 수 없다',
      other.rowCount
        ? (await student.rpc('rpc_set_note_review_recap',
            { p_note_id: other.rows[0].id, p_recap: 'x' })).error !== null
        : true);

    // ── 8-7. 정체성 컬럼을 바꿀 수 없다 ────────────────────────────────────
    /*
      `0037`의 가드는 스케줄 네 컬럼만 봤다. 그래서 학생이 기존 노트를 `source: academy` +
      우리 학원 배정 uuid + 임의 문항으로 PATCH해 담당 선생님 화면에 주입할 수 있었다.
    */
    console.log('\n[정체성 컬럼]');
    check('source 직접 UPDATE 거부',
      (await student.from('wrong_notes').update({ source: 'academy' }).eq('id', noteId)).error !== null);
    check('question_id 직접 UPDATE 거부',
      (await student.from('wrong_notes')
        .update({ question_id: '00000000-0000-0000-0000-000000000001' })
        .eq('id', noteId)).error !== null);
    check('assignment_id 직접 UPDATE 거부',
      (await student.from('wrong_notes')
        .update({ assignment_id: '00000000-0000-0000-0000-000000000001' })
        .eq('id', noteId)).error !== null);
    /* 같은 값을 쓰면 `is distinct from`이 거짓이라 가드가 통과한다 — 다른 값으로 시험한다. */
    check('miss_streak 직접 UPDATE 거부',
      (await student.from('wrong_notes').update({ miss_streak: 2 }).eq('id', noteId)).error !== null);
    check('wrong_notes 직접 INSERT 거부(담기는 RPC만)',
      (await student.from('wrong_notes').insert({
        student_id: uid,
        question_id: (await db.query<{ question_id: string }>(
          `select question_id from public.wrong_notes where id = $1`, [noteId])).rows[0].question_id,
        content_set_id: (await db.query<{ content_set_id: string }>(
          `select content_set_id from public.wrong_notes where id = $1`, [noteId])).rows[0].content_set_id,
        source: 'personal',
      }).select()).error !== null);

    // ── 9. 학원 뷰에 새 컬럼이 없다 ─────────────────────────────────────────
    console.log('\n[학원 경계]');
    const cols = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = 'v_academy_visible_notes'`,
    );
    const names = cols.rows.map((r) => r.column_name);
    for (const forbidden of ['state', 'due_on', 'streak', 'miss_streak', 'dismissed_at', 'starred', 'mastered', 'picked_index']) {
      check(`학원 뷰에 ${forbidden}가 없다`, !names.includes(forbidden));
    }
    const teacher = await signIn('hanbit.teacher');
    const tr = await teacher.from('note_reviews').select('id');
    check('선생님은 note_reviews에서 0행을 받는다', (tr.data?.length ?? -1) === 0, tr.error?.message);
  } finally {
    // ── 정리: 만든 로그를 지우고 스케줄을 시작 상태로 되돌린다 ──────────────
    console.log('\n[정리]');
    await db.query(`delete from public.note_reviews where note_id = $1`, [noteId]);
    /*
      **seed 행을 원래 값으로 다시 넣는다**(A-151). `id`까지 되돌려 다른 검증이 세는 총계와
      학부모·본인 읽기 단정이 seed 상태와 같아진다. 활동 이벤트 트리거는 `after insert`라
      여기서 끈다 — 켜 두면 `learning_events`에 `review_done`이 실행마다 쌓인다
      (그 표는 append-only라 앱 역할이 지울 수 없다).
    */
    if (seedReviews.rowCount && seedReviews.rowCount > 0) {
      await db.query(`alter table public.note_reviews disable trigger note_reviews_event`);
      try {
        for (const r of seedReviews.rows) {
          await db.query(
            `insert into public.note_reviews
               (id, note_id, student_id, reviewed_on, picked_index, is_correct, evidence, recap, created_at)
             values ($1, $2, $3, $4::date, $5, $6, $7::public.note_evidence, $8, $9::timestamptz)`,
            [
              r.id,
              noteId,
              r.student_id,
              r.reviewed_on,
              r.picked_index,
              r.is_correct,
              r.evidence,
              r.recap,
              r.created_at,
            ],
          );
        }
      } finally {
        await db.query(`alter table public.note_reviews enable trigger note_reviews_event`);
      }
    }
    await asOwner(
      db,
      `update public.wrong_notes
         set state = $2, due_on = $3::date, streak = $4, miss_streak = $5, dismissed_at = null
         where id = $1`,
      [noteId, before.state, before.due_on, before.streak, before.miss_streak],
    );
    const restored = await sched(db, noteId);
    check('스케줄이 시작 상태로 돌아왔다',
      restored.state === before.state && restored.streak === before.streak
      && restored.miss_streak === before.miss_streak,
      JSON.stringify(restored));
    /*
      **`0건`이 아니라 `seed 상태`를 단정한다.** 예전 단정은 seed 행까지 지운 것을 통과로 읽었다 —
      그것이 A-151의 결함을 이 스크립트 안에서 보이지 않게 만든 자리다.
    */
    const logs = await db.query<{ reviewed_on: string }>(
      `select reviewed_on::text as reviewed_on from public.note_reviews
         where note_id = $1 order by reviewed_on`,
      [noteId],
    );
    eq('복습 로그가 seed 상태로 돌아왔다', logs.rowCount, seedReviews.rowCount);
    check(
      '복습일도 물러나지 않았다',
      logs.rows.map((r) => r.reviewed_on).join(',') ===
        seedReviews.rows.map((r) => r.reviewed_on).join(','),
      `기대 ${seedReviews.rows.map((r) => r.reviewed_on).join(',')} · 실제 ${logs.rows
        .map((r) => r.reviewed_on)
        .join(',')}`,
    );
    await db.end();
  }

  const { passed, failed } = results();
  console.log(`\n통과 ${passed} · 실패 ${failed}`);
  if (failed > 0) process.exit(1);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
