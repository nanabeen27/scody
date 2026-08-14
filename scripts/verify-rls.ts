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
 * **그래도 `npm run db:verify`로 돌린다.** seed 총계를 등호로 단정하는 자리가 9곳이라(계정·학원·
 * 콘텐츠·문항·배정·풀이·오답노트·반·초대), 앱에서 만든 기록이 남아 있는 DB에서는 그 단정이
 * 깨진다. 정리는 **이 스크립트가 만든 것만** 치운다.
 *
 * **학원 간 격리는 학원 둘로 시험한다**(M-DB-13). seed에 새길학원이 있고, 이 스크립트의
 * `[학원 격리]` 단계가 네 방향(한빛 원장·선생 · 새길 원장·선생)으로 상대 학원의 콘텐츠·반·학생·
 * 배정·제출 현황·초대·오답 메모가 보이지 않는지, 그리고 교차 배정·교차 초대·교차 소속 쓰기가
 * 막히는지 확인한다.
 *
 * **`npm test`에 넣지 않는다.** 네트워크와 원격 DB 자격 증명이 필요해서, 단위 테스트에 넣으면
 * `.env`가 없는 환경에서 전체 테스트가 깨진다. 스키마나 정책을 바꿀 때 손으로 돌린다.
 */
import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Client } from 'pg';
// `.env`를 `process.env`로 올린다. 규칙은 `scripts/env.ts` 한곳에 있다.
import './env';


const URL_ = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
/** seed 계정 비밀번호. `.env`에서 읽는다 — 레포에 리터럴로 두지 않는다(gen-seed와 같은 이유). */
const PASSWORD = process.env.EXPO_PUBLIC_DEV_LOGIN_PASSWORD ?? '';

if (!URL_ || !KEY) throw new Error('.env에 EXPO_PUBLIC_SUPABASE_URL·ANON_KEY가 필요해요.');
if (!PASSWORD) throw new Error('.env에 EXPO_PUBLIC_DEV_LOGIN_PASSWORD가 필요해요.');

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
  /*
    seed에 **두 번째 학원**(새길학원)이 들어와 다섯 총계가 움직였다(M-DB-13). 값은 그대로 등호로
    단정한다 — `>=`로 바꾸면 "seed가 정확히 무엇을 넣는지"를 확인하는 이 단정의 목적이 없어진다.
  */
  check('계정 25개(로그인 11 + 반친구 12 + 새길학원 학생 2)', (await count(admin, 'profiles')) === 25);
  check('학원 2곳(한빛·새길)', (await count(admin, 'academies')) === 2);
  check('콘텐츠 14세트', (await count(admin, 'content_sets')) === 14);
  check('문항 192개', (await count(admin, 'questions')) === 192);
  /*
    **개수를 변수로 들고 간다.** 아래 검증이 배정·풀이를 하나씩 만들고, 정리 단계가 그것을
    치운 뒤 **같은 수로 돌아왔는지** 다시 단정한다. 등호로 단정하는 값 자체는 그대로 둔다.
  */
  const assignmentsAtSeed = await count(admin, 'assignments');
  check('배정 5건', assignmentsAtSeed === 5);
  const attemptsAtSeed = await count(admin, 'attempts');
  check('풀이 32건', attemptsAtSeed === 32);
  check('오답노트 11건', (await count(admin, 'wrong_notes')) === 11);
  check('반 3개', (await count(admin, 'classes')) === 3);
  const invitesAtSeed = await count(admin, 'invites');
  check('초대 4건(한빛 3 + 새길 1)', invitesAtSeed === 4);

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

    /*
      **원장만 좌석 단가를 읽는다**(0034 · D-148). 0024가 표를 운영자로 좁힌 뒤 원장도 자기
      청구액을 확인할 길이 없어서 화면이 코드 상수를 서버 값처럼 말했다(A-098). 뷰는
      `is_director()`로 좁히므로 선생님·학생에게는 0행이다 — 여기서 그 대칭을 실측한다.
    */
    const seat = 'v_academy_seat_pricing';
    /*
      **다섯 계정을 배치로 묻는다.** 서로 독립인 읽기라 직렬로 두면 왕복만 5회(약 400ms)다.
      `check()` 호출 순서는 그대로 둬서 출력과 단정 개수는 바뀌지 않는다.

      원장 질의는 `select('*')` 하나로 값 검사와 컬럼 검사를 함께 쓴다 — 컬럼 목록을 나열해
      받으면 자기가 나열한 키를 다시 세는 셈이라 컬럼 검사가 **실패할 수 없다.**
    */
    const [dirAll, teacherN, seojunN, minjiN, anonN] = await Promise.all([
      director.from(seat).select('*'),
      count(teacher, seat),
      count(seojun, seat),
      count(minji, seat),
      count(anon, seat),
    ]);
    const dirRow = dirAll.data?.[0] as Record<string, unknown> | undefined;
    check(
      '원장은 좌석 단가를 뷰로 읽는다',
      !dirAll.error && (dirAll.data?.length ?? 0) === 1 && Number(dirRow?.academy_seat ?? 0) > 0,
      dirAll.error?.message,
    );
    check('선생님에게 좌석 단가 뷰가 0행', teacherN === 0);
    check('학생에게 좌석 단가 뷰가 0행', seojunN === 0);
    check('학부모에게 좌석 단가 뷰가 0행', minjiN === 0);
    /*
      **익명은 권한 자체가 없다**(0035). 0034는 `authenticated`에게만 grant했는데 Supabase의
      기본 권한 때문에 `anon`이 select를 그대로 갖고 있었고, 막는 벽이 뷰 본문의 `is_director()`
      하나뿐이었다. `count()`는 권한 오류에 `-1`을 돌려주므로 `0행`이 아니라 `읽지 못한다`로
      단정한다(0행이면 벽이 한 겹만 남았다는 뜻이다).
    */
    check('익명은 좌석 단가 뷰를 읽지 못한다(권한 없음)', anonN === -1);
    const seatCols = Object.keys(dirRow ?? {}).sort();
    check(
      '좌석 뷰가 내보내는 컬럼은 넷뿐이다',
      seatCols.join(',') === 'academy_seat,effective_from,seat_discount_from,seat_discount_pct',
      seatCols.join(','),
    );
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

  /*
    ── 학원 간 격리 ──────────────────────────────────────────────────────────

    **왜 여기까지 오는 데 오래 걸렸나**: DB에 학원이 한빛학원 한 곳뿐이어서 이 성질을 시험할 수
    없었다(M-DB-13). 학원이 하나면 모든 조회가 "내 학원 것"이라 `owner_academy_id = my_academy_id()`
    조건을 **지워도 같은 결과가 나온다.** 그래서 정책은 맞아 보였지만 근거가 없었다.

    seed에 새길학원을 넣고(원장·선생·반 1개·학생 2명·콘텐츠 1세트·배정 1건·초대 1건) 네 방향으로
    확인한다: 한빛 원장·한빛 선생·새길 원장·새길 선생이 각각 **상대 학원 것을 하나도 보지 못하고**,
    그러면서 **자기 학원 것은 본다**(비어 있어서 통과하는 것이 아님을 함께 단정한다).

    기준선(어느 id가 어느 학원의 것인지)은 **운영자로 읽는다** — 검증 대상이 아니라 잣대다.
  */
  console.log('\n[학원 격리] 두 학원의 기준선');
  const saegilDirector = await signIn('saegil.director');
  const saegilTeacher = await signIn('saegil.teacher');

  const { data: academyRows } = await admin.from('academies').select('id, name');
  const academyIdOf = (name: string) =>
    ((academyRows ?? []).find((a) => a.name === name)?.id ?? '') as string;
  const hanbitId = academyIdOf('한빛학원');
  const saegilId = academyIdOf('새길학원');
  check(
    '학원 둘의 id가 서로 다르다(격리 검증의 전제)',
    !!hanbitId && !!saegilId && hanbitId !== saegilId,
    `${hanbitId} / ${saegilId}`,
  );

  const { data: allClasses } = await admin.from('classes').select('id, academy_id');
  const classIdsOf = (academy: string) =>
    (allClasses ?? []).filter((c) => c.academy_id === academy).map((c) => c.id as string);
  const { data: allAssignments } = await admin.from('assignments').select('id, class_id');
  const assignmentIdsOf = (academy: string) => {
    const ids = classIdsOf(academy);
    return (allAssignments ?? [])
      .filter((a) => ids.includes(a.class_id as string))
      .map((a) => a.id as string);
  };
  const { data: allMembers } = await admin
    .from('academy_members')
    .select('academy_id, user_id, member_role');
  const studentIdsOf = (academy: string) =>
    (allMembers ?? [])
      .filter((m) => m.academy_id === academy && m.member_role === 'student')
      .map((m) => m.user_id as string);
  check(
    `기준선을 읽었다: 한빛 반 ${classIdsOf(hanbitId).length}개·학생 ${studentIdsOf(hanbitId).length}명 · ` +
      `새길 반 ${classIdsOf(saegilId).length}개·학생 ${studentIdsOf(saegilId).length}명`,
    classIdsOf(hanbitId).length === 2 &&
      studentIdsOf(hanbitId).length === 14 &&
      classIdsOf(saegilId).length === 1 &&
      studentIdsOf(saegilId).length === 2,
  );

  /**
   * 그 계정에게 보이는 `table`의 행 중 **남의 학원 것이 하나도 없다.**
   *
   * 조회가 거부되면 실패로 본다 — `0행`과 `오류`는 다른 사실이고, 오류를 통과로 세면 표를 없애도
   * 격리가 지켜진 것으로 읽힌다.
   */
  async function noneVisible(
    who: string,
    client: SupabaseClient,
    table: string,
    column: string,
    forbidden: readonly string[],
  ) {
    const { data, error } = await client.from(table).select(column);
    const rows = (data ?? []) as unknown as Record<string, string | null>[];
    const leaked = rows.filter((r) => r[column] != null && forbidden.includes(r[column] as string));
    check(
      `${who}: ${table}에 남의 학원 행이 없다 (본 ${rows.length}행 · 유출 ${leaked.length}행)`,
      !error && leaked.length === 0,
      error?.message ?? leaked.map((r) => String(r[column])).join(', '),
    );
  }

  const sides = [
    { who: '한빛 원장', client: director, mine: hanbitId, theirs: saegilId },
    { who: '한빛 선생', client: teacher, mine: hanbitId, theirs: saegilId },
    { who: '새길 원장', client: saegilDirector, mine: saegilId, theirs: hanbitId },
    { who: '새길 선생', client: saegilTeacher, mine: saegilId, theirs: hanbitId },
  ];

  /*
    **seed에는 한빛학원 소유 콘텐츠가 없다.**

    실측으로 알게 된 사실이다(2026-08-14): `src/data/content.ts`의 어느 세트에도
    `ownerAcademyName`이 없어서 seed의 13세트는 전부 운영자 콘텐츠(`owner_academy_id is null`)다.
    `scripts/gen-seed.ts`의 `ownerAcademyName === ACADEMY_NAME` 분기는 지금 아무 세트에도 맞지 않는다.

    그대로 두면 콘텐츠 격리가 **한 방향만** 시험된다 — 새길학원 소유 세트가 한빛에게 안 보이는 것은
    확인되지만, 그 반대는 볼 대상이 없어서 정책을 지워도 통과한다. 그래서 한빛 원장으로 자기 학원
    콘텐츠 한 세트를 **여기서 만들어** 양쪽을 대칭으로 시험하고, 정리 단계가 그것을 치운다.
  */
  console.log('\n[학원 격리] 한빛학원 소유 콘텐츠를 만들어 양쪽을 대칭으로 시험한다');
  const contentAtSeed = await count(admin, 'content_sets');
  let hanbitOwnedSetId: string | null = null;
  {
    onCleanup('교차 확인용 콘텐츠 정리', async () => {
      if (hanbitOwnedSetId) {
        await ownerExec('delete from public.content_sets where id = $1::uuid', [hanbitOwnedSetId]);
      }
      check(
        `콘텐츠가 seed 상태(${contentAtSeed}세트)로 돌아왔다`,
        (await count(admin, 'content_sets')) === contentAtSeed,
      );
    });
    const { data: made, error: makeErr } = await director
      .from('content_sets')
      .insert({
        subject: '국어',
        area: '문법',
        title: '격리 검증용 한빛 문제',
        kind: 'grammar',
        grade: 1,
        publish_to_students: false,
        owner_academy_id: hanbitId,
        created_by: (await director.auth.getUser()).data.user!.id,
      })
      .select('id')
      .single();
    check('한빛 원장이 자기 학원 콘텐츠를 등록할 수 있다', !makeErr && !!made?.id, makeErr?.message);
    hanbitOwnedSetId = (made?.id as string | undefined) ?? null;
    if (hanbitOwnedSetId) {
      const seenBy = async (client: SupabaseClient) =>
        count(client, 'content_sets', `id=${hanbitOwnedSetId}`);
      check('한빛 원장에게 그 세트가 보인다', (await seenBy(director)) === 1);
      check('한빛 선생에게도 보인다(같은 학원)', (await seenBy(teacher)) === 1);
      check('새길 원장에게 보이지 않는다', (await seenBy(saegilDirector)) === 0);
      check('새길 선생에게 보이지 않는다', (await seenBy(saegilTeacher)) === 0);
      check('학원과 무관한 학생에게 보이지 않는다', (await seenBy(seojun)) === 0);
    }
  }

  console.log('\n[학원 격리] 다른 학원의 콘텐츠·반·학생·배정·초대·메모가 보이지 않는다');
  for (const side of sides) {
    await noneVisible(side.who, side.client, 'content_sets', 'owner_academy_id', [side.theirs]);
    await noneVisible(side.who, side.client, 'classes', 'academy_id', [side.theirs]);
    await noneVisible(side.who, side.client, 'class_students', 'class_id', classIdsOf(side.theirs));
    await noneVisible(side.who, side.client, 'v_class_roster', 'class_id', classIdsOf(side.theirs));
    await noneVisible(side.who, side.client, 'assignments', 'class_id', classIdsOf(side.theirs));
    await noneVisible(
      side.who,
      side.client,
      'v_assignment_submissions',
      'assignment_id',
      assignmentIdsOf(side.theirs),
    );
    await noneVisible(side.who, side.client, 'invites', 'academy_id', [side.theirs]);
    await noneVisible(side.who, side.client, 'profiles', 'id', studentIdsOf(side.theirs));
    await noneVisible(
      side.who,
      side.client,
      'v_academy_visible_notes',
      'student_id',
      studentIdsOf(side.theirs),
    );
  }

  /*
    **비어 있어서 통과한 것이 아니다.** 위 단정은 "남의 것이 없다"만 보므로, 조회가 통째로 0행이면
    똑같이 통과한다. 각자 자기 학원 것은 실제로 본다는 것을 함께 단정한다.
  */
  console.log('\n[학원 격리] 자기 학원 것은 보인다(위 단정이 공허하지 않다는 근거)');
  for (const side of sides) {
    const ownSets = await count(side.client, 'content_sets', `owner_academy_id=${side.mine}`);
    check(`${side.who}: 자기 학원 콘텐츠가 보인다 (${ownSets}세트)`, ownSets > 0);
    const ownClasses = await count(side.client, 'classes', `academy_id=${side.mine}`);
    check(`${side.who}: 자기 학원 반이 보인다 (${ownClasses}개)`, ownClasses > 0);
    const ownRoster = await count(side.client, 'v_class_roster');
    check(`${side.who}: 자기 반 로스터가 보인다 (${ownRoster}행)`, ownRoster > 0);
  }

  console.log('\n[학원 격리] 다른 학원 반에는 배정할 수 없다');
  {
    const hanbitClassId = classIdsOf(hanbitId)[0];
    const saegilClassId = classIdsOf(saegilId)[0];
    /** 다른 학원 반에 배정을 시도한다. 만들어지면 격리가 깨진 것이고, 그 배정은 반드시 치운다. */
    const crossAssign = async (
      who: string,
      client: SupabaseClient,
      classId: string,
      contentSetId: string,
      why: string,
    ) => {
      /*
        **시도 전에 정리를 등록한다.** 거부되면 지울 것이 없어 0행이 지워지고 단정만 남는다.
        통과하면(=격리가 깨졌다) 그 배정이 남아 남의 학원 학생 화면에 과제로 보인다.
      */
      let made: string | null = null;
      onCleanup(`교차 배정 정리(${who})`, async () => {
        if (made) await ownerExec('delete from public.assignments where id = $1::uuid', [made]);
        check(
          `배정이 seed 상태(${assignmentsAtSeed}건)로 돌아왔다 — ${who}`,
          (await count(admin, 'assignments')) === assignmentsAtSeed,
        );
      });
      const { data, error } = await client.rpc('rpc_add_assignment', {
        p_class_id: classId,
        p_content_set_id: contentSetId,
        p_title: '격리 검증용 교차 배정',
        p_due_date: null,
      });
      made = (data as string | null) ?? null;
      check(
        `${who}: ${why}`,
        !!error && !made,
        error?.message ?? `배정 ${made}가 만들어졌다 — 격리가 깨졌다`,
      );
    };
    // ① 남의 반에 (운영자 공개) 콘텐츠를 배정한다 — 막는 것은 반 소유다.
    await crossAssign('한빛 원장', director, saegilClassId, setId, '새길학원 반에 배정할 수 없다');
    await crossAssign(
      '새길 원장',
      saegilDirector,
      hanbitClassId,
      setId,
      '한빛학원 반에 배정할 수 없다',
    );
    // ② 자기 반에 **남의 학원 콘텐츠**를 배정한다 — 막는 것은 콘텐츠 소유다.
    const { data: saegilSets } = await admin
      .from('content_sets')
      .select('id')
      .eq('owner_academy_id', saegilId);
    check(
      `학원 소유 콘텐츠가 양쪽에 있다 (한빛 ${hanbitOwnedSetId ? 1 : 0} · 새길 ${saegilSets?.length ?? 0})`,
      !!hanbitOwnedSetId && (saegilSets?.length ?? 0) > 0,
    );
    if (hanbitOwnedSetId && (saegilSets?.length ?? 0) > 0) {
      await crossAssign(
        '한빛 원장',
        director,
        hanbitClassId,
        saegilSets![0].id as string,
        '새길학원 콘텐츠는 자기 반에도 배정할 수 없다',
      );
      await crossAssign(
        '새길 원장',
        saegilDirector,
        saegilClassId,
        hanbitOwnedSetId,
        '한빛학원 콘텐츠는 자기 반에도 배정할 수 없다',
      );
    }
  }

  console.log('\n[학원 격리] 다른 학원의 초대를 만들 수 없다');
  {
    const crossInvite = async (who: string, client: SupabaseClient, academyId: string) => {
      let made: string | null = null;
      onCleanup(`교차 초대 정리(${who})`, async () => {
        if (made) await ownerExec('delete from public.invites where token = $1', [made]);
        check(
          `초대가 seed 상태(${invitesAtSeed}건)로 돌아왔다 — ${who}`,
          (await count(admin, 'invites')) === invitesAtSeed,
        );
      });
      const { data, error } = await client.rpc('rpc_create_invite', {
        p_academy_id: academyId,
        p_invitee_role: 'teacher',
        p_valid_days: 7,
      });
      made = (data as string | null) ?? null;
      check(
        `${who}: 다른 학원 초대를 만들 수 없다`,
        !!error && !made,
        error?.message ?? `토큰 ${made}가 만들어졌다 — 격리가 깨졌다`,
      );
    };
    await crossInvite('한빛 원장', director, saegilId);
    await crossInvite('새길 원장', saegilDirector, hanbitId);
  }

  console.log('\n[학원 격리] 다른 학원에 사람을 넣을 수 없다');
  {
    const membersAtSeed = await count(admin, 'academy_members');
    const crossMember = async (
      who: string,
      client: SupabaseClient,
      academyId: string,
      userId: string,
    ) => {
      onCleanup(`교차 소속 정리(${who})`, async () => {
        await ownerExec(
          'delete from public.academy_members where academy_id = $1::uuid and user_id = $2::uuid',
          [academyId, userId],
        );
        check(
          `학원 소속이 seed 상태(${membersAtSeed}건)로 돌아왔다 — ${who}`,
          (await count(admin, 'academy_members')) === membersAtSeed,
        );
      });
      const { error } = await client
        .from('academy_members')
        .insert({ academy_id: academyId, user_id: userId, member_role: 'teacher' });
      // RLS로 막힌 insert는 오류를 주지만, 오류 없이 통과하는 경우도 행으로 확인한다.
      const { count: added } = await admin
        .from('academy_members')
        .select('*', { count: 'exact', head: true })
        .eq('academy_id', academyId)
        .eq('user_id', userId);
      check(
        `${who}: 다른 학원에 사람을 넣을 수 없다`,
        added === 0,
        `${error?.message ?? '오류 없음'} / ${added}행`,
      );
    };
    const hanbitTeacherId = (await teacher.auth.getUser()).data.user!.id;
    const saegilTeacherId = (await saegilTeacher.auth.getUser()).data.user!.id;
    await crossMember('한빛 원장', director, saegilId, hanbitTeacherId);
    await crossMember('새길 원장', saegilDirector, hanbitId, saegilTeacherId);
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
