/*
  배정 대상 판정.

  **반 소속이 아니라 배정 대상 행이 배정 사실이다.** 대상 행은 배정하는 순간의 로스터로 한 번
  박히고(`rpc_add_assignment`가 `v_class_roster`에서 넣는다) 반에 나중에 들어온 학생에게
  소급되지 않는다 — `addStudentsToClass`도 지난 배정을 채우지 않는다.

  서버 제출 검사가 이미 그 기준이다(`rpc_submit_attempt` → `배정받은 학습이 아니에요.`).
  학생 화면(`buildStudentItems`)과 학부모 리포트(`buildChildReport`의 `pending`)가 같은 기준을
  쓰는지 여기서 지킨다. 어긋나면 학생은 끝까지 풀고 제출에서 거부당하고, 학부모 홈에는 마감이
  지난 유령 미제출이 영구히 남는다.
*/
import { buildStudentItems } from '@/features/learning';
import { buildChildReport } from '@/features/report';
import { ASSIGNMENTS_SEED, SEED_CONTENT, ACADEMY_CLASSES, getAccount } from '@/data/seed';
import { EXTRA_CONTENT } from '@/data/contentExtra';
import type { Assignment } from '@/data';

const SETS = [...SEED_CONTENT, ...EXTRA_CONTENT];
/** 시드가 2026-07 기준이다. */
const TODAY = '2026-07-28';

/** 박도윤: 학원 이용권만, 고1 국어(`c_kor1`) 소속. `a_kor1_1`을 아직 안 냈다. */
const CHILD = 'u_student_academy';
const CHILD_CLASS = 'c_kor1';

function classIdsOf(childId: string): string[] {
  return ACADEMY_CLASSES.filter((c) => c.studentIds.includes(childId)).map((c) => c.id);
}

/**
 * 박도윤이 반에 들어오기 **전에** 나간 배정. 반은 같지만 그 학생의 대상 행이 없다 —
 * 원장이 나중에 반에 넣어도 이 배정은 그 학생 것이 되지 않는다.
 */
const BEFORE_JOIN: Assignment = {
  id: 'a_before_join',
  classId: CHILD_CLASS,
  subject: '국어',
  title: '들어오기 전에 나간 과제',
  questionCount: 10,
  contentId: 'ct_acad_1',
  dueDate: '2026-07-10',
  submissions: [{ studentId: 'u_rs_0001', submitted: true, accuracy: 70 }],
};

const WITH_BEFORE_JOIN = [...ASSIGNMENTS_SEED, BEFORE_JOIN];

describe('학생 화면: 배정 대상 행이 있는 과제만 받는다', () => {
  const items = () =>
    buildStudentItems({
      sets: SETS,
      account: getAccount(CHILD)!,
      attempts: {},
      assignments: WITH_BEFORE_JOIN,
      academyLinked: true,
      answers: {},
    });

  it('반에 나중에 들어와도 지난 배정은 목록에 없다', () => {
    expect(items().academy.map((i) => i.id)).not.toContain(BEFORE_JOIN.id);
  });

  it('대상 행이 있는 과제는 그대로 보인다', () => {
    // 이 단정이 없으면 위 테스트는 목록이 비어서도 통과한다.
    expect(items().academy.map((i) => i.id)).toContain('a_kor1_1');
  });

  it('소속하지 않은 반의 과제도 대상 행이 없으면 보이지 않는다', () => {
    // `c_kor2`(고2 국어)에는 박도윤이 없고 대상 행도 없다.
    expect(items().academy.map((i) => i.id)).not.toContain('a_kor2_1');
  });
});

describe('학부모 리포트: 미제출도 같은 기준으로 센다', () => {
  const report = (assignments: readonly Assignment[]) =>
    buildChildReport(CHILD, {
      assignments,
      attempts: {},
      wrongNotes: [],
      sets: SETS,
      today: TODAY,
      classIds: classIdsOf(CHILD),
    });

  it('반 소속만 있고 대상 행이 없는 배정은 미제출에 들어오지 않는다', () => {
    const r = report(WITH_BEFORE_JOIN);
    expect(r.pending.map((p) => p.id)).not.toContain(BEFORE_JOIN.id);
    // 마감이 지난 배정이라 들어왔다면 `지금 확인할 것`에 영구히 남았을 자리다.
    expect(r.pending.map((p) => p.id)).toEqual(report(ASSIGNMENTS_SEED).pending.map((p) => p.id));
  });

  it('대상 행이 있고 아직 안 낸 과제는 그대로 센다', () => {
    const r = report(WITH_BEFORE_JOIN);
    expect(r.pending.map((p) => p.id)).toContain('a_kor1_1');
    expect(r.now.pending).toBe(r.pending.length);
  });

  it('낸 과제는 미제출에서 빠진다', () => {
    const submitted = WITH_BEFORE_JOIN.map((a) =>
      a.id === 'a_kor1_1'
        ? {
            ...a,
            submissions: a.submissions.map((s) =>
              s.studentId === CHILD
                ? { ...s, submitted: true, submittedAt: '2026-07-24', accuracy: 60 }
                : s,
            ),
          }
        : a,
    );
    expect(report(submitted).pending).toHaveLength(0);
  });
});

describe('두 화면이 같은 사실을 말한다', () => {
  it('학생 목록에 없는 과제는 학부모 미제출에도 없다', () => {
    const academy = new Set(
      buildStudentItems({
        sets: SETS,
        account: getAccount(CHILD)!,
        attempts: {},
        assignments: WITH_BEFORE_JOIN,
        academyLinked: true,
        answers: {},
      }).academy.map((i) => i.id),
    );
    const pending = buildChildReport(CHILD, {
      assignments: WITH_BEFORE_JOIN,
      attempts: {},
      wrongNotes: [],
      sets: SETS,
      today: TODAY,
      classIds: classIdsOf(CHILD),
    }).pending;
    for (const row of pending) {
      // 학부모가 "안 냈어요"라고 읽는 과제는 학생 화면에 반드시 있어야 한다 — 없으면 낼 길이 없다.
      expect(academy.has(row.id)).toBe(true);
    }
    expect(pending.length).toBeGreaterThan(0);
  });
});
