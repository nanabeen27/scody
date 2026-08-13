import { ANCHOR_INDEX, TOTAL_DAYS, WINDOW_WEEKS, dateOfIndex, seasonWeight } from './calendar';
import { frac, hash, pick } from './hash';

/**
 * 합성 활동 기록.
 *
 * **왜 필요한가**: MAU·Activation·리텐션·Carrying Capacity·Quick Ratio는 전부 "누가 언제
 * 활동했는지"에서 나온다. 그런데 이 레포에는 시간 축이 없다 — `Account`에 가입일이 없고
 * 실제 풀이 기록(`Attempt`)은 **로그인한 계정 메모리에만** 있다. 그래서 서비스 전체 지표를
 * 계산할 재료가 아예 없었다.
 *
 * **하드코딩한 지표 숫자를 화면에 박지 않는다.** 대신 결정적으로 생성한 활동 기록을 두고
 * 그 위에서 지표를 **실제로 계산**한다. 수식은 진짜이고 입력이 합성이다 — 화면은 지표마다
 * `합성` 배지로 그 사실을 밝힌다(마스터 플랜 5절).
 *
 * **활성의 정의**(D-1): 그 날 **문항 1개 이상 답을 저장한** 학생. 로그인은 활성이 아니다.
 * 학습을 완료한 날은 그중 일부이고 따로 센다(북극성 지표).
 *
 * 실제 사용자 데이터가 아니다. 운영 데이터 연결 시 이 모듈을 서버 이벤트 집계로 교체한다.
 */

/** 한 사람의 활동 성향. 전부 `userId` 하나의 해시에서 나온다. */
export interface ActivityProfile {
  userId: string;
  /** 가입한 주차(0 = 창 시작). 코호트 행이 되고 `createdAt`의 근거다. */
  joinWeek: number;
  /** 평상시 주당 학습일 수(1~5). L7 분포를 만든다. */
  freqBase: number;
  /** 0~99. 높으면 오래 남는다. 리텐션 플래토를 만든다. */
  loyalty: number;
  /** 이탈한 주차. 없으면 계속 남아 있다. */
  churnWeek?: number;
  /** 부활한 주차. 시험 주에 돌아온다. 없으면 부활하지 않았다. */
  resurrectWeek?: number;
  /** 활동한 날의 인덱스(오름차순). */
  days: number[];
  /** 그중 학습을 **완료**한 날(제출까지 간 날). `days`의 부분집합이다. */
  doneDays: number[];
}

/** 이탈로 보는 무활동 기간(일). 창을 밝히지 않으면 이탈률은 뜻이 없다. */
export const CHURN_WINDOW_DAYS = 28;
/** MAU를 세는 창(일). 캘린더 월이 아니라 28일 rolling으로 고정한다. */
export const MAU_WINDOW_DAYS = 28;

/**
 * 가입 주차. **최근 주에 가중**한다 — 균등하게 두면 신규 유입 곡선이 평평해져
 * "성장하는 제품"의 모양이 나오지 않는다.
 */
function joinWeekOf(userId: string): number {
  // 제곱근을 쓰면 뒤쪽(최근) 주에 몰린다.
  const r = frac(`join:${userId}`);
  return Math.min(WINDOW_WEEKS - 1, Math.floor((1 - Math.sqrt(1 - r)) * WINDOW_WEEKS));
}

/**
 * 한 사람의 활동을 만든다.
 *
 * 규칙
 * - 가입 주 이전에는 활동하지 않는다(코호트 Day 0이 어긋나면 리텐션이 전부 틀어진다).
 * - 주당 활동일 수 = `freqBase × 계절 가중치`. 방학에 줄고 시험 앞에 늘어난다.
 * - `loyalty`가 낮으면 몇 주 뒤 이탈하고, 그중 일부는 **시험 주에 부활**한다 —
 *   학습 앱의 실제 패턴이고, Resurrected를 New와 섞지 않으려면 이 사람들이 있어야 한다.
 * - 완료(제출)는 활동일 중 일부다. 답만 저장하고 나온 날이 실제로 있기 때문이다(D-035).
 */
function buildProfile(userId: string): ActivityProfile {
  const joinWeek = joinWeekOf(userId);
  const freqBase = pick(`freq:${userId}`, 1, 5);
  const loyalty = pick(`loy:${userId}`, 0, 99);

  /*
    낮은 `loyalty`는 **가입 직후 몇 주 안에** 이탈한다. 예전에는 2~12주로 두어 28일 창 안에
    이탈이 거의 없었고, 그래서 "가입 7일 안에 완료한 사람"과 "안 한 사람"의 28일 잔존이
    92% 대 84%로 붙어 Activation 마일스톤의 예측력이 1.10배로 나왔다(실측). 실제 제품에서는
    초반에 가치를 못 본 사람이 곧 떠난다 — 그 관계가 없으면 이 검증 자체가 뜻을 잃는다.
  */
  const churnWeek =
    loyalty < 40 ? Math.min(WINDOW_WEEKS, joinWeek + pick(`churn:${userId}`, 1, 5)) : undefined;
  // 부활은 이탈한 사람 중 일부만. 시험이 있는 주(계절 가중치가 높은 주)에 돌아온다.
  const resurrectWeek =
    churnWeek != null && loyalty >= 25 && churnWeek + 3 < WINDOW_WEEKS
      ? (() => {
          for (let w = churnWeek + 3; w < WINDOW_WEEKS; w += 1) {
            if (seasonWeight[w] >= 1.3) return w;
          }
          return undefined;
        })()
      : undefined;

  const days: number[] = [];
  const doneDays: number[] = [];
  for (let w = joinWeek; w < WINDOW_WEEKS; w += 1) {
    // 이탈한 구간은 건너뛴다. 부활 주부터 다시 활동한다.
    if (churnWeek != null && w >= churnWeek && (resurrectWeek == null || w < resurrectWeek)) {
      continue;
    }
    const target = Math.round(freqBase * seasonWeight[w]);
    const count = Math.max(0, Math.min(7, target));
    if (count === 0) continue;
    /*
      어느 요일에 하는지를 해시로 정한다.

      **비트 필터로 건너뛰는 방식을 쓰지 않는다.** 예전에는 `bits`의 해당 비트가 0이면
      그 요일을 건너뛰었는데, 비트가 대부분 0이면 목표 일수를 채우지 못하고 **0일이 되기도
      했다** — 학생 31명이 가입 주에 활동 0건이었고 일부는 전 기간 0건이었다(실측).
      그러면 코호트 W0이 100%가 되지 않아 리텐션 표의 기준선이 무너진다.

      대신 시작 요일을 해시로 정하고 7과 서로소인 2씩 돌며 정확히 `count`일을 고른다.
      같은 사람은 늘 비슷한 요일에 하고, 주마다 시작 요일이 달라 완전히 같아지지도 않는다.
    */
    const start = hash(`day:${userId}:${w}`) % 7;
    const chosen = new Set<number>();
    for (let k = 0; k < count; k += 1) chosen.add((start + k * 2) % 7);
    for (const dow of [...chosen].sort((a, b) => a - b)) {
      const index = w * 7 + dow;
      if (index > ANCHOR_INDEX || index >= TOTAL_DAYS) break;
      days.push(index);
      /*
        학습을 끝내는 비율을 `loyalty`와 상관시킨다.
        상관이 없으면 "가입 7일 안에 완료한 사람"과 "안 한 사람"의 잔존이 똑같이 나와
        Activation 마일스톤의 예측력이 1.00배가 된다(실측). 그러면 화면이 "이 마일스톤은
        리텐션을 예측하지 못한다"고 말하는데, 그건 합성 데이터의 산물이지 사실이 아니다.
        실제 제품에서는 초반에 가치를 본 사람이 더 오래 남는다.
      */
      if (pick(`done:${userId}:${index}`, 0, 99) < 15 + loyalty * 0.85) doneDays.push(index);
    }
  }
  return { userId, joinWeek, freqBase, loyalty, churnWeek, resurrectWeek, days, doneDays };
}

/**
 * 활동 기록 캐시. 계정이 3천 개대라 **최초 접근 시 한 번만** 만든다.
 * 모듈 싱글턴이라 화면을 옮겨도 다시 계산하지 않는다.
 */
const cache = new Map<string, ActivityProfile>();

export function activityOf(userId: string): ActivityProfile {
  const hit = cache.get(userId);
  if (hit) return hit;
  const made = buildProfile(userId);
  cache.set(userId, made);
  return made;
}

/** 가입일(`YYYY-MM-DD`). `Account.createdAt`이 비어 있을 때 쓰는 파생값이다. */
export function joinDateOf(userId: string): string {
  return dateOfIndex(activityOf(userId).joinWeek * 7);
}

/** 마지막 활동일. 활동이 없으면 `undefined`. */
export function lastActiveOf(userId: string): string | undefined {
  const days = activityOf(userId).days;
  return days.length ? dateOfIndex(days[days.length - 1]) : undefined;
}
