-- 행 수준 보안(RLS).
--
-- ## 원칙
--
-- 1. **모든 표에 RLS를 켠다. 정책이 없으면 거부다**(닫힌 기본값).
-- 2. 확정 정책 2절의 데이터 공개 범위를 여기서 강제한다 — 화면 숨김이 아니라 DB가 판단한다.
-- 3. **쓰기 경로가 원자성을 요구하거나 여러 표를 함께 건드리면 정책을 두지 않고 RPC만 남긴다**
--    (`assignments`·`attempts` 등). `security definer` 함수가 유일한 문이 되어, 화면이 우회로
--    한 행만 바꿀 수 없다.
-- 4. 학원은 **배정 학습만** 본다. 개인 학습 오답·별표·이해 완료·고른 답은 어떤 정책으로도
--    닿지 않고, 학원용 뷰(`v_academy_visible_notes`)에는 그 컬럼이 아예 없다.

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.academies enable row level security;
alter table public.academy_members enable row level security;
alter table public.classes enable row level security;
alter table public.class_students enable row level security;
alter table public.invites enable row level security;
alter table public.parent_children enable row level security;
alter table public.content_sets enable row level security;
alter table public.questions enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_targets enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.answer_drafts enable row level security;
alter table public.wrong_notes enable row level security;
alter table public.study_queue enable row level security;
alter table public.retry_requests enable row level security;
alter table public.praises enable row level security;
alter table public.week_summaries enable row level security;
alter table public.parent_payment_offers enable row level security;
alter table public.entitlements enable row level security;
alter table public.pricing_policies enable row level security;
alter table public.payment_records enable row level security;
alter table public.audit_logs enable row level security;
alter table public.impersonation_sessions enable row level security;
alter table public.learning_events enable row level security;

-- ── 계정 ─────────────────────────────────────────────────────────────────────

/*
  프로필 읽기. 본인 · 연결된 자녀 · 학원 범위의 학생 · 같은 학원 교직원 · 운영자.

  같은 학원 교직원을 여는 이유: 반 담당자를 고르는 화면과 선생님 목록이 이름을 보여 준다.
  다른 학원 계정에는 아무것도 주지 않는다.
*/
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or public.is_my_child(id)
    or public.can_see_student(id)
    or (
      public.my_academy_id() is not null
      and exists (
        select 1 from public.academy_members m
        where m.user_id = profiles.id
          and m.academy_id = public.my_academy_id()
          and m.left_at is null
      )
    )
    or public.is_admin()
  );

-- 가입 직후 본인 프로필을 만든다. 남의 id로는 만들 수 없다.
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());

-- 이름·번호·학년만 본인이 바꾼다. `support_code`는 바꿀 수 없어야 하지만 컬럼 단위 제한은
-- 정책으로 표현할 수 없어서 트리거로 막는다(아래).
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

/**
 * 고객지원 코드와 가입일은 바꿀 수 없다.
 * 코드는 사용자가 문의에서 말하는 값이고, 가입일은 코호트의 기준선이다.
 */
create or replace function public.tg_profiles_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.support_code <> old.support_code then
    raise exception '고객지원 코드는 바꿀 수 없어요.';
  end if;
  if new.created_at <> old.created_at then
    raise exception '가입일은 바꿀 수 없어요.';
  end if;
  return new;
end;
$$;

create trigger profiles_immutable
  before update on public.profiles
  for each row execute function public.tg_profiles_immutable();

-- 역할은 본인과 운영자만 본다. 학원 화면은 소속(`academy_members`)으로 판단한다.
create policy user_roles_select on public.user_roles
  for select using (user_id = auth.uid() or public.is_admin());

-- 가입 시 본인 역할을 정한다. 운영자 역할은 스스로 붙일 수 없다.
create policy user_roles_insert_self on public.user_roles
  for insert with check (user_id = auth.uid() and role <> 'admin');

create policy user_roles_admin_all on public.user_roles
  for all using (public.is_admin()) with check (public.is_admin());

-- ── 학원 ─────────────────────────────────────────────────────────────────────

-- 소속 구성원과 운영자만 학원 정보를 본다.
create policy academies_select on public.academies
  for select using (
    id = public.my_academy_id()
    or public.is_admin()
    or exists (
      select 1 from public.academy_members m
      where m.academy_id = academies.id and m.user_id = auth.uid() and m.left_at is null
    )
  );

-- 계약 좌석·갱신일은 운영자만 만든다·바꾼다.
create policy academies_admin_write on public.academies
  for all using (public.is_admin()) with check (public.is_admin());

create policy academy_members_select on public.academy_members
  for select using (
    user_id = auth.uid()
    or academy_id = public.my_academy_id()
    or public.is_admin()
  );

-- 소속을 넣고 빼는 것은 원장과 운영자만. 초대 수락 경로는 `rpc_accept_invite`가 따로 있다.
create policy academy_members_write on public.academy_members
  for all
  using (public.is_admin() or (public.is_director() and academy_id = public.my_academy_id()))
  with check (public.is_admin() or (public.is_director() and academy_id = public.my_academy_id()));

/*
  반 읽기. 학원 교직원(원장은 전체·선생님도 목록에서 전체를 보고 상세는 `my_class_ids`로
  좁힌다) · 그 반 학생 · 자녀가 속한 반의 학부모 · 운영자.

  선생님에게 학원 전체 반 목록을 여는 이유: 배정 화면이 담당 반만 보여 주지만, 학생 상세는
  그 학생이 속한 다른 반 이름을 함께 말한다. 반 이름은 학습 기록이 아니다.
*/
create policy classes_select on public.classes
  for select using (
    academy_id = public.my_academy_id()
    or public.is_admin()
    -- `class_students`를 직접 조회하면 그 표의 정책이 다시 `classes`를 보아 재귀가 된다
    -- (`in_class`가 `security definer`로 그 고리를 끊는다 — `0004_parent_children.sql`).
    or public.in_class(id)
  );

-- 반 관리는 원장만(마스터 플랜 3절: 원장은 반·학생 관리, 선생님은 배정·결과).
create policy classes_write on public.classes
  for all
  using (public.is_admin() or (public.is_director() and academy_id = public.my_academy_id()))
  with check (public.is_admin() or (public.is_director() and academy_id = public.my_academy_id()));

-- `classes`를 직접 조회하지 않는다(위 `classes_select`와 재귀가 된다). `class_academy_id`가
-- `security definer`로 학원만 알려 준다.
create policy class_students_select on public.class_students
  for select using (
    student_id = auth.uid()
    or public.is_my_child(student_id)
    or public.is_admin()
    or public.class_academy_id(class_id) = public.my_academy_id()
  );

create policy class_students_write on public.class_students
  for all
  using (
    public.is_admin()
    or (public.is_director() and public.class_academy_id(class_id) = public.my_academy_id())
  )
  with check (
    public.is_admin()
    or (public.is_director() and public.class_academy_id(class_id) = public.my_academy_id())
  );

/*
  초대. **익명에게는 열지 않는다** — 토큰을 아는 사람은 `rpc_invite_info(token)`으로
  학원 이름과 대상 역할만 받는다. 표 자체를 열면 남의 초대까지 전부 보인다.
*/
create policy invites_select on public.invites
  for select using (academy_id = public.my_academy_id() or public.is_admin());

create policy invites_write on public.invites
  for all
  using (public.is_admin() or (public.is_director() and academy_id = public.my_academy_id()))
  with check (public.is_admin() or (public.is_director() and academy_id = public.my_academy_id()));

-- ── 학부모–자녀 ──────────────────────────────────────────────────────────────

create policy parent_children_select on public.parent_children
  for select using (
    parent_id = auth.uid() or student_id = auth.uid() or public.is_admin()
  );

-- 연결 승인은 운영자·학원 초대 경로에서 다룬다. 학부모가 스스로 자녀를 붙일 수는 없다.
create policy parent_children_admin_write on public.parent_children
  for all using (public.is_admin()) with check (public.is_admin());

-- ── 콘텐츠 ───────────────────────────────────────────────────────────────────

create policy content_sets_select on public.content_sets
  for select using (public.can_read_content(id));

-- 등록: 운영자, 또는 자기 학원 이름으로 등록하는 학원 교직원.
create policy content_sets_insert on public.content_sets
  for insert with check (
    public.is_admin()
    or (owner_academy_id is not null and owner_academy_id = public.my_academy_id())
  );

/*
  **수정·삭제 정책을 두지 않는다.** 등록한 콘텐츠를 고치거나 지우는 화면이 아직 없고(Q-034),
  배정된 뒤에 문항을 고치면 학생이 푼 기록과 어긋난다. 그 결정과 감사 로그를 함께 정할 때
  정책을 더한다.
*/

create policy questions_select on public.questions
  for select using (public.can_read_content(content_set_id));

create policy questions_insert on public.questions
  for insert with check (
    exists (
      select 1 from public.content_sets s
      where s.id = questions.content_set_id
        and (
          public.is_admin()
          or (s.owner_academy_id is not null and s.owner_academy_id = public.my_academy_id())
        )
    )
  );

-- ── 배정과 풀이 ──────────────────────────────────────────────────────────────
--
-- **쓰기 정책이 없다.** 배정·재배정·삭제·제출은 전부 `rpc_*` 함수를 지나야 한다
-- (`0013_functions.sql`). 한 표만 바꾸는 우회로를 남기면 제출 표시와 풀이 기록이 갈린다.

create policy assignments_select on public.assignments
  for select using (
    class_id in (select public.my_class_ids())
    or public.is_admin()
    or exists (
      select 1 from public.assignment_targets t
      where t.assignment_id = assignments.id
        and (t.student_id = auth.uid() or public.is_my_child(t.student_id))
    )
    -- 반에 속해 있으면 아직 대상 행이 없어도 배정을 본다(반 배정 직후의 잠깐).
    or public.in_class(class_id)
  );

create policy assignment_targets_select on public.assignment_targets
  for select using (
    public.can_read_student(student_id)
    or public.can_see_assignment(assignment_id)
    or public.is_admin()
  );

/*
  풀이 기록. **본인과 연결된 학부모, 그리고 운영자만** 읽는다.

  학원은 여기 없다 — 개인 학습 상세를 열람할 수 없다(확정 정책 2절). 학원이 보는 배정 제출
  결과는 `v_assignment_submissions` 뷰가 따로 준다.
*/
create policy attempts_select on public.attempts
  for select using (public.can_read_student(student_id) or public.is_admin());

create policy attempt_answers_select on public.attempt_answers
  for select using (
    exists (
      select 1 from public.attempts a
      where a.id = attempt_answers.attempt_id
        and (public.can_read_student(a.student_id) or public.is_admin())
    )
  );

-- 답안 초안은 본인만. 학부모도 보지 않는다 — 제출 전 중간 상태다.
create policy answer_drafts_own on public.answer_drafts
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());

-- ── 오답노트 · 담아 둔 학습 · 재풀이 ─────────────────────────────────────────

create policy wrong_notes_select on public.wrong_notes
  for select using (public.can_read_student(student_id) or public.is_admin());

-- 담고 지우고 메모하고 별표하는 것은 **본인만**. 학부모도 학원도 쓰지 않는다.
create policy wrong_notes_write on public.wrong_notes
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());

create policy study_queue_select on public.study_queue
  for select using (public.can_read_student(student_id) or public.is_admin());

create policy study_queue_write on public.study_queue
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());

create policy retry_requests_select on public.retry_requests
  for select using (public.can_read_student(student_id) or public.is_admin());

-- 재풀이 요청은 **연결된 학부모**가 만든다. 본인이 자기에게 요청할 일은 없다.
create policy retry_requests_write on public.retry_requests
  for all
  using (requested_by = auth.uid() and public.is_my_child(student_id))
  with check (requested_by = auth.uid() and public.is_my_child(student_id));

-- ── 학부모 기능 ──────────────────────────────────────────────────────────────

create policy praises_select on public.praises
  for select using (
    child_id = auth.uid() or from_user_id = auth.uid() or public.is_admin()
  );

create policy praises_insert on public.praises
  for insert with check (from_user_id = auth.uid() and public.is_my_child(child_id));

-- 자녀가 자기 칭찬을 확인해 닫는다.
create policy praises_seen on public.praises
  for update using (child_id = auth.uid()) with check (child_id = auth.uid());

create policy week_summaries_select on public.week_summaries
  for select using (public.can_read_student(child_id) or public.is_admin());

create policy week_summaries_write on public.week_summaries
  for all using (public.is_my_child(child_id)) with check (public.is_my_child(child_id));

create policy parent_payment_offers_select on public.parent_payment_offers
  for select using (
    parent_id = auth.uid() or child_id = auth.uid() or public.is_admin()
  );

create policy parent_payment_offers_write on public.parent_payment_offers
  for all
  using (parent_id = auth.uid() and public.is_my_child(child_id))
  with check (parent_id = auth.uid() and public.is_my_child(child_id));

-- ── 이용권 · 요금 · 결제 ─────────────────────────────────────────────────────

create policy entitlements_select on public.entitlements
  for select using (
    user_id = auth.uid() or public.is_my_child(user_id) or public.is_admin()
  );

-- 이용권을 주고 해지하는 것은 운영자만. 결제 연동이 붙으면 서버 함수가 대신한다.
create policy entitlements_admin_write on public.entitlements
  for all using (public.is_admin()) with check (public.is_admin());

/*
  요금 정책은 로그인한 사용자 누구나 읽는다 — 학부모의 `대신 내주기` 화면이 금액을 말한다.
  **쌓기만 하고 고치지 않는다**(이력이다).
*/
create policy pricing_policies_select on public.pricing_policies
  for select using (auth.uid() is not null);

create policy pricing_policies_insert on public.pricing_policies
  for insert with check (public.is_admin() and updated_by = auth.uid());

create policy payment_records_select on public.payment_records
  for select using (user_id = auth.uid() or public.is_admin());

-- 결제 기록을 쓰는 코드는 아직 없다. 정책도 두지 않는다.

-- ── 운영 기록 ────────────────────────────────────────────────────────────────

create policy audit_logs_select on public.audit_logs
  for select using (public.is_admin());

/*
  **append-only.** 넣을 수만 있다 — `update`·`delete` 정책이 없으므로 아무도 지울 수 없다.
  자기 이름으로만 남긴다(`actor_id = auth.uid()`).
*/
create policy audit_logs_insert on public.audit_logs
  for insert with check (actor_id = auth.uid());

create policy impersonation_select on public.impersonation_sessions
  for select using (operator_id = auth.uid() or public.is_admin());

create policy impersonation_write on public.impersonation_sessions
  for all
  using (public.is_admin() and operator_id = auth.uid())
  with check (public.is_admin() and operator_id = auth.uid());

/*
  학습 활동 이벤트. 본인과 운영자가 읽는다.
  **쓰기 정책이 없다** — 트리거(`security definer`)만 넣는다. 손으로 넣을 수 있으면 활성 지표를
  올릴 수 있고, 그러면 지표가 행동을 세는 것이 아니라 호출을 세는 것이 된다.
*/
create policy learning_events_select on public.learning_events
  for select using (student_id = auth.uid() or public.is_admin());
