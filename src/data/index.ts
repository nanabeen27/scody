/**
 * 화면과 도메인 모듈이 쓰는 **픽스처 없는** 경계.
 *
 * 여기 있는 것은 타입, 국어 분류 상수, 그리고 인자로 받은 데이터만 보는 순수 함수다.
 * 실제 데이터는 Supabase에 있고 `src/repo/*`가 조회한다 — 그 결과가 이 함수들의 인자로 온다.
 *
 * **시드 픽스처는 `./seed`에 있고 이 파일은 그것을 import하지 않는다.** Metro에는 tree
 * shaking이 없어서, barrel이 픽스처를 값으로 re-export하면 화면이 `findContent` 하나만
 * 가져와도 `ACCOUNTS`(4,186개)·로스터 3,000명 그래프가 모듈 평가 때 만들어져 운영 번들에
 * 그대로 실린다. 그 경계를 되돌리지 않으려면 이 파일에 픽스처 import를 다시 넣지 않는다.
 */
import type { ContentSet, LearningItem, Assignment } from './types';

export * from './types';
export { GRADES, AREAS, TOPICS, topicsFor, gradeLabel } from './taxonomy';

/** 번호 비교용 정규화. 하이픈·공백 차이로 조회가 실패하지 않게 숫자만 남긴다. */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** 콘텐츠 세트를 id로 찾는다. `sets`는 서버에서 읽은 목록이다(`useContent`). */
export function findContent(sets: readonly ContentSet[], id: string): ContentSet | undefined {
  return sets.find((s) => s.id === id);
}

/** 공개된 콘텐츠 세트를 학생 개인 학습 항목으로 변환. */
export function contentToPersonalItem(set: ContentSet): LearningItem {
  return {
    id: `li_${set.id}`,
    source: 'personal',
    subject: set.subject,
    area: set.area,
    title: set.title,
    contentId: set.id,
    questionCount: set.questions.length,
    status: 'todo',
  };
}

/** 학생에게 공개된 개인 학습 목록(공개 콘텐츠에서 파생). */
export function personalItems(sets: readonly ContentSet[]): LearningItem[] {
  return sets.filter((s) => s.publishToStudents).map(contentToPersonalItem);
}

export interface SubmissionStat {
  submitted: number;
  total: number;
  avgAccuracy: number | null;
}

export function submissionStat(a: Assignment): SubmissionStat {
  const total = a.submissions.length;
  const done = a.submissions.filter((s) => s.submitted);
  const avg = done.length
    ? Math.round(done.reduce((x, s) => x + (s.accuracy ?? 0), 0) / done.length)
    : null;
  return { submitted: done.length, total, avgAccuracy: avg };
}
