-- 소속이 끝난 학생을 반 로스터에서 뺀다(M-DB-14 · D-134).
--
-- ## 무엇이 어긋났나
--
-- `removeMember`는 `academy_members.left_at`만 채우고 `class_students`는 그대로 둔다
-- (0024가 의도한 대로다 — 그 학생이 그 반에서 낸 제출 기록의 근거가 필요하다).
-- 그런데 `v_class_roster`는 `class_students.removed_at is null`만 보고 `left_at`을 보지
-- 않았다(0012:105). 그래서 같은 학생에 대해 세 가지가 서로 다른 답을 냈다:
--
-- | 무엇 | 소속이 끝난 학생을 | 고치기 전 실측 |
-- |---|---|---|
-- | `can_see_student` (0003) | 활성 소속을 요구한다 | `false` — 선생님이 못 본다 |
-- | `rpc_add_assignment` (0029) | `v_class_roster`로 대상을 만든다 | 새 배정 9명에 **포함** |
-- | `rpc_class_stats`·`rpc_revenue_estimate` (0014) | `v_class_roster`로 센다 | 좌석 14석에 **포함** |
--
-- 청구는 하는데 가르칠 수는 없는 상태였다. 실측(2026-08-14, `begin … rollback` 안에서
-- 정예린의 `left_at`을 세움): 로스터 2행 유지 · 좌석 14 유지 · 결제자 16 유지 ·
-- `rpc_add_assignment`가 그 학생을 대상에 넣음 · `can_see_student`는 선생님·원장 모두 거짓.
--
-- ## 고치는 자리는 뷰 하나다
--
-- 셋 다 `v_class_roster`를 원천으로 쓰므로 **함수 본문은 하나도 건드리지 않는다.** 뷰에
-- 활성 소속 조건을 더하면 셋이 함께 맞는다.
--
-- ## 무엇이 바뀌지 않는가 — 경계
--
-- - **이미 만들어진 `assignment_targets`·`attempts`는 그대로 둔다.** 확정 정책이 "학원 연결이
--   끝나도 계정과 과거 기록은 유지한다"고 정한다. 바뀌는 것은 **앞으로의** 배정과 **현재**
--   좌석 수다. 로스터에서 빼는 것과 기록을 지우는 것을 섞지 않는다.
-- - **월 중 이탈 안분(proration)은 이 마이그레이션의 범위가 아니다.** 그것은 A-049가 들고 있는
--   별 질문이다("이탈 시점 이후 구간만 제외할지"). 여기서 답하는 질문은 "떠난 사람을 셀지
--   말지"이고, 답은 세지 않는 것이다. 좌석 수는 여전히 **지금 시점의 스냅샷**이다.
--
-- ## 왜 행이 늘거나 줄지 않는가
--
-- `academy_members`의 기본키가 `(academy_id, user_id)`이고 `classes`는 `id`로 조인하므로
-- 두 조인 모두 최대 1행을 붙인다 — 활성 학생의 로스터 행 수는 그대로다(실측: 15행 → 15행).
--
-- `security_invoker = on`을 유지한다. 더한 두 테이블도 호출자 권한으로 읽히는데, 지금
-- `class_students` 행을 읽을 수 있는 모든 호출자가 그 두 행도 읽을 수 있다:
-- 학생 본인(`academy_members.user_id = auth.uid()`) · 학부모(`is_my_child(user_id)`) ·
-- 교직원(`academy_id = my_academy_id()`) · 운영자(`is_admin()`). `classes`도 같다
-- (`classes_select`: 우리 학원 · `in_class(id)` · 운영자).

create or replace view public.v_class_roster with (security_invoker = on) as
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
-- ↓↓↓ 0033이 더한 줄뿐이다 ↓↓↓
-- 반이 속한 학원을 알아야 소속을 볼 수 있다. `class_academy_id()`(security definer)를 쓰지
-- 않는 이유: 그 함수는 `auth.uid()`가 없으면 NULL을 준다(0032). 그러면 JWT 없이 도는
-- security definer 함수 안에서 로스터가 통째로 비어 버린다.
join public.classes c on c.id = cs.class_id
-- **소속이 끝난 학생은 로스터에서 빠진다**(M-DB-14 · D-134).
-- `academy_members`의 기본키가 `(academy_id, user_id)`라 이 조인은 행을 늘리지 않는다.
join public.academy_members m
  on m.academy_id = c.academy_id
 and m.user_id = cs.student_id
 and m.left_at is null
-- ↑↑↑ 여기까지가 추가분 ↑↑↑
where cs.removed_at is null;


comment on view public.v_class_roster is
  '살아 있는 반 학생. 반에서 제외된 학생(class_students.removed_at)과 학원 소속이 끝난 학생'
  '(academy_members.left_at)이 함께 빠진다(M-DB-14 · D-134). 배정 대상 생성·반 통계·매출 추정이 '
  '모두 이 뷰를 원천으로 쓰므로, 여기서 빠지면 새 배정을 받지 않고 청구 좌석에도 세어지지 않는다. '
  '과거 기록(assignment_targets·attempts)은 지우지 않는다. 월 중 이탈 안분은 A-049의 별 질문이다.';
