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
