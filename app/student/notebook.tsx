import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import {
  ActionBar,
  ConfirmStep,
  EmptyState,
  Screen,
  Section,
  Group,
  Button,
  AppText,
  Passage,
  RichText,
  AskField,
  Icon,
  IconButton,
  Row,
  SegmentedControl,
  SourceTag,
  type SegmentedOption,
  MotionAsset,
} from '@/components';
import { useSession } from '@/session';
import { useProgress, type WrongNote } from '@/features/progress';
import { useContent } from '@/features/content';
import { useRecommendations } from '@/features/recommend';
import { useToast } from '@/features/toast';
import { askScodyAIStream, isAiFailure, isAiSavable } from '@/features/openrouter';
import { SCODY_WRONG_SYSTEM, WRONG_MEMO_SYSTEM, wrongCtx } from '@/features/prompts';
import { findContent, type LearningItem } from '@/data';
import { colors, spacing, typeface, font } from '@/theme/tokens';
import { useColumn } from '@/theme/useColumn';


/**
 * 노트 카드의 머리 — 발문과 아이콘 줄(정리·별표·휴지통).
 *
 * **좁은 컬럼에서는 아이콘 줄을 발문 아래로 내린다.** 44px 아이콘이 셋이면 390에서 발문에
 * 180px만 남아 넉 줄이 되고, `alignItems: center`였을 때는 그 줄 뭉치의 세로 가운데에
 * 아이콘이 걸렸다 — 한 손으로 스크롤하다 발문 오른쪽을 스치면 지우기가 눌린다.
 *
 * **별도 컴포넌트인 이유**: 폭 판단은 창 폭이 아니라 `Screen`의 컬럼 폭이어야 한다.
 * 화면 함수 본문에서 부른 `useColumn()`은 아직 `Screen`의 `ColumnWidthProvider` 밖이라
 * 창 폭으로 되돌아간다. 컬럼 안에서 부르려면 자기 컴포넌트가 있어야 한다.
 *
 * 아이콘 순서(정리·별표·휴지통)는 §17이 정한다. `inset`은 한 줄로 놓을 때만 쓴다 —
 * 아래 줄로 내리면 되돌릴 높이가 없다.
 */
function NoteHead({
  prompt,
  tools,
}: {
  prompt: string;
  tools: (stacked: boolean) => ReactNode;
}) {
  const { isMobile } = useColumn();
  return (
    <View style={isMobile ? styles.noteHeadStack : styles.noteHead}>
      <AppText variant="label" style={isMobile ? undefined : styles.grow}>
        {prompt}
      </AppText>
      <View style={isMobile ? styles.noteToolsStack : styles.noteTools}>{tools(isMobile)}</View>
    </View>
  );
}

/** 틀린 문제 모아보기 + Scody AI 대화 + 노트 정리. 지문이 있는 문항은 지문을 함께 보여준다. */
export default function Notebook() {
  const router = useRouter();
  const {
    wrongNotes: allNotes,
    removeWrongNote,
    restoreWrongNote,
    setDig,
    toggleStar,
    addToQueue,
    removeFromQueue,
    isQueued,
  } = useProgress();
  const { sets } = useContent();
  const { readOnly } = useSession();
  const { show } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [input, setInput] = useState<Record<string, string>>({});
  const [convo, setConvo] = useState<Record<string, { q: string; a: string }[]>>({});
  const [streaming, setStreaming] = useState<Record<string, string>>({});
  /** 답을 받지 못한 문항. 그 카드 안에서만 한 줄로 알린다(§9 — 오류는 인라인 캡션). */
  const [askFailed, setAskFailed] = useState<Record<string, boolean>>({});
  const [wrapUp, setWrapUp] = useState(false);
  /** 정리와 대화를 지우기 전 확인. 되돌릴 수 없어 한 번 묻는다. */
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  const [areaFilter, setAreaFilter] = useState<string>('all');
  // 담아 둔 오답과 같은 유형의 학습을 다음에 풀 것으로 제안한다.
  const recommendations = useRecommendations(3);

  const areas = useMemo(() => {
    const seen: string[] = [];
    for (const n of allNotes) if (!seen.includes(n.area)) seen.push(n.area);
    return seen;
  }, [allNotes]);
  const areaOptions = useMemo<readonly SegmentedOption<string>[]>(
    () => [
      { value: 'all', label: '전체', count: allNotes.length },
      ...areas.map((a) => ({
        value: a,
        label: a,
        count: allNotes.filter((n) => n.area === a).length,
      })),
    ],
    [allNotes, areas],
  );
  /**
   * 실제로 걸러 볼 영역. **옵션에서 사라진 값은 `전체`로 되돌린다.**
   *
   * 옵션은 `allNotes`에서 파생되는데 고른 값은 상태에 남는다 — `문법`으로 좁힌 뒤 마지막 문법
   * 오답을 지우면 어떤 옵션도 값과 맞지 않아 `SegmentedControl`의 **모든 칸이 비선택**으로
   * 그려졌다. 화면이 자기 상태를 잘못 말하는 것이라, 상태를 고치지 않고 그릴 값을 정한다 —
   * 그래야 되돌리기로 그 오답이 살아나면 보고 있던 필터도 함께 돌아온다.
   */
  const activeArea = useMemo(
    () => (areaOptions.some((o) => o.value === areaFilter) ? areaFilter : 'all'),
    [areaOptions, areaFilter],
  );
  const wrongNotes = useMemo(
    () => (activeArea === 'all' ? allNotes : allNotes.filter((n) => n.area === activeArea)),
    [allNotes, activeArea],
  );
  const pending = useMemo(() => wrongNotes.filter((n) => !n.dig), [wrongNotes]);
  /**
   * 아직 정리하지 않은 오답 **전체**. 필터와 무관하다.
   *
   * 마무리 문장은 이것으로 낸다 — `문법`만 보다가 마무리하면 독서 오답이 열 개 남았는데도
   * `모두 정리했어요`라고 말하고 주 버튼이 `학습 보러 가기`로 바뀌었다. 흐름의 마지막 문장이
   * 완료를 잘못 선언하면 학생은 남은 것을 모르고 나간다.
   */
  const pendingAll = useMemo(() => allNotes.filter((n) => !n.dig), [allNotes]);
  /** 지문을 자동으로 펼칠 문항. 목록이 바뀌면 새 첫 문항이 펼쳐진다. */
  const firstId = wrongNotes[0]?.id;

  /**
   * 추천 학습 담기/빼기. 오답노트 문항 담기와 문구를 구분한다.
   *
   * **서버가 받아 준 다음에 알린다.** 담긴 표시는 곧바로 바뀌지만(즉각 반응), 알림은 서버가
   * 확인한 뒤에 띄운다 — 먼저 알리면 저장되지 않아도 `담아 뒀어요`라고 말하고 다음 조회에서
   * 조용히 사라진다(`app/parent/children.tsx`와 같은 규칙).
   */
  async function toggleQueue(target: LearningItem) {
    const on = !isQueued(target.id);
    const res = on ? await addToQueue(target) : await removeFromQueue(target.id);
    if (readOnly) return;
    if (!res.ok) {
      show(res.error ?? (on ? '담아 두지 못했어요' : '빼지 못했어요'), 'removed');
      return;
    }
    show(on ? '학습을 담아 뒀어요' : '담아 둔 학습에서 뺐어요', on ? 'added' : 'removed');
  }

  /**
   * 별표 켜고 끄기. 아이콘 색만 바뀌면 눌린 것인지 확신이 안 서 한 줄로 알린다.
   * **동사는 버튼 이름과 같게 쓴다**(D-043) — `별표 달기`를 눌렀는데 `저장했어요`라고 하면
   * 스크린리더 사용자는 다른 일이 일어난 줄 안다.
   */
  async function star(n: WrongNote) {
    const on = !n.starred;
    const res = await toggleStar(n.id);
    // 대리 보기에서는 쓰기가 거부된다(D-071). 일어나지 않은 일을 알리지 않는다.
    if (readOnly) return;
    if (!res.ok) {
      show(res.error ?? (on ? '별표를 달지 못했어요' : '별표를 빼지 못했어요'), 'removed');
      return;
    }
    show(on ? '별표를 달았어요' : '별표를 뺐어요', on ? 'added' : 'removed');
  }

  /**
   * 이 문항을 오답노트에서 뺀다. **되돌리기는 알림 안에 둔다**(D-091).
   * 원래 자리(`index`)를 함께 들고 있어야 되돌렸을 때 목록 순서가 유지된다.
   *
   * 되돌리기 버튼은 **서버가 지우기를 받아 준 뒤에만** 붙는다 — 지워지지 않은 것을 되돌릴
   * 자리를 만들면 누를 때마다 이미 있는 문항을 다시 넣으려 한다.
   */
  async function takeOut(n: WrongNote) {
    const index = allNotes.findIndex((x) => x.id === n.id);
    const res = await removeWrongNote(n.id);
    if (readOnly) return;
    if (!res.ok) {
      show(res.error ?? '오답노트에서 빼지 못했어요', 'removed');
      return;
    }
    show('오답노트에서 뺐어요', 'removed', {
      label: '되돌리기',
      onPress: () => void undoTakeOut(n, index),
    });
  }

  /** 되돌리기. 성공하면 문항이 목록에 다시 나타나므로 따로 알리지 않고, 실패만 말한다. */
  async function undoTakeOut(n: WrongNote, index: number) {
    const res = await restoreWrongNote(n, index);
    if (!res.ok) show(res.error ?? '되돌리지 못했어요', 'removed');
  }

  /**
   * 이 문항에 대해 Scody AI에게 묻는다.
   *
   * **실패 문장을 대화에 넣지 않는다.** `askScodyAIStream`은 실패도 문장으로 돌려주므로
   * 그대로 넣으면 `Scody AI 연결 오류…`가 `Scody AI` 이름표 아래 정상 답변과 같은 서식으로
   * 그려진다(정리 저장과 같은 규칙 — D-102).
   *
   * **실패하면 쓴 질문을 그대로 남긴다.** 입력을 먼저 비우면 다시 물어보려고 처음부터 써야 한다.
   * 그래서 보낸 질문을 대화에 미리 올리지 않는다 — 질문은 입력창에 그대로 있고, 답을 기다리는
   * 표시만 대화 카드에 띄운다(대화 화면은 입력창을 비우므로 거기서는 질문을 미리 올린다).
   */
  async function ask(n: WrongNote) {
    const q = (input[n.id] ?? '').trim();
    if (!q || busy) return;
    setBusy(n.id);
    setAskFailed((prev) => ({ ...prev, [n.id]: false }));
    setStreaming((prev) => ({ ...prev, [n.id]: '' }));
    /*
      **`busy`는 `finally`에서 되돌린다.** 스트림이 중간에 끊기면 호출이 예외로 끝나는데,
      그때 `busy`가 켜진 채 남아 이 화면의 **모든** 보내기 버튼이 화면을 나갈 때까지 꺼져 있었다.
      끊긴 응답은 빈 문장으로 두면 아래 실패 처리가 그대로 받는다(`isAiFailure('')`는 참).
    */
    let answer = '';
    try {
      answer = await askScodyAIStream(
        `${SCODY_WRONG_SYSTEM}\n\n[문항 정보]\n${wrongCtx(n)}`,
        q,
        (chunk) => setStreaming((prev) => ({ ...prev, [n.id]: (prev[n.id] ?? '') + chunk })),
      );
    } catch {
      // 끊긴 스트림은 값이 아니라 예외로 온다. 실패로 다루려면 빈 문장이어야 한다.
      answer = '';
    } finally {
      setStreaming((prev) => ({ ...prev, [n.id]: '' }));
      setBusy(null);
    }
    if (isAiFailure(answer)) {
      setAskFailed((prev) => ({ ...prev, [n.id]: true }));
      return;
    }
    setConvo((prev) => ({ ...prev, [n.id]: [...(prev[n.id] ?? []), { q, a: answer }] }));
    setInput((prev) => ({ ...prev, [n.id]: '' }));
  }

  /**
   * 지금까지의 대화 **전체**를 오답노트 메모로 정리한다. 늘 새로 쓴다.
   *
   * 뒤에 이어 붙이지 않는 이유: 요약은 언제나 대화 전체를 보므로, 붙이면 앞서 쓴 것과
   * 같은 내용이 두 번 쌓인다. 더 물어본 뒤 다시 부르면 그 내용까지 담긴 한 편이 나온다.
   *
   * 대화가 없으면 아무 일도 하지 않는다 — 화면을 벗어나면 대화가 사라지므로
   * 정리 버튼은 대화가 있을 때만 보인다.
   */
  async function summarize(n: WrongNote) {
    const msgs = convo[n.id] ?? [];
    if (msgs.length === 0 || busy) return;
    setBusy(`${n.id}-sum`);
    const text = msgs.map((m) => `질문: ${m.q}\n답변: ${m.a}`).join('\n\n');
    // `ask`와 같은 이유로 `finally`에서 되돌린다 — 예외로 끝나면 정리 버튼이 영구히 꺼졌다.
    let summary = '';
    try {
      summary = await askScodyAIStream(
        WRONG_MEMO_SYSTEM,
        `${wrongCtx(n)}\n\n[대화]\n${text}`,
        () => {},
      );
    } catch {
      summary = '';
    } finally {
      setBusy(null);
    }
    /*
      **저장할 수 없는 문장은 메모로 넣지 않는다.** `askScodyAIStream`은 실패도 문장으로
      돌려주므로 그대로 넣으면 `Scody AI 연결 오류…`가 학생의 오답노트에 남고, 키 없는
      데모 응답은 안내문이 메모가 된다(D-102·D-112).
    */
    if (!isAiSavable(summary)) {
      show('지금은 정리하지 못했어요. 잠시 뒤 다시 해 주세요.', 'removed');
      return;
    }
    const res = await setDig(n.id, summary);
    /*
      대리 보기에서는 `setDig`가 거부된다(D-071). 일어나지 않은 일을 알리지 않는다 —
      알리면 아이콘이 `노트에 정리됐어요`로 바뀌는데 메모는 어디에도 없고, 캡션은 그 오답을
      계속 미정리로 센다.
    */
    if (readOnly) return;
    // 서버가 메모를 받지 못했으면 정리됐다고 말하지 않는다. 대화는 그대로 남아 다시 정리할 수 있다.
    if (!res.ok) {
      show(res.error ?? '정리를 저장하지 못했어요', 'removed');
      return;
    }
    // 아이콘만 바뀌면 저장됐는지 확신이 안 선다. 한 줄로 알린다.
    show('노트에 정리했어요');
  }

  /**
   * 이 문항의 정리를 처음 상태로 되돌린다 — 메모와 대화를 함께 지운다.
   * 메모만 지우고 대화를 남기면 "다시 정리"가 같은 결과를 낼 뿐이라 초기화가 되지 않는다.
   */
  async function resetNote(n: WrongNote) {
    if (busy) return;
    /*
      **대화는 서버가 메모를 지운 뒤에 비운다.**

      예전에는 대화를 먼저 비웠다. 대화는 화면에만 있고(A-031) 되돌릴 수 없어서, 저장이 거부되면
      메모는 그대로인데 대화만 사라졌다 — 다시 정리할 근거가 없어진다. 게다가 다시 정리하는
      버튼들은 `msgs.length > 0`일 때만 보이므로 그 자리에서 다시 시도할 수도 없었다.
    */
    const res = await setDig(n.id, '');
    // 메모 지우기는 대리 보기에서 거부된다(D-071). 아무것도 지우지 않고 아무 말도 하지 않는다.
    if (readOnly) return;
    // 메모가 서버에 남아 있으면 지웠다고 말하지 않는다. 대화는 그대로 남아 다시 정리할 수 있다.
    if (!res.ok) {
      show(res.error ?? '지우지 못했어요', 'removed');
      return;
    }
    setConvo((prev) => ({ ...prev, [n.id]: [] }));
    setStreaming((prev) => ({ ...prev, [n.id]: '' }));
    setInput((prev) => ({ ...prev, [n.id]: '' }));
    setAskFailed((prev) => ({ ...prev, [n.id]: false }));
    show('정리와 대화를 지웠어요', 'removed');
  }

  return (
    <Screen testID="student-notebook" backFallback="/student" title="오답노트">
      <View style={{ gap: 4 }}>
        <AppText variant="body" tone="secondary">
          Scody AI와 이야기하면서 정답이 왜 정답인지, 내가 어디서 잘못 생각했는지 짚어봐요.
        </AppText>
        <AppText variant="caption" tone="tertiary">
          이야기한 내용은 오답노트 메모로 남고, 카드로 모아 다시 공부할 수 있어요.
        </AppText>
      </View>

      {/*
        **필터는 목록보다 먼저, 그리고 목록이 비어도 그린다.**
        예전에는 빈 분기에 필터가 없어서, 문법으로 좁힌 뒤 마지막 문법 오답을 지우면
        `담아 둔 오답이 없어요`만 남고 전체로 돌아갈 길이 화면에서 사라졌다(다른 영역에는
        오답이 남아 있는데도). 화면을 나갔다 들어오는 것이 유일한 탈출구였다.
      */}
      {areas.length > 1 ? (
        <SegmentedControl
          testID="note-area"
          options={areaOptions}
          value={activeArea}
          onChange={setAreaFilter}
        />
      ) : null}

      {wrongNotes.length === 0 ? (
        <EmptyState
          title={activeArea === 'all' ? '담아 둔 오답이 없어요' : `${activeArea} 오답이 없어요`}
          subtitle={
            activeArea === 'all'
              ? '완료한 학습을 열면 틀린 문항을 담을 수 있어요.'
              : '위에서 다른 영역을 골라 볼 수 있어요.'
          }
          action={
            activeArea === 'all' ? (
              <Button
                testID="notebook-go-records"
                label="학습 보러 가기"
                trailing={<Icon name="arrow-right" size={16} color={colors.accentText} />}
                onPress={() => router.push('/student/learn' as never)}
              />
            ) : (
              <Button
                testID="notebook-clear-filter"
                variant="secondary"
                tone="accent"
                label="전체 보기"
                onPress={() => setAreaFilter('all')}
              />
            )
          }
        />
      ) : (
        <>
          <AppText variant="caption" tone="secondary">
            {pending.length > 0
              ? `${wrongNotes.length}개 중 ${pending.length}개는 아직 정리하지 않았어요.`
              : `${wrongNotes.length}개 모두 정리했어요.`}
          </AppText>

          {wrongNotes.map((n) => {
            const msgs = convo[n.id] ?? [];
            const live = streaming[n.id] ?? '';
            const content = n.contentId ? findContent(sets, n.contentId) : undefined;
            return (
              <Section key={n.id} title={n.title}>
                {/*
                  지문은 맨 위 문항만 펼쳐 둔다. 문항마다 다 펼치면 화면이 지문으로 덮여
                  정작 볼 오답이 묻힌다.

                  **`key`에 `firstId`를 넣지 않는다.** 넣으면 첫 문항이 바뀔 때(문항을 지우거나
                  영역을 갈 때) 목록의 **모든** 지문이 새로 마운트돼 학생이 접고 펼쳐 둔 상태가
                  전부 되돌아간다. `defaultOpen`은 첫 마운트에만 쓰이므로, 그 대신 학생이 정한
                  상태를 그대로 남긴다(`review.tsx`와 같은 판단).
                */}
                {content?.passage ? (
                  <Passage
                    key={n.contentId}
                    passage={content.passage}
                    collapsible
                    defaultOpen={n.id === firstId}
                  />
                ) : null}

                {/* 구분선을 카드 끝까지 긋는다. 들여쓰면 입력창 왼쪽 위만 선이 없어 어긋나 보인다. */}
                <Group dividerInset={0}>
                  <View style={{ padding: spacing.lg, gap: 6 }}>
                    {/*
                      **개인 학습 오답과 학원 과제 오답이 한 목록에 섞인다.** 어디서 담은
                      문항인지 손으로 쓴 글이 아니라 `SourceTag`로 말한다(§18).
                    */}
                    <SourceTag source={n.source} />
                    {/*
                      **모바일에서는 아이콘 줄을 발문 아래로 내린다.** 발문 옆에 44px 아이콘이
                      셋이면 390에서 발문에 180px만 남아 넉 줄이 되고, 그 줄 뭉치의 세로 가운데에
                      아이콘이 걸려 스크롤하다 스치면 지우기가 눌렸다.
                    */}
                    <NoteHead
                      prompt={n.prompt}
                      tools={(stacked) => (
                        <>
                          {/*
                            정리는 대화가 있을 때만 할 수 있다. 늘 띄우면 물어보지 않은 문항에서
                            눌러도 아무 일이 없는 죽은 버튼이 된다.
                          */}
                          {msgs.length > 0 ? (
                            <IconButton
                              testID={`summ-${n.qId}`}
                              inset={!stacked}
                              name={n.dig ? 'check-square' : 'file-plus'}
                              active={!!n.dig}
                              label={n.dig ? '노트에 정리됐어요' : '노트에 정리해 두기'}
                              /*
                                정리된 뒤에는 **누르지 않는다.** 이름이 `노트에 정리됐어요`라
                                행동이 아니라 상태로 읽히는데, 누르면 애써 만든 메모를 확인도
                                되돌리기도 없이 새 요약으로 덮어썼다. 다시 정리하는 행동은
                                메모 아래 `다시 정리하기`·`더해서 정리하기`가 이름을 달고 맡는다.
                              */
                              onPress={
                                n.dig ? undefined : () => summarize(n)
                              }
                            />
                          ) : null}
                          <IconButton
                            testID={`note-star-${n.qId}`}
                            inset={!stacked}
                            name="star"
                            active={n.starred}
                            label={n.starred ? '별표 빼기' : '별표 달기'}
                            onPress={() => void star(n)}
                          />
                          {/*
                            지우기는 별표 옆이다(D-033). 누르면 바로 빠지고 알림에서 되돌릴 수 있다.
                            되돌릴 수는 있어도 파괴적 행동이라 4px로 붙이지 않는다.
                          */}
                          <IconButton
                            testID={`del-${n.qId}`}
                            inset={!stacked}
                            name="trash-2"
                            label="이 문항 지우기"
                            onPress={() => void takeOut(n)}
                            style={styles.destructive}
                          />
                        </>
                      )}
                    />
                    <AppText variant="caption" tone="secondary">
                      내 답 · {n.pickedIndex != null ? n.choices[n.pickedIndex] : '없음'}
                    </AppText>
                    <AppText variant="caption" style={{ color: colors.success }}>
                      정답 · {n.choices[n.answerIndex]}
                    </AppText>
                    {/*
                      **학원 과제 오답의 메모는 담당 선생님이 본문까지 읽는다**(D-054).
                      정리하기 전에 알 수 있도록 메모가 아직 없을 때에도 둔다.
                      개인 학습 오답은 어떤 경로로도 학원에 나가지 않으므로 붙이지 않는다.
                    */}
                    {n.source === 'academy' ? (
                      <AppText variant="caption" tone="tertiary" style={styles.notice}>
                        학원 과제에서 담은 오답의 메모는 선생님이 볼 수 있어요.
                      </AppText>
                    ) : null}
                    {/*
                      정리는 몇 초 걸린다. 진행을 버튼 이름에 넣으면 버튼인지 안내인지 알 수 없어
                      캡션으로 둔다(§8). 첫 정리(머리 아이콘)와 다시 정리(아래 버튼)가 같이 쓴다.
                    */}
                    {busy === `${n.id}-sum` ? (
                      <View style={styles.summarizing}>
                        <AppText variant="caption" tone="tertiary">
                          정리하는 중이에요
                        </AppText>
                        <MotionAsset name="pending" testID={`summ-pending-motion-${n.qId}`} />
                      </View>
                    ) : null}
                    {n.dig ? (
                      <View style={{ marginTop: spacing.sm, gap: 4 }}>
                        <AppText
                          variant="caption"
                          tone="accent"
                          style={{ fontFamily: typeface.semibold }}
                        >
                          내 오답노트 메모
                        </AppText>
                        <View testID={`dig-${n.qId}`}>
                          <RichText text={n.dig} />
                        </View>
                        {/* 메모가 있을 때만 쓰는 행동이라 메모 바로 아래에 둔다. */}
                        {msgs.length > 0 ? (
                          <View style={styles.actions}>
                            {/*
                              더 물어본 뒤 누르면 그 내용까지 담긴 한 편으로 다시 쓴다.
                              **노트마다 반복되는 행동이라 기본 `md`(44)다** — `sm`(32)은 섹션
                              제목 옆 전용이다(§8·§10). 라벨은 늘 무엇을 하는지만 말하고,
                              진행은 위 캡션이 알린다.
                            */}
                            <Button
                              testID={`addsum-${n.qId}`}
                              variant="ghost"
                              tone="accent"
                              hug
                              leading={<Icon name="refresh-cw" size={16} color={colors.accent} />}
                              label="추가로 대화한 내용까지 더해서 정리하기"
                              onPress={() => summarize(n)}
                              style={styles.ghostAlign}
                            />
                            {/*
                              되돌릴 수 없다. 테두리 없는 글자로 두면 옆의 `더해서 정리하기`와
                              같은 무게로 읽혀 잘못 눌린다 — 색과 확인 단계로 갈라 둔다.
                            */}
                            <Button
                              testID={`resum-${n.qId}`}
                              variant="secondary"
                              tone="danger"
                              hug
                              leading={<Icon name="trash-2" size={16} color={colors.danger} />}
                              label="정리와 대화 지우기"
                              onPress={() => setConfirmReset(n.id)}
                            />
                          </View>
                        ) : null}
                        {confirmReset === n.id ? (
                          <ConfirmStep
                            message="정리한 메모와 지금까지의 대화가 함께 지워져요. 되돌릴 수 없어요."
                            confirmLabel="지우기"
                            confirmTestID={`resum-confirm-${n.qId}`}
                            confirmAccessibilityLabel="정리와 대화 지우기"
                            confirmIcon="trash-2"
                            destructive
                            onCancel={() => setConfirmReset(null)}
                            onConfirm={() => {
                              void resetNote(n);
                              setConfirmReset(null);
                            }}
                          />
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </Group>

                {/*
                  대화가 위, 입력창이 아래다. 챗 서비스처럼 방금 쓴 말 바로 아래에서
                  이어 쓰게 된다. 대화가 없어도 카드를 띄워 물어볼 곳을 늘 열어 둔다.
                */}
                <Group dividerInset={0}>
                  {msgs.map((m, i) => (
                    <View key={i} style={{ padding: spacing.lg, gap: 6 }}>
                      <AppText variant="caption" tone="tertiary">
                        나
                      </AppText>
                      <AppText style={styles.body}>{m.q}</AppText>
                      <AppText
                        variant="caption"
                        tone="accent"
                        style={{ fontFamily: typeface.semibold, marginTop: 4 }}
                      >
                        Scody AI
                      </AppText>
                      <RichText text={m.a} />
                    </View>
                  ))}
                  {/*
                    **첫 조각이 오기 전에도 그린다.** 예전에는 `live`가 빈 문자열인 동안 아무것도
                    없어서, 보낸 뒤 몇 초간 바뀌는 것이 보내기 버튼 배경 하나였다 —
                    안 보내진 줄 알고 다시 누른다. 대화 화면과 같은 방식이다(§17-1).
                  */}
                  {busy === n.id || live ? (
                    <View style={{ padding: spacing.lg, gap: 6 }} testID={`stream-${n.qId}`}>
                      <AppText
                        variant="caption"
                        tone="accent"
                        style={{ fontFamily: typeface.semibold }}
                      >
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
                          <MotionAsset name="pending" testID={`ask-pending-motion-${n.qId}`} />
                        </View>
                      )}
                    </View>
                  ) : null}
                  {/* 개발자용 오류 문구를 학생 화면에 내보내지 않는다(§19). 쓴 질문은 그대로 남는다. */}
                  {askFailed[n.id] ? (
                    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
                      <AppText testID={`ask-failed-${n.qId}`} variant="caption" tone="danger">
                        지금은 답하지 못했어요. 잠시 뒤 다시 물어봐 주세요.
                      </AppText>
                    </View>
                  ) : null}
                  <AskField
                    flat
                    testID={`ask-${n.qId}`}
                    sendTestID={`send-${n.qId}`}
                    accessibilityLabel="오답 질문 입력"
                    value={input[n.id] ?? ''}
                    onChangeText={(v) => setInput((prev) => ({ ...prev, [n.id]: v }))}
                    onSubmit={() => ask(n)}
                    /*
                      **한 번에 한 문항만 부른다**(`busy`는 전역 하나다). 그래서 작업 중에는
                      모든 보내기 버튼을 함께 끈다 — 예전에는 작업 중인 문항만 꺼져서, 다른
                      문항의 버튼은 눌리는 모양인데 `ask()`가 첫 줄에서 조용히 되돌아갔다(A-034).
                      진행은 작업 중인 문항 카드 안에 표시된다.
                    */
                    busy={!!busy}
                    placeholder={
                      msgs.length > 0 ? '이어서 물어보세요' : '왜 이 선지를 골랐는지 써보아요.'
                    }
                  />
                </Group>
              </Section>
            );
          })}

          {/*
            맨 아래: 오답노트 마무리.
            **집계는 필터와 무관한 전체(`pendingAll`)로 낸다.** 지금 보고 있는 영역만 세면
            흐름의 마지막 문장이 남은 오답을 감춘다. 영역을 다 끝냈으면 그것도 함께 말한다.
          */}
          {wrapUp ? (
            <Group>
              <View style={{ padding: spacing.lg, gap: spacing.xs }}>
                {pendingAll.length === 0 ? (
                  <AppText variant="label">오답을 모두 정리했어요.</AppText>
                ) : activeArea !== 'all' && pending.length === 0 ? (
                  <>
                    <AppText variant="label">{activeArea} 오답은 다 정리했어요.</AppText>
                    <AppText variant="caption" tone="secondary">
                      다른 영역에 {pendingAll.length}개 남아 있어요.
                    </AppText>
                  </>
                ) : (
                  <>
                    <AppText variant="label">
                      오답노트를 안 한 문제들이 있어요. 나중에 오답노트 하시겠어요?
                    </AppText>
                    <AppText variant="caption" tone="secondary">
                      {pendingAll.length}개가 남아 있어요. 지금 나가도 오답은 그대로 남아 있어요.
                    </AppText>
                  </>
                )}
              </View>
              {/*
                **답이 둘인 질문이라 버튼을 늘어놓지 않고 카드 안 목록으로 둔다**
                (`ActionBar` 규칙 3). 둘 다 위 물음에 대한 답이라 화면 아래 행동 줄로 내려가면
                무엇에 답하는 것인지 사라진다. 여기 남는 답이 먼저, 나가는 답이 뒤다.
                chevron은 화면을 떠나는 줄에만 둔다 — `더 정리할게요`는 이 화면에 남는다.
              */}
              <Row
                testID="wrapup-continue"
                title="더 정리할게요"
                onPress={() => setWrapUp(false)}
              />
              <Row
                testID="wrapup-later"
                title={pendingAll.length > 0 ? '나중에 할게요' : '학습 보러 가기'}
                subtitle={pendingAll.length > 0 ? '학습 화면으로 가요' : undefined}
                showChevron
                onPress={() => router.push('/student/learn' as never)}
              />
            </Group>
          ) : (
            <ActionBar>
              <Button
                testID="notebook-wrapup"
                label="오답노트 마무리하기"
                onPress={() => setWrapUp(true)}
              />
            </ActionBar>
          )}
        </>
      )}

      {recommendations.length > 0 ? (
        <Section title="이 유형 더 풀어볼까요?">
          <AppText variant="caption" tone="secondary">
            담아 둔 오답과 같은 유형의 개인 학습이에요.
          </AppText>
          <Group>
            {recommendations.map((r) => (
              <Row
                key={r.item.id}
                testID={`notebook-reco-${r.item.id}`}
                title={r.item.title}
                subtitle={r.reason}
                meta={`${r.item.questionCount}문항`}
                onPress={() => router.push(`/student/${r.item.id}` as never)}
                trailing={
                  <IconButton
                    testID={`reco-queue-${r.item.id}`}
                    variant="outlined"
                    role="checkbox"
                    name={isQueued(r.item.id) ? 'check' : 'plus'}
                    active={isQueued(r.item.id)}
                    label={isQueued(r.item.id) ? '담아 둔 학습에서 빼기' : '담아 두기'}
                    size={18}
                    onPress={() => void toggleQueue(r.item)}
                  />
                }
              />
            ))}
          </Group>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** 정리 진행 캡션 + 대기 표시가 한 줄에 선다. 줄 높이는 캡션이 정한다. */
  summarizing: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  /*
    메모 아래 보조 행동. 둘 다 44px이고 좁은 컬럼에서는 줄바꿈한다.
    상쇄 마진은 **행이 아니라 ghost 버튼에** 둔다(`ghostAlign`) — 행에 두면 줄바꿈한 둘째 줄의
    `secondary` 테두리가 카드 안쪽 여백을 넘어 카드 선에 닿는다.
  */
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  // ghost 버튼의 좌우 패딩을 상쇄해 글자를 메모와 같은 선에 맞춘다.
  ghostAlign: { marginLeft: -spacing.lg },
  /*
    발문과 아이콘 줄. 넓은 컬럼에서는 한 줄로 두고 **아이콘을 첫 줄에 고정한다**
    (`flex-start`) — 발문이 여러 줄이 되면 세로 가운데의 아이콘이 글 옆에 붕 뜬다.
  */
  noteHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  // 모바일: 발문이 전폭을 쓰고 아이콘은 아래 줄로 내려간다.
  noteHeadStack: { gap: spacing.xs },
  grow: { flex: 1 },
  // 정리·별표·지우기(§17이 정한 순서). 손가락으로 눌러도 될 만큼 넓히되 테두리는 두지 않는다.
  noteTools: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  /*
    아래 줄로 내려간 아이콘 줄. `inset`을 쓰지 않아 44px 높이가 그대로 서고,
    첫 아이콘의 글리프를 발문 왼쪽 선에 맞춘다(44px 버튼 안에서 글리프는 14px 안쪽).
  */
  noteToolsStack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    marginLeft: -spacing.md,
    marginVertical: -spacing.xs,
  },
  // 파괴적 행동은 옆 아이콘과 떼어 둔다. 스치듯 눌리면 안 된다.
  destructive: { marginLeft: spacing.sm },
  // 한 줄 고지·진행 안내. 위 값들과 붙지 않게 한 칸 띄운다.
  notice: { marginTop: spacing.xs },
  body: {
    fontFamily: typeface.regular,
    color: colors.ink,
    fontSize: font.size.base,
    lineHeight: font.size.base * font.lineHeight.relaxed,
  },
});
