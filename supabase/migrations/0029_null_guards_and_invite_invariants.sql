-- 0026·0027이 놓친 같은 계열의 구멍을 닫는다. 독립 반박 검증(2026-08-14)이 실측으로 찾았다.
--
-- ══════════════════════════════════════════════════════════════════════════
-- 0. 먼저 정정: 0026의 주장이 틀렸다
-- ══════════════════════════════════════════════════════════════════════════
--
-- 0026은 "레포 전체에서 그 모양은 `0021`·`0022` 두 곳이다"라고 적었다. **거짓이다.**
-- 그때는 `or`가 NULL을 만드는 경우만 찾고, 같은 성질을 가진 다른 연산자를 보지 않았다.
-- plpgsql에서 `if <NULL> then`은 거짓으로 처리되므로 **불리언 식이 NULL이 될 수 있는 모든
-- 가드**가 같은 사고를 낸다 — `or`뿐 아니라 `not in`·`<>`도 그렇다.
--
-- 아래 두 함수는 **본문을 다시 쓰지 않는다.** 0013의 원문을 그대로 두고 NULL 인자 검사만
-- 앞에 끼워 넣었다(원문과의 diff가 추가된 가드 줄뿐임을 확인했다). 0026에서 본문을 부분만
-- 읽고 옮겨 적어 하마터면 콘텐츠 소유권 검사와 제출 후 초안·담아둔목록 정리를 잃을 뻔했다.

-- ── 1. `rpc_add_assignment`: `not in`이 NULL을 만든다 ────────────────────────
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
  -- `not in`은 인자가 NULL이면 NULL을 돌려준다. plpgsql의 `if NULL`은 거짓이라 가드가
  -- 통째로 건너뛰어졌다(실측: 선생님이 p_class_id=null을 보내면 거부가 아니라 23502가 났다).
  if p_class_id is null then
    raise exception '반을 골라 주세요.';
  end if;
  if not exists (select 1 from public.my_class_ids() c where c = p_class_id) then
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

-- ── 2. `rpc_submit_attempt`: `<>`가 NULL을 만든다 ────────────────────────────
--
-- 두 컬럼이 `not null`이라 트랜잭션이 결국 깨지므로 지금 악용되지는 않는다. 그래도 가드가
-- 우회되는 것 자체가 결함이고, `23502` 메시지가 실패한 행의 컬럼 이름을 알려 준다.
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
  -- 아래 `<>` 비교는 한쪽이 NULL이면 NULL이 되고, plpgsql의 `if NULL`은 거짓이라 가드가
  -- 건너뛰어졌다(실측: p_source=null이면 거부가 아니라 INSERT까지 가서 23502가 났다).
  if p_source is null then
    raise exception '학습 출처가 없어요.';
  end if;
  if p_content_set_id is null then
    raise exception '어떤 학습인지 알 수 없어요.';
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

-- ══════════════════════════════════════════════════════════════════════════
-- 3. 초대의 만료를 **스키마 불변식**으로 만든다
-- ══════════════════════════════════════════════════════════════════════════
--
-- 0027은 `update invites set expires_at = now() + 14일 where expires_at is null`로 한 번
-- 채웠다. **그것으로는 지켜지지 않는다** — 실측으로 드러났다: `npm run db:verify`가 재시드하면
-- `supabase/seed.sql`이 `expires_at` 없이 초대를 다시 넣어 세 행 모두 NULL로 돌아갔다.
-- 백필 직후에 "기간 없는 미사용 초대 0건"을 확인하고 그것을 근거로 보고했는데, 그 뒤에 직접
-- 돌린 재시드가 그 사실을 무효로 만들었다.
--
-- `rpc_accept_invite`는 `expires_at is not null and expires_at < now()`만 본다. 즉
-- **NULL은 "영원히 유효"**다. 불변식이 RPC 하나와 한 번짜리 UPDATE에만 있었고 스키마에는
-- 없었다. 이제 컬럼이 스스로 지킨다 — seed와 직접 insert도 기본값을 받는다.
update public.invites
set expires_at = now() + interval '14 days'
where expires_at is null;

alter table public.invites
  alter column expires_at set default now() + interval '14 days';

alter table public.invites
  alter column expires_at set not null;

comment on column public.invites.expires_at is
  '만료 시각. not null이고 기본값이 있다 — NULL이면 rpc_accept_invite가 "영원히 유효"로 읽는다.';

-- ── 4. 초대를 만드는 문을 하나로 ────────────────────────────────────────────
--
-- `invites_write`가 `for all`이라 원장이 RPC를 건너뛰고 직접 insert할 수 있었다. 실측:
-- 원장이 `INV-T-WEAK1`을 201로 만들고 다른 사용자가 그것을 **끝까지 수락**했다.
-- 0026이 방금 닫은 것과 같은 모양이다 — 함수는 조였는데 그 옆에 제한 없는 직접 쓰기가 열려 있다.
--
-- 이 레포는 이미 답을 갖고 있다: `assignments`·`attempts`는 표 정책이 **없고**
-- `security definer` 함수만이 문이다(0015 머리말). 초대도 같게 만든다.
-- 원장이 계속 할 수 있어야 하는 것은 **취소**(update·delete)라 그것만 남긴다.
drop policy if exists invites_write on public.invites;

create policy invites_update on public.invites
  for update
  using (public.is_admin() or (public.is_director() and academy_id = public.my_academy_id()))
  with check (public.is_admin() or (public.is_director() and academy_id = public.my_academy_id()));

create policy invites_delete on public.invites
  for delete
  using (public.is_admin() or (public.is_director() and academy_id = public.my_academy_id()));

-- insert 정책은 두지 않는다. 초대는 `rpc_create_invite`(security definer)만이 만든다 —
-- 그 함수가 토큰 엔트로피·기간·초대한 사람을 함께 책임진다.

-- ── 5. 새 RPC의 기본 PUBLIC 실행 권한 정리 ──────────────────────────────────
--
-- Postgres는 함수에 EXECUTE를 PUBLIC으로 기본 부여한다. 0024가 `note_learning_event`에서 같은
-- 이유로 revoke해야 했다. `rpc_create_invite`는 로그인한 사람만 쓸 일이라 익명에서 뺀다
-- (함수 안에 `auth.uid() is null` 검사가 있어 지금도 막히지만 권한으로도 막아 둔다).
revoke execute on function public.rpc_create_invite(uuid, invite_role, int) from anon;

-- `rpc_signup_*` 둘은 **의도적으로** 익명이 부른다(가입 화면은 로그인 전이다). 대신 열거
-- 오라클이므로 호출 상한이 필요하다 — A-100으로 남긴다.
