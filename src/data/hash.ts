/**
 * 결정적 생성기.
 *
 * 개발용 합성 데이터(콘텐츠 사용 집계·활동 기록·학원 계약)는 **새로고침·재실행에도 같은 값**이
 * 나와야 한다. 그러지 않으면 화면을 두 번 열 때 지표가 달라져 무엇을 믿어야 할지 알 수 없고,
 * E2E도 고정할 수 없다. 그래서 `Math.random`과 현재 시각을 쓰지 않고 문자열 씨앗에서 만든다.
 *
 * `src/data/usage.ts`가 먼저 이 방식을 썼고(D-018), 활동 데이터가 같은 규칙을 쓰도록 뽑아 뒀다.
 */

/** FNV-1a. 문자열 → 32bit 정수. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** seed로 `[min, max]` 범위의 정수를 만든다(양 끝 포함). */
export function pick(seed: string, min: number, max: number): number {
  const span = max - min + 1;
  return min + (hash(seed) % span);
}

/**
 * seed로 `[0, 1)` 실수를 만든다. 가중 추출에 쓴다.
 * `pick`으로는 "최근에 가입한 사람이 더 많다" 같은 분포를 만들 수 없다.
 */
export function frac(seed: string): number {
  return hash(seed) / 4_294_967_296;
}

/**
 * 씨앗 하나를 `base` 진수 `count`자리로 펼친다.
 *
 * **`pick`을 자리마다 부르면 안 된다.** FNV-1a는 씨앗의 마지막 글자만 바뀔 때 결과가 작은
 * 폭으로만 움직여서, `code:x:0`~`code:x:5`로 뽑은 여섯 값이 `9,10,7,8,5,6`처럼 붙어 나온다.
 * 그러면 여섯 자리가 사실상 한 값이 되어 3,586개 계정에서 3,386건이 충돌했다(실측).
 * 해시 하나를 나눠 쓰면 자리마다 독립적인 값이 나온다.
 */
export function digits(seed: string, base: number, count: number): number[] {
  let h = hash(seed);
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(h % base);
    h = Math.floor(h / base);
  }
  return out;
}
