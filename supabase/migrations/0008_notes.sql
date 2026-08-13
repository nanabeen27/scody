-- 오답노트 · 담아 둔 학습 · 재풀이 요청.

/*
  오답노트.

  ## A-085(P1)을 스키마에서 닫는다

  프로토타입은 노트를 **문항 id 하나로만** 식별했다(`wn_${qId}`). 그런데 같은 콘텐츠가 개인
  학습으로 공개되면서 학원 배정에도 쓰이기 때문에(`ct_read_1`·`ct_gram_1`이 실제로 그렇다),
  개인 학습 결과 화면에서 담기 토글을 끄면 **학원 배정 오답 노트와 메모가 함께 지워졌다** —
  선생님이 보고 있던 값이다(D-054).
  아래 유니크 키가 개인 학습과 학원 과제의 노트를 처음부터 다른 행으로 만든다.
  같은 문항이 목록에 두 줄로 보이는 것이 맞다 — 다른 학습에서 틀린 것이다.
*/
create table public.wrong_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  -- 문항이 속한 콘텐츠. 오답노트에서 지문을 함께 보여주려면 필요하다.
  content_set_id uuid not null references public.content_sets (id) on delete cascade,
  source learning_source not null,
  -- 학원 배정에서 나온 오답이면 그 배정. 학원 열람 경계가 이 값으로 출처를 되짚는다.
  assignment_id uuid references public.assignments (id) on delete cascade,
  -- 학생이 고른 답. **학원에는 열지 않는다**(`v_academy_visible_notes`에서 컬럼째로 뺀다).
  picked_index smallint,
  -- AI와 정리한 내 메모. 선생님은 배정 학습의 이 값까지 본다(D-054).
  dig text,
  -- 집중 복습으로 따로 모아 보려고 별표한 문항. **학원에는 열지 않는다**(D-054).
  starred boolean not null default false,
  -- 카드 복습에서 이해 완료 표시. **학원에는 열지 않는다**(D-054).
  mastered boolean not null default false,
  created_at timestamptz not null default now(),
  constraint wrong_notes_assignment_matches_source
    check ((source = 'academy') = (assignment_id is not null))
);

create unique index wrong_notes_key on public.wrong_notes (
  student_id, question_id, source, coalesce(assignment_id, content_set_id)
);
create index wrong_notes_student_idx on public.wrong_notes (student_id, created_at desc);
create index wrong_notes_assignment_idx on public.wrong_notes (assignment_id)
  where source = 'academy';

/*
  담아 둔 학습. **배열 순서가 곧 풀 순서다.**

  프로토타입의 `QueueEntry`는 `itemId`와 `contentId`를 함께 들고 있었는데, 개인 학습의
  `itemId`가 `li_${contentId}`로 파생되는 값이라 같은 사실이 두 컬럼이었다. 하나로 줄인다.

  **개인 학습만 담긴다**(D-012) — 학원 과제는 배정으로만 전달돼야 하므로 학생이 스스로 담을
  수 있으면 자기 배정이 된다. 그래서 `source` 컬럼이 없다.
*/
create table public.study_queue (
  student_id uuid not null references public.profiles (id) on delete cascade,
  content_set_id uuid not null references public.content_sets (id) on delete cascade,
  -- 담은 순서. 화면의 위/아래 옮기기가 이 값을 바꾼다.
  position int not null,
  created_at timestamptz not null default now(),
  primary key (student_id, content_set_id)
);

create index study_queue_order_idx on public.study_queue (student_id, position);

/*
  재풀이 요청. 학부모가 자녀에게 "이 학습 다시 풀어 보자"고 표시한다.

  **기존 기록은 지우지 않는다**(확정 정책 2절 학생 기록의 지속성). 다시 풀면 새 회차
  (`attempts.attempt_no`)로 쌓인다.

  `canceled_at`을 둔 이유: 프로토타입은 요청을 취소할 수 없어 잘못 눌러도 되돌릴 수 없었다
  (A-037). 해제 경로를 스키마에서 열어 둔다.
*/
create table public.retry_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  source learning_source not null,
  assignment_id uuid references public.assignments (id) on delete cascade,
  content_set_id uuid not null references public.content_sets (id) on delete cascade,
  created_at timestamptz not null default now(),
  canceled_at timestamptz,
  constraint retry_requests_assignment_matches_source
    check ((source = 'academy') = (assignment_id is not null))
);

-- 같은 대상에 살아 있는 요청은 하나만. 취소한 요청은 남고 다시 요청할 수 있다.
create unique index retry_requests_open_key on public.retry_requests (
  student_id, source, coalesce(assignment_id, content_set_id)
) where canceled_at is null;
