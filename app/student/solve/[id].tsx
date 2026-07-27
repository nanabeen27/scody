import { useRef } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Section, Group, Button, AppText, SourceTag, Passage } from '@/components';
import { useCurrentAccount, useSession } from '@/session';
import { useStudentItems } from '@/features/learning';
import { useContent } from '@/features/content';
import { useProgress, buildAttempt } from '@/features/progress';
import { now, todayISO } from '@/features/clock';
import { useResponsive } from '@/theme/useResponsive';
import { findContent } from '@/data';
import { colors, spacing, radius } from '@/theme/tokens';

/** 문제 풀이: 지문형이면 지문을 먼저 보여주고, 선택은 자동 저장돼요. */
export default function Solve() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  useCurrentAccount();
  const { answers, saveAnswer, submit } = useSession();
  const { all } = useStudentItems();
  const { sets } = useContent();
  const { recordAttempt, markAssignmentSubmitted } = useProgress();
  const { isDesktop } = useResponsive();
  const startRef = useRef<number>(now());

  const item = all.find((i) => i.id === id);
  const content = item ? findContent(sets, item.contentId) : undefined;

  if (!item || !content) {
    return (
      <Screen testID="student-solve" title="학습을 찾지 못했어요">
        <Button label="홈으로 갈게요" onPress={() => router.replace('/student' as never)} />
      </Screen>
    );
  }

  const questions = content.questions;
  const picked = answers[item.id] ?? {};
  const answeredCount = questions.filter((q) => picked[q.id] != null).length;
  const allAnswered = answeredCount === questions.length;

  function onSubmit() {
    const timeSec = Math.max(1, Math.round((now() - startRef.current) / 1000));
    submit(item!.id, content!.questions);
    const attempt = buildAttempt(
      { itemId: item!.id, title: item!.title, area: item!.area, source: item!.source },
      content!.questions,
      answers[item!.id] ?? {},
      timeSec,
      todayISO(),
    );
    recordAttempt(attempt);
    // 학원 학습은 제출 사실이 학원·학부모 화면에도 전달돼야 한다.
    if (item!.source === 'academy') {
      markAssignmentSubmitted(item!.id, attempt.accuracy, attempt.timeSec);
    }
    router.replace(`/student/result/${item!.id}` as never);
  }

  const hasPassage = content.kind === 'passage' && !!content.passage;
  const twoCol = isDesktop && hasPassage;

  const passageBlock = hasPassage ? <Passage passage={content.passage!} /> : null;

  const questionsBlock = (
    <>
      {questions.map((q, qi) => (
        <Section key={q.id} title={`${qi + 1}. ${q.prompt}`}>
          <Group>
            {q.choices.map((choice, ci) => {
              const selected = picked[q.id] === ci;
              return (
                <Pressable
                  key={ci}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${qi + 1}번 보기 ${ci + 1}`}
                  testID={`choice-${qi}-${ci}`}
                  onPress={() => saveAnswer(item.id, q.id, ci)}
                  style={({ pressed }) => [styles.choice, pressed && { backgroundColor: colors.hover }]}
                >
                  <View style={[styles.radio, selected && styles.radioOn]}>
                    {selected ? <View style={styles.dot} /> : null}
                  </View>
                  <AppText style={{ flex: 1, color: selected ? colors.ink : colors.inkSecondary }}>
                    {choice}
                  </AppText>
                </Pressable>
              );
            })}
          </Group>
        </Section>
      ))}

      <Button
        testID="solve-submit"
        fullWidth
        label={allAnswered ? '제출할게요' : `아직 ${questions.length - answeredCount}문항 남았어요`}
        variant={allAnswered ? 'primary' : 'secondary'}
        onPress={allAnswered ? onSubmit : undefined}
      />
    </>
  );

  return (
    <Screen
      wide
      testID="student-solve"
      eyebrow={`${answeredCount} / ${questions.length} 풀었어요`}
      title={item.title}
    >
      <SourceTag source={item.source} />

      {twoCol ? (
        <View style={styles.cols}>
          <View style={styles.col}>{passageBlock}</View>
          <View style={styles.col}>{questionsBlock}</View>
        </View>
      ) : (
        <>
          {passageBlock}
          {questionsBlock}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cols: { flexDirection: 'row', gap: spacing.xxl, alignItems: 'flex-start' },
  col: { flex: 1, gap: spacing.xl },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.accent },
  dot: { width: 11, height: 11, borderRadius: radius.pill, backgroundColor: colors.accent },
});
