-- 기록 보호를 **주가 끝날 때가 아니라 목표를 채운 순간** 준다.
--
-- ## 0044의 판본이 틀린 이유
--
-- `0044`는 일요일에 그 주를 결산해서 보호를 줬다. 그런데 **빠지는 날은 결산 전에 온다.**
--
--     월 화 수 목 금  토  일
--     ○  ○  ○  ○  ○  ✕  ○     ← 주 5일을 채웠는데도 토요일에 연속이 끊긴다
--
-- 토요일을 판정할 때 보호는 아직 0이다(일요일 결산 전이므로). 그래서 월~금을 채운 학생의 연속이
-- 토요일에 0으로 떨어졌고, 그것은 이 장치가 막으려던 바로 그 일이다.
--
-- 실측으로 확인했다: 위 배열에서 `current`가 3(일·월·화)이 나왔다 — 보호가 한 번도 쓰이지 않았다.
--
-- ## 바꾼 규칙
--
-- 그 주의 학습일이 목표(`c_week_goal`)에 **닿는 순간** 보호 하나가 생긴다. 학생 화면도 그렇게
-- 말한다(`한 주에 5일을 채우면 하나씩 생겨요`) — 화면의 문장이 이미 이 규칙이었다.
--
-- 한 주에 하나까지만 준다(`= c_week_goal`로 판정하므로 6일·7일을 채워도 하나다). 쌓아 둘 수 있는
-- 최대는 그대로 2다.
--
-- 나머지 계산은 0044와 같다. **파생값이라 마이그레이션으로 옮길 데이터가 없다** — 함수만 바꾸면
-- 과거 기록도 새 규칙으로 다시 계산된다.

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
  v_today_row jsonb;
  v_totals jsonb;
  v_bests jsonb;
  v_prev_bests jsonb;
  v_week_json jsonb;
  v_last_week jsonb;
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
          **목표에 닿는 순간 준다.** `=`로 판정하므로 한 주에 하나까지다 — 6일·7일을 채운 주가
          보호를 두세 개씩 만들면 다음 주를 통째로 쉬어도 연속이 남는다.
        */
        if v_week_count = c_week_goal then
          v_protect := least(c_max_protect, v_protect + 1);
        end if;
      elsif v_d < v_today then
        if v_protect > 0 then
          v_protect := v_protect - 1;
        else
          v_cur := 0;
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
      'weekGoal', c_week_goal
    ),
    'totals', v_totals,
    'bests', v_bests || jsonb_build_object('week', v_best_week),
    'prevBests', v_prev_bests || jsonb_build_object('week', v_prev_best_week -> 'value'),
    'week', v_week_json,
    'lastWeek', v_last_week,
    'avg4Weeks', v_avg4,
    'days', v_days_json,
    'weeks', v_weeks_json
  );
end;
$$;
