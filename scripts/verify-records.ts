/**
 * 학습 기록 검증. **집계와 연속 계산이 SQL 안에 있어서 단위 테스트로 닿지 않는다.**
 *
 *     npx tsx scripts/verify-records.ts
 *
 * `verify-note-schedule.ts`와 같은 방식이다 — seed 계정으로 **실제 로그인해서** 진짜 JWT로
 * RPC를 부르고, 통제된 상황은 소유자 연결(`pg`)로 만든다. `auth.uid()`와 RLS를 보는 코드라
 * JWT 없이는 아무것도 검증되지 않는다.
 *
 * ## 무엇을 확인하는가
 *
 * 1. **일별 집계의 항등식** — `graded = 풀이 + 오답 복습`, `학습일 ⟺ graded >= 3`, 그리고
 *    `rpc_student_records`의 누적·최고·주간이 뷰의 합과 같은지.
 * 2. **연속 학습일과 기록 보호** — 기록이 없는 학생(`doyun`)에 날짜를 심어 사다리를 걸어 본다.
 *    보호가 없으면 끊기는 배열에서 실제로 이어지는지 확인한다(0046이 고친 자리다).
 * 3. **같은 날 재풀이를 두 번 세지 않는지** — 25문항 세트를 앉은 자리에서 두 번 내도 그 날의
 *    문항 수가 한 번만 늘어야 한다.
 * 4. **학습 시간 상한** — 한 번에 받는 양과 하루 총량을 서버가 깎는지.
 * 5. **권한** — 본인·학부모는 읽고, 학원 교직원은 거부되고, 직접 쓰기는 막히는지.
 *
 * ## 끝나면 만든 것을 전부 치운다(`try/finally`)
 *
 * 이 검증은 실제 DB에 쓴다 — 풀이 몇 건, 활동 이벤트, 학습 시간 조각. 남겨 두면 다음 실행과
 * `npm run db:verify`의 seed 총계 단정이 어긋난다(`verify-rls.ts`가 같은 실수를 실측으로
 * 기록해 두었다).
 *
 * **`npm test`에 넣지 않는다.** 네트워크와 원격 DB 자격 증명이 필요하다.
 */
import { type Client } from 'pg';
import { check, eq, ownerClient, requireEnv, results, signIn } from './_verify';
import { addDaysISO } from '../src/features/clock';
import {
  STUDY_DAY_QUESTIONS,
  STUDY_TIME_DAY_CAP_SEC,
  STUDY_TIME_FLUSH_CAP_SEC,
} from '../src/features/records';
import type { StudentRecords } from '../src/repo/records';

requireEnv();

/*
  상한은 `src/features/records.ts`에서 가져온다 — 예전에는 이 파일에 `FLUSH_CAP`·`DAY_CAP`을
  다시 선언하고 본문에서 `900`을 또 인라인했다. `STUDY_DAY_QUESTIONS`가 이미 그 방식이다.
*/
const FLUSH_CAP = STUDY_TIME_FLUSH_CAP_SEC;
const DAY_CAP = STUDY_TIME_DAY_CAP_SEC;

interface ViewRow {
  day: string;
  sets_completed: number;
  solved_questions: number;
  correct_questions: number;
  reviews_done: number;
  reviews_correct: number;
  notes_added: number;
  notes_mastered: number;
  active_sec: number;
  graded_questions: number;
  counts_as_study_day: boolean;
}

async function uidOf(scodyId: string): Promise<string> {
  const client = await signIn(scodyId);
  const { data } = await client.auth.getUser();
  return data.user!.id;
}

/** 서비스가 보는 오늘(`Asia/Seoul`). 기기 시간대로 계산하면 하루 어긋난다. */
async function todayKst(db: Client): Promise<string> {
  const { rows } = await db.query<{ d: string }>(
    `select public.today_kst()::text as d`,
  );
  return rows[0].d;
}

/*
  날짜 산술은 `addDaysISO`(`src/features/clock.ts`)를 쓴다. 이 파일에 사본이 있었는데, 그 함수의
  docblock이 이미 `여섯 번째 사본을 만들기 전에 둘 중 하나로 모은다`고 적어 둔 자리였다.
*/
const shift = addDaysISO;

async function main() {
  const db = ownerClient();
  await db.connect();

  const yerin = await signIn('yerin');
  const yerinId = await uidOf('yerin');
  /*
    **박도윤은 기록이 없는 학생이다.** 연속 계산을 통제된 배열로 걸어 보려면 다른 기록이 섞이지
    않아야 한다. 소유자 연결로 심고, 읽기는 이 계정의 JWT로 한다 — `rpc_student_records`는
    `auth.uid()`를 보므로 소유자 연결에서 부르면 `can_read_student`가 거짓이 된다(실측).
  */
  const doyun = await signIn('doyun');
  const doyunId = await uidOf('doyun');
  const today = await todayKst(db);

  /*
    **정리는 이 스크립트가 만든 것만 치운다.**

    처음 판본은 `delete from study_activity where student_id = yerin`이었는데, seed도 정예린의
    학습 시간을 넣으므로(`gen-seed.ts`) 그 삭제가 **seed 행까지 지웠다.** 그러면 다음 실행이
    seed 상태가 아닌 DB에서 다른 답을 낸다 — `verify-rls.ts`가 실측으로 기록해 둔 함정이다.
    기준선 뒤에 생긴 행만 지운다.
  */
  async function maxId(table: string): Promise<number> {
    const { rows } = await db.query<{ n: string }>(
      `select coalesce(max(id), 0)::text as n from ${table}`,
    );
    return Number(rows[0].n);
  }
  const baseTime = await maxId('public.study_activity');
  /*
    **접기가 다시 쓸 수 있는 seed 행을 떠 둔다**(A-151과 같은 이유).

    `compact_study_activity`는 지운 뒤 다시 넣으므로 대상이 된 행의 `id`가 바뀐다. 그러면 아래
    정리(`id > baseTime`인 행만 지운다)가 **seed 행을 지운다** — 창 밖의 오래된 날이 그 대상이다.
    범위가 작으므로(seed는 최근 5주라 한두 행) 통째로 떠 두고 정리에서 되돌린다.
  */
  const preWindowCut = shift(today, -28);
  const preWindow = await db.query<{
    student_id: string;
    occurred_at: string;
    occurred_on: string;
    kind: string;
    ref_id: string | null;
    active_sec: number;
  }>(
    `select student_id::text, occurred_at::text, occurred_on::text, kind::text, ref_id::text, active_sec
       from public.study_activity where occurred_on < $1::date order by id`,
    [preWindowCut],
  );
  const baseEvent = await maxId('public.learning_events');
  const seedTimeSum = Number(
    (
      await db.query<{ s: string }>(
        `select coalesce(sum(active_sec), 0)::text as s from public.study_activity`,
      )
    ).rows[0].s,
  );
  const baseAttempts = (
    await db.query<{ n: string }>(`select count(*)::text as n from public.attempts`)
  ).rows[0].n;

  try {
    // ── 1. 일별 집계의 항등식 ────────────────────────────────────────────────
    console.log('\n[일별 집계]');

    const view = await yerin
      .from('v_daily_learning_stats')
      .select('*')
      .eq('student_id', yerinId)
      .order('day');
    check('학생이 자기 일별 집계를 읽는다', !view.error, view.error?.message ?? '');
    const rows = (view.data ?? []) as unknown as ViewRow[];
    check('seed 학생에게 집계 행이 있다', rows.length > 0, `${rows.length}행`);

    check(
      'graded = 푼 문항 + 다시 푼 오답',
      rows.every((r) => r.graded_questions === r.solved_questions + r.reviews_done),
      JSON.stringify(rows.filter((r) => r.graded_questions !== r.solved_questions + r.reviews_done)),
    );
    check(
      `학습일 ⟺ 채점 문항 ${STUDY_DAY_QUESTIONS}개 이상`,
      rows.every((r) => r.counts_as_study_day === r.graded_questions >= STUDY_DAY_QUESTIONS),
      JSON.stringify(
        rows.filter((r) => r.counts_as_study_day !== r.graded_questions >= STUDY_DAY_QUESTIONS),
      ),
    );
    /*
      **오답 복습만 한 날이 학습일이 아닌 것을 실제로 확인한다.** 규칙을 적어 두는 것과 그
      규칙이 데이터에 나타나는 것은 다르다 — seed에는 복습 한 장만 남은 날이 있다.
    */
    const reviewOnly = rows.filter((r) => r.solved_questions === 0 && r.reviews_done > 0);
    check(
      '오답 복습 한두 장만 한 날은 학습일이 아니다',
      reviewOnly.length > 0 &&
        reviewOnly.every((r) =>
          r.reviews_done >= STUDY_DAY_QUESTIONS ? r.counts_as_study_day : !r.counts_as_study_day,
        ),
      JSON.stringify(reviewOnly),
    );

    const rpc = await yerin.rpc('rpc_student_records', { p_student_id: yerinId });
    check('기록 묶음을 읽는다', !rpc.error, rpc.error?.message ?? '');
    const rec = rpc.data as unknown as StudentRecords;

    eq(
      '누적 학습일 = 학습일로 센 행 수',
      rec.totals.studyDays,
      rows.filter((r) => r.counts_as_study_day).length,
    );
    eq(
      '누적 문항 = 일별 합',
      rec.totals.solvedQuestions,
      rows.reduce((s, r) => s + r.solved_questions, 0),
    );
    eq(
      '누적 오답 복습 = 일별 합',
      rec.totals.reviewsDone,
      rows.reduce((s, r) => s + r.reviews_done, 0),
    );
    eq(
      '하루 최다 풀이 = 일별 최댓값',
      rec.bests.questions.value,
      Math.max(...rows.map((r) => r.solved_questions)),
    );
    eq('잔디는 28칸이다', rec.days.length, 28);
    eq('잔디의 마지막 칸이 오늘이다', rec.days[rec.days.length - 1].day, today);
    check(
      '오늘을 뺀 최고는 오늘 값을 보지 않는다',
      rec.prevBests.questions ===
        Math.max(0, ...rows.filter((r) => r.day < today).map((r) => r.solved_questions)),
      `prev=${rec.prevBests.questions}`,
    );
    /*
      **주간 합은 그 주의 날들만 센다.** 월요일 경계가 하루 어긋나면 이 단정이 깨진다 —
      `date_trunc('week', …)`가 ISO 주(월요일 시작)인 것을 여기서 확인한다.
    */
    const weekRows = rows.filter((r) => r.day >= rec.week.monday && r.day <= today);
    eq(
      '이번 주 문항 = 그 주 날들의 합',
      rec.week.solvedQuestions,
      weekRows.reduce((s, r) => s + r.solved_questions, 0),
    );
    const lastWeekRows = rows.filter(
      (r) => r.day >= rec.lastWeek.monday && r.day < rec.week.monday,
    );
    eq(
      '지난주 문항 = 그 주 날들의 합',
      rec.lastWeek.solvedQuestions,
      lastWeekRows.reduce((s, r) => s + r.solved_questions, 0),
    );
    check(
      '이번 주 월요일은 월요일이다',
      new Date(`${rec.week.monday}T00:00:00Z`).getUTCDay() === 1,
      rec.week.monday,
    );

    /*
      **지난주 같은 시점까지**(0047). 진행 중인 주를 완성된 주와 비교하면 월요일마다 `-100%`가
      뜬다 — 창의 길이가 같아야 비교가 성립한다.
    */
    const elapsed = Math.round(
      (new Date(`${today}T00:00:00Z`).getTime() -
        new Date(`${rec.week.monday}T00:00:00Z`).getTime()) /
        86_400_000,
    );
    eq('지난주 창의 시작은 지난주 월요일이다', rec.lastWeekToDate.monday, shift(rec.week.monday, -7));
    eq(
      '지난주 창의 끝이 이번 주 경과 일수와 같다',
      rec.lastWeekToDate.throughDay,
      shift(rec.week.monday, -7 + elapsed),
    );
    const toDateRows = rows.filter(
      (r) => r.day >= rec.lastWeekToDate.monday && r.day <= (rec.lastWeekToDate.throughDay ?? ''),
    );
    eq(
      '지난주 같은 시점까지의 문항 = 그 창의 합',
      rec.lastWeekToDate.solvedQuestions,
      toDateRows.reduce((s2, r) => s2 + r.solved_questions, 0),
    );
    check(
      '완성된 지난주는 그 창보다 작지 않다',
      rec.lastWeek.solvedQuestions >= rec.lastWeekToDate.solvedQuestions,
      `완성 ${rec.lastWeek.solvedQuestions} · 같은 시점 ${rec.lastWeekToDate.solvedQuestions}`,
    );

    // ── 2. 연속 학습일과 기록 보호 ───────────────────────────────────────────
    //
    // 기록이 없는 학생에 날짜를 심는다. 소유자 연결로 `attempts`를 직접 넣으므로 RLS와
    // `rpc_submit_attempt`의 가드를 지나지 않는다 — 여기서 시험하는 것은 **집계와 연속 계산**이다.
    console.log('\n[연속 학습일]');

    const setId = (
      await db.query<{ id: string }>(
        `select s.id from public.content_sets s
         where s.publish_to_students
         order by (select count(*) from public.questions q where q.content_set_id = s.id) desc
         limit 1`,
      )
    ).rows[0].id;

    async function seedDays(days: readonly string[]) {
      await db.query(`delete from public.attempts where student_id = $1`, [doyunId]);
      await db.query(`delete from public.learning_events where student_id = $1`, [doyunId]);
      let no = 0;
      for (const day of days) {
        no += 1;
        await db.query(
          `insert into public.attempts
             (student_id, content_set_id, source, attempt_no, time_sec, submitted_on,
              correct_count, total_count)
           values ($1, $2, 'personal', $3, 60, $4::date, 4, 5)`,
          [doyunId, setId, no, day],
        );
      }
    }

    async function recordsOfDoyun(): Promise<StudentRecords> {
      const got = await doyun.rpc('rpc_student_records', { p_student_id: doyunId });
      if (got.error) throw new Error(got.error.message);
      return got.data as unknown as StudentRecords;
    }

    async function streakOf(): Promise<StudentRecords['streak']> {
      return (await recordsOfDoyun()).streak;
    }

    // ① 어제까지 사흘 연속. 오늘은 아직 하지 않았다 — 끊기지 않아야 한다.
    await seedDays([shift(today, -3), shift(today, -2), shift(today, -1)]);
    let st = await streakOf();
    eq('사흘 연속이면 3이다', st.current, 3);
    eq('최장도 3이다', st.longest, 3);
    check(
      '오늘을 아직 하지 않아도 끊기지 않는다',
      st.current === 3,
      '오늘을 결석으로 세면 매일 아침 0이 된다',
    );

    // ② 중간에 하루 빠졌고 보호가 없다 — 끊긴다.
    await seedDays([shift(today, -4), shift(today, -3), shift(today, -1)]);
    st = await streakOf();
    eq('보호가 없으면 하루 빠진 자리에서 끊긴다', st.current, 1);
    /* 끊긴 뒤에는 목록을 비운다 — 지금 연속을 지킨 보호만 말해야 한다. */
    eq('끊긴 뒤에는 쓴 날을 말하지 않는다', st.protectedDays.length, 0);
    eq('그래도 최장 기록은 남는다', st.longest, 2);

    /*
      ③ **주간 목표를 채운 주의 다음 결석은 보호가 메운다.**

      `이번 주 월요일 - 7`부터 5일(월~금)을 채우면 금요일에 보호 하나가 생긴다. 토요일을 비우고
      일요일부터 오늘 전날까지 이어 두면, 보호가 없을 때는 토요일에서 끊겨 며칠짜리 연속이
      되고 보호가 있으면 전체가 하나로 이어진다.

      0046 이전 판본은 일요일에 결산했기 때문에 이 배열에서 토요일을 막지 못했다.
    */
    const lastMonday = rec.lastWeek.monday;
    const run: string[] = [];
    for (let i = 0; i < 5; i += 1) run.push(shift(lastMonday, i)); // 월~금
    // 토요일(+5)은 비운다.
    for (let d = shift(lastMonday, 6); d < today; d = shift(d, 1)) run.push(d); // 일~어제
    await seedDays(run);
    st = await streakOf();
    eq('보호가 하루 결석을 메워 연속이 이어진다', st.current, run.length);
    /* 쓴 날을 응답에 담는다(0049) — 화면이 `8월 16일을 메웠어요`를 말하는 근거다. */
    eq('보호를 쓴 날이 하나 담긴다', st.protectedDays.length, 1);
    eq('그 날은 비워 둔 토요일이다', st.protectedDays[0], shift(lastMonday, 5));
    /* 목표를 채운 주가 2개를 주므로(0047) 하루를 메우고 하나가 남는다. */
    eq('하나를 쓰고 하나가 남는다', st.protections, 1);
    check(
      '보호받은 날은 연속을 늘리지 않는다',
      st.current === run.length,
      `공부한 날 ${run.length}일과 같아야 한다 — 결석한 하루를 세면 ${run.length + 1}이 된다`,
    );

    /*
      ④ **결석이 없으면 보호가 쓰이지 않고 남는다.**

      ③의 배열에서 빈 토요일을 채운다. 지난주가 7일이라 금요일에 보호 하나가 생기고
      (`= c_week_goal`이라 6·7일째에는 더 주지 않는다) 쓸 자리가 없으므로 그대로 남는다.

      **처음에는 `월~금만 심고 보호 1개`를 기대했는데 실제는 0이었다.** 스캔이 오늘까지 계속
      돌기 때문에 그 뒤의 토요일이 곧바로 보호를 써 버린다 — 기대가 틀렸고 함수는 맞았다.
      결석이 없는 배열이어야 남은 보호를 볼 수 있다.
    */
    const noGap: string[] = [];
    for (let d = lastMonday; d < today; d = shift(d, 1)) noGap.push(d);
    await seedDays(noGap);
    st = await streakOf();
    eq('결석이 없으면 보호가 그대로 남는다', st.protections, 2);
    eq('연속은 심은 날 수와 같다', st.current, noGap.length);
    check(
      '보유 상한은 2다',
      st.protections === 2,
      `지난주 7일 · 이번 주 ${noGap.filter((d) => d >= rec.week.monday).length}일을 심었다 — ` +
        '한 주가 2개를 주고 상한도 2이므로 더 쌓이지 않는다',
    );

    /*
      ⑤ **주 5일을 매주 지키는 학생의 연속이 이어진다.**

      이것이 0047이 고친 결함이다. 보호가 하나였을 때는 금요일에 하나가 생기고 토요일이 그것을
      소진해 **일요일에 끊겼다** — 주간 목표를 100% 지키는 학생의 최장 연속이 5일에 갇히고
      첫 milestone(7일 연속)이 도달 불가였다. 3주를 월~금으로 심어 그 사다리를 직접 걸어 본다.

      월요일이 아닌 날에 돌려도 성립하도록 **이번 주는 심지 않는다** — 오늘까지의 결석은 보호가
      메우고(있으면) 오늘은 판정하지 않는다.
    */
    const fiveDayWeeks: string[] = [];
    for (let w = 3; w >= 1; w -= 1) {
      const monday = shift(rec.week.monday, -7 * w);
      for (let i = 0; i < 5; i += 1) fiveDayWeeks.push(shift(monday, i));
    }
    await seedDays(fiveDayWeeks);
    st = await streakOf();
    /*
      **`longest`로 판정한다.** 이번 주를 심지 않았으므로 `current`는 0이 맞다 — 지난주 토·일을
      보호가 메운 뒤 이번 주 월요일부터 보호가 없어 끊긴다(그것도 정상 동작이다).
      사다리가 주말을 건넜는지는 최장 기록이 말한다: 보호가 하나면 5, 둘이면 15다.
    */
    eq('주 5일을 3주 지키면 최장 연속이 15일이다', st.longest, fiveDayWeeks.length);
    check(
      '첫 milestone(7일 연속)에 닿는다',
      st.longest >= 7,
      `최장 ${st.longest}일 — 보호가 하나였을 때는 5일이 상한이라 도달 불가였다`,
    );

    // ── 3. 같은 날 재풀이를 두 번 세지 않는다 ────────────────────────────────
    console.log('\n[중복 집계]');

    async function todayQuestions(): Promise<number> {
      return (await recordsOfDoyun()).today.solvedQuestions;
    }

    await db.query(`delete from public.attempts where student_id = $1`, [doyunId]);
    await db.query(`delete from public.learning_events where student_id = $1`, [doyunId]);
    await db.query(
      `insert into public.attempts
         (student_id, content_set_id, source, attempt_no, time_sec, submitted_on,
          correct_count, total_count)
       values ($1, $2, 'personal', 1, 60, $3::date, 4, 5)`,
      [doyunId, setId, today],
    );
    eq('한 번 냈으면 5문항이다', await todayQuestions(), 5);

    await db.query(
      `insert into public.attempts
         (student_id, content_set_id, source, attempt_no, time_sec, submitted_on,
          correct_count, total_count)
       values ($1, $2, 'personal', 2, 60, $3::date, 5, 5)`,
      [doyunId, setId, today],
    );
    eq('같은 날 같은 학습을 다시 내도 5문항이다', await todayQuestions(), 5);

    await db.query(
      `insert into public.attempts
         (student_id, content_set_id, source, attempt_no, time_sec, submitted_on,
          correct_count, total_count)
       values ($1, $2, 'personal', 3, 60, $3::date, 5, 5)`,
      [doyunId, setId, shift(today, -1)],
    );
    eq('다른 날 다시 푼 것은 그 날에 센다', await todayQuestions(), 5);
    const doyunRec = await recordsOfDoyun();
    eq('누적은 두 날을 합해 10문항이다', doyunRec.totals.solvedQuestions, 10);

    // ── 4. 학습 시간 상한 ────────────────────────────────────────────────────
    console.log('\n[학습 시간]');

    /*
      **seed 행을 지우지 않는다.** 남은 방을 지금 상태에서 계산하므로 오늘 이미 쌓인 시간이
      있어도 단정이 성립한다.
    */
    const usedBefore = Number(
      (
        await db.query<{ s: string }>(
          `select coalesce(sum(active_sec), 0)::text as s from public.study_activity
           where student_id = $1 and occurred_on = $2::date`,
          [yerinId, today],
        )
      ).rows[0].s,
    );

    const one = await yerin.rpc('rpc_log_study_time', { p_kind: 'solve', p_active_sec: 90 });
    eq('보낸 만큼 기록한다', one.data, 90);

    const over = await yerin.rpc('rpc_log_study_time', {
      p_kind: 'solve',
      p_active_sec: FLUSH_CAP * 10,
    });
    eq('한 번에 받는 양을 깎는다', over.data, FLUSH_CAP);

    const negative = await yerin.rpc('rpc_log_study_time', { p_kind: 'solve', p_active_sec: -600 });
    eq('음수는 0으로 본다', negative.data, 0);

    const nullish = await yerin.rpc('rpc_log_study_time', {
      p_kind: 'review',
      p_active_sec: null as unknown as number,
    });
    eq('null도 0으로 본다', nullish.data, 0);

    /*
      하루 상한. 남은 방을 한 번에 채우고 그다음 호출이 0을 돌려주는지 본다 —
      `900초씩 32번`을 부르면 왕복이 32번이라, 소유자 연결로 상한 직전까지 채운다.
    */
    const used = usedBefore + 90 + FLUSH_CAP;
    await db.query(
      `insert into public.study_activity (student_id, occurred_on, kind, active_sec)
       select $1, $2::date, 'solve', $4 from generate_series(1, $3)`,
      [yerinId, today, Math.floor((DAY_CAP - used) / FLUSH_CAP), FLUSH_CAP],
    );
    const remainder = (DAY_CAP - used) % FLUSH_CAP;
    if (remainder > 0) {
      await db.query(
        `insert into public.study_activity (student_id, occurred_on, kind, active_sec)
         values ($1, $2::date, 'solve', $3)`,
        [yerinId, today, remainder],
      );
    }
    const full = await yerin.rpc('rpc_log_study_time', { p_kind: 'solve', p_active_sec: 300 });
    eq('하루 상한을 채우면 0을 돌려준다', full.data, 0);
    const sum = (
      await db.query<{ s: string }>(
        `select coalesce(sum(active_sec), 0)::text as s from public.study_activity
         where student_id = $1 and occurred_on = $2::date`,
        [yerinId, today],
      )
    ).rows[0].s;
    eq('하루 총량이 상한을 넘지 않는다', Number(sum), DAY_CAP);

    // `attempts.time_sec`의 위쪽 경계(0043의 트리거).
    await db.query(
      `insert into public.attempts
         (student_id, content_set_id, source, attempt_no, time_sec, submitted_on,
          correct_count, total_count)
       values ($1, $2, 'personal', 9, 36000, $3::date, 1, 5)`,
      [doyunId, setId, today],
    );
    const clamped = (
      await db.query<{ t: number }>(
        `select time_sec as t from public.attempts where student_id = $1 and attempt_no = 9`,
        [doyunId],
      )
    ).rows[0].t;
    check(
      '열어 둔 탭이 만든 10시간은 깎인다',
      clamped === Math.max(600, 5 * 900),
      `실제 ${clamped}초`,
    );

    // ── 4-1. 오래된 학습 시간 접기(A-150) ────────────────────────────────────
    //
    // **하루의 합이 바뀌지 않아야 한다.** 접기가 잃는 것은 `ref_id`와 조각의 시각뿐이고, 그 둘은
    // 어떤 화면도 읽지 않는다. 합이 바뀌면 잔디·주간 비교·누적이 함께 바뀐다.
    console.log('\n[학습 시간 접기]');

    /*
      **박도윤에 심는다.** seed는 풀이가 있는 학생에게만 학습 시간을 넣으므로(`gen-seed.ts`)
      이 학생의 `study_activity`는 전부 이 스크립트가 만든 것이다.

      두 날에 심어 창의 경계를 함께 시험한다 — 400일 전(접힌다)과 20일 전(접히지 않는다).
    */
    const oldDay = shift(today, -400);
    const insideDay = shift(today, -20);
    for (let i = 0; i < 6; i += 1) {
      await db.query(
        `insert into public.study_activity (student_id, occurred_on, kind, ref_id, active_sec)
         values ($1, $2::date, 'solve', null, $3)`,
        [doyunId, oldDay, 100 + i],
      );
    }
    for (let i = 0; i < 3; i += 1) {
      await db.query(
        `insert into public.study_activity (student_id, occurred_on, kind, ref_id, active_sec)
         values ($1, $2::date, 'review', null, $3)`,
        [doyunId, insideDay, 90],
      );
    }
    const oldSum = 100 + 101 + 102 + 103 + 104 + 105;

    async function dayRows(day: string): Promise<{ rows: number; total: number }> {
      const r = await db.query<{ n: string; s: string }>(
        `select count(*)::text as n, coalesce(sum(active_sec), 0)::text as s
           from public.study_activity where student_id = $1 and occurred_on = $2::date`,
        [doyunId, day],
      );
      return { rows: Number(r.rows[0].n), total: Number(r.rows[0].s) };
    }

    eq('접기 전에는 조각이 6행이다', (await dayRows(oldDay)).rows, 6);

    const freed = (
      await db.query<{ freed: number }>(`select public.compact_study_activity(365) as freed`)
    ).rows[0].freed;
    const folded = await dayRows(oldDay);
    eq('오래된 하루가 한 행으로 접혔다', folded.rows, 1);
    eq('접어도 그 날의 합은 그대로다', folded.total, oldSum);
    eq('줄어든 행 수를 돌려준다', freed, 5);
    eq('보관 창 안의 날은 접지 않는다', (await dayRows(insideDay)).rows, 3);

    /* 접힌 행은 되짚을 대상이 하나가 아니므로 `ref_id`를 비운다. */
    const refs = await db.query<{ n: string }>(
      `select count(*)::text as n from public.study_activity
         where student_id = $1 and occurred_on = $2::date and ref_id is not null`,
      [doyunId, oldDay],
    );
    eq('접힌 행에는 ref_id가 없다', Number(refs.rows[0].n), 0);

    /* 접은 뒤에도 일별 집계가 같은 값을 낸다 — 화면이 읽는 것은 이 뷰다. */
    const viewSum = await db.query<{ s: string }>(
      `select coalesce(sum(active_sec), 0)::text as s from public.v_daily_learning_stats
         where student_id = $1 and day = $2::date`,
      [doyunId, oldDay],
    );
    eq('일별 집계가 접기 전과 같다', Number(viewSum.rows[0].s), oldSum);

    /* 두 번 접어도 더 줄지 않는다(멱등). */
    const again = (
      await db.query<{ freed: number }>(`select public.compact_study_activity(365) as freed`)
    ).rows[0].freed;
    eq('이미 접힌 것을 다시 접지 않는다', again, 0);

    /*
      **보관 창의 바닥이 28일이다.** `10`을 넣어도 잔디가 보는 창(28일)은 접지 않는다.
      20일 전에 심은 세 행이 그 바닥을 시험한다 — 바닥이 없으면 잘린다.

      이 호출은 창 밖의 **seed 행도** 다시 쓴다(그것이 이 함수의 일이다). 위에서 떠 둔
      `preWindow`를 정리에서 되돌린다.
    */
    await db.query(`select public.compact_study_activity(10)`);
    eq('보관 10일을 넣어도 28일 바닥이 이긴다', (await dayRows(insideDay)).rows, 3);

    /* 앱 역할은 이 함수를 부를 수 없다 — 지우는 함수를 클라이언트에 열지 않는다. */
    const asStudent = await yerin.rpc('compact_study_activity' as never, { p_keep_days: 0 } as never);
    check(
      '학생은 접기 함수를 부를 수 없다',
      !!asStudent.error,
      asStudent.error?.message ?? '막히지 않았다',
    );

    // ── 5. 권한 ──────────────────────────────────────────────────────────────
    console.log('\n[권한]');

    const minji = await signIn('minji'); // 최민지 — 자녀: 이하은, 정예린
    const asParent = await minji.rpc('rpc_student_records', { p_student_id: yerinId });
    check('학부모는 자녀 기록을 읽는다', !asParent.error, asParent.error?.message ?? '');
    const parentBundle = await minji.rpc('rpc_readable_records');
    check(
      '자녀 목록은 서버가 정한다',
      !parentBundle.error && Object.keys(parentBundle.data ?? {}).includes(yerinId),
      parentBundle.error?.message ?? JSON.stringify(Object.keys(parentBundle.data ?? {})),
    );

    const teacher = await signIn('hanbit.teacher');
    const asTeacher = await teacher.rpc('rpc_student_records', { p_student_id: yerinId });
    check('학원 선생님은 거부된다', !!asTeacher.error, asTeacher.error?.message ?? '거부되지 않았다');
    const teacherView = await teacher
      .from('v_daily_learning_stats')
      .select('*')
      .eq('student_id', yerinId);
    eq('선생님에게 일별 집계는 0행이다', (teacherView.data ?? []).length, 0);
    const teacherTime = await teacher
      .from('study_activity')
      .select('*')
      .eq('student_id', yerinId);
    eq('선생님에게 학습 시간은 0행이다', (teacherTime.data ?? []).length, 0);

    const director = await signIn('hanbit.director');
    const asDirector = await director.rpc('rpc_student_records', { p_student_id: yerinId });
    check('원장도 거부된다', !!asDirector.error, asDirector.error?.message ?? '거부되지 않았다');

    const otherParent = await signIn('jihoon'); // 한지훈 — 자녀는 박도윤뿐이다
    const cross = await otherParent.rpc('rpc_student_records', { p_student_id: yerinId });
    check(
      '연결되지 않은 학부모는 거부된다',
      !!cross.error,
      cross.error?.message ?? '거부되지 않았다',
    );

    const directInsert = await yerin
      .from('study_activity')
      .insert({ student_id: yerinId, kind: 'solve', active_sec: 600 });
    check(
      '학습 시간을 직접 넣을 수 없다',
      !!directInsert.error,
      directInsert.error?.message ?? '막히지 않았다',
    );
    const directDelete = await yerin.from('study_activity').delete().eq('student_id', yerinId);
    check(
      '학습 시간을 지울 수 없다(append-only)',
      !!directDelete.error,
      directDelete.error?.message ?? '막히지 않았다',
    );
    /*
      `graduated_on`은 서버만 쓴다. 학생이 직접 쓰면 `익힌 오답 500개`를 PATCH 한 번으로
      만들 수 있고, 그러면 이 값이 학습의 사실이 아니라 자기 신고가 된다.
    */
    const noteId = (
      await db.query<{ id: string }>(
        `select id from public.wrong_notes where student_id = $1 and dismissed_at is null limit 1`,
        [yerinId],
      )
    ).rows[0]?.id;
    if (noteId) {
      const patch = await yerin
        .from('wrong_notes')
        .update({ graduated_on: today })
        .eq('id', noteId);
      check(
        '익힘 날짜를 직접 쓸 수 없다',
        !!patch.error,
        patch.error?.message ?? '막히지 않았다',
      );
    } else {
      check('익힘 날짜 검사를 위한 노트가 있다', false, 'seed에 노트가 없다');
    }
  } finally {
    // ── 정리 ─────────────────────────────────────────────────────────────────
    console.log('\n[정리]');
    // 박도윤은 seed에 풀이가 없다 — 이 스크립트가 넣은 것이 전부다.
    await db.query(`delete from public.attempts where student_id = $1`, [doyunId]);
    await db.query(`delete from public.learning_events where id > $1`, [baseEvent]);
    await db.query(`delete from public.study_activity where id > $1`, [baseTime]);
    /*
      접기가 다시 쓴 창 밖 행을 원래 값으로 되돌린다. 위 삭제가 새 id를 함께 지웠으므로
      남아 있을 수 있는 원본까지 지운 뒤 스냅샷을 다시 넣는다 — 그러면 두 경로 모두에서
      결과가 같다(접혔든 안 접혔든).
    */
    await db.query(`delete from public.study_activity where occurred_on < $1::date`, [
      preWindowCut,
    ]);
    for (const r of preWindow.rows) {
      await db.query(
        `insert into public.study_activity (student_id, occurred_at, occurred_on, kind, ref_id, active_sec)
         values ($1, $2::timestamptz, $3::date, $4::public.study_activity_kind, $5, $6)`,
        [r.student_id, r.occurred_at, r.occurred_on, r.kind, r.ref_id, r.active_sec],
      );
    }
    eq(
      '창 밖 학습 시간이 seed 상태로 돌아왔다',
      Number(
        (
          await db.query<{ n: string }>(
            `select count(*)::text as n from public.study_activity where occurred_on < $1::date`,
            [preWindowCut],
          )
        ).rows[0].n,
      ),
      preWindow.rowCount ?? 0,
    );

    eq(
      '박도윤의 풀이가 남지 않았다',
      Number(
        (
          await db.query<{ n: string }>(
            `select count(*)::text as n from public.attempts where student_id = $1`,
            [doyunId],
          )
        ).rows[0].n,
      ),
      0,
    );
    eq(
      '풀이 총계가 seed 상태로 돌아왔다',
      (await db.query<{ n: string }>(`select count(*)::text as n from public.attempts`)).rows[0].n,
      baseAttempts,
    );
    /*
      **id가 아니라 합으로 단정한다.** 접기가 창 밖 행을 다시 넣으므로 `max(id)`는 기준선으로
      돌아가지 않는다 — 돌아가야 하는 것은 값이다.
    */
    eq(
      '학습 시간 총합이 seed 상태로 돌아왔다',
      Number(
        (
          await db.query<{ s: string }>(
            `select coalesce(sum(active_sec), 0)::text as s from public.study_activity`,
          )
        ).rows[0].s,
      ),
      seedTimeSum,
    );
    eq('활동 이벤트가 기준선으로 돌아왔다', await maxId('public.learning_events'), baseEvent);
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
