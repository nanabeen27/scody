import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Screen, AppText, RichText, AskField } from '@/components';
import { askScodyAIStream } from '@/features/openrouter';
import { SCODY_TUTOR_SYSTEM as SYSTEM } from '@/features/prompts';
import { colors, spacing, radius, font, typeface } from '@/theme/tokens';

/**
 * Scody AI에게 질문하기. 국어 학습 도우미.
 * OpenRouter를 호출하고(`askScodyAI`), 키가 없으면 데모 응답임을 답변에 밝힌다.
 */
export default function Ask() {
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onAsk() {
    const question = q.trim();
    if (!question || loading) return;
    setLoading(true);
    setAnswer('');
    // 조각이 오는 대로 화면에 이어 붙인다.
    await askScodyAIStream(SYSTEM, question, (chunk) => setAnswer((prev) => (prev ?? '') + chunk));
    setLoading(false);
  }

  return (
    <Screen testID="student-ask" eyebrow="Scody AI" title="무엇이 궁금한가요?">
      <AppText variant="body" tone="secondary">
        국어 공부하다 막히는 곳을 물어보세요. 개념·지문·문법 모두 도와줄게요.
      </AppText>

      <AskField
        testID="ask-input"
        sendTestID="ask-submit"
        accessibilityLabel="질문 입력"
        value={q}
        onChangeText={setQ}
        onSubmit={onAsk}
        busy={loading}
        multiline
        placeholder="예: 비판적 읽기가 뭔가요?"
      />

      {answer ? (
        <View style={styles.answer} testID="ask-answer">
          <AppText variant="eyebrow" tone="accent">
            Scody AI
          </AppText>
          <RichText text={answer} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  answer: { gap: spacing.sm, paddingTop: spacing.sm },
  answerText: {
    fontFamily: typeface.regular,
    color: colors.ink,
    fontSize: font.size.base,
    lineHeight: font.size.base * font.lineHeight.relaxed,
  },
});
