-- 오답 복습: 다시 풀어 본 사실을 남기는 표 · 스케줄 컬럼 · 지우기를 소프트 삭제로.

/*
  ## 왜 표를 하나 더 두는가

  지금 이 레포는 **학생이 오답을 다시 풀어 봤다는 사실을 어디에도 남기지 않는다.** 복습에서
  나가는 쓰기는 `starred`·`dig`·`mastered` 셋뿐이고(`app/student/review.tsx`), 그중 복습을
  다루는 것은 `mastered` 하나다. 그것은 학생이 누르는 자기 신고이고 **어떤 화면도 바꾸지
  않는다**(A-087): 해제 경로가 없고, 덱 필터(`review.tsx`의 `pool`)가 보지 않아 여덟 개를 전부
  이해 완료한 학생이 `전체 복습하기`를 누르면 같은 여덟 장이 같은 순서로 다시 나오고,
  `오답 N개` 개수에서도 빠지지 않는다. 오답노트 화면에는 표시조차 없다.

  ## 설계가 서 있는 근거

  - **자기 신고를 숙달 판정에 쓰지 않는다.** 학생의 성과 예측은 실제 성과와 무상관이다
    (Karpicke & Roediger 2008, Science 319:966). 그래서 이 표의 중심은 `is_correct`(다시 풀어
    맞혔는가)이고 `mastered`(읽고 이해했다는 신고)가 아니다. `mastered` 컬럼은 남긴다 —
    확정 정책 2절이 그 이름으로 학원 공개 여부를 정하고 있고 `__tests__/report.test.ts`가
    학부모 리포트에서의 부재를 고정한다. 학생 화면에서만 걷어낸다.
  - **재풀이가 효과의 본체다**: 인출 g=0.50 (Rowland 2014, Psychological Bulletin), 교육 텍스트
    재독은 유의한 이득이 거의 없다 (Callender & McDaniel 2009).
  - **정오 한 칸으로는 부족하다**: 정오만 d=0.05 · 정답 제시 0.32 · 설명 피드백 0.49
    (Van der Kleij et al. 2015, RER 85(4)). 그래서 로그가 `evidence`(근거를 어디서 잡았는가)와
    `recap`(내 말로 다시 쓴 한 줄)을 함께 담는다. 정오 하나만 남기면 그 차이를 적을 자리가 없다.
  - **숙달은 서로 다른 세션에서 정답 3회**(Rawson & Dunlosky; Vaughn & Rawson 2011). 같은
    세션에서 3회는 1회 후 빼는 것과 차이가 없다(Karpicke & Bauernschmidt 2011). 그래서 아래
    유니크 키가 **"서로 다른 세션"을 날짜로 정의한다.**
  - **맞힌 것을 큐에서 빼면 안 된다**: 1회 정답 후 시험을 중단하면 지연 회상 이득이 사라진다
    (Karpicke & Roediger 2008). 그래서 졸업한 노트도 사라지지 않고 유지 복습으로 남는다.

  ## 어떤 것을 컬럼으로 두지 않는가

  **정답 횟수·오답 횟수를 누적 컬럼으로 두지 않는다.** 누적값은 리셋 시점이 정의되지 않아
  규칙과 모순을 만든다(같은 설계의 앞선 초안이 실제로 그랬다: 누적 정답이 3을 넘은 노트는 몇
  번을 틀려도 정답 하나에 다시 최장 간격으로 갔고, 오래전 네 번 틀린 노트는 한 번 틀리면
  곧바로 큐에서 빠졌다). 아래 두 컬럼은 **연속** 값이고 서로 배타적으로 초기화되므로 그 모순이
  성립할 수 없다.

  `stage`(사다리 칸)도 두지 않는다. 간격은 `streak`의 함수이므로 두 값이 어긋날 자리가 없다.
*/

-- ── 1. 상태와 근거 ───────────────────────────────────────────────────────────

/**
 * 복습 스케줄 상태. **지우기는 이 값이 아니다** — `dismissed_at`이 따로 있다.
 *
 * 지움을 상태값으로 두면 되돌릴 때 무엇으로 돌아갈지가 사라진다(졸업한 노트를 지웠다 되살리면
 * 큐에 다시 들어와야 하는가?). D-033이 약속한 "없던 일"이 성립하려면 지움과 스케줄이 다른
 * 축이어야 한다.
 */
create type public.note_state as enum (
  -- 다시 볼 차례가 정해져 있다. `due_on`이 그날이다.
  'queued',
  -- 서로 다른 날 3회 연속으로 맞혔다. 큐에서 빠지지 않고 유지 복습으로 돌아온다.
  'graduated',
  -- 서로 다른 날 3회 연속으로 틀렸다. 큐에서 내린다(`due_on = null`).
  -- 같은 문항을 무한히 반복시키는 것은 학습이 아니다. 화면이 개념 학습·질문으로 넘긴다.
  'stuck'
);

/**
 * 답의 근거를 어디서 잡았는가. **국어에서 이 구분이 처방을 가른다.**
 *
 * 지문에서 근거를 찾아 틀린 것과 선지만 보고 찍어 틀린 것은 다음에 할 일이 다르다. 한국 국어
 * 지도 실무가 오답 기록의 핵심으로 「선지 vs 지문」을 지목하는 것과 같은 축이다.
 *
 * **확신도 평정(1~5)을 쓰지 않는다** — 일반 객관식에 확신도 슬라이더만 덧붙이는 것은 실험에서
 * 이득이 없었다(32.1% vs 32.7%, n.s. — Sparck, Bjork & Bjork 2016). 효과가 확인된 형식은
 * 선지별 확신 배분(42% vs 35.1%, d=0.51)인데, 5지선다마다 배분 UI를 반복하는 부담이 커서
 * 쓰지 않았다. **이 3택은 그보다 근거가 약한 선택이다** — 정보량이 있고 처방을 가른다는 점에서
 * 정오 한 칸보다는 낫지만, 효과크기로 뒷받침되지는 않는다.
 */
create type public.note_evidence as enum ('passage', 'choices', 'unsure');

-- ── 2. `wrong_notes`에 스케줄을 붙인다 ───────────────────────────────────────

alter table public.wrong_notes
  -- 새로 담은 노트는 내일 본다. 아래 트리거가 이 값을 강제하므로 클라이언트 값은 무시된다.
  add column state public.note_state not null default 'queued',
  -- 다시 볼 날. `stuck`이면 null이고 그때만 null이다.
  add column due_on date,
  -- 서로 다른 날 연속으로 맞힌 횟수. 틀리면 0으로 돌아간다. 간격이 이 값의 함수다.
  add column streak smallint not null default 0 check (streak >= 0),
  -- 서로 다른 날 연속으로 틀린 횟수. 맞히면 0으로 돌아간다. 3이면 `stuck`이다.
  add column miss_streak smallint not null default 0 check (miss_streak >= 0),
  -- 지운 시각. null이면 살아 있다. **물리 삭제를 하지 않는 이유는 아래 4절에.**
  add column dismissed_at timestamptz,
  -- 마지막으로 스케줄이 움직인 시각. 화면이 `마지막으로 본 날`을 말하는 근거다.
  add column updated_at timestamptz not null default now();

/*
  ## 기존 노트를 큐에 올린다

  **제약보다 먼저 와야 한다.** 컬럼을 더한 직후 기존 행은 `state = 'queued'`(기본값)이고
  `due_on`은 null이라, 아래 제약을 먼저 붙이면 그 행들이 위반이 되어 ALTER가 실패한다.

  담긴 지 오래된 오답은 정의상 이미 밀린 것이므로 **오늘**로 올린다. 한 번에 쏟아지는 것은
  화면의 하루 상한이 막는다 — 큐 크기를 늘리지 않고 우선순위만 바꾸는 것이 그쪽 규칙이다.

  이 UPDATE는 §5의 가드·터치 트리거가 **아직 만들어지기 전**에 돈다. 그래서 GUC를 세울 필요가
  없고, `updated_at`도 컬럼 기본값(`now()`)에 남는다 — 새 컬럼이라 보존할 이전 값이 없다.
*/
update public.wrong_notes
  set due_on = public.today_kst()
  where due_on is null;

/*
  `stuck`만 `due_on`이 없고, 나머지는 반드시 있다. 이 제약이 없으면 `queued`인데 `due_on`이
  null인 유령 노트가 생긴다 — 목록에는 보이는데 큐에는 영원히 나오지 않는다.
*/
alter table public.wrong_notes
  add constraint wrong_notes_due_matches_state
    check ((state = 'stuck') = (due_on is null));

/*
  오늘 볼 것을 찾는 질의가 쓴다. `stuck`은 큐에 없으므로 부분 인덱스에서 뺀다.
  `dismissed_at is null`도 조건에 두어 지운 노트가 인덱스를 키우지 않게 한다.
*/
create index wrong_notes_due_idx on public.wrong_notes (student_id, due_on)
  where dismissed_at is null and state <> 'stuck';

-- ── 3. 다시 풀어 본 사실 ─────────────────────────────────────────────────────

create table public.note_reviews (
  id uuid primary key default gen_random_uuid(),
  -- 노트를 지우면 로그도 함께 지워진다 — 그런데 지우기는 소프트 삭제이므로(4절) 이 cascade는
  -- 학생 계정 삭제 같은 실제 물리 삭제에서만 돈다.
  note_id uuid not null references public.wrong_notes (id) on delete cascade,
  -- 노트에서 파생되는 값이지만 RLS 정책이 이 컬럼을 본다. 정책 안에서 부모 표를 조회하면
  -- `wrong_notes`의 정책이 다시 평가되어 재귀가 된다(0004가 같은 이유로 헬퍼를 뺐다).
  student_id uuid not null references public.profiles (id) on delete cascade,
  -- **세션의 경계는 날짜다.** 아래 유니크 키가 그 정의다.
  reviewed_on date not null default public.today_kst(),
  -- 이번에 고른 답. 처음 풀 때 고른 답(`wrong_notes.picked_index`)과 비교할 수 있다.
  picked_index smallint check (picked_index >= 0),
  -- 다시 풀어 맞혔는가. 이 표의 중심 값이다.
  is_correct boolean not null,
  -- 근거를 어디서 잡았는가. 답을 확인하기 **전에** 묻는다 — 나중에는 되짚을 수 없는 값이다.
  evidence public.note_evidence,
  -- 내 말로 다시 쓴 한 줄. 자기설명 g=0.55 (Bisra et al. 2018). **건너뛸 수 있다** —
  -- 쓰기를 강제하면 복습이 노동이 되고, 그것이 종이 오답노트가 실패한 단일 원인이다.
  recap text,
  created_at timestamptz not null default now()
);

/*
  **"서로 다른 세션"의 정의.** 하루에 한 노트를 두 번 세지 않는다. 같은 날 반복해서 맞히면
  졸업 조건 3회를 한 자리에서 만들 수 있고, 그러면 집중 반복이 분산 인출로 계산된다 — 문헌이
  구분하는 바로 그 차이다(같은 세션 3회는 1회 후 빼는 것과 차이가 없다).
*/
create unique index note_reviews_session on public.note_reviews (note_id, reviewed_on);
create index note_reviews_note_idx on public.note_reviews (note_id);
create index note_reviews_student_idx on public.note_reviews (student_id, reviewed_on desc);

alter table public.note_reviews enable row level security;

/*
  읽기 범위는 `wrong_notes_select`와 같다 — 본인 · 연결된 학부모 · 운영자.
  **학원 경로는 만들지 않는다.** `recap`은 `dig`(D-054가 선생님에게 연 유일한 값)와 다른
  값이고, 확정 정책 2절이 열기로 정한 것은 `오답노트 메모 본문` 하나다.
*/
create policy note_reviews_select on public.note_reviews
  for select using (public.can_read_student(student_id) or public.is_admin());

/*
  **쓰기 정책이 없다.** 유일한 문은 `rpc_log_note_review`(0038)이고, 그 함수가 로그 한 행과
  스케줄 갱신을 한 트랜잭션으로 처리한다. 학생이 이 표에 직접 넣을 수 있으면 정답 3회를 손으로
  만들어 졸업할 수 있고, 그러면 이 표가 학습의 사실이 아니라 자기 신고가 된다 — `mastered`가
  정확히 그랬다.
*/
revoke insert, update, delete, truncate on public.note_reviews from anon, authenticated;
grant select on public.note_reviews to authenticated;

-- ── 4. 지우기를 소프트 삭제로 ────────────────────────────────────────────────

/*
  ## 왜 물리 삭제를 멈추는가

  지금 `removeNote`는 `delete from wrong_notes`다(`src/repo/learning.ts`). 그 위에 D-033의
  되돌리기가 **같은 id로 다시 INSERT**하는 방식으로 얹혀 있다. 복습 로그가 생기면 그 조합이
  깨진다 — 삭제가 `note_reviews`를 cascade로 함께 지우므로 되돌려도 정답 3회의 근거가 돌아오지
  않는다. "없던 일"이 되지 않는다.

  그래서 지우기는 `dismissed_at`을 세우는 일이 되고, **DELETE 권한을 회수한다.** 회수하지
  않으면 소프트 삭제는 클라이언트의 약속일 뿐이다 — `DELETE /rest/v1/wrong_notes?id=eq.…`
  한 번으로 노트와 로그가 사라진다. 0026·0029가 두 번 고친 것과 같은 모양(함수는 조였는데 옆에
  제한 없는 직접 쓰기가 열려 있다)이므로 여기서 미리 닫는다.

  `for all` 정책은 그대로 두고 권한만 회수한다 — 정책은 select·insert·update에도 걸려 있고,
  그 셋은 계속 필요하다(담기 · 메모 · 별표 · 지우기).
*/
revoke delete on public.wrong_notes from anon, authenticated;

-- 학원 뷰가 지운 노트를 계속 보여주면 학생이 뺀 것을 선생님이 읽는다.
create or replace view public.v_academy_visible_notes as
select
  n.id,
  n.student_id,
  n.question_id,
  n.content_set_id,
  n.source,
  n.assignment_id,
  n.dig,
  n.created_at
from public.wrong_notes n
where n.source = 'academy'
  and n.assignment_id is not null
  and n.dismissed_at is null
  and public.can_see_assignment(n.assignment_id)
  and public.can_see_student(n.student_id);

/*
  **뷰의 컬럼 목록이 방어 장치다**(D-085 · 0012의 주석). 위에서 더한 컬럼 다섯 개
  (`state`·`due_on`·`streak`·`miss_streak`·`dismissed_at`)와 `updated_at`은 여기 나열되지
  않았으므로 학원 응답 스키마에 들어가지 않는다. 확정 정책 2절이 별표·이해 완료를 닫은 것과
  같은 이유로 복습 스케줄도 학원에 열지 않는다 — 학생이 무엇을 몇 번 틀렸는지는 풀이 과정이다.
*/

-- ── 5. 스케줄은 서버만 쓴다 ──────────────────────────────────────────────────

create or replace function public.tg_wrong_notes_touch()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger wrong_notes_touch
  before update on public.wrong_notes
  for each row execute function public.tg_wrong_notes_touch();

/**
 * 스케줄 컬럼을 클라이언트가 못 바꾸게 막는다.
 *
 * `wrong_notes_write`는 본인 행에 대해 `for all`이므로, 막지 않으면 학생이 `state`를
 * `graduated`로 쓰거나 `due_on`을 먼 미래로 밀어 큐를 비울 수 있다. 그러면 스케줄이 서버 규칙이
 * 아니라 클라이언트 값이 된다.
 *
 * **INSERT는 값을 검사하지 않고 덮어쓴다.** 거부하면 담기 실패가 되는데, 담기 화면이 스케줄을
 * 알 이유가 없다. 서버가 정하는 것이 계약이므로 조용히 서버 값으로 맞춘다.
 *
 * **`dismissed_at`은 막지 않는다** — 지우기·되돌리기는 학생의 행동이고 D-033이 그 자리에
 * 확인 단계를 두지 않기로 정했다.
 *
 * 서버 경로(0038의 RPC, 0039의 백필)는 `scody.note_schedule` GUC로 통과한다. **RPC 안에서는
 * 반드시 트랜잭션 지역(`set_config(..., true)`)이어야 한다** — PostgREST는 연결을 재사용하므로
 * 세션 범위로 세우면 그 연결에서 가드가 영구히 꺼진다.
 */
create or replace function public.tg_wrong_notes_schedule_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_open boolean := coalesce(current_setting('scody.note_schedule', true), '') = 'on';
begin
  if v_open then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.state := 'queued';
    new.due_on := public.today_kst() + 1;
    new.streak := 0;
    new.miss_streak := 0;
    return new;
  end if;

  if new.state is distinct from old.state
    or new.due_on is distinct from old.due_on
    or new.streak is distinct from old.streak
    or new.miss_streak is distinct from old.miss_streak
  then
    raise exception '복습 일정은 직접 바꿀 수 없어요.';
  end if;

  return new;
end;
$$;

create trigger wrong_notes_schedule_guard
  before insert or update on public.wrong_notes
  for each row execute function public.tg_wrong_notes_schedule_guard();

-- ── 6. `review_done`이 처음으로 진실이 된다 ──────────────────────────────────

/*
  `tg_note_event`는 `mastered` false→true에 `review_done`을 남겼다. 그 값은 자기 신고이고
  `v_daily_activity.reviews_done`이 그것을 세고 있었다(읽는 화면은 0개다 —
  `src/features/adminMetrics.ts`에 `reviewsDone` 사용처가 없다).

  이제 복습 로그 INSERT가 그 이벤트를 남긴다. 집계의 뜻이 `이해했다고 누른 횟수`에서
  `다시 풀어 본 횟수`로 바뀐다.
*/
create or replace function public.tg_note_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.note_learning_event(new.student_id, 'note_added', new.id, false);
  return new;
end;
$$;

drop trigger if exists wrong_notes_event on public.wrong_notes;
create trigger wrong_notes_event
  after insert on public.wrong_notes
  for each row execute function public.tg_note_event();

create or replace function public.tg_note_review_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- 하루에 한 번만 센다(`p_once_a_day = true`). 한 세션에서 카드 다섯 장을 풀면 복습을 다섯
  -- 번 한 것이 아니라 하루 복습을 한 것이다.
  perform public.note_learning_event(new.student_id, 'review_done', new.note_id, true);
  return new;
end;
$$;

create trigger note_reviews_event
  after insert on public.note_reviews
  for each row execute function public.tg_note_review_event();
