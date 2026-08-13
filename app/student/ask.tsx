import { useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { AppText, RichText, AskField, Divider, BackLink, MotionAsset } from '@/components';
import { askScodyAIStream } from '@/features/openrouter';
import { SCODY_TUTOR_SYSTEM as SYSTEM } from '@/features/prompts';
import { colors, layout, spacing, typeface } from '@/theme/tokens';

interface Turn {
  q: string;
  a: string;
}

/** 이 안쪽에 있으면 '맨 아래에서 읽는 중'으로 본다. 밖이면 사용자가 올려 읽는 중이다. */
const NEAR_BOTTOM = 64;
/** 하단에 고정된 입력창이 화면을 다 먹지 않게 홈보다 낮게 잡는다(본문 15px에서 약 6줄). */
const COMPOSER_MAX = 140;

/** 이어지는 질문에서도 앞 대화를 알고 답하도록 대화 내용을 함께 보낸다. */
function withHistory(turns: Turn[], question: string): string {
  if (turns.length === 0) return question;
  const history = turns.map((t) => `나: ${t.q}\nScody AI: ${t.a}`).join('\n\n');
  return `[이전 대화]\n${history}\n\n[새 질문]\n${question}`;
}

/**
 * Scody AI 대화. 국어 학습 도우미.
 * 홈 입력창에서 넘어오면(`?q=`) 그 질문으로 바로 시작하고, 이어서 계속 물어볼 수 있다.
 * OpenRouter를 호출하고(`askScodyAIStream`), 키가 없으면 데모 응답임을 답변에 밝힌다.
 *
 * 이 화면만 `Screen`을 쓰지 않는다. 대화는 위로 쌓이고 입력창은 아래에 붙어 있어야 해서
 * 스크롤 영역과 입력창이 형제여야 하고(`Screen`은 전체가 하나의 ScrollView다),
 * 새 답이 올 때 맨 아래로 따라가려면 ScrollView ref가 필요하다.
 * 하단 탭은 `RoleShell`이 이 경로에서 숨긴다 — 입력창과 겹치지 않게.
 */
export default function Ask() {
  const { q: initial } = useLocalSearchParams<{ q?: string }>();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [live, setLive] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 답을 기다리는 동안 내가 보낸 말을 먼저 보여 준다. 홈에서 넘어와도 질문이 바로 보인다.
  const [pending, setPending] = useState<string | null>(null);
  // 홈에서 넘어온 질문은 한 번만 보낸다.
  const sentInitial = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const atBottom = useRef(true);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    atBottom.current =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - NEAR_BOTTOM;
  }

  /** 위로 올려 읽는 중이면 끌어내리지 않는다. */
  function stickToBottom() {
    if (!atBottom.current) return;
    scrollRef.current?.scrollToEnd({ animated: false });
  }

  async function send(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    setPending(text);
    setLive('');
    // 내가 보낸 말은 무조건 보이게 한다.
    atBottom.current = true;
    /*
      **`busy`는 `finally`에서 되돌린다.** 호출이 예외로 끝나면 `busy`가 켜진 채 남아 입력창이
      화면을 나갈 때까지 죽어 있었다(오답노트·카드 복습이 이미 이 순서다).
      끊긴 응답은 빈 문장으로 두면 아래 실패 처리가 그대로 받는다.
    */
    let answer = '';
    try {
      // 이 함수는 렌더마다 새로 만들어지므로 `turns`는 부를 때의 최신 값이다.
      answer = await askScodyAIStream(SYSTEM, withHistory(turns, text), (chunk) =>
        setLive((prev) => (prev ?? '') + chunk),
      );
    } catch {
      // 끊긴 스트림은 값이 아니라 예외로 온다. 실패로 다루려면 빈 문장이어야 한다.
      answer = '';
    } finally {
      setPending(null);
      setLive(null);
      setBusy(false);
    }
    if (!answer) {
      /*
        빈 답을 `Scody AI`의 답으로 그리지 않는다 — 이름표만 있고 내용 없는 답변이 남는다.
        쓴 질문은 입력창에 되돌려 준다(보낼 때 비웠다). 기다리는 동안 새로 쓴 글이 있으면
        그것을 지우지 않는다.
      */
      setInput((prev) => (prev ? prev : text));
      return;
    }
    setTurns((prev) => [...prev, { q: text, a: answer }]);
  }

  useEffect(() => {
    if (sentInitial.current || !initial) return;
    sentInitial.current = true;
    void send(initial);
    // 첫 질문은 화면에 들어올 때 한 번만 보낸다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  // 웹은 onContentSizeChange가, 네이티브는 이 effect가 더 잘 맞는다. 둘 다 같은 호출이라 겹쳐도 된다.
  useEffect(stickToBottom, [turns.length, live, pending]);

  function onSubmit() {
    const text = input;
    setInput('');
    void send(text);
  }

  const hasThread = turns.length > 0 || pending != null || live != null;

  return (
    // iOS만 키보드만큼 밀어 준다. 안드로이드는 창이 줄어들어 flex가 알아서 처리한다.
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.head}>
        <View style={[styles.col, styles.headCol]}>
          <BackLink fallback="/student" />
          <AppText variant="title">Scody AI</AppText>
        </View>
      </View>

      <ScrollView
        testID="student-ask"
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={onScroll}
        scrollEventThrottle={64}
        onContentSizeChange={stickToBottom}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.col}>
          <AppText variant="body" tone="secondary">
            국어 공부하다 막히는 곳을 물어보세요. 개념·지문·문법 모두 도와줄게요.
          </AppText>

          {hasThread ? (
            <View style={styles.thread} testID="ask-answer">
              {turns.map((t, i) => (
                <View key={i} style={styles.turn}>
                  {i > 0 ? <Divider /> : null}
                  <AppText variant="caption" tone="tertiary">
                    나
                  </AppText>
                  <AppText style={styles.mine}>{t.q}</AppText>
                  <AppText variant="caption" tone="accent" style={styles.who}>
                    Scody AI
                  </AppText>
                  <RichText text={t.a} />
                </View>
              ))}
              {pending != null ? (
                <View style={styles.turn} testID="ask-pending">
                  {turns.length > 0 ? <Divider /> : null}
                  <AppText variant="caption" tone="tertiary">
                    나
                  </AppText>
                  <AppText style={styles.mine}>{pending}</AppText>
                </View>
              ) : null}
              {live != null ? (
                <View style={styles.turn} testID="ask-stream">
                  <AppText variant="caption" tone="accent" style={styles.who}>
                    Scody AI
                  </AppText>
                  {live ? (
                    <RichText text={live} />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <AppText variant="body" tone="tertiary">
                        답을 쓰고 있어요
                      </AppText>
                      {/* 상태는 위 글자가 말한다. 이건 '멈춘 게 아니다'만 거든다. */}
                      <MotionAsset name="pending" testID="ask-pending-motion" />
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* 떠 있는 요소가 아니라 아래 면이다. 그림자 없이 위쪽 구분선만 둔다. */}
      <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.col}>
          <AskField
            testID="ask-input"
            sendTestID="ask-submit"
            accessibilityLabel="질문 입력"
            value={input}
            onChangeText={setInput}
            onSubmit={onSubmit}
            busy={busy}
            maxHeight={COMPOSER_MAX}
            placeholder={turns.length > 0 ? '이어서 물어보세요' : '예: 비판적 읽기가 뭔가요?'}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  // 셸이 이미 위쪽 안전영역을 소비했다. 대화 화면은 세로 예산이 빡빡해 여백을 줄인다.
  // 대화가 이 아래로 스크롤해 지나가므로 하단 바와 같은 구분선을 둔다.
  head: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headCol: { gap: spacing.sm },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  bar: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  // 헤더·대화·입력창이 같은 폭 컬럼을 써서 좌우 정렬선이 다른 화면과 어긋나지 않게 한다.
  col: { width: '100%', maxWidth: layout.contentMaxWidth, gap: spacing.xl },
  thread: { gap: spacing.xl },
  turn: { gap: 6 },
  who: { fontFamily: typeface.semibold, marginTop: 4 },
  mine: { fontFamily: typeface.medium, color: colors.ink },
});
