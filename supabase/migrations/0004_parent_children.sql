-- 학부모–자녀 연결.
--
-- 자녀의 학습 기록은 **학생 계정에 남는다**. 이 표는 누가 그것을 볼 수 있는지만 정한다.
-- 프로토타입의 `PARENT_CHILDREN` 맵을 대체하고, `progress.tsx`의 `canRead`가 클라이언트에서만
-- 하던 판정을 서버 정책의 근거로 올린다.

create table public.parent_children (
  parent_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  -- 학원이 학부모를 초대하면 자녀 관계를 확인하고 연결을 승인한다(마스터 플랜 3절).
  status link_status not null default 'pending',
  linked_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (parent_id, student_id),
  constraint parent_children_not_self check (parent_id <> student_id),
  constraint parent_children_linked_at_matches_status
    check ((status = 'linked') = (linked_at is not null))
);

create index parent_children_student_idx on public.parent_children (student_id)
  where status = 'linked';

/**
 * 이 학생이 내 자녀인지(승인된 연결만).
 *
 * 학부모의 읽기 정책이 전부 이 함수를 쓴다. `pending` 연결에는 아무것도 열지 않는다 —
 * 승인 전에 남의 자녀 기록이 보이면 연결 확인 절차 자체가 뜻을 잃는다.
 */
create or replace function public.is_my_child(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.parent_children
    where parent_id = auth.uid() and student_id = target and status = 'linked'
  );
$$;

/**
 * 이 학생의 기록을 읽을 수 있는지 — **본인 또는 연결된 학부모**.
 *
 * `progress.tsx`의 `canRead`와 같은 판정이다. 학원은 여기 없다 — 학원은 개인 학습 상세를
 * 열람할 수 없고(확정 정책 2절), 학원이 보는 것은 배정 학습 전용 뷰뿐이다.
 */
create or replace function public.can_read_student(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select target = auth.uid() or public.is_my_child(target);
$$;

/*
  ── 정책 재귀를 끊는 두 함수 ────────────────────────────────────────────────

  `classes`의 정책은 "내가(또는 내 자녀가) 이 반에 있나"를 물어야 하고, `class_students`의
  정책은 "이 반이 우리 학원 반인가"를 물어야 한다. 두 정책이 서로의 표를 직접 조회하면
  Postgres가 `infinite recursion detected in policy for relation`으로 거부한다.

  `security definer`로 감싸면 함수 안의 조회에는 정책이 걸리지 않아 고리가 끊긴다.
  대신 함수가 무엇을 여는지 여기서 좁게 못박는다 — 우회로가 되지 않게.
*/

/** 이 반이 속한 학원. 반 정책과 배정 권한이 학원 비교에 쓴다. */
create or replace function public.class_academy_id(target uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select academy_id from public.classes where id = target;
$$;

/** 나 또는 내 자녀가 이 반에 있는지(제외되지 않은 상태). */
create or replace function public.in_class(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.class_students cs
    where cs.class_id = target
      and cs.removed_at is null
      and (cs.student_id = auth.uid() or public.is_my_child(cs.student_id))
  );
$$;
