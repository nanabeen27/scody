import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  SEED_CONTENT,
  type ContentSet,
  type KoreanArea,
  type ContentKind,
  type Grade,
  type Question,
} from '@/data';

export interface NewQuestionInput {
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation?: string;
}

export interface NewContentInput {
  area: KoreanArea;
  title: string;
  kind: ContentKind;
  passage?: { title: string; body: string };
  questions: NewQuestionInput[];
  publishToStudents: boolean;
  /** 학원이 등록하면 그 학원 이름. 운영자 등록이면 비움. */
  ownerAcademyName?: string;
  /** 학년과 세부 유형. 학생이 학습을 고를 때 이 값으로 좁힌다. */
  grade?: Grade;
  topic?: string;
}

interface ContentValue {
  sets: ContentSet[];
  addContent: (input: NewContentInput) => ContentSet;
}

const ContentContext = createContext<ContentValue | null>(null);

/**
 * 국어 학습 콘텐츠 저장소(프로토타입: 메모리).
 * 총괄관리자가 등록한 문제가 여기에 쌓이고 학생에게 공개된다.
 * 실제 콘텐츠 백엔드로 교체할 지점.
 */
export function ContentProvider({ children }: { children: ReactNode }) {
  const [sets, setSets] = useState<ContentSet[]>(() => SEED_CONTENT.map((s) => ({ ...s })));

  const addContent = useCallback((input: NewContentInput): ContentSet => {
    let created: ContentSet;
    setSets((prev) => {
      const id = `ct_new_${prev.length}`;
      const questions: Question[] = input.questions.map((q, i) => ({
        id: `${id}_q${i + 1}`,
        prompt: q.prompt,
        choices: q.choices,
        answerIndex: q.answerIndex,
        explanation: q.explanation,
      }));
      created = {
        id,
        subject: '국어',
        area: input.area,
        title: input.title,
        kind: input.kind,
        passage: input.kind === 'passage' ? input.passage : undefined,
        questions,
        publishToStudents: input.publishToStudents,
        ownerAcademyName: input.ownerAcademyName,
        grade: input.grade,
        topic: input.topic,
      };
      return [...prev, created];
    });
    // setSets 콜백에서 생성됨(동기적으로 실행)
    return created!;
  }, []);

  const value = useMemo(() => ({ sets, addContent }), [sets, addContent]);
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent(): ContentValue {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error('useContent must be used within ContentProvider');
  return ctx;
}
