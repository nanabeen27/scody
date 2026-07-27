import { useContent } from './content';
import { useProgress } from './progress';
import { useCurrentAccount, useSession } from '@/session';
import {
  personalItems,
  findContent,
  getStudentClasses,
  type LearningItem,
  type ContentSet,
} from '@/data';

export interface StudentItems {
  personal: LearningItem[];
  academy: LearningItem[];
  all: LearningItem[];
  hasPersonal: boolean;
}

/**
 * 학생 학습 목록.
 * - 개인: 공개 콘텐츠에서 파생
 * - 학원: 내가 속한 반에 배정된 학습(선생님 배정 → 학생 전달)
 * 각 항목은 내 풀이 기록(attempt)으로 완료/정답률이 반영된다.
 */
export function useStudentItems(): StudentItems {
  const { sets } = useContent();
  const account = useCurrentAccount();
  const { attempts, assignments } = useProgress();
  const { academyLinked } = useSession();

  const merge = (item: LearningItem): LearningItem => {
    const a = attempts[item.id];
    if (!a) return item;
    return { ...item, status: 'done', accuracy: a.accuracy };
  };

  const hasPersonal = account.entitlements.some((e) => e.kind === 'personal');
  const personal = (hasPersonal ? personalItems(sets) : []).map(merge);

  const myClassIds = new Set(getStudentClasses(account.userId).map((c) => c.id));
  const academy = assignments
    .filter((a) => myClassIds.has(a.classId) && a.contentId)
    .map((a) => {
      const content = findContent(sets, a.contentId!) as ContentSet | undefined;
      const item: LearningItem = {
        id: a.id,
        source: 'academy',
        subject: '국어',
        area: content?.area ?? '문학',
        title: a.title,
        contentId: a.contentId!,
        questionCount: content?.questions.length ?? a.questionCount,
        status: 'todo',
        dueDate: a.dueDate,
      };
      return merge(item);
    });

  // 학원 연결을 끊으면 새 학원 학습은 감추되 완료 기록은 유지.
  const academyVisible = academyLinked ? academy : academy.filter((i) => i.status === 'done');
  return {
    personal,
    academy: academyVisible,
    all: [...academyVisible, ...personal],
    hasPersonal,
  };
}
