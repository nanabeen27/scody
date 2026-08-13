-- 한 학생의 모든 학원 과제 반 비교를 한 번에.
--
-- `0021`의 배정 단위 함수를 학생 단위로 묶는다. 배정마다 따로 부르면 학부모 한 명이
-- 자녀 수 × 과제 수만큼 왕복한다 — 리포트는 목록을 한 번에 그린다.

/**
 * 한 학생의 **모든** 학원 과제 반 비교. 배정 id를 키로 하는 객체를 준다.
 *
 * 배정마다 따로 부르면 학부모 한 명이 자녀 두 명 × 과제 수만큼 왕복한다. 리포트는 목록을 한 번에
 * 그리므로 한 번에 받는다.
 */
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
  if not (public.can_read_student(p_student_id) or public.is_admin()) then
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
