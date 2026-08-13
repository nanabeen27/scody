import { useRef, useState } from 'react';
import { Animated, View, Pressable, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActionBar,
  Screen,
  Button,
  AppText,
  SegmentedControl,
  SourceTag,
  Passage,
  Steps,
  Icon,
} from '@/components';
import { useCurrentAccount, useSession } from '@/session';
import { useStudentItems } from '@/features/learning';
import { useContent } from '@/features/content';
import { useProgress } from '@/features/progress';
import { now } from '@/features/clock';
import { useResponsive } from '@/theme/useResponsive';
import { useReplayFade } from '@/theme/useMotion';
import { findContent, type Question } from '@/data';
import { colors, spacing, radius, typeface, font } from '@/theme/tokens';

/** 한 화면에 놓는 문항 수. 10문항을 한 번에 쏟으면 어디를 푸는지 놓친다. */
const PAGE_SIZE = 5;

type ViewMode = 'five' | 'one';

/**
 * 2단일 때 지문은 화면에 붙어 있어야 한다. 문항을 내려 보다가 지문이 위로 사라지면
 * 지문을 다시 찾으러 올라가야 한다. 웹에서만 쓰는 스타일이라 RN 타입 밖이다.
 */
const stickyPassage = (
  Platform.OS === 'web'
    ? { position: 'sticky', top: spacing.xl, maxHeight: '85vh', overflow: 'auto' }
    : {}
) as unknown as ViewStyle;

const MODES = [
  { value: 'five', label: '5문항씩' },
  { value: 'one', label: '한 문항씩' },
] as const;

/**
 * 문제 풀이. 지문형이면 지문을 하나의 면으로 묶어 왼쪽(또는 위)에 두고,
 * 문항은 최대 5개씩 나눠 보여준다. '한 문항씩' 모드로 바꾸면 한 문제에만 집중할 수 있다.
 * 선택은 자동 저장된다.
 */
export default function Solve() {
  const router = useRouter();
  /**
   * `retry=1`은 상세의 `기록을 바꾸고 다시 풀기`에서만 붙는다(`app/student/[id].tsx`).
   * 이어서 풀기(D-035)로 들어오면 붙지 않아 지난 답이 그대로 남는다.
   */
  const { id, retry } = useLocalSearchParams<{ id: string; retry?: string }>();
  const retrying = retry === '1';
  useCurrentAccount();
  const { answers, saveAnswer } = useSession();
  const { all } = useStudentItems();
  const { sets } = useContent();
  const { submitAttempt } = useProgress();
  const { isDesktop } = useResponsive();
  const startRef = useRef<number>(now());
  const [mode, setMode] = useState<ViewMode>('five');
  const [page, setPage] = useState(0);
  /**
   * 이번 재풀이에서 다시 고른 문항. **화면이 지난 답을 가리는 데만 쓴다.**
   *
   * 세션 답안(`answers`)을 지우지 않는 이유: 답안은 세션이 가진 하나뿐인 진실이고
   * 지우는 함수가 없다. 대신 여기 담긴 문항만 골라 보여 주면 다시 읽지 않은 문항은
   * 비어 있는 채로 남아 제출 버튼도 뜨지 않는다. 다 풀어야 제출할 수 있으므로
   * 제출 시점의 세션 답안은 전부 이번에 고른 것으로 덮여 있다.
   */
  const [redone, setRedone] = useState<string[]>([]);
  /** 제출 중. 두 번 눌러 두 번 내지 않게 한다. */
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /*
    페이지를 넘기면 스크롤이 맨 위로 돌아간다(`scrollResetKey`). 그때 문항이 그대로 서 있으면
    화면이 움직이지 않은 것처럼 보여 같은 문제를 다시 읽는다. 짧게 교차 페이드해서
    '내용이 갈렸다'만 전한다. 0이 아니라 0.35에서 시작하는 것은 빈 화면이 로딩처럼 읽히기 때문.
  */
  const fade = useReplayFade(page);

  const item = all.find((i) => i.id === id);
  const content = item ? findContent(sets, item.contentId) : undefined;

  if (!item || !content) {
    return (
      <Screen testID="student-solve" title="학습을 찾지 못했어요">
        <ActionBar>
          <Button label="홈으로 갈게요" onPress={() => router.replace('/student' as never)} />
        </ActionBar>
      </Screen>
    );
  }

  const questions = content.questions;
  const saved = answers[item.id] ?? {};
  /*
    재풀이에서는 이번에 다시 고른 문항만 칠한다. `saved`에서 골라 오므로 대리 보기처럼
    저장이 거부된 경우(D-071)에는 여기서도 비어 있다 — 화면과 저장된 값이 어긋나지 않는다.
  */
  const picked: Record<string, number> = retrying
    ? Object.fromEntries(
        redone.filter((qid) => saved[qid] != null).map((qid) => [qid, saved[qid]]),
      )
    : saved;
  const answeredCount = questions.filter((q) => picked[q.id] != null).length;
  const allAnswered = answeredCount === questions.length;

  const pageSize = mode === 'one' ? 1 : PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(questions.length / pageSize));
  const current = Math.min(page, pages - 1);
  const from = current * pageSize;
  const shown = questions.slice(from, from + pageSize);
  const lastPage = current >= pages - 1;

  /** 보기 모드를 바꿔도 지금 보던 문항이 화면에 남게 페이지를 다시 계산한다. */
  function changeMode(next: ViewMode) {
    const firstIndex = current * pageSize;
    const nextSize = next === 'one' ? 1 : PAGE_SIZE;
    setMode(next);
    setPage(Math.floor(firstIndex / nextSize));
  }

  async function onSubmit() {
    if (submitting) return;
    const timeSec = Math.max(1, Math.round((now() - startRef.current) / 1000));
    setSubmitting(true);
    /*
      **채점은 서버가 한다**(`rpc_submit_attempt`). 예전에는 `session.submit()`이 세션 안에서
      정답 수를 세고 `recordAttempt`가 기록을 따로 남겼다 — 같은 사실이 두 곳에 있었고, 학원
      학습은 `markAssignmentSubmitted`로 한 번 더 알려야 했다. 지금은 한 번의 호출이 시도·문항별
      정오·배정 제출 표시를 한 트랜잭션으로 남긴다.
    */
    const result = await submitAttempt({
      source: item!.source,
      contentId: item!.contentId,
      assignmentId: item!.source === 'academy' ? item!.id : undefined,
      timeSec,
      picked: answers[item!.id] ?? {},
    });
    setSubmitting(false);
    if (!result.ok) {
      // 내지 못했는데 결과 화면으로 보내면 제출된 것처럼 보인다.
      setSubmitError(result.error ?? '제출하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
      return;
    }
    router.replace(`/student/result/${item!.id}` as never);
  }

  const hasPassage = content.kind === 'passage' && !!content.passage;
  const twoCol = isDesktop && hasPassage;

  const passageBlock = hasPassage ? <Passage passage={content.passage!} /> : null;

  const questionsBlock = (
    <>
      <View style={styles.qBar}>
        <AppText variant="caption" tone="secondary">
          {mode === 'one'
            ? `${from + 1}번 문항`
            : `${from + 1}–${Math.min(questions.length, from + pageSize)}번 문항`}
          <AppText variant="caption" tone="tertiary">
            {' '}
            · 전체 {questions.length}문항
          </AppText>
        </AppText>
        <SegmentedControl testID="solve-mode" options={MODES} value={mode} onChange={changeMode} />
      </View>

      <Animated.View style={{ opacity: fade, gap: spacing.xl }}>
        {shown.map((q, i) => (
          <QuestionCard
            key={q.id}
            number={from + i + 1}
            question={q}
            pickedIndex={picked[q.id]}
            onPick={(ci) => {
              saveAnswer({
                itemId: item.id,
                source: item.source,
                contentId: item.contentId,
                // 학원 학습의 `itemId`는 배정 id다 — 초안이 어느 배정의 것인지 서버가 알아야 한다.
                assignmentId: item.source === 'academy' ? item.id : undefined,
                questionId: q.id,
                choice: ci,
              });
              if (retrying) setRedone((prev) => (prev.includes(q.id) ? prev : [...prev, q.id]));
            }}
          />
        ))}
      </Animated.View>

      {/* 두 칸을 같은 폭으로 두고 각자 바깥쪽으로 붙인다. 한쪽만 늘어나면 무게가 어긋난다. */}
      <View style={styles.nav}>
        <View style={[styles.navSide, styles.navLeft]}>
          {current > 0 ? (
            <Button
              testID="solve-prev"
              variant="secondary"
              label="이전"
              leading={<Icon name="chevron-left" size={16} color={colors.ink} />}
              accessibilityLabel="이전"
              onPress={() => setPage(current - 1)}
            />
          ) : null}
        </View>
        <AppText variant="caption" tone="tertiary">
          {current + 1} / {pages}
        </AppText>
        <View style={[styles.navSide, styles.navRight]}>
          {lastPage ? null : (
            /*
              `이전`과 같은 무게로 둔다(§16). 이 화면의 primary는 `제출할게요` 하나이고,
              그 버튼이 **나타나는 것 자체가** 다 풀었다는 신호다 — 다 풀기 전에 accent 버튼이
              둘이면 어느 쪽이 끝인지 알 수 없다.
            */
            <Button
              testID="solve-next"
              variant="secondary"
              label="다음"
              trailing={<Icon name="chevron-right" size={16} color={colors.ink} />}
              accessibilityLabel="다음"
              onPress={() => setPage(current + 1)}
            />
          )}
        </View>
      </View>

      {/* 다 풀었을 때만 나타난다. 남은 개수는 위 진행 표시가 이미 말한다. */}
      {allAnswered ? (
        <>
          {submitError ? (
            <AppText variant="caption" style={{ color: colors.danger }}>
              {submitError}
            </AppText>
          ) : null}
          <ActionBar>
            <Button
              testID="solve-submit"
              size="lg"
              label={submitting ? '제출하고 있어요' : '제출할게요'}
              variant="primary"
              trailing={<Icon name="arrow-right" size={18} color={colors.accentText} />}
              accessibilityLabel="제출할게요"
              onPress={() => void onSubmit()}
            />
          </ActionBar>
        </>
      ) : null}
    </>
  );

  return (
    <Screen wide testID="student-solve" title={item.title} scrollResetKey={current}>
      <View style={styles.head}>
        <SourceTag source={item.source} />
        <AppText variant="caption" tone="secondary">
          {answeredCount} / {questions.length} 풀었어요
        </AppText>
      </View>
      {/*
        비율 막대가 아니라 **칸**이다. 바로 위에 `3 / 5 풀었어요`가 있어 같은 비율을
        막대로 또 그리면 같은 말이 두 번이 된다. 칸은 몇 문항이 남았는지를 말한다.
        문항이 많으면(25문항 세트) `Steps`가 스스로 아무것도 그리지 않는다 — 그때는
        칸이 실처럼 가늘어져 셀 수 없고, 위 숫자만으로 충분하다.
      */}
      <Steps done={answeredCount} total={questions.length} />

      {twoCol ? (
        <View style={styles.cols}>
          <View style={[styles.col, stickyPassage]}>{passageBlock}</View>
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

/**
 * 한 문항. 번호는 왼쪽에 고정하고 발문은 오른쪽 컬럼에서 접힌다 —
 * 번호와 발문을 한 문장으로 두면 발문이 길어질 때 번호 아래로 흘러 줄이 어긋난다.
 */
function QuestionCard({
  number,
  question,
  pickedIndex,
  onPick,
}: {
  number: number;
  question: Question;
  pickedIndex?: number;
  onPick: (choiceIndex: number) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.qHead}>
        <View style={styles.qNum}>
          <AppText variant="caption" style={styles.qNumText}>
            {number}
          </AppText>
        </View>
        <AppText style={styles.prompt}>{question.prompt}</AppText>
      </View>

      <View style={styles.choices}>
        {question.choices.map((choice, ci) => {
          const selected = pickedIndex === ci;
          return (
            <Pressable
              key={ci}
              accessibilityRole="radio"
              aria-checked={selected}
              accessibilityLabel={`${number}번 보기 ${ci + 1}`}
              testID={`choice-${number - 1}-${ci}`}
              onPress={() => onPick(ci)}
              style={({ pressed }) => [
                styles.choice,
                selected && styles.choiceOn,
                pressed && !selected && { backgroundColor: colors.hover },
              ]}
            >
              {/* 선지가 두 줄 이상이 되어도 동그라미는 첫 줄에 붙어 있어야 한다. */}
              <View style={[styles.radio, selected && styles.radioOn]}>
                {selected ? <View style={styles.dot} /> : null}
              </View>
              <AppText style={[styles.choiceText, selected && styles.choiceTextOn]}>
                {choice}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  cols: { flexDirection: 'row', gap: spacing.xxl, alignItems: 'flex-start' },
  col: { flex: 1, gap: spacing.xl },

  qBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  card: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  qHead: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  qNum: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.offset,
    alignItems: 'center',
    justifyContent: 'center',
    // 발문 첫 줄과 눈높이를 맞춘다.
    marginTop: 1,
  },
  qNumText: { fontFamily: typeface.semibold, color: colors.inkSecondary },
  prompt: {
    flex: 1,
    fontFamily: typeface.semibold,
    color: colors.ink,
    fontSize: font.size.md,
    lineHeight: font.size.md * font.lineHeight.snug,
  },

  choices: { gap: spacing.xs },
  choice: {
    flexDirection: 'row',
    // 긴 선지가 여러 줄로 접힐 때를 기준으로 정렬한다.
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  choiceOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  choiceText: {
    flex: 1,
    fontFamily: typeface.regular,
    color: colors.inkSecondary,
    fontSize: font.size.base,
    lineHeight: font.size.base * font.lineHeight.normal,
  },
  choiceTextOn: { color: colors.ink, fontFamily: typeface.medium },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  radioOn: { borderColor: colors.accent },
  dot: { width: 11, height: 11, borderRadius: radius.pill, backgroundColor: colors.accent },

  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  navSide: { flex: 1 },
  navLeft: { alignItems: 'flex-start' },
  navRight: { alignItems: 'flex-end' },
});
