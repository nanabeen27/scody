import type {
  AcademyClass,
  Account,
  Assignment,
  ContentSet,
  Entitlement,
  Grade,
  Invite,
  KoreanArea,
  Question,
  Role,
  Submission,
} from '@/data/types';

/**
 * DB 행 → 화면이 쓰는 도메인 타입.
 *
 * ## 왜 매핑 계층을 두는가
 *
 * DB는 정규화돼 있고(`academy_id` FK, `(source, assignment_id, content_set_id)` 조합), 화면 57개는
 * 프로토타입의 도메인 타입(`src/data/types.ts`)에 맞춰 쓰여 있다. 두 형태를 여기서 한 번만
 * 이어 주면 화면을 건드리지 않는다.
 *
 * **특히 두 가지를 그대로 유지한다:**
 *
 * 1. `academyName` — 화면과 집계 모듈(`report.ts`·`academyStats.ts`)이 학원을 이름으로 비교한다.
 *    DB는 `academy_id`로 잇고, 여기서 이름을 채워 준다.
 * 2. `itemId` — 개인 학습은 `li_${contentId}`, 학원 학습은 배정 id다. DB의 식별은
 *    `(source, assignment_id, content_set_id)` 조합이지만, 이 문자열이 오답노트·리포트·복습에
 *    두루 박혀 있어 매핑에서 되만들어 준다(`itemIdOf`).
 */

/** 학습 대상의 화면용 식별자. DB의 조합 키를 프로토타입이 쓰던 한 문자열로 되만든다. */
export function itemIdOf(source: 'personal' | 'academy', assignmentId: string | null, contentSetId: string): string {
  return source === 'academy' && assignmentId ? assignmentId : `li_${contentSetId}`;
}

/** 프로필 + 역할 + 소속 + 이용권을 하나의 `Account`로 합친다. */
export function toAccount(input: {
  id: string;
  name: string;
  scody_id: string;
  phone: string | null;
  grade: number | null;
  kakao_linked: boolean;
  created_at: string;
  support_code?: string;
  roles: readonly string[];
  academyName?: string;
  academyRole?: 'director' | 'teacher' | null;
  entitlements: readonly {
    kind: string;
    payer: string;
    label: string;
    started_on: string;
    canceled_at: string | null;
  }[];
}): Account {
  return {
    userId: input.id,
    name: input.name,
    scodyId: input.scody_id,
    phone: input.phone ?? undefined,
    grade: (input.grade ?? undefined) as Grade | undefined,
    kakaoLinked: input.kakao_linked,
    supportCode: input.support_code,
    // 가입일은 날짜만 쓴다. 화면은 `YYYY-MM-DD`로 비교한다.
    createdAt: input.created_at.slice(0, 10),
    roles: input.roles as Role[],
    academyName: input.academyName,
    academyRole: input.academyRole ?? undefined,
    entitlements: input.entitlements.map(toEntitlement),
  };
}

export function toEntitlement(row: {
  kind: string;
  payer: string;
  label: string;
  started_on: string;
  canceled_at: string | null;
}): Entitlement {
  return {
    kind: row.kind as Entitlement['kind'],
    payer: row.payer as Entitlement['payer'],
    label: row.label,
    startedAt: row.started_on,
    canceledAt: row.canceled_at?.slice(0, 10),
    status: row.canceled_at ? 'canceled' : 'active',
  };
}

export function toClass(
  row: {
    id: string;
    name: string;
    grade: number | null;
    teacher_id: string | null;
    academy_id: string;
  },
  academyName: string,
  studentIds: readonly string[],
): AcademyClass {
  return {
    id: row.id,
    academyName,
    name: row.name,
    // 담당 미배정은 빈 문자열이다 — 프로토타입의 `setClassTeacher('')`과 같은 뜻이다.
    teacherId: row.teacher_id ?? '',
    grade: (row.grade ?? undefined) as Grade | undefined,
    studentIds: [...studentIds],
  };
}

export function toQuestion(row: {
  id: string;
  prompt: string;
  choices: string[];
  answer_index: number;
  explanation: string | null;
}): Question {
  return {
    id: row.id,
    prompt: row.prompt,
    choices: row.choices,
    answerIndex: row.answer_index,
    explanation: row.explanation ?? undefined,
  };
}

export function toContentSet(
  row: {
    id: string;
    subject: string;
    area: string;
    title: string;
    kind: string;
    grade: number | null;
    topic: string | null;
    publish_to_students: boolean;
    passage_title: string | null;
    passage_body: string | null;
  },
  questions: readonly Question[],
  ownerAcademyName?: string,
): ContentSet {
  return {
    id: row.id,
    subject: row.subject as ContentSet['subject'],
    area: row.area as KoreanArea,
    title: row.title,
    kind: row.kind as ContentSet['kind'],
    grade: (row.grade ?? undefined) as Grade | undefined,
    topic: row.topic ?? undefined,
    publishToStudents: row.publish_to_students,
    passage:
      row.passage_body != null
        ? { title: row.passage_title ?? row.title, body: row.passage_body }
        : undefined,
    questions: [...questions],
    ownerAcademyName,
  };
}

/**
 * 배정 제출 한 줄.
 *
 * `submitted`는 DB에 컬럼이 없다 — `attempt_id`가 있으면 낸 것이다(`v_assignment_submissions`).
 * 틀린 문항은 뷰가 `attempt_answers`에서 모아 준다.
 */
export function toSubmission(row: {
  student_id: string;
  submitted: boolean;
  accuracy: number | null;
  time_sec: number | null;
  submitted_on: string | null;
  wrong_question_ids: string[] | null;
}): Submission {
  return {
    studentId: row.student_id,
    submitted: row.submitted,
    accuracy: row.accuracy ?? undefined,
    timeSec: row.time_sec ?? undefined,
    submittedAt: row.submitted_on ?? undefined,
    wrongQIds: row.wrong_question_ids ?? undefined,
  };
}

export function toAssignment(
  row: {
    id: string;
    class_id: string;
    content_set_id: string;
    title: string;
    due_date: string | null;
    original_due_date: string | null;
  },
  questionCount: number,
  submissions: readonly Submission[],
): Assignment {
  return {
    id: row.id,
    classId: row.class_id,
    // 지금은 국어만 지원한다. 콘텐츠에서 읽어 오지 않고 고정한다(`content_sets.subject`와 같은 값).
    subject: '국어',
    title: row.title,
    questionCount,
    contentId: row.content_set_id,
    dueDate: row.due_date ?? undefined,
    originalDueDate: row.original_due_date ?? undefined,
    submissions: [...submissions],
  };
}

export function toInvite(row: {
  token: string;
  academy_name: string;
  invitee_role: string;
  inviter_label?: string;
}): Invite {
  return {
    token: row.token,
    academyName: row.academy_name,
    invitee: row.invitee_role as Invite['invitee'],
    inviterLabel: row.inviter_label ?? row.academy_name,
  };
}
