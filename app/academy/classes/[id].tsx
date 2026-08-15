import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActionBar,
  ConfirmStep,
  Screen,
  Section,
  Group,
  Row,
  Button,
  Field,
  AppText,
  Icon,
  Pager,
} from '@/components';
import { useCurrentAccount, useSession } from '@/session';
import { useProgress } from '@/features/progress';
import { useAcademyStaff } from '@/features/academy';
import { useToast } from '@/features/toast';
import { pendingStat, submitStat } from '@/features/academyStats';
import { dueLabel, formatDate } from '@/features/learning';
import { endRow, inset } from '@/theme/styles';
import { colors, radius, spacing } from '@/theme/tokens';

/** 배정은 마감 임박순으로 5개씩. 반 하나에 배정이 쌓여도 화면이 길어지지 않게 한다. */
const ASSIGN_PAGE = 5;
/** 학생은 12명씩. 로스터 반은 25명이라 한 번에 다 쏟지 않는다. */
const STUDENT_PAGE = 12;
/** 이름 검색을 두기 시작하는 학생 수. */
const SEARCH_FROM = 12;
/** 담당 선생님 후보를 한 번에 보여 줄 수. */
const TEACHER_PICK = 6;
/** 학생 추가 후보를 한 번에 보여 줄 수. 학원 학생이 3,000명이라 검색을 먼저 받는다. */
const CANDIDATE_PICK = 8;

/** 마감 없는 배정은 목록 맨 뒤로. */
const NO_DUE = '9999-99-99';

/**
 * 반 상세: 담당 선생님 · 배정 학습 · 학생 목록 · 학생 추가 · 반 관리.
 *
 * 권한 밖 반은 열리지 않는다 — 목록을 좁혀 주는 것에 의존하지 않고 `classById`가 검사한다.
 * 학생 행을 펼치면 **우리 반 배정의 제출 결과만** 보인다. 개인 학습은 학원에 공개하지 않는다
 * (마스터 플랜 2절 · D-014).
 */
export default function ClassDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const classId = typeof id === 'string' ? id : '';
  const account = useCurrentAccount();
  const { academyStudents } = useSession();
  const isDirector = account.academyRole === 'director';
  const { assignments, academyNotesOf } = useProgress();
  const {
    teachers,
    classById,
    studentsIn,
    addStudentsToClass,
    removeStudentFromClass,
    setClassTeacher,
    renameClass,
    archiveClass,
  } = useAcademyStaff();
  const { show } = useToast();

  const [assignPage, setAssignPage] = useState(0);
  const [studentQuery, setStudentQuery] = useState('');
  const [studentPage, setStudentPage] = useState(0);
  const [openStudent, setOpenStudent] = useState<string | null>(null);
  /** 방금 반에서 뺀 학생. 되돌릴 수 있는 동안 화면에 안내를 남긴다(D-033). */
  const [undo, setUndo] = useState<{ userId: string; name: string } | null>(null);
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [teacherQuery, setTeacherQuery] = useState('');
  const [candidateQuery, setCandidateQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cls = classById(classId);
  const students = useMemo(() => studentsIn(classId), [studentsIn, classId]);

  // 학원은 배정 학습의 제출 결과만 본다. 개인 학습 기록은 여기에 쓰지 않는다.
  const classAssignments = useMemo(
    () =>
      assignments
        .filter((a) => a.classId === classId)
        .sort((x, y) => (x.dueDate ?? NO_DUE).localeCompare(y.dueDate ?? NO_DUE)),
    [assignments, classId],
  );

  /** 학생별 안 낸 과제 건수. 정렬 기준이자 행의 값이다(`pendingStat`이 세는 단위를 정한다). */
  const pendingBy = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of pendingStat(classAssignments).byStudent) map.set(s.studentId, s.count);
    return map;
  }, [classAssignments]);

  /** 학생 한 명의 우리 반 제출 요약. 배정이 없으면 그 사실을 말한다. */
  const summaryFor = useMemo(() => {
    return (studentId: string) => {
      const rows = classAssignments
        .map((a) => a.submissions.find((s) => s.studentId === studentId))
        .filter((s): s is NonNullable<typeof s> => !!s);
      const submitted = rows.filter((s) => s.submitted);
      const accs = submitted.map((s) => s.accuracy).filter((v): v is number => v != null);
      const avg = accs.length ? Math.round(accs.reduce((x, y) => x + y, 0) / accs.length) : null;
      if (rows.length === 0) return '배정 학습 없음';
      return `제출 ${submitted.length}/${rows.length}${avg != null ? ` · 평균 ${avg}%` : ''}`;
    };
  }, [classAssignments]);

  const sortedStudents = useMemo(() => {
    const q = studentQuery.trim();
    return [...students]
      .filter((s) => !q || s.name.includes(q) || s.scodyId.includes(q))
      .sort(
        (a, b) =>
          (pendingBy.get(b.userId) ?? 0) - (pendingBy.get(a.userId) ?? 0) ||
          a.name.localeCompare(b.name),
      );
  }, [students, studentQuery, pendingBy]);

  const teacherCandidates = useMemo(() => {
    const q = teacherQuery.trim();
    if (!q) return teachers;
    return teachers.filter((t) => t.name.includes(q) || t.scodyId.includes(q));
  }, [teachers, teacherQuery]);

  /** 학생 추가 후보: 우리 학원 학생 중 이 반에 없는 사람. 검색을 받기 전에는 늘어놓지 않는다. */
  const candidates = useMemo(() => {
    const q = candidateQuery.trim();
    if (!q || !cls) return [];
    const inClass = new Set(cls.studentIds);
    return academyStudents.filter(
      (s) =>
        s.academyName === cls.academyName &&
        !inClass.has(s.userId) &&
        (s.name.includes(q) || s.scodyId.includes(q)),
    );
  }, [candidateQuery, cls, academyStudents]);

  if (!cls) {
    return (
      <Screen
        wide
        testID="academy-class"
        backFallback="/academy/classes"
        title="반을 찾을 수 없어요"
      >
        <AppText tone="secondary">폐강되었거나 담당하지 않는 반이에요.</AppText>
        <ActionBar>
          <Button
            label="반 목록으로"
            onPress={() => router.replace('/academy/classes' as never)}
          />
        </ActionBar>
      </Screen>
    );
  }

  // 학원에서 제외된 선생님은 담당으로 표시하지 않는다(`teachers`가 이미 제외분을 뺀 목록이다).
  const teacher = teachers.find((t) => t.userId === cls.teacherId);
  const visibleAssignments = classAssignments.slice(
    assignPage * ASSIGN_PAGE,
    (assignPage + 1) * ASSIGN_PAGE,
  );
  const visibleStudents = sortedStudents.slice(
    studentPage * STUDENT_PAGE,
    (studentPage + 1) * STUDENT_PAGE,
  );
  const teacherShown = teacherCandidates.slice(0, TEACHER_PICK);
  const candidateShown = candidates.slice(0, CANDIDATE_PICK);

  async function pickTeacher(userId: string, name: string) {
    const result = await setClassTeacher(cls!.id, userId);
    if (!result.ok) {
      setError(result.error ?? '담당 선생님을 정하지 못했어요.');
      return;
    }
    setError(null);
    setTeacherOpen(false);
    setTeacherQuery('');
    show(userId ? `담당 선생님을 ${name} 선생님으로 정했어요` : '담당 선생님을 미배정으로 뒀어요');
  }

  async function takeOut(userId: string, name: string) {
    const result = await removeStudentFromClass(cls!.id, userId);
    if (!result.ok) {
      setError(result.error ?? '학생을 빼지 못했어요.');
      return;
    }
    setError(null);
    setOpenStudent(null);
    setUndo({ userId, name });
    show(`${name} 학생을 반에서 뺐어요`, 'removed');
  }

  async function addPicked() {
    const result = await addStudentsToClass(cls!.id, picked);
    if (!result.ok) {
      setError(result.error ?? '학생을 추가하지 못했어요.');
      return;
    }
    setError(null);
    show(`학생 ${picked.length}명을 반에 넣었어요`);
    setPicked([]);
    setCandidateQuery('');
  }

  async function submitRename() {
    const next = renameValue.trim();
    const result = await renameClass(cls!.id, next);
    if (!result.ok) {
      setError(result.error ?? '반 이름을 바꾸지 못했어요.');
      return;
    }
    setError(null);
    setRenaming(false);
    show(`반 이름을 ${next}로 바꿨어요`);
  }

  async function submitArchive() {
    const result = await archiveClass(cls!.id);
    if (!result.ok) {
      setError(result.error ?? '폐강하지 못했어요.');
      return;
    }
    setConfirmArchive(false);
    show(`${cls!.name} 반을 폐강했어요`, 'removed');
    router.replace('/academy/classes' as never);
  }

  return (
    <Screen wide testID="academy-class" backFallback="/academy/classes" title={cls.name}>
      {error ? (
        <AppText variant="caption" style={{ color: colors.danger }}>
          {error}
        </AppText>
      ) : null}

      <Group>
        <Row
          testID="class-teacher"
          title="담당 선생님"
          accessibilityLabel={isDirector ? '담당 선생님 정하기' : '담당 선생님'}
          onPress={isDirector ? () => setTeacherOpen((v) => !v) : undefined}
          /*
            바로 아래 `학생 수` 행과 완전히 같은 모양인데 하나만 눌린다.
            원장 흐름에서 담당을 지정하는 진입점이 이것 하나라 표시가 있어야 한다.
          */
          trailing={
            <View style={styles.trailPair}>
              <AppText variant="label">{teacher?.name ?? '미배정'}</AppText>
              {isDirector ? (
                <View style={teacherOpen ? { transform: [{ rotate: '90deg' }] } : undefined}>
                  <Icon name="chevron-right" size={18} color={colors.inkTertiary} />
                </View>
              ) : null}
            </View>
          }
        />
        <Row
          title="학생 수"
          trailing={<AppText variant="label">{students.length.toLocaleString('en-US')}명</AppText>}
        />
      </Group>

      {isDirector && teacherOpen ? (
        <View style={inset.panel}>
          {teachers.length > TEACHER_PICK ? (
            <Field
              label="선생님 이름·아이디로 찾기"
              testID="class-teacher-search"
              value={teacherQuery}
              onChangeText={setTeacherQuery}
              placeholder="예: 김선생 또는 kimteacher"
            />
          ) : null}
          <Group>
            <Row
              testID="class-teacher-none"
              title="미배정으로 두기"
              accessibilityLabel="담당 선생님 미배정으로 두기"
              onPress={() => pickTeacher('', '')}
            />
            {teacherShown.map((t) => (
              <Row
                key={t.userId}
                testID={`class-teacher-${t.scodyId}`}
                title={t.name}
                subtitle={t.scodyId}
                accessibilityLabel={`${t.name} 담당으로 정하기`}
                onPress={() => pickTeacher(t.userId, t.name)}
                trailing={
                  t.userId === cls.teacherId ? (
                    <AppText variant="label" tone="accent">
                      지금 담당
                    </AppText>
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
        </View>
      ) : null}

      <Section
        title="배정 학습"
        action={
          /* 배정 화면이 같은 살아 있는 반 목록을 쓰므로 여기서 만든 반에도 바로 배정된다(D-063). */
          <Button
            testID="class-goto-assign"
            variant="secondary"
            tone="accent"
            size="sm"
            hug
            label="이 반에 배정하기"
            leading={<Icon name="edit-3" size={15} color={colors.accent} />}
            onPress={() => router.push(`/academy/assign?class=${cls.id}` as never)}
          />
        }
      >
        {classAssignments.length === 0 ? (
          <Group>
            <Row title="아직 배정한 학습이 없어요" subtitle="학습을 배정하면 제출 현황이 여기에 보여요" />
          </Group>
        ) : (
          <>
            <AppText variant="caption" tone="secondary">
              마감이 급한 것부터예요.
            </AppText>
            <Group>
              {visibleAssignments.map((a) => {
                const stat = submitStat(a);
                const due = dueLabel(a.dueDate);
                return (
                  <Row
                    key={a.id}
                    testID={`class-task-${a.id}`}
                    title={`${a.subject} · ${a.title}`}
                    subtitle={due ? due.text : '마감 없음'}
                    trailing={
                      <AppText variant="label">
                        제출 {stat.submitted}/{stat.total}
                        {stat.avgAccuracy != null ? ` · 평균 ${stat.avgAccuracy}%` : ''}
                      </AppText>
                    }
                  />
                );
              })}
            </Group>
            {classAssignments.length > ASSIGN_PAGE ? (
              <Pager
                testID="class-task-pager"
                total={classAssignments.length}
                page={assignPage}
                pageSize={ASSIGN_PAGE}
                onChange={setAssignPage}
              />
            ) : null}
          </>
        )}
      </Section>

      <Section title="학생">
        {/* 되돌리기는 사라지면 기회도 사라진다. 토스트가 아니라 화면에 남는 안내다(D-033). */}
        {undo ? (
          <View style={styles.undo}>
            <AppText variant="caption" tone="secondary" style={styles.grow}>
              {undo.name} 학생을 반에서 뺐어요
            </AppText>
            <Button
              testID="class-student-undo"
              variant="ghost"
              tone="accent"
              leading={<Icon name="refresh-cw" size={16} color={colors.accent} />}
              label="되돌리기"
              accessibilityLabel={`${undo.name} 학생 되돌리기`}
              onPress={async () => {
                const result = await addStudentsToClass(cls.id, [undo.userId]);
                if (!result.ok) {
                  setError(result.error ?? '되돌리지 못했어요.');
                  return;
                }
                setUndo(null);
              }}
            />
          </View>
        ) : null}

        <AppText variant="caption" tone="secondary">
          안 낸 과제가 많은 학생부터예요. 행을 누르면 우리 반 제출 결과를 볼 수 있어요.
        </AppText>

        {students.length > SEARCH_FROM ? (
          <Field
            label="학생 이름·아이디로 찾기"
            testID="class-student-search"
            value={studentQuery}
            onChangeText={(v) => {
              setStudentQuery(v);
              setStudentPage(0);
            }}
            placeholder="예: 정예린 또는 hanbit.s0001"
          />
        ) : null}

        <Group>
          {visibleStudents.length === 0 ? (
            <Row
              title={students.length === 0 ? '아직 학생이 없어요' : '찾는 학생이 없어요'}
              subtitle={
                students.length === 0
                  ? '아래에서 학생을 넣으면 학습을 배정할 수 있어요'
                  : '이름이나 아이디를 다시 확인해 주세요'
              }
            />
          ) : (
            visibleStudents.map((st) => {
              const pending = pendingBy.get(st.userId) ?? 0;
              const open = openStudent === st.userId;
              return (
                <View key={st.userId}>
                  <Row
                    testID={`class-student-${st.userId}`}
                    title={st.name}
                    subtitle={summaryFor(st.userId)}
                    accessibilityLabel={open ? `${st.name} 접기` : `${st.name} 제출 결과 보기`}
                    onPress={() => setOpenStudent(open ? null : st.userId)}
                    trailing={
                      <AppText variant="label">
                        {pending > 0 ? `안 낸 과제 ${pending}건` : '안 낸 과제 없음'}
                      </AppText>
                    }
                  />
                  {open ? (
                    <View style={inset.panel}>
                      {classAssignments.length === 0 ? (
                        <AppText variant="caption" tone="secondary">
                          이 반에 배정한 학습이 아직 없어요.
                        </AppText>
                      ) : (
                        classAssignments.map((a) => {
                          const sub = a.submissions.find((s) => s.studentId === st.userId);
                          const done = sub?.submitted;
                          const value = !sub
                            ? '배정 대상 아님'
                            : done
                              ? `냈어요${sub.accuracy != null ? ` · 정답률 ${sub.accuracy}%` : ''}`
                              : '아직 안 냈어요';
                          return (
                            <View key={a.id} style={styles.line}>
                              <AppText variant="caption" tone="secondary" style={styles.grow}>
                                {a.title}
                                {sub?.submittedAt ? ` · ${formatDate(sub.submittedAt)} 제출` : ''}
                              </AppText>
                              <AppText variant="label">{value}</AppText>
                            </View>
                          );
                        })
                      )}
                      <View style={styles.line}>
                        <AppText variant="caption" tone="secondary" style={styles.grow}>
                          배정 학습 오답노트
                        </AppText>
                        <AppText variant="label">{academyNotesOf(st.userId).length}개</AppText>
                      </View>
                      <AppText variant="caption" tone="tertiary">
                        개인 학습 기록은 학원에 공개되지 않아요.
                      </AppText>
                      {/* 이 반 안에서만 보이는 요약이다. 학생이 두 반에 속하면 반쪽이라 상세로 잇는다.
                          글자가 함께 든 패널이라 버튼만 오른쪽 끝으로 뺀다(§8 규칙 ③ · D-146). */}
                      <View style={endRow.action}>
                        <Button
                          testID={`class-student-detail-${st.userId}`}
                          variant="ghost"
                          tone="accent"
                          hug
                          leading={<Icon name="user" size={16} color={colors.accent} />}
                          label="이 학생 기록 전체 보기"
                          accessibilityLabel={`${st.name} 학생 기록 전체 보기`}
                          onPress={() =>
                            router.push(`/academy/classes/student/${st.userId}` as never)
                          }
                        />
                      </View>
                      {/*
                        빼기는 값 옆이 아니라 펼친 자리에 둔다. `안 낸 과제 없음`(약 95px)과
                        버튼(약 76px)을 `trailing`에 함께 두면 1280에서도 두 줄로 갈리고
                        390에서는 이름 칸이 100px로 눌렸다(실측).
                      */}
                      {isDirector ? (
                        /* 한 줄에 버튼 하나(D-122). 위 버튼과 나란히 두지 않고 각각 오른쪽 끝이다. */
                        <View style={endRow.action}>
                          <Button
                            testID={`class-student-out-${st.userId}`}
                            variant="secondary"
                            hug
                            leading={
                              <Icon name="minus-circle" size={16} color={colors.inkSecondary} />
                            }
                            label="이 반에서 빼기"
                            accessibilityLabel={`${st.name} 학생 반에서 빼기`}
                            onPress={() => takeOut(st.userId, st.name)}
                          />
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </Group>
        {sortedStudents.length > STUDENT_PAGE ? (
          <Pager
            testID="class-student-pager"
            total={sortedStudents.length}
            page={studentPage}
            pageSize={STUDENT_PAGE}
            unit="명"
            onChange={setStudentPage}
          />
        ) : null}
      </Section>

      {isDirector ? (
        <Section title="학생 추가">
          <AppText variant="caption" tone="secondary">
            우리 학원 학생 중 이 반에 없는 학생을 찾아요.
          </AppText>
          <Field
            label="이름·아이디로 찾기"
            testID="class-add-search"
            value={candidateQuery}
            onChangeText={setCandidateQuery}
            placeholder="예: 박도윤 또는 hanbit.s0001"
          />
          {candidateQuery.trim() ? (
            <>
              <Group>
                {candidateShown.length ? (
                  candidateShown.map((s) => {
                    const on = picked.includes(s.userId);
                    return (
                      <Row
                        key={s.userId}
                        testID={`class-add-${s.userId}`}
                        title={s.name}
                        subtitle={s.scodyId}
                        accessibilityLabel={on ? `${s.name} 고르기 취소` : `${s.name} 고르기`}
                        onPress={() =>
                          setPicked((prev) =>
                            prev.includes(s.userId)
                              ? prev.filter((x) => x !== s.userId)
                              : [...prev, s.userId],
                          )
                        }
                        trailing={
                          on ? (
                            <AppText variant="label" tone="accent">
                              고름
                            </AppText>
                          ) : undefined
                        }
                      />
                    );
                  })
                ) : (
                  <Row title="찾는 학생이 없어요" subtitle="이름이나 아이디를 다시 확인해 주세요" />
                )}
              </Group>
              {candidates.length > CANDIDATE_PICK ? (
                <AppText variant="caption" tone="tertiary">
                  {candidates.length}명 중 {CANDIDATE_PICK}명만 보여요. 이름으로 좁혀 보세요.
                </AppText>
              ) : null}
            </>
          ) : null}
          <AppText variant="caption" tone="tertiary">
            우리 학원 학생 전체에서 찾아요. 다른 학원 학생은 나오지 않아요.
          </AppText>
          {picked.length > 0 ? (
            <ActionBar>
              <Button
                testID="class-add-submit"
                label={`${picked.length}명 반에 넣기`}
                onPress={addPicked}
              />
            </ActionBar>
          ) : null}
        </Section>
      ) : null}

      {isDirector ? (
        <Section title="반 관리">
          {/*
            **여는 버튼이 그대로 닫는 버튼이다.** 예전에는 폼 아래 행동줄에 `이름 바꾸기`와
            `취소`가 나란히 있어, 어느 것이 이름을 바꾸는 것인지 모양으로 구분되지 않았다.
            접기는 폼을 여는 자리로 되돌아가는 일이라 그 자리에 두는 것이 맞다 —
            성과 분석의 마감일 패널이 이미 같은 형태다(`app/academy/analytics.tsx`).
          */}
          <Button
            testID="class-rename-open"
            variant="ghost"
            hug
            aria-expanded={renaming}
            leading={<Icon name={renaming ? 'arrow-up' : 'edit-3'} size={16} color={colors.ink} />}
            label={renaming ? '접기' : '반 이름 바꾸기'}
            accessibilityLabel={renaming ? '반 이름 바꾸기 접기' : '반 이름 바꾸기'}
            onPress={() => {
              if (renaming) {
                setRenaming(false);
                return;
              }
              setRenameValue(cls.name);
              setRenaming(true);
            }}
          />
          {renaming ? (
            <>
              <Field
                label="반 이름"
                testID="class-rename-input"
                value={renameValue}
                onChangeText={setRenameValue}
                placeholder="예: 고1 국어 A"
              />
              <ActionBar>
                {/* 접힌 폼의 제출은 화면 primary가 아니다 — 이 화면의 primary는 `학생 추가`다(R4). */}
                <Button
                  testID="class-rename-submit"
                  variant="secondary"
                  tone="accent"
                  size="sm"
                  label="이름 바꾸기"
                  onPress={submitRename}
                />
              </ActionBar>
            </>
          ) : null}

          <AppText variant="caption" tone="tertiary">
            폐강하면 목록에서 내려가요. 지난 배정과 제출 기록은 그대로 남아요.
          </AppText>
          {confirmArchive ? (
            <ConfirmStep
              message="정말 폐강할까요? 폐강은 되돌릴 수 없어요."
              confirmLabel="폐강하기"
              confirmTestID="class-archive-confirm"
              confirmAccessibilityLabel={`${cls.name} 반 폐강하기`}
              confirmIcon="minus-circle"
              destructive
              onCancel={() => setConfirmArchive(false)}
              onConfirm={submitArchive}
            />
          ) : (
            <ActionBar>
              <Button
                testID="class-archive-open"
                variant="secondary"
                tone="danger"
                leading={<Icon name="minus-circle" size={16} color={colors.danger} />}
                label="폐강하기"
                accessibilityLabel={`${cls.name} 반 폐강하기`}
                onPress={() => setConfirmArchive(true)}
              />
            </ActionBar>
          )}
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  trailPair: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  // 뺀 직후 안내. `app/student/queue.tsx`의 되돌리기와 같은 모양으로 둔다.
  undo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.offset,
  },
  // 목록 안에서 놓치기 쉬운 행동이라 누름 영역을 44px로 잡는다(DESIGN.md §10).
});
