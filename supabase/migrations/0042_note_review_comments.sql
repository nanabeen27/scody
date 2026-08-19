-- 복습 스케줄 객체의 계약을 DB 자체에 적는다.

/*
  0037~0040은 이유를 마이그레이션 파일 안에만 적었다. 그런데 이 스키마를 읽는 사람은 대개
  `psql`에서 `\df+ rpc_log_note_review`나 `\d+ wrong_notes`를 먼저 본다 — 그 자리에 계약이 없으면
  **"정오를 인자로 받으면 안 된다"는 판단이 보이지 않는다.** 0026·0032·0033·0036이 보안에 민감한
  함수·뷰·컬럼마다 `comment on`을 남긴 이유와 같다.

  0040이 함수 본문을 갈아 끼웠으므로(`drop`·`create or replace`) 주석은 새로 붙여야 한다.
  코드 변경은 없다. 주석만 붙인다.
*/

comment on function public.rpc_add_wrong_note(uuid, uuid, learning_source, uuid, smallint) is
  '오답노트에 담는다. 담기와 되살리기가 한 함수다(dismissed_at을 비운다). security definer라 '
  'RLS를 지나지 않으므로 rpc_submit_attempt와 같은 검사를 직접 한다 — 배정 대상 행, 배정과 '
  '콘텐츠의 일치, 문항이 그 콘텐츠의 것인지, 개인 학습이면 공개 여부. wrong_notes에 직접 '
  'INSERT하는 길은 회수되어 있으므로 담기는 이 함수 하나다.';

comment on function public.rpc_log_note_review(uuid, smallint, public.note_evidence, text) is
  '다시 풀어 본 사실을 남기고 다음 차례를 정한다. 정오는 서버가 questions.answer_index와 '
  '대조한다 — 인자에 is_correct가 없는 것이 이 함수의 존재 이유다(자기 신고를 숙달 판정에서 '
  '걷어낸다). 다음 차례도 클라이언트가 제안하지 않는다(인자에 날짜가 없다). 차례가 아닌 날의 '
  '복습은 기록만 남기고 스케줄을 움직이지 않는다(scheduled=false), stuck 노트는 거부하며, '
  'evidence=unsure로 맞힌 회차는 streak을 올리지 않는다(4지선다 무작위 정답률 25%).';

comment on function public.rpc_defer_note(uuid) is
  '차례가 온 문항을 하루 미룬다. 화면의 건너뛰기가 부른다. 미루지 않으면 due_on이 과거에 남아 '
  '밀린 일수가 늘고 우선순위가 더 앞으로 가서, 모르는 카드를 건너뛴 학생의 덱이 영구히 같은 '
  '다섯 장이 된다. 복습 기록은 남기지 않는다 — 건너뛴 것은 다시 풀어 본 사실이 아니다.';

comment on function public.rpc_requeue_note(uuid) is
  'stuck 노트를 복습 큐로 돌려보낸다(queued · 내일 · miss_streak 0). streak은 그대로 둔다 — '
  '이미 채운 정답 회차를 없던 일로 만들지 않는다. 큐로 돌아오는 '
  '문은 이 함수 하나다 — 다른 상태에서 부를 수 있으면 학생이 자기 일정을 앞당길 수 있다.';

comment on function public.rpc_set_note_review_recap(uuid, text) is
  '오늘 남긴 복습 한 줄(자기설명)을 고친다. 오늘 행만 대상이다 — 지난 회차의 기록은 그때의 '
  '사실이므로 나중에 덮어쓰지 않는다.';

comment on function public.tg_wrong_notes_schedule_guard() is
  '스케줄(state·due_on·streak·miss_streak)과 정체성(student_id·question_id·content_set_id·'
  'source·assignment_id)을 클라이언트가 못 바꾸게 막는다. 바꿀 수 있는 것은 dig·starred·'
  'mastered·picked_index·dismissed_at뿐이다. scody.note_schedule GUC가 on인 연결(RPC와 '
  '소유자 스크립트)에서만 열린다.';

comment on table public.note_reviews is
  '다시 풀어 본 한 회차. (note_id, reviewed_on) 유니크가 "다른 세션"의 정의다 — 같은 날 두 번은 '
  '분산 인출이 아니라 집중 반복이므로 스케줄을 움직이지 않는다. 쓰기 정책이 없다 — RPC만 쓴다. '
  '읽기는 note_reviews_select 하나이고 can_read_student(student_id) or is_admin()이다: 본인, '
  '연결된 학부모, 운영자가 읽는다. 학원 갈래는 없다 — 교직원은 0행이다. recap은 학생이 자기 말로 '
  '쓴 글이라 dig와 달리 학원에 열지 않았다(0037).';

comment on column public.wrong_notes.state is
  'queued=차례를 기다린다, graduated=연속 정답 3회를 채웠다(큐에는 남는다), stuck=연속 오답 '
  '3회로 쉰다. stuck만 due_on이 null이다(CHECK로 묶여 있다).';

comment on column public.wrong_notes.due_on is
  '다음 차례(KST 날짜). 사다리는 1 → 7 → 21 → 30일이다. 담은 날이 아니라 다음 날부터 시작한다 '
  '— 같은 날 다시 푸는 것은 분산이 아니다.';

comment on column public.wrong_notes.miss_streak is
  '연속 오답 횟수. 3이면 state가 stuck이 되고 rpc_requeue_note로만 돌아온다. 정답이면 0으로 '
  '돌아간다.';

comment on column public.wrong_notes.dismissed_at is
  '학생이 목록에서 뺀 시각. 소프트 삭제다 — 행은 남기고 학원 뷰와 복습 덱에서만 빠진다. '
  'wrong_notes의 DELETE 권한은 회수되어 있다.';
