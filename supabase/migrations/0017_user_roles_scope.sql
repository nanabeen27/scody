-- 볼 수 있는 사람의 역할은 읽을 수 있게 한다.
--
-- **왜 넓히는가**: 화면이 쓰는 `Account`에는 `roles`가 들어 있다(`src/data/types.ts`). 원래 정책은
-- 본인과 운영자만 `user_roles`를 읽게 해서, 학원이 자기 학생 목록을 만들 때나 학부모가 자녀
-- 계정을 만들 때 역할을 채울 수 없었다.
--
-- 소속(`academy_members.member_role`)에서 역할을 **추측**하는 길도 있었지만, 같은 사실이 두 곳에서
-- 다르게 계산되는 자리를 만든다 — 이 레포가 D-048·D-061에서 두 번 고친 종류다.
--
-- 범위는 `profiles_select`와 **똑같이** 둔다. 이미 이름·학년을 볼 수 있는 사람의 역할이 추가로
-- 드러내는 것은 없다. 넓히지 않는 것: 다른 학원 사람, 연결되지 않은 학생.

drop policy if exists user_roles_select on public.user_roles;

create policy user_roles_select on public.user_roles
  for select using (
    user_id = auth.uid()
    or public.is_my_child(user_id)
    or public.can_see_student(user_id)
    or (
      public.my_academy_id() is not null
      and exists (
        select 1 from public.academy_members m
        where m.user_id = user_roles.user_id
          and m.academy_id = public.my_academy_id()
          and m.left_at is null
      )
    )
    or public.is_admin()
  );
