import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * 요금 정책. 총괄관리자가 월정액 단가와 비율을 정한다.
 *
 * 프로토타입 경계: 값은 메모리에만 있고 실제 결제·정산과 연결되지 않는다.
 * 실제 결제를 붙일 때 이 provider를 서버 요금제 API로 교체한다(마스터 플랜 5절).
 */

export interface PricingPolicy {
  /** 학생 본인이 결제하는 개인 월정액(원/월). */
  studentPaid: number;
  /** 학부모가 결제하는 개인 월정액(원/월). */
  parentPaid: number;
  /** 학원이 부담하는 재원생 1인 좌석 단가(원/월). */
  academySeat: number;
  /** 좌석 수가 많은 학원에 적용하는 규모 할인율(%). `seatDiscountFrom`명 이상부터. */
  seatDiscountPct: number;
  /** 규모 할인이 시작되는 좌석 수(명). */
  seatDiscountFrom: number;
  /** 연 결제 선택 시 할인율(%). */
  annualDiscountPct: number;
  /** 연 결제를 고른 비율(%). MRR 추정에 쓴다. */
  annualSharePct: number;
}

export const DEFAULT_PRICING: PricingPolicy = {
  studentPaid: 19000,
  parentPaid: 29000,
  academySeat: 12000,
  seatDiscountPct: 15,
  seatDiscountFrom: 50,
  annualDiscountPct: 20,
  annualSharePct: 30,
};

/** 정책상 허용 범위. 화면의 증감 버튼과 검증이 같은 값을 쓴다. */
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
  /** 한 항목을 설정한다. 허용 범위를 벗어나면 잘라 낸다. */
  setValue: (key: keyof PricingPolicy, value: number) => void;
  /** step만큼 올리거나 내린다. */
  bump: (key: keyof PricingPolicy, direction: 1 | -1) => void;
  reset: () => void;
  /** 기본값과 다른 항목이 있는지. 화면에서 '기본값으로' 버튼을 보일 때 쓴다. */
  changed: boolean;
}

const PricingContext = createContext<PricingValue | null>(null);

function clamp(key: keyof PricingPolicy, value: number): number {
  const { min, max } = PRICING_LIMITS[key];
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function PricingProvider({ children }: { children: ReactNode }) {
  const [policy, setPolicy] = useState<PricingPolicy>(DEFAULT_PRICING);

  const setValue = useCallback((key: keyof PricingPolicy, value: number) => {
    setPolicy((p) => ({ ...p, [key]: clamp(key, value) }));
  }, []);

  const bump = useCallback((key: keyof PricingPolicy, direction: 1 | -1) => {
    setPolicy((p) => ({
      ...p,
      [key]: clamp(key, p[key] + direction * PRICING_LIMITS[key].step),
    }));
  }, []);

  const reset = useCallback(() => setPolicy(DEFAULT_PRICING), []);

  const changed = useMemo(
    () =>
      (Object.keys(DEFAULT_PRICING) as (keyof PricingPolicy)[]).some(
        (k) => policy[k] !== DEFAULT_PRICING[k],
      ),
    [policy],
  );

  const value = useMemo(
    () => ({ policy, setValue, bump, reset, changed }),
    [policy, setValue, bump, reset, changed],
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
