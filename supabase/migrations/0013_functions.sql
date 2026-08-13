-- 쓰기 함수와 트리거.
--
-- **원자성이 필요한 쓰기만 함수로 둔다.** 단순한 한 행 추가·수정은 클라이언트가 PostgREST로
-- 직접 하고 RLS가 막는다. 함수를 늘리면 권한 판단이 두 곳(정책과 함수)으로 갈린다.

/**
 * 서비스 기준 '오늘'(`Asia/Seoul`).
 *
 * 지표는 **날짜 단위**로 세는데 DB 시간대는 UTC다. `current_date`를 쓰면 KST 자정~오전 9시
 * 사이의 학습이 전날로 기록되어 화면(`todayISO()`는 기기 로컬 시간)과 하루 어긋난다.
 * 스코디는 한국 고등학생용 서비스라 서비스 시간대 하나를 고정하는 것이 맞다.
 */
create or replace function public.today_kst()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Seoul')::date;
$$;

-- ── 학습 활동 이벤트 트리거 ──────────────────────────────────────────────────
--
-- **호출부가 기억하지 않아도 되게 트리거로 둔다.** 프로토타입에서 지표의 원천이 합성이었던
-- 이유 중 하나는 실제 행동을 남기는 자리가 없었다는 것이다. 그 자리를 쓰기 경로마다 손으로
-- 넣으면 새 경로가 생길 때 빠진다.

/**
 * 그 날 첫 활동만 남긴다.
 *
 * `answer_saved`는 문항을 고를 때마다 일어난다. 전부 남기면 표가 선택 수만큼 커지는데,
 * 지표가 세는 것은 **그 날 활동했는지**뿐이다(D-1). 하루 한 줄로 줄인다.
 */
create or replace function public.note_learning_event(
  p_student uuid,
  p_kind learning_event_kind,
  p_ref uuid,
  p_once_a_day boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_day date := public.today_kst();
begin
  if p_once_a_day and exists (
    select 1 from public.learning_events
    where student_id = p_student and occurred_on = v_day and kind = p_kind
  ) then
    return;
  end if;
  insert into public.learning_events (student_id, occurred_on, kind, ref_id)
  values (p_student, v_day, p_kind, p_ref);
end;
$$;

create or replace function public.tg_answer_draft_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.note_learning_event(new.student_id, 'answer_saved', null, true);
  return new;
end;
$$;

create trigger answer_drafts_event
  after insert or update of picked_index on public.answer_drafts
  for each row execute function public.tg_answer_draft_event();

create or replace function public.tg_attempt_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- 제출한 날은 답을 저장한 날이기도 하다. 답안 초안 없이 한 번에 낸 경로가 있어서 함께 남긴다.
  perform public.note_learning_event(new.student_id, 'answer_saved', null, true);
  perform public.note_learning_event(new.student_id, 'attempt_submitted', new.id, false);
  return new;
end;
$$;

create trigger attempts_event
  after insert on public.attempts
  for each row execute function public.tg_attempt_event();

create or replace function public.tg_note_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform public.note_learning_event(new.student_id, 'note_added', new.id, false);
  elsif not old.mastered and new.mastered then
    -- 카드 복습에서 이해 완료로 표시한 순간이 복습을 마친 사실이다.
    perform public.note_learning_event(new.student_id, 'review_done', new.id, false);
  end if;
  return new;
end;
$$;

create trigger wrong_notes_event
  after insert or update of mastered on public.wrong_notes
  for each row execute function public.tg_note_event();

-- ── 풀이 제출 ────────────────────────────────────────────────────────────────

/**
 * 풀이를 제출한다. **원자성이 필요한 유일한 쓰기다.**
 *
 * 한 트랜잭션에서 네 가지가 함께 일어나야 한다: 시도 한 행 · 문항별 정오 · 배정 대상의
 * 제출 표시 · 답안 초안 정리. 하나라도 빠지면 화면이 서로 다른 말을 한다 — 프로토타입은
 * 정답률만 저장하다가 제출일과 틀린 문항이 영구히 남지 않아 학원·학부모 화면이 `기록 없음`으로
 * 떨어졌다(D-060).
 *
 * **채점은 서버가 한다.** 클라이언트가 보낸 정답 수를 믿지 않는다.
 *
 * @param p_answers `[{"question_id": "...", "picked_index": 2}, …]`. 안 고른 문항은 빼도 되고,
 *   그 문항은 오답으로 채점된다.
 * @returns 만든 `attempts.id`
 */
create or replace function public.rpc_submit_attempt(
  p_source learning_source,
  p_content_set_id uuid,
  p_answers jsonb,
  p_time_sec int default 0,
  p_assignment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_total int;
  v_correct int;
  v_no int;
  v_id uuid;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.';
  end if;
  if (p_source = 'academy') <> (p_assignment_id is not null) then
    raise exception '학습 출처와 배정이 맞지 않아요.';
  end if;

  if p_source = 'academy' then
    -- 배정받지 않은 과제는 낼 수 없다. 화면 목록이 아니라 배정 대상 행이 근거다.
    if not exists (
      select 1 from public.assignment_targets t
      where t.assignment_id = p_assignment_id and t.student_id = v_uid
    ) then
      raise exception '배정받은 학습이 아니에요.';
    end if;
    if not exists (
      select 1 from public.assignments a
      where a.id = p_assignment_id and a.content_set_id = p_content_set_id
    ) then
      raise exception '배정된 학습과 다른 문제예요.';
    end if;
  else
    -- 개인 학습은 공개된 콘텐츠만 푼다(`personalItems`와 같은 기준).
    if not exists (
      select 1 from public.content_sets s
      where s.id = p_content_set_id and s.publish_to_students
    ) then
      raise exception '지금은 풀 수 없는 학습이에요.';
    end if;
  end if;

  select
    count(*)::int,
    count(*) filter (where coalesce(x.picked_index = q.answer_index, false))::int
  into v_total, v_correct
  from public.questions q
  left join jsonb_to_recordset(coalesce(p_answers, '[]'::jsonb))
    as x(question_id uuid, picked_index smallint) on x.question_id = q.id
  where q.content_set_id = p_content_set_id;

  if v_total = 0 then
    raise exception '문항이 없는 학습이에요.';
  end if;

  -- 회차. 다시 풀면 쌓인다(이전 회차를 덮어쓰지 않는다 — A-036).
  select coalesce(max(a.attempt_no), 0) + 1
  into v_no
  from public.attempts a
  where a.student_id = v_uid
    and a.source = p_source
    and coalesce(a.assignment_id, a.content_set_id)
      = coalesce(p_assignment_id, p_content_set_id);

  insert into public.attempts (
    student_id, content_set_id, source, assignment_id,
    attempt_no, time_sec, submitted_on, correct_count, total_count
  )
  values (
    v_uid, p_content_set_id, p_source, p_assignment_id,
    v_no, greatest(0, coalesce(p_time_sec, 0)), public.today_kst(), v_correct, v_total
  )
  returning id into v_id;

  -- 안 고른 문항도 행을 만든다. 빠지면 "몇 문항 중 몇 개"의 분모가 갈린다.
  insert into public.attempt_answers (attempt_id, question_id, picked_index, is_correct)
  select v_id, q.id, x.picked_index, coalesce(x.picked_index = q.answer_index, false)
  from public.questions q
  left join jsonb_to_recordset(coalesce(p_answers, '[]'::jsonb))
    as x(question_id uuid, picked_index smallint) on x.question_id = q.id
  where q.content_set_id = p_content_set_id;

  if p_source = 'academy' then
    update public.assignment_targets
    set attempt_id = v_id
    where assignment_id = p_assignment_id and student_id = v_uid;
  end if;

  -- 낸 학습의 초안은 지운다. 남으면 목록이 다시 `이어서 하기`로 보인다.
  delete from public.answer_drafts d
  where d.student_id = v_uid
    and d.source = p_source
    and coalesce(d.assignment_id, d.content_set_id)
      = coalesce(p_assignment_id, p_content_set_id);

  -- 푼 학습은 담아 둔 목록에서 빠진다. 목록의 개수가 늘 '할 일'을 뜻하게.
  if p_source = 'personal' then
    delete from public.study_queue
    where student_id = v_uid and content_set_id = p_content_set_id;
  end if;

  return v_id;
end;
$$;

-- ── 배정 ─────────────────────────────────────────────────────────────────────

/**
 * 반에 학습을 배정한다.
 *
 * 권한: 원장은 학원 전체 반, 선생님은 담당 반만(`my_class_ids`).
 * **같은 반에 같은 콘텐츠의 미제출 배정이 있으면 거부한다**(D-046) — 학생 화면에 같은 과제가
 * 두 줄로 뜨면 어느 쪽을 풀어야 제출되는지 알 수 없다. 마감일만 미루는 쪽이 맞다.
 *
 * 배정 대상 행은 **지금 살아 있는 반 학생**으로 만든다(`v_class_roster`).
 */
create or replace function public.rpc_add_assignment(
  p_class_id uuid,
  p_content_set_id uuid,
  p_title text,
  p_due_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_academy uuid;
  v_id uuid;
  v_students int;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.';
  end if;
  if p_class_id not in (select public.my_class_ids()) then
    raise exception '담당하는 반에만 배정할 수 있어요.';
  end if;
  if length(btrim(coalesce(p_title, ''))) = 0 then
    raise exception '과제 이름을 입력해 주세요.';
  end if;

  -- 우리 학원 콘텐츠이거나 운영자가 공개한 콘텐츠만 배정할 수 있다(확정 정책 2절).
  v_academy := public.my_academy_id();
  if not exists (
    select 1 from public.content_sets s
    where s.id = p_content_set_id
      and (s.owner_academy_id = v_academy or (s.owner_academy_id is null and s.publish_to_students))
  ) then
    raise exception '배정할 수 없는 문제예요.';
  end if;

  if exists (
    select 1
    from public.assignments a
    join public.assignment_targets t on t.assignment_id = a.id
    where a.class_id = p_class_id
      and a.content_set_id = p_content_set_id
      and t.attempt_id is null
  ) then
    raise exception '이 반에 같은 학습이 이미 배정돼 있어요. 마감일만 바꿔 주세요.';
  end if;

  insert into public.assignments (
    class_id, content_set_id, title, due_date, original_due_date, created_by
  )
  values (p_class_id, p_content_set_id, btrim(p_title), p_due_date, p_due_date, v_uid)
  returning id into v_id;

  insert into public.assignment_targets (assignment_id, student_id)
  select v_id, r.student_id from public.v_class_roster r where r.class_id = p_class_id;

  select count(*)::int into v_students
  from public.assignment_targets where assignment_id = v_id;

  if v_students = 0 then
    -- 학생이 없는 반에 배정하면 아무도 받지 못한다. 조용히 만들지 않고 알린다.
    raise exception '이 반에 학생이 없어요. 학생을 먼저 넣어 주세요.';
  end if;

  return v_id;
end;
$$;

/**
 * 마감일을 다시 정한다(재배정).
 *
 * 이미 낸 학생의 제출 기록은 지우지 않는다(D-013). **처음 마감일은 `original_due_date`에
 * 남긴다**(D-056) — 학부모 월간 리포트가 그 값으로 달을 판정하므로, 남기지 않으면 마감을
 * 미룰 때마다 이미 낸 학생의 지난달 기록이 다른 달로 옮겨 간다.
 */
create or replace function public.rpc_reassign(p_assignment_id uuid, p_due_date date)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_see_assignment(p_assignment_id) then
    raise exception '담당하는 반의 배정만 바꿀 수 있어요.';
  end if;
  update public.assignments
  set due_date = p_due_date,
      -- 두 번 미뤄도 원래 값은 그대로다.
      original_due_date = coalesce(original_due_date, due_date)
  where id = p_assignment_id;
end;
$$;

/**
 * 방금 만든 배정을 지운다(되돌리기).
 * **제출이 하나라도 있으면 거부한다** — 낸 기록을 지우지 않는다(D-013).
 */
create or replace function public.rpc_remove_assignment(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_see_assignment(p_assignment_id) then
    raise exception '담당하는 반의 배정만 지울 수 있어요.';
  end if;
  if exists (
    select 1 from public.assignment_targets
    where assignment_id = p_assignment_id and attempt_id is not null
  ) then
    raise exception '이미 낸 학생이 있어 지울 수 없어요. 마감일만 바꿀 수 있어요.';
  end if;
  delete from public.assignments where id = p_assignment_id;
end;
$$;

-- ── 초대 수락 ────────────────────────────────────────────────────────────────

/**
 * 초대 링크가 가리키는 대상.
 *
 * **로그인 전에도 읽어야 한다** — `/join?invite=…`이 첫 화면인 사람이 있다. 그런데 `invites`
 * 테이블을 익명에게 열면 남의 초대까지 전부 보인다. 그래서 토큰을 아는 사람에게만
 * **필요한 두 값**(학원 이름·대상 역할)을 주는 함수를 둔다. 토큰 자체가 열쇠다.
 */
create or replace function public.rpc_invite_info(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'token', i.token,
    'academy_name', ac.name,
    'invitee_role', i.invitee_role,
    'accepted', i.accepted_at is not null,
    'expired', i.expires_at is not null and i.expires_at < now()
  )
  from public.invites i
  join public.academies ac on ac.id = i.academy_id
  where lower(btrim(i.token)) = lower(btrim(p_token));
$$;

/**
 * 초대를 수락해 학원 소속을 추가한다.
 *
 * **기존 계정에는 소속만 추가하고 새 계정을 만들지 않는다**(마스터 플랜 3절). 개인 구독은
 * 그대로 유지된다 — 이 함수는 `entitlements`를 건드리지 않는다.
 *
 * 학부모 초대는 소속이 아니라 자녀 연결이다. 어느 자녀인지는 이 토큰만으로 알 수 없어서
 * `pending` 연결을 만들지 않고 거부한다 — 화면이 다음 단계를 안내한다.
 */
create or replace function public.rpc_accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.invites;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.';
  end if;
  select * into v_invite from public.invites
  where lower(btrim(token)) = lower(btrim(p_token));
  if v_invite.token is null then
    raise exception '초대를 찾을 수 없어요.';
  end if;
  if v_invite.accepted_at is not null then
    raise exception '이미 사용한 초대예요.';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception '기간이 지난 초대예요.';
  end if;
  if v_invite.invitee_role = 'parent' then
    raise exception '학부모 초대는 자녀 확인이 필요해요.';
  end if;

  insert into public.academy_members (academy_id, user_id, member_role)
  values (
    v_invite.academy_id,
    v_uid,
    case v_invite.invitee_role when 'teacher' then 'teacher'::academy_member_role
                               else 'student'::academy_member_role end
  )
  on conflict (academy_id, user_id) do update set left_at = null;

  insert into public.user_roles (user_id, role)
  values (v_uid, case v_invite.invitee_role when 'teacher' then 'academy'::app_role
                                            else 'student'::app_role end)
  on conflict do nothing;

  update public.invites
  set accepted_at = now(), accepted_by = v_uid
  where token = v_invite.token;

  return v_invite.academy_id;
end;
$$;
