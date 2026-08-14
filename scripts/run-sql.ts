/**
 * SQL 파일 하나를 연결된 프로젝트에 실행한다.
 *
 *     npx tsx scripts/run-sql.ts supabase/seed.sql
 *
 * **왜 필요한가**: `supabase db push --include-seed`는 **올릴 마이그레이션이 있을 때만** seed를
 * 돌린다(실측: 최신 상태면 `"seeds":[]`로 건너뛴다). 그래서 seed만 다시 넣을 길이 없었다.
 *
 * `supabase db reset --linked`는 seed를 돌려 주지만 **스키마를 먼저 지운다.** 그러면 seed 앞머리에
 * 둔 "운영 DB면 중단" 가드가 실행될 기회조차 없이 데이터가 사라진다. 이 스크립트는 스키마를
 * 건드리지 않고 SQL만 실행해서 그 가드가 실제로 일하게 한다.
 *
 * 접속은 `supabase link`가 저장해 둔 풀러 주소(`supabase/.temp/pooler-url`)를 쓴다. 이 머신은
 * IPv6 송신이 안 되고 직접 연결 호스트(`db.<ref>.supabase.co`)는 IPv6 전용이라 풀러가 유일한 길이다.
 */
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
// `.env`를 `process.env`로 올린다. 규칙은 `scripts/env.ts` 한곳에 있다.
import './env';

const file = process.argv[2];
if (!file) {
  console.error('사용법: tsx scripts/run-sql.ts <파일.sql>');
  process.exit(1);
}

const url = readFileSync('supabase/.temp/pooler-url', 'utf8').trim();
if (!url) {
  console.error('supabase/.temp/pooler-url이 비어 있어요. `npm run db:push`로 먼저 링크해 주세요.');
  process.exit(1);
}

/*
  **풀러 주소에는 비밀번호가 없다**(실측: `URL.password`가 빈 문자열이다). CLI가 접속할 때
  `SUPABASE_DB_PASSWORD`를 따로 넘기기 때문이다. 여기서도 같은 값을 넣어 준다.
*/
const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error('.env에 SUPABASE_DB_PASSWORD가 필요해요.');
  process.exit(1);
}

const sql = readFileSync(file, 'utf8');

/*
  **`connectionString`과 `password`를 함께 주면 안 된다.** `pg`는 연결 문자열을 파싱해 그 값으로
  나머지 설정을 덮어쓰므로(`ConnectionParameters`), 주소에 담긴 빈 비밀번호가 위에서 넣은 값을
  지운다(실측: `client password must be a string`). 그래서 필드를 하나씩 넘긴다.
*/
const target = new URL(url);

async function main() {
  const client = new Client({
    host: target.hostname,
    port: Number(target.port || 5432),
    user: decodeURIComponent(target.username),
    database: target.pathname.replace(/^\//, '') || 'postgres',
    password,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    /*
      파일 전체를 한 번에 보낸다 — 문장 단위로 쪼개면 `do $$ … $$;` 안의 세미콜론에서 잘린다.
      한 번에 보내면 하나의 암묵적 트랜잭션이 되어, 중간에 실패하면 전부 되돌아간다.
      seed가 앞머리에서 truncate하므로 이 성질이 중요하다.
    */
    await client.query(sql);
    console.log(`${file} 실행 완료`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(`${file} 실행 실패:`, e instanceof Error ? e.message : e);
  process.exit(1);
});
