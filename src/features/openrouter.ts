/**
 * OpenRouter 호출(Scody AI). 모델: google/gemini-3.6-flash.
 * 키는 EXPO_PUBLIC_OPENROUTER_API_KEY 환경변수(.env)에서 읽는다.
 * 키가 없으면 데모 폴백. 키가 있는데 실패하면 원인을 그대로 보여준다(디버깅).
 */
const MODEL = 'google/gemini-3.5-flash-lite';
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

function getKey(): string | undefined {
  const raw = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
  const key = raw ? raw.trim() : '';
  return key.length > 0 ? key : undefined;
}

export function hasOpenRouterKey(): boolean {
  return !!getKey();
}

export async function askScodyAI(system: string, user: string): Promise<string> {
  const key = getKey();
  if (!key) {
    return `${user}\n\n(Scody AI 데모 응답) OpenRouter 키가 감지되지 않았어요. 프로젝트 루트 .env에 EXPO_PUBLIC_OPENROUTER_API_KEY를 넣고 dev 서버를 재시작해 주세요.`;
  }
  try {
    const referer =
      typeof window !== 'undefined' && window.location ? window.location.origin : 'https://scody.app';
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': referer,
        'X-Title': 'Scody',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return `Scody AI 호출 실패 (HTTP ${res.status}). 모델(${MODEL})·키·크레딧을 확인해 주세요.\n${body.slice(0, 300)}`;
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text === 'string' && text.trim()) return text.trim();
    return `Scody AI 응답이 비어 있어요. 응답 형식: ${JSON.stringify(data).slice(0, 300)}`;
  } catch (e) {
    return `Scody AI 연결 오류: ${e instanceof Error ? e.message : String(e)}. (브라우저 CORS/네트워크 확인)`;
  }
}

/**
 * 스트리밍 호출. 조각이 올 때마다 `onDelta`로 넘기고, 끝나면 전체 문장을 반환한다.
 * 브라우저는 SSE로 읽고, 스트림을 못 읽는 환경(네이티브 등)에서는 한 번에 받아 통째로 넘긴다.
 */
export async function askScodyAIStream(
  system: string,
  user: string,
  onDelta: (chunk: string) => void,
): Promise<string> {
  const key = getKey();
  if (!key) {
    const demo = await askScodyAI(system, user);
    onDelta(demo);
    return demo;
  }
  try {
    const referer =
      typeof window !== 'undefined' && window.location ? window.location.origin : 'https://scody.app';
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': referer,
        'X-Title': 'Scody',
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const msg = `Scody AI 호출 실패 (HTTP ${res.status}). 모델(${MODEL})·키·크레딧을 확인해 주세요.
${body.slice(0, 300)}`;
      onDelta(msg);
      return msg;
    }

    const body = (res as unknown as { body?: ReadableStream<Uint8Array> }).body;
    if (!body || typeof body.getReader !== 'function') {
      // 스트림을 못 읽는 환경: 전체 응답을 파싱해 한 번에 넘긴다.
      const text = parseSseText(await res.text());
      onDelta(text);
      return text;
    }

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const chunk = deltaFromSseLine(line);
        if (chunk) {
          full += chunk;
          onDelta(chunk);
        }
      }
    }
    const tail = deltaFromSseLine(buffer);
    if (tail) {
      full += tail;
      onDelta(tail);
    }
    if (full.trim()) return full.trim();
    const empty = 'Scody AI 응답이 비어 있어요. 잠시 뒤 다시 물어봐 주세요.';
    onDelta(empty);
    return empty;
  } catch (e) {
    const msg = `Scody AI 연결 오류: ${e instanceof Error ? e.message : String(e)}. (브라우저 CORS/네트워크 확인)`;
    onDelta(msg);
    return msg;
  }
}

/** SSE 한 줄에서 텍스트 조각을 뽑는다. 데이터가 아니면 빈 문자열. */
export function deltaFromSseLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return '';
  const payload = trimmed.slice(5).trim();
  if (!payload || payload === '[DONE]') return '';
  try {
    const json = JSON.parse(payload);
    const delta = json?.choices?.[0]?.delta?.content;
    return typeof delta === 'string' ? delta : '';
  } catch {
    return '';
  }
}

/** 스트림을 못 읽는 환경에서 전체 SSE 본문을 이어 붙인다. */
export function parseSseText(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map(deltaFromSseLine)
    .join('')
    .trim();
}
