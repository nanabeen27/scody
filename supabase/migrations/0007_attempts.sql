-- 풀이 기록: 배정 대상 · 시도 · 문항별 정오 · 제출 전 자동 저장.
--
-- ## 여기서 통합한 중복
--
-- 프로토타입은 같은 사실을 두 곳에 담고 있었다. `Submission`이 `accuracy`·`timeSec`·
-- `submittedAt`·`wrongQIds`를 들고, `Attempt`가 같은 값을 `perQuestion`까지 담아 다시 들었다.
-- 두 곳에 있으면 갈린다 — 이 레포는 그 종류의 결함을 D-048·D-052·D-060에서 이미 세 번 고쳤다.
--
-- 이제 **`attempts`가 풀이의 유일한 원천**이고, `assignment_targets`는 "누구에게 배정됐고
-- 어느 풀이로 냈는지"만 가리킨다. 화면이 쓰던 `Submission` 형태는 `v_assignment_submissions`
-- 뷰가 그대로 준다.
--
-- ## 학습 대상을 가리키는 방법
--
-- 프로토타입의 `itemId`는 두 종류였다 — 개인 학습은 `li_${contentId}`, 학원 학습은 배정 id.
-- 문자열 접두로 갈라 보는 코드가 화면·오답노트·리포트에 흩어져 있었다.
-- 여기서는 **`(source, assignment_id, content_set_id)` 한 조합**으로 통일한다:
--   개인 학습 → source='personal', assignment_id is null
--   학원 학습 → source='academy',  assignment_id 필수
-- 유니크 키는 `coalesce(assignment_id, content_set_id)`로 잡는다.

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  content_set_id uuid not null references public.content_sets (id) on delete restrict,
  source learning_source not null,
  assignment_id uuid references public.assignments (id) on delete cascade,
  /*
    회차. 재풀이하면 2, 3…으로 쌓인다.

    **덮어쓰지 않는 이유**(A-036): 학부모가 재풀이를 요청하는 목적은 변화를 보는 것인데,
    프로토타입은 `itemId`로 교체해서 확인하려던 변화 자체가 사라졌다. 화면은
    `v_latest_attempts`로 최신 회차만 읽어 동작이 같고, 이전 회차는 남는다.
  */
  attempt_no int not null default 1 check (attempt_no >= 1),
  -- 푸는 데 걸린 시간(초). 세트 전체 하나다(문항별 시각은 A-040).
  time_sec int not null default 0 check (time_sec >= 0),
  -- 푼 날. **마감일과 다른 값이다**(D-048) — 마감일을 제출일 자리에 넣지 않는다.
  submitted_on date not null,
  correct_count int not null check (correct_count >= 0),
  total_count int not null check (total_count > 0),
  -- 정답률(%). 파생값이라 저장하지 않고 계산한다 — 두 값이 어긋날 자리를 만들지 않는다.
  accuracy int generated always as (
    round(correct_count::numeric * 100 / nullif(total_count, 0))::int
  ) stored,
  created_at timestamptz not null default now(),
  constraint attempts_assignment_matches_source
    check ((source = 'academy') = (assignment_id is not null)),
  constraint attempts_correct_within_total check (correct_count <= total_count)
);

create unique index attempts_target_no_key on public.attempts (
  student_id, source, coalesce(assignment_id, content_set_id), attempt_no
);
create index attempts_student_date_idx on public.attempts (student_id, submitted_on desc);
create index attempts_content_idx on public.attempts (content_set_id);

/*
  배정 대상 한 행 = "이 학생에게 배정됐다"는 사실.

  **`submitted` 컬럼을 두지 않는다** — `attempt_id is not null`이 그 답이다. 따로 두면
  제출을 지웠을 때 둘이 어긋난다.
*/
create table public.assignment_targets (
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  -- 낸 풀이. 아직 안 냈으면 null. 재풀이하면 최신 회차를 가리킨다.
  attempt_id uuid references public.attempts (id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (assignment_id, student_id)
);

create index assignment_targets_student_idx on public.assignment_targets (student_id);
create index assignment_targets_pending_idx on public.assignment_targets (assignment_id)
  where attempt_id is null;

/*
  문항별 정오.

  **`prompt`·`choices`·`answer_index`를 저장하지 않는다** — `questions`와 join한다.
  프로토타입의 `PerQuestion`은 이 셋을 전부 복사해 들고 있었는데, 세트 하나에 25문항이면
  풀이 한 건마다 선지 100개가 복제된다.

  대신 **`is_correct`는 저장한다.** 정답 자리(`questions.answer_index`)와 비교해 그때그때
  계산하면 문항을 고친 순간 과거 채점이 조용히 바뀐다. 채점은 푼 시점의 사실이다.
*/
create table public.attempt_answers (
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  -- 고른 선지. 안 고르고 넘긴 문항은 null이고 그것은 오답이다.
  picked_index smallint,
  is_correct boolean not null,
  primary key (attempt_id, question_id)
);

create index attempt_answers_question_idx on public.attempt_answers (question_id);

/*
  제출 전 자동 저장 답안.

  프로토타입은 `session.answers`(메모리)에 있어 새로고침하면 사라졌다(A-025와 같은 뿌리).
  이 표가 있어서 학습 목록이 `이어서 하기`를 말할 수 있고, 그 말이 새로고침 뒤에도 사실이다.

  대상 식별은 위 `attempts`와 **같은 조합**을 쓴다.
*/
create table public.answer_drafts (
  student_id uuid not null references public.profiles (id) on delete cascade,
  source learning_source not null,
  assignment_id uuid references public.assignments (id) on delete cascade,
  content_set_id uuid not null references public.content_sets (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  picked_index smallint not null check (picked_index >= 0),
  updated_at timestamptz not null default now(),
  constraint answer_drafts_assignment_matches_source
    check ((source = 'academy') = (assignment_id is not null))
);

create unique index answer_drafts_key on public.answer_drafts (
  student_id, question_id, source, coalesce(assignment_id, content_set_id)
);
create index answer_drafts_target_idx on public.answer_drafts (
  student_id, source, coalesce(assignment_id, content_set_id)
);

/**
 * 이 콘텐츠를 읽을 수 있는지.
 *
 * - 학생에게 공개된 세트: **로그인한** 사용자 누구나
 * - 우리 학원이 등록한 세트: 그 학원 교직원
 * - 나에게 배정된 세트: **공개 여부와 무관하게** 열린다 — 배정받은 학생은 풀어야 한다
 * - 운영자: 전부
 *
 * **익명에게는 아무것도 열지 않는다.** 지문과 문항은 유료 콘텐츠다 — 로그인 없이 읽히면
 * 그대로 무료 공개가 된다(실측: 이 조건이 없을 때 익명이 공개 세트를 전부 읽었다).
 *
 * 개인 이용권까지 요구하지는 않는다. 이용권 없는 계정에 무엇을 보여 줄지는 화면의 결정이고
 * (마스터 플랜 A-096), 정책에 넣으면 그 결정을 DB가 대신하게 된다.
 *
 * `0005_content.sql`이 아니라 여기 있는 이유: `assignment_targets`를 봐야 하고,
 * `language sql` 함수는 만들 때 본문을 검사한다.
 */
create or replace function public.can_read_content(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.content_sets s
    where s.id = target
      and (
        s.publish_to_students
        or public.is_admin()
        or (s.owner_academy_id is not null and s.owner_academy_id = public.my_academy_id())
        or exists (
          select 1
          from public.assignment_targets t
          join public.assignments a on a.id = t.assignment_id
          where t.student_id = auth.uid() and a.content_set_id = s.id
        )
      )
  );
$$;

/**
 * 이 배정이 내가 볼 수 있는 반의 것인지.
 * 원장은 학원 전체 반, 선생님은 담당 반만이다(`my_class_ids`).
 */
create or replace function public.can_see_assignment(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.assignments a
    where a.id = target and a.class_id in (select public.my_class_ids())
  );
$$;
