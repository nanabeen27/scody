import {
  ACCOUNTS,
  SEED_CONTENT,
  findContent,
  personalItems,
  getChildren,
  getChildSummary,
  getClassesForAccount,
  getStudentsInClass,
  submissionStat,
  ASSIGNMENTS_SEED,
  DEMO_PASSWORD,
  authenticate,
  getAccount,
  getAccountsByRole,
  getInvite,
  getLearningItems,
  isScodyIdTaken,
} from '@/data';
import { mergeResult } from '@/session';

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
    expect(roster.every((a) => a.academyName === '한빛학원')).toBe(true);
    // 비밀번호가 없어 어떤 값으로도 로그인되지 않는다
    expect(authenticate('hanbit.s0001', 'test1234')).toBeUndefined();
    expect(authenticate('hanbit.t01', '')).toBeUndefined();
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

describe('초대 링크', () => {
  it('토큰으로 초대 대상을 인식한다', () => {
    expect(getInvite('INV-STUDENT')?.invitee).toBe('student');
    expect(getInvite('inv-parent')?.invitee).toBe('parent');
  });
  it('잘못된 토큰은 없음', () => {
    expect(getInvite('nope')).toBeUndefined();
  });
});

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

describe('제출 결과 반영', () => {
  it('mergeResult는 결과가 있으면 done + 정답률로 바꾼다', () => {
    const item = getLearningItems('u_student_both')[0];
    const merged = mergeResult(item, { [item.id]: { correct: 9, total: 12 } });
    expect(merged.status).toBe('done');
    expect(merged.accuracy).toBe(75);
  });
  it('결과가 없으면 그대로', () => {
    const item = getLearningItems('u_student_both')[0];
    expect(mergeResult(item, {})).toEqual(item);
  });
});

describe('학부모-자녀 (M3)', () => {
  it('학부모의 연결된 자녀를 반환한다', () => {
    expect(getChildren('u_parent').map((c) => c.userId)).toEqual([
      'u_student_parentpaid',
      'u_student_both',
    ]);
  });
  it('자녀 요약: 미완료·정답률·반복오답 (학원 배정 기준)', () => {
    const s = getChildSummary('u_student_both');
    expect(s.incomplete).toBe(1);
    expect(s.recentAccuracy).toBeNull();
    expect(s.repeatWrong).toBe(0);
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
    // 선생님은 자기 담당 반만
    expect(getClassesForAccount(teacherKor).map((c) => c.id)).toEqual(['c_kor1']);
    expect(getClassesForAccount(teacherKor2).map((c) => c.id)).toEqual(['c_kor2']);
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
    expect(getStudentsInClass('c_kor1').map((s) => s.userId)).toEqual([
      'u_student_both',
      'u_student_academy',
    ]);
  });

  it('제출 현황 통계를 계산한다', () => {
    const a = ASSIGNMENTS_SEED.find((x) => x.id === 'a_kor1_1')!;
    expect(submissionStat(a)).toEqual({ submitted: 1, total: 2, avgAccuracy: 80 });
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
