import { ROSTER_CLASSES } from './roster';
import { EXTRA_ACADEMY_CLASSES } from './academies';
import { SEED_CONTENT } from './content';
import { DATA_ANCHOR, WINDOW_WEEKS, dateOfIndex, seasonWeight } from './calendar';
import { digits, frac, pick } from './hash';
import type { AcademyClass, Assignment, Submission } from './types';

/**
 * 학원 배정 이력(합성).
 *
 * **왜 만드는가**: 시드 배정은 4건이고 제출일(`submittedAt`)이 있는 행이 4개뿐이라
 * 반 122개짜리 학원에서 데이터가 있는 반이 2개였다. 그 상태로는 주간 추이의 점이 4개도
 * 나오지 않아 학원 대시보드가 무엇을 그려도 빈 화면이 된다.
 *
 * **규칙은 `src/data/activity.ts`·`academies.ts`와 같다**: `Math.random`과 현재 시각을 쓰지 않고
 * 문자열 씨앗에서 결정적으로 만든다. 새로고침·재실행에도 같은 값이 나온다.
 * 시간 축은 `src/data/calendar.ts` 하나를 쓰고 계절 가중치(`seasonWeight`)를 그대로 받는다.
 *
 * **실제 사용자 데이터가 아니다.** 화면은 이 값을 테스트·합성 데이터라고 밝힌다(마스터 플랜 5절).
 *
 * 대상에서 **`c_kor1`·`c_kor2`는 뺀다** — 두 반의 배정은 학생 제출 흐름과 학부모 월간 리포트가
 * 걸려 있는 읽기 쉬운 시드(`fixtures.ts`)이고, 여기서 더하면 그 화면들의 확정된 숫자가 바뀐다.
 */

/**
 * 이력을 만들 한빛학원 반(인덱스). 나머지 100개 반은 배정 0으로 남겨
 * `배정 없는 반`도 진짜 값이 되게 한다.
 *
 * **세 학년에 고루 둔다** — 로스터는 0~39가 고1, 40~79가 고2, 80~119가 고3이다. 한 학년만
 * 채우면 학년별 요약의 나머지 두 줄이 영원히 비고, 테스트 선생님 계정의 담당 반
 * (`roster.ts`의 `TEACHER_OVERRIDE`: 고1 2·5·8, 고2 42·45·48)이 빠진다.
 */
const ROSTER_HISTORY_INDEXES: readonly number[] = [
  ...Array.from({ length: 10 }, (_, i) => i), // 고1 0~9
  ...Array.from({ length: 10 }, (_, i) => 40 + i), // 고2 40~49
  ...Array.from({ length: 5 }, (_, i) => 80 + i), // 고3 80~84
];

/** 마감일을 기준일 뒤로 더 내는 주 수. 오늘·이번 주 마감이 화면에 실제로 있어야 한다. */
const AHEAD_WEEKS = 2;

/** 배정 대상 반. 한빛 25개 + 신규 학원 7곳의 반 전부. */
function historyClasses(): readonly AcademyClass[] {
  return [
    ...ROSTER_HISTORY_INDEXES.map((i) => ROSTER_CLASSES[i]).filter(Boolean),
    ...EXTRA_ACADEMY_CLASSES,
  ];
}

/**
 * 일 인덱스 → 날짜 문자열 표.
 * `dateOfIndex`는 부를 때마다 `Date`를 두 개 만든다. 제출 행이 만 단위라 그 비용이 생성 시간의
 * 대부분이었다(실측 404ms → 표를 쓰면 크게 준다).
 */
const DATE_TABLE: readonly string[] = Array.from(
  { length: (WINDOW_WEEKS + AHEAD_WEEKS) * 7 + 8 },
  (_, i) => dateOfIndex(i),
);

function dateAt(index: number): string {
  return DATE_TABLE[index] ?? dateOfIndex(index);
}

/** 과제 이름. 학원이 실제로 붙이는 방식(`4월 3주 문법 점검`)을 따른다. */
function titleOf(due: string, area: string): string {
  const month = Number(due.slice(5, 7));
  const week = Math.floor((Number(due.slice(8, 10)) - 1) / 7) + 1;
  return `${month}월 ${week}주 ${area} 점검`;
}

/** 그 주에 배정이 있었는지. 방학 주(가중치 0.55)는 절반 이하로 준다. */
function hasAssignment(classId: string, week: number): boolean {
  const weight = seasonWeight[Math.min(week, WINDOW_WEEKS - 1)];
  return frac(`ah:when:${classId}:${week}`) < Math.min(0.95, weight * 0.5);
}

/**
 * 학생별 성실도·실력. 학생 한 명이 26주 내내 비슷하게 보이도록 계정 단위로 고정한다.
 * 학생 1,000명이 배정 30개씩을 받으므로 계정마다 한 번만 계산하고 들고 있는다.
 */
const traitCache = new Map<string, { loyalty: number; ability: number }>();

/**
 * **아이디를 뒤집어서 씨앗에 넣는다.** 학생 아이디는 `u_rs_0001`처럼 뒤 네 자리만 다른데,
 * FNV-1a는 마지막 글자만 바뀌면 결과가 좁은 폭으로 움직인다(`hash.ts`가 적어 둔 성질이다).
 * 그대로 쓰면 실력 분포가 한쪽으로 몰려 정답률 분포 그래프가 들쭉날쭉해진다
 * (실측 625명 10구간: `55,47,77,29,93,47,94,84,44,55` → 뒤집으면 `65,53,63,66,60,76,66,61,56,59`).
 */
function traitOf(studentId: string): { loyalty: number; ability: number } {
  let t = traitCache.get(studentId);
  if (!t) {
    const rev = [...studentId].reverse().join('');
    t = { loyalty: frac(`${rev}:ah:l`), ability: frac(`${rev}:ah:a`) };
    traitCache.set(studentId, t);
  }
  return t;
}

/**
 * 틀린 문항 id. 정답률에서 개수를 정하고 문항을 고르게 흩는다.
 * 정답 수를 정답률에서 되돌리지 않기 위한 값이다(D-052) — 문항별 정오의 근거가 된다.
 */
function wrongIdsOf(ids: readonly string[], start: number, accuracy: number): string[] {
  const total = ids.length;
  const wrong = Math.max(0, Math.min(total, Math.round((total * (100 - accuracy)) / 100)));
  if (wrong === 0) return [];
  // 서로 겹치지 않는 자리를 고른다. 간격을 두면 같은 문항이 두 번 들어와 개수가 줄어든다.
  const out: string[] = [];
  for (let i = 0; i < wrong; i += 1) out.push(ids[(start + i) % total]);
  return out;
}

function submissionsFor(
  cls: AcademyClass,
  assignmentId: string,
  questionIds: readonly string[],
  dueIndex: number,
  week: number,
): Submission[] {
  const weight = seasonWeight[Math.min(week, WINDOW_WEEKS - 1)];
  return cls.studentIds.map((studentId) => {
    // **씨앗 하나를 나눠 쓴다.** 값마다 `pick`을 부르면 제출 행 1.7만 개에서 해시가 다섯 배로
    // 늘고 문자열도 그만큼 더 만든다(`hash.ts`의 `digits`가 있는 이유와 같다).
    const [dSub, dWhen, dAcc, dTime, dWrong] = digits(`ah:${assignmentId}:${studentId}`, 64, 5);
    const trait = traitOf(studentId);
    // 성실도 + 계절. 시험 달에는 제출이 늘고 방학에는 줄어든다.
    const chance = Math.max(0.4, Math.min(0.98, 0.5 + trait.loyalty * 0.4 + (weight - 1) * 0.12));
    if (dSub / 64 >= chance) return { studentId, submitted: false };

    // 마감 3일 전 ~ 마감 당일. **마감일을 제출일 자리에 넣지 않는다**(D-048).
    const submittedAt = dateAt(dueIndex - (dWhen % 4));
    // 기준일보다 뒤면 아직 낼 수 없는 과제다. 최근·다가오는 마감의 미제출은 여기서 생긴다.
    if (submittedAt > DATA_ANCHOR) return { studentId, submitted: false };

    // 실력이 낮은 학생도 실제로 있다. 폭이 좁으면 분포 그래프의 아래 구간이 통째로 빈다.
    const mean = 46 + trait.ability * 38;
    const accuracy = Math.max(15, Math.min(100, Math.round(mean + (dAcc / 64 - 0.5) * 34)));
    return {
      studentId,
      submitted: true,
      submittedAt,
      accuracy,
      timeSec: 420 + (100 - accuracy) * 8 + dTime * 2,
      wrongQIds: wrongIdsOf(questionIds, dWrong % questionIds.length, accuracy),
    };
  });
}

function build(): Assignment[] {
  const sets = SEED_CONTENT;
  // 문항 id 배열은 세트마다 한 번만 만든다(제출 행마다 다시 만들면 만 번 돈다).
  const questionIds = sets.map((s) => s.questions.map((q) => q.id));
  const out: Assignment[] = [];
  for (const cls of historyClasses()) {
    for (let week = 0; week < WINDOW_WEEKS + AHEAD_WEEKS; week += 1) {
      if (!hasAssignment(cls.id, week)) continue;
      const id = `ah_${cls.id}_w${String(week).padStart(2, '0')}`;
      const at = pick(`${id}:set`, 0, sets.length - 1);
      const set = sets[at];
      // 주 중반~주말 마감. 월요일 마감은 실제로 거의 없다.
      const dueIndex = week * 7 + pick(`${id}:due`, 2, 5);
      out.push({
        id,
        classId: cls.id,
        subject: '국어',
        // 콘텐츠 제목을 그대로 쓰지 않는다 — 학원이 붙이는 과제 이름은 콘텐츠 이름과 다르고,
        // 같으면 화면에서 콘텐츠를 찾을 때 합성 배정 수백 건이 함께 걸린다.
        title: titleOf(dateAt(dueIndex), set.area),
        questionCount: set.questions.length,
        contentId: set.id,
        dueDate: dateAt(dueIndex),
        submissions: submissionsFor(cls, id, questionIds[at], dueIndex, week),
      });
    }
  }
  return out;
}

let cache: readonly Assignment[] | null = null;

/**
 * 배정 이력. **모듈 캐시**라 여러 화면이 불러도 한 번만 만든다.
 * 앱 시작마다 만들지 않도록 게으르게 부른다 — 학생·학부모 화면은 이 값을 쓰지 않는다.
 */
export function assignmentHistory(): readonly Assignment[] {
  if (!cache) cache = build();
  return cache;
}
