import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Account, LearningItem, Question, Role } from '@/data';

export interface Result {
  correct: number;
  total: number;
}

interface SessionValue {
  account: Account | null;
  signIn: (account: Account) => void;
  signOut: () => void;
  // 학습 진행: 답안 자동 저장 + 제출 결과 (프로토타입은 메모리 보관)
  answers: Record<string, Record<string, number>>;
  results: Record<string, Result>;
  saveAnswer: (itemId: string, questionId: string, choice: number) => void;
  submit: (itemId: string, questions: Question[]) => Result;
  getResult: (itemId: string) => Result | undefined;
  // 학원 연결 상태. 연결을 끊어도 학습 기록은 유지된다(정책).
  academyLinked: boolean;
  setAcademyLinked: (linked: boolean) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

/**
 * 인증·학습 진행 세션 경계. 프로토타입은 메모리에 보관한다.
 * 실제 인증/저장으로 교체할 지점(결정 기록 D-005).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [answers, setAnswers] = useState<Record<string, Record<string, number>>>({});
  const [results, setResults] = useState<Record<string, Result>>({});
  const [academyLinked, setAcademyLinked] = useState(true);

  const signIn = useCallback((acc: Account) => {
    setAccount(acc);
    setAcademyLinked(true);
  }, []);
  const signOut = useCallback(() => {
    setAccount(null);
    setAnswers({});
    setResults({});
    setAcademyLinked(true);
  }, []);

  const saveAnswer = useCallback((itemId: string, questionId: string, choice: number) => {
    setAnswers((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [questionId]: choice } }));
  }, []);

  const submit = useCallback(
    (itemId: string, questions: Question[]): Result => {
      const picked = answers[itemId] ?? {};
      const correct = questions.filter((q) => picked[q.id] === q.answerIndex).length;
      const result: Result = { correct, total: questions.length };
      setResults((prev) => ({ ...prev, [itemId]: result }));
      return result;
    },
    [answers],
  );

  const getResult = useCallback((itemId: string) => results[itemId], [results]);

  const value = useMemo<SessionValue>(
    () => ({
      account,
      signIn,
      signOut,
      answers,
      results,
      saveAnswer,
      submit,
      getResult,
      academyLinked,
      setAcademyLinked,
    }),
    [account, answers, results, signIn, signOut, saveAnswer, submit, getResult, academyLinked],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}

export function useCurrentAccount(): Account {
  const { account } = useSession();
  if (!account) throw new Error('No signed-in account');
  return account;
}

export function accountHasRole(account: Account, role: Role): boolean {
  return account.roles.includes(role);
}

/** 정적 학습 항목에 세션의 제출 결과를 반영한 실효 상태. */
export function mergeResult(item: LearningItem, results: Record<string, Result>): LearningItem {
  const r = results[item.id];
  if (!r) return item;
  return { ...item, status: 'done', accuracy: Math.round((r.correct / r.total) * 100) };
}
