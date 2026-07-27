import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { Section } from './Section';
import { Group } from './Group';
import { Row } from './Row';
import { Button } from './Button';
import { ProgressBar } from './ProgressBar';
import { findContent, getStudentClasses, type Account } from '@/data';
import { useProgress } from '@/features/progress';
import { useContent } from '@/features/content';
import { colors, spacing, radius, typeface } from '@/theme/tokens';

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

const RECENT = 6;
const WEAK_THRESHOLD = 80;

/**
 * 자녀 종합 리포트.
 * 학부모가 "얼마나 했고, 어디가 약하고, 다음에 무엇을 시킬지"를 이 화면에서 판단할 수 있어야 한다.
 * 학습 하나를 누르면 상세 리포트(문항별 내역)로 넘어간다.
 */
export function ChildReport({ child, allowRetry }: { child: Account; allowRetry?: boolean }) {
  const router = useRouter();
  const { assignments, attemptsOf, wrongNotesOf, requestRetryFor, retryOf } = useProgress();
  const { sets } = useContent();
  const [showAll, setShowAll] = useState(false);

  const attempts = attemptsOf(child.userId);
  const wrongNotes = wrongNotesOf(child.userId);
  const requested = retryOf(child.userId);

  /**
   * 리포트 한 줄. 두 출처를 합친다.
   * - attempt: 이 세션에서 자녀가 푼 기록(문항별 내역까지 있음)
   * - 학원 제출 기록: 문항 내역 없이 정답률·시간만 있는 제출 결과
   */
  const done = useMemo(() => {
    const rows = Object.values(attempts).map((a) => ({
      itemId: a.itemId,
      title: a.title,
      area: a.area,
      source: a.source,
      accuracy: a.accuracy,
      questions: a.total,
      timeSec: a.timeSec,
      dateISO: a.dateISO,
      hasDetail: true,
    }));
    const seen = new Set(rows.map((r) => r.itemId));
    for (const assignment of assignments) {
      const sub = assignment.submissions.find((s) => s.studentId === child.userId);
      if (!sub?.submitted || seen.has(assignment.id) || sub.accuracy == null) continue;
      const content = assignment.contentId ? findContent(sets, assignment.contentId) : undefined;
      rows.push({
        itemId: assignment.id,
        title: assignment.title,
        area: content?.area ?? '문학',
        source: 'academy',
        accuracy: sub.accuracy,
        questions: content?.questions.length ?? assignment.questionCount,
        timeSec: sub.timeSec ?? 0,
        dateISO: assignment.dueDate ?? '',
        // 시드 제출도 틀린 문항 정보가 있으면 상세 리포트를 열 수 있다.
        hasDetail: !!content && !!sub.wrongQIds,
      });
    }
    return rows.sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
  }, [attempts, assignments, child.userId, sets]);

  // 학원이 배정했는데 아직 안 낸 과제
  const classIds = useMemo(
    () => new Set(getStudentClasses(child.userId).map((c) => c.id)),
    [child.userId],
  );
  const pending = useMemo(
    () =>
      assignments
        .filter((a) => classIds.has(a.classId))
        .filter((a) => !a.submissions.some((s) => s.studentId === child.userId && s.submitted))
        .map((a) => ({ id: a.id, title: a.title, dueDate: a.dueDate })),
    [assignments, classIds, child.userId],
  );

  const totals = useMemo(() => {
    const count = done.length;
    const questions = done.reduce((n, a) => n + a.questions, 0);
    // 문항 수로 가중한 정답률. 문항이 많은 학습이 평균을 더 많이 움직인다.
    const correct = done.reduce((n, a) => n + Math.round((a.accuracy * a.questions) / 100), 0);
    const timeSec = done.reduce((n, a) => n + a.timeSec, 0);
    const accuracy = questions ? Math.round((correct / questions) * 100) : null;
    const weakCount = done.filter((a) => a.accuracy < WEAK_THRESHOLD).length;
    return { count, questions, correct, timeSec, accuracy, weakCount };
  }, [done]);

  /** 영역별 정답률. 취약 영역 판단의 근거다. */
  const byArea = useMemo(() => {
    const acc: Record<string, { correct: number; total: number }> = {};
    for (const a of done) {
      acc[a.area] = acc[a.area] ?? { correct: 0, total: 0 };
      acc[a.area].correct += Math.round((a.accuracy * a.questions) / 100);
      acc[a.area].total += a.questions;
    }
    return Object.entries(acc)
      .filter(([, v]) => v.total > 0)
      .map(([area, v]) => ({ area, rate: Math.round((v.correct / v.total) * 100), total: v.total }))
      .sort((x, y) => x.rate - y.rate);
  }, [done]);

  const weakest = byArea[0];

  const trend = useMemo(
    () =>
      [...done]
        .reverse()
        .slice(-5)
        .map((a) => ({ date: a.dateISO.slice(5), rate: a.accuracy, title: a.title })),
    [done],
  );

  const visible = showAll ? done : done.slice(0, RECENT);

  const openDetail = (itemId: string) =>
    router.push(`/parent/attempt?child=${child.userId}&item=${itemId}` as never);

  if (done.length === 0 && pending.length === 0) {
    return (
      <Group>
        <View style={{ padding: spacing.lg, gap: spacing.xs }}>
          <AppText variant="label">아직 학습 기록이 없어요</AppText>
          <AppText variant="caption" tone="secondary">
            자녀가 학습을 제출하면 정답률·취약 영역·문항별 내역이 여기에 쌓여요.
          </AppText>
        </View>
      </Group>
    );
  }

  return (
    <View style={{ gap: spacing.xl }}>
      <Section title="종합 리포트">
        <View style={styles.metrics}>
          <View style={styles.metric}>
            <AppText variant="caption" tone="secondary">
              평균 정답률
            </AppText>
            <AppText style={styles.metricValue}>
              {totals.accuracy != null ? `${totals.accuracy}%` : '—'}
            </AppText>
            <AppText variant="caption" tone="tertiary">
              {totals.correct}/{totals.questions}문항
            </AppText>
          </View>
          <View style={styles.metric}>
            <AppText variant="caption" tone="secondary">
              완료한 학습
            </AppText>
            <AppText style={styles.metricValue}>{totals.count}개</AppText>
            <AppText variant="caption" tone="tertiary">
              미제출 {pending.length}개
            </AppText>
          </View>
          <View style={styles.metric}>
            <AppText variant="caption" tone="secondary">
              총 학습 시간
            </AppText>
            <AppText style={styles.metricValue}>
              {totals.timeSec > 0 ? fmtTime(totals.timeSec) : '—'}
            </AppText>
            <AppText variant="caption" tone="tertiary">
              다시 볼 학습 {totals.weakCount}개
            </AppText>
          </View>
        </View>
        {weakest ? (
          <AppText variant="caption" tone="secondary">
            {weakest.rate < WEAK_THRESHOLD
              ? `${weakest.area} 영역이 ${weakest.rate}%로 가장 약해요. 이 영역을 먼저 복습하면 좋아요.`
              : `가장 낮은 영역도 ${weakest.rate}%예요. 전체적으로 고르게 하고 있어요.`}
          </AppText>
        ) : null}
      </Section>

      {byArea.length > 0 ? (
        <Section title="영역별 정답률">
          <View style={{ gap: spacing.md }}>
            {byArea.map((a) => (
              <View key={a.area} style={{ gap: 6 }}>
                <View style={styles.areaHead}>
                  <AppText variant="label">
                    {a.area}
                    {a.rate < WEAK_THRESHOLD ? ' · 취약' : ''}
                  </AppText>
                  <AppText variant="caption" tone="secondary">
                    {a.rate}% · {a.total}문항
                  </AppText>
                </View>
                <ProgressBar value={a.rate} />
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {trend.length > 1 ? (
        <Section title="최근 정답률 변화">
          <Group>
            {trend.map((t, i) => (
              <Row key={`${t.title}-${i}`} title={t.title} subtitle={t.date} meta={`${t.rate}%`} />
            ))}
          </Group>
        </Section>
      ) : null}

      {pending.length > 0 ? (
        <Section title="아직 안 낸 학원 과제">
          <Group>
            {pending.map((p) => (
              <Row
                key={p.id}
                title={p.title}
                subtitle={p.dueDate ? `${p.dueDate} 마감` : '마감일 없음'}
                meta="미제출"
              />
            ))}
          </Group>
        </Section>
      ) : null}

      <Section title="학습별 상세 리포트">
        {done.length === 0 ? (
          <Group>
            <View style={{ padding: spacing.lg }}>
              <AppText tone="secondary">제출한 학습이 아직 없어요.</AppText>
            </View>
          </Group>
        ) : (
          <>
            <Group>
              {visible.map((a) => {
                const wrongCount = a.questions - Math.round((a.accuracy * a.questions) / 100);
                return (
                  <Row
                    key={a.itemId}
                    testID={`report-item-${a.itemId}`}
                    title={a.title}
                    subtitle={`${a.source === 'academy' ? '학원 학습' : '개인 학습'} · ${a.area}${a.dateISO ? ` · ${a.dateISO}` : ''}`}
                    meta={
                      a.hasDetail
                        ? `정답률 ${a.accuracy}% · 오답 ${wrongCount}개`
                        : `정답률 ${a.accuracy}% · 문항 내역 없음`
                    }
                    showChevron={a.hasDetail}
                    onPress={a.hasDetail ? () => openDetail(a.itemId) : undefined}
                  />
                );
              })}
            </Group>
            {done.length > RECENT ? (
              <Button
                variant="ghost"
                label={showAll ? '최근 기록만 보기' : `지난 기록 더보기 (${done.length - RECENT}개)`}
                onPress={() => setShowAll((v) => !v)}
              />
            ) : null}
          </>
        )}
      </Section>

      {wrongNotes.length > 0 ? (
        <Section title={`자녀의 오답노트 ${wrongNotes.length}개`}>
          <AppText variant="caption" tone="secondary">
            별표 {wrongNotes.filter((n) => n.starred).length}개 · 메모 정리{' '}
            {wrongNotes.filter((n) => n.dig).length}개
          </AppText>
          <View style={{ gap: spacing.md }}>
            {wrongNotes.slice(0, 6).map((n) => (
              <View key={n.id} style={styles.note}>
                <AppText variant="label">
                  {n.starred ? '★ ' : ''}
                  {n.prompt}
                </AppText>
                <AppText variant="caption" tone="tertiary">
                  {n.area} · {n.source === 'academy' ? '학원 학습' : '개인 학습'} · {n.title}
                </AppText>
                <AppText variant="caption" style={{ color: colors.success }}>
                  정답 · {n.choices[n.answerIndex]}
                </AppText>
                {n.dig ? (
                  <View style={{ gap: 2, marginTop: 2 }}>
                    <AppText
                      variant="caption"
                      tone="accent"
                      style={{ fontFamily: typeface.semibold }}
                    >
                      자녀가 정리한 메모
                    </AppText>
                    <AppText variant="caption" tone="secondary">
                      {n.dig}
                    </AppText>
                  </View>
                ) : (
                  <AppText variant="caption" tone="tertiary">
                    아직 메모를 정리하지 않았어요.
                  </AppText>
                )}
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {allowRetry && done.length > 0 ? (
        <Section title="다시 풀게 하기">
          <Group>
            {done.slice(0, RECENT).map((a) =>
              requested.includes(a.itemId) ? (
                <Row key={a.itemId} title={a.title} meta="요청했어요" />
              ) : (
                <Row
                  key={a.itemId}
                  title={a.title}
                  meta="요청"
                  testID={`retry-${a.itemId}`}
                  onPress={() => requestRetryFor(child.userId, a.itemId)}
                />
              ),
            )}
          </Group>
          <AppText variant="caption" tone="tertiary">
            요청해도 지금까지의 기록은 그대로 남아요.
          </AppText>
        </Section>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  metric: {
    flexGrow: 1,
    flexBasis: '30%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: 2,
  },
  metricValue: { fontFamily: typeface.bold, color: colors.ink, fontSize: 22, letterSpacing: -0.3 },
  areaHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  note: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: 3,
    backgroundColor: colors.surface,
  },
});
