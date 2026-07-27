import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Pressable, StyleSheet } from 'react-native';
import {
  Screen,
  Section,
  Group,
  Button,
  AppText,
  Passage,
  RichText,
  AskField,
  ProgressBar,
} from '@/components';
import { useProgress, type WrongNote } from '@/features/progress';
import { useContent } from '@/features/content';
import { askScodyAIStream } from '@/features/openrouter';
import { SCODY_WRONG_SYSTEM } from '@/features/prompts';
import { findContent } from '@/data';
import { colors, spacing, radius, typeface } from '@/theme/tokens';

const MEMO_SYSTEM =
  '아래 오답 대화를 2~3문장으로 정리해. 학생이 다시 볼 오답노트 메모야. ' +
  '핵심 개념과 실수 포인트만 담고, 존댓말 -어요로 짧게 써. 마크다운 강조는 쓰지 마.';

function ctx(n: WrongNote): string {
  return `문제: ${n.prompt}\n보기: ${n.choices.join(' / ')}\n정답: ${n.choices[n.answerIndex]}\n지난번 내 답: ${n.pickedIndex != null ? n.choices[n.pickedIndex] : '없음'}`;
}

/**
 * 오답노트 카드 복습.
 * 카드 한 장에 문항 하나. 다시 풀어 보고 → 정답·해설·내 메모를 확인하고 → 필요하면 더 물어본다.
 * 별표한 문항만 모아 집중 복습할 수 있고, 이해가 끝난 문항은 완료로 표시한다.
 */
export default function Review() {
  const router = useRouter();
  const params = useLocalSearchParams<{ area?: string; starred?: string }>();
  const { wrongNotes, toggleStar, setMastered, setDig } = useProgress();
  const { sets } = useContent();

  const onlyStarred = params.starred === '1';
  const area = params.area;

  const cards = useMemo(
    () => wrongNotes.filter((n) => (!area || n.area === area) && (!onlyStarred || n.starred)),
    [wrongNotes, area, onlyStarred],
  );

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [showPassage, setShowPassage] = useState(false);
  const [question, setQuestion] = useState('');
  const [live, setLive] = useState('');
  const [convo, setConvo] = useState<{ q: string; a: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [again, setAgain] = useState<Record<string, boolean>>({});

  const card = cards[index];
  const solved = picked != null;
  const correct = solved && card ? picked === card.answerIndex : false;

  function nextCard() {
    setPicked(null);
    setShowPassage(false);
    setConvo([]);
    setLive('');
    setQuestion('');
    setIndex((i) => i + 1);
  }

  async function ask() {
    if (!card) return;
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setLive('');
    const answer = await askScodyAIStream(
      `${SCODY_WRONG_SYSTEM}\n\n[문항 정보]\n${ctx(card)}`,
      q,
      (chunk) => setLive((prev) => prev + chunk),
    );
    setConvo((prev) => [...prev, { q, a: answer }]);
    setLive('');
    setQuestion('');
    setBusy(false);
  }

  async function saveMemo() {
    if (!card || convo.length === 0 || busy) return;
    setBusy(true);
    const text = convo.map((m) => `질문: ${m.q}\n답변: ${m.a}`).join('\n\n');
    const memo = await askScodyAIStream(MEMO_SYSTEM, `${ctx(card)}\n\n[대화]\n${text}`, () => {});
    setDig(card.id, memo);
    setBusy(false);
  }

  const title = onlyStarred ? '별표 집중 복습' : area ? `${area} 복습` : '오답노트 복습';

  if (cards.length === 0) {
    return (
      <Screen testID="student-review" backFallback="/student/records" title={title}>
        <Group>
          <View style={{ padding: spacing.lg, gap: spacing.xs }}>
            <AppText tone="secondary">복습할 오답이 없어요.</AppText>
            <AppText variant="caption" tone="tertiary">
              {onlyStarred
                ? '오답노트에서 별표를 달면 여기에 모여요.'
                : '결과 화면에서 틀린 문제를 담으면 카드로 복습할 수 있어요.'}
            </AppText>
          </View>
        </Group>
        <Button
          testID="review-to-records"
          variant="secondary"
          label="기록으로 돌아가기"
          onPress={() => router.replace('/student/records' as never)}
        />
      </Screen>
    );
  }

  // 마지막 카드까지 끝낸 상태
  if (!card) {
    const againCount = Object.values(again).filter(Boolean).length;
    return (
      <Screen testID="student-review" backFallback="/student/records" title="복습을 끝냈어요">
        <Group>
          <View style={{ padding: spacing.lg, gap: spacing.xs }}>
            <AppText variant="label">
              {cards.length}개 중 {cards.length - againCount}개를 다시 맞혔어요.
            </AppText>
            <AppText variant="caption" tone="secondary">
              {againCount > 0
                ? `${againCount}개는 아직 헷갈려요. 별표를 달아 두면 집중 복습에서 다시 만나요.`
                : '헷갈리던 문제를 모두 정리했어요.'}
            </AppText>
          </View>
        </Group>
        <Button
          testID="review-restart"
          label="처음부터 다시 복습하기"
          onPress={() => {
            setAgain({});
            setIndex(0);
          }}
        />
        <Button
          testID="review-to-records"
          variant="secondary"
          label="기록으로 돌아가기"
          onPress={() => router.replace('/student/records' as never)}
        />
      </Screen>
    );
  }

  const content = card.contentId ? findContent(sets, card.contentId) : undefined;
  const progress = Math.round((index / cards.length) * 100);

  return (
    <Screen
      testID="student-review"
      backFallback="/student/records"
      eyebrow={`${index + 1} / ${cards.length}`}
      title={title}
    >
      <ProgressBar value={progress} />

      <View style={styles.card} testID={`review-card-${card.qId}`}>
        <View style={styles.cardHead}>
          <AppText variant="caption" tone="tertiary">
            {card.area} · {card.source === 'academy' ? '학원 학습' : '개인 학습'} · {card.title}
          </AppText>
          <Pressable
            testID={`review-star-${card.qId}`}
            accessibilityRole="button"
            accessibilityLabel={card.starred ? '별표 빼기' : '별표 달기'}
            onPress={() => toggleStar(card.id)}
            style={styles.star}
          >
            <AppText style={{ color: card.starred ? colors.accent : colors.inkTertiary }}>
              {card.starred ? '★ 별표' : '☆ 별표'}
            </AppText>
          </Pressable>
        </View>

        {content?.passage ? (
          showPassage ? (
            <Passage passage={content.passage} />
          ) : (
            <Button
              testID="review-show-passage"
              variant="ghost"
              label="지문 다시 보기"
              onPress={() => setShowPassage(true)}
            />
          )
        ) : null}

        <AppText variant="label">{card.prompt}</AppText>

        <View style={{ gap: spacing.sm }}>
          {card.choices.map((choice, ci) => {
            const isAnswer = ci === card.answerIndex;
            const isPicked = picked === ci;
            const tone = solved
              ? isAnswer
                ? colors.success
                : isPicked
                  ? colors.danger
                  : colors.inkSecondary
              : colors.ink;
            return (
              <Pressable
                key={ci}
                testID={`review-choice-${ci}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: isPicked }}
                disabled={solved}
                onPress={() => {
                  setPicked(ci);
                  if (ci !== card.answerIndex) setAgain((prev) => ({ ...prev, [card.id]: true }));
                }}
                style={({ pressed }) => [
                  styles.choice,
                  isPicked && styles.choicePicked,
                  solved && isAnswer && styles.choiceAnswer,
                  pressed && !solved && { backgroundColor: colors.hover },
                ]}
              >
                <AppText style={{ color: tone }}>{choice}</AppText>
              </Pressable>
            );
          })}
        </View>

        {solved ? (
          <View style={{ gap: spacing.sm }}>
            <AppText variant="label" style={{ color: correct ? colors.success : colors.danger }}>
              {correct ? '이번엔 맞혔어요.' : '아직 헷갈려요.'}
            </AppText>
            <AppText variant="caption" tone="secondary">
              정답 · {card.choices[card.answerIndex]}
            </AppText>
            {card.pickedIndex != null ? (
              <AppText variant="caption" tone="tertiary">
                처음 풀 때 고른 답 · {card.choices[card.pickedIndex]}
              </AppText>
            ) : null}

            {card.dig ? (
              <View style={{ gap: 4 }}>
                <AppText variant="caption" tone="accent" style={{ fontFamily: typeface.semibold }}>
                  내 오답노트 메모
                </AppText>
                <RichText text={card.dig} />
              </View>
            ) : (
              <AppText variant="caption" tone="tertiary">
                아직 메모가 없어요. 아래에서 물어보고 정리해 둘 수 있어요.
              </AppText>
            )}
          </View>
        ) : null}
      </View>

      {solved ? (
        <Section title="더 파고들기">
          {convo.map((m, i) => (
            <View key={i} style={{ gap: 6 }}>
              <AppText variant="caption" tone="tertiary">
                나
              </AppText>
              <AppText>{m.q}</AppText>
              <AppText variant="caption" tone="accent" style={{ fontFamily: typeface.semibold }}>
                Scody AI
              </AppText>
              <RichText text={m.a} />
            </View>
          ))}
          {live ? (
            <View style={{ gap: 6 }} testID="review-stream">
              <AppText variant="caption" tone="accent" style={{ fontFamily: typeface.semibold }}>
                Scody AI
              </AppText>
              <RichText text={live} />
            </View>
          ) : null}

          <AskField
            testID="review-ask"
            sendTestID="review-send"
            accessibilityLabel="복습 질문 입력"
            value={question}
            onChangeText={setQuestion}
            onSubmit={ask}
            busy={busy}
            placeholder="이 문제, 어디가 헷갈리나요?"
          />

          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            {convo.length > 0 ? (
              <Button
                testID="review-save-memo"
                variant="secondary"
                label={card.dig ? '메모 다시 정리하기' : '노트에 정리해 두기'}
                onPress={saveMemo}
              />
            ) : null}
            {card.mastered ? (
              <Button testID="review-mastered" variant="ghost" label="이해 완료로 표시했어요" />
            ) : (
              <Button
                testID="review-master"
                variant="ghost"
                label="이제 이해했어요"
                onPress={() => setMastered(card.id, true)}
              />
            )}
            <Button
              testID="review-next"
              label={index + 1 < cards.length ? '다음 문제' : '복습 마치기'}
              onPress={nextCard}
            />
          </View>
        </Section>
      ) : (
        <AppText variant="caption" tone="tertiary">
          답을 고르면 정답과 내 메모를 함께 볼 수 있어요.
        </AppText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.md,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  star: { paddingVertical: 2, paddingHorizontal: spacing.sm, borderRadius: radius.pill },
  choice: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  choicePicked: { borderColor: colors.accent },
  choiceAnswer: { borderColor: colors.success },
});
