-- 학부모 기능: 칭찬 · 주간 요약.

/*
  학부모가 자녀에게 보낸 칭찬. 자녀 홈 맨 위에 한 줄로 뜨고 자녀가 닫을 수 있다.

  종류를 **자녀가 실제로 한 일**로 좁혀 둔 이유: 근거 없는 칭찬을 만들지 않는다.
*/
create table public.praises (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.profiles (id) on delete cascade,
  from_user_id uuid not null references public.profiles (id) on delete cascade,
  kind praise_kind not null,
  -- 보낸 날. 하루에 같은 종류를 두 번 보내지 않는다(아래 유니크).
  sent_on date not null default current_date,
  -- 자녀가 확인해 닫은 시각.
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (child_id, from_user_id, kind, sent_on)
);

create index praises_child_open_idx on public.praises (child_id) where seen_at is null;

/*
  자녀 주간 요약.

  **그 주 내내 같은 요약이 보여야 한다** — 매번 다시 만들면 볼 때마다 문장이 바뀌어 학부모가
  무엇을 믿어야 할지 알 수 없다. 그래서 자녀×주 하나에 한 행이다.

  `by_ai`는 AI가 쓴 글인지. **저장 시점의 사실**이라 나중에 키 상태가 바뀌어도 흔들리지 않는다.
*/
create table public.week_summaries (
  child_id uuid not null references public.profiles (id) on delete cascade,
  -- 그 주 월요일. 주 단위 집계와 같은 키를 쓴다(`report.ts`의 `weekOf`).
  week_monday date not null,
  text text not null check (length(btrim(text)) > 0),
  by_ai boolean not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (child_id, week_monday)
);

/*
  학부모가 대신 내주기로 표시한 자녀.

  **실제 결제·청구는 연결돼 있지 않다**(마스터 플랜 5절) — 지금은 뜻만 남기고 화면에서 그
  사실을 밝힌다. `canceled_at`으로 취소를 남긴다.
*/
create table public.parent_payment_offers (
  parent_id uuid not null references public.profiles (id) on delete cascade,
  child_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  canceled_at timestamptz,
  primary key (parent_id, child_id)
);
