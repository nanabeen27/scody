import { useRouter } from 'expo-router';
import { View, Pressable, StyleSheet } from 'react-native';
import { Screen, Section, Group, LearningRow, ProgressBar, Button, AppText, SourceTag } from '@/components';
import { useCurrentAccount } from '@/session';
import { useStudentItems } from '@/features/learning';
import { colors, spacing, radius, typeface, font } from '@/theme/tokens';

/**
 * 학생 홈. 3초 안에 "오늘 뭘 해야 하는지" 이해되도록:
 * 오늘의 학습(가장 크게) → 진행률 → 과제(학원) → 오답복습 순으로 시선이 흐른다.
 */
export default function StudentHome() {
  const router = useRouter();
  const account = useCurrentAccount();
  const { all, academy } = useStudentItems();

  const todo = all.filter((i) => i.status !== 'done');
  const done = all.filter((i) => i.status === 'done');
  const next = todo[0];
  const progress = all.length ? Math.round((done.length / all.length) * 100) : 0;
  const academyTodo = academy.filter((i) => i.status !== 'done');
  const review = done.filter((i) => (i.accuracy ?? 100) < 100);

  const go = (id: string) => router.push(`/student/${id}` as never);
  const due = (iso?: string) => {
    if (!iso) return '';
    const [, m, d] = iso.split('-');
    return ` · ${Number(m)}월 ${Number(d)}일까지`;
  };

  return (
    <Screen testID="student-home">
      <AppText variant="caption" tone="secondary">
        {account.name}님, 오늘도 반가워요
      </AppText>

      {next ? (
        <View testID="today-primary" style={styles.hero}>
          <View style={styles.heroTop}>
            <AppText variant="eyebrow" tone="tertiary">
              오늘의 학습
            </AppText>
            <SourceTag source={next.source} />
          </View>
          <AppText style={styles.heroTitle}>{next.title}</AppText>
          <AppText variant="caption" tone="secondary">
            국어 · {next.area} · {next.questionCount}문항{due(next.dueDate)}
          </AppText>
          <View style={styles.heroCta}>
            <Button label="시작하기" onPress={() => go(next.id)} />
            {todo.length > 1 ? (
              <AppText variant="caption" tone="tertiary">
                남은 학습 {todo.length}개
              </AppText>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={styles.hero}>
          <AppText variant="eyebrow" tone="tertiary">
            오늘의 학습
          </AppText>
          <AppText style={styles.heroTitle}>오늘 할 일을 다 끝냈어요</AppText>
          <AppText variant="caption" tone="secondary">
            오답을 다시 보거나, 학습 탭에서 더 풀어볼 수 있어요.
          </AppText>
        </View>
      )}

      <Button
        testID="home-ask"
        variant="secondary"
        fullWidth
        label="Scody AI에게 질문하기"
        onPress={() => router.push('/student/ask' as never)}
      />
      <Button
        testID="home-notebook"
        variant="ghost"
        fullWidth
        label="틀린 문제 모아보기"
        onPress={() => router.push('/student/notebook' as never)}
      />

      <View style={styles.progress}>
        <View style={styles.progressHead}>
          <AppText variant="caption" tone="secondary">
            학습 진행률
          </AppText>
          <AppText variant="caption" tone="secondary" style={{ fontFamily: typeface.medium }}>
            {done.length}/{all.length} 완료
          </AppText>
        </View>
        <ProgressBar value={progress} />
      </View>

      {academyTodo.length > 0 ? (
        <Section title="학원 과제">
          <Group>
            {academyTodo.map((i) => (
              <LearningRow key={i.id} item={i} onPress={() => go(i.id)} />
            ))}
          </Group>
        </Section>
      ) : null}

      {review.length > 0 ? (
        <Section title="오답 복습">
          <Group>
            {review.map((i) => (
              <Pressable
                key={i.id}
                accessibilityRole="button"
                onPress={() => router.push(`/student/result/${i.id}` as never)}
                style={({ pressed }) => [
                  styles.reviewRow,
                  pressed && { backgroundColor: colors.hover },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="label">{i.title}</AppText>
                  <AppText variant="caption" tone="tertiary">
                    정답률 {i.accuracy}% · 틀린 문제 다시 보기
                  </AppText>
                </View>
                <View style={styles.chev} />
              </Pressable>
            ))}
          </Group>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.surface,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroTitle: {
    fontFamily: typeface.bold,
    color: colors.ink,
    fontSize: font.size.xxl,
    lineHeight: font.size.xxl * 1.2,
    letterSpacing: -0.4,
  },
  heroCta: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm },
  progress: { gap: spacing.sm },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  chev: {
    width: 7,
    height: 7,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: colors.inkTertiary,
    transform: [{ rotate: '45deg' }],
  },
});
