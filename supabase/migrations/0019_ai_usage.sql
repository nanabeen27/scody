-- AI 호출 사용량.
--
-- **왜 별 표인가**: 상한을 세는 값은 학습 활동이 아니다. `learning_events`에 섞으면 활성 지표가
-- AI 호출 수만큼 부풀고, 지표가 행동을 세는 것이 아니라 호출을 세는 것이 된다.
--
-- **사용자가 자기 사용량을 지울 수 없어야 한다.** 그래서 읽기 정책만 두고 쓰기 정책은 두지
-- 않는다 — 프록시 함수(`supabase/functions/ai-proxy`)가 `service_role`로 넣는다.

create table public.ai_usage (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  called_at timestamptz not null default now()
);

-- 상한 확인이 `(user_id, called_at)` 범위 조회다. 그 모양에 맞춘다.
create index ai_usage_user_time_idx on public.ai_usage (user_id, called_at desc);

alter table public.ai_usage enable row level security;

/*
  본인 사용량은 볼 수 있다 — 화면이 `오늘 N번 물어봤어요`를 말할 수 있어야 한다.
  운영자는 전체를 본다(비용 확인).
*/
create policy ai_usage_select on public.ai_usage
  for select using (user_id = auth.uid() or public.is_admin());
