import { useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Pressable, StyleSheet } from 'react-native';
import {
  Screen,
  Section,
  Group,
  Row,
  Button,
  AppText,
  EmptyState,
  Passage,
  RichText,
  AskField,
  ActionBar,
  Icon,
  IconButton,
  Steps,
  SourceTag,
  MotionAsset,
  ConfirmStep,
} from '@/components';
import { useSession } from '@/session';
import { useProgress, type WrongNote } from '@/features/progress';
import { useContent } from '@/features/content';
import { useToast } from '@/features/toast';
import { askScodyAIStream, isAiFailure, isAiSavable } from '@/features/openrouter';
import { SCODY_WRONG_SYSTEM, WRONG_MEMO_SYSTEM, wrongCtx } from '@/features/prompts';
import { findContent } from '@/data';
import { colors, spacing, radius, typeface } from '@/theme/tokens';


/**
 * 화면 이름은 **`카드 복습` 하나**이고 범위를 앞에 붙인다(D-150).
 *
 * 예전에는 `오답노트 복습`·`별표 집중 복습`·`{영역} 복습` 세 이름이라 같은 화면이 세 가지로
 * 불렸고, 마스터 플랜 4절이 쓰는 `카드 복습`은 화면 어디에도 없었다(M9-10). 질문·정리하는 곳
 * (`오답노트`)과 다시 푸는 곳(`카드 복습`)을 이름으로 가른다.
 */
function deckTitle(area: string | undefined, onlyStarred: boolean): string {
  if (onlyStarred) return '별표 카드 복습';
  return area ? `${area} 카드 복습` : '카드 복습';
}

/**
 * 카드 복습의 겉. **읽는 중 · 실패 · 덱을 셋으로 가른다**(D-133·D-136과 같은 규칙 · D-153).
 *
 * ## 왜 컴포넌트를 둘로 갈랐나
 *
 * `ReviewDeck`은 덱(카드 순서)을 **첫 렌더에 한 번** 고정한다. 그 스냅샷은 카드 안에서 별표를
 * 뺄 때 자리와 판정이 어긋나는 것을 막는 장치라 유지해야 한다. 그런데 조회가 끝나기 전에
 * 마운트되면 원본이 비어 있어 `deck = []`이 되고, 노트가 도착해도 다시 세우는 곳이 없어서
 * **`복습할 오답이 없어요.`가 그 화면의 영구 상태가 됐다** — 오답 8개를 담은 학생이 이 주소에서
 * 새로고침하면 3초 뒤에도 그 문장이 남았다(실측).
 *
 * effect에서 덱을 다시 세우는 방법은 쓰지 않는다(React Compiler가 effect 안의 `setState`를
 * 막고, 연쇄 렌더가 된다). 대신 **조회가 끝난 뒤에 덱 화면을 마운트한다** — 그러면 첫 렌더의
 * 스냅샷이 처음부터 옳고, 고칠 상태가 없다.
 */
export default function Review() {
  const params = useLocalSearchParams<{ area?: string; starred?: string }>();
  const { loading, error, reload } = useProgress();
  const title = deckTitle(params.area, params.starred === '1');

  if (loading) {
    return (
      <Screen testID="student-review" backFallback="/student/learn" title={title}>
        <Group>
          <Row title="오답을 불러오고 있어요" />
        </Group>
      </Screen>
    );
  }

  /* 실패는 빈 목록과 다르게 말한다(M-DB-16). 다시 시도가 이 화면의 유일한 다음 행동이다. */
  if (error) {
    return (
      <Screen testID="student-review" backFallback="/student/learn" title={title}>
        <View style={{ gap: spacing.sm, alignItems: 'flex-start' }} testID="review-load-failed">
          <AppText variant="caption" tone="danger">
            오답을 불러오지 못했어요. {error}
          </AppText>
          <Button
            testID="review-load-retry"
            variant="secondary"
            hug
            label="다시 불러오기"
            onPress={() => void reload()}
          />
        </View>
      </Screen>
    );
  }

  return <ReviewDeck />;
}

/**
 * 오답노트 카드 복습.
 * 카드 한 장에 문항 하나. 다시 풀어 보고 → 정답·해설·내 메모를 확인하고 → 필요하면 더 물어본다.
 * 별표한 문항만 모아 집중 복습할 수 있고, 이해가 끝난 문항은 완료로 표시한다.
 */
function ReviewDeck() {
  const router = useRouter();
  const params = useLocalSearchParams<{ area?: string; starred?: string }>();
  const { wrongNotes, toggleStar, setMastered, setDig } = useProgress();
  const { sets } = useContent();
  const { readOnly } = useSession();
  const { show } = useToast();

  const onlyStarred = params.starred === '1';
  const area = params.area;

  /** 지금 조건에 맞는 오답 전체. 세션 덱을 뽑는 원본이다. */
  const pool = useMemo(
    () => wrongNotes.filter((n) => (!area || n.area === area) && (!onlyStarred || n.starred)),
    [wrongNotes, area, onlyStarred],
  );

  /**
   * **덱은 세션이 시작될 때 한 번 고정한다.**
   *
   * 매 렌더의 필터 결과를 덱으로 쓰면 카드 안에서 별표를 빼는 순간 그 카드가 목록에서
   * 사라져 **같은 자리(index)가 다음 문항을 가리킨다** — 내 답·정답 판정·AI 대화는 앞
   * 문항 것이 남아 있어서 학생이 B 문항 화면에서 A 문항의 판정을 읽게 된다.
   * 그래서 id 순서만 붙잡아 두고 값은 매 렌더의 `wrongNotes`에서 다시 찾는다 —
   * 별표·메모 변경은 카드 안에 그대로 반영되고 순서와 개수는 흔들리지 않는다.
   *
   * 필터가 바뀐 복습으로 가는 길은 기록 화면을 거치므로(화면이 새로 마운트된다)
   * 이 스냅샷이 곧 한 세션이다. 다시 시작할 때 새로 잡는다 — 그때 별표를 뺀 것이 반영된다.
   */
  const [deck, setDeck] = useState<string[]>(() => pool.map((n) => n.id));
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [question, setQuestion] = useState('');
  const [live, setLive] = useState('');
  const [convo, setConvo] = useState<{ q: string; a: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [askFailed, setAskFailed] = useState(false);
  const [again, setAgain] = useState<Record<string, boolean>>({});
  /** 메모를 덮어쓰기 전 확인 중인 카드 id. 잃을 것이 있을 때만 세운다. */
  const [confirmMemo, setConfirmMemo] = useState<string | null>(null);

  /**
   * 지금 유효한 호출 회차.
   *
   * 카드를 넘기거나 다시 시작하면 올라가고, 그 전에 보낸 호출의 **결과와 조각을 모두 버린다.**
   * 답을 기다리는 동안에도 `다음 문제`는 눌리기 때문에, 이 검사가 없으면 A 카드에 보낸 답이
   * B 카드의 대화로 들어가고 — 그 대화로 만든 메모가 B의 오답노트 메모로 저장됐다.
   */
  const askSeq = useRef(0);

  const byId = useMemo(() => new Map(wrongNotes.map((n) => [n.id, n] as const)), [wrongNotes]);

  /**
   * 덱에 있던 문항을 다른 화면(오답노트)에서 지웠을 수 있다. 그 자리는 그릴 내용이 없으므로
   * **자리를 지우지 않고 건너뛴다** — 덱에서 빼면 뒤 카드가 앞으로 밀려 위에서 막은 어긋남이
   * 다시 생긴다.
   */
  const at = useMemo(() => {
    let i = index;
    while (i < deck.length && !byId.has(deck[i])) i += 1;
    return i;
  }, [index, deck, byId]);

  const card = at < deck.length ? byId.get(deck[at]) : undefined;
  /** 덱에 아직 남아 있는 카드 수. 진행 표시와 완료 요약이 같은 수를 쓴다. */
  const total = useMemo(() => deck.filter((id) => byId.has(id)).length, [deck, byId]);
  /** 남아 있는 카드 중 몇 번째인가(0부터). 지운 자리는 세지 않는다. */
  const seen = useMemo(
    () => deck.slice(0, at).filter((id) => byId.has(id)).length,
    [deck, at, byId],
  );

  const solved = picked != null;
  const correct = solved && card ? picked === card.answerIndex : false;

  /**
   * 카드 한 장에 매달린 상태를 전부 되돌린다.
   * 카드를 넘길 때와 처음부터 다시 시작할 때가 **같은 것을 부른다** — 예전에는 다시 시작이
   * `picked`를 남겨서, 답을 고르기도 전에 1번 카드의 정답이 공개됐다.
   */
  function resetCard() {
    // 앞 카드에 보낸 호출을 무효로 만든다. 남은 응답은 도착해도 버려진다.
    askSeq.current += 1;
    setBusy(false);
    setPicked(null);
    setConvo([]);
    setLive('');
    setQuestion('');
    setAskFailed(false);
  }

  function nextCard() {
    resetCard();
    setIndex(at + 1);
  }

  function restart() {
    setAgain({});
    // 덱을 지금 조건으로 다시 잡는다 — 이 세션에서 별표를 뺀 문항은 다음 세션에 빠진다.
    setDeck(pool.map((n) => n.id));
    setIndex(0);
    resetCard();
  }

  async function ask() {
    if (!card) return;
    const q = question.trim();
    if (!q || busy) return;
    const seq = askSeq.current;
    setBusy(true);
    setAskFailed(false);
    setLive('');
    /*
      **`busy`는 `finally`에서 되돌린다.** 스트림이 끊기면 호출이 예외로 끝나고, 그때 `busy`가
      켜진 채 남아 이 카드에서 다시 물어볼 수 없었다(화면을 나가야 풀렸다). 카드가 바뀐 뒤라면
      `resetCard`가 이미 정리했으므로 지금 카드의 것만 되돌린다.
    */
    let answer = '';
    try {
      answer = await askScodyAIStream(
        `${SCODY_WRONG_SYSTEM}\n\n[문항 정보]\n${wrongCtx(card, '지난번 내 답')}`,
        q,
        (chunk) => {
          if (askSeq.current !== seq) return;
          setLive((prev) => prev + chunk);
        },
      );
    } catch {
      // 끊긴 스트림은 값이 아니라 예외로 온다. 실패로 다루려면 빈 문장이어야 한다.
      answer = '';
    } finally {
      if (askSeq.current === seq) {
        setLive('');
        setBusy(false);
      }
    }
    // 카드가 바뀌었으면 이 답은 여기 것이 아니다. 화면 상태는 `resetCard`가 이미 정리했다.
    if (askSeq.current !== seq) return;
    /*
      실패 문장을 `Scody AI`의 답으로 그리지 않는다(§19·D-107 — 오답노트와 같은 규칙).
      쓴 질문은 입력창에 그대로 남긴다. 데모 응답은 실패가 아니라 그대로 보여 준다 —
      키 없는 빌드에서 대화가 시작되지 않으면 정리 흐름 전체가 죽는다.
    */
    if (isAiFailure(answer)) {
      setAskFailed(true);
      return;
    }
    setConvo((prev) => [...prev, { q, a: answer }]);
    setQuestion('');
  }

  async function saveMemo() {
    if (!card || convo.length === 0 || busy) return;
    const seq = askSeq.current;
    setBusy(true);
    const text = convo.map((m) => `질문: ${m.q}\n답변: ${m.a}`).join('\n\n');
    // `ask`와 같은 이유로 `finally`에서 되돌린다 — 예외로 끝나면 정리 버튼이 영구히 꺼졌다.
    let memo = '';
    try {
      memo = await askScodyAIStream(WRONG_MEMO_SYSTEM, `${wrongCtx(card, '지난번 내 답')}\n\n[대화]\n${text}`, () => {});
    } catch {
      memo = '';
    } finally {
      if (askSeq.current === seq) setBusy(false);
    }
    if (askSeq.current !== seq) return;
    // 실패·데모 문장을 메모로 저장하지 않는다(오답노트와 같은 규칙).
    if (!isAiSavable(memo)) {
      show('지금은 정리하지 못했어요. 잠시 뒤 다시 해 주세요.', 'removed');
      return;
    }
    const res = await setDig(card.id, memo);
    if (readOnly) return;
    // 서버가 메모를 받지 못했으면 정리됐다고 말하지 않는다. 대화는 남아 다시 정리할 수 있다.
    if (!res.ok) {
      show(res.error ?? '정리를 저장하지 못했어요', 'removed');
      return;
    }
    // 몇 초 걸리는 호출이라 끝난 것을 알리지 않으면 저장됐는지 알 수 없다. 오답노트와 같은 문장.
    show('노트에 정리했어요');
  }

  /**
   * 별표 켜고 끄기. 동사는 버튼 이름과 같게 쓴다(D-043).
   * **서버가 받아 준 뒤에 알린다** — 오답노트 화면과 같은 규칙이다.
   */
  async function star(c: WrongNote) {
    const on = !c.starred;
    const res = await toggleStar(c.id);
    if (readOnly) return;
    if (!res.ok) {
      show(res.error ?? (on ? '별표를 달지 못했어요' : '별표를 빼지 못했어요'), 'removed');
      return;
    }
    show(on ? '별표를 달았어요' : '별표를 뺐어요', on ? 'added' : 'removed');
  }

  /** 이해 완료로 표시. 카드 아래 글자만 바뀌어 눌렸는지 알기 어렵다. */
  async function master(c: WrongNote) {
    const res = await setMastered(c.id, true);
    if (readOnly) return;
    if (!res.ok) {
      show(res.error ?? '표시하지 못했어요', 'removed');
      return;
    }
    show('이해 완료로 표시했어요');
  }

  const title = deckTitle(area, onlyStarred);

  if (total === 0) {
    return (
      <Screen testID="student-review" backFallback="/student/learn" title={title}>
        <EmptyState
          title="복습할 오답이 없어요."
          subtitle={
            onlyStarred
              ? '오답노트에서 별표를 달면 여기에 모여요.'
              : '결과 화면에서 틀린 문제를 담으면 카드로 복습할 수 있어요.'
          }
          action={
            <Button
              testID="review-to-records"
              variant="secondary"
              hug
              label="학습으로 돌아가기"
              onPress={() => router.replace('/student/learn' as never)}
            />
          }
        />
      </Screen>
    );
  }

  // 마지막 카드까지 끝낸 상태
  if (!card) {
    // 세션 중에 오답노트에서 빠진 문항은 세지 않는다 — 남은 카드 수와 짝이 맞아야 한다.
    const againCount = deck.filter((id) => byId.has(id) && again[id]).length;
    return (
      <Screen testID="student-review" backFallback="/student/learn" title="복습을 끝냈어요">
        {/*
          빈 상태가 아니라 완료 요약이라 `EmptyState`를 쓰지 않는다 — 여기서 할 수 있는 행동이
          둘이고(다시 복습 · 기록으로), `EmptyState`의 `action`은 다음 행동 하나다.
          글자 무게는 `EmptyState`와 같게 맞춘다(label + caption).
        */}
        <Group>
          <View style={{ padding: spacing.lg, gap: spacing.xs }}>
            <AppText variant="label">
              {total}개 중 {total - againCount}개를 다시 맞혔어요.
            </AppText>
            <AppText variant="caption" tone="secondary">
              {againCount > 0
                ? `${againCount}개는 아직 헷갈려요. 별표를 달아 두면 집중 복습에서 다시 만나요.`
                : '헷갈리던 문제를 모두 정리했어요.'}
            </AppText>
          </View>
          {/*
            다시 복습하기는 **이 요약에 딸린 행동**이라 카드 안 줄로 둔다(`ActionBar` 규칙 3) —
            방금 읽은 숫자를 그대로 다시 돌리는 일이다. chevron은 두지 않는다: 화면을 여는 것이
            아니라 이 화면을 처음으로 되감는다.
          */}
          <Row
            testID="review-restart"
            title="처음부터 다시 복습하기"
            subtitle={`${total}개를 처음부터 다시 봐요`}
            onPress={restart}
          />
        </Group>
        {/* 이 흐름을 끝내는 행동 하나만 남긴다. */}
        <ActionBar>
          <Button
            testID="review-to-records"
            label="학습으로 돌아가기"
            onPress={() => router.replace('/student/learn' as never)}
          />
        </ActionBar>
      </Screen>
    );
  }

  const content = card.contentId ? findContent(sets, card.contentId) : undefined;

  return (
    <Screen
      testID="student-review"
      backFallback="/student/learn"
      /* 카드를 넘기면 자리는 그대로이고 내용만 갈린다 — 맨 위로 되돌린다(D-095). */
      scrollResetKey={at}
      eyebrow={`${seen + 1} / ${total}`}
      title={title}
    >
      {/*
        비율 막대가 아니라 **칸**이다. 위 `eyebrow`가 `2 / 8`이라고 이미 말하고 있어
        같은 비율을 막대로 또 그리면 같은 말이 두 번이 된다. 칸은 몇 장 남았는지를 말한다.
      */}
      <Steps done={seen + 1} total={total} />

      {/* 어느 학습에서 온 문항인지 먼저 말한다. 출처는 손으로 쓴 글이 아니라 `SourceTag`다(§18). */}
      <View style={styles.head}>
        <View style={styles.headMeta}>
          <SourceTag source={card.source} />
          <AppText variant="caption" tone="tertiary" style={styles.headText}>
            {card.area} · {card.title}
          </AppText>
        </View>
        {/* 글리프(★)는 `Icon`과 굵기가 달라 같은 화면에서 다른 아이콘 체계로 읽힌다(§20). */}
        <IconButton
          testID={`review-star-${card.qId}`}
          inset
          name="star"
          active={card.starred}
          label={card.starred ? '별표 빼기' : '별표 달기'}
          onPress={() => void star(card)}
        />
      </View>

      {/*
        지문은 문제 카드 **밖** 형제로 둔다 — 둘 다 `surface` 면이라 안에 넣으면 같은 색이
        두 겹으로 겹친다(§16). 접을 수 있게 두고(`collapsible`) 처음에는 펼쳐 둔다 —
        390에서 지문을 펼친 채로 돌아갈 길이 없으면 발문과 선지가 화면 밖으로 밀린다.
        `key`는 카드가 아니라 **지문**이다: 같은 지문의 다음 문항으로 넘어가면 접어 둔 상태가
        그대로 남고, 다른 지문이 오면 새로 펼쳐진다.
      */}
      {content?.passage ? (
        <Passage key={card.contentId} passage={content.passage} collapsible defaultOpen />
      ) : null}

      <View style={styles.card} testID={`review-card-${card.qId}`}>
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
            /*
              색만으로 정오를 말하지 않는다(§11). 답을 고른 뒤 그 줄이 무엇인지 글자로 붙인다 —
              점 + `정답`/`내 답`은 결과 화면(`QuestionReview`)과 같은 표현이다.
            */
            const mark = !solved
              ? null
              : isAnswer && isPicked
                ? '정답 · 내 답'
                : isAnswer
                  ? '정답'
                  : isPicked
                    ? '내 답'
                    : null;
            return (
              <Pressable
                key={ci}
                testID={`review-choice-${ci}`}
                accessibilityRole="radio"
                aria-checked={isPicked}
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
                <AppText style={[styles.choiceText, { color: tone }]}>{choice}</AppText>
                {mark ? (
                  <View style={styles.mark}>
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: isAnswer ? colors.success : colors.danger },
                      ]}
                    />
                    <AppText
                      variant="caption"
                      style={{
                        color: isAnswer ? colors.success : colors.danger,
                        fontFamily: typeface.medium,
                      }}
                    >
                      {mark}
                    </AppText>
                  </View>
                ) : null}
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

            {/*
              **무엇이 공개되는지 쓰기 전에 말한다**(D-110·D-054). 이 화면에서도 메모를 저장하는데
              (`saveMemo`) 고지가 없어서, 학원 오답의 메모를 담당 선생님이 읽는다는 사실을 그 글을
              쓰는 화면에서 듣지 못했다. 문장은 오답노트·결과 화면과 **한 글자도 다르지 않게** 쓴다.
            */}
            {card.source === 'academy' ? (
              <AppText variant="caption" tone="secondary">
                학원 과제에서 담은 오답의 메모는 선생님이 볼 수 있어요.
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

            {/*
              이해 완료는 **이 문항에 붙는 표시**라 카드 안, 정답과 메모를 다 읽은 자리에 둔다
              (`ActionBar` 규칙 3). 화면 아래 행동 줄에서는 `다음 문제`와 나란히 서서 어느 것이
              카드를 넘기는 행동인지 모양으로 알 수 없었다.
              눌러도 아무 일이 없는 버튼은 두지 않는다(§8·D-036) — 이미 끝난 상태는 글자다.
            */}
            {card.mastered ? (
              <AppText testID="review-mastered" variant="label" tone="accent">
                이해 완료
              </AppText>
            ) : (
              <Button
                testID="review-master"
                variant="secondary"
                tone="accent"
                hug
                leading={<Icon name="check-square" size={16} color={colors.accent} />}
                label="이제 이해했어요"
                onPress={() => void master(card)}
              />
            )}
          </View>
        ) : null}
      </View>

      {solved ? (
        <Section
          /*
            **오답노트와 같은 이름을 쓴다**(D-150). 여기서 하는 일이 오답노트에서 하는 일과 같다 —
            예전 `더 파고들기`는 그 일을 부르는 네 번째 이름이었다(M9-10).
          */
          title="질문하고 메모하기"
          /*
            정리는 **이 섹션의 대화에 대한 행동**이라 제목 오른쪽에 둔다(`ActionBar` 규칙 3).
            대화가 없으면 정리할 것이 없어 두지 않는다(§17 — 죽은 버튼을 만들지 않는다).
            화살표는 붙이지 않는다: 카드를 넘기는 행동이 아니라 지금 대화를 노트에 남기는 일이다.
          */
          action={
            convo.length > 0 ? (
              <Button
                testID="review-save-memo"
                variant="secondary"
                size="sm"
                tone="accent"
                hug
                /*
                  **라벨이 결과를 말한다.** `메모 다시 정리하기`는 무엇이 사라지는지 말하지 않았다 —
                  이 화면의 대화는 카드를 넘길 때마다 비므로(`resetCard`), 오답노트에서 여러 번
                  물어 만든 긴 메모가 여기서 한 문답의 요약으로 **교체**된다. 학원 오답이면 담당
                  선생님이 보고 있던 값이다(D-054). §17의 "정리는 전체를 다시 요약해 새로 쓴다"는
                  대화가 남아 있는 오답노트의 전제이고, 이 화면에는 그 전제가 없다(A-031).
                */
                label={card.dig ? '지금 대화로 메모를 새로 쓰기' : '노트에 정리해 두기'}
                onPress={() => {
                  // 덮어쓸 것이 없으면 바로 저장한다. 확인 단계는 잃을 것이 있을 때만 둔다.
                  if (card.dig) setConfirmMemo(card.id);
                  else void saveMemo();
                }}
              />
            ) : undefined
          }
        >
          {/*
            **되돌릴 수 없는 교체라 확인을 받는다**(오답노트의 `정리와 대화 지우기`와 같은 무게).
            문장이 무엇이 사라지는지 말한다.
          */}
          {confirmMemo === card.id ? (
            <ConfirmStep
              message="지금 오답노트에 있는 메모가 이 대화의 요약으로 바뀌어요. 되돌릴 수 없어요."
              confirmLabel="새로 쓰기"
              confirmTestID="review-save-memo-confirm"
              confirmAccessibilityLabel="지금 대화로 메모를 새로 쓰기"
              destructive
              onCancel={() => setConfirmMemo(null)}
              onConfirm={() => {
                setConfirmMemo(null);
                void saveMemo();
              }}
            />
          ) : null}
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
          {busy || live ? (
            <View style={{ gap: 6 }} testID="review-stream">
              <AppText variant="caption" tone="accent" style={{ fontFamily: typeface.semibold }}>
                Scody AI
              </AppText>
              {/* 첫 조각이 오기 전에도 진행을 말한다(D-108 — 오답노트와 같은 문장). */}
              {live ? (
                <RichText text={live} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <AppText tone="tertiary">답을 쓰고 있어요</AppText>
                  {/* 상태는 위 글자가 말한다. 이건 '멈춘 게 아니다'만 거든다. */}
                  <MotionAsset name="pending" testID="review-pending-motion" />
                </View>
              )}
            </View>
          ) : null}

          {/* 실패는 답변이 아니라 사람 문장 한 줄로 말한다(§9). 쓴 질문은 입력창에 남아 있다. */}
          {askFailed ? (
            <AppText variant="caption" tone="danger" testID="review-ask-failed">
              지금은 답하지 못했어요. 잠시 뒤 다시 물어봐 주세요.
            </AppText>
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

          {/*
            카드를 넘기는 것만 남긴다 — 이 화면의 목적을 끝내는 행동이다. 정리는 섹션 제목 옆으로,
            이해 완료는 문항 카드 안으로 갔다(각각 그 대상에 딸린 행동이다).
          */}
          <ActionBar>
            <Button
              testID="review-next"
              label={seen + 1 < total ? '다음 문제' : '복습 마치기'}
              trailing={<Icon name="arrow-right" size={16} color={colors.accentText} />}
              accessibilityLabel={seen + 1 < total ? '다음 문제' : '복습 마치기'}
              onPress={nextCard}
            />
          </ActionBar>
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
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headMeta: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headText: { flex: 1 },
  choice: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    // 선지가 두 줄이 되어도 `정답`·`내 답` 표식은 첫 줄에 붙어 있어야 한다.
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  choiceText: { flex: 1 },
  mark: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  choicePicked: { borderColor: colors.accent },
  choiceAnswer: { borderColor: colors.success },
});
