-- 실제 학습 시간과 '익힘에 처음 닿은 날'. 학습 기록 시스템의 원천 두 가지를 만든다.
--
-- ## 왜 이 표가 필요한가
--
-- 학습 시간을 셀 수 있는 자리는 지금 `attempts.time_sec` 하나뿐이고, 그 값은 **화면을 연
-- 시각부터 제출한 시각까지의 벽시계**다(`app/student/solve/[id].tsx`가 `startRef`를 마운트에서
-- 한 번 잡고 제출에서 뺀다). 탭을 열어 둔 채 세 시간 뒤에 제출하면 `10800`이 기록된다 —
-- 학부모 화면이 그 값을 `실제 학습 시간`이라고 부르면 거짓이 된다.
--
-- 그리고 그 값은 **제출한 학습에만 붙는다.** 오답 카드 복습(`note_reviews`)에는 시간 컬럼이
-- 없고, 절반쯤 풀고 다음 날 제출한 학습은 시간 전부가 제출한 날로 몰린다.
--
-- 그래서 시간은 **별 표에 append-only로 쌓는다.** 클라이언트는 활동이 있는 동안만 자라는
-- 누적기(`src/features/activeTime.ts`)를 들고 있고, 그 증분만 여기로 보낸다. 하루 총량은
-- 이 표의 합이고 `attempts.time_sec`은 그대로 **그 풀이 한 건의 걸린 시간**을 말한다
-- (두 값을 더하지 않는다 — 더하면 같은 시간을 두 번 센다).
--
-- ## 부풀릴 수 없게 만드는 세 겹
--
-- 1. 클라이언트가 유휴·백그라운드 구간을 애초에 세지 않는다(측정).
-- 2. 이 함수가 한 번에 받을 수 있는 양을 제한한다(`ACTIVE_FLUSH_CAP`).
-- 3. 이 함수가 하루 총량을 제한한다(`ACTIVE_DAY_CAP`). 클라이언트를 고쳐 1초마다 900초를
--    보내도 하루 상한을 넘지 못한다.
--
-- 상한은 거부가 아니라 **깎기**다. 거부하면 학생이 방금 한 공부가 오류로 보인다.

create type public.study_activity_kind as enum ('solve', 'review');

/*
  실제 학습 시간 조각.

  `occurred_on`을 따로 두는 이유는 `learning_events`와 같다 — 하루의 경계는 서비스 시간대
  (`Asia/Seoul`)이고, timestamptz에서 매번 캐스팅하면 서버 시간대에 따라 하루가 밀린다.

  **`ref_id`에 FK를 두지 않는다.** 되짚기 위한 값이고, 제출 전에 보낸 조각은 아직 존재하지
  않는 풀이를 가리킬 수 없다(그때는 콘텐츠 세트 id를 담는다).
*/
create table public.study_activity (
  id bigserial primary key,
  student_id uuid not null references public.profiles (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  occurred_on date not null default public.today_kst(),
  kind public.study_activity_kind not null,
  ref_id uuid,
  /*
    이 조각의 활동 시간(초). **0은 넣지 않는다** — 아무 일도 없었다는 사실은 행이 없는 것으로
    충분하고, 0행이 쌓이면 표만 커진다. 상한은 함수가 깎아서 넣으므로 이 제약에 걸릴 값은
    함수를 지나지 않은 경로뿐이다.
  */
  active_sec int not null check (active_sec > 0 and active_sec <= 900)
);

create index study_activity_student_day_idx on public.study_activity (student_id, occurred_on);

alter table public.study_activity enable row level security;

/*
  읽기 범위는 `attempts`·`note_reviews`와 같다 — 본인 · 연결된 학부모 · 운영자.

  **학원 경로를 만들지 않는다.** 확정 정책 2절이 학원에 여는 것은 그 학원이 배정한 학습과 그
  결과이고, 이 표에는 개인 학습 시간이 출처 구분 없이 섞여 있다. 학원이 읽으면 학생이 집에서
  개인 학습을 몇 분 했는지가 그대로 드러난다.
*/
create policy study_activity_select on public.study_activity
  for select using (public.can_read_student(student_id) or public.is_admin());

/*
  **쓰기 정책이 없다.** 유일한 문은 아래 `rpc_log_study_time`이고, 그 함수가 상한을 적용한다.
  직접 INSERT가 열려 있으면 상한은 클라이언트의 약속일 뿐이다 — 0026·0029·0037이 세 번 고친
  것과 같은 모양(함수는 조였는데 옆에 제한 없는 직접 쓰기가 열려 있다)이므로 여기서 미리 닫는다.

  `learning_events`와 같이 append-only다. UPDATE·DELETE도 회수한다 — 지난 학습 시간을 고칠
  이유가 없고, 고칠 수 있으면 기록이 아니다.
*/
revoke insert, update, delete, truncate on public.study_activity from anon, authenticated;
grant select on public.study_activity to authenticated;

/**
 * 활동이 있었던 학습 시간을 더한다. **깎아서 넣고, 실제로 넣은 초를 돌려준다.**
 *
 * @param p_kind 어느 화면인가(`solve`·`review`). 나중에 화면별 시간을 갈라 보기 위해 남긴다.
 * @param p_active_sec 마지막 전송 이후 **활동이 있는 동안만** 자란 초. 클라이언트가 유휴·
 *   백그라운드를 이미 뺀 값이다.
 * @param p_ref_id 풀이 id 또는 콘텐츠 세트 id 또는 노트 id. 되짚기용이고 없어도 된다.
 * @returns 실제로 기록한 초. 상한에 걸려 깎였으면 보낸 값보다 작고, 하루 상한을 이미 채웠으면 0이다.
 */
create or replace function public.rpc_log_study_time(
  p_kind public.study_activity_kind,
  p_active_sec int,
  p_ref_id uuid default null
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- 한 번에 받는 최대. 클라이언트는 60초마다 보내므로 정상 경로는 이 값에 닿지 않는다.
  c_flush_cap constant int := 900;
  -- 하루 최대(8시간). 고등학생이 이 서비스에서 하루에 쓸 수 있는 시간의 넉넉한 위쪽 경계다.
  c_day_cap constant int := 8 * 3600;
  v_uid uuid := auth.uid();
  v_day date := public.today_kst();
  v_want int;
  v_used int;
  v_room int;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.';
  end if;
  if p_kind is null then
    raise exception '어떤 학습인지 알 수 없어요.';
  end if;

  /*
    **null·음수·NaN을 가드한다**(0029·0031이 같은 함정을 두 번 고쳤다). `coalesce`를
    `greatest`보다 먼저 둔다 — `greatest(0, null)`은 0이 아니라 null이다.
  */
  v_want := least(greatest(coalesce(p_active_sec, 0), 0), c_flush_cap);
  if v_want = 0 then
    return 0;
  end if;

  select coalesce(sum(active_sec), 0)::int
  into v_used
  from public.study_activity
  where student_id = v_uid and occurred_on = v_day;

  v_room := c_day_cap - v_used;
  if v_room <= 0 then
    return 0;
  end if;

  v_want := least(v_want, v_room);

  insert into public.study_activity (student_id, occurred_on, kind, ref_id, active_sec)
  values (v_uid, v_day, p_kind, p_ref_id, v_want);

  return v_want;
end;
$$;

revoke all on function public.rpc_log_study_time(public.study_activity_kind, int, uuid) from public, anon;
grant execute on function public.rpc_log_study_time(public.study_activity_kind, int, uuid) to authenticated;

-- ── `attempts.time_sec`의 위쪽 경계 ─────────────────────────────────────────
--
-- 클라이언트가 활동 기반으로 재기 시작하면 이 값은 정상 범위에 들어온다. 그래도 경계를 서버에
-- 둔다 — 측정은 클라이언트의 코드이고, 그 코드는 바꿔서 보낼 수 있다.
--
-- **거부가 아니라 깎기다.** 제약(`check`)으로 두면 학생이 방금 낸 풀이가 통째로 실패한다.
-- 문항당 15분 · 최소 10분이라 정상 풀이가 여기에 닿는 일은 없고, `10800`(세 시간 열어 둔 탭)
-- 같은 값만 잘린다.

create or replace function public.tg_attempt_time_clamp()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.time_sec := least(new.time_sec, greatest(600, new.total_count * 900));
  return new;
end;
$$;

create trigger attempts_time_clamp
  before insert or update of time_sec on public.attempts
  for each row execute function public.tg_attempt_time_clamp();

-- ── 익힘에 처음 닿은 날 ──────────────────────────────────────────────────────
--
-- ## `state = 'graduated'`를 셀 수 없는 이유
--
-- 익힌 오답의 누적 수를 `count(*) where state = 'graduated'`로 세면 **줄어든다.** 익힘은
-- 30일마다 유지 복습을 받고(D-176), 그 복습에서 틀리면 `rpc_log_note_review`가 상태를
-- `queued`로 되돌린다(0040: `v_streak := 0` · `v_state := 'queued'`). 그러면 어제 `50개 익힘`
-- 이던 학생이 오늘 `49개`가 된다.
--
-- 기록은 그런 값이 아니다. **한 번 익힌 사실은 남는다** — 이 컬럼은 처음 닿은 날만 담고 이후
-- 어떤 경로로도 지워지지 않는다. 지금 익힘 상태인지는 `state`가 계속 말한다(둘은 다른 질문이다).

alter table public.wrong_notes add column if not exists graduated_on date;

create index wrong_notes_graduated_idx on public.wrong_notes (student_id, graduated_on)
  where graduated_on is not null;

/*
  이 컬럼은 **서버만 쓴다.** 0037 §5의 스케줄 가드에 같은 규칙으로 얹는다 — 학생이 직접 쓸 수
  있으면 `익힌 오답 500개`를 한 번의 PATCH로 만들 수 있고, 그러면 이 값이 학습의 사실이 아니라
  자기 신고가 된다(`mastered`가 정확히 그랬다).

  값을 세우는 자리도 여기다. `rpc_log_note_review`(0040)를 다시 만들지 않는 것은, 그 함수가
  스케줄 규칙 전부를 담고 있어 여기서 복제하면 다음 사람이 한쪽만 고치기 때문이다. 이 트리거는
  **상태 전이 하나만** 본다: `graduated`가 아니었다가 `graduated`가 된 순간.
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
    /*
      **처음 닿은 날만 남긴다.** `is null` 조건이 그 뜻이다 — 익힘에서 떨어졌다가 다시 익히면
      두 번째 날로 덮지 않는다. 그 학생이 처음 익힌 날은 하나다.

      INSERT도 함께 본다. seed와 0039의 백필이 스케줄 값을 직접 써 넣는 경로다.
    */
    if new.state = 'graduated'
      and (tg_op = 'INSERT' or old.state is distinct from 'graduated')
      and new.graduated_on is null
    then
      new.graduated_on := public.today_kst();
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.state := 'queued';
    new.due_on := public.today_kst() + 1;
    new.streak := 0;
    new.miss_streak := 0;
    new.graduated_on := null;
    return new;
  end if;

  if new.state is distinct from old.state
    or new.due_on is distinct from old.due_on
    or new.streak is distinct from old.streak
    or new.miss_streak is distinct from old.miss_streak
    or new.graduated_on is distinct from old.graduated_on
  then
    raise exception '복습 일정은 직접 바꿀 수 없어요.';
  end if;

  if new.student_id is distinct from old.student_id
    or new.question_id is distinct from old.question_id
    or new.content_set_id is distinct from old.content_set_id
    or new.source is distinct from old.source
    or new.assignment_id is distinct from old.assignment_id
  then
    raise exception '오답노트의 출처는 바꿀 수 없어요.';
  end if;

  return new;
end;
$$;

/*
  ## 이미 익힌 오답의 날짜를 되살린다(backfill)

  `graduated_on`이 없던 동안 익힘에 닿은 노트가 있다. 그 노트의 복습 로그는 남아 있으므로
  **마지막 복습일**을 그 날로 쓴다 — 익힘 판정은 그 회차의 정답으로 났기 때문이다.

  **근사치다.** 익힘 이후 유지 복습을 받은 노트는 마지막 복습일이 실제 졸업일보다 뒤다.
  로그로 정확한 졸업일을 되짚으려면 `streak`이 3에 닿은 회차를 찾아야 하는데, 그 계산은
  `unsure`로 맞힌 회차를 세지 않는 규칙까지 복제해야 한다(0040) — 지난 데이터를 위해 규칙을
  두 곳에 두지 않는다. 앞으로 생기는 값은 위 트리거가 정확하게 남긴다.

  트리거 가드를 지나야 하므로 GUC를 연다. 트랜잭션 지역이다(0037 §5).
*/
do $$
begin
  perform set_config('scody.note_schedule', 'on', true);
  update public.wrong_notes n
  set graduated_on = coalesce(
    (select max(r.reviewed_on) from public.note_reviews r where r.note_id = n.id),
    /*
      근거 행이 없는 노트. seed는 `graduated`를 주장할 때 복습 로그를 함께 넣으므로
      (`scripts/gen-seed.ts`) 정상 경로에는 없다. 그래도 여기서 null로 남기면 그 노트는
      누적 익힘에서 통째로 빠진다 — 마지막으로 상태가 바뀐 날로 대신한다.
    */
    (n.updated_at at time zone 'Asia/Seoul')::date
  )
  where n.state = 'graduated' and n.graduated_on is null;
  perform set_config('scody.note_schedule', '', true);
end;
$$;

comment on table public.study_activity is
  '실제 활동이 있었던 학습 시간 조각(append-only). 하루 총량은 occurred_on으로 묶은 합이고 '
  'attempts.time_sec과 더하지 않는다 — 같은 시간을 두 번 센다.';
comment on column public.wrong_notes.graduated_on is
  '익힘에 처음 닿은 날. 익힘에서 떨어져도 지우지 않는다 — 지금 상태는 state가 말한다.';
