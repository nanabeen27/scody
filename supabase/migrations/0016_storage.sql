-- Storage: 콘텐츠 첨부 버킷.
--
-- **아직 쓰는 화면이 없다.** 지문 이미지·보기 그림을 올리는 UI가 앱에 없고, 이번 범위에서
-- 만들지도 않는다. 버킷과 정책만 미리 둔다 — 나중에 만들 때 권한 규칙을 다시 고민하지 않게.
--
-- 공개 버킷이 아니다(`public = false`). 서명 URL로만 읽는다 — 지문은 유료 콘텐츠다.

insert into storage.buckets (id, name, public)
values ('content-assets', 'content-assets', false)
on conflict (id) do nothing;

-- 읽기: 로그인한 사용자. 어느 콘텐츠의 첨부인지까지 좁히려면 경로 규칙이 필요해서,
-- 실제로 올리는 화면을 만들 때 함께 정한다.
create policy content_assets_read on storage.objects
  for select
  to authenticated
  using (bucket_id = 'content-assets');

-- 쓰기: 운영자, 또는 학원 교직원(자기 학원 콘텐츠에 붙인다).
create policy content_assets_write on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'content-assets'
    and (public.is_admin() or public.my_academy_id() is not null)
  );

create policy content_assets_delete on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'content-assets' and public.is_admin());
