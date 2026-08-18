/** 시간 유틸. 컴포넌트 순수성 린트 회피를 위해 여기로 분리. */
export function now(): number {
  return Date.now();
}
/**
 * 오늘 날짜(YYYY-MM-DD). **로컬 시간대 기준**이다.
 * `toISOString()`은 UTC라 KST 오전 9시 이전 풀이가 전날로 기록되고 마감 판정이 하루 어긋난다.
 */
export function todayISO(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * `YYYY-MM-DD`를 로컬 자정으로. 잘못된 문자열이면 `null`이다.
 *
 * **`?? 1` 같은 기본값 가드는 효과가 없다** — 숫자가 아닌 조각은 `undefined`가 아니라 `NaN`이
 * 되고 `NaN ?? 1`은 `NaN`이다. 가드가 있는 것처럼 보이는 것이 없는 것보다 나쁘다.
 * `src/features/learning.ts`의 `dueLabel`이 같은 방식으로 막는다.
 */
function atLocalMidnight(iso: string): Date | null {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/**
 * `YYYY-MM-DD`에서 며칠 뒤/전. 잘못된 문자열이면 그대로 돌려준다.
 *
 * `Date`의 `setDate`는 달을 넘겨도 알아서 넘어간다. `todayISO()`와 같은 로컬 시간대 기준이다 —
 * UTC로 계산하면 KST 오전 9시 이전에 하루가 어긋난다.
 *
 * **같은 계산이 `src/features/adminMetrics.ts`에도 있다**(`shift`·`daysBetween`) — 그쪽은 운영자
 * 지표 전용이고 이 파일이 그 계산의 집이다. 여섯 번째 사본을 만들기 전에 둘 중 하나로 모은다.
 */
export function addDaysISO(iso: string, days: number): string {
  const at = atLocalMidnight(iso);
  if (!at) return iso;
  at.setDate(at.getDate() + days);
  const mm = `${at.getMonth() + 1}`.padStart(2, '0');
  const dd = `${at.getDate()}`.padStart(2, '0');
  return `${at.getFullYear()}-${mm}-${dd}`;
}

/** `a`에서 `b`까지 며칠. 음수면 `b`가 과거다. 잘못된 문자열이면 0이다. */
export function daysBetweenISO(a: string, b: string): number {
  const from = atLocalMidnight(a);
  const to = atLocalMidnight(b);
  if (!from || !to) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}
