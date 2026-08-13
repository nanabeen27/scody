import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@/lib/supabase';
import {
  CHURN_WINDOW_DAYS,
  MAU_WINDOW_DAYS,
  WEEK_DAYS,
  activityEvents,
  adminOverview,
  dailyActivity,
  daysAgoISO,
  listAcademies,
  revenueEstimate,
  staffCounts,
  studentSignups,
  type ActivityEvent,
  type AcademySummary,
  type AdminOverview,
  type DailyActivity,
  type RevenueEstimate,
  type Signup,
  type StaffCounts,
} from '@/repo/admin';
import { todayISO } from './clock';

/**
 * 운영자 지표를 **한곳에서** 계산한다.
 *
 * 왜 한곳인가: 지표 로직이 화면마다 흩어지면 같은 이름의 값이 조금씩 다르게 나온다
 * (metric drift). 이 레포는 그 결함을 이미 두 번 고쳤다 — 홈과 학부모 리포트 사이(D-048),
 * 학원 대시보드와 성과 분석 사이(D-061). 세 번째를 만들지 않는다.
 *
 * ## 입력이 서버로 바뀌었다
 *
 * 예전에는 `src/data/activity.ts`가 FNV-1a 해시로 26주 활동을 합성하고, `src/data/calendar.ts`가
 * `2026-07-28` 고정 기준일과 계절 가중치를 만들었다. 그 위에서 계산한 MAU는 실제 MAU가 아니었고
 * 화면은 지표마다 `합성` 배지를 달아 그 사실을 밝혔다. 이제 원천은 `learning_events`·`profiles`·
 * `entitlements`·`academies`이고, 시계는 **실제 오늘**(`todayISO()`) 하나다.
 *
 * ## 없는 값을 0으로 채우지 않는다 — 이 파일의 핵심 규칙
 *
 * 합성 데이터를 버리면서 **원천을 잃은 지표가 생겼다.** 코호트 리텐션·Quick Ratio·이탈·
 * Activation은 "그 사람의 그 기간을 우리가 실제로 기록했는가"에 걸려 있는데, 활동 기록은
 * 서버를 붙인 날부터 쌓인다. 90일 전에 만든 계정의 W0 잔존을 0%로 적으면 화면은 "떠났다"고
 * 말하지만 사실은 "안 봤다"다. 그래서 이 파일의 계산 함수는 값 대신 **`reason`(왜 못 내는지)**
 * 을 돌려줄 수 있고, 화면은 그 문장을 값 자리에 그대로 쓴다.
 *
 * **활성의 정의**(D-1): 그 날 문항 1개 이상 답을 저장한 학생. 로그인은 활성이 아니다.
 * **이탈**: 28일 연속 활성 0건. 창을 밝히지 않으면 이탈률은 뜻이 없다.
 */

/** 지표 값의 출처. 서버 집계는 `실측`, 요금 정책으로 계산한 금액만 `추정`이다. */
export type MetricSource = '실측' | '추정';

export { CHURN_WINDOW_DAYS, MAU_WINDOW_DAYS, WEEK_DAYS };

/**
 * 지표 사전. **이름·정의·수식의 단일 소스**다.
 *
 * 화면은 표의 열 헤더와 행 이름을 여기서 가져오고, 수식을 지표명 바로 아래 한 줄로 보여 준다.
 * `fake`는 "이 지표가 오작동으로 오르는 경로"다 — 정의만 적어 두면 나중에 숫자가 올랐을 때
 * 좋은 일인지 판단할 근거가 없다.
 *
 * **`desc`·`fake`는 화면에 그대로 나가므로 `-어요` 체로 쓴다**(개요 북극성 설명과 지표 사전).
 * 어투를 두 벌 두지 않는다 — 사전 어투가 필요한 독자는 없다. `formula`는 명사구라 그대로 둔다.
 *
 * **지표를 지우지 않는다.** 지금 값을 낼 수 없는 지표도 정의는 남긴다 — 무엇을 세려 했는지가
 * 사라지면 기록이 쌓인 뒤에 다시 발명해야 한다.
 */
export interface MetricDef {
  label: string;
  formula: string;
  desc: string;
  source: MetricSource;
  /** 오작동으로 오르는 경로. 없으면 해당 없음. */
  fake?: string;
  /** 비율 지표인지. `Δ`를 `%p`로 쓸지 `%`로 쓸지 가른다 — 섞으면 부호가 뒤집혀 읽힌다. */
  ratio?: boolean;
}

export const METRICS: Record<string, MetricDef> = {
  wal: {
    label: '주간 학습 완료 학습자',
    formula: '최근 7일에 학습 1건 이상 완료한 학생 수(중복 없이)',
    desc: '북극성 지표예요. 전달된 가치를 세는 값이라 활성보다 좁게 잡아요.',
    source: '실측',
    fake: '학원이 짧은 과제를 잘게 쪼개 배정하면 완료 수가 늘어나요.',
  },
  wau: {
    label: '주간 활성 학습자',
    formula: '최근 7일에 문항 1개 이상 답을 저장한 학생 수(중복 없이)',
    desc: '활성은 로그인이 아니라 문제를 푸는 행동이에요.',
    source: '실측',
  },
  mau: {
    label: 'MAU (28일)',
    formula: '오늘 이전 28일 안에 활성이었던 학생 수(중복 없이)',
    desc: '캘린더 월이 아니라 28일 rolling으로 고정했어요. 월 길이 차이로 값이 흔들리지 않게요.',
    source: '실측',
  },
  dau: {
    label: 'DAU',
    formula: '오늘 활성이었던 학생 수',
    desc: '하루 단위예요. 학습 앱은 매일 쓰는 제품이 아니라 주 단위가 더 뜻이 있어요.',
    source: '실측',
  },
  stickiness: {
    label: '고착도 (DAU/MAU)',
    formula: 'DAU ÷ MAU × 100',
    desc: '외부 벤치마크는 활성 정의가 달라 비교가 성립하지 않아요. 사내 추이만 봐요.',
    source: '실측',
    ratio: true,
  },
  signup: {
    label: '신규 가입',
    formula: '그 주에 계정을 만든 학생 수',
    desc: '가입일은 계정의 생성 시각이에요. 다른 값에서 파생하지 않아요.',
    source: '실측',
  },
  activation: {
    label: 'Activation율',
    formula: '(가입 7일 안에 학습 1건 완료한 신규) ÷ 그 주 신규 가입 × 100',
    desc: '마일스톤은 리텐션을 예측해야 뜻이 있어요. 도달군의 28일 잔존이 미도달군의 2배 이상이어야 해요.',
    source: '실측',
    fake: '마일스톤을 가입 완료처럼 이른 단계로 내리면 저절로 올라가요.',
    ratio: true,
  },
  churn: {
    label: '주간 이탈',
    formula: `그 주에 ${CHURN_WINDOW_DAYS}일 연속 무활동이 된 학생 수`,
    desc: `이탈 판정 창은 ${CHURN_WINDOW_DAYS}일이에요. 7·14일로 두면 방학·시험 주가 이탈로 잡혀요.`,
    source: '실측',
  },
  quickRatio: {
    label: 'Quick Ratio',
    formula: '(신규 + 부활) ÷ 이탈',
    desc: '1을 넘으면 활성이 늘어나요. 부활을 신규에 섞으면 값이 부풀려져요.',
    source: '실측',
  },
  cc: {
    label: 'Carrying Capacity',
    formula: `일 신규 활성 ÷ 일 이탈률 (일 이탈률 = ${CHURN_WINDOW_DAYS}일 이탈 ÷ MAU ÷ ${CHURN_WINDOW_DAYS})`,
    desc: '이 유입·이탈이 유지될 때 도달하는 활성 사용자 상한이에요. 시장 크기는 반영하지 않아요.',
    source: '실측',
  },
  ccUse: {
    label: '적재용량 소진율',
    formula: 'MAU ÷ Carrying Capacity × 100',
    desc: '상한 단일 숫자보다 이쪽이 실전적이에요. 얼마나 남았는지를 말해요.',
    source: '실측',
    ratio: true,
  },
  personalSubs: {
    label: '개인학습 구독자',
    formula: '개인 이용권이 살아 있는 건수',
    desc: '학원 좌석과 겹치는 학생의 개인 이용권도 세요. 해지한 이용권은 빼요.',
    source: '실측',
  },
  academyCount: {
    label: '학원 수',
    formula: '계약이 살아 있는 학원 수',
    desc: '이탈한 학원은 세지 않고 따로 표시해요.',
    source: '실측',
  },
  academySeats: {
    label: '학원 좌석',
    formula: '계약이 살아 있는 학원의 반에 속한 학생 수 합계(학원별 중복 없이)',
    desc: '계약 좌석이 아니라 실제 재원생 수예요. 이탈한 학원의 재원생은 빼요.',
    source: '실측',
  },
  seatUse: {
    label: '좌석 활용률',
    formula: '재원생 수 ÷ 계약 좌석 × 100',
    desc: '60% 미만이면 갱신에서 이탈로 이어지는 선행 신호예요.',
    source: '실측',
    ratio: true,
  },
  directors: {
    label: '원장',
    formula: '학원에서 원장으로 등록된 계정 수',
    desc: '학원마다 1명이에요.',
    source: '실측',
  },
  teachers: {
    label: '선생님',
    formula: '학원에서 선생님으로 등록된 계정 수',
    desc: '원장은 여기 넣지 않아요.',
    source: '실측',
  },
  students: {
    label: '학생 계정',
    formula: '학생 역할 계정 수',
    desc: '학원 재원생과 개인 학습자를 함께 세요.',
    source: '실측',
  },
  parents: {
    label: '학부모 계정',
    formula: '학부모 역할 계정 수',
    desc: '자녀 연결이 없는 계정도 세요.',
    source: '실측',
  },
  mrr: {
    label: 'MRR',
    formula: '살아 있는 개인 이용권 월 환산 합계 + 학원 좌석 청구액 합계',
    desc: '요금제 화면의 단가·할인율을 그대로 써요. 해지한 구독과 이탈한 학원에는 청구하지 않아요. 실제 결제 기록이 아니에요.',
    source: '추정',
  },
  arr: {
    label: 'ARR',
    formula: 'MRR × 12',
    desc: '연 환산이에요. 연 결제 비율은 요금제 정책값이에요.',
    source: '추정',
  },
  arppu: {
    label: 'ARPPU',
    formula: 'MRR ÷ 돈을 내는 사람 수(중복 없이)',
    desc: '분모는 사람이에요. 이용권 건수와 좌석 수를 더하면 한 학생이 두 번 세어져요.',
    source: '추정',
  },
  arpu: {
    label: 'ARPU',
    formula: 'MRR ÷ MAU',
    desc: '분모를 누적 가입자로 잡으면 계속 떨어지는 가짜 지표가 돼요. 보통 ARPPU가 ARPU보다 크지만, 유료 사람보다 활성이 적으면 반대가 돼요 — 돈을 받는데 쓰지 않는 좌석이 많다는 뜻이에요.',
    source: '추정',
  },
  grr: {
    label: 'GRR (개인 구독)',
    formula: '(시작한 구독 − 해지) ÷ 시작한 구독 × 100',
    desc: '확장을 넣지 않으므로 100%를 넘을 수 없어요. NRR은 만들지 않아요 — 개인 구독에 확장 개념이 없어요.',
    source: '실측',
    ratio: true,
  },
};

/* ────────────────────────── 날짜 도구 ────────────────────────── */

const DAY_MS = 86_400_000;

function dateOf(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function isoOf(at: Date): string {
  const m = `${at.getMonth() + 1}`.padStart(2, '0');
  const d = `${at.getDate()}`.padStart(2, '0');
  return `${at.getFullYear()}-${m}-${d}`;
}

/** `from`부터 `to`까지의 일 수(같은 날이면 0). */
export function daysBetween(from: string, to: string): number {
  return Math.round((dateOf(to).getTime() - dateOf(from).getTime()) / DAY_MS);
}

function shift(iso: string, days: number): string {
  const at = dateOf(iso);
  at.setDate(at.getDate() + days);
  return isoOf(at);
}

/** 그 날이 속한 주의 월요일. 주를 나누는 기준을 한곳에 둔다. */
export function mondayOf(iso: string): string {
  const at = dateOf(iso);
  // `getDay()`는 일요일이 0이다. 월요일을 주 시작으로 쓰므로 일요일은 6일 앞으로 당긴다.
  const back = (at.getDay() + 6) % 7;
  return shift(iso, -back);
}

/* ────────────────────────── 활동 ────────────────────────── */

/** 최근 7일 중 며칠 활동했는지의 히스토그램 한 칸. */
export interface L7Bucket {
  days: number;
  count: number;
}

/**
 * 창 안의 활동 요약.
 *
 * `null`은 **"아직 기록이 없다"**는 뜻이고 0과 다르다. 기록이 하나도 없으면 활성 0명이 아니라
 * 활성을 아직 셀 수 없는 상태다.
 */
export interface ActivityStats {
  /** 활동 기록이 시작된 날. 없으면 아직 아무 기록도 없다. */
  firstDay?: string;
  /** 가장 최근 활동일. */
  lastDay?: string;
  /** 기록이 있는 기간의 길이(일). 첫 기록일부터 오늘까지 센다. */
  recordedDays: number;
  dau: number | null;
  wau: number | null;
  wal: number | null;
  mau: number | null;
  /** 완성된 주의 주간 계열. 완성된 주가 없으면 빈 배열이고 화면이 `추이 없음`이라고 말한다. */
  walWeekly: number[];
  wauWeekly: number[];
  mauWeekly: number[];
  /** 완성된 주의 월요일. `*Weekly`와 길이가 같다. */
  weekLabels: string[];
  /** 최근 7일 활동일 분포. 기록이 없으면 `null`. */
  l7: L7Bucket[] | null;
}

const ANSWERED = 'answer_saved';
const COMPLETED = 'attempt_submitted';

/** 사람×날을 하나로 묶은 집합. 같은 날 여러 이벤트를 하루로 센다. */
function daysByStudent(events: readonly ActivityEvent[], kind: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const e of events) {
    if (e.kind !== kind) continue;
    let set = out.get(e.studentId);
    if (!set) out.set(e.studentId, (set = new Set()));
    set.add(e.day);
  }
  return out;
}

/** 구간 `[from, to]`에 하루라도 든 사람 수(중복 없이). */
function distinctIn(by: Map<string, Set<string>>, from: string, to: string): number {
  let n = 0;
  for (const [, days] of by) {
    for (const d of days) {
      if (d >= from && d <= to) {
        n += 1;
        break;
      }
    }
  }
  return n;
}

/**
 * 활동 요약을 만든다.
 *
 * 하루 단위 수(`dau`)는 `v_daily_activity`가 세어 준 값을 쓰고, 기간 안에서 중복을 제거한
 * 수(WAU·WAL·MAU)는 원본 이벤트에서 센다 — 하루치를 더하면 이틀 활동한 학생이 두 번 세어진다.
 * 두 입력 모두 `learning_events` 한 표에서 나온다.
 */
export function activityStats(
  events: readonly ActivityEvent[],
  daily: readonly DailyActivity[],
  studentCount: number,
  today: string = todayISO(),
): ActivityStats {
  const answered = daysByStudent(events, ANSWERED);
  const completed = daysByStudent(events, COMPLETED);
  const allDays = events.map((e) => e.day).sort();
  const firstDay = allDays[0];
  const lastDay = allDays[allDays.length - 1];

  if (!firstDay || !lastDay) {
    return {
      recordedDays: 0,
      dau: null,
      wau: null,
      wal: null,
      mau: null,
      walWeekly: [],
      wauWeekly: [],
      mauWeekly: [],
      weekLabels: [],
      l7: null,
    };
  }

  /*
    **완성된 주만 그린다.** 오늘이 주 중간이면 마지막 점이 2~3일치라 값이 절반으로 떨어져
    사고처럼 읽힌다(코호트에서 아직 오지 않은 셀을 0%로 채우지 않는 것과 같은 이유).
    첫 주도 기록이 주 중간부터 시작했으면 넣지 않는다 — 같은 이유로 낮게 나온다.
  */
  const weekLabels: string[] = [];
  let cursor = mondayOf(firstDay);
  if (cursor < firstDay) cursor = shift(cursor, WEEK_DAYS);
  while (shift(cursor, WEEK_DAYS - 1) < today) {
    weekLabels.push(cursor);
    cursor = shift(cursor, WEEK_DAYS);
  }

  const walWeekly = weekLabels.map((w) => distinctIn(completed, w, shift(w, WEEK_DAYS - 1)));
  const wauWeekly = weekLabels.map((w) => distinctIn(answered, w, shift(w, WEEK_DAYS - 1)));
  const mauWeekly = weekLabels.map((w) => {
    const end = shift(w, WEEK_DAYS - 1);
    return distinctIn(answered, shift(end, -(MAU_WINDOW_DAYS - 1)), end);
  });

  const weekFrom = shift(today, -(WEEK_DAYS - 1));
  /** 최근 7일에 활동한 날 수. `0일` 칸은 나머지 전부다. */
  const buckets = new Array<number>(WEEK_DAYS + 1).fill(0);
  let counted = 0;
  for (const [, days] of answered) {
    const n = [...days].filter((d) => d >= weekFrom && d <= today).length;
    if (n === 0) continue;
    buckets[Math.min(WEEK_DAYS, n)] += 1;
    counted += 1;
  }
  /*
    `0일` 버킷을 지우지 않는다. 최근 7일에 아무것도 하지 않은 학생이 가장 큰 집단인데,
    그것을 빼면 분모가 화면에서 사라진다 — "분산을 드러낸다"고 말하면서 가장 큰 분산을 지우는
    일이 된다. 대신 그 칸이 무엇인지 화면이 글자로 밝힌다.
  */
  buckets[0] = Math.max(0, studentCount - counted);

  return {
    firstDay,
    lastDay,
    recordedDays: daysBetween(firstDay, today) + 1,
    dau: daily.find((d) => d.day === today)?.activeStudents ?? 0,
    wau: distinctIn(answered, weekFrom, today),
    wal: distinctIn(completed, weekFrom, today),
    mau: distinctIn(answered, shift(today, -(MAU_WINDOW_DAYS - 1)), today),
    walWeekly,
    wauWeekly,
    mauWeekly,
    weekLabels,
    l7: buckets.map((count, days) => ({ days, count })),
  };
}

/* ────────────────────────── 기록이 없어 못 내는 값 ────────────────────────── */

/**
 * 기록이 짧아 판정할 수 없을 때의 문장.
 *
 * **화면이 이 문장을 값 자리에 그대로 쓴다.** `0`이나 추정으로 채우지 않는다 — "이탈 0명"과
 * "아직 이탈을 판정할 수 없다"는 다른 사실이고, 앞의 것은 좋은 소식으로 읽힌다.
 */
export function shortHistory(activity: ActivityStats, needDays: number): string | null {
  if (!activity.firstDay) return '아직 활동 기록이 모이지 않았어요';
  if (activity.recordedDays >= needDays) return null;
  return `활동 기록이 ${activity.recordedDays}일치예요. ${needDays}일이 모이면 값이 나와요`;
}

/* ────────────────────────── 성장 구성 ────────────────────────── */

export interface GrowthWeek {
  /** 주 시작(월요일). */
  label: string;
  /** 이번 주 처음 활성이 된 사람. */
  isNew: number;
  /** 지난주에도 활성이었고 이번 주도 활성. */
  retained: number;
  /** 이탈했다가 이번 주에 돌아온 사람. */
  resurrected: number;
  /** 이번 주에 28일 무활동이 된 사람. */
  churned: number;
  /** (신규 + 부활) ÷ 이탈. 이탈이 0이면 값이 없다. */
  quickRatio: number | null;
}

export interface Growth {
  weeks: GrowthWeek[];
  /** 만들 수 없는 이유. 값이 있으면 `weeks`는 비어 있다. */
  reason?: string;
}

/**
 * 주간 성장 회계.
 *
 * **부활(Resurrected)을 신규에 섞지 않는다.** 학습 앱은 시험 주기 부활자가 많아, 섞으면
 * "신규가 늘었다"고 오독하게 된다.
 *
 * **이탈을 판정하려면 창보다 긴 기록이 있어야 한다.** 기록이 5일치면 아무도 28일 무활동이 될
 * 수 없어서 이탈은 언제나 0이 되는데, 그건 "이탈이 없다"가 아니라 "아직 모른다"다. 그래서
 * 기록이 `이탈 창 + 비교할 한 주`보다 짧으면 표를 만들지 않고 이유를 돌려준다.
 */
export function growth(events: readonly ActivityEvent[], activity: ActivityStats): Growth {
  const need = CHURN_WINDOW_DAYS + WEEK_DAYS;
  const reason = shortHistory(activity, need);
  if (reason) return { weeks: [], reason };

  const answered = daysByStudent(events, ANSWERED);
  const weeks: GrowthWeek[] = [];
  const everActive = new Set<string>();
  let prevActive = new Set<string>();

  for (const start of activity.weekLabels) {
    const end = shift(start, WEEK_DAYS - 1);
    const active = new Set<string>();
    for (const [id, days] of answered) {
      for (const d of days) {
        if (d >= start && d <= end) {
          active.add(id);
          break;
        }
      }
    }
    let isNew = 0;
    let retained = 0;
    let resurrected = 0;
    for (const id of active) {
      if (!everActive.has(id)) isNew += 1;
      else if (prevActive.has(id)) retained += 1;
      else resurrected += 1;
    }
    // 이탈: 이 주 마지막 날 기준으로 28일 무활동이 되었고, 직전 주에는 그렇지 않았던 사람.
    let churned = 0;
    for (const [id, days] of answered) {
      if (!everActive.has(id) && !active.has(id)) continue;
      const list = [...days];
      const nowOut = !list.some((d) => d > shift(end, -CHURN_WINDOW_DAYS) && d <= end);
      const before = shift(end, -WEEK_DAYS);
      const wasOut = !list.some((d) => d > shift(before, -CHURN_WINDOW_DAYS) && d <= before);
      if (nowOut && !wasOut) churned += 1;
    }
    for (const id of active) everActive.add(id);
    prevActive = active;
    weeks.push({
      label: start,
      isNew,
      retained,
      resurrected,
      churned,
      quickRatio: churned > 0 ? (isNew + resurrected) / churned : null,
    });
  }
  return { weeks };
}

/* ────────────────────────── 적재용량 ────────────────────────── */

/** 적재용량이 유입·이탈을 평균하는 기간(주). */
export const CC_WEEKS = 4;

export interface CarryingCapacity {
  /** 일 신규 활성(최근 4주 평균). */
  dailyInflow: number;
  /** 일 이탈률. `28일 이탈 ÷ MAU ÷ 28`. */
  dailyChurnRate: number;
  /** 균형점. 이탈률이 0이면 값이 없다. */
  capacity: number | null;
  /** `MAU ÷ capacity`. */
  usedPct: number | null;
  /** 만들 수 없는 이유. */
  reason?: string;
}

export function carryingCapacity(g: Growth, mau: number | null): CarryingCapacity {
  if (g.reason || g.weeks.length === 0) {
    return {
      dailyInflow: 0,
      dailyChurnRate: 0,
      capacity: null,
      usedPct: null,
      reason: g.reason ?? '아직 집계할 주가 없어요',
    };
  }
  const recent = g.weeks.slice(-CC_WEEKS);
  const inflow = recent.reduce((n, w) => n + w.isNew + w.resurrected, 0) / (recent.length * WEEK_DAYS);
  const churned = recent.reduce((n, w) => n + w.churned, 0);
  const dailyChurnRate = mau && mau > 0 ? churned / mau / CHURN_WINDOW_DAYS : 0;
  const capacity = dailyChurnRate > 0 ? inflow / dailyChurnRate : null;
  return {
    dailyInflow: inflow,
    dailyChurnRate,
    capacity,
    usedPct: capacity && mau ? (mau / capacity) * 100 : null,
  };
}

/* ────────────────────────── 코호트 리텐션 ────────────────────────── */

export interface CohortRow {
  /** 가입 주(월요일). */
  label: string;
  /** 코호트 크기. 작으면 화면에서 회색으로 둔다. */
  size: number;
  /** `W0`부터의 잔존율(%). 아직 오지 않은 주는 `null` — 0으로 채우지 않는다. */
  cells: (number | null)[];
}

/** 코호트 표에서 보여 줄 경과 주 수. */
export const COHORT_WEEKS = 9;
/** 이보다 작은 코호트는 신뢰할 수 없다고 화면에서 흐리게 둔다. */
export const COHORT_MIN_SIZE = 20;

export interface Cohorts {
  rows: CohortRow[];
  /** 만들 수 없는 이유. 값이 있으면 `rows`는 비어 있다. */
  reason?: string;
}

/**
 * 주간 Classic 리텐션 코호트.
 *
 * Day 0 = **가입일**로 고정한다. 첫 핵심 행동일로 두면 활성화하지 못한 사람이 분모에서
 * 빠져 값이 부풀려진다. `W0`은 정의상 거의 100%이므로 화면에서 강조하지 않는다.
 *
 * **활동을 기록하기 시작한 날보다 먼저 가입한 코호트는 만들지 않는다.** 그 사람들의 W0~Wn에
 * 활동이 없는 것은 안 했기 때문이 아니라 **우리가 안 봤기 때문**이고, 0%로 적으면 화면이
 * "전원 이탈"이라고 말한다. 기록이 쌓이면서 새로 가입하는 코호트부터 줄이 생긴다.
 */
export function cohorts(
  signups: readonly Signup[],
  events: readonly ActivityEvent[],
  activity: ActivityStats,
  today: string = todayISO(),
): Cohorts {
  const first = activity.firstDay;
  if (!first) {
    return { rows: [], reason: '아직 활동 기록이 모이지 않았어요' };
  }
  const answered = daysByStudent(events, ANSWERED);
  /** 가입 주가 기록 시작보다 이른 코호트는 잔존을 관찰하지 못했다. */
  const openFrom =
    mondayOf(first) >= first ? mondayOf(first) : shift(mondayOf(first), WEEK_DAYS);

  const byWeek = new Map<string, string[]>();
  for (const s of signups) {
    const w = mondayOf(s.day);
    if (w < openFrom) continue;
    byWeek.set(w, [...(byWeek.get(w) ?? []), s.userId]);
  }
  if (byWeek.size === 0) {
    return {
      rows: [],
      reason: `활동 기록은 ${first}부터예요. 그 뒤에 가입한 코호트부터 잔존을 볼 수 있어요`,
    };
  }

  const rows: CohortRow[] = [];
  for (const [week, members] of [...byWeek].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const cells: (number | null)[] = [];
    for (let n = 0; n < COHORT_WEEKS; n += 1) {
      const from = shift(week, n * WEEK_DAYS);
      const to = shift(from, WEEK_DAYS - 1);
      if (from > today) {
        cells.push(null); // 아직 오지 않은 주. 0%로 채우면 리텐션이 떨어진 것처럼 읽힌다.
        continue;
      }
      // 잔존은 **그 코호트 사람들**의 활동으로 센다. 전체 활동을 세면 W0이 100%를 넘는다.
      const stay = members.filter((id) => {
        const days = answered.get(id);
        if (!days) return false;
        for (const d of days) if (d >= from && d <= to && d <= today) return true;
        return false;
      }).length;
      cells.push(Math.round((stay / members.length) * 100));
    }
    rows.push({ label: week, size: members.length, cells });
  }
  return { rows: rows.reverse() }; // 최근 코호트를 위에 둔다
}

/* ────────────────────────── Activation ────────────────────────── */

/** 마일스톤을 쓸 수 있다고 보는 최소 예측력(배). `METRICS.activation.desc`가 말하는 기준이다. */
export const MILESTONE_MIN_RATIO = 2;
/** Activation 마일스톤의 기한(일). 가입 후 이 안에 학습을 완료해야 도달이다. */
export const ACTIVATION_DAYS = 7;

export interface Predictiveness {
  reached: number | null;
  missed: number | null;
  ratio: number | null;
  /** 판정할 수 없는 이유. */
  reason?: string;
}

/**
 * 마일스톤이 리텐션을 예측하는지 검증한다.
 * 도달군과 미도달군의 28일 잔존을 비교한다 — 2배 미만이면 마일스톤을 바꿔야 한다.
 *
 * **가입 시점의 행동을 실제로 기록한 사람만 본다.** 기록 시작 전에 가입한 사람은 가입 7일 안의
 * 완료가 있었는지 알 수 없어서 전원이 미도달로 잡힌다 — 그러면 예측력이 지어낸 값이 된다.
 */
export function activationPredictiveness(
  signups: readonly Signup[],
  events: readonly ActivityEvent[],
  activity: ActivityStats,
  today: string = todayISO(),
): Predictiveness {
  const blank = { reached: null, missed: null, ratio: null };
  const first = activity.firstDay;
  if (!first) return { ...blank, reason: '아직 활동 기록이 모이지 않았어요' };
  /** 가입 후 28일이 지났고, 그 28일을 우리가 기록한 사람만 판정할 수 있다. */
  const eligible = signups.filter(
    (s) => s.day >= first && daysBetween(s.day, today) >= CHURN_WINDOW_DAYS,
  );
  if (eligible.length === 0) {
    return {
      ...blank,
      reason: `활동 기록은 ${first}부터예요. 그 뒤에 가입해 ${CHURN_WINDOW_DAYS}일이 지난 계정이 생기면 판정할 수 있어요`,
    };
  }

  const answered = daysByStudent(events, ANSWERED);
  const completed = daysByStudent(events, COMPLETED);
  let reachedTotal = 0;
  let reachedStay = 0;
  let missedTotal = 0;
  let missedStay = 0;
  for (const s of eligible) {
    const done = completed.get(s.userId);
    const reached = !!done && [...done].some((d) => d >= s.day && d <= shift(s.day, ACTIVATION_DAYS));
    const days = answered.get(s.userId);
    // 잔존은 가입 4주째(22~28일)에 활성이 있었는지로 본다.
    const stayed =
      !!days &&
      [...days].some(
        (d) => d >= shift(s.day, CHURN_WINDOW_DAYS - 6) && d <= shift(s.day, CHURN_WINDOW_DAYS),
      );
    if (reached) {
      reachedTotal += 1;
      if (stayed) reachedStay += 1;
    } else {
      missedTotal += 1;
      if (stayed) missedStay += 1;
    }
  }
  const reached = reachedTotal ? (reachedStay / reachedTotal) * 100 : 0;
  const missed = missedTotal ? (missedStay / missedTotal) * 100 : 0;
  return { reached, missed, ratio: missed ? reached / missed : null };
}

/* ────────────────────────── 신규 가입 ────────────────────────── */

/** 완성된 주별 신규 가입 학생 수. 활동 기록과 무관하게 `profiles.created_at`이 답한다. */
export function signupWeekly(
  signups: readonly Signup[],
  weekLabels: readonly string[],
): number[] {
  return weekLabels.map((w) => {
    const end = shift(w, WEEK_DAYS - 1);
    return signups.filter((s) => s.day >= w && s.day <= end).length;
  });
}

/**
 * 최근 7일의 Activation율(%).
 *
 * 분모는 **기록 시작 뒤에 가입해 7일이 지난 학생**이다. 분모가 0이면 값이 없다(0%가 아니다).
 */
export function activationRate(
  signups: readonly Signup[],
  events: readonly ActivityEvent[],
  activity: ActivityStats,
  today: string = todayISO(),
): { value: number | null; reason?: string } {
  const first = activity.firstDay;
  if (!first) return { value: null, reason: '아직 활동 기록이 모이지 않았어요' };
  const cohort = signups.filter(
    (s) => s.day >= first && daysBetween(s.day, today) >= ACTIVATION_DAYS,
  );
  if (cohort.length === 0) {
    return {
      value: null,
      reason: `활동 기록은 ${first}부터예요. 그 뒤에 가입해 ${ACTIVATION_DAYS}일이 지난 계정이 생기면 값이 나와요`,
    };
  }
  const completed = daysByStudent(events, COMPLETED);
  const hit = cohort.filter((s) => {
    const done = completed.get(s.userId);
    return !!done && [...done].some((d) => d >= s.day && d <= shift(s.day, ACTIVATION_DAYS));
  }).length;
  return { value: Math.round((hit / cohort.length) * 100) };
}

/* ────────────────────────── 학원 ────────────────────────── */

/** 학원별 좌석 활용률. 낮은 순으로 준다 — 먼저 볼 곳이 위에 와야 한다. */
export interface AcademyUse {
  id: string;
  name: string;
  enrolled: number;
  contractSeats: number;
  usePct: number;
  /** 오늘까지 남은 갱신 일수. 음수면 지났다. 갱신일이 없으면 `null`. */
  renewalInDays: number | null;
  status: string;
  /** 최근 28일 활성 학생 수. 활동 기록이 없으면 `null`. */
  active28: number | null;
}

export function academyUse(
  academies: readonly AcademySummary[],
  today: string = todayISO(),
): AcademyUse[] {
  return academies
    .map((ac) => ({
      id: ac.id,
      name: ac.name,
      enrolled: ac.enrolled,
      contractSeats: ac.contractSeats,
      usePct: ac.contractSeats ? Math.round((ac.enrolled / ac.contractSeats) * 100) : 0,
      renewalInDays: ac.renewalDate ? daysBetween(today, ac.renewalDate) : null,
      status: ac.status === 'churned' ? '이탈' : '계약 중',
      active28: ac.active28,
    }))
    .sort((a, b) => a.usePct - b.usePct);
}

/** 계약이 살아 있는 학원의 좌석 활용률(%). 분모가 0이면 값이 없다. */
export function seatUsePct(academies: readonly AcademySummary[]): number | null {
  const active = academies.filter((a) => a.status === 'active');
  const seats = active.reduce((n, a) => n + a.contractSeats, 0);
  if (seats === 0) return null;
  return Math.round((active.reduce((n, a) => n + a.enrolled, 0) / seats) * 100);
}

/** 개인 구독 GRR. 해지만 반영하고 확장은 넣지 않으므로 100%를 넘을 수 없다. */
export function personalGrr(overview: AdminOverview): number {
  const start = overview.personalActive + overview.personalCanceled;
  return start > 0 ? Math.round((overview.personalActive / start) * 100) : 100;
}

/** 사람 1인당·활성 1인당 월 매출 추정. 분모가 없으면 값이 없다. */
export function arpu(revenue: RevenueEstimate, mau: number | null): number | null {
  if (!mau || mau <= 0) return null;
  return revenue.mrr / mau;
}

/* ────────────────────────── 조회 훅 ────────────────────────── */

/**
 * 서버 조회 하나를 화면에 붙인다.
 *
 * **로딩 중에 빈 값을 사실처럼 그리지 않는다.** 첫 렌더에서 `loading`을 내려 두면 화면이 0을
 * 실제 값으로 말한다 — `ContentProvider`가 같은 이유로 조회를 시작할 때 다시 `loading`으로
 * 돌린다. 여기서도 같은 순서다(nonce + 비동기 IIFE, 모든 setState는 콜백 안).
 *
 * `load`는 **모듈 수준 함수**여야 한다(참조가 매 렌더 바뀌면 효과가 끝없이 돈다).
 */
export interface Query<T> {
  data: T | null;
  loading: boolean;
  error?: string;
  reload: () => void;
}

function useQuery<T>(load: () => Promise<T>): Query<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await Promise.resolve();
      if (!alive) return;
      setLoading(true);
      setError(undefined);
      try {
        const next = await load();
        if (alive) setData(next);
      } catch (e) {
        if (alive) setError(errorMessage(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [load, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}

/** 운영자 개요 수치. */
export function useAdminOverview(): Query<AdminOverview> {
  return useQuery(adminOverview);
}

/** 매출 추정. 이탈한 학원은 세지 않는다(A-049). */
export function useRevenue(): Query<RevenueEstimate> {
  return useQuery(revenueEstimateNow);
}

function revenueEstimateNow(): Promise<RevenueEstimate> {
  return revenueEstimate(false);
}

/** 원장·선생님 수. */
export function useStaffCounts(): Query<StaffCounts> {
  return useQuery(staffCounts);
}

/** 학원 목록. */
export function useAcademies(): Query<AcademySummary[]> {
  return useQuery(listAcademies);
}

/** 활동 기록 창. 지표가 보는 기간 밖은 읽지 않는다. */
export const ACTIVITY_WEEKS = 26;

export interface ActivityData {
  events: ActivityEvent[];
  daily: DailyActivity[];
  signups: Signup[];
}

function loadActivity(): Promise<ActivityData> {
  const from = daysAgoISO(ACTIVITY_WEEKS * WEEK_DAYS);
  return Promise.all([activityEvents(from), dailyActivity(from), studentSignups()]).then(
    ([events, daily, signups]) => ({ events, daily, signups }),
  );
}

/** 활동 기록과 가입일. 지표 대부분이 여기 걸린다. */
export function useActivityData(): Query<ActivityData> {
  return useQuery(loadActivity);
}

/**
 * 화면 첫 줄에 밝히는 기준.
 *
 * 예전에는 `2026-07-28 기준`(합성 시간축)이었다. 이제 실제 오늘이고, 활동 기록이 언제부터
 * 쌓였는지를 함께 말한다 — 기간을 밝히지 않으면 작은 값이 하락으로 읽힌다.
 */
export function asOfLabel(overview: AdminOverview | null, activity?: ActivityStats): string {
  const day = overview?.asOf ?? todayISO();
  // 활동 기록을 읽지 않는 화면(학원 목록·학원 상세)은 그 이야기를 하지 않는다.
  if (!activity) return `${day} 기준`;
  if (!activity.firstDay) return `${day} 기준 · 활동 기록은 아직 없어요`;
  return `${day} 기준 · 활동 기록은 ${activity.firstDay}부터예요`;
}

/** 여러 조회의 로딩·오류를 하나로 묶는다. 화면이 게이트를 한 번만 쓰게. */
export function useCombined(...queries: Query<unknown>[]): { loading: boolean; error?: string } {
  const loading = queries.some((q) => q.loading);
  const error = queries.find((q) => q.error)?.error;
  return useMemo(() => ({ loading, error }), [loading, error]);
}
