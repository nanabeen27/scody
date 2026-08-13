import type { Account, Assignment } from '@/data';
import {
  ACADEMY_CLASSES,
  ASSIGNMENTS_SEED,
  SEED_CONTENT,
  assignmentHistory,
  getClassesForAccount,
  getAccount,
} from '@/data/seed';
import {
  HARD_MIN_ANSWERS,
  accuracyDistribution,
  areaBreakdown,
  byClass,
  classPerformance,
  deltaOf,
  gradeBreakdown,
  hardestQuestions,
  pendingStat,
  scopedAssignments,
  studentPerformance,
  weeklySeries,
  weightedAccuracy,
} from '@/features/academyStats';

/**
 * `academyStats`의 단위 테스트.
 *
 * 이 모듈에는 테스트가 없었고, D-061이 고친 지표 불일치(단순 평균 vs 문항 수 가중,
 * `미제출 N명`이 사실은 건 수였던 것)가 두 번 났던 자리다. 화면이 아니라 여기서 고정한다.
 */

const ALL: readonly Assignment[] = [...ASSIGNMENTS_SEED, ...assignmentHistory()];

function assignment(over: Partial<Assignment> & Pick<Assignment, 'id'>): Assignment {
  return {
    classId: 'c_x',
    subject: '국어',
    title: '테스트',
    questionCount: 10,
    submissions: [],
    ...over,
  };
}

describe('세는 단위', () => {
  it('평균 정답률은 문항 수로 가중한다 — 작은 세트가 결과를 뒤집지 않는다', () => {
    const rows = [
      assignment({
        id: 'a1',
        questionCount: 25,
        submissions: [{ studentId: 's1', submitted: true, accuracy: 40 }],
      }),
      assignment({
        id: 'a2',
        questionCount: 5,
        submissions: [{ studentId: 's1', submitted: true, accuracy: 100 }],
      }),
    ];
    // 단순 평균이면 70%. 문항 수 가중이면 (10 + 5) / 30 = 50%.
    expect(weightedAccuracy(rows)).toBe(50);
  });

  it('안 낸 학생은 사람 수, 안 낸 과제는 건 수다', () => {
    const rows = [
      assignment({ id: 'a1', submissions: [{ studentId: 's1', submitted: false }] }),
      assignment({ id: 'a2', submissions: [{ studentId: 's1', submitted: false }] }),
      assignment({ id: 'a3', submissions: [{ studentId: 's2', submitted: false }] }),
    ];
    const stat = pendingStat(rows);
    expect(stat.students).toBe(2);
    expect(stat.count).toBe(3);
  });
});

describe('주간 추이', () => {
  it('오래된 주가 앞이고 주 수가 정확하다', () => {
    const series = weeklySeries(ALL, 12, '2026-07-29');
    expect(series).toHaveLength(12);
    expect(series[0].monday < series[11].monday).toBe(true);
    expect(series[11].monday).toBe('2026-07-27');
  });

  it('마감일을 제출일 자리에 넣지 않는다 — 제출하지 않은 행은 정답률 분모에서 빠진다', () => {
    const rows = [
      assignment({
        id: 'a1',
        dueDate: '2026-07-29',
        submissions: [
          { studentId: 's1', submitted: true, accuracy: 80, submittedAt: '2026-07-28' },
          { studentId: 's2', submitted: false },
        ],
      }),
    ];
    const week = weeklySeries(rows, 1, '2026-07-29')[0];
    expect(week.total).toBe(2);
    expect(week.submitted).toBe(1);
    expect(week.rate).toBe(50);
    expect(week.accuracy).toBe(80);
  });

  it('마감일을 미뤄도 원래 주에 남는다 (D-056)', () => {
    const rows = [
      assignment({
        id: 'a1',
        originalDueDate: '2026-07-22',
        dueDate: '2026-07-29',
        submissions: [{ studentId: 's1', submitted: true, accuracy: 60 }],
      }),
    ];
    const series = weeklySeries(rows, 2, '2026-07-29');
    expect(series[0].assigned).toBe(1);
    expect(series[1].assigned).toBe(0);
  });

  it('마감일이 없는 배정은 어느 주에도 세지 않는다', () => {
    const rows = [assignment({ id: 'a1', submissions: [{ studentId: 's1', submitted: true }] })];
    expect(weeklySeries(rows, 4, '2026-07-29').every((w) => w.assigned === 0)).toBe(true);
  });

  it('변화는 값이 둘 이상일 때만 낸다', () => {
    expect(deltaOf([null, 70])).toBeNull();
    expect(deltaOf([70, 74])).toBe(4);
  });
});

describe('영역별 정답률', () => {
  it('네 영역을 모두 돌려준다 — 콘텐츠가 없는 영역도 자리를 남긴다', () => {
    const stats = areaBreakdown(ALL, SEED_CONTENT);
    expect(stats.map((s) => s.area)).toEqual(['문학', '독서', '화법과 작문', '문법']);
    const speech = stats.find((s) => s.area === '화법과 작문')!;
    expect(speech.questions).toBe(0);
    expect(speech.accuracy).toBeNull();
    expect(speech.enough).toBe(false);
  });

  it('문항 20개 미만이면 단정하지 않는다', () => {
    const rows = [
      assignment({
        id: 'a1',
        contentId: 'ct_read_1',
        questionCount: 10,
        submissions: [{ studentId: 's1', submitted: true, accuracy: 50 }],
      }),
    ];
    const read = areaBreakdown(rows, SEED_CONTENT).find((s) => s.area === '독서')!;
    expect(read.questions).toBe(10);
    expect(read.enough).toBe(false);
  });

  /**
   * Q-037. 학생 상세는 "이 학생이 배정받은 배정"을 넘겼지만 배정은 반 단위라 그 안에 다른
   * 학생의 제출 행이 함께 있었다 → 한 건도 내지 않은 학생의 화면에 반 평균이 떴다.
   */
  describe('학생 필터', () => {
    const rows = [
      assignment({
        id: 'a1',
        contentId: 'ct_read_1',
        questionCount: 10,
        submissions: [
          { studentId: 's1', submitted: true, accuracy: 40 },
          { studentId: 's2', submitted: true, accuracy: 80 },
          { studentId: 's3', submitted: false },
        ],
      }),
    ];

    it('학생을 지정하지 않으면 배정의 모든 제출을 센다 — 대시보드의 값은 그대로다', () => {
      const read = areaBreakdown(rows, SEED_CONTENT).find((s) => s.area === '독서')!;
      expect(read.questions).toBe(20);
      expect(read.accuracy).toBe(60);
      // 인자를 주지 않는 호출부(`app/academy/index.tsx`)는 시드 전체에서도 값이 같아야 한다.
      expect(areaBreakdown(ALL, SEED_CONTENT)).toEqual(areaBreakdown(ALL, SEED_CONTENT, undefined));
    });

    it('학생을 지정하면 그 학생의 제출만 센다', () => {
      const s1 = areaBreakdown(rows, SEED_CONTENT, 's1').find((s) => s.area === '독서')!;
      expect(s1.questions).toBe(10);
      expect(s1.accuracy).toBe(40);
      const s2 = areaBreakdown(rows, SEED_CONTENT, 's2').find((s) => s.area === '독서')!;
      expect(s2.questions).toBe(10);
      expect(s2.accuracy).toBe(80);
    });

    it('한 건도 내지 않은 학생은 모든 영역이 비어 있다 — 반 평균을 그 학생 값으로 말하지 않는다', () => {
      const stats = areaBreakdown(rows, SEED_CONTENT, 's3');
      expect(stats).toHaveLength(4);
      expect(stats.every((s) => s.questions === 0)).toBe(true);
      expect(stats.every((s) => s.accuracy === null)).toBe(true);
      expect(stats.every((s) => s.enough === false)).toBe(true);
    });

    it('배정받지 않은 학생을 지정하면 아무것도 세지 않는다', () => {
      const stats = areaBreakdown(rows, SEED_CONTENT, 's_none');
      expect(stats.every((s) => s.questions === 0 && s.accuracy === null)).toBe(true);
    });

    it('시드: 한 건도 내지 않은 박도윤의 영역별은 비어 있다 — 화면의 `평균 정답률 —`과 같은 말을 한다', () => {
      const student = 'u_student_academy';
      const mine = ALL.filter((a) => a.submissions.some((s) => s.studentId === student));
      expect(mine.length).toBeGreaterThan(0);
      // 학생을 지정하지 않으면 같은 반 다른 학생들의 제출이 섞여 값이 잡혔다(Q-037의 증상).
      expect(areaBreakdown(mine, SEED_CONTENT).some((s) => s.questions > 0)).toBe(true);
      expect(areaBreakdown(mine, SEED_CONTENT, student).every((s) => s.questions === 0)).toBe(true);
    });
  });
});

describe('다시 다룰 문항', () => {
  /** 한 명이 풀고 한 명이 틀린 문항은 오답률 100%라 정렬만으로는 늘 맨 위에 선다. */
  it('표본이 충분한 문항을 먼저 준다 — 1명 중 1명이 39명 중 21명을 밀어내지 않는다', () => {
    const set = SEED_CONTENT.find((s) => s.questions.length >= 3)!;
    const [q1, q2] = set.questions;
    const rows = [
      assignment({
        id: 'a1',
        contentId: set.id,
        questionCount: set.questions.length,
        submissions: [
          // q1: 1명 중 1명 오답(100%)
          { studentId: 's1', submitted: true, accuracy: 50, wrongQIds: [q1.id] },
        ],
      }),
      assignment({
        id: 'a2',
        contentId: set.id,
        questionCount: set.questions.length,
        // q2: 표본 HARD_MIN_ANSWERS명 이상, 과반이 오답
        submissions: Array.from({ length: HARD_MIN_ANSWERS + 1 }, (_, i) => ({
          studentId: `p${i}`,
          submitted: true,
          accuracy: 50,
          wrongQIds: i < HARD_MIN_ANSWERS ? [q2.id] : [],
        })),
      }),
    ];
    const top = hardestQuestions(rows, SEED_CONTENT, 5);
    expect(top[0].questionId).toBe(q2.id);
    expect(top[0].answered).toBeGreaterThanOrEqual(HARD_MIN_ANSWERS);
    // 표본이 적은 문항을 지우지는 않는다 — 뒤로 보낼 뿐이다.
    expect(top.map((r) => r.questionId)).toContain(q1.id);
  });
});

describe('정답률 분포', () => {
  it('구간 10개를 모두 유지하고 학생 수로 센다', () => {
    const rows = [
      assignment({
        id: 'a1',
        submissions: [
          { studentId: 's1', submitted: true, accuracy: 95 },
          { studentId: 's2', submitted: true, accuracy: 95 },
          { studentId: 's3', submitted: false },
        ],
      }),
    ];
    const buckets = accuracyDistribution(rows);
    expect(buckets).toHaveLength(10);
    expect(buckets.reduce((n, b) => n + b.students, 0)).toBe(2);
    expect(buckets[9].students).toBe(2);
  });
});

describe('학년별', () => {
  it('학년이 있는 반만 학년으로 묶고, 학년을 이름에서 추측하지 않는다', () => {
    const classes = [
      { id: 'c1', academyName: 'A', name: '고2 국어 1반', teacherId: 't', studentIds: ['s1'] },
      { id: 'c2', academyName: 'A', name: '고1 국어 1반', teacherId: 't', studentIds: ['s2'], grade: 1 as const },
    ];
    const stats = gradeBreakdown(classes, []);
    expect(stats.map((g) => g.label)).toEqual(['고1', '학년 미정']);
  });
});

describe('배정 이력 합성 데이터', () => {
  const history = assignmentHistory();

  it('결정적이다 — 두 번 불러도 같은 값이다', () => {
    expect(assignmentHistory()).toBe(history);
    expect(history.length).toBeGreaterThan(300);
  });

  it('시드 배정을 건드리지 않는다 — c_kor1·c_kor2에는 이력을 만들지 않는다', () => {
    expect(ASSIGNMENTS_SEED).toHaveLength(4);
    expect(history.some((a) => a.classId === 'c_kor1' || a.classId === 'c_kor2')).toBe(false);
  });

  it('모든 배정에 마감일과 콘텐츠가 있고 문항 수가 콘텐츠와 맞는다', () => {
    for (const a of history) {
      expect(a.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const set = SEED_CONTENT.find((s) => s.id === a.contentId);
      expect(set).toBeDefined();
      expect(a.questionCount).toBe(set!.questions.length);
    }
  });

  it('제출일은 마감일보다 늦지 않고, 기준일 뒤로는 만들지 않는다', () => {
    for (const a of history) {
      for (const s of a.submissions) {
        if (!s.submitted) continue;
        expect(s.submittedAt).toBeDefined();
        expect(s.submittedAt! <= a.dueDate!).toBe(true);
        expect(s.submittedAt! <= '2026-07-28').toBe(true);
      }
    }
  });

  it('반 학생 전원에게 제출 행이 있고, 안 낸 행에는 정답률이 없다', () => {
    const classById = new Map(ACADEMY_CLASSES.map((c) => [c.id, c]));
    for (const a of history) {
      expect(a.submissions).toHaveLength(classById.get(a.classId)!.studentIds.length);
      for (const s of a.submissions) {
        if (s.submitted) expect(typeof s.accuracy).toBe('number');
        else expect(s.accuracy).toBeUndefined();
      }
    }
  });

  it('26주 창을 실제로 채운다 — 추이선의 점이 이어진다', () => {
    const series = weeklySeries(history, 26, '2026-07-29');
    expect(series.filter((w) => w.rate != null).length).toBeGreaterThanOrEqual(24);
  });

  it('배정이 없는 반이 남아 있다 — `배정 없는 반`도 진짜 값이다', () => {
    const withWork = new Set(history.map((a) => a.classId));
    expect(ACADEMY_CLASSES.some((c) => !withWork.has(c.id))).toBe(true);
  });
});

describe('원장·선생님이 보는 범위', () => {
  const director = getAccount('u_academy_director') as Account;
  const teacher = getAccount('u_academy_teacher') as Account;

  it('원장은 학원 전체, 선생님은 담당 반만 본다', () => {
    const wide = scopedAssignments(getClassesForAccount(director), ALL);
    const narrow = scopedAssignments(getClassesForAccount(teacher), ALL);
    expect(narrow.length).toBeGreaterThan(0);
    expect(wide.length).toBeGreaterThan(narrow.length);
    const mine = new Set(getClassesForAccount(teacher).map((c) => c.id));
    expect(narrow.every((a) => mine.has(a.classId))).toBe(true);
  });

  it('선생님도 추이·분포·영역별을 그릴 만큼 데이터가 있다', () => {
    const narrow = scopedAssignments(getClassesForAccount(teacher), ALL);
    expect(weeklySeries(narrow, 12, '2026-07-29').filter((w) => w.rate != null).length)
      .toBeGreaterThanOrEqual(8);
    expect(accuracyDistribution(narrow).reduce((n, b) => n + b.students, 0)).toBeGreaterThan(20);
    expect(hardestQuestions(narrow, SEED_CONTENT, 5).length).toBeGreaterThan(0);
  });

  it('반별 수행률은 제출률이 낮은 반부터 주고 배정 없는 반을 뒤로 보낸다', () => {
    const classes = getClassesForAccount(director);
    const perf = classPerformance(classes, scopedAssignments(classes, ALL));
    const rated = perf.filter((p) => p.rate != null);
    expect(rated.length).toBeGreaterThan(20);
    for (let i = 1; i < rated.length; i += 1) expect(rated[i - 1].rate!).toBeLessThanOrEqual(rated[i].rate!);
    expect(perf[perf.length - 1].rate).toBeNull();
  });

  it('반 인덱스는 전체를 다시 훑지 않고 같은 결과를 준다', () => {
    const index = byClass(ALL);
    expect(index.get('c_kor1')).toHaveLength(1);
    expect(index.get('c_kor2')).toHaveLength(3);
  });
});

describe('학생 한 명', () => {
  it('낸 것과 안 낸 것을 가르고, 개인 학습은 들어오지 않는다', () => {
    const perf = studentPerformance('u_student_academy', ALL);
    // 박도윤은 c_kor1의 미제출 계정이다.
    expect(perf.assigned).toBe(1);
    expect(perf.submitted).toBe(0);
    expect(perf.pending).toHaveLength(1);
    expect(perf.accuracy).toBeNull();
  });

  it('낸 과제는 제출일 늦은 순이고 반 평균을 함께 준다', () => {
    const perf = studentPerformance('u_student_both', ALL);
    expect(perf.rows.length).toBeGreaterThan(0);
    expect(perf.rows[0].submission.submittedAt).toBe('2026-07-25');
    expect(perf.rows[0].classAvg).not.toBeNull();
    expect(perf.trend.length).toBe(perf.rows.filter((r) => r.submission.accuracy != null).length);
  });
});
