import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

import {
  AppText,
  Field,
  Icon,
  LoadFailed,
  Pager,
  Screen,
  SegmentedControl,
  Table,
  type Column,
  type SegmentedOption,
  useTableSort,
} from '@/components';
import { useCurrentAccount, useSession } from '@/session';
import { useProgress } from '@/features/progress';
import { useAcademyStaff } from '@/features/academy';
import { scopedAssignments, studentSummaries, type StudentSummary } from '@/features/academyStats';
import { formatDate } from '@/features/learning';
import type { Account } from '@/data';
import { colors } from '@/theme/tokens';

/** 한 페이지에 보여 줄 학생 수. `app/admin/users.tsx`와 같은 20명씩. */
const PAGE = 20;
/** 반 필터를 칩으로 둘 수 있는 최대 개수. 그보다 많으면 이름 검색으로 좁힌다. */
const SEGMENT_MAX = 6;

/** 목록 한 줄. */
interface StudentRow {
  account: Account;
  classes: { id: string; name: string }[];
  stat: StudentSummary;
}

/**
 * 학원 전체 학생.
 *
 * 반 상세는 그 반 학생만 보여 준다. 이름만 아는 학생이 어느 반인지 찾을 길이 없어서
 * 이 화면을 둔다. 탭에는 넣지 않는다(학원 메뉴 6개는 4절 고정) — `반·학생`과 대시보드에서 들어온다.
 *
 * **행을 누르면 그 학생 상세로 간다.** 예전에는 그 학생의 첫 번째 반으로 보냈다 — 학생을 찾아
 * 눌렀는데 반 화면이 열려서, 두 반에 속한 학생은 반쪽만 보였다.
 *
 * 권한: **원장은 우리 학원 학생 전체**(반이 없는 학생도 찾을 수 있어야 반에 넣을 수 있다),
 * **선생님은 담당 반 학생만**이다(`classesFor`와 같은 경계).
 */
export default function AcademyStudents() {
  const router = useRouter();
  const account = useCurrentAccount();
  const { academyStudents } = useSession();
  const isDirector = account.academyRole === 'director';
  const { classesFor } = useAcademyStaff();
  const {
    assignments,
    loaded: progressLoaded,
    error: progressError,
    reload: reloadProgress,
  } = useProgress();
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [classQuery, setClassQuery] = useState('');
  const [page, setPage] = useState(0);

  const classes = useMemo(() => classesFor(account), [classesFor, account]);

  /** 학생 → 속한 반(내가 볼 수 있는 반만). 반 이름과 갈 곳을 함께 들고 간다. */
  const classesByStudent = useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>();
    for (const c of classes) {
      for (const studentId of c.studentIds) {
        const list = map.get(studentId) ?? [];
        list.push({ id: c.id, name: c.name });
        map.set(studentId, list);
      }
    }
    return map;
  }, [classes]);

  /** 내가 볼 수 있는 반의 배정. 아래 요약과 조회 상태 판단이 같은 값을 본다. */
  const scoped = useMemo(() => scopedAssignments(classes, assignments), [classes, assignments]);

  /** 학생별 요약. 내가 볼 수 있는 반의 배정만 센다. 한 번만 훑는다. */
  const statBy = useMemo(() => studentSummaries(scoped), [scoped]);

  /*
    **읽는 중 · 실패 · 없음을 셋으로 가른다**(D-136 · `DESIGN.md` §9).

    이름·반은 세션에서 오지만 `배정`·`제출률`·`평균 정답률`·`안 낸 과제`·`최근 제출`은 배정 기록에서
    온다. 첫 조회가 끝나기 전에는 `statBy`가 비어 `EMPTY`가 들어가므로, 안 낸 과제가 쌓인 학생도
    `배정 0건 · 배정 없음 · 안 낸 과제 없음 · 기록 없음`으로 보였다 — 이 화면의 기본 정렬(안 낸
    과제 많은 순)까지 그 값 위에 서 있어서 순서 자체가 거짓이었다. 실패해도 같은 표가 남는다.

    게이트는 `loading`이 아니라 **`loaded`**다(D-163).
  */
  const ready = progressLoaded;
  /** 실패 문장. 서버가 준 것을 그대로 쓴다(`errorMessage`). */
  const loadError = progressError;
  /** 손에 든 배정이 있으면 값은 사실이다 — 실패해도 이미 읽어 둔 것은 지우지 않는다(D-136). */
  const canCount = ready && (!loadError || scoped.length > 0);

  /**
   * 검색 대상. 원장은 우리 학원 학생 계정 전체, 선생님은 담당 반 학생만이다.
   * 반이 없는 학생은 원장 화면에만 나타난다 — 반에 넣는 것이 원장의 일이다(3절).
   */
  const pool = useMemo<Account[]>(() => {
    if (!account.academyName) return [];
    const all = academyStudents;
    if (isDirector) return all;
    return all.filter((s) => classesByStudent.has(s.userId));
  }, [account.academyName, isDirector, classesByStudent, academyStudents]);

  const classOptions = useMemo<SegmentedOption<string>[]>(
    () => [
      { value: 'all', label: '모든 반' },
      ...classes.map((c) => ({ value: c.id, label: c.name, count: c.studentIds.length })),
    ],
    [classes],
  );
  const useSegments = classes.length <= SEGMENT_MAX;

  const rows = useMemo<StudentRow[]>(() => {
    const q = query.trim();
    const cq = classQuery.trim();
    return pool
      .filter((s) => !q || s.name.includes(q) || s.scodyId.includes(q))
      .filter((s) => {
        const mine = classesByStudent.get(s.userId) ?? [];
        if (useSegments && classFilter !== 'all') return mine.some((c) => c.id === classFilter);
        if (!useSegments && cq) return mine.some((c) => c.name.includes(cq));
        return true;
      })
      .map((s) => ({
        account: s,
        classes: classesByStudent.get(s.userId) ?? [],
        stat: statBy.get(s.userId) ?? EMPTY,
      }));
  }, [pool, query, classQuery, classFilter, useSegments, classesByStudent, statBy]);

  const columns: Column<StudentRow>[] = [
    { key: 'name', header: '이름', cell: (r) => r.account.name, sort: COMPARE.name },
    /*
      **`반`은 390에서도 접지 않는다.** 이 화면이 있는 이유가 "이름만 아는 학생이 어느 반인지"라서
      그 열이 접히면 화면의 목적이 사라진다(위 주석). 접을 순서는 `안 낸 과제`로 내렸다 —
      기본 정렬이 안 낸 과제 순이라는 사실은 표 위 캡션이 이미 말한다.
    */
    {
      key: 'class',
      header: '반',
      cell: (r) => (r.classes.length ? r.classes.map((c) => c.name).join(' · ') : '아직 반이 없어요'),
    },
    /*
      **배정 기록에서 오는 다섯 열은 그 기록을 읽은 뒤에만 만든다**(§9 · D-136). 아직 못 읽은 값을
      `배정 0건 · 배정 없음 · 안 낸 과제 없음 · 기록 없음`으로 적으면, 안 낸 과제가 쌓인 학생을
      화면이 "다 냈다"고 말한다. 이름·반은 세션이 준 사실이라 남고 **행을 눌러 학생 상세로 가는
      길도 남는다** — 이 화면의 목적("이름만 아는 학생이 어느 반인지")은 그 둘로 성립한다.
    */
    ...(canCount
      ? ([
          {
            key: 'assigned',
            header: '배정',
            width: 68,
            align: 'right',
            priority: 3,
            cell: (r) => `${r.stat.assigned.toLocaleString('en-US')}건`,
            sort: COMPARE.assigned,
          },
          {
            key: 'rate',
            header: '제출률',
            width: 76,
            align: 'right',
            priority: 2,
            cell: (r) => (r.stat.rate != null ? `${r.stat.rate}%` : '배정 없음'),
            sort: COMPARE.rate,
          },
          {
            key: 'accuracy',
            header: '평균 정답률',
            width: 92,
            align: 'right',
            priority: 3,
            cell: (r) => (r.stat.accuracy != null ? `${r.stat.accuracy}%` : '—'),
            sort: COMPARE.accuracy,
          },
          {
            key: 'pending',
            header: '안 낸 과제',
            width: 88,
            align: 'right',
            // 기본 정렬 기준이라 390에서도 남긴다. `이름 + 반 + 안 낸 과제 + 이동`은 312px로
            // 모바일 컬럼(358px) 안에 들어간다(실측) — 정렬 기준이 안 보이면 캡션이 거짓이 된다.
            cell: (r) => (r.stat.pending > 0 ? `${r.stat.pending}건` : '없음'),
            sort: COMPARE.pending,
          },
          {
            key: 'last',
            header: '최근 제출',
            width: 92,
            align: 'right',
            priority: 3,
            cell: (r) => (r.stat.lastSubmittedAt ? formatDate(r.stat.lastSubmittedAt) : '기록 없음'),
            sort: COMPARE.last,
          },
        ] as Column<StudentRow>[])
      : []),
    /* 눌리는 표라는 표시. 반 목록·대시보드 반별 현황과 같은 열이다. */
    {
      key: 'go',
      header: '',
      width: 24,
      cell: () => <Icon name="chevron-right" size={18} color={colors.inkTertiary} />,
    },
  ];

  /**
   * 정렬은 **화면이 쥔다** — 표에 페이지 슬라이스를 넘기기 때문이다(A-050).
   * 기본은 안 낸 과제가 많은 순이라 여기서 한 번 세워 두고, 열 헤더는 그 위에서 다시 세운다.
   */
  const ordered = useMemo(() => [...rows].sort(COMPARE.pending).reverse(), [rows]);
  const sorted = useTableSort(ordered, COMPARE, () => setPage(0));
  const visible = sorted.rows.slice(page * PAGE, (page + 1) * PAGE);

  return (
    <Screen
      wide
      testID="academy-students"
      backFallback="/academy/classes"
      title="학생"
      scrollResetKey={page}
    >
      {/*
        `app/admin/users.tsx`와 **같은 문장**을 쓴다. 예전에는 `로스터 계정은…`이라고 적었는데
        그 합성 로스터(학생 3,000명)는 이미 전부 버렸다(마스터 플랜 5절) — 지금 로그인할 수 없는
        계정은 반 평균·순위를 계산할 `반 비교용 계정` 12명이다.
      */}
      <AppText variant="caption" tone="tertiary">
        개발·테스트 계정입니다. 반 비교용 계정은 비밀번호가 없어 로그인할 수 없어요.
      </AppText>
      <AppText variant="caption" tone="secondary">
        {isDirector ? '우리 학원 학생' : '담당 반 학생'} {pool.length.toLocaleString('en-US')}명
      </AppText>

      {/*
        **한 화면에 실패 면은 하나다**(§9). 표의 값 다섯 열이 모두 이 조회에 매달려 있다.
        카드로 만들지 않는다 — 실패는 알려야 하지만 화면에서 가장 무거운 것이 될 이유는 없다.
      */}
      {loadError ? (
        <LoadFailed
          testID="students-load-failed"
          retryTestID="students-load-retry"
          what="학생 기록"
          message={loadError}
          onRetry={() => void reloadProgress()}
        />
      ) : null}

      <Field
        label="이름·아이디로 찾기"
        testID="student-search"
        value={query}
        onChangeText={(v) => {
          setQuery(v);
          setPage(0);
        }}
        placeholder="예: 정예린 또는 hanbit.s0001"
      />

      {classes.length === 0 ? null : useSegments ? (
        <SegmentedControl
          testID="student-class"
          options={classOptions}
          value={classFilter}
          onChange={(v) => {
            setClassFilter(v);
            setPage(0);
          }}
        />
      ) : (
        <Field
          label="반 이름으로 좁히기"
          testID="student-class-search"
          value={classQuery}
          onChangeText={(v) => {
            setClassQuery(v);
            setPage(0);
          }}
          placeholder="예: 고1 국어 3반"
        />
      )}

      {/*
        **표 위 캡션은 지금 보이는 표를 설명한다.** 값 열이 없는 동안 `안 낸 과제가 많은 학생부터`는
        거짓이다 — 그 순서는 방금 못 읽은 값으로 세우는 것이라 실제로는 이름 순이다.
        실패 이유는 화면 위 한 줄이 이미 말했으므로 여기서 반복하지 않는다(§9).
      */}
      <AppText variant="caption" tone="secondary">
        {canCount
          ? '안 낸 과제가 많은 학생부터예요. 열 이름을 누르면 학생 전체를 다시 줄 세워요. 행을 누르면 그 학생의 학원 학습 기록을 봐요.'
          : ready
            ? '이름 순으로 보여 줘요. 행을 누르면 그 학생의 학원 학습 기록을 봐요.'
            : '학생 기록을 불러오고 있어요. 행을 누르면 그 학생의 학원 학습 기록을 봐요.'}
      </AppText>

      <Table
        testID="academy-student-table"
        columns={columns}
        rows={visible}
        {...sorted.props}
        rowKey={(r) => r.account.userId}
        onRowPress={(r) => router.push(`/academy/classes/student/${r.account.userId}` as never)}
        /* 스크린리더 문장도 셀과 같은 말을 한다 — 화면에 없는 값을 읽어 주지 않는다(§20). */
        rowLabel={(r) =>
          [
            r.account.name,
            r.classes.length ? r.classes.map((c) => c.name).join(' · ') : '아직 반이 없어요',
            canCount ? `배정 ${r.stat.assigned}건` : null,
            canCount ? (r.stat.rate != null ? `제출률 ${r.stat.rate}%` : '배정 없음') : null,
            canCount ? (r.stat.pending > 0 ? `안 낸 과제 ${r.stat.pending}건` : '안 낸 과제 없음') : null,
          ]
            .filter(Boolean)
            .join(', ')
        }
        empty={{ title: '찾는 학생이 없어요', subtitle: '이름이나 아이디를 다시 확인해 주세요' }}
      />

      {sorted.rows.length > PAGE ? (
        <Pager
          testID="student-pager"
          total={sorted.rows.length}
          page={page}
          pageSize={PAGE}
          unit="명"
          onChange={setPage}
        />
      ) : null}
    </Screen>
  );
}

const EMPTY: StudentSummary = { assigned: 0, submitted: 0, pending: 0, rate: null, accuracy: null };

/** 열 정렬. **오름차순으로 정의한다** — 내림차순은 표가 뒤집는다. */
const COMPARE: Record<string, (a: StudentRow, b: StudentRow) => number> = {
  name: (a, b) => a.account.name.localeCompare(b.account.name),
  assigned: (a, b) => a.stat.assigned - b.stat.assigned,
  rate: (a, b) => nullLast(a.stat.rate) - nullLast(b.stat.rate),
  accuracy: (a, b) => nullLast(a.stat.accuracy) - nullLast(b.stat.accuracy),
  pending: (a, b) => a.stat.pending - b.stat.pending || b.account.name.localeCompare(a.account.name),
  last: (a, b) => (a.stat.lastSubmittedAt ?? '').localeCompare(b.stat.lastSubmittedAt ?? ''),
};

function nullLast(v: number | null): number {
  return v == null ? Number.POSITIVE_INFINITY : v;
}
