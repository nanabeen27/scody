-- 반 비교(평균·순위)를 집계로 준다.
--
-- ## 무엇이 막혔나
--
-- 학부모 리포트는 학원 과제에 **반 평균과 반 내 순위**를 보여 준다(확정 정책 2절). 그런데 RLS는
-- 학부모에게 **자기 자녀의 제출만** 준다 — 그것이 맞다. 다른 학생의 정답률을 열면 그 학생의
-- 기록을 학부모가 읽는 일이 된다.
--
-- 그래서 개별 행을 열지 않고 **집계만** 내려 준다. 프로토타입은 메모리에 반 전체 제출이 있어서
-- 화면이 직접 평균을 냈는데, 서버로 옮기면서 그 계산의 재료가 (정당하게) 사라졌다.
--
-- ## 무엇을 주는가
--
-- 제출자 수 · 평균 정답률 · 그 학생의 순위. **다른 학생을 특정할 수 있는 값은 주지 않는다** —
-- 정답률 목록도, 이름도, id도 없다.
--
-- 순위는 `동점이면 같은 등수`다(`classStat`과 같은 규칙: 나보다 높은 사람 수 + 1).

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
  if not (public.can_read_student(p_student_id) or public.is_admin()) then
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
