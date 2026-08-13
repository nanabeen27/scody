import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Screen,
  Section,
  Group,
  Row,
  AppText,
  BarRow,
  Button,
  Field,
  Icon,
  Sparkline,
  sparkLabel,
  Table,
  RichText,
  type Column,
  ActionBar,
} from '@/components';
import { useCurrentAccount } from '@/session';
import { useAcademyStaff } from '@/features/academy';
import { useProgress } from '@/features/progress';
import { useContent } from '@/features/content';
import { useToast } from '@/features/toast';
import {
  areaBreakdown,
  classNameOf,
  scopedAssignments,
  studentPerformance,
  submitStat,
  type StudentPerf,
} from '@/features/academyStats';
import { dueLabel, formatDate, parseDueDate } from '@/features/learning';
import { findContent } from '@/data';
import { todayISO } from '@/features/clock';
import { inset } from '@/theme/styles';
import { colors, spacing } from '@/theme/tokens';

/**
 * 학생 한 명의 학원 학습 기록.
 *
 * **왜 필요한가**: 학생 목록에서 이름을 찾아 눌러도 그 학생의 첫 번째 반으로 갈 뿐이었다.
 * 두 반에 속한 학생은 반쪽만 보였고, 학부모 상담을 준비하려면 반 상세 여러 개를 오가야 했다.
 *
 * **여기서 열지 않는 것**(확정 정책 2절 · D-014 · D-054):
 * 개인 학습 목록·정답률·학습 시간, 개인 오답노트와 그 메모, 별표·이해 완료 표시,
 * 다른 학원이 배정한 학습, 전화번호. 오답 메모는 **우리 학원이 배정한 학습**에서 나온 것만이다.
 *
 * 권한은 `studentInScope`가 판단한다 — 화면 숨김이 아니라 함수 안에서 막으므로 URL을 직접 쳐도
 * 담당 밖 학생은 열리지 않는다.
 */
export default function AcademyStudentDetail() {
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const account = useCurrentAccount();
  const studentId = typeof params.id === 'string' ? params.id : '';
  const { classesFor, studentInScope } = useAcademyStaff();
  const { assignments, academyNotesOf, reassign } = useProgress();
  const { sets } = useContent();
  const { show } = useToast();
  const today = todayISO();

  const student = studentInScope(studentId);
  const classes = useMemo(() => classesFor(account), [classesFor, account]);
  const scoped = useMemo(() => scopedAssignments(classes, assignments), [classes, assignments]);
  /** 이 학생이 실제로 배정받은 것만. 반이 여럿이면 모두 모인다. */
  const perf = useMemo<StudentPerf>(
    () => studentPerformance(studentId, scoped),
    [studentId, scoped],
  );
  const mine = useMemo(
    () => scoped.filter((a) => a.submissions.some((s) => s.studentId === studentId)),
    [scoped, studentId],
  );
  /**
   * 영역별 정답률은 **이 학생의 제출만** 센다. 배정을 `mine`으로 좁혀도 배정은 반 단위라
   * 그 안에 같은 반 다른 학생의 제출 행이 함께 들어 있다 — 학생을 지정하지 않으면 반 평균을
   * 이 학생의 값으로 말하게 된다(Q-037).
   */
  const areas = useMemo(() => areaBreakdown(mine, sets, studentId), [mine, sets, studentId]);
  const notes = academyNotesOf(studentId);
  const myClasses = useMemo(
    () => classes.filter((c) => c.studentIds.includes(studentId)),
    [classes, studentId],
  );
  /**
   * 안 낸 과제 중 마감일이 없는 건. `pending`은 마감일 유무와 상관없이 **안 낸 것 전부**라,
   * 부제가 무엇을 셌는지 사실대로 말하려면 이 수가 필요하다.
   */
  const pendingNoDue = useMemo(
    () => perf.pending.filter((a) => !a.dueDate).length,
    [perf.pending],
  );
  /**
   * 추이의 첫·마지막 점을 **언제 낸 것인지**. 값은 `perf.trend`가 주고, 날짜는 같은 순서
   * (제출일 오래된 것부터, 채점된 제출만)의 행에서 읽는다 — 여기서 추이를 다시 만들지 않는다.
   */
  const trendDates = useMemo(() => {
    const dates = [...perf.rows]
      .reverse()
      .filter((r) => r.submission.accuracy != null)
      .map((r) => r.submission.submittedAt);
    return { first: dates[0], last: dates[dates.length - 1] };
  }, [perf.rows]);

  const [reassignAt, setReassignAt] = useState<string | null>(null);
  const [due, setDue] = useState('');
  const [dueError, setDueError] = useState<string | null>(null);

  if (!student) {
    return (
      <Screen testID="academy-student" backFallback="/academy/classes/students" title="학생">
        <Group>
          <Row
            title="학생을 찾을 수 없어요"
            subtitle="담당하는 반의 학생만 볼 수 있어요"
          />
        </Group>
        <ActionBar>
          <Button
            label="학생 목록으로"
            onPress={() => router.replace('/academy/classes/students' as never)}
          />
        </ActionBar>
      </Screen>
    );
  }

  /**
   * 마감일만 새로 정한다. 성과 분석(`app/academy/analytics.tsx`)과 **같은 검사**를 쓴다 —
   * 같은 쓰기에 두 규칙이 있으면 한쪽에서 막은 값이 다른 쪽으로 들어온다.
   * 특히 빈 입력은 `parseDueDate`에서 `{ok:true, value:undefined}`라, 여기서 막지 않으면
   * 마감일이 지워진 채 `다시 정했어요`라고 말하게 된다(마감이 비면 그 배정은
   * `overdueAssignments`에서 빠져 되돌릴 자리도 사라진다).
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

  /**
   * 마감일 입력 한 벌. 성과 분석의 `reassignPanel`과 **같은 자리(눌린 행 바로 아래)·같은 문장**을
   * 쓴다 — 같은 쓰기를 두 화면이 다르게 설명하지 않게.
   * 첫 줄만 이 화면의 사실을 더한다: 여기는 학생 한 명으로 좁혀 보고 있지만 마감일은 과제마다
   * 하나뿐이라 **그 반 전체**가 함께 바뀐다.
   */
  function reassignPanel(assignmentId: string, className: string, missing: number) {
    return (
      <View style={inset.panel}>
        <AppText variant="caption" tone="secondary">
          {className || '이 반'} 전체가 받은 과제예요.
        </AppText>
        <AppText variant="caption" tone="secondary">
          마감일을 바꾸면 안 낸 학생 {missing}명에게만 다시 열려요.
        </AppText>
        <AppText variant="caption" tone="tertiary">
          이미 낸 학생의 제출 기록과 학부모 리포트의 달은 그대로예요.
        </AppText>
        <Field
          label="새 마감일"
          testID={`student-due-${assignmentId}`}
          accessibilityLabel="새 마감일"
          value={due}
          onChangeText={setDue}
          placeholder="예: 2026-08-11"
          style={styles.dueInput}
        />
        {dueError ? (
          <AppText variant="caption" style={{ color: colors.danger }}>
            {dueError}
          </AppText>
        ) : null}
        <Button
          testID={`student-reassign-submit-${assignmentId}`}
          hug
          label="다시 배정하기"
          onPress={() => submitReassign(assignmentId)}
        />
      </View>
    );
  }

  /**
   * `안 낸 과제`의 부제. `pending`은 **마감일과 무관하게 안 낸 것 전부**라
   * `마감일이 있는 과제만 세요`는 사실이 아니었다. 세는 대상을 그대로 말한다.
   */
  const pendingSubtitle = (() => {
    if (perf.assigned === 0) return '아직 배정받은 학습이 없어요';
    if (perf.pending.length === 0) return '배정받은 것을 모두 냈어요';
    const nearest = perf.pending[0]?.dueDate;
    if (!nearest) return '아직 마감일이 정해지지 않았어요';
    const withoutDue = pendingNoDue ? ` · 마감일 없는 과제 ${pendingNoDue}건 포함` : '';
    return `가장 이른 마감 ${formatDate(nearest)}${withoutDue}`;
  })();

  /**
   * 그 과제에서 **틀린 문항**. 정답률만으로는 무엇을 다시 가르쳐야 할지 알 수 없다 —
   * 학부모는 앱에서 문항별 정오를 이미 보는데(4절) 학원만 못 봤다.
   *
   * **배정 학습 안의 값이다.** 개인 학습은 여기 들어오지 않는다(D-014·D-080).
   * 학생이 어느 오답지를 골랐는지는 제출 기록에 없어(`Submission`에 `wrongQIds`만 있다)
   * **정답만 적는다** — 없는 값을 지어내지 않는다.
   */
  function wrongPanel(row: StudentPerf['rows'][number]) {
    const set = row.assignment.contentId ? findContent(sets, row.assignment.contentId) : undefined;
    const wrongIds = row.submission.wrongQIds;
    if (!wrongIds || !set) {
      return (
        <AppText variant="caption" tone="tertiary">
          이 과제에는 문항별 기록이 없어요. 정답률만 남아 있어요.
        </AppText>
      );
    }
    const wrongSet = new Set(wrongIds);
    const wrong = set.questions
      .map((q, i) => ({ q, no: i + 1 }))
      .filter(({ q }) => wrongSet.has(q.id));
    if (wrong.length === 0) {
      return (
        <AppText variant="caption" tone="secondary">
          {set.questions.length}문항을 모두 맞혔어요.
        </AppText>
      );
    }
    return (
      <View style={styles.wrong}>
        <AppText variant="caption" tone="secondary">
          {set.questions.length}문항 중 {wrong.length}문항을 틀렸어요.
        </AppText>
        {wrong.map(({ q, no }) => (
          <View key={q.id} style={styles.wrongItem}>
            <AppText variant="caption">
              {no}번 · {q.prompt}
            </AppText>
            <AppText variant="caption" tone="tertiary">
              정답 {q.choices[q.answerIndex]}
            </AppText>
          </View>
        ))}
      </View>
    );
  }

  const columns: Column<StudentPerf['rows'][number]>[] = [
    { key: 'title', header: '과제', cell: (r) => r.assignment.title },
    { key: 'class', header: '반', width: 104, priority: 3, cell: (r) => classNameOf(r.assignment, classes) },
    {
      key: 'due',
      header: '마감',
      width: 84,
      align: 'right',
      priority: 2,
      cell: (r) => (r.assignment.dueDate ? formatDate(r.assignment.dueDate) : '마감 없음'),
    },
    {
      key: 'submitted',
      header: '제출일',
      width: 84,
      align: 'right',
      // 상담에서 마지막으로 필요한 열이라 좁은 화면에서 먼저 접는다.
      priority: 3,
      // 마감일을 제출일 자리에 넣지 않는다(D-048).
      cell: (r) =>
        r.submission.submittedAt ? formatDate(r.submission.submittedAt) : '기록 없음',
    },
    {
      key: 'accuracy',
      header: '정답률',
      width: 76,
      align: 'right',
      cell: (r) => (r.submission.accuracy != null ? `${r.submission.accuracy}%` : '—'),
    },
    {
      key: 'vs',
      header: '반 평균 대비',
      width: 96,
      align: 'right',
      // 상담에서 가장 많이 쓰는 값이라 모바일에서도 접지 않는다(priority 기본 1).
      cell: (r) => {
        if (r.submission.accuracy == null || r.classAvg == null) return '—';
        const gap = r.submission.accuracy - r.classAvg;
        return `${gap > 0 ? '+' : gap < 0 ? '−' : ''}${Math.abs(gap)}%p`;
      },
    },
  ];

  return (
    <Screen
      wide
      testID="academy-student"
      backFallback="/academy/classes/students"
      title={student.name}
      lead={`${myClasses.map((c) => c.name).join(' · ') || '아직 반이 없어요'} · ${student.scodyId}`}
    >
      <AppText variant="caption" tone="tertiary">
        우리 학원이 배정한 학습만 보여요. 개인 학습 기록은 학원에 공개되지 않아요.
      </AppText>

      <Section title="배정 학습 요약">
        <Group>
          <Row
            title="제출"
            subtitle="배정받은 건 중 낸 비율"
            trailing={
              <AppText variant="label" style={styles.num}>
                {perf.submitted}/{perf.assigned}건
                {perf.rate != null ? ` · ${perf.rate}%` : ''}
              </AppText>
            }
          />
          <Row
            title="평균 정답률"
            subtitle="문항 수로 가중한 평균"
            trailing={
              <AppText variant="label" style={styles.num}>
                {perf.accuracy != null ? `${perf.accuracy}%` : '—'}
              </AppText>
            }
          />
          <Row
            title="안 낸 과제"
            subtitle={pendingSubtitle}
            trailing={
              <AppText variant="label" style={styles.num}>
                {perf.pending.length}건
              </AppText>
            }
          />
          <Row
            title="최근 제출일"
            subtitle="마감일이 아니라 실제로 낸 날이에요"
            trailing={
              <AppText variant="label" style={styles.num}>
                {perf.lastSubmittedAt ? formatDate(perf.lastSubmittedAt) : '기록 없음'}
              </AppText>
            }
          />
        </Group>
      </Section>

      <Section title="정답률 추이">
        {perf.trend.length > 1 ? (
          <View style={styles.trend}>
            <AppText variant="caption" tone="secondary" style={styles.num}>
              낸 순서대로 {perf.trend.length}번 · {perf.trend[0]}% →{' '}
              {perf.trend[perf.trend.length - 1]}%
            </AppText>
            {/* 시간 축이 없으면 "언제부터 좋아졌나"를 말할 수 없다. 제출일로 양 끝을 밝힌다. */}
            {trendDates.first && trendDates.last ? (
              <AppText variant="caption" tone="tertiary" style={styles.num}>
                {formatDate(trendDates.first)}에 낸 것부터 {formatDate(trendDates.last)}에 낸
                것까지예요.
              </AppText>
            ) : null}
            <Sparkline
              testID="student-trend"
              values={perf.trend}
              width={320}
              height={44}
              // 점 하나가 한 주가 아니라 **낸 순서 한 번**이다.
              label={sparkLabel(`${student.name} 정답률`, perf.trend, '%', '번')}
            />
          </View>
        ) : (
          <AppText variant="caption" tone="tertiary">
            추이를 그리려면 채점된 제출이 두 번 이상 필요해요.
          </AppText>
        )}
      </Section>

      <Section title="영역별 정답률">
        <AppText variant="caption" tone="secondary">
          이 학생이 낸 배정 학습의 문항 수로 가중해 냈어요. 문항 20개 미만이면 아직 단정하지
          않아요.
        </AppText>
        <View style={styles.bars} testID="student-areas">
          {areas.map((a) => (
            /*
              값 글자가 대시보드보다 길어(`기록 없음`이 아니라 `72% · 1,204문항 · 표본 적음`)
              라벨을 84, 값을 168로 둔다 — `BarRow` 기본값(92/148)과 다른 이 화면의 값이다.
            */
            <BarRow
              key={a.area}
              label={a.area}
              value={a.accuracy ?? 0}
              note={
                a.questions === 0
                  ? '기록 없음'
                  : `${a.accuracy}% · ${a.questions.toLocaleString('en-US')}문항${
                      a.enough ? '' : ' · 표본 적음'
                    }`
              }
              muted={a.questions === 0}
              labelWidth={84}
              noteWidth={168}
            />
          ))}
        </View>
      </Section>

      {perf.pending.length ? (
        <Section title={`안 낸 과제 ${perf.pending.length}건`}>
          <AppText variant="caption" tone="secondary">
            이 학생이 아직 안 낸 과제예요.
          </AppText>
          <AppText variant="caption" tone="tertiary">
            마감일은 과제마다 하나라, 다시 정하면 그 반 전체에 적용돼요.
          </AppText>
          <Group>
            {perf.pending.map((a) => {
              const d = dueLabel(a.dueDate);
              const stat = submitStat(a);
              const missing = stat.total - stat.submitted;
              const className = classNameOf(a, classes);
              const open = reassignAt === a.id;
              return (
                /* 입력은 눌린 행 바로 아래에 둔다 — 안 낸 과제가 여러 건이면 목록 끝에 둔
                   입력창이 어느 과제의 것인지 화면에서 알 수 없다. */
                <View key={a.id}>
                  <Row
                    testID={`student-pending-${a.id}`}
                    title={a.title}
                    subtitle={`${className}${d ? ` · ${d.text}` : ''} · 반에서 안 낸 학생 ${missing}명`}
                  />
                  <View style={inset.action}>
                    <Button
                      testID={`student-reassign-open-${a.id}`}
                      size="sm"
                      variant="ghost"
                      tone="accent"
                      hug
                      label={open ? '접기' : '이 과제의 반 마감일 다시 정하기'}
                      accessibilityLabel={
                        open ? '접기' : `${a.title} 반 마감일 다시 정하기`
                      }
                      leading={
                        <Icon
                          name={open ? 'arrow-up' : 'refresh-cw'}
                          size={15}
                          color={colors.accent}
                        />
                      }
                      onPress={() => {
                        setReassignAt((cur) => (cur === a.id ? null : a.id));
                        setDue('');
                        setDueError(null);
                      }}
                    />
                  </View>
                  {open ? reassignPanel(a.id, className, missing) : null}
                </View>
              );
            })}
          </Group>
        </Section>
      ) : null}

      <Section title={`낸 과제 ${perf.rows.length}건`}>
        <AppText variant="caption" tone="secondary">
          행을 누르면 그 과제에서 틀린 문항을 볼 수 있어요.
        </AppText>
        <Table
          testID="student-history"
          columns={columns}
          rows={perf.rows}
          rowKey={(r) => r.assignment.id}
          expand={(r) => wrongPanel(r)}
          rowLabel={(r) =>
            [
              r.assignment.title,
              classNameOf(r.assignment, classes),
              r.submission.submittedAt ? `${formatDate(r.submission.submittedAt)} 제출` : '제출일 기록 없음',
              r.submission.accuracy != null ? `정답률 ${r.submission.accuracy}%` : null,
              r.classAvg != null ? `반 평균 ${r.classAvg}%` : null,
            ]
              .filter(Boolean)
              .join(', ')
          }
          footer={{
            title: '전체',
            accuracy: perf.accuracy != null ? `${perf.accuracy}%` : '—',
          }}
          empty={{ title: '아직 낸 과제가 없어요', subtitle: '제출하면 여기에 쌓여요' }}
        />
      </Section>

      <Section title={`배정 학습 오답노트 ${notes.length}개`}>
        <AppText variant="caption" tone="secondary">
          우리 학원이 배정한 학습에서 담은 오답만 보여요. 개인 학습에서 담은 오답과 그 메모는 열지
          않아요.
        </AppText>
        <Group>
          {notes.length ? (
            notes.map((n) => (
              /* 메모는 여러 줄 글이라 값 자리(`trailing`)가 아니라 본문 아래 블록에 둔다
                 (DESIGN.md §20 · D-070). 폭을 좁히면 상담에서 읽을 수 없다. */
              <View key={n.id}>
                <Row title={n.prompt} subtitle={n.dig ? undefined : '아직 정리한 메모가 없어요'} />
                {n.dig ? (
                  <View style={inset.panel}>
                    <AppText variant="caption" tone="accent">
                      학생이 AI와 정리한 메모
                    </AppText>
                    <RichText text={n.dig} />
                  </View>
                ) : null}
              </View>
            ))
          ) : (
            <Row
              title="담은 오답이 없어요"
              subtitle="배정 학습에서 담으면 여기에 보여요"
            />
          )}
        </Group>
      </Section>

      {/* 반 평균은 배정마다 다르다. 위 `낸 과제` 표의 `반 평균 대비` 열이 배정마다 정확히
          말하므로, 여기서 배정 하나를 골라 같은 값을 다시 말하지 않는다. */}
      <Section title="소속 반">
        <Group>
          {myClasses.map((c) => (
            <Row
              key={c.id}
              testID={`student-class-${c.id}`}
              title={c.name}
              subtitle={`학생 ${c.studentIds.length}명`}
              onPress={() => router.push(`/academy/classes/${c.id}` as never)}
              showChevron
            />
          ))}
          {myClasses.length === 0 ? (
            <Row title="아직 반이 없어요" subtitle="반 상세에서 넣을 수 있어요" />
          ) : null}
        </Group>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  num: { fontVariant: ['tabular-nums'] },
  trend: { gap: spacing.xs },
  /** 가로 막대 목록. 한 줄의 모양·쌓기는 `BarRow`가 쥔다. */
  bars: { gap: spacing.xs },
  wrong: { gap: spacing.sm, paddingBottom: spacing.sm },
  wrongItem: { gap: 1 },
  dueInput: { maxWidth: 280 },
});
