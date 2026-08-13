/**
 * 합성 활동 데이터의 시간 축.
 *
 * **왜 실제 시계를 쓰지 않는가**: 시드 기록(`attempts.ts`·`fixtures.ts`)이 고정 날짜에 맞춰져
 * 있다. 지표를 실제 시계로 계산하면 12주 추이가 매주 밀리고 코호트 마지막 행이 조용히
 * 비어 간다 — 화면이 매일 조금씩 다른 말을 하게 된다. 그래서 **합성 데이터와 그 위에서
 * 계산하는 운영자 지표는 이 기준일 하나만 본다.**
 *
 * 학생·학부모·학원 화면은 그대로 `todayISO()`(실제 시계)를 쓴다 — 마감 판정은 오늘이 진짜
 * 오늘이어야 하기 때문이다. 두 시간 축이 다르다는 사실을 운영자 화면 첫 줄에 밝힌다.
 *
 * 실제 사용자 데이터가 아니다(마스터 플랜 5절).
 */

/** 합성 데이터와 운영자 지표가 쓰는 '오늘'. 시드 기록과 같은 날이다. */
export const DATA_ANCHOR = '2026-07-28';

/** 만들어 두는 기간(주). 12주 추이 + 코호트 8주를 담는 최소 폭이다. */
export const WINDOW_WEEKS = 26;

/** 하루 밀리초. 날짜 계산에만 쓴다. */
const DAY = 86_400_000;

/** `WINDOW_WEEKS` 전 월요일. 일 인덱스 0이 이 날이다. */
export const WINDOW_START = (() => {
  const [y, m, d] = DATA_ANCHOR.split('-').map(Number);
  const at = new Date(y, m - 1, d);
  // 기준일이 속한 주의 월요일로 맞춘 뒤 그만큼 되돌린다(주 단위 집계가 어긋나지 않게).
  const back = (at.getDay() + 6) % 7;
  at.setDate(at.getDate() - back - (WINDOW_WEEKS - 1) * 7);
  return isoOf(at);
})();

/** `Date` → `YYYY-MM-DD`(로컬). */
function isoOf(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 일 인덱스 → `YYYY-MM-DD`. 인덱스 0은 `WINDOW_START`다. */
export function dateOfIndex(index: number): string {
  const [y, m, d] = WINDOW_START.split('-').map(Number);
  return isoOf(new Date(new Date(y, m - 1, d).getTime() + index * DAY));
}

/** `YYYY-MM-DD` → 일 인덱스. 창 밖이면 음수 또는 `TOTAL_DAYS` 이상이 나온다. */
export function indexOfDate(iso: string): number {
  const [y1, m1, d1] = WINDOW_START.split('-').map(Number);
  const [y2, m2, d2] = iso.split('-').map(Number);
  return Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / DAY);
}

/** 창 전체 일수. */
export const TOTAL_DAYS = WINDOW_WEEKS * 7;

/** 기준일의 일 인덱스. 지표 계산의 오른쪽 끝이다. */
export const ANCHOR_INDEX = indexOfDate(DATA_ANCHOR);

/**
 * 주차별 활동 가중치.
 *
 * **가정한 학사 일정이다. 실제 교육청 일정이 아니다.** 지표 사전에서 이 사실을 밝힌다.
 * 계절성이 없으면 스파크라인이 평평해지고 이벤트 마커가 뜻을 잃는다 — 학습 제품은 계절성이
 * 매우 강해서, 계절성 없는 합성 데이터로 만든 화면은 실제 운영에서 통하지 않는다.
 *
 * `WINDOW_START`(주 0)부터 `WINDOW_WEEKS - 1`까지. 1.0이 평상시다.
 */
export const seasonWeight: readonly number[] = (() => {
  const w: number[] = [];
  for (let i = 0; i < WINDOW_WEEKS; i += 1) {
    const month = Number(weekStart(i).slice(5, 7));
    // 방학(1·2·8월)은 학습이 줄고, 시험을 앞둔 달(4·6·10·11월)은 늘어난다.
    const base =
      month === 1 || month === 2 || month === 8
        ? 0.55
        : month === 3 || month === 9
          ? 1.15
          : month === 4 || month === 6 || month === 10 || month === 11
            ? 1.35
            : 1.0;
    w.push(base);
  }
  return w;
})();

/** 주차 → 그 주 월요일(`YYYY-MM-DD`). */
export function weekStart(week: number): string {
  return dateOfIndex(week * 7);
}

/** 그 날이 속한 주차. 창 밖이면 음수 또는 `WINDOW_WEEKS` 이상. */
export function weekOfIndex(index: number): number {
  return Math.floor(index / 7);
}

export type EventKind = '모평' | '시험' | '방학' | '정책';

/**
 * 스파크라인 아래에 두는 이벤트 마커.
 *
 * 이벤트 없이 추이만 보면 전부 오독한다 — 방학에 활성이 떨어진 것을 제품 문제로 읽는다.
 * `모평`·`시험`·`방학`은 **가정한 일정**이고, `정책`은 실제로 이 레포에서 일어난 변경이다.
 */
export interface CalendarEvent {
  week: number;
  label: string;
  kind: EventKind;
}

export const EVENTS: readonly CalendarEvent[] = (() => {
  const out: CalendarEvent[] = [];
  for (let i = 0; i < WINDOW_WEEKS; i += 1) {
    const iso = weekStart(i);
    const month = Number(iso.slice(5, 7));
    const day = Number(iso.slice(8, 10));
    // 3·6·9월 첫째 주를 모평 주로 가정한다.
    if ((month === 3 || month === 6 || month === 9) && day <= 7) {
      out.push({ week: i, label: `${month}월 모평`, kind: '모평' });
    }
    // 4월·10월 셋째 주를 중간고사, 7월·12월 첫째 주를 기말고사로 가정한다.
    if ((month === 4 || month === 10) && day >= 15 && day <= 21) {
      out.push({ week: i, label: '중간고사', kind: '시험' });
    }
    if ((month === 7 || month === 12) && day <= 7) {
      out.push({ week: i, label: '기말고사', kind: '시험' });
    }
    if ((month === 1 || month === 8) && day <= 7) {
      out.push({ week: i, label: '방학 시작', kind: '방학' });
    }
  }
  return out;
})();
