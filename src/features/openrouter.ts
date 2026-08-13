import { hasSupabaseConfig, supabase } from '@/lib/supabase';

/**
 * Scody AI 호출.
 *
 * ## 키는 클라이언트에 없다
 *
 * 예전에는 `EXPO_PUBLIC_OPENROUTER_API_KEY`를 브라우저에서 읽어 OpenRouter를 직접 불렀다.
 * `EXPO_PUBLIC_*`은 번들에 그대로 실리므로 **비밀키가 공개됐고**, `expo export` 빌드에는 그 값이
 * 들어가지 않아 **출시 빌드에서 AI가 통째로 죽어 있었다**(A-088).
 *
 * 지금은 Edge Function(`supabase/functions/ai-proxy`)이 부른다. 키는 서버 환경변수에만 있고,
 * 클라이언트는 로그인한 사용자의 JWT로 그 함수를 부른다. 상한(분당·일일)도 서버가 센다.
 *
 * 모델을 클라이언트가 고르지 않는다 — 서버가 정한 모델만 쓴다.
 */

/**
 * 프록시를 쓸 수 있는 상태인지. 화면이 `Scody AI를 연결하지 않았어요`를 말할 때 본다.
 *
 * **이름을 유지한다** — 호출부 여러 곳이 이 함수로 안내를 가른다. 보는 대상만 OpenRouter 키에서
 * Supabase 설정으로 바뀌었다.
 */
export function hasOpenRouterKey(): boolean {
  return hasSupabaseConfig();
}

/** 프록시를 부른다. 실패는 예외가 아니라 값으로 돌려준다. */
async function callProxy(
  system: string,
  user: string,
  stream: boolean,
): Promise<{ ok: true; res: Response } | { ok: false; message: string }> {
  if (!hasSupabaseConfig()) return { ok: false, message: 'no-config' };
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  // 세션 읽기도 `try` 안에 둔다 — 저장소가 막히면 여기서 던져 계약이 깨졌다.
  try {
    const { data } = await supabase().auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, message: 'no-session' };
    const res = await fetch(`${base}/functions/v1/ai-proxy`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ system, user, stream }),
    });
    if (!res.ok) {
      /*
        서버가 사람이 읽을 문장을 준다(상한 초과·키 없음 등). 그 문장을 그대로 쓴다 —
        여기서 다시 쓰면 두 곳이 갈린다.
      */
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, message: body?.error ?? `AI 호출이 실패했어요. (${res.status})` };
    }
    return { ok: true, res };
  } catch (e) {
    return {
      ok: false,
      message: `Scody AI 연결 오류: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * 성공과 실패를 **값으로 구분해** 돌려준다.
 *
 * `askScodyAI`는 실패도 문장으로 반환한다(호출부가 화면에 그대로 뿌리기 편하도록).
 * 그런데 그 문장을 저장하는 화면(학부모 주간 요약)에서는 오류가 사실처럼 남는다.
 * 저장하거나 판단이 필요한 곳은 이 함수를 쓴다.
 */
export async function askScodyAIResult(
  system: string,
  user: string,
): Promise<{ ok: boolean; text: string }> {
  if (!hasSupabaseConfig()) return { ok: false, text: 'no-key' };
  const text = await askScodyAI(system, user);
  return { ok: isAiSavable(text), text };
}

/**
 * 키가 없을 때 돌려주는 데모 응답의 표식.
 *
 * `askScodyAI`와 `isAiSavable`이 **같은 값**을 봐야 한다. 문자열을 두 곳에 적어 두면
 * 한쪽만 고쳐져 데모 응답이 다시 저장 검사를 통과한다.
 */
const AI_DEMO_MARK = '(Scody AI 데모 응답)';

/** 스트림·비스트림 두 경로가 같은 문장을 쓴다. 한쪽만 고쳐지면 빈 응답이 성공으로 통과한다. */
const AI_EMPTY = 'Scody AI 응답이 비어 있어요. 잠시 뒤 다시 물어봐 주세요.';

/**
 * **실패** 문장인가 — 화면에 답변으로 그리지도, 저장하지도 않는다.
 *
 * `askScodyAI`·`askScodyAIStream`은 실패도 **문장으로** 반환한다(스트리밍 화면이 조각을 그대로
 * 뿌리기 편하도록). 그래서 그리기 전에 이걸로 걸러야 한다 — 그러지 않으면
 * `Scody AI 연결 오류: … (브라우저 CORS/네트워크 확인)`이 `Scody AI`의 답으로 보인다.
 *
 * 빈 문장도 실패다. 네이티브는 스트림을 못 읽어 비스트림 경로로 가고, 그 경로는 파싱할 조각이
 * 없으면 `''`를 돌려줄 수 있다 — `''`를 성공으로 보면 빈 답변 풍선이 뜨고 빈 메모가 저장된다.
 *
 * **데모 응답(키 없음)은 실패가 아니다.** 저장만 막는다 — `isAiSavable`을 쓴다.
 */
export function isAiFailure(text: string): boolean {
  const t = text.trim();
  return !t || /^Scody AI (호출 실패|응답이 비어|연결 오류)/.test(t);
}

/**
 * **저장해도 되는** 답인가 — 오답노트 메모·주간 요약처럼 남는 값을 쓰기 전에 본다.
 *
 * 실패에 더해 **키 없는 데모 응답**을 막는다. 데모 문장은 모델이 쓴 설명이 아니라 안내라서
 * 학생의 `내 오답노트 메모`로 남으면 안 되고(D-102), 그 메모는 학부모 리포트와 학원 화면에도
 * 그대로 나간다. 대신 화면에 **보여 주는 것은 막지 않는다** — 그러면 키 없는 데모 빌드에서
 * 오답노트 대화가 아예 시작되지 않아 정리 흐름 전체가 죽는다.
 */
export function isAiSavable(text: string): boolean {
  return !isAiFailure(text) && !text.includes(AI_DEMO_MARK);
}

export async function askScodyAI(system: string, user: string): Promise<string> {
  const call = await callProxy(system, user, false);
  if (!call.ok) {
    if (call.message === 'no-config' || call.message === 'no-session') {
      /*
        질문을 되돌려 주지 않는다. 예전에는 `${user}`를 앞에 붙여 돌려줬는데, 그 값이 그대로
        저장돼 학생의 `내 오답노트 메모`가 자기 질문 + 정답이 든 컨텍스트가 됐다.
        개발자용 안내(.env·서버 설정)도 넣지 않는다 — 학생 화면에 나가는 문장이다.
      */
      return `${AI_DEMO_MARK} 지금은 Scody AI를 연결하지 않은 데모 상태예요. 실제 설명 대신 이 안내가 나와요.`;
    }
    return `Scody AI 호출 실패. ${call.message}`;
  }
  const data = await call.res.json().catch(() => null);
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text === 'string' && text.trim()) return text.trim();
  return AI_EMPTY;
}

/**
 * 조각을 화면으로 넘긴다. **소비자가 던져도 값 계약을 지킨다.**
 *
 * `onDelta`는 부르는 화면의 코드다(대개 `setState`). 거기서 예외가 나면 그대로
 * `askScodyAIStream`의 거절로 새어 나가, 실패는 값이라는 이 모듈의 계약이 깨졌다 —
 * 그러면 부르는 화면의 대기 표시가 꺼지지 않는다. 그리기 실패는 답 자체를 무르지 않으므로
 * 여기서 삼키고, 반환값은 그대로 준다.
 */
function emit(onDelta: (chunk: string) => void, chunk: string): void {
  try {
    onDelta(chunk);
  } catch (e) {
    console.warn('답 조각을 화면에 넘기지 못했어요:', e instanceof Error ? e.message : String(e));
  }
}

/**
 * 스트리밍 호출. 조각이 올 때마다 `onDelta`로 넘기고, 끝나면 전체 문장을 반환한다.
 * 브라우저는 SSE로 읽고, 스트림을 못 읽는 환경(네이티브 등)에서는 한 번에 받아 통째로 넘긴다.
 *
 * **던지지 않는다.** 실패는 `isAiFailure`가 아는 문장으로 돌려준다.
 */
export async function askScodyAIStream(
  system: string,
  user: string,
  onDelta: (chunk: string) => void,
): Promise<string> {
  const call = await callProxy(system, user, true);
  if (!call.ok) {
    if (call.message === 'no-config' || call.message === 'no-session') {
      const demo = await askScodyAI(system, user);
      emit(onDelta, demo);
      return demo;
    }
    const msg = `Scody AI 호출 실패. ${call.message}`;
    emit(onDelta, msg);
    return msg;
  }

  const body = (call.res as unknown as { body?: ReadableStream<Uint8Array> }).body;
  if (!body || typeof body.getReader !== 'function') {
    /*
      스트림을 못 읽는 환경: 전체 응답을 파싱해 한 번에 넘긴다. **네이티브는 항상 이 경로다**
      (`Response.body.getReader`가 없다). 파싱할 조각이 없으면 `''`가 나오므로 아래 스트리밍
      경로와 **같은 빈 응답 문장**으로 바꿔 준다 — 그러지 않으면 빈 답변이 성공으로 통과한다.
    */
    // 본문 읽기가 끊기면 빈 응답으로 다룬다 — 여기서 던지면 대기 표시가 꺼지지 않는다.
    const raw = await call.res.text().catch(() => '');
    const text = parseSseText(raw).trim() || AI_EMPTY;
    emit(onDelta, text);
    return text;
  }

  let full = '';
  /*
    **읽다가 끊겨도 예외로 나가지 않는다.** 이 모듈의 계약은 `실패는 값`인데(위 `callProxy`)
    스트림 읽기만 예외로 새어 나갔다. 부르는 화면은 그 예외를 받을 준비가 없어서 대기 표시가
    꺼지지 않고 보내기·정리 버튼이 화면을 나갈 때까지 눌리지 않았다.

    끊긴 조각은 답으로 쓰지 않는다 — 중간에 끊긴 설명은 틀린 설명이 될 수 있고, 저장하는
    화면(오답노트 메모)이 그것을 남기면 되돌릴 방법이 없다. 실패 문장을 `onDelta`로 흘리지도
    않는다: 이미 그려 둔 조각 뒤에 오류 문장이 이어 붙으면 답변의 일부로 읽힌다.

    **`getReader`·`TextDecoder`도 이 안에서 만든다.** 둘 다 던질 수 있는데(스트림을 이미 다른
    곳에서 읽고 있거나, `TextDecoder`가 없는 환경) `try` 밖에 있어서 그 예외만 계약을 빠져나갔다.
  */
  try {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
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
          emit(onDelta, chunk);
        }
      }
    }
    const tail = deltaFromSseLine(buffer);
    if (tail) {
      full += tail;
      emit(onDelta, tail);
    }
  } catch (e) {
    return `Scody AI 연결 오류: ${e instanceof Error ? e.message : String(e)}`;
  }
  if (full.trim()) return full.trim();
  emit(onDelta, AI_EMPTY);
  return AI_EMPTY;
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
