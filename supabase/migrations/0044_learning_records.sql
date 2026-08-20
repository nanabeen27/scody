-- 학습 기록: 일별 집계 뷰 하나와 그것을 읽는 함수 하나.
--
-- ## 왜 집계 표를 만들지 않는가
--
-- 흔한 설계는 `daily_learning_stats` 표를 두고 쓰기 경로마다 숫자를 올리는 것이다. 이 레포에서
-- 그것을 하지 않는 이유는 세 가지다.
--
-- 1. **중복 집계가 구조적으로 불가능해진다.** 증분 갱신은 "이미 셌는지"를 어딘가에 기억해야
--    한다. 새로고침·재시도·중복 요청이 그 기억을 건드리는 순간 값이 갈리고, 갈린 뒤에는 무엇이
--    맞는지 알 방법이 없다. 파생값을 저장하지 않는 판단은 이 레포가 이미 세 번 했다
--    (`attempts.accuracy`는 generated column이고, `assignment_targets`에 `submitted`를 두지
--    않았고, `Submission`/`Attempt`의 중복을 0007이 합쳤다).
-- 2. **백필이 필요 없다.** 뷰는 이미 쌓여 있는 `attempts`·`note_reviews`·`wrong_notes`를 그대로
--    읽으므로, 기존 사용자의 과거 기록이 처음 조회에서 전부 나온다. 마이그레이션으로 옮길
--    숫자가 없다.
-- 3. **지표를 늘리기 쉽다.** 새 지표는 뷰에 컬럼 하나이고, 과거 데이터에도 즉시 적용된다.
--    표에 담아 두면 새 지표마다 백필 스크립트가 하나씩 생긴다.
--
-- 역할은 그래도 갈라 둔다: **원천은 표**(`attempts`·`attempt_answers`·`note_reviews`·
-- `wrong_notes`·`study_activity`), **일별 집계는 이 뷰**, **화면이 쓰는 묶음은 아래 함수**다.
-- 규모가 커져 이 뷰가 느려지면 같은 이름의 물리 표나 matview로 바꿔 끼울 수 있다 — 함수와 화면은
-- 뷰 이름만 알고 있다.

/**
 * 학생 하루의 학습 사실.
 *
 * **하루의 경계는 `Asia/Seoul`이다.** `attempts.submitted_on`·`note_reviews.reviewed_on`·
 * `study_activity.occurred_on`은 모두 `today_kst()`로 쓰인 date라 이미 맞고, `wrong_notes`만
 * timestamptz라 여기서 변환한다.
 *
 * **`security_invoker = on`**: 밑 표들의 정책이 이미 범위를 정한다(본인·연결된 학부모·운영자).
 * 학원 교직원에게는 `attempts`·`note_reviews`·`study_activity` 정책이 0행을 주므로 이 뷰도
 * 0행이다 — 확정 정책 2절이 학원에 개인 학습 상세를 열지 않는 것과 같은 결과다.
 */
create view public.v_daily_learning_stats with (security_invoker = on) as
with day_attempts as (
  /*
    **같은 학습을 같은 날 여러 번 내면 그 날은 한 번만 센다.**

    재풀이는 회차가 쌓이므로(`attempt_no`) 25문항 세트를 앉은 자리에서 40번 내면 누적 문항이
    1,000이 된다. 그것은 공부가 아니라 버튼이다. 그런데 **다른 날 다시 푸는 것은 공부다**
    (분산 인출이 이 레포의 복습 스케줄 근거다) — 그래서 날짜별로 최신 회차 하나만 센다.
  */
  select distinct on (
    a.student_id, a.submitted_on, a.source, coalesce(a.assignment_id, a.content_set_id)
  )
    a.student_id,
    a.submitted_on as day,
    a.total_count,
    a.correct_count
  from public.attempts a
  order by
    a.student_id, a.submitted_on, a.source, coalesce(a.assignment_id, a.content_set_id),
    a.attempt_no desc
),
attempt_day as (
  select
    student_id,
    day,
    count(*)::int as sets_completed,
    sum(total_count)::int as solved_questions,
    sum(correct_count)::int as correct_questions
  from day_attempts
  group by student_id, day
),
review_day as (
  /*
    부풀릴 수 없다 — `note_reviews_session` 유니크 인덱스가 한 노트 하루 한 행을 강제한다
    (0037). 정오도 서버가 매긴다(0040).
  */
  select
    student_id,
    reviewed_on as day,
    count(*)::int as reviews_done,
    count(*) filter (where is_correct)::int as reviews_correct
  from public.note_reviews
  group by student_id, reviewed_on
),
note_day as (
  /* 지운 노트도 센다 — 담아서 한 번 본 사실은 지우기로 없어지지 않는다. */
  select
    student_id,
    (created_at at time zone 'Asia/Seoul')::date as day,
    count(*)::int as notes_added
  from public.wrong_notes
  group by 1, 2
),
mastered_day as (
  /* 익힘에 **처음** 닿은 날(0043). 익힘에서 떨어져도 이 수는 줄지 않는다. */
  select
    student_id,
    graduated_on as day,
    count(*)::int as notes_mastered
  from public.wrong_notes
  where graduated_on is not null
  group by 1, 2
),
time_day as (
  select
    student_id,
    occurred_on as day,
    sum(active_sec)::int as active_sec
  from public.study_activity
  group by 1, 2
),
all_days as (
  select student_id, day from attempt_day
  union select student_id, day from review_day
  union select student_id, day from note_day
  union select student_id, day from mastered_day
  union select student_id, day from time_day
)
select
  d.student_id,
  d.day,
  coalesce(a.sets_completed, 0) as sets_completed,
  coalesce(a.solved_questions, 0) as solved_questions,
  coalesce(a.correct_questions, 0) as correct_questions,
  coalesce(r.reviews_done, 0) as reviews_done,
  coalesce(r.reviews_correct, 0) as reviews_correct,
  coalesce(n.notes_added, 0) as notes_added,
  coalesce(m.notes_mastered, 0) as notes_mastered,
  coalesce(t.active_sec, 0) as active_sec,
  /*
    **서버가 채점한 문항 수.** 제출한 학습의 문항 + 다시 푼 오답 카드다. 둘 다 서버가 정답과
    대조한 결과라(`rpc_submit_attempt`·`rpc_log_note_review`) 클릭이나 체류로는 자라지 않는다.
  */
  (coalesce(a.solved_questions, 0) + coalesce(r.reviews_done, 0)) as graded_questions,
  /*
    **'의미 있는 학습일'의 정의: 서버가 채점한 문항이 3개 이상인 날.**

    앱 실행은 여기 들어오지 않는다(`learning_events`의 `answer_saved`와 다른 기준이다 —
    그쪽은 "서비스를 썼나"를 세는 운영자 지표 D-1이고, 이쪽은 "공부했나"다).

    왜 1이 아니라 3인가: 오답 카드 한 장은 문항 하나이고 30초다. 그것을 `공부한 날`이라고
    부르면 학부모 화면의 `이번 주 5일 공부했어요`가 실제 학습량을 말하지 못한다.
    왜 5나 10이 아닌가: 학습 세트는 가장 작은 것이 3문항이고, 오늘 볼 오답 큐는 하루 5장까지다
    (D-176). 3이면 **어떤 날에도 달성할 수 있는 경로가 반드시 하나 있다.**
  */
  (coalesce(a.solved_questions, 0) + coalesce(r.reviews_done, 0)) >= 3 as counts_as_study_day
from all_days d
left join attempt_day a on a.student_id = d.student_id and a.day = d.day
left join review_day r on r.student_id = d.student_id and r.day = d.day
left join note_day n on n.student_id = d.student_id and n.day = d.day
left join mastered_day m on m.student_id = d.student_id and m.day = d.day
left join time_day t on t.student_id = d.student_id and t.day = d.day;

grant select on public.v_daily_learning_stats to authenticated;

comment on view public.v_daily_learning_stats is
  '학생 하루의 학습 사실(일별 집계 층). 원천 표에서 파생되며 저장하지 않는다 — 중복 집계와 '
  '백필이 생길 자리를 만들지 않기 위해서다. 학습일 기준은 채점 문항 3개 이상.';

/**
 * 화면이 쓰는 기록 묶음. **한 번의 왕복이다.**
 *
 * 학생 홈·기록 화면·결과 화면·학부모 리포트가 같은 값을 본다. 화면마다 따로 계산하면 같은
 * 사실이 자리마다 달라진다 — 이 레포가 D-048·D-052·D-060에서 세 번 고친 결함의 모양이다.
 *
 * 권한은 `rpc_class_comparisons`(0022)와 같은 가드를 쓴다: 본인 · 연결된 학부모 · 운영자.
 * **학원은 여기 오지 않는다.**
 */
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
  v_week_days int;
  v_today_row jsonb;
  v_totals jsonb;
  v_bests jsonb;
  v_prev_bests jsonb;
  v_week jsonb;
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
  -- **하루 빠졌다고 몇 달의 노력이 0이 되지 않게 한다.** 주간 목표(5일)를 채운 주마다 보호가
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
      v_is_study := v_d = any(v_days);
      if v_is_study then
        v_cur := v_cur + 1;
        if v_cur > v_longest then
          v_longest := v_cur;
        end if;
      elsif v_d < v_today then
        if v_protect > 0 then
          v_protect := v_protect - 1;
        else
          v_cur := 0;
        end if;
      end if;

      /*
        주가 끝나는 날(일요일)에 그 주를 결산한다. **끝난 주만** 결산한다 — 이번 주는 아직
        채울 수 있으므로 보호를 미리 주면 목표의 뜻이 없어진다.
      */
      if extract(isodow from v_d) = 7 and v_d < v_today then
        select count(*)::int into v_week_days
        from unnest(v_days) x
        where x > v_d - 7 and x <= v_d;
        if v_week_days >= c_week_goal then
          v_protect := least(c_max_protect, v_protect + 1);
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
  --
  -- 주의 시작은 월요일이다(`date_trunc('week', …)`가 ISO 주를 쓴다).

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
  into v_week
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
    'week', v_week,
    'lastWeek', v_last_week,
    'avg4Weeks', v_avg4,
    'days', v_days_json,
    'weeks', v_weeks_json
  );
end;
$$;

revoke all on function public.rpc_student_records(uuid) from public, anon;
grant execute on function public.rpc_student_records(uuid) to authenticated;

comment on function public.rpc_student_records(uuid) is
  '학생 기록 묶음(오늘·연속·누적·최고·주간·잔디). 권한은 can_read_student 또는 is_admin — '
  '학원 경로는 없다. 모든 값이 v_daily_learning_stats에서 파생되므로 저장된 상태가 없다.';
