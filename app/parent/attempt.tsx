import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Screen,
  Section,
  Group,
  Row,
  Button,
  Icon,
  SegmentedControl,
  AppText,
  ScoreCard,
  SourceTag,
  QuestionReview,
  ActionBar,
} from '@/components';
import { useCurrentAccount, useSession } from '@/session';
import { useProgress } from '@/features/progress';
import { useContent } from '@/features/content';
import { useToast } from '@/features/toast';
import { formatDate } from '@/features/learning';
import { classStat } from '@/features/report';
import { findContent } from '@/data';
import { colors } from '@/theme/tokens';

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

/**
 * 자녀 학습 상세 리포트.
 *
 * 문항 리뷰는 기본이 '틀린 문항'이다(D-030 — 학생 결과 화면과 같은 규칙).
 * 예전에는 틀린 문항 카드와 전체 내역을 한 화면에 다 쏟아 25문항 세트면 32덩어리가 됐고,
 * `QuestionReview`를 쓰지 않아 학부모 홈이 약속한 해설이 없었다.
 *
 * 열람 권한은 provider가 검사한다(연결된 자녀만).
 */
export default function ParentAttemptDetail() {
  const router = useRouter();
  const { child: childId, item: itemId } = useLocalSearchParams<{ child: string; item: string }>();
  const account = useCurrentAccount();
  const { attemptsOf, assignments, requestRetryFor, retryOf, comparisonsOf } = useProgress();
  const { sets } = useContent();
  const { show } = useToast();
  const { readOnly, childrenOf, accountOf } = useSession();
  const [scope, setScope] = useState<'wrong' | 'all'>('wrong');

  const linked = childrenOf(account.userId).some((c) => c.userId === childId);
  const child = childId ? accountOf(childId) : undefined;
  const own = childId && itemId ? attemptsOf(childId)[itemId] : undefined;
  // 이 계정이 직접 푼 기록이 없으면 학원 제출 기록으로 문항별 내역을 구성한다.
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
      // 제출일이 없으면 비워 둔다. 마감일을 제출일이라고 말하지 않는다.
      dateISO: sub.submittedAt ?? '',
      dueDate: assignment.dueDate,
      perQuestion: content.questions.map((q) => ({
        qId: q.id,
        prompt: q.prompt,
        choices: q.choices,
        answerIndex: q.answerIndex,
        pickedIndex: undefined as number | undefined,
        correct: !wrongSet.has(q.id),
      })),
    };
  }

  if (!linked || !child || !attempt) {
    return (
      <Screen testID="parent-attempt" backFallback="/parent/report" title="기록을 찾을 수 없어요">
        <AppText tone="secondary">연결된 자녀의 학습만 볼 수 있어요.</AppText>
        <ActionBar>
          <Button
            variant="secondary"
            label="리포트로 갈게요"
            onPress={() => router.replace('/parent/report' as never)}
          />
        </ActionBar>
      </Screen>
    );
  }

  /*
    마감일은 **배정에만** 있다. 자녀가 앱에서 직접 낸 기록(`own`)은 `Attempt`라 마감을 들고
    있지 않아서, 그 경우 배정에서 찾아 온다 — 안 그러면 같은 과제인데 제출 경로에 따라 마감이
    보이거나 안 보인다(실측: seed에 실제 풀이가 생기면서 `마감` 줄이 사라졌다).
  */
  const dueDate =
    'dueDate' in attempt
      ? (attempt.dueDate as string | undefined)
      : attempt.source === 'academy'
        ? assignments.find((a) => a.id === itemId)?.dueDate
        : undefined;
  /*
    반 비교는 **학원 과제에만** 둔다 — 또래 집단이 실제로 있는 곳이다.
    개인 학습에는 함께 비교할 반 친구가 없어 만들지 않는다.
    제출자가 적으면 `classStat`이 null을 주고, 그러면 그리지 않는다.
  */
  const assignment = assignments.find((a) => a.id === attempt.itemId);
  const cls =
    attempt.source === 'academy' && assignment && childId
      ? classStat(comparisonsOf(childId)[assignment.id])
      : null;
  const wrong = attempt.perQuestion.filter((q) => !q.correct);
  const requested = retryOf(child.userId).includes(attempt.itemId);
  // 고른 답이 하나도 안 남은 기록(학원 제출)은 문항마다 반복하지 않고 위에서 한 번 밝힌다.
  const noPicks = attempt.perQuestion.every((q) => q.pickedIndex == null);
  // 다 맞았으면 고를 것이 없으니 전체를 보여준다.
  const effectiveScope = wrong.length === 0 ? 'all' : scope;
  const listed = effectiveScope === 'wrong' ? wrong : attempt.perQuestion;

  return (
    <Screen
      testID="parent-attempt"
      backFallback={`/parent/report?child=${child.userId}`}
      title={attempt.title}
    >
      <SourceTag source={attempt.source} />

      <ScoreCard
        rate={attempt.accuracy}
        detail={`${attempt.total}문항 중 ${attempt.correct}문항 정답 · 오답 ${wrong.length}개`}
      />

      <Group>
        {attempt.dateISO ? (
          <Row title="제출한 날" meta={formatDate(attempt.dateISO)} />
        ) : (
          <Row title="제출한 날" meta="기록 없음" />
        )}
        {dueDate ? <Row title="마감" meta={formatDate(dueDate)} /> : null}
        <Row title="걸린 시간" meta={fmtTime(attempt.timeSec)} />
        <Row title="영역" meta={`국어 · ${attempt.area}`} />
        {cls ? (
          <Row
            testID="attempt-class"
            title="반에서"
            subtitle={`제출한 ${cls.submitters}명 기준 · 반 평균 ${cls.avg}%`}
            meta={`${cls.rank}번째`}
          />
        ) : null}
        <Row
          title="문항당 평균"
          meta={attempt.total ? fmtTime(Math.round(attempt.timeSec / attempt.total)) : '—'}
        />
      </Group>

      <Section title="문항별로 확인해요">
        {noPicks ? (
          <AppText variant="caption" tone="secondary">
            학원에서 받은 제출 결과예요. 어떤 선지를 골랐는지는 남아 있지 않아요.
          </AppText>
        ) : null}
        {wrong.length > 0 ? (
          <SegmentedControl
            testID="attempt-scope"
            options={[
              { value: 'wrong', label: `틀린 문항 ${wrong.length}` },
              { value: 'all', label: `전체 ${attempt.total}` },
            ]}
            value={effectiveScope}
            onChange={setScope}
          />
        ) : (
          <AppText variant="caption" tone="secondary">
            이 학습에서는 틀린 문항이 없어요.
          </AppText>
        )}
        <Group>
          {listed.map((q) => {
            const index = attempt.perQuestion.findIndex((x) => x.qId === q.qId);
            return (
              <QuestionReview
                key={q.qId}
                index={index}
                question={{
                  id: q.qId,
                  prompt: q.prompt,
                  choices: q.choices,
                  answerIndex: q.answerIndex,
                  explanation: findQuestion(q.qId)?.explanation,
                }}
                pickedIndex={q.pickedIndex}
                correct={q.correct}
                pickedLabel="자녀가 고른 답"
              />
            );
          })}
        </Group>
      </Section>

      {requested ? (
        <AppText variant="caption" tone="accent">
          다시 풀기를 요청했어요. 자녀가 다시 풀면 새 결과로 바뀌어요.
        </AppText>
      ) : (
        <Button
          testID="attempt-retry"
          variant="secondary"
          tone="accent"
          hug
          label="다시 풀게 하기"
          leading={<Icon name="refresh-cw" size={16} color={colors.accent} />}
          onPress={() => void askRetry(child.userId, attempt.itemId)}
        />
      )}
    </Screen>
  );

  /**
   * 다시 풀게 하기.
   *
   * **서버가 요청을 받아 준 다음에 알린다** — 먼저 알리면 요청이 저장되지 않아도 화면은
   * `요청했어요`라고 말하고 그 표시가 다음 조회에서 조용히 사라진다.
   * 대리 보기에서는 쓰기가 거부된다(D-071). 일어나지 않은 일을 알리지 않는다.
   * 같은 행동을 하는 `ChildReport`의 `askRetry`와 규칙과 문구를 맞춘다.
   */
  async function askRetry(studentId: string, target: string) {
    const res = await requestRetryFor(studentId, target);
    if (readOnly) return;
    if (!res.ok) {
      show(res.error ?? '요청하지 못했어요', 'removed');
      return;
    }
    show('다시 풀기를 요청했어요');
  }

  /** 해설은 콘텐츠에만 있다. 저장된 풀이 기록에는 담기지 않는다. */
  function findQuestion(qId: string) {
    for (const set of sets) {
      const q = set.questions.find((x) => x.id === qId);
      if (q) return q;
    }
    return undefined;
  }
}
