-- 배정한 학원은 그 콘텐츠를 읽을 수 있어야 한다.
--
-- **무엇이 잘못됐나**: `can_read_content`는 학생 쪽만 봤다 — "나에게 배정된 세트"는
-- `assignment_targets.student_id = auth.uid()`로 열렸는데, **선생님·원장에게는 그 행이 없다.**
-- 그래서 공개되지 않은 운영자 콘텐츠(`ct_acad_1`처럼 `publish_to_students = false`)를 배정하면
-- 정작 배정한 선생님이 그 문항을 읽지 못했다.
--
-- **실제로 어떻게 드러났나**: 학원 대시보드의 `평균 정답률`이 `—`로 나왔다. 문항 수를 세지
-- 못해(`questions`가 0행) 문항 수 가중 평균의 분모가 0이 됐다. 제출률(89%)은 제출 행만 보므로
-- 정상으로 보였다 — 한 화면에서 어떤 값은 맞고 어떤 값은 비는 형태였다.
--
-- 여는 범위는 **내가 볼 수 있는 반에 배정된 콘텐츠**뿐이다. 배정하지 않은 콘텐츠는 그대로 닫힌다.

create or replace function public.can_read_content(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.content_sets s
    where s.id = target
      and (
        s.publish_to_students
        or public.is_admin()
        or (s.owner_academy_id is not null and s.owner_academy_id = public.my_academy_id())
        or exists (
          -- 나에게 배정된 세트. 공개 여부와 무관하게 풀 수 있어야 한다.
          select 1
          from public.assignment_targets t
          join public.assignments a on a.id = t.assignment_id
          where t.student_id = auth.uid() and a.content_set_id = s.id
        )
        or exists (
          -- 내가 볼 수 있는 반에 배정된 세트. 배정한 사람이 문항을 못 보면 결과를 읽을 수 없다.
          select 1
          from public.assignments a
          where a.content_set_id = s.id
            and a.class_id in (select public.my_class_ids())
        )
      )
  );
$$;
