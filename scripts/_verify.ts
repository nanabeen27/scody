/**
 * 검증 스크립트 공용 헬퍼.
 *
 * `verify-rls.ts`·`verify-note-schedule.ts`가 같은 골격을 각자 갖고 있었다 — 단정 카운터, seed
 * 계정 로그인, 풀러 접속, `.env` 가드. `scripts/env.ts`가 이미 스크립트 공용 모듈의 선례다.
 *
 * **아직 `verify-note-schedule.ts`만 이 모듈을 쓴다.** `verify-rls.ts`(1300줄 · 단정 125개)는
 * 자기 사본을 그대로 들고 있다 — 그 스크립트는 이번 변경 범위가 아니라 함께 옮기지 않았다.
 * 옮기기 전에는 사본이 **줄지 않았다**는 뜻이므로, 여기 있는 것을 고칠 때 그쪽도 같이 본다.
 * 그때까지 쓰이지 않는 것은 두지 않는다(`count`는 `verify-rls.ts`에 그대로 있다).
 *
 * **풀러 접속의 함정을 여기 한 번만 적는다.** `run-sql.ts`에만 있던 주석이라 세 번째 사본을 쓰는
 * 사람이 그 이유를 모른 채 복사했다.
 */
import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import './env';

const URL_ = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
/** seed 계정 공용 비밀번호. `.env`에서 읽는다 — 레포에 리터럴로 두지 않는다. */
const PASSWORD = process.env.EXPO_PUBLIC_DEV_LOGIN_PASSWORD ?? '';

/** `signIn`·`anonClient`를 부르기 전에 한 번. 없는 값으로 클라이언트를 만들면 오류가 불명확하다. */
export function requireEnv(): void {
  if (!URL_ || !KEY) throw new Error('.env에 EXPO_PUBLIC_SUPABASE_URL·ANON_KEY가 필요해요.');
  if (!PASSWORD) throw new Error('.env에 EXPO_PUBLIC_DEV_LOGIN_PASSWORD가 필요해요.');
}

let passed = 0;
let failed = 0;

/** 단정 하나. 실패해도 계속 돈다 — 한 번에 전체 상태를 보는 것이 이 스크립트의 목적이다. */
export function check(label: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/** 기대·실제를 함께 적는 단정. 값 비교는 이쪽이 실패 원인을 바로 말해 준다. */
export function eq(label: string, actual: unknown, expected: unknown): void {
  check(
    label,
    actual === expected,
    `기대 ${JSON.stringify(expected)}, 실제 ${JSON.stringify(actual)}`,
  );
}

export function results(): { passed: number; failed: number } {
  return { passed, failed };
}

/** 익명 클라이언트. 아무것도 보이지 않아야 하는 벽을 시험한다. */
function anonClient(): SupabaseClient {
  return createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * seed 계정으로 **실제 로그인한다.** 정책은 `auth.uid()`를 보고 판단하므로 진짜 JWT가 없으면
 * 검증이 되지 않는다. 이메일 규칙(`{scodyId}@scody.test`)은 `gen-seed.ts`가 정한다.
 */
export async function signIn(scodyId: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({
    email: `${scodyId}@scody.test`,
    password: PASSWORD,
  });
  if (error) throw new Error(`${scodyId} 로그인 실패: ${error.message}`);
  return client;
}

/**
 * 소유자 연결. RLS를 지나지 않으므로 seed 상태 확인과 정리에만 쓴다.
 *
 * **풀러 주소를 쓴다.** 직접 연결 호스트(`db.<ref>.supabase.co`)는 IPv6 전용이고 이 머신은 IPv6
 * 송신이 안 된다. 그리고 **`connectionString`을 쓰지 않는다** — 풀러 주소에는 비밀번호가 없어서
 * (실측: `URL.password`가 빈 문자열) 필드를 하나씩 넘기고 비밀번호만 `.env`에서 붙인다.
 */
export function ownerClient(): Client {
  const url = readFileSync('supabase/.temp/pooler-url', 'utf8').trim();
  if (!url) throw new Error('supabase/.temp/pooler-url이 비어 있어요. `npm run db:push`를 먼저 돌려 주세요.');
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) throw new Error('.env에 SUPABASE_DB_PASSWORD가 필요해요.');
  const u = new URL(url);
  return new Client({
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username),
    password,
    database: u.pathname.replace(/^\//, '') || 'postgres',
    ssl: { rejectUnauthorized: false },
  });
}
