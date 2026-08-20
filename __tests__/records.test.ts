import {
  IDLE_MS,
  MAX_TICK_MS,
  TICK_MS,
  activeSeconds,
  initActiveTime,
  noteActivity,
  pendingSeconds,
  tickActiveTime,
} from '../src/features/activeTime';
import { formatDuration } from '../src/features/learning';
import {
  STUDY_DAY_QUESTIONS,
  achievedMilestones,
  changeOf,
  completedWeekTrend,
  consistency,
  daysToLongest,
  formatCount,
  milestoneDetail,
  milestoneUnit,
  milestonesCrossedToday,
  newRecordsToday,
  percentLabel,
  protectionLine,
  streakLine,
  studyMethodNotice,
  todayLine,
  upcomingMilestones,
} from '../src/features/records';
import type { StudentRecords } from '../src/repo/records';

/**
 * 학습 기록의 **클라이언트 쪽 판단**을 고정한다.
 *
 * ## 여기서 시험하지 않는 것
 *
 * 연속 학습일·누적·최고 기록은 **SQL 안에** 있다(`rpc_student_records`). 단위 테스트로 닿지
 * 않으므로 `scripts/verify-records.ts`가 실제 DB에서 확인한다 — 복습 스케줄이 같은 이유로
 * `verify-note-schedule.ts`를 갖고 있는 것과 같은 구분이다.
 *
 * 이 파일이 지키는 것은 두 가지다.
 * 1. **무엇을 축하할지**(milestone 선택 · 새 기록 판정 · 비교 문장)
 * 2. **활동 시간을 어떻게 세는지**(유휴·백그라운드·스로틀 방어)
 */

const TODAY = '2026-08-19';

function day(over: Partial<StudentRecords['today']> = {}): StudentRecords['today'] {
  return {
    day: TODAY,
    solvedQuestions: 0,
    correctQuestions: 0,
    setsCompleted: 0,
    activeSec: 0,
    reviewsDone: 0,
    reviewsCorrect: 0,
    notesAdded: 0,
    notesMastered: 0,
    gradedQuestions: 0,
    isStudyDay: false,
    ...over,
  };
}

function week(over: Partial<StudentRecords['week']> = {}): StudentRecords['week'] {
  return {
    monday: '2026-08-17',
    studyDays: 0,
    activeSec: 0,
    solvedQuestions: 0,
    setsCompleted: 0,
    reviewsDone: 0,
    reviewsCorrect: 0,
    notesAdded: 0,
    notesMastered: 0,
    ...over,
  };
}

function records(over: Partial<StudentRecords> = {}): StudentRecords {
  return {
    studentId: 's1',
    studyDayQuestions: STUDY_DAY_QUESTIONS,
    today: day(),
    streak: { current: 0, longest: 0, protections: 0, weekGoal: 5, protectedDays: [] },
    totals: {
      studyDays: 0,
      activeSec: 0,
      solvedQuestions: 0,
      correctQuestions: 0,
      setsCompleted: 0,
      reviewsDone: 0,
      reviewsCorrect: 0,
      notesAdded: 0,
      notesMastered: 0,
      firstDay: null,
    },
    bests: {
      questions: { value: 0, day: null },
      activeSec: { value: 0, day: null },
      reviewsCorrect: { value: 0, day: null },
      week: { value: 0, monday: null },
    },
    prevBests: { questions: 0, activeSec: 0, reviewsCorrect: 0, week: 0 },
    week: week(),
    lastWeek: week({ monday: '2026-08-10' }),
    lastWeekToDate: week({ monday: '2026-08-10', throughDay: '2026-08-12' }),
    avg4Weeks: { solvedQuestions: 0, activeSec: 0, studyDays: 0 },
    days: [],
    weeks: [],
    ...over,
  };
}

// ── 형식 ─────────────────────────────────────────────────────────────────────

/*
  **소요 시간 형식은 앱에 하나다**(`src/features/learning.ts`). 기록 쪽에 사본을 만들었다가
  지웠다 — 같은 이름의 함수가 이미 있었고(D-178이 학부모 화면을 그 하나로 모았다) 사본을 두면
  같은 4,512초가 화면마다 다른 글자가 된다. 여기서는 기록 문장이 그 함수를 쓴다는 사실만 고정한다.
*/
describe('formatDuration을 기록 문장이 그대로 쓴다', () => {
  it('한 시간을 넘으면 시간과 분으로 갈라 말한다', () => {
    expect(formatDuration(3600 + 20 * 60)).toBe('1시간 20분');
  });

  it('한 시간 안이면 분과 초로 말한다', () => {
    expect(formatDuration(47 * 60)).toBe('47분 0초');
  });
});

describe('formatCount', () => {
  it('네 자리를 넘으면 천 단위로 끊는다', () => {
    expect(formatCount(1284)).toBe('1,284');
    expect(formatCount(38)).toBe('38');
  });
});

// ── milestone ────────────────────────────────────────────────────────────────

describe('upcomingMilestones', () => {
  it('축마다 아직 넘지 않은 첫 칸 하나만, 남은 수가 적은 것부터', () => {
    const r = records({
      streak: { current: 5, longest: 5, protections: 0, weekGoal: 5, protectedDays: [] },
      totals: { ...records().totals, solvedQuestions: 96, notesMastered: 0, studyDays: 4 },
    });
    const up = upcomingMilestones(r);
    // 연속은 7까지 2일, 문항은 100까지 4개 — 가까운 것이 앞이다.
    expect(up.map((m) => m.label)).toEqual(['7일 연속 학습', '100문항 풀이', '오답 5개 익힘']);
    // 한 축의 여러 칸이 함께 서지 않는다.
    expect(up.filter((m) => m.kind === 'questions')).toHaveLength(1);
  });

  it('남은 수를 함께 준다 — 목표는 가깝고 구체적이어야 한다', () => {
    const r = records({ totals: { ...records().totals, solvedQuestions: 96 } });
    const q = upcomingMilestones(r, 4).find((m) => m.kind === 'questions');
    expect(q?.remaining).toBe(4);
    expect(q?.value).toBe(96);
  });
});

describe('milestoneUnit', () => {
  it('축마다 그 축의 단위로 센다 — `문항`을 `개`로 세지 않는다', () => {
    expect(milestoneUnit('questions', 1200)).toBe('1,200문항');
    expect(milestoneUnit('mastered', 5)).toBe('5개');
    expect(milestoneUnit('streak', 7)).toBe('7일');
    expect(milestoneUnit('studyDays', 30)).toBe('30일');
  });
});

describe('upcomingMilestones · 기록이 하나도 없는 계정', () => {
  /*
    기록 탭은 `firstDay`가 없으면 누적 섹션을 그리지 않는다. 그 자리에 남는 것이 이 목록이라
    **그 계정에서도 값이 나와야 한다** — 나오지 않으면 도착한 화면에 기록이라는 개념이 없다.
  */
  it('아직 아무것도 하지 않은 계정에도 다가오는 기록 세 줄을 만든다', () => {
    const up = upcomingMilestones(records());
    expect(up).toHaveLength(3);
    expect(up.every((m) => m.value === 0 && m.remaining === m.threshold)).toBe(true);
  });
});

describe('achievedMilestones', () => {
  it('축마다 가장 높은 칸 하나만 남긴다 — 같은 사실을 두 줄로 세우지 않는다', () => {
    const r = records({
      totals: { ...records().totals, solvedQuestions: 1200, studyDays: 40 },
    });
    const done = achievedMilestones(r);
    expect(done.filter((m) => m.kind === 'questions').map((m) => m.threshold)).toEqual([1000]);
    expect(done.filter((m) => m.kind === 'studyDays').map((m) => m.threshold)).toEqual([30]);
  });

  it('아무것도 넘지 않았으면 빈 목록이다', () => {
    expect(achievedMilestones(records())).toEqual([]);
  });
});

describe('milestonesCrossedToday', () => {
  it('오늘 넘은 것만 고른다 — 어제 넘은 것은 축하하지 않는다', () => {
    const yesterday = records({
      totals: { ...records().totals, solvedQuestions: 120 },
      today: day({ solvedQuestions: 0 }),
    });
    expect(milestonesCrossedToday(yesterday)).toEqual([]);

    const crossedNow = records({
      totals: { ...records().totals, solvedQuestions: 120 },
      today: day({ solvedQuestions: 25, isStudyDay: true }),
    });
    expect(milestonesCrossedToday(crossedNow).map((m) => m.threshold)).toEqual([100]);
  });

  it('같은 날 다시 계산해도 같은 답이다 — 축하했음 표시를 저장하지 않는 근거다', () => {
    const r = records({
      streak: { current: 7, longest: 7, protections: 0, weekGoal: 5, protectedDays: [] },
      today: day({ isStudyDay: true }),
    });
    const first = milestonesCrossedToday(r).map((m) => m.label);
    const second = milestonesCrossedToday(r).map((m) => m.label);
    expect(first).toEqual(['7일 연속 학습']);
    expect(second).toEqual(first);
  });

  it('오늘 늘어난 것이 없으면 이미 넘은 기준선을 다시 축하하지 않는다', () => {
    const r = records({
      streak: { current: 7, longest: 7, protections: 0, weekGoal: 5, protectedDays: [] },
      today: day({ isStudyDay: false }),
    });
    expect(milestonesCrossedToday(r)).toEqual([]);
  });
});

describe('milestoneDetail', () => {
  it('축하에 근거 숫자를 붙인다 — 근거 없는 칭찬을 만들지 않는다', () => {
    const r = records({
      streak: { current: 30, longest: 30, protections: 0, weekGoal: 5, protectedDays: [] },
      today: day({ isStudyDay: true }),
      totals: { ...records().totals, solvedQuestions: 1284, studyDays: 30 },
    });
    const m = milestonesCrossedToday(r).find((x) => x.kind === 'streak')!;
    expect(milestoneDetail(m, r)).toBe('그동안 1,284문항을 풀었어요.');
  });
});

// ── 새 기록 ──────────────────────────────────────────────────────────────────

describe('newRecordsToday', () => {
  it('오늘 값이 지난 최고를 넘었을 때만 기록이다', () => {
    const r = records({
      today: day({ reviewsCorrect: 11 }),
      prevBests: { questions: 0, activeSec: 0, reviewsCorrect: 8, week: 0 },
    });
    const found = newRecordsToday(r);
    expect(found.map((x) => x.key)).toContain('reviewsCorrect');
    const hit = found.find((x) => x.key === 'reviewsCorrect')!;
    expect(hit.from).toBe(8);
    expect(hit.to).toBe(11);
    expect(hit.format(hit.to)).toBe('11개');
  });

  it('같은 값은 갱신이 아니다', () => {
    const r = records({
      today: day({ solvedQuestions: 25 }),
      prevBests: { questions: 25, activeSec: 0, reviewsCorrect: 0, week: 0 },
    });
    expect(newRecordsToday(r).map((x) => x.key)).not.toContain('questions');
  });

  it('첫 기록도 기록이다 — 0에서 시작한 값을 감추지 않는다', () => {
    const r = records({ today: day({ solvedQuestions: 12 }) });
    const hit = newRecordsToday(r).find((x) => x.key === 'questions')!;
    expect(hit.from).toBe(0);
    expect(hit.to).toBe(12);
  });

  it('0 → 0은 기록이 아니다', () => {
    expect(newRecordsToday(records())).toEqual([]);
  });

  it('주간 기록은 이번 주 값과 지난 주들의 최고를 비교한다', () => {
    const r = records({
      week: week({ solvedQuestions: 243 }),
      prevBests: { questions: 0, activeSec: 0, reviewsCorrect: 0, week: 187 },
    });
    const hit = newRecordsToday(r).find((x) => x.key === 'week')!;
    expect(hit.from).toBe(187);
    expect(hit.to).toBe(243);
  });
});

// ── 측정 방식 고지 ───────────────────────────────────────────────────────────

describe('studyMethodNotice', () => {
  it('학생·학부모 둘 다 학습일 기준을 서버 값으로 말한다', () => {
    const r = records({ studyDayQuestions: 4 });
    expect(studyMethodNotice('student', r)).toContain('하루에 4문항');
    expect(studyMethodNotice('parent', r)).toContain('하루에 4문항');
  });

  it('둘 다 화면 체류가 아니라는 사실을 말한다', () => {
    const r = records();
    for (const who of ['student', 'parent'] as const) {
      expect(studyMethodNotice(who, r)).toContain('화면을 열어 둔 시간');
    }
  });

  it('학부모 쪽만 채점의 주체를 밝힌다 — 그 숫자로 자녀를 판단하기 때문이다', () => {
    const r = records();
    expect(studyMethodNotice('parent', r)).toContain('서버가 채점한 결과');
    expect(studyMethodNotice('student', r)).not.toContain('서버가 채점한 결과');
  });
});

// ── 과거의 나와 비교 ─────────────────────────────────────────────────────────

describe('changeOf · percentLabel', () => {
  it('지난주 대비 증가율을 부호와 함께 말한다', () => {
    expect(percentLabel(changeOf(243, 187))).toBe('+30%');
    expect(percentLabel(changeOf(150, 187))).toBe('-20%');
  });

  it('지난 값이 0이면 비율을 만들지 않는다 — `+1200%`는 뜻이 없다', () => {
    expect(changeOf(12, 0).percent).toBeNull();
    expect(percentLabel(changeOf(12, 0))).toBeNull();
  });

  /*
    **이 함수는 문장을 만들지 않는다.** 예전에는 `percent === 0`에 `'지난주와 같아요'`를 박아
    돌려줬는데, 같은 함수를 `최근 4주 평균 대비` 줄도 쓰기 때문에 그 문구가 다른 기준의 값 자리에
    나갔다(`src/features/records.ts`의 근거). 기준 이름이 붙는 문장은 부르는 쪽이 만든다 —
    `app/student/records.tsx`의 `weekCompare`가 `change.percent === 0`을 보고 그 문장을 만든다.
  */
  it('변화가 없으면 비율만 말한다 — 기준 이름이 붙는 문장은 부르는 쪽이 만든다', () => {
    expect(percentLabel(changeOf(187, 187))).toBe('0%');
  });
});

describe('consistency', () => {
  it('창 전체를 분모로 쓴다 — 기록이 짧은 학생이 100%가 되지 않게', () => {
    const days = Array.from({ length: 28 }, (_, i) => ({
      day: `2026-07-${String(i + 1).padStart(2, '0')}`,
      gradedQuestions: i < 14 ? 10 : 0,
      activeSec: 0,
      isStudyDay: i < 14,
    }));
    /* 비율과 함께 **세는 데 쓴 두 수**를 돌려준다 — 화면이 `28일 중 14일`을 다시 세지 않게. */
    expect(consistency(records({ days }))).toEqual({ days: 28, studied: 14, percent: 50 });
  });

  it('기록이 없으면 0%다(0으로 나누지 않는다)', () => {
    expect(consistency(records())).toEqual({ days: 0, studied: 0, percent: 0 });
  });
});

describe('completedWeekTrend', () => {
  const weeks = [
    { monday: '2026-07-27', solvedQuestions: 40, studyDays: 4, activeSec: 0 },
    { monday: '2026-08-03', solvedQuestions: 55, studyDays: 5, activeSec: 0 },
    { monday: '2026-08-10', solvedQuestions: 65, studyDays: 4, activeSec: 0 },
    { monday: '2026-08-17', solvedQuestions: 10, studyDays: 1, activeSec: 0 },
  ];

  it('진행 중인 이번 주를 넣지 않는다 — 마지막 점이 늘 바닥으로 떨어진다(§18-0)', () => {
    const r = records({ weeks, week: week({ monday: '2026-08-17', solvedQuestions: 10 }) });
    expect(completedWeekTrend(r)).toEqual([40, 55, 65]);
  });

  it('점이 둘 미만이면 선을 만들지 않는다', () => {
    const r = records({
      weeks: [weeks[2], weeks[3]],
      week: week({ monday: '2026-08-17' }),
    });
    expect(completedWeekTrend(r)).toEqual([]);
  });

  it('기록이 없으면 빈 배열이다', () => {
    expect(completedWeekTrend(records())).toEqual([]);
  });
});

describe('daysToLongest', () => {
  it('최장 기록까지 남은 일수를 준다', () => {
    const r = records({ streak: { current: 14, longest: 17, protections: 0, weekGoal: 5, protectedDays: [] } });
    expect(daysToLongest(r)).toBe(3);
  });

  it('지금이 최장이면 `0일 남음`이라고 말하지 않는다', () => {
    const r = records({ streak: { current: 17, longest: 17, protections: 0, weekGoal: 5, protectedDays: [] } });
    expect(daysToLongest(r)).toBeNull();
  });
});

// ── 오늘 한 줄 ───────────────────────────────────────────────────────────────

describe('todayLine', () => {
  it('한 일만 말한다 — 하지 않은 일을 0으로 세지 않는다', () => {
    const r = records({ today: day({ solvedQuestions: 38, activeSec: 47 * 60 }) });
    expect(todayLine(r)).toBe('38문항 · 47분 0초');
  });

  it('오답을 맞혔으면 해결로, 틀렸으면 복습으로 말한다', () => {
    expect(todayLine(records({ today: day({ reviewsDone: 6, reviewsCorrect: 6 }) })))
      .toBe('오답 6개 해결');
    expect(todayLine(records({ today: day({ reviewsDone: 6, reviewsCorrect: 0 }) })))
      .toBe('오답 6개 복습');
  });

  it('아무것도 하지 않은 날은 빈 문장이다 — 화면이 그 자리를 그리지 않는다', () => {
    expect(todayLine(records())).toBe('');
  });
});

describe('protectionLine', () => {
  it('쓴 적이 없으면 얻는 방법만 말한다', () => {
    expect(protectionLine(records())).toBe('한 주에 5일을 채우면 생겨요 · 빠진 날을 메워요');
  });

  it('하루를 메웠으면 그 날을 말한다 — 숫자만 보면 연속이 틀린 것으로 읽힌다', () => {
    const r = records({
      streak: { current: 12, longest: 12, protections: 1, weekGoal: 5, protectedDays: ['2026-08-16'] },
    });
    expect(protectionLine(r)).toBe('8월 16일을 메웠어요 · 한 주에 5일을 채우면 생겨요');
  });

  it('여러 날을 메웠으면 개수를 함께 말한다', () => {
    const r = records({
      streak: {
        current: 12,
        longest: 12,
        protections: 0,
        weekGoal: 5,
        protectedDays: ['2026-08-15', '2026-08-16'],
      },
    });
    expect(protectionLine(r)).toBe('8월 16일까지 2일을 메웠어요 · 한 주에 5일을 채우면 생겨요');
  });

  it('겁주는 문장을 만들지 않는다', () => {
    const r = records({
      streak: { current: 12, longest: 12, protections: 0, weekGoal: 5, protectedDays: ['2026-08-16'] },
    });
    expect(protectionLine(r)).not.toMatch(/끊|잃|주의|경고/);
  });
});

describe('streakLine', () => {
  /*
    **문장에 연속 일수를 넣지 않는다.** 예전에는 `17일째 공부 중`·`17일 연속 · …`을 돌려줬는데,
    이 문장을 쓰는 두 화면(기록·결과)이 같은 줄의 `trailing`에 `17일`을 이미 적고 있었다 —
    한 줄에서 같은 수가 두 번이었다. 수는 값의 자리가, 조건은 이 문장이 말한다.
  */
  it('오늘이 학습일이면 이어지고 있다고 말한다 — 수는 말하지 않는다', () => {
    const r = records({
      streak: { current: 17, longest: 20, protections: 0, weekGoal: 5, protectedDays: [] },
      today: day({ isStudyDay: true }),
    });
    expect(streakLine(r)).toBe('오늘도 공부했어요');
    expect(streakLine(r)).not.toContain('17');
  });

  it('오늘이 아직 학습일이 아니면 그 사실을 말한다 — 이미 한 것처럼 읽히지 않게', () => {
    const r = records({
      streak: { current: 17, longest: 20, protections: 0, weekGoal: 5, protectedDays: [] },
      today: day({ isStudyDay: false }),
    });
    expect(streakLine(r)).toBe(`오늘 ${STUDY_DAY_QUESTIONS}문항을 풀면 이어져요`);
    expect(streakLine(r)).not.toContain('17');
  });

  it('기록이 없으면 시작하는 방법을 말한다', () => {
    expect(streakLine(records())).toBe(`오늘 ${STUDY_DAY_QUESTIONS}문항을 풀면 기록이 시작돼요`);
  });
});

// ── 활동 시간 ────────────────────────────────────────────────────────────────

describe('tickActiveTime', () => {
  const t0 = 1_000_000;

  it('활동 뒤 유휴 창 안에서는 자란다', () => {
    let s = initActiveTime(t0);
    s = tickActiveTime(s, t0 + TICK_MS, true);
    expect(activeSeconds(s)).toBe(1);
  });

  it('유휴 창을 넘기면 세지 않는다 — 자리를 떠난 시간은 학습 시간이 아니다', () => {
    let s = initActiveTime(t0);
    // 활동 없이 유휴 창을 넘긴 뒤의 tick
    s = { ...s, lastTickAt: t0 + IDLE_MS + 1_000 };
    s = tickActiveTime(s, t0 + IDLE_MS + 2_000, true);
    expect(activeSeconds(s)).toBe(0);
  });

  it('활동을 알리면 창이 다시 열린다', () => {
    let s = initActiveTime(t0);
    const later = t0 + IDLE_MS + 5_000;
    s = { ...s, lastTickAt: later };
    s = noteActivity(s, later);
    s = tickActiveTime(s, later + TICK_MS, true);
    expect(activeSeconds(s)).toBe(1);
  });

  it('화면이 뒤에 있으면 세지 않는다', () => {
    let s = initActiveTime(t0);
    s = tickActiveTime(s, t0 + TICK_MS, false);
    expect(activeSeconds(s)).toBe(0);
  });

  it('한 tick이 더할 수 있는 양을 묶는다 — 백그라운드 스로틀이 만든 큰 간격을 자른다', () => {
    let s = initActiveTime(t0);
    // 브라우저가 타이머를 1분 늦춘 뒤 앞으로 돌아온 순간(활동은 방금 있었다)
    s = noteActivity(s, t0 + 60_000);
    s = tickActiveTime(s, t0 + 60_000, true);
    expect(s.activeMs).toBe(MAX_TICK_MS);
  });

  it('세지 않아도 `lastTickAt`은 전진한다 — 멈춰 두면 다음 tick이 유휴 구간을 한꺼번에 더한다', () => {
    let s = initActiveTime(t0);
    s = tickActiveTime(s, t0 + 5_000, false);
    expect(s.lastTickAt).toBe(t0 + 5_000);
    expect(s.activeMs).toBe(0);
  });

  it('시계가 거꾸로 가도 음수를 더하지 않는다', () => {
    let s = initActiveTime(t0);
    s = tickActiveTime(s, t0 - 5_000, true);
    expect(s.activeMs).toBe(0);
  });
});

describe('pendingSeconds', () => {
  it('보낸 만큼은 다시 보내지 않는다 — 같은 시간을 두 번 세지 않는 자리다', () => {
    let s = initActiveTime(0);
    for (let i = 1; i <= 90; i += 1) {
      s = noteActivity(s, i * TICK_MS);
      s = tickActiveTime(s, i * TICK_MS, true);
    }
    expect(activeSeconds(s)).toBe(90);
    expect(pendingSeconds(s)).toBe(90);

    s = { ...s, flushedSec: 60 };
    expect(pendingSeconds(s)).toBe(30);
  });

  it('보낸 값이 센 값보다 커도 음수가 되지 않는다(서버가 더 크게 기록한 경우)', () => {
    const s = { ...initActiveTime(0), flushedSec: 100 };
    expect(pendingSeconds(s)).toBe(0);
  });
});
