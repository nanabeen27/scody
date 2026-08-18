-- 한 줄 정리를 뒤에 쓴다.

/*
  ## 왜 쓰기를 두 시점으로 나누는가

  복습 한 장의 순서는 `답 고르기 → 근거 → 확인 → (정답·해설) → 내 말로 한 줄`이다. 자기설명은
  **피드백을 읽은 뒤**에 뜻이 생기고(g=0.55 — Bisra et al. 2018), 그 자리는 설명 피드백을 본
  다음이다.

  그런데 로그는 **확인을 누르는 순간** 남아야 한다. 카드를 넘길 때 남기면 화면을 닫고 나간
  학생의 진행이 사라지고, 그것이 A-114가 기록한 결함이다(8장 중 5장을 풀고 나가면 다시 1번
  카드부터).

  그래서 `rpc_log_note_review`가 정오·근거를 먼저 남기고, 이 함수가 **오늘 그 행의 `recap`만**
  채운다. 스케줄은 건드리지 않는다 — 한 줄을 썼다고 다음 차례가 바뀌지 않는다.

  ## 오늘 행만 고친다

  `reviewed_on = today_kst()`로 좁히지 않으면 지난 복습의 한 줄을 나중에 덮어쓸 수 있다. 이 표는
  학습의 사실을 쌓는 자리이므로 지난 기록을 고치는 문을 만들지 않는다(D-013과 같은 규칙).
  `note_reviews`에는 UPDATE 권한이 없으므로(0037) 이 함수 밖에는 경로가 없다.
*/
create or replace function public.rpc_set_note_review_recap(
  p_note_id uuid,
  p_recap text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_rows int;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.';
  end if;
  if p_note_id is null then
    raise exception '어떤 오답인지 알 수 없어요.';
  end if;

  update public.note_reviews
    set recap = nullif(btrim(coalesce(p_recap, '')), '')
    where note_id = p_note_id
      and student_id = v_uid
      and reviewed_on = public.today_kst();
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    raise exception '오늘 복습한 기록이 없어요.';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.rpc_set_note_review_recap(uuid, text) from public, anon;
grant execute on function public.rpc_set_note_review_recap(uuid, text) to authenticated;
