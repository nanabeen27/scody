-- 보호를 쓴 날을 응답에 담는다.
--
-- ## 왜 필요한가
--
-- 응답에는 **남은 개수**만 있었다(`streak.protections`). 그래서 어제 공부하지 않았는데
-- `연속 학습 12일`이 그대로인 학생은 그 숫자를 틀린 것으로 읽는다 — 잔디에는 빈 칸이 있고
-- 연속은 줄지 않았는데 둘을 잇는 문장이 화면에 없었다. `기록 보호 0개`가 `아직 한 번도 못
-- 얻었다`인지 `방금 다 썼다`인지도 구분되지 않았다.
--
-- 새 개념을 화면만 보고 이해할 수 있느냐는 질문의 답이 **얻는 방법은 알 수 있고 쓰인 사실은 알 수
-- 없다**였고, 이 마이그레이션이 뒤쪽을 채운다.
--
-- ## 지금 이어지고 있는 연속만 말한다
--
-- 연속이 끊기는 자리에서 목록을 비운다. 석 달 전에 쓴 보호를 `방금 하나 썼어요`처럼 말하면
-- 그것도 거짓이다 — 이 값이 설명하는 것은 **화면에 지금 서 있는 연속 일수**다.
--
-- 잔디에 네 번째 단계를 만들지는 않는다. `DayHeatmap`이 단계를 셋으로 묶은 근거가 그대로
-- 유효하다(단계가 많아지면 색만 보고 값을 되짚을 수 없다).
--
-- 파생값이라 옮길 데이터가 없다 — 함수만 바꾸면 과거 기록도 새 규칙으로 다시 계산된다.

create or replace function public.rpc_student_records(p_student_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  -- 주간 목표: 한 주(월~일)에 이 일수를 채우면 보호 하나를 얻는다.
  c_week_goal constant int := 5;
  -- 쌓아 둘 수 있는 보호의 최대. 무제한이면 한 달을 쉬어도 연속이 남아 뜻을 잃는다.
  c_max_protect constant int := 2;
  /*
    주간 목표를 채운 주가 주는 보호 수. **주말 이틀과 같은 수다** — 그것이 이 값의 근거다
    (파일 머리의 계산). 상한이 2라 한 주가 만들 수 있는 최대이기도 하다.
  */
  c_week_grant constant int := 2;
  -- 화면이 그리는 잔디의 길이(4주).
  c_window constant int := 28;

  v_today date := public.today_kst();
  v_monday date := (date_trunc('week', public.today_kst()))::date;
  v_days date[];
  v_first date;
  v_cur int := 0;
  v_longest int := 0;
  v_protect int := 0;
  v_d date;
  v_is_study boolean;
  v_week date;
  v_prev_week date;
  v_week_count int := 0;
  /** 지금 이어지고 있는 연속을 지킨 보호의 날들. 연속이 끊기면 비운다. */
  v_protected date[] := '{}';
  v_today_row jsonb;
  v_totals jsonb;
  v_bests jsonb;
  v_prev_bests jsonb;
  v_week_json jsonb;
  v_last_week jsonb;
  v_last_week_to_date jsonb;
  v_avg4 jsonb;
  v_days_json jsonb;
  v_weeks_json jsonb;
  v_best_week jsonb;
  v_prev_best_week jsonb;
begin
  if not (public.can_read_student(p_student_id) or public.is_admin()) then
    raise exception '이 학생의 기록을 볼 수 없어요.';
  end if;

  -- ── 연속 학습일 ────────────────────────────────────────────────────────────
  --
  -- **하루 빠졌다고 몇 달의 노력이 0이 되지 않게 한다.** 그 주의 학습일이 목표에 닿으면 보호가
  -- 하나 생기고 최대 두 개까지 쌓인다. 빠진 날은 보호가 있으면 그것이 메운다.
  --
  -- **보호받은 날은 연속을 늘리지 않는다.** 끊지도 않고 늘리지도 않는다 — 공부하지 않은 날을
  -- `17일째 공부 중`의 하루로 세면 그 숫자가 거짓이 된다.
  --
  -- **오늘은 판정하지 않는다.** 아직 끝나지 않은 하루를 결석으로 세면 매일 아침 연속이 끊긴다.

  select array_agg(day order by day)
  into v_days
  from public.v_daily_learning_stats
  where student_id = p_student_id and counts_as_study_day;

  if v_days is not null then
    v_first := v_days[1];
    v_d := v_first;
    while v_d <= v_today loop
      -- 주가 바뀌면 그 주의 학습일 수를 다시 센다.
      v_week := (date_trunc('week', v_d))::date;
      if v_prev_week is null or v_week <> v_prev_week then
        v_prev_week := v_week;
        v_week_count := 0;
      end if;

      v_is_study := v_d = any(v_days);
      if v_is_study then
        v_cur := v_cur + 1;
        if v_cur > v_longest then
          v_longest := v_cur;
        end if;
        v_week_count := v_week_count + 1;
        /*
          **목표에 닿는 순간 주말 이틀만큼 준다.** `=`로 판정하므로 한 주에 한 번이다 —
          6일·7일을 채운 주가 보호를 계속 만들지 않는다(상한 `c_max_protect`도 그대로 2다).
        */
        if v_week_count = c_week_goal then
          v_protect := least(c_max_protect, v_protect + c_week_grant);
        end if;
      elsif v_d < v_today then
        if v_protect > 0 then
          v_protect := v_protect - 1;
          /*
            **보호를 쓴 날을 남긴다.** 응답에 남은 개수만 있으면, 어제 공부하지 않았는데 연속이
            그대로인 학생은 그 숫자가 틀린 것으로 읽는다 — 잔디에는 빈 칸이 있고 연속은 줄지
            않았는데 둘을 잇는 문장이 화면에 없었다. 파생값이라 저장이 늘지 않는다.
          */
          v_protected := array_append(v_protected, v_d);
        else
          v_cur := 0;
          /*
            **끊긴 자리에서 목록을 비운다.** 지금 이어지고 있는 연속을 지킨 보호만 말해야 한다 —
            석 달 전에 쓴 보호를 `방금 하나 썼어요`처럼 말하면 그것도 거짓이다.
          */
          v_protected := '{}';
        end if;
      end if;

      v_d := v_d + 1;
    end loop;
  end if;

  -- ── 오늘 ───────────────────────────────────────────────────────────────────

  select jsonb_build_object(
    'day', v_today,
    'solvedQuestions', coalesce(s.solved_questions, 0),
    'correctQuestions', coalesce(s.correct_questions, 0),
    'setsCompleted', coalesce(s.sets_completed, 0),
    'activeSec', coalesce(s.active_sec, 0),
    'reviewsDone', coalesce(s.reviews_done, 0),
    'reviewsCorrect', coalesce(s.reviews_correct, 0),
    'notesAdded', coalesce(s.notes_added, 0),
    'notesMastered', coalesce(s.notes_mastered, 0),
    'gradedQuestions', coalesce(s.graded_questions, 0),
    'isStudyDay', coalesce(s.counts_as_study_day, false)
  )
  into v_today_row
  from (select 1) one
  left join public.v_daily_learning_stats s
    on s.student_id = p_student_id and s.day = v_today;

  -- ── 지금까지 ───────────────────────────────────────────────────────────────

  select jsonb_build_object(
    'studyDays', count(*) filter (where counts_as_study_day),
    'activeSec', coalesce(sum(active_sec), 0),
    'solvedQuestions', coalesce(sum(solved_questions), 0),
    'correctQuestions', coalesce(sum(correct_questions), 0),
    'setsCompleted', coalesce(sum(sets_completed), 0),
    'reviewsDone', coalesce(sum(reviews_done), 0),
    'reviewsCorrect', coalesce(sum(reviews_correct), 0),
    'notesAdded', coalesce(sum(notes_added), 0),
    'notesMastered', coalesce(sum(notes_mastered), 0),
    'firstDay', min(day)
  )
  into v_totals
  from public.v_daily_learning_stats
  where student_id = p_student_id;

  -- ── 나의 최고 기록 ─────────────────────────────────────────────────────────
  --
  -- **오늘을 뺀 최고(`prevBests`)를 함께 준다.** 결과 화면이 `8개 → 11개`를 말하려면 갱신
  -- 직전의 값이 필요한데, 갱신 시점을 따로 저장해 두면 그 기억이 갈린다. `오늘 > 오늘 뺀 최고`는
  -- 언제 다시 계산해도 같은 답이라 두 번 눌러도 두 번 세지 않는다.

  select jsonb_build_object(
    'questions', jsonb_build_object(
      'value', coalesce(max(solved_questions), 0),
      'day', (array_agg(day order by solved_questions desc, day desc))[1]
    ),
    'activeSec', jsonb_build_object(
      'value', coalesce(max(active_sec), 0),
      'day', (array_agg(day order by active_sec desc, day desc))[1]
    ),
    'reviewsCorrect', jsonb_build_object(
      'value', coalesce(max(reviews_correct), 0),
      'day', (array_agg(day order by reviews_correct desc, day desc))[1]
    )
  )
  into v_bests
  from public.v_daily_learning_stats
  where student_id = p_student_id;

  select jsonb_build_object(
    'questions', coalesce(max(solved_questions), 0),
    'activeSec', coalesce(max(active_sec), 0),
    'reviewsCorrect', coalesce(max(reviews_correct), 0)
  )
  into v_prev_bests
  from public.v_daily_learning_stats
  where student_id = p_student_id and day < v_today;

  -- ── 주 단위 ────────────────────────────────────────────────────────────────

  select jsonb_build_object(
    'monday', v_monday,
    'studyDays', count(*) filter (where counts_as_study_day),
    'activeSec', coalesce(sum(active_sec), 0),
    'solvedQuestions', coalesce(sum(solved_questions), 0),
    'setsCompleted', coalesce(sum(sets_completed), 0),
    'reviewsDone', coalesce(sum(reviews_done), 0),
    'reviewsCorrect', coalesce(sum(reviews_correct), 0),
    'notesAdded', coalesce(sum(notes_added), 0),
    'notesMastered', coalesce(sum(notes_mastered), 0)
  )
  into v_week_json
  from public.v_daily_learning_stats
  where student_id = p_student_id and day >= v_monday and day <= v_today;

  /*
    **지난주 같은 시점까지.** 진행 중인 주를 완성된 주와 비교하면 월요일마다 `-100%`가 뜬다.
    창의 길이를 이번 주의 경과 일수와 같게 맞춘다 — 오늘이 수요일이면 지난주 월~수다.
  */
  select jsonb_build_object(
    'monday', v_monday - 7,
    'throughDay', v_monday - 7 + (v_today - v_monday),
    'studyDays', count(*) filter (where counts_as_study_day),
    'activeSec', coalesce(sum(active_sec), 0),
    'solvedQuestions', coalesce(sum(solved_questions), 0),
    'setsCompleted', coalesce(sum(sets_completed), 0),
    'reviewsDone', coalesce(sum(reviews_done), 0),
    'reviewsCorrect', coalesce(sum(reviews_correct), 0),
    'notesAdded', coalesce(sum(notes_added), 0),
    'notesMastered', coalesce(sum(notes_mastered), 0)
  )
  into v_last_week_to_date
  from public.v_daily_learning_stats
  where student_id = p_student_id
    and day >= v_monday - 7
    and day <= v_monday - 7 + (v_today - v_monday);

  select jsonb_build_object(
    'monday', v_monday - 7,
    'studyDays', count(*) filter (where counts_as_study_day),
    'activeSec', coalesce(sum(active_sec), 0),
    'solvedQuestions', coalesce(sum(solved_questions), 0),
    'setsCompleted', coalesce(sum(sets_completed), 0),
    'reviewsDone', coalesce(sum(reviews_done), 0),
    'reviewsCorrect', coalesce(sum(reviews_correct), 0),
    'notesAdded', coalesce(sum(notes_added), 0),
    'notesMastered', coalesce(sum(notes_mastered), 0)
  )
  into v_last_week
  from public.v_daily_learning_stats
  where student_id = p_student_id and day >= v_monday - 7 and day < v_monday;

  /*
    최근 4주 평균. **이번 주는 넣지 않는다** — 아직 안 끝난 주를 평균에 섞으면 월요일마다
    "평균보다 낮다"가 나온다. 분모는 4주 고정이라 기록이 짧은 학생은 평균이 낮게 나오고,
    그것이 사실이다(없는 주를 0으로 세는 것이 맞다).
  */
  select jsonb_build_object(
    'solvedQuestions', round(coalesce(sum(solved_questions), 0) / 4.0, 1),
    'activeSec', round(coalesce(sum(active_sec), 0) / 4.0),
    'studyDays', round(count(*) filter (where counts_as_study_day) / 4.0, 1)
  )
  into v_avg4
  from public.v_daily_learning_stats
  where student_id = p_student_id and day >= v_monday - 28 and day < v_monday;

  select
    jsonb_build_object(
      'value', coalesce(max(q), 0),
      'monday', (array_agg(monday order by q desc, monday desc))[1]
    ),
    coalesce(jsonb_agg(jsonb_build_object(
      'monday', monday, 'solvedQuestions', q, 'studyDays', d, 'activeSec', sec
    ) order by monday), '[]'::jsonb)
  into v_best_week, v_weeks_json
  from (
    select
      (date_trunc('week', day))::date as monday,
      sum(solved_questions)::int as q,
      count(*) filter (where counts_as_study_day)::int as d,
      sum(active_sec)::int as sec
    from public.v_daily_learning_stats
    where student_id = p_student_id and day >= v_monday - 49
    group by 1
  ) w;

  select jsonb_build_object('value', coalesce(max(q), 0))
  into v_prev_best_week
  from (
    select sum(solved_questions)::int as q
    from public.v_daily_learning_stats
    where student_id = p_student_id and day < v_monday
    group by (date_trunc('week', day))::date
  ) w;

  -- ── 최근 28일(잔디) ───────────────────────────────────────────────────────
  --
  -- 없는 날도 행을 만든다. 빈 칸이 없으면 화면이 날짜를 셀 수 없다.

  select coalesce(jsonb_agg(jsonb_build_object(
    'day', g.day::date,
    'gradedQuestions', coalesce(s.graded_questions, 0),
    'activeSec', coalesce(s.active_sec, 0),
    'isStudyDay', coalesce(s.counts_as_study_day, false)
  ) order by g.day), '[]'::jsonb)
  into v_days_json
  from generate_series(v_today - (c_window - 1), v_today, interval '1 day') g(day)
  left join public.v_daily_learning_stats s
    on s.student_id = p_student_id and s.day = g.day::date;

  return jsonb_build_object(
    'studentId', p_student_id,
    'today', v_today_row,
    'streak', jsonb_build_object(
      'current', v_cur,
      'longest', v_longest,
      'protections', v_protect,
      'weekGoal', c_week_goal,
      /*
        지금 연속을 지킨 보호. 화면은 **가장 마지막 날**과 **개수**를 말한다 — 목록을 다 보여
        주면 `기록 보호` 한 줄이 목록이 된다.
      */
      'protectedDays', coalesce(to_jsonb(v_protected), '[]'::jsonb)
    ),
    'totals', v_totals,
    'bests', v_bests || jsonb_build_object('week', v_best_week),
    'prevBests', v_prev_bests || jsonb_build_object('week', v_prev_best_week -> 'value'),
    'week', v_week_json,
    'lastWeek', v_last_week,
    'lastWeekToDate', v_last_week_to_date,
    'avg4Weeks', v_avg4,
    'days', v_days_json,
    'weeks', v_weeks_json
  );
end;
$$;
