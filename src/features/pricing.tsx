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
import { errorMessage } from '@/lib/supabase';
import * as repo from '@/repo/pricing';
import { useSession } from '@/session';

/**
 * 요금 정책. 총괄관리자가 월정액 단가와 비율을 정한다.
 *
 * **값은 서버에 있다.** 바꾸면 `pricing_policies`에 **새 행이 쌓이고**(이력이다) 지금 값은
 * `current_pricing()`이 준다. 예전에는 메모리의 단일 값이라 새로고침하면 되돌아갔고, 누가 언제
 * 단가를 바꿨는지 알 수 없었다.
 *
 * ## 읽는 범위가 역할에 따라 갈린다
 *
 * `pricing_policies`는 운영자만 읽는다 — 좌석 단가·규모 할인·연 결제 비율은 B2B 계약 조건이다.
 * 학부모·학생 화면은 `v_public_pricing`에서 **개인 요금 두 개만** 읽는다(`대신 내주기`가 말하는
 * 금액이 그것뿐이다). **원장은 좌석 세 값을** `v_academy_seat_pricing`에서 읽는다(D-148) —
 * 학원 관리 화면의 `좌석 단가`·`규모 할인`·`한 달 예상 금액`이 그 값으로 계산된다.
 * 어느 경로에서도 받지 못한 항목은 `DEFAULT_PRICING` 값 그대로다.
 *
 * 실제 결제·정산과는 아직 연결되지 않았다(마스터 플랜 5절). 화면이 그 사실을 함께 밝힌다.
 */

export type PricingPolicy = repo.PricingPolicy;
export type WriteResult = repo.WriteResult;

/**
 * 기준값. `supabase/seed.sql`이 넣는 첫 정책 행과 같은 값이고, 운영 기록의
 * `기본값과 다른 항목`이 이 값과 비교한다.
 */
export const DEFAULT_PRICING: PricingPolicy = {
  studentPaid: 19000,
  parentPaid: 29000,
  academySeat: 12000,
  seatDiscountPct: 15,
  seatDiscountFrom: 50,
  annualDiscountPct: 20,
  annualSharePct: 30,
};

/** 정책상 허용 범위. 화면의 증감 버튼과 검증, 그리고 표의 CHECK 제약이 같은 값을 쓴다. */
export const PRICING_LIMITS: Record<
  keyof PricingPolicy,
  { min: number; max: number; step: number }
> = {
  studentPaid: { min: 0, max: 200000, step: 1000 },
  parentPaid: { min: 0, max: 200000, step: 1000 },
  academySeat: { min: 0, max: 200000, step: 500 },
  seatDiscountPct: { min: 0, max: 60, step: 5 },
  seatDiscountFrom: { min: 1, max: 500, step: 10 },
  annualDiscountPct: { min: 0, max: 60, step: 5 },
  annualSharePct: { min: 0, max: 100, step: 5 },
};

interface PricingValue {
  policy: PricingPolicy;
  /**
   * 첫 조회가 끝나기 전에는 참이다.
   *
   * 화면이 `DEFAULT_PRICING`을 서버 값처럼 말하지 않게 하고, `parentPays`의 빈 배열을
   * `표시하지 않았어요`로 읽히지 않게 한다.
   *
   * **다시 읽는 동안에도 참이다.** 이미 읽어 둔 값이 있으면 `loaded`가 그대로 참이므로,
   * 화면을 비울지 말지는 `loading`이 아니라 `loaded`로 판단한다(D-168).
   */
  loading: boolean;
  /**
   * **지금 화면에 얹힌 값이 이 계정으로 서버에서 읽어 온 것인지.**
   *
   * 쓰기 게이트가 이것을 본다 — 요금 정책은 한 벌 전체를 새 행으로 쌓으므로, 읽지 못한 값
   * 위에서 한 항목을 올리면 나머지가 기준값으로 덮인다(아래 `save` 주석).
   *
   * 계정 키를 비교하는 방식은 `progress`·`content` provider와 같다: `loading` 상태 하나로는
   * 로그인한 사람이 바뀐 **첫 렌더**를 덮지 못한다(효과는 렌더 뒤에 돌고, 그 안에서도
   * 마이크로태스크를 한 번 넘긴 뒤에야 상태를 올린다).
   */
  loaded: boolean;
  /**
   * 조회 실패 문장. 성공하면 `null`이다.
   *
   * 없을 때는 실패해도 화면이 `DEFAULT_PRICING`을 **서버 값처럼** 말했다 — 운영자가 좌석 단가를
   * 올려도 조회가 실패한 원장 화면은 옛 기준값으로 `좌석 단가`·`한 달 예상 금액`을 계산했다
   * (A-098이 닫은 것의 나머지 절반). `progress`·`content` provider와 같은 계약이다(M-DB-16).
   */
  error: string | null;
  /** 서버에서 다시 읽는다. 실패 자리의 `다시 불러오기`가 부른다(D-136). */
  reload: () => Promise<void>;
  /**
   * 한 항목을 설정한다. 허용 범위를 벗어나면 잘라 낸다. 새 정책 행이 하나 쌓인다.
   *
   * 쓰기 셋 모두 `loaded`가 아니면 `요금 정책을 아직 읽지 못했어요.`로 거절한다(아래 `save`).
   */
  setValue: (key: keyof PricingPolicy, value: number) => Promise<WriteResult>;
  /** step만큼 올리거나 내린다. 새 정책 행이 하나 쌓인다. 읽기 전에는 거절한다. */
  bump: (key: keyof PricingPolicy, direction: 1 | -1) => Promise<WriteResult>;
  /** 기준값으로 되돌린다. 지난 행을 지우지 않고 기준값 행을 하나 더 쌓는다. 읽기 전에는 거절한다. */
  reset: () => Promise<WriteResult>;
  /** 기준값과 다른 항목이 있는지. 화면에서 '기본값으로' 버튼을 보일 때 쓴다. */
  changed: boolean;
  /**
   * 학부모가 대신 내주기로 표시한 자녀 id(`parent_payment_offers`).
   * 실제 결제·청구는 아직 없다. 화면은 이 사실을 반드시 함께 밝힌다.
   */
  parentPays: string[];
  offerToPay: (childId: string) => Promise<WriteResult>;
  cancelOffer: (childId: string) => Promise<WriteResult>;
}

const PricingContext = createContext<PricingValue | null>(null);

function clamp(key: keyof PricingPolicy, value: number): number {
  const { min, max } = PRICING_LIMITS[key];
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

const NO_OFFERS: string[] = [];

export function PricingProvider({ children }: { children: ReactNode }) {
  const { account, readOnly } = useSession();
  const [policy, setPolicy] = useState<PricingPolicy>(DEFAULT_PRICING);
  const [parentPays, setParentPays] = useState<string[]>(NO_OFFERS);
  const [reading, setReading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /**
   * **성공한 조회의 계정 키.** 실패했을 때는 채우지 않는다 — 이 값이 곧 "서버 값을 들고 있다"는
   * 뜻이라, 실패도 끝으로 세면 쓰기 게이트가 읽지 못한 값 위에서 열린다.
   *
   * 그래도 화면이 `불러오고 있어요`에서 멈추지 않는 이유는 `loading`이 `error`도 함께 보기
   * 때문이다(아래).
   */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  /** 다시 읽기 신호. 값이 바뀌면 아래 효과가 다시 돈다(`content.tsx`와 같은 방식). */
  const [nonce, setNonce] = useState(0);

  /**
   * 지금 정책의 최신 값.
   *
   * 쓰기 함수가 `policy` 상태 대신 이 값을 읽는다 — 증감 버튼을 연달아 누르면 두 번째 호출이
   * 아직 갱신되지 않은 상태를 보고 첫 번째 변경을 덮어쓴다.
   */
  const policyRef = useRef<PricingPolicy>(DEFAULT_PRICING);
  const applyPolicy = useCallback((next: PricingPolicy) => {
    policyRef.current = next;
    setPolicy(next);
  }, []);

  // 옵셔널 체이닝을 의존성에 두면 `react-hooks` 린트가 메모 보존을 보장하지 못한다.
  const viewerId = account?.userId;
  const isAdmin = !!account?.roles.includes('admin');
  const isParent = !!account?.roles.includes('parent');
  // 원장만 좌석 단가를 읽는다(0034의 뷰도 `is_director()`로 좁힌다). 선생님에게는 0행이다.
  const isDirector = account?.academyRole === 'director';

  /*
    로그인한 사람이 바뀌면 다시 읽는다 — 읽을 수 있는 범위가 역할에 따라 다르다.
    로그아웃하면 기준값으로 돌아간다.

    **모든 setState가 비동기 콜백 안에 있다**(`content.tsx`와 같은 이유).
  */
  useEffect(() => {
    let alive = true;
    const key = viewerId ?? null;
    void (async () => {
      if (!viewerId) {
        await Promise.resolve();
        if (!alive) return;
        applyPolicy(DEFAULT_PRICING);
        setParentPays(NO_OFFERS);
        setError(null);
        // 로그아웃도 끝난 상태다 — 이 계정에게는 기준값이 사실이고 더 읽을 것이 없다.
        setLoadedFor(key);
        setReading(false);
        return;
      }
      await Promise.resolve();
      if (!alive) return;
      setReading(true);
      setError(null);
      try {
        const [next, seat, offers] = await Promise.all([
          isAdmin ? repo.loadCurrentPricing() : repo.loadPublicPricing(),
          isDirector && !isAdmin ? repo.loadAcademySeatPricing() : Promise.resolve(null),
          isParent ? repo.loadPaymentOffers(viewerId) : Promise.resolve(NO_OFFERS),
        ]);
        if (!alive) return;
        /*
          운영자는 한 벌 전체를, 원장은 개인 요금 두 개 + 좌석 세 값을, 그 외에는 개인 요금
          두 개만 받는다. 어느 것도 오지 않으면 기준값이다 — 비어 있는 것을 0원으로 그리면
          요금이 없는 서비스처럼 보인다.

          운영자에게는 좌석 조회를 걸지 않는다: `loadCurrentPricing`이 같은 행의 좌석 값을
          이미 담고 있고, 운영자 계정에 `academyRole`이 붙어 있어도 뷰는 0행을 준다.
        */
        applyPolicy({ ...DEFAULT_PRICING, ...next, ...seat });
        setParentPays(offers);
        // 성공한 조회만 여기를 지난다. 이 뒤로 쓰기 게이트가 열린다.
        setLoadedFor(key);
      } catch (e) {
        // 화면이 기준값을 서버 값처럼 말하지 않게 실패를 값으로 내보낸다.
        if (alive) setError(errorMessage(e));
        console.warn('요금 정책을 읽지 못했어요:', errorMessage(e));
      } finally {
        if (alive) setReading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [applyPolicy, isAdmin, isDirector, isParent, nonce, viewerId]);

  /** 서버에서 다시 읽는다. 위 효과를 한 번 더 돌린다. */
  const reload = useCallback(async () => {
    setNonce((n) => n + 1);
  }, []);

  /** 얹힌 값이 이 계정으로 성공한 조회에서 왔는지. 쓰기 게이트와 화면 게이트가 함께 본다. */
  const loaded = loadedFor === (viewerId ?? null);
  /**
   * 조회 중이거나, 아직 한 번도 성공하지 못했으면 읽는 중이다.
   *
   * **실패는 읽는 중이 아니다** — `error`를 함께 보지 않으면 실패한 화면이 영구히
   * `불러오고 있어요`에 머문다(D-136이 실패와 빈 목록을 가른 것과 같은 이유).
   */
  const loading = reading || (!loaded && !error);

  /*
    대리 보기 중에는 아무것도 바꾸지 않는다(D-071). 요금 정책은 총괄관리자만 만지고 대리 대상에
    admin이 없어서 화면으로는 닿지 않지만, **서버는 운영자를 운영자로 본다**(`auth.uid()`가
    운영자라 `is_admin()`이 통과한다) — 그래서 쓰기 경로마다 경계를 다시 본다. `parentPays`는
    **학부모 화면에서** 쓰므로(`app/parent/children.tsx`) 더 직접적이다.

    **읽지 못한 값 위에서도 쓰지 않는다.** 쓰기는 항목 하나가 아니라 정책 **한 벌 전체**를 새 행으로
    쌓으므로(위 이력 구조), 조회가 끝나기 전에 `Stepper`를 한 번 누르면 누른 항목만 오르고
    **나머지 여섯 개는 `DEFAULT_PRICING`으로 되돌아간 행**이 남는다. update 정책이 없어 그 행을
    고칠 길도 없다.

    **감사 로그도 함께 거짓이 된다**: `app/admin/billing.tsx`가 화면에 있는 `policy[knob.key]`를
    `before`로 적으므로, 서버의 실제 이전 값이 아니라 기준값이 기록에 남는다
    (`학원 좌석 단가 ₩12,000 → ₩12,500`이 실제로는 `₩13,500 → ₩12,500`이었을 수 있다).
    접속기록은 자기 자신에 대해 정직해야 한다(D-065).

    **조회가 실패했을 때도 같다** — 가진 값이 서버 값인지 알 수 없다.
  */
  const save = useCallback(
    async (next: PricingPolicy): Promise<WriteResult> => {
      if (readOnly) return { ok: false, error: '대리 보기 중에는 요금 정책을 바꿀 수 없어요.' };
      if (!loaded || error) return { ok: false, error: '요금 정책을 아직 읽지 못했어요.' };
      const res = await repo.savePricingPolicy(next);
      if (res.ok) applyPolicy(next);
      return res;
    },
    [applyPolicy, error, loaded, readOnly],
  );

  const setValue = useCallback<PricingValue['setValue']>(
    (key, value) => save({ ...policyRef.current, [key]: clamp(key, value) }),
    [save],
  );

  const bump = useCallback<PricingValue['bump']>(
    (key, direction) => {
      const cur = policyRef.current;
      return save({
        ...cur,
        [key]: clamp(key, cur[key] + direction * PRICING_LIMITS[key].step),
      });
    },
    [save],
  );

  const reset = useCallback<PricingValue['reset']>(() => save(DEFAULT_PRICING), [save]);

  const offerToPay = useCallback<PricingValue['offerToPay']>(
    async (childId) => {
      if (readOnly) return { ok: false, error: '대리 보기 중에는 바꿀 수 없어요.' };
      const res = await repo.offerPaymentFor(childId);
      if (res.ok) setParentPays((prev) => (prev.includes(childId) ? prev : [...prev, childId]));
      return res;
    },
    [readOnly],
  );

  const cancelOffer = useCallback<PricingValue['cancelOffer']>(
    async (childId) => {
      if (readOnly) return { ok: false, error: '대리 보기 중에는 바꿀 수 없어요.' };
      const res = await repo.cancelPaymentOffer(childId);
      if (res.ok) setParentPays((prev) => prev.filter((id) => id !== childId));
      return res;
    },
    [readOnly],
  );

  const changed = useMemo(
    () =>
      (Object.keys(DEFAULT_PRICING) as (keyof PricingPolicy)[]).some(
        (k) => policy[k] !== DEFAULT_PRICING[k],
      ),
    [policy],
  );

  const value = useMemo(
    () => ({
      policy,
      loading,
      loaded,
      error,
      reload,
      setValue,
      bump,
      reset,
      changed,
      parentPays,
      offerToPay,
      cancelOffer,
    }),
    [
      policy,
      loading,
      loaded,
      error,
      reload,
      setValue,
      bump,
      reset,
      changed,
      parentPays,
      offerToPay,
      cancelOffer,
    ],
  );
  return <PricingContext.Provider value={value}>{children}</PricingContext.Provider>;
}

export function usePricing(): PricingValue {
  const ctx = useContext(PricingContext);
  if (!ctx) throw new Error('usePricing must be used within PricingProvider');
  return ctx;
}

/** 학원 한 곳의 월 청구액. 좌석 수가 기준을 넘으면 규모 할인을 적용한다. */
export function academyMonthly(policy: PricingPolicy, seats: number): number {
  const base = seats * policy.academySeat;
  if (seats < policy.seatDiscountFrom) return base;
  return Math.round(base * (1 - policy.seatDiscountPct / 100));
}

/** 개인 이용권 한 건의 월 환산액. 연 결제 비율만큼 할인을 반영한다. */
export function personalMonthly(policy: PricingPolicy, payer: 'student' | 'parent'): number {
  const list = payer === 'parent' ? policy.parentPaid : policy.studentPaid;
  const annualShare = policy.annualSharePct / 100;
  const annualPrice = list * (1 - policy.annualDiscountPct / 100);
  return Math.round(list * (1 - annualShare) + annualPrice * annualShare);
}

export function won(n: number): string {
  return `₩${Math.round(n).toLocaleString('en-US')}`;
}
