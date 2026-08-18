import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
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
import { colors, spacing } from '@/theme/tokens';

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
  const {
    assignments,
    loaded: progressLoaded,
    error: progressError,
    reload: reloadProgress,
  } = useProgress();
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

  /*
    **읽는 중 · 실패 · 없음을 셋으로 가른다**(D-136 · `DESIGN.md` §9).

    반 이름·담당·학생 수는 세션에서 오지만 `배정`·`제출률`·`평균 정답률`과 합계 행은 배정 기록에서
    온다. 첫 조회가 끝나기 전에는 그 값이 전부 `0건`·`배정 없음`이라, 배정이 있는 반에 대해 표가
    "한 번도 안 냈다"고 말했다. 조회가 실패해도 같은 표가 남는다 — `loading`이 내려가기 때문이다.

    게이트는 `loading`이 아니라 **`loaded`**다(D-163) — 반을 만들거나 담당을 바꾸면 `reload()`가
    돌아 `loading`이 다시 참이 되는데, 그때 목록이 사라지면 방금 만든 반을 확인할 수 없다.
  */
  const ready = progressLoaded;
  /** 실패 문장. 서버가 준 것을 그대로 쓴다(`errorMessage`). */
  const loadError = progressError;
  /** 손에 든 배정이 있으면 값은 사실이다 — 실패해도 이미 읽어 둔 것은 지우지 않는다(D-136). */
  const canCount = ready && (!loadError || scoped.length > 0);

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
    /*
      **배정 기록에서 오는 세 열은 그 기록을 읽은 뒤에만 만든다**(§9 · D-136). 아직 못 읽은 값을
      `0건`·`배정 없음`으로 적으면 배정이 있는 반을 "한 번도 안 냈다"고 말하고, 칸만 비워 두면
      그 빈 칸이 같은 뜻으로 읽힌다 — 그래서 열 자체를 두지 않는다(D-076이 `변화`·`추이`에서 쓴
      규칙과 같다). 반 이름·담당·학생 수는 세션이 준 사실이라 남고, **행을 눌러 반 상세로 가는
      길도 남는다** — 조회가 실패했다고 이 화면의 유일한 이동 경로까지 사라지면 안 된다.
    */
    ...(canCount
      ? ([
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
        ] as Column<ClassPerf>[])
      : []),
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
      {/*
        실제 재원생으로 읽히지 않게 `app/admin/users.tsx`와 **같은 문장**을 먼저 둔다.
        예전에는 `로스터 계정은…`이라고 적었는데 그 합성 로스터(반 120개·학생 3,000명)는
        이미 전부 버렸다(마스터 플랜 5절) — 지금 로그인할 수 없는 계정은 반 평균·순위를 계산할
        `반 비교용 계정` 12명이다. 화면이 없는 규모를 근거로 자기를 해명하고 있었다.
      */}
      <AppText variant="caption" tone="tertiary">
        개발·테스트 계정입니다. 반 비교용 계정은 비밀번호가 없어 로그인할 수 없어요.
      </AppText>

      {/*
        **한 화면에 실패 면은 하나다**(§9). 아래 표의 값 다섯 열과 합계 행이 모두 이 조회에
        매달려 있어서, 자리마다 빨간 줄을 두면 한 번의 실패가 여섯 번으로 읽힌다.
        카드로 만들지 않는다 — 실패는 알려야 하지만 화면에서 가장 무거운 것이 될 이유는 없다.
      */}
      {loadError ? (
        <View testID="classes-load-failed" style={{ gap: spacing.sm, alignItems: 'flex-start' }}>
          <AppText variant="caption" tone="danger">
            반별 기록을 불러오지 못했어요. {loadError}
          </AppText>
          {/* 다시 시도는 이 화면의 주 행동이 아니다 — `hug`인 보조 버튼이다(§8). */}
          <Button
            testID="classes-load-retry"
            variant="secondary"
            hug
            label="다시 불러오기"
            onPress={() => void reloadProgress()}
          />
        </View>
      ) : null}

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
          {/*
            **표 위 캡션은 지금 보이는 표를 설명한다.** 값 열이 없는 동안 `제출률이 낮은 반부터`는
            거짓이다 — 그 정렬은 방금 못 읽은 값으로 세우는 것이라, 실제 순서는 반을 만든 순서다.
            실패 이유는 화면 위 한 줄이 이미 말했으므로 여기서 반복하지 않는다(§9).
          */}
          <AppText variant="caption" tone="secondary">
            {canCount
              ? '제출률이 낮은 반부터 보여 줘요. 열 이름을 누르면 반 전체를 다시 줄 세워요. 행을 누르면 반 상세로 가요.'
              : ready
                ? '행을 누르면 반 상세로 가요.'
                : '반별 기록을 불러오고 있어요. 행을 누르면 반 상세로 가요.'}
          </AppText>
          <Table
            testID="academy-class-list"
            columns={columns}
            rows={visible}
            {...sorted.props}
            rowKey={(r) => r.classId}
            onRowPress={(r) => router.push(`/academy/classes/${r.classId}` as never)}
            /* 스크린리더 문장도 셀과 같은 말을 한다 — 화면에 없는 값을 읽어 주지 않는다(§20). */
            rowLabel={(r) =>
              [
                r.name,
                teacherOf.get(r.classId) ?? '미배정',
                `학생 ${r.students}명`,
                canCount ? `배정 ${r.assigned}건` : null,
                canCount ? (r.rate != null ? `제출률 ${r.rate}%` : '배정 없음') : null,
                canCount && r.avgAccuracy != null ? `평균 정답률 ${r.avgAccuracy}%` : null,
              ]
                .filter(Boolean)
                .join(', ')
            }
            /* 합계는 값 열이 있을 때만. 열이 없는 표에 합계만 남기면 어디를 더한 값인지 알 수 없다. */
            footer={
              canCount
                ? {
                    /*
                      합계 행의 이름은 **값이 덮는 범위**다. 값은 `classesFor(account)`가 준 반에서만
                      나오므로 선생님에게는 담당 반의 합계다 — `학원 전체`라고 적으면 담당 반
                      학생 수를 학원 전체로 읽는다. 선생님에게 담당 밖 집계를 여는 것은
                      3절 권한 문제라 **값은 그대로 두고 이름만 사실에 맞춘다.**
                    */
                    name: isDirector ? '학원 전체' : '담당 반 합계',
                    students: `${studentCount.toLocaleString('en-US')}명`,
                    assigned: `${totals.assigned.toLocaleString('en-US')}건`,
                    rate: totals.rate != null ? `${totals.rate}%` : '—',
                    accuracy: totals.accuracy != null ? `${totals.accuracy}%` : '—',
                  }
                : { name: isDirector ? '학원 전체' : '담당 반 합계', students: `${studentCount.toLocaleString('en-US')}명` }
            }
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
