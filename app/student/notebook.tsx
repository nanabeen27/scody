import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
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
  Row,
} from '@/components';
import { useProgress, type WrongNote } from '@/features/progress';
import { useContent } from '@/features/content';
import { useRecommendations } from '@/features/recommend';
import { askScodyAIStream } from '@/features/openrouter';
import { SCODY_WRONG_SYSTEM } from '@/features/prompts';
import { findContent } from '@/data';
import { colors, spacing, radius, typeface, font } from '@/theme/tokens';

const SUMMARY_SYSTEM =
  '아래 오답 대화를 2~3문장으로 정리해. 학생이 나중에 다시 볼 오답노트 메모야. ' +
  '핵심 개념과 실수 포인트만 담고, 존댓말 -어요로 짧게 써. 마크다운 강조는 쓰지 마.';

function ctx(n: WrongNote): string {
  return `문제: ${n.prompt}\n보기: ${n.choices.join(' / ')}\n정답: ${n.choices[n.answerIndex]}\n내가 고른 답: ${n.pickedIndex != null ? n.choices[n.pickedIndex] : '없음'}`;
}

/** 틀린 문제 모아보기 + Scody AI 대화 + 노트 정리. 지문이 있는 문항은 지문을 함께 보여준다. */
export default function Notebook() {
  const router = useRouter();
  const { wrongNotes: allNotes, removeWrongNote, setDig, toggleStar } = useProgress();
  const { sets } = useContent();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string | null>(null);
  const [input, setInput] = useState<Record<string, string>>({});
  const [convo, setConvo] = useState<Record<string, { q: string; a: string }[]>>({});
  const [streaming, setStreaming] = useState<Record<string, string>>({});
  const [justSaved, setJustSaved] = useState<Record<string, boolean>>({});
  const [wrapUp, setWrapUp] = useState(false);
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  // 담아 둔 오답과 같은 유형의 학습을 다음에 풀 것으로 제안한다.
  const recommendations = useRecommendations(3);

  const areas = useMemo(() => {
    const seen: string[] = [];
    for (const n of allNotes) if (!seen.includes(n.area)) seen.push(n.area);
    return seen;
  }, [allNotes]);
  const wrongNotes = useMemo(
    () => (areaFilter ? allNotes.filter((n) => n.area === areaFilter) : allNotes),
    [allNotes, areaFilter],
  );
  const pending = useMemo(() => wrongNotes.filter((n) => !n.dig), [wrongNotes]);

  async function ask(n: WrongNote) {
    const q = (input[n.id] ?? '').trim();
    if (!q || busy) return;
    setBusy(n.id);
    setStreaming((prev) => ({ ...prev, [n.id]: '' }));
    const answer = await askScodyAIStream(
      `${SCODY_WRONG_SYSTEM}\n\n[문항 정보]\n${ctx(n)}`,
      q,
      (chunk) => setStreaming((prev) => ({ ...prev, [n.id]: (prev[n.id] ?? '') + chunk })),
    );
    setConvo((prev) => ({ ...prev, [n.id]: [...(prev[n.id] ?? []), { q, a: answer }] }));
    setStreaming((prev) => ({ ...prev, [n.id]: '' }));
    setInput((prev) => ({ ...prev, [n.id]: '' }));
    setBusy(null);
  }

  async function summarize(n: WrongNote) {
    const msgs = convo[n.id] ?? [];
    if (msgs.length === 0 || busy) return;
    setBusy(`${n.id}-sum`);
    const text = msgs.map((m) => `질문: ${m.q}\n답변: ${m.a}`).join('\n\n');
    const summary = await askScodyAIStream(SUMMARY_SYSTEM, `${ctx(n)}\n\n[대화]\n${text}`, () => {});
    setDig(n.id, summary);
    setJustSaved((prev) => ({ ...prev, [n.id]: true }));
    setBusy(null);
  }

  return (
    <Screen testID="student-notebook" backFallback="/student" title="오답노트">
      <View style={{ gap: 4 }}>
        <AppText variant="body" tone="secondary">
          Scody AI와 이야기하면서 정답이 왜 정답인지, 내가 어디서 잘못 생각했는지 짚어봐요.
        </AppText>
        <AppText variant="caption" tone="tertiary">
          이야기한 내용은 오답노트 메모로 남고, 카드로 모아 다시 공부할 수 있어요.
        </AppText>
      </View>

      {removed ? (
        <AppText variant="caption" tone="accent">
          {removed}
        </AppText>
      ) : null}

      {wrongNotes.length === 0 ? (
        <>
          <Group>
            <View style={{ padding: spacing.lg, gap: spacing.xs }}>
              <AppText tone="secondary">담아 둔 오답이 없어요.</AppText>
              <AppText variant="caption" tone="tertiary">
                결과 화면에서 틀린 문제를 담으면 여기에서 다시 볼 수 있어요.
              </AppText>
            </View>
          </Group>
          <Button
            testID="notebook-go-records"
            variant="secondary"
            label="기록 보러 가기"
            onPress={() => router.push('/student/records' as never)}
          />
        </>
      ) : (
        <>
          {areas.length > 1 ? (
            <View style={styles.chips}>
              <Pressable
                testID="note-area-all"
                accessibilityRole="button"
                onPress={() => setAreaFilter(null)}
                style={[styles.chip, areaFilter === null && styles.chipOn]}
              >
                <AppText
                  variant="caption"
                  style={{ color: areaFilter === null ? colors.accentText : colors.inkSecondary }}
                >
                  전체 {allNotes.length}
                </AppText>
              </Pressable>
              {areas.map((a) => {
                const on = areaFilter === a;
                const n = allNotes.filter((x) => x.area === a).length;
                return (
                  <Pressable
                    key={a}
                    testID={`note-area-${a}`}
                    accessibilityRole="button"
                    onPress={() => setAreaFilter(a)}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <AppText
                      variant="caption"
                      style={{ color: on ? colors.accentText : colors.inkSecondary }}
                    >
                      {a} {n}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <AppText variant="caption" tone="secondary">
            {pending.length > 0
              ? `${wrongNotes.length}개 중 ${pending.length}개는 아직 정리하지 않았어요.`
              : `${wrongNotes.length}개 모두 정리했어요.`}
          </AppText>

          {wrongNotes.map((n) => {
            const msgs = convo[n.id] ?? [];
            const live = streaming[n.id] ?? '';
            const content = n.contentId ? findContent(sets, n.contentId) : undefined;
            return (
              <Section key={n.id} title={n.title}>
                {/* 지문형 문항은 지문을 맨 위에 함께 보여준다 */}
                {content?.passage ? <Passage passage={content.passage} /> : null}

                <Group>
                  <View style={{ padding: spacing.lg, gap: 6 }}>
                    <View style={styles.noteHead}>
                      <AppText variant="label" style={{ flex: 1 }}>
                        {n.prompt}
                      </AppText>
                      <Pressable
                        testID={`note-star-${n.qId}`}
                        accessibilityRole="button"
                        accessibilityLabel={n.starred ? '별표 빼기' : '별표 달기'}
                        onPress={() => toggleStar(n.id)}
                      >
                        <AppText style={{ color: n.starred ? colors.accent : colors.inkTertiary }}>
                          {n.starred ? '★' : '☆'}
                        </AppText>
                      </Pressable>
                    </View>
                    <AppText variant="caption" tone="secondary">
                      내 답 · {n.pickedIndex != null ? n.choices[n.pickedIndex] : '없음'}
                    </AppText>
                    <AppText variant="caption" style={{ color: colors.success }}>
                      정답 · {n.choices[n.answerIndex]}
                    </AppText>
                    {n.dig ? (
                      <View style={{ marginTop: spacing.sm, gap: 4 }}>
                        <AppText
                          variant="caption"
                          tone="accent"
                          style={{ fontFamily: typeface.semibold }}
                        >
                          내 오답노트 메모
                        </AppText>
                        <RichText text={n.dig} />
                      </View>
                    ) : null}
                  </View>

                  {/* 문제와 한 카드로 붙인다. 위쪽 얇은 선으로만 구분. */}
                  <AskField
                    flat
                    testID={`ask-${n.qId}`}
                    sendTestID={`send-${n.qId}`}
                    accessibilityLabel="오답 질문 입력"
                    value={input[n.id] ?? ''}
                    onChangeText={(v) => setInput((prev) => ({ ...prev, [n.id]: v }))}
                    onSubmit={() => ask(n)}
                    busy={busy === n.id}
                    placeholder="왜 이 선지를 골랐는지 써보아요."
                  />
                </Group>

                {msgs.length > 0 || live ? (
                  <Group>
                    {msgs.map((m, i) => (
                      <View key={i} style={{ padding: spacing.lg, gap: 6 }}>
                        <AppText variant="caption" tone="tertiary">
                          나
                        </AppText>
                        <AppText style={styles.body}>{m.q}</AppText>
                        <AppText
                          variant="caption"
                          tone="accent"
                          style={{ fontFamily: typeface.semibold, marginTop: 4 }}
                        >
                          Scody AI
                        </AppText>
                        <RichText text={m.a} />
                      </View>
                    ))}
                    {live ? (
                      <View style={{ padding: spacing.lg, gap: 6 }} testID={`stream-${n.qId}`}>
                        <AppText
                          variant="caption"
                          tone="accent"
                          style={{ fontFamily: typeface.semibold }}
                        >
                          Scody AI
                        </AppText>
                        <RichText text={live} />
                      </View>
                    ) : null}
                  </Group>
                ) : null}

                <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                  {msgs.length > 0 ? (
                    justSaved[n.id] || n.dig ? (
                      <Button
                        testID={`summ-${n.qId}`}
                        variant="secondary"
                        label="노트에 추가됐어요"
                        onPress={undefined}
                      />
                    ) : (
                      <Button
                        testID={`summ-${n.qId}`}
                        variant="secondary"
                        label={busy === `${n.id}-sum` ? '정리하는 중이에요' : '노트에 정리해 두기'}
                        onPress={() => summarize(n)}
                      />
                    )
                  ) : null}
                  {confirmDelete === n.id ? (
                    <>
                      <Button
                        testID={`del-confirm-${n.qId}`}
                        variant="ghost"
                        label="메모까지 지울게요"
                        onPress={() => {
                          removeWrongNote(n.id);
                          setConfirmDelete(null);
                          setRemoved('오답노트에서 뺏어요.');
                        }}
                      />
                      <Button
                        variant="ghost"
                        label="그대로 둘게요"
                        onPress={() => setConfirmDelete(null)}
                      />
                    </>
                  ) : (
                    <Button
                      testID={`del-${n.qId}`}
                      variant="ghost"
                      label="오답노트에서 빼기"
                      onPress={() => {
                        setConfirmDelete(n.id);
                        setRemoved(null);
                      }}
                    />
                  )}
                </View>
              </Section>
            );
          })}

          {/* 맨 아래: 오답노트 마무리 */}
          {wrapUp ? (
            <Group>
              <View style={{ padding: spacing.lg, gap: spacing.md }}>
                {pending.length > 0 ? (
                  <>
                    <AppText variant="label">
                      오답노트를 안 한 문제들이 있어요. 나중에 오답노트 하시겠어요?
                    </AppText>
                    <AppText variant="caption" tone="secondary">
                      {pending.length}개가 남아 있어요. 지금 나가도 오답은 그대로 남아 있어요.
                    </AppText>
                  </>
                ) : (
                  <AppText variant="label">오답을 모두 정리했어요.</AppText>
                )}
                <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                  <Button
                    testID="wrapup-later"
                    label={pending.length > 0 ? '나중에 할게요' : '기록 보러 가기'}
                    onPress={() => router.push('/student/records' as never)}
                  />
                  <Button
                    testID="wrapup-continue"
                    variant="secondary"
                    label="더 정리할게요"
                    onPress={() => setWrapUp(false)}
                  />
                </View>
              </View>
            </Group>
          ) : (
            <Button
              testID="notebook-wrapup"
              fullWidth
              label="오답노트 마무리하기"
              onPress={() => setWrapUp(true)}
            />
          )}
        </>
      )}

      {recommendations.length > 0 ? (
        <Section title="이 유형 더 풀어볼까요?">
          <AppText variant="caption" tone="secondary">
            담아 둔 오답과 같은 유형의 개인 학습이에요.
          </AppText>
          <Group>
            {recommendations.map((r) => (
              <Row
                key={r.item.id}
                testID={`notebook-reco-${r.item.id}`}
                title={r.item.title}
                subtitle={r.reason}
                meta={`${r.item.questionCount}문항`}
                onPress={() => router.push(`/student/${r.item.id}` as never)}
                showChevron
              />
            ))}
          </Group>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  noteHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  body: {
    fontFamily: typeface.regular,
    color: colors.ink,
    fontSize: font.size.base,
    lineHeight: font.size.base * font.lineHeight.relaxed,
  },
});
