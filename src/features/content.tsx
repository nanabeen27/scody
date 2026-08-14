import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ContentKind, ContentSet, Grade, KoreanArea } from '@/data/types';
import { errorMessage } from '@/lib/supabase';
import { createContent, listContent } from '@/repo/content';
import { useSession } from '@/session';

/**
 * 국어 학습 콘텐츠 저장소.
 *
 * **무엇이 보이는지는 서버가 정한다**(`can_read_content`): 학생에게 공개된 세트, 우리 학원이
 * 등록한 세트, 나에게 배정된 세트, 그리고 운영자는 전부. 그래서 이 provider는 받은 것을 그대로
 * 들고 있고 화면이 다시 걸러 내지 않는다.
 *
 * 익명에게는 아무것도 열리지 않는다 — 지문과 문항은 유료 콘텐츠다.
 */

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
  grade?: Grade;
  topic?: string;
}

interface ContentValue {
  sets: ContentSet[];
  /** 첫 조회가 끝나기 전에는 참이다. 화면이 `콘텐츠가 없어요`라고 말하지 않게. */
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
   * 값은 사람에게 그대로 보여 줄 문장이다(`errorMessage`). 실패해도 `sets`는 비우지 않는다 —
   * 이미 읽어 둔 것이 있으면 그것은 여전히 사실이다.
   */
  error: string | null;
  /**
   * 콘텐츠를 등록한다.
   *
   * **거부와 실패를 구분해서 돌려준다.** 예전에는 둘 다 `null`이어서 화면이 서버 오류를
   * `대리 보기 중에는 문제를 등록할 수 없어요.`라고 말했다 — 대리 보기가 아닐 때도 그렇게 나왔다.
   *
   * 대리 보기 중에는 등록하지 않는다(D-071). 학원 계정을 대리하면 `/academy/content/new`가
   * 열려 있고, 등록을 열어 두면 그 학원 콘텐츠에 운영자가 만든 것이 섞인다.
   */
  addContent: (input: NewContentInput) => Promise<{ set: ContentSet } | { error: string }>;
  /** 서버에서 다시 읽는다. */
  reload: () => Promise<void>;
}

const ContentContext = createContext<ContentValue | null>(null);

export function ContentProvider({ children }: { children: ReactNode }) {
  const { account, academy, readOnly } = useSession();
  // 옵셔널 체이닝을 의존성에 두면 `react-hooks` 린트가 메모 보존을 보장하지 못한다.
  const academyId = academy?.id;
  const [sets, setSets] = useState<ContentSet[]>([]);
  const [reading, setReading] = useState(true);
  /** 마지막 조회가 실패한 이유. 다음 조회가 성공하면 `null`로 돌아간다. */
  const [error, setError] = useState<string | null>(null);
  /**
   * 지금 화면에 얹힌 `sets`가 **누구의 것인지**. 아래 효과가 조회를 끝낼 때만 채운다.
   *
   * `loading`을 상태 하나로 두면 로그인한 사람이 바뀐 **첫 렌더**가 `false`로 남는다 —
   * 효과는 렌더가 끝난 뒤에 돌고, 그 안에서도 마이크로태스크를 한 번 넘긴 뒤에야
   * `loading`을 올린다(린트가 효과 본문의 setState를 막는다). 그 한 프레임에 화면은 빈
   * 데이터를 사실로 그린다(실측: 학생 홈 새로고침에서 `아직 시작한 학습이 없어요`가
   * 629ms → 9ms로 줄었을 뿐 사라지지 않았다). 계정 키를 비교하면 그 프레임까지 덮인다.
   */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const accountKey = account?.userId ?? null;

  /** 다시 읽기 신호. 값이 바뀌면 아래 효과가 다시 돈다. */
  const [nonce, setNonce] = useState(0);

  /*
    로그인한 사람이 바뀌면 다시 읽는다 — 볼 수 있는 콘텐츠가 역할·소속에 따라 다르다.
    로그아웃하면 비운다.

    **모든 setState가 비동기 콜백 안에 있다.** 효과 본문에서 곧바로 부르면 렌더가 한 번 더 돌고
    린트가 그것을 막는다.
  */
  useEffect(() => {
    let alive = true;
    const key = account?.userId ?? null;
    /**
     * 이 조회가 끝났다고 표시한다. 성공·실패 모두 여기를 지난다.
     *
     * `failure`가 곧 화면이 볼 `error`다 — 성공하면 `null`로 되돌려, 한 번 실패한 화면이
     * 다음 조회가 성공한 뒤에도 빨간 줄을 들고 있지 않게 한다.
     */
    const done = (rows: ContentSet[] | null, failure: string | null) => {
      if (!alive) return;
      if (rows) setSets(rows);
      setError(failure);
      /*
        **실패도 끝으로 본다.** 실패한 계정 키를 비워 두면 화면이 `불러오고 있어요`에서 영구히
        멈춘다. 실패했다는 사실은 `error`가 들고 있으므로, 화면은 그것을 보고 실패를 말하고
        `reload()`로 다시 시도한다.
      */
      setLoadedFor(key);
      setReading(false);
    };
    void (async () => {
      if (account) {
        /*
          **조회를 시작할 때 다시 읽는 중으로 돌린다.**

          계정이 없는 첫 렌더에서 내려 두면, 로그인 뒤 실제 조회가 도는 동안에도 false로 남는다.
          그러면 화면은 빈 데이터를 사실처럼 그린다 — 학습 고르기가 모든 학년을
          `아직 준비 중이에요`로 말하고 그 줄은 눌리지 않는다(실측: E2E 11건이 이 창에서 갈렸다).

          마이크로태스크 뒤에 부른다 — 효과 본문에서 곧바로 setState하면 렌더가 한 번 더 돈다.
          그 한 프레임은 위 `loadedFor` 비교가 덮는다.
        */
        await Promise.resolve();
        if (!alive) return;
        setReading(true);

        try {
          done(await listContent(), null);
        } catch (e) {
          const message = errorMessage(e);
          console.warn('콘텐츠를 읽지 못했어요:', message);
          // 읽어 둔 목록은 그대로 두고 실패만 얹는다. 화면이 빈 목록을 사실로 그리지 않게.
          done(null, message);
        }
        return;
      }
      // 로그아웃하면 비운다.
      done([], null);
    })();
    return () => {
      alive = false;
    };
  }, [account, nonce]);

  /** 서버에서 다시 읽는다. 위 효과를 한 번 더 돌린다. */
  const reload = useCallback(async () => {
    setNonce((n) => n + 1);
  }, []);

  const addContent = useCallback<ContentValue['addContent']>(
    async (input) => {
      if (readOnly) return { error: '대리 보기 중에는 문제를 등록할 수 없어요.' };
      try {
        const created = await createContent({
          area: input.area,
          title: input.title,
          kind: input.kind,
          passage: input.passage,
          questions: input.questions,
          publishToStudents: input.publishToStudents,
          /*
            학원 등록이면 **지금 로그인한 사람의 학원**으로 소유를 잡는다. 화면이 넘긴 이름을
            믿지 않는다 — 서버도 `owner_academy_id`가 내 학원인지 다시 본다.
          */
          ownerAcademyId: input.ownerAcademyName ? academyId : undefined,
          grade: input.grade,
          topic: input.topic,
        });
        setSets((prev) => [...prev, created]);
        return { set: created };
      } catch (e) {
        return { error: errorMessage(e) };
      }
    },
    [academyId, readOnly],
  );

  /** 조회 중이거나, 얹힌 값이 다른 계정의 것이면 아직 읽는 중이다. */
  const loaded = loadedFor === accountKey;
  const loading = reading || !loaded;
  const value = useMemo(() => ({ sets, loading, loaded, error, addContent, reload }), [
    sets,
    loading,
    loaded,
    error,
    addContent,
    reload,
  ]);
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent(): ContentValue {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error('useContent must be used within ContentProvider');
  return ctx;
}
