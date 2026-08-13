-- 학원·반·소속·초대.
--
-- **이름 문자열 조인을 FK로 바꾼다.** 프로토타입은 학원이 엔티티가 아니라
-- `AcademyClass.academyName`·`Account.academyName` 문자열에서 파생돼, 계약 좌석·갱신일을 둘
-- 자리가 없었고 학원 이름을 바꾸면 모든 연결이 끊겼다.

create table public.academies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) > 0),
  -- 계약 좌석 수. 좌석 활용률의 분모다. 실제 재원생 수보다 크거나 같다.
  contract_seats int not null default 0 check (contract_seats >= 0),
  -- 갱신 예정일. 갱신 90일 전부터 운영자가 먼저 봐야 한다.
  renewal_date date,
  status academy_status not null default 'active',
  -- 이탈한 날. `status = 'churned'`일 때만 있다.
  churned_at date,
  created_at timestamptz not null default now(),
  constraint academies_churned_at_matches_status
    check ((status = 'churned') = (churned_at is not null))
);

/*
  학원 소속. **학생과 교직원을 한 테이블로 담는다.**

  프로토타입은 학생 소속을 `Account.academyName`으로, 교직원 자리를 `Account.academyRole`로
  나눠 두어 `getTeachersForAcademy`가 원장과 선생을 가르지 못했다(학원 관리 화면의 `원장 N명`이
  2가 되는 결함의 원인).

  **제외는 삭제가 아니다**(D-013) — `left_at`을 채운다. 지난 학원의 배정·제출 기록이 남아 있고,
  그 기록의 출처를 되짚으려면 "그때 이 학원에 있었다"는 사실이 필요하다.
*/
create table public.academy_members (
  academy_id uuid not null references public.academies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  member_role academy_member_role not null,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (academy_id, user_id)
);

create index academy_members_user_idx on public.academy_members (user_id) where left_at is null;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  /*
    반의 학년. **반 이름(`고2 국어 3반`)을 파싱하지 않으려고 둔다** — 원장이 이름을 바꾸는
    순간 파싱이 깨진다. 비워 둘 수 있고, 그러면 학년별 요약에서 `학년 미정`으로 모인다.
  */
  grade smallint check (grade between 1 and 3),
  -- 담당 선생님. 비어 있으면 미배정이다(제외된 선생님의 반도 이 상태가 된다).
  teacher_id uuid references public.profiles (id) on delete set null,
  -- 폐강. **삭제가 아니다**(D-013). 배정·제출 기록은 그대로 남고 목록에서만 내려간다.
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

-- 살아 있는 반끼리만 이름이 겹치지 않게 한다. 폐강한 반의 이름은 다시 쓸 수 있다.
create unique index classes_name_key on public.classes (academy_id, btrim(name))
  where archived_at is null;
create index classes_teacher_idx on public.classes (teacher_id) where archived_at is null;

/*
  반 학생. 제외해도 행은 남는다(`removed_at`) — 그 학생이 그 반에서 낸 제출 기록의 근거다.
*/
create table public.class_students (
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (class_id, student_id)
);

create index class_students_student_idx on public.class_students (student_id)
  where removed_at is null;

/*
  초대 링크. 휴대폰이 아니라 토큰으로 확인한다.

  수락(`accepted_at`)까지 담아 두는 이유: 지금 화면은 "로그인하면 연결됩니다"라고 말하지만
  연결하는 코드가 없다(A-097). 수락 처리를 서버에 둘 자리를 미리 만든다.
*/
create table public.invites (
  token text primary key check (length(btrim(token)) > 0),
  academy_id uuid not null references public.academies (id) on delete cascade,
  invitee_role invite_role not null,
  inviter_id uuid references public.profiles (id) on delete set null,
  expires_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint invites_accepted_together
    check ((accepted_at is null) = (accepted_by is null))
);

-- ── RLS 정책이 쓰는 권한 헬퍼 ────────────────────────────────────────────────
--
-- 전부 `security definer`다. 정책 안에서 이 테이블들을 직접 조회하면 그 조회에도 정책이 걸려
-- 재귀가 된다(`has_role`과 같은 이유).

/** 지금 로그인한 계정이 교직원(원장·선생)으로 속한 학원. 없으면 null. */
create or replace function public.my_academy_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select academy_id
  from public.academy_members
  where user_id = auth.uid()
    and left_at is null
    and member_role in ('director', 'teacher')
  limit 1;
$$;

/** 원장인지. 반·학생 관리는 원장만 한다(마스터 플랜 3절). */
create or replace function public.is_director()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.academy_members
    where user_id = auth.uid() and left_at is null and member_role = 'director'
  );
$$;

/**
 * 지금 로그인한 계정이 볼 수 있는 반.
 * 원장은 학원 전체, 선생님은 담당 반만이다(`getClassesForAccount`와 같은 권한 규칙).
 */
create or replace function public.my_class_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id
  from public.classes c
  where c.archived_at is null
    and c.academy_id = public.my_academy_id()
    and (public.is_director() or c.teacher_id = auth.uid());
$$;

/**
 * 학원 쪽에서 이 학생을 볼 수 있는지.
 * 원장은 우리 학원 학생 전체(반이 없는 학생도 반에 넣어야 하므로), 선생님은 담당 반 학생만.
 */
create or replace function public.can_see_student(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when public.my_academy_id() is null then false
    when public.is_director() then exists (
      select 1 from public.academy_members m
      where m.user_id = target
        and m.academy_id = public.my_academy_id()
        and m.left_at is null
        and m.member_role = 'student'
    )
    else exists (
      select 1
      from public.class_students cs
      join public.classes c on c.id = cs.class_id
      where cs.student_id = target
        and cs.removed_at is null
        and c.archived_at is null
        and c.teacher_id = auth.uid()
    )
  end;
$$;
