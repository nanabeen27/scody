-- 가입 화면의 중복 검사를 서버가 답한다.
--
-- 무엇이 문제였나: `app/signup.tsx`가 `isPhoneTaken`·`isScodyIdTaken`으로 **번들에 실린
-- 픽스처 배열**(`ACCOUNTS` 4,186개)을 뒤졌다. 그래서 두 가지가 동시에 틀렸다.
--
--   ① 합성 로스터 번호를 넣으면 `이미 가입된 번호예요`라고 말했다 — 어느 DB에도 없는 번호다.
--   ② 실제로 `profiles`에 있는 번호는 그 배열에 없으면 통과했다.
--
-- 검사가 답해야 하는 것은 `profiles`의 사실이다. 마침 스키마가 그 검사를 위해 만들어져
-- 있다 — `0002_profiles.sql`이 `profiles_scody_id_key`(`lower(btrim(scody_id))`)와
-- `profiles_phone_digits_key`(생성 컬럼 `phone_digits`) 두 유니크 인덱스를 갖고 있다.
--
-- **왜 `security definer`인가:** 가입 화면은 로그인 전이라 `anon`으로 부른다. `profiles`의
-- select 정책은 남의 행을 열지 않으므로(0015) 일반 조회로는 답이 언제나 `false`가 된다.
-- 그래서 두 함수만 소유자 권한으로 돌고, **밖으로 내보내는 값은 boolean 하나**다 — 이름·
-- 학원·역할은 나가지 않는다.
--
-- **남은 위험(사람이 정해야 한다):** boolean 하나라도 "이 번호가 가입돼 있는가"에 답하므로
-- 번호 열거(enumeration) 오라클이다. 가입 화면이 있는 서비스의 공통 성질이지만, 운영 전에
-- 호출 상한이 필요하다. 마스터 플랜 남은 작업에 **A-100**으로 올린다.
-- (처음에 A-099로 적었는데 그 번호는 담아 둔 학습 순서 바꾸기 항목이 이미 쓰고 있었다.)

-- 번호는 숫자만 비교한다(`phone_digits`와 같은 정규화). 빈 입력은 `nullif`가 null을 만들고
-- `= null`은 참이 되지 않으므로 자동으로 `false`다 — 빈 값을 "가입됨"으로 답하지 않는다.
create or replace function public.rpc_signup_phone_taken(p_phone text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.phone_digits = nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '')
  );
$$;

comment on function public.rpc_signup_phone_taken(text) is
  '가입 화면 전용. 이 번호로 만든 프로필이 있는지 boolean 하나로만 답한다.';

-- 아이디는 유니크 인덱스와 **같은 식**으로 비교한다(`lower(btrim(...))`). 식이 달라지면
-- 검사가 통과한 아이디가 insert에서 깨진다.
create or replace function public.rpc_signup_scody_id_taken(p_scody_id text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select btrim(coalesce(p_scody_id, '')) <> ''
     and exists (
       select 1
       from public.profiles p
       where lower(btrim(p.scody_id)) = lower(btrim(p_scody_id))
     );
$$;

comment on function public.rpc_signup_scody_id_taken(text) is
  '가입 화면 전용. 이 스코디 아이디를 쓰는 프로필이 있는지 boolean 하나로만 답한다.';

-- 함수 실행 권한은 Postgres 기본이 `public`이라 이미 열려 있다. 의도를 읽을 수 있게 적어 둔다
-- (0024가 `note_learning_event`에서 `revoke`한 것과 같은 이유로 명시가 필요하다).
grant execute on function public.rpc_signup_phone_taken(text) to anon, authenticated;
grant execute on function public.rpc_signup_scody_id_taken(text) to anon, authenticated;
