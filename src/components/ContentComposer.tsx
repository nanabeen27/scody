import { Fragment, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ActionBar } from './ActionBar';
import { Screen } from './Screen';
import { Section } from './Section';
import { Group } from './Group';
import { Field } from './Field';
import { Button } from './Button';
import { SegmentedControl, type SegmentedOption } from './SegmentedControl';
import { Icon } from './Icon';
import { AppText } from './AppText';
import { useContent, type NewQuestionInput } from '@/features/content';
import {
  AREAS,
  GRADES,
  gradeLabel,
  topicsFor,
  type ContentKind,
  type ContentSet,
  type Grade,
  type KoreanArea,
} from '@/data';
import { colors, radius, spacing } from '@/theme/tokens';

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

/** 한 문항에 남은 입력. 비어 있으면(`prompt`가 false, `choices`가 빈 배열) 그 문항은 완성이다. */
interface QProblem {
  prompt: boolean;
  choices: number[];
}
interface Problems {
  title: boolean;
  topic: boolean;
  passage: boolean;
  questions: QProblem[];
  /** 입력이 남은 문항 번호(1부터). 화면 위 요약에 쓴다. */
  incomplete: number[];
  any: boolean;
}

/** 방금 지운 문항. 원래 자리를 함께 들고 있어야 되돌릴 때 순서가 복원된다(D-033). */
interface Removal {
  index: number;
  draft: QDraft;
}

const KIND_OPTIONS: readonly SegmentedOption<ContentKind>[] = [
  { value: 'passage', label: '지문형' },
  { value: 'grammar', label: '문법형' },
];
const GRADE_OPTIONS: readonly SegmentedOption<string>[] = GRADES.map((g) => ({
  value: String(g),
  label: gradeLabel(g),
}));
const AREA_OPTIONS: readonly SegmentedOption<KoreanArea>[] = AREAS.filter((a) => a !== '문법').map(
  (a) => ({ value: a, label: a }),
);

function isFilled(q: QDraft): boolean {
  return !!q.prompt.trim() && q.choices.every((c) => c.trim());
}

/**
 * 지문형/문법형 국어 문제 등록 폼. 총괄관리자·학원 공용.
 * `publishToStudents`가 true면 학생의 개인 학습에 공개된다(운영자 콘텐츠).
 * 학원 콘텐츠는 false로 등록하고 배정으로만 학생에게 전달한다(출처 분리 정책).
 *
 * 검사는 **첫 실패에서 멈추지 않는다.** 문법 은행 세트는 20~25문항이라 문항 하나가 약 400px이고,
 * 화면 맨 아래 캡션 한 줄로 `3번 문제의 보기를…`이라고 알리면 수천 픽셀을 거슬러 올라가야 한다.
 * 그래서 남은 입력을 **해당 필드 아래 인라인**으로 모두 표시하고, 문항 제목에도 표시를 붙인다.
 */
export function ContentComposer({
  title,
  onDone,
  doneLabel = '확인',
  publishToStudents,
  ownerAcademyName,
  backFallback,
}: {
  title: string;
  /** 등록을 마치고 확인을 눌렀을 때. 방금 만든 세트를 함께 넘긴다(다음 화면이 그 학습을 이어 쓴다). */
  onDone: (created: ContentSet) => void;
  /** 완료 화면 버튼 라벨. 어디로 가는지는 호출한 화면이 안다. */
  doneLabel?: string;
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
  /** 한 번이라도 등록을 눌렀는지. 누르기 전에는 빈 칸을 오류로 말하지 않는다. */
  const [checked, setChecked] = useState(false);
  const [removed, setRemoved] = useState<Removal | null>(null);
  const [created, setCreated] = useState<ContentSet | null>(null);
  /** 저장소가 거부한 이유. 지금은 대리 보기(읽기 전용)뿐이다. 조용히 삼키지 않는다. */
  const [refused, setRefused] = useState<string | null>(null);

  const topicOptions: readonly SegmentedOption<string>[] = useMemo(
    () => topicsFor(area).map((t) => ({ value: t, label: t })),
    [area],
  );

  /** 남은 입력. `checked` 전에는 계산해도 화면에 쓰지 않는다(진행 표시만 쓴다). */
  const problems: Problems = useMemo(() => {
    const qs: QProblem[] = questions.map((q) => ({
      prompt: !q.prompt.trim(),
      choices: q.choices.map((c, i) => (c.trim() ? -1 : i)).filter((i) => i >= 0),
    }));
    const incomplete = qs
      .map((p, i) => (p.prompt || p.choices.length ? i + 1 : 0))
      .filter((n) => n > 0);
    const title = !ct.trim();
    const topicMissing = !topic;
    const passage = kind === 'passage' && !passageBody.trim();
    return {
      title,
      topic: topicMissing,
      passage,
      questions: qs,
      incomplete,
      any: title || topicMissing || passage || incomplete.length > 0,
    };
  }, [ct, topic, kind, passageBody, questions]);

  const filled = questions.filter(isFilled).length;

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
  /** 확인 단계 없이 바로 지우고 원래 자리를 기억한다(D-033). */
  function removeQ(qi: number) {
    setRemoved({ index: qi, draft: questions[qi] });
    setQuestions((prev) => prev.filter((_, i) => i !== qi));
  }
  function restoreQ() {
    if (!removed) return;
    setQuestions((prev) => {
      const next = [...prev];
      next.splice(Math.min(removed.index, next.length), 0, removed.draft);
      return next;
    });
    setRemoved(null);
  }

  async function onSave() {
    setChecked(true);
    if (problems.any) return;
    const payload: NewQuestionInput[] = questions.map((q) => ({
      prompt: q.prompt.trim(),
      choices: q.choices.map((c) => c.trim()),
      answerIndex: q.answerIndex,
      explanation: q.explanation.trim() || undefined,
    }));
    const result = await addContent({
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
    /*
      실패하면 완료 화면으로 넘기지 않는다 — 등록된 것처럼 보이면 안 된다.
      **거부 사유를 그대로 보여 준다.** 예전에는 모든 실패를 `대리 보기 중…`으로 말해서, 서버
      오류가 권한 문제로 보였다(실측: 정책 문제로 등록이 막혔는데 대리 보기 안내가 나왔다).
    */
    if ('error' in result) {
      setRefused(result.error);
      return;
    }
    setRefused(null);
    setCreated(result.set);
  }

  if (created) {
    // 제목 문장이 이미 완료를 말하므로 `eyebrow`를 두지 않는다(한글 eyebrow 금지, DESIGN.md §4).
    return (
      <Screen wide testID="composer" title="문제를 등록했어요">
        <AppText tone="secondary">
          {publishToStudents
            ? '학생 개인 학습과 배정에서 바로 쓸 수 있어요.'
            : '배정하면 반 학생에게 전달돼요. 다른 학생의 개인 학습에는 올라가지 않아요.'}
        </AppText>
        <AppText variant="caption" tone="tertiary">
          {created.title} · {created.questions.length}문항
        </AppText>
        {/* 화면의 목적은 이미 끝났다 — 완료 화면의 행동은 전부 `hug`이다(D-047). */}
        <Button
          testID="composer-done"
          hug
          label={doneLabel}
          trailing={<Icon name="arrow-right" size={16} color={colors.accentText} />}
          onPress={() => onDone(created)}
        />
      </Screen>
    );
  }

  const undoNotice = (
    <View style={styles.undo}>
      <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
        문제를 지웠어요
      </AppText>
      <Button
        testID="new-remove-undo"
        variant="ghost"
        tone="accent"
        hug
        leading={<Icon name="refresh-cw" size={16} color={colors.accent} />}
        label="되돌리기"
        onPress={restoreQ}
      />
    </View>
  );

  return (
    <Screen wide testID="composer" title={title} backFallback={backFallback}>
      {/* 저장소가 없어 입력이 화면에만 있다. 길게 쓰기 전에 그 사실을 먼저 알린다. */}
      <AppText variant="caption" tone="tertiary">
        등록하기 전에 이 화면을 벗어나면 쓴 내용은 남지 않아요.
      </AppText>

      {/* 진행 표시. 문법 은행 세트는 20~25문항이라 어디까지 채웠는지 위에서 보여야 한다. */}
      <AppText testID="new-progress" variant="label" tone="secondary">
        {questions.length}문항 · 입력 완료 {filled}
      </AppText>
      {checked && problems.any ? (
        <AppText testID="new-problems" variant="caption" style={{ color: colors.danger }}>
          아직 입력이 남았어요.{' '}
          {problems.incomplete.length
            ? `${problems.incomplete.map((n) => `${n}번`).join(' · ')} 문제를 확인해 주세요.`
            : '표시한 곳을 확인해 주세요.'}
        </AppText>
      ) : null}
      {refused ? (
        <AppText testID="new-refused" variant="caption" style={{ color: colors.danger }}>
          {refused}
        </AppText>
      ) : null}

      <Section title="유형">
        <SegmentedControl testID="new-kind" options={KIND_OPTIONS} value={kind} onChange={setKindSafe} />
      </Section>

      <Section title="학년">
        <SegmentedControl
          testID="new-grade"
          options={GRADE_OPTIONS}
          value={String(grade)}
          onChange={(g) => setGrade(Number(g) as Grade)}
        />
      </Section>

      {kind === 'passage' ? (
        <Section title="영역">
          <SegmentedControl testID="new-area" options={AREA_OPTIONS} value={area} onChange={setAreaSafe} />
        </Section>
      ) : null}

      <Section title="세부 유형">
        <SegmentedControl testID="new-topic" options={topicOptions} value={topic} onChange={setTopic} />
        {checked && problems.topic ? (
          <AppText variant="caption" style={{ color: colors.danger }}>
            세부 유형을 골라 주세요.
          </AppText>
        ) : null}
      </Section>

      <View style={styles.field}>
        <Field
          label="학습 제목"
          testID="new-title"
          value={ct}
          onChangeText={setCt}
          placeholder="예: 비판적 읽기"
        />
        {checked && problems.title ? (
          <AppText variant="caption" style={{ color: colors.danger }}>
            학습 제목을 입력해 주세요.
          </AppText>
        ) : null}
      </View>

      {kind === 'passage' ? (
        <Section title="지문">
          <Field
            label="지문 제목(선택)"
            testID="new-passage-title"
            value={passageTitle}
            onChangeText={setPassageTitle}
            placeholder="예: 비판적 읽기"
          />
          <View style={styles.field}>
            <Field
              label="지문 내용"
              testID="new-passage-body"
              value={passageBody}
              onChangeText={setPassageBody}
              placeholder="지문을 붙여넣거나 입력해 주세요."
              multiline
              style={styles.multiline}
            />
            {checked && problems.passage ? (
              <AppText variant="caption" style={{ color: colors.danger }}>
                지문 내용을 입력해 주세요.
              </AppText>
            ) : null}
          </View>
        </Section>
      ) : null}

      {questions.map((q, qi) => {
        const p = problems.questions[qi];
        const left = checked && (p.prompt || p.choices.length > 0);
        return (
          <Fragment key={qi}>
            {removed && removed.index === qi ? undoNotice : null}
            <Section title={`${qi + 1}번 문제${left ? ' · 입력이 남았어요' : ''}`}>
              <View style={styles.field}>
                <Field
                  label="질문"
                  testID={`new-q${qi}-prompt`}
                  value={q.prompt}
                  onChangeText={(v) => updateQ(qi, { prompt: v })}
                  placeholder="문제를 입력해 주세요."
                />
                {checked && p.prompt ? (
                  <AppText variant="caption" style={{ color: colors.danger }}>
                    질문을 입력해 주세요.
                  </AppText>
                ) : null}
              </View>

              <Group>
                {q.choices.map((c, ci) => (
                  <View key={ci} style={styles.choice}>
                    <Field
                      label={`보기 ${ci + 1}${q.answerIndex === ci ? ' · 정답' : ''}`}
                      testID={`new-q${qi}-c${ci}`}
                      value={c}
                      onChangeText={(v) => updateChoice(qi, ci, v)}
                      placeholder={`보기 ${ci + 1}`}
                    />
                    {checked && p.choices.includes(ci) ? (
                      <AppText variant="caption" style={{ color: colors.danger }}>
                        보기를 입력해 주세요.
                      </AppText>
                    ) : null}
                  </View>
                ))}
              </Group>

              {/*
                정답은 손으로 그린 24px 라디오였다. 공용 `SegmentedControl`은 `보기 N` 라벨을 함께
                읽히게 하고 선택 표현이 화면마다 갈리지 않으므로 그대로 쓴다(D-077). 고른 보기의
                입력 라벨에도 `· 정답`이 붙어 색만으로 뜻을 전하지 않는다.
              */}
              <View style={styles.answer}>
                <AppText variant="caption" tone="secondary">
                  정답
                </AppText>
                <SegmentedControl
                  testID={`new-q${qi}-answer`}
                  options={q.choices.map((_, ci) => ({
                    value: String(ci),
                    label: `보기 ${ci + 1}`,
                  }))}
                  value={String(q.answerIndex)}
                  onChange={(v) => updateQ(qi, { answerIndex: Number(v) })}
                />
              </View>

              <Field
                label="해설(선택)"
                testID={`new-q${qi}-exp`}
                value={q.explanation}
                onChangeText={(v) => updateQ(qi, { explanation: v })}
                placeholder="학생이 결과 화면에서 볼 해설이에요."
              />
              {questions.length > 1 ? (
                <Button
                  testID={`new-q${qi}-remove`}
                  variant="ghost"
                  size="sm"
                  hug
                  label="이 문제 지우기"
                  leading={<Icon name="trash-2" size={15} color={colors.inkSecondary} />}
                  onPress={() => removeQ(qi)}
                />
              ) : null}
            </Section>
          </Fragment>
        );
      })}
      {removed && removed.index >= questions.length ? undoNotice : null}

      <Button
        variant="secondary"
        testID="new-add-question"
        hug
        label="문제 추가하기"
        leading={<Icon name="plus" size={16} color={colors.ink} />}
        onPress={() => setQuestions((p) => [...p, emptyQ()])}
      />

      {/* 이 화면의 목적을 끝내는 버튼 하나만 전폭이다(D-047). 폭은 읽기 폭에서 멈춘다. */}
      <ActionBar>
        <Button testID="new-save" fullWidth label="등록할게요" onPress={() => void onSave()} />
      </ActionBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** 입력 + 그 아래 인라인 오류. 오류가 없으면 `Field` 하나와 같은 모양이다. */
  field: { gap: spacing.xs },
  multiline: { height: 120, paddingTop: 14, textAlignVertical: 'top' },
  choice: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, gap: spacing.xs },
  answer: { gap: spacing.xs },
  // 지운 직후 안내. 되돌릴 수 있으니 확인 단계를 두지 않는다(담아 둔 학습과 같은 모양).
  undo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.offset,
  },
  // 되돌리기는 놓치기 쉬운 행동이라 누름 영역을 44px로 잡는다(DESIGN.md §10).
});
