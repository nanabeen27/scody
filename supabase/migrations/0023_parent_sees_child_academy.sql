-- 학부모는 자녀의 학원 소속을 볼 수 있어야 한다.
--
-- ## 무엇이 막혔나
--
-- `academy_members_select`가 `본인 · 우리 학원 · 운영자`만 열었다. 학부모는 학원 교직원이 아니라
-- `my_academy_id()`가 없고, 자기 자녀의 소속 행도 읽지 못했다.
--
-- 그래서 `Account.academyName`이 비었고, 자녀 탭이 `한빛학원` 대신 `학원 이용권`이라고 말했다.
-- 확정 정책 2절은 학부모가 **연결된 자녀의 개인·학원 학습을 모두 본다**고 정한다 — 어느 학원에
-- 다니는지는 그보다 좁은 정보다.
--
-- 학원 이름 자체는 `academies_select`가 따로 판단한다(아래에서 함께 넓힌다) — 소속 행만 읽고
-- 이름을 못 읽으면 `academyName`이 여전히 빈다.

drop policy if exists academy_members_select on public.academy_members;

create policy academy_members_select on public.academy_members
  for select using (
    user_id = auth.uid()
    or academy_id = public.my_academy_id()
    -- 연결된 자녀의 소속. 다른 학생의 소속은 열지 않는다.
    or public.is_my_child(user_id)
    or public.is_admin()
  );

drop policy if exists academies_select on public.academies;

create policy academies_select on public.academies
  for select using (
    id = public.my_academy_id()
    or public.is_admin()
    or exists (
      select 1 from public.academy_members m
      where m.academy_id = academies.id and m.user_id = auth.uid() and m.left_at is null
    )
    -- 자녀가 다니는 학원. 이름과 계약 정보 중 이름만 화면이 쓴다.
    or exists (
      select 1 from public.academy_members m
      where m.academy_id = academies.id
        and public.is_my_child(m.user_id)
        and m.left_at is null
    )
  );
