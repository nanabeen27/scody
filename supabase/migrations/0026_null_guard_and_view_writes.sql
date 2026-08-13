-- 확인된 구멍 두 개를 막는다. 둘 다 실측으로 재현했다(2026-08-14).

-- ══════════════════════════════════════════════════════════════════════════
-- 1. 로그인하지 않은 사람이 아무 학생의 정답률·반 순위를 읽을 수 있었다
-- ══════════════════════════════════════════════════════════════════════════
--
-- 재현(anon 키만, 세션 없음):
--
--   rpc_class_comparisons('29fc31f4-…')  →
--     {"21e971cb-…":{"avg":60,"mine":60,"rank":3,"submitters":6},
--      "5df5e1c7-…":{"avg":73,"mine":90,"rank":1,"submitters":6}, …}
--
-- 대조군은 정상이었다 — `select attempts` 0행, `rpc_content_usage` 거부. 즉 정책이 넓은 것이
-- 아니라 **이 두 함수의 가드만** 통과됐다.
--
-- ## 원인: `or`가 NULL을 만들고, plpgsql의 `if NULL`은 거짓이다
--
--   can_read_student(target) = `target = auth.uid() or is_my_child(target)`
--
-- 세션이 없으면 `auth.uid()`가 null이므로 `target = null` → **NULL**(거짓이 아니다).
-- `is_my_child`는 `exists(...)`라 `false`. 그래서 `NULL or false` → **NULL**.
-- 가드는 `if not (can_read_student(...) or is_admin()) then raise`이고
-- `not (NULL or false)` → `not NULL` → **NULL**. plpgsql은 `if NULL then`을 거짓으로 보므로
-- `raise`를 건너뛰고, 본문은 `security definer`라 RLS를 우회한 채 집계를 계산했다.
--
-- RLS 정책에서 같은 함수를 쓰는 자리는 안전하다 — `using` 절의 NULL은 행을 **버린다**
-- (실측: anon은 28개 표 전부 0행). 위험한 것은 plpgsql `if not (...)` 가드뿐이고,
-- 레포 전체에서 그 모양은 `0021`·`0022` 두 곳이다. 다른 헬퍼(`is_admin`·`has_role`·
-- `is_my_child`·`can_see_assignment`·`in_class`·`is_director`)는 전부 `exists(...)`이거나
-- `case … else false`라 NULL을 돌려주지 않는다.
--
-- ## 고치는 방법: 뿌리와 호출부 양쪽
--
-- 뿌리 — 이 함수가 다시는 NULL을 돌려주지 않게 한다. 세션이 없으면 읽을 수 있는 학생도 없다.
-- `and`/`or`를 섞으면 우선순위가 헷갈리므로 `case`로 갈래를 그대로 적는다.
create or replace function public.can_read_student(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when auth.uid() is null then false
    when target is null then false
    when target = auth.uid() then true
    else coalesce(public.is_my_child(target), false)
  end;
$$;

comment on function public.can_read_student(uuid) is
  '이 학생의 기록을 읽을 수 있는가(본인·연결된 자녀). 세션이 없으면 false — NULL을 돌려주지 '
  '않는다. plpgsql `if not (…)` 가드에서 NULL은 거짓으로 취급돼 가드를 통째로 건너뛴다.';

-- 호출부 — 가드가 NULL에 걸려도 닫히게 한다. 뿌리를 고쳤으니 중복이지만, 다음 사람이
-- `can_read_student`를 다시 nullable하게 만들어도 여기서 막힌다.
create or replace function public.rpc_class_comparison(p_assignment_id uuid, p_student_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_mine int;
  v_submitters int;
  v_avg int;
  v_rank int;
begin
  -- 그 학생의 기록을 읽을 수 있는 사람만 부를 수 있다(본인·연결된 학부모·운영자).
  -- `coalesce`가 있어야 NULL이 "허용"으로 읽히지 않는다.
  if not (coalesce(public.can_read_student(p_student_id), false)
          or coalesce(public.is_admin(), false)) then
    raise exception '이 학생의 기록을 볼 수 없어요.';
  end if;

  select a.accuracy into v_mine
  from public.assignment_targets t
  join public.attempts a on a.id = t.attempt_id
  where t.assignment_id = p_assignment_id and t.student_id = p_student_id;

  -- 낸 기록이 없으면 비교할 것이 없다.
  if v_mine is null then
    return jsonb_build_object('submitters', 0, 'rank', null, 'avg', null, 'mine', null);
  end if;

  select
    count(*)::int,
    round(avg(a.accuracy))::int,
    (count(*) filter (where a.accuracy > v_mine) + 1)::int
  into v_submitters, v_avg, v_rank
  from public.assignment_targets t
  join public.attempts a on a.id = t.attempt_id
  where t.assignment_id = p_assignment_id;

  return jsonb_build_object(
    'submitters', v_submitters,
    'rank', v_rank,
    'avg', v_avg,
    'mine', v_mine
  );
end;
$$;

create or replace function public.rpc_class_comparisons(p_student_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not (coalesce(public.can_read_student(p_student_id), false)
          or coalesce(public.is_admin(), false)) then
    raise exception '이 학생의 기록을 볼 수 없어요.';
  end if;

  select coalesce(jsonb_object_agg(x.assignment_id, jsonb_build_object(
    'submitters', x.submitters,
    'rank', x.rank,
    'avg', x.avg,
    'mine', x.mine
  )), '{}'::jsonb)
  into v_result
  from (
    select
      mine.assignment_id,
      count(*)::int as submitters,
      round(avg(a.accuracy))::int as avg,
      (count(*) filter (where a.accuracy > mine.accuracy) + 1)::int as rank,
      mine.accuracy as mine
    from (
      -- 그 학생이 낸 과제와 정답률. 이것이 비교의 기준점이다.
      select t.assignment_id, at2.accuracy
      from public.assignment_targets t
      join public.attempts at2 on at2.id = t.attempt_id
      where t.student_id = p_student_id
    ) mine
    join public.assignment_targets t2 on t2.assignment_id = mine.assignment_id
    join public.attempts a on a.id = t2.attempt_id
    group by mine.assignment_id, mine.accuracy
  ) x;

  return v_result;
end;
$$;

-- ══════════════════════════════════════════════════════════════════════════
-- 2. `v_academy_visible_notes`로 아무나 오답노트 행을 만들 수 있었다
-- ══════════════════════════════════════════════════════════════════════════
--
-- 실측한 사실:
--
--   pg_class:      owner=postgres · reloptions=null(`security_invoker` 없음)
--   updatable:     pg_relation_is_updatable(oid, true) = 28 → insert·update·delete 자동 가능
--   grants:        anon·authenticated 각각 INSERT·UPDATE·DELETE·TRUNCATE 보유
--   wrong_notes:   relforcerowsecurity = false → 뷰 소유자(postgres)는 RLS 면제
--
-- 그래서 이 뷰를 통한 쓰기는 `postgres`로 실행돼 `wrong_notes_write`
-- (`student_id = auth.uid()`)가 **적용되지 않는다**. `with check option`도 없으므로 INSERT는
-- 조건이 아예 없다 — 로그인하지 않은 사람이 남의 `student_id`로 오답노트를 만들 수 있다.
--
-- 더 나쁜 것: 그 INSERT가 `wrong_notes_event` 트리거를 깨워 `note_learning_event`를 부른다.
-- `0024`가 그 함수의 실행 권한을 anon·authenticated에서 뺀 이유가 바로 "활동 지표를 손으로
-- 넣을 수 없게" 하려던 것인데, 이 경로가 그 조치를 우회한다. `learning_events`에는 delete
-- 정책이 없어 들어간 행은 지워지지 않는다.
--
-- ## 왜 `security_invoker = on`이 답이 아닌가
--
-- 이 뷰는 **일부러** 소유자 권한으로 돈다. 선생님이 담당 학생의 학원 오답 메모를 보는 것이
-- 확정 정책(D-054)이고, `wrong_notes_select`는 본인·학부모·운영자만 연다. `security_invoker`를
-- 켜면 그 기능이 죽는다. 읽기는 그대로 두고 **쓰기 권한만 뺀다.**
revoke insert, update, delete, truncate on public.v_academy_visible_notes from anon, authenticated;

-- 나머지 뷰는 지금 `pg_relation_is_updatable = 0`(집계·distinct가 있어 자동 갱신 불가)이라
-- 당장 위험하지 않다. 다만 `public` 스키마의 기본 권한이 anon·authenticated에 쓰기까지 주고
-- 있어서, 뷰 정의가 단순해지는 순간 같은 구멍이 다시 열린다. 읽기 전용임을 권한으로 못박는다.
revoke insert, update, delete, truncate on public.v_assignment_submissions from anon, authenticated;
revoke insert, update, delete, truncate on public.v_daily_activity from anon, authenticated;
revoke insert, update, delete, truncate on public.v_public_pricing from anon, authenticated;
revoke insert, update, delete, truncate on public.v_class_roster from anon, authenticated;
revoke insert, update, delete, truncate on public.v_latest_attempts from anon, authenticated;
