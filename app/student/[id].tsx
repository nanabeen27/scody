import { useState, type ReactNode } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import {
  ActionBar,
  ConfirmStep,
  Screen,
  Group,
  Row,
  Button,
  SourceTag,
  Icon,
  AppText,
} from '@/components';
import { useStudentItems } from '@/features/learning';
import { useContent } from '@/features/content';
import { useProgress } from '@/features/progress';
import { useToast } from '@/features/toast';
import { useSession } from '@/session';
import { findContent, type LearningItem } from '@/data';
import { colors, spacing } from '@/theme/tokens';
import { useColumn } from '@/theme/useColumn';

const KIND_LABEL = { passage: '지문형', grammar: '문법형' } as const;

/**
 * 학습 이름 줄 — 출처·이름과 담기 토글.
 *
 * **좁은 컬럼에서는 토글을 이름 아래로 내린다.** 390에서 `담아 둔 학습에서 빼기`가 190px 가까이
 * 가져가면 이름에 150px만 남아 `헷갈리는 맞춤` / `법·어법`처럼 낱말 가운데서 접힌다.
 *
 * **별도 컴포넌트인 이유**: 폭 판단은 창 폭이 아니라 `Screen`의 컬럼 폭이어야 한다. 화면 함수
 * 본문에서 부른 `useColumn()`은 아직 `ColumnWidthProvider` 밖이라 창 폭으로 되돌아간다
 * (`notebook.tsx`의 `NoteHead`와 같은 이유 — D-109).
 */
function DetailHead({
  source,
  title,
  action,
}: {
  source: LearningItem['source'];
  title: string;
  action: ReactNode;
}) {
  const { isMobile } = useColumn();
  return (
    <View style={isMobile ? styles.headStack : styles.head}>
      <View style={styles.headMain}>
        <SourceTag source={source} />
        <AppText variant="title">{title}</AppText>
      </View>
      {action}
    </View>
  );
}

/** 학습 상세: 유형(지문형/문법형)·영역·문항 수를 보여주고 시작한다. */
export default function LearningDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { all } = useStudentItems();
  const { sets } = useContent();
  const { attempts, retry, addToQueue, removeFromQueue, isQueued } = useProgress();
  const { readOnly } = useSession();
  const { show } = useToast();
  const [confirmRetry, setConfirmRetry] = useState(false);
  const item = all.find((i) => i.id === id);
  const content = item ? findContent(sets, item.contentId) : undefined;
  /**
   * 담기/빼기. 문구는 `pick`·`result`·`notebook`과 **한 글자도 다르지 않게** 쓴다(D-043) —
   * 같은 토글이 화면마다 다른 말을 하면 무슨 일이 일어났는지 매번 다시 읽어야 한다.
   */
  async function toggleQueue(target: LearningItem) {
    const on = !isQueued(target.id);
    // **서버가 받아 준 다음에 알린다** — 먼저 알리면 저장되지 않아도 담았다고 말한다.
    const res = on ? await addToQueue(target) : await removeFromQueue(target.id);
    // 대리 보기에서는 쓰기가 거부된다(D-071). 일어나지 않은 일을 알리지 않는다.
    if (readOnly) return;
    if (!res.ok) {
      show(res.error ?? (on ? '담아 두지 못했어요' : '빼지 못했어요'), 'removed');
      return;
    }
    show(on ? '학습을 담아 뒀어요' : '담아 둔 학습에서 뺐어요', on ? 'added' : 'removed');
  }

  const attempt = id ? attempts[id] : undefined;

  if (!item || !content) {
    return (
      <Screen testID="student-detail" title="학습을 찾지 못했어요">
        <ActionBar>
          <Button label="홈으로 갈게요" onPress={() => router.replace('/student' as never)} />
        </ActionBar>
      </Screen>
    );
  }

  /** 담기 토글. 제목 옆 한 자리에서만 쓰지만 상태에 따라 라벨·아이콘이 갈려 함수로 둔다. */
  function queueButton() {
    const on = isQueued(item!.id);
    return (
      <Button
        testID="detail-queue"
        variant="secondary"
        /*
          **`hug`이 이 버튼의 폭을 정한다.** 모바일에서는 `headStack`이 세로라 주지 않으면
          컬럼 전체로 늘어나, 아래 `학습 시작하기`와 같은 폭의 테두리 버튼이 제목 바로 밑에
          먼저 선다(§12 `보조 버튼을 전폭으로 늘리기`). 데스크톱 가로 줄에서는
          `alignSelf: 'flex-start'`가 부모의 `alignItems: 'flex-start'`와 같아 그대로다.
        */
        hug
        tone={on ? 'accent' : 'default'}
        label={on ? '담아 둔 학습에서 빼기' : '담아 두기'}
        accessibilityLabel={on ? '담아 둔 학습에서 빼기' : '담아 두기'}
        leading={
          <Icon
            name={on ? 'check' : 'plus'}
            size={16}
            color={on ? colors.accent : colors.ink}
          />
        }
        onPress={() => void toggleQueue(item!)}
      />
    );
  }

  return (
    <Screen testID="student-detail" backFallback="/student">
      {/*
        담기는 **이 학습 하나에 딸린 행동**이라 화면 아래 행동 줄이 아니라 이름 옆에 둔다
        (`ActionBar` 규칙 3). 아래에 두면 `학습 시작하기`와 나란히 서서 어느 것이 주 행동인지
        모양으로 알 수 없었고, 무엇을 담는다는 것인지도 이름에서 멀어졌다.
        학원 과제는 배정으로만 오므로 담을 수 없다(개인 학습만 토글을 둔다).
      */}
      <DetailHead
        source={item.source}
        title={item.title}
        action={item.source === 'personal' ? queueButton() : null}
      />
      <Group>
        <Row title="영역" meta={`국어 · ${item.area}`} />
        <Row title="유형" meta={KIND_LABEL[content.kind]} />
        <Row title="문항 수" meta={`${content.questions.length}문항`} />
        {item.dueDate ? <Row title="마감" meta={`${item.dueDate}까지`} /> : null}
        {attempt ? <Row title="정답률" meta={`${attempt.accuracy}%`} /> : null}
      </Group>
      {/*
        `attempt`를 함께 보지 않는다. 학원 제출 기록은 이 계정의 `attempt`로 남지 않아(A-026),
        조건을 걸면 학부모가 요청할 수 있는 바로 그 과제에서 안내가 한 번도 뜨지 않았다.
      */}
      {retry.includes(item.id) ? (
        <AppText variant="caption" tone="accent">
          다시 풀어보라는 요청이 왔어요.
          {attempt ? ' 지금 기록은 새로 풀면 바뀌어요.' : ''}
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
      {confirmRetry && attempt ? (
        /*
          되돌릴 수 없는 것을 묻는 자리다. 확인 단계의 형태는 앱에 하나뿐이라(`ConfirmStep`)
          손으로 만든 두 버튼 줄을 그것으로 바꿨다 — 문구가 `role="alert"`로 읽히고 포커스가
          확인 버튼으로 옮겨 간다. 확인 중에는 다른 행동을 숨긴다: 지금 답할 질문이 하나여야 한다.
        */
        <ConfirmStep
          message={`다시 풀면 지금 기록(${attempt.accuracy}%)이 새 결과로 바뀌어요.`}
          confirmLabel="기록을 바꾸고 다시 풀기"
          confirmTestID="detail-start"
          confirmAccessibilityLabel="기록을 바꾸고 다시 풀기"
          onCancel={() => setConfirmRetry(false)}
          /*
            **다시 풀기는 `retry=1`을 달고 간다.** 답안은 세션 메모리에 학습별로 남아 있어서
            그냥 들어가면 지난 답이 그대로 칠해져 있고 제출 버튼이 처음부터 떠 있다 —
            한 문항도 다시 읽지 않고 같은 점수를 새 기록으로 덮을 수 있었다. 그러면
            "제출 버튼이 나타나는 것 자체가 다 풀었다는 신호"(D-036)가 재풀이에서 뜻을 잃는다.
            `이어서 풀기`(D-035)는 지난 답이 남아 있어야 하므로 이 표시를 달지 않는다.
          */
          onConfirm={() => router.push(`/student/solve/${item.id}?retry=1` as never)}
          />
      ) : attempt ? (
        /*
          이미 푼 학습에서 할 수 있는 일은 둘이고, 둘 다 이 학습에 대한 것이다.
          **버튼을 나란히 늘어놓지 않고 고르는 목록으로 둔다**(`ActionBar` 규칙 1 — 기록 화면의
          복습 범위 목록과 같은 판단). 위 캡션이 이미 "결과를 다시 보거나 한 번 더 풀 수 있어요"라고
          말하고 있어, 그 두 갈래를 그대로 두 줄로 편 것이다.
          chevron은 **바로 화면을 여는 줄**에만 둔다 — `다시 풀기`는 여기서 한 번 더 묻는다.
        */
        <Group>
          <Row
            testID="detail-result"
            title="결과 다시 보기"
            subtitle="문항별 정오와 해설을 봐요"
            showChevron
            onPress={() => router.push(`/student/result/${item.id}` as never)}
          />
          <Row
            testID="detail-retry"
            title="다시 풀기"
            subtitle="지금 기록이 새 결과로 바뀌어요"
            onPress={() => setConfirmRetry(true)}
          />
        </Group>
      ) : (
        /*
          아직 안 푼 학습: 시작하기 하나가 이 화면의 목적이라 행동 줄에 그것만 둔다.
          담기는 위 제목 옆으로 갔다 — 전폭 primary 옆에 hug 보조를 세우면 폭이 제각각인
          덩어리가 되고, 그 학습에 딸린 행동이 화면 아래로 내려가면 무엇에 대한 것인지 사라진다.
        */
        <ActionBar>
          <Button
            testID="detail-start"
            label={item.status === 'in_progress' ? '이어서 풀기' : '학습 시작하기'}
            trailing={<Icon name="arrow-right" size={16} color={colors.accentText} />}
            accessibilityLabel={item.status === 'in_progress' ? '이어서 풀기' : '학습 시작하기'}
            onPress={() => router.push(`/student/solve/${item.id}` as never)}
          />
        </ActionBar>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  /*
    학습 이름 줄. 담기 토글은 이름 오른쪽 끝에 서고, 좁아지면 이름이 여러 줄로 접힌다.
    아이콘 줄이 아니라 라벨 있는 버튼이라 세로 가운데가 아니라 **첫 줄에 맞춘다**
    (`flex-start`) — 이름이 두 줄이 되면 가운데 맞춤은 버튼이 글 옆에 붕 뜬다.
  */
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  // 좁은 컬럼: 이름이 전폭을 쓰고 토글은 아래 줄 왼쪽 끝에 선다(`hug`이 정렬을 맡는다).
  headStack: { gap: spacing.md },
  headMain: { flex: 1, gap: spacing.sm },
});
