import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  ASSIGNMENTS_SEED,
  getAccount,
  getChildren,
  getClass,
  type Assignment,
  type Question,
} from '@/data';
import { useSession } from '@/session';

export interface PerQuestion {
  qId: string;
  prompt: string;
  choices: string[];
  answerIndex: number;
  pickedIndex?: number;
  correct: boolean;
}

/** 한 번의 풀이 결과. 걸린 시간·문항별 정오까지 저장 → 리포트의 원천. */
export interface Attempt {
  itemId: string;
  title: string;
  area: string;
  source: 'personal' | 'academy';
  timeSec: number;
  correct: number;
  total: number;
  accuracy: number;
  dateISO: string;
  perQuestion: PerQuestion[];
}

export interface WrongNote {
  id: string;
  itemId: string;
  /** 문항이 속한 콘텐츠. 오답노트에서 지문을 함께 보여주려면 필요하다. */
  contentId?: string;
  /** 개인 학습인지 학원 배정 학습인지. 학원은 배정 학습 오답만 볼 수 있다(정책). */
  source: 'personal' | 'academy';
  /** 영역(문학·독서·문법·화법과 작문). 카테고리별 복습에 쓴다. */
  area: string;
  title: string;
  qId: string;
  prompt: string;
  choices: string[];
  answerIndex: number;
  pickedIndex?: number;
  dig?: string; // AI와 정리한 내 오답노트 메모
  /** 집중 복습으로 따로 모아 보려고 별표한 문항. */
  starred?: boolean;
  /** 카드 복습에서 완전히 이해했다고 표시한 문항. */
  mastered?: boolean;
}

interface ProgressValue {
  /** 지금 로그인한 계정이 소유한 풀이 기록. */
  attempts: Record<string, Attempt>;
  recordAttempt: (a: Attempt) => void;
  retry: string[];
  /** 다른 학생의 기록. 열람 권한이 없으면 빈 값을 준다. */
  attemptsOf: (studentId: string) => Record<string, Attempt>;
  wrongNotesOf: (studentId: string) => WrongNote[];
  retryOf: (studentId: string) => string[];
  requestRetryFor: (studentId: string, itemId: string) => void;
  wrongNotes: WrongNote[];
  addWrongNote: (n: Omit<WrongNote, 'id'>) => void;
  removeWrongNote: (id: string) => void;
  setDig: (id: string, text: string) => void;
  /** 별표 켜고 끄기. 집중 복습 목록의 기준이다. */
  toggleStar: (id: string) => void;
  /** 카드 복습에서 이해 완료 표시. */
  setMastered: (id: string, value: boolean) => void;
  /** 학원이 볼 수 있는 오답노트: 배정 학습에서 나온 것만(개인 학습 상세는 제외). */
  academyNotesOf: (studentId: string) => WrongNote[];
  hasNote: (qId: string) => boolean;
  assignments: Assignment[];
  /** 학원 배정 학습을 제출했음을 기록한다(본인 제출만). */
  markAssignmentSubmitted: (assignmentId: string, accuracy: number, timeSec: number) => void;
  addAssignment: (input: {
    classId: string;
    subject: string;
    title: string;
    questionCount: number;
    contentId?: string;
    /** 마감일(YYYY-MM-DD). 학생 화면의 마감 표시에 쓰인다. */
    dueDate?: string;
  }) => void;
}

const ProgressContext = createContext<ProgressValue | null>(null);

const NO_ATTEMPTS: Record<string, Attempt> = {};
const NO_NOTES: WrongNote[] = [];
const NO_RETRY: string[] = [];

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { account } = useSession();
  const uid = account?.userId ?? '';
  // 학습 기록은 학생 계정별로 나눠 보관한다. 계정을 바꾸면 남의 기록이 보이지 않는다.
  const [attemptsByUser, setAttemptsByUser] = useState<Record<string, Record<string, Attempt>>>({});
  const [retryByUser, setRetryByUser] = useState<Record<string, string[]>>({});
  const [notesByUser, setNotesByUser] = useState<Record<string, WrongNote[]>>({});
  const [assignments, setAssignments] = useState<Assignment[]>([...ASSIGNMENTS_SEED]);

  const attempts = (uid ? attemptsByUser[uid] : undefined) ?? NO_ATTEMPTS;
  const retry = (uid ? retryByUser[uid] : undefined) ?? NO_RETRY;
  const wrongNotes = (uid ? notesByUser[uid] : undefined) ?? NO_NOTES;

  /**
   * 다른 학생의 기록을 볼 수 있는지. 본인과 연결된 자녀만 허용한다.
   * 학원은 개인 학습 상세를 열람할 수 없다(확정 정책). 학원은 배정 학습의 제출 결과만 본다.
   */
  const canRead = useCallback(
    (studentId: string) => {
      if (!account || !studentId) return false;
      if (studentId === account.userId) return true;
      if (!account.roles.includes('parent')) return false;
      return getChildren(account.userId).some((c) => c.userId === studentId);
    },
    [account],
  );

  const attemptsOf = useCallback(
    (studentId: string) => (canRead(studentId) ? attemptsByUser[studentId] ?? NO_ATTEMPTS : NO_ATTEMPTS),
    [canRead, attemptsByUser],
  );
  const wrongNotesOf = useCallback(
    (studentId: string) => (canRead(studentId) ? notesByUser[studentId] ?? NO_NOTES : NO_NOTES),
    [canRead, notesByUser],
  );
  const retryOf = useCallback(
    (studentId: string) => (canRead(studentId) ? retryByUser[studentId] ?? NO_RETRY : NO_RETRY),
    [canRead, retryByUser],
  );

  const recordAttempt = useCallback(
    (a: Attempt) => {
      if (!uid) return;
      setAttemptsByUser((prev) => ({ ...prev, [uid]: { ...prev[uid], [a.itemId]: a } }));
      setRetryByUser((prev) => ({ ...prev, [uid]: (prev[uid] ?? []).filter((id) => id !== a.itemId) }));
    },
    [uid],
  );

  const requestRetryFor = useCallback(
    (studentId: string, itemId: string) => {
      if (!canRead(studentId)) return;
      // 기존 기록은 지우지 않는다(학생 기록 지속성). 다시 풀면 그때 새 결과로 대체된다.
      setRetryByUser((prev) => {
        const list = prev[studentId] ?? [];
        return list.includes(itemId) ? prev : { ...prev, [studentId]: [...list, itemId] };
      });
    },
    [canRead],
  );

  const addWrongNote = useCallback(
    (n: Omit<WrongNote, 'id'>) => {
      if (!uid) return;
      setNotesByUser((prev) => {
        const mine = prev[uid] ?? [];
        if (mine.some((w) => w.qId === n.qId)) return prev;
        return { ...prev, [uid]: [...mine, { ...n, id: `wn_${n.qId}` }] };
      });
    },
    [uid],
  );
  const removeWrongNote = useCallback(
    (id: string) => {
      if (!uid) return;
      setNotesByUser((prev) => ({ ...prev, [uid]: (prev[uid] ?? []).filter((w) => w.id !== id) }));
    },
    [uid],
  );
  const setDig = useCallback(
    (id: string, text: string) => {
      if (!uid) return;
      setNotesByUser((prev) => ({
        ...prev,
        [uid]: (prev[uid] ?? []).map((w) => (w.id === id ? { ...w, dig: text } : w)),
      }));
    },
    [uid],
  );
  const toggleStar = useCallback(
    (id: string) => {
      if (!uid) return;
      setNotesByUser((prev) => ({
        ...prev,
        [uid]: (prev[uid] ?? []).map((w) => (w.id === id ? { ...w, starred: !w.starred } : w)),
      }));
    },
    [uid],
  );

  const setMastered = useCallback(
    (id: string, value: boolean) => {
      if (!uid) return;
      setNotesByUser((prev) => ({
        ...prev,
        [uid]: (prev[uid] ?? []).map((w) => (w.id === id ? { ...w, mastered: value } : w)),
      }));
    },
    [uid],
  );

  /**
   * 학원용 읽기. 같은 학원 소속 학생의 '배정 학습' 오답만 준다.
   * 개인 학습 오답은 확정 정책상 학원에 공개하지 않는다.
   */
  const academyNotesOf = useCallback(
    (studentId: string) => {
      if (!account || !account.roles.includes('academy') || !studentId) return NO_NOTES;
      const student = getAccount(studentId);
      if (!student || student.academyName !== account.academyName) return NO_NOTES;
      const notes = notesByUser[studentId] ?? NO_NOTES;
      return notes.filter((n) => n.source === 'academy');
    },
    [account, notesByUser],
  );

  const hasNote = useCallback((qId: string) => wrongNotes.some((w) => w.qId === qId), [wrongNotes]);

  const markAssignmentSubmitted = useCallback<ProgressValue['markAssignmentSubmitted']>(
    (assignmentId, accuracy, timeSec) => {
      if (!uid) return;
      setAssignments((prev) =>
        prev.map((a) => {
          if (a.id !== assignmentId) return a;
          const mine = { studentId: uid, submitted: true, accuracy, timeSec };
          const exists = a.submissions.some((s) => s.studentId === uid);
          return {
            ...a,
            submissions: exists
              ? a.submissions.map((s) => (s.studentId === uid ? mine : s))
              : [...a.submissions, mine],
          };
        }),
      );
    },
    [uid],
  );

  const addAssignment = useCallback<ProgressValue['addAssignment']>((input) => {
    setAssignments((prev) => {
      const cls = getClass(input.classId);
      const submissions = (cls?.studentIds ?? []).map((studentId) => ({ studentId, submitted: false }));
      return [
        ...prev,
        {
          id: `a_new_${prev.length}`,
          classId: input.classId,
          subject: input.subject,
          title: input.title,
          questionCount: input.questionCount,
          contentId: input.contentId,
          dueDate: input.dueDate,
          submissions,
        },
      ];
    });
  }, []);

  const value = useMemo<ProgressValue>(
    () => ({
      attempts,
      recordAttempt,
      retry,
      attemptsOf,
      wrongNotesOf,
      retryOf,
      requestRetryFor,
      wrongNotes,
      addWrongNote,
      removeWrongNote,
      setDig,
      toggleStar,
      setMastered,
      academyNotesOf,
      hasNote,
      assignments,
      markAssignmentSubmitted,
      addAssignment,
    }),
    [
      attempts,
      recordAttempt,
      retry,
      attemptsOf,
      wrongNotesOf,
      retryOf,
      requestRetryFor,
      wrongNotes,
      addWrongNote,
      removeWrongNote,
      setDig,
      toggleStar,
      setMastered,
      academyNotesOf,
      hasNote,
      assignments,
      markAssignmentSubmitted,
      addAssignment,
    ],
  );
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used within ProgressProvider');
  return ctx;
}

/** 문항 배열로 attempt 계산(정오·시간 포함). */
export function buildAttempt(
  meta: { itemId: string; title: string; area: string; source: 'personal' | 'academy' },
  questions: Question[],
  picked: Record<string, number>,
  timeSec: number,
  dateISO: string,
): Attempt {
  const perQuestion: PerQuestion[] = questions.map((q) => ({
    qId: q.id,
    prompt: q.prompt,
    choices: q.choices,
    answerIndex: q.answerIndex,
    pickedIndex: picked[q.id],
    correct: picked[q.id] === q.answerIndex,
  }));
  const correct = perQuestion.filter((p) => p.correct).length;
  const total = questions.length;
  return {
    ...meta,
    timeSec,
    correct,
    total,
    accuracy: total ? Math.round((correct / total) * 100) : 0,
    dateISO,
    perQuestion,
  };
}
