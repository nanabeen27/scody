/**
 * `supabase/seed.sql` 생성기.
 *
 * **왜 손으로 쓰지 않는가**: 옮겨야 하는 콘텐츠가 12세트 · 문항 180여 개 · 선지 700여 개다.
 * 한국어 지문과 해설을 손으로 SQL에 옮기면 오타가 반드시 생기고, 그 오타는 정답 인덱스가
 * 어긋나는 형태로 나타나 학생이 맞은 문항을 틀렸다고 말한다.
 *
 * 그래서 기존 fixture 모듈(`src/data/content.ts`·`contentExtra.ts`·`attempts.ts` 등)을
 * **그대로 읽어** SQL로 펼친다. 실행:
 *
 *     npx tsx scripts/gen-seed.ts
 *
 * **이 스크립트는 fixture를 지우는 단계(Phase 7)에서 함께 지운다.** 그때까지는 seed를 다시
 * 만들 수 있는 유일한 길이라 남겨 둔다.
 *
 * ## 규모 데이터는 옮기지 않는다
 *
 * 로스터 3,000명 · 학원 7곳 · 개인 사용자 600명 · 26주 합성 활동 · 배정 이력 777건은 버린다.
 * 남기는 것은 콘텐츠 12세트 · 로그인 테스트 계정 9종 · 한빛학원 1곳 · 반 2개 ·
 * 반 평균과 순위를 계산할 반 친구 15명 · 배정 4건 · 풀이 6건 · 오답노트 12건이다.
 *
 * ## 날짜
 *
 * 원본 시드는 `2026-07-28`(`DATA_ANCHOR`)을 '오늘'로 보고 고정 날짜를 박아 두었다. DB에는
 * **그 기준일을 seed 실행일로 옮겨** 상대 간격만 유지한 채 넣는다(`day()`). 고정 날짜를 그대로
 * 넣으면 seed를 돌리는 시점에 따라 모든 마감이 몇 달 전이 된다.
 */
import { createHash, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
/*
  **`SEED_CONTENT`가 전부다.** 그 배열은 마지막에 `...EXTRA_CONTENT`를 스프레드하므로
  (`src/data/content.ts` 끝) 두 모듈을 합치면 9세트가 두 번 들어가 PK가 충돌한다(실측).
*/
import { SEED_CONTENT } from '../src/data/content';
import { ATTEMPTS_SEED, WRONG_NOTES_SEED } from '../src/data/attempts';
import { ACADEMY_CLASSES, ASSIGNMENTS_SEED } from '../src/data/fixtures';
import { ROSTER_STUDENTS } from '../src/data/roster';
import type { Account, ContentSet, Grade, Role } from '../src/data/types';

/** 원본 시드가 '오늘'로 삼았던 날. 여기서부터의 간격만 DB로 옮긴다. */
const ANCHOR = '2026-07-28';

/** 프로토타입 공용 비밀번호. **개발용 로그인 전용**이고 운영에서는 쓰지 않는다. */
const DEV_PASSWORD = 'test1234';

// ── 결정적 식별자 ────────────────────────────────────────────────────────────

/**
 * 옛 문자열 id → uuid(v5 형태).
 *
 * 결정적이라 seed를 다시 만들어도 같은 값이 나오고, E2E가 URL에 id를 적어 둘 수 있다.
 */
function uuidFor(key: string): string {
  const h = createHash('sha1').update(`scody-seed:${key}`).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** 고객지원 코드. `profiles.support_code`의 CHECK 형식을 맞춘다. */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
function supportCodeFor(key: string): string {
  const h = createHash('sha1').update(`scody-code:${key}`).digest();
  let out = '';
  for (let i = 0; i < 6; i += 1) out += CODE_ALPHABET[h[i] % CODE_ALPHABET.length];
  return `${out.slice(0, 3)}-${out.slice(3)}`;
}

// ── SQL 리터럴 ───────────────────────────────────────────────────────────────

function q(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function qn(value: string | undefined | null): string {
  return value == null || value === '' ? 'null' : q(value);
}

function arr(values: readonly string[]): string {
  return `array[${values.map(q).join(', ')}]`;
}

/** 원본 고정 날짜 → seed 실행일 기준 상대 날짜 SQL. */
function day(iso: string): string {
  const diff = Math.round(
    (Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${ANCHOR}T00:00:00Z`)) / 86_400_000,
  );
  if (diff === 0) return 'current_date';
  return `current_date ${diff > 0 ? '+' : '-'} ${Math.abs(diff)}`;
}

// ── 계정 ─────────────────────────────────────────────────────────────────────

interface SeedAccount {
  key: string;
  name: string;
  scodyId: string;
  phone: string;
  roles: Role[];
  grade?: Grade;
  kakaoLinked?: boolean;
  /** 한빛학원 안에서의 자리. 학생도 소속이 있다. */
  academyRole?: 'director' | 'teacher' | 'student';
  entitlements: { kind: 'personal' | 'academy'; payer: 'student' | 'parent' | 'academy'; label: string }[];
}

/**
 * 로그인 가능한 테스트 계정 9종.
 *
 * `src/data/fixtures.ts`의 `LOGIN_ACCOUNTS`와 같은 사람들이다. 그 상수는 export되지 않아
 * 여기 다시 적는다 — 대신 **이메일과 uuid가 새로 필요해서** 어차피 이 자리에서 정해야 한다.
 */
const ACCOUNTS: readonly SeedAccount[] = [
  {
    key: 'u_student_personal',
    name: '김서준',
    scodyId: 'seojun',
    phone: '010-1000-0001',
    roles: ['student'],
    grade: 1,
    entitlements: [{ kind: 'personal', payer: 'student', label: '개인 월정액' }],
  },
  {
    key: 'u_student_parentpaid',
    name: '이하은',
    scodyId: 'haeun',
    phone: '010-1000-0002',
    roles: ['student'],
    grade: 2,
    entitlements: [{ kind: 'personal', payer: 'parent', label: '학부모 결제 구독' }],
  },
  {
    key: 'u_student_academy',
    name: '박도윤',
    scodyId: 'doyun',
    phone: '010-1000-0003',
    roles: ['student'],
    grade: 1,
    academyRole: 'student',
    entitlements: [{ kind: 'academy', payer: 'academy', label: '학원 이용권' }],
  },
  {
    key: 'u_student_both',
    name: '정예린',
    scodyId: 'yerin',
    phone: '010-1000-0004',
    roles: ['student'],
    grade: 1,
    kakaoLinked: true,
    academyRole: 'student',
    entitlements: [
      { kind: 'academy', payer: 'academy', label: '학원 이용권' },
      { kind: 'personal', payer: 'student', label: '개인 월정액' },
    ],
  },
  {
    key: 'u_parent',
    name: '최민지',
    scodyId: 'minji',
    phone: '010-2000-0001',
    roles: ['parent'],
    entitlements: [],
  },
  {
    key: 'u_academy_director',
    name: '한빛 원장',
    scodyId: 'hanbit.director',
    phone: '010-3000-0001',
    roles: ['academy'],
    academyRole: 'director',
    entitlements: [],
  },
  {
    key: 'u_academy_teacher',
    name: '오선생',
    scodyId: 'hanbit.teacher',
    phone: '010-3000-0002',
    roles: ['academy'],
    academyRole: 'teacher',
    entitlements: [],
  },
  {
    // 한 계정 다역할: 선생님이면서 학부모. 로그인 후 공간 전환을 보여준다.
    key: 'u_teacher_parent',
    name: '한지훈',
    scodyId: 'jihoon',
    phone: '010-3000-0003',
    roles: ['academy', 'parent'],
    academyRole: 'teacher',
    entitlements: [],
  },
  {
    key: 'u_admin',
    name: '스코디 관리자',
    scodyId: 'admin',
    phone: '010-9000-0001',
    roles: ['admin'],
    entitlements: [],
  },
];

/** 학부모 → 자녀. 자녀의 학습 기록은 학생 계정에 남는다. */
const PARENT_CHILDREN: Record<string, readonly string[]> = {
  u_parent: ['u_student_parentpaid', 'u_student_both'],
  u_teacher_parent: ['u_student_academy'],
};

const ACADEMY_NAME = '한빛학원';
const ACADEMY_KEY = 'ac_hanbit';

/** 테스트 계정이 속한 반. 규모용 로스터 반은 옮기지 않는다. */
const CLASS_KEYS = ['c_kor1', 'c_kor2'] as const;

/**
 * 반 친구.
 *
 * **왜 필요한가**: 학부모 리포트가 반 평균과 반 내 순위를 보여 주려면 비교할 또래가 있어야
 * 한다. 제출자가 한두 명이면 `1명 중 1등`이 되어 뜻이 없다. 로스터에서 이 15명만 가져온다 —
 * 이름은 원본과 같아서 E2E가 적어 둔 값이 살아 있다. 로그인할 수 없다(비밀번호가 없다).
 */
const PEER_KEYS = [
  ...new Set(
    ACADEMY_CLASSES.filter((c) => (CLASS_KEYS as readonly string[]).includes(c.id))
      .flatMap((c) => c.studentIds)
      .filter((id) => id.startsWith('u_rs_')),
  ),
];

const PEER_NAME = new Map(ROSTER_STUDENTS.map((s) => [s.userId, s] as const));

// ── 출력 ─────────────────────────────────────────────────────────────────────

const out: string[] = [];
function w(line = '') {
  out.push(line);
}

w(`-- 개발·테스트 seed. **자동 생성 파일이다** — 고치지 말고 \`scripts/gen-seed.ts\`를 고친 뒤`);
w(`-- \`npx tsx scripts/gen-seed.ts\`로 다시 만든다.`);
w(`--`);
w(`-- 실제 사용자 데이터가 아니다. 화면에서 실제 재원생·실제 기록처럼 표현하지 않는다.`);
w(`-- 로그인 비밀번호(\`${DEV_PASSWORD}\`)는 개발용이다. 운영 DB에 이 seed를 넣지 않는다.`);
w();
w(`-- \`crypt\`·\`gen_salt\`(pgcrypto)는 Supabase에서 \`extensions\` 스키마에 있다. seed는 psql로`);
w(`-- 직접 도는데 그 경로에는 \`extensions\`가 없어서 함수를 못 찾는다.`);
w(`set search_path = public, extensions;`);
w();

// ── 다시 실행할 수 있게 만드는 정리 구문 ─────────────────────────────────────

const seedUserIds = [...ACCOUNTS.map((a) => a.key), ...PEER_KEYS].map(uuidFor);

w(`-- ── 정리 ────────────────────────────────────────────────────────────────`);
w(`--`);
w(`-- seed를 **여러 번 돌릴 수 있게** 먼저 지운다. 그러지 않으면 두 번째 실행이 PK 충돌로`);
w(`-- 중간에 멈추고, 그 시점까지 들어간 행만 남아 DB가 어중간한 상태가 된다(실측).`);
w(`--`);
w(`-- append-only 표(\`audit_logs\`·\`impersonation_sessions\`·\`learning_events\`)를 seed 상태로`);
w(`-- 되돌릴 수 있는 곳은 여기뿐이다 — 앱 역할에는 delete 정책이 없다(0015·0024).`);
w(`--`);
w(`-- **운영 데이터를 지우지 않도록 먼저 확인한다.** seed가 만들지 않은 계정이 하나라도 있으면`);
w(`-- 실수로 운영 DB를 가리킨 것으로 보고 중단한다.`);
w(`do $$`);
w(`begin`);
w(`  if exists (`);
w(`    select 1 from public.profiles`);
w(`    where id not in (`);
w(seedUserIds.map((id) => `      ${q(id)}::uuid`).join(',\n'));
w(`    )`);
w(`  ) then`);
w(`    raise exception 'seed가 만들지 않은 계정이 있어요. 운영 DB일 수 있어 중단합니다.';`);
w(`  end if;`);
w(`end $$;`);
w();
/*
  **append-only 표도 목록에 담는다.**

  `learning_events`·`audit_logs`·`impersonation_sessions`는 앱 역할이 지울 수 없다 — delete
  정책이 아예 없다(0015·0024). 접속기록과 활동 지표를 행위자가 없앨 수 없어야 하기 때문이고,
  그 성질은 그대로 두는 것이 맞다. 대신 그 표를 **seed 상태로 되돌릴 수 있는 곳은 여기뿐이다.**

  목록에서 빠지면 `npm run db:verify`가 남기는 검증용 행(감사 로그 2건·대리 보기 1건·활동
  이벤트 몇 건)이 **실행마다 쌓여 영구히 늘어난다.** 운영 기록 화면이 검증을 실제 운영자
  조작으로 보여 주고, MAU·Activation이 검증 실행 수를 함께 센다. `scripts/verify-rls.ts`의
  정리 단계도 같은 이유로 소유자 접속(seed와 같은 경로)으로만 그 행을 치운다.
*/
w(`truncate table`);
w(
  [
    'public.learning_events',
    'public.audit_logs',
    'public.impersonation_sessions',
    'public.payment_records',
    'public.pricing_policies',
    'public.entitlements',
    'public.parent_payment_offers',
    'public.week_summaries',
    'public.praises',
    'public.retry_requests',
    'public.study_queue',
    'public.wrong_notes',
    'public.answer_drafts',
    'public.attempt_answers',
    'public.assignment_targets',
    'public.attempts',
    'public.assignments',
    'public.questions',
    'public.content_sets',
    'public.invites',
    'public.class_students',
    'public.classes',
    'public.academy_members',
    'public.academies',
    'public.parent_children',
    'public.user_roles',
    'public.profiles',
  ]
    .map((t) => `  ${t}`)
    .join(',\n'),
);
w(`cascade;`);
w();
w(`-- 프로필은 \`auth.users\`를 참조하므로 계정도 함께 지운다(위 truncate가 프로필만 비운다).`);
w(`delete from auth.users where id in (`);
w(seedUserIds.map((id) => `  ${q(id)}::uuid`).join(',\n'));
w(`);`);
w();
w(`-- 활동 이벤트는 아래에서 **날짜를 맞춰 직접 넣는다.** 트리거에 맡기면 6건이 전부 seed를`);
w(`-- 돌린 날로 기록되어 "모두 오늘 활동했다"가 된다.`);
w(`alter table public.attempts disable trigger attempts_event;`);
w(`alter table public.wrong_notes disable trigger wrong_notes_event;`);
w();

// ── auth.users + profiles ────────────────────────────────────────────────────

w(`-- ── 계정 ────────────────────────────────────────────────────────────────`);
w(`--`);
w(`-- 개발용 이메일+비밀번호 로그인이다. 확정 정책(D-020)의 로그인 수단은 카카오와 휴대폰`);
w(`-- 두 가지이고, 그 연결은 다음 단계다. 여기서 실제 \`auth.users\`를 만드는 이유는 **RLS를`);
w(`-- 실제 JWT로 검증하기 위해서다** — 정책은 \`auth.uid()\`를 보고 판단한다.`);
w();

/*
  **토큰 컬럼을 빈 문자열로 채운다.**

  GoTrue는 로그인할 때 `auth.users`를 읽어 Go 구조체(`string`)에 담는데, 이 컬럼들이 NULL이면
  스캔이 실패해 `Database error querying schema`로 떨어진다 — 비밀번호가 맞아도 아무도 로그인할
  수 없다(실측). 손으로 `auth.users`를 만들 때 늘 걸리는 자리다.
*/
const AUTH_TOKEN_COLUMNS = [
  'confirmation_token',
  'recovery_token',
  'email_change_token_new',
  'email_change',
  'email_change_token_current',
  'phone_change',
  'phone_change_token',
  'reauthentication_token',
];

for (const a of ACCOUNTS) {
  const id = uuidFor(a.key);
  const email = `${a.scodyId}@scody.test`;
  w(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, ${AUTH_TOKEN_COLUMNS.join(', ')})`,
  );
  w(
    `values ('00000000-0000-0000-0000-000000000000', ${q(id)}, 'authenticated', 'authenticated', ${q(email)}, crypt(${q(DEV_PASSWORD)}, gen_salt('bf')), now(), now() - interval '90 days', now(), '{"provider":"email","providers":["email"]}', ${q(JSON.stringify({ name: a.name }))}, ${AUTH_TOKEN_COLUMNS.map(() => "''").join(', ')})`,
  );
  w(`on conflict (id) do nothing;`);
  w(
    `insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)`,
  );
  w(
    `values (gen_random_uuid(), ${q(id)}, ${q(id)}, ${q(JSON.stringify({ sub: id, email }))}, 'email', now(), now(), now())`,
  );
  w(`on conflict do nothing;`);
}
w();

w(`insert into public.profiles (id, name, scody_id, phone, support_code, grade, kakao_linked, created_at) values`);
w(
  ACCOUNTS.map(
    (a) =>
      `  (${q(uuidFor(a.key))}, ${q(a.name)}, ${q(a.scodyId)}, ${q(a.phone)}, ${q(supportCodeFor(a.key))}, ${a.grade ?? 'null'}, ${a.kakaoLinked ? 'true' : 'false'}, now() - interval '90 days')`,
  ).join(',\n'),
);
w(`;`);
w();

w(`-- 반 친구. 로그인할 수 없다(\`auth.users\`를 만들지 않는다) — 이름만 있는 또래다.`);
w(`-- **\`profiles.id\`는 \`auth.users\`를 참조한다**: 로그인 없는 사람을 담으려면 그 행이 있어야`);
w(`-- 한다. 비밀번호 없이 만들어 두면 어느 수단으로도 로그인되지 않는다.`);
for (const key of PEER_KEYS) {
  const id = uuidFor(key);
  w(
    `insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at, ${AUTH_TOKEN_COLUMNS.join(', ')}) values ('00000000-0000-0000-0000-000000000000', ${q(id)}, 'authenticated', 'authenticated', ${q(`${key}@peer.scody.test`)}, now() - interval '90 days', now(), ${AUTH_TOKEN_COLUMNS.map(() => "''").join(', ')}) on conflict (id) do nothing;`,
  );
}
w();
w(`insert into public.profiles (id, name, scody_id, support_code, grade, created_at) values`);
w(
  PEER_KEYS.map((key) => {
    const peer = PEER_NAME.get(key) as Account | undefined;
    // 반 이름이 `고1 국어`·`고2 국어`라 학년은 반에서 읽는다.
    const grade = ACADEMY_CLASSES.find((c) => c.studentIds.includes(key))?.grade ?? 1;
    return `  (${q(uuidFor(key))}, ${q(peer?.name ?? key)}, ${q(peer?.scodyId ?? key)}, ${q(supportCodeFor(key))}, ${grade}, now() - interval '90 days')`;
  }).join(',\n'),
);
w(`;`);
w();

w(`insert into public.user_roles (user_id, role) values`);
w(
  [
    ...ACCOUNTS.flatMap((a) => a.roles.map((r) => `  (${q(uuidFor(a.key))}, ${q(r)})`)),
    ...PEER_KEYS.map((key) => `  (${q(uuidFor(key))}, 'student')`),
  ].join(',\n'),
);
w(`;`);
w();

// ── 학원 ─────────────────────────────────────────────────────────────────────

const peerCount = PEER_KEYS.length;
const academyStudents = [
  ...ACCOUNTS.filter((a) => a.academyRole === 'student').map((a) => a.key),
  ...PEER_KEYS,
];

w(`-- ── 학원 ────────────────────────────────────────────────────────────────`);
w(`--`);
w(`-- 계약 좌석은 재원생(${academyStudents.length}명)보다 조금 많게 둔다 — 좌석 활용률이 100%를 넘지 않고`);
w(`-- 0%도 아닌 값이 되어야 그 지표를 화면에서 확인할 수 있다.`);
w(`-- 갱신일은 seed 실행일 기준으로 정한다. 고정 날짜를 박으면 곧 지난 날이 된다.`);
w(
  `insert into public.academies (id, name, contract_seats, renewal_date, status, created_at) values`,
);
w(
  `  (${q(uuidFor(ACADEMY_KEY))}, ${q(ACADEMY_NAME)}, ${academyStudents.length + 13}, current_date + 120, 'active', now() - interval '90 days');`,
);
w();

w(`insert into public.academy_members (academy_id, user_id, member_role) values`);
w(
  [
    ...ACCOUNTS.filter((a) => a.academyRole).map(
      (a) => `  (${q(uuidFor(ACADEMY_KEY))}, ${q(uuidFor(a.key))}, ${q(a.academyRole!)})`,
    ),
    ...PEER_KEYS.map((key) => `  (${q(uuidFor(ACADEMY_KEY))}, ${q(uuidFor(key))}, 'student')`),
  ].join(',\n'),
);
w(`;`);
w();

const classes = ACADEMY_CLASSES.filter((c) => (CLASS_KEYS as readonly string[]).includes(c.id));

w(`insert into public.classes (id, academy_id, name, grade, teacher_id, created_at) values`);
w(
  classes
    .map(
      (c) =>
        `  (${q(uuidFor(c.id))}, ${q(uuidFor(ACADEMY_KEY))}, ${q(c.name)}, ${c.grade ?? 'null'}, ${q(uuidFor(c.teacherId))}, now() - interval '80 days')`,
    )
    .join(',\n'),
);
w(`;`);
w();

w(`insert into public.class_students (class_id, student_id) values`);
w(
  classes
    .flatMap((c) => c.studentIds.map((s) => `  (${q(uuidFor(c.id))}, ${q(uuidFor(s))})`))
    .join(',\n'),
);
w(`;`);
w();

/*
  ── 선생님 초대 토큰은 seed를 돌릴 때마다 새로 뽑는다 ────────────────────────

  **왜**: 독립 검증이 실증했다(2026-08-14). 학부모 계정(`minji`)이 하드코딩된 `INV-TEACHER`를
  `rpc_accept_invite`에 넣어 **학원 선생님이 됐고**, 그 자리에서 학생 15명의 이름·스코디
  아이디·지원 코드를 읽었다. `rpc_accept_invite`는 로그인한 누구나 부를 수 있고
  (`authenticated`), `rpc_invite_info`는 익명이 토큰을 확인해 볼 수 있는 창구다.

  0027·0028이 **앱이 만드는** 토큰을 74비트로 올렸지만, seed가 심어 둔 리터럴은 그대로여서
  그 작업이 무의미해지는 자리였다. 레포를 읽을 수 있으면 토큰을 아는 것과 같다.

  형태는 `rpc_create_invite`와 같게 맞춘다(`INV-T-` + 대문자 hex 20자 = 74비트 난수).
  `supabase/seed.sql`은 git에 올라가지 않으므로 매번 값이 달라도 diff가 지저분해지지 않는다.

  **학생·학부모 초대는 리터럴로 남긴다**: `e2e/auth-flow.spec.ts`가 `/join?invite=INV-STUDENT`·
  `INV-PARENT`를 6곳에서 직접 열어 초대 화면의 상태(유효·이미 사용됨·학부모 거부)를 확인한다.
  두 초대는 학원 **교직원** 권한을 주지 않는다 — 학생 초대는 학생 소속만 붙이고, 학부모 초대는
  서버가 거부한다(0013:433). 남는 위험은 "아무나 한빛학원 학생으로 붙을 수 있다"이고, 그것을
  없애려면 E2E가 토큰을 DB에서 읽어 오도록 바꿔야 한다 — 별 작업으로 남긴다(A-102).
*/
const teacherInviteToken = `INV-T-${randomBytes(10).toString('hex').slice(0, 20).toUpperCase()}`;

w(`-- 초대 링크. 수락하면 소속이 붙는다(\`rpc_accept_invite\`).`);
w(`--`);
w(`-- 선생님 초대 토큰은 seed를 돌릴 때마다 새로 뽑는다(엔트로피 74비트). 하드코딩 리터럴은`);
w(`-- 학부모 계정이 수락해 교직원이 되는 것을 실증으로 확인했다 — \`scripts/gen-seed.ts\` 참고.`);
w(`insert into public.invites (token, academy_id, invitee_role, inviter_id) values`);
w(
  [
    ['INV-STUDENT', 'student'],
    ['INV-PARENT', 'parent'],
    [teacherInviteToken, 'teacher'],
  ]
    .map(
      ([token, role]) =>
        `  (${q(token)}, ${q(uuidFor(ACADEMY_KEY))}, ${q(role)}, ${q(uuidFor('u_academy_director'))})`,
    )
    .join(',\n'),
);
w(`;`);
w();

w(`insert into public.parent_children (parent_id, student_id, status, linked_at) values`);
w(
  Object.entries(PARENT_CHILDREN)
    .flatMap(([parent, kids]) =>
      kids.map(
        (kid) =>
          `  (${q(uuidFor(parent))}, ${q(uuidFor(kid))}, 'linked', now() - interval '80 days')`,
      ),
    )
    .join(',\n'),
);
w(`;`);
w();

// ── 이용권 · 요금 정책 ───────────────────────────────────────────────────────

w(`-- ── 이용권과 요금 정책 ──────────────────────────────────────────────────`);
w(`insert into public.entitlements (user_id, kind, payer, label, started_on) values`);
w(
  [
    ...ACCOUNTS.flatMap((a) =>
      a.entitlements.map(
        (e) =>
          `  (${q(uuidFor(a.key))}, ${q(e.kind)}, ${q(e.payer)}, ${q(e.label)}, current_date - 90)`,
      ),
    ),
    // 반 친구도 학원 이용권으로 학습한다 — 좌석 수와 매출 추정의 근거다.
    ...PEER_KEYS.map(
      (key) => `  (${q(uuidFor(key))}, 'academy', 'academy', '학원 이용권', current_date - 90)`,
    ),
  ].join(',\n'),
);
w(`;`);
w();

w(`-- 기본 요금 정책. \`src/features/pricing.ts\`의 \`DEFAULT_PRICING\`과 같은 값이다.`);
w(
  `insert into public.pricing_policies (student_paid, parent_paid, academy_seat, seat_discount_pct, seat_discount_from, annual_discount_pct, annual_share_pct, updated_by, effective_from)`,
);
w(
  `values (19000, 29000, 12000, 15, 50, 20, 30, ${q(uuidFor('u_admin'))}, now() - interval '90 days');`,
);
w();

// ── 콘텐츠 ───────────────────────────────────────────────────────────────────

const sets: ContentSet[] = SEED_CONTENT;

w(`-- ── 콘텐츠 ${sets.length}세트 · 문항 ${sets.reduce((n, s) => n + s.questions.length, 0)}개 ─────────────────────────────`);
w(`--`);
w(`-- 전부 운영자(총괄관리자) 콘텐츠다(\`owner_academy_id\`가 없다). 원본 fixture의`);
w(`-- \`ownerAcademyName\`이 있는 세트는 학원 이름으로 소유를 잡는다.`);
w();
w(
  `insert into public.content_sets (id, subject, area, title, kind, grade, topic, publish_to_students, owner_academy_id, passage_title, passage_body, created_by, created_at) values`,
);
w(
  sets
    .map((s) => {
      const owner = s.ownerAcademyName === ACADEMY_NAME ? q(uuidFor(ACADEMY_KEY)) : 'null';
      const creator =
        s.ownerAcademyName === ACADEMY_NAME ? uuidFor('u_academy_director') : uuidFor('u_admin');
      return `  (${q(uuidFor(s.id))}, ${q(s.subject)}, ${q(s.area)}, ${q(s.title)}, ${q(s.kind)}, ${s.grade ?? 'null'}, ${qn(s.topic)}, ${s.publishToStudents ? 'true' : 'false'}, ${owner}, ${qn(s.passage?.title)}, ${qn(s.passage?.body)}, ${q(creator)}, now() - interval '85 days')`;
    })
    .join(',\n'),
);
w(`;`);
w();

w(`insert into public.questions (id, content_set_id, position, prompt, choices, answer_index, explanation) values`);
w(
  sets
    .flatMap((s) =>
      s.questions.map(
        (question, i) =>
          `  (${q(uuidFor(question.id))}, ${q(uuidFor(s.id))}, ${i + 1}, ${q(question.prompt)}, ${arr(question.choices)}, ${question.answerIndex}, ${qn(question.explanation)})`,
      ),
    )
    .join(',\n'),
);
w(`;`);
w();

// ── 배정 · 제출 ──────────────────────────────────────────────────────────────

const questionByOldId = new Map(
  sets.flatMap((s) => s.questions.map((question) => [question.id, { set: s, q: question }] as const)),
);

w(`-- ── 배정 ${ASSIGNMENTS_SEED.length}건과 제출 ───────────────────────────────────────────────`);
w(`--`);
w(`-- 제출은 \`assignment_targets.attempt_id\`가 가리키는 \`attempts\` 한 행이다. 정답률·시간·`);
w(`-- 제출일·틀린 문항은 전부 그 행과 \`attempt_answers\`에서 나온다 — 같은 사실을 두 곳에`);
w(`-- 두지 않는다.`);
w();
w(
  `insert into public.assignments (id, class_id, content_set_id, title, due_date, original_due_date, created_by, created_at) values`,
);
w(
  ASSIGNMENTS_SEED.map((a) => {
    const cls = classes.find((c) => c.id === a.classId)!;
    return `  (${q(uuidFor(a.id))}, ${q(uuidFor(a.classId))}, ${q(uuidFor(a.contentId!))}, ${q(a.title)}, ${day(a.dueDate!)}, ${day(a.dueDate!)}, ${q(uuidFor(cls.teacherId))}, now() - interval '20 days')`;
  }).join(',\n'),
);
w(`;`);
w();

w(`insert into public.assignment_targets (assignment_id, student_id) values`);
w(
  ASSIGNMENTS_SEED.flatMap((a) =>
    a.submissions.map((s) => `  (${q(uuidFor(a.id))}, ${q(uuidFor(s.studentId))})`),
  ).join(',\n'),
);
w(`;`);
w();

/** 배정 제출 → `attempts` 한 행. 틀린 문항 목록에서 정답 수를 되돌리지 않는다(D-052). */
interface AttemptRow {
  key: string;
  student: string;
  setOldId: string;
  source: 'personal' | 'academy';
  assignmentOldId?: string;
  timeSec: number;
  day: string;
  correct: number;
  total: number;
  /** 문항 옛 id → 고른 선지(없으면 안 골랐다는 뜻이 아니라 정답을 골랐다는 뜻으로 채운다). */
  answers: { qOldId: string; picked: number | null; correct: boolean }[];
}

const attemptRows: AttemptRow[] = [];

for (const a of ASSIGNMENTS_SEED) {
  const set = sets.find((s) => s.id === a.contentId)!;
  for (const sub of a.submissions) {
    if (!sub.submitted) continue;
    const wrong = new Set(sub.wrongQIds ?? []);
    /*
      틀린 문항 목록이 있으면 그것을 그대로 쓴다. 없는 제출(반 친구)은 정답률에서 개수를
      정하고 앞에서부터 고르게 흩는다 — 문항별 정오의 근거가 필요하기 때문이다.
    */
    const ids = set.questions.map((x) => x.id);
    if (wrong.size === 0 && sub.accuracy != null && sub.accuracy < 100) {
      const count = Math.round((ids.length * (100 - sub.accuracy)) / 100);
      const step = Math.max(1, Math.floor(ids.length / Math.max(1, count)));
      for (let i = 0; i < count; i += 1) wrong.add(ids[(i * step) % ids.length]);
    }
    const answers = set.questions.map((question) => {
      const isWrong = wrong.has(question.id);
      return {
        qOldId: question.id,
        /*
          **고른 선지는 남기지 않는다.** 학원에서 받은 제출 결과는 어느 문항을 틀렸는지만 알려
          준다 — 어떤 선지를 골랐는지는 그 기록에 없다. 예전에는 `정답 + 1`로 지어냈는데, 그건
          없는 사실을 만든 것이고 `어떤 선지를 골랐는지는 남아 있지 않아요`(학부모 상세)가
          어떤 데이터에서도 나올 수 없게 만들었다.
        */
        picked: null as number | null,
        correct: !isWrong,
      };
    });
    attemptRows.push({
      key: `at_${a.id}_${sub.studentId}`,
      student: sub.studentId,
      setOldId: set.id,
      source: 'academy',
      assignmentOldId: a.id,
      timeSec: sub.timeSec ?? 0,
      day: sub.submittedAt ?? a.dueDate!,
      correct: answers.filter((x) => x.correct).length,
      total: answers.length,
      answers,
    });
  }
}

// 개인 학습 풀이 시드(`src/data/attempts.ts`).
for (const [studentId, byItem] of Object.entries(ATTEMPTS_SEED)) {
  for (const attempt of Object.values(byItem)) {
    const setOldId = attempt.itemId.replace(/^li_/, '');
    attemptRows.push({
      key: `at_${studentId}_${setOldId}`,
      student: studentId,
      setOldId,
      source: 'personal',
      timeSec: attempt.timeSec,
      day: attempt.dateISO,
      correct: attempt.correct,
      total: attempt.total,
      answers: attempt.perQuestion.map((p) => ({
        qOldId: p.qId,
        picked: p.pickedIndex ?? null,
        correct: p.correct,
      })),
    });
  }
}

w(
  `insert into public.attempts (id, student_id, content_set_id, source, assignment_id, attempt_no, time_sec, submitted_on, correct_count, total_count) values`,
);
w(
  attemptRows
    .map(
      (r) =>
        `  (${q(uuidFor(r.key))}, ${q(uuidFor(r.student))}, ${q(uuidFor(r.setOldId))}, ${q(r.source)}, ${r.assignmentOldId ? q(uuidFor(r.assignmentOldId)) : 'null'}, 1, ${r.timeSec}, ${day(r.day)}, ${r.correct}, ${r.total})`,
    )
    .join(',\n'),
);
w(`;`);
w();

w(`insert into public.attempt_answers (attempt_id, question_id, picked_index, is_correct) values`);
w(
  attemptRows
    .flatMap((r) =>
      r.answers.map(
        (x) =>
          `  (${q(uuidFor(r.key))}, ${q(uuidFor(x.qOldId))}, ${x.picked == null ? 'null' : x.picked}, ${x.correct ? 'true' : 'false'})`,
      ),
    )
    .join(',\n'),
);
w(`;`);
w();

w(`-- 낸 배정에 풀이를 잇는다. 이 값이 곧 '제출했다'는 사실이다.`);
w(`update public.assignment_targets t set attempt_id = a.id`);
w(`from public.attempts a`);
w(`where a.assignment_id = t.assignment_id and a.student_id = t.student_id;`);
w();

// ── 오답노트 ─────────────────────────────────────────────────────────────────

const noteRows = Object.entries(WRONG_NOTES_SEED).flatMap(([studentId, notes]) =>
  notes.map((n) => ({ studentId, note: n })),
);

w(`-- ── 오답노트 ${noteRows.length}건 ─────────────────────────────────────────────────`);
w(`--`);
w(`-- 학원 배정에서 나온 오답은 \`assignment_id\`를 채운다 — 학원 열람 경계가 그 값으로 출처를`);
w(`-- 되짚는다. 개인 학습 오답은 비워 둔다.`);
w(
  `insert into public.wrong_notes (id, student_id, question_id, content_set_id, source, assignment_id, picked_index, dig, starred, mastered, created_at) values`,
);
w(
  noteRows
    .map(({ studentId, note }) => {
      const found = questionByOldId.get(note.qId);
      const picked =
        note.pickedIndex ??
        (found ? (found.q.answerIndex + 1) % found.q.choices.length : 0);
      // 학원 학습의 `itemId`는 배정 id다(`li_`로 시작하지 않는다).
      const assignment = note.source === 'academy' ? q(uuidFor(note.itemId)) : 'null';
      return `  (${q(uuidFor(`wn_${studentId}_${note.id}`))}, ${q(uuidFor(studentId))}, ${q(uuidFor(note.qId))}, ${q(uuidFor(note.contentId))}, ${q(note.source)}, ${assignment}, ${picked}, ${qn(note.dig)}, ${note.starred ? 'true' : 'false'}, ${note.mastered ? 'true' : 'false'}, (${day(note.createdAt)})::timestamptz)`;
    })
    .join(',\n'),
);
w(`;`);
w();

// ── 활동 이벤트 ──────────────────────────────────────────────────────────────

w(`-- ── 학습 활동 이벤트 ────────────────────────────────────────────────────`);
w(`--`);
w(`-- 지표(MAU·Activation)의 원천이다. **풀이·오답노트가 실제로 일어난 날에 맞춘다** —`);
w(`-- 트리거에 맡기면 전부 seed를 돌린 날이 되어 "모두 오늘 활동했다"가 된다.`);
w(`-- 앞으로 앱에서 일어나는 활동은 트리거가 남긴다.`);
w(`insert into public.learning_events (student_id, occurred_on, kind, ref_id) values`);
w(
  [
    ...attemptRows.flatMap((r) => [
      `  (${q(uuidFor(r.student))}, ${day(r.day)}, 'answer_saved', null)`,
      `  (${q(uuidFor(r.student))}, ${day(r.day)}, 'attempt_submitted', ${q(uuidFor(r.key))})`,
    ]),
    ...noteRows.map(
      ({ studentId, note }) =>
        `  (${q(uuidFor(studentId))}, ${day(note.createdAt)}, 'note_added', ${q(uuidFor(`wn_${studentId}_${note.id}`))})`,
    ),
    ...noteRows
      .filter(({ note }) => note.mastered)
      .map(
        ({ studentId, note }) =>
          `  (${q(uuidFor(studentId))}, ${day(note.createdAt)}, 'review_done', ${q(uuidFor(`wn_${studentId}_${note.id}`))})`,
      ),
  ].join(',\n'),
);
w(`;`);
w();

w(`alter table public.attempts enable trigger attempts_event;`);
w(`alter table public.wrong_notes enable trigger wrong_notes_event;`);
w();
w(`-- 담아 둔 학습·칭찬·주간 요약은 넣지 않는다. 빈 상태를 화면에서 확인해야 하고,`);
w(`-- 앱에서 만들어 보는 것이 그 흐름의 검증이다.`);

writeFileSync('supabase/seed.sql', `${out.join('\n')}\n`, 'utf8');

const counts = {
  '계정(로그인 가능)': ACCOUNTS.length,
  '반 친구': peerCount,
  '콘텐츠 세트': sets.length,
  문항: sets.reduce((n, s) => n + s.questions.length, 0),
  반: classes.length,
  배정: ASSIGNMENTS_SEED.length,
  풀이: attemptRows.length,
  오답노트: noteRows.length,
};
console.log('supabase/seed.sql 생성');
for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
