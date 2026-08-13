import { ROSTER_ACADEMY } from './roster';
import { dateOfIndex, weekStart, WINDOW_WEEKS } from './calendar';
import { pick } from './hash';
import type { Account, AcademyClass, Grade } from './types';

/**
 * 학원 계약 정보와 규모가 있는 학원 목록.
 *
 * **왜 필요한가**: 학원이 한 곳뿐이라 운영자 화면의 학원 관련 지표가 전부 뜻이 없었다 —
 * 정렬·검색·페이저가 한 줄짜리 목록 위에서 돌고, `학원 총 개수`·`원장 수`·`이탈률`을 답할 수
 * 없었다. 게다가 학원이 엔티티가 아니라 `AcademyClass.academyName` 문자열에서 파생돼
 * **계약 좌석·갱신일을 둘 자리가 없었다** — 그 둘이 없으면 좌석 활용률(갱신 이탈 선행 신호)을
 * 만들 수 없다.
 *
 * **조인 키는 `name`을 그대로 쓴다.** `AcademyClass.academyName`과 `Account.academyName`을
 * 건드리지 않아야 학생·학부모·학원 화면과 E2E가 영향을 받지 않는다. `id`는 URL용으로만 둔다
 * (지금 학원 상세 주소가 학원 이름이라 이름을 바꾸면 링크가 깨진다).
 *
 * 결정적으로 생성한다. 실제 계약 데이터가 아니다(마스터 플랜 5절).
 */

export type AcademyStatus = 'active' | 'churned';

export interface Academy {
  /** URL용 식별자. 조인은 `name`으로 한다. */
  id: string;
  name: string;
  /** 계약 시작일. 학원 수 추이의 근거다. */
  createdAt: string;
  /** 계약 좌석 수. **좌석 활용률의 분모**다. 실제 재원생 수보다 크거나 같다. */
  contractSeats: number;
  /** 갱신 예정일. 갱신 90일 전부터 운영자가 먼저 봐야 한다. */
  renewalDate: string;
  status: AcademyStatus;
  /** 이탈한 날. `status === 'churned'`일 때만 있다. */
  churnedAt?: string;
}

/** 지역 이름. 학원 이름을 사람이 구별할 수 있게 만든다. */
const AREAS = ['대치', '분당', '평촌', '중계', '해운대', '둔산', '수성'] as const;

/** 신규 학원 이름. 한빛학원은 기존 로스터 학원이라 여기 넣지 않는다. */
const NEW_ACADEMY_NAMES = AREAS.map((a) => `${a}국어학원`);

/** 반 인덱스 → 학년. 이름과 같은 규칙이지만 이름을 파싱하지 않는다(`AcademyClass.grade`). */
function classGradeOf(i: number, per: number): Grade {
  return Math.min(3, 1 + Math.floor(i / Math.max(1, Math.ceil(per / 3)))) as Grade;
}

/** 반 이름에 쓰는 학년 라벨. */
function classNameOf(i: number, per: number): string {
  return `고${classGradeOf(i, per)} 국어 ${(i % 4) + 1}반`;
}

interface Built {
  academies: Academy[];
  teachers: Account[];
  students: Account[];
  classes: AcademyClass[];
}

/**
 * 신규 학원 7곳을 만든다.
 *
 * 규모를 작게(반 2~6개·반당 15~22명, 학원당 학생 약 40~130명) 두는 이유: 한빛학원 같은
 * 3천 명 규모를 하나 더 만들면 계정이 6천을 넘고 활동 생성 비용이 두 배가 된다. 좌석 활용률과
 * 학원 이탈률의 **분포**를 보는 데는 이 규모로 충분하다.
 *
 * 마지막 한 곳은 `churned`로 둔다 — 이탈이 0이면 학원 이탈률과 Quick Ratio가 늘 0이어서
 * 화면이 그 지표를 한 번도 보여 주지 못한다.
 */
function build(): Built {
  const academies: Academy[] = [];
  const teachers: Account[] = [];
  const students: Account[] = [];
  const classes: AcademyClass[] = [];

  // 한빛학원: 기존 로스터. 계약 정보만 얹는다. 원장은 로그인 계정에 이미 있어 더하지 않는다
  // (`getTeachersForAcademy`가 원장·선생을 가르지 않아 학원 관리 화면의 `원장 N명`이 2가 된다).
  academies.push({
    id: 'ac_hanbit',
    name: ROSTER_ACADEMY,
    createdAt: dateOfIndex(0),
    // 실제 재원생 3,000명보다 조금 넉넉하게 계약한 상태로 둔다(활용률이 100%를 넘지 않게).
    contractSeats: 3_200,
    renewalDate: dateOfIndex((WINDOW_WEEKS + 1) * 7),
    status: 'active',
  });

  NEW_ACADEMY_NAMES.forEach((name, n) => {
    const seed = `ac:${name}`;
    const classCount = pick(`${seed}:classes`, 2, 6);
    const perClass = pick(`${seed}:per`, 15, 22);
    const startWeek = pick(`${seed}:start`, 0, WINDOW_WEEKS - 6);
    const churned = n === NEW_ACADEMY_NAMES.length - 1;
    const enrolled = classCount * perClass;

    academies.push({
      id: `ac_${n + 1}`,
      name,
      createdAt: weekStart(startWeek),
      // 계약 좌석은 재원생보다 조금 많다 — 그래서 활용률이 60~95% 사이에 흩어진다.
      contractSeats: enrolled + pick(`${seed}:spare`, 2, 30),
      /*
        갱신일은 기준일 주변으로 흩뜨린다. 계약일 + 52주로 계산하면 창(26주)을 전부 넘어가
        모든 학원이 같은 날이 되고, `갱신 30일 내` 알림이 한 번도 뜨지 않는다.
        음수도 허용해 이미 갱신 시점이 지난 학원(재계약 협의 중)도 만든다.
      */
      renewalDate: dateOfIndex((WINDOW_WEEKS + pick(`${seed}:renew`, -3, 22)) * 7),
      status: churned ? 'churned' : 'active',
      churnedAt: churned ? weekStart(WINDOW_WEEKS - 3) : undefined,
    });

    // 원장 1명. 로스터에 원장이 0명이어서 `원장 수`를 셀 수 없었다.
    const director: Account = {
      userId: `u_ad_${n + 1}`,
      name: `${name.slice(0, 2)} 원장`,
      scodyId: `${romanize(name)}.director`,
      roles: ['academy'],
      academyRole: 'director',
      academyName: name,
      entitlements: [],
    };
    teachers.push(director);

    const teacherCount = Math.ceil(classCount / 2);
    const mine: Account[] = Array.from({ length: teacherCount }, (_, t) => ({
      userId: `u_at_${n + 1}_${t + 1}`,
      name: `${SURNAME_POOL[(n * 5 + t) % SURNAME_POOL.length]}선생`,
      scodyId: `${romanize(name)}.t${t + 1}`,
      roles: ['academy'],
      academyRole: 'teacher',
      academyName: name,
      entitlements: [],
    }));
    teachers.push(...mine);

    for (let c = 0; c < classCount; c += 1) {
      const ids: string[] = [];
      for (let s = 0; s < perClass; s += 1) {
        const userId = `u_as_${n + 1}_${c + 1}_${s + 1}`;
        ids.push(userId);
        students.push({
          userId,
          name: `${SURNAME_POOL[(c * 7 + s) % SURNAME_POOL.length]}${GIVEN_POOL[(s * 3 + c) % GIVEN_POOL.length]}`,
          scodyId: `${romanize(name)}.s${c + 1}${String(s + 1).padStart(2, '0')}`,
          roles: ['student'],
          academyName: name,
          entitlements: [{ kind: 'academy', payer: 'academy', label: '학원 이용권' }],
        });
      }
      classes.push({
        id: `c_ac${n + 1}_${c + 1}`,
        academyName: name,
        name: classNameOf(c, classCount),
        grade: classGradeOf(c, classCount),
        teacherId: mine[c % mine.length].userId,
        studentIds: ids,
      });
    }
  });

  return { academies, teachers, students, classes };
}

/** 스코디 아이디에 쓰는 라틴 표기. 한글 아이디는 로그인 규칙과 어긋난다. */
function romanize(name: string): string {
  const at = NEW_ACADEMY_NAMES.indexOf(name);
  return at >= 0 ? ROMAN[at] : 'academy';
}

const ROMAN = ['daechi', 'bundang', 'pyeongchon', 'junggye', 'haeundae', 'dunsan', 'suseong'];
const SURNAME_POOL = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'];
const GIVEN_POOL = ['민준', '서연', '도윤', '지우', '예준', '하윤', '시우', '지민', '주원', '서현'];

const built = build();

export const ACADEMIES: readonly Academy[] = built.academies;
export const EXTRA_ACADEMY_TEACHERS: readonly Account[] = built.teachers;
export const EXTRA_ACADEMY_STUDENTS: readonly Account[] = built.students;
export const EXTRA_ACADEMY_CLASSES: readonly AcademyClass[] = built.classes;

/** 학원 이름으로 계약 정보를 찾는다. */
export function academyByName(name?: string): Academy | undefined {
  return name ? ACADEMIES.find((a) => a.name === name) : undefined;
}

export function academyById(id: string): Academy | undefined {
  return ACADEMIES.find((a) => a.id === id);
}
