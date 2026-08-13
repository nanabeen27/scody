-- 학원 배정.
--
-- 선생님이 반에 학습을 배정하고, 학생은 그 문항을 푼다. 배정 대상 행
-- (`assignment_targets`)은 풀이 테이블과 함께 `0007_attempts.sql`에서 만든다 —
-- 그 행이 풀이를 가리키기 때문이다.

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  /*
    배정된 콘텐츠. **필수다** — 프로토타입은 `contentId`를 optional로 두어 화면이 매번
    `a.contentId!`로 단정하고 있었고, 콘텐츠 없는 배정은 학생이 풀 수 없는 죽은 행이다.
  */
  content_set_id uuid not null references public.content_sets (id) on delete restrict,
  /*
    과제 이름. **콘텐츠 제목과 다르다** — 학원은 `4월 3주 문법 점검`처럼 자기 방식으로 붙인다.
  */
  title text not null check (length(btrim(title)) > 0),
  due_date date,
  /*
    처음 배정할 때의 마감일. 재배정으로 `due_date`를 미루면 여기에 원래 값이 남는다.

    학부모 월간 리포트는 **이 값으로** 그 달 배정을 판정한다(D-056). 마감일을 미룰 때마다
    이미 낸 학생의 지난달 기록이 다른 달로 옮겨 가면 확정된 리포트가 뒤바뀐다.
  */
  original_due_date date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index assignments_class_idx on public.assignments (class_id, due_date);
create index assignments_content_idx on public.assignments (content_set_id);

/*
  같은 반에 같은 콘텐츠를 두 번 배정하지 않는다(D-046).

  학생 화면에 같은 과제가 두 줄로 뜨면 어느 쪽을 풀어야 제출되는지 알 수 없다. 마감일만
  미루는 쪽이 맞다. **미제출이 남아 있는 배정에만** 걸어야 하는 규칙이지만 부분 유니크
  인덱스로는 다른 테이블(`assignment_targets`)을 볼 수 없어서, 그 판정은
  `rpc_add_assignment`가 한다. 여기서는 완전 중복만 막는다.
*/
create unique index assignments_no_same_due_idx
  on public.assignments (class_id, content_set_id, coalesce(due_date, 'infinity'::date));
