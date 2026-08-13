import type {
  AcademyClass,
  Assignment,
  ContentSet,
  Grade,
  KoreanArea,
  Submission,
} from '@/data';
import { AREAS, GRADES, findContent, gradeLabel } from '@/data';
import { WEAK_MIN_QUESTIONS, prevWeek, reportDueOf, weekOf } from './report';

/**
 * 학원 화면의 집계를 한곳에 모은다.
 *
 * 왜 필요한가: 대시보드와 성과 분석이 각자 계산해서 **같은 반에 대해 다른 숫자**를 말했다.
 * 대시보드는 배정별 평균을 다시 단순 평균했고(25문항 세트와 10문항 세트가 같은 무게),
 * 학부모 리포트는 문항 수 가중으로 냈다(D-052). 학원이 상담에서 말하는 반 평균과 학부모 앱의
 * 값이 어긋나는 것은 D-048이 고쳤던 문제와 같은 종류다.
 *
 * 그리고 `미제출 N명`이 사람 수가 아니라 **배정×학생 행 수**였다. 한 학생이 과제 3개를 안 내면
 * `3명`이 됐다. 그래서 이 파일은 세는 단위를 이름에 못박는다 — `students`는 사람, `count`는 건.
 */

/** 제출 현황. 정답률은 **문항 수 가중**이다(세트 크기가 달라도 뜻이 유지된다). */
export interface SubmitStat {
  /** 낸 학생 수. */
  submitted: number;
  /** 배정받은 학생 수. */
  total: number;
  /** 문항 수로 가중한 평균 정답률. 정답률이 없는 제출은 분모에서 뺀다. */
  avgAccuracy: number | null;
}

export function submitStat(a: Assignment): SubmitStat {
  const done = a.submissions.filter((s) => s.submitted);
  const scored = done.filter(
    (s): s is typeof s & { accuracy: number } => s.accuracy != null,
  );
  // 문항 수는 배정마다 같으므로 한 배정 안에서는 단순 평균과 같다.
  // 여러 배정을 합칠 때(반·학원 평균) 가중이 필요해 `weightedAccuracy`를 따로 둔다.
  const avg = scored.length
    ? Math.round(scored.reduce((n, s) => n + s.accuracy, 0) / scored.length)
    : null;
  return { submitted: done.length, total: a.submissions.length, avgAccuracy: avg };
}

/**
 * 여러 배정을 합친 평균 정답률. **문항 수로 가중한다.**
 * 25문항 세트와 10문항 세트를 같은 무게로 평균하면 작은 세트가 결과를 뒤집는다.
 */
export function weightedAccuracy(assignments: readonly Assignment[]): number | null {
  let questions = 0;
  let correct = 0;
  for (const a of assignments) {
    const per = a.questionCount || 0;
    for (const s of a.submissions) {
      if (!s.submitted || s.accuracy == null || per === 0) continue;
      questions += per;
      correct += (s.accuracy * per) / 100;
    }
  }
  return questions ? Math.round((correct / questions) * 100) : null;
}

/**
 * 아직 안 낸 것. **두 단위를 갈라서 준다** — 라벨을 붙일 때 헷갈리지 않게.
 * `students`는 사람 수(한 학생이 세 개를 안 내도 1), `count`는 과제 건 수.
 */
export interface PendingStat {
  students: number;
  count: number;
  /** 학생별 안 낸 과제 수. 목록을 학생 1행으로 묶을 때 쓴다. */
  byStudent: { studentId: string; count: number; nearest?: string }[];
}

export function pendingStat(assignments: readonly Assignment[]): PendingStat {
  const per = new Map<string, { count: number; nearest?: string }>();
  let count = 0;
  for (const a of assignments) {
    for (const s of a.submissions) {
      if (s.submitted) continue;
      count += 1;
      const cur = per.get(s.studentId) ?? { count: 0 };
      cur.count += 1;
      // 가장 급한 마감을 함께 들고 간다(정렬과 문장에 쓴다).
      if (a.dueDate && (!cur.nearest || a.dueDate < cur.nearest)) cur.nearest = a.dueDate;
      per.set(s.studentId, cur);
    }
  }
  const byStudent = [...per.entries()]
    .map(([studentId, v]) => ({ studentId, ...v }))
    .sort((x, y) => y.count - x.count || (x.nearest ?? '9999').localeCompare(y.nearest ?? '9999'));
  return { students: per.size, count, byStudent };
}

/** 마감이 지났는데 안 낸 학생이 남은 배정. 선생님이 마감일을 다시 정할 대상이다(D-046). */
export function overdueAssignments(
  assignments: readonly Assignment[],
  today: string,
): { assignment: Assignment; missing: number }[] {
  return assignments
    .filter((a) => a.dueDate && a.dueDate < today)
    .map((a) => ({ assignment: a, missing: a.submissions.filter((s) => !s.submitted).length }))
    .filter((x) => x.missing > 0)
    .sort((x, y) => (x.assignment.dueDate ?? '').localeCompare(y.assignment.dueDate ?? ''));
}

/** 오늘 마감 · 이번 주(오늘부터 7일) 마감. 선생님이 아침에 가장 먼저 보는 값이다(4절). */
export function dueSoon(
  assignments: readonly Assignment[],
  today: string,
): { today: Assignment[]; week: Assignment[] } {
  const [y, m, d] = today.split('-').map(Number);
  const limit = new Date(y, m - 1, d + 7);
  const mm = `${limit.getMonth() + 1}`.padStart(2, '0');
  const dd = `${limit.getDate()}`.padStart(2, '0');
  const end = `${limit.getFullYear()}-${mm}-${dd}`;
  const inRange = assignments.filter((a) => a.dueDate && a.dueDate >= today && a.dueDate <= end);
  return {
    today: inRange.filter((a) => a.dueDate === today),
    week: inRange.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')),
  };
}

/** 반별 수행률. **제출률이 낮은 반부터** 준다 — 원장이 먼저 볼 곳이 위에 와야 한다. */
export interface ClassPerf {
  classId: string;
  name: string;
  students: number;
  assigned: number;
  submitted: number;
  /** 제출률(%). 배정이 없으면 null이라 화면에서 `배정 없음`으로 말한다. */
  rate: number | null;
  avgAccuracy: number | null;
}

export function classPerformance(
  classes: readonly AcademyClass[],
  assignments: readonly Assignment[],
): ClassPerf[] {
  return classes
    .map((c) => {
      const mine = assignments.filter((a) => a.classId === c.id);
      const rows = mine.flatMap((a) => a.submissions);
      const submitted = rows.filter((s) => s.submitted).length;
      return {
        classId: c.id,
        name: c.name,
        students: c.studentIds.length,
        assigned: rows.length,
        submitted,
        rate: rows.length ? Math.round((submitted / rows.length) * 100) : null,
        avgAccuracy: weightedAccuracy(mine),
      };
    })
    .sort((a, b) => {
      // 배정이 없는 반은 판단할 것이 없어 맨 뒤로.
      if (a.rate == null) return 1;
      if (b.rate == null) return -1;
      return a.rate - b.rate;
    });
}

/** 배정의 반 이름. 없으면 빈 문자열(화면에서 반 이름 자리를 비운다). */
/**
 * 배정이 속한 반 이름.
 *
 * **반 목록을 인자로 받는다.** 예전에는 fixture(`getClass`)를 직접 읽어서, 학원이 새로 만든 반의
 * 이름을 못 찾았고(마스터 플랜 S-013) 서버로 옮긴 뒤에는 아무 이름도 찾지 못했다.
 * 화면은 세션 스냅샷의 살아 있는 반 목록을 넘긴다.
 */
export function classNameOf(a: Assignment, classes: readonly AcademyClass[]): string {
  return classes.find((c) => c.id === a.classId)?.name ?? '';
}

/* ------------------------------------------------------------------ *
 * 여기서부터: 기간을 다루는 집계.
 *
 * 화면마다 `assignments.filter(a => ids.has(a.classId))`를 다시 쓰던 것과,
 * 대시보드가 스냅샷만 말하던 것을 여기로 모은다. 화면은 계산하지 않는다(D-061).
 * ------------------------------------------------------------------ */

/** 이 학원(또는 담당 반)이 볼 수 있는 배정만 남긴다. 화면마다 되풀이하던 네 줄을 여기 둔다. */
export function scopedAssignments(
  classes: readonly AcademyClass[],
  assignments: readonly Assignment[],
): Assignment[] {
  const ids = new Set(classes.map((c) => c.id));
  return assignments.filter((a) => ids.has(a.classId));
}

/** 반 id → 그 반 배정. 반 122개마다 전체를 다시 훑지 않으려고 한 번만 만든다. */
export function byClass(assignments: readonly Assignment[]): Map<string, Assignment[]> {
  const map = new Map<string, Assignment[]>();
  for (const a of assignments) {
    const list = map.get(a.classId);
    if (list) list.push(a);
    else map.set(a.classId, [a]);
  }
  return map;
}

/**
 * 추이선의 오른쪽 끝. **지난주 월요일**이다.
 *
 * 이번 주는 아직 끝나지 않아 마감이 남아 있고 제출도 진행 중이다. 그 주를 추이에 넣으면
 * 마지막 점이 늘 바닥으로 떨어져 "제출률이 무너졌다"고 읽힌다(실측: 72,75,73,75,69,68,71,**16**).
 * 지금 값은 화면 위의 지표가 말하고, 추이는 끝난 주까지만 그린다.
 */
export function lastCompleteWeek(today: string): string {
  return prevWeek(weekOf(today));
}

/**
 * 최근 `weeks`주에 마감한 배정만 남긴다. **기간 토글이 `값`에 닿게 하는 함수다.**
 *
 * 예전에는 대시보드의 `값` 열이 전 기간(28주) 누적인데 같은 행의 `변화`·`추이`만 주간이라
 * `4주`↔`26주`를 바꿔도 값이 움직이지 않았다 — 한 행이 세 가지 축을 섞어 말했다(D-076 ⑤).
 *
 * 주 판정은 `weeklySeries`와 **같다**(`reportDueOf` → `weekOf`, D-056). 그래서
 * `weeklySeries(withinWeeks(rows, w, end), w, end)`는 `weeklySeries(rows, w, end)`와 같은 결과다.
 *
 * `endMonday`에는 보통 `lastCompleteWeek(today)`를 준다 — 진행 중인 이번 주는 아직 마감이
 * 남아 있어 넣으면 제출률이 통째로 내려앉는다.
 */
export function withinWeeks(
  assignments: readonly Assignment[],
  weeks: number,
  endMonday: string,
): Assignment[] {
  const keys = new Set<string>();
  let monday = weekOf(endMonday);
  for (let i = 0; i < weeks; i += 1) {
    keys.add(monday);
    monday = prevWeek(monday);
  }
  return assignments.filter((a) => {
    const due = reportDueOf(a);
    return !!due && keys.has(weekOf(due));
  });
}

/** 주 하나의 값. `assigned`는 건, `students`는 사람 — 이름에 단위를 못박는다. */
export interface WeekPoint {
  /** 그 주 월요일(YYYY-MM-DD). */
  monday: string;
  assigned: number;
  submitted: number;
  total: number;
  /** 제출률(%). 배정이 없으면 null. */
  rate: number | null;
  /** 문항 수 가중 정답률(%). 채점된 제출이 없으면 null. */
  accuracy: number | null;
}

/**
 * 최근 `weeks`주의 주간 추이. **오래된 주가 앞**이다(`Sparkline`이 그대로 받는다).
 *
 * **한 주에 담기는 것은 "그 주가 마감인 배정"이다.** 제출일(`submittedAt`)로 자르지 않는 이유:
 * 제출률의 분모(배정받은 학생 수)에는 제출일이 없어서, 분자만 제출일로 자르면 두 값이 다른
 * 주를 말하게 된다. 마감주는 배정마다 하나뿐이라 분모·분자가 같은 축에 선다.
 *
 * 달 판정과 같은 규칙으로 **`originalDueDate ?? dueDate`**를 쓴다(D-056) — 마감일을 미뤄도
 * 이미 지난 주의 값이 다른 주로 옮겨 가지 않는다.
 */
export function weeklySeries(
  assignments: readonly Assignment[],
  weeks: number,
  today: string,
): WeekPoint[] {
  const keys: string[] = [];
  let monday = weekOf(today);
  for (let i = 0; i < weeks; i += 1) {
    keys.push(monday);
    monday = prevWeek(monday);
  }
  keys.reverse();

  const slot = new Map(
    keys.map((k) => [k, { assigned: 0, submitted: 0, total: 0, questions: 0, correct: 0 }]),
  );
  for (const a of assignments) {
    const due = reportDueOf(a);
    if (!due) continue;
    const bucket = slot.get(weekOf(due));
    if (!bucket) continue;
    const per = a.questionCount || 0;
    bucket.assigned += 1;
    for (const s of a.submissions) {
      bucket.total += 1;
      if (!s.submitted) continue;
      bucket.submitted += 1;
      if (s.accuracy == null || per === 0) continue;
      bucket.questions += per;
      bucket.correct += (s.accuracy * per) / 100;
    }
  }

  return keys.map((monday) => {
    const b = slot.get(monday)!;
    return {
      monday,
      assigned: b.assigned,
      submitted: b.submitted,
      total: b.total,
      rate: b.total ? Math.round((b.submitted / b.total) * 100) : null,
      accuracy: b.questions ? Math.round((b.correct / b.questions) * 100) : null,
    };
  });
}

/** 마지막 값과 그 전 값의 차. 값이 둘 미만이거나 한쪽이 없으면 null이다. */
export function deltaOf(values: readonly (number | null)[]): number | null {
  const known = values.filter((v): v is number => v != null);
  if (known.length < 2) return null;
  return known[known.length - 1] - known[known.length - 2];
}

/** 영역별 정답률. **네 영역을 모두 돌려준다** — 값이 없는 영역을 지우면 분모가 사라진다. */
export interface AreaStat {
  area: KoreanArea;
  /** 채점에 들어간 문항 수(가중치의 분모). */
  questions: number;
  accuracy: number | null;
  /** 영역을 단정할 만큼 풀었는지(`WEAK_MIN_QUESTIONS`). 학부모 리포트와 같은 하한이다. */
  enough: boolean;
}

/**
 * `studentId`를 주면 **그 학생의 제출만** 센다. 주지 않으면 넘긴 배정의 모든 제출을 센다.
 *
 * 학생 상세는 "이 학생이 배정받은 배정"을 넘기면서 학생을 지정하지 않아, 같은 반 다른 학생들의
 * 제출까지 합해 놓고 그 학생의 영역별 강약이라고 말했다. 한 건도 내지 않은 학생의 화면에도
 * `문학 76% · 80문항`이 떴고, 같은 화면의 `평균 정답률`은 `—`였다(Q-037). 배정을 좁히는 것으로는
 * 막을 수 없다 — 배정은 반 단위라 그 안에 다른 학생의 제출 행이 함께 들어 있다.
 */
export function areaBreakdown(
  assignments: readonly Assignment[],
  sets: readonly ContentSet[],
  studentId?: string,
): AreaStat[] {
  const acc = new Map<KoreanArea, { questions: number; correct: number }>(
    AREAS.map((a) => [a, { questions: 0, correct: 0 }]),
  );
  for (const a of assignments) {
    if (!a.contentId) continue;
    const set = findContent(sets, a.contentId);
    const bucket = set && acc.get(set.area);
    if (!bucket) continue;
    const per = a.questionCount || 0;
    for (const s of a.submissions) {
      if (studentId && s.studentId !== studentId) continue;
      if (!s.submitted || s.accuracy == null || per === 0) continue;
      bucket.questions += per;
      bucket.correct += (s.accuracy * per) / 100;
    }
  }
  return AREAS.map((area) => {
    const b = acc.get(area)!;
    return {
      area,
      questions: b.questions,
      accuracy: b.questions ? Math.round((b.correct / b.questions) * 100) : null,
      enough: b.questions >= WEAK_MIN_QUESTIONS,
    };
  });
}

/** 정답률 구간별 학생 수. */
export interface AccuracyBucket {
  label: string;
  min: number;
  students: number;
}

/**
 * 학생 한 명당 문항 수 가중 정답률을 내고 10점 구간으로 나눈다.
 * **비어 있는 구간을 지우지 않는다** — 분모를 지우면 분포가 아니라 목록이 된다.
 */
export function accuracyDistribution(assignments: readonly Assignment[]): AccuracyBucket[] {
  const per = new Map<string, { questions: number; correct: number }>();
  for (const a of assignments) {
    const q = a.questionCount || 0;
    if (q === 0) continue;
    for (const s of a.submissions) {
      if (!s.submitted || s.accuracy == null) continue;
      const cur = per.get(s.studentId) ?? { questions: 0, correct: 0 };
      cur.questions += q;
      cur.correct += (s.accuracy * q) / 100;
      per.set(s.studentId, cur);
    }
  }
  const buckets: AccuracyBucket[] = Array.from({ length: 10 }, (_, i) => ({
    label: i === 9 ? '90~100%' : `${i * 10}~${i * 10 + 9}%`,
    min: i * 10,
    students: 0,
  }));
  for (const v of per.values()) {
    const rate = Math.round((v.correct / v.questions) * 100);
    buckets[Math.min(9, Math.floor(rate / 10))].students += 1;
  }
  return buckets;
}

/** 학년별 요약. 학년을 모르는 반은 `학년 미정`으로 따로 센다(반 이름을 파싱하지 않는다). */
export interface GradeStat {
  grade: Grade | null;
  label: string;
  classes: number;
  students: number;
  assigned: number;
  submitted: number;
  rate: number | null;
  accuracy: number | null;
}

export function gradeBreakdown(
  classes: readonly AcademyClass[],
  assignments: readonly Assignment[],
): GradeStat[] {
  const index = byClass(assignments);
  const keys: (Grade | null)[] = [...GRADES, null];
  return keys
    .map((grade) => {
      const mine = classes.filter((c) => (c.grade ?? null) === grade);
      const rows = mine.flatMap((c) => index.get(c.id) ?? []);
      const subs = rows.flatMap((a) => a.submissions);
      const submitted = subs.filter((s) => s.submitted).length;
      return {
        grade,
        label: grade ? gradeLabel(grade) : '학년 미정',
        classes: mine.length,
        students: new Set(mine.flatMap((c) => c.studentIds)).size,
        assigned: subs.length,
        submitted,
        rate: subs.length ? Math.round((submitted / subs.length) * 100) : null,
        accuracy: weightedAccuracy(rows),
      };
    })
    .filter((g) => g.classes > 0);
}

/**
 * 문항을 `다시 다룰 것`으로 앞세우려면 이만큼은 풀었어야 한다.
 * 영역별 정답률의 `WEAK_MIN_QUESTIONS`와 같은 성격의 하한이다 — 표본이 적으면 단정하지 않는다.
 */
export const HARD_MIN_ANSWERS = 5;

/** 오답률이 높은 문항. 수업에서 다시 다룰 것을 고르는 데 쓴다. */
export interface HardQuestion {
  contentId: string;
  questionId: string;
  prompt: string;
  wrong: number;
  answered: number;
  rate: number;
}

/**
 * 문항별 오답률 상위 `n`개.
 * 틀린 문항은 `Submission.wrongQIds`에서만 온다 — 정답률에서 되돌려 추정하지 않는다(D-052).
 */
export function hardestQuestions(
  assignments: readonly Assignment[],
  sets: readonly ContentSet[],
  n = 5,
): HardQuestion[] {
  const wrong = new Map<string, number>();
  const answered = new Map<string, number>();
  for (const a of assignments) {
    if (!a.contentId) continue;
    const set = findContent(sets, a.contentId);
    if (!set) continue;
    /*
      푼 사람 수는 **배정당 한 번** 더한다. 한 배정의 모든 제출이 같은 문항 집합을 보므로
      제출 루프 안에서 문항마다 +1 하면 같은 결과를 훨씬 많은 쓰기로 만든다
      (원장 26주 실측: 97,073회 → 5,452회).
    */
    let solved = 0;
    for (const s of a.submissions) {
      if (!s.submitted || !s.wrongQIds) continue;
      solved += 1;
      for (const id of s.wrongQIds) wrong.set(id, (wrong.get(id) ?? 0) + 1);
    }
    if (solved === 0) continue;
    for (const q of set.questions) answered.set(q.id, (answered.get(q.id) ?? 0) + solved);
  }
  const byId = new Map(
    sets.flatMap((set) => set.questions.map((q) => [q.id, { set, q }] as const)),
  );
  return [...wrong.entries()]
    .map(([questionId, count]) => {
      const found = byId.get(questionId);
      const total = answered.get(questionId) ?? 0;
      return {
        contentId: found?.set.id ?? '',
        questionId,
        prompt: found?.q.prompt ?? '',
        wrong: count,
        answered: total,
        rate: total ? Math.round((count / total) * 100) : 0,
      };
    })
    .filter((r) => r.answered > 0)
    .sort((a, b) => {
      // **표본이 충분한 문항을 먼저 준다.** 한 명이 풀고 한 명이 틀린 문항은 오답률 100%라
      // 정렬만으로는 늘 맨 위에 서는데, 선생님이 수업에서 다시 볼 문항은 그것이 아니다
      // (실측: `1명 중 1명` 두 줄이 `39명 중 21명`을 밀어냈다).
      const aEnough = a.answered >= HARD_MIN_ANSWERS;
      const bEnough = b.answered >= HARD_MIN_ANSWERS;
      if (aEnough !== bEnough) return aEnough ? -1 : 1;
      return b.rate - a.rate || b.answered - a.answered;
    })
    .slice(0, n);
}

/** 학생 목록 한 줄. 학생 3,000명을 한 번에 세려고 요약만 담는다. */
export interface StudentSummary {
  assigned: number;
  submitted: number;
  pending: number;
  rate: number | null;
  accuracy: number | null;
  lastSubmittedAt?: string;
}

/**
 * 학생별 요약을 **한 번 훑어서** 만든다.
 *
 * 학생마다 `studentPerformance`를 부르면 학생 3,000명 × 배정 400건을 매 렌더에 돈다.
 * 목록 화면은 요약만 필요하므로 제출 행을 한 번만 지나간다.
 */
export function studentSummaries(
  assignments: readonly Assignment[],
): Map<string, StudentSummary> {
  const acc = new Map<
    string,
    { assigned: number; submitted: number; questions: number; correct: number; last?: string }
  >();
  for (const a of assignments) {
    const per = a.questionCount || 0;
    for (const s of a.submissions) {
      const cur = acc.get(s.studentId) ?? { assigned: 0, submitted: 0, questions: 0, correct: 0 };
      cur.assigned += 1;
      if (s.submitted) {
        cur.submitted += 1;
        if (s.accuracy != null && per > 0) {
          cur.questions += per;
          cur.correct += (s.accuracy * per) / 100;
        }
        if (s.submittedAt && (!cur.last || s.submittedAt > cur.last)) cur.last = s.submittedAt;
      }
      acc.set(s.studentId, cur);
    }
  }
  const out = new Map<string, StudentSummary>();
  for (const [studentId, v] of acc) {
    out.set(studentId, {
      assigned: v.assigned,
      submitted: v.submitted,
      pending: v.assigned - v.submitted,
      rate: v.assigned ? Math.round((v.submitted / v.assigned) * 100) : null,
      accuracy: v.questions ? Math.round((v.correct / v.questions) * 100) : null,
      lastSubmittedAt: v.last,
    });
  }
  return out;
}

/** 학생 한 명의 학원 학습 요약. **개인 학습은 여기 들어오지 않는다**(확정 정책 2절). */
export interface StudentPerf {
  assigned: number;
  submitted: number;
  rate: number | null;
  accuracy: number | null;
  /** 아직 안 낸 배정(마감 이른 순). */
  pending: Assignment[];
  /** 낸 것(제출일 늦은 순). 반 평균은 그 배정 안에서 낸다. */
  rows: { assignment: Assignment; submission: Submission; classAvg: number | null }[];
  /** 낸 순서대로의 정답률. 추이선이 그대로 받는다. */
  trend: number[];
  lastSubmittedAt?: string;
}

export function studentPerformance(
  studentId: string,
  assignments: readonly Assignment[],
): StudentPerf {
  const mine = assignments.filter((a) => a.submissions.some((s) => s.studentId === studentId));
  const rows: StudentPerf['rows'] = [];
  const pending: Assignment[] = [];
  let questions = 0;
  let correct = 0;
  let submitted = 0;

  for (const a of mine) {
    const submission = a.submissions.find((s) => s.studentId === studentId)!;
    if (!submission.submitted) {
      pending.push(a);
      continue;
    }
    submitted += 1;
    const per = a.questionCount || 0;
    if (submission.accuracy != null && per > 0) {
      questions += per;
      correct += (submission.accuracy * per) / 100;
    }
    rows.push({ assignment: a, submission, classAvg: submitStat(a).avgAccuracy });
  }

  pending.sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  rows.sort((x, y) => orderKey(y).localeCompare(orderKey(x)));

  return {
    assigned: mine.length,
    submitted,
    rate: mine.length ? Math.round((submitted / mine.length) * 100) : null,
    accuracy: questions ? Math.round((correct / questions) * 100) : null,
    pending,
    rows,
    trend: [...rows]
      .reverse()
      .map((r) => r.submission.accuracy)
      .filter((v): v is number => v != null),
    lastSubmittedAt: rows.find((r) => r.submission.submittedAt)?.submission.submittedAt,
  };
}

/** 정렬 키. 제출일이 없으면 마감일로 대신하되 **값 자체를 제출일 자리에 넣지는 않는다**. */
function orderKey(row: StudentPerf['rows'][number]): string {
  return row.submission.submittedAt ?? row.assignment.dueDate ?? '';
}
