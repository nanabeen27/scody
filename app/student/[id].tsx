import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { Screen, Group, Row, Button, SourceTag, AppText } from '@/components';
import { useStudentItems } from '@/features/learning';
import { useContent } from '@/features/content';
import { useProgress } from '@/features/progress';
import { findContent } from '@/data';
import { spacing } from '@/theme/tokens';

const KIND_LABEL = { passage: '지문형', grammar: '문법형' } as const;

/** 학습 상세: 유형(지문형/문법형)·영역·문항 수를 보여주고 시작한다. */
export default function LearningDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { all } = useStudentItems();
  const { sets } = useContent();
  const { attempts, retry } = useProgress();
  const [confirmRetry, setConfirmRetry] = useState(false);
  const item = all.find((i) => i.id === id);
  const content = item ? findContent(sets, item.contentId) : undefined;
  const attempt = id ? attempts[id] : undefined;

  if (!item || !content) {
    return (
      <Screen testID="student-detail" title="학습을 찾지 못했어요">
        <Button label="홈으로 갈게요" onPress={() => router.replace('/student' as never)} />
      </Screen>
    );
  }

  return (
    <Screen testID="student-detail" backFallback="/student">
      <View style={{ gap: spacing.sm }}>
        <SourceTag source={item.source} />
        <AppText variant="title">{item.title}</AppText>
      </View>
      <Group>
        <Row title="영역" meta={`국어 · ${item.area}`} />
        <Row title="유형" meta={KIND_LABEL[content.kind]} />
        <Row title="문항 수" meta={`${content.questions.length}문항`} />
        {item.dueDate ? <Row title="마감" meta={`${item.dueDate}까지`} /> : null}
        {attempt ? <Row title="정답률" meta={`${attempt.accuracy}%`} /> : null}
      </Group>
      {attempt && retry.includes(item.id) ? (
        <AppText variant="caption" tone="accent">
          다시 풀어보라는 요청이 왔어요. 지금 기록은 새로 풀면 바뀌어요.
        </AppText>
      ) : attempt ? (
        <AppText variant="caption" tone="secondary">
          이미 제출한 학습이에요. 결과를 다시 보거나 한 번 더 풀 수 있어요.
        </AppText>
      ) : content.kind === 'passage' ? (
        <AppText variant="caption" tone="secondary">
          지문을 읽고 문제를 풀어요. 잠깐이면 돼요.
        </AppText>
      ) : (
        <AppText variant="caption" tone="secondary">문법 문제를 하나씩 풀어볼게요.</AppText>
      )}
      {attempt ? (
        <View style={{ gap: spacing.sm }}>
          <Button
            testID="detail-result"
            label="결과 다시 보기"
            onPress={() => router.push(`/student/result/${item.id}` as never)}
          />
          {confirmRetry ? (
            <View style={{ gap: spacing.sm }}>
              <AppText variant="caption" tone="secondary">
                다시 풀면 지금 기록({attempt.accuracy}%)이 새 결과로 바뀌어요.
              </AppText>
              <Button
                testID="detail-start"
                variant="secondary"
                label="기록을 바꾸고 다시 풀기"
                onPress={() => router.push(`/student/solve/${item.id}` as never)}
              />
              <Button variant="ghost" label="그대로 둘게요" onPress={() => setConfirmRetry(false)} />
            </View>
          ) : (
            <Button
              testID="detail-retry"
              variant="secondary"
              label="다시 풀기"
              onPress={() => setConfirmRetry(true)}
            />
          )}
        </View>
      ) : (
        <Button
          testID="detail-start"
          label={item.status === 'in_progress' ? '이어서 풀기' : '학습 시작하기'}
          onPress={() => router.push(`/student/solve/${item.id}` as never)}
        />
      )}
    </Screen>
  );
}
