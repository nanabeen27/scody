-- 2차 독립 반박 검증(2026-08-14)이 찾은 것들. 세 가지 모두 **0029·0030이 닫은 것과 같은 계열**이다.

-- ══════════════════════════════════════════════════════════════════════════
-- 1. `tg_impersonation_append_only`도 NULL로 우회됐다
-- ══════════════════════════════════════════════════════════════════════════
--
-- 0029는 `not in`·`<>`가 NULL을 만드는 자리를 찾았다고 했지만 **트리거를 보지 않았다.**
-- 이 트리거의 가드가 `<>` 다섯 개를 `or`로 잇는다.
--
-- 실측(BEGIN…ROLLBACK 안):
--   reason → 다른 값      → P0001 `대리 보기 기록의 시작 정보는 바꿀 수 없어요.`  (가드 작동)
--   reason → NULL         → 23502 not-null violation                            (가드 건너뜀)
--   started_at → NULL     → 23502 not-null violation                            (가드 건너뜀)
--
-- `before update` 트리거라 not null 검사가 **트리거 뒤에** 돈다. 그래서 지금 막고 있는 것은
-- 가드가 아니라 컬럼 제약이다. 0029가 `rpc_submit_attempt`에 대해 근거로 든 것과 똑같은
-- 증거 모양(`P0001`이 아니라 `23502`)이다.
create or replace function public.tg_impersonation_append_only()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  /*
    `is distinct from`을 쓴다. `<>`는 한쪽이 NULL이면 NULL을 돌려주고, plpgsql의 `if NULL`은
    거짓이라 가드가 통째로 건너뛰어졌다 — 0029가 고친 것과 같은 사고다.
    실측: `reason`을 NULL로 바꾸면 `P0001`(가드)이 아니라 `23502`(not null)가 났다.
    즉 컬럼 제약만이 막고 있었고 이 가드는 지나갔다.
  */
  if new.operator_id is distinct from old.operator_id
    or new.target_id is distinct from old.target_id
    or new.reason is distinct from old.reason
    or new.ticket is distinct from old.ticket
    or new.started_at is distinct from old.started_at
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

-- ══════════════════════════════════════════════════════════════════════════
-- 2. 초대: 만료를 늘리거나 되돌릴 수 있었다
-- ══════════════════════════════════════════════════════════════════════════
--
-- 0029가 `expires_at`의 NULL 표현은 막았지만 **불변식 자체는 막지 못했다.** 실측:
--   rpc_create_invite(p_valid_days = 3_650_000)  → 만료 12019-12-23  (상한이 없었다)
--   update invites set expires_at = '9999-12-31' → 통과            (`invites_update`가 전 컬럼 허용)
--   update invites set accepted_at = null        → 통과            (한 번만 쓰는 규칙이 풀린다)
--   update invites set invitee_role = …          → 통과            (초대 역할을 바꿀 수 있다)
--
-- `accepted_at`은 `rpc_accept_invite`의 **유일한** 재사용 방지 장치다(0013:425). 그것을 되돌릴
-- 수 있으면 한 토큰을 몇 번이든 쓸 수 있다.
--
-- 상한은 함수에, 나머지는 트리거에 둔다 — 원장의 `취소`(delete)는 그대로 남긴다.
create or replace function public.rpc_create_invite(
  p_academy_id uuid,
  p_invitee_role invite_role default 'teacher',
  p_valid_days int default 14
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

  -- 충돌은 사실상 일어나지 않지만(74비트), 토큰이 기본 키라 몇 번은 다시 시도한다.
  for i in 1..5 loop
    v_token := 'INV-T-' || upper(
      substr(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 20)
    );
    begin
      insert into public.invites (token, academy_id, invitee_role, inviter_id, expires_at)
      values (
        v_token,
        p_academy_id,
        p_invitee_role,
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

/*
  초대 행의 뼈대는 만든 뒤 바뀌지 않는다. `accepted_at`만 **한 방향으로** 움직인다
  (아직 안 쓴 것 → 쓴 것). `rpc_accept_invite`가 그 전이를 하고, 그 함수는 security definer라
  소유자로 돌지만 트리거는 그래도 실행되므로 여기서 방향만 확인한다.

  원장이 초대를 되돌리는 길은 **삭제**다(`invites_delete`, 0029). 그것은 막지 않는다.
*/
create or replace function public.tg_invites_immutable()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.token is distinct from old.token
    or new.academy_id is distinct from old.academy_id
    or new.invitee_role is distinct from old.invitee_role
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

drop trigger if exists invites_immutable on public.invites;
create trigger invites_immutable
  before update on public.invites
  for each row execute function public.tg_invites_immutable();

-- ══════════════════════════════════════════════════════════════════════════
-- 3. `class_academy_id`가 익명에게 열려 있었다
-- ══════════════════════════════════════════════════════════════════════════
--
-- `security definer`인데 안에 `auth.uid()` 검사가 없고 PUBLIC 실행 권한이 남아 있었다.
-- 실측: 세션 없이 `class_academy_id('c7cfd873-…')` → `6ce693b6-…`(실제 학원 id)를 돌려줬다.
-- RLS를 우회해 `classes.academy_id`를 읽는 창구다.
--
-- 이 함수는 **정책 재귀를 끊기 위한 내부 헬퍼**다(0004 머리말). 클라이언트가 부를 일이 없다.
-- 0030에서 배운 대로 PUBLIC에서 회수한다 — `anon`에서만 빼면 PUBLIC 부여가 남아 물려받는다.
revoke execute on function public.class_academy_id(uuid) from public;
grant execute on function public.class_academy_id(uuid) to authenticated, service_role;
