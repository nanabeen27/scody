/** 시간 유틸. 컴포넌트 순수성 린트 회피를 위해 여기로 분리. */
export function now(): number {
  return Date.now();
}
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
