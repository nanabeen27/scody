-- `class_academy_id`가 익명에게 학원 id를 알려 주던 것을 막는다.
--
-- 실측: 세션 없이 `class_academy_id('c7cfd873-…')` → `6ce693b6-…`(실제 학원 id).
-- `security definer`라 RLS를 우회해 `classes.academy_id`를 읽고, 안에 `auth.uid()` 검사가 없다.
--
-- ## 왜 실행 권한 회수가 답이 아닌가
--
-- 0031이 `revoke … from public`을 했지만 그래도 열려 있었다 — `proacl`에 **명시적인 `anon=X`**
-- 항목이 따로 있었다(`{postgres=X,anon=X,authenticated=X,service_role=X}`).
--
-- 그런데 `anon`에서 회수하는 것은 **틀린 고침**이다. 이 함수는 RLS 정책 안에서 불린다
-- (`class_students_select`의 `class_academy_id(class_id) = my_academy_id()`, 0015:163).
-- 정책 식은 **호출자 권한으로** 평가되므로, `anon`이 실행 권한을 잃으면 익명 조회가
-- `0행`이 아니라 **permission denied 오류**가 된다. 지금 익명이 28개 표에서 조용히 0행을 받는
-- 성질(실측)이 깨진다.
--
-- ## 고치는 방법: 함수가 익명에게 답하지 않게 한다
--
-- 실행 권한은 그대로 두고 **값을 주지 않는다.** 정책 쪽은 아무 영향이 없다 — 익명은
-- `my_academy_id()`도 NULL이라 `NULL = NULL`이 NULL이고, 정책의 `using` 절에서 NULL은 행을
-- 버린다(닫히는 방향). 즉 정책 결과는 전과 같고, 직접 호출만 NULL을 받는다.
create or replace function public.class_academy_id(target uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select academy_id
  from public.classes
  where id = target
    -- 로그인하지 않았으면 답하지 않는다. `security definer`라 이 검사가 없으면 RLS를 우회해
    -- 아무 반의 학원 id를 익명에게 알려 준다(실측).
    and auth.uid() is not null;
$$;

comment on function public.class_academy_id(uuid) is
  '반이 속한 학원 id. RLS 정책의 재귀를 끊기 위한 내부 헬퍼다(0004). 로그인하지 않은 호출자에게는 '
  'NULL을 준다 — security definer라 검사가 없으면 익명이 아무 반의 학원을 읽는다.';
