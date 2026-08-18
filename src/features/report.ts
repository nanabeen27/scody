import { useCallback, useMemo } from 'react';
import { findContent, type Assignment, type ContentSet } from '@/data';
import { useSession } from '@/session';
import { useProgress, type Attempt, type WrongNote } from './progress';
import type { ClassComparison } from '@/repo/learning';
import { useContent } from './content';
import { dueLabel } from './learning';
import { todayISO } from './clock';

/** 취약이라고 말하려면 이만큼은 풀어야 한다. 한 세트(10문항)로 영역을 단정하지 않는다. */
export const WEAK_MIN_QUESTIONS = 20;
/** 달마다 변화에서 보여 줄 개월 수. */
export const HISTORY_MONTHS = 6;

/** `YYYY-MM-DD` → `YYYY-MM`. 빈 값이면 빈 문자열. */
export function monthOf(iso: string): string {
  return iso ? iso.slice(0, 7) : '';
}

/** `2026-07` → `7월`. 해가 다르면 `2025년 12월`. */
export function monthLabel(month: string, today: string): string {
  const [y, m] = month.split('-');
  return today.slice(0, 4) === y ? `${Number(m)}월` : `${y}년 ${Number(m)}월`;
}

/** 그 주의 월요일(YYYY-MM-DD). 주 단위 집계와 요약 캐시의 키다. */
export function weekOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  const at = new Date(y, m - 1, d);
  // getDay(): 0=일요일. 월요일 시작으로 맞춘다.
  const back = (at.getDay() + 6) % 7;
  at.setDate(at.getDate() - back);
  const mm = `${at.getMonth() + 1}`.padStart(2, '0');
  const dd = `${at.getDate()}`.padStart(2, '0');
  return `${at.getFullYear()}-${mm}-${dd}`;
}

/** 한 주 전 월요일. */
export function prevWeek(monday: string): string {
  const [y, m, d] = monday.split('-').map(Number);
  const at = new Date(y, m - 1, d - 7);
  const mm = `${at.getMonth() + 1}`.padStart(2, '0');
  const dd = `${at.getDate()}`.padStart(2, '0');
  return `${at.getFullYear()}-${mm}-${dd}`;
}

/** 한 달 전. `2026-01` → `2025-12`. */
export function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${`${m - 1}`.padStart(2, '0')}`;
}
/** 이 아래면 약한 영역으로 본다. 화면에서 기준을 함께 밝힌다. */
export const WEAK_THRESHOLD = 80;

export interface ReportRow {
  itemId: string;
  title: string;
  area: string;
  source: 'personal' | 'academy';
  accuracy: number;
  questions: number;
  timeSec: number;
  /** 푼 날 또는 제출한 날. 없으면 빈 문자열 — **마감일을 여기에 넣지 않는다.** */
  dateISO: string;
  /** 마감일. 학원 과제만 갖는다. */
  dueDate?: string;
  /** 문항별 내역을 열 수 있는지. 학원 제출은 틀린 문항 정보가 있어야 열린다. */
  hasDetail: boolean;
  /** 반 비교. 학원 과제이고 제출자가 충분할 때만 있다. */
  cls?: ClassStat | null;
  /**
   * 실제 정답 수. 있으면 이 값을 쓴다 —
   * `accuracy`는 이미 정수로 반올림된 값이라 문항 수로 되돌리면 세트마다 ±1이 쌓인다.
   */
  correct?: number;
}

export interface PendingRow {
  id: string;
  title: string;
  dueDate?: string;
  due: ReturnType<typeof dueLabel>;
}

interface Deps {
  assignments: readonly Assignment[];
  attempts: Record<string, Attempt>;
  wrongNotes: readonly WrongNote[];
  sets: readonly ContentSet[];
  /** 오늘(YYYY-MM-DD). 기본으로 볼 달과 달 이름을 정한다. */
  today: string;
  /**
   * 이 학생이 속한 반 id. **화면이 넘긴다** — 예전에는 fixture(`getStudentClasses`)를 읽어서
   * 학원이 새로 만든 반을 못 봤다(마스터 플랜 S-013). 지금은 세션 스냅샷이 살아 있는 반을 준다.
   *
   * 그 달의 배정 수(`academySubmit`·`byWeekday`)만 이 값으로 좁힌다.
   * **미제출(`pending`)은 배정 대상 행으로 판정한다** — 아래 근거를 적어 뒀다.
   */
  classIds?: readonly string[];
  /**
   * 배정 id → 반 비교 집계. **서버가 낸 값이다**(`rpc_class_comparison`).
   * 없으면 비교를 그리지 않는다 — 지어내지 않는다.
   */
  comparisons?: Record<string, ClassComparison>;
}

/** 반 비교를 보여 주려면 제출자가 이만큼은 있어야 한다. 3명 중 2등은 뜻이 없다. */
export const RANK_MIN_SUBMITTERS = 5;

export interface ClassStat {
  /** 제출한 학생 수. 순위의 분모다. */
  submitters: number;
  /** 1부터. 정답률이 같으면 같은 등수로 본다. */
  rank: number;
  /** 제출자 평균 정답률. */
  avg: number;
  mine: number;
}

/**
 * 학원 과제 하나의 반 비교.
 *
 * **집계는 서버가 낸다**(`rpc_class_comparison`). 예전에는 반 전체 제출이 메모리에 있어서 여기서
 * 평균을 냈는데, 학부모는 RLS상 **다른 학생의 제출을 볼 수 없다** — 그것이 맞다. 개별 정답률을
 * 열지 않고 평균·순위만 받는다.
 *
 * 학원 과제에만 또래 집단이 있다. 개인 학습에는 없으므로 이 값을 만들지 않는다.
 * 제출자가 적으면 `null`을 준다(화면은 비교를 그리지 않는다).
 */
export function classStat(
  comparison: ClassComparison | undefined,
): ClassStat | null {
  if (!comparison || comparison.mine == null || comparison.rank == null || comparison.avg == null) {
    return null;
  }
  if (comparison.submitters < RANK_MIN_SUBMITTERS) return null;
  return {
    submitters: comparison.submitters,
    rank: comparison.rank,
    avg: comparison.avg,
    mine: comparison.mine,
  };
}

/**
 * 그 배정이 **어느 달의 일인지** 판정할 때 쓰는 마감일.
 *
 * 마감일을 미루면(`reassign`) 원래 값이 `originalDueDate`에 남는다. 월 판정을 현재 `dueDate`로
 * 하면 마감을 미룰 때마다 **이미 낸 학생의 확정된 지난달 리포트가 다른 달로 옮겨 간다**(D-056).
 * 아직 안 낸 과제를 재촉 없이 알리는 목록은 반대로 지금 마감일(`a.dueDate`)을 쓴다.
 */
export function reportDueOf(a: Assignment): string | undefined {
  return a.originalDueDate ?? a.dueDate;
}

/** 한 달치 집계. 달마다 같은 모양이라 지난달과 그대로 비교할 수 있다. */
export interface MonthStat {
  month: string;
  /** 공부한 날 수. 누적 총합보다 이 값이 학부모에게 뜻이 있다. */
  days: number;
  count: number;
  questions: number;
  correct: number;
  timeSec: number;
  accuracy: number | null;
}

/**
 * 행의 정답 수.
 *
 * 저장된 값(`Attempt.correct` 또는 `wrongQIds`에서 센 값)이 있으면 그것을 쓴다 — D-052가
 * 정답률에서 되돌리지 말라고 정한 이유는 `accuracy`가 이미 정수로 반올림돼 세트마다 ±1이
 * 집계에 쌓이기 때문이다.
 *
 * 값이 없을 때만 정답률에서 되돌린다(**근사값**). 자기를 다시 호출하면 무한 재귀가 되고,
 * `wrongQIds`가 없는 제출 행에서 실제로 스택 오버플로가 났다(D-060).
 */
export function correctOf(row: ReportRow): number {
  return row.correct ?? Math.round((row.accuracy * row.questions) / 100);
}

function statOf(month: string, rows: readonly ReportRow[]): MonthStat {
  const part = rows.filter((r) => monthOf(r.dateISO) === month);
  const questions = part.reduce((n, a) => n + a.questions, 0);
  const correct = part.reduce((n, a) => n + correctOf(a), 0);
  return {
    month,
    days: new Set(part.map((r) => r.dateISO)).size,
    count: part.length,
    questions,
    correct,
    timeSec: part.reduce((n, a) => n + a.timeSec, 0),
    accuracy: questions ? Math.round((correct / questions) * 100) : null,
  };
}

/** 한 주치 집계. 주 단위 요약이 쓰는 재료다. */
export interface WeekStat {
  monday: string;
  days: number;
  count: number;
  questions: number;
  accuracy: number | null;
  timeSec: number;
  /** 그 주에 낸 학원 과제 수. */
  academySubmitted: number;
}

function weekStatOf(monday: string, rows: readonly ReportRow[]): WeekStat {
  const part = rows.filter((r) => r.dateISO && weekOf(r.dateISO) === monday);
  const questions = part.reduce((n, a) => n + a.questions, 0);
  const correct = part.reduce((n, a) => n + correctOf(a), 0);
  return {
    monday,
    days: new Set(part.map((r) => r.dateISO)).size,
    count: part.length,
    questions,
    accuracy: questions ? Math.round((correct / questions) * 100) : null,
    timeSec: part.reduce((n, a) => n + a.timeSec, 0),
    academySubmitted: part.filter((r) => r.source === 'academy').length,
  };
}

/**
 * AI 요약에 넘길 **사실 문장**. 이미 계산된 값만 담는다 —
 * 모델이 새 수치를 만들 여지를 주지 않는 것이 이 함수의 목적이다.
 * 값이 없는 항목은 줄 자체를 넣지 않는다(모델이 `0`을 해석하지 않게).
 */
export function weekFacts(
  childName: string,
  week: WeekStat,
  before: WeekStat | null,
  areas: readonly { area: string; rate: number; total: number }[],
  pendingOverdue: number,
): string {
  const lines: string[] = [`자녀 이름: ${childName}`];
  lines.push(`이번 주에 공부한 날 수: ${week.days}일`);
  lines.push(`이번 주에 푼 문항 수: ${week.questions}문항`);
  lines.push(`이번 주에 푼 학습 수: ${week.count}개`);
  if (week.accuracy != null) lines.push(`이번 주 정답률: ${week.accuracy}%`);
  lines.push(`이번 주 총 학습 시간: ${Math.round(week.timeSec / 60)}분`);
  if (week.academySubmitted > 0) lines.push(`이번 주에 낸 학원 과제: ${week.academySubmitted}개`);
  if (pendingOverdue > 0) lines.push(`마감이 지났는데 아직 안 낸 학원 과제: ${pendingOverdue}개`);
  if (before && before.count > 0) {
    lines.push(`지난주에 공부한 날 수: ${before.days}일`);
    lines.push(`지난주에 푼 문항 수: ${before.questions}문항`);
    if (before.accuracy != null) lines.push(`지난주 정답률: ${before.accuracy}%`);
  } else {
    lines.push('지난주 기록: 없음 (지난주와 비교하지 마세요)');
  }
  for (const a of areas) {
    lines.push(`영역 ${a.area}: 정답률 ${a.rate}% (${a.total}문항)`);
  }
  return lines.join('\n');
}

/**
 * AI 요약 다듬기. **프롬프트만으로는 출력 형태를 통제할 수 없다** —
 * 인사말을 붙이거나 문장마다 줄을 바꾸는 일이 실제로 일어난다(실측).
 * 그래서 화면에 넣기 전에 구조를 결정적으로 정리한다. 내용은 손대지 않는다.
 */
export function tidySummary(raw: string): string {
  const noMarkdown = raw
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\)\s*/gm, '');
  // 문장마다 줄을 바꿔 보내는 일이 있어 한 덩어리로 잇는다.
  const oneLine = noMarkdown.replace(/\s*\n+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  // 마침표 기준으로 자른 뒤 인사·자기소개 문장을 버린다.
  const sentences = oneLine
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => !/^(안녕하세요|반갑습니다|저는|스코디 선생님)/.test(x));
  // 4문장을 넘기면 리포트 맨 위가 길어진다.
  return sentences.slice(0, 4).join(' ');
}

/** 키가 없을 때 쓸 대체 요약. 같은 숫자를 이어 붙이기만 한다(AI가 쓴 글이 아니라고 밝힌다). */
export function weekFallback(week: WeekStat, before: WeekStat | null): string {
  const bits = [`이번 주에 ${week.days}일 공부하고 ${week.questions}문항을 풀었어요.`];
  if (week.accuracy != null) bits.push(`정답률은 ${week.accuracy}%예요.`);
  if (before && before.accuracy != null && week.accuracy != null) {
    const d = week.accuracy - before.accuracy;
    if (d !== 0) bits.push(`지난주 ${before.accuracy}%보다 ${Math.abs(d)}%포인트 ${d > 0 ? '높아요' : '낮아요'}.`);
  }
  // 근거 없는 총평을 붙이지 않는다. 꾸준함은 실제로 여러 날 했을 때만 말한다.
  if (week.days >= 3) bits.push('오늘은 결과보다 꾸준히 앉은 점을 짚어 주세요.');
  return bits.join(' ');
}

/**
 * 자녀 학습 리포트 계산. **한 달이 리포트 하나다.**
 *
 * 누적 총합은 오래 쓸수록 뜻을 잃는다 — 5년 쓴 학생의 `총 학습 시간 300시간`은
 * 학부모가 이번 달에 무엇을 해야 할지 아무것도 말해 주지 않는다. 그래서 모든 지표를
 * 달로 끊고 **지난달과 나란히** 둔다. 머무는 지표는 "공부한 날 수"다(리서치: 학습량 총합보다
 * 꾸준함이 학부모가 검증할 수 있는 사실이다).
 *
 * 홈과 리포트가 같은 숫자를 말하도록 계산은 여기 한곳에만 둔다.
 * 훅이 아니라 순수 함수라 자녀 여러 명을 한 번에 계산할 수 있다.
 */
export function buildChildReport(childId: string, deps: Deps, wantMonth?: string) {
  const { assignments, attempts, wrongNotes, sets, today } = deps;

  /**
   * 두 출처를 한 목록으로. 직접 푼 기록(문항 내역 있음) + 학원 제출 기록.
   *
   * **직접 푼 학원 과제에도 마감일과 반 비교를 붙인다.** 학원 학습의 `LearningItem.id`는
   * 배정 id이고(`learning.ts`) 제출 기록의 `itemId`도 같은 값이라, 아래 배정 루프가
   * `seen`으로 건너뛴다. 그때 붙여 주지 않으면 자녀가 앱에서 푼 과제에서 순위·마감이
   * 사라지고 화면은 "낸 학생이 적어서"라는 거짓 이유를 대게 된다.
   */
  const allRows: ReportRow[] = Object.values(attempts).map((a) => {
    const assignment =
      a.source === 'academy' ? assignments.find((x) => x.id === a.itemId) : undefined;
    return {
      itemId: a.itemId,
      title: a.title,
      area: a.area,
      source: a.source,
      accuracy: a.accuracy,
      questions: a.total,
      timeSec: a.timeSec,
      dateISO: a.dateISO,
      // 제출 기록의 기준 마감일은 그 학생에게 실제로 적용됐던 값이다(재배정 전).
      dueDate: assignment ? reportDueOf(assignment) : undefined,
      hasDetail: true,
      cls: assignment ? classStat(deps.comparisons?.[assignment.id]) : undefined,
      // 정답 수는 근사하지 않는다. 저장된 실제 값을 쓴다.
      correct: a.correct,
    };
  });
  const seen = new Set(allRows.map((r) => r.itemId));
  for (const assignment of assignments) {
    const sub = assignment.submissions.find((s) => s.studentId === childId);
    if (!sub?.submitted || seen.has(assignment.id) || sub.accuracy == null) continue;
    const content = assignment.contentId ? findContent(sets, assignment.contentId) : undefined;
    allRows.push({
      itemId: assignment.id,
      title: assignment.title,
      area: content?.area ?? '문학',
      source: 'academy',
      accuracy: sub.accuracy,
      questions: content?.questions.length ?? assignment.questionCount,
      timeSec: sub.timeSec ?? 0,
      // 제출일이 없으면 비워 둔다. 마감일로 대신하지 않는다.
      dateISO: sub.submittedAt ?? '',
      dueDate: reportDueOf(assignment),
      hasDetail: !!content && !!sub.wrongQIds,
      cls: classStat(deps.comparisons?.[assignment.id]),
      // 틀린 문항 목록이 있으면 정답 수를 정확히 셀 수 있다.
      correct: sub.wrongQIds
        ? (content?.questions.length ?? assignment.questionCount) - sub.wrongQIds.length
        : undefined,
    });
  }
  allRows.sort((a, b) => (b.dateISO || '').localeCompare(a.dateISO || ''));

  const thisMonth = monthOf(today);
  /** 기록이 있는 달만, 최신순. 비어 있는 이번 달은 여기 없다. */
  const recorded = Array.from(
    new Set([
      ...allRows.map((r) => monthOf(r.dateISO)).filter(Boolean),
      ...wrongNotes.map((n) => monthOf(n.createdAt ?? '')).filter(Boolean),
    ]),
  ).sort((a, b) => b.localeCompare(a));
  /** 고를 수 있는 달. 기록이 있는 달 + 이번 달, 최신순. */
  const months = Array.from(new Set([thisMonth, ...recorded])).sort((a, b) => b.localeCompare(a));
  /**
   * 기본은 **이번 달**이다(D-090). 기록이 있는 가장 최근 달로 열면 매달 1일에 홈은 `8월`,
   * 리포트는 `7월`을 말해 두 화면의 숫자가 어긋난다 — 홈도 같은 함수를 기본값으로 쓴다.
   * 이번 달이 비어 있을 때는 화면이 `latest`로 가는 길을 준다.
   */
  const month = wantMonth && months.includes(wantMonth) ? wantMonth : thisMonth;
  /** 기록이 있는 가장 최근 달. 하나도 없으면 null이라 화면이 길을 만들지 않는다. */
  const latest = recorded[0] ?? null;

  const rows = allRows.filter((r) => monthOf(r.dateISO) === month);
  const totals = statOf(month, allRows);
  /** 지난달. 비교할 기록이 없으면 null이라 화면에서 비교 문구를 그리지 않는다. */
  const before = statOf(prevMonth(month), allRows);
  const prev = before.count > 0 ? before : null;

  /** 최근 몇 달 흐름. 달마다 같은 값이라 나란히 읽힌다(오래된 것부터). */
  const history: MonthStat[] = [];
  let cursor = month;
  for (let i = 0; i < HISTORY_MONTHS; i++) {
    history.unshift(statOf(cursor, allRows));
    cursor = prevMonth(cursor);
  }

  /**
   * 이 달의 복습 활동. 정답률만으로는 "복습을 했는지"를 알 수 없다 —
   * 학부모가 실제로 궁금해하는 것은 틀린 것을 다시 봤는가다.
   */
  const monthNotes = wrongNotes.filter((n) => monthOf(n.createdAt ?? '') === month);
  const notes = {
    added: monthNotes.length,
    organized: monthNotes.filter((n) => n.dig).length,
    starred: monthNotes.filter((n) => n.starred).length,
    // `이해 완료`(mastered)는 뜻이 불분명해 학부모 리포트에서 빼냈다.
    // 필드 자체는 학생 카드 복습이 쓰므로 남아 있다.
    /** 지금까지 담긴 전체. 달과 무관한 현재 상태다. */
    total: wrongNotes.length,
  };

  /**
   * 학원이 배정했는데 아직 안 낸 과제. 달과 무관한 **지금** 상태다.
   *
   * **판정 근거는 배정 대상 행 하나다**(`Submission`은 `v_assignment_submissions` =
   * `assignment_targets`에서 온다). 그 행이 있고 아직 안 낸 것만 센다.
   *
   * 예전에는 `반 소속 ∩ 미제출`이라 대상 행을 보지 않았다. 대상 행은 배정하는 순간의 로스터로
   * 한 번 박히고(`rpc_add_assignment`) 반에 나중에 들어온 학생에게 소급되지 않으므로, 원장이
   * 학생을 반에 넣으면 그 반의 **지난 배정 전부**가 대상 행 없이 이 목록에 들어왔다 — 마감이
   * 이미 지났으니 `지금 확인할 것`과 `아직 안 낸 학원 과제`에 영구히 남는 유령이었다. 같은
   * 과제를 학원은 미제출로 세지 않고(대상 행만 본다) 서버는 제출을 거부했다
   * (`rpc_submit_attempt` → `배정받은 학습이 아니에요.`). 학생 화면(`learning.ts`)과 같은 기준으로
   * 맞춰 세 역할이 같은 사실을 말하게 한다.
   *
   * 아래 달별 배정 수(`academySubmit`·`byWeekday`)는 아직 반 소속으로 좁힌다 — 같은 뿌리이지만
   * 이 변경의 범위가 아니다(S-013).
   */
  const classIds = new Set(deps.classIds ?? []);
  const pending: PendingRow[] = assignments
    .filter((a) => {
      const sub = a.submissions.find((s) => s.studentId === childId);
      return !!sub && !sub.submitted;
    })
    .map((a) => ({ id: a.id, title: a.title, dueDate: a.dueDate, due: dueLabel(a.dueDate) }))
    .sort((a, b) => {
      const ao = a.due?.overdue ? 0 : 1;
      const bo = b.due?.overdue ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99');
    });

  /**
   * 출처별 집계(이 달). **학부모만 두 출처를 다 본다.** 합쳐서 하나의 정답률로 말하면
   * 그 값이 학원 성적인지 집에서 푼 것인지 알 수 없어 학원 상담에 쓸 수 없다.
   */
  const pick = (source: 'personal' | 'academy') => {
    const part = rows.filter((r) => r.source === source);
    const q = part.reduce((n, a) => n + a.questions, 0);
    const c = part.reduce((n, a) => n + correctOf(a), 0);
    return {
      count: part.length,
      questions: q,
      accuracy: q ? Math.round((c / q) * 100) : null,
      days: new Set(part.map((r) => r.dateISO).filter(Boolean)).size,
      timeSec: part.reduce((n, a) => n + a.timeSec, 0),
    };
  };
  const bySource = { personal: pick('personal'), academy: pick('academy') };

  /**
   * 이 달 학원 과제의 반 비교 요약.
   * **과제별 순위를 평균 내지 않는다** — 그것은 없는 수를 만드는 것이다.
   * 대신 반 평균보다 높았던 과제를 센다.
   */
  const compared = rows.filter((r) => r.source === 'academy' && r.cls);
  const academyCompare =
    compared.length > 0
      ? {
          total: compared.length,
          beatAvg: compared.filter((r) => r.cls!.mine > r.cls!.avg).length,
          /**
           * 반 평균. **자녀 정답률과 같은 방식(문항 수 가중)으로 낸다** —
           * 과제별 평균을 단순 평균하면 25문항 세트의 비중이 두 값에서 달라져
           * `정답률 75% · 반 평균 72%`의 부호가 실제와 뒤집힐 수 있다.
           */
          classAvg: Math.round(
            compared.reduce((n, r) => n + r.cls!.avg * r.questions, 0) /
              compared.reduce((n, r) => n + r.questions, 0),
          ),
        }
      : null;

  /** 이 달 학원 과제 제출 현황. `배정 4개 중 3개 냈어요`처럼 말한다. */
  /*
    **마감월 하나로 판정한다.** 제출월과 OR로 묶으면 마감 7/31·제출 8/2인 과제가 두 달의
    분모에 모두 들어가고, 7월은 그 달에 내지 않은 과제를 '모두 냈어요'라고 말한다.
    마감일이 없는 배정은 어느 달에도 넣을 수 없으므로 세지 않고 그 수를 밝힌다.
  */
  const mine = assignments.filter((a) => classIds.has(a.classId));
  const monthAssigned = mine.filter((a) => {
    const due = reportDueOf(a);
    return due && monthOf(due) === month;
  });
  const academySubmit = {
    assigned: monthAssigned.length,
    submitted: monthAssigned.filter((a) =>
      a.submissions.some((s) => s.studentId === childId && s.submitted),
    ).length,
    /** 마감일이 없어 어느 달에도 세지 않은 배정 수. 화면에서 밝힌다. */
    noDueDate: mine.filter((a) => !reportDueOf(a)).length,
  };

  /** 영역별 정답률(이 달). 낮은 순. `enough`가 false면 약점으로 단정하지 않는다. */
  const acc: Record<string, { correct: number; total: number }> = {};
  for (const a of rows) {
    acc[a.area] = acc[a.area] ?? { correct: 0, total: 0 };
    acc[a.area].correct += correctOf(a);
    acc[a.area].total += a.questions;
  }
  const byArea = Object.entries(acc)
    .filter(([, v]) => v.total > 0)
    .map(([area, v]) => ({
      area,
      rate: Math.round((v.correct / v.total) * 100),
      total: v.total,
      enough: v.total >= WEAK_MIN_QUESTIONS,
    }))
    .sort((x, y) => x.rate - y.rate);

  /**
   * 세부 유형별 정답률(제재·갈래). `ContentSet.topic`에서 온다.
   * **자녀가 푼 세트만** 나오고, 대부분 유형에 세트가 하나뿐이라
   * 사실상 "그 세트의 정답률"과 같다 — 그래서 문항 수를 반드시 함께 낸다.
   */
  const topicAcc: Record<string, { correct: number; total: number; area: string }> = {};
  for (const row of rows) {
    const content = sets.find(
      (c) => `li_${c.id}` === row.itemId || c.id === row.itemId,
    );
    // 학원 과제는 itemId가 배정 id라 콘텐츠를 배정에서 되짚는다.
    const viaAssignment = content
      ? undefined
      : assignments.find((a) => a.id === row.itemId)?.contentId;
    const set = content ?? (viaAssignment ? findContent(sets, viaAssignment) : undefined);
    const topic = set?.topic;
    if (!topic) continue;
    topicAcc[topic] = topicAcc[topic] ?? { correct: 0, total: 0, area: row.area };
    topicAcc[topic].correct += correctOf(row);
    topicAcc[topic].total += row.questions;
  }
  const byTopic = Object.entries(topicAcc)
    .map(([topic, v]) => ({
      topic,
      area: v.area,
      rate: Math.round((v.correct / v.total) * 100),
      total: v.total,
    }))
    .sort((x, y) => x.rate - y.rate);

  /** 일별 학습. 그 달에 기록이 있는 날만. 한 세션이 하루로 기록되는 한계는 화면에서 밝힌다. */
  const dayAcc: Record<string, { questions: number; timeSec: number }> = {};
  for (const row of rows) {
    if (!row.dateISO) continue;
    dayAcc[row.dateISO] = dayAcc[row.dateISO] ?? { questions: 0, timeSec: 0 };
    dayAcc[row.dateISO].questions += row.questions;
    dayAcc[row.dateISO].timeSec += row.timeSec;
  }
  const byDay = Object.entries(dayAcc)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  /**
   * 기한 내 제출. 제출일과 마감일이 **둘 다 있는** 과제만 센다 —
   * 하나라도 없으면 판정할 수 없어 분모에서 뺀다.
   */
  const judgeable = rows.filter((r) => r.source === 'academy' && r.dateISO && r.dueDate);
  const onTime = {
    total: judgeable.length,
    inTime: judgeable.filter((r) => r.dateISO <= (r.dueDate ?? '')).length,
  };

  /** 마감이 어느 요일에 몰렸나. 그 달에 마감이 있는 배정만. */
  const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
  const loadAcc: Record<string, number> = {};
  for (const a of assignments) {
    const due = reportDueOf(a);
    if (!classIds.has(a.classId) || !due || monthOf(due) !== month) continue;
    const [y, m, d] = due.split('-').map(Number);
    const label = WEEKDAY[new Date(y, m - 1, d).getDay()];
    loadAcc[label] = (loadAcc[label] ?? 0) + 1;
  }
  const byWeekday = WEEKDAY.map((label) => ({ label, count: loadAcc[label] ?? 0 })).filter(
    (x) => x.count > 0,
  );

  /** 날짜가 남아 있지 않아 어느 달에도 못 세는 기록. 숨기지 않고 밝힌다. */
  const undated = allRows.filter((r) => !r.dateISO).length;
  const lastDate = allRows.find((r) => r.dateISO)?.dateISO ?? null;

  /** 이번 주와 지난주. AI 요약과 '이번 주' 표시가 쓴다(달과 무관한 지금 상태). */
  const thisWeek = weekOf(today);
  const week = weekStatOf(thisWeek, allRows);
  const beforeWeek = weekStatOf(prevWeek(thisWeek), allRows);
  /**
   * **이번 주** 영역별 정답률. 주간 요약에 넘길 값이라 달 집계(`byArea`)를 쓰면 안 된다 —
   * 그러면 모델이 월 성취를 주간 사실로 서술한다.
   */
  const weekAcc: Record<string, { correct: number; total: number }> = {};
  for (const row of allRows) {
    if (!row.dateISO || weekOf(row.dateISO) !== thisWeek) continue;
    weekAcc[row.area] = weekAcc[row.area] ?? { correct: 0, total: 0 };
    weekAcc[row.area].correct += correctOf(row);
    weekAcc[row.area].total += row.questions;
  }
  const weekAreas = Object.entries(weekAcc)
    .filter(([, v]) => v.total > 0)
    .map(([area, v]) => ({ area, rate: Math.round((v.correct / v.total) * 100), total: v.total }))
    .sort((x, y) => x.rate - y.rate);

  return {
    month,
    months,
    latest,
    label: monthLabel(month, today),
    week,
    weekAreas,
    prevWeek: beforeWeek.count > 0 ? beforeWeek : null,
    rows,
    allRows,
    totals,
    prev,
    history,
    notes,
    monthNotes,
    pending,
    bySource,
    academyCompare,
    academySubmit,
    byArea,
    byTopic,
    byDay,
    onTime,
    byWeekday,
    undated,
    lastDate,
    wrongNotes,
    /** 지금 상태(달과 무관). 홈이 쓴다. */
    now: {
      pending: pending.length,
      overdue: pending.filter((p) => p.due?.overdue).length,
      notes: wrongNotes.length,
    },
  };
}

export type ChildReportData = ReturnType<typeof buildChildReport>;

/**
 * 리포트가 **얼마나 아는지**. 계산 결과와 함께 내보낸다.
 *
 * 계산은 두 조회(`useProgress` · `useContent`)에서 온다. 그런데 학부모 화면 셋은 그 조회의
 * `loading`·`loaded`·`error`를 한 번도 보지 않아서, 첫 조회 중과 조회 실패 뒤에 `기록이 없다`고
 * 단정했다 — 학생 화면이 D-133·D-136·D-168로 닫은 결함이 학부모 쪽에 그대로 남아 있었다.
 * 상태를 화면마다 다시 조립하지 않고 여기서 한 번 만든다: 세 화면이 같은 사실을 말해야 한다.
 */
export interface ReportLoad {
  /**
   * 두 조회의 **첫 조회**가 끝났는지. 게이트는 `loading`이 아니라 이 값으로 건다(D-168) —
   * `loading`은 `reading || !loaded`라 재조회마다 참이 되고, 그것으로 목록을 감추면 쓰기
   * 실패가 부른 `reload()` 한 번에 손에 있는 리포트가 통째로 사라진다.
   *
   * **첫 조회가 실패해도 참이 된다**(두 provider가 성공·실패를 함께 끝으로 본다) —
   * 그래서 실패 줄이 정상적으로 나오고 화면이 `불러오고 있어요`에서 영구히 멈추지 않는다.
   */
  loaded: boolean;
  /** 조회가 도는 중. **재조회**는 `loading && loaded`다(`LoadFailed`의 `retrying`). */
  loading: boolean;
  /**
   * 실패 문장(서버가 준 `errorMessage`) 또는 `null`.
   * **첫 조회 중에는 `null`이다** — 자녀를 바꿔 첫 조회가 도는 동안 앞 자녀의 실패 문장이
   * 남으면 지금 무슨 일이 일어나는지 알 수 없다(D-136이 정한 것과 같은 이유).
   */
  error: string | null;
  /** 두 조회를 함께 다시 시도한다. 실패가 어느 쪽에서 왔는지 학부모가 고를 일은 아니다. */
  reload: () => Promise<void>;
}

/** 자녀 한 명의 월간 리포트. 열람 권한은 `attemptsOf`가 검사한다(연결된 자녀만). */
export function useChildReport(childId: string, month?: string): ChildReportData & ReportLoad {
  const {
    assignments,
    attemptsOf,
    wrongNotesOf,
    comparisonsOf,
    loading: progressLoading,
    loaded: progressLoaded,
    error: progressError,
    reload: reloadProgress,
  } = useProgress();
  const {
    sets,
    loading: contentLoading,
    loaded: contentLoaded,
    error: contentError,
    reload: reloadContent,
  } = useContent();
  const { studentClasses } = useSession();
  const attempts = attemptsOf(childId);
  const comparisons = comparisonsOf(childId);
  const wrongNotes = wrongNotesOf(childId);
  const today = todayISO();
  const classIds = studentClasses(childId).map((c) => c.id);
  const classKey = classIds.join(',');
  const data = useMemo(
    () =>
      buildChildReport(
        childId,
        { assignments, attempts, wrongNotes, sets, today, classIds, comparisons },
        month,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- classIds는 매 렌더 새 배열이라 문자열 키로 비교한다.
    [childId, assignments, attempts, wrongNotes, sets, today, month, classKey, comparisons],
  );
  const loaded = progressLoaded && contentLoaded;
  const loading = progressLoading || contentLoading;
  const error = loaded ? (progressError ?? contentError) : null;
  const reload = useCallback(async () => {
    await Promise.all([reloadProgress(), reloadContent()]);
  }, [reloadProgress, reloadContent]);
  return useMemo(
    () => ({ ...data, loaded, loading, error, reload }),
    [data, loaded, loading, error, reload],
  );
}

/**
 * 자녀 여러 명의 리포트를 한 번에. 학부모 홈이 쓴다.
 * 훅을 반복 호출할 수 없어 순수 함수를 루프로 돈다.
 */
export function useChildReports(childIds: readonly string[]): Record<string, ChildReportData> {
  const { assignments, attemptsOf, wrongNotesOf, comparisonsOf } = useProgress();
  const { sets } = useContent();
  const { studentClasses } = useSession();
  const today = todayISO();
  const key = childIds.join(',');
  return useMemo(() => {
    const out: Record<string, ChildReportData> = {};
    for (const id of childIds) {
      out[id] = buildChildReport(id, {
        assignments,
        attempts: attemptsOf(id),
        wrongNotes: wrongNotesOf(id),
        sets,
        classIds: studentClasses(id).map((c) => c.id),
        comparisons: comparisonsOf(id),
        today,
      });
    }
    return out;
    // childIds는 매 렌더 새 배열이라 문자열 키로 비교한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, assignments, attemptsOf, wrongNotesOf, sets, today]);
}
