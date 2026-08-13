import { ACADEMIES } from '@/data/academies';
import { activityOf } from '@/data/activity';
import { ANCHOR_INDEX, DATA_ANCHOR } from '@/data/calendar';
import {
  canceledPersonalAt,
  hasLearningRecords,
  isActiveEntitlement,
  lastActiveAtOf,
  lastActiveLabelOf,
  startedAtOf,
  supportCodeOf,
} from '@/data/accountMeta';
import {
  CHURN_WINDOW_DAYS,
  activationPredictiveness,
  activationRate,
  activityStats,
  arpu,
  carryingCapacity,
  cohorts,
  growth,
  mondayOf,
  personalGrr,
  seatUsePct,
  shortHistory,
  signupWeekly,
} from '@/features/adminMetrics';
import type { ActivityEvent, AdminOverview, RevenueEstimate, Signup } from '@/repo/admin';
import { findContent, personalItems, submissionStat } from '@/data';
import {
  ACADEMY_CLASSES,
  ACCOUNTS,
  SEED_CONTENT,
  getChildren,
  getClassesForAccount,
  getStudentsInClass,
  ASSIGNMENTS_SEED,
  DEMO_PASSWORD,
  authenticate,
  getAccount,
  getAccountsByRole,
  getLearningItems,
  isScodyIdTaken,
} from '@/data/seed';

describe('테스트 계정 픽스처', () => {
  it('로그인 가능한 테스트 계정은 총괄관리자 포함 9종이다', () => {
    const loginable = ACCOUNTS.filter((a) => a.password);
    expect(loginable).toHaveLength(9);
    expect(loginable.map((a) => a.scodyId)).toEqual([
      'seojun',
      'haeun',
      'doyun',
      'yerin',
      'minji',
      'hanbit.director',
      'hanbit.teacher',
      'jihoon',
      'admin',
    ]);
  });

  it('로그인 가능한 계정의 역할별 수', () => {
    const byRole = (role: 'student' | 'parent' | 'academy' | 'admin') =>
      getAccountsByRole(role).filter((a) => a.password);
    expect(byRole('student')).toHaveLength(4);
    expect(byRole('parent')).toHaveLength(2);
    expect(byRole('academy')).toHaveLength(3);
    expect(byRole('admin')).toHaveLength(1);
  });

  it('규모용 로스터는 로그인할 수 없고 학원 규모를 만든다', () => {
    const roster = ACCOUNTS.filter((a) => !a.password);
    expect(roster.length).toBeGreaterThan(1000);
    /*
      로스터에는 두 종류가 있다. 학원 소속(선생·원장·재원생)과 **학원 밖 개인 사용자**다.
      예전에는 학원이 한 곳(한빛학원)뿐이고 전원이 학원 소속이라 그 이름을 직접 단정했는데,
      운영자 지표를 위해 둘 다 늘렸다 — 학원이 하나면 학원 수·원장 수·이탈률을 볼 수 없고,
      개인 사용자가 없으면 무료 사용자가 0명이어서 ARPU가 ARPPU보다 커진다(실측).
    */
    expect(roster.some((a) => !!a.academyName)).toBe(true);
    expect(roster.some((a) => !a.academyName && a.roles.includes('student'))).toBe(true);
    // 학원 소속인 계정은 반드시 알려진 학원에 속한다(오타로 만든 학원이 생기지 않게)
    const names = new Set(ACADEMIES.map((a) => a.name));
    expect(roster.every((a) => !a.academyName || names.has(a.academyName))).toBe(true);
    // 비밀번호가 없어 어떤 값으로도 로그인되지 않는다
    expect(authenticate('hanbit.s0001', 'test1234')).toBeUndefined();
    expect(authenticate('hanbit.t01', '')).toBeUndefined();
    expect(authenticate('daechi.director', 'test1234')).toBeUndefined();
  });

  it('학원이 여러 곳이고 학원마다 원장이 있다', () => {
    // 원장 수를 세려면 로스터에 원장이 있어야 한다. 예전에는 0명이었다.
    const active = ACADEMIES.filter((a) => a.status === 'active');
    expect(ACADEMIES.length).toBeGreaterThan(1);
    expect(active.length).toBeLessThan(ACADEMIES.length); // 이탈한 학원이 하나는 있다
    const directors = ACCOUNTS.filter((a) => a.academyRole === 'director');
    expect(directors.length).toBe(ACADEMIES.length);
    // 계약 좌석은 재원생보다 적지 않다(좌석 활용률이 100%를 넘지 않게)
    for (const ac of ACADEMIES) {
      const seats = new Set(
        ACADEMY_CLASSES.filter((c) => c.academyName === ac.name).flatMap((c) => c.studentIds),
      ).size;
      expect(ac.contractSeats).toBeGreaterThanOrEqual(seats);
    }
  });

  it('학원 이용권만 가진 학생은 개인 이용권이 없다', () => {
    expect(getAccount('u_student_academy')!.entitlements.map((e) => e.kind)).toEqual(['academy']);
  });

  it('개인·학원 이용권은 한 학생에게 동시에 존재할 수 있다', () => {
    const kinds = getAccount('u_student_both')!.entitlements.map((e) => e.kind).sort();
    expect(kinds).toEqual(['academy', 'personal']);
  });

  it('다역할 계정은 여러 역할을 가진다', () => {
    expect(getAccount('u_teacher_parent')!.roles.sort()).toEqual(['academy', 'parent']);
  });
});

describe('인증', () => {
  it('올바른 아이디/비밀번호로 로그인된다', () => {
    expect(authenticate('yerin', DEMO_PASSWORD)?.userId).toBe('u_student_both');
  });
  it('대소문자·공백을 무시한다', () => {
    expect(authenticate('  YERIN ', DEMO_PASSWORD)?.userId).toBe('u_student_both');
  });
  it('잘못된 비밀번호는 실패한다', () => {
    expect(authenticate('yerin', 'wrong')).toBeUndefined();
  });
  it('총괄관리자로 로그인된다', () => {
    expect(authenticate('admin', DEMO_PASSWORD)?.roles).toEqual(['admin']);
  });
});

/*
  초대 토큰 조회를 fixture에서 확인하던 자리다. 토큰은 이제 서버가 답한다
  (`inviteInfo` → `rpc_invite_info`). 링크 진입은 E2E가 확인한다(`auth-flow.spec.ts`).
*/

describe('국어 콘텐츠', () => {
  it('시드 콘텐츠는 모두 국어다', () => {
    for (const c of SEED_CONTENT) expect(c.subject).toBe('국어');
  });

  it('지문형은 지문을, 문법형은 지문이 없다', () => {
    const passage = SEED_CONTENT.find((c) => c.kind === 'passage')!;
    const grammar = SEED_CONTENT.find((c) => c.kind === 'grammar')!;
    expect(passage.passage?.body.length).toBeGreaterThan(0);
    expect(grammar.passage).toBeUndefined();
  });

  it('모든 문항의 정답 인덱스가 보기 범위 안에 있다', () => {
    for (const c of SEED_CONTENT) {
      for (const q of c.questions) {
        expect(q.answerIndex).toBeGreaterThanOrEqual(0);
        expect(q.answerIndex).toBeLessThan(q.choices.length);
      }
    }
  });

  it('문법 정답이 실제 맞춤법과 일치한다(웬일)', () => {
    const q = findContent(SEED_CONTENT, 'ct_gram_1')!.questions[0];
    expect(q.choices[q.answerIndex]).toContain('웬일');
  });

  it('공개 콘텐츠만 학생 개인 학습으로 노출된다', () => {
    const items = personalItems(SEED_CONTENT);
    const published = SEED_CONTENT.filter((c) => c.publishToStudents);
    expect(items).toHaveLength(published.length);
    expect(items.every((i) => i.source === 'personal' && i.subject === '국어')).toBe(true);
    // 학원 전용 콘텐츠는 개인 학습에 없다
    expect(findContent(SEED_CONTENT, 'ct_acad_1')!.publishToStudents).toBe(false);
    expect(items.some((i) => i.contentId === 'ct_acad_1')).toBe(false);
  });

  it('학생이 풀 문항이 충분히 준비돼 있다', () => {
    const published = SEED_CONTENT.filter((c) => c.publishToStudents);
    expect(published.length).toBeGreaterThanOrEqual(10);
    const questionCount = published.reduce((n, c) => n + c.questions.length, 0);
    expect(questionCount).toBeGreaterThanOrEqual(120);
    // 세트 하나가 3~4문항짜리로 남지 않게 한다
    for (const set of SEED_CONTENT) {
      expect(set.questions.length).toBeGreaterThanOrEqual(10);
    }
    // 영역이 한쪽으로 몰리지 않는다
    expect(new Set(published.map((c) => c.area)).size).toBeGreaterThanOrEqual(3);
    // 모든 문항은 보기 4개와 유효한 정답을 가진다
    for (const set of SEED_CONTENT) {
      for (const q of set.questions) {
        expect(q.choices).toHaveLength(4);
        expect(q.answerIndex).toBeGreaterThanOrEqual(0);
        expect(q.answerIndex).toBeLessThan(q.choices.length);
      }
    }
  });

  it('콘텐츠와 문항 id는 중복되지 않는다', () => {
    const ids = SEED_CONTENT.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const qIds = SEED_CONTENT.flatMap((c) => c.questions.map((q) => q.id));
    expect(new Set(qIds).size).toBe(qIds.length);
  });
});

describe('학원 배정 학습', () => {
  it('학생은 학원이 배정한 학습만 fixtures에 가진다', () => {
    const items = getLearningItems('u_student_both');
    expect(items.every((i) => i.source === 'academy')).toBe(true);
    expect(items[0].contentId).toBe('ct_acad_1');
  });
  it('재실행해도 동일 결과(결정적)', () => {
    expect(getLearningItems('u_student_academy')).toEqual(getLearningItems('u_student_academy'));
  });
});

/*
  `mergeResult` 테스트는 여기서 지웠다. **검증이 사라진 것이 아니라 옮겨 갔다** —
  정답률 계산은 이제 서버가 한다(`rpc_submit_attempt`). 클라이언트가 보낸 정답 수를 믿지 않으므로
  그 함수도 사라졌다.

  새 검증 자리: `scripts/verify-rls.ts`의 `[제출]` 절이 일부러 한 문항을 틀리게 골라 보내고
  `서버가 채점했다: 9/10 = 90%`를 단정한다. `npm run db:verify`로 돌린다.
*/

describe('학부모-자녀 (M3)', () => {
  it('학부모의 연결된 자녀를 반환한다', () => {
    expect(getChildren('u_parent').map((c) => c.userId)).toEqual([
      'u_student_parentpaid',
      'u_student_both',
    ]);
  });
  it('공개된 개인 학습은 자녀 리포트에서 볼 수 있다', () => {
    expect(personalItems(SEED_CONTENT).length).toBeGreaterThan(0);
  });
});

describe('학원 (M4)', () => {
  const director = getAccount('u_academy_director')!;
  const teacherKor = getAccount('u_academy_teacher')!; // 고1 국어
  const teacherKor2 = getAccount('u_teacher_parent')!; // 고2 국어

  it('원장은 학원 전체 반을, 선생님은 담당 반만 본다', () => {
    const directorClasses = getClassesForAccount(director).map((c) => c.id);
    // 원장은 테스트 계정 반과 규모용 반을 모두 본다
    expect(directorClasses).toContain('c_kor1');
    expect(directorClasses).toContain('c_kor2');
    expect(directorClasses.length).toBeGreaterThanOrEqual(30);
    // 선생님은 자기 담당 반만. 담당 반이 하나뿐이면 선생님 대시보드의 추이·분포가 통째로
    // 비어서, 로스터 반을 학년에 맞춰 나눠 줬다(`roster.ts`의 `TEACHER_OVERRIDE`).
    expect(getClassesForAccount(teacherKor).map((c) => c.id)).toEqual([
      'c_kor1',
      'c_hanbit_03',
      'c_hanbit_06',
      'c_hanbit_09',
    ]);
    expect(getClassesForAccount(teacherKor2).map((c) => c.id)).toEqual([
      'c_kor2',
      'c_hanbit_43',
      'c_hanbit_46',
      'c_hanbit_49',
    ]);
  });

  it('선생님 담당 반은 학년이 섞이지 않는다', () => {
    expect(getClassesForAccount(teacherKor).every((c) => c.grade === 1)).toBe(true);
    expect(getClassesForAccount(teacherKor2).every((c) => c.grade === 2)).toBe(true);
  });

  it('모든 반에 학년이 있다 — 반 이름을 파싱하지 않으려고 둔 값이다', () => {
    expect(getClassesForAccount(director).every((c) => c.grade != null)).toBe(true);
  });

  it('규모용 학원은 반 30개·선생님 30명·학생 1000명 이상이다', () => {
    const classes = getClassesForAccount(director);
    expect(classes.length).toBeGreaterThanOrEqual(30);
    const teachers = new Set(classes.map((c) => c.teacherId));
    expect(teachers.size).toBeGreaterThanOrEqual(30);
    const students = new Set(classes.flatMap((c) => c.studentIds));
    expect(students.size).toBeGreaterThan(1000);
  });

  it('반의 학생을 반환한다', () => {
    // 테스트 계정 두 명이 앞에 오고, 반 비교용 친구가 뒤에 붙는다.
    const ids = getStudentsInClass('c_kor1').map((s) => s.userId);
    expect(ids.slice(0, 2)).toEqual(['u_student_both', 'u_student_academy']);
    expect(ids).toHaveLength(9);
    // 반 친구는 로그인할 수 없다(전화·비밀번호 없음).
    const peers = getStudentsInClass('c_kor1').slice(2);
    expect(peers.every((s) => !s.phone && !s.password)).toBe(true);
  });

  it('제출 현황 통계를 계산한다', () => {
    // 반 비교가 뜻을 가지려면 제출자가 여러 명이어야 한다(박도윤만 미제출).
    const a = ASSIGNMENTS_SEED.find((x) => x.id === 'a_kor1_1')!;
    expect(submissionStat(a)).toEqual({ submitted: 8, total: 9, avgAccuracy: 76 });
  });
});

describe('중복 계정 방지 (M5)', () => {
  it('이미 있는 아이디는 사용 중으로 본다', () => {
    expect(isScodyIdTaken('yerin')).toBe(true);
    expect(isScodyIdTaken('  YERIN ')).toBe(true);
  });
  it('없는 아이디는 사용 가능하다', () => {
    expect(isScodyIdTaken('brandnew')).toBe(false);
  });
});

describe('합성 활동 데이터', () => {
  /**
   * 결정적이어야 한다. 새로고침마다 지표가 달라지면 무엇을 믿어야 할지 알 수 없고
   * E2E도 고정할 수 없다(D-018이 콘텐츠 집계에 세운 규칙과 같다).
   */
  it('같은 계정은 항상 같은 활동을 만든다', () => {
    const a = activityOf('u_rs_0500');
    const b = activityOf('u_rs_0500');
    expect(a.days).toEqual(b.days);
    expect(a.joinWeek).toBe(b.joinWeek);
  });

  it('가입 주 이전에는 활동하지 않는다', () => {
    // 코호트 Day 0이 어긋나면 리텐션이 전부 틀어진다.
    for (const id of ['u_rs_0001', 'u_rs_1500', 'u_solo_0100', 'u_as_1_1_1']) {
      const p = activityOf(id);
      expect(p.days.every((d) => d >= p.joinWeek * 7)).toBe(true);
    }
  });

  it('기준일보다 뒤에는 활동하지 않는다', () => {
    // 미래 활동이 섞이면 마지막 주가 실제보다 커 보인다.
    for (const id of ['u_rs_0002', 'u_solo_0001']) {
      expect(activityOf(id).days.every((d) => d <= ANCHOR_INDEX)).toBe(true);
    }
  });

  it('완료한 날은 활동한 날의 부분집합이다', () => {
    const p = activityOf('u_rs_0777');
    const days = new Set(p.days);
    expect(p.doneDays.every((d) => days.has(d))).toBe(true);
  });

  it('고객지원 코드는 계정마다 다르다', () => {
    // 겹치면 상담원이 남의 계정을 연다.
    const seen = new Set(ACCOUNTS.map((a) => supportCodeOf(a.userId)));
    expect(seen.size).toBe(ACCOUNTS.length);
  });

  it('고객지원 코드에 혼동하는 글자를 쓰지 않는다', () => {
    // 전화로 불러 줄 값이라 0/O·1/I·L·U를 뺀다.
    const code = supportCodeOf('u_student_both');
    expect(code).toMatch(/^[2-9A-HJ-KM-NP-TV-Z]{3}-[2-9A-HJ-KM-NP-TV-Z]{3}$/);
  });
});

/*
  운영자 지표는 **순수 함수 + 서버 스냅샷**이다. 예전에는 합성 활동 데이터(4천 계정 × 26주)를
  전역에서 읽어 계산했고 테스트도 그 전역에 기대 있었다. 이제 입력을 인자로 넘긴다 — 그래서
  "기록이 짧을 때 무엇을 말하는가"를 테스트가 직접 세울 수 있다.
*/

/** `days`일 전 날짜. seed와 같은 규칙(로컬 시계)이다. */
function day(offset: number): string {
  const at = new Date();
  at.setDate(at.getDate() + offset);
  const m = `${at.getMonth() + 1}`.padStart(2, '0');
  const d = `${at.getDate()}`.padStart(2, '0');
  return `${at.getFullYear()}-${m}-${d}`;
}

function event(studentId: string, offset: number, kind: string): ActivityEvent {
  return { studentId, day: day(offset), kind };
}

/** 최근 며칠에 활동한 학생 n명. 하루에 한 명씩 답 저장 + 제출. */
function shortRun(): ActivityEvent[] {
  return [
    event('s1', -5, 'answer_saved'),
    event('s1', -5, 'attempt_submitted'),
    event('s2', -4, 'answer_saved'),
    event('s2', -4, 'attempt_submitted'),
    event('s3', -3, 'answer_saved'),
  ];
}

/** 이탈까지 판정할 수 있는 긴 기록. 한 명은 초반에만, 한 명은 계속 활동한다. */
function longRun(): ActivityEvent[] {
  const out: ActivityEvent[] = [];
  for (let d = 70; d >= 0; d -= 7) out.push(event('steady', -d, 'answer_saved'));
  for (let d = 70; d >= 56; d -= 7) out.push(event('left', -d, 'answer_saved'));
  return out;
}

describe('운영자 지표 — 활동 요약', () => {
  it('활동 기록이 없으면 활성을 0이 아니라 없음으로 준다', () => {
    /*
      0으로 채우면 화면이 "아무도 안 썼다"고 말한다. 사실은 "아직 모른다"다 — 앞의 것은
      사고로 읽히고 뒤의 것은 기다림이다.
    */
    const s = activityStats([], [], 10);
    expect(s.firstDay).toBeUndefined();
    expect(s.mau).toBeNull();
    expect(s.wau).toBeNull();
    expect(s.wal).toBeNull();
    expect(s.l7).toBeNull();
    expect(s.recordedDays).toBe(0);
  });

  it('MAU는 28일 창을 쓰고 WAU보다 작지 않다', () => {
    const s = activityStats(shortRun(), [], 10);
    expect(s.mau).toBeGreaterThanOrEqual(s.wau!);
    expect(s.wal).toBeLessThanOrEqual(s.wau!);
  });

  it('같은 사람이 같은 주에 여러 날 활동해도 한 번만 센다', () => {
    const events = [
      event('s1', -1, 'answer_saved'),
      event('s1', -2, 'answer_saved'),
      event('s1', -3, 'answer_saved'),
    ];
    expect(activityStats(events, [], 5).wau).toBe(1);
  });

  it('완성되지 않은 주는 주간 계열에 넣지 않는다', () => {
    // 주 중간에 끊긴 마지막 점은 2~3일치라 값이 절반으로 떨어져 사고처럼 읽힌다.
    const s = activityStats(shortRun(), [], 10);
    for (const w of s.weekLabels) {
      expect(mondayOf(w)).toBe(w);
      expect(w < day(0)).toBe(true);
    }
    expect(s.wauWeekly).toHaveLength(s.weekLabels.length);
    expect(s.mauWeekly).toHaveLength(s.weekLabels.length);
  });

  it('L7 분포에 0일 버킷이 있고 합계가 학생 수와 같다', () => {
    /*
      `0일`을 지우면 분모가 화면에서 사라진다 — 최근 7일에 아무것도 하지 않은 학생이 가장 큰
      집단인데, 그것을 빼 놓고 "분산을 드러낸다"고 말할 수 없다.
    */
    const bars = activityStats(shortRun(), [], 10).l7!;
    expect(bars.map((b) => b.days)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(bars.reduce((n, b) => n + b.count, 0)).toBe(10);
  });

  it('DAU는 일별 활동 뷰가 센 값을 쓴다', () => {
    // 하루치를 더해 기간 중복 제거 수를 만들 수 없으므로 두 입력의 역할을 갈라 둔다.
    const s = activityStats(shortRun(), [{ day: day(0), activeStudents: 7, completedStudents: 2, notesAdded: 0, reviewsDone: 0 }], 10);
    expect(s.dau).toBe(7);
  });
});

describe('운영자 지표 — 기록이 짧을 때', () => {
  const short = activityStats(shortRun(), [], 10);

  it('이탈 창보다 짧은 기록에서는 성장 구성을 만들지 않고 이유를 준다', () => {
    const g = growth(shortRun(), short);
    expect(g.weeks).toHaveLength(0);
    expect(g.reason).toContain(`${CHURN_WINDOW_DAYS + 7}일`);
  });

  it('적재용량은 성장 구성이 없으면 값을 만들지 않는다', () => {
    const cc = carryingCapacity(growth(shortRun(), short), short.mau);
    expect(cc.capacity).toBeNull();
    expect(cc.usedPct).toBeNull();
    expect(cc.reason).toBeTruthy();
  });

  it('기록 시작 전에 가입한 코호트는 줄을 만들지 않는다', () => {
    /*
      그 사람들의 W0~Wn에 활동이 없는 것은 안 했기 때문이 아니라 **우리가 안 봤기 때문**이다.
      0%로 적으면 화면이 "전원 이탈"이라고 말한다.
    */
    const signups: Signup[] = [{ userId: 's1', day: day(-90) }];
    const c = cohorts(signups, shortRun(), short);
    expect(c.rows).toHaveLength(0);
    expect(c.reason).toContain(short.firstDay!);
  });

  it('Activation은 관찰하지 못한 코호트로 계산하지 않는다', () => {
    const signups: Signup[] = [{ userId: 's1', day: day(-90) }];
    expect(activationRate(signups, shortRun(), short).value).toBeNull();
    const p = activationPredictiveness(signups, shortRun(), short);
    expect(p.ratio).toBeNull();
    expect(p.reason).toBeTruthy();
  });

  it('짧은 기록을 말하는 문장에 실제 기록 길이가 들어간다', () => {
    const reason = shortHistory(short, 35);
    expect(reason).toContain(`${short.recordedDays}일치`);
    expect(shortHistory(short, 1)).toBeNull();
  });
});

describe('운영자 지표 — 기록이 충분할 때', () => {
  const long = activityStats(longRun(), [], 5);

  it('성장 구성 네 갈래가 서로 겹치지 않는다', () => {
    // 부활을 신규에 섞으면 Quick Ratio가 부풀려진다.
    const g = growth(longRun(), long);
    expect(g.reason).toBeUndefined();
    expect(g.weeks.length).toBeGreaterThan(0);
    for (const w of g.weeks) {
      expect(w.isNew).toBeGreaterThanOrEqual(0);
      expect(w.resurrected).toBeGreaterThanOrEqual(0);
      if (w.churned > 0) {
        expect(w.quickRatio).toBeCloseTo((w.isNew + w.resurrected) / w.churned, 5);
      } else {
        expect(w.quickRatio).toBeNull();
      }
    }
  });

  it('활동을 멈춘 사람이 이탈로 잡힌다', () => {
    // 기록이 창보다 길어야 이 판정이 가능하다 — 짧으면 위 블록처럼 값을 만들지 않는다.
    expect(growth(longRun(), long).weeks.some((w) => w.churned > 0)).toBe(true);
  });

  it('코호트 W0은 100%를 넘지 않고 아직 오지 않은 주는 비어 있다', () => {
    /*
      가입 주는 **기록이 시작된 주보다 뒤**여야 줄이 생긴다. 기록 시작일이 주 중간이면 그 주는
      W0을 온전히 보지 못했으므로 다음 주부터다 — 그래서 한 주 뒤의 월요일을 쓴다.
    */
    const joined = mondayOf(day(-56));
    const signups: Signup[] = [
      { userId: 'steady', day: joined },
      { userId: 'left', day: joined },
    ];
    const rows = cohorts(signups, longRun(), long).rows;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.cells[0]).toBeLessThanOrEqual(100);
      // null 뒤에는 숫자가 오지 않는다(0%로 채우면 떨어진 것처럼 읽힌다).
      const firstNull = r.cells.indexOf(null);
      if (firstNull >= 0) expect(r.cells.slice(firstNull).every((c) => c == null)).toBe(true);
    }
  });

  it('잔존은 그 코호트 사람만 센다', () => {
    // 전체 활동을 세면 코호트가 한 명인데 잔존이 200%가 된다.
    const signups: Signup[] = [{ userId: 'left', day: mondayOf(day(-56)) }];
    const rows = cohorts(signups, longRun(), long).rows;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) for (const c of r.cells) if (c != null) expect(c).toBeLessThanOrEqual(100);
  });

  it('신규 가입 추이는 완성된 주 수와 길이가 같다', () => {
    const signups: Signup[] = [{ userId: 'steady', day: mondayOf(day(-56)) }];
    const weekly = signupWeekly(signups, long.weekLabels);
    expect(weekly).toHaveLength(long.weekLabels.length);
    // 가입 한 건은 정확히 한 주에만 들어간다 — 두 주에 세어지면 신규가 부풀려진다.
    expect(weekly.reduce((n, v) => n + v, 0)).toBe(1);
  });
});

describe('운영자 지표 — 규모와 매출', () => {
  const overview: AdminOverview = {
    asOf: day(0),
    accounts: 24,
    students: 17,
    parents: 2,
    academyStaff: 3,
    academies: 1,
    academiesChurned: 0,
    classes: 2,
    contentSets: 13,
    contentPublished: 11,
    personalActive: 3,
    personalCanceled: 1,
    attemptsTotal: 6,
    mau: 5,
    wau: 3,
    completed28: 4,
  };

  it('GRR은 100%를 넘지 않고 실제 해지 비율과 같다', () => {
    // 확장을 넣지 않으므로 정의상 넘을 수 없다. 넘으면 계산이 틀린 것이다.
    expect(personalGrr(overview)).toBe(75);
    expect(personalGrr(overview)).toBeLessThanOrEqual(100);
    expect(personalGrr({ ...overview, personalActive: 0, personalCanceled: 0 })).toBe(100);
  });

  it('ARPU 분모는 활성 사용자이고, MAU가 없으면 값도 없다', () => {
    const revenue: RevenueEstimate = {
      personal: 60000,
      academy: 168000,
      mrr: 228000,
      arr: 2736000,
      personalCount: 3,
      academySeatCount: 14,
      payingPeople: 15,
      arppu: 15200,
      includesChurned: false,
    };
    expect(arpu(revenue, 5)).toBeCloseTo(228000 / 5, 5);
    // MAU가 없으면 0으로 나누지 않고 값이 없다고 말한다.
    expect(arpu(revenue, null)).toBeNull();
    expect(arpu(revenue, 0)).toBeNull();
  });

  it('좌석 활용률은 계약 중인 학원만 센다', () => {
    const base = {
      contractSeats: 20,
      renewalDate: day(30),
      createdAt: day(-90),
      enrolled: 10,
      classCount: 2,
      teacherCount: 2,
      active28: 3,
    };
    const list = [
      { ...base, id: 'a', name: '한빛', status: 'active' as const },
      { ...base, id: 'b', name: '이탈', status: 'churned' as const, enrolled: 20 },
    ];
    // 이탈 학원을 넣으면 (10+20)/40 = 75%가 되어 실제보다 좋아 보인다.
    expect(seatUsePct(list)).toBe(50);
    expect(seatUsePct([])).toBeNull();
  });
});


describe('개인 구독 해지', () => {
  /** 개인 이용권이 있는 계정. */
  const withPersonal = ACCOUNTS.filter((a) => a.entitlements.some((e) => e.kind === 'personal'));

  it('해지 판정은 Entitlement.status 하나에서만 온다', () => {
    /*
      예전에는 `canceledPersonalAt`이 자기 해시로 다시 10%를 해지로 골라서, 같은 계정이
      개요에서는 `해지`, 계정 표에서는 `개인`, 계정 상세에서는 `이용 중`으로 나왔다.
    */
    expect(withPersonal.length).toBeGreaterThan(0);
    for (const a of withPersonal) {
      const canceled = a.entitlements.some((e) => e.kind === 'personal' && !isActiveEntitlement(e));
      expect(canceledPersonalAt(a) != null).toBe(canceled);
    }
  });

  it('해지일은 시작일보다 이르지 않고 기준일을 넘지 않는다', () => {
    for (const a of withPersonal) {
      const at = canceledPersonalAt(a);
      if (!at) continue;
      const e = a.entitlements.find((x) => x.kind === 'personal')!;
      expect(at >= startedAtOf(a, e)).toBe(true);
      expect(at <= DATA_ANCHOR).toBe(true);
    }
  });

  /*
    여기 있던 두 단정은 옮겨 갔다.
    ------------------------------------------------------------------
    ① `해지한 개인 구독에는 청구하지 않는다` — 매출 계산이 클라이언트에서 사라졌다.
       이제 `rpc_revenue_estimate()`가 `entitlements`를 `canceled_at is null`로 좁혀 센다.
       그 조건은 SQL이라 jest로 확인할 수 없다 — `scripts/verify-rls.ts` 계열의 서버 확인이
       맡을 자리다(아직 없다).
    ② `GRR은 실제 해지 비율과 같다` — `personalGrr(overview)`로 옮겼고
       `운영자 지표 — 규모와 매출` 블록이 살아 있는 건수와 해지 건수로 같은 성질을 단정한다.
  */
});

describe('학습 기록이 없는 역할', () => {
  it('학생이 아닌 계정에는 최근 활동을 만들지 않는다', () => {
    /*
      `activityOf`는 역할을 보지 않고 `userId`만으로 활동을 합성한다. 그대로 쓰면 원장·학부모
      계정에도 활동일이 생겨 "국어 문항을 풀었다"는 뜻이 된다.
    */
    for (const role of ['parent', 'academy', 'admin'] as const) {
      const list = getAccountsByRole(role).filter((a) => !a.roles.includes('student'));
      expect(list.length).toBeGreaterThan(0);
      for (const a of list) {
        expect(hasLearningRecords(a)).toBe(false);
        expect(lastActiveAtOf(a)).toBeUndefined();
        expect(lastActiveLabelOf(a)).toBe('해당 없음');
      }
    }
  });

  it('학생 계정은 최근 활동을 그대로 노출한다', () => {
    const student = getAccountsByRole('student')[0];
    expect(hasLearningRecords(student)).toBe(true);
    expect(lastActiveLabelOf(student)).not.toBe('해당 없음');
  });
});
