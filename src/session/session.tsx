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
import type { AcademyClass, Account, Role } from '@/data/types';
import { errorMessage, hasSupabaseConfig, supabase } from '@/lib/supabase';
import { DEV_LOGIN_ENABLED, DEV_LOGIN_PASSWORD, devLoginEmail } from '@/session/devAccounts';
import { staffEmail } from '@/session/staffEmail';
import {
  loadDirectory,
  loadSelfRoles,
  type AcademyInfo,
  type Directory,
} from '@/repo/directory';
import { loadDrafts, saveDraft } from '@/repo/learning';

/**
 * 인증·사람·학원 스냅샷 경계.
 *
 * ## 왜 하나의 provider인가
 *
 * 화면 57개가 `useSession().account`를 쓴다. 계정을 만들려면 프로필·역할·소속·이용권을 합쳐야
 * 하고(`toAccount`), 그 데이터는 반 목록·자녀 목록과 같은 질의에서 온다. 인증과 스냅샷을 두
 * provider로 나누면 둘이 서로를 기다려야 해서 순서 제약과 로딩 상태가 두 벌이 된다.
 *
 * ## 로딩 게이트
 *
 * Supabase는 저장된 세션을 **비동기로** 복원한다. 그동안 `account`는 `null`인데, 역할 레이아웃은
 * `account`가 없으면 즉시 `/login`으로 보낸다. 그래서 `loading`을 함께 내보내고 레이아웃이 그
 * 값을 먼저 본다 — 없으면 새로고침마다 로그인 화면으로 튄다.
 */

/** 대리 보기 상태. 운영자가 사용자 화면을 그 사람 눈으로 볼 때만 있다. **읽기 전용이다**(D-071). */
export interface Impersonation {
  operator: Account;
  target: Account;
  startedAt: string;
  reason: string;
  ticket?: string;
  /** 이 세션에서 열어 본 화면 경로. 개인정보 접속기록의 '수행업무'에 해당한다. */
  visited: string[];
  /** 서버에 남긴 기록의 id. 종료 시각을 여기에 쓴다. */
  recordId?: string;
}

/** 대리 보기 최대 시간(분). 지나면 자동으로 끝난다. */
export const IMPERSONATION_MINUTES = 15;

export type ImpersonationEndReason = '수동 종료' | '시간 만료';

export interface ImpersonationEnd extends Impersonation {
  why: ImpersonationEndReason;
}

export interface SignInResult {
  ok: boolean;
  error?: string;
  account?: Account;
}

interface SessionValue {
  /** 세션 복원·스냅샷 로딩 중. 참이면 역할 가드가 판단을 미룬다. */
  loading: boolean;
  account: Account | null;
  /**
   * 개발용 테스트 계정 로그인.
   *
   * 확정 정책(D-020)의 로그인 수단은 카카오와 휴대폰 두 가지이고 그 연결은 다음 단계다.
   * 로그인 화면의 **테스트 계정 패널**만 이 함수를 쓴다 — 화면에 보이는 수단 구성은 그대로다.
   */
  signInWithTestAccount: (scodyId: string) => Promise<SignInResult>;
  /**
   * **스코디 아이디 + 비밀번호로 로그인한다**(D-165). `/staff`가 쓴다.
   *
   * `signInWithTestAccount`와 다른 점은 비밀번호를 **사람이 입력한다**는 것이다. 그래서
   * `DEV_LOGIN_ENABLED` 스위치와 무관하게 운영 빌드에서도 동작한다 — 벽은 화면 숨김이 아니라
   * Supabase 인증이고, 비밀번호는 공개 저장소에 없는 난수다(D-157).
   */
  signInWithScodyId: (scodyId: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  /** 스냅샷을 다시 읽는다. 반·학생·소속을 바꾼 뒤 부른다. */
  reload: () => Promise<void>;

  // ── 사람·학원·반 조회(동기) ────────────────────────────────────────────────
  /** 내가 볼 수 있는 계정 하나. 범위 밖이면 `undefined`. */
  accountOf: (userId: string) => Account | undefined;
  /** 연결된 자녀 계정. */
  childrenOf: (parentId: string) => Account[];
  /** 그 계정이 볼 수 있는 반. 원장은 학원 전체, 선생님은 담당 반만. */
  classesFor: (target: Account) => AcademyClass[];
  /** 지금 로그인한 계정이 볼 수 있는 반 하나. */
  classById: (classId: string) => AcademyClass | undefined;
  /** 그 반의 학생 계정. 권한 밖이면 빈 배열. */
  studentsIn: (classId: string) => Account[];
  /** 학생이 속한 반들. */
  studentClasses: (userId: string) => AcademyClass[];
  /** 우리 학원 학생 전체(원장·선생님 범위). */
  academyStudents: Account[];
  /** 우리 학원 교직원(원장 포함). */
  teachers: Account[];
  /** 교직원으로 속한 학원. 계약 좌석·갱신일이 들어 있다. */
  academy?: AcademyInfo;

  // ── 대리 보기 ──────────────────────────────────────────────────────────────
  impersonation: Impersonation | null;
  startImpersonation: (input: {
    target: Account;
    reason: string;
    ticket?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  endImpersonation: (why: ImpersonationEndReason) => ImpersonationEnd | null;
  noteVisit: (path: string) => void;
  /** 대리 중에는 참이다. 쓰기 함수가 이 값을 보고 거부한다. */
  readOnly: boolean;

  // ── 학습 진행 ──────────────────────────────────────────────────────────────
  /**
   * 제출 전 자동 저장 답안. `itemId` → `{ 문항id: 고른 선지 }`.
   * 프로토타입은 메모리였고 이제 `answer_drafts` 표에 남는다 — 새로고침해도 이어서 할 수 있다.
   */
  answers: Record<string, Record<string, number>>;
  saveAnswer: (input: {
    itemId: string;
    source: 'personal' | 'academy';
    contentId: string;
    assignmentId?: string;
    questionId: string;
    choice: number;
  }) => void;
  /** 학원 연결 상태. 연결을 끊어도 학습 기록은 유지된다(정책). */
  academyLinked: boolean;
  setAcademyLinked: (linked: boolean) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

const NO_CLASSES: AcademyClass[] = [];
const NO_ACCOUNTS: Account[] = [];

export function SessionProvider({ children }: { children: ReactNode }) {
  /** 로그인한 사람. 대리 보기 중에도 이 값은 **운영자**다. */
  const [authUid, setAuthUid] = useState<string | null>(null);
  /**
   * 세션 복원 중인지.
   *
   * 초기값을 설정 유무로 정한다 — 설정이 없으면 복원할 것이 없다. 효과 본문에서
   * `setLoading(false)`를 부르면 렌더가 한 번 더 돌고 린트가 그것을 막는다.
   */
  const [loading, setLoading] = useState(() => hasSupabaseConfig());
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [impersonation, setImpersonation] = useState<Impersonation | null>(null);
  /**
   * 대리 보기를 시작할 때의 운영자 스냅샷.
   *
   * **끝낼 때 즉시 되돌리기 위해 들고 있는다.** 예전에는 종료 후 서버에서 다시 읽었는데, 그 사이
   * `account`가 대상 계정으로 남아 있어 운영자 화면의 역할 가드가 `/login`으로 보냈다
   * (실측: admin-flow 4건이 종료 직후 로그인 화면을 봤다).
   */
  const [operatorDirectory, setOperatorDirectory] = useState<Directory | null>(null);
  const [answers, setAnswers] = useState<Record<string, Record<string, number>>>({});
  const [academyLinked, setAcademyLinked] = useState(true);

  /** 화면에 보여 줄 사람. 대리 중에는 대상이다. */
  const viewUid = impersonation?.target.userId ?? authUid;

  /**
   * 스냅샷을 읽는다.
   *
   * 운영자에게는 최소 스냅샷만 읽는다 — RLS가 전체 계정을 주기 때문에 전부 담으면 프로토타입이
   * 브라우저에서 4천 개 계정을 훑던 자리로 돌아간다. 대리 보기 중에는 대상의 화면을 그려야 해서
   * 전체를 읽는다.
   */
  const fetchDirectory = useCallback(async (uid: string, impersonating: boolean) => {
    const roles = await loadSelfRoles(uid);
    const minimal = roles.includes('admin') && !impersonating;
    return loadDirectory(uid, { minimal });
  }, []);

  const hydrate = useCallback(
    async (uid: string | null) => {
      if (!uid) {
        setDirectory(null);
        setAnswers({});
        setLoading(false);
        return;
      }
      try {
        const [dir, drafts] = await Promise.all([fetchDirectory(uid, false), loadDrafts()]);
        setDirectory(dir);
        setAnswers(drafts);
      } catch (e) {
        // 스냅샷을 못 읽으면 로그인 상태를 유지할 근거가 없다. 조용히 빈 화면을 만들지 않는다.
        console.warn('세션 스냅샷을 읽지 못했어요:', errorMessage(e));
        setDirectory(null);
      } finally {
        setLoading(false);
      }
    },
    [fetchDirectory],
  );

  /*
    저장된 세션을 복원하고, 이후 로그인·로그아웃·토큰 갱신을 구독한다.
    설정이 없으면(`.env` 미비) 로딩만 끝낸다 — 모듈을 부르는 것만으로 앱이 죽지 않게.
  */
  useEffect(() => {
    if (!hasSupabaseConfig()) return;
    let alive = true;
    supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (!alive) return;
        const uid = data.session?.user.id ?? null;
        setAuthUid(uid);
        void hydrate(uid);
      });
    const { data: sub } = supabase().auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      const uid = session?.user.id ?? null;
      setAuthUid((prev) => {
        // 같은 사람의 토큰 갱신에는 스냅샷을 다시 읽지 않는다.
        if (prev === uid) return prev;
        void hydrate(uid);
        return uid;
      });
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [hydrate]);

  /**
   * 스코디 아이디 + 비밀번호로 세션을 연다. 두 로그인 경로가 이 본문을 함께 쓴다.
   *
   * 이메일 주소를 만드는 곳은 `devLoginEmail` 하나다 — 여기 템플릿 리터럴을 두면 개발 로그인을
   * 끈 빌드에서도 그 문자열이 번들에 남는다(D-145에서 실측했다).
   */
  const openSession = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      if (!hasSupabaseConfig()) {
        return { ok: false, error: 'Supabase 설정이 없어요.' };
      }
      if (!email) return { ok: false, error: '아이디를 확인해 주세요.' };
      setLoading(true);
      const { data, error } = await supabase().auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        setLoading(false);
        return { ok: false, error: errorMessage(error) || '로그인하지 못했어요.' };
      }
      setImpersonation(null);
      setAcademyLinked(true);
      try {
        const [dir, drafts] = await Promise.all([
          fetchDirectory(data.user.id, false),
          loadDrafts(),
        ]);
        setAuthUid(data.user.id);
        setDirectory(dir);
        setAnswers(drafts);
        return { ok: true, account: dir.me };
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      } finally {
        setLoading(false);
      }
    },
    [fetchDirectory],
  );

  const signInWithScodyId = useCallback<SessionValue['signInWithScodyId']>(
    (scodyId, password) => {
      const id = scodyId.trim().toLowerCase();
      if (!id) return Promise.resolve({ ok: false, error: '아이디를 적어 주세요.' });
      if (!password) return Promise.resolve({ ok: false, error: '비밀번호를 적어 주세요.' });
      return openSession(staffEmail(id), password);
    },
    [openSession],
  );

  const signInWithTestAccount = useCallback<SessionValue['signInWithTestAccount']>(
    async (scodyId) => {
      if (!hasSupabaseConfig()) {
        return { ok: false, error: 'Supabase 설정이 없어요.' };
      }
      /*
        **개발용 로그인은 켜져 있을 때만 동작한다**(D-135). 기본값이 꺼짐이라, 이 값을 넣지 않은
        빌드에는 이 경로가 없다 — 실수로 운영에 실려 나가는 것을 막는 유일한 장치다(M-DB-2가
        닫히기 전까지는 이것이 유일한 로그인이라 지울 수는 없다).
      */
      if (!DEV_LOGIN_ENABLED || !DEV_LOGIN_PASSWORD) {
        return { ok: false, error: '이 빌드에는 개발용 로그인이 없어요.' };
      }
      setLoading(true);
      const { data, error } = await supabase().auth.signInWithPassword({
        /*
          seed가 만든 개발용 계정. 실제 서비스에서는 이 경로가 없다.
          **주소를 여기서 만들지 않는다**(D-145) — 이 파일의 템플릿 리터럴은 스위치를 꺼도
          운영 번들에 남는다. `devLoginEmail`은 꺼진 빌드에서 상수로 접혀 사라진다.
        */
        email: devLoginEmail(scodyId),
        password: DEV_LOGIN_PASSWORD,
      });
      if (error || !data.user) {
        setLoading(false);
        return { ok: false, error: errorMessage(error) || '로그인하지 못했어요.' };
      }
      setImpersonation(null);
      setAcademyLinked(true);
      try {
        const [dir, drafts] = await Promise.all([
          fetchDirectory(data.user.id, false),
          loadDrafts(),
        ]);
        setAuthUid(data.user.id);
        setDirectory(dir);
        setAnswers(drafts);
        return { ok: true, account: dir.me };
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      } finally {
        setLoading(false);
      }
    },
    [fetchDirectory],
  );

  const signOut = useCallback(async () => {
    /*
      **서버 로그아웃을 먼저 기다린다.** 먼저 화면 상태를 비우면 사용자가 곧바로 다른 계정으로
      로그인할 수 있는데, 그때 늦게 도착한 `SIGNED_OUT` 이벤트가 방금 만든 세션을 지운다
      (실측: 로그아웃 → 다른 계정 로그인이 로그인 화면에 머물렀다).
    */
    if (hasSupabaseConfig()) await supabase().auth.signOut();
    setImpersonation(null);
    setOperatorDirectory(null);
    setAnswers({});
    setAcademyLinked(true);
    setDirectory(null);
    setAuthUid(null);
  }, []);

  const reload = useCallback(async () => {
    if (!viewUid) return;
    try {
      setDirectory(await fetchDirectory(viewUid, !!impersonation));
    } catch (e) {
      console.warn('스냅샷을 다시 읽지 못했어요:', errorMessage(e));
    }
  }, [fetchDirectory, impersonation, viewUid]);

  // ── 조회 ───────────────────────────────────────────────────────────────────

  const account = directory?.me ?? null;

  const accountOf = useCallback(
    (userId: string) => directory?.people.get(userId),
    [directory],
  );

  const childrenOf = useCallback(
    (parentId: string): Account[] => {
      if (!directory) return NO_ACCOUNTS;
      // 스냅샷은 내 자녀만 담는다. 다른 사람의 자녀 목록은 여기서 나오지 않는다.
      if (parentId !== directory.me.userId) return NO_ACCOUNTS;
      return directory.childIds
        .map((id) => directory.people.get(id))
        .filter((a): a is Account => !!a);
    },
    [directory],
  );

  const classesFor = useCallback(
    (target: Account): AcademyClass[] => {
      if (!directory) return NO_CLASSES;
      if (!target.roles.includes('academy') || !target.academyName) return NO_CLASSES;
      const mine = directory.classes.filter((c) => c.academyName === target.academyName);
      if (target.academyRole === 'director') return mine;
      return mine.filter((c) => c.teacherId === target.userId);
    },
    [directory],
  );

  const classById = useCallback(
    (classId: string) => (account ? classesFor(account).find((c) => c.id === classId) : undefined),
    [account, classesFor],
  );

  const studentsIn = useCallback(
    (classId: string): Account[] => {
      const cls = classById(classId);
      if (!cls || !directory) return NO_ACCOUNTS;
      return cls.studentIds
        .map((id) => directory.people.get(id))
        .filter((a): a is Account => !!a);
    },
    [classById, directory],
  );

  const studentClasses = useCallback(
    (userId: string): AcademyClass[] =>
      directory ? directory.classes.filter((c) => c.studentIds.includes(userId)) : NO_CLASSES,
    [directory],
  );

  const academyStudents = useMemo(() => {
    if (!directory?.academy) return NO_ACCOUNTS;
    const name = directory.academy.name;
    return [...directory.people.values()].filter(
      (p) => p.academyName === name && p.roles.includes('student'),
    );
  }, [directory]);

  const teachers = useMemo(() => {
    if (!directory?.academy) return NO_ACCOUNTS;
    const name = directory.academy.name;
    return [...directory.people.values()].filter(
      (p) => p.academyName === name && p.roles.includes('academy'),
    );
  }, [directory]);

  // ── 대리 보기 ──────────────────────────────────────────────────────────────

  const startImpersonation = useCallback<SessionValue['startImpersonation']>(
    async ({ target, reason, ticket }) => {
      if (!account) return { ok: false, error: '로그인이 필요해요.' };
      if (!account.roles.includes('admin')) {
        return { ok: false, error: '총괄관리자만 대리 보기를 할 수 있어요.' };
      }
      if (impersonation) return { ok: false, error: '이미 대리 보기 중이에요.' };
      if (target.userId === account.userId) {
        return { ok: false, error: '자기 계정은 대리 보기 할 수 없어요.' };
      }
      if (target.roles.includes('admin')) {
        return { ok: false, error: '총괄관리자 계정은 대리 보기 할 수 없어요.' };
      }
      if (!reason.trim()) return { ok: false, error: '사유를 적어야 시작할 수 있어요.' };

      /*
        **서버에 먼저 남긴다.** 프로토타입은 진행 상태가 메모리에만 있어 새로고침하면 사라졌고
        종료 기록도 남지 않았다. 개인정보 안전성 확보조치 기준 제8조(접속기록)의 근거가 되는
        기록이라, 화면 상태보다 이 행이 먼저다.
      */
      /*
        **닫히지 않은 이전 기록을 먼저 닫는다.** 종료 처리는 탭을 닫거나 네트워크가 끊기면
        못 갈 수 있는데, `impersonation_open_key`가 운영자당 열린 기록을 하나로 제한한다. 그러면
        그 뒤로 대리 보기를 **영구히 시작할 수 없다**(실측 가능한 자기 차단이다).
        끝난 것으로 표시하되 사유를 `시간 만료`로 남겨, 정상 종료와 구분되게 한다.

        **그래서 이 정리의 실패를 삼키지 않는다.** 조용히 넘기면 바로 아래 insert가 그 유니크
        인덱스에 걸려, 화면에는 원인과 무관한 중복 키 문구만 남고 자기 차단이 그대로 일어난다.
      */
      const stale = await supabase()
        .from('impersonation_sessions')
        .update({ ended_at: new Date().toISOString(), end_reason: '시간 만료' })
        .eq('operator_id', account.userId)
        .is('ended_at', null);
      if (stale.error) return { ok: false, error: errorMessage(stale.error) };

      const { data, error } = await supabase()
        .from('impersonation_sessions')
        .insert({
          operator_id: account.userId,
          target_id: target.userId,
          reason: reason.trim(),
          ticket: ticket?.trim() || null,
        })
        .select('id')
        .single();
      if (error) return { ok: false, error: errorMessage(error) };

      setImpersonation({
        operator: account,
        target,
        startedAt: new Date().toISOString(),
        reason: reason.trim(),
        ticket: ticket?.trim() || undefined,
        visited: [],
        recordId: data.id,
      });
      setAnswers({});
      setAcademyLinked(true);
      /*
        대상 기준으로 스냅샷을 다시 읽는다. **`auth.uid()`는 여전히 운영자다** — RLS는 운영자
        권한으로 판단하고(`is_admin()` 분기), 조립만 대상 기준으로 한다. 그래서 "대상의 눈으로
        본다"가 서버에서 강제되지는 않는다(A-048의 `impersonated_by` 토큰 분리가 필요한 자리다).
      */
      try {
        // 지금 스냅샷을 그대로 보관한다 — 끝낼 때 서버를 기다리지 않고 되돌린다.
        setOperatorDirectory(directory);
        setDirectory(await fetchDirectory(target.userId, true));
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      }
      return { ok: true };
    },
    [account, directory, fetchDirectory, impersonation],
  );

  const endImpersonation = useCallback<SessionValue['endImpersonation']>(
    (why) => {
      if (!impersonation) return null;
      const ended = { ...impersonation, why };
      setImpersonation(null);
      setAnswers({});
      setAcademyLinked(true);
      if (impersonation.recordId) {
        /*
          화면은 기다리지 않는다(스냅샷을 곧바로 되돌려야 한다). 대신 **실패를 삼키지 않는다** —
          접속기록의 '수행업무'가 비는 일이라 조용히 지나가면 안 된다. 시작 쪽이 닫히지 않은
          기록을 정리하므로, 실패해도 다음 대리 보기가 막히지는 않는다.
        */
        void supabase()
          .from('impersonation_sessions')
          .update({
            ended_at: new Date().toISOString(),
            end_reason: why,
            visited: impersonation.visited,
          })
          .eq('id', impersonation.recordId)
          // 아직 열린 기록만 닫는다. 시작 쪽이 `시간 만료`로 이미 닫아 둔 행이면
          // 트리거가 `이미 끝난 대리 보기 기록이에요.`로 막고 종료 사유만 사라진다.
          .is('ended_at', null)
          .then(({ error }) => {
            if (error) console.error('대리 보기 종료 기록 실패', error.message);
          });
      }
      /*
        **운영자 스냅샷을 곧바로 되돌린다.** 서버 왕복을 기다리면 그 사이 `account`가 대상으로
        남아 운영자 화면의 역할 가드가 로그인으로 보낸다. 최신 값은 뒤이어 다시 읽는다.
      */
      if (operatorDirectory) setDirectory(operatorDirectory);
      setOperatorDirectory(null);
      if (authUid) void fetchDirectory(authUid, false).then(setDirectory).catch(() => {});
      return ended;
    },
    [authUid, fetchDirectory, impersonation, operatorDirectory],
  );

  const noteVisit = useCallback((path: string) => {
    setImpersonation((cur) =>
      // 같은 화면을 연속으로 두 번 적지 않는다.
      !cur || cur.visited[cur.visited.length - 1] === path
        ? cur
        : { ...cur, visited: [...cur.visited, path] },
    );
  }, []);

  const readOnly = !!impersonation;

  // ── 답안 자동 저장 ─────────────────────────────────────────────────────────

  /** 저장 중인 요청. 같은 문항을 연달아 누를 때 마지막 값만 남게 한다. */
  const pending = useRef(new Map<string, number>());

  const saveAnswer = useCallback<SessionValue['saveAnswer']>(
    (input) => {
      // 대리 보기는 읽기 전용이다. 답이 학생 명의로 저장되면 학습 기록이 오염된다(D-071).
      if (readOnly) return;
      // 화면은 즉시 반응해야 한다. 서버 저장은 뒤따라간다(낙관적 갱신).
      setAnswers((prev) => ({
        ...prev,
        [input.itemId]: { ...prev[input.itemId], [input.questionId]: input.choice },
      }));
      pending.current.set(input.questionId, input.choice);
      void saveDraft({
        source: input.source,
        contentId: input.contentId,
        assignmentId: input.assignmentId,
        questionId: input.questionId,
        pickedIndex: input.choice,
      }).then((r) => {
        if (!r.ok) console.warn('답안을 저장하지 못했어요:', r.error);
        pending.current.delete(input.questionId);
      });
    },
    [readOnly],
  );

  const value = useMemo<SessionValue>(
    () => ({
      loading,
      account,
      signInWithTestAccount,
      signInWithScodyId,
      signOut,
      reload,
      accountOf,
      childrenOf,
      classesFor,
      classById,
      studentsIn,
      studentClasses,
      academyStudents,
      teachers,
      academy: directory?.academy,
      impersonation,
      startImpersonation,
      endImpersonation,
      noteVisit,
      readOnly,
      answers,
      saveAnswer,
      academyLinked,
      setAcademyLinked,
    }),
    [
      loading,
      account,
      signInWithTestAccount,
      signInWithScodyId,
      signOut,
      reload,
      accountOf,
      childrenOf,
      classesFor,
      classById,
      studentsIn,
      studentClasses,
      academyStudents,
      teachers,
      directory,
      impersonation,
      startImpersonation,
      endImpersonation,
      noteVisit,
      readOnly,
      answers,
      saveAnswer,
      academyLinked,
    ],
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
