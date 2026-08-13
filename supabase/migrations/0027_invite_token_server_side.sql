-- 초대 토큰을 서버가 만들고, 기간과 초대한 사람을 남긴다.
--
-- ## 무엇이 문제였나
--
-- `src/repo/directory.ts`의 `inviteTeacher`가 토큰을 브라우저에서 만들었다:
--
--   `INV-T-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
--
-- 셋이 동시에 잘못됐다.
--
--   ① **엔트로피**: base36 6자 ≈ 2.2×10⁹. `Math.random()`은 암호용 난수가 아니라 시드를
--      복원하면 다음 값을 예측할 수 있다.
--   ② **기간이 없다**: insert가 `expires_at`을 쓰지 않아 live `invites` 세 행 모두 null이다.
--      `rpc_accept_invite`는 `expires_at`을 제대로 검사하지만, null이면 "영원히 유효"가 된다.
--      화면(`loadInvites`)은 그 null을 보고 언제나 `pending`이라고 말한다.
--   ③ **초대한 사람이 없다**: `inviter_id`도 쓰지 않아 누가 만든 초대인지 남지 않는다.
--
-- 토큰은 `rpc_accept_invite`의 **유일한 자격 증명**이다 — 그것 하나로 `academy_members`에
-- 소속이 생기고 `user_roles`에 `academy` 역할이 붙는다(0013:436-448). 그리고 `rpc_invite_info`는
-- 일부러 anon이 부를 수 있다(초대 링크는 로그인 전에 열린다). 즉 추측한 토큰을 확인할 창구가
-- 열려 있다. 그래서 추측 비용을 올리는 것이 유일한 방어다.
--
-- ## 고치는 방법
--
-- 토큰을 **서버에서** `pgcrypto`의 `gen_random_bytes`로 만든다(0001이 이미 확장을 켠다).
-- 8바이트 = 64비트 ≈ 1.8×10¹⁹ — 앞의 2.2×10⁹에서 약 80억 배다.
--
-- 형태는 `INV-T-` + 대문자 16자 hex로 둔다. 사람이 읽고 전달할 수 있어야 하고(`INV-T-` 접두어는
-- `e2e/academy-flow.spec.ts:271`이 단정한다), hex는 O/0·I/1이 섞이지 않는다.

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

  -- 충돌은 사실상 일어나지 않지만(64비트), 토큰이 기본 키라 한 번은 다시 시도한다.
  for i in 1..5 loop
    v_token := 'INV-T-' || upper(encode(gen_random_bytes(8), 'hex'));
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
      -- 다음 바이트로 다시 뽑는다.
      null;
    end;
  end loop;

  raise exception '초대 링크를 만들지 못했어요. 다시 시도해 주세요.';
end;
$$;

comment on function public.rpc_create_invite(uuid, invite_role, int) is
  '초대 토큰을 서버에서 만든다. 토큰이 accept의 유일한 자격 증명이라 엔트로피가 서버에 있어야 '
  '한다. 기간(expires_at)과 초대한 사람(inviter_id)을 함께 남긴다.';

grant execute on function public.rpc_create_invite(uuid, invite_role, int) to authenticated;

-- 기간 없이 만들어져 **영원히 유효한** 기존 초대에 기간을 준다. 아직 쓰지 않은 것만 손댄다 —
-- 이미 수락된 초대의 기간을 바꾸면 기록이 바뀐다.
--
-- 기준을 `created_at`이 아니라 `now()`로 잡는다. `created_at + 14일`로 계산하면 오래된 초대가
-- 이 마이그레이션 때문에 **소급해서 만료**되는데, 그러면 seed 토큰으로 초대 화면을 검증하는
-- E2E(`auth-flow`의 `초대 링크는 역할과 학원을 인식한다`)가 스키마 변경만으로 깨진다.
-- 지금 살아 있는 초대는 살아 있는 채로 두고, 앞으로 14일의 기한만 붙인다.
update public.invites
set expires_at = now() + interval '14 days'
where expires_at is null
  and accepted_at is null;
