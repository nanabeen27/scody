-- 복습 기록 · 담기 · 큐 복귀 RPC. **스케줄을 정하는 유일한 문이다.**

/*
  ## 스케줄 규칙 (서버가 유일한 판정자다)

    입력                  | streak | miss_streak | 결과
    ----------------------|--------|-------------|--------------------------------
    담기(INSERT)          | 0      | 0           | queued · due = 내일
    정답 (streak' = 1)    | +1     | 0           | queued · due = today + 7
    정답 (streak' = 2)    | +1     | 0           | queued · due = today + 21
    정답 (streak' >= 3)   | +1     | 0           | graduated · due = today + 30
    오답 (miss' < 3)      | 0      | +1          | queued · due = today + 1
    오답 (miss' >= 3)     | 0      | +1          | stuck · due = null

  **간격이 `streak`의 함수라 두 값이 어긋날 자리가 없다.** 사다리 칸을 따로 저장하면 정답
  판정과 칸이 갈릴 수 있고, 앞선 초안이 실제로 그랬다(문서는 1·3·7·14를 적었지만 실효는
  1·3·7이었고 마지막 칸은 도달 불가였다).

  ## 왜 이 숫자인가

  - **7일이 중심이다.** 교실 메타분석에서 7일 고정 간격이 가장 일관되게 양의 효과를 냈고,
    확장 간격은 더 작거나 음수였다(Mawson & Kang 2025, Behavioral Sciences 15(6):771 —
    교실 d=0.54, 실험실 d=0.85). 확장 간격과 균등 간격의 차이는 g=0.034로 유의하지 않으므로
    (Latimier, Peyre & Ramus 2021), 정교한 곡선을 만들 이유가 없다.
  - **첫 간격만 1일이다.** 고확신 오류는 피드백 후 재시험이 없으면 지연 뒤 되돌아온다
    (Metcalfe & Finn 2014, JARMAC). 틀린 직후에는 짧게 다시 묻는다.
  - **졸업은 3회다.** 서로 다른 세션에서 정답 3회가 초기 학습의 기준이고 그 위로는 수확
    체감이다(Rawson & Dunlosky; Vaughn & Rawson 2011, Psych. Science).
  - **졸업해도 큐에서 빠지지 않는다.** 1회 정답 후 시험을 중단하면 지연 회상 이득이 사라진다
    (Karpicke & Roediger 2008, Science 319:966). 30일마다 돌아온다.
  - **3회 연속 오답에서 멈춘다.** 명시적 포기 경로가 없는 시스템은 leech를 쌓고, 그것이 복습
    자체를 그만두게 만든다(Anki는 8회 실패 시 자동 정지를 두고, 그것이 없는 서비스에서는
    수백 개가 쌓이며 세션 정확도가 20~30%로 떨어진다는 사용자 서술이 반복된다). 국어는 문항
    수가 적고 세션이 드물어 8회는 몇 달이 걸린다 — 3회로 좁혔다.

  ## 개인화 모델을 쓰지 않는다

  SM-2·FSRS 같은 파생 상태(난이도·안정성)를 저장하지 않는다. 개인화의 이득 근거는 어휘·산술
  처럼 항목이 수천이고 반복이 수만인 환경에서 나왔고(Lindsey et al. 2014, Psych. Science),
  FSRS 최적화기는 리뷰 수백 회 미만이면 기본 파라미터보다 나빠질 수 있다. 이 제품의 학생 한
  명이 가진 오답은 수십~수백이고 세션은 드물다. **지금 데이터량에서는 고정 간격이 차선이
  아니라 더 안전한 선택이다.**
*/

/**
 * 오답노트에 담는다. **담기와 되살리기가 한 함수다.**
 *
 * 지우기가 소프트 삭제(0037)가 되면서 담기가 플레인 INSERT일 수 없게 됐다 — 지웠던 문항을 다시
 * 담으면 `wrong_notes_key` 유니크에 걸린다(23505). 그 키는 표현식 인덱스라
 * (`coalesce(assignment_id, content_set_id)`) PostgREST의 `onConflict`로 지정할 수 없어
 * 클라이언트에서 원자적으로 처리할 방법이 없다.
 *
 * 되살릴 때 **스케줄을 건드리지 않는다.** 지운 시점의 `state`·`due_on`·`streak`이 그대로
 * 돌아오는 것이 D-033의 "없던 일"이다. 메모(`dig`)와 별표도 남아 있다.
 */
create or replace function public.rpc_add_wrong_note(
  p_question_id uuid,
  p_content_set_id uuid,
  p_source learning_source,
  p_assignment_id uuid default null,
  p_picked_index smallint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_restored boolean := false;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.';
  end if;
  -- `<>` 비교는 한쪽이 NULL이면 NULL이 되고 plpgsql의 `if NULL`은 거짓이라 가드가 건너뛰어진다
  -- (0029 §2가 `rpc_submit_attempt`에서 실측으로 확인한 것과 같은 함정이다).
  if p_question_id is null then
    raise exception '어떤 문항인지 알 수 없어요.';
  end if;
  if p_content_set_id is null then
    raise exception '어떤 학습인지 알 수 없어요.';
  end if;
  if p_source is null then
    raise exception '학습 출처가 없어요.';
  end if;
  if (p_source = 'academy') <> (p_assignment_id is not null) then
    raise exception '학습 출처와 배정이 맞지 않아요.';
  end if;

  -- 이미 있으면(지운 것 포함) 되살린다. 유니크 키와 같은 식으로 찾는다.
  select id into v_id
  from public.wrong_notes
  where student_id = v_uid
    and question_id = p_question_id
    and source = p_source
    and coalesce(assignment_id, content_set_id)
      = coalesce(p_assignment_id, p_content_set_id);

  if v_id is not null then
    update public.wrong_notes
      set dismissed_at = null,
          picked_index = coalesce(p_picked_index, picked_index)
      where id = v_id;
    v_restored := true;
  else
    -- 스케줄 값은 가드 트리거가 정한다(0037 §5). 여기서 쓰지 않는다.
    insert into public.wrong_notes (
      student_id, question_id, content_set_id, source, assignment_id, picked_index
    )
    values (
      v_uid, p_question_id, p_content_set_id, p_source, p_assignment_id, p_picked_index
    )
    returning id into v_id;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'restored', v_restored);
end;
$$;

/**
 * 다시 풀어 본 사실을 남기고 다음 차례를 정한다.
 *
 * **다음 차례를 클라이언트가 제안할 수 없다.** 앞선 초안은 `p_due_on`을 받아 서버 계산을
 * 덮게 했는데, 그러면 `due_on = 오늘`인 카드를 만들 수 있고 같은 날 두 번째 복습은 아래에서
 * 거부되므로 **오늘 큐에 계속 보이면서 어떤 복습도 받지 못하는 카드**가 된다. 인자를 없애면
 * 서버 계산은 항상 내일 이후여서 그 상태가 성립하지 않는다.
 */
create or replace function public.rpc_log_note_review(
  p_note_id uuid,
  p_is_correct boolean,
  p_picked_index smallint default null,
  p_evidence public.note_evidence default null,
  p_recap text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public.today_kst();
  v_note public.wrong_notes;
  v_streak smallint;
  v_miss smallint;
  v_state public.note_state;
  v_due date;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.';
  end if;
  if p_note_id is null then
    raise exception '어떤 오답인지 알 수 없어요.';
  end if;
  if p_is_correct is null then
    raise exception '맞혔는지 틀렸는지 알 수 없어요.';
  end if;

  select * into v_note from public.wrong_notes where id = p_note_id;
  if not found then
    raise exception '오답노트에 없는 문항이에요.';
  end if;
  -- `security definer`는 RLS를 지나지 않는다. 소유 검사를 함수 안에서 한다.
  if v_note.student_id <> v_uid then
    raise exception '내 오답노트가 아니에요.';
  end if;
  if v_note.dismissed_at is not null then
    raise exception '오답노트에서 뺀 문항이에요.';
  end if;
  if exists (
    select 1 from public.note_reviews
    where note_id = p_note_id and reviewed_on = v_today
  ) then
    raise exception '오늘은 이미 복습했어요.';
  end if;

  insert into public.note_reviews (
    note_id, student_id, reviewed_on, picked_index, is_correct, evidence, recap
  )
  values (
    p_note_id, v_uid, v_today, p_picked_index, p_is_correct, p_evidence,
    nullif(btrim(coalesce(p_recap, '')), '')
  );

  if p_is_correct then
    v_streak := v_note.streak + 1;
    v_miss := 0;
  else
    v_streak := 0;
    v_miss := v_note.miss_streak + 1;
  end if;

  if not p_is_correct and v_miss >= 3 then
    v_state := 'stuck';
    v_due := null;
  elsif p_is_correct and v_streak >= 3 then
    v_state := 'graduated';
    v_due := v_today + 30;
  elsif p_is_correct then
    -- streak 1 -> 7일 · streak 2 -> 21일. 3부터는 위 갈래가 먼저 잡는다.
    v_state := 'queued';
    v_due := v_today + case when v_streak = 1 then 7 else 21 end;
  else
    v_state := 'queued';
    v_due := v_today + 1;
  end if;

  -- 트랜잭션 지역이어야 한다(0037 §5). PostgREST가 연결을 재사용하므로 세션 범위로 세우면
  -- 그 연결에서 가드가 영구히 꺼진다.
  perform set_config('scody.note_schedule', 'on', true);
  update public.wrong_notes
    set state = v_state, due_on = v_due, streak = v_streak, miss_streak = v_miss
    where id = p_note_id;
  perform set_config('scody.note_schedule', '', true);

  return jsonb_build_object(
    'ok', true,
    'state', v_state,
    'dueOn', v_due,
    'streak', v_streak,
    'missStreak', v_miss
  );
end;
$$;

/**
 * 멈춘 문항을 다시 큐에 넣는다.
 *
 * `stuck`은 `due_on`이 null이라 큐 질의에 걸리지 않는다. 학생이 개념을 다시 보거나 선생님께
 * 물어본 뒤 돌아올 길이 필요하다 — 그 길이 없으면 `stuck`은 사실상 조용한 삭제다.
 *
 * `stuck`에서만 부른다. 다른 상태에서 부르면 학생이 자기 일정을 앞당길 수 있다.
 */
create or replace function public.rpc_requeue_note(p_note_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_note public.wrong_notes;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.';
  end if;
  if p_note_id is null then
    raise exception '어떤 오답인지 알 수 없어요.';
  end if;

  select * into v_note from public.wrong_notes where id = p_note_id;
  if not found then
    raise exception '오답노트에 없는 문항이에요.';
  end if;
  if v_note.student_id <> v_uid then
    raise exception '내 오답노트가 아니에요.';
  end if;
  if v_note.state <> 'stuck' then
    raise exception '지금은 복습 목록에 다시 넣을 수 없어요.';
  end if;

  perform set_config('scody.note_schedule', 'on', true);
  update public.wrong_notes
    set state = 'queued', due_on = public.today_kst() + 1, miss_streak = 0
    where id = p_note_id;
  perform set_config('scody.note_schedule', '', true);

  return jsonb_build_object('ok', true);
end;
$$;

/*
  0024가 세운 규칙대로 실행 권한을 좁힌다 — 학생이 부르는 세 함수는 authenticated에 열고,
  익명에는 열지 않는다.
*/
revoke all on function public.rpc_add_wrong_note(uuid, uuid, learning_source, uuid, smallint) from public, anon;
revoke all on function public.rpc_log_note_review(uuid, boolean, smallint, public.note_evidence, text) from public, anon;
revoke all on function public.rpc_requeue_note(uuid) from public, anon;
grant execute on function public.rpc_add_wrong_note(uuid, uuid, learning_source, uuid, smallint) to authenticated;
grant execute on function public.rpc_log_note_review(uuid, boolean, smallint, public.note_evidence, text) to authenticated;
grant execute on function public.rpc_requeue_note(uuid) to authenticated;
