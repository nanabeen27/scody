import { readFileSync } from 'node:fs';
import { Client } from 'pg';

/**
 * 테스트 사이에 DB를 seed 상태로 되돌린다.
 *
 * ## 왜 필요해졌나
 *
 * 프로토타입은 상태가 메모리에 있어서 **페이지를 새로 열면 초기화**됐다. 그래서 각 테스트가
 * 서로에게 영향을 주지 않았다. 지금은 서버에 남는다 — 한 테스트가 선생님을 제외하거나 반을
 * 폐강하면 뒤 테스트가 그 상태를 물려받는다(실측: 학원 흐름 15건이 이 때문에 갈렸다).
 *
 * `supabase/seed.sql`은 앞머리에서 앱 표를 비우고 다시 넣으므로 그대로 다시 실행하면 된다.
 * 연결은 프로세스당 한 번만 만든다 — 매번 새로 열면 왕복이 테스트 시간을 지배한다.
 */

let client: Client | null = null;
let sql: string | null = null;

function env(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const at = line.indexOf('=');
    if (at > 0 && !line.trimStart().startsWith('#')) {
      out[line.slice(0, at).trim()] = line
        .slice(at + 1)
        .trim()
        .replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  return out;
}

async function connect(): Promise<Client> {
  if (client) return client;
  const vars = env();
  const url = new URL(readFileSync('supabase/.temp/pooler-url', 'utf8').trim());
  const next = new Client({
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    database: url.pathname.replace(/^\//, '') || 'postgres',
    // 풀러 주소에는 비밀번호가 없다. CLI와 같은 값을 넣는다.
    password: vars.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });
  await next.connect();
  client = next;
  return next;
}

/** seed를 다시 넣는다. 파일 전체를 한 번에 보내 하나의 트랜잭션이 되게 한다. */
export async function reseed(): Promise<void> {
  sql ??= readFileSync('supabase/seed.sql', 'utf8');
  const db = await connect();
  await db.query(sql);
}

export async function closeSeedConnection(): Promise<void> {
  await client?.end();
  client = null;
}

/**
 * seed가 심어 둔 초대 토큰. 역할당 하나다.
 *
 * ## 왜 파일에서 읽는가
 *
 * 예전에는 테스트가 `INV-STUDENT`·`INV-PARENT`를 그대로 적었다. 그래서 seed가 그 리터럴을 계속
 * 심어야 했고, 레포를 읽을 수 있는 누구나 `rpc_accept_invite('INV-STUDENT')`로 한빛학원 학생이
 * 될 수 있었다(실측으로 재현했다 — A-103). 토큰을 seed 실행마다 난수로 뽑으려면 테스트가 값을
 * 서버 쪽에서 받아 와야 한다.
 *
 * `supabase/seed.sql`을 파싱한다. DB 왕복이 없고, `reseed()`가 넣는 것과 **같은 파일**이라
 * 재시드 결과와 어긋날 수 없다. 서버 uuid를 규칙으로 다시 만드는 `_ids.ts`의 `sid()`와 같은 자리다.
 */
const INVITE_INSERT = /insert into public\.invites \([^)]*\) values\s*([\s\S]*?);/;
const INVITE_ROW = /\(\s*'([^']+)'\s*,\s*'[^']+'\s*,\s*'([^']+)'/g;
const RESEED_HINT = '`npm run db:seed`를 먼저 돌려 주세요.';

let inviteTokens: Map<string, string> | null = null;

export function inviteToken(role: 'student' | 'parent' | 'teacher'): string {
  if (!inviteTokens) {
    sql ??= readFileSync('supabase/seed.sql', 'utf8');
    const rows = INVITE_INSERT.exec(sql)?.[1];
    if (!rows) throw new Error(`seed.sql에서 초대 목록을 찾지 못했어요. ${RESEED_HINT}`);
    inviteTokens = new Map();
    for (const [, token, invitedRole] of rows.matchAll(INVITE_ROW)) {
      if (!inviteTokens.has(invitedRole)) inviteTokens.set(invitedRole, token);
    }
  }
  const token = inviteTokens.get(role);
  if (!token) throw new Error(`seed.sql에 ${role} 초대가 없어요. ${RESEED_HINT}`);
  return token;
}

/**
 * 개발용 계정 비밀번호. **`.env`에서 읽는다** — 레포에 리터럴로 두지 않는다(D-157).
 *
 * `inviteToken()`이 seed에서 값을 읽는 것과 같은 자리다. Playwright 프로세스는 `.env`를 자동으로
 * 읽지 않으므로(설정에 dotenv가 없다) 여기서 한 줄만 꺼낸다.
 */
export function devPassword(): string {
  const line = readFileSync('.env', 'utf8')
    .split('\n')
    .find((l) => l.startsWith('EXPO_PUBLIC_DEV_LOGIN_PASSWORD='));
  const value = line?.slice(line.indexOf('=') + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
  if (!value) throw new Error('`.env`에 `EXPO_PUBLIC_DEV_LOGIN_PASSWORD`가 필요해요.');
  return value;
}
