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
   * 인증·복구·알림용 휴대폰 번호. 식별자가 아니다(기록은 `userId`에 붙는다).
   * 프로토타입에서는 '휴대폰 번호로 로그인'의 조회 키로만 쓴다. 번호가 없는 계정은 번호로 로그인할 수 없다.
   */
  phone?: string;
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
}

export interface Submission {
  studentId: string;
  submitted: boolean;
  accuracy?: number; // 제출한 경우 0-100
  timeSec?: number; // 푸는 데 걸린 시간(초)
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
  /** 배정된 학습 콘텐츠. 학생이 실제로 이 문항을 푼다. */
  contentId?: string;
  submissions: Submission[];
}
