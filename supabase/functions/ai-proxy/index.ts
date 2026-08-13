/**
 * Scody AI 프록시.
 *
 * ## 왜 필요한가
 *
 * 프로토타입은 `EXPO_PUBLIC_OPENROUTER_API_KEY`로 브라우저에서 OpenRouter를 직접 불렀다.
 * `EXPO_PUBLIC_*`은 번들에 그대로 실리므로 **비밀키가 공개된다**. 게다가 `expo export`로 만든
 * 빌드에는 그 값이 들어가지 않아서 **출시 빌드에서는 AI가 통째로 죽어 있었다**(A-088).
 *
 * 이 함수가 그 두 가지를 함께 닫는다: 키는 서버 환경변수(`OPENROUTER_API_KEY`)에만 있고,
 * 클라이언트는 로그인한 사용자의 JWT로 이 함수를 부른다.
 *
 * ## 무엇을 막는가
 *
 * - **로그인하지 않은 호출**: JWT가 없으면 거부한다. 남의 크레딧으로 모델을 쓰는 길을 열지 않는다.
 * - **호출 폭주**: 사용자별 분당 상한과 일일 상한을 둔다. 상한은 `learning_events`가 아니라
 *   `ai_usage` 표에서 센다 — 학습 활동과 AI 호출은 다른 사실이다.
 * - **모델 바꿔치기**: 클라이언트가 모델을 고르지 못한다. 서버가 정한 모델만 쓴다.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const MODEL = 'google/gemini-3.5-flash-lite';
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/** 사용자 한 명의 상한. 학생이 오답노트를 정리하는 실제 사용량을 넘는 값으로 둔다. */
const PER_MINUTE = 10;
const PER_DAY = 200;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST만 받아요.' }, 405);

  const key = Deno.env.get('OPENROUTER_API_KEY');
  if (!key) {
    // 키가 없는 배포는 정상 상태가 아니다. 조용히 데모 문장을 돌려주지 않는다.
    return json({ error: 'AI 키가 서버에 설정되지 않았어요.' }, 503);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return json({ error: '로그인이 필요해요.' }, 401);

  let body: { system?: string; user?: string; stream?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ error: '요청을 읽지 못했어요.' }, 400);
  }
  const system = (body.system ?? '').slice(0, 4000);
  const prompt = (body.user ?? '').slice(0, 8000);
  if (!prompt.trim()) return json({ error: '물어볼 내용이 비어 있어요.' }, 400);

  /*
    상한 확인. `service_role`로 세고 기록한다 — 사용자가 자기 사용량을 지우지 못하게 하려면
    그 표를 사용자 권한으로 열어 둘 수 없다.
  */
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const now = new Date();
  const minuteAgo = new Date(now.getTime() - 60_000).toISOString();
  const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();

  const [{ count: perMinute }, { count: perDay }] = await Promise.all([
    admin
      .from('ai_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('called_at', minuteAgo),
    admin
      .from('ai_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('called_at', dayAgo),
  ]);

  if ((perMinute ?? 0) >= PER_MINUTE) {
    return json({ error: '잠깐만요. 조금 뒤에 다시 물어봐 주세요.' }, 429);
  }
  if ((perDay ?? 0) >= PER_DAY) {
    return json({ error: '오늘은 물어볼 수 있는 횟수를 다 썼어요. 내일 다시 만나요.' }, 429);
  }

  await admin.from('ai_usage').insert({ user_id: user.id });

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://scody.app',
      'X-Title': 'Scody',
    },
    // 모델은 서버가 정한다. 클라이언트가 고르면 비싼 모델로 바꿔치기할 수 있다.
    body: JSON.stringify({
      model: MODEL,
      stream: body.stream === true,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return json({ error: `AI 호출이 실패했어요. (${res.status})`, detail: detail.slice(0, 300) }, 502);
  }

  // 스트리밍은 본문을 그대로 흘려 준다. 화면이 조각을 받아 그린다.
  if (body.stream === true) {
    return new Response(res.body, {
      headers: { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  }
  return new Response(await res.text(), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
