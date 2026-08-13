-- 0029의 `revoke`가 듣지 않았다. 실측으로 확인하고 고친다.
--
-- 0029는 이렇게 적었다:
--
--   revoke execute on function public.rpc_create_invite(uuid, invite_role, int) from anon;
--
-- 그런데 그 뒤에도 `has_function_privilege('anon', …, 'EXECUTE')`가 **true**였다.
--
-- 원인은 `pg_proc.proacl`을 보면 바로 드러난다:
--
--   rpc_create_invite  → {=X/postgres, postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres}
--                         ↑ 이 빈 grantee가 PUBLIC이다
--   note_learning_event → {postgres=X/postgres, service_role=X/postgres}
--                         ↑ 0024가 닫은 함수에는 PUBLIC 항목이 없다
--
-- `anon`에서 revoke하면 **명시적인 `anon=X` 항목만** 사라진다. PUBLIC 부여가 남아 있으면
-- `anon`은 그것을 물려받는다. Postgres는 함수를 만들 때 EXECUTE를 PUBLIC에 기본 부여하므로,
-- 실제로 닫으려면 **PUBLIC에서** 회수하고 필요한 역할에만 다시 줘야 한다.
revoke execute on function public.rpc_create_invite(uuid, invite_role, int) from public;
grant execute on function public.rpc_create_invite(uuid, invite_role, int) to authenticated;

-- 가입 검사 두 개는 **의도적으로** 익명이 부른다(가입 화면은 로그인 전이다). 그래도 PUBLIC이
-- 아니라 필요한 두 역할에만 명시적으로 준다 — 권한이 어디서 오는지 읽을 수 있게.
revoke execute on function public.rpc_signup_phone_taken(text) from public;
revoke execute on function public.rpc_signup_scody_id_taken(text) from public;
grant execute on function public.rpc_signup_phone_taken(text) to anon, authenticated;
grant execute on function public.rpc_signup_scody_id_taken(text) to anon, authenticated;

/*
  다른 RPC들(`rpc_submit_attempt` 등)도 PUBLIC + anon 부여를 갖고 있다. 여기서 함께 손대지
  않는다 — 그 함수들은 본문 첫 줄이 `if auth.uid() is null then raise`이고, 익명 호출은 실측에서
  전부 거부된다(독립 검증에서 28개 표·6개 뷰에 대해 anon 0행을 확인했다). 권한 정리는 그
  자체로 옳지만 함수 30여 개의 부여를 한꺼번에 바꾸는 일이라 이 마이그레이션의 범위가 아니다.
  A-101로 남긴다.
*/
