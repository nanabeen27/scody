/**
 * 매출 표시에 쓰는 도구.
 *
 * **계산은 서버가 한다.** 예전에는 이 파일이 `ACCOUNTS`·`ACADEMY_CLASSES` fixture를 직접 훑어
 * MRR을 만들었고, 개요와 요금제 화면이 같은 수식을 각자 들고 있었다. 지금은
 * `rpc_revenue_estimate()` 하나가 답하고(`src/repo/admin.ts`의 `revenueEstimate`), 두 화면은
 * 그 결과를 그대로 보여 준다 — 한쪽만 고쳐 서로 다른 MRR을 말하는 일이 생기지 않는다.
 *
 * 서버가 주는 값은 전부 **추정**이다. 실제 결제·정산 기록이 아니다(마스터 플랜 5절).
 * 화면에서는 `추정` 출처 배지와 함께 보여 준다.
 */

export type { RevenueEstimate } from '@/repo/admin';

/**
 * 구성비(%). 0이 되면 `1% 미만`으로 말한다 — `0%`는 "없다"로 읽히기 때문이다.
 * 개요·요금제·콘텐츠 상세가 각자 같은 함수를 두고 있어 여기로 모은다.
 */
export function share(part: number, whole: number): string {
  if (whole <= 0) return '—';
  const pct = Math.round((part / whole) * 100);
  return pct === 0 && part > 0 ? '1% 미만' : `${pct}%`;
}
