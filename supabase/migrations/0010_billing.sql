-- 이용권 · 요금 정책 · 결제 기록.

/*
  이용권. **개인 이용권과 학원 이용권을 한 학생이 동시에 가질 수 있다**(확정 정책 2절).

  **만료일(`ends_at`)을 두지 않는다** — 결제 주기가 없는데 만료를 두면 만료를 발명하는 일이
  된다(마스터 플랜 5절). 살아 있는지는 `canceled_at`만 본다.
*/
create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind entitlement_kind not null,
  -- 결제 주체. 학생 본인·학부모·학원으로 갈리고 요금이 다르다(`personalMonthly`).
  payer payer_kind not null,
  -- 화면에 그대로 나가는 이름(`개인 월정액`·`학원 이용권` 등).
  label text not null check (length(btrim(label)) > 0),
  -- 구독을 시작한 날. 구독자 수 추이와 신규 구독을 세려면 필요하다.
  started_on date not null default current_date,
  canceled_at timestamptz,
  /*
    살아 있는 구독인지. **`canceled_at`에서 파생한다** — 프로토타입은 `status`와 `canceledAt`이
    따로 있어 같은 계정이 화면마다 `해지`/`이용 중`으로 갈렸다(D-061이 고친 종류).
  */
  status entitlement_status generated always as (
    case when canceled_at is null then 'active'::entitlement_status else 'canceled'::entitlement_status end
  ) stored,
  created_at timestamptz not null default now()
);

create index entitlements_user_idx on public.entitlements (user_id);
create index entitlements_active_idx on public.entitlements (kind, payer) where canceled_at is null;

/*
  요금 정책.

  **행을 쌓아 이력을 남긴다.** 프로토타입은 메모리의 단일 값이라 누가 언제 단가를 바꿨는지
  알 수 없었다. 지금 값은 `effective_from <= now()` 중 가장 최근 행이다(`current_pricing()`).
*/
create table public.pricing_policies (
  id uuid primary key default gen_random_uuid(),
  effective_from timestamptz not null default now(),
  -- 학생 본인이 결제하는 개인 월정액(원/월).
  student_paid int not null check (student_paid between 0 and 200000),
  -- 학부모가 결제하는 개인 월정액(원/월).
  parent_paid int not null check (parent_paid between 0 and 200000),
  -- 학원이 부담하는 재원생 1인 좌석 단가(원/월).
  academy_seat int not null check (academy_seat between 0 and 200000),
  -- 규모 할인율(%)과 시작 좌석 수(명).
  seat_discount_pct int not null check (seat_discount_pct between 0 and 60),
  seat_discount_from int not null check (seat_discount_from between 1 and 500),
  -- 연 결제 할인율(%)과 연 결제를 고른 비율(%). MRR 추정에 쓴다.
  annual_discount_pct int not null check (annual_discount_pct between 0 and 60),
  annual_share_pct int not null check (annual_share_pct between 0 and 100),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index pricing_policies_effective_idx on public.pricing_policies (effective_from desc);

/** 지금 적용되는 요금 정책 한 행. */
create or replace function public.current_pricing()
returns public.pricing_policies
language sql
stable
as $$
  select *
  from public.pricing_policies
  where effective_from <= now()
  order by effective_from desc
  limit 1;
$$;

/*
  결제 기록.

  **스키마만 둔다.** 실제 PG 연동(승인·영수증·갱신·환불·동기화)은 이번 범위 밖이다
  (마스터 플랜 5절). 지금 이 표에 행을 쓰는 코드는 없고, 화면이 결제를 완료된 것처럼
  표현하지 않는다.
*/
create table public.payment_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  entitlement_id uuid references public.entitlements (id) on delete set null,
  pricing_policy_id uuid references public.pricing_policies (id) on delete set null,
  -- 결제 대행사 이름. 아직 정하지 않았다.
  provider text,
  -- 대행사 쪽 거래 번호. 같은 거래를 두 번 기록하지 않게 한다.
  external_id text,
  amount int not null check (amount >= 0),
  status payment_status not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, external_id)
);
