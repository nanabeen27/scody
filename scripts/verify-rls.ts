/**
 * RLS 검증. **허용 경로와 거부 경로를 양쪽 다 확인한다.**
 *
 *     npm run db:verify        # seed를 다시 넣고 검증한다(권장)
 *     npx tsx scripts/verify-rls.ts   # 이미 갓 seed한 상태에서만
 *
 * `.env`의 `EXPO_PUBLIC_SUPABASE_URL`·`EXPO_PUBLIC_SUPABASE_ANON_KEY`를 읽고, seed가 만든
 * 테스트 계정으로 **실제 로그인해서** 정책을 시험한다. 정책은 `auth.uid()`를 보고 판단하므로
 * 진짜 JWT가 없으면 검증이 되지 않는다.
 *
 * **끝나면 바꾼 것을 되돌린다.** 이 검증은 실제 DB에 쓴다 — 풀이 한 건, 배정 한 건, 칭찬·재풀이
 * 요청·주간 요약·감사 로그·대리 보기 기록, 그리고 이름과 학원 소속을 바꾼다. 그것을 그대로 두면
 * **다음 실행이 seed 상태가 아닌 DB에서 다른 답을 낸다.** 실제로 소속을 끝낸 채 남겨 두어
 * `v_academy_visible_notes`가 선생님·원장 모두에게 비었고, 확정 정책 D-054가 깨진 것으로
 * 잘못 읽혔다(그때 정책은 멀쩡했다). 이름은 `박서준`으로 바꾼 것이 live DB에 그대로 남아 있었다.
 *
 * 그래서 마지막에 `[정리]` 단계가 돌고, **되돌린 결과를 다시 단정한다.** 단정이 실패해도,
 * 중간에 `await`가 거부돼도 정리는 돈다(`try/finally`).
 *
 * **그래도 `npm run db:verify`로 돌린다.** seed 총계를 등호로 단정하는 자리가 7곳이라, 앱에서
 * 만든 기록이 남아 있는 DB에서는 그 단정이 깨진다. 정리는 **이 스크립트가 만든 것만** 치운다.
 *
 * **`npm test`에 넣지 않는다.** 네트워크와 원격 DB 자격 증명이 필요해서, 단위 테스트에 넣으면
 * `.env`가 없는 환경에서 전체 테스트가 깨진다. 스키마나 정책을 바꿀 때 손으로 돌린다.
 */
import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Client } from 'pg';

// `.env`를 직접 읽는다 — Expo 밖에서 도는 스크립트라 `process.env`에 자동으로 들어오지 않는다.
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const at = line.indexOf('=');
  if (at > 0 && !line.trimStart().startsWith('#')) {
    process.env[line.slice(0, at).trim()] ??= line.slice(at + 1).trim();
  }
}

const URL_ = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const PASSWORD = 'test1234';

if (!URL_ || !KEY) throw new Error('.env에 EXPO_PUBLIC_SUPABASE_URL·ANON_KEY가 필요해요.');

let failed = 0;
let passed = 0;

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/** 그 계정으로 로그인한 클라이언트. 각자 자기 JWT를 들고 있어야 정책이 갈린다. */
async function signIn(scodyId: string): Promise<SupabaseClient> {
  const client = createClient(URL_, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: `${scodyId}@scody.test`,
    password: PASSWORD,
  });
  if (error) throw new Error(`${scodyId} 로그인 실패: ${error.message}`);
  return client;
}

async function count(client: SupabaseClient, table: string, filter = ''): Promise<number> {
  let query = client.from(table).select('*', { count: 'exact', head: true });
  if (filter) {
    const [col, value] = filter.split('=');
    query = query.eq(col, value);
  }
  const { count: n, error } = await query;
  if (error) return -1;
  return n ?? 0;
}

/** 지금까지의 마지막 활동 이벤트 id. 정리가 **그 뒤에 생긴 것만** 지우게 하는 기준선이다. */
async function lastEventId(client: SupabaseClient): Promise<number> {
  const { data } = await client
    .from('learning_events')
    .select('id')
    .order('id', { ascending: false })
    .limit(1);
  return (data?.[0]?.id as number | undefined) ?? 0;
}

// ── 정리 ─────────────────────────────────────────────────────────────────────
//
// **왜 필요한가**: 검증이 바꾼 것을 그대로 두면 다음 실행이 seed 상태가 아닌 DB에서 시작한다.
// 그 상태에서 나온 결과를 정책 결함으로 읽는 일이 실제로 있었다(맨 위 주석의 D-054 오진).

/** 되돌리기 단계. 각 단계는 되돌린 결과를 스스로 `check`한다 — 공짜로 얻는 단정이다. */
const cleanups: { label: string; run: () => Promise<void> }[] = [];

/**
 * 되돌리기를 등록한다. **바꾼 직후에 등록한다** — 그 뒤에서 무엇이 실패하든 정리가 돈다.
 *
 * `label`은 그 단계 자체가 던졌을 때 결과에 남길 이름이다.
 */
function onCleanup(label: string, run: () => Promise<void>) {
  cleanups.push({ label, run });
}

/*
  **append-only 표는 앱 역할로 지울 수 없다 — 그게 이 검증이 지키는 성질이다.**

  `audit_logs`·`impersonation_sessions`·`learning_events`·`attempts`·`praises`·`retry_requests`·
  `week_summaries`에는 delete 정책이 아예 없다(0015·0024). 그래서 그 행들은 **seed가 쓰는 것과
  같은 경로**로 치운다 — `scripts/run-sql.ts`가 쓰는 풀러 접속(DB 소유자)이다. 앱 역할에 delete를
  열어 주는 것이 아니라, 지울 수 있는 자리를 seed 쪽에 그대로 둔 채 정리만 그 자리에서 한다.
  `supabase/seed.sql`의 truncate 목록이 같은 이유로 이 표들을 담는다(`scripts/gen-seed.ts`).

  지우는 대상은 **이번 실행이 만든 행의 id뿐**이다. 조건으로 넓게 지우지 않는다.
*/
let owner: Client | null = null;

async function ownerExec(sql: string, params: unknown[] = []): Promise<void> {
  if (!owner) {
    const poolerUrl = readFileSync('supabase/.temp/pooler-url', 'utf8').trim();
    const password = process.env.SUPABASE_DB_PASSWORD;
    if (!poolerUrl || !password) {
      throw new Error(
        '정리에 소유자 접속이 필요해요: supabase/.temp/pooler-url과 .env의 SUPABASE_DB_PASSWORD',
      );
    }
    // `connectionString`과 `password`를 함께 주지 않는다 — 이유는 `scripts/run-sql.ts` 주석에 있다.
    const target = new URL(poolerUrl);
    owner = new Client({
      host: target.hostname,
      port: Number(target.port || 5432),
      user: decodeURIComponent(target.username),
      database: target.pathname.replace(/^\//, '') || 'postgres',
      password,
      ssl: { rejectUnauthorized: false },
    });
    await owner.connect();
  }
  await owner.query(sql, params);
}

/** 등록의 **역순**으로 돈다 — 나중에 만든 것을 먼저 치운다. 한 단계가 던져도 나머지는 계속 돈다. */
async function runCleanups() {
  console.log('\n[정리] 검증이 바꾼 것을 seed 상태로 되돌린다');
  for (const step of [...cleanups].reverse()) {
    try {
      await step.run();
    } catch (e) {
      // 조용히 넘기면 다음 실행이 이유 없이 흔들린다. 실패도 결과에 남긴다.
      check(step.label, false, e instanceof Error ? e.message : String(e));
    }
  }
  if (owner) await owner.end();
}

/**
 * 허용·거부 경로 전체.
 *
 * **`main`과 나눠 둔 이유**: 여기서 무엇이 던져도 `main`의 `finally`가 정리를 돌려야 한다.
 * 예전에는 되돌리기가 마지막 블록 안에 있어서, 그 앞의 `await` 하나가 거부되면 끝낸 소속이
 * 그대로 남았다.
 */
async function verify(anon: SupabaseClient) {
  console.log('\n[익명] 아무것도 보이지 않는다');
  for (const table of ['profiles', 'attempts', 'wrong_notes', 'content_sets', 'audit_logs']) {
    check(`${table} 0행`, (await count(anon, table)) === 0);
  }

  console.log('\n[시드 데이터가 실제로 들어갔나]');
  const admin = await signIn('admin');
  check('계정 21개(로그인 9 + 반친구 12)', (await count(admin, 'profiles')) === 21);
  check('콘텐츠 13세트', (await count(admin, 'content_sets')) === 13);
  check('문항 189개', (await count(admin, 'questions')) === 189);
  /*
    **개수를 변수로 들고 간다.** 아래 검증이 배정·풀이를 하나씩 만들고, 정리 단계가 그것을
    치운 뒤 **같은 수로 돌아왔는지** 다시 단정한다. 등호로 단정하는 값 자체는 그대로 둔다.
  */
  const assignmentsAtSeed = await count(admin, 'assignments');
  check('배정 4건', assignmentsAtSeed === 4);
  const attemptsAtSeed = await count(admin, 'attempts');
  check('풀이 32건', attemptsAtSeed === 32);
  check('오답노트 11건', (await count(admin, 'wrong_notes')) === 11);
  check('반 2개', (await count(admin, 'classes')) === 2);

  /*
    검증이 **행을 남기는** 표의 seed 상태를 적어 둔다. seed는 칭찬·주간 요약·재풀이 요청·운영
    기록을 넣지 않으므로 지금은 전부 0이지만, 값을 박지 않고 읽어 둔다 — seed가 바뀌어도 정리
    단정이 따라간다.
  */
  const seedRows = {
    praises: await count(admin, 'praises'),
    retry_requests: await count(admin, 'retry_requests'),
    week_summaries: await count(admin, 'week_summaries'),
    audit_logs: await count(admin, 'audit_logs'),
    impersonation_sessions: await count(admin, 'impersonation_sessions'),
    learning_events: await count(admin, 'learning_events'),
  };

  /*
    활동 이벤트는 트리거가 남긴다(풀이 제출·답안 자동저장). 그 이벤트가 남으면 MAU·Activation의
    원천이 seed와 달라진다 — `오늘 활동한 학생`이 검증 때문에 늘어난다.

    **개수가 아니라 id 기준선으로 치운다.** `answer_saved`는 하루 한 줄로 줄이므로(`once_a_day`)
    그 학생이 오늘 이미 활동했다면 새 행이 아예 생기지 않는다. 무엇이 생겼는지 세지 않고
    "기준선 뒤에 생긴 그 학생의 이벤트"만 지우면 두 경우가 같은 코드로 맞는다.
  */
  const eventsAtSeed = await lastEventId(admin);
  /** 검증 중 트리거가 이벤트를 남기는 학생. 아래에서 uid를 알게 되면 채운다. */
  const eventStudents: string[] = [];
  onCleanup('활동 이벤트 정리', async () => {
    await ownerExec(
      'delete from public.learning_events where id > $1 and student_id = any($2::uuid[])',
      [eventsAtSeed, eventStudents],
    );
    check(
      `활동 이벤트가 seed 상태(${seedRows.learning_events}건)로 돌아왔다`,
      (await count(admin, 'learning_events')) === seedRows.learning_events,
    );
  });

  console.log('\n[학생] 자기 기록만 보인다');
  const yerin = await signIn('yerin'); // 정예린 — 개인 + 학원 학습 둘 다
  const yerinAttempts = await count(yerin, 'attempts');
  check(`정예린 풀이 7건(개인 3 + 학원 4), 실제 ${yerinAttempts}`, yerinAttempts === 7);
  const seojun = await signIn('seojun');
  /*
    **`0건`으로 단정하지 않는다.** 아래 쓰기 검증이 이 계정으로 풀이를 하나 만들기 때문에,
    개수로 보면 검증기를 두 번째로 돌릴 때 스스로 깨진다. 시험하려는 성질은 개수가 아니라
    **남의 기록이 섞이지 않는다**는 것이다.

    정리 단계가 그 풀이를 치우지만 이 단정은 개수에 매지 않은 채로 둔다 — 정리가 실패하는
    날에도 이 검사는 성질을 그대로 본다.
  */
  const seojunUid = (await seojun.auth.getUser()).data.user!.id;
  eventStudents.push(seojunUid); // 아래 제출 검증이 이 학생 이름으로 활동 이벤트를 남긴다.
  const { data: seojunRows } = await seojun.from('attempts').select('student_id');
  check(
    `김서준에게 보이는 풀이가 전부 본인 것 (${seojunRows?.length ?? 0}건)`,
    (seojunRows ?? []).every((r) => r.student_id === seojunUid),
  );
  const { data: seojunNotes } = await seojun.from('wrong_notes').select('student_id');
  check(
    `김서준에게 보이는 오답노트가 전부 본인 것 (${seojunNotes?.length ?? 0}건)`,
    (seojunNotes ?? []).every((r) => r.student_id === seojunUid),
  );

  console.log('\n[학부모] 연결된 자녀만 보인다');
  const minji = await signIn('minji'); // 최민지 — 자녀: 이하은, 정예린
  const minjiSeen = await count(minji, 'attempts');
  check(`최민지에게 자녀 2명의 풀이 10건, 실제 ${minjiSeen}`, minjiSeen === 10);
  const jihoon = await signIn('jihoon'); // 한지훈 — 자녀: 박도윤(기록 없음), 선생님 겸직
  check('한지훈에게 자녀 풀이 0건(박도윤은 기록이 없다)', (await count(jihoon, 'attempts')) === 0);

  console.log('\n[학원] 개인 학습 오답은 어떤 경로로도 보이지 않는다');
  const teacher = await signIn('hanbit.teacher'); // 오선생 — c_kor1 담당
  check('선생님이 wrong_notes 표에서 0행', (await count(teacher, 'wrong_notes')) === 0);
  const { data: academyNotes, error: noteErr } = await teacher
    .from('v_academy_visible_notes')
    .select('*');
  check(
    `학원용 뷰로는 배정 오답이 보인다 (${academyNotes?.length ?? 0}건)`,
    !noteErr && (academyNotes?.length ?? 0) > 0,
    noteErr?.message,
  );
  const leaked = academyNotes?.some(
    (n) => 'starred' in n || 'mastered' in n || 'picked_index' in n,
  );
  check('학원용 뷰에 별표·이해완료·고른답 컬럼이 없다', !leaked);
  const personalLeak = academyNotes?.some((n) => (n as { source: string }).source !== 'academy');
  check('학원용 뷰에 개인 학습 오답이 섞이지 않는다', !personalLeak);

  console.log('\n[학원] 배정한 콘텐츠의 문항을 읽는다');
  /*
    **회귀 검사**: 선생님이 자기가 배정한 콘텐츠의 문항을 못 읽으면 문항 수를 셀 수 없어
    문항 수 가중 평균의 분모가 0이 된다 — 학원 대시보드의 `평균 정답률`이 `—`로 비었다(실측).
    공개되지 않은 운영자 콘텐츠(`publish_to_students = false`)를 배정했을 때 드러난다.
  */
  const { data: taught } = await teacher
    .from('assignments')
    .select('id, content_sets ( publish_to_students, questions ( id ) )');
  // PostgREST의 중첩 결과 타입이 배열/객체로 갈려 나온다. 값만 꺼내 쓴다.
  const setOf = (a: { content_sets: unknown }) =>
    (Array.isArray(a.content_sets) ? a.content_sets[0] : a.content_sets) as
      | { publish_to_students: boolean; questions: unknown[] }
      | undefined;
  const withQuestions = (taught ?? []).filter((a) => (setOf(a)?.questions.length ?? 0) > 0);
  check(
    `배정 ${taught?.length ?? 0}건의 문항이 모두 보인다`,
    (taught?.length ?? 0) > 0 && withQuestions.length === (taught?.length ?? 0),
  );
  const unpublished = (taught ?? []).some((a) => setOf(a)?.publish_to_students === false);
  check('공개되지 않은 콘텐츠도 배정했으면 읽힌다(이 검사의 전제)', unpublished);

  console.log('\n[학원] 배정 제출 결과는 본다');
  const { data: subs, error: subErr } = await teacher.from('v_assignment_submissions').select('*');
  check(
    `선생님이 담당 반 제출 현황을 본다 (${subs?.length ?? 0}행)`,
    !subErr && (subs?.length ?? 0) > 0,
    subErr?.message,
  );

  console.log('\n[권한] 선생님은 반·학생을 바꿀 수 없다(원장만)');
  const { data: cls } = await teacher.from('classes').select('id, name').limit(1);
  const classId = cls?.[0]?.id as string | undefined;
  if (classId) {
    const { error: renameErr } = await teacher
      .from('classes')
      .update({ name: '선생님이 바꾼 이름' })
      .eq('id', classId);
    const { data: after } = await teacher.from('classes').select('name').eq('id', classId).single();
    check(
      '선생님의 반 이름 변경이 반영되지 않는다',
      after?.name !== '선생님이 바꾼 이름',
      `renameErr=${renameErr?.message ?? '없음'} / name=${after?.name}`,
    );
  } else {
    check('반을 찾지 못했다', false);
  }

  console.log('\n[권한] 감사 로그는 지울 수 없다(append-only)');
  /*
    검증이 남긴 감사 로그 id를 모아 둔다. **앱 역할로는 지울 수 없어**(그것이 여기서 확인하는
    성질이다) 정리는 소유자 접속으로 이 id만 지운다. 아래 `[쓰기 범위]`가 한 건 더 넣는다.
  */
  const auditLogIds: string[] = [];
  const { data: verifyLog } = await admin
    .from('audit_logs')
    .insert({
      actor_id: (await admin.auth.getUser()).data.user!.id,
      actor_name: '스코디 관리자',
      action: '기타',
      detail: 'RLS 검증',
    })
    .select('id')
    .single();
  if (verifyLog) auditLogIds.push(verifyLog.id as string);
  onCleanup('감사 로그 정리', async () => {
    await ownerExec('delete from public.audit_logs where id = any($1::uuid[])', [auditLogIds]);
    check(
      `감사 로그가 seed 상태(${seedRows.audit_logs}건)로 돌아왔다`,
      (await count(admin, 'audit_logs')) === seedRows.audit_logs,
    );
  });
  const before = await count(admin, 'audit_logs');
  await admin.from('audit_logs').delete().neq('detail', '');
  const after = await count(admin, 'audit_logs');
  check(`감사 로그가 지워지지 않는다 (${before} → ${after})`, before > 0 && after === before);

  console.log('\n[권한] 운영자만 지표를 본다');
  const { error: metricsErr } = await teacher.rpc('rpc_admin_overview');
  check('선생님의 rpc_admin_overview가 거부된다', !!metricsErr, metricsErr?.message);
  const { data: overview, error: adminMetricsErr } = await admin.rpc('rpc_admin_overview');
  check('운영자는 개요를 받는다', !adminMetricsErr, adminMetricsErr?.message);
  if (overview) {
    const o = overview as Record<string, unknown>;
    console.log(
      `      계정 ${o.accounts} · 학원 ${o.academies} · 콘텐츠 ${o.content_sets}(공개 ${o.content_published}) · 풀이 ${o.attempts_total} · MAU ${o.mau ?? '없음'}`,
    );
  }

  console.log('\n[제출] rpc_submit_attempt만이 문이다');
  const seojunId = seojunUid;
  const { data: openSet } = await seojun
    .from('content_sets')
    .select('id')
    .eq('publish_to_students', true)
    .limit(1)
    .single();
  const setId = openSet!.id as string;
  const { error: directInsert } = await seojun.from('attempts').insert({
    student_id: seojunId,
    content_set_id: setId,
    source: 'personal',
    submitted_on: new Date().toISOString().slice(0, 10),
    correct_count: 10,
    total_count: 10,
  });
  check('attempts 직접 insert가 거부된다', !!directInsert, directInsert?.message);

  // 정답을 하나 일부러 틀리게 골라 채점이 서버에서 이뤄지는지 본다.
  const { data: qs } = await seojun
    .from('questions')
    .select('id, answer_index, choices')
    .eq('content_set_id', setId)
    .order('position');
  const answers = (qs ?? []).map((row, i) => ({
    question_id: row.id as string,
    picked_index:
      i === 0
        ? ((row.answer_index as number) + 1) % (row.choices as string[]).length
        : (row.answer_index as number),
  }));
  const { data: attemptId, error: submitErr } = await seojun.rpc('rpc_submit_attempt', {
    p_source: 'personal',
    p_content_set_id: setId,
    p_answers: answers,
    p_time_sec: 321,
  });
  check('rpc_submit_attempt로 제출된다', !submitErr && !!attemptId, submitErr?.message);

  if (attemptId) {
    /*
      **만든 풀이를 치운다.** 남기면 `풀이 32건`이 다음 실행에서 스스로 깨지고, 학생 화면·학원
      대시보드·지표가 검증이 만든 기록을 실제 학습으로 센다. `attempt_answers`는 FK가 cascade라
      함께 지워진다(0007). `attempts`에는 delete 정책이 없어 소유자 접속으로 지운다.
    */
    onCleanup('풀이 정리', async () => {
      await ownerExec('delete from public.attempts where id = $1::uuid', [attemptId as string]);
      check(
        `풀이가 seed 상태(${attemptsAtSeed}건)로 돌아왔다`,
        (await count(admin, 'attempts')) === attemptsAtSeed,
      );
    });
    const { data: made } = await seojun
      .from('attempts')
      .select('correct_count, total_count, accuracy, time_sec')
      .eq('id', attemptId as string)
      .single();
    check(
      `서버가 채점했다: ${made?.correct_count}/${made?.total_count} = ${made?.accuracy}%`,
      made?.correct_count === answers.length - 1 && made?.total_count === answers.length,
    );
    check('걸린 시간이 남았다', made?.time_sec === 321);
    const { count: answerRows } = await seojun
      .from('attempt_answers')
      .select('*', { count: 'exact', head: true })
      .eq('attempt_id', attemptId as string);
    check(`문항별 정오가 ${answers.length}행 남았다`, answerRows === answers.length);
    const { count: events } = await seojun
      .from('learning_events')
      .select('*', { count: 'exact', head: true })
      .eq('ref_id', attemptId as string);
    check('활동 이벤트가 트리거로 남았다', (events ?? 0) === 1);
  }

  console.log('\n[제출] 배정받지 않은 과제는 낼 수 없다');
  const { data: otherAssignment } = await admin.from('assignments').select('id, content_set_id').limit(1).single();
  const { error: notMine } = await seojun.rpc('rpc_submit_attempt', {
    p_source: 'academy',
    p_content_set_id: otherAssignment!.content_set_id as string,
    p_answers: [],
    p_assignment_id: otherAssignment!.id as string,
  });
  check('배정 대상이 아니면 거부된다', !!notMine, notMine?.message);

  console.log('\n[배정] 담당 반에만 배정할 수 있다');
  const director = await signIn('hanbit.director');
  const { data: dirClasses } = await director.from('classes').select('id').limit(1);
  const { data: newAssignment, error: assignErr } = await director.rpc('rpc_add_assignment', {
    p_class_id: dirClasses![0].id as string,
    p_content_set_id: setId,
    p_title: 'RLS 검증용 배정',
    p_due_date: null,
  });
  check('원장이 배정할 수 있다', !assignErr && !!newAssignment, assignErr?.message);
  if (newAssignment) {
    /*
      아래에서 `rpc_remove_assignment`로 지우는 것이 정상 경로다. **그 앞에서 무엇이 던지면**
      배정이 남아 학생 화면에 `RLS 검증용 배정`이 과제로 보인다. 그래서 정리에서 한 번 더
      확인한다 — 이미 지워졌으면 0행이 지워지고 단정만 남는다.
    */
    onCleanup('검증용 배정 정리', async () => {
      await ownerExec('delete from public.assignments where id = $1::uuid', [
        newAssignment as string,
      ]);
      check(
        `배정이 seed 상태(${assignmentsAtSeed}건)로 돌아왔다`,
        (await count(admin, 'assignments')) === assignmentsAtSeed,
      );
    });
    const { count: targets } = await director
      .from('assignment_targets')
      .select('*', { count: 'exact', head: true })
      .eq('assignment_id', newAssignment as string);
    check(`반 학생 수만큼 대상 행이 생겼다 (${targets}행)`, (targets ?? 0) > 0);
    const { error: dupErr } = await director.rpc('rpc_add_assignment', {
      p_class_id: dirClasses![0].id as string,
      p_content_set_id: setId,
      p_title: '같은 콘텐츠 두 번',
      p_due_date: null,
    });
    check('같은 콘텐츠의 미제출 배정이 있으면 거부된다', !!dupErr, dupErr?.message);
    const { error: rmErr } = await director.rpc('rpc_remove_assignment', {
      p_assignment_id: newAssignment as string,
    });
    check('제출이 없으면 지울 수 있다', !rmErr, rmErr?.message);
  }
  const { error: outsideErr } = await seojun.rpc('rpc_add_assignment', {
    p_class_id: dirClasses![0].id as string,
    p_content_set_id: setId,
    p_title: '학생이 자기에게 배정',
    p_due_date: null,
  });
  check('학생은 배정할 수 없다', !!outsideErr, outsideErr?.message);

  // ── 쓰기 범위(0024) ───────────────────────────────────────────────────────
  //
  // 여기서 시험하는 것은 전부 "정책이 의도한 것보다 넓었다"는 한 종류다. 읽기 정책만 보면
  // 촘촘해 보여서 놓쳤던 것들이라, 거부되는 쪽을 **직접 호출해서** 확인한다.

  console.log('\n[쓰기 범위] 활동 지표를 손으로 넣을 수 없다');
  {
    const { error } = await seojun.rpc('note_learning_event', {
      p_student: (await seojun.auth.getUser()).data.user!.id,
      p_kind: 'attempt_submitted',
      p_ref: null,
      p_once_a_day: false,
    });
    check('학생이 note_learning_event를 부를 수 없다', !!error, error?.message);
    const { error: anonErr } = await anon.rpc('note_learning_event', {
      p_student: (await admin.auth.getUser()).data.user!.id,
      p_kind: 'answer_saved',
      p_ref: null,
      p_once_a_day: false,
    });
    check('익명도 부를 수 없다', !!anonErr, anonErr?.message);
  }

  console.log('\n[쓰기 범위] 감사 로그는 운영자만 남긴다');
  {
    const uid = (await seojun.auth.getUser()).data.user!.id;
    const { error } = await seojun.from('audit_logs').insert({
      actor_id: uid,
      actor_name: '김원장',
      action: '대리 보기',
      detail: '위조',
      subject_id: uid,
    });
    check('학생이 감사 로그를 넣을 수 없다', !!error, error?.message);
    const adminId = (await admin.auth.getUser()).data.user!.id;
    const { data: okRow, error: okErr } = await admin
      .from('audit_logs')
      .insert({
        actor_id: adminId,
        actor_name: '운영자',
        action: '요금 정책',
        detail: '검증',
        subject_id: null,
      })
      .select('id')
      .single();
    check('운영자는 넣을 수 있다', !okErr, okErr?.message);
    // 위에서 등록한 감사 로그 정리가 이 id도 함께 지운다.
    if (okRow) auditLogIds.push(okRow.id as string);
    await admin.from('audit_logs').delete().eq('actor_id', adminId);
    check('운영자도 지울 수 없다', (await count(admin, 'audit_logs')) > 0);
  }

  console.log('\n[쓰기 범위] 대리 보기 기록을 지울 수 없다');
  {
    const adminId = (await admin.auth.getUser()).data.user!.id;
    const targetId = (await seojun.auth.getUser()).data.user!.id;
    const { data: row, error: insErr } = await admin
      .from('impersonation_sessions')
      .insert({ operator_id: adminId, target_id: targetId, reason: '검증', ticket: 'T-1' })
      .select('id')
      .single();
    check('운영자가 대리 보기를 시작할 수 있다', !insErr, insErr?.message);
    if (row) {
      /*
        대리 보기 기록도 append-only다 — 행위자가 지울 수 없어야 한다(0024). 검증이 만든 이 한
        줄을 두면 실행마다 쌓이고, 운영 기록 화면이 검증을 실제 대리 열람으로 보여 준다.
      */
      onCleanup('대리 보기 기록 정리', async () => {
        await ownerExec('delete from public.impersonation_sessions where id = $1::uuid', [row.id]);
        check(
          `대리 보기 기록이 seed 상태(${seedRows.impersonation_sessions}건)로 돌아왔다`,
          (await count(admin, 'impersonation_sessions')) === seedRows.impersonation_sessions,
        );
      });
      // RLS로 막힌 delete는 오류 없이 0행을 지운다. 행이 남았는지로 확인한다.
      await admin.from('impersonation_sessions').delete().eq('id', row.id);
      const { count: alive } = await admin
        .from('impersonation_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('id', row.id);
      check('본인 기록도 지울 수 없다', alive === 1, `${alive}행`);
      const { error: tamperErr } = await admin
        .from('impersonation_sessions')
        .update({ reason: '바꿈' })
        .eq('id', row.id);
      check('시작 사유를 바꿀 수 없다', !!tamperErr, tamperErr?.message);
      const { error: endErr } = await admin
        .from('impersonation_sessions')
        .update({ ended_at: new Date().toISOString(), end_reason: '수동 종료', visited: ['/student'] })
        .eq('id', row.id);
      check('종료 처리는 된다', !endErr, endErr?.message);
      const { error: reopenErr } = await admin
        .from('impersonation_sessions')
        .update({ ended_at: null })
        .eq('id', row.id);
      check('닫힌 기록을 다시 열 수 없다', !!reopenErr, reopenErr?.message);
    }
  }

  console.log('\n[쓰기 범위] 학생이 자기 계정의 로그인 키를 바꿀 수 없다');
  {
    const uid = (await seojun.auth.getUser()).data.user!.id;
    await seojun.from('profiles').update({ scody_id: 'stolen', kakao_linked: true }).eq('id', uid);
    // `name`도 함께 읽는다 — 바꾸기 **전** 값이 곧 되돌릴 값이다(문자열을 다시 박지 않는다).
    const { data } = await seojun
      .from('profiles')
      .select('name, scody_id, kakao_linked')
      .eq('id', uid)
      .single();
    check('scody_id가 그대로다', data?.scody_id === 'seojun', String(data?.scody_id));
    check('kakao_linked가 그대로다', data?.kakao_linked === false, String(data?.kakao_linked));
    /*
      **이름을 원래대로 돌려놓는다.** 여기서 확인하는 것은 "본인 이름은 바꿀 수 있다"인데,
      되돌리지 않아서 live DB의 seed 계정 이름이 `김서준` → `박서준`으로 영구히 바뀌어 있었다.
      화면·E2E·리포트가 모두 seed 이름을 근거로 삼는 자리라 그 어긋남이 조용히 남는다.
    */
    const seedName = data?.name as string | undefined;
    const { error: nameErr } = await seojun.from('profiles').update({ name: '박서준' }).eq('id', uid);
    check('이름은 바꿀 수 있다', !nameErr, nameErr?.message);
    onCleanup('이름 되돌리기', async () => {
      // 바꾸기 전 이름을 못 읽었으면 되돌릴 값이 없다. 조용히 두면 드리프트가 그대로 남는다.
      if (!seedName) {
        check('바꾸기 전 이름을 읽어 두었다', false, '이름을 되돌리지 못했어요');
        return;
      }
      const { error: undoErr } = await seojun
        .from('profiles')
        .update({ name: seedName })
        .eq('id', uid);
      const { data: back } = await seojun.from('profiles').select('name').eq('id', uid).single();
      check(
        `이름이 seed 값(${seedName})으로 돌아왔다`,
        back?.name === seedName,
        `${undoErr?.message ?? ''} name=${back?.name}`,
      );
    });
  }

  console.log('\n[쓰기 범위] 요금 정책은 운영자만 읽는다');
  {
    check('학생에게 pricing_policies가 0행', (await count(seojun, 'pricing_policies')) === 0);
    check('운영자에게는 보인다', (await count(admin, 'pricing_policies')) > 0);
    const { data, error } = await seojun.from('v_public_pricing').select('student_paid, parent_paid');
    check('학생은 개인 요금만 뷰로 읽는다', !error && (data?.length ?? 0) === 1, error?.message);
  }

  console.log('\n[쓰기 범위] 칭찬의 보낸 사람을 자녀가 바꿀 수 없다');
  {
    const yerinId = (await yerin.auth.getUser()).data.user!.id;
    const minjiId = (await minji.auth.getUser()).data.user!.id;
    const { data: praise } = await minji
      .from('praises')
      .insert({ child_id: yerinId, from_user_id: minjiId, kind: 'steady' })
      .select('id')
      .single();
    if (praise) {
      /*
        칭찬에는 delete 정책이 없다 — 받은 칭찬을 아무도 없앨 수 없는 것이 맞다. 그래서 검증이
        만든 이 한 줄은 소유자 접속으로 치운다. 두면 정예린의 학생·학부모 화면에 받은 적 없는
        칭찬이 남고, 실행마다 하나씩 쌓인다.
      */
      onCleanup('칭찬 정리', async () => {
        await ownerExec('delete from public.praises where id = $1::uuid', [praise.id]);
        check(
          `칭찬이 seed 상태(${seedRows.praises}건)로 돌아왔다`,
          (await count(admin, 'praises')) === seedRows.praises,
        );
      });
      const teacherId = (await teacher.auth.getUser()).data.user!.id;
      await yerin.from('praises').update({ from_user_id: teacherId, kind: 'thanks' }).eq('id', praise.id);
      const { data: after } = await yerin.from('praises').select('from_user_id, kind').eq('id', praise.id).single();
      check('보낸 사람이 그대로다', after?.from_user_id === minjiId);
      check('종류가 그대로다', after?.kind === 'steady', String(after?.kind));
      const { error: seenErr } = await yerin
        .from('praises')
        .update({ seen_at: new Date().toISOString() })
        .eq('id', praise.id);
      check('확인 처리는 된다', !seenErr, seenErr?.message);
    } else {
      check('칭찬을 만들 수 있다', false, '삽입 실패');
    }
  }

  console.log('\n[쓰기 범위] 주간 요약을 남의 이름으로 쓸 수 없다');
  {
    const yerinId = (await yerin.auth.getUser()).data.user!.id;
    const jihoonId = (await jihoon.auth.getUser()).data.user!.id;
    const monday = '2026-01-05';
    const { error } = await minji.from('week_summaries').insert({
      child_id: yerinId,
      week_monday: monday,
      text: '위조된 요약',
      by_ai: true,
      created_by: jihoonId,
    });
    check('created_by를 남의 id로 넣을 수 없다', !!error, error?.message);
    const minjiId = (await minji.auth.getUser()).data.user!.id;
    const { error: okErr } = await minji.from('week_summaries').upsert({
      child_id: yerinId,
      week_monday: monday,
      text: '이번 주 요약',
      by_ai: false,
      created_by: minjiId,
    });
    check('본인 이름으로는 쓸 수 있다', !okErr, okErr?.message);
    /*
      그 주 요약은 지울 수 없다(바로 아래에서 확인한다 — D-030). 검증이 넣은 `이번 주 요약`은
      2026-01-05 주라 화면에서 잘 보이지 않지만, 남으면 학부모 리포트가 그 주에 요약이 있다고
      말한다. 소유자 접속으로 치운다.
    */
    onCleanup('주간 요약 정리', async () => {
      await ownerExec(
        'delete from public.week_summaries where child_id = $1::uuid and week_monday = $2::date',
        [yerinId, monday],
      );
      check(
        `주간 요약이 seed 상태(${seedRows.week_summaries}건)로 돌아왔다`,
        (await count(admin, 'week_summaries')) === seedRows.week_summaries,
      );
    });
    await minji.from('week_summaries').delete().eq('child_id', yerinId).eq('week_monday', monday);
    const { count: alive } = await minji
      .from('week_summaries')
      .select('*', { count: 'exact', head: true })
      .eq('child_id', yerinId)
      .eq('week_monday', monday);
    check('그 주 요약을 지울 수 없다', alive === 1, `${alive}행`);
  }

  console.log('\n[쓰기 범위] 재풀이 요청을 지울 수 없다');
  {
    const yerinId = (await yerin.auth.getUser()).data.user!.id;
    const minjiId = (await minji.auth.getUser()).data.user!.id;
    const { data: sets } = await yerin.from('content_sets').select('id').limit(1);
    const { data: req } = await minji
      .from('retry_requests')
      .insert({
        student_id: yerinId,
        requested_by: minjiId,
        source: 'personal',
        content_set_id: sets![0].id as string,
      })
      .select('id')
      .single();
    if (req) {
      /*
        재풀이 요청도 취소만 기록으로 남기고 지우지 못한다(0024 ⑨). 검증이 만든 요청을 두면
        학생의 학습 목록에 `다시 풀어 보기` 요청이 계속 떠 있다. 소유자 접속으로 치운다.
      */
      onCleanup('재풀이 요청 정리', async () => {
        await ownerExec('delete from public.retry_requests where id = $1::uuid', [req.id]);
        check(
          `재풀이 요청이 seed 상태(${seedRows.retry_requests}건)로 돌아왔다`,
          (await count(admin, 'retry_requests')) === seedRows.retry_requests,
        );
      });
      await minji.from('retry_requests').delete().eq('id', req.id);
      const { count: alive } = await minji
        .from('retry_requests')
        .select('*', { count: 'exact', head: true })
        .eq('id', req.id);
      check('요청을 지울 수 없다', alive === 1, `${alive}행`);
      const { error: cancelErr } = await minji
        .from('retry_requests')
        .update({ canceled_at: new Date().toISOString() })
        .eq('id', req.id);
      check('취소는 기록으로 남는다', !cancelErr, cancelErr?.message);
    } else {
      check('재풀이 요청을 만들 수 있다', false, '삽입 실패');
    }
  }

  console.log('\n[자동저장] 답안이 실제로 저장되고 다시 읽힌다');
  {
    const uid = (await yerin.auth.getUser()).data.user!.id;
    eventStudents.push(uid); // 자동저장 트리거가 이 학생 이름으로 `answer_saved`를 남긴다.
    const { data: set } = await yerin
      .from('content_sets')
      .select('id, questions(id)')
      .eq('publish_to_students', true)
      .limit(1)
      .single();
    const qId = (set!.questions as { id: string }[])[0].id;
    const row = {
      student_id: uid,
      source: 'personal' as const,
      assignment_id: null,
      content_set_id: set!.id as string,
      question_id: qId,
      picked_index: 2,
    };
    const conflict = 'student_id,question_id,source,assignment_id,content_set_id';
    /*
      **자동저장한 답안은 치운다.** 초안이 남으면 그 학생의 학습 목록이 그 세트를 계속
      `이어서 하기`로 말한다 — 검증 때문에 시작한 적 없는 학습이 진행 중으로 보인다.
      초안은 본인이 지울 수 있다(`answer_drafts_own`)이라 앱 역할로 되돌린다.
    */
    onCleanup('자동저장 정리', async () => {
      const { error: delErr } = await yerin
        .from('answer_drafts')
        .delete()
        .eq('student_id', uid)
        .eq('question_id', qId);
      const { count: left } = await yerin
        .from('answer_drafts')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', uid)
        .eq('question_id', qId);
      check(
        '자동저장한 답안이 지워졌다',
        left === 0,
        `${delErr?.message ?? ''} ${left}행`,
      );
    });
    const { error: first } = await yerin.from('answer_drafts').upsert(row, { onConflict: conflict });
    check('자동저장이 성공한다', !first, first?.message);
    const { error: second } = await yerin
      .from('answer_drafts')
      .upsert({ ...row, picked_index: 3 }, { onConflict: conflict });
    check('같은 문항을 다시 고르면 덮어쓴다', !second, second?.message);
    const { data: drafts } = await yerin
      .from('answer_drafts')
      .select('picked_index')
      .eq('student_id', uid)
      .eq('question_id', qId);
    check('행이 하나만 남았다', drafts?.length === 1, `${drafts?.length}행`);
    check('마지막 선택이 남았다', drafts?.[0]?.picked_index === 3, String(drafts?.[0]?.picked_index));
    const { count: evented } = await yerin
      .from('learning_events')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', uid)
      .eq('kind', 'answer_saved');
    check('활동 이벤트가 트리거로 남았다', (evented ?? 0) > 0, `${evented}행`);
  }

  console.log('\n[학원 경계] 소속이 끝나면 선생님도 메모를 못 읽는다');
  {
    const { data: before } = await teacher.from('v_academy_visible_notes').select('student_id');
    const seen = new Set((before ?? []).map((r) => r.student_id as string));
    check('지금은 담당 반 학생의 메모가 보인다', seen.size > 0, `${seen.size}명`);
    const victim = [...seen][0];
    const { error: leaveErr } = await director
      .from('academy_members')
      .update({ left_at: new Date().toISOString() })
      .eq('user_id', victim)
      .eq('member_role', 'student');
    check('원장이 소속을 끝낼 수 있다', !leaveErr, leaveErr?.message);

    /*
      **끝낸 소속을 되돌린다.** 그러지 않으면 검증이 DB를 seed 상태가 아닌 곳에 남긴다. 실제로
      그것 때문에 뒤따르는 검증이 헷갈렸다 — 학원 오답의 유일한 소유자가 이 `victim`이라,
      소속이 끝난 채 남으면 `v_academy_visible_notes`가 **선생님·원장 모두에게 빈 목록**이 된다.
      그 상태에서 보면 D-054(선생님이 담당 학생의 학원 오답 메모를 본다)가 깨진 것처럼 보인다.

      **바꾼 직후에 등록한다.** 예전에는 되돌리기가 이 블록의 마지막 줄이어서, 그 앞의 `await`
      하나가 거부되면(예: 아래 뷰 조회) `left_at`이 그대로 남았다. 이제 정리 단계가 돌린다.

      되돌리기가 실패하면 그 사실도 결과에 남긴다 — 조용히 넘기면 다음 실행이 이유 없이 흔들린다.
    */
    onCleanup('소속 되돌리기', async () => {
      const { error: undoErr } = await director
        .from('academy_members')
        .update({ left_at: null })
        .eq('user_id', victim)
        .eq('member_role', 'student');
      check('검증이 끝낸 소속을 다시 되돌린다', !undoErr, undoErr?.message);
      const { data: restored } = await teacher.from('v_academy_visible_notes').select('student_id');
      check(
        '되돌린 뒤 메모가 다시 보인다',
        (restored ?? []).some((r) => r.student_id === victim),
      );
    });

    const { data: after } = await teacher.from('v_academy_visible_notes').select('student_id');
    const stillSeen = (after ?? []).some((r) => r.student_id === victim);
    check('소속이 끝난 학생은 더 보이지 않는다', !stillSeen);
  }
}

async function main() {
  const anon = createClient(URL_, KEY, { auth: { persistSession: false } });
  try {
    await verify(anon);
  } finally {
    // 단정이 실패했든 쿼리가 던졌든 정리는 돈다.
    await runCleanups();
  }

  console.log(`\n결과: ${passed}개 통과, ${failed}개 실패\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('\n검증 중단:', e instanceof Error ? e.message : e);
  // 중단돼도 그때까지의 결과를 남긴다 — 정리 단계의 실패가 여기서 사라지지 않게.
  console.log(`결과: ${passed}개 통과, ${failed}개 실패 (중단됨)\n`);
  process.exit(1);
});
