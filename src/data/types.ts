/** 도메인 타입. 실제 백엔드로 교체하기 쉽도록 UI와 데이터 사이 경계를 둔다. */

export type Role = 'student' | 'parent' | 'academy' | 'admin';

/** 학원 내부 세부 역할. academy 역할일 때만 의미가 있다. */
export type AcademyRole = 'director' | 'teacher';

export type EntitlementKind = 'personal' | 'academy';

export interface Entitlement {
  kind: EntitlementKind;
  /** 결제 주체. 개인 이용권과 학원 이용권은 동시에 존재할 수 있다. */
  payer: 'student' | 'parent' | 'academy';
  label: string;
  /**
   * 구독을 시작한 날. 구독자 수 추이와 신규 구독을 세려면 필요하다.
   * 없으면 계정 가입일로 본다(`startedAtOf`).
   */
  startedAt?: string;
  /** 해지한 날. 있으면 `status`는 `canceled`다. */
  canceledAt?: string;
  /**
   * 지금 살아 있는 구독인지. **만료일(`endsAt`)은 두지 않는다** — 결제 주기가 없어
   * 만료를 발명하는 일이 된다(마스터 플랜 5절).
   */
  status?: 'active' | 'canceled';
}

export interface Account {
  /** 스코디 내부 영구 식별자. 휴대폰 번호가 아니다. */
  userId: string;
  name: string;
  /** 스코디 아이디. 가입 시 정하고, 프로토타입 테스트 계정 로그인에 쓴다. */
  scodyId: string;
  roles: Role[];
  academyRole?: AcademyRole;
  entitlements: Entitlement[];
  academyName?: string;
  /** 프로토타입 전용 비밀번호. 실제로는 서버가 검증한다. */
  password?: string;
  /** 카카오 계정과 연결되어 '카카오로 계속하기'로 로그인 가능한지. */
  kakaoLinked?: boolean;
  /**
   * 계정을 만든 날(YYYY-MM-DD).
   *
   * 코호트 Day 0 · 신규 유입 · Activation 분모 · 계정 수 추이가 전부 여기서 나온다.
   * **로스터 계정에는 넣지 않는다** — 3천 개에 날짜를 박는 대신 활동 데이터와 **같은 해시**에서
   * 파생한다(`joinDateOf`). 따로 만들면 "가입 전에 활동한 학생"이 생겨 코호트가 깨진다.
   */
  createdAt?: string;
  /** 학년. 검색 결과에서 동명이인을 가르는 근거 중 하나다(A-023이 요청한 값). */
  grade?: Grade;
  /**
   * 인증·복구·알림용 휴대폰 번호. 식별자가 아니다(기록은 `userId`에 붙는다).
   * 프로토타입에서는 '휴대폰 번호로 로그인'의 조회 키로만 쓴다. 번호가 없는 계정은 번호로 로그인할 수 없다.
   */
  phone?: string;
  /**
   * 고객지원 코드(`XXX-XXX`). 사용자가 문의에서 말할 수 있는 짧은 값이다.
   * **이 코드로는 로그인할 수 없다** — 화면에서 그 사실을 밝힌다.
   * 프로토타입은 `userId` 해시로 파생했지만 지금은 계정을 만들 때 정해 저장한 값이다.
   */
  supportCode?: string;
}

/** 초대 링크가 가리키는 대상. 휴대폰이 아니라 토큰으로 확인한다. */
export interface Invite {
  token: string;
  academyName: string;
  invitee: 'student' | 'parent' | 'teacher';
  inviterLabel: string;
}

export type LearningSource = 'personal' | 'academy';
export type LearningStatus = 'todo' | 'in_progress' | 'done';

/** 현재는 국어만 지원한다. 수학·영어 등은 이후 추가 예정. */
export type Subject = '국어';
/** 국어 영역. 독서·문학은 지문형, 문법은 독립 문항형. */
export type KoreanArea = '독서' | '문학' | '문법' | '화법과 작문';
/** 학년. 학습을 고를 때 첫 번째 단계다. */
export type Grade = 1 | 2 | 3;
/** 문제 유형: 지문 기반(passage) 또는 독립 문항(grammar). */
export type ContentKind = 'passage' | 'grammar';

export interface Question {
  id: string;
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation?: string;
}

export interface Passage {
  title: string;
  body: string;
}

/** 하나의 학습 콘텐츠 세트(총괄관리자가 등록). */
export interface ContentSet {
  id: string;
  subject: Subject;
  area: KoreanArea;
  title: string;
  kind: ContentKind;
  /** kind === 'passage'일 때 지문. */
  passage?: Passage;
  questions: Question[];
  /** 학년. 학습 고르기 첫 단계에 쓴다. */
  grade?: Grade;
  /** 세부 유형(현대소설·과학·음운의 변동 등). 학습 고르기 마지막 단계에 쓴다. */
  topic?: string;
  /** 학생 개인 학습으로 공개할지. */
  publishToStudents: boolean;
  /**
   * 학원이 등록한 콘텐츠면 그 학원 이름. 운영자 콘텐츠는 없음.
   * 학원은 자기 콘텐츠와 운영자 공개 콘텐츠만 배정할 수 있다.
   */
  ownerAcademyName?: string;
}

export interface LearningItem {
  id: string;
  source: LearningSource;
  subject: Subject;
  area: KoreanArea;
  title: string;
  /** 연결된 콘텐츠 세트. 문항은 콘텐츠에서 온다. */
  contentId: string;
  questionCount: number;
  status: LearningStatus;
  /** ISO 날짜 (YYYY-MM-DD). 결정적 고정값. */
  dueDate?: string;
  accuracy?: number; // 0-100, 완료 항목만
}

export interface AcademyClass {
  id: string;
  academyName: string;
  name: string;
  teacherId: string;
  studentIds: string[];
  /**
   * 반의 학년. **반 이름(`고2 국어 3반`)을 파싱하지 않으려고 둔다** — 원장이 `renameClass`로
   * 이름을 바꾸는 순간 파싱이 깨진다. 화면에서 만든 반은 값이 없고, 학년별 집계는 그런 반을
   * `학년 미정`으로 따로 센다.
   */
  grade?: Grade;
}

export interface Submission {
  studentId: string;
  submitted: boolean;
  accuracy?: number; // 제출한 경우 0-100
  timeSec?: number; // 푸는 데 걸린 시간(초)
  /**
   * 제출한 날(YYYY-MM-DD). **마감일(`Assignment.dueDate`)과 다른 값이다.**
   * 없으면 화면에서 `제출일 기록 없음`이라고 말한다 — 마감일을 제출일 자리에 넣지 않는다.
   */
  submittedAt?: string;
  /**
   * 틀린 문항 id. 학부모·학원이 상세 리포트에서 문항별 정오를 볼 수 있게 한다.
   * 이 세션에서 직접 푼 기록(Attempt)이 있으면 그쪽이 우선한다.
   */
  wrongQIds?: readonly string[];
}

export interface Assignment {
  id: string;
  classId: string;
  subject: string;
  title: string;
  questionCount: number;
  dueDate?: string;
  /**
   * 처음 배정할 때의 마감일. 재배정(`reassign`)으로 `dueDate`를 미루면 여기에 원래 값이 남는다.
   *
   * 학부모 월간 리포트는 **이 값으로** 그 달 배정을 판정한다(D-056). 마감일을 미룰 때마다
   * 이미 낸 학생의 지난달 기록이 다른 달로 옮겨 가면 확정된 리포트가 뒤바뀐다.
   */
  originalDueDate?: string;
  /** 배정된 학습 콘텐츠. 학생이 실제로 이 문항을 푼다. */
  contentId?: string;
  submissions: Submission[];
}

/**
 * 오답 복습의 스케줄 상태. DB의 `public.note_state`와 값이 같다.
 *
 * - `queued` — 다시 볼 차례가 정해져 있다.
 * - `graduated` — 서로 다른 날 3회 연속으로 맞혔다. 큐에서 빠지지 않고 유지 복습으로 돌아온다.
 * - `stuck` — 서로 다른 날 3회 연속으로 틀렸다. 큐에서 내리고 화면이 다른 길로 넘긴다.
 *
 * **지움은 이 값이 아니다** — `dismissed_at`이 따로 있다. 지움을 상태로 두면 되돌릴 때 무엇으로
 * 돌아갈지가 사라진다(D-033의 "없던 일"이 성립하지 않는다).
 */
export type NoteState = 'queued' | 'graduated' | 'stuck';

/**
 * 답의 근거를 어디서 잡았는가. DB의 `public.note_evidence`와 값이 같다.
 *
 * 국어에서 「선지 vs 지문」 구분이 다음에 할 일을 가른다. **답을 확인하기 전에 묻는다** —
 * 확인한 뒤에는 되짚을 수 없는 값이다.
 */
export type NoteEvidence = 'passage' | 'choices' | 'unsure';
