/** 시간 유틸. 컴포넌트 순수성 린트 회피를 위해 여기로 분리. */
export function now(): number {
  return Date.now();
}
/**
 * 오늘 날짜(YYYY-MM-DD). **로컬 시간대 기준**이다.
 * `toISOString()`은 UTC라 KST 오전 9시 이전 풀이가 전날로 기록되고 마감 판정이 하루 어긋난다.
 */
export function todayISO(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * 표시용 날짜(`7월 24일`). ISO 문자열을 화면에 그대로 내보내지 않는다.
 * 학생·학부모·학원이 같은 형식을 쓰도록 한곳에 둔다. **앞의 0을 뗀다** — `08월 01일`을 만드는
 * 자리가 있었고(축하 문장) 같은 화면의 다른 날짜와 모양이 갈렸다.
 */
export function formatDate(iso: string): string {
  const [, m, d] = iso.split('-');
  /*
    **잘못된 문자열에는 원문을 돌려준다.** `Number('')`은 `NaN`이라 가드가 없으면
    `NaN월 NaN일`이 화면에 나간다. 이 가드는 `DayHeatmap`이 자기 사본(`dayLabel`)에 갖고 있던
    것을 여기로 옮긴 것이다 — 그 사본이 있던 이유가 이 한 줄이었다.
  */
  if (!m || !d) return iso;
  return `${Number(m)}월 ${Number(d)}일`;
}

/**
 * 표시용 소요 시간(`1시간 15분` · `12분 3초` · `48초`).
 *
 * **한 시간을 넘기면 분 단위로 접는다** — `75분 12초`는 학부모가 다시 계산해야 읽힌다.
 * 학부모 리포트·자세히 보기·학습 상세·학생 기록이 같은 값을 같은 형식으로 말하도록 한곳에 둔다
 * (예전에는 세 화면이 각자 `fmtTime`을 두었고 그중 하나만 시간 분기가 없어서, 같은 75분이
 * 상세에서 `1시간 15분`, 그 학습 상세에서 `75분 12초`였다 — D-178·A-147).
 *
 * **`learning.ts`가 아니라 여기 있는 이유**: 그 파일은 훅(`useStudentItems`)을 담아 react-native을
 * 끌어오고, 그러면 `scripts/verify-*.ts`가 이 모듈을 지나 상수 하나를 가져올 수 없다(실측:
 * `tsx`가 `react-native/index.js`를 변환하지 못한다). 이 파일은 `Date`만 쓴다.
 * `learning.ts`는 기존 import 경로를 지키기 위해 다시 내보낸다.
 */
export function formatDuration(sec: number): string {
  if (sec >= 3600) return `${Math.floor(sec / 3600)}시간 ${Math.floor((sec % 3600) / 60)}분`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

/**
 * `YYYY-MM-DD`를 로컬 자정으로. 잘못된 문자열이면 `null`이다.
 *
 * **`?? 1` 같은 기본값 가드는 효과가 없다** — 숫자가 아닌 조각은 `undefined`가 아니라 `NaN`이
 * 되고 `NaN ?? 1`은 `NaN`이다. 가드가 있는 것처럼 보이는 것이 없는 것보다 나쁘다.
 * `src/features/learning.ts`의 `dueLabel`이 같은 방식으로 막는다.
 */
function atLocalMidnight(iso: string): Date | null {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/**
 * `YYYY-MM-DD`에서 며칠 뒤/전. 잘못된 문자열이면 그대로 돌려준다.
 *
 * `Date`의 `setDate`는 달을 넘겨도 알아서 넘어간다. `todayISO()`와 같은 로컬 시간대 기준이다 —
 * UTC로 계산하면 KST 오전 9시 이전에 하루가 어긋난다.
 *
 * **같은 계산이 `src/features/adminMetrics.ts`에도 있다**(`shift`·`daysBetween`) — 그쪽은 운영자
 * 지표 전용이고 이 파일이 그 계산의 집이다. 여섯 번째 사본을 만들기 전에 둘 중 하나로 모은다.
 */
export function addDaysISO(iso: string, days: number): string {
  const at = atLocalMidnight(iso);
  if (!at) return iso;
  at.setDate(at.getDate() + days);
  const mm = `${at.getMonth() + 1}`.padStart(2, '0');
  const dd = `${at.getDate()}`.padStart(2, '0');
  return `${at.getFullYear()}-${mm}-${dd}`;
}

/** `a`에서 `b`까지 며칠. 음수면 `b`가 과거다. 잘못된 문자열이면 0이다. */
export function daysBetweenISO(a: string, b: string): number {
  const from = atLocalMidnight(a);
  const to = atLocalMidnight(b);
  if (!from || !to) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}
