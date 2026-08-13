-- 열거 타입과 확장.
--
-- 한글 라벨을 쓰는 enum(`korean_area`·`audit_action` 등)은 `src/data/types.ts`의 문자열
-- 리터럴과 **같은 값**을 쓴다. 영문 코드로 바꾸면 클라이언트와 DB 사이에 매핑 표가 하나
-- 더 생기고, 그 표는 화면 문구가 바뀔 때마다 갈린다.

create extension if not exists pgcrypto;

-- 계정 역할. 한 계정이 여러 개를 가질 수 있다(확정 정책 2절).
create type app_role as enum ('student', 'parent', 'academy', 'admin');

-- 학원 안에서의 자리. 학생 소속과 교직원 소속을 한 테이블(`academy_members`)로 담기 위해
-- `student`도 여기 둔다.
create type academy_member_role as enum ('director', 'teacher', 'student');

create type academy_status as enum ('active', 'churned');

-- 초대 대상. `academy_member_role`과 다르다 — 학부모는 학원 구성원이 아니라 자녀로 연결된다.
create type invite_role as enum ('student', 'parent', 'teacher');

-- 연결 승인 상태. 학부모–자녀 연결은 확인을 거친다(마스터 플랜 3절).
create type link_status as enum ('pending', 'linked');

create type subject_kind as enum ('국어');

-- 국어 영역. `src/data/taxonomy.ts`의 `AREAS`와 같은 값이다.
create type korean_area as enum ('독서', '문학', '문법', '화법과 작문');

-- 지문형(독서·문학)과 독립 문항형(문법).
create type content_kind as enum ('passage', 'grammar');

-- 학습의 출처. 개인 학습과 학원 학습은 섞이지 않는다(확정 정책 2절).
create type learning_source as enum ('personal', 'academy');

create type entitlement_kind as enum ('personal', 'academy');
create type payer_kind as enum ('student', 'parent', 'academy');
create type entitlement_status as enum ('active', 'canceled');

create type praise_kind as enum ('steady', 'submitted', 'reviewed', 'thanks');

-- 감사 로그 분류. `src/features/audit.tsx`의 `AuditAction`과 같은 값이다.
create type audit_action as enum ('요금 정책', '콘텐츠', '계정', '대리 보기', '기타');

create type impersonation_end_reason as enum ('수동 종료', '시간 만료');

/*
  학습 활동 이벤트.

  **왜 필요한가**: MAU·Activation·리텐션은 "누가 언제 활동했는지"에서 나온다. 프로토타입은
  이 축이 없어서 `src/data/activity.ts`가 해시로 26주치를 합성했다. 이제는 실제 행동이
  일어날 때마다 여기 한 줄이 쌓이고 지표는 그 위에서 계산된다.

  **활성의 정의**(D-1): 그 날 문항 1개 이상 답을 저장한 학생 = `answer_saved`.
  로그인은 활성이 아니라서 이벤트로 남기지 않는다.
*/
create type learning_event_kind as enum (
  'answer_saved',
  'attempt_submitted',
  'note_added',
  'review_done'
);

-- 결제 기록 상태. 실제 PG 연동은 아직 없다(스키마만 둔다).
create type payment_status as enum ('pending', 'paid', 'failed', 'refunded');
