-- 일별 집계 뷰가 학생 필터를 원천까지 내려보내게 고친다.
--
-- ## 실측한 결함
--
-- `0044`의 뷰는 CTE 다섯 개를 각각 **두 번** 참조했다 — `all_days`의 `union`에서 한 번, 아래
-- `left join`에서 또 한 번. PG12+는 **두 번 이상 참조된 CTE를 인라인하지 않으므로**(그것이
-- 최적화 방벽이다) `where student_id = $1`이 CTE 안으로 내려가지 못했다.
--
-- `explain (analyze, buffers) select * from v_daily_learning_stats where student_id = <정예린>`
-- 실측(2026-08-20, seed):
--
--     CTE attempt_day  → Seq Scan on attempts        rows=32   (정예린의 9일치가 아니라 전량)
--     CTE review_day   → Seq Scan on note_reviews    rows=6    (전량)
--     CTE note_day     → Seq Scan on wrong_notes     rows=11   (전량)
--     CTE time_day     → Seq Scan on study_activity  rows=45   (전량)
--
-- 즉 한 학생의 10행을 얻는 데 원천 94행을 전부 집계했다. 있는 인덱스
-- (`attempts_student_date_idx` · `note_reviews_student_idx` · `study_activity_student_day_idx` ·
-- `wrong_notes_student_idx`)가 **하나도 쓰이지 않았다.**
--
-- seed에서는 무료다. 문제는 기울기다 — `rpc_student_records`는 이 뷰를 **한 호출에 12번** 평가하고
-- (`from`/`join` 12곳), `rpc_readable_records`는 그것을 학생 수만큼 부른다. 학생 1,000명·1년치면
-- 원천이 수백만 행이 되고 그 전량 집계가 호출마다 12번 돈다.
--
-- ## 고친 방법
--
-- 갈래마다 **참조를 한 번으로** 만든다. 다섯 갈래를 `union all`로 같은 모양의 튜플로 쌓고
-- **한 번의 `group by student_id, day`**로 접는다. `all_days` + `left join` 다섯 벌이 사라지므로
-- 각 갈래가 단일 참조가 되고, `student_id`는 모든 층에서 그룹 키·union all 분기라 술어가
-- 원천까지 내려간다.
--
-- 값은 바뀌지 않는다 — 같은 갈래, 같은 집계, 같은 학습일 기준이다. `scripts/verify-records.ts`의
-- 항등식 단정(`graded = 풀이 + 복습` · `학습일 ⟺ 3문항` · 누적·최고·주간이 일별 합과 같다)이
-- 그것을 지킨다.
--
-- **0으로 채운 갈래를 `sum`한다.** 갈래마다 자기 컬럼만 값이고 나머지는 0이라, 합이 곧
-- `left join`이 하던 `coalesce`다. 없는 날은 애초에 행이 생기지 않으므로 `all_days`의 dedup도
-- 필요 없다.

create or replace view public.v_daily_learning_stats with (security_invoker = on) as
with parts as (
  /*
    ① 제출한 학습. **같은 학습을 같은 날 여러 번 내면 그 날은 한 번만 센다** — 재풀이는 회차가
    쌓이므로(`attempt_no`) 25문항 세트를 앉은 자리에서 40번 내면 누적이 1,000이 된다. 그것은
    공부가 아니라 버튼이다. **다른 날 다시 푸는 것은 공부다**(분산 인출이 이 레포 복습 스케줄의
    근거다) — 그래서 날짜별로 최신 회차 하나만 센다.
  */
  select
    student_id,
    day,
    sets_completed,
    solved_questions,
    correct_questions,
    0 as reviews_done,
    0 as reviews_correct,
    0 as notes_added,
    0 as notes_mastered,
    0 as active_sec
  from (
    select
      student_id,
      submitted_on as day,
      count(*)::int as sets_completed,
      sum(total_count)::int as solved_questions,
      sum(correct_count)::int as correct_questions
    from (
      select distinct on (
        a.student_id, a.submitted_on, a.source, coalesce(a.assignment_id, a.content_set_id)
      )
        a.student_id, a.submitted_on, a.total_count, a.correct_count
      from public.attempts a
      order by
        a.student_id, a.submitted_on, a.source, coalesce(a.assignment_id, a.content_set_id),
        a.attempt_no desc
    ) latest
    group by student_id, submitted_on
  ) att

  union all

  /*
    ② 다시 푼 오답. 부풀릴 수 없다 — `note_reviews_session` 유니크 인덱스가 한 노트 하루 한 행을
    강제한다(0037). 정오도 서버가 매긴다(0040).
  */
  select
    student_id, reviewed_on, 0, 0, 0,
    count(*)::int,
    count(*) filter (where is_correct)::int,
    0, 0, 0
  from public.note_reviews
  group by student_id, reviewed_on

  union all

  /* ③ 담은 오답. 지운 노트도 센다 — 담아서 한 번 본 사실은 지우기로 없어지지 않는다. */
  select
    student_id, (created_at at time zone 'Asia/Seoul')::date, 0, 0, 0, 0, 0,
    count(*)::int,
    0, 0
  from public.wrong_notes
  group by student_id, (created_at at time zone 'Asia/Seoul')::date

  union all

  /* ④ 익힘에 **처음** 닿은 날(0043). 익힘에서 떨어져도 이 수는 줄지 않는다. */
  select
    student_id, graduated_on, 0, 0, 0, 0, 0, 0,
    count(*)::int,
    0
  from public.wrong_notes
  where graduated_on is not null
  group by student_id, graduated_on

  union all

  /* ⑤ 활동이 있었던 학습 시간(0043). 하루가 여러 조각일 수 있고 0048이 오래된 날을 접는다. */
  select
    student_id, occurred_on, 0, 0, 0, 0, 0, 0, 0,
    sum(active_sec)::int
  from public.study_activity
  group by student_id, occurred_on
)
select
  student_id,
  day,
  sum(sets_completed)::int as sets_completed,
  sum(solved_questions)::int as solved_questions,
  sum(correct_questions)::int as correct_questions,
  sum(reviews_done)::int as reviews_done,
  sum(reviews_correct)::int as reviews_correct,
  sum(notes_added)::int as notes_added,
  sum(notes_mastered)::int as notes_mastered,
  sum(active_sec)::int as active_sec,
  /*
    **서버가 채점한 문항 수.** 제출한 학습의 문항 + 다시 푼 오답 카드다. 둘 다 서버가 정답과
    대조한 결과라(`rpc_submit_attempt`·`rpc_log_note_review`) 클릭이나 체류로는 자라지 않는다.
  */
  (sum(solved_questions) + sum(reviews_done))::int as graded_questions,
  /*
    **'의미 있는 학습일'의 정의: 서버가 채점한 문항이 3개 이상인 날.**

    앱 실행은 여기 들어오지 않는다(`learning_events`의 `answer_saved`와 다른 기준이다 — 그쪽은
    "서비스를 썼나"를 세는 운영자 지표 D-1이고, 이쪽은 "공부했나"다).

    왜 1이 아니라 3인가: 오답 카드 한 장은 문항 하나이고 30초다. 그것을 `공부한 날`이라고 부르면
    학부모 화면의 `이번 주 5일 공부했어요`가 실제 학습량을 말하지 못한다.
    왜 5나 10이 아닌가: 학습 세트는 가장 작은 것이 3문항이고, 오늘 볼 오답 큐는 하루 5장까지다
    (D-176). 3이면 **어떤 날에도 달성할 수 있는 경로가 반드시 하나 있다.**

    **이 값이 `rpc_student_records`의 `studyDayQuestions`로도 나간다**(0051) — 화면이 이 기준을
    말할 때 클라이언트 상수를 쓰지 않게 하기 위해서다.
  */
  (sum(solved_questions) + sum(reviews_done)) >= 3 as counts_as_study_day
from parts
group by student_id, day;

comment on view public.v_daily_learning_stats is
  '학생 하루의 학습 사실(일별 집계 층). 원천 표에서 파생되며 저장하지 않는다 — 중복 집계와 '
  '백필이 생길 자리를 만들지 않기 위해서다. 학습일 기준은 채점 문항 3개 이상. '
  '갈래마다 참조가 한 번이라 student_id 술어가 원천 인덱스까지 내려간다(0050).';
