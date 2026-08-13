-- 학습 콘텐츠: 세트와 문항.
--
-- 운영자가 등록한 콘텐츠와 학원이 등록한 콘텐츠가 같은 구조다. 다른 것은 소유자
-- (`owner_academy_id`)와 공개 범위(`publish_to_students`)뿐이다.

create table public.content_sets (
  id uuid primary key default gen_random_uuid(),
  subject subject_kind not null default '국어',
  area korean_area not null,
  title text not null check (length(btrim(title)) > 0),
  kind content_kind not null,
  -- 학년과 세부 유형. 학생이 학습을 고를 때(`/student/pick`) 이 값으로 좁힌다.
  grade smallint check (grade between 1 and 3),
  /*
    세부 유형(`현대소설`·`과학`·`음운의 변동` 등). `src/data/taxonomy.ts`의 `TOPICS`에서 고른다.
    **enum이나 참조 테이블로 두지 않는다** — 유형 목록은 화면의 고르기 단계 구성이고, 늘어날
    때마다 마이그레이션을 요구하면 콘텐츠 등록이 배포에 묶인다.
  */
  topic text,
  -- 학생 개인 학습으로 공개할지. 개인 학습 목록은 이 값이 참인 세트에서 파생한다.
  publish_to_students boolean not null default false,
  /*
    등록한 학원. **null이면 운영자 콘텐츠**다.
    학원은 자기 콘텐츠와 운영자 공개 콘텐츠만 배정할 수 있다(확정 정책 2절).
  */
  owner_academy_id uuid references public.academies (id) on delete cascade,
  -- 지문. `kind = 'passage'`일 때만 있다(아래 CHECK).
  passage_title text,
  passage_body text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  /*
    지문형에는 지문이 있고 문법형에는 없다. 컬럼으로 두는 이유: 세트와 지문이 1:1이라
    별 테이블은 join만 늘린다.
  */
  constraint content_sets_passage_matches_kind
    check ((kind = 'passage') = (passage_body is not null))
);

create index content_sets_published_idx on public.content_sets (grade, area)
  where publish_to_students;
create index content_sets_owner_idx on public.content_sets (owner_academy_id);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  content_set_id uuid not null references public.content_sets (id) on delete cascade,
  -- 문항 번호(1부터). 화면이 `N번 문항`으로 말하고 오답노트도 이 순서로 보여 준다.
  position int not null check (position >= 1),
  prompt text not null check (length(btrim(prompt)) > 0),
  /*
    선지. **배열로 둔다** — 순서가 뜻을 가지고(`answer_index`가 자리를 가리킨다) 4지 고정이
    아니다. 별 테이블로 쪼개면 순서 컬럼과 join이 늘 뿐 얻는 것이 없다.
  */
  choices text[] not null check (array_length(choices, 1) >= 2),
  answer_index smallint not null,
  explanation text,
  unique (content_set_id, position),
  constraint questions_answer_index_in_range
    check (answer_index >= 0 and answer_index < array_length(choices, 1))
);

create index questions_set_idx on public.questions (content_set_id, position);

/** 세트의 문항 수. 화면이 `N문항`으로 말할 때 쓴다. */
create or replace function public.question_count(target uuid)
returns int
language sql
stable
as $$
  select count(*)::int from public.questions where content_set_id = target;
$$;

-- 콘텐츠 열람 권한 헬퍼(`can_read_content`)는 `0007_attempts.sql`에 있다 —
-- 배정받은 학생이 비공개 세트도 풀 수 있어야 해서 `assignment_targets`를 함께 봐야 하고,
-- `language sql` 함수는 만들 때 본문을 검사하므로 그 테이블보다 먼저 만들 수 없다.
