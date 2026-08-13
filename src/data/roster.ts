import type { Account, AcademyClass, Grade } from './types';

/**
 * 규모가 있는 학원을 보여주기 위한 개발용 로스터.
 *
 * - 결정적으로 생성한다(난수·현재 시각을 쓰지 않음). 새로고침·재실행에도 같은 목록이 나온다.
 * - 비밀번호가 없어 로그인할 수 없다. 로그인 가능한 계정은 `ACCOUNTS`의 테스트 계정뿐이다.
 * - 실제 사용자 데이터가 아니다. 화면에서 실제 재원생처럼 표현하지 않는다.
 */
export const ROSTER_ACADEMY = '한빛학원';

// 수천 명 규모의 학원에서 화면이 어떻게 보이는지 확인하기 위한 크기다.
const TEACHER_COUNT = 60;
const CLASS_COUNT = 120;
const STUDENTS_PER_CLASS = 25;

const SURNAMES = [
  '김', '이', '박', '최', '정', '강', '조', '윤', '장', '임',
  '한', '오', '서', '신', '권', '황', '안', '송', '류', '전',
];

const GIVEN_NAMES = [
  '민준', '서연', '도윤', '지우', '예준', '하윤', '시우', '지민', '주원', '서현',
  '유준', '다은', '건우', '채원', '현우', '수아', '지호', '하은', '우진', '지아',
  '준서', '소율', '태준', '나윤', '이준', '유나', '재원', '서아', '동현', '가은',
];

/** 인덱스만으로 이름을 만든다. 성·이름 주기를 다르게 돌려 한 반에 같은 이름이 몰리지 않게 한다. */
function nameFor(i: number): string {
  const surname = SURNAMES[i % SURNAMES.length];
  const given = GIVEN_NAMES[(i * 7) % GIVEN_NAMES.length];
  return `${surname}${given}`;
}

/** 고1~고3 × 반 번호. 120개 반을 학년별로 40개씩 나눈다. */
function classLabel(i: number): string {
  return `고${gradeOf(i)} 국어 ${(i % 40) + 1}반`;
}

/** 반 인덱스 → 학년. 이름과 같은 규칙이지만 이름을 파싱하지 않는다(`AcademyClass.grade`). */
function gradeOf(i: number): Grade {
  return (1 + Math.floor(i / 40)) as Grade;
}

/**
 * 테스트 선생님 계정이 실제로 맡는 반.
 *
 * 담당 반이 하나뿐이면(학생 9명·배정 1건) 선생님 대시보드의 추이·분포·영역별 그래프가
 * 전부 빈 상태로 남는다. 실제 학원 선생님의 담당 규모(3~4반)에 맞춰 로스터 반을 나눠 준다.
 * **학년을 갈라 주는 이유**: `u_teacher_kor`은 `c_kor1`(고1 국어), `u_teacher_kor2`는
 * `c_kor2`(고2 국어)를 이미 맡고 있어 담당 학년이 섞이면 화면이 설명하기 어려워진다.
 */
const TEACHER_OVERRIDE: Readonly<Record<number, string>> = {
  2: 'u_academy_teacher',
  5: 'u_academy_teacher',
  8: 'u_academy_teacher',
  42: 'u_teacher_parent',
  45: 'u_teacher_parent',
  48: 'u_teacher_parent',
};

export const ROSTER_TEACHERS: readonly Account[] = Array.from(
  { length: TEACHER_COUNT },
  (_, i): Account => ({
    userId: `u_rt_${String(i + 1).padStart(2, '0')}`,
    name: `${SURNAMES[(i * 3) % SURNAMES.length]}${GIVEN_NAMES[(i * 11) % GIVEN_NAMES.length]}`,
    scodyId: `hanbit.t${String(i + 1).padStart(2, '0')}`,
    roles: ['academy'],
    academyRole: 'teacher',
    academyName: ROSTER_ACADEMY,
    entitlements: [],
  }),
);

export const ROSTER_STUDENTS: readonly Account[] = Array.from(
  { length: CLASS_COUNT * STUDENTS_PER_CLASS },
  (_, i): Account => ({
    userId: `u_rs_${String(i + 1).padStart(4, '0')}`,
    name: nameFor(i),
    scodyId: `hanbit.s${String(i + 1).padStart(4, '0')}`,
    roles: ['student'],
    academyName: ROSTER_ACADEMY,
    entitlements: [{ kind: 'academy', payer: 'academy', label: '학원 이용권' }],
  }),
);

export const ROSTER_CLASSES: readonly AcademyClass[] = Array.from(
  { length: CLASS_COUNT },
  (_, i): AcademyClass => ({
    id: `c_hanbit_${String(i + 1).padStart(2, '0')}`,
    academyName: ROSTER_ACADEMY,
    name: classLabel(i),
    grade: gradeOf(i),
    teacherId: TEACHER_OVERRIDE[i] ?? ROSTER_TEACHERS[i % TEACHER_COUNT].userId,
    studentIds: ROSTER_STUDENTS.slice(i * STUDENTS_PER_CLASS, (i + 1) * STUDENTS_PER_CLASS).map(
      (s) => s.userId,
    ),
  }),
);
