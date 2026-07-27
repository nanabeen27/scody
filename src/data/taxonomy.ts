import type { Grade, KoreanArea } from './types';

/** 학습 고르기 1단계: 학년. */
export const GRADES: readonly Grade[] = [1, 2, 3];

/** 학습 고르기 2단계: 영역. */
export const AREAS: readonly KoreanArea[] = ['문학', '독서', '화법과 작문', '문법'];

/** 학습 고르기 3단계: 영역별 세부 유형. */
export const TOPICS: Record<KoreanArea, readonly string[]> = {
  문학: ['현대소설', '고전소설', '고전시가', '현대시', '고전수필', '현대수필', '기타문학'],
  독서: [
    '과학',
    '기술',
    '인문(일반)',
    '인문(철학)',
    '인문(논리학)',
    '사회(일반)',
    '사회(법학)',
    '사회(경제)',
  ],
  '화법과 작문': ['대화와 발표', '토론', '설득하는 글', '정보 전달 글', '자기 표현 글'],
  문법: [
    '음운의 변동',
    '단어와 품사',
    '문장 구조',
    '문법 요소(높임·시제·피동)',
    '담화',
    '국어사',
    '어문 규정 - 맞춤법',
    '어문 규정 - 띄어쓰기',
    '어문 규정 - 표준 발음',
  ],
};

export function topicsFor(area: KoreanArea): readonly string[] {
  return TOPICS[area] ?? [];
}

export function gradeLabel(grade: Grade): string {
  return `고${grade}`;
}
