-- 계정: 프로필과 역할.
--
-- `profiles.id`가 확정 정책 2절의 **영구 `user_id`**다. 학습 기록·구독·소속·자녀 연결은 전부
-- 이 값에 붙는다. 전화번호는 인증·복구·초대 확인·알림에만 쓰고 식별자로 쓰지 않는다.

create table public.profiles (
  -- Supabase Auth 사용자와 1:1. 계정을 지우면 프로필도 함께 사라진다.
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  /*
    스코디 아이디. 가입 시 정한다.
    **대소문자를 구분하지 않는다** — `src/data/index.ts`의 `isScodyIdTaken`·`authenticate`가
    `toLowerCase()`로 비교했다. 그 규칙을 unique 인덱스로 옮긴다(아래).
  */
  scody_id text not null check (length(btrim(scody_id)) > 0),
  /*
    휴대폰 번호. 사용자가 적은 형태를 그대로 두고, 비교는 숫자만 남긴 파생 컬럼으로 한다 —
    하이픈·공백 차이로 같은 번호가 두 계정에 들어가지 않게 한다(`normalizePhone`과 같은 규칙).
  */
  phone text,
  phone_digits text generated always as (
    nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '')
  ) stored,
  /*
    고객지원 코드(`XXX-XXX`).

    카카오 로그인이 주 수단이면 서비스가 항상 갖는 값은 회원번호뿐이고 사용자는 그것을 알
    방법이 없다. 그래서 사용자가 말할 수 있는 짧은 코드를 둔다.
    **이 코드로는 로그인할 수 없다** — 화면에서 그 사실을 밝힌다.

    혼동하는 글자(I·L·O·U·0·1)를 뺀 알파벳·숫자 6자. 프로토타입에서는 `userId` 해시로
    파생했지만 uuid로는 뜻이 없으므로 **만들 때 정해 저장한다**(`support_code_new()`).
  */
  support_code text not null check (support_code ~ '^[2-9A-HJ-KMNP-TV-Z]{3}-[2-9A-HJ-KMNP-TV-Z]{3}$'),
  -- 학년. 학생에게만 뜻이 있다. 동명이인을 가르는 근거 중 하나다.
  grade smallint check (grade between 1 and 3),
  kakao_linked boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index profiles_scody_id_key on public.profiles (lower(btrim(scody_id)));
create unique index profiles_phone_digits_key on public.profiles (phone_digits)
  where phone_digits is not null;
create unique index profiles_support_code_key on public.profiles (support_code);

comment on table public.profiles is '서비스 내부 프로필. id가 영구 user_id다.';

/*
  고객지원 코드 생성기.

  혼동하는 글자를 뺀 30자 알파벳에서 6자를 뽑는다. 충돌하면 호출부가 다시 부른다
  (30^6 ≈ 7.3억 가지라 실제로는 거의 일어나지 않는다).
*/
create or replace function public.support_code_new()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  code text := '';
  i int;
begin
  for i in 1 .. 6 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return substr(code, 1, 3) || '-' || substr(code, 4, 3);
end;
$$;

-- 역할. 한 계정 다역할이라 별 테이블로 둔다(`Account.roles[]` 대체).
create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role app_role not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

/*
  RLS 정책이 쓰는 역할 검사.

  `security definer`인 이유: 정책 안에서 `user_roles`를 직접 조회하면 그 조회에도 정책이
  걸려 재귀가 된다. `search_path`를 고정하는 것은 `security definer` 함수의 기본 방어다.
*/
create or replace function public.has_role(target app_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = target
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role('admin');
$$;
