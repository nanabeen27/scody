-- 학원이 자기 좌석 단가를 서버에서 읽는 창구 (M9-13 ① → D-148)
--
-- 0024가 `pricing_policies_select`를 `is_admin()`으로 좁힌 판단은 옳다 — 학생·선생님이 좌석 단가·
-- 규모 할인·연 결제 비율 같은 B2B 계약 조건을 읽을 이유가 없다. 그런데 그 뒤로 **원장도** 자기
-- 좌석 단가를 읽을 수 없게 됐고, 학원 관리 화면(`app/academy/manage.tsx`)은 코드 상수
-- (`DEFAULT_PRICING`)를 서버 값처럼 말했다 — 운영자가 단가를 바꾸면 학원 화면만 옛 값을
-- 말한다(A-098).
--
-- ## 내보내는 것과 내보내지 않는 것
--
-- 주는 것: `academy_seat` · `seat_discount_pct` · `seat_discount_from` · `effective_from`.
-- 화면의 세 줄(`좌석 단가` · `규모 할인` · `한 달 예상 금액`)이 그 값으로 계산된다.
--
-- 주지 않는 것:
--   * `student_paid` · `parent_paid` — 개인 요금은 이미 `v_public_pricing`이 준다.
--   * `annual_discount_pct` · `annual_share_pct` — 운영자의 MRR 추정 입력이고 학원의 청구액과
--     무관하다(`src/features/revenue.ts`).
--   * `updated_by` — 누가 단가를 정했는지는 학원이 알 일이 아니다.
--
-- ## 왜 학원별 컬럼을 두지 않았나
--
-- 요금 정책은 지금 **전 학원 공통 한 행**이다. 그래서 "다른 학원의 계약 조건"이라는 것이 아직
-- 없고, 이 뷰는 학원마다 다른 값을 만들지 않는다. 학원별 계약 단가(M9-13 ②)는 확정 정책 2절의
-- 결제 주체·요금제 구조를 함께 손대는 일이라 하지 않았다.
--
-- ## 왜 뷰가 직접 조건을 거나
--
-- 밑 테이블 정책이 운영자만 허용하므로 `security_invoker = on`으로는 원장에게 0행이 나간다.
-- 그래서 0012의 두 번째 종류(뷰 소유자 권한 + 뷰가 직접 조건)로 두고, 조건을 `is_director()`
-- 하나로 명시한다 — 선생님·학생·학부모·익명에게는 0행이다.

create or replace view public.v_academy_seat_pricing as
  select
    p.academy_seat,
    p.seat_discount_pct,
    p.seat_discount_from,
    p.effective_from
  from public.pricing_policies p
  where p.effective_from <= now()
    and public.is_director()
  order by p.effective_from desc
  limit 1;

grant select on public.v_academy_seat_pricing to authenticated;

-- 뷰로 들어오는 쓰기를 막는다(0026이 `v_public_pricing`에 한 것과 같은 이유 — 단순 뷰는
-- 기본적으로 갱신 가능해서, 뷰에 insert 하면 밑 표에 행이 쌓인다).
revoke insert, update, delete, truncate on public.v_academy_seat_pricing from anon, authenticated;
