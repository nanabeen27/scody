-- 내가 볼 수 있는 학생들의 기록을 한 번에.
--
-- ## 왜 클라이언트가 대상을 정하지 않는가
--
-- 학부모 리포트는 자녀의 기록을 읽어야 한다. 그 자녀 목록을 클라이언트가 정하면 두 가지가
-- 어긋난다.
--
-- 1. **순서.** 자녀 목록은 `SessionProvider`의 디렉터리 조회에서 오고, 기록 조회는
--    `ProgressProvider`에서 돈다. 둘은 서로를 기다리지 않으므로 첫 조회에서 자녀 기록이 빈
--    채로 화면에 얹힌다 — 이 레포가 `loadedFor`로 이미 한 번 고친 종류의 창이다.
-- 2. **범위.** `loadAttempts()`가 준 학생 id로 대신하면 **풀이가 한 건도 없는 자녀가 빠진다.**
--    오답 복습만 한 자녀에게는 기록이 있는데 화면에는 없는 것으로 보인다.
--
-- 그래서 대상도 서버가 정한다. `parent_children`이 원본이고 RLS와 같은 근거를 쓴다.
--
-- **운영자에게는 자기 자신만 준다.** `can_read_student`는 운영자에게 모든 학생을 열지만, 여기서
-- 그 범위를 쓰면 계정 수만큼 일별 집계를 돌린다. 운영자 화면은 이 함수를 읽지 않는다 —
-- 대리 보기로 학생이 되어 들어가는 경로가 그 자리다.

/**
 * `auth.uid()`가 볼 수 있는 학생들의 기록. `{ "<student_id>": { … } }` 형태다.
 *
 * 본인 + 연결이 승인된 자녀. 각 값의 모양은 `rpc_student_records`와 같다 — 그 함수를 부르므로
 * 규칙이 한 곳에만 있다.
 */
create or replace function public.rpc_readable_records()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb := '{}'::jsonb;
  v_id uuid;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.';
  end if;

  for v_id in
    select v_uid
    union
    select pc.student_id
    from public.parent_children pc
    where pc.parent_id = v_uid and pc.status = 'linked'
  loop
    v_result := v_result || jsonb_build_object(
      v_id::text, public.rpc_student_records(v_id)
    );
  end loop;

  return v_result;
end;
$$;

revoke all on function public.rpc_readable_records() from public, anon;
grant execute on function public.rpc_readable_records() to authenticated;

comment on function public.rpc_readable_records() is
  '본인 + 연결된 자녀의 기록 묶음. 대상을 클라이언트가 정하지 않는다 — 풀이가 없는 자녀가 '
  '빠지고, 디렉터리 조회와 기록 조회의 순서에 따라 값이 달라진다.';
