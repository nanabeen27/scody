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
import { dueLabel, formatDate, useStudentItems } from '@/features/learning';
import { useContent } from '@/features/content';
import { useProgress } from '@/features/progress';
import { useToast } from '@/features/toast';
import { useSession } from '@/session';
import { findContent, type LearningItem } from '@/data';
import { colors, spacing, typeface } from '@/theme/tokens';
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
  const { sets, loading: contentLoading, error: contentError, reload: reloadContent } = useContent();
  const {
    attempts,
    retry,
    addToQueue,
    removeFromQueue,
    isQueued,
    loading: progressLoading,
    error: progressError,
    reload: reloadProgress,
  } = useProgress();
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

  /*
    **읽는 중 · 실패 · 없는 학습을 셋으로 가른다**(A-116). 학습 목록과 콘텐츠는 두 조회에서 오고
    (`src/features/learning.ts`) 첫 조회가 끝나기 전에는 둘 다 비어 있다 — 그 창에
    `학습을 찾지 못했어요`를 그리면 상세 주소로 바로 들어온 학생에게 있는 학습을 없다고 단정한다.
    조회가 **실패해도** 같은 문장이 나왔다(M-DB-16). 못 읽은 것과 없는 것은 다르다.
    기준 구현은 `result/[id].tsx`이고 문장·행동을 그대로 쓴다.
  */
  const reading = progressLoading || contentLoading;
  /** 조회 실패 문장. 다시 읽는 중에는 감춘다(§9). */
  const loadError = reading ? null : (progressError ?? contentError);

  /** 두 조회를 함께 다시 시도한다. 실패가 어느 쪽에서 왔는지 학생이 고를 일은 아니다. */
  async function retryLoad() {
    await Promise.all([reloadProgress(), reloadContent()]);
  }

  if (!item || !content) {
    return (
      <Screen
        testID="student-detail"
        /*
          **상태가 무엇이든 되돌아갈 길을 둔다**(`CLAUDE.md` 내비게이션 규칙). 예전에는 성공
          경로에만 `backFallback`이 있어서 같은 URL이 상태에 따라 뒤로가기를 보였다 감췄다 했다.
        */
        backFallback="/student"
        title={
          reading
            ? '학습을 불러오고 있어요'
            : loadError
              ? '학습을 불러오지 못했어요'
              : '학습을 찾지 못했어요'
        }
      >
        {reading ? (
          <Group>
            <Row title="잠시만 기다려 주세요" />
          </Group>
        ) : loadError ? (
          /* 실패 문장은 서버가 준 것을 쓴다. 다시 시도가 이 화면의 유일한 다음 행동이다. */
          <>
            <AppText variant="caption" tone="danger">
              {loadError}
            </AppText>
            <ActionBar>
              <Button
                testID="detail-load-retry"
                label="다시 불러오기"
                onPress={() => void retryLoad()}
              />
            </ActionBar>
          </>
        ) : (
          <ActionBar>
            <Button label="홈으로 갈게요" onPress={() => router.replace('/student' as never)} />
          </ActionBar>
        )}
      </Screen>
    );
  }

  /**
   * 오늘 기준 마감. **이미 낸 학습에는 쓰지 않는다**(D-142) — 낸 과제에게 마감일은 지난 일이라
   * 날짜만 남긴다. 그 줄을 `마감이 지났어요`로 바꾸면 할 일이 남은 것처럼 읽힌다.
   */
  const due = item.status === 'done' ? null : dueLabel(item.dueDate);

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
        {/*
          **상세도 오늘 기준으로 말한다**(`dueLabel` — 홈 히어로·목록 행과 같은 문장).
          D-142는 이 줄을 `formatDate`로 정했지만 그때 없애려던 결함은 **ISO 원문 노출**
          (`2026-08-20까지`)이었다. 날짜만 남은 뒤에도 어제가 마감인 과제가 `8월 17일까지`로
          읽혀, 같은 사실을 홈 히어로와 목록 행이 `마감이 지났어요`로 말하는 것과 어긋났다.
          ISO를 내보내지 않는다는 원칙은 그대로다 — `dueLabel`도 `formatDate`도 사람 문장을 준다.

          **지난 마감은 이 줄에 담지 않는다.** `meta`는 `inkTertiary`(3.23:1, AA 미달)라
          가장 흐린 글자이고(§8), 히어로와 같이 `Row` 밖 한 줄로 분리한다(§14의 1번).
        */}
        {item.dueDate && !due?.overdue ? (
          <Row title="마감" meta={due?.text ?? formatDate(item.dueDate)} />
        ) : null}
        {attempt ? <Row title="정답률" meta={`${attempt.accuracy}%`} /> : null}
      </Group>
      {/*
        **글자가 먼저 바뀌고 색은 그다음이다**(§11 · D-142). 그리고 지난 마감 뒤에는 지금 무엇을
        할 수 있는지 말한다 — 서버는 마감을 검사하지 않으므로(`supabase/migrations/0029_*.sql`의
        `rpc_submit_attempt` 가드는 배정 여부·콘텐츠 일치·문항 존재만 본다) 마감이 지나도 낼 수
        있다. 그 사실을 말하는 곳이 학생 화면에 하나도 없어서, 빨간 글자만 보고 손을 놓는 것이
        가장 자연스러운 반응이었다. **풀이 화면 상단에 같은 문장을 둔다.**
        늦은 제출이 서버 판정으로 남지는 않는다 — 선생님 화면에서는 제출일과 마감일 비교로 읽힌다.
      */}
      {due?.overdue ? (
        <View style={styles.overdueBlock}>
          <AppText variant="caption" style={styles.overdue}>
            {due.text}
          </AppText>
          {item.source === 'academy' ? (
            <AppText variant="caption" tone="secondary">
              마감이 지나도 낼 수 있어요. 선생님에게는 늦게 낸 것으로 보여요.
            </AppText>
          ) : null}
        </View>
      ) : null}
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
          /*
            **무엇이 공개되는지 쓰기 전에 말한다.** 메모에 대해서는 세 화면이 전부 고지를 두는데
            (D-110·D-054) 점수에는 같은 원칙이 적용되지 않았다 — `지금 기록이 새 결과로 바뀌어요`만
            읽으면 바뀌는 것이 내 화면의 숫자로 읽히지만, 학원 과제는 **선생님이 보는 제출 결과**가
            함께 바뀐다(`rpc_submit_attempt`가 `assignment_targets.attempt_id`를 새 회차로 옮긴다).
            개인 학습에는 붙이지 않는다 — 볼 사람이 없다.
          */
          message={
            `다시 풀면 지금 기록(${attempt.accuracy}%)이 새 결과로 바뀌어요.` +
            (item.source === 'academy' ? ' 선생님이 보는 결과도 이 회차로 바뀌어요.' : '')
          }
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

  /* 지난 마감과 그 뒤에 할 수 있는 일. 한 덩어리 안에서 줄만 갈리므로 `spacing.xs`다. */
  overdueBlock: { gap: spacing.xs },
  /* 학생 홈 히어로의 같은 줄과 한 벌이다(`app/student/index.tsx`의 `overdue`). */
  overdue: { color: colors.danger, fontFamily: typeface.medium },
});
