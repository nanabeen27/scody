import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Screen, Section, Group, Row, Button, AppText, ScoreCard } from '@/components';
import { useCurrentAccount } from '@/session';
import { useProgress } from '@/features/progress';
import { useContent } from '@/features/content';
import { findContent, getAccount, getChildren } from '@/data';
import { colors, spacing, radius } from '@/theme/tokens';

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

/**
 * 자녀 학습 상세 리포트.
 * 문항별로 자녀가 고른 답과 정답을 보여 준다. 열람 권한은 provider가 검사한다(연결된 자녀만).
 */
export default function ParentAttemptDetail() {
  const router = useRouter();
  const { child: childId, item: itemId } = useLocalSearchParams<{ child: string; item: string }>();
  const account = useCurrentAccount();
  const { attemptsOf, assignments, requestRetryFor, retryOf } = useProgress();
  const { sets } = useContent();

  const linked = getChildren(account.userId).some((c) => c.userId === childId);
  const child = childId ? getAccount(childId) : undefined;
  const own = childId && itemId ? attemptsOf(childId)[itemId] : undefined;
  // 이 세션에서 푼 기록이 없으면 학원 제출 기록으로 문항별 내역을 구성한다.
  const attempt = own ?? (childId && itemId ? fromSubmission(childId, itemId) : undefined);

  function fromSubmission(studentId: string, assignmentId: string) {
    const assignment = assignments.find((a) => a.id === assignmentId);
    const sub = assignment?.submissions.find((s) => s.studentId === studentId);
    const content = assignment?.contentId ? findContent(sets, assignment.contentId) : undefined;
    if (!assignment || !sub?.submitted || !content || !sub.wrongQIds) return undefined;
    const wrongSet = new Set(sub.wrongQIds);
    return {
      itemId: assignment.id,
      title: assignment.title,
      area: content.area,
      source: 'academy' as const,
      timeSec: sub.timeSec ?? 0,
      total: content.questions.length,
      correct: content.questions.length - wrongSet.size,
      accuracy: sub.accuracy ?? 0,
      dateISO: assignment.dueDate ?? '',
      perQuestion: content.questions.map((q) => ({
        qId: q.id,
        prompt: q.prompt,
        choices: q.choices,
        answerIndex: q.answerIndex,
        pickedIndex: undefined,
        correct: !wrongSet.has(q.id),
      })),
    };
  }

  if (!linked || !child || !attempt) {
    return (
      <Screen testID="parent-attempt" backFallback="/parent" title="기록을 찾을 수 없어요">
        <AppText tone="secondary">연결된 자녀의 학습만 볼 수 있어요.</AppText>
        <Button label="자녀 목록으로" onPress={() => router.replace('/parent/children' as never)} />
      </Screen>
    );
  }

  const wrong = attempt.perQuestion.filter((q) => !q.correct);
  const requested = retryOf(child.userId).includes(attempt.itemId);

  return (
    <Screen
      testID="parent-attempt"
      backFallback={`/parent/child/${child.userId}`}
      eyebrow={`${child.name} 님 · ${attempt.source === 'academy' ? '학원 학습' : '개인 학습'}`}
      title={attempt.title}
    >
      <ScoreCard
        rate={attempt.accuracy}
        detail={`${attempt.total}문항 중 ${attempt.correct}문항 정답 · 오답 ${wrong.length}개`}
      />

      <Group>
        <Row title="제출한 날" meta={attempt.dateISO} />
        <Row title="걸린 시간" meta={fmtTime(attempt.timeSec)} />
        <Row title="영역" meta={`국어 · ${attempt.area}`} />
        <Row
          title="문항당 평균"
          meta={attempt.total ? fmtTime(Math.round(attempt.timeSec / attempt.total)) : '—'}
        />
      </Group>

      {wrong.length > 0 ? (
        <Section title={`틀린 문항 ${wrong.length}개`}>
          <View style={{ gap: spacing.md }}>
            {wrong.map((q, i) => (
              <View key={q.qId} style={styles.card}>
                <AppText variant="label">
                  {i + 1}. {q.prompt}
                </AppText>
                <AppText variant="caption" style={{ color: colors.danger }}>
                  자녀가 고른 답 · {q.pickedIndex != null ? q.choices[q.pickedIndex] : '기록 없음'}
                </AppText>
                <AppText variant="caption" style={{ color: colors.success }}>
                  정답 · {q.choices[q.answerIndex]}
                </AppText>
              </View>
            ))}
          </View>
        </Section>
      ) : (
        <AppText variant="caption" tone="secondary">
          이 학습에서는 틀린 문항이 없어요.
        </AppText>
      )}

      <Section title="문항별 전체 내역">
        <Group>
          {attempt.perQuestion.map((q, i) => (
            <Row
              key={q.qId}
              title={`${i + 1}. ${q.prompt}`}
              subtitle={`자녀 답: ${q.pickedIndex != null ? q.choices[q.pickedIndex] : '기록 없음'} · 정답: ${q.choices[q.answerIndex]}`}
              meta={q.correct ? '정답' : '오답'}
            />
          ))}
        </Group>
      </Section>

      {requested ? (
        <AppText variant="caption" tone="accent">
          다시 풀기를 요청했어요. 기존 기록은 그대로 남아요.
        </AppText>
      ) : (
        <Button
          testID="attempt-retry"
          variant="secondary"
          label="이 학습을 다시 풀게 하기"
          onPress={() => requestRetryFor(child.userId, attempt.itemId)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: 4,
    backgroundColor: colors.surface,
  },
});
