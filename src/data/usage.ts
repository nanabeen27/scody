import type { ContentSet } from './types';

/**
 * 콘텐츠별 서비스 전체 사용 집계.
 *
 * 실제 풀이 기록(`src/features/progress`의 `Attempt`)은 로그인한 계정 메모리에만 있어서
 * 총괄관리자 화면에서 서비스 전체를 볼 수 없다. 그래서 콘텐츠·문항 id로부터
 * **결정적으로 생성한 테스트 집계**를 쓴다. 같은 id면 항상 같은 값이 나온다.
 *
 * 규칙
 * - 실제 사용자 데이터가 아니다. 이 값을 쓰는 화면은 테스트 집계임을 반드시 표기한다.
 * - 세션에서 실제로 푼 기록·배정 제출은 화면에서 이 값에 더해 보여준다(`live` 인자).
 * - 운영 데이터 연결 시 이 모듈을 서버 집계 쿼리로 교체한다.
 */

/** FNV-1a. 문자열 → 32bit 정수. 결정적이어야 하므로 Math.random을 쓰지 않는다. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** seed로 [min, max] 범위의 정수를 만든다(양 끝 포함). */
function pick(seed: string, min: number, max: number): number {
  const span = max - min + 1;
  return min + (hash(seed) % span);
}

export interface ContentUsage {
  contentId: string;
  /** 학원이 배정해서 학생이 푼 횟수. */
  academySolves: number;
  /** 학생이 개인 학습에서 직접 골라 푼 횟수. */
  personalSolves: number;
  /** 전체 평균 정답률(%). */
  avgAccuracy: number;
  /** 문항 id별 오답률(%). 어려운 문항을 찾는 데 쓴다. */
  wrongRateByQ: Record<string, number>;
}

/** 세션에서 실제로 발생한 수치. 화면이 모아서 넘긴다. */
export interface LiveUsage {
  academySolves?: number;
  personalSolves?: number;
}

/**
 * 콘텐츠 한 세트의 사용 집계(테스트 집계 + 세션 실측).
 * 문항 오답률은 문항 id 기준이라 문항이 늘어도 기존 값이 흔들리지 않는다.
 */
export function contentUsage(set: ContentSet, live?: LiveUsage): ContentUsage {
  const wrongRateByQ: Record<string, number> = {};
  for (const q of set.questions) {
    wrongRateByQ[q.id] = pick(`wrong:${q.id}`, 6, 74);
  }
  const rates = Object.values(wrongRateByQ);
  const avgWrong = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  return {
    contentId: set.id,
    academySolves: pick(`acad:${set.id}`, 0, 180) + (live?.academySolves ?? 0),
    personalSolves: pick(`pers:${set.id}`, 0, 240) + (live?.personalSolves ?? 0),
    avgAccuracy: Math.round(100 - avgWrong),
    wrongRateByQ,
  };
}

/** 총 풀이 횟수(배정 + 개인). */
export function totalSolves(u: ContentUsage): number {
  return u.academySolves + u.personalSolves;
}

/** 오답률이 높은 문항부터. 상위 n개만 본다. */
export function hardestQuestions(
  set: ContentSet,
  u: ContentUsage,
  n = 5,
): { id: string; prompt: string; wrongRate: number }[] {
  return set.questions
    .map((q) => ({ id: q.id, prompt: q.prompt, wrongRate: u.wrongRateByQ[q.id] ?? 0 }))
    .sort((a, b) => b.wrongRate - a.wrongRate)
    .slice(0, n);
}
