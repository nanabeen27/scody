import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import {
  ActionBar,
  AppText,
  Button,
  Field,
  Group,
  Icon,
  LoadFailed,
  Pager,
  RichText,
  Row,
  Screen,
  Section,
  SegmentedControl,
  TestDataNote,
  type SegmentedOption,
} from '@/components';
import { useCurrentAccount, useSession } from '@/session';
import { useAcademyStaff } from '@/features/academy';
import { useProgress, type AcademyNote } from '@/features/progress';
import { useToast } from '@/features/toast';
import { todayISO } from '@/features/clock';
import { dayAfter, dueLabel, formatDate, parseDueDate } from '@/features/learning';
import {
  classNameOf,
  dueSoon,
  overdueAssignments,
  pendingStat,
  submitStat,
  weightedAccuracy,
} from '@/features/academyStats';
import type { Assignment } from '@/data';
import { endRow, inset } from '@/theme/styles';
import { colors, spacing } from '@/theme/tokens';

/** 한 페이지에 두는 배정 수. 반 122개 규모에서도 한 목록에 다 쏟지 않는다. */
const PAGE = 10;
/** 확인이 필요한 학생 한 페이지. 학생 1행이라 배정×학생으로 늘어나지 않는다. */
const STUDENT_PAGE = 20;
/** 반·과제 필터를 칩으로 둘 수 있는 상한. 넘으면 검색으로 바꾼다. */
const SEGMENT_MAX = 6;
/** 펼친 배정에서 이름을 보여 주는 학생 수. 25명 반이 그대로 쏟아지지 않게. */
const NAME_PREVIEW = 8;
/** 여러 학생이 담은 문항 상위 N. 두 명부터 '여러 학생'이다. */
const TOGETHER_TOP = 5;
const TOGETHER_MIN = 2;
/** 마감이 없는 배정은 정렬에서 맨 뒤로. */
const NO_DUE = '9999-99-99';

type DueFilter = 'all' | 'overdue' | 'soon';
type MemoFilter = 'all' | 'memo';

/** 학생 한 명이 아직 안 낸 급한 과제. 목록을 **학생 1행**으로 묶을 때 쓴다. */
interface MissingTask {
  assignmentId: string;
  /** 과목까지 붙인 목록용 이름(`국어 · 현대소설 점검`). */
  title: string;
  /** 과제 이름만. 문장 안에 넣을 때 쓴다. */
  name: string;
  className: string;
  dueDate?: string;
  overdue: boolean;
}

interface NeedStudent {
  studentId: string;
  name: string;
  /** 지금 내가 보는 반에 없는 학생. 배정 대상 행이 남아 이 목록에는 계속 나온다. */
  left: boolean;
  /** 학생 상세가 열리는 학생인가. 판정은 상세 화면과 같은 `studentInScope`다. */
  openable: boolean;
  count: number;
  nearest?: string;
  tasks: MissingTask[];
}

/** 배정 학습 오답노트 한 줄. 어느 학생·어느 과제에서 나왔는지 함께 들고 간다. */
interface NoteRow {
  /**
   * **`AcademyNote`다.** `academyNotesOf`가 투영해 준 값이고, 별표·이해 완료·고른 답·복습
   * 스케줄이 없다(D-085 · 확정 정책 2절). `WrongNote`로 적으면 이 화면이 `note.dueOn` 같은
   * 없는 값을 읽어도 컴파일이 서고 `undefined`가 조용히 흐른다 — D-085가 막으려던 종류다.
   */
  note: AcademyNote;
  studentId: string;
  studentName: string;
  taskId: string;
  taskTitle: string;
}

/** 마감이 이른 것부터. 마감이 없으면 뒤로(학생 화면의 `byDue`와 같은 규칙). */
function byDueAsc(a: { dueDate?: string }, b: { dueDate?: string }): number {
  return (a.dueDate ?? NO_DUE).localeCompare(b.dueDate ?? NO_DUE);
}

/** 마감 한 줄. 학생 홈·학부모 리포트와 같은 문장을 쓴다(`dueLabel`). */
function dueText(iso?: string): string {
  return dueLabel(iso)?.text ?? '마감일 없음';
}

/**
 * 학원 성과 분석.
 *
 * **미제출을 말하는 곳을 두 층으로만 둔다.** 예전에는 `배정 학습 · 제출 현황`,
 * `마감이 지난 미제출 과제`, `확인이 필요한 학생` 세 섹션이 같은 무게로 쌓여 있었고
 * 세 목록이 모두 `submitted === false` 한 곳에서 나와 무엇이 무엇의 부분인지 알 수 없었다.
 * 이제는 ① 과제 축(`제출 현황`, 필터·정렬·페이지) → ② 학생 축(급한 것만 학생 1행) →
 * ③ 오답노트 순이고, 두 번째가 첫 번째의 부분집합이라는 사실을 화면에서 문장으로 밝힌다.
 *
 * 배정 학습만 다룬다. 학생 개인 학습 상세·개인 학습 오답은 어떤 집계에도 넣지 않는다(D-014).
 */
export default function AcademyAnalytics() {
  const account = useCurrentAccount();
  const { accountOf } = useSession();
  const router = useRouter();
  const {
    assignments,
    academyNotesOf,
    reassign,
    loaded: progressLoaded,
    error: progressError,
    reload: reloadProgress,
  } = useProgress();
  const { classesFor, studentInScope } = useAcademyStaff();
  const { show } = useToast();
  const today = todayISO();

  /**
   * 대시보드의 알림 행이 `?due=overdue`처럼 **좁혀서** 보낸다. 그 화면에는 뒤로가기가 없는
   * 상위 탭이라, 왜 여기 왔는지를 쿼리가 말하고 아래 `전체 보기`가 되돌아갈 길을 준다(D-075).
   * 범위 밖 값은 무시하고 전체를 보여 준다.
   */
  const params = useLocalSearchParams<{ due?: string; task?: string }>();
  const fromQuery: DueFilter =
    params.due === 'overdue' || params.due === 'soon' ? params.due : 'all';

  /**
   * 배정 완료 화면이 `?task=<배정 id>`로 **방금 낸 과제만** 실어 보낸다(§20 · D-075와 같은 형태).
   * 예전에는 `/academy/analytics`로 그냥 보내서, 방금 낸 과제를 배정 목록에서 이름으로 다시
   * 검색해야 했다.
   *
   * **상태로 복사하지 않고 쿼리를 그대로 읽는다.** `dueFilter`는 화면에 컨트롤이 있어(세그먼트)
   * 사용자가 직접 바꾸므로 상태가 필요하지만, 이것은 좁혀 들어온 사실 하나라 되돌리는 길도
   * 주소를 지우는 것이다(`전체 보기` → `replace`). 상태로 두면 이미 열려 있던 성과 분석 화면이
   * 다시 쓰일 때 `useState` 초기값이 갱신되지 않아 좁혀 보낸 것이 조용히 무시된다.
   */
  const fromTask = typeof params.task === 'string' ? params.task : '';

  // 제출 현황 필터·펼침
  const [dueFilter, setDueFilter] = useState<DueFilter>(fromQuery);
  const [classFilter, setClassFilter] = useState('all');
  const [classQuery, setClassQuery] = useState('');
  /** 과제 이름 검색. 배정이 수백 건인 학원에서 특정 과제를 찾는 유일한 길이다. */
  const [taskQuery, setTaskQuery] = useState('');
  const [taskNav, setTaskNav] = useState({ key: '', page: 0 });
  const [openTask, setOpenTask] = useState<string | null>(null);
  // 확인이 필요한 학생
  const [studentNav, setStudentNav] = useState({ key: '', page: 0 });
  /** 학생 이름 검색. 담당 학생이 수백 명이면 이름으로 찾는 길이 있어야 한다. */
  const [needQuery, setNeedQuery] = useState('');
  const [openStudent, setOpenStudent] = useState<string | null>(null);
  // 오답노트
  const [noteTask, setNoteTask] = useState('all');
  const [noteQuery, setNoteQuery] = useState('');
  const [memoFilter, setMemoFilter] = useState<MemoFilter>('all');
  const [noteNav, setNoteNav] = useState({ key: '', page: 0 });
  /*
    마감일 입력 패널은 화면 전체에서 하나만 열린다. 제출 현황과 학생 목록이 같은 배정을
    가리킬 수 있어, 둘을 함께 열면 같은 입력이 두 번 렌더된다.
  */
  const [reassignAt, setReassignAt] = useState<{
    scope: 'task' | 'student';
    key: string;
    assignmentId: string;
  } | null>(null);
  const [due, setDue] = useState('');
  const [dueError, setDueError] = useState<string | null>(null);

  /*
    집계는 전부 `useMemo`로 묶는다. 예전에는 렌더마다 학생 3,000명을 돌며 오답을 모았고,
    같은 화면에 마감일 입력이 있어 **한 글자 칠 때마다** 그 순회가 다시 돌았다.
  */
  const classes = useMemo(() => classesFor(account), [account, classesFor]);

  const scoped = useMemo(() => {
    const ids = new Set(classes.map((c) => c.id));
    return assignments.filter((a) => ids.has(a.classId));
  }, [assignments, classes]);

  /*
    **읽는 중 · 실패 · 없음을 셋으로 가른다**(D-136 · `DESIGN.md` §9).

    이 화면의 세 섹션(제출 현황 · 확인이 필요한 학생 · 배정 학습 오답노트)은 모두 배정 기록에서
    온다. `classes`는 세션이라 레이아웃이 기다려 주지만 `assignments`는 아니었다 — 첫 조회가
    끝나기 전에는 비어 있어서, 배정이 있는 학원의 원장도 첫 진입에서 `아직 배정한 학습이 없어요` +
    `학습 배정하러 가기`를 봤다. 실패해도 같은 화면이 남는다(`loading`이 내려간다).

    게이트는 `loading`이 아니라 **`loaded`**(첫 조회가 끝났는가)다(D-163) — 마감일 재배정이 부른
    `reload()` 한 번에 화면이 통째로 `불러오고 있어요`로 돌아가지 않게.
  */
  const ready = progressLoaded;
  /** 실패 문장. 서버가 준 것을 그대로 쓴다(`errorMessage`). */
  const loadError = progressError;

  /** 지금 내가 보는 반에 있는 학생. 반에서 빠진 학생을 가르는 기준이다(아래 `needStudents`). */
  const inMyClass = useMemo(
    () => new Set(classes.flatMap((c) => c.studentIds)),
    [classes],
  );

  /** 마감이 지났고 **안 낸 학생이 남은** 배정. 마감일을 다시 정할 대상이다(D-046). */
  const reassignable = useMemo(() => {
    const map = new Map<string, number>();
    for (const x of overdueAssignments(scoped, today)) map.set(x.assignment.id, x.missing);
    return map;
  }, [scoped, today]);

  /** 오늘·내일 마감. `dueSoon`의 이번 주 목록에서 이틀만 잘라 쓴다. */
  const soonIds = useMemo(() => {
    const limit = dayAfter(today, 1);
    return new Set(
      dueSoon(scoped, today)
        .week.filter((a) => (a.dueDate ?? NO_DUE) <= limit)
        .map((a) => a.id),
    );
  }, [scoped, today]);

  const pendingAll = useMemo(() => pendingStat(scoped), [scoped]);
  const avgAccuracy = useMemo(() => weightedAccuracy(scoped), [scoped]);

  /** 배정이 있는 반만 필터 후보로 둔다. 반 122개를 모두 칩으로 늘어놓지 않는다. */
  const classOptions = useMemo(() => {
    const count = new Map<string, number>();
    for (const a of scoped) count.set(a.classId, (count.get(a.classId) ?? 0) + 1);
    return classes
      .filter((c) => count.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, count: count.get(c.id) ?? 0 }));
  }, [classes, scoped]);

  const classSearch = classOptions.length > SEGMENT_MAX;

  /** 실려 온 배정 id가 지금 내가 보는 범위에 있을 때만 좁힌다. 아니면 전체를 보여 준다(D-075). */
  const taskNarrow = useMemo(
    () => (fromTask && scoped.some((a) => a.id === fromTask) ? fromTask : ''),
    [fromTask, scoped],
  );

  const taskRows = useMemo(() => {
    const q = classQuery.trim();
    const t = taskQuery.trim();
    const rows = scoped
      .filter((a) => !taskNarrow || a.id === taskNarrow)
      .filter((a) =>
        dueFilter === 'overdue'
          ? !!a.dueDate && a.dueDate < today
          : dueFilter === 'soon'
            ? soonIds.has(a.id)
            : true,
      )
      .filter((a) => classFilter === 'all' || a.classId === classFilter)
      .filter((a) => !q || classNameOf(a, classes).includes(q))
      .filter((a) => !t || a.title.includes(t));
    /*
      `전체`는 **최근 마감부터** 본다. 마감 이른 순으로 두면 반년 전에 지난 배정이 늘 맨 위에
      올라와, 지금 확인할 것을 찾으려면 페이지를 끝까지 넘겨야 한다.
      좁혀서 볼 때(`마감 지남`·`오늘·내일`)는 급한 것이 이른 마감이므로 반대로 세운다.
    */
    return dueFilter === 'all' ? rows.sort((a, b) => -byDueAsc(a, b)) : rows.sort(byDueAsc);
  }, [scoped, taskNarrow, dueFilter, classFilter, classQuery, taskQuery, soonIds, today, classes]);

  const overdueCount = useMemo(
    () => scoped.filter((a) => !!a.dueDate && a.dueDate < today).length,
    [scoped, today],
  );

  /**
   * 확인이 필요한 학생. **마감이 지났거나 오늘·내일 마감인 것만** 센다 —
   * 마감이 남은 배정은 제출 현황의 `제출 3/9`가 이미 말한다. 방금 배정한 과제 때문에
   * 반 전원이 '확인이 필요한 학생'으로 뜨면 선생님이 정상 학생에게 연락하게 된다.
   */
  const urgent = useMemo(
    () => scoped.filter((a) => reassignable.has(a.id) || soonIds.has(a.id)),
    [scoped, reassignable, soonIds],
  );

  const needStudents = useMemo<NeedStudent[]>(() => {
    const tasks = new Map<string, MissingTask[]>();
    for (const a of urgent) {
      for (const s of a.submissions) {
        if (s.submitted) continue;
        const list = tasks.get(s.studentId) ?? [];
        list.push({
          assignmentId: a.id,
          title: `${a.subject} · ${a.title}`,
          name: a.title,
          className: classNameOf(a, classes),
          dueDate: a.dueDate,
          overdue: reassignable.has(a.id),
        });
        tasks.set(s.studentId, list);
      }
    }
    // `pendingStat`이 정한 순서(안 낸 개수 → 급한 마감)를 그대로 쓴다.
    const q = needQuery.trim();
    return pendingStat(urgent)
      .byStudent.map((s) => {
        /*
          **반에서 빼도 그 학생의 배정 대상 행은 남는다** — `removeStudentFromClass`는
          `class_students.removed_at`만 채우므로 이 목록에는 계속 나온다. 예전에는 이름을 못
          찾으면 그냥 `학생`이라고 불렀고, 대시보드에서 눌러 간 상세는 `학생을 찾을 수 없어요`로
          끝났다 — 목록이 가리킨 곳에서 할 수 있는 일이 0개였다. 지금은 그 사실을 행에서 말하고
          상세로 보내지 않는다(대시보드의 `studentLine`과 같은 판단).
        */
        const found = accountOf(s.studentId);
        const mine = inMyClass.has(s.studentId);
        return {
          studentId: s.studentId,
          name: found?.name ?? '반에서 빠진 학생',
          left: !!found && !mine,
          openable: mine && !!studentInScope(s.studentId),
          count: s.count,
          nearest: s.nearest,
          tasks: (tasks.get(s.studentId) ?? []).sort(byDueAsc),
        };
      })
      .filter((s) => !q || s.name.includes(q));
  }, [urgent, reassignable, needQuery, accountOf, classes, inMyClass, studentInScope]);

  /**
   * 배정 학습 오답노트. 읽기는 `academyNotesOf` 한 경로로만 한다(담당 반 + 우리 학원 배정 검사).
   * 순회 대상을 **배정이 있는 반의 학생**으로 좁힌다 — 노트가 우리 배정에서 나왔어야 하므로
   * 배정이 없는 반의 학생을 도는 것은 언제나 빈 결과다(원장 계정 3,000명 순회의 원인이었다).
   */
  const notes = useMemo<NoteRow[]>(() => {
    const titleOf = new Map(scoped.map((a) => [a.id, `${a.subject} · ${a.title}`]));
    const withAssignment = new Set(scoped.map((a) => a.classId));
    const studentIds = Array.from(
      new Set(classes.filter((c) => withAssignment.has(c.id)).flatMap((c) => c.studentIds)),
    );
    const rows: NoteRow[] = [];
    for (const studentId of studentIds) {
      const studentName = accountOf(studentId)?.name ?? '학생';
      for (const note of academyNotesOf(studentId)) {
        rows.push({
          note,
          studentId,
          studentName,
          taskId: note.itemId,
          taskTitle: titleOf.get(note.itemId) ?? '배정 학습',
        });
      }
    }
    // 최근에 담은 것부터. 담은 날이 없는 옛 기록은 뒤로 보낸다.
    return rows.sort((a, b) => (b.note.createdAt ?? '').localeCompare(a.note.createdAt ?? ''));
  }, [classes, scoped, academyNotesOf, accountOf]);

  /** 오답이 담긴 과제만 필터 후보로 둔다. 많으면 오답이 많은 순으로 앞의 것만 칩으로 둔다. */
  const noteTaskOptions = useMemo(() => {
    const count = new Map<string, { title: string; count: number }>();
    for (const r of notes) {
      const cur = count.get(r.taskId) ?? { title: r.taskTitle, count: 0 };
      cur.count += 1;
      count.set(r.taskId, cur);
    }
    return [...count.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.count - a.count);
  }, [notes]);

  const noteTasksShown = noteTaskOptions.slice(0, SEGMENT_MAX);
  const noteTasksHidden = noteTaskOptions.length - noteTasksShown.length;

  /** 과제로만 좁힌 목록. 아래 집계는 학생 이름 검색과 무관하게 센다. */
  const taskScopedNotes = useMemo(
    () => (noteTask === 'all' ? notes : notes.filter((r) => r.taskId === noteTask)),
    [notes, noteTask],
  );

  /** 같은 문항을 담은 학생 수. 수업에서 다시 볼 문항을 개인 메모를 열지 않고 고를 수 있다. */
  const together = useMemo(() => {
    const byQ = new Map<string, { prompt: string; taskTitle: string; students: Set<string> }>();
    for (const r of taskScopedNotes) {
      const cur =
        byQ.get(r.note.qId) ??
        { prompt: r.note.prompt, taskTitle: r.taskTitle, students: new Set<string>() };
      cur.students.add(r.studentId);
      byQ.set(r.note.qId, cur);
    }
    return [...byQ.entries()]
      .map(([qId, v]) => ({ qId, prompt: v.prompt, taskTitle: v.taskTitle, students: v.students.size }))
      .filter((x) => x.students >= TOGETHER_MIN)
      .sort((a, b) => b.students - a.students)
      .slice(0, TOGETHER_TOP);
  }, [taskScopedNotes]);

  const noteRows = useMemo(() => {
    const q = noteQuery.trim();
    return taskScopedNotes
      .filter((r) => memoFilter === 'all' || !!r.note.dig)
      .filter((r) => !q || r.studentName.includes(q));
  }, [taskScopedNotes, memoFilter, noteQuery]);

  /*
    페이지는 필터가 바뀌면 처음으로 돌아가야 한다. effect에서 setState를 하면 렌더가 연쇄되므로
    상태에 필터 키를 함께 담아 **파생**으로 계산한다(`ChildReport`의 오답 페이지와 같은 방법).
  */
  const taskKey = `${taskNarrow}|${dueFilter}|${classFilter}|${classQuery.trim()}|${taskQuery.trim()}`;
  const taskPage = taskNav.key === taskKey ? taskNav.page : 0;
  const visibleTasks = taskRows.slice(taskPage * PAGE, taskPage * PAGE + PAGE);

  const studentKey = `${needStudents.length}|${needQuery.trim()}`;
  const studentPage = studentNav.key === studentKey ? studentNav.page : 0;
  const visibleStudents = needStudents.slice(
    studentPage * STUDENT_PAGE,
    studentPage * STUDENT_PAGE + STUDENT_PAGE,
  );

  const noteKey = `${noteTask}|${memoFilter}|${noteQuery.trim()}`;
  const notePage = noteNav.key === noteKey ? noteNav.page : 0;
  const shownNote = noteRows[Math.min(notePage, Math.max(0, noteRows.length - 1))];

  /** 안 낸 학생 이름 한 줄. 25명 반을 그대로 쏟지 않고 앞의 몇 명만 말한다. */
  function missingNames(a: Assignment): string {
    const names = a.submissions
      .filter((s) => !s.submitted)
      // 이름을 못 찾는 계정은 학원을 떠난 학생이다. 아무 학생이나 가리키는 `학생`으로 쓰지 않는다.
      .map((s) => accountOf(s.studentId)?.name ?? '반에서 빠진 학생');
    const head = names.slice(0, NAME_PREVIEW).join(' · ');
    return names.length > NAME_PREVIEW ? `${head} 외 ${names.length - NAME_PREVIEW}명` : head;
  }

  function openReassign(scope: 'task' | 'student', key: string, assignmentId: string) {
    const same = reassignAt?.scope === scope && reassignAt.key === key;
    setReassignAt(same ? null : { scope, key, assignmentId });
    setDue('');
    setDueError(null);
  }

  /**
   * 마감일만 새로 정한다. 배정 화면과 **같은 검사**를 쓴다(`parseDueDate`) —
   * 화면마다 규칙이 다르면 어제 날짜로 배정되는 구멍이 남는다.
   */
  async function submitReassign(assignmentId: string) {
    const parsed = parseDueDate(due, today, { allowToday: false });
    if (!parsed.ok) {
      setDueError(parsed.error);
      return;
    }
    if (!parsed.value) {
      setDueError('새 마감일을 적어 주세요.');
      return;
    }
    const r = await reassign(assignmentId, parsed.value);
    if (!r.ok) {
      setDueError(r.error ?? '마감일을 바꾸지 못했어요.');
      return;
    }
    setDueError(null);
    setReassignAt(null);
    setDue('');
    show('마감일을 다시 정했어요');
  }

  /** 마감일 입력 한 벌. 두 섹션이 같은 결과를 만들므로 같은 문장·같은 검사를 쓴다. */
  function reassignPanel(assignmentId: string, prefix: string, missing: number) {
    return (
      <View style={inset.panel}>
        <AppText variant="caption" tone="secondary">
          마감일을 바꾸면 안 낸 학생 {missing}명에게만 다시 열려요.
        </AppText>
        <AppText variant="caption" tone="tertiary">
          이미 낸 학생의 제출 기록과 학부모 리포트의 달은 그대로예요.
        </AppText>
        <Field
          label="새 마감일"
          testID={`${prefix}-due-${assignmentId}`}
          accessibilityLabel="새 마감일"
          value={due}
          onChangeText={setDue}
          placeholder="예: 2026-08-11"
          // 날짜 한 줄이라 넓은 화면에서도 입력폭을 늘리지 않는다.
          style={styles.dueInput}
        />
        {dueError ? (
          <AppText variant="caption" style={{ color: colors.danger }}>
            {dueError}
          </AppText>
        ) : null}
        {/*
          패널 안에서도 행동은 줄의 오른쪽 끝이다(§8 규칙 ③ · D-146). 패널 자체에 정렬을 주면
          위 설명 문장까지 따라오므로 버튼만 감싼다. 학생 상세의 쌍둥이 패널과 같게 맞춘다.
        */}
        <View style={endRow.action}>
          <Button
            testID={`${prefix}-submit-${assignmentId}`}
            hug
            label="다시 배정하기"
            onPress={() => submitReassign(assignmentId)}
          />
        </View>
      </View>
    );
  }

  const dueOptions: SegmentedOption<DueFilter>[] = [
    { value: 'all', label: '전체', count: scoped.length },
    { value: 'overdue', label: '마감 지남', count: overdueCount },
    { value: 'soon', label: '오늘·내일 마감', count: soonIds.size },
  ];

  const memoOptions: SegmentedOption<MemoFilter>[] = [
    { value: 'all', label: '전체', count: taskScopedNotes.length },
    { value: 'memo', label: '메모 있음', count: taskScopedNotes.filter((r) => !!r.note.dig).length },
  ];

  /**
   * 쿼리로 좁혀 들어온 이유와 되돌아갈 길(§20 · D-075). **두 갈래를 한 자리로 모은다** —
   * 대시보드는 `?due=`로, 배정 완료 화면은 `?task=`로 보내고 배너는 화면에 하나만 선다.
   *
   * **수는 지금 목록의 크기를 그대로 말한다**(`taskRows.length`, D-084 ①). 예전에는
   * `overdueCount`·`soonIds.size`를 말했는데 둘은 반·과제 검색을 거치기 전 값이라 더 좁히는
   * 순간 화면에 남은 줄 수와 어긋났다. 설명도 필터 이름과 같은 말로 둔다.
   */
  const narrowed = taskNarrow
    ? {
        testID: 'submit-clear-task',
        text: `배정 화면에서 넘어왔어요. 방금 배정한 학습 ${taskRows.length}개만 남겼어요.`,
        /* 좁힌 근거가 주소에 있으니 되돌리는 것도 주소를 지우는 일이다(뒤로가기를 만들지 않게 `replace`). */
        clear: () => router.replace('/academy/analytics' as never),
      }
    : fromQuery !== 'all' && dueFilter === fromQuery
      ? {
          testID: 'submit-clear-narrow',
          text: `대시보드에서 넘어왔어요. ${
            fromQuery === 'overdue' ? '마감이 지난' : '오늘·내일 마감인'
          } 배정 ${taskRows.length}개만 남겼어요.`,
          clear: () => {
            setDueFilter('all');
            router.replace('/academy/analytics' as never);
          },
        }
      : null;

  /*
    **첫 조회가 끝나기 전에는 배정이 없다고 말하지 않는다**(§9). 빈 상자 셋과 배정 CTA를 두면
    배정이 있는 학원의 원장이 첫 화면에서 "아무것도 안 냈다"를 읽는다.
  */
  if (!ready) {
    return (
      <Screen wide testID="academy-analytics" title="성과 분석">
        <TestDataNote />
        <AppText variant="caption" tone="secondary">
          배정 기록을 불러오고 있어요.
        </AppText>
      </Screen>
    );
  }

  /* 못 읽은 목록을 없는 목록으로 말하지 않는다(D-136). 실패 문장 하나와 다시 시도만 둔다. */
  if (loadError && scoped.length === 0) {
    return (
      <Screen wide testID="academy-analytics" title="성과 분석">
        <TestDataNote />
        <LoadFailed
          testID="analytics-load-failed"
          retryTestID="analytics-load-retry"
          what="배정 기록"
          message={loadError}
          onRetry={() => void reloadProgress()}
        />
      </Screen>
    );
  }

  // 배정이 없으면 하위 섹션을 아예 그리지 않는다. 빈 상자 셋을 쌓는 대신 다음 행동 하나를 둔다.
  if (scoped.length === 0) {
    return (
      <Screen wide testID="academy-analytics" title="성과 분석">
        <TestDataNote />
        <Group>
          <View style={styles.empty}>
            <AppText tone="secondary">아직 배정한 학습이 없어요.</AppText>
            <AppText variant="caption" tone="tertiary">
              학습을 배정하면 제출·결과와 배정 학습 오답노트를 여기서 봐요.
            </AppText>
          </View>
        </Group>
        <ActionBar>
          <Button
            testID="analytics-goto-assign"
            /* 빈 상태의 다음 행동은 `hug`이다(§8). `ActionBar`가 줄의 오른쪽 끝에 세운다(규칙 ③). */
            hug
            label="학습 배정하러 가기"
            trailing={<Icon name="arrow-right" size={16} color={colors.accentText} />}
            onPress={() => router.navigate('/academy/assign' as never)}
          />
        </ActionBar>
      </Screen>
    );
  }

  return (
    <Screen wide testID="academy-analytics" title="성과 분석">
      <TestDataNote />

      {/*
        **한 화면에 실패 면은 하나다**(§9). 세 섹션이 모두 같은 조회에 매달려 있어서 자리마다
        빨간 줄을 두면 한 번의 실패가 세 번으로 읽힌다. 여기까지 왔다는 것은 손에 든 배정이
        있다는 뜻이라(위 게이트) 이미 읽어 둔 값은 그대로 보여 준다 — 가진 것은 사실이다.
      */}
      {loadError ? (
        <LoadFailed
          testID="analytics-load-failed"
          retryTestID="analytics-load-retry"
          what="배정 기록"
          message={loadError}
          again
          onRetry={() => void reloadProgress()}
        />
      ) : null}

      <Section title="제출 현황">
        {narrowed ? (
          <View style={styles.narrowed}>
            <AppText variant="caption" tone="secondary" style={styles.narrowedText}>
              {narrowed.text}
            </AppText>
            <Button
              testID={narrowed.testID}
              size="sm"
              variant="ghost"
              tone="accent"
              hug
              label="전체 보기"
              /* 옆 문장과 떨어져 읽히면 무엇의 전체인지 알 수 없다. 이름을 고정한다(§8). */
              accessibilityLabel="배정 전체 보기"
              onPress={narrowed.clear}
            />
          </View>
        ) : null}
        <AppText variant="caption" tone="secondary">
          배정 {scoped.length}개 · 안 낸 학생 {pendingAll.students}명
          {avgAccuracy != null ? ` · 평균 정답률 ${avgAccuracy}%` : ''}
        </AppText>
        <SegmentedControl testID="submit-filter" options={dueOptions} value={dueFilter} onChange={setDueFilter} />
        <Field
          label="과제 이름으로 찾기"
          testID="submit-search"
          value={taskQuery}
          onChangeText={setTaskQuery}
          placeholder="예: 현대소설 점검"
        />
        {classSearch ? (
          <Field
            label="반 이름으로 좁히기"
            testID="submit-class-search"
            value={classQuery}
            onChangeText={setClassQuery}
            placeholder="예: 고1 국어 3반"
          />
        ) : classOptions.length > 1 ? (
          <SegmentedControl
            testID="submit-class"
            options={[
              { value: 'all', label: '모든 반', count: scoped.length },
              ...classOptions.map((c) => ({ value: c.id, label: c.name, count: c.count })),
            ]}
            value={classFilter}
            onChange={setClassFilter}
          />
        ) : null}
        <AppText variant="caption" tone="tertiary">
          {dueFilter === 'all'
            ? '최근 마감부터예요. 행을 누르면 안 낸 학생을 볼 수 있어요.'
            : '마감이 급한 것부터예요. 행을 누르면 안 낸 학생을 볼 수 있어요.'}
        </AppText>

        {taskRows.length === 0 ? (
          <Group>
            <View style={styles.empty}>
              <AppText tone="secondary">고른 조건에 맞는 배정이 없어요.</AppText>
            </View>
          </Group>
        ) : (
          <Group>
            {visibleTasks.map((a) => {
              const stat = submitStat(a);
              const missing = stat.total - stat.submitted;
              const canReassign = reassignable.has(a.id);
              const open = openTask === a.id;
              const dueOpen = reassignAt?.scope === 'task' && reassignAt.key === a.id;
              return (
                <View key={a.id}>
                  <Row
                    testID={`submit-${a.id}`}
                    title={`${a.subject} · ${a.title}`}
                    subtitle={[classNameOf(a, classes), dueText(a.dueDate)].filter(Boolean).join(' · ')}
                    accessibilityLabel={
                      missing > 0 ? `${a.title} 안 낸 학생 보기` : `${a.title} 모두 냈어요`
                    }
                    onPress={missing > 0 ? () => setOpenTask(open ? null : a.id) : undefined}
                    trailing={
                      <AppText variant="label">
                        제출 {stat.submitted}/{stat.total}
                        {stat.avgAccuracy != null ? ` · 평균 ${stat.avgAccuracy}%` : ''}
                      </AppText>
                    }
                  />
                  {open ? (
                    <View style={inset.panel}>
                      <AppText variant="caption" tone="secondary">
                        안 낸 학생 {missing}명
                      </AppText>
                      <AppText variant="caption">{missingNames(a)}</AppText>
                    </View>
                  ) : null}
                  {canReassign ? (
                    <View style={inset.action}>
                      <Button
                        testID={`reassign-open-${a.id}`}
                        size="sm"
                        variant="ghost"
                        tone="accent"
                        hug
                        label={dueOpen ? '접기' : '마감일 다시 정하기'}
                        accessibilityLabel={dueOpen ? '접기' : `${a.title} 마감일 다시 정하기`}
                        leading={
                          <Icon
                            name={dueOpen ? 'arrow-up' : 'refresh-cw'}
                            size={15}
                            color={colors.accent}
                          />
                        }
                        onPress={() => openReassign('task', a.id, a.id)}
                      />
                    </View>
                  ) : null}
                  {dueOpen ? reassignPanel(a.id, 'reassign', missing) : null}
                </View>
              );
            })}
          </Group>
        )}
        {taskRows.length > PAGE ? (
          <Pager
            testID="submit-pager"
            total={taskRows.length}
            page={taskPage}
            pageSize={PAGE}
            onChange={(page) => setTaskNav({ key: taskKey, page })}
          />
        ) : null}
      </Section>

      <Section title="확인이 필요한 학생">
        <AppText variant="caption" tone="secondary">
          마감이 지났거나 오늘·내일 마감인 과제를 학생 기준으로 다시 묶었어요. 위 필터와 상관없이
          담당 반 전체를 세어요.
        </AppText>
        <Field
          label="학생 이름으로 찾기"
          testID="need-search"
          value={needQuery}
          onChangeText={setNeedQuery}
          placeholder="예: 박도윤"
        />
        {needStudents.length === 0 ? (
          <Group>
            <View style={styles.empty}>
              <AppText tone="secondary">
                {needQuery.trim()
                  ? '그 이름으로 급한 미제출이 있는 학생을 찾지 못했어요.'
                  : pendingAll.count === 0
                    ? '모두 제출했어요.'
                    : '급한 미제출은 없어요. 남은 과제는 위 제출 현황에서 볼 수 있어요.'}
              </AppText>
            </View>
          </Group>
        ) : (
          <Group>
            {visibleStudents.map((s) => {
              const first = s.tasks[0];
              const open = openStudent === s.studentId;
              const target = s.tasks.find((t) => t.overdue);
              const dueOpen = reassignAt?.scope === 'student' && reassignAt.key === s.studentId;
              return (
                <View key={s.studentId}>
                  <Row
                    testID={`need-${s.studentId}`}
                    title={s.name}
                    subtitle={[
                      s.count === 1 && first
                        ? [`${first.title} 미제출`, first.className, dueText(first.dueDate)]
                            .filter(Boolean)
                            .join(' · ')
                        : `안 낸 과제 ${s.count}건 · 가장 급한 마감 ${dueText(s.nearest)}`,
                      // 이름을 모르는 학생은 제목이 이미 그 말을 한다 — 같은 말을 두 번 두지 않는다.
                      s.left ? '반에서 빠진 학생이에요' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    accessibilityLabel={`${s.name} 안 낸 과제 보기`}
                    /*
                      **펼칠 수 있다는 표시가 없으면 이 행은 눌러 볼 이유가 없다.**
                      선생님 흐름의 마지막 단계(마감일 다시 정하기)가 이 행 뒤에 있다.
                    */
                    trailing={
                      <View style={open ? { transform: [{ rotate: '90deg' }] } : undefined}>
                        <Icon name="chevron-right" size={18} color={colors.inkTertiary} />
                      </View>
                    }
                    onPress={() => setOpenStudent(open ? null : s.studentId)}
                  />
                  {open ? (
                    <View style={inset.panel}>
                      {/* 안 낸 과제가 하나면 위 부제가 이미 그 과제를 말한다 — 같은 말을 두 번 하지 않는다. */}
                      {s.count > 1
                        ? s.tasks.map((t) => (
                            <AppText key={t.assignmentId} variant="caption" tone="secondary">
                              {[t.title, t.className, dueText(t.dueDate)].filter(Boolean).join(' · ')}
                            </AppText>
                          ))
                        : null}
                      {/*
                        **학생 축에서 그 학생 상세로 가는 길.** 대시보드의 `안 낸 학생` 행과 반
                        상세의 펼침은 이미 같은 곳으로 가는데(D-084 ⑥ — 같은 목적지는 한 이름·한
                        아이콘) 미제출을 다루는 주 화면인 여기만 길이 없었다. 그래서 이름을 아는
                        학생의 지난 제출·정답률을 보려면 학생 목록으로 되돌아가 다시 찾아야 했다.
                        모양·이름은 반 상세의 `class-student-detail-*`과 같다.
                      */}
                      {s.openable ? (
                        <View style={endRow.action}>
                          <Button
                            testID={`need-student-detail-${s.studentId}`}
                            variant="ghost"
                            tone="accent"
                            hug
                            leading={<Icon name="user" size={16} color={colors.accent} />}
                            label="이 학생 기록 전체 보기"
                            accessibilityLabel={`${s.name} 학생 기록 전체 보기`}
                            onPress={() =>
                              router.push(`/academy/classes/student/${s.studentId}` as never)
                            }
                          />
                        </View>
                      ) : (
                        /* 열리지 않는 상세로 보내지 않는다. 왜 없는지만 한 줄로 말한다(§8 · D-141). */
                        <AppText variant="caption" tone="tertiary">
                          반에서 빠진 학생이라 기록 전체 보기는 열리지 않아요.
                        </AppText>
                      )}
                      {target ? (
                        /* 위 과제 목록과 같은 패널 안이라 버튼만 오른쪽으로 뺀다(D-146).
                           바로 위 과제 섹션의 `reassign-open-*`은 `inset.action`이라 이미
                           오른쪽인데, 같은 일을 하는 이 버튼만 왼쪽이었다. */
                        <View style={endRow.action}>
                          <Button
                            testID={`student-reassign-open-${s.studentId}`}
                            size="sm"
                            variant="ghost"
                            tone="accent"
                            hug
                            /* 라벨과 같은 문장이라 `accessibilityLabel`을 따로 주지 않는다 —
                               버튼 안 글자에서 접근 가능한 이름이 계산된다. */
                            label={dueOpen ? '접기' : `${target.name} 마감일 다시 정하기`}
                            leading={
                              <Icon
                                name={dueOpen ? 'arrow-up' : 'refresh-cw'}
                                size={15}
                                color={colors.accent}
                              />
                            }
                            onPress={() =>
                              openReassign('student', s.studentId, target.assignmentId)
                            }
                          />
                        </View>
                      ) : (
                        <AppText variant="caption" tone="tertiary">
                          마감이 아직 남아 있어요. 마감이 지나면 마감일을 다시 정할 수 있어요.
                        </AppText>
                      )}
                    </View>
                  ) : null}
                  {dueOpen && reassignAt ? (
                    <View style={styles.nested}>
                      {reassignPanel(
                        reassignAt.assignmentId,
                        'student-reassign',
                        reassignable.get(reassignAt.assignmentId) ?? 0,
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Group>
        )}
        {needStudents.length > STUDENT_PAGE ? (
          <Pager
            testID="need-pager"
            total={needStudents.length}
            page={studentPage}
            pageSize={STUDENT_PAGE}
            unit="명"
            onChange={(page) => setStudentNav({ key: studentKey, page })}
          />
        ) : null}
      </Section>

      <Section title={`배정 학습 오답노트 ${notes.length}개`}>
        <AppText variant="caption" tone="tertiary">
          배정한 학습의 제출과 결과만 표시합니다. 학생 개인 학습 상세는 표시하지 않습니다.
        </AppText>

        {notes.length === 0 ? (
          <Group>
            <View style={styles.empty}>
              <AppText tone="secondary">배정 학습에서 담은 오답이 아직 없어요.</AppText>
              <AppText variant="caption" tone="tertiary">
                학생이 개인 학습에서 담은 오답은 학원에 공개되지 않아요.
              </AppText>
            </View>
          </Group>
        ) : (
          <>
            {noteTasksShown.length > 1 ? (
              <>
                <SegmentedControl
                  testID="note-task"
                  options={[
                    { value: 'all', label: '모든 과제', count: notes.length },
                    ...noteTasksShown.map((t) => ({
                      value: t.id,
                      label: t.title,
                      count: t.count,
                    })),
                  ]}
                  value={noteTask}
                  onChange={setNoteTask}
                />
                {/* 칩을 줄였으면 줄였다고 밝힌다 — 목록이 조용히 잘리지 않게. */}
                {noteTasksHidden > 0 ? (
                  <AppText variant="caption" tone="tertiary">
                    오답이 많은 과제 {noteTasksShown.length}개만 칩으로 뒀어요. 나머지{' '}
                    {noteTasksHidden}개는 학생 이름으로 찾아 주세요.
                  </AppText>
                ) : null}
              </>
            ) : null}

            {together.length > 0 ? (
              <View style={styles.block}>
                <AppText variant="label">여러 학생이 담은 문항</AppText>
                <AppText variant="caption" tone="tertiary">
                  같은 문항을 담은 학생 수예요. 아래 학생 이름 검색과는 따로 세어요.
                </AppText>
                <Group>
                  {together.map((t) => (
                    <Row
                      key={t.qId}
                      testID={`together-${t.qId}`}
                      title={t.prompt}
                      subtitle={t.taskTitle}
                      trailing={<AppText variant="label">{t.students}명</AppText>}
                    />
                  ))}
                </Group>
              </View>
            ) : null}

            <View style={styles.block}>
              <AppText variant="label">학생이 정리한 메모</AppText>
              <Field
                label="학생 이름으로 찾기"
                testID="note-search"
                value={noteQuery}
                onChangeText={setNoteQuery}
                placeholder="예: 정예린"
              />
              <SegmentedControl
                testID="note-memo"
                options={memoOptions}
                value={memoFilter}
                onChange={setMemoFilter}
              />
              {shownNote ? (
                <>
                  <NoteCard row={shownNote} />
                  <Pager
                    testID="academy-note-pager"
                    total={noteRows.length}
                    page={notePage}
                    pageSize={1}
                    onChange={(page) => setNoteNav({ key: noteKey, page })}
                  />
                </>
              ) : (
                <Group>
                  <View style={styles.empty}>
                    <AppText tone="secondary">고른 조건에 맞는 오답이 없어요.</AppText>
                  </View>
                </Group>
              )}
            </View>
          </>
        )}
      </Section>
    </Screen>
  );
}


/**
 * 오답 하나를 펼쳐 보여 준다. **메모 본문까지 보여 주는 것은 배정 학습 오답에 한한다**(D-054).
 * 여러 줄 서식이 있는 글이라 `Row`에 담을 수 없어 `RichText`로 그린다.
 */
function NoteCard({ row }: { row: NoteRow }) {
  const { note } = row;
  return (
    <Group>
      <View style={styles.note}>
        <AppText variant="label">{row.studentName}</AppText>
        <AppText variant="caption" tone="tertiary">
          {row.taskTitle} · {note.area}
          {note.createdAt ? ` · ${formatDate(note.createdAt)}에 담았어요` : ''}
        </AppText>
        <AppText>{note.prompt}</AppText>
        <AppText variant="caption" style={{ color: colors.success }}>
          정답 · {note.choices[note.answerIndex]}
        </AppText>
        {note.dig ? (
          <View style={styles.memo}>
            <AppText variant="caption" tone="accent">
              학생이 AI와 정리한 메모
            </AppText>
            <RichText text={note.dig} />
          </View>
        ) : (
          <AppText variant="caption" tone="tertiary">
            아직 메모를 정리하지 않았어요.
          </AppText>
        )}
      </View>
    </Group>
  );
}

const styles = StyleSheet.create({
  narrowed: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  narrowedText: { flex: 1, minWidth: 220 },
  /** 학생 행 안에서 한 단계 더 들어간 입력. 어디에 딸린 입력인지 보이게 들여쓴다. */
  nested: { paddingLeft: spacing.sm },
  dueInput: { maxWidth: 280 },
  empty: { padding: spacing.lg, gap: spacing.xs },
  /* 실패 문장 + 다시 시도. 카드로 만들지 않는다(학생 홈·대시보드와 같은 모양, §9). */
  loadFailed: { gap: spacing.sm, alignItems: 'flex-start' },
  block: { gap: spacing.sm },
  note: { padding: spacing.lg, gap: 4 },
  memo: { gap: 2, marginTop: 2 },
});
