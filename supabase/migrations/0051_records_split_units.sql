-- `rpc_student_records`를 교체 단위가 작은 조각으로 쪼갠다.
--
-- ## 왜 쪼개는가
--
-- Postgres의 `create or replace function`은 **본문 전체**를 요구한다. 그래서 규칙을 세 번 고치는
-- 동안(0046 보호 시점 · 0047 보호 2개와 지난주 창 · 0049 보호 사용 날짜) 매번 함수를 통째로
-- 다시 적었다. 실측하면 실제로 바뀐 줄은 49 / 35 / 25줄이고 판본마다 본문이 약 300줄이다 —
-- **약 860줄이 "바뀌지 않았다"는 사실만 다시 적은 SQL**이다.
--
-- 이 레포는 그 위험을 이미 겪고 기록해 두었다. `0029`가 머리에서 본문 재작성을 명시적으로
-- 거부하며 근거로 든 것이 그것이다 — `0026`에서 본문을 부분만 읽고 옮겨 적어 콘텐츠 소유권
-- 검사와 제출 후 초안·담아둔목록 정리를 하마터면 잃을 뻔했다. 이 시스템은 그 위험에 세 번
-- 노출됐고 매번 눈으로 대조해서 통과했다.
--
-- 규칙 전용 표를 만들지는 않는다 — 이 설계는 파생값 저장을 의도적으로 피했고(0044) 그 판단을
-- 되돌릴 이유가 없다. 대신 **교체되는 단위를 작게** 만든다.
--
-- ## 무엇을 떼어내는가
--
-- 1. **`f_window_sum`** — 창 하나의 8개 합. 지금 `totals` · `week` · `lastWeekToDate` · `lastWeek`
--    네 자리에 같은 8필드가 창만 다르게 적혀 있다. 지표를 하나 더하면 네 곳을 고쳐야 하고,
--    하나를 빠뜨리면 `이번 주`에는 있고 `지난주 이맘때`에는 없는 필드가 생겨 **비교 줄이 조용히
--    빈다**(`WeekRecord`는 세 값이 같은 타입이라 TypeScript가 그 누락을 잡지 못한다).
-- 2. **`f_student_streak`** — 연속·최장·보호·보호 사용일. 세 번의 규칙 변경이 **전부** 이 루프만
--    건드렸다. 떼어내면 다음 변경이 60줄 교체가 되고, 규칙 상수 셋(`c_week_goal` ·
--    `c_max_protect` · `c_week_grant`)이 그것을 쓰는 유일한 함수에 모인다.
--
-- 선례는 이 시스템 안에 있다 — `0045`의 `rpc_readable_records`가 대상 판정만 하고 계산을
-- `rpc_student_records`에 위임하며 그 근거를 적어 두었다("그 함수를 부르므로 규칙이 한 곳에만
-- 있다"). 같은 판단을 한 단계 안쪽에 적용하는 일이다.
--
-- ## 함께 고친 것
--
-- - **연속 계산이 기간의 제곱이었다.** `v_d = any(v_days)`가 하루마다 정렬된 배열을 선형
--   탐색했다 — 1년 매일 학습이면 비교 66,795회, 3년이면 551,232회(실측 시뮬레이션). 배열이 이미
--   오름차순이므로 커서를 함께 전진시키면 `기간 + 학습일`이 된다(1년 730회 · 91배).
-- - **학습일 기준을 응답에 싣는다**(`studyDayQuestions`). 같은 종류의 규칙인 `weekGoal`은 이미
--   서버가 실어 보내는데 이 값만 클라이언트 상수였다 — 규칙 하나가 두 진실을 갖는 상태였다.
-- - **`rpc_readable_records`가 학부모 자신의 빈 기록을 만들지 않는다.** 대상에 늘 호출자를
--   넣었는데 `records`(자기 것)를 읽는 화면은 학생 화면 둘뿐이다. 자녀 2명 학부모의 계산 중
--   33%가 아무도 읽지 않는 0값 레코드였다.
--
-- 값은 바뀌지 않는다(`studyDayQuestions` 추가와 학부모 자기 레코드 제거 둘뿐이다).
-- `scripts/verify-records.ts`의 72단정이 그것을 지킨다.

-- ── 창 하나의 합 ─────────────────────────────────────────────────────────────

/**
 * `[p_from, p_to]` 구간의 학습 사실 8개.
 *
 * 창을 바꿔 네 자리에서 부른다 — 누적(첫 기록~오늘) · 이번 주 · 지난주 같은 시점까지 ·
 * 완성된 지난주. **지표를 더할 자리는 이제 여기 하나다.**
 *
 * `p_extra`로 창마다 다른 키를 얹는다(`monday` · `throughDay` · `firstDay`) — 그 셋은 창의
 * 정체를 말하는 값이라 합계와 성격이 다르다.
 */
create or replace function public.f_window_sum(
  p_student_id uuid,
  p_from date,
  p_to date,
  p_extra jsonb default '{}'::jsonb
)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select p_extra || jsonb_build_object(
    'studyDays', count(*) filter (where counts_as_study_day),
    'activeSec', coalesce(sum(active_sec), 0),
    'solvedQuestions', coalesce(sum(solved_questions), 0),
    'correctQuestions', coalesce(sum(correct_questions), 0),
    'setsCompleted', coalesce(sum(sets_completed), 0),
    'reviewsDone', coalesce(sum(reviews_done), 0),
    'reviewsCorrect', coalesce(sum(reviews_correct), 0),
    'notesAdded', coalesce(sum(notes_added), 0),
    'notesMastered', coalesce(sum(notes_mastered), 0)
  )
  from public.v_daily_learning_stats
  where student_id = p_student_id and day >= p_from and day <= p_to;
$$;

-- ── 연속 학습일 ──────────────────────────────────────────────────────────────

/**
 * 연속·최장·남은 보호·보호로 지킨 날.
 *
 * **규칙이 여기 모여 있다.** 세 번의 변경(0046·0047·0049)이 전부 이 계산만 건드렸는데 매번
 * `rpc_student_records` 300줄을 함께 옮겨 적어야 했다.
 *
 * - **하루 빠졌다고 몇 달의 노력이 0이 되지 않게 한다.** 그 주의 학습일이 목표에 닿으면 보호가
 *   주말 이틀만큼 생기고 최대 두 개까지 쌓인다. 빠진 날은 보호가 있으면 그것이 메운다.
 * - **보호받은 날은 연속을 늘리지 않는다.** 끊지도 않고 늘리지도 않는다 — 공부하지 않은 날을
 *   `17일째 공부 중`의 하루로 세면 그 숫자가 거짓이 된다.
 * - **오늘은 판정하지 않는다.** 아직 끝나지 않은 하루를 결석으로 세면 매일 아침 연속이 끊긴다.
 * - **보호로 지킨 날은 연속이 끊기는 자리에서 비운다** — 지금 화면에 서 있는 연속을 지킨 보호만
 *   말해야 한다(석 달 전에 쓴 보호를 `방금 하나 썼어요`처럼 말하면 그것도 거짓이다).
 */
create or replace function public.f_student_streak(p_student_id uuid)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  -- 주간 목표: 한 주(월~일)에 이 일수를 채우면 보호를 얻는다.
  c_week_goal constant int := 5;
  -- 쌓아 둘 수 있는 보호의 최대. 무제한이면 한 달을 쉬어도 연속이 남아 뜻을 잃는다.
  c_max_protect constant int := 2;
  -- 목표를 채운 주가 주는 보호 수. **주말 이틀과 같은 수다** — 하나면 일요일에 끊긴다(0047).
  c_week_grant constant int := 2;

  v_today date := public.today_kst();
  v_days date[];
  v_cur int := 0;
  v_longest int := 0;
  v_protect int := 0;
  v_protected date[] := '{}';
  v_d date;
  v_i int := 1;
  v_n int;
  v_is_study boolean;
  v_week date;
  v_prev_week date;
  v_week_count int := 0;
begin
  select array_agg(day order by day)
  into v_days
  from public.v_daily_learning_stats
  where student_id = p_student_id and counts_as_study_day;

  if v_days is null then
    return jsonb_build_object(
      'current', 0, 'longest', 0, 'protections', 0,
      'weekGoal', c_week_goal, 'protectedDays', '[]'::jsonb
    );
  end if;

  v_n := array_length(v_days, 1);
  v_d := v_days[1];
  while v_d <= v_today loop
    -- 주가 바뀌면 그 주의 학습일 수를 다시 센다.
    v_week := (date_trunc('week', v_d))::date;
    if v_prev_week is null or v_week <> v_prev_week then
      v_prev_week := v_week;
      v_week_count := 0;
    end if;

    /*
      **커서로 판정한다.** 예전에는 `v_d = any(v_days)`였는데 그것은 하루마다 배열을 선형
      탐색해서 비용이 기간의 제곱이었다(1년 매일이면 비교 66,795회 · 3년이면 551,232회).
      배열이 오름차순이므로 커서를 함께 전진시키면 총 비교가 `기간 + 학습일`이 된다.
    */
    while v_i <= v_n and v_days[v_i] < v_d loop
      v_i := v_i + 1;
    end loop;
    v_is_study := v_i <= v_n and v_days[v_i] = v_d;

    if v_is_study then
      v_cur := v_cur + 1;
      if v_cur > v_longest then
        v_longest := v_cur;
      end if;
      v_week_count := v_week_count + 1;
      /*
        **목표에 닿는 순간 준다.** `=`로 판정하므로 한 주에 한 번이다 — 6일·7일을 채운 주가
        보호를 계속 만들지 않는다(상한 `c_max_protect`도 그대로다).
      */
      if v_week_count = c_week_goal then
        v_protect := least(c_max_protect, v_protect + c_week_grant);
      end if;
    elsif v_d < v_today then
      if v_protect > 0 then
        v_protect := v_protect - 1;
        v_protected := array_append(v_protected, v_d);
      else
        v_cur := 0;
        v_protected := '{}';
      end if;
    end if;

    v_d := v_d + 1;
  end loop;

  return jsonb_build_object(
    'current', v_cur,
    'longest', v_longest,
    'protections', v_protect,
    'weekGoal', c_week_goal,
    'protectedDays', coalesce(to_jsonb(v_protected), '[]'::jsonb)
  );
end;
$$;

-- ── 화면이 쓰는 묶음 ─────────────────────────────────────────────────────────

/**
 * 화면이 쓰는 기록 묶음. **한 번의 왕복이다.**
 *
 * 학생 홈·기록 화면·결과 화면·학부모 리포트가 같은 값을 본다. 화면마다 따로 계산하면 같은
 * 사실이 자리마다 달라진다 — 이 레포가 D-048·D-052·D-060에서 세 번 고친 결함의 모양이다.
 *
 * 권한은 `rpc_class_comparisons`(0022)와 같은 가드를 쓴다: 본인 · 연결된 학부모 · 운영자.
 * **학원은 여기 오지 않는다.**
 *
 * 계산은 두 함수에 위임한다(`f_window_sum` · `f_student_streak`) — 이 함수는 창을 정하고
 * 조각을 모으는 일만 한다.
 */
create or replace function public.rpc_student_records(p_student_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  -- 화면이 그리는 잔디의 길이(4주).
  c_window constant int := 28;
  -- 추이선이 보는 주 수(이번 주 포함 8주 → 화면은 끝난 주만 그린다).
  c_weeks constant int := 8;
  /*
    학습일로 인정되는 최소 채점 문항. **뷰의 판정과 같은 값이어야 한다**
    (`v_daily_learning_stats.counts_as_study_day`). 화면이 이 기준을 말할 때 클라이언트 상수를
    쓰지 않도록 응답에 싣는다 — `weekGoal`이 이미 그 방식이다.
  */
  c_study_day_questions constant int := 3;

  v_today date := public.today_kst();
  v_monday date := (date_trunc('week', public.today_kst()))::date;
  v_first date;
  v_totals jsonb;
begin
  if not (public.can_read_student(p_student_id) or public.is_admin()) then
    raise exception '이 학생의 기록을 볼 수 없어요.';
  end if;

  select min(day) into v_first
  from public.v_daily_learning_stats
  where student_id = p_student_id;

  /*
    누적. 창의 시작은 첫 기록이고, 없으면 오늘로 두어 빈 합이 나온다(`f_window_sum`이
    `coalesce`로 0을 만든다).
  */
  v_totals := public.f_window_sum(
    p_student_id,
    coalesce(v_first, v_today),
    v_today,
    jsonb_build_object('firstDay', v_first)
  );

  return jsonb_build_object(
    'studentId', p_student_id,
    'studyDayQuestions', c_study_day_questions,
    'today', (
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
      from (select 1) one
      left join public.v_daily_learning_stats s
        on s.student_id = p_student_id and s.day = v_today
    ),
    'streak', public.f_student_streak(p_student_id),
    'totals', v_totals,
    /*
      나의 최고 기록. **오늘을 뺀 최고(`prevBests`)를 함께 준다** — 결과 화면이 `8개 → 11개`를
      말하려면 갱신 직전의 값이 필요한데, 갱신 시점을 저장해 두면 그 기억이 갈린다.
      `오늘 > 오늘 뺀 최고`는 언제 다시 계산해도 같은 답이라 두 번 봐도 두 번 세지 않는다.
    */
    'bests', (
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
        ),
        'week', (
          select jsonb_build_object(
            'value', coalesce(max(q), 0),
            'monday', (array_agg(monday order by q desc, monday desc))[1]
          )
          from (
            select (date_trunc('week', day))::date as monday, sum(solved_questions)::int as q
            from public.v_daily_learning_stats
            where student_id = p_student_id
            group by 1
          ) w
        )
      )
      from public.v_daily_learning_stats
      where student_id = p_student_id
    ),
    'prevBests', (
      select jsonb_build_object(
        'questions', coalesce(max(solved_questions), 0),
        'activeSec', coalesce(max(active_sec), 0),
        'reviewsCorrect', coalesce(max(reviews_correct), 0),
        'week', (
          select coalesce(max(q), 0)
          from (
            select sum(solved_questions)::int as q
            from public.v_daily_learning_stats
            where student_id = p_student_id and day < v_monday
            group by (date_trunc('week', day))::date
          ) w
        )
      )
      from public.v_daily_learning_stats
      where student_id = p_student_id and day < v_today
    ),
    'week', public.f_window_sum(
      p_student_id, v_monday, v_today, jsonb_build_object('monday', v_monday)
    ),
    /*
      **지난주 같은 시점까지.** 진행 중인 주를 완성된 주와 비교하면 월요일마다 `-100%`가 뜬다 —
      창의 길이를 이번 주의 경과 일수와 같게 맞춘다(§18-0의 같은 판단).
    */
    'lastWeekToDate', public.f_window_sum(
      p_student_id,
      v_monday - 7,
      v_monday - 7 + (v_today - v_monday),
      jsonb_build_object(
        'monday', v_monday - 7,
        'throughDay', v_monday - 7 + (v_today - v_monday)
      )
    ),
    /* 완성된 지난주 7일. `주간 최다 풀이`와 주가 끝난 뒤의 비교가 쓴다. */
    'lastWeek', public.f_window_sum(
      p_student_id, v_monday - 7, v_monday - 1, jsonb_build_object('monday', v_monday - 7)
    ),
    /*
      최근 4주 평균. **이번 주는 넣지 않는다** — 아직 안 끝난 주를 평균에 섞으면 월요일마다
      "평균보다 낮다"가 나온다. 분모는 4주 고정이라 기록이 짧은 학생은 평균이 낮게 나오고,
      그것이 사실이다(없는 주를 0으로 세는 것이 맞다).
    */
    'avg4Weeks', (
      select jsonb_build_object(
        'solvedQuestions', round(coalesce(sum(solved_questions), 0) / 4.0, 1),
        'activeSec', round(coalesce(sum(active_sec), 0) / 4.0),
        'studyDays', round(count(*) filter (where counts_as_study_day) / 4.0, 1)
      )
      from public.v_daily_learning_stats
      where student_id = p_student_id and day >= v_monday - 28 and day < v_monday
    ),
    /* 최근 28일. 없는 날도 행을 만든다 — 빈 칸이 없으면 화면이 날짜를 셀 수 없다. */
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', g.day::date,
        'gradedQuestions', coalesce(s.graded_questions, 0),
        'activeSec', coalesce(s.active_sec, 0),
        'isStudyDay', coalesce(s.counts_as_study_day, false)
      ) order by g.day), '[]'::jsonb)
      from generate_series(v_today - (c_window - 1), v_today, interval '1 day') g(day)
      left join public.v_daily_learning_stats s
        on s.student_id = p_student_id and s.day = g.day::date
    ),
    'weeks', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'monday', monday, 'solvedQuestions', q, 'studyDays', d, 'activeSec', sec
      ) order by monday), '[]'::jsonb)
      from (
        select
          (date_trunc('week', day))::date as monday,
          sum(solved_questions)::int as q,
          count(*) filter (where counts_as_study_day)::int as d,
          sum(active_sec)::int as sec
        from public.v_daily_learning_stats
        where student_id = p_student_id and day >= v_monday - 7 * (c_weeks - 1)
        group by 1
      ) w
    )
  );
end;
$$;

-- ── 대상 판정 ────────────────────────────────────────────────────────────────

/**
 * `auth.uid()`가 볼 수 있는 학생들의 기록. `{ "<student_id>": { … } }` 형태다.
 *
 * 연결이 승인된 자녀 + **학생 역할일 때만** 본인. 각 값의 모양은 `rpc_student_records`와 같다 —
 * 그 함수를 부르므로 규칙이 한 곳에만 있다.
 *
 * **본인을 무조건 넣지 않는다.** `records`(자기 것)를 읽는 화면은 학생 화면 둘뿐이라
 * (`app/student/index.tsx` · `result/[id].tsx`), 학부모에게는 아무도 읽지 않는 0값 레코드를
 * 만드는 일이었다 — 자녀 2명이면 계산의 33%가 그것이었다. 학부모가 학생을 겸하는 계정은
 * `user_roles`에 학생 역할이 있으므로 그대로 받는다.
 *
 * **운영자에게는 자기 자신만 준다.** `can_read_student`는 운영자에게 모든 학생을 열지만, 여기서
 * 그 범위를 쓰면 계정 수만큼 일별 집계를 돌린다. 운영자 화면은 이 함수를 읽지 않는다 —
 * 대리 보기로 학생이 되어 들어가는 경로가 그 자리다.
 */
create or replace function public.rpc_readable_records()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb := '{}'::jsonb;
  v_id uuid;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.';
  end if;

  for v_id in
    select v_uid
    where exists (
      select 1 from public.user_roles r where r.user_id = v_uid and r.role = 'student'
    )
    union
    select pc.student_id
    from public.parent_children pc
    where pc.parent_id = v_uid and pc.status = 'linked'
  loop
    v_result := v_result || jsonb_build_object(
      v_id::text, public.rpc_student_records(v_id)
    );
  end loop;

  return v_result;
end;
$$;

-- ── 권한 ─────────────────────────────────────────────────────────────────────
--
-- 새 두 함수는 `rpc_student_records`가 가드를 지난 뒤에만 불린다. 그래도 PUBLIC 실행 기본값을
-- 회수한다 — 열려 있으면 가드를 지나지 않고 남의 연속·합계를 읽을 수 있다(0030의 규칙).

revoke all on function public.f_window_sum(uuid, date, date, jsonb) from public, anon, authenticated;
revoke all on function public.f_student_streak(uuid) from public, anon, authenticated;

comment on function public.f_window_sum(uuid, date, date, jsonb) is
  '창 하나의 학습 사실 8개. 지표를 더할 자리는 여기 하나다 — 예전에는 네 곳에 창만 다르게 '
  '적혀 있었다. 가드는 부르는 쪽(rpc_student_records)에 있고 앱 역할은 실행할 수 없다.';
comment on function public.f_student_streak(uuid) is
  '연속·최장·보호·보호로 지킨 날. 보호 규칙 상수가 여기 모여 있다 — 세 번의 규칙 변경이 전부 '
  '이 계산만 건드렸는데 매번 rpc_student_records 300줄을 함께 옮겨 적어야 했다.';
