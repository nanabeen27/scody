-- 학습 시간 조각을 오래된 날부터 하루 한 행으로 접는다(A-150).
--
-- ## 왜 필요한가
--
-- `study_activity`는 append-only이고 클라이언트가 **60초마다** 조각을 보낸다
-- (`src/features/activeTime.ts`의 `FLUSH_SEC`). 학생 한 명이 하루에 두 시간을 공부하면 약 120행이고
-- 하루 상한(8시간)까지 쓰면 480행이다. 그런데 이 표를 읽는 것은 **일별 합** 하나뿐이다
-- (`v_daily_learning_stats`의 `time_day` 갈래가 `occurred_on`으로 묶어 더한다). 지표가 보는 창은
-- 최근 28일과 8주인데 표는 무한히 자란다.
--
-- ## 무엇을 잃는가
--
-- 접으면 **`ref_id`와 조각의 시각(`occurred_at`)이 사라진다.** 그 둘은 되짚기용이고 어떤 화면도
-- 읽지 않는다 — 잃어도 되는 값이라고 판단한 근거를 여기 적어 둔다. **하루의 합은 바뀌지 않는다**:
-- 그래서 접기 전후로 `v_daily_learning_stats`가 같은 값을 낸다(`scripts/verify-records.ts`가
-- 그것을 단정한다).
--
-- ## 한 행의 상한을 하루 상한으로 올린다
--
-- 지금 제약은 `active_sec <= 900`(한 번에 보내는 최대)이라 접은 행이 그 제약에 걸린다 — 하루를
-- 한 행으로 만들면 최대 8시간이다. **한 번에 받는 양의 제한은 제약이 아니라 함수가 한다**
-- (`rpc_log_study_time`의 `c_flush_cap` — 직접 쓰기는 회수돼 있어 그 함수가 유일한 문이다).
-- 제약의 일은 `말이 안 되는 값을 막는 것`이고, 그 경계는 하루 상한이다.
--
-- ## 언제 도는가
--
-- **아직 자동으로 돌지 않는다.** 이 레포에는 스케줄러가 없다(`pg_cron`도 켜지지 않았고 알림
-- 채널도 없다 — M-DEC-6). 지금은 `npm run db:compact`가 손으로 부르고, 그 사실을 마스터 플랜
-- 남은 작업에 남긴다. 함수가 먼저 있어야 스케줄을 붙일 자리가 생긴다.

alter table public.study_activity drop constraint study_activity_active_sec_check;

/*
  하루 상한(8시간)이 한 행의 상한이다. `rpc_log_study_time`의 `c_day_cap`과 같은 값이어야 한다 —
  접은 행이 하루 전체를 담을 수 있어야 하고, 그보다 큰 값은 어떤 경로로도 사실이 아니다.
*/
alter table public.study_activity
  add constraint study_activity_active_sec_check
  check (active_sec > 0 and active_sec <= 8 * 3600);

/**
 * 오래된 학습 시간 조각을 `(학생, 날, 종류)`마다 한 행으로 접는다.
 *
 * @param p_keep_days 이 일수 안의 날은 접지 않는다. **최소 28일**로 바닥을 둔다 — 잔디가 보는
 *   창이고, 그 안의 조각은 무엇이 언제 쌓였는지 되짚을 수 있어야 한다.
 * @returns 줄어든 행 수(접기 전 − 접은 뒤). 0이면 접을 것이 없었다.
 *
 * **합을 바꾸지 않는다.** 마지막에 접은 구간의 총합을 다시 세어 같지 않으면 예외로 되돌린다 —
 * 이 함수의 유일한 위험이 그것이고, 트랜잭션 안이라 실패하면 아무것도 바뀌지 않는다.
 */
create or replace function public.compact_study_activity(p_keep_days int default 60)
returns int
language plpgsql
set search_path = public, pg_temp
as $$
declare
  -- 잔디가 보는 창. 이보다 짧게 접지 않는다.
  c_floor_days constant int := 28;
  v_cut date := public.today_kst() - greatest(coalesce(p_keep_days, 60), c_floor_days);
  v_sum_before bigint;
  v_sum_after bigint;
  v_rows_before bigint;
  v_rows_after bigint;
begin
  select coalesce(sum(active_sec), 0), count(*)
  into v_sum_before, v_rows_before
  from public.study_activity
  where occurred_on < v_cut;

  if v_rows_before = 0 then
    return 0;
  end if;

  create temp table _compacted on commit drop as
  select
    student_id,
    occurred_on,
    kind,
    sum(active_sec)::int as active_sec,
    min(occurred_at) as occurred_at
  from public.study_activity
  where occurred_on < v_cut
  group by student_id, occurred_on, kind;

  delete from public.study_activity where occurred_on < v_cut;

  /*
    `ref_id`를 넣지 않는다 — 여러 조각을 접었으므로 가리킬 대상이 하나가 아니다.
    `occurred_at`은 그 날 첫 조각의 시각이다(가장 이른 것이 그 날의 시작이다).
  */
  insert into public.study_activity (student_id, occurred_at, occurred_on, kind, active_sec)
  select student_id, occurred_at, occurred_on, kind, active_sec from _compacted;

  select coalesce(sum(active_sec), 0), count(*)
  into v_sum_after, v_rows_after
  from public.study_activity
  where occurred_on < v_cut;

  if v_sum_after <> v_sum_before then
    raise exception '접기 전후의 학습 시간 합이 다릅니다(전 %초 · 후 %초). 되돌립니다.',
      v_sum_before, v_sum_after;
  end if;

  return (v_rows_before - v_rows_after)::int;
end;
$$;

/*
  **앱 역할은 부를 수 없다.** 유지보수용이고, 지우는 함수라 클라이언트에 열 이유가 없다.
  Postgres가 함수에 PUBLIC 실행 권한을 기본으로 주므로 회수해야 한다(0030이 같은 이유로
  같은 일을 했다). 소유자 접속(`scripts/compact-study-time.ts`)만이 문이다.
*/
revoke all on function public.compact_study_activity(int) from public, anon, authenticated;

comment on function public.compact_study_activity(int) is
  '오래된 학습 시간 조각을 (학생, 날, 종류)마다 한 행으로 접는다. 하루의 합은 바뀌지 않고 '
  'ref_id와 조각 시각을 잃는다. 앱 역할은 부를 수 없다 — 소유자 접속만.';
