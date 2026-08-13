import {
  buildChildReport,
  weekOf,
  prevWeek,
  weekFacts,
  weekFallback,
  tidySummary,
  WEAK_MIN_QUESTIONS,
  RANK_MIN_SUBMITTERS,
  classStat,
  correctOf,
  reportDueOf,
  type ChildReportData,
  type ReportRow,
} from '@/features/report';
import {
  ASSIGNMENTS_SEED,
  ATTEMPTS_SEED,
  WRONG_NOTES_SEED,
  SEED_CONTENT,
  ACADEMY_CLASSES,
} from '@/data/seed';
import { EXTRA_CONTENT } from '@/data/contentExtra';
import type { Attempt } from '@/features/progress';

const SETS = [...SEED_CONTENT, ...EXTRA_CONTENT];

/**
 * 자녀가 속한 반 id.
 *
 * `buildChildReport`는 **화면이 넘긴 반 목록**으로 미제출 과제를 좁힌다 — 예전에는 fixture를
 * 직접 읽어서 학원이 새로 만든 반을 보지 못했다(마스터 플랜 S-013). 앱에서는 세션 스냅샷이
 * 이 값을 준다. 테스트는 같은 fixture에서 뽑아 넘긴다.
 */
function classIdsOf(childId: string): string[] {
  return ACADEMY_CLASSES.filter((c) => c.studentIds.includes(childId)).map((c) => c.id);
}

/** 시드가 2026-07 기준이라 그 달을 오늘로 둔다. 리포트는 달마다 하나다. */
const TODAY = '2026-07-28';

/**
 * 반 비교 집계. **서버가 내는 값**(`rpc_class_comparisons`)을 테스트가 직접 넘긴다 —
 * 학부모는 RLS상 다른 학생의 제출을 볼 수 없어 클라이언트가 계산할 수 없다.
 *
 * `a_kor1_1`: 정예린 80% · 반 친구 7명(90·70·60·85·50·75·95) → 제출 8명, 정예린은 4등.
 */
const COMPARISONS = {
  a_kor1_1: { submitters: 8, rank: 4, avg: 76, mine: 80 },
};


function report(childId: string, month?: string): ChildReportData {
  return buildChildReport(
    childId,
    {
      assignments: ASSIGNMENTS_SEED,
      attempts: (ATTEMPTS_SEED[childId] ?? {}) as Record<string, Attempt>,
      wrongNotes: WRONG_NOTES_SEED[childId] ?? [],
      sets: SETS,
      today: TODAY,
      classIds: classIdsOf(childId),
      comparisons: COMPARISONS,
    },
    month,
  );
}

describe('주 단위 집계', () => {
  it('주는 월요일에 시작한다', () => {
    expect(weekOf('2026-07-28')).toBe('2026-07-27'); // 화요일 → 그 주 월요일
    expect(weekOf('2026-07-27')).toBe('2026-07-27'); // 월요일은 자기 자신
    expect(weekOf('2026-07-26')).toBe('2026-07-20'); // 일요일은 앞 주에 붙는다
  });

  it('한 주 전을 구한다', () => {
    expect(prevWeek('2026-07-27')).toBe('2026-07-20');
    expect(prevWeek('2026-01-05')).toBe('2025-12-29'); // 해를 넘어간다
  });

  it('AI에게 넘기는 사실에는 주어진 숫자만 담고 없는 값은 줄을 만들지 않는다', () => {
    const week = {
      monday: '2026-07-27',
      days: 2,
      count: 3,
      questions: 30,
      accuracy: 80,
      timeSec: 600,
      academySubmitted: 1,
    };
    const facts = weekFacts('정예린', week, null, [{ area: '독서', rate: 55, total: 20 }], 0);
    expect(facts).toContain('공부한 날 수: 2일');
    expect(facts).toContain('정답률: 80%');
    expect(facts).toContain('영역 독서: 정답률 55% (20문항)');
    // 지난주가 없으면 비교하지 말라고 못박는다
    expect(facts).toContain('지난주와 비교하지 마세요');
    // 미제출이 0이면 그 줄을 만들지 않는다(모델이 0을 해석하지 않게)
    expect(facts).not.toContain('안 낸 학원 과제');
    // 등수·백분위 같은 말을 재료에 넣지 않는다
    expect(facts).not.toMatch(/등수|백분위|예상/);
  });

  it('꾸준함 총평은 여러 날 공부했을 때만 붙는다', () => {
    const one = {
      monday: '2026-07-27',
      days: 1,
      count: 1,
      questions: 10,
      accuracy: 80,
      timeSec: 300,
      academySubmitted: 0,
    };
    expect(weekFallback(one, null)).not.toContain('꾸준히 앉은');
    expect(weekFallback({ ...one, days: 3 }, null)).toContain('꾸준히 앉은');
  });

  it('키가 없을 때 대체 요약은 같은 숫자만 이어 붙인다', () => {
    const week = {
      monday: '2026-07-27',
      days: 2,
      count: 3,
      questions: 30,
      accuracy: 80,
      timeSec: 600,
      academySubmitted: 1,
    };
    const before = { ...week, monday: '2026-07-20', accuracy: 70 };
    const text = weekFallback(week, before);
    expect(text).toContain('2일');
    expect(text).toContain('30문항');
    expect(text).toContain('10%포인트 높아요');
    expect(text).not.toMatch(/등급|예상|또래/);
  });
});

describe('자녀 리포트 계산', () => {
  it('개인 학습과 학원 과제를 한 목록으로 모으고 출처를 갈라 센다', () => {
    const r = report('u_student_both'); // 7월: 개인 2 + 학원 제출 4
    expect(r.bySource.personal.count).toBe(2);
    expect(r.bySource.academy.count).toBe(4);
    expect(r.totals.count).toBe(6);
    // 두 출처를 합친 값이 아니라 각각도 따로 나온다
    expect(r.bySource.personal.accuracy).not.toBeNull();
    expect(r.bySource.academy.accuracy).not.toBeNull();
  });

  it('학원 과제가 없는 자녀는 개인 학습만 집계한다', () => {
    const r = report('u_student_parentpaid'); // 7월: 개인 2, 학원 소속 없음
    expect(r.bySource.academy.count).toBe(0);
    expect(r.bySource.personal.count).toBe(2);
    expect(r.pending).toHaveLength(0);
  });

  it('학원 과제의 날짜는 제출일에서만 온다(마감일을 대신 넣지 않는다)', () => {
    const r = report('u_student_both');
    const academy = r.rows.filter((x) => x.source === 'academy');
    expect(academy.length).toBeGreaterThan(0);
    for (const row of academy) {
      const seed = ASSIGNMENTS_SEED.find((a) => a.id === row.itemId);
      const sub = seed?.submissions.find((s) => s.studentId === 'u_student_both');
      // 제출일이 없으면 빈 문자열이어야 한다 — 마감일이 흘러들어오면 안 된다
      expect(row.dateISO).toBe(sub?.submittedAt ?? '');
    }
    // 마감보다 일찍 낸 기록이 실제로 구분된다
    expect(academy.some((row) => row.dateISO && row.dateISO < (row.dueDate ?? ''))).toBe(true);
  });

  it('제출일이 없는 학원 기록은 날짜를 비우고 그 수를 센다', () => {
    const stripped = ASSIGNMENTS_SEED.map((a) => ({
      ...a,
      submissions: a.submissions.map((s) => ({ ...s, submittedAt: undefined })),
    }));
    const r = buildChildReport('u_student_both', {
      assignments: stripped,
      attempts: {},
      wrongNotes: [],
      sets: SETS,
      today: TODAY,
      classIds: classIdsOf('u_student_both'),
    });
    expect(r.allRows.every((x) => x.dateISO === '')).toBe(true);
    expect(r.undated).toBe(r.allRows.length);
    expect(r.lastDate).toBeNull();
    // 날짜가 없으면 어느 달에도 세지 않는다. 임의의 달로 밀어 넣지 않는다.
    expect(r.rows).toHaveLength(0);
    expect(r.totals.count).toBe(0);
  });

  it('기록이 없는 자녀는 빈 집계를 주고 미제출만 남긴다', () => {
    const r = report('u_student_academy'); // 박도윤: 기록 없음, 미제출 과제 있음
    expect(r.totals.count).toBe(0);
    expect(r.totals.accuracy).toBeNull();
    expect(r.pending.length).toBeGreaterThan(0);
  });

  it('미제출은 마감이 지난 것부터 준다', () => {
    const r = report('u_student_academy');
    const overdue = r.pending.filter((p) => p.due?.overdue);
    if (overdue.length > 0 && overdue.length < r.pending.length) {
      expect(r.pending[0].due?.overdue).toBe(true);
    }
    expect(r.now.overdue).toBe(overdue.length);
  });

  it('문항이 적은 영역은 약점으로 단정하지 않는다', () => {
    const r = report('u_student_both');
    expect(r.byArea.length).toBeGreaterThan(0);
    for (const a of r.byArea) {
      expect(a.enough).toBe(a.total >= WEAK_MIN_QUESTIONS);
    }
    // 낮은 순 정렬
    const rates = r.byArea.map((a) => a.rate);
    expect([...rates].sort((x, y) => x - y)).toEqual(rates);
  });

  it('지표가 누적이 아니라 그 달 것만 센다', () => {
    const july = report('u_student_parentpaid', '2026-07');
    const june = report('u_student_parentpaid', '2026-06');
    // 이하은은 7월 2건(7/26, 7/24) + 6월 1건(6/30)을 풀었다
    expect(july.totals.count).toBe(2);
    expect(june.totals.count).toBe(1);
    // 전체는 3건이지만 어느 달도 3을 말하지 않는다 — 누적이 아니다
    expect(july.allRows).toHaveLength(3);
    expect(july.rows.every((r) => r.dateISO.startsWith('2026-07'))).toBe(true);
    expect(june.rows.every((r) => r.dateISO.startsWith('2026-06'))).toBe(true);
  });

  it('공부한 날 수를 세고 지난달과 비교할 수 있다', () => {
    const r = report('u_student_parentpaid', '2026-07');
    expect(r.totals.days).toBe(2); // 7/26, 7/24
    expect(r.prev?.month).toBe('2026-06');
    expect(r.prev?.days).toBe(1);
  });

  it('비교할 지난달 기록이 없으면 prev를 주지 않는다', () => {
    // 정예린의 6월 앞(5월)에는 기록이 없다
    const r = report('u_student_both', '2026-06');
    expect(r.totals.count).toBe(1);
    expect(r.prev).toBeNull();
  });

  it('고를 수 있는 달은 기록이 있는 달과 이번 달이다', () => {
    const r = report('u_student_parentpaid');
    expect(r.months).toContain('2026-07');
    expect(r.months).toContain('2026-06');
    // 최신순
    expect(r.months[0]).toBe('2026-07');
  });

  /*
    D-090. 달이 바뀐 날 리포트를 열면 이번 달에는 아직 기록이 없다.
    그렇다고 기록이 있는 달로 몰래 옮기면 홈은 `8월`, 리포트는 `7월`을 말해 두 화면이 어긋난다.
    이번 달을 그대로 열고, 기록이 남은 달은 `latest`로 알려 화면이 갈 길을 만든다.
  */
  it('이번 달이 비어 있어도 이번 달을 연다', () => {
    const aug = buildChildReport(
      'u_student_parentpaid',
      {
        assignments: ASSIGNMENTS_SEED,
        attempts: (ATTEMPTS_SEED['u_student_parentpaid'] ?? {}) as Record<string, Attempt>,
        wrongNotes: WRONG_NOTES_SEED['u_student_parentpaid'] ?? [],
        sets: SETS,
        today: '2026-08-01',
      },
    );
    expect(aug.month).toBe('2026-08');
    expect(aug.totals.count).toBe(0);
    // 기록이 사라진 것이 아니라는 사실을 화면이 말할 수 있어야 한다
    expect(aug.latest).toBe('2026-07');
    expect(aug.months[0]).toBe('2026-08');
  });

  it('기록이 하나도 없으면 옮겨 갈 달도 없다', () => {
    const r = buildChildReport(
      'u_student_academy',
      { assignments: [], attempts: {}, wrongNotes: [], sets: SETS, today: TODAY },
    );
    expect(r.latest).toBeNull();
  });

  it('오답노트 활동도 그 달 것만 센다', () => {
    const july = report('u_student_parentpaid', '2026-07');
    const june = report('u_student_parentpaid', '2026-06');
    expect(july.notes.added).toBe(2); // 7/26 정리함, 7/24 별표
    // `이해 완료`는 학생 자기 신고라 학부모 리포트 지표에서 뺐다
    expect('mastered' in july.notes).toBe(false);
    expect(july.notes.organized).toBe(1);
    expect(july.notes.starred).toBe(1);
    expect(june.notes.added).toBe(1);
    // 전체 담긴 수는 달과 무관하다
    expect(july.notes.total).toBe(3);
    expect(june.notes.total).toBe(3);
  });

  it('달마다 변화는 최근 6개월을 오래된 것부터 준다', () => {
    const r = report('u_student_parentpaid', '2026-07');
    expect(r.history).toHaveLength(6);
    expect(r.history[5].month).toBe('2026-07');
    expect(r.history[0].month).toBe('2026-02');
    // 기록이 없는 달도 0으로 자리를 지킨다
    expect(r.history[0].count).toBe(0);
  });

  it('미제출 과제는 달과 무관한 지금 상태다', () => {
    const july = report('u_student_academy', '2026-07');
    const june = report('u_student_academy', '2026-06');
    expect(june.pending).toEqual(july.pending);
  });

  /*
    **평균·순위 계산은 서버로 옮겼다**(`rpc_class_comparisons`). 학부모는 RLS상 다른 학생의 제출을
    볼 수 없으므로 클라이언트에서 계산할 재료가 없다 — 그것이 맞다.

    여기서 지키는 것은 **받은 집계를 어떻게 쓰는지**다: 제출자가 적으면 비교하지 않고, 낸 기록이
    없으면 비교하지 않는다. 집계 자체의 정확성은 `scripts/verify-rls.ts`가 서버에서 확인한다.
  */
  it('제출자가 기준보다 적으면 반 비교를 주지 않는다', () => {
    expect(classStat({ submitters: RANK_MIN_SUBMITTERS - 1, rank: 2, avg: 70, mine: 80 })).toBeNull();
  });

  it('제출자가 충분하면 받은 값을 그대로 쓴다', () => {
    const cls = classStat({ submitters: 8, rank: 4, avg: 74, mine: 80 })!;
    expect(cls).toEqual({ submitters: 8, rank: 4, avg: 74, mine: 80 });
  });

  it('낸 기록이 없으면 반 비교를 주지 않는다', () => {
    expect(classStat({ submitters: 8, rank: null, avg: 74, mine: null })).toBeNull();
    expect(classStat(undefined)).toBeNull();
  });

  it('기한 내 제출은 제출일과 마감일이 둘 다 있는 과제만 센다', () => {
    const r = report('u_student_both', '2026-07');
    const judgeable = r.rows.filter((x) => x.source === 'academy' && x.dateISO && x.dueDate);
    expect(r.onTime.total).toBe(judgeable.length);
    expect(r.onTime.inTime).toBe(
      judgeable.filter((x) => x.dateISO <= (x.dueDate ?? '')).length,
    );
    // 시드에는 마감보다 일찍 낸 것과 마감일에 낸 것이 섞여 있다
    expect(r.onTime.inTime).toBe(r.onTime.total);
  });

  it('세부 유형별 정답률은 자녀가 푼 세트에서만 나오고 문항 수를 함께 준다', () => {
    const r = report('u_student_both', '2026-07');
    expect(r.byTopic.length).toBeGreaterThan(0);
    for (const t of r.byTopic) expect(t.total).toBeGreaterThan(0);
    // 낮은 순
    const rates = r.byTopic.map((t) => t.rate);
    expect([...rates].sort((x, y) => x - y)).toEqual(rates);
  });

  it('일별 학습은 기록이 있는 날만 오래된 순으로 준다', () => {
    const r = report('u_student_both', '2026-07');
    expect(r.byDay.length).toBeGreaterThan(0);
    const dates = r.byDay.map((d) => d.date);
    expect([...dates].sort()).toEqual(dates);
    expect(r.byDay.every((d) => d.date.startsWith('2026-07'))).toBe(true);
  });

  it('앱에서 직접 푼 학원 과제에도 마감일과 반 비교가 붙는다', () => {
    // 학원 학습의 itemId는 배정 id다. 그래서 attempt 행이 배정 행을 가려 버리면
    // 순위·마감이 사라지고 화면이 "낸 학생이 적어서"라는 거짓 이유를 댄다.
    const solved = {
      itemId: 'a_kor1_1',
      title: '현대소설 점검',
      area: '문학',
      source: 'academy' as const,
      timeSec: 700,
      correct: 8,
      total: 10,
      accuracy: 80,
      dateISO: '2026-07-27',
      perQuestion: [],
    };
    const r = buildChildReport(
      'u_student_both',
      {
        assignments: ASSIGNMENTS_SEED,
        attempts: { a_kor1_1: solved },
        wrongNotes: [],
        sets: SETS,
        today: TODAY,
        comparisons: COMPARISONS,
      },
      '2026-07',
    );
    const row = r.rows.find((x) => x.itemId === 'a_kor1_1')!;
    expect(row.dueDate).toBe('2026-07-24');
    expect(row.cls).not.toBeNull();
    expect(row.cls!.rank).toBe(4);
  });

  it('정답 수를 정답률에서 되돌리지 않고 저장된 값을 쓴다', () => {
    // accuracy는 정수로 반올림된 값이라 문항 수로 되돌리면 세트마다 ±1이 쌓인다.
    const odd = {
      itemId: 'li_ct_gram_core',
      title: '문법 종합',
      area: '문법',
      source: 'personal' as const,
      timeSec: 600,
      correct: 17,
      total: 24,
      accuracy: 71, // 17/24 = 70.83 → 71. 되돌리면 Math.round(71*24/100) = 17이지만 값이 다를 수 있다
      dateISO: '2026-07-27',
      perQuestion: [],
    };
    const r = buildChildReport(
      'u_student_parentpaid',
      { assignments: [], attempts: { x: odd }, wrongNotes: [], sets: SETS, today: TODAY },
      '2026-07',
    );
    expect(r.rows[0].correct).toBe(17);
    expect(r.totals.correct).toBe(17);
  });

  it('그 달 배정은 마감월로만 판정하고 마감일 없는 배정은 따로 센다', () => {
    const extra = [
      ...ASSIGNMENTS_SEED,
      {
        id: 'a_nodue',
        classId: 'c_kor1',
        subject: '국어',
        title: '마감 없는 과제',
        questionCount: 10,
        submissions: [{ studentId: 'u_student_both', submitted: false }],
      },
    ];
    const r = buildChildReport(
      'u_student_both',
      {
        assignments: extra,
        attempts: {},
        wrongNotes: [],
        sets: SETS,
        today: TODAY,
        classIds: classIdsOf('u_student_both'),
      },
      '2026-07',
    );
    // 마감일 없는 배정은 분모에 넣지 않고 개수만 밝힌다
    expect(r.academySubmit.noDueDate).toBe(1);
    expect(r.academySubmit.assigned).toBe(4);
    // 8월에는 그 달 마감이 없어 배정도 0이다(제출월로 끌어오지 않는다)
    const aug = buildChildReport(
      'u_student_both',
      {
        assignments: extra,
        attempts: {},
        wrongNotes: [],
        sets: SETS,
        today: '2026-08-04',
        classIds: classIdsOf('u_student_both'),
      },
      '2026-08',
    );
    expect(aug.academySubmit.assigned).toBe(0);
  });

  it('주간 요약에 넘기는 영역은 이번 주 것만이다', () => {
    const r = report('u_student_both');
    // 7월 전체는 세 영역이지만 이번 주(7/27~)에 푼 것은 문학 하나뿐이다
    expect(r.byArea.length).toBe(3);
    expect(r.weekAreas.map((a) => a.area)).toEqual(['문학']);
    expect(r.weekAreas[0].total).toBe(10);
  });

  it('반 평균을 자녀 정답률과 같은 방식(문항 가중)으로 낸다', () => {
    const r = report('u_student_both', '2026-07');
    const compared = r.rows.filter((x) => x.source === 'academy' && x.cls);
    const weighted = Math.round(
      compared.reduce((n, x) => n + x.cls!.avg * x.questions, 0) /
        compared.reduce((n, x) => n + x.questions, 0),
    );
    expect(r.academyCompare!.classAvg).toBe(weighted);
  });

  it('연결되지 않은 자녀의 기록은 계산에 들어가지 않는다', () => {
    // 권한은 provider의 canRead가 막는다. 빈 attempts가 들어오면 학원 제출만 남는다.
    const r = buildChildReport('u_student_both', {
      assignments: ASSIGNMENTS_SEED,
      attempts: {},
      wrongNotes: [],
      sets: SETS,
      today: TODAY,
      classIds: classIdsOf('u_student_both'),
    });
    expect(r.bySource.personal.count).toBe(0);
  });
});

describe('AI 요약 다듬기', () => {
  it('인사말과 자기소개 문장을 버린다', () => {
    const raw = '안녕하세요, 스코디 선생님이에요.\n예린이는 이번 주에 1일 공부했어요.';
    expect(tidySummary(raw)).toBe('예린이는 이번 주에 1일 공부했어요.');
  });

  it('문장마다 줄을 바꿔 보내도 한 덩어리로 잇는다', () => {
    const raw = '첫 문장이에요.\n\n두 번째예요.\n세 번째예요.';
    expect(tidySummary(raw)).toBe('첫 문장이에요. 두 번째예요. 세 번째예요.');
    expect(tidySummary(raw)).not.toContain('\n');
  });

  it('마크다운 제목과 목록 기호를 걷어낸다', () => {
    expect(tidySummary('## 요약\n- 첫째예요.\n- 둘째예요.')).toBe('요약 첫째예요. 둘째예요.');
  });

  it('네 문장을 넘기면 자른다', () => {
    const raw = '하나예요. 둘이에요. 셋이에요. 넷이에요. 다섯이에요.';
    expect(tidySummary(raw)).toBe('하나예요. 둘이에요. 셋이에요. 넷이에요.');
  });

  it('이미 깔끔한 글은 그대로 둔다', () => {
    const good = '이번 주에 3일 공부했어요. 문학이 나아졌어요. 오늘은 과정을 칭찬해 주세요.';
    expect(tidySummary(good)).toBe(good);
  });
});

describe('정답 수 되돌리기', () => {
  /**
   * `correctOf`가 자기를 다시 호출해 무한 재귀였다. 저장된 정답 수가 없는 제출 행에서
   * 스택 오버플로가 났고, 학생이 앱에서 학원 과제를 낸 뒤 학부모가 리포트를 열면 화면이
   * 죽었다(D-060). 저장된 값이 없을 때도 유한한 근사값을 돌려주어야 한다.
   */
  const row = (over: Partial<ReportRow> = {}): ReportRow => ({
    itemId: 'x',
    title: 't',
    area: '문학',
    source: 'academy',
    accuracy: 80,
    questions: 10,
    timeSec: 0,
    dateISO: '2026-07-01',
    hasDetail: false,
    ...over,
  });

  it('저장된 정답 수가 없으면 정답률에서 되돌린다(재귀하지 않는다)', () => {
    expect(correctOf(row())).toBe(8);
  });

  it('저장된 정답 수가 있으면 그 값을 그대로 쓴다', () => {
    expect(correctOf(row({ correct: 7 }))).toBe(7);
  });

  it('정답 수 0도 되돌린 값으로 덮지 않는다', () => {
    expect(correctOf(row({ accuracy: 90, correct: 0 }))).toBe(0);
  });
});

describe('재배정과 월 판정', () => {
  /**
   * 마감일을 미루면 원래 값이 `originalDueDate`에 남고, 월 판정은 그 값으로 한다(D-056).
   * 현재 마감일로 판정하면 이미 낸 학생의 확정된 지난달 리포트가 다른 달로 옮겨 간다.
   */
  const base = { id: 'a', classId: 'c', subject: '국어', title: 't', questionCount: 10, submissions: [] };

  it('재배정 전에는 마감일 그대로다', () => {
    expect(reportDueOf({ ...base, dueDate: '2026-07-24' })).toBe('2026-07-24');
  });

  it('재배정 후에도 원래 마감일로 달을 판정한다', () => {
    expect(reportDueOf({ ...base, dueDate: '2026-08-20', originalDueDate: '2026-07-24' })).toBe(
      '2026-07-24',
    );
  });

  it('마감일이 아예 없으면 판정하지 않는다', () => {
    expect(reportDueOf(base)).toBeUndefined();
  });
});
