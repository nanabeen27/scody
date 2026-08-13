/**
 * AI 프록시 검증.
 *
 *     npx tsx scripts/verify-ai.ts
 *
 * **비밀키가 클라이언트에 없어도 동작하는지**가 핵심이다(A-088·M9-02). 로그인한 사용자의 JWT로
 * Edge Function을 부르고, 로그인하지 않은 호출이 거부되는지 함께 본다.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const at = line.indexOf('=');
  if (at > 0 && !line.trimStart().startsWith('#')) {
    process.env[line.slice(0, at).trim()] ??= line.slice(at + 1).trim();
  }
}
const URL_ = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

let failed = 0;
function check(label: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failed += 1;
}

async function main() {
  console.log('\n[익명] 프록시를 부를 수 없다');
  const anon = await fetch(`${URL_}/functions/v1/ai-proxy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ system: 's', user: '안녕' }),
  });
  check(`로그인 없이는 거부된다 (HTTP ${anon.status})`, anon.status === 401);

  console.log('\n[학생] 프록시로 답을 받는다');
  const client = createClient(URL_, KEY, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({
    email: 'seojun@scody.test',
    password: 'test1234',
  });
  if (signInError) {
    check('로그인', false, signInError.message);
    process.exit(1);
  }
  const token = (await client.auth.getSession()).data.session!.access_token;
  const res = await fetch(`${URL_}/functions/v1/ai-proxy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: '한 문장으로 짧게 답해요.',
      user: '국어에서 비유란 무엇인가요?',
    }),
  });
  const body = (await res.json().catch(() => null)) as
    | { choices?: { message?: { content?: string } }[]; error?: string }
    | null;
  const text = body?.choices?.[0]?.message?.content ?? '';
  check(`답이 온다 (HTTP ${res.status})`, res.ok && text.trim().length > 0, body?.error);
  if (text) console.log(`      «${text.slice(0, 70).replace(/\n/g, ' ')}…»`);

  console.log('\n[사용량] 호출이 기록된다');
  const { count } = await client
    .from('ai_usage')
    .select('*', { count: 'exact', head: true });
  check(`본인 사용량이 보인다 (${count}건)`, (count ?? 0) > 0);

  console.log(`\n결과: ${failed === 0 ? '전부 통과' : `${failed}개 실패`}\n`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => {
  console.error('검증 중단:', e instanceof Error ? e.message : e);
  process.exit(1);
});
