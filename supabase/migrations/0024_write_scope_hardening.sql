-- 쓰기 경로를 실제로 막는다.
--
-- 독립 감사 3건이 공통으로 지적한 것: **읽기 정책은 촘촘한데 쓰기 정책이 넓다.** 정책이
-- `for all`이거나 한 컬럼만 검사해서, 로그인한 사람이 지표·기록·작성자를 손으로 바꿀 수 있었다.
--
-- 여기서 고치는 것은 전부 "정책이 의도한 것보다 넓다"는 한 종류다.

-- ── 1. 자동저장 답안이 저장되지 않던 결함 ───────────────────────────────────
--
-- `saveDraft`가 `onConflict: 'student_id,question_id,source,assignment_id,content_set_id'`를 보낸다.
-- 그런데 유일한 유니크 인덱스는 **표현식**(`coalesce(assignment_id, content_set_id)`)이라
-- `on conflict`가 컬럼 목록으로 그 인덱스를 찾지 못한다 → 매번 `42P10`.
--
-- 실제로 어떻게 드러났나: 저장 실패가 `console.warn`으로만 남아서 화면은 답을 고른 것처럼
-- 보였고, 새로고침하면 사라졌다. `이어서 하기`가 새로고침 뒤에 절대 켜지지 않았다.
-- `answer_drafts_event` 트리거도 못 돌아서 `answer_saved` 활동이 제출 때만 생겼다.
--
-- 컬럼 목록과 **똑같은 모양**의 제약을 만든다. `nulls not distinct`가 있어야 개인 학습
-- (`assignment_id is null`)도 같은 행으로 합쳐진다.
alter table public.answer_drafts
  add constraint answer_drafts_target_key
  unique nulls not distinct (student_id, question_id, source, assignment_id, content_set_id);

-- ── 2. 활동 지표를 손으로 넣을 수 있었다 ────────────────────────────────────
--
-- `note_learning_event`는 `security definer`이고 `p_student`를 인자로 받는다. PostgREST가
-- 모든 public 함수를 노출하므로 `POST /rest/v1/rpc/note_learning_event`로 **남의 id로**
-- 활동을 만들 수 있었다. `learning_events`는 append-only라 지울 수도 없다.
--
-- 트리거에서만 부르는 함수다. 클라이언트 역할에서 실행 권한을 뺀다.
revoke execute on function public.note_learning_event(uuid, learning_event_kind, uuid, boolean)
  from public, anon, authenticated;

-- 트리거 함수는 세 개 다 `security definer`라 표 소유자로 돌고, 소유자 권한은 그대로다.
--
-- 읽기 판단 헬퍼(`can_read_student`·`is_my_child`·`has_role` 등)는 **뺄 수 없다**. RLS 정책
-- 안의 함수 호출은 조회하는 역할의 권한으로 평가되므로, 실행 권한을 빼면 정책 자체가 깨진다.
-- 그 함수들은 인자로 받은 대상을 판단만 하고 아무것도 노출하지 않아 노출돼도 해가 없다.

-- ── 3. 감사 로그에 누구나 남의 이름으로 넣을 수 있었다 ──────────────────────
--
-- `audit_logs_insert`가 `actor_id = auth.uid()`만 봤다. `actor_name`·`action`·`subject_id`는
-- 자유였고 표는 append-only라 지울 수 없다. 학생이 원장 이름으로 `대리 보기` 기록을 만들면
-- 그대로 남는다.
--
-- 감사 로그를 쓰는 사람은 운영자뿐이다(요금 변경·콘텐츠 등록·대리 보기).
drop policy if exists audit_logs_insert on public.audit_logs;

create policy audit_logs_insert on public.audit_logs
  for insert with check (public.is_admin() and actor_id = auth.uid());

-- ── 4. 대리 보기 기록을 본인이 지울 수 있었다 ───────────────────────────────
--
-- `impersonation_write for all`은 DELETE·UPDATE를 포함한다. 운영자가 남의 데이터를 열어 본 뒤
-- 자기 행을 지우면 흔적이 남지 않는다. 접속기록은 행위자가 지울 수 없어야 한다.
drop policy if exists impersonation_write on public.impersonation_sessions;

create policy impersonation_insert on public.impersonation_sessions
  for insert with check (public.is_admin() and operator_id = auth.uid());

-- 종료 처리만 허용한다. 시작 정보(대상·사유·티켓)는 바꿀 수 없다 — 아래 트리거가 지킨다.
create policy impersonation_finish on public.impersonation_sessions
  for update using (public.is_admin() and operator_id = auth.uid())
  with check (public.is_admin() and operator_id = auth.uid());

create or replace function public.tg_impersonation_append_only()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.operator_id <> old.operator_id
    or new.target_id <> old.target_id
    or new.reason <> old.reason
    or coalesce(new.ticket, '') <> coalesce(old.ticket, '')
    or new.started_at <> old.started_at
  then
    raise exception '대리 보기 기록의 시작 정보는 바꿀 수 없어요.';
  end if;
  -- 한 번 닫힌 기록은 다시 열거나 고칠 수 없다.
  if old.ended_at is not null then
    raise exception '이미 끝난 대리 보기 기록이에요.';
  end if;
  return new;
end;
$$;

drop trigger if exists impersonation_append_only on public.impersonation_sessions;
create trigger impersonation_append_only
  before update on public.impersonation_sessions
  for each row execute function public.tg_impersonation_append_only();

-- ── 5. 원장 권한이 학원 경계를 넘었다 ───────────────────────────────────────
--
-- `is_director()`가 **어느 학원의** 원장인지 보지 않았다. 그래서 A학원 원장이 B학원 선생으로
-- 초대를 수락하면 B학원 전체에 원장 권한이 생겼다(반·학생·교직원 쓰기, 학생 메모 열람).
--
-- 그리고 `my_academy_id()`가 `order by` 없는 `limit 1`이라 어느 학원인지 비결정적이었다.
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
  -- 원장 소속을 먼저, 그 다음 오래된 소속 순. 값이 매번 같아야 권한도 같다.
  order by (member_role = 'director') desc, joined_at, academy_id
  limit 1;
$$;

create or replace function public.is_director()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.academy_members
    where user_id = auth.uid()
      and left_at is null
      and member_role = 'director'
      -- 권한을 쓰는 학원과 같은 학원의 원장일 때만이다.
      and academy_id = public.my_academy_id()
  );
$$;

-- ── 6. 소속이 끝난 학생의 메모를 선생님이 계속 읽었다 ───────────────────────
--
-- `can_see_student`의 선생 분기가 `class_students`만 봤다. `removeMember`는
-- `academy_members.left_at`만 채우고 `class_students`는 그대로 둔다. 그래서 원장은 접근을
-- 잃는데(원장 분기가 소속을 본다) 선생님은 그 학생의 `dig`를 계속 읽었다.
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
      -- 지금도 그 학원 학생인지 함께 본다. 소속이 끝나면 메모도 닫힌다.
      join public.academy_members m
        on m.user_id = cs.student_id
       and m.academy_id = c.academy_id
       and m.left_at is null
       and m.member_role = 'student'
      where cs.student_id = target
        and cs.removed_at is null
        and c.archived_at is null
        and c.teacher_id = auth.uid()
    )
  end;
$$;

-- ── 7. 주간 요약의 작성자를 남의 이름으로 쓸 수 있었다 ──────────────────────
--
-- `week_summaries_write for all`이 `created_by`·`by_ai`를 검사하지 않았고 DELETE도 열려 있었다.
-- 그 주 안에서는 요약이 유지돼야 한다(D-030) — 지우는 경로는 없어야 한다.
drop policy if exists week_summaries_write on public.week_summaries;

create policy week_summaries_insert on public.week_summaries
  for insert with check (public.is_my_child(child_id) and created_by = auth.uid());

create policy week_summaries_update on public.week_summaries
  for update using (public.is_my_child(child_id))
  with check (public.is_my_child(child_id) and created_by = auth.uid());

-- ── 8. 자녀가 칭찬의 보낸 사람을 바꿀 수 있었다 ─────────────────────────────
--
-- `praises_seen`이 `child_id`만 검사해서 `from_user_id`·`kind`·`sent_on`도 바꿀 수 있었다.
-- 화면은 `from_user_id`를 조인해 이름을 보여 주므로, 보내지 않은 사람의 칭찬이 만들어졌다.
create or replace function public.tg_praise_seen_only()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  -- 확인 처리 외에는 아무것도 바뀌지 않는다.
  new.child_id := old.child_id;
  new.from_user_id := old.from_user_id;
  new.kind := old.kind;
  new.sent_on := old.sent_on;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists praise_seen_only on public.praises;
create trigger praise_seen_only
  before update on public.praises
  for each row execute function public.tg_praise_seen_only();

-- ── 9. 재풀이 요청을 지울 수 있었다 ─────────────────────────────────────────
--
-- `canceled_at`을 둔 이유가 "취소를 기록으로 남긴다"는 것이다(0008). `for all`은 DELETE를
-- 포함해서 그 기록을 없앨 수 있었다.
drop policy if exists retry_requests_write on public.retry_requests;

create policy retry_requests_insert on public.retry_requests
  for insert with check (requested_by = auth.uid() and public.is_my_child(student_id));

create policy retry_requests_update on public.retry_requests
  for update using (requested_by = auth.uid() and public.is_my_child(student_id))
  with check (requested_by = auth.uid() and public.is_my_child(student_id));

-- ── 10. 로그인 식별자와 카카오 연결 상태를 본인이 바꿀 수 있었다 ────────────
--
-- `profiles_update_self`가 본인 행의 **모든** 컬럼을 열었고, 불변 트리거는
-- `support_code`·`created_at`만 막았다. `scody_id`는 로그인 키이고(유니크라 선점 가능),
-- `kakao_linked`는 인증 상태를 주장하는 값이다. 둘 다 본인이 정할 값이 아니다.
--
-- 트리거에 `set search_path`가 없던 것도 함께 고친다 — 이 레포에서 유일한 예외였다.
create or replace function public.tg_profiles_immutable()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  new.support_code := old.support_code;
  new.created_at := old.created_at;
  new.scody_id := old.scody_id;
  new.kakao_linked := old.kakao_linked;
  return new;
end;
$$;

-- ── 11. 요금 정책을 모두가 읽었다 ───────────────────────────────────────────
--
-- `pricing_policies_select`가 로그인한 모두에게 열려 있어서 학생·선생이 학원 좌석 단가,
-- 좌석 할인율, 연간 공유율 같은 B2B 계약 조건을 읽을 수 있었다.
--
-- 화면이 실제로 필요한 것은 `대신 내주기`의 개인 요금 두 개뿐이다. 그것만 따로 준다.
drop policy if exists pricing_policies_select on public.pricing_policies;

create policy pricing_policies_select on public.pricing_policies
  for select using (public.is_admin());

create or replace view public.v_public_pricing as
  select student_paid, parent_paid, effective_from
  from public.pricing_policies
  where effective_from <= now()
  order by effective_from desc
  limit 1;

grant select on public.v_public_pricing to authenticated;
