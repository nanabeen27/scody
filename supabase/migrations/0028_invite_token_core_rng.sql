-- `rpc_create_invite`가 실행되지 않던 것을 고친다.
--
-- 0027이 토큰을 `gen_random_bytes(8)`로 만들었는데 원장이 부르면 이렇게 실패했다(실측):
--
--   function gen_random_bytes(integer) does not exist
--
-- 원인: Supabase는 `pgcrypto`를 `public`이 아니라 **`extensions` 스키마**에 설치한다(실측:
-- `pg_extension` → `pgcrypto`/`uuid-ossp` 둘 다 `extensions`). 이 함수는
-- `set search_path = public, pg_temp`로 고정돼 있어서 그 스키마를 보지 못한다. `search_path`를
-- 고정하는 것은 0024가 모든 `security definer` 함수에 적용한 규칙이라 풀 수 없다.
--
-- `extensions.gen_random_bytes(8)`로 스키마를 붙이는 방법도 있지만 그러면 이 마이그레이션이
-- Supabase 전용이 된다 — 0001은 `create extension if not exists pgcrypto`를 스키마 없이
-- 부르므로 일반 Postgres에서는 `public`에 들어간다.
--
-- 그래서 **`pg_catalog.gen_random_uuid()`** 를 쓴다. PostgreSQL 13부터 코어에 있어서
-- (실측: `pg_proc`에 `pg_catalog.gen_random_uuid`가 있다) `search_path`와 무관하게 늘 닿고,
-- 확장에 의존하지 않는다. 값은 v4 UUID라 암호학적으로 강한 난수원에서 나온다.
--
-- 엔트로피: 하이픈을 뺀 32자 hex에서 앞 20자를 쓴다. v4는 13번째 자리가 버전('4')으로
-- 고정되고 17번째 자리에 변이 비트 2개가 박히므로, 20자 = 80비트 중 **74비트가 난수**다.
-- 예전 `Math.random()` base36 6자(≈31비트)에서 크게 올라간다.
--
-- 형태는 그대로 `INV-T-` + 대문자 hex다(`e2e/academy-flow.spec.ts:271`이 접두어를 단정한다).

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

  if p_valid_days is null or p_valid_days < 1 then
    raise exception '초대 기간이 올바르지 않아요.';
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
