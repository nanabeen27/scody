import { errorMessage, supabase } from '@/lib/supabase';

/**
 * 요금 정책과 학부모의 `대신 내주기`.
 *
 * ## 요금 정책은 쌓기만 한다
 *
 * `pricing_policies`는 **행을 쌓아 이력을 남긴다**(`supabase/migrations/0010_billing.sql`).
 * 지금 값은 `current_pricing()`이 주는 한 행이고, 바꾸면 새 행이 하나 생긴다. update 정책이
 * 없으므로 지난 값을 고칠 길이 없다.
 *
 * ## 읽는 사람이 셋으로 갈린다
 *
 * `pricing_policies_select`가 `is_admin()`이다(0024). 좌석 단가·규모 할인·연 결제 비율은 B2B
 * 계약 조건이라 학생·학부모·선생님에게 열지 않는다. 그 화면들이 실제로 필요한 것은 개인 요금
 * 두 개뿐이고, 그것만 `v_public_pricing` 뷰가 준다.
 *
 * **원장은 좌석 세 값을 읽는다**(`v_academy_seat_pricing`, 0034 · D-148). 자기 학원의 청구액을
 * 확인할 길이 필요한데, 0024 뒤로 그 길이 없어서 화면이 코드 상수를 서버 값처럼 말했다(A-098).
 */

/** 요금 정책 한 벌. 화면이 쓰는 형태. */
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

/** 개인 요금 두 개만. 학생·학부모 화면이 보는 범위다(`v_public_pricing`). */
export interface PublicPricing {
  studentPaid: number;
  parentPaid: number;
}

/**
 * 좌석 관련 세 값만. **원장**이 보는 범위다(`v_academy_seat_pricing`, 0034).
 * 개인 요금·연 결제 비율은 들어 있지 않다 — 학원의 청구액과 무관하다.
 */
export interface AcademySeatPricing {
  academySeat: number;
  seatDiscountPct: number;
  seatDiscountFrom: number;
}

export interface WriteResult {
  ok: boolean;
  error?: string;
}

function fail(error: unknown): WriteResult {
  return { ok: false, error: errorMessage(error) };
}

/**
 * 지금 적용되는 요금 정책. 운영자만 읽을 수 있고, 아직 한 행도 없으면 `null`이다.
 *
 * `current_pricing()`을 쓴다 — `effective_from <= now()` 중 가장 최근 행을 고르는 규칙이
 * 서버에 한 벌만 있어야 화면과 정산이 다른 행을 보지 않는다.
 */
export async function loadCurrentPricing(): Promise<PricingPolicy | null> {
  const { data, error } = await supabase().rpc('current_pricing');
  if (error) throw new Error(errorMessage(error));
  if (!data) return null;
  return {
    studentPaid: data.student_paid,
    parentPaid: data.parent_paid,
    academySeat: data.academy_seat,
    seatDiscountPct: data.seat_discount_pct,
    seatDiscountFrom: data.seat_discount_from,
    annualDiscountPct: data.annual_discount_pct,
    annualSharePct: data.annual_share_pct,
  };
}

/**
 * 학생·학부모 화면이 쓰는 개인 요금.
 *
 * 뷰는 이미 한 행으로 좁혀져 있다(`limit 1`). 한 행도 없으면 `null`이다.
 */
export async function loadPublicPricing(): Promise<PublicPricing | null> {
  const { data, error } = await supabase()
    .from('v_public_pricing')
    .select('student_paid, parent_paid')
    .maybeSingle();
  if (error) throw new Error(errorMessage(error));
  if (!data || data.student_paid === null || data.parent_paid === null) return null;
  return { studentPaid: data.student_paid, parentPaid: data.parent_paid };
}

/**
 * 원장이 보는 좌석 단가(0034의 `v_academy_seat_pricing`).
 *
 * 뷰가 `is_director()`로 좁히므로 다른 역할에는 0행이 나가고 여기서 `null`이 된다. 한 행도 없을
 * 때도 `null`이다 — 그때는 부르는 쪽이 기준값을 쓴다(0원으로 그리면 무료처럼 보인다).
 */
export async function loadAcademySeatPricing(): Promise<AcademySeatPricing | null> {
  const { data, error } = await supabase()
    .from('v_academy_seat_pricing')
    .select('academy_seat, seat_discount_pct, seat_discount_from')
    .maybeSingle();
  if (error) throw new Error(errorMessage(error));
  if (
    !data ||
    data.academy_seat === null ||
    data.seat_discount_pct === null ||
    data.seat_discount_from === null
  ) {
    return null;
  }
  return {
    academySeat: data.academy_seat,
    seatDiscountPct: data.seat_discount_pct,
    seatDiscountFrom: data.seat_discount_from,
  };
}

/**
 * 새 요금 정책을 쌓는다. 지난 행은 그대로 남는다.
 *
 * `effective_from`은 서버 기본값(`now()`)을 쓴다 — 미래 날짜 예약은 화면에 없고, 클라이언트
 * 시계로 적으면 방금 넣은 행이 `current_pricing()`에서 빠질 수 있다.
 */
export async function savePricingPolicy(next: PricingPolicy): Promise<WriteResult> {
  const uid = (await supabase().auth.getUser()).data.user?.id;
  if (!uid) return { ok: false, error: '다시 로그인해 주세요.' };
  const { error } = await supabase()
    .from('pricing_policies')
    .insert({
      student_paid: next.studentPaid,
      parent_paid: next.parentPaid,
      academy_seat: next.academySeat,
      seat_discount_pct: next.seatDiscountPct,
      seat_discount_from: next.seatDiscountFrom,
      annual_discount_pct: next.annualDiscountPct,
      annual_share_pct: next.annualSharePct,
      updated_by: uid,
    });
  return error ? fail(error) : { ok: true };
}

// ── 대신 내주기 ──────────────────────────────────────────────────────────────

/**
 * 그 학부모가 대신 내주기로 표시한 자녀 id. 취소한 표시는 빠진다.
 *
 * **`auth.uid()`가 아니라 화면이 보고 있는 사람으로 좁힌다.** 대리 보기 중에는 둘이 다르고
 * (`auth.uid()`는 운영자), 그때 그려야 하는 것은 대상 학부모의 표시다. 운영자는 `is_admin()`
 * 분기로 그 행을 읽을 수 있다(`parent_payment_offers_select`).
 */
export async function loadPaymentOffers(parentId: string): Promise<string[]> {
  const { data, error } = await supabase()
    .from('parent_payment_offers')
    .select('child_id')
    .eq('parent_id', parentId)
    .is('canceled_at', null);
  if (error) throw new Error(errorMessage(error));
  return (data ?? []).map((r) => r.child_id);
}

/**
 * 대신 내주기로 표시한다.
 *
 * 취소했다가 다시 표시하는 길이 있어서 upsert다 — 기본키가 `(parent_id, child_id)`라 같은
 * 자녀에 두 행이 생기지 않고, `canceled_at`을 비워 되살린다.
 */
export async function offerPaymentFor(childId: string): Promise<WriteResult> {
  const uid = (await supabase().auth.getUser()).data.user?.id;
  if (!uid) return { ok: false, error: '다시 로그인해 주세요.' };
  const { error } = await supabase()
    .from('parent_payment_offers')
    .upsert(
      { parent_id: uid, child_id: childId, canceled_at: null },
      { onConflict: 'parent_id,child_id' },
    );
  return error ? fail(error) : { ok: true };
}

/** 표시를 취소한다. 행은 남고 `canceled_at`이 채워진다 — 취소도 기록이다. */
export async function cancelPaymentOffer(childId: string): Promise<WriteResult> {
  const uid = (await supabase().auth.getUser()).data.user?.id;
  if (!uid) return { ok: false, error: '다시 로그인해 주세요.' };
  const { error } = await supabase()
    .from('parent_payment_offers')
    .update({ canceled_at: new Date().toISOString() })
    .eq('parent_id', uid)
    .eq('child_id', childId)
    .is('canceled_at', null);
  return error ? fail(error) : { ok: true };
}
