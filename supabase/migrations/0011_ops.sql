-- 운영 기록: 감사 로그 · 대리 보기 · 학습 활동 이벤트.

/*
  감사 로그. **append-only다** — 넣을 수만 있고 고치거나 지울 수 없다(RLS에 update/delete
  정책을 두지 않는다).

  요금 정책 변경·문제 등록·대리 보기처럼 서비스 전체에 영향을 주는 조작은 누가 언제 무엇을
  바꿨는지 남긴다. 개인정보 안전성 확보조치 기준 제8조(접속기록)의 근거가 되는 표다.
*/
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  -- 행동한 사람. 계정이 지워져도 기록은 남아야 하므로 이름을 함께 박아 둔다.
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name text not null,
  action audit_action not null,
  -- 사람이 읽는 한 줄 설명.
  detail text not null check (length(btrim(detail)) > 0),
  /*
    이 기록이 다룬 사용자.

    **설명 문자열을 파싱해 좁히지 않는다** — 프로토타입은 `detail.includes(userId)`로 좁혔다가
    id가 접두 관계인 계정들의 열람 기록이 섞여 보였다.
  */
  subject_id uuid references public.profiles (id) on delete set null
);

create index audit_logs_at_idx on public.audit_logs (at desc);
create index audit_logs_subject_idx on public.audit_logs (subject_id, at desc);

/*
  대리 보기 한 건.

  프로토타입은 진행 상태를 클라이언트 메모리에, 시작·종료 기록을 메모리 감사 로그에 나눠
  두었다. 서버에 모아 두면 새로고침해도 진행 중인 대리가 살아 있고, 종료 기록이 지워지지 않는다.

  **운영 전 필수 장치가 아직 없다**(A-048): MFA 재인증 · 대상 사용자 통지 ·
  `impersonated_by`를 담은 서버 토큰 분리 · 보관 기간 정책. 이 표는 그중 "서버에 남긴다"만
  채운다. 나머지는 여전히 미구현이고 화면이 그 사실을 밝힌다.
*/
create table public.impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  -- 사유. 없으면 시작할 수 없다 — 감사 로그의 핵심 항목이다.
  reason text not null check (length(btrim(reason)) > 0),
  ticket text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason impersonation_end_reason,
  -- 이 세션에서 열어 본 화면 경로. 개인정보 접속기록의 '수행업무'에 해당한다.
  visited text[] not null default '{}',
  constraint impersonation_not_self check (operator_id <> target_id),
  constraint impersonation_end_together
    check ((ended_at is null) = (end_reason is null))
);

-- 한 운영자가 동시에 두 건을 시작하지 못하게 한다.
create unique index impersonation_open_key on public.impersonation_sessions (operator_id)
  where ended_at is null;
create index impersonation_target_idx on public.impersonation_sessions (target_id, started_at desc);

/*
  학습 활동 이벤트. **append-only다.**

  `src/data/activity.ts`가 해시로 26주치를 합성하던 자리다. 이제는 실제 행동이 일어날 때마다
  한 줄이 쌓이고, MAU·Activation·리텐션은 이 표 위에서 계산된다.

  **활성의 정의**(D-1): 그 날 문항 1개 이상 답을 저장한 학생 = `answer_saved`.
  로그인은 활성이 아니라서 이벤트로 남기지 않는다. 학습을 완료한 날(`attempt_submitted`)은
  그중 일부이고 따로 센다(북극성 지표).

  `occurred_on`을 따로 두는 이유: 지표는 **날짜 단위**로 세고, 그 판정은 사용자의 로컬
  자정 기준이어야 한다(`todayISO()`와 같은 규칙). timestamptz에서 매번 캐스팅하면 서버
  시간대에 따라 하루가 밀린다.
*/
create table public.learning_events (
  id bigserial primary key,
  student_id uuid not null references public.profiles (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  occurred_on date not null,
  kind learning_event_kind not null,
  -- 이 이벤트가 가리키는 대상(풀이 id·노트 id 등). 되짚기 위한 값이고 FK는 두지 않는다.
  ref_id uuid
);

create index learning_events_day_idx on public.learning_events (occurred_on, kind);
create index learning_events_student_idx on public.learning_events (student_id, occurred_on);
