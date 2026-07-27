import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Screen } from './Screen';
import { Section } from './Section';
import { Group } from './Group';
import { Field } from './Field';
import { Button } from './Button';
import { AppText } from './AppText';
import { useContent, type NewQuestionInput } from '@/features/content';
import { AREAS, GRADES, topicsFor, type ContentKind, type Grade, type KoreanArea } from '@/data';
import { colors, spacing, radius } from '@/theme/tokens';

interface QDraft {
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
}
const emptyQ = (): QDraft => ({
  prompt: '',
  choices: ['', '', '', ''],
  answerIndex: 0,
  explanation: '',
});

/**
 * 지문형/문법형 국어 문제 등록 폼. 총괄관리자·학원 공용.
 * `publishToStudents`가 true면 학생의 개인 학습에 공개된다(운영자 콘텐츠).
 * 학원 콘텐츠는 false로 등록하고 배정으로만 학생에게 전달한다(출처 분리 정책).
 */
export function ContentComposer({
  title,
  onDone,
  publishToStudents,
  ownerAcademyName,
  backFallback,
}: {
  title: string;
  onDone: () => void;
  publishToStudents: boolean;
  /** 학원이 등록하는 경우 그 학원 이름. 운영자 등록이면 넘기지 않는다. */
  ownerAcademyName?: string;
  /** 등록을 그만둘 때 돌아갈 경로. 히스토리가 없는 직접 진입에도 안전해야 한다. */
  backFallback: string;
}) {
  const { addContent } = useContent();
  const [kind, setKind] = useState<ContentKind>('passage');
  const [area, setArea] = useState<KoreanArea>('독서');
  const [grade, setGrade] = useState<Grade>(1);
  const [topic, setTopic] = useState<string>(topicsFor('독서')[0]);
  const [ct, setCt] = useState('');
  const [passageTitle, setPassageTitle] = useState('');
  const [passageBody, setPassageBody] = useState('');
  const [questions, setQuestions] = useState<QDraft[]>([emptyQ()]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function setKindSafe(k: ContentKind) {
    setKind(k);
    const nextArea: KoreanArea = k === 'grammar' ? '문법' : '독서';
    setArea(nextArea);
    setTopic(topicsFor(nextArea)[0]);
  }
  function setAreaSafe(a: KoreanArea) {
    setArea(a);
    setTopic(topicsFor(a)[0]);
  }
  function updateQ(i: number, patch: Partial<QDraft>) {
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }
  function updateChoice(qi: number, ci: number, val: string) {
    setQuestions((prev) =>
      prev.map((q, idx) =>
        idx === qi ? { ...q, choices: q.choices.map((c, j) => (j === ci ? val : c)) } : q,
      ),
    );
  }

  function onSave() {
    if (!ct.trim()) return setError('학습 제목을 입력해 주세요.');
    if (!topic) return setError('세부 유형을 골라 주세요.');
    if (kind === 'passage' && !passageBody.trim()) return setError('지문 내용을 입력해 주세요.');
    for (const [i, q] of questions.entries()) {
      if (!q.prompt.trim()) return setError(`${i + 1}번 문제의 질문을 입력해 주세요.`);
      if (q.choices.some((c) => !c.trim()))
        return setError(`${i + 1}번 문제의 보기를 모두 입력해 주세요.`);
    }
    setError(null);
    const payload: NewQuestionInput[] = questions.map((q) => ({
      prompt: q.prompt.trim(),
      choices: q.choices.map((c) => c.trim()),
      answerIndex: q.answerIndex,
      explanation: q.explanation.trim() || undefined,
    }));
    addContent({
      area,
      title: ct.trim(),
      kind,
      passage:
        kind === 'passage'
          ? { title: passageTitle.trim() || ct.trim(), body: passageBody.trim() }
          : undefined,
      questions: payload,
      grade,
      topic,
      publishToStudents,
      ownerAcademyName,
    });
    setDone(true);
  }

  if (done) {
    return (
      <Screen wide testID="composer" eyebrow="완료" title="문제를 등록했어요">
        <AppText tone="secondary">
          {publishToStudents
            ? '학생 개인 학습과 배정에서 바로 쓸 수 있어요.'
            : '배정하면 반 학생에게 전달돼요. 다른 학생의 개인 학습에는 올라가지 않아요.'}
        </AppText>
        <Button testID="composer-done" label="확인" onPress={onDone} />
      </Screen>
    );
  }

  return (
    <Screen wide testID="composer" title={title} backFallback={backFallback}>
      <Section title="유형">
        <View style={styles.row}>
          {(['passage', 'grammar'] as ContentKind[]).map((k) => (
            <Pressable
              key={k}
              testID={`new-kind-${k}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: kind === k }}
              onPress={() => setKindSafe(k)}
              style={[styles.chip, kind === k && styles.chipOn]}
            >
              <AppText
                variant="label"
                style={{ color: kind === k ? colors.accentText : colors.inkSecondary }}
              >
                {k === 'passage' ? '지문형' : '문법형'}
              </AppText>
            </Pressable>
          ))}
        </View>
      </Section>

      <Section title="학년">
        <View style={styles.row}>
          {GRADES.map((g) => (
            <Pressable
              key={g}
              testID={`new-grade-${g}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: grade === g }}
              onPress={() => setGrade(g)}
              style={[styles.chip, grade === g && styles.chipOn]}
            >
              <AppText
                variant="label"
                style={{ color: grade === g ? colors.accentText : colors.inkSecondary }}
              >
                고{g}
              </AppText>
            </Pressable>
          ))}
        </View>
      </Section>

      {kind === 'passage' ? (
        <Section title="영역">
          <View style={styles.row}>
            {AREAS.filter((a) => a !== '문법').map((a) => (
              <Pressable
                key={a}
                testID={`new-area-${a}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: area === a }}
                onPress={() => setAreaSafe(a)}
                style={[styles.chip, area === a && styles.chipOn]}
              >
                <AppText
                  variant="label"
                  style={{ color: area === a ? colors.accentText : colors.inkSecondary }}
                >
                  {a}
                </AppText>
              </Pressable>
            ))}
          </View>
        </Section>
      ) : null}

      <Section title="세부 유형">
        <View style={styles.row}>
          {topicsFor(area).map((t) => (
            <Pressable
              key={t}
              testID={`new-topic-${t}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: topic === t }}
              onPress={() => setTopic(t)}
              style={[styles.chip, topic === t && styles.chipOn]}
            >
              <AppText
                variant="label"
                style={{ color: topic === t ? colors.accentText : colors.inkSecondary }}
              >
                {t}
              </AppText>
            </Pressable>
          ))}
        </View>
      </Section>

      <Field label="학습 제목" testID="new-title" value={ct} onChangeText={setCt} placeholder="예: 비판적 읽기" />

      {kind === 'passage' ? (
        <Section title="지문">
          <Field
            label="지문 제목(선택)"
            testID="new-passage-title"
            value={passageTitle}
            onChangeText={setPassageTitle}
            placeholder="예: 비판적 읽기"
          />
          <Field
            label="지문 내용"
            testID="new-passage-body"
            value={passageBody}
            onChangeText={setPassageBody}
            placeholder="지문을 붙여넣거나 입력해 주세요."
            multiline
            style={styles.multiline}
          />
        </Section>
      ) : null}

      {questions.map((q, qi) => (
        <Section key={qi} title={`${qi + 1}번 문제`}>
          <Field
            label="질문"
            testID={`new-q${qi}-prompt`}
            value={q.prompt}
            onChangeText={(v) => updateQ(qi, { prompt: v })}
            placeholder="문제를 입력해 주세요."
          />
          <Group>
            {q.choices.map((c, ci) => (
              <View key={ci} style={styles.choiceRow}>
                <Pressable
                  testID={`new-q${qi}-answer-${ci}`}
                  accessibilityRole="radio"
                  accessibilityLabel={`${qi + 1}번 정답 ${ci + 1}`}
                  accessibilityState={{ checked: q.answerIndex === ci }}
                  onPress={() => updateQ(qi, { answerIndex: ci })}
                  style={[styles.radio, q.answerIndex === ci && styles.radioOn]}
                >
                  {q.answerIndex === ci ? <View style={styles.dot} /> : null}
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Field
                    label={`보기 ${ci + 1}${q.answerIndex === ci ? ' · 정답' : ''}`}
                    testID={`new-q${qi}-c${ci}`}
                    value={c}
                    onChangeText={(v) => updateChoice(qi, ci, v)}
                    placeholder={`보기 ${ci + 1}`}
                  />
                </View>
              </View>
            ))}
          </Group>
          <Field
            label="해설(선택)"
            testID={`new-q${qi}-exp`}
            value={q.explanation}
            onChangeText={(v) => updateQ(qi, { explanation: v })}
            placeholder="학생이 결과 화면에서 볼 해설이에요."
          />
          {questions.length > 1 ? (
            <Button
              variant="ghost"
              label="이 문제 삭제"
              onPress={() => setQuestions((p) => p.filter((_, i) => i !== qi))}
            />
          ) : null}
        </Section>
      ))}

      <Button
        variant="secondary"
        testID="new-add-question"
        label="문제 추가하기"
        onPress={() => setQuestions((p) => [...p, emptyQ()])}
      />

      {error ? (
        <AppText variant="caption" style={{ color: colors.danger }}>
          {error}
        </AppText>
      ) : null}
      <Button testID="new-save" fullWidth label="등록할게요" onPress={onSave} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  multiline: { height: 120, paddingTop: 14, textAlignVertical: 'top' },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.accent },
  dot: { width: 12, height: 12, borderRadius: radius.pill, backgroundColor: colors.accent },
});
