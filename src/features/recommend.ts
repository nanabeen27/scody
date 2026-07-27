import { useContent } from './content';
import { useProgress } from './progress';
import { useStudentItems } from './learning';
import { findContent, type Grade, type LearningItem } from '@/data';

/**
 * 문항 추천. 틀린 문제와 같은 유형의 학습을 다음에 풀 것으로 제안한다.
 *
 * 설계 기준
 * - 추천 단위는 학습 세트다. 문항은 세트 안에 유형별로 묶여 있고 풀이 화면도 세트 기준이다.
 * - 후보는 학생이 지금 풀 수 있는 개인 학습 중 아직 안 푼 것만. 학원 학습은 배정으로만
 *   전달되는 정책이라 추천하지 않는다(개인 학습과 학원 학습의 출처를 섞지 않는다).
 * - 점수는 오답에서만 나온다. 같은 세부 유형이 가장 강한 신호고, 영역 일치는 약한 신호다.
 * - 추천 이유를 문장으로 함께 낸다. 근거 없는 점수·확률은 화면에 쓰지 않는다.
 */

/** 오답 하나가 만드는 약점 신호. */
export interface WeakSignal {
  area: string;
  /** 세부 유형(현대소설·음운의 변동 등). 오답이 나온 콘텐츠에서 가져온다. */
  topic?: string;
  grade?: Grade;
  /** 학생이 별표한 오답인지. 집중 복습 대상이라 무게를 두 배로 본다. */
  starred?: boolean;
}

/** 추천 후보(학생이 지금 풀 수 있는 학습). */
export interface Candidate {
  item: LearningItem;
  area: string;
  topic?: string;
  grade?: Grade;
}

export interface Recommendation {
  item: LearningItem;
  /** 화면에 그대로 쓰는 추천 이유. */
  reason: string;
  /** 근거가 된 오답 문항 수. */
  matched: number;
}

const TOPIC_HIT = 3;
const AREA_HIT = 1;
const GRADE_HIT = 1;

/**
 * 후보를 약점 신호로 점수화해 상위 `limit`개를 돌려준다.
 * 순수 함수라 화면 없이 검증할 수 있다.
 */
export function rankRecommendations(
  candidates: readonly Candidate[],
  signals: readonly WeakSignal[],
  limit = 3,
): Recommendation[] {
  if (signals.length === 0) return [];

  const scored = candidates.map((c) => {
    let score = 0;
    let topicMatches = 0;
    let areaMatches = 0;
    let gradeMatch = false;

    for (const s of signals) {
      const weight = s.starred ? 2 : 1;
      if (c.topic && s.topic && c.topic === s.topic) {
        score += TOPIC_HIT * weight;
        topicMatches += 1;
      } else if (c.area === s.area) {
        score += AREA_HIT * weight;
        areaMatches += 1;
      }
      if (!gradeMatch && c.grade != null && s.grade === c.grade) gradeMatch = true;
    }
    if (score > 0 && gradeMatch) score += GRADE_HIT;

    const matched = topicMatches > 0 ? topicMatches : areaMatches;
    const reason =
      topicMatches > 0 && c.topic
        ? `${c.area} · ${c.topic}에서 ${topicMatches}문항 틀렸어요`
        : `${c.area}에서 ${areaMatches}문항 틀렸어요`;
    return { item: c.item, reason, matched, score };
  });

  return scored
    .filter((s) => s.score > 0)
    // 점수가 같으면 오답 수가 많은 쪽, 그다음 제목 순으로 고정한다(순서가 매번 바뀌지 않게).
    .sort(
      (a, b) =>
        b.score - a.score || b.matched - a.matched || a.item.title.localeCompare(b.item.title),
    )
    .slice(0, limit)
    .map(({ item, reason, matched }) => ({ item, reason, matched }));
}

/**
 * 지금 로그인한 학생의 추천 학습.
 * 개인 이용권이 없으면 개인 학습 후보가 없으므로 빈 배열이다.
 */
export function useRecommendations(limit = 3): Recommendation[] {
  const { sets } = useContent();
  const { personal } = useStudentItems();
  const { wrongNotes } = useProgress();

  const signals: WeakSignal[] = wrongNotes.map((n) => {
    const from = n.contentId ? findContent(sets, n.contentId) : undefined;
    return { area: n.area, topic: from?.topic, grade: from?.grade, starred: n.starred };
  });

  const candidates: Candidate[] = personal
    .filter((i) => i.status !== 'done')
    .map((item) => {
      const set = findContent(sets, item.contentId);
      return { item, area: item.area, topic: set?.topic, grade: set?.grade };
    });

  return rankRecommendations(candidates, signals, limit);
}
