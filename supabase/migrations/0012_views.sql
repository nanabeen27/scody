-- 뷰: 화면이 쓰던 형태를 그대로 주고, 공개 범위를 DB에서 좁힌다.
--
-- ## 두 종류의 뷰
--
-- 1. `security_invoker = on` — 밑 테이블의 RLS를 **부르는 사람 기준**으로 적용한다.
--    권한 규칙이 이미 그 테이블 정책에 있을 때 쓴다.
-- 2. 기본(뷰 소유자 권한) — 밑 테이블의 RLS를 우회하고 **뷰가 직접 조건을 건다.**
--    학원용 투영처럼 "그 테이블의 정책과 다른 규칙"이 필요할 때만 쓰고, 조건을 빠뜨리면
--    그대로 유출이라 아래 각 뷰에 근거를 적어 둔다.

/**
 * 학생×학습 대상별 **최신 회차** 풀이.
 *
 * 화면은 늘 최신 결과를 본다. 이전 회차는 `attempts`에 남아 있어 재풀이 전후를 비교할 수 있다
 * (A-036). 밑 테이블 정책을 그대로 쓴다.
 */
create view public.v_latest_attempts with (security_invoker = on) as
select a.*
from public.attempts a
where a.attempt_no = (
  select max(x.attempt_no)
  from public.attempts x
  where x.student_id = a.student_id
    and x.source = a.source
    and coalesce(x.assignment_id, x.content_set_id) = coalesce(a.assignment_id, a.content_set_id)
);

/**
 * 배정 제출 현황 — 화면이 쓰던 `Submission` 형태.
 *
 * `submitted`는 컬럼이 아니라 `attempt_id is not null`이고, 틀린 문항은 `attempt_answers`에서
 * 모은다. 두 값이 어긋날 자리가 없다.
 *
 * **뷰가 직접 조건을 건다**(뷰 소유자 권한): 이 행은 학생 본인·연결된 학부모·그 배정을 담당한
 * 학원 교직원·운영자가 본다. `attempts` 테이블 정책만으로는 학원이 볼 수 없는데(개인 학습
 * 오답을 막기 위해 학생·학부모로 좁혀 뒀다) 학원은 **자기 배정의 제출 결과**는 봐야 한다.
 */
create view public.v_assignment_submissions as
select
  t.assignment_id,
  t.student_id,
  (t.attempt_id is not null) as submitted,
  t.attempt_id,
  att.accuracy,
  att.time_sec,
  att.submitted_on,
  att.correct_count,
  att.total_count,
  coalesce(wrong.question_ids, '{}'::uuid[]) as wrong_question_ids
from public.assignment_targets t
left join public.attempts att on att.id = t.attempt_id
left join lateral (
  select array_agg(aa.question_id order by q.position) as question_ids
  from public.attempt_answers aa
  join public.questions q on q.id = aa.question_id
  where aa.attempt_id = t.attempt_id and not aa.is_correct
) wrong on true
where public.can_read_student(t.student_id)
   or public.can_see_assignment(t.assignment_id)
   or public.is_admin();

/**
 * 학원이 볼 수 있는 오답노트.
 *
 * **뺀 컬럼과 근거**(확정 정책 2절 · D-054):
 * - `starred`(별표) · `mastered`(이해 완료) — 열지 않기로 정했다.
 * - `picked_index`(고른 답) — 어떤 오답지를 골랐는지는 학생의 풀이 과정이다.
 *
 * 프로토타입은 `toAcademyNote()`가 필드를 하나씩 골라 투영했다. 그 경계는 다음 사람이
 * 스프레드로 바꾸는 순간 사라진다. **여기서는 컬럼이 애초에 없다** — 뷰가 응답 스키마다.
 *
 * 조건 세 가지를 모두 요구한다: ①학원 배정에서 나온 오답만 ②그 배정이 내가 담당하는 반의
 * 것 ③그 학생이 내 범위. 프로토타입이 학원 이름 하나로 좁혔을 때 담당 아닌 반의 오답과
 * 학생이 학원을 옮긴 뒤 이전 학원 배정의 오답이 새어 나갔다.
 */
create view public.v_academy_visible_notes as
select
  n.id,
  n.student_id,
  n.question_id,
  n.content_set_id,
  n.source,
  n.assignment_id,
  n.dig,
  n.created_at
from public.wrong_notes n
where n.source = 'academy'
  and n.assignment_id is not null
  and public.can_see_assignment(n.assignment_id)
  and public.can_see_student(n.student_id);

/** 살아 있는 반 학생. 제외된 학생(`removed_at`)은 빠진다. */
create view public.v_class_roster with (security_invoker = on) as
select
  cs.class_id,
  cs.student_id,
  cs.added_at,
  p.name,
  p.scody_id,
  p.grade,
  p.support_code
from public.class_students cs
join public.profiles p on p.id = cs.student_id
where cs.removed_at is null;

/**
 * 일별 활동. 운영자 지표(MAU·Activation·리텐션)의 원천이다.
 *
 * **`활성`은 그 날 답을 저장한 학생 수**(D-1). 학습을 완료한 학생은 그중 일부이고 따로 센다.
 * 운영자만 읽는다 — `is_admin()`을 조건에 두어 다른 역할에는 0행이 나간다.
 */
create view public.v_daily_activity as
select
  e.occurred_on,
  count(distinct e.student_id) filter (where e.kind = 'answer_saved') as active_students,
  count(distinct e.student_id) filter (where e.kind = 'attempt_submitted') as completed_students,
  count(*) filter (where e.kind = 'note_added') as notes_added,
  count(*) filter (where e.kind = 'review_done') as reviews_done
from public.learning_events e
where public.is_admin()
group by e.occurred_on;

grant select on public.v_latest_attempts to authenticated;
grant select on public.v_assignment_submissions to authenticated;
grant select on public.v_academy_visible_notes to authenticated;
grant select on public.v_class_roster to authenticated;
grant select on public.v_daily_activity to authenticated;
