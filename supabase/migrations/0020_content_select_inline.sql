-- 콘텐츠 읽기 정책을 행 자체로 판단하게 바꾼다.
--
-- ## 무엇이 잘못됐나
--
-- `content_sets_select`가 `can_read_content(id)`를 불렀다. 그 함수는 **자기가 보호하는 표를 다시
-- 조회한다** — `exists (select 1 from content_sets where id = target)`.
--
-- `STABLE` 함수는 **문장이 시작된 시점의 스냅샷**을 본다. 그래서 `insert … returning`의 반환
-- 단계에서 방금 넣은 행이 그 스냅샷에 없고, 정책이 거짓이 되어
-- `new row violates row-level security policy`로 떨어진다.
--
-- **실제로 어떻게 드러났나**: 운영자가 문제를 등록하면 화면이 `대리 보기 중에는 문제를 등록할 수
-- 없어요.`라고 말했다(등록 경로가 실패를 한 가지로 뭉갰다 — 그쪽도 함께 고쳤다). 순수 `insert`는
-- 통과하고 `insert().select()`만 실패해서 권한 문제로 보이지 않았다.
--
-- 그래서 **정책은 행의 컬럼으로 직접 판단한다.** 같은 표를 다시 읽지 않으므로 스냅샷 문제가 없다.
-- `can_read_content()`는 그대로 둔다 — `questions` 정책이 쓰고, 그쪽은 **다른 표**(`content_sets`)를
-- 읽으므로 그 행은 이미 존재한다.

drop policy if exists content_sets_select on public.content_sets;

create policy content_sets_select on public.content_sets
  for select using (
    auth.uid() is not null
    and (
      -- 학생에게 공개된 세트
      publish_to_students
      or public.is_admin()
      -- 우리 학원이 등록한 세트
      or (owner_academy_id is not null and owner_academy_id = public.my_academy_id())
      -- 나에게 배정된 세트. 공개 여부와 무관하게 풀 수 있어야 한다.
      or exists (
        select 1
        from public.assignment_targets t
        join public.assignments a on a.id = t.assignment_id
        where t.student_id = auth.uid() and a.content_set_id = content_sets.id
      )
      -- 내가 볼 수 있는 반에 배정된 세트. 배정한 사람이 문항을 못 보면 결과를 읽을 수 없다.
      or exists (
        select 1
        from public.assignments a
        where a.content_set_id = content_sets.id
          and a.class_id in (select public.my_class_ids())
      )
    )
  );
