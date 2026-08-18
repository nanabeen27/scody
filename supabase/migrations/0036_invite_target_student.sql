-- 학부모 초대에 **대상 학생**을 붙인다 (확정 정책 3절 · A-097의 학부모 몫)
--
-- ## 무엇이 막혀 있었나
--
-- 확정 정책 3절은 "학원이 학부모를 초대하면 자녀 관계를 확인하고 연결을 승인한다"고 정한다.
-- 그런데 그 경로가 **레포에 한 군데도 없었다**:
--
--   src/repo/directory.ts    초대를 만드는 유일한 호출부가 `p_invitee_role: 'teacher'` 리터럴
--   app/academy/manage.tsx   생성 버튼이 `초대 링크 만들기`(선생님) 하나
--   rpc_accept_invite (0013) 학부모 초대는 `학부모 초대는 자녀 확인이 필요해요.`로 거부
--   app/join.tsx             그래서 학부모에게는 수락 버튼 자체를 두지 않는다
--
-- 서버의 거부는 옳았다 — **어느 자녀인지 토큰만으로 알 수 없다**(0013:432의 주석 그대로).
-- 없던 것은 그 사실을 담을 자리다. 초대 행에 대상 학생을 적으면 3절의 두 단계가 제자리를 찾는다:
-- **확인**은 원장이 초대를 만들 때 자기 학원 학생 하나를 고르는 것이고, **승인**은 그 링크를 받은
-- 학부모가 수락하는 것이다. `pending` 연결을 만들어 두고 아무도 승인하지 않는 자리를 만들지 않는다
-- (`parent_children_admin_write`는 지금도 운영자 전용이고, 학원에는 승인 화면이 없다).
--
-- ## 이 초대가 주는 권한의 무게
--
-- 연결이 붙으면 학부모는 그 자녀의 **개인·학원 학습을 모두** 본다(확정 정책 2절 — 오답노트 메모와
-- 별표까지). 즉 대상 학생을 고르는 행위가 곧 권한 부여다. 그래서 경계를 넷 둔다:
--
--   1. 원장은 **자기 학원 학생만** 대상으로 지정할 수 있다(3의 소속 검사).
--   2. **그 학원 구성원은 수락할 수 없다**(4). 없으면 원장이 자기 계정으로 수락해 학생의 개인
--      학습을 여는 길이 생긴다 — 확정 정책 2절이 학원에 닫아 둔 바로 그것이다.
--   3. 수락 시점에 그 학생이 **아직 그 학원 학생**이어야 한다(4). 학원의 확인은 그때까지만 유효하다.
--   4. 토큰이 유일한 자격 증명인 것은 그대로다 — 74비트 난수(0028) · 기본 14일 만료(0029) ·
--      한 번만 수락(0031의 `tg_invites_immutable`). 읽을 수 있는 사람도 원장으로 좁힌다(6).
--
-- 남는 것: 원장이 **자기가 관리하는 다른 계정**으로 수락하는 경우는 서버가 구분할 수 없다.
-- 학부모 연결을 학원이 지정한다는 3절의 구조가 그 신뢰를 전제한다 — 학생 본인의 확인 단계를 둘지는
-- 정책 결정이라 여기서 정하지 않는다(`결정 대기`로 올린다).
--
-- ## 무엇을 바꾸지 않았나
--
--   * `parent_children`에 쓰는 문은 여전히 운영자 정책과 `security definer` 함수 둘뿐이다
--     (0029가 초대에 세운 "함수만이 문"과 같은 모양). 새 쓰기 정책을 만들지 않았다.
--   * 선생님·학생 초대의 흐름과 문장은 그대로다. `rpc_accept_invite`의 소속·역할 부여 분기를
--     건드리지 않았다.
--   * 대상 학생이 비어 있는 학부모 초대(seed와 이 마이그레이션 이전에 만든 행)는 **예전대로**
--     거부된다 — 같은 문장을 그대로 쓴다. 이미 있는 행에 뜻을 지어 붙이지 않는다.
--   * RLS는 한 곳만 손댔고 **좁히는 방향**이다(6 — 초대 읽기를 원장으로).

-- ── 1. 초대 행에 대상 학생 ──────────────────────────────────────────────────
--
-- 널을 허용한다. 선생님·학생 초대에는 대상 학생이 없고, 이 컬럼이 생기기 전에 만든 학부모
-- 초대에도 없다. `on delete cascade`는 `academy_id`와 같은 판단이다 — 그 학생이 사라지면
-- 초대는 가리킬 곳이 없다(`inviter_id`·`accepted_by`는 기록이라 `set null`이었다).
alter table public.invites
  add column if not exists target_student_id uuid references public.profiles (id) on delete cascade;

comment on column public.invites.target_student_id is
  '학부모 초대의 대상 학생. 수락하면 이 학생과 parent_children 연결이 생긴다(확정 정책 3절). '
  '선생님·학생 초대에는 없다. 비어 있는 학부모 초대는 rpc_accept_invite가 예전처럼 거부한다.';

-- 학생·선생님 초대가 대상 학생을 들고 다니지 못하게 한다. 들고 있어도 쓰이지 않지만, 쓰이지
-- 않는 값이 남아 있으면 다음 사람이 그 값을 근거로 읽는다.
-- 학부모 초대에 `not null`을 걸지는 **않는다** — 이미 있는 행(seed의 학부모 초대)이 널이다.
alter table public.invites
  drop constraint if exists invites_target_only_for_parent;

alter table public.invites
  add constraint invites_target_only_for_parent
  check (target_student_id is null or invitee_role = 'parent');

-- ── 2. 대상 학생도 만든 뒤 바뀌지 않는다 ────────────────────────────────────
--
-- 0031이 세운 불변식에 새 컬럼을 더한다. 빠뜨리면 `invites_update`(0029)를 가진 원장이 이미
-- 전달한 토큰의 대상을 **다른 학생으로 바꿀 수 있다.** 그 정책은 `academy_id`만 우리 학원인지
-- 보므로 남의 학원 학생으로 바꾸는 것도 막지 못한다. 취소하는 길은 그대로 삭제다(`invites_delete`).
create or replace function public.tg_invites_immutable()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.token is distinct from old.token
    or new.academy_id is distinct from old.academy_id
    or new.invitee_role is distinct from old.invitee_role
    or new.target_student_id is distinct from old.target_student_id
    or new.inviter_id is distinct from old.inviter_id
    or new.created_at is distinct from old.created_at
    or new.expires_at is distinct from old.expires_at
  then
    raise exception '초대의 내용과 기간은 만든 뒤 바꿀 수 없어요. 취소하려면 초대를 지워 주세요.';
  end if;
  -- 한 번 쓴 초대를 다시 쓸 수 있게 되돌리지 못한다.
  if old.accepted_at is not null and new.accepted_at is null then
    raise exception '이미 사용한 초대는 되돌릴 수 없어요.';
  end if;
  return new;
end;
$$;

-- ── 3. 초대를 만들 때 대상 학생을 받는다 ────────────────────────────────────
--
-- **인자를 더하면 새 시그니처다.** `create or replace`로는 4인자 함수가 하나 더 생기고, 기존
-- 호출(`p_academy_id`·`p_invitee_role` 두 개만 이름으로 넘긴다 — `src/repo/directory.ts`와
-- `scripts/verify-rls.ts`)이 **`function is not unique`로 죽는다.** 그래서 3인자 함수를 먼저 지운다.
-- 지우면 0029·0030이 정리한 실행 권한도 함께 사라지므로 아래에서 다시 세운다.
drop function if exists public.rpc_create_invite(uuid, invite_role, int);

create or replace function public.rpc_create_invite(
  p_academy_id uuid,
  p_invitee_role invite_role default 'teacher',
  p_valid_days int default 14,
  -- 마지막에 기본값으로 둔다 — 이름 없이 부르던 기존 호출부가 그대로 동작한다.
  p_target_student uuid default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_allowed boolean;
  v_token text;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.';
  end if;

  /*
    가드는 **전부 `coalesce`로 감싼다.** `or`/`and`가 NULL을 만들면 plpgsql의 `if not NULL`이
    거짓이 되어 가드를 통째로 건너뛴다 — 0026이 고친 것이 정확히 그 사고였다.
  */
  v_allowed := coalesce(public.is_admin(), false)
    or (coalesce(public.is_director(), false)
        and coalesce(p_academy_id = public.my_academy_id(), false));

  if not v_allowed then
    raise exception '이 학원의 초대를 만들 수 없어요.';
  end if;

  -- 상한이 없으면 `p_valid_days`를 크게 넣어 사실상 만료되지 않는 초대를 만들 수 있다
  -- (실측: 3,650,000일 → 12019년). 초대는 사람이 며칠 안에 쓰는 것이라 1년으로 묶는다.
  if p_valid_days is null or p_valid_days < 1 or p_valid_days > 365 then
    raise exception '초대 기간은 1일에서 365일 사이여야 해요.';
  end if;

  /*
    역할이 NULL이면 아래 `= 'parent'` 비교가 NULL이 되고, plpgsql의 `if NULL`은 거짓이라 학부모
    분기를 건너뛴다. 지금은 컬럼의 not null이 23502로 막지만, 그것은 **가드가 아니라 제약**이다
    (0029·0031이 같은 증거 모양으로 두 번 고친 자리). 여기서 읽을 수 있는 문장으로 막는다.
  */
  if p_invitee_role is null then
    raise exception '초대 종류를 정해 주세요.';
  end if;

  /*
    대상 학생은 **학부모 초대에만** 있다(확정 정책 3절).

    권한 경계를 여기서 못박는다: 대상은 `p_academy_id`에 **지금 소속된 학생**이어야 한다.
    이 검사가 없으면 원장이 남의 학원 학생(또는 아무 프로필)을 골라 그 학생의 개인 학습까지
    열리는 연결을 만들 수 있다 — 초대 하나로 확정 정책 2절의 공개 범위를 넘는다.
    `member_role = 'student' and left_at is null`은 M-DB-14가 로스터에 세운 기준과 같다.
  */
  if p_invitee_role = 'parent' then
    if p_target_student is null then
      raise exception '연결할 자녀를 골라 주세요.';
    end if;
    if not exists (
      select 1 from public.academy_members m
      where m.academy_id = p_academy_id
        and m.user_id = p_target_student
        and m.member_role = 'student'
        and m.left_at is null
    ) then
      raise exception '우리 학원 학생만 자녀로 지정할 수 있어요.';
    end if;
  elsif p_target_student is not null then
    -- 선생님·학생 초대에는 대상 학생이 없다. 조용히 버리지 않고 부르는 쪽의 잘못을 알린다.
    raise exception '학부모 초대에만 자녀를 지정할 수 있어요.';
  end if;

  -- 충돌은 사실상 일어나지 않지만(74비트), 토큰이 기본 키라 몇 번은 다시 시도한다.
  for i in 1..5 loop
    v_token := 'INV-T-' || upper(
      substr(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 20)
    );
    begin
      insert into public.invites
        (token, academy_id, invitee_role, target_student_id, inviter_id, expires_at)
      values (
        v_token,
        p_academy_id,
        p_invitee_role,
        p_target_student,
        v_uid,
        now() + make_interval(days => p_valid_days)
      );
      return v_token;
    exception when unique_violation then
      -- 다음 값으로 다시 뽑는다.
      null;
    end;
  end loop;

  raise exception '초대 링크를 만들지 못했어요. 다시 시도해 주세요.';
end;
$$;

comment on function public.rpc_create_invite(uuid, invite_role, int, uuid) is
  '학원 초대를 만든다. 토큰은 서버가 만든다(74비트). 원장은 자기 학원만, 운영자는 전체. '
  '학부모 초대는 p_target_student(우리 학원 재적 학생)가 필요하고, 그 학생이 수락자와 연결된다.';

-- 함수를 지우면 0029·0030이 정리한 실행 권한도 사라진다. **새 시그니처에 같은 정리를 다시 한다.**
--
-- 두 줄 다 필요하다: Postgres는 새 함수의 EXECUTE를 PUBLIC에 기본 부여하고(0030이 실측으로
-- 확인한 자리), Supabase는 `public` 스키마의 기본 권한으로 `anon`에게도 명시 부여를 남길 수 있다.
-- PUBLIC만 회수하면 명시 부여가 남고, `anon`만 회수하면 PUBLIC 부여를 물려받는다.
--
-- 0030과 **같은 역할에만** 준다(`authenticated` 하나). 함수를 다시 만든 김에 넓히지 않는다.
revoke execute on function public.rpc_create_invite(uuid, invite_role, int, uuid) from public;
revoke execute on function public.rpc_create_invite(uuid, invite_role, int, uuid) from anon;
grant execute on function public.rpc_create_invite(uuid, invite_role, int, uuid) to authenticated;

-- ── 4. 수락: 학부모 초대는 소속이 아니라 자녀 연결이다 ──────────────────────
--
-- 시그니처는 그대로다(`p_token` 하나). 대상 학생은 토큰이 가리키는 행에 있다 — 수락하는 사람이
-- 자기 자녀를 인자로 고르게 하면 초대의 확인 절차가 뜻을 잃는다.
--
-- 학부모 분기의 검사 네 개는 아래 본문에 근거와 함께 적었다: 대상 학생이 있는지 · 수락자가 그
-- 학생 본인이 아닌지 · **수락자가 그 학원 구성원이 아닌지**(확정 정책 2절) · 그 학생이 **지금도**
-- 그 학원 학생인지.
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
    /*
      대상 학생이 없는 학부모 초대는 **예전 그대로 거부한다.** 이 컬럼이 생기기 전에 만든 행
      (seed의 학부모 초대가 그렇다)이 여기 온다. 문장을 바꾸지 않는다 — `app/join.tsx`와
      `e2e/auth-flow.spec.ts`가 그 문장 기준으로 다음 단계를 안내한다.
    */
    if v_invite.target_student_id is null then
      raise exception '학부모 초대는 자녀 확인이 필요해요.';
    end if;
    -- 표 제약(`parent_children_not_self`)이 막기는 하지만, 학생 본인이 자기 초대 링크를 열었을 때
    -- 읽을 수 있는 문장을 준다.
    if v_invite.target_student_id = v_uid then
      raise exception '자기 자신을 자녀로 연결할 수 없어요.';
    end if;

    /*
      **초대한 학원의 구성원은 이 초대를 수락할 수 없다.**

      자녀 연결은 `is_my_child()`를 참으로 만들고, 그 함수는 학생의 **개인** 학습까지 연다
      (`attempts`·`attempt_answers`·`wrong_notes`·`study_queue`·`parent_notes` 선택 정책, 0015).
      확정 정책 2절은 학원이 개인 학습 상세와 개인 학습 오답노트를 볼 수 없다고 정한다. 그런데
      초대를 만드는 사람이 원장이고 토큰은 그가 화면에서 그대로 읽는 값이라, 이 검사가 없으면
      원장이 자기 계정으로 수락해 학생의 개인 학습을 여는 길이 열린다 — 초대 하나로 2절이 무너진다.

      **그래서 막는 대가**: 자녀가 자기 학원에 다니는 선생님은 이 링크로 연결할 수 없다. 서버는
      그 사람이 진짜 학부모인지 구분할 방법이 없다. 그 경우는 운영자가 연결을 만든다
      (`parent_children_admin_write`) — 넓은 경계를 열어 두는 것보다 좁게 막고 예외를 사람이
      확인하는 쪽을 택한다.
    */
    if exists (
      select 1 from public.academy_members m
      where m.academy_id = v_invite.academy_id
        and m.user_id = v_uid
        and m.left_at is null
    ) then
      raise exception '이 학원 구성원 계정으로는 자녀 연결을 수락할 수 없어요.';
    end if;

    /*
      **학원의 확인은 그 학생이 우리 학원 학생일 때만 유효하다.** 초대를 만든 뒤 소속이 끝났으면
      (`p_valid_days`는 최대 365일이다) 그 학원이 지금 확인해 줄 수 있는 관계가 아니다.
      기준은 로스터와 같다(`member_role = 'student' and left_at is null` — M-DB-14 · D-134).
    */
    if not exists (
      select 1 from public.academy_members m
      where m.academy_id = v_invite.academy_id
        and m.user_id = v_invite.target_student_id
        and m.member_role = 'student'
        and m.left_at is null
    ) then
      raise exception '초대가 가리키는 학생이 지금은 이 학원 학생이 아니에요.';
    end if;

    /*
      **확인은 이미 끝났다** — 원장이 초대를 만들 때 이 학생을 골랐다(확정 정책 3절의 "확인").
      그래서 `pending`이 아니라 `linked`로 넣는다. `pending`으로 두면 그것을 승인할 사람이
      아무도 없다(`parent_children_admin_write`는 운영자 전용이고 학원에는 승인 화면이 없다).

      이미 연결이 있으면(예: 운영자가 손으로 만든 `pending`) 그것을 살린다. `linked_at`은
      처음 값을 지킨다 — 언제부터 볼 수 있었는지가 뒤로 밀리지 않게.
    */
    insert into public.parent_children (parent_id, student_id, status, linked_at)
    values (v_uid, v_invite.target_student_id, 'linked', now())
    on conflict (parent_id, student_id) do update
      set status = 'linked',
          linked_at = coalesce(parent_children.linked_at, now());

    -- 학부모는 학원 구성원이 아니다(`invite_role` 주석, 0001) — `academy_members`에 넣지 않는다.
    -- 자녀의 학원 이름은 `is_my_child`로 이미 보인다(0023).
    insert into public.user_roles (user_id, role)
    values (v_uid, 'parent'::app_role)
    on conflict do nothing;

    update public.invites
    set accepted_at = now(), accepted_by = v_uid
    where token = v_invite.token;

    -- 어느 학원의 초대였는지는 돌려준다(학생·선생님 초대와 같은 계약). 소속이 생긴 것은 아니다.
    return v_invite.academy_id;
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

comment on function public.rpc_accept_invite(text) is
  '초대를 수락한다. 학생·선생님 초대는 academy_members 소속과 역할을 붙이고, 학부모 초대는 '
  'invites.target_student_id와 parent_children 연결(linked)을 만든다. 대상 학생이 없는 학부모 '
  '초대는 예전처럼 거부한다. 기존 계정에 더하기만 한다 — entitlements는 건드리지 않는다.';

-- ── 5. 초대 링크 화면이 어느 자녀인지 말할 수 있게 ──────────────────────────
--
-- `/join`은 로그인 전에도 열리고, 학부모는 **누구와 연결되는지 보고 수락해야 한다.** 학원 이름과
-- 역할만으로는 그 판단을 할 수 없다.
--
-- 내보내는 것은 **이름 한 개**다. `target_student_id`(uuid)나 스코디 아이디·학년은 주지 않는다 —
-- 화면이 쓰지 않고, 이 함수는 토큰만 알면 익명도 부를 수 있다(0013의 설계 그대로).
-- 토큰 자체가 열쇠라는 전제는 그대로다: 74비트 난수 · 기본 14일 · 한 번만 수락.
-- 학부모가 아닌 초대에서는 늘 null이다(위 1의 `invites_target_only_for_parent`가 보장한다).
--
-- **아직 읽는 화면이 없다.** 소비자는 `app/join.tsx`의 학부모 분기인데, 그 화면은 지금도 "이 링크
-- 만으로는 연결되지 않아요"를 말하고 수락 버튼을 두지 않는다. 그 화면을 고치는 것은 이 변경의
-- 범위가 아니다 — 없는 소비자를 있는 것처럼 적지 않으려고 여기 남긴다. `InviteLookup`·`Invite`에
-- `targetStudentName`을 더하고(`src/repo/mappers.ts`) 학부모 분기에서 수락 버튼을 여는 일이 남았다.
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
    'target_student_name', st.name,
    'accepted', i.accepted_at is not null,
    'expired', i.expires_at is not null and i.expires_at < now()
  )
  from public.invites i
  join public.academies ac on ac.id = i.academy_id
  -- `left join`이다. 대상 학생이 없는 초대(선생님·학생, 그리고 옛 학부모 초대)도 한 행을 준다.
  left join public.profiles st on st.id = i.target_student_id
  where lower(btrim(i.token)) = lower(btrim(p_token));
$$;

-- ── 6. 초대 토큰을 읽는 사람을 원장으로 좁힌다 ──────────────────────────────
--
-- `invites_select`(0015)는 `academy_id = my_academy_id()`였다. 그 함수는 **선생님에게도** 학원
-- id를 주므로(0003), 선생님이 우리 학원 초대의 `token` 컬럼을 전부 읽을 수 있었다.
--
-- 초대를 만드는 것은 원장만이고(확정 정책 3절 · `rpc_create_invite`의 `is_director()`), 선생님이
-- 초대 토큰을 읽어야 할 화면은 없다 — `loadInvites`를 부르는 자리는 학원 관리의 원장 분기 하나다
-- (`app/academy/manage.tsx`). 그런데 위 4가 보여 준 대로 학부모 초대 토큰은 이제 **학생의 개인
-- 학습을 여는 자격 증명**이다. 읽을 이유가 없는 사람에게서 닫는다.
--
-- 취소(update·delete)는 이미 `is_director()`로 좁혀져 있었다(0029). 이제 세 동작의 범위가 같다.
drop policy if exists invites_select on public.invites;

create policy invites_select on public.invites
  for select using (
    (public.is_director() and academy_id = public.my_academy_id()) or public.is_admin()
  );
