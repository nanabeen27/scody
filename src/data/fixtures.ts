import type { Account, Assignment, AcademyClass, LearningItem, Submission } from './types';
import { ROSTER_CLASSES, ROSTER_STUDENTS, ROSTER_TEACHERS } from './roster';
import {
  EXTRA_ACADEMY_CLASSES,
  EXTRA_ACADEMY_STUDENTS,
  EXTRA_ACADEMY_TEACHERS,
} from './academies';
import { SOLO_STUDENTS } from './solo';

/** 프로토타입 공용 비밀번호. 실제 서비스에서는 사용하지 않는다. */
/** 개발 fixture 계정의 자리 표시용. 실제 로그인에 쓰이지 않는다(서버가 검증한다). */
export const DEMO_PASSWORD = '(개발 fixture)';

/**
 * 프로토타입 공용 인증번호. 실제로는 서버가 발송하고 검증한다.
 * 아래 계정의 전화번호도 모두 합성 값이다(실제 번호가 아니다).
 */
export const DEMO_PHONE_CODE = '000000';

/** '카카오로 계속하기' 데모가 로그인시킬 계정. */
export const DEMO_KAKAO_USER = 'u_student_both';

/**
 * 결정적 테스트 계정. 새로고침·재실행에도 동일 상태를 재현한다.
 * 날짜는 고정 문자열(현재 시각 비의존).
 */
const LOGIN_ACCOUNTS: readonly Account[] = [
  {
    userId: 'u_student_personal',
    name: '김서준',
    scodyId: 'seojun',
    phone: '010-1000-0001',
    password: DEMO_PASSWORD,
    roles: ['student'],
    entitlements: [{ kind: 'personal', payer: 'student', label: '개인 월정액' }],
  },
  {
    userId: 'u_student_parentpaid',
    name: '이하은',
    scodyId: 'haeun',
    phone: '010-1000-0002',
    password: DEMO_PASSWORD,
    roles: ['student'],
    entitlements: [{ kind: 'personal', payer: 'parent', label: '학부모 결제 구독' }],
  },
  {
    userId: 'u_student_academy',
    name: '박도윤',
    scodyId: 'doyun',
    phone: '010-1000-0003',
    password: DEMO_PASSWORD,
    roles: ['student'],
    academyName: '한빛학원',
    entitlements: [{ kind: 'academy', payer: 'academy', label: '학원 이용권' }],
  },
  {
    userId: 'u_student_both',
    name: '정예린',
    scodyId: 'yerin',
    phone: '010-1000-0004',
    password: DEMO_PASSWORD,
    kakaoLinked: true,
    roles: ['student'],
    academyName: '한빛학원',
    entitlements: [
      { kind: 'academy', payer: 'academy', label: '학원 이용권' },
      { kind: 'personal', payer: 'student', label: '개인 월정액' },
    ],
  },
  {
    userId: 'u_parent',
    name: '최민지',
    scodyId: 'minji',
    phone: '010-2000-0001',
    password: DEMO_PASSWORD,
    roles: ['parent'],
    entitlements: [],
  },
  {
    userId: 'u_academy_director',
    name: '한빛 원장',
    scodyId: 'hanbit.director',
    phone: '010-3000-0001',
    password: DEMO_PASSWORD,
    roles: ['academy'],
    academyRole: 'director',
    academyName: '한빛학원',
    entitlements: [],
  },
  {
    userId: 'u_academy_teacher',
    name: '오선생',
    scodyId: 'hanbit.teacher',
    phone: '010-3000-0002',
    password: DEMO_PASSWORD,
    roles: ['academy'],
    academyRole: 'teacher',
    academyName: '한빛학원',
    entitlements: [],
  },
  {
    // 한 계정 다역할: 선생님이면서 학부모. 로그인 후 공간 전환을 보여준다.
    userId: 'u_teacher_parent',
    name: '한지훈',
    scodyId: 'jihoon',
    phone: '010-3000-0003',
    password: DEMO_PASSWORD,
    roles: ['academy', 'parent'],
    academyRole: 'teacher',
    academyName: '한빛학원',
    entitlements: [],
  },
  {
    // 총괄관리자(운영자). 문제 콘텐츠를 등록한다.
    userId: 'u_admin',
    name: '스코디 관리자',
    scodyId: 'admin',
    phone: '010-9000-0001',
    password: DEMO_PASSWORD,
    roles: ['admin'],
    entitlements: [],
  },
] as const;

/**
 * 전체 계정 = 로그인 가능한 테스트 계정 + 규모용 로스터(로그인 불가).
 * 로스터는 학원 화면이 실제 규모에서 어떻게 보이는지 확인하기 위한 개발용 데이터다.
 */
export const ACCOUNTS: readonly Account[] = [
  ...LOGIN_ACCOUNTS,
  ...ROSTER_TEACHERS,
  ...ROSTER_STUDENTS,
  // 학원이 여러 곳인 상태를 보려면 학원마다 원장·선생·학생이 있어야 한다(`academies.ts`).
  ...EXTRA_ACADEMY_TEACHERS,
  ...EXTRA_ACADEMY_STUDENTS,
  // 학원에 속하지 않은 개인 사용자(무료·유료). 없으면 ARPU가 ARPPU보다 커진다(`solo.ts`).
  ...SOLO_STUDENTS,
];

/*
  초대 토큰 fixture(`INVITES`)는 없다. 세 개의 하드코딩 토큰이 화면에서 실제 초대처럼 보였고,
  학원이 실제로 만든 토큰은 `유효하지 않은 링크`가 됐다. 초대는 `invites` 표에 있고,
  링크 진입은 `rpc_invite_info`가, 목록은 `loadInvites`가 답한다. seed에도 같은 토큰이 있다.
*/

/** 학부모 → 자녀(학생) 연결. 자녀의 학습 기록은 학생 계정에 남는다. */
export const PARENT_CHILDREN: Record<string, readonly string[]> = {
  u_parent: ['u_student_parentpaid', 'u_student_both'],
  u_teacher_parent: ['u_student_academy'],
};

/** 학생별 학습 항목. 개인/학원 출처를 source로 구분. */
export const LEARNING_BY_USER: Record<string, readonly LearningItem[]> = {
  // 학원이 배정한 학습만 여기 둔다. 개인 학습은 공개된 콘텐츠에서 파생한다.
  u_student_academy: [
    {
      id: 'al_academy_1',
      source: 'academy',
      subject: '국어',
      area: '문학',
      title: '현대소설 - 인물의 심리',
      contentId: 'ct_acad_1',
      questionCount: 2,
      status: 'todo',
      dueDate: '2026-07-24',
    },
  ],
  u_student_both: [
    {
      id: 'al_both_1',
      source: 'academy',
      subject: '국어',
      area: '문학',
      title: '현대소설 - 인물의 심리',
      contentId: 'ct_acad_1',
      questionCount: 2,
      status: 'todo',
      dueDate: '2026-07-24',
    },
  ],
};

/**
 * 테스트 계정 반의 같은 반 친구.
 *
 * 학부모 리포트가 **반 평균과 반 내 순위**를 보여 주려면 비교할 또래가 있어야 한다.
 * 제출자가 한두 명이면 "1명 중 1등"이 되어 뜻이 없다.
 * 새 계정을 만들지 않고 이미 `ACCOUNTS`에 있는 로스터 학생을 쓴다 —
 * 이름은 있지만 전화·비밀번호가 없어 로그인할 수 없다(규모용 데이터와 같은 성격).
 */
const KOR1_PEERS = ['u_rs_0001', 'u_rs_0002', 'u_rs_0003', 'u_rs_0004', 'u_rs_0005', 'u_rs_0006', 'u_rs_0007'] as const;
const KOR2_PEERS = ['u_rs_0011', 'u_rs_0012', 'u_rs_0013', 'u_rs_0014', 'u_rs_0015'] as const;

/** 테스트 계정이 속한 반. 규모용 반은 로스터에서 이어 붙인다. */
const CORE_CLASSES: readonly AcademyClass[] = [
  {
    id: 'c_kor1',
    academyName: '한빛학원',
    name: '고1 국어',
    grade: 1,
    teacherId: 'u_academy_teacher',
    studentIds: ['u_student_both', 'u_student_academy', ...KOR1_PEERS],
  },
  {
    id: 'c_kor2',
    academyName: '한빛학원',
    name: '고2 국어',
    grade: 2,
    teacherId: 'u_teacher_parent',
    studentIds: ['u_student_both', ...KOR2_PEERS],
  },
] as const;

/**
 * 반 친구들의 제출 정답률. 과제 id → 학생별 정답률.
 * **박도윤(`u_student_academy`)은 일부러 넣지 않는다** — 미제출 상태를 보여 주는 계정이다.
 * 나머지는 전원 제출로 두어, 박도윤이 내면 반이 전원 제출이 되는 기존 흐름이 살아 있다.
 */
const PEER_ACCURACY: Record<string, Record<string, number>> = {
  a_kor1_1: { u_rs_0001: 90, u_rs_0002: 70, u_rs_0003: 60, u_rs_0004: 85, u_rs_0005: 50, u_rs_0006: 75, u_rs_0007: 95 },
  a_kor2_1: { u_rs_0011: 80, u_rs_0012: 65, u_rs_0013: 95, u_rs_0014: 70, u_rs_0015: 55 },
  a_kor2_2: { u_rs_0011: 70, u_rs_0012: 50, u_rs_0013: 80, u_rs_0014: 45, u_rs_0015: 65 },
  a_kor2_3: { u_rs_0011: 68, u_rs_0012: 84, u_rs_0013: 76, u_rs_0014: 60, u_rs_0015: 88 },
};

/** 정답률 표를 제출 기록으로 편다. 시간은 정답률에서 결정적으로 만든다(실제 측정값이 아니다). */
function peerSubmissions(assignmentId: string): Submission[] {
  return Object.entries(PEER_ACCURACY[assignmentId] ?? {}).map(([studentId, accuracy]) => ({
    studentId,
    submitted: true,
    accuracy,
    timeSec: 600 + ((100 - accuracy) * 7),
  }));
}

/** 학원 반과 담당 학생. 테스트 계정 반이 앞, 규모용 반이 뒤에 온다. */
export const ACADEMY_CLASSES: readonly AcademyClass[] = [
  ...CORE_CLASSES,
  ...ROSTER_CLASSES,
  ...EXTRA_ACADEMY_CLASSES,
];

/** 배정된 학습과 제출 현황(초기 시드). 배정 화면에서 추가된 항목은 메모리에 더해진다. */
const CORE_ASSIGNMENTS: readonly Assignment[] = [
  {
    id: 'a_kor1_1',
    classId: 'c_kor1',
    subject: '국어',
    title: '현대소설 점검',
    questionCount: 10,
    contentId: 'ct_acad_1',
    dueDate: '2026-07-24',
    submissions: [
      {
        studentId: 'u_student_both',
        submitted: true,
        submittedAt: '2026-07-23',
        accuracy: 80,
        timeSec: 742,
        wrongQIds: ['ct_acad_1_q5', 'ct_acad_1_q9'],
      },
      { studentId: 'u_student_academy', submitted: false },
    ],
  },
  {
    id: 'a_kor2_1',
    classId: 'c_kor2',
    subject: '국어',
    title: '문법 - 맞춤법 점검',
    questionCount: 10,
    contentId: 'ct_gram_1',
    dueDate: '2026-07-25',
    submissions: [
      {
        studentId: 'u_student_both',
        submitted: true,
        submittedAt: '2026-07-25',
        accuracy: 90,
        timeSec: 605,
        wrongQIds: ['ct_gram_1_q7'],
      },
    ],
  },
  {
    id: 'a_kor2_2',
    classId: 'c_kor2',
    subject: '국어',
    title: '독서 - 비판적 읽기 점검',
    questionCount: 10,
    contentId: 'ct_read_1',
    dueDate: '2026-07-20',
    submissions: [
      {
        studentId: 'u_student_both',
        submitted: true,
        submittedAt: '2026-07-19',
        accuracy: 60,
        timeSec: 980,
        wrongQIds: ['ct_read_1_q2', 'ct_read_1_q5', 'ct_read_1_q7', 'ct_read_1_q10'],
      },
    ],
  },
  {
    id: 'a_kor2_3',
    classId: 'c_kor2',
    subject: '국어',
    title: '맞춤법 집중 25문항',
    questionCount: 25,
    contentId: 'ct_gram_bank_spelling',
    dueDate: '2026-07-22',
    submissions: [
      {
        studentId: 'u_student_both',
        submitted: true,
        submittedAt: '2026-07-22',
        accuracy: 72,
        timeSec: 1520,
        wrongQIds: [
          'ct_gram_bank_spelling_q3',
          'ct_gram_bank_spelling_q8',
          'ct_gram_bank_spelling_q12',
          'ct_gram_bank_spelling_q17',
          'ct_gram_bank_spelling_q19',
          'ct_gram_bank_spelling_q22',
          'ct_gram_bank_spelling_q25',
        ],
      },
    ],
  },
] as const;

/**
 * 배정 학습 시드. 테스트 계정 제출 뒤에 반 친구 제출을 이어 붙인다.
 * 이렇게 두면 반 평균·순위·제출률이 실제 계산이 되고, 위 시드는 읽기 쉬운 상태로 남는다.
 */
export const ASSIGNMENTS_SEED: readonly Assignment[] = CORE_ASSIGNMENTS.map((a) => ({
  ...a,
  submissions: [...a.submissions, ...peerSubmissions(a.id)],
}));
