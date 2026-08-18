-- 복습 기록의 신뢰 모델을 고친다: 채점은 서버가 하고, 쓰기 문을 하나로 좁힌다.

/*
  ## 왜 되돌리는가

  `0037`의 주석은 이렇게 적었다 — "학생이 이 표에 직접 넣을 수 있으면 정답 3회를 손으로 만들어
  졸업할 수 있고, 그러면 이 표가 학습의 사실이 아니라 자기 신고가 된다 — `mastered`가 정확히
  그랬다." 그런데 `0038`의 `rpc_log_note_review`는 **`p_is_correct`를 인자로 받아 그대로 스케줄에
  썼다.** 표에 직접 넣는 길만 막고 정오 판정은 클라이언트에 맡긴 것이다.

  실제로 가능했던 것: 학생 JWT로
      POST /rest/v1/rpc/rpc_log_note_review  {"p_note_id": "<내 노트>", "p_is_correct": true}
  를 서로 다른 3일에 부르면 문항을 열어 보지도 않고 `graduated`가 된다. **`mastered`를 걷어낸
  이유가 그대로 되살아난 것이다.**

  같은 레포의 `rpc_submit_attempt`는 이미 서버 채점을 한다
  (`coalesce(x.picked_index = q.answer_index, false)` — `0029`). 두 쓰기 경로의 신뢰 모델이
  갈려 있었다. 여기서 맞춘다.

  ## 함께 닫는 것

  1. **차례가 아닌 복습은 일정을 앞당기지 못한다.** `scopedDeck`(별표·영역·전체 덱)은 의도적으로
     차례를 보지 않는데, 그 복습이 스케줄을 전진시키면 3일 연속 전체 복습으로 `1 → 7 → 21`을
     3일로 압축해 전부 졸업시킬 수 있었다. `0037`의 유니크 키가 날짜로 막으려던 "집중 반복이
     분산 인출로 계산되는 일"이 그대로 일어난다. **기록은 남기고 스케줄은 그대로 둔다** — 학생이
     지금 더 풀어 보는 것은 막지 않되 그것이 숙달 판정이 되지는 않는다.
  2. **`stuck` 노트는 복습을 받지 않는다.** `rpc_requeue_note`가 "다른 상태에서 부르면 학생이
     자기 일정을 앞당길 수 있다"며 막은 것을 옆 함수가 열어 두고 있었다(정답 한 번으로
     `queued · +7일` 복귀). 큐로 돌아오는 문은 `rpc_requeue_note` 하나다.
  3. **찍어서 맞힌 것을 숙달로 세지 않는다.** `evidence = 'unsure'`는 학생이 "잘 모르겠어요"라고
     답한 값이다. 4지선다에서 무작위 정답률이 25%이므로, 그 답으로 맞힌 회차를 `streak`으로
     세면 네 번에 한 번은 운이 숙달로 기록된다. 로그는 남기고 연속만 올리지 않는다.
     — 이 값을 판정에 쓰는 것이 3택을 묻는 이유이기도 하다. 묻고 버리면 학생에게 인지 비용만
     부과한다.
  4. **건너뛰기가 큐를 교착시키던 것을 고친다.** 건너뛰면 기록이 없어 `due_on`이 과거에 남고,
     다음 날 밀린 일수가 1 늘어 우선순위에서 더 앞으로 갔다. 모르는 카드 다섯 장을 건너뛰면
     다음 날 덱이 같은 다섯 장이고 그 상태가 영구히 유지됐다(`miss_streak`도 늘지 않아 `stuck`
     탈출구도 열리지 않는다). `rpc_defer_note`가 서버 경로로 하루 미룬다.
  5. **`wrong_notes`의 INSERT·UPDATE를 좁힌다.** `0037`은 DELETE만 회수했다. 그래서 학생이
     `student_id`만 자기 것으로 두고 **임의 문항 + 임의 `dig` 본문 + 우리 학원 배정 uuid**로
     행을 만들거나 기존 행을 그렇게 바꿀 수 있었다 — `v_academy_visible_notes`는
     `can_see_assignment`·`can_see_student`만 보므로 그것이 담당 선생님 화면에 그대로 올라간다.
     0026 §2가 뷰에서 한 번 고친 것과 같은 모양이다.
  6. **같은 날 중복을 경쟁 안전하게 만든다.** `exists` 검사 → INSERT 사이에 경쟁이 붙으면
     유니크 인덱스가 잡지만 학생은 `이미 있는 값이에요.`(뜻이 통하지 않는 문장)를 본다.
     `on conflict do nothing` + `row_count`로 한 문장으로 합친다.
*/

-- ── 1. 담기: 소유와 정합을 검사한다 ─────────────────────────────────────────

/**
 * 오답노트에 담는다. **담기와 되살리기가 한 함수다.**
 *
 * `0038`의 판본은 null 가드와 출처·배정 짝만 봤다. `rpc_submit_attempt`가 하는 검사
 * (배정 대상 행 · 배정의 콘텐츠 일치 · 개인 학습의 공개 여부)를 여기에도 둔다 — 0029가
 * 실측으로 세운 관례이고, 이 함수는 `security definer`라 RLS를 지나지 않는다.
 *
 * 문항이 그 콘텐츠의 것인지도 본다. 어긋나면 오답노트 목록의 문항과 지문이 짝이 맞지 않고,
 * 학원 화면에서는 그 배정과 무관한 문항이 `여러 학생이 담은 문항`에 섞인다.
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
  v_choices int;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.';
  end if;
  -- `<>` 비교는 한쪽이 NULL이면 NULL이 되고 plpgsql의 `if NULL`은 거짓이라 가드가 건너뛰어진다
  -- (0029 §2가 `rpc_submit_attempt`에서 실측으로 확인한 함정이다).
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

  -- 문항이 그 콘텐츠의 것인가. 선지 수도 함께 받아 고른 답의 범위를 검사한다.
  select coalesce(array_length(q.choices, 1), 0) into v_choices
  from public.questions q
  where q.id = p_question_id and q.content_set_id = p_content_set_id;
  if not found then
    raise exception '이 학습의 문항이 아니에요.';
  end if;
  if p_picked_index is not null and (p_picked_index < 0 or p_picked_index >= v_choices) then
    raise exception '고른 답이 이 문항의 선지가 아니에요.';
  end if;

  if p_source = 'academy' then
    -- 배정받지 않은 과제의 오답은 담을 수 없다. 화면 목록이 아니라 배정 대상 행이 근거다(D-172).
    if not exists (
      select 1 from public.assignment_targets t
      where t.assignment_id = p_assignment_id and t.student_id = v_uid
    ) then
      raise exception '배정받은 학습이 아니에요.';
    end if;
    if not exists (
      select 1 from public.assignments a
      where a.id = p_assignment_id and a.content_set_id = p_content_set_id
    ) then
      raise exception '배정된 학습과 다른 문제예요.';
    end if;
  else
    -- 개인 학습은 공개된 콘텐츠만. `personalItems`와 같은 기준이다.
    if not exists (
      select 1 from public.content_sets s
      where s.id = p_content_set_id and s.publish_to_students
    ) then
      raise exception '지금은 담을 수 없는 학습이에요.';
    end if;
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

-- ── 2. 복습 기록: 채점은 서버가 한다 ────────────────────────────────────────

-- 인자가 바뀌므로 옛 시그니처를 지운다. 남겨 두면 클라이언트가 계속 그것을 부를 수 있다.
drop function if exists public.rpc_log_note_review(uuid, boolean, smallint, public.note_evidence, text);

/**
 * 다시 풀어 본 사실을 남기고 다음 차례를 정한다.
 *
 * **`p_is_correct`가 없다.** 서버가 `questions.answer_index`와 대조한다 — 이 함수의 존재 이유가
 * 자기 신고를 숙달 판정에서 걷어내는 것이므로, 정오를 클라이언트가 정하면 함수가 목적을
 * 달성하지 못한다.
 *
 * **다음 차례도 클라이언트가 제안하지 않는다.** 인자에 날짜가 없는 것이 그 계약이다.
 *
 * 돌려주는 값에 `reviewedOn`(서버 날짜)과 `scheduled`(스케줄을 움직였는지)를 싣는다. 화면이
 * 기기 로컬 날짜로 "오늘 본 것"을 판정하면 시간대가 KST와 다른 기기에서 어긋나 **큐에는 보이는데
 * 어떤 복습도 받지 못하는 카드**가 생긴다.
 */
create or replace function public.rpc_log_note_review(
  p_note_id uuid,
  p_picked_index smallint,
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
  v_answer int;
  v_choices int;
  v_correct boolean;
  v_counts boolean;
  v_scheduled boolean;
  v_streak smallint;
  v_miss smallint;
  v_state public.note_state;
  v_due date;
  v_rows int;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.';
  end if;
  if p_note_id is null then
    raise exception '어떤 오답인지 알 수 없어요.';
  end if;
  if p_picked_index is null then
    raise exception '고른 답이 없어요.';
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
  /*
    **`stuck`은 복습을 받지 않는다.** 큐로 돌아오는 문은 `rpc_requeue_note` 하나다. 여기서
    받아 주면 정답 한 번으로 그 함수의 가드를 우회한다.
  */
  if v_note.state = 'stuck' then
    raise exception '지금은 쉬고 있는 문항이에요. 오답노트에서 다시 넣어 주세요.';
  end if;

  -- 서버 채점. 선지 범위도 함께 본다.
  select q.answer_index, coalesce(array_length(q.choices, 1), 0)
  into v_answer, v_choices
  from public.questions q
  where q.id = v_note.question_id;
  if not found then
    raise exception '문항을 찾을 수 없어요.';
  end if;
  if p_picked_index < 0 or p_picked_index >= v_choices then
    raise exception '고른 답이 이 문항의 선지가 아니에요.';
  end if;
  v_correct := p_picked_index = v_answer;

  /*
    같은 날 두 번째 복습은 받지 않는다 — 그것이 "서로 다른 세션"의 정의다(0037의 유니크 키).
    `on conflict do nothing` + `row_count`로 판정하면 경쟁이 붙어도 학생이 보는 문장이 같다
    (`exists` 검사와 INSERT 사이의 경쟁에서는 유니크 위반 문구가 그대로 새어 나갔다).
  */
  insert into public.note_reviews (
    note_id, student_id, reviewed_on, picked_index, is_correct, evidence, recap
  )
  values (
    p_note_id, v_uid, v_today, p_picked_index, v_correct, p_evidence,
    nullif(btrim(coalesce(p_recap, '')), '')
  )
  on conflict (note_id, reviewed_on) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception '오늘은 이미 복습했어요.';
  end if;

  /*
    **차례가 아닌 복습은 스케줄을 움직이지 않는다.** 별표·영역·전체 덱은 차례를 보지 않고
    열리므로(학생의 시험 일정이 정하는 일이다), 그 복습이 일정을 전진시키면 3일 연속 전체
    복습으로 사다리를 3일로 압축해 전부 졸업시킬 수 있다.

    **찍어서 맞힌 것은 연속으로 세지 않는다.** `unsure`는 학생이 "잘 모르겠어요"라고 답한 값이고
    4지선다의 무작위 정답률은 25%다.
  */
  v_scheduled := v_note.due_on is not null and v_note.due_on <= v_today;
  v_counts := v_correct and coalesce(p_evidence, 'passage') <> 'unsure';

  if not v_scheduled then
    return jsonb_build_object(
      'ok', true,
      'reviewedOn', v_today,
      'isCorrect', v_correct,
      'scheduled', false,
      'state', v_note.state,
      'dueOn', v_note.due_on,
      'streak', v_note.streak,
      'missStreak', v_note.miss_streak
    );
  end if;

  if v_counts then
    v_streak := v_note.streak + 1;
    v_miss := 0;
  elsif v_correct then
    -- 맞혔지만 찍었다. 연속은 그대로 두고 오답 연속도 늘리지 않는다 — 벌하지 않는다.
    v_streak := v_note.streak;
    v_miss := v_note.miss_streak;
  else
    v_streak := 0;
    v_miss := v_note.miss_streak + 1;
  end if;

  if not v_correct and v_miss >= 3 then
    v_state := 'stuck';
    v_due := null;
  elsif v_counts and v_streak >= 3 then
    v_state := 'graduated';
    v_due := v_today + 30;
  elsif v_correct then
    -- streak 1 -> 7일 · streak 2 -> 21일. 찍어서 맞힌 회차는 streak이 그대로라 내일 다시 본다.
    v_state := 'queued';
    v_due := v_today + case when v_streak = 0 then 1 when v_streak = 1 then 7 else 21 end;
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
    'reviewedOn', v_today,
    'isCorrect', v_correct,
    'scheduled', true,
    'state', v_state,
    'dueOn', v_due,
    'streak', v_streak,
    'missStreak', v_miss
  );
end;
$$;

-- ── 3. 건너뛰기: 하루 미룬다 ────────────────────────────────────────────────

/**
 * 차례가 온 문항을 하루 미룬다. 화면의 `건너뛰기`가 부른다.
 *
 * **미루지 않으면 큐가 교착된다.** 건너뛰기는 기록을 남기지 않으므로 `due_on`이 과거에 그대로
 * 남고, 다음 날 밀린 일수가 1 늘어 우선순위에서 **더 앞으로** 간다. 모르는 카드 다섯 장을
 * 건너뛰면 다음 날 덱이 같은 다섯 장이고, `miss_streak`도 늘지 않아 `stuck` 탈출구도 열리지
 * 않는다.
 *
 * 복습 기록을 남기지 않는 것은 그대로다 — 건너뛴 것은 다시 풀어 본 사실이 아니다.
 */
create or replace function public.rpc_defer_note(p_note_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public.today_kst();
  v_note public.wrong_notes;
  v_due date;
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
  -- 차례가 아닌 카드를 미루면 학생이 일정을 뒤로 밀 수 있다. 오늘 것만 미룬다.
  if v_note.state = 'stuck' or v_note.due_on is null or v_note.due_on > v_today then
    return jsonb_build_object('ok', true, 'deferred', false, 'dueOn', v_note.due_on);
  end if;

  v_due := v_today + 1;
  perform set_config('scody.note_schedule', 'on', true);
  update public.wrong_notes set due_on = v_due where id = p_note_id;
  perform set_config('scody.note_schedule', '', true);

  return jsonb_build_object('ok', true, 'deferred', true, 'dueOn', v_due);
end;
$$;

-- ── 4. `wrong_notes` 쓰기를 좁힌다 ──────────────────────────────────────────

/*
  INSERT를 회수하면 `rpc_add_wrong_note`가 유일한 담기 문이 된다. UPDATE는 남긴다 — 메모·별표·
  지우기·되돌리기가 그 경로이고, 아래 가드가 정체성 컬럼을 얼린다.
*/
revoke insert on public.wrong_notes from anon, authenticated;

/**
 * 스케줄과 **정체성**을 클라이언트가 못 바꾸게 막는다.
 *
 * `0037`의 판본은 스케줄 네 컬럼만 봤다. 그래서 학생이 기존 노트를
 * `{"source":"academy","assignment_id":"<우리 학원 배정>","question_id":"<아무 문항>"}`으로
 * PATCH해 담당 선생님의 화면(`v_academy_visible_notes`)에 임의 문항과 임의 `dig` 본문을 올릴 수
 * 있었다. 뷰는 `can_see_assignment`·`can_see_student`만 보므로 그 행을 걸러 낼 수 없다.
 *
 * 바꿀 수 있는 것은 `dig`·`starred`·`mastered`·`picked_index`·`dismissed_at`뿐이다.
 */
create or replace function public.tg_wrong_notes_schedule_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_open boolean := coalesce(current_setting('scody.note_schedule', true), '') = 'on';
begin
  if v_open then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.state := 'queued';
    new.due_on := public.today_kst() + 1;
    new.streak := 0;
    new.miss_streak := 0;
    return new;
  end if;

  if new.state is distinct from old.state
    or new.due_on is distinct from old.due_on
    or new.streak is distinct from old.streak
    or new.miss_streak is distinct from old.miss_streak
  then
    raise exception '복습 일정은 직접 바꿀 수 없어요.';
  end if;

  if new.student_id is distinct from old.student_id
    or new.question_id is distinct from old.question_id
    or new.content_set_id is distinct from old.content_set_id
    or new.source is distinct from old.source
    or new.assignment_id is distinct from old.assignment_id
  then
    raise exception '오답노트의 출처는 바꿀 수 없어요.';
  end if;

  return new;
end;
$$;

-- ── 5. 권한 ─────────────────────────────────────────────────────────────────

revoke all on function public.rpc_add_wrong_note(uuid, uuid, learning_source, uuid, smallint) from public, anon;
revoke all on function public.rpc_log_note_review(uuid, smallint, public.note_evidence, text) from public, anon;
revoke all on function public.rpc_defer_note(uuid) from public, anon;
grant execute on function public.rpc_add_wrong_note(uuid, uuid, learning_source, uuid, smallint) to authenticated;
grant execute on function public.rpc_log_note_review(uuid, smallint, public.note_evidence, text) to authenticated;
grant execute on function public.rpc_defer_note(uuid) to authenticated;
