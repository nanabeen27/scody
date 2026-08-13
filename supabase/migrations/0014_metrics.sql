-- 집계 함수.
--
-- **클라이언트가 전체 계정을 훑지 않게 한다.** 프로토타입은 `adminMetrics.ts`가 4천 개 계정과
-- 1.7만 제출 행을 브라우저에서 돌렸다. 이제 집계는 여기서 하고 화면은 결과만 받는다.
--
-- 반환은 `jsonb`다. 지표가 늘어날 때 함수 시그니처를 바꾸지 않아도 되고, 클라이언트 타입은
-- `src/features/*.ts`에 한 번만 적는다.

/**
 * 콘텐츠 한 세트의 사용 집계.
 *
 * `src/data/usage.ts`가 문항 id를 해시로 돌려 만들던 값을 **실제 풀이에서** 낸다.
 * 풀이가 아직 없으면 0과 빈 배열이 나온다 — 그것이 사실이다.
 *
 * 권한: 운영자, 또는 그 콘텐츠를 등록한 학원의 교직원.
 */
create or replace function public.rpc_content_usage(p_content_set_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not (
    public.is_admin()
    or exists (
      select 1 from public.content_sets s
      where s.id = p_content_set_id and s.owner_academy_id = public.my_academy_id()
    )
  ) then
    raise exception '이 콘텐츠의 사용 기록을 볼 수 없어요.';
  end if;

  select jsonb_build_object(
    'content_set_id', p_content_set_id,
    'academy_solves', coalesce(sum(case when a.source = 'academy' then 1 else 0 end), 0),
    'personal_solves', coalesce(sum(case when a.source = 'personal' then 1 else 0 end), 0),
    -- 정답률 평균은 문항 수로 가중한다(세트 크기가 달라도 뜻이 유지된다 — D-052).
    'avg_accuracy', case
      when coalesce(sum(a.total_count), 0) = 0 then null
      else round(sum(a.correct_count)::numeric * 100 / sum(a.total_count))::int
    end,
    'attempts', count(*)
  )
  into v_result
  from public.attempts a
  where a.content_set_id = p_content_set_id;

  -- 문항별 오답률. 어려운 문항을 찾는 데 쓴다.
  return v_result || jsonb_build_object(
    'wrong_rate_by_question',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'question_id', q.id,
          'position', q.position,
          'answered', stat.answered,
          'wrong_rate', stat.wrong_rate
        ) order by q.position
      )
      from public.questions q
      left join lateral (
        select
          count(*)::int as answered,
          case when count(*) = 0 then null
               else round(count(*) filter (where not aa.is_correct)::numeric * 100 / count(*))::int
          end as wrong_rate
        from public.attempt_answers aa
        where aa.question_id = q.id
      ) stat on true
      where q.content_set_id = p_content_set_id
    ), '[]'::jsonb)
  );
end;
$$;

/**
 * 반별 제출 현황.
 *
 * 정답률은 **문항 수 가중**이다 — 25문항 세트와 10문항 세트를 같은 무게로 평균하면 작은 세트가
 * 결과를 뒤집는다(D-052). `미제출`은 **사람 수**다(배정×학생 행 수가 아니다).
 *
 * 권한: 내가 볼 수 있는 반만. 넘긴 id 중 범위 밖은 조용히 빠진다 — 목록을 좁혀 주는 것이
 * 화면의 일이고, 거부로 화면 전체를 세우지 않는다.
 */
create or replace function public.rpc_class_stats(p_class_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(row_to_json(s)::jsonb), '[]'::jsonb)
  from (
    select
      c.id as class_id,
      c.name,
      c.grade,
      count(distinct a.id)::int as assignment_count,
      count(distinct r.student_id)::int as student_count,
      count(distinct t.student_id) filter (where t.attempt_id is not null)::int as submitted_students,
      count(distinct t.student_id) filter (where t.attempt_id is null)::int as pending_students,
      case
        when coalesce(sum(att.total_count), 0) = 0 then null
        else round(sum(att.correct_count)::numeric * 100 / sum(att.total_count))::int
      end as avg_accuracy
    from public.classes c
    left join public.assignments a on a.class_id = c.id
    left join public.assignment_targets t on t.assignment_id = a.id
    left join public.attempts att on att.id = t.attempt_id
    left join public.v_class_roster r on r.class_id = c.id
    where c.id = any (p_class_ids)
      and c.id in (select public.my_class_ids())
    group by c.id, c.name, c.grade
    order by c.name
  ) s;
$$;

/**
 * 운영자 개요.
 *
 * **원천이 없는 지표는 null로 준다.** 프로토타입은 합성 활동 위에서 26주 추이·코호트·리텐션을
 * 계산했는데 그 데이터를 버렸으므로, 실제 기록이 쌓이기 전에는 계산할 수 없다. 0으로 주면
 * 화면이 "활동이 없다"고 말하고, 그건 "아직 모른다"와 다르다.
 *
 * `mau`의 창은 28일 rolling이다(캘린더 월이 아니다). 창을 밝히지 않으면 뜻이 없다.
 */
create or replace function public.rpc_admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := public.today_kst();
  v_first date;
begin
  if not public.is_admin() then
    raise exception '총괄관리자만 볼 수 있어요.';
  end if;

  select min(occurred_on) into v_first from public.learning_events;

  return jsonb_build_object(
    'as_of', v_today,
    -- 활동 기록이 시작된 날. 화면이 "언제부터의 값인지"를 밝히는 데 쓴다.
    'events_since', v_first,
    'accounts', (select count(*) from public.profiles),
    'students', (select count(*) from public.user_roles where role = 'student'),
    'parents', (select count(*) from public.user_roles where role = 'parent'),
    'academy_staff', (select count(*) from public.user_roles where role = 'academy'),
    'academies', (select count(*) from public.academies where status = 'active'),
    'academies_churned', (select count(*) from public.academies where status = 'churned'),
    'classes', (select count(*) from public.classes where archived_at is null),
    'content_sets', (select count(*) from public.content_sets),
    'content_published', (select count(*) from public.content_sets where publish_to_students),
    'personal_active', (
      select count(*) from public.entitlements
      where kind = 'personal' and canceled_at is null
    ),
    'personal_canceled', (
      select count(*) from public.entitlements
      where kind = 'personal' and canceled_at is not null
    ),
    'attempts_total', (select count(*) from public.attempts),
    -- 28일 rolling MAU. 기록이 아직 없으면 null이다(0이 아니다).
    'mau', case when v_first is null then null else (
      select count(distinct student_id) from public.learning_events
      where kind = 'answer_saved' and occurred_on > v_today - 28
    ) end,
    'wal', case when v_first is null then null else (
      select count(distinct student_id) from public.learning_events
      where kind = 'answer_saved' and occurred_on > v_today - 7
    ) end,
    'completed_28d', case when v_first is null then null else (
      select count(distinct student_id) from public.learning_events
      where kind = 'attempt_submitted' and occurred_on > v_today - 28
    ) end
  );
end;
$$;

/**
 * 매출 추정.
 *
 * 여기 있는 값은 전부 **추정**이다. 실제 결제·정산 기록이 아니다(마스터 플랜 5절).
 * 화면에서는 `추정` 출처와 함께 보여 준다.
 *
 * **이탈한 학원의 좌석은 기본적으로 세지 않는다.** 프로토타입은 세고 있었고 그것이 A-049로
 * 열려 있었다 — 이탈 학원 1곳의 좌석이 MRR에 들어가 있었다. 옛 동작을 확인할 필요가 있으면
 * `p_include_churned`를 참으로 준다.
 */
create or replace function public.rpc_revenue_estimate(p_include_churned boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_p public.pricing_policies;
  v_personal numeric := 0;
  v_personal_count int := 0;
  v_academy numeric := 0;
  v_seats int := 0;
  v_people int := 0;
begin
  if not public.is_admin() then
    raise exception '총괄관리자만 볼 수 있어요.';
  end if;
  v_p := public.current_pricing();
  if v_p.id is null then
    raise exception '요금 정책이 없어요.';
  end if;

  /*
    개인 이용권 월 환산. 연 결제 비율만큼 할인을 반영한다(`personalMonthly`와 같은 식).
    **해지한 구독에는 청구하지 않는다** — 프로토타입은 해지를 세면서 매출은 전원에게 청구해
    같은 화면이 GRR 80%와 해지율 0%를 함께 말했다.
  */
  select
    coalesce(sum(
      case when e.payer = 'parent' then v_p.parent_paid else v_p.student_paid end
      * (1 - v_p.annual_share_pct / 100.0)
      + case when e.payer = 'parent' then v_p.parent_paid else v_p.student_paid end
        * (1 - v_p.annual_discount_pct / 100.0) * (v_p.annual_share_pct / 100.0)
    ), 0),
    count(*)::int
  into v_personal, v_personal_count
  from public.entitlements e
  where e.kind = 'personal' and e.canceled_at is null;

  -- 학원 좌석 = 살아 있는 반에 속한 학생을 중복 없이 센 값.
  with seats as (
    select ac.id, count(distinct r.student_id)::int as seats
    from public.academies ac
    left join public.classes c on c.academy_id = ac.id and c.archived_at is null
    left join public.v_class_roster r on r.class_id = c.id
    where p_include_churned or ac.status = 'active'
    group by ac.id
  )
  select
    coalesce(sum(
      case when s.seats >= v_p.seat_discount_from
        then round(s.seats * v_p.academy_seat * (1 - v_p.seat_discount_pct / 100.0))
        else s.seats * v_p.academy_seat
      end
    ), 0),
    coalesce(sum(s.seats), 0)
  into v_academy, v_seats
  from seats s;

  /*
    돈이 오는 **사람** 수(중복 제거). 프로토타입은 `개인 이용권 건수 + 학원 좌석 수`를 더해
    ARPU의 분모로 썼다 — 건과 명을 더한 값이라 둘을 함께 가진 학생이 두 번 세어졌다.
  */
  select count(*)::int into v_people
  from (
    select e.user_id from public.entitlements e
    where e.kind = 'personal' and e.canceled_at is null
    union
    select r.student_id
    from public.v_class_roster r
    join public.classes c on c.id = r.class_id and c.archived_at is null
    join public.academies ac on ac.id = c.academy_id
    where p_include_churned or ac.status = 'active'
  ) payers;

  return jsonb_build_object(
    'personal', v_personal,
    'academy', v_academy,
    'mrr', v_personal + v_academy,
    'arr', (v_personal + v_academy) * 12,
    'personal_count', v_personal_count,
    'academy_seat_count', v_seats,
    'paying_people', v_people,
    'arppu', case when v_people = 0 then 0 else (v_personal + v_academy) / v_people end,
    'includes_churned', p_include_churned
  );
end;
$$;
