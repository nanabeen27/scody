-- 좌석 단가 뷰에서 익명 권한을 회수한다
--
-- 0034가 `grant select ... to authenticated`만 했다. 그런데 Supabase 프로젝트에는
-- `alter default privileges ... grant all on tables to anon, authenticated`가 걸려 있어서,
-- **새로 만든 뷰에 `anon`이 select 권한을 그대로 갖는다**(0032가 함수에서 배운 것의 관계 버전 —
-- `revoke ... from public`으로는 역할에 명시적으로 부여된 권한이 지워지지 않는다).
--
-- 오늘 새는 것은 없다: 뷰 본문의 `is_director()`가 익명에게 거짓이라 0행이다. 다만 그러면
-- 노출을 막는 벽이 뷰 본문 **한 겹**뿐이다. 벽을 둘로 만든다.
--
-- 근거(실측): `scripts/verify-rls.ts`의 `익명에게 좌석 단가 뷰가 0행`이 통과했다. 그 검사의
-- `count()`는 권한 오류에 `-1`을 돌려주므로(`verify-rls.ts`), 통과했다는 것은 익명이
-- **권한을 가진 상태로 0행**을 받았다는 뜻이다.

revoke select on public.v_academy_seat_pricing from anon;
