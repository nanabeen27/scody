import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActionBar,
  Screen,
  Section,
  Group,
  Row,
  AppText,
  Button,
  Field,
  Icon,
  Pager,
  SegmentedControl,
  Table,
  useTableSort,
  type Column,
} from '@/components';
import { useCurrentAccount, useSession } from '@/session';
import { useAcademyStaff } from '@/features/academy';
import { useProgress } from '@/features/progress';
import {
  classPerformance,
  scopedAssignments,
  weightedAccuracy,
  type ClassPerf,
} from '@/features/academyStats';
import { useToast } from '@/features/toast';
import type { Grade } from '@/data';
import { colors } from '@/theme/tokens';

/**
 * 한 페이지에 보여 줄 반 수. 전량 펼치기는 122줄 × 56px ≈ 6,800px가 되어
 * 되돌릴 방법도 없었다. `app/admin/users.tsx`와 같은 20개씩으로 맞춘다.
 */
const PAGE = 20;
/** 검색을 두기 시작하는 반 수. 반이 몇 개든 찾는 방법은 같아야 한다. */
const SEARCH_FROM = 5;
/** 새 반의 학년. 빈 값은 `학년 미정`이다(학년으로 나누지 않는 반이 있다). */
const GRADE_OPTIONS = [
  { value: '' as const, label: '학년 미정' },
  { value: '1' as const, label: '고1' },
  { value: '2' as const, label: '고2' },
  { value: '3' as const, label: '고3' },
];

/** 담당 선생님 후보를 한 번에 보여 줄 수. 60명을 다 늘어놓지 않는다. */
const TEACHER_PICK = 6;

/** 반·학생: 담당(원장은 전체) 반 목록. 반이 많은 학원을 위해 검색과 페이지로 다룬다. */
export default function AcademyClasses() {
  const router = useRouter();
  const account = useCurrentAccount();
  const { accountOf } = useSession();
  const isDirector = account.academyRole === 'director';
  const { classesFor, teachers, addClass, isActiveTeacher } = useAcademyStaff();
  const { assignments } = useProgress();
  const { show } = useToast();
  const classes = useMemo(() => classesFor(account), [classesFor, account]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  // 반 만들기: 목록을 밀어내지 않게 접어 두고, 열었을 때만 입력을 보여 준다.
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [teacherQuery, setTeacherQuery] = useState('');
  /** 새 반의 담당 선생님. 빈 문자열은 미배정이다. */
  const [newTeacher, setNewTeacher] = useState('');
  /**
   * 새 반의 학년. 빈 문자열은 `학년 미정`이다.
   * **이름에서 추측하지 않는다** — 원장이 이름을 바꾸는 순간 파싱이 깨지고, 학년별 요약과
   * 배정 화면의 학년 필터가 같은 반을 다르게 잡는다.
   */
  const [newGrade, setNewGrade] = useState<'' | '1' | '2' | '3'>('');
  const [error, setError] = useState<string | null>(null);

  // 값은 `classPerformance`가 만든다 — 화면이 다시 계산하면 대시보드·성과 분석과 어긋난다(D-061).
  const scoped = useMemo(() => scopedAssignments(classes, assignments), [classes, assignments]);
  const perf = useMemo(() => classPerformance(classes, scoped), [classes, scoped]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return perf;
    return perf.filter((c) => c.name.includes(q));
  }, [perf, query]);


  const studentCount = useMemo(() => new Set(classes.flatMap((c) => c.studentIds)).size, [classes]);
  /** 합계 행. 각 반의 값이 좋은지 나쁜지 판단할 기준선이다. */
  const totals = useMemo(() => {
    const rows = scoped.flatMap((a) => a.submissions);
    const submitted = rows.filter((s) => s.submitted).length;
    return {
      assigned: rows.length,
      rate: rows.length ? Math.round((submitted / rows.length) * 100) : null,
      accuracy: weightedAccuracy(scoped),
    };
  }, [scoped]);

  /**
   * 반 id → 담당 선생님 이름.
   * **fixture가 아니라 `classesFor`가 준 목록**을 쓴다 — 이 세션에서 담당을 바꾸거나 선생님을
   * 제외했으면 목록에도 그 결과가 보여야 한다.
   */
  const teacherOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classes) {
      map.set(c.id, (isActiveTeacher(c.teacherId) && accountOf(c.teacherId)?.name) || '미배정');
    }
    return map;
  }, [classes, isActiveTeacher, accountOf]);

  const columns: Column<ClassPerf>[] = [
    { key: 'name', header: '반', cell: (r) => r.name, sort: COMPARE.name },
    { key: 'teacher', header: '담당', width: 92, priority: 3, cell: (r) => teacherOf.get(r.classId) ?? '미배정' },
    {
      key: 'students',
      header: '학생',
      width: 68,
      align: 'right',
      priority: 2,
      cell: (r) => `${r.students.toLocaleString('en-US')}명`,
      sort: COMPARE.students,
    },
    {
      key: 'assigned',
      header: '배정',
      width: 72,
      align: 'right',
      priority: 3,
      cell: (r) => `${r.assigned.toLocaleString('en-US')}건`,
      sort: COMPARE.assigned,
    },
    {
      key: 'rate',
      header: '제출률',
      width: 76,
      align: 'right',
      cell: (r) => (r.rate != null ? `${r.rate}%` : '배정 없음'),
      sort: COMPARE.rate,
    },
    {
      key: 'accuracy',
      header: '평균 정답률',
      width: 92,
      align: 'right',
      priority: 2,
      cell: (r) => (r.avgAccuracy != null ? `${r.avgAccuracy}%` : '—'),
      sort: COMPARE.accuracy,
    },
    /*
      **이 표가 눌린다는 사실을 화면이 말한다.** `Row`는 `showChevron`으로 말하는데 표에는
      아무 표시가 없었다. 대시보드의 반별 현황 표와 같은 열이다(`app/academy/index.tsx`).
      `priority`를 주지 않아 390에서도 접히지 않는다 — 접히면 말하려던 것이 사라진다.
    */
    {
      key: 'go',
      header: '',
      width: 24,
      cell: () => <Icon name="chevron-right" size={18} color={colors.inkTertiary} />,
    },
  ];

  /**
   * 정렬은 **화면이 쥔다.** 표에 페이지 슬라이스를 넘기므로 표가 스스로 정렬하면 그 20줄
   * 안에서만 줄이 바뀌어, 화면이 약속한 `열 이름을 누르면 반 전체를 다시 줄 세워요`가
   * 거짓이 된다(A-050). 기본 순서(제출률 낮은 순)는 `classPerformance`가 준 그대로 둔다.
   */
  const sorted = useTableSort(filtered, COMPARE, () => setPage(0));
  const visible = sorted.rows.slice(page * PAGE, (page + 1) * PAGE);

  const teacherCandidates = useMemo(() => {
    const q = teacherQuery.trim();
    if (!q) return teachers;
    return teachers.filter((t) => t.name.includes(q) || t.scodyId.includes(q));
  }, [teachers, teacherQuery]);
  const teacherShown = teacherCandidates.slice(0, TEACHER_PICK);
  const newTeacherName = teachers.find((t) => t.userId === newTeacher)?.name ?? '미배정';

  function closeCreate() {
    setCreating(false);
    setNewName('');
    setTeacherQuery('');
    setNewTeacher('');
    setNewGrade('');
    setError(null);
  }

  async function onCreate() {
    const name = newName.trim();
    const result = await addClass({
      name,
      teacherId: newTeacher,
      grade: newGrade ? (Number(newGrade) as Grade) : undefined,
    });
    if (!result.ok || !result.id) {
      setError(result.error ?? '반을 만들지 못했어요.');
      return;
    }
    closeCreate();
    show(`${name} 반을 만들었어요`);
    // 만든 반에서 바로 학생을 넣을 수 있게 상세로 보낸다.
    router.push(`/academy/classes/${result.id}` as never);
  }

  return (
    <Screen wide testID="academy-classes" title="반·학생" scrollResetKey={page}>
      {/* 반 120개·학생 3,000명은 규모 확인용 개발 로스터다(마스터 플랜 5절).
          실제 재원생으로 읽히지 않게 `app/admin/users.tsx`와 같은 문장을 먼저 둔다. */}
      <AppText variant="caption" tone="tertiary">
        프로토타입 테스트 계정입니다. 로스터 계정은 비밀번호가 없어 로그인할 수 없어요.
      </AppText>

      {classes.length > 0 ? (
        <AppText variant="caption" tone="secondary">
          반 {classes.length.toLocaleString('en-US')}개 · 학생{' '}
          {studentCount.toLocaleString('en-US')}명
        </AppText>
      ) : null}

      {/*
        만들기는 원장만 한다(3절: 반·학생 관리는 원장).
        **행동줄에는 이 화면의 주 행동 하나만 둔다.** `학생 전체 보기`는 아래 반 목록의 제목
        오른쪽으로 내려갔다 — 다른 목록으로 건너가는 보조 행동이라 만들기와 나란히 설 자리가
        아니었고, 선생님에게는 만들기가 없어 그 줄에 보조 행동만 홀로 남았다.
      */}
      {isDirector && !creating ? (
        <ActionBar>
          <Button testID="class-new-open" label="반 만들기" onPress={() => setCreating(true)} />
        </ActionBar>
      ) : null}

      {isDirector && creating ? (
        <Section
          title="새 반"
          /*
            **취소는 이 폼 전체를 닫는 행동**이라 폼의 제목 옆에 둔다. 아래 행동줄에 제출과
            나란히 두면 어느 것이 반을 만드는 것인지 모양으로 구분되지 않는다.
          */
          action={
            <Button
              testID="class-new-cancel"
              variant="secondary"
              size="sm"
              hug
              label="취소"
              accessibilityLabel="새 반 만들기 취소"
              onPress={closeCreate}
            />
          }
        >
          <Field
            label="반 이름"
            testID="class-new-name"
            value={newName}
            onChangeText={setNewName}
            placeholder="예: 고1 국어 A"
          />
          <SegmentedControl
            testID="class-new-grade"
            options={GRADE_OPTIONS}
            value={newGrade}
            onChange={setNewGrade}
          />
          {newGrade === '' ? (
            <AppText variant="caption" tone="tertiary">
              학년을 정하지 않으면 대시보드의 학년별 요약에서 `학년 미정`으로 모이고, 학습 배정의
              학년 고르기에도 걸리지 않아요.
            </AppText>
          ) : null}
          <AppText variant="caption" tone="secondary">
            담당 선생님 · {newTeacherName}
          </AppText>
          {teachers.length > TEACHER_PICK ? (
            <Field
              label="선생님 이름·아이디로 찾기"
              testID="class-new-teacher-search"
              value={teacherQuery}
              onChangeText={setTeacherQuery}
              placeholder="예: 김선생 또는 kimteacher"
            />
          ) : null}
          <Group>
            <Row
              testID="class-new-teacher-none"
              title="미배정"
              subtitle="나중에 반 상세에서 정할 수 있어요"
              accessibilityLabel="담당 선생님 미배정으로 두기"
              onPress={() => setNewTeacher('')}
              trailing={
                newTeacher === '' ? <AppText variant="label" tone="accent">고름</AppText> : undefined
              }
            />
            {teacherShown.map((t) => (
              <Row
                key={t.userId}
                testID={`class-new-teacher-${t.scodyId}`}
                title={t.name}
                subtitle={t.scodyId}
                accessibilityLabel={`${t.name} 담당으로 정하기`}
                onPress={() => setNewTeacher(t.userId)}
                trailing={
                  newTeacher === t.userId ? (
                    <AppText variant="label" tone="accent">고름</AppText>
                  ) : undefined
                }
              />
            ))}
            {teacherShown.length === 0 ? (
              <Row title="찾는 선생님이 없어요" subtitle="이름이나 아이디를 다시 확인해 주세요" />
            ) : null}
          </Group>
          {teacherCandidates.length > TEACHER_PICK ? (
            <AppText variant="caption" tone="tertiary">
              {teacherCandidates.length}명 중 {TEACHER_PICK}명만 보여요. 이름으로 좁혀 보세요.
            </AppText>
          ) : null}
          {error ? (
            <AppText variant="caption" style={{ color: colors.danger }}>
              {error}
            </AppText>
          ) : null}
          <ActionBar>
            {/* 이 화면의 주 행동이 반 만들기라 폼의 제출도 primary 그대로다(R4의 예외 쪽). */}
            <Button testID="class-new-submit" label="반 만들기" onPress={onCreate} />
          </ActionBar>
        </Section>
      ) : null}

      {classes.length === 0 ? (
        <Group>
          <Row
            title={isDirector ? '아직 등록된 반이 없어요' : '아직 담당하는 반이 없어요'}
            subtitle={
              isDirector
                ? '반을 만들고 학생을 넣으면 학습을 배정할 수 있어요'
                : '원장님이 담당 반을 정해 주면 여기에 보여요'
            }
          />
        </Group>
      ) : (
        /*
          **`학생 전체 보기`가 붙는 대상이 이 목록이다** — 반 목록 옆에서 "학생 쪽 목록으로
          건너간다"는 뜻이 서고, 화면 위 행동줄에 있을 때처럼 만들기와 경쟁하지 않는다.
          모양은 대시보드의 같은 목적지 버튼과 맞춘다(§20 R2) — 한 화면을 두 이름으로 부르지
          않는다.
        */
        <Section
          title="반 목록"
          action={
            <Button
              testID="class-goto-students"
              variant="secondary"
              tone="accent"
              size="sm"
              hug
              leading={<Icon name="users" size={15} color={colors.accent} />}
              label="학생 전체 보기"
              accessibilityLabel="학생 전체 보기"
              onPress={() => router.push('/academy/classes/students' as never)}
            />
          }
        >
          {classes.length > SEARCH_FROM ? (
            <Field
              label="반 이름으로 찾기"
              testID="class-search"
              value={query}
              onChangeText={(v) => {
                setQuery(v);
                setPage(0);
              }}
              placeholder="예: 고2"
            />
          ) : null}
          <AppText variant="caption" tone="secondary">
            제출률이 낮은 반부터 보여 줘요. 열 이름을 누르면 반 전체를 다시 줄 세워요. 행을 누르면
            반 상세로 가요.
          </AppText>
          <Table
            testID="academy-class-list"
            columns={columns}
            rows={visible}
            {...sorted.props}
            rowKey={(r) => r.classId}
            onRowPress={(r) => router.push(`/academy/classes/${r.classId}` as never)}
            rowLabel={(r) =>
              [
                r.name,
                teacherOf.get(r.classId) ?? '미배정',
                `학생 ${r.students}명`,
                `배정 ${r.assigned}건`,
                r.rate != null ? `제출률 ${r.rate}%` : '배정 없음',
                r.avgAccuracy != null ? `평균 정답률 ${r.avgAccuracy}%` : null,
              ]
                .filter(Boolean)
                .join(', ')
            }
            footer={{
              /*
                합계 행의 이름은 **값이 덮는 범위**다. 값은 `classesFor(account)`가 준 반에서만
                나오므로 선생님에게는 담당 반 4개의 합계다 — `학원 전체`라고 적으면 담당 반
                88명을 학원 전체 3,002명으로 읽는다. 선생님에게 담당 밖 집계를 여는 것은
                3절 권한 문제라 **값은 그대로 두고 이름만 사실에 맞춘다.**
              */
              name: isDirector ? '학원 전체' : '담당 반 합계',
              students: `${studentCount.toLocaleString('en-US')}명`,
              assigned: `${totals.assigned.toLocaleString('en-US')}건`,
              rate: totals.rate != null ? `${totals.rate}%` : '—',
              accuracy: totals.accuracy != null ? `${totals.accuracy}%` : '—',
            }}
            empty={{ title: '찾는 반이 없어요', subtitle: '반 이름을 다시 확인해 주세요' }}
          />
          {filtered.length > PAGE ? (
            <Pager
              testID="class-pager"
              total={filtered.length}
              page={page}
              pageSize={PAGE}
              onChange={setPage}
            />
          ) : null}
        </Section>
      )}
    </Screen>
  );
}

/**
 * 열 정렬. **오름차순으로 정의한다** — 내림차순은 표가 화살표와 함께 뒤집는다.
 * 배정이 없어 값이 `null`인 반은 어느 방향으로 세워도 판단할 것이 없어 맨 뒤로 보낸다.
 */
const COMPARE: Record<string, (a: ClassPerf, b: ClassPerf) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  students: (a, b) => a.students - b.students,
  assigned: (a, b) => a.assigned - b.assigned,
  rate: (a, b) => nullLast(a.rate) - nullLast(b.rate),
  accuracy: (a, b) => nullLast(a.avgAccuracy) - nullLast(b.avgAccuracy),
};

function nullLast(v: number | null): number {
  return v == null ? Number.POSITIVE_INFINITY : v;
}
