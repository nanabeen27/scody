import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Section, Group, Button, AppText, Field } from '@/components';
import { useCurrentAccount } from '@/session';
import { useProgress } from '@/features/progress';
import { useContent } from '@/features/content';
import { getClassesForAccount } from '@/data';
import { colors, spacing } from '@/theme/tokens';

const KIND_LABEL = { passage: '지문형', grammar: '문법형' } as const;

/** 학습 배정: 반과 콘텐츠를 골라 배정한다. 배정 즉시 해당 반 학생에게 전달된다. */
export default function AcademyAssign() {
  const router = useRouter();
  const account = useCurrentAccount();
  const { addAssignment } = useProgress();
  const { sets: allSets } = useContent();
  const classes = getClassesForAccount(account);
  // 운영자 공개 콘텐츠 + 우리 학원이 등록한 콘텐츠만 배정할 수 있다.
  const sets = allSets.filter(
    (s) => !s.ownerAcademyName || s.ownerAcademyName === account.academyName,
  );

  const [classId, setClassId] = useState(classes[0]?.id);
  const [contentId, setContentId] = useState(sets[0]?.id);
  const [due, setDue] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onAssign() {
    const content = sets.find((s) => s.id === contentId);
    if (!classId || !content) {
      setError('반과 학습 콘텐츠를 선택해 주세요.');
      return;
    }
    const dueDate = due.trim();
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      setError('마감일은 2026-08-11 형식으로 적어 주세요.');
      return;
    }
    setError(null);
    addAssignment({
      classId,
      subject: content.subject,
      title: content.title,
      questionCount: content.questions.length,
      contentId: content.id,
      dueDate: dueDate || undefined,
    });
    setDone(true);
  }

  if (classes.length === 0) {
    return (
      <Screen wide testID="academy-assign" title="학습 배정">
        <Group>
          <View style={{ padding: spacing.lg }}>
            <AppText tone="secondary">배정할 담당 반이 없어요.</AppText>
          </View>
        </Group>
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen wide testID="academy-assign" eyebrow="완료" title="학습을 배정했어요">
        <AppText tone="secondary">해당 반 학생의 홈과 학습 탭에 바로 나타나요.</AppText>
        <Button
          testID="assign-goto-analytics"
          label="제출 현황 보기"
          onPress={() => router.push('/academy/analytics' as never)}
        />
        <Button variant="secondary" label="계속 배정하기" onPress={() => setDone(false)} />
      </Screen>
    );
  }

  const Radio = ({ on }: { on: boolean }) => (
    <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.dot} /> : null}</View>
  );

  return (
    <Screen wide testID="academy-assign" title="학습 배정">
      <Section title="반 선택">
        <Group>
          {classes.map((c) => {
            const on = c.id === classId;
            return (
              <Pressable
                key={c.id}
                testID={`assign-class-${c.id}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => setClassId(c.id)}
                style={({ pressed }) => [styles.opt, pressed && { backgroundColor: colors.hover }]}
              >
                <Radio on={on} />
                <AppText variant="label">
                  {c.name} · 학생 {c.studentIds.length}명
                </AppText>
              </Pressable>
            );
          })}
        </Group>
      </Section>

      <Section title="학습 콘텐츠 선택">
        <Group>
          {sets.map((s) => {
            const on = s.id === contentId;
            return (
              <Pressable
                key={s.id}
                testID={`assign-content-${s.id}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => setContentId(s.id)}
                style={({ pressed }) => [styles.opt, pressed && { backgroundColor: colors.hover }]}
              >
                <Radio on={on} />
                <View style={{ flex: 1 }}>
                  <AppText variant="label">{s.title}</AppText>
                  <AppText variant="caption" tone="tertiary">
                    국어 · {s.area} · {KIND_LABEL[s.kind]} · {s.questions.length}문항
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </Group>
      </Section>

      <Field
        label="마감일(선택)"
        testID="assign-due"
        value={due}
        onChangeText={setDue}
        placeholder="예: 2026-08-11"
      />

      {error ? (
        <AppText variant="caption" style={{ color: colors.danger }}>
          {error}
        </AppText>
      ) : null}
      <Button testID="assign-submit" label="배정하기" onPress={onAssign} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.accent },
  dot: { width: 10, height: 10, borderRadius: 999, backgroundColor: colors.accent },
});
