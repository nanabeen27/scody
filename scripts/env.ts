import { readFileSync } from 'node:fs';

/**
 * `.env`를 `process.env`로 올린다. **import 한 줄로 끝난다** — `import './env';`
 *
 * ## 왜 한곳에 두는가
 *
 * 예전에는 스크립트마다 로더를 손으로 갖고 있었고, **규칙이 갈렸다**:
 * `run-sql.ts`는 감싼 따옴표를 벗기고 `verify-rls.ts`·`verify-ai.ts`는 벗기지 않았으며,
 * `gen-seed.ts`는 로더가 아예 없어 `package.json`의 `set -a && . ./.env`(셸 소싱)에만 의존했다.
 *
 * 그래서 두 가지가 실제로 깨져 있었다.
 *
 * 1. `npx tsx scripts/gen-seed.ts`가 실패했다 — `.env`에 값이 있는데도. 그런데 그 스크립트가
 *    만드는 `supabase/seed.sql`의 머리 주석이 **바로 그 명령**을 안내한다.
 * 2. `.env.example`은 "특수문자가 든 값은 작은따옴표로 감싸라"고 안내한다. 비밀번호를 감싸면
 *    셸 소싱 경로(`gen-seed`)는 따옴표를 벗긴 값으로 해시를 만들고, 파싱 경로
 *    (`verify-rls`·`verify-ai`)는 따옴표가 붙은 값으로 로그인한다 — **seed 비밀번호와 검증
 *    비밀번호가 갈리고**, 증상은 `db:verify`의 `✗ 로그인` 한 줄이라 원인을 찾기 어렵다(D-157이
 *    세 스크립트를 같은 값에 묶은 뒤로 도달 가능해졌다).
 *
 * 규칙은 `run-sql.ts`의 판본을 쓴다(따옴표를 벗긴다). 셸 소싱(`set -a && . ./.env`)은
 * **`supabase` CLI를 부르는 npm 스크립트에만** 남긴다 — 거기서는 CLI가 환경변수를 읽는다.
 *
 * 이미 있는 값은 덮지 않는다(`??=`). CI나 `EXPO_PUBLIC_x=y npm run ...`이 이긴다.
 */
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const at = line.indexOf('=');
  if (at > 0 && !line.trimStart().startsWith('#')) {
    const value = line.slice(at + 1).trim();
    process.env[line.slice(0, at).trim()] ??= value.replace(/^(['"])(.*)\1$/, '$2');
  }
}
