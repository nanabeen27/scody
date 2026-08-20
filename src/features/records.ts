import type { PrevBests, StudentRecords } from '@/repo/records';
/*
  **소요 시간 형식은 앱에 하나다.** 처음에는 이 파일에 `formatDuration`을 따로 두었는데, 같은
  함수가 이미 있었다 — D-178이 학부모 화면 세 벌을 그 하나로 모았고 A-147이 학생 화면 둘의
  `fmtTime`을 그쪽으로 옮기라고 적어 둔 자리다. 사본을 하나 더 만들면 같은 4,512초가 화면마다
  다른 글자가 된다.

  가져오는 곳은 `clock.ts`다(`learning.ts`가 아니다). 그 파일은 훅을 담아 react-native을
  끌어오고, 그러면 `scripts/verify-records.ts`가 이 모듈에서 `STUDY_DAY_QUESTIONS`를 가져올 수
  없다 — 실측으로 `tsx`가 `react-native/index.js`에서 멈췄다.
*/
import { formatDate, formatDuration } from './clock';

/**
 * 기록을 화면의 문장으로 바꾼다. **여기에는 계산이 아니라 판단이 있다.**
 *
 * 누적·연속·최고는 전부 서버가 준다(`rpc_student_records`). 이 파일이 정하는 것은
 * **무엇을 축하할지**와 **어떤 문장으로 말할지**다 — 그 둘은 제품의 결정이라 서버에 두면
 * 문구를 고칠 때마다 마이그레이션이 생긴다.
 *
 * ## 조사에서 가져온 판단
 *
 * - **자기 기준 비교만 쓴다.** 전체 학생 순위는 두지 않는다. 숙달 목표 지향(자기 기준)은
 *   지속에 기여하고 성과 목표 지향(사회 비교)은 하위권 학습자를 이탈시킨다는 것이 교육
 *   gamification 문헌의 반복된 결과다. 초기 버전은 `과거의 나`만 상대한다.
 * - **보상이 아니라 정보로 준다.** 포인트·화폐·아바타를 두지 않는다. 외적 보상은 내재
 *   동기를 밀어낼 수 있고(overjustification), 여기서 주려는 것은 "내가 쌓은 것이 보인다"는
 *   사실 자체다.
 * - **다음 목표는 가깝고 구체적이어야 한다.** 목표 설정 이론의 근접 목표다 — 그래서 milestone은
 *   달성한 것보다 **다가오는 것**을 먼저 보여 주고 남은 수를 함께 말한다.
 * - **오답을 되돌아본 것이 가장 큰 성취다.** 인출 연습과 분산 복습이 이 레포 복습 스케줄의
 *   근거이고(D-176), 그 사다리를 끝까지 오른 오답이 `익힘`이다. milestone의 한 축을 그것으로 둔다.
 */

/**
 * 학습일로 인정되는 최소 채점 문항 수. **검증 스크립트의 기대값이다.**
 *
 * 화면은 이 상수를 읽지 않는다 — 서버가 응답에 실어 보내는 `records.studyDayQuestions`를 쓴다.
 * 같은 종류의 규칙인 `streak.weekGoal`이 이미 그 방식이었는데 이 값만 클라이언트 상수여서
 * 규칙 하나가 두 진실을 가졌다.
 *
 * 여기 남는 이유는 `scripts/verify-records.ts`가 **뷰의 판정과 대조**하기 위해서다 — 서버가
 * 판정과 응답에서 다른 수를 쓰면 그 단정이 잡는다.
 * (`src/features/review.ts`의 `GRADUATE_STREAK`가 같은 자리에 있는 선례다.)
 */
export const STUDY_DAY_QUESTIONS = 3;

/**
 * 학습 시간 한 번 전송의 상한(초). **DB의 `rpc_log_study_time`의 `c_flush_cap`과 같은 값이어야
 * 한다**(그리고 `study_activity.active_sec` 제약의 옛 값이었다).
 *
 * 이 값이 TS 쪽 세 자리에 흩어져 있었다 — `scripts/verify-records.ts`의 `FLUSH_CAP` ·
 * `scripts/gen-seed.ts`의 `TIME_CHUNK` · 그리고 그 스크립트들 안의 인라인 `900`. 상한이 바뀌면
 * SQL 하나에 TS 여러 자리를 함께 고쳐야 했고, seed 쪽을 빠뜨리면 `check` 위반으로 실패한다.
 *
 * **`activeTime.ts`가 아니라 여기 있는 이유**: 그 파일은 `react-native`을 끌어와 스크립트가
 * 가져올 수 없다(`STUDY_DAY_QUESTIONS`가 같은 이유로 이 파일에 있다).
 */
export const STUDY_TIME_FLUSH_CAP_SEC = 900;

/**
 * 하루에 셀 수 있는 학습 시간의 상한(초). **`rpc_log_study_time`의 `c_day_cap`과 같은 값이어야
 * 한다**(그리고 `study_activity.active_sec` 제약의 현재 값이다 — 0048이 접은 행을 담기 위해
 * 한 행 상한을 이 값으로 올렸다).
 */
export const STUDY_TIME_DAY_CAP_SEC = 8 * 3600;

/**
 * **측정 방식 고지.** 학생용과 학부모용 두 가지다.
 *
 * `학습 시간 3시간 20분`·`학습일 42일`은 사람이 자기(또는 자녀)를 판단하는 근거가 되므로, 그
 * 값이 **무엇을 세고 무엇을 세지 않는지** 화면이 말해야 한다 — 밝히지 않으면 근거 없는 수치다
 * (`CLAUDE.md`가 금지하는 자리다). 예전에는 이 고지가 **학부모 화면에만** 있었다: 행동을
 * 바꿔야 하는 쪽은 학생인데 규칙은 학생만 몰랐다.
 *
 * **문구를 화면에 적지 않고 여기서 가져간다.** 두 화면이 같은 규칙을 다른 말로 설명하면 어느
 * 쪽이 사실인지 알 수 없다(`src/features/review.ts`의 `ACADEMY_MEMO_NOTICE`가 같은 자리다).
 *
 * 두 문장의 차이는 담는 양이다: 학부모는 이 숫자로 자녀를 판단하므로 **채점의 주체**(서버)까지
 * 밝히고, 학생 쪽은 자기가 할 일에 필요한 두 가지만 말한다. **한쪽만 고치지 않는다.**
 *
 * 학습일 기준은 **서버가 준 값**이다(`studyDayQuestions`) — 화면이 상수를 읽으면 DB 판정과
 * 갈릴 수 있다.
 */
export function studyMethodNotice(
  audience: 'student' | 'parent',
  records: StudentRecords,
): string {
  const n = records.studyDayQuestions;
  if (audience === 'parent') {
    return (
      '학습 시간은 문제를 풀거나 오답을 다시 본 시간만 세요. 화면을 열어 둔 시간이나 다른 앱을 ' +
      '보는 동안은 세지 않아요. 문항 수와 정답 여부는 서버가 채점한 결과예요. ' +
      `하루에 ${n}문항을 채점받은 날을 학습일로 세요.`
    );
  }
  return (
    '학습 시간은 문제를 풀거나 오답을 다시 본 시간만 세요. 화면을 열어 둔 시간은 세지 않아요. ' +
    `하루에 ${n}문항을 채점받으면 그 날이 학습일이 돼요.`
  );
}

// ── 형식 ─────────────────────────────────────────────────────────────────────

/** 천 단위 구분. 누적 문항이 네 자리를 넘으면 읽히지 않는다. */
export function formatCount(n: number): string {
  return Math.round(n).toLocaleString('ko-KR');
}

// ── milestone ────────────────────────────────────────────────────────────────

export type MilestoneKind = 'streak' | 'questions' | 'mastered' | 'studyDays';

export interface Milestone {
  kind: MilestoneKind;
  threshold: number;
  /** 화면에 쓰는 이름. */
  label: string;
  /** 지금 값. */
  value: number;
  achieved: boolean;
  /** 남은 수. 달성했으면 0이다. */
  remaining: number;
}

/**
 * 기준선. **네 축만 둔다.**
 *
 * 축을 늘리면 어느 것도 가깝지 않은 상태가 생긴다 — 학생 화면은 `다가오는 것` 셋만 그리고,
 * 넷 이상이면 그 목록이 무엇을 고른 것인지 설명할 수 없다.
 *
 * 값은 실제로 닿을 수 있는 간격으로 둔다. `익힘`은 서로 다른 날 세 번 맞혀야 하나가 되므로
 * (D-176) 문항 수와 같은 자릿수를 쓰면 첫 칸조차 몇 달이 걸린다.
 */
const THRESHOLDS: Record<MilestoneKind, readonly number[]> = {
  streak: [7, 30, 50, 100],
  questions: [100, 500, 1_000, 5_000],
  mastered: [5, 20, 50, 100],
  studyDays: [30, 100, 365],
};

/**
 * 축 이름. **기준선이 들어 있지 않다.**
 *
 * `KIND_LABEL`은 목록에서 쓰는 이름이라 수를 품는다(`100문항 풀이`). 축하 블록은 큰 숫자로 수를
 * 따로 말하므로 그 라벨을 쓰면 같은 수가 두 번이 된다.
 */
export const MILESTONE_AXIS: Record<MilestoneKind, string> = {
  streak: '연속 학습',
  questions: '문항 풀이',
  mastered: '오답 익힘',
  studyDays: '학습일',
};

/**
 * 축의 단위를 붙인다. **`문항`을 `개`로 세지 않는다** — 앱 전체가 문항을 `N문항`으로 센다.
 */
export function milestoneUnit(kind: MilestoneKind, n: number): string {
  switch (kind) {
    case 'streak':
    case 'studyDays':
      return `${formatCount(n)}일`;
    case 'questions':
      return `${formatCount(n)}문항`;
    case 'mastered':
      return `${formatCount(n)}개`;
  }
}

const KIND_LABEL: Record<MilestoneKind, (n: number) => string> = {
  streak: (n) => `${n}일 연속 학습`,
  questions: (n) => `${formatCount(n)}문항 풀이`,
  mastered: (n) => `오답 ${formatCount(n)}개 익힘`,
  studyDays: (n) => `${formatCount(n)}일 학습`,
};

function valueOf(kind: MilestoneKind, records: StudentRecords): number {
  switch (kind) {
    case 'streak':
      return records.streak.current;
    case 'questions':
      return records.totals.solvedQuestions;
    case 'mastered':
      return records.totals.notesMastered;
    case 'studyDays':
      return records.totals.studyDays;
  }
}

/** 오늘 늘어난 양. `지금 값 - 오늘분 < 기준선 <= 지금 값`이면 오늘 넘었다. */
function todayGainOf(kind: MilestoneKind, records: StudentRecords): number {
  switch (kind) {
    case 'streak':
      // 오늘이 학습일이 되면서 연속이 1 늘었다. 아니면 오늘 늘어난 것이 없다.
      return records.today.isStudyDay ? 1 : 0;
    case 'questions':
      return records.today.solvedQuestions;
    case 'mastered':
      return records.today.notesMastered;
    case 'studyDays':
      return records.today.isStudyDay ? 1 : 0;
  }
}

const KINDS = Object.keys(THRESHOLDS) as MilestoneKind[];

/** 축과 기준선 하나로 `Milestone`을 만든다. 세 선택자가 이것만 부른다. */
function milestoneAt(kind: MilestoneKind, threshold: number, value: number): Milestone {
  return {
    kind,
    threshold,
    label: KIND_LABEL[kind](threshold),
    value,
    achieved: value >= threshold,
    remaining: Math.max(0, threshold - value),
  };
}

/**
 * 다가오는 milestone. **축마다 하나씩, 가까운 순으로.**
 *
 * 한 축의 여러 칸을 함께 보여 주면(`100문항`·`500문항`·`1,000문항`) 목록이 같은 말의 반복이
 * 된다. 축마다 아직 넘지 않은 첫 칸 하나만 남기고 남은 수가 적은 것부터 세운다.
 *
 * **`THRESHOLDS`가 축마다 오름차순이라 `find` 하나가 답이다.** 예전에는 15개를 다 만든 뒤
 * `Map`으로 축별 최솟값을 다시 골랐는데, 그 묶기가 필요 없는 일이었다.
 */
export function upcomingMilestones(records: StudentRecords, limit = 3): Milestone[] {
  return KINDS.flatMap((kind) => {
    const value = valueOf(kind, records);
    const next = THRESHOLDS[kind].find((t) => value < t);
    return next == null ? [] : [milestoneAt(kind, next, value)];
  })
    .sort((a, b) => a.remaining - b.remaining)
    .slice(0, limit);
}

/**
 * 이미 넘은 milestone. **축마다 가장 높은 칸 하나만** 남긴다.
 *
 * `100문항`과 `500문항`을 함께 세우면 같은 사실이 두 줄이 된다. 그리고 **언제 넘었는지는 알 수
 * 없다** — 달성 시점을 저장하지 않기로 했으므로(파생값만 쓴다) `최근 순`으로 세울 근거가 없다.
 * 그래서 순서는 시간이 아니라 크기다.
 *
 * 오름차순 배열에서 넘은 것의 **마지막**이 그 축의 답이다(위 `upcoming`의 거울상).
 */
export function achievedMilestones(records: StudentRecords): Milestone[] {
  return KINDS.flatMap((kind) => {
    const value = valueOf(kind, records);
    const top = THRESHOLDS[kind].filter((t) => value >= t).at(-1);
    return top == null ? [] : [milestoneAt(kind, top, value)];
  }).sort((a, b) => b.threshold - a.threshold);
}

/**
 * **오늘 넘은** milestone. 학습을 끝낸 순간에만 축하한다.
 *
 * 저장된 `축하했음` 표시를 두지 않는다 — 그 상태는 갈리고, 갈리면 축하가 두 번 나오거나
 * 아예 나오지 않는다. `지금 값 - 오늘분 < 기준선 <= 지금 값`은 오늘 안에서 몇 번 계산해도
 * 같은 답이다.
 *
 * **여기서는 전 칸을 본다** — 하루에 두 칸을 넘을 수 있다(0문항에서 600문항이면 100과 500 둘).
 */
export function milestonesCrossedToday(records: StudentRecords): Milestone[] {
  return KINDS.flatMap((kind) => {
    const gain = todayGainOf(kind, records);
    if (gain <= 0) return [];
    const value = valueOf(kind, records);
    return THRESHOLDS[kind]
      .filter((t) => value >= t && value - gain < t)
      .map((t) => milestoneAt(kind, t, value));
  });
}

/**
 * milestone 아래에 붙는 근거 한 줄.
 *
 * **축하 문장에 사실을 함께 둔다.** `30일 연속 학습 달성`만 있으면 무엇을 이룬 것인지 숫자가
 * 없고, 그러면 근거 없는 칭찬처럼 읽힌다(`CLAUDE.md`가 금지하는 자리다).
 */
export function milestoneDetail(m: Milestone, records: StudentRecords): string {
  switch (m.kind) {
    case 'streak':
      return `그동안 ${formatCount(records.totals.solvedQuestions)}문항을 풀었어요.`;
    case 'questions':
      return `${formatCount(records.totals.studyDays)}일 동안 쌓은 기록이에요.`;
    case 'mastered':
      return '틀린 문제를 다시 풀어서 익힌 수예요.';
    case 'studyDays':
      /*
        **날짜 형식은 앱에 하나다.** 예전에는 `slice(5).replace('-', '월 ')`로 잘라서
        `08월 01일에 시작했어요.`가 됐다 — 같은 화면의 잔디 캡션은 `8월 1일`이라 한 화면에 두
        모양이 섰다. `formatDate`가 앞의 0을 떼는 그 함수다(`clock.ts` — `formatDuration`과 같은
        이유로 거기 있다).
      */
      return records.totals.firstDay ? `${formatDate(records.totals.firstDay)}에 시작했어요.` : '';
  }
}

// ── 오늘 한 줄 ───────────────────────────────────────────────────────────────

/**
 * 오늘 한 일을 한 줄로. **0인 항목은 빼고 말한다.**
 *
 * 항목을 늘 세 개로 두면 오답 복습을 하지 않은 날에 `오답 0개 해결`이 붙는다 — 하지 않은 일을
 * 굳이 세는 문장이고, 기록 화면의 목적과 반대다.
 */
export function todayLine(records: StudentRecords): string {
  const t = records.today;
  const parts: string[] = [];
  if (t.solvedQuestions > 0) parts.push(`${formatCount(t.solvedQuestions)}문항`);
  if (t.activeSec > 0) parts.push(formatDuration(t.activeSec));
  if (t.reviewsCorrect > 0) parts.push(`오답 ${formatCount(t.reviewsCorrect)}개 해결`);
  else if (t.reviewsDone > 0) parts.push(`오답 ${formatCount(t.reviewsDone)}개 복습`);
  return parts.join(' · ');
}

/**
 * 연속 학습 상태 한 줄. **연속 일수를 이 문장에 넣지 않는다.**
 *
 * **오늘이 아직 학습일이 아니면 그 사실을 말한다.** `오늘도 공부했어요`라고만 하면 오늘도 이미
 * 한 것처럼 읽히고, 그러면 그 문장이 학생에게 거짓을 말한다.
 *
 * **수는 값의 자리(`Row`의 `trailing`)가 말한다.** 예전에는 `17일째 공부 중`을 돌려주어
 * 기록 화면·결과 화면에서 같은 수가 한 줄에 두 번 섰다(`17일째 공부 중` + `17일`). 그리고
 * `current === 0`이면 문장에는 수가 없는데 `trailing`은 `0일`이었다 — 뜻이 없는 수치다
 * (`DESIGN.md` §13). 지금은 문장이 **조건**만, `trailing`이 **수**만 말하고 연속이 0이면
 * 부르는 쪽이 `trailing`을 그리지 않는다.
 *
 * 홈(`app/student/index.tsx`)에는 값의 자리가 없어서 그 화면이 앞에 `N일 연속 ·`을 붙인다 —
 * 그래도 수는 한 번이다.
 */
export function streakLine(records: StudentRecords): string {
  const { current } = records.streak;
  const n = records.studyDayQuestions;
  if (current === 0) return `오늘 ${n}문항을 풀면 기록이 시작돼요`;
  if (records.today.isStudyDay) return '오늘도 공부했어요';
  return `오늘 ${n}문항을 풀면 이어져요`;
}

/**
 * 기록 보호 한 줄. **얻는 방법과 쓰인 사실을 함께 말한다.**
 *
 * 예전에는 얻는 방법만 있었다(`한 주에 5일을 채우면 생기고 빠진 날을 메워요`). 그래서 어제
 * 공부하지 않았는데 연속이 그대로인 학생은 그 숫자를 틀린 것으로 읽었다 — 잔디에는 빈 칸이 있고
 * 연속은 줄지 않았는데 둘을 잇는 문장이 없었다.
 *
 * **경고를 두지 않는다.** `다음에 빠지면 끊겨요`는 재촉이다(`CLAUDE.md`). 사실만 적는다.
 */
export function protectionLine(records: StudentRecords): string {
  const { weekGoal, protectedDays } = records.streak;
  const earn = `한 주에 ${weekGoal}일을 채우면 생겨요`;
  if (protectedDays.length === 0) return `${earn} · 빠진 날을 메워요`;
  const last = protectedDays[protectedDays.length - 1];
  /*
    여러 날을 지켰으면 개수를 함께 말한다 — 날짜만 적으면 그 하루만 메운 것으로 읽힌다.
    목록을 다 보여 주지는 않는다(한 줄이 목록이 된다).
  */
  const used =
    protectedDays.length === 1
      ? `${formatDate(last)}을 메웠어요`
      : `${formatDate(last)}까지 ${formatCount(protectedDays.length)}일을 메웠어요`;
  return `${used} · ${earn}`;
}

// ── 새 기록 ──────────────────────────────────────────────────────────────────

export type RecordKey = keyof PrevBests;

export interface NewRecord {
  key: RecordKey;
  /** 무엇의 기록인가. */
  label: string;
  /** 지난 최고. 처음 세우는 기록이면 0이다. */
  from: number;
  /** 오늘(이번 주) 값. */
  to: number;
  /** 숫자를 문장에 넣는 방법. */
  format: (n: number) => string;
}

/**
 * 오늘 갱신한 개인 최고 기록.
 *
 * **`>`로 판정한다.** 같은 값은 갱신이 아니다 — 최고 기록과 같은 날을 `새로운 기록`이라고
 * 부르면 그 말이 헐거워진다.
 *
 * **0에서 시작하는 첫 기록도 기록이다.** 첫날 12문항을 푼 학생에게 `하루 최다 12문항`은 사실이고,
 * 그것을 감추면 기록이 쌓이기 시작한 것을 알 수 없다. 다만 `0 → 0`은 기록이 아니다.
 */
export function newRecordsToday(records: StudentRecords): NewRecord[] {
  const out: NewRecord[] = [];
  const push = (
    key: RecordKey,
    label: string,
    to: number,
    from: number,
    format: (n: number) => string,
  ) => {
    if (to > 0 && to > from) out.push({ key, label, from, to, format });
  };
  push(
    'questions',
    '하루 최다 풀이',
    records.today.solvedQuestions,
    records.prevBests.questions,
    (n) => `${formatCount(n)}문항`,
  );
  push(
    'reviewsCorrect',
    '하루 최다 오답 해결',
    records.today.reviewsCorrect,
    records.prevBests.reviewsCorrect,
    (n) => `${formatCount(n)}개`,
  );
  push(
    'activeSec',
    '하루 최다 학습 시간',
    records.today.activeSec,
    records.prevBests.activeSec,
    formatDuration,
  );
  push(
    'week',
    '주간 최다 풀이',
    records.week.solvedQuestions,
    records.prevBests.week,
    (n) => `${formatCount(n)}문항`,
  );
  return out;
}

/**
 * 목적격 조사(`을`/`를`). **문장에 데이터를 끼울 때는 조사를 계산한다**(`DESIGN.md` §19).
 *
 * 축하 문장이 `지난 최고 8개을 넘었어요.`·`48초을 넘었어요.`를 만들고 있었다 — 네 기록의 형식
 * 중 둘(`N개`·`N초`)이 받침이 없다. `ChildReport`의 `subjectParticle`이 주격에 대해 같은 계산을
 * 한다(그쪽은 `이/가`).
 */
export function objectParticle(word: string): '을' | '를' {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  // 한글 음절이 아니면(숫자·영문으로 끝나면) 받침을 셀 수 없다 — 더 흔한 쪽을 쓴다.
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return '를';
  return (code - 0xac00) % 28 === 0 ? '를' : '을';
}

// ── 과거의 나와 비교 ─────────────────────────────────────────────────────────

export interface Change {
  now: number;
  before: number;
  /** 변화율(%). 지난 값이 0이면 비교할 수 없어 `null`이다. */
  percent: number | null;
}

/** 나눌 수 없는 비교를 `null`로 남긴다 — `0 → 12`를 `+∞%`나 `+1200%`로 말하지 않는다. */
export function changeOf(now: number, before: number): Change {
  return {
    now,
    before,
    percent: before > 0 ? Math.round(((now - before) / before) * 100) : null,
  };
}

/**
 * 부호를 붙인 변화율. 비교할 수 없으면 `null`이다.
 *
 * **문장을 만들지 않는다.** 예전에는 `percent === 0`에 `'지난주와 같아요'`를 박아 돌려줬는데,
 * 이 함수는 지난주 비교와 **최근 4주 평균 비교** 두 곳에서 쓰인다 — 그래서 이번 주 문항 수가
 * 4주 평균과 같아지는 순간 `최근 4주 평균 대비` 줄의 값이 `지난주와 같아요`가 됐다. 제목과 값이
 * 다른 기준을 말한 것이다. 게다가 부르는 쪽이 그 문자열을 `if (pct === '지난주와 같아요')`로
 * 비교해 제어 흐름에 쓰고 있어서, 문구를 고치면 조용히 깨졌다.
 *
 * 지금은 비율만 돌려주고 **기준 이름이 붙는 문장은 부르는 쪽이 만든다**(§20의 같은 규칙).
 */
export function percentLabel(change: Change): string | null {
  if (change.percent == null) return null;
  if (change.percent === 0) return '0%';
  return change.percent > 0 ? `+${change.percent}%` : `${change.percent}%`;
}

/**
 * 끝난 주의 주당 푼 문항. **이번 주는 넣지 않는다.**
 *
 * `DESIGN.md` §18-0이 학원 추이선에 대해 정한 것과 같은 규칙이다 — 진행 중인 주를 넣으면 마지막
 * 점이 늘 바닥으로 떨어져 `무너졌다`로 읽힌다(실측 근거가 그 절에 있다). 월요일 아침이면 그 점이
 * 0이다.
 *
 * 점이 두 개 미만이면 선이 되지 않으므로 빈 배열을 준다 — 화면이 그때 아무것도 그리지 않는다.
 */
export function completedWeekTrend(records: StudentRecords): number[] {
  const done = records.weeks.filter((w) => w.monday !== records.week.monday);
  return done.length >= 2 ? done.map((w) => w.solvedQuestions) : [];
}

/**
 * 최근 창의 꾸준함. **화면이 `A일 중 B일 · N%`를 그대로 쓴다.**
 *
 * 예전에는 비율만 돌려줬고, 화면은 그 옆 부제에서 `days.length`와 `filter(isStudyDay).length`를
 * **다시 세었다** — 같은 두 수를 한 줄에서 두 번 센 셈이고 그 `filter` 표현이 세 파일에 같은
 * 글자로 있었다. 분모 규칙이 바뀌면 비율은 함수가 따라가고 부제는 따라가지 않는 자리였다.
 *
 * 기간을 고정한다 — 기록이 짧은 학생의 분모를 줄이면 이틀 공부하고 100%가 나온다.
 */
export function consistency(records: StudentRecords): {
  days: number;
  studied: number;
  percent: number;
} {
  const days = records.days.length;
  const studied = records.days.filter((d) => d.isStudyDay).length;
  return { days, studied, percent: days > 0 ? Math.round((studied / days) * 100) : 0 };
}

/**
 * 지난주 **같은 시점까지**와 비교한 한 줄. **학생·학부모 화면이 같은 문장을 쓴다.**
 *
 * 예전에는 두 화면이 각자 이 함수를 갖고 있었고, `StudyProof` 쪽 주석은 사본을 `말투가 다르다 —
 * 그쪽은 학생에게, 이쪽은 학부모에게 말한다`로 정당화했다. **그 정당화가 사실이 아니었다** —
 * 네 갈래의 문자열이 글자까지 같았다. 근거만 적힌 사본은 한쪽만 고쳐지는 것이 시간 문제다
 * (`formatDuration`이 세 화면에서 갈렸던 경로다). 정말 말투를 갈라야 하는 날이 오면 그때 인자
 * 하나로 가른다.
 *
 * **완성된 주와 비교하지 않는다.** `lastWeek`(7일)를 기준으로 쓰면 이번 주 3일치를 지난주
 * 7일치와 나누게 되어 월요일 아침에 네 줄이 동시에 `-100%`가 된다 — 이 레포는 같은 결함을
 * 학원 추이선에서 이미 고쳤다(§18-0). 서버가 `lastWeekToDate`로 같은 길이의 창을 준다(0047).
 *
 * **변화율을 만들 수 없으면 지난 값을 그대로 말한다** — `0 → 12`를 `+1200%`로 적으면 숫자가
 * 뜻을 잃고, 첫 주에는 늘 그 상태다.
 */
export function weekToDateLine(
  now: number,
  before: number,
  format: (n: number) => string,
): string {
  if (before === 0) {
    return now > 0 ? '지난주 이맘때는 기록이 없었어요' : '지난주 이맘때도 기록이 없었어요';
  }
  const change = changeOf(now, before);
  if (change.percent === 0) return '지난주 이맘때와 같아요';
  return `지난주 이맘때 ${format(before)} · ${percentLabel(change)}`;
}

/**
 * 최장 기록까지 며칠 남았나. 이미 최장이면 `null`이다(따라잡을 것이 없다).
 *
 * `current >= longest`인 상태는 지금이 최장 기록이라는 뜻이다 — 그때 `0일 남음`이라고 말하면
 * 아직 도달하지 않은 것처럼 읽힌다.
 */
export function daysToLongest(records: StudentRecords): number | null {
  const gap = records.streak.longest - records.streak.current;
  return gap > 0 ? gap : null;
}
