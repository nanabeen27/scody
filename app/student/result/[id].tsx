import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import {
  Screen,
  Section,
  Group,
  Button,
  ScoreCard,
  QuestionReview,
  Row,
  AppText,
} from '@/components';
import { useSession } from '@/session';
import { useStudentItems } from '@/features/learning';
import { useContent } from '@/features/content';
import { useProgress } from '@/features/progress';
import { useRecommendations } from '@/features/recommend';
import { findContent } from '@/data';
import { spacing } from '@/theme/tokens';

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

/** 제출 결과: 정답률·걸린 시간 + 문항별 정오·해설 + 오답노트 담기. */
export default function ResultScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { answers } = useSession();
  const { all } = useStudentItems();
  const { sets } = useContent();
  const { attempts, addWrongNote, hasNote } = useProgress();
  // 오답노트에 담은 문항을 근거로 다음에 풀 학습을 고른다. 담긴 오답이 없으면 비어 있다.
  const recommendations = useRecommendations(2);

  const item = all.find((i) => i.id === id);
  const content = item ? findContent(sets, item.contentId) : undefined;
  const attempt = id ? attempts[id] : undefined;

  if (!item || !content || !attempt) {
    return (
      <Screen testID="student-result" title="결과를 찾지 못했어요">
        <Button label="홈으로 갈게요" onPress={() => router.replace('/student' as never)} />
      </Screen>
    );
  }

  const picked = answers[item.id] ?? {};
  const wrong = content.questions.filter((q) => picked[q.id] !== q.answerIndex);

  return (
    <Screen testID="student-result" backFallback="/student" eyebrow="다 풀었어요!" title={item.title}>
      <ScoreCard rate={attempt.accuracy} detail={`${attempt.total}문항 중 ${attempt.correct}문항 정답`} />

      <Group>
        <Row title="걸린 시간" meta={fmtTime(attempt.timeSec)} />
        <Row title="영역" meta={`국어 · ${item.area}`} />
      </Group>

      <Section title="문항별로 확인해요">
        <Group>
          {content.questions.map((q, i) => (
            <QuestionReview key={q.id} index={i} question={q} pickedIndex={picked[q.id]} />
          ))}
        </Group>
      </Section>

      {wrong.length > 0 ? (
        <Section title="오답노트">
          <Group>
            {wrong.map((q) => {
              const saved = hasNote(q.id);
              return (
                <Row
                  key={q.id}
                  title={q.prompt}
                  subtitle={saved ? '오답노트에 담겼어요' : '틀린 문제예요'}
                  meta={saved ? '담김' : '담기'}
                  onPress={
                    saved
                      ? undefined
                      : () =>
                          addWrongNote({
                            itemId: item.id,
                            contentId: content.id,
                            source: item.source,
                            area: item.area,
                            title: item.title,
                            qId: q.id,
                            prompt: q.prompt,
                            choices: q.choices,
                            answerIndex: q.answerIndex,
                            pickedIndex: picked[q.id],
                          })
                  }
                />
              );
            })}
          </Group>
          <Button
            testID="result-notebook"
            variant="secondary"
            label="틀린 문제 모아보기"
            onPress={() => router.push('/student/notebook' as never)}
          />
        </Section>
      ) : null}

      {recommendations.length > 0 ? (
        <Section title="비슷한 유형으로 이어서 풀어요">
          <AppText variant="caption" tone="secondary">
            오답노트에 담은 문항과 같은 유형이에요.
          </AppText>
          <Group>
            {recommendations.map((r) => (
              <Row
                key={r.item.id}
                testID={`result-reco-${r.item.id}`}
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

      <View style={{ gap: spacing.sm }}>
        <Button testID="result-done" fullWidth label="홈으로 갈게요" onPress={() => router.replace('/student' as never)} />
      </View>
    </Screen>
  );
}
