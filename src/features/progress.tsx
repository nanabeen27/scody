import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Assignment, LearningItem, Question } from '@/data';
import type { Account } from '@/data/types';
import { errorMessage } from '@/lib/supabase';
import * as repo from '@/repo/learning';
import * as parentRepo from '@/repo/parent';
import { useSession } from '@/session';
import { useAcademyStaff } from './academy';

/**
 * 학습 기록 경계: 풀이 · 오답노트 · 담아 둔 학습 · 배정 · 학부모 기능.
 *
 * ## 프로토타입에서 무엇이 바뀌었나
 *
 * 이 파일은 883줄짜리 메모리 저장소였다. 지금은 **서버에서 읽고 서버에 쓴다.**
 *
 * - 열람 권한(`canRead`)을 클라이언트에서 판단하던 자리는 RLS가 대신한다. 남의 기록은 애초에
 *   응답에 오지 않는다 — 함수가 걸러 주는 것이 아니다.
 * - 채점은 서버가 한다(`rpc_submit_attempt`). `recordAttempt`·`markAssignmentSubmitted`가
 *   하던 두 걸음이 한 트랜잭션이 됐다.
 * - `academyNotesOf`의 투영은 뷰가 한다(`v_academy_visible_notes`) — 별표·이해 완료·고른 답은
 *   컬럼째로 응답에 없다.
 *
 * ## 여전히 여기 있는 것
 *
 * **대리 보기 쓰기 차단**(D-071). 서버는 운영자를 운영자로 보므로 RLS만으로는 막히지 않는다.
 * 쓰기 함수마다 `readOnly`를 본다 — 새 쓰기를 더할 때도 같은 검사를 함께 넣는다.
 */

export type PerQuestion = repo.PerQuestion;
export type Attempt = repo.Attempt;
export type WrongNote = repo.WrongNote;
export type AcademyNote = repo.AcademyNote;
export type QueueEntry = repo.QueueEntry;
export type WriteResult = repo.WriteResult;
export type PraiseKind = parentRepo.PraiseKind;
export type Praise = parentRepo.Praise;

export const PRAISE_LABEL: Record<PraiseKind, string> = {
  steady: '꾸준히 했어요',
  submitted: '과제를 다 냈어요',
  reviewed: '오답을 다시 봤어요',
  thanks: '고마워요',
};

export type QueueMove = 'up' | 'down';

/** 담아 둔 목록에서 뺀 한 칸과 그 자리. 되돌리기에 쓴다. */
export interface QueueRemoval {
  entry: QueueEntry;
  index: number;
}

/**
 * 담은 순서에서 한 칸 옮긴다. 옮길 수 없으면 원래 배열을 그대로 돌려준다.
 *
 * `visible`을 주면 **그 목록에 있는 칸끼리만** 자리를 바꾼다. 화면은 공개가 끝난 학습을 걸러서
 * 그리므로 담긴 순서와 보이는 순서가 어긋난다 — 그때 바로 옆 칸과 바꾸면 보이지 않는 칸과
 * 자리를 맞바꿔서 **화면에서는 아무 일도 일어나지 않는다.**
 */
export function moveQueueEntry(
  list: readonly QueueEntry[],
  itemId: string,
  dir: QueueMove,
  visible?: readonly string[],
): QueueEntry[] {
  const at = list.findIndex((q) => q.itemId === itemId);
  if (at < 0) return list as QueueEntry[];
  const step = dir === 'up' ? -1 : 1;
  const shown = (id: string) => !visible || visible.includes(id);
  let to = at + step;
  while (to >= 0 && to < list.length && !shown(list[to].itemId)) to += step;
  if (to < 0 || to >= list.length) return list as QueueEntry[];
  const next = [...list];
  [next[at], next[to]] = [next[to], next[at]];
  return next;
}

/**
 * 뺀 칸들을 원래 자리로 다시 끼워 넣는다.
 * 자리가 작은 것부터 넣어야 뒤 칸의 자리가 앞 칸 삽입에 밀리지 않는다.
 */
export function restoreQueueEntries(
  list: readonly QueueEntry[],
  removals: readonly QueueRemoval[],
): QueueEntry[] {
  const next = [...list];
  for (const r of [...removals].sort((a, b) => a.index - b.index)) {
    if (next.some((q) => q.itemId === r.entry.itemId)) continue;
    next.splice(Math.max(0, Math.min(r.index, next.length)), 0, r.entry);
  }
  return next;
}

/** 문항 배열로 attempt 계산(정오·시간 포함). 결과 화면이 서버 응답을 기다리지 않고 그릴 때 쓴다. */
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

interface ProgressValue {
  /** 첫 조회가 끝나기 전에는 참이다. */
  loading: boolean;
  /**
   * **이 계정의 첫 조회가 끝났는지**(성공이든 실패든). 다시 읽는 동안에도 참으로 남는다.
   *
   * `loading`은 재조회마다 다시 참이 되므로, 화면이 그것으로 하위 컴포넌트의 **마운트**를
   * 결정하면 쓰기 실패가 부른 `reload()` 한 번에 그 화면의 상태가 초기화된다(D-160이 겪은 일).
   * 그때 필요한 것은 `첫 조회가 끝났는가`이고, 그 사실은 provider가 이미 계산해 두고 있다 —
   * 데이터가 비었는지로 추측하지 않게 값으로 내보낸다.
   */
  loaded: boolean;
  /**
   * 마지막 조회가 실패한 이유. 성공하면 `null`이다.
   *
   * **화면이 실패와 빈 계정을 가르는 데 쓴다**(M-DB-16). 예전에는 실패를 `console.warn`으로만
   * 남기고 `loading`을 내렸다 — 그래서 조회가 500으로 끊긴 학생에게 `아직 시작한 학습이 없어요`가
   * 영구 상태로 남았고, 화면에는 오류도 재시도도 없었다.
   *
   * 값은 사람에게 그대로 보여 줄 문장이다(`errorMessage`). 실패한 조회는 아무것도 얹지 않으므로
   * 이미 읽어 둔 기록은 그대로 남는다. 다시 시도는 `reload()`다.
   */
  error: string | null;
  /** 지금 보고 있는 계정이 소유한 풀이 기록. */
  attempts: Record<string, Attempt>;
  /** 다른 학생의 기록. 권한이 없으면 응답에 오지 않으므로 빈 값이다. */
  attemptsOf: (studentId: string) => Record<string, Attempt>;
  wrongNotesOf: (studentId: string) => WrongNote[];
  retryOf: (studentId: string) => string[];
  retry: string[];
  /**
   * 재풀이를 요청한다. `itemId`는 화면이 들고 있는 값 그대로다 —
   * 개인 학습은 `li_${'${contentId}'}`, 학원 학습은 배정 id. 여기서 대상 조합으로 되짚는다.
   */
  requestRetryFor: (studentId: string, itemId: string) => Promise<WriteResult>;
  wrongNotes: WrongNote[];
  /**
   * 오답을 담는다. **개인 학습과 학원 과제는 다른 행이다**(A-085) — 개인 쪽에서 지워도 학원
   * 배정 오답과 메모가 남는다.
   */
  addWrongNote: (input: {
    questionId: string;
    contentId: string;
    source: 'personal' | 'academy';
    assignmentId?: string;
    pickedIndex?: number;
  }) => Promise<WriteResult>;
  removeWrongNote: (id: string) => Promise<WriteResult>;
  /** 지운 오답을 되돌린다(D-033). 메모·별표도 함께 살아난다. */
  restoreWrongNote: (note: WrongNote, index: number) => Promise<WriteResult>;
  setDig: (id: string, text: string) => Promise<WriteResult>;
  toggleStar: (id: string) => Promise<WriteResult>;
  setMastered: (id: string, value: boolean) => Promise<WriteResult>;
  /** 그 문항을 이 학습에서 이미 담았는지. 학습이 다르면 따로 센다. */
  hasNote: (questionId: string, itemId: string) => boolean;
  /** 학원이 볼 수 있는 오답노트: 담당 반 학생의 배정 학습 오답만. */
  academyNotesOf: (studentId: string) => AcademyNote[];
  /** 그 학생의 학원 과제별 반 비교(평균·순위). 서버 집계다. */
  comparisonsOf: (studentId: string) => Record<string, repo.ClassComparison>;
  queue: QueueEntry[];
  addToQueue: (item: Pick<LearningItem, 'id' | 'contentId' | 'source'>) => Promise<WriteResult>;
  removeFromQueue: (itemId: string) => Promise<WriteResult>;
  removeManyFromQueue: (itemIds: string[]) => Promise<WriteResult>;
  moveInQueue: (
    itemId: string,
    dir: QueueMove,
    visible?: readonly string[],
  ) => Promise<WriteResult>;
  restoreToQueue: (removals: readonly QueueRemoval[]) => Promise<WriteResult>;
  isQueued: (itemId: string) => boolean;
  assignments: Assignment[];
  /** 풀이를 제출한다. **채점은 서버가 한다.** */
  submitAttempt: (input: {
    source: 'personal' | 'academy';
    contentId: string;
    assignmentId?: string;
    timeSec: number;
    picked: Record<string, number>;
  }) => Promise<WriteResult>;
  addAssignment: (input: {
    classId: string;
    title: string;
    contentId: string;
    dueDate?: string;
  }) => Promise<WriteResult & { id?: string }>;
  removeAssignment: (assignmentId: string) => Promise<WriteResult>;
  reassign: (assignmentId: string, dueDate: string) => Promise<WriteResult>;
  weekSummaryOf: (childId: string, monday: string) => parentRepo.WeekSummary | undefined;
  setWeekSummary: (
    childId: string,
    monday: string,
    text: string,
    byAI: boolean,
  ) => Promise<WriteResult>;
  praiseFor: (childId: string) => Praise[];
  sendPraise: (childId: string, kind: PraiseKind) => Promise<WriteResult>;
  dismissPraise: (id: string) => Promise<WriteResult>;
  /** 서버에서 다시 읽는다. */
  reload: () => Promise<void>;
}

const ProgressContext = createContext<ProgressValue | null>(null);

/**
 * 대리 보기에서 가리는 필드를 지운다(D-071).
 *
 * **한곳에 둔다.** 예전에는 같은 식이 `wrongNotes`·`wrongNotesOf`·`academyNotesOf` 세 곳에
 * 복제돼 있었고, 그중 하나(`academyNotesOf`)에 빠진 것이 D-159가 고친 결함이었다. 가리는 필드가
 * 하나 늘거나 조건이 넓어질 때 세 자리를 다 찾지 않아도 되게 한다.
 */
function maskDig<T extends { dig?: string }>(notes: T[], hide: boolean): T[] {
  return hide ? notes.map((n) => ({ ...n, dig: undefined })) : notes;
}

const NO_ATTEMPTS: Record<string, Attempt> = {};
const NO_NOTES: WrongNote[] = [];
const NO_ACADEMY_NOTES: AcademyNote[] = [];
const NO_RETRY: string[] = [];
const NO_PRAISE: Praise[] = [];
const NO_COMPARISONS: Record<string, repo.ClassComparison> = {};

/** 대리 보기 중 쓰기를 막을 때 돌려주는 결과(D-071). 모듈 상수라 렌더마다 새로 만들지 않는다. */
const DENIED: WriteResult = { ok: false, error: '대리 보기 중에는 바꿀 수 없어요.' };

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { account, readOnly } = useSession();
  // 학원 오답노트 열람은 지금 살아 있는 반 목록을 본다.
  useAcademyStaff();

  const uid = account?.userId ?? '';
  const [reading, setReading] = useState(true);
  /** 마지막 조회가 실패한 이유. 다음 조회가 성공하면 `null`로 돌아간다. */
  const [error, setError] = useState<string | null>(null);
  /**
   * 지금 화면에 얹힌 기록이 **누구의 것인지**. 조회가 끝날 때만 채운다.
   *
   * 상태 하나로 두면 로그인한 사람이 바뀐 **첫 렌더**가 `false`로 남는다 — 효과는 렌더가
   * 끝난 뒤에 돌고, 그 안에서도 마이크로태스크를 한 번 넘긴 뒤에야 값을 올린다(린트가 효과
   * 본문의 setState를 막는다). 그 한 프레임에 화면은 빈 데이터를 사실로 그린다
   * (실측: 학생 홈 새로고침에서 `아직 시작한 학습이 없어요`가 629ms → 9ms로 줄었을 뿐
   * 사라지지 않았다). 계정 키를 비교하면 그 프레임까지 덮인다.
   */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const accountKey = account?.userId ?? null;
  const [attemptsByUser, setAttemptsByUser] = useState<Record<string, Record<string, Attempt>>>({});
  const [notesByUser, setNotesByUser] = useState<Record<string, WrongNote[]>>({});
  const [academyNotes, setAcademyNotes] = useState<Record<string, AcademyNote[]>>({});
  const [retryByUser, setRetryByUser] = useState<Record<string, string[]>>({});
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [weekSummaries, setWeekSummaries] = useState<Record<string, parentRepo.WeekSummary>>({});
  const [praiseByChild, setPraiseByChild] = useState<Record<string, Praise[]>>({});
  /**
   * 학생 id → (배정 id → 반 비교). **서버 집계다**(`rpc_class_comparisons`).
   * 학부모는 다른 학생의 제출을 볼 수 없으므로 평균·순위는 이 값으로만 나온다.
   */
  const [comparisons, setComparisons] = useState<Record<string, Record<string, repo.ClassComparison>>>({});

  /**
   * 마지막 조회만 화면에 쓴다. 계정이 바뀌거나 다시 읽기가 겹치면 앞선 응답은 버린다 —
   * 예전 `alive` 플래그가 하던 일을 조회마다 붙는 번호로 옮긴 것이다.
   */
  const runId = useRef(0);

  /**
   * 지금 도는 조회의 번호와 약속. **밀린 조회가 자기를 밀어낸 조회를 기다리는 데 쓴다.**
   */
  const running = useRef<{ id: number; done: Promise<void> } | null>(null);

  /**
   * 나를 밀어낸 조회가 화면에 얹힐 때까지 기다린다.
   *
   * 밀린 조회는 아무것도 얹지 않고 끝난다. 그런데 그 약속은 정상적으로 풀렸으므로,
   * 연달아 두 번 쓰고 각각 `await reload()`를 하면 **첫 번째가 자기 값이 도착하기도 전에**
   * 풀렸다 — `reload()`가 약속한 `조회가 화면에 얹힌 뒤에 풀린다`가 거짓이었다.
   * 그래서 뒤에 온 조회를 기다려 그 자리에서 함께 풀린다.
   *
   * **잠금이 아니다.** 조회 번호는 계속 커지므로 기다림은 늘 더 큰 번호를 향한다 —
   * 서로 기다리는 고리가 생기지 않는다. 기다릴 대상이 없으면(취소) 그대로 끝낸다.
   */
  const awaitSuccessor = useCallback(async (id: number) => {
    const run = running.current;
    // 나를 밀어낸 조회가 없다 = 취소다(계정이 바뀌었거나 화면이 떠났다). 얹을 조회가 없다.
    if (!run || run.id <= id) return;
    // 뒤 조회가 던져도 앞 호출부를 깨뜨리지 않는다 — 이 경로는 늘 값으로 끝났다.
    await run.done.catch(() => {});
  }, []);

  /**
   * 서버에서 한 번 다 읽어 화면에 얹는다. **첫 조회와 다시 읽기가 같은 함수를 쓴다.**
   *
   * 예전에는 `reload()`가 다시 읽기 신호(`nonce`)만 올리고 곧바로 풀렸다. 그래서
   * `await reload()`는 조회가 시작되기도 전에 끝났고, 부르는 화면은 아직 도착하지 않은 값을
   * 사실처럼 다뤘다 — 제출 직후 결과 화면이 `결과를 찾지 못했어요`를 스쳤고(실측), 실패
   * 되돌리기는 잘못된 낙관적 값과 실패 문장을 함께 보였다. 지금은 조회가 끝난 뒤에 풀린다.
   *
   * 질의는 병렬로 던진다 — 원격 DB라 왕복이 곧 로딩 시간이고 서로 의존하지 않는다.
   * **학원 오답노트는 학원 계정일 때만 읽는다** — 다른 역할에는 뷰가 0행을 주므로 낭비다.
   */
  const runRead = useCallback(async (target: Account | null, id: number) => {
    const alive = () => runId.current === id;
    /*
      **첫 setState 전에 마이크로태스크를 한 번 넘긴다.** 효과 본문에서 곧바로 setState하면
      렌더가 한 번 더 돌고 린트가 그것을 막는다(`react-hooks/set-state-in-effect`).
    */
    await Promise.resolve();
    if (!alive()) return await awaitSuccessor(id);
    if (!target) {
      setAttemptsByUser({});
      setNotesByUser({});
      setAcademyNotes({});
      setRetryByUser({});
      setQueue([]);
      setAssignments([]);
      setWeekSummaries({});
      setPraiseByChild({});
      setComparisons({});
      setError(null);
      setLoadedFor(null);
      setReading(false);
      return;
    }
    /*
      **조회를 시작할 때 다시 `loading`으로 돌린다.**

      계정이 없는 첫 렌더에서 `loading`을 false로 내려 두면, 로그인 뒤 실제 조회가 도는 동안에도
      false로 남는다. 그러면 화면은 빈 데이터를 사실처럼 그린다 — 학습 고르기가 모든 학년을
      `아직 준비 중이에요`로 말하고 그 줄은 눌리지 않는다(실측: E2E 11건이 이 창에서 갈렸다).
    */
    setReading(true);
    try {
      const isAcademy = target.roles.includes('academy');
      const [attemptRows, notes, retry, q, asgn, summaries, praises, aNotes] = await Promise.all([
        repo.loadAttempts(),
        repo.loadNotes(),
        parentRepo.loadRetryRequests(),
        repo.loadQueue(),
        repo.loadAssignments(),
        parentRepo.loadWeekSummaries(),
        parentRepo.loadPraises(),
        isAcademy ? repo.loadAcademyNotes() : Promise.resolve({}),
      ]);
      if (!alive()) return await awaitSuccessor(id);
      setAttemptsByUser(attemptRows);
      setNotesByUser(notes);
      setRetryByUser(retry);
      setQueue(q);
      setAssignments(asgn);
      setWeekSummaries(summaries);
      setPraiseByChild(praises);
      setAcademyNotes(aNotes);
      /*
        반 비교는 **기록을 읽을 수 있는 학생마다** 한 번씩 받는다(본인 + 연결된 자녀).
        제출한 학원 과제가 있는 학생만 대상이다 — 없으면 빈 객체가 온다.
      */
      const studentIds = Object.keys(attemptRows);
      const pairs = await Promise.all(
        studentIds.map(async (sid) => [sid, await repo.classComparisons(sid)] as const),
      );
      if (!alive()) return await awaitSuccessor(id);
      setComparisons(Object.fromEntries(pairs));
      // 성공했으면 지난 실패를 지운다 — 다시 시도가 통했다는 사실도 화면에 닿아야 한다.
      setError(null);
    } catch (e) {
      const message = errorMessage(e);
      console.warn('학습 기록을 읽지 못했어요:', message);
      // 실패한 조회는 아무것도 얹지 않았다. 나를 밀어낸 조회가 있으면 그것이 얹을 때까지 기다린다.
      if (!alive()) return await awaitSuccessor(id);
      // 화면이 이 문장으로 실패와 빈 계정을 가른다(M-DB-16).
      setError(message);
    } finally {
      if (alive()) {
        /*
          **실패도 끝으로 본다.** 실패한 계정 키를 비워 두면 화면이 `불러오고 있어요`에서
          영구히 멈춘다. 실패했다는 사실은 `error`가 들고 있으므로, 화면은 그것을 보고 실패를
          말하고 `reload()`로 다시 시도한다.
        */
        setLoadedFor(target.userId);
        setReading(false);
      }
    }
  }, [awaitSuccessor]);

  /**
   * 조회를 시작하고 **그 조회를 기다리는 약속**을 준다. 새 조회의 번호는 여기서만 올린다
   * (아래 효과의 정리 함수는 취소로 올린다). 밀린 조회가 자기를 밀어낸 조회를 찾을 수 있게
   * 번호와 약속을 함께 남긴다.
   */
  const read = useCallback(
    (target: Account | null): Promise<void> => {
      const id = (runId.current += 1);
      const done = runRead(target, id);
      running.current = { id, done };
      return done;
    },
    [runRead],
  );

  /*
    로그인한 사람이 바뀌면 전부 다시 읽는다. 정리 함수는 도는 조회를 무효로 만든다 —
    계정이 바뀐 뒤 도착한 응답을 쓰면 남의 기록이 잠깐 보인다.
  */
  useEffect(() => {
    // 비동기 콜백 안에서 부른다 — 효과 본문에서 곧바로 부르면 린트가 setState를 본다.
    void (async () => {
      await read(account);
    })();
    return () => {
      runId.current += 1;
    };
  }, [account, read]);

  /** 서버에서 다시 읽는다. **조회가 화면에 얹힌 뒤에 풀린다.** */
  const reload = useCallback(() => read(account), [account, read]);

  /** 대리 보기 중에는 아무것도 쓰지 않는다(D-071). 서버는 운영자를 운영자로 보므로 여기서 막는다. */
  const denied = readOnly;

  // ── 조회 ───────────────────────────────────────────────────────────────────

  const attempts = attemptsByUser[uid] ?? NO_ATTEMPTS;
  const rawNotes = notesByUser[uid] ?? NO_NOTES;

  /*
    대리 보기 중에는 **AI와 정리한 메모(`dig`)를 가린다**(D-071). 문항·보기·별표는 문제 재현에
    필요하지만 메모는 학생이 자기 말로 쓴 사적인 글이다. 학원에도 열지 않는 것을 운영자가 전부
    읽으면 안 된다. 값 자체를 지워 어느 화면에서도 보이지 않게 한다.
  */
  const wrongNotes = useMemo(() => maskDig(rawNotes, readOnly), [rawNotes, readOnly]);

  const attemptsOf = useCallback(
    (studentId: string) => attemptsByUser[studentId] ?? NO_ATTEMPTS,
    [attemptsByUser],
  );
  /*
    `wrongNotes`와 **같은 규칙**을 쓴다. 바로 위에서 메모를 가려 놓고 여기서 원본을 주면 가린
    의미가 없다 — 학부모·학원 화면이 이 함수로 자녀·학생 노트를 읽는다(실측: `parent/attempt`,
    `academy/classes/student/[id]`). 운영자가 대리 보기로 들어오면 그 경로도 열린다.
  */
  const wrongNotesOf = useCallback(
    (studentId: string) => maskDig(notesByUser[studentId] ?? NO_NOTES, readOnly),
    [notesByUser, readOnly],
  );
  const retryOf = useCallback(
    (studentId: string) => retryByUser[studentId] ?? NO_RETRY,
    [retryByUser],
  );
  /*
    `wrongNotes`·`wrongNotesOf`와 **같은 규칙**을 쓴다(D-071). 이 경로만 마스크가 없었다 —
    지금은 서버가 막아서(대리 중 `auth.uid()`가 운영자라 `can_see_student()`가 거짓) 0행이지만,
    A-048의 토큰 분리가 들어오는 날 학원 화면들이 학생 메모 본문을 운영자에게 그린다.
    막는 벽을 서버 한 겹에만 두지 않는다.
  */
  /*
    **가리기를 호출마다 하지 않는다.** 이 함수는 렌더 루프 안에서 불린다
    (`academy/classes/[id].tsx`가 학생마다 `.length`만 읽는다) — 호출마다 배열을 새로 만들면
    학생 수에 비례해 낭비가 자라고 참조도 매번 달라진다. 데이터가 바뀔 때 한 번만 가린다.
  */
  const visibleAcademyNotes = useMemo(() => {
    if (!readOnly) return academyNotes;
    const out: typeof academyNotes = {};
    for (const [id, notes] of Object.entries(academyNotes)) out[id] = maskDig(notes, true);
    return out;
  }, [academyNotes, readOnly]);
  const academyNotesOf = useCallback(
    (studentId: string) => visibleAcademyNotes[studentId] ?? NO_ACADEMY_NOTES,
    [visibleAcademyNotes],
  );
  const comparisonsOf = useCallback(
    (studentId: string) => comparisons[studentId] ?? NO_COMPARISONS,
    [comparisons],
  );

  /**
   * 그 문항을 이 학습에서 담았는지.
   *
   * **`itemId`를 함께 본다**(A-085). 문항 id 하나로만 판단하면 개인 학습 결과 화면에서 학원
   * 배정의 오답이 이미 담긴 것으로 보이고, 그 토글을 끄면 학원 기록이 지워진다.
   */
  const hasNote = useCallback(
    (questionId: string, itemId: string) =>
      wrongNotes.some((w) => w.qId === questionId && w.itemId === itemId),
    [wrongNotes],
  );

  const isQueued = useCallback((itemId: string) => queue.some((q) => q.itemId === itemId), [queue]);

  const weekSummaryOf = useCallback(
    (childId: string, monday: string) => weekSummaries[`${childId}-${monday}`],
    [weekSummaries],
  );
  const praiseFor = useCallback(
    (childId: string) => praiseByChild[childId] ?? NO_PRAISE,
    [praiseByChild],
  );

  // ── 쓰기 ───────────────────────────────────────────────────────────────────

  /*
    **쓰기 함수는 모두 `WriteResult`를 돌려준다.**

    예전에는 여럿이 `Promise<void>`였고 실패를 조용히 삼켰다(`if (!result.ok) await reload()`).
    화면은 기다리지 않고 곧바로 `별표를 달았어요`·`다시 풀기를 요청했어요`를 띄웠는데, RLS가
    거부하거나 연결이 끊기면 그 값은 다음 조회에서 조용히 되돌아갔다 — 화면이 일어나지 않은
    일을 알린 것이다.

    지금은 결과를 그대로 넘긴다. 낙관적 표시는 그대로 두고(즉각 반응이 이 화면들의 가치다),
    실패하면 `reload()`가 서버 값으로 되돌리고 **부르는 화면이 그 사실을 말한다**
    (`app/parent/children.tsx`가 먼저 쓰던 방식이다).

    대리 보기(D-071)도 실패로 돌려준다. 화면은 `readOnly`를 먼저 보고 아무 말도 하지 않으므로
    이 문장이 사용자에게 보이지는 않는다 — 결과를 무시하는 자리가 없게 하려고 채워 둔다.
  */

  /**
   * 쓰기 한 번을 감싼다. **예외를 실패 결과로 바꾼다.**
   *
   * `src/repo/*`는 서버 오류를 `{ ok: false }`로 돌려주지만 **그 전에 던질 수 있다** —
   * `supabase()`는 설정이 없으면 예외이고, 여러 쓰기가 먼저 `auth.getUser()`를 기다린다.
   * 화면은 이 결과를 `void`로 흘려보내므로(부동 프로미스) 그 예외는 어디에도 닿지 않았다:
   * 낙관적으로 바꿔 둔 화면이 그대로 남고 `reload()`도 `if (!result.ok)`도 돌지 않아,
   * 저장되지 않은 값이 **성공처럼** 보였다.
   *
   * 그래서 예외도 결과로 돌려주고, 낙관적 변경은 `reload()`로 서버 값에 맞춘다.
   * 13곳에 같은 `try`를 두지 않으려고 한 곳에 모았다.
   */
  const write = useCallback(
    async <T extends WriteResult>(run: () => Promise<T>): Promise<T | WriteResult> => {
      try {
        return await run();
      } catch (e) {
        // 낙관적으로 바꿔 둔 화면을 서버 값으로 되돌린 뒤에 실패를 넘긴다.
        await reload();
        return { ok: false, error: errorMessage(e) };
      }
    },
    [reload],
  );

  const submitAttempt = useCallback<ProgressValue['submitAttempt']>(
    (input) =>
      write(async () => {
        if (denied) return { ok: false, error: '대리 보기 중에는 바꿀 수 없어요.' };
        const result = await repo.submitAttempt(input);
        if (result.ok) await reload();
        return result;
      }),
    [denied, reload, write],
  );

  const addWrongNote = useCallback<ProgressValue['addWrongNote']>(
    (input) =>
      write(async () => {
        if (denied) return DENIED;
        const result = await repo.addNote(input);
        if (result.ok) await reload();
        return result;
      }),
    [denied, reload, write],
  );

  const removeWrongNote = useCallback<ProgressValue['removeWrongNote']>(
    (id) =>
      write(async () => {
        if (denied) return DENIED;
        // 화면이 곧바로 반응해야 한다. 실패하면 다시 읽어 되돌리고 결과를 화면에 넘긴다.
        setNotesByUser((prev) => ({
          ...prev,
          [uid]: (prev[uid] ?? []).filter((w) => w.id !== id),
        }));
        const result = await repo.removeNote(id);
        if (!result.ok) await reload();
        return result;
      }),
    [denied, reload, uid, write],
  );

  const restoreWrongNote = useCallback<ProgressValue['restoreWrongNote']>(
    (note, index) =>
      write(async () => {
        if (denied) return DENIED;
        // 목록의 원래 자리로 되돌린다 — 맨 뒤에 붙으면 맞춰 둔 순서를 잃는다.
        setNotesByUser((prev) => {
          const mine = prev[uid] ?? [];
          if (mine.some((w) => w.id === note.id)) return prev;
          const at = Math.max(0, Math.min(index, mine.length));
          return { ...prev, [uid]: [...mine.slice(0, at), note, ...mine.slice(at)] };
        });
        const result = await repo.restoreNote(note);
        if (!result.ok) await reload();
        return result;
      }),
    [denied, reload, uid, write],
  );

  const patchNote = useCallback(
    (
      id: string,
      fields: { dig?: string; starred?: boolean; mastered?: boolean },
    ): Promise<WriteResult> =>
      write(async () => {
        if (denied) return DENIED;
        setNotesByUser((prev) => ({
          ...prev,
          [uid]: (prev[uid] ?? []).map((w) => (w.id === id ? { ...w, ...fields } : w)),
        }));
        const result = await repo.setNoteFields(id, fields);
        if (!result.ok) await reload();
        return result;
      }),
    [denied, reload, uid, write],
  );

  const setDig = useCallback((id: string, text: string) => patchNote(id, { dig: text }), [patchNote]);
  const toggleStar = useCallback(
    (id: string) => {
      const cur = rawNotes.find((w) => w.id === id);
      return patchNote(id, { starred: !cur?.starred });
    },
    [patchNote, rawNotes],
  );
  const setMastered = useCallback(
    (id: string, value: boolean) => patchNote(id, { mastered: value }),
    [patchNote],
  );

  const addToQueue = useCallback<ProgressValue['addToQueue']>(
    (item) =>
      write(async () => {
        if (denied) return DENIED;
        // **개인 학습만** 담는다(D-012) — 학원 과제는 배정으로만 전달돼야 한다.
        if (item.source !== 'personal') {
          return { ok: false, error: '학원 과제는 담아 둘 수 없어요.' };
        }
        // 이미 담겨 있다. 바꿀 것이 없으니 실패가 아니다.
        if (queue.some((q) => q.itemId === item.id)) return { ok: true };
        setQueue((prev) => [...prev, { itemId: item.id, contentId: item.contentId }]);
        const result = await repo.addToQueue(item.contentId, queue.length);
        if (!result.ok) await reload();
        return result;
      }),
    [denied, queue, reload, write],
  );

  const dropFromQueue = useCallback(
    (itemIds: readonly string[]): Promise<WriteResult> =>
      write(async () => {
        if (denied) return DENIED;
        if (itemIds.length === 0) return { ok: true };
        const drop = new Set(itemIds);
        const hit = queue.filter((q) => drop.has(q.itemId));
        /*
          **담긴 칸을 하나도 못 찾으면 성공이 아니다.** 여기서 `contentIds`가 비면
          `repo.removeFromQueue`가 아무것도 지우지 않고 `{ ok: true }`로 돌아온다 —
          서버에 닿지도 않은 빼기를 화면이 `뺐어요`라고 알렸다.
        */
        if (hit.length === 0) return { ok: false, error: '담아 둔 학습에서 찾지 못했어요.' };
        setQueue((prev) => prev.filter((q) => !drop.has(q.itemId)));
        const result = await repo.removeFromQueue(hit.map((q) => q.contentId));
        if (!result.ok) await reload();
        return result;
      }),
    [denied, queue, reload, write],
  );

  const removeFromQueue = useCallback((itemId: string) => dropFromQueue([itemId]), [dropFromQueue]);
  const removeManyFromQueue = useCallback(
    (itemIds: string[]) => dropFromQueue(itemIds),
    [dropFromQueue],
  );

  /** 순서를 바꾼 뒤 배열 전체를 다시 쓴다 — `position`이 곧 순서다. */
  const persistOrder = useCallback(
    (next: QueueEntry[]): Promise<WriteResult> =>
      write(async () => {
        setQueue(next);
        const result = await repo.setQueueOrder(next.map((q) => q.contentId));
        if (!result.ok) await reload();
        return result;
      }),
    [reload, write],
  );

  const moveInQueue = useCallback<ProgressValue['moveInQueue']>(
    async (itemId, dir, visible) => {
      if (denied) return DENIED;
      return persistOrder(moveQueueEntry(queue, itemId, dir, visible));
    },
    [denied, persistOrder, queue],
  );

  const restoreToQueue = useCallback<ProgressValue['restoreToQueue']>(
    async (removals) => {
      if (denied) return DENIED;
      if (removals.length === 0) return { ok: true };
      return persistOrder(restoreQueueEntries(queue, removals));
    },
    [denied, persistOrder, queue],
  );

  const addAssignment = useCallback<ProgressValue['addAssignment']>(
    (input) =>
      write(async () => {
        if (denied) return { ok: false, error: '대리 보기 중에는 바꿀 수 없어요.' };
        const result = await repo.addAssignment(input);
        if (result.ok) await reload();
        return result;
      }),
    [denied, reload, write],
  );

  const removeAssignment = useCallback<ProgressValue['removeAssignment']>(
    (assignmentId) =>
      write(async () => {
        if (denied) return { ok: false, error: '대리 보기 중에는 바꿀 수 없어요.' };
        const result = await repo.removeAssignment(assignmentId);
        if (result.ok) await reload();
        return result;
      }),
    [denied, reload, write],
  );

  const reassign = useCallback<ProgressValue['reassign']>(
    (assignmentId, dueDate) =>
      write(async () => {
        if (denied) return { ok: false, error: '대리 보기 중에는 바꿀 수 없어요.' };
        const result = await repo.reassign(assignmentId, dueDate);
        if (result.ok) await reload();
        return result;
      }),
    [denied, reload, write],
  );

  const requestRetryFor = useCallback<ProgressValue['requestRetryFor']>(
    (studentId, itemId) =>
      write(async () => {
        if (denied) return DENIED;
        // 개인 학습의 `itemId`는 콘텐츠에서 파생된다. 학원 학습은 배정 id라 배정에서 콘텐츠를 찾는다.
        const personal = itemId.startsWith('li_');
        const contentId = personal
          ? itemId.slice(3)
          : assignments.find((a) => a.id === itemId)?.contentId;
        // 배정이 지워졌거나 아직 안 읽혔다. 요청을 보낼 대상이 없으므로 성공이 아니다.
        if (!contentId) return { ok: false, error: '요청할 학습을 찾지 못했어요.' };
        const result = await parentRepo.requestRetry({
          studentId,
          source: personal ? 'personal' : 'academy',
          contentId,
          assignmentId: personal ? undefined : itemId,
        });
        if (result.ok) await reload();
        return result;
      }),
    [assignments, denied, reload, write],
  );

  const setWeekSummary = useCallback<ProgressValue['setWeekSummary']>(
    (childId, monday, text, byAI) =>
      write(async () => {
        if (denied) return DENIED;
        const result = await parentRepo.setWeekSummary({ childId, monday, text, byAI });
        if (result.ok) await reload();
        return result;
      }),
    [denied, reload, write],
  );

  const sendPraise = useCallback<ProgressValue['sendPraise']>(
    (childId, kind) =>
      write(async () => {
        if (denied) return DENIED;
        const result = await parentRepo.sendPraise(childId, kind);
        if (result.ok) await reload();
        return result;
      }),
    [denied, reload, write],
  );

  const dismissPraise = useCallback<ProgressValue['dismissPraise']>(
    (id) =>
      write(async () => {
        if (denied) return DENIED;
        setPraiseByChild((prev) => ({
          ...prev,
          [uid]: (prev[uid] ?? []).map((p) => (p.id === id ? { ...p, seen: true } : p)),
        }));
        const result = await parentRepo.dismissPraise(id);
        if (!result.ok) await reload();
        return result;
      }),
    [denied, reload, uid, write],
  );

  /** 조회 중이거나, 얹힌 기록이 다른 계정의 것이면 아직 읽는 중이다. */
  const loaded = loadedFor === accountKey;
  const loading = reading || !loaded;

  const value = useMemo<ProgressValue>(
    () => ({
      loading,
      loaded,
      error,
      attempts,
      attemptsOf,
      wrongNotesOf,
      retryOf,
      retry: retryByUser[uid] ?? NO_RETRY,
      requestRetryFor,
      wrongNotes,
      addWrongNote,
      removeWrongNote,
      restoreWrongNote,
      setDig,
      toggleStar,
      setMastered,
      hasNote,
      academyNotesOf,
      comparisonsOf,
      queue,
      addToQueue,
      removeFromQueue,
      removeManyFromQueue,
      moveInQueue,
      restoreToQueue,
      isQueued,
      assignments,
      submitAttempt,
      addAssignment,
      removeAssignment,
      reassign,
      weekSummaryOf,
      setWeekSummary,
      praiseFor,
      sendPraise,
      dismissPraise,
      reload,
    }),
    [
      loading,
      loaded,
      error,
      attempts,
      attemptsOf,
      wrongNotesOf,
      retryOf,
      retryByUser,
      uid,
      requestRetryFor,
      wrongNotes,
      addWrongNote,
      removeWrongNote,
      restoreWrongNote,
      setDig,
      toggleStar,
      setMastered,
      hasNote,
      academyNotesOf,
      comparisonsOf,
      queue,
      addToQueue,
      removeFromQueue,
      removeManyFromQueue,
      moveInQueue,
      restoreToQueue,
      isQueued,
      assignments,
      submitAttempt,
      addAssignment,
      removeAssignment,
      reassign,
      weekSummaryOf,
      setWeekSummary,
      praiseFor,
      sendPraise,
      dismissPraise,
      reload,
    ],
  );
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used within ProgressProvider');
  return ctx;
}
