import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import {
  ActionBar,
  Screen,
  Section,
  Group,
  Button,
  SegmentedControl,
  Icon,
  IconButton,
  ScoreCard,
  SourceTag,
  QuestionReview,
  Row,
  AppText,
} from '@/components';
import { useSession } from '@/session';
import { byDue, useQueuedItems, useStudentItems } from '@/features/learning';
import { useContent } from '@/features/content';
import { useProgress, type PerQuestion } from '@/features/progress';
import { ACADEMY_MEMO_NOTICE } from '@/features/review';
import { useRecommendations } from '@/features/recommend';
import { useToast } from '@/features/toast';
import { findContent, type LearningItem } from '@/data';
import { colors, spacing } from '@/theme/tokens';

/** 한 화면 목록 상한(§8). 그 이상은 섹션 제목 옆 `N개 더 보기`로 펼친다. */
const PREVIEW = 5;

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

/**
 * 제출 결과: 정답률·걸린 시간 + 문항별 정오·해설 + 오답노트 담기.
 * 문항 리뷰는 기본이 '틀린 문항'이다. 다 맞은 문항까지 열 필요는 없고, 필요하면 토글로 전체를 본다.
 *
 * 정오와 고른 답은 **저장된 채점 결과**(`attempt.perQuestion`)에서 읽는다. 세션 답안(`answers`)은
 * 로그인마다 비어서, 이 세션에서 직접 풀지 않은 기록을 열면 전 문항이 오답으로 보였다.
 * 학부모 상세(`app/parent/attempt.tsx`)가 같은 데이터를 읽는 방식과 맞춘다.
 */
export default function ResultScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { readOnly } = useSession();
  const { all } = useStudentItems();
  /** 담아 둔 순서대로 이어 풀 수 있게 — 홈 히어로와 **같은 후보 집합**을 쓴다(D-140 · D-170). */
  const queued = useQueuedItems();
  const {
    sets,
    loading: contentLoading,
    loaded: contentLoaded,
    error: contentError,
    reload: reloadContent,
  } = useContent();
  const {
    attempts,
    addWrongNote,
    addWrongNotes,
    removeWrongNote,
    hasNote,
    wrongNotes,
    addToQueue,
    removeFromQueue,
    isQueued,
    loading: progressLoading,
    loaded: progressLoaded,
    error: progressError,
    reload: reloadProgress,
  } = useProgress();
  // 오답노트에 담은 문항을 근거로 다음에 풀 학습을 고른다. 담긴 오답이 없으면 비어 있다.
  const recommendations = useRecommendations(2);
  const [scope, setScope] = useState<'wrong' | 'all'>('wrong');
  const [showAllQuestions, setShowAllQuestions] = useState(false);
  /** 일괄 담기가 도는 중. 여러 번 부르면 같은 문항을 두 번 담으려 해서 유니크에 걸린다. */
  const [busyAll, setBusyAll] = useState(false);
  const { show } = useToast();

  const item = all.find((i) => i.id === id);
  const content = item ? findContent(sets, item.contentId) : undefined;
  const attempt = id ? attempts[id] : undefined;

  /*
    **읽는 중 · 실패 · 없는 기록을 셋으로 가른다.** 학습·콘텐츠·풀이 기록은 세 조회에서 오고,
    첫 조회가 끝나기 전에는 셋 다 비어 있다 — 그 창에 `결과를 찾지 못했어요`를 그리면 결과
    주소로 바로 들어온 학생에게 없는 기록을 없다고 단정한다
    (다른 화면과 같은 규칙 — `app/admin/content/[id].tsx`).

    조회가 **실패해도** 같은 문장이 나왔다(M-DB-16). 못 읽은 것과 없는 것은 다르다 —
    없다고 하면 학생은 방금 푼 기록이 사라졌다고 믿는다.
  */
  /*
    **게이트는 첫 조회에만 건다**(A-126 · D-168). provider의 `loading`은 `reading || !loaded`라
    **재조회마다** 참이 되고, 쓰기가 실패하면 `reload()`가 돈다 — 그때 손에 있는 목록이 사라진다.
    `loaded`(첫 조회가 끝났는지)를 보면 그 창에서 화면이 그대로 남는다. 실패했을 때 개수를 세지
    않고 `없어요`도 말하지 않는 것은 D-136 그대로다.
  */
  const reading = !progressLoaded || !contentLoaded;
  /**
   * **다시 조회가 도는 중**(첫 조회가 아니다). 실패 줄의 버튼이 그 사이 라벨로 진행을 말한다 —
   * 언마운트하면 웹에서 포커스가 `<body>`로 떨어진다(A-130).
   */
  const retrying = (progressLoading || contentLoading) && !reading;
  /** 조회 실패 문장. 다시 읽는 중에는 감춘다. */
  const loadError = reading ? null : (progressError ?? contentError);

  /** 두 조회를 함께 다시 시도한다. */
  async function retryLoad() {
    await Promise.all([reloadProgress(), reloadContent()]);
  }

  if (!item || !content || !attempt) {
    return (
      <Screen
        testID="student-result"
        /*
          **상태가 무엇이든 되돌아갈 길을 둔다**(`CLAUDE.md` 내비게이션 규칙). 성공 경로에만
          `backFallback`이 있어서, 결과 주소로 바로 들어왔거나 조회가 계속 실패하는 학생은
          화면 안에서 나가는 장치를 못 봤다 — 같은 URL이 상태에 따라 뒤로가기를 보였다 감췄다 했다.
        */
        backFallback="/student"
        title={
          reading
            ? '결과를 불러오고 있어요'
            : loadError
              ? '결과를 불러오지 못했어요'
              : '결과를 찾지 못했어요'
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
                testID="result-load-retry"
                /* 라벨이 진행을 말한다 — 버튼을 지우면 포커스가 사라진다(A-130 · `LoadFailed`와 같은 방법). */
                label={retrying ? '다시 불러오고 있어요' : '다시 불러오기'}
                onPress={() => {
                  if (retrying) return;
                  void retryLoad();
                }}
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

  const indexed = attempt.perQuestion.map((q, i) => ({ q, i }));
  const wrong = indexed.filter(({ q }) => !q.correct);
  /**
   * 아직 담지 않은 오답. **한 번만 센다.**
   *
   * 예전에는 같은 식(`wrong.filter(hasNote)`)이 렌더 본문과 `addAllWrong`에 각각 있었다.
   *
   * `useMemo`를 쓰지 않는다 — 이 자리는 이른 return(`if (!item || !content || !attempt)`) 뒤라
   * 훅을 조건부로 부르게 된다. 바로 위 `indexed`·`wrong`도 같은 이유로 메모가 없다.
   *
   * 비용은 감당된다. `hasNote`는 `wrongNotes`를 훑는 선형 검사이므로 25문항 × 노트 300개면
   * 7,500회 비교이고, 이 화면의 로컬 상태는 `scope`·`showAllQuestions`·`busyAll` 셋뿐이라
   * 리렌더가 잦지 않다(입력창도 스트리밍도 없다). 줄여야 할 때 고칠 자리는 이 호출부가 아니라
   * `hasNote`다 — provider가 `${qId}|${itemId}` 집합을 들면 여기와 줄마다의 검사가 함께 O(1)이
   * 된다.
   */
  const unsaved = wrong.filter(({ q }) => !hasNote(q.qId, item.id));
  // 다 맞았으면 고를 것이 없으니 전체를 보여준다.
  const effectiveScope = wrong.length === 0 ? 'all' : scope;
  const listed = effectiveScope === 'wrong' ? wrong : indexed;
  /**
   * 문항 리뷰도 §8의 5줄 상한을 지킨다(M9-11 ③ → D-144).
   *
   * `QuestionReview`는 발문 + 내 답 + 정답 + 해설이 든 큰 덩어리라 다섯 개만으로도
   * 화면 몇 개 길이가 된다. 상한이 없을 때는 이 섹션이 길어질수록 **아래 두 섹션이
   * 함께 밀려서**, 방금 담을 오답과 `질문하고 메모하기`가 화면 밖으로 나갔다(A-086).
   * 필터를 바꿔도 접힘 상태는 그대로 둔다 — 학생이 펼친 선택을 되감지 않는다.
   */
  const visibleListed = showAllQuestions ? listed : listed.slice(0, PREVIEW);

  /**
   * 다음에 풀 학습. 후보와 순서는 **홈 히어로와 같다**(D-140): 담아 둔 학습 → 남은 학원 과제
   * (마감이 이른 것부터). 공개 카탈로그는 후보가 아니다 — 학생이 고른 적도, 누가 시킨 적도
   * 없는 항목을 다음 할 일로 올리지 않는다. 비슷한 유형 추천은 위 섹션이 맡는다.
   *
   * **방금 푼 학습은 뺀다.** 개인 학습은 제출하면 서버가 담아 둔 목록에서 지우고
   * (`rpc_submit_attempt`) 학원 과제는 `status`가 `done`이 되지만, 조회가 아직 도착하지 않은
   * 창에서는 둘 다 남아 있어 `다음 학습`이 방금 낸 것을 가리킬 수 있다.
   */
  const nextItem =
    queued.items.find((i) => i.id !== item.id) ??
    all
      .filter((i) => i.source === 'academy' && i.status !== 'done' && i.id !== item.id)
      .sort(byDue)[0];

  /**
   * 추천 학습 담기/빼기. 오답노트 문항 담기와 문구를 구분한다.
   * **서버가 받아 준 다음에 알린다** — 먼저 알리면 저장되지 않아도 담았다고 말한다.
   */
  async function toggleQueue(target: LearningItem) {
    const on = !isQueued(target.id);
    const res = on ? await addToQueue(target) : await removeFromQueue(target.id);
    // 대리 보기에서는 쓰기가 거부된다(D-071). 일어나지 않은 일을 알리지 않는다.
    if (readOnly) return;
    if (!res.ok) {
      show(res.error ?? (on ? '담아 두지 못했어요' : '빼지 못했어요'), 'removed');
      return;
    }
    show(on ? '학습을 담아 뒀어요' : '담아 둔 학습에서 뺐어요', on ? 'added' : 'removed');
  }

  /**
   * 담기/빼기 토글. 담긴 문항을 다시 누르면 노트에서 빠진다.
   * 발문·선지·고른 답은 저장된 채점 결과를 그대로 옮긴다 — 학생이 푼 시점의 문항이 노트에 남는다.
   *
   * **서버가 받아 준 뒤에 알린다.** 결과를 보지 않고 알렸을 때는 RLS가 거부해도 화면이
   * `담았어요`라고 말하고, 오답노트를 열면 그 문항이 없었다.
   */
  async function toggleNote(target: PerQuestion) {
    /*
      **이 학습에서 담은 노트만 찾는다**(A-085). 문항 id 하나로 찾으면 같은 문항을 학원 배정에서
      담아 둔 경우 그 노트를 지우게 된다 — 선생님이 보고 있던 값이다(D-054).
    */
    const note = wrongNotes.find((n) => n.qId === target.qId && n.itemId === item!.id);
    if (note) {
      const removed = await removeWrongNote(note.id);
      if (readOnly) return;
      show(
        removed.ok ? '오답노트에서 뺐어요' : (removed.error ?? '오답노트에서 빼지 못했어요'),
        'removed',
      );
      return;
    }
    // 발문·선지는 저장하지 않는다 — 문항을 가리키기만 하고 본문은 서버에서 join으로 온다.
    const added = await addWrongNote({
      questionId: target.qId,
      contentId: content!.id,
      source: item!.source,
      assignmentId: item!.source === 'academy' ? item!.id : undefined,
      pickedIndex: target.pickedIndex,
    });
    if (readOnly) return;
    if (!added.ok) {
      show(added.error ?? '오답노트에 담지 못했어요', 'removed');
      return;
    }
    /*
      **되살린 것을 담았다고 말하지 않는다.** 예전에 담아 두었던 문항이면 서버가 스케줄을 그대로
      보존하고 되살린다(D-033의 "없던 일") — 그 사실을 모른 학생은 오늘 복습에 나오리라
      기대하지만 몇 주 뒤 차례일 수 있다. 서버가 `restored`로 알려 주는데 그것을 버리고 있었다.

      새로 담은 것은 첫 차례가 내일이다(틀린 직후 같은 세션 재시험은 근거가 없다). 그 사실을
      담는 순간 말하지 않으면 담은 날과 다음 날 사이가 비어 있는 것으로 읽힌다.
    */
    show(added.restored ? '오답노트에 다시 담았어요' : '오답노트에 담았어요. 내일 다시 만나요');
  }

  /**
   * 틀린 문항을 한 번에 담는다.
   *
   * **문항당 1클릭이 유일한 길이었다.** 열 문항 중 일곱을 틀린 학생은 오답노트로 넘어가기 전에
   * 일곱 번 눌러야 했고, 여기서 담지 않은 오답은 기록 탭에서 이 결과를 다시 열지 않으면 다시
   * 담을 길이 없었다(그 경로는 이 화면에서 안내되지 않는다).
   *
   * **이미 담은 것은 건드리지 않는다.** 토글이 아니라 담기만 하는 행동이다 — 한 번 더 누르면
   * 방금 담은 것이 전부 빠지는 버튼은 되돌리기 없이 파괴적이다(D-033).
   *
   * 하나라도 실패하면 몇 개가 담겼는지 그대로 말한다. 부분 성공을 전체 성공으로 말하지 않는다.
   */
  async function addAllWrong() {
    if (busyAll) return;
    // 버튼을 세운 목록과 보내는 목록이 같아야 한다 — 이름을 하나 더 두면 갈라질 자리가 생긴다.
    const targets = unsaved;
    if (targets.length === 0) return;
    setBusyAll(true);
    /*
      **한 번에 보내고 재조회는 한 번이다.** 루프에서 `addWrongNote`를 부르면 항목마다 전체
      재조회가 돌아 오답 7개에 요청 63개·순차 14단계가 됐고 그중 56개는 직전과 같은 값을 다시
      읽었다. 사용자에게는 그 시간만큼 버튼이 `담는 중이에요`로 서 있는 것으로 보인다.
    */
    /*
      **개수가 없는 결과가 실재한다.** provider가 예외를 잡은 갈래는 `{ ok: false, error }`만
      돌려주므로 기본값을 여기서 정한다 — 없는 값을 `undefined > 0`으로 물으면 실패가 아래
      성공 문장으로 빠져나가 `undefined개를 담았어요`가 된다.
    */
    const { added = 0, failed = targets.length } = await addWrongNotes(
      targets.map(({ q }) => ({
        questionId: q.qId,
        contentId: content!.id,
        source: item!.source,
        assignmentId: item!.source === 'academy' ? item!.id : undefined,
        pickedIndex: q.pickedIndex,
      })),
    );
    setBusyAll(false);
    if (readOnly) return;
    if (failed > 0) {
      show(
        added > 0
          ? `${added}개를 담았어요. ${failed}개는 담지 못했어요.`
          : '오답노트에 담지 못했어요',
        'removed',
      );
      return;
    }
    show(`${added}개를 오답노트에 담았어요`);

  }

  return (
    <Screen
      testID="student-result"
      backFallback="/student"
      /*
        `eyebrow`는 대문자 변환 + 넓은 자간의 라틴 전용 변형이라 한글이 뜻 없이 벌어지고
        `tertiary`(3.23:1)로 그려진다(§4). 완료의 순간을 가장 흐린 글자로 두지 않는다.
      */
      title={item.title}
      lead="다 풀었어요."
    >
      {/* 개인 학습과 학원 과제를 결과에서도 구분한다(§18). 홈·풀이 화면과 같은 자리다. */}
      <SourceTag source={item.source} />

      <ScoreCard
        rate={attempt.accuracy}
        detail={`${attempt.total}문항 중 ${attempt.correct}문항 정답`}
      />

      <Group>
        {/* 값은 `trailing`에 둔다. `meta`는 `inkTertiary`(3.23:1, AA 미달)라 값을 담지 않는다(§8). */}
        <Row
          title="걸린 시간"
          trailing={<AppText variant="label">{fmtTime(attempt.timeSec)}</AppText>}
        />
        {/* 영역은 값이 아니라 분류라서 `meta`가 맞다. */}
        <Row title="영역" meta={`국어 · ${item.area}`} />
      </Group>

      <Section
        title="문항별로 확인해요"
        /* `N개 더 보기`는 섹션 제목 옆 R2 한 벌이다(§8) — 리포트의 `report-more`와 같은 모양. */
        action={
          listed.length > PREVIEW ? (
            <Button
              testID="result-review-more"
              variant="secondary"
              size="sm"
              tone="accent"
              hug
              label={showAllQuestions ? '접기' : `${listed.length - PREVIEW}개 더 보기`}
              onPress={() => setShowAllQuestions((v) => !v)}
            />
          ) : null
        }
      >
        {wrong.length > 0 ? (
          <SegmentedControl
            testID="result-scope"
            options={[
              { value: 'wrong', label: `틀린 문항 ${wrong.length}` },
              { value: 'all', label: `전체 ${indexed.length}` },
            ]}
            value={effectiveScope}
            onChange={setScope}
          />
        ) : (
          <AppText variant="caption" tone="secondary">
            모두 맞혔어요. 해설로 한 번 더 확인해 볼까요?
          </AppText>
        )}
        <Group>
          {visibleListed.map(({ q, i }) => (
            <QuestionReview
              key={q.qId}
              index={i}
              /* 해설은 콘텐츠에만 있다. 저장된 풀이 기록에는 담기지 않는다. */
              question={{
                id: q.qId,
                prompt: q.prompt,
                choices: q.choices,
                answerIndex: q.answerIndex,
                explanation: content.questions.find((x) => x.id === q.qId)?.explanation,
              }}
              pickedIndex={q.pickedIndex}
              correct={q.correct}
            />
          ))}
        </Group>
      </Section>

      {wrong.length > 0 ? (
        <Section
          title="오답노트할 문제 담기"
          /*
            오답노트로 가는 길은 **이 섹션에 딸린 행동**이라 제목 오른쪽에 둔다
            (`ActionBar` 규칙 3). 화면 아래 행동 줄에 두면 방금 담은 문항들과 멀어져
            무엇을 가지고 가는 것인지 사라진다.
            화살표는 붙이지 않는다 — 담은 것을 어디서 보는지 알려 주는 옆길이지 이 화면을
            끝내는 행동이 아니다(학습 탭 오답노트 섹션의 같은 버튼과 같은 자리·같은 규칙).
            **이름은 `질문하고 메모하기` 하나다**(D-150) — 예전 `오답노트 하러 가기`는 같은
            목적지로 가는 두 번째 이름이었고, 이 섹션 제목이 이미 `오답노트`를 말한다.
          */
          action={
            <Button
              testID="result-notebook"
              variant="secondary"
              size="sm"
              tone="accent"
              hug
              label="질문하고 메모하기"
              accessibilityLabel="오답노트에서 질문하고 메모하기"
              onPress={() => router.push('/student/notebook' as never)}
            />
          }
        >
          <AppText variant="caption" tone="secondary">
            담아 두면 오답노트에서 Scody AI와 함께 다시 볼 수 있어요.
          </AppText>
          {/*
            **아직 담지 않은 것이 둘 이상일 때만 둔다.** 하나뿐이면 그 줄의 토글을 누르는 것과
            같은 수의 클릭이라 버튼이 늘어난 것 말고는 달라지는 것이 없다(§8 — 죽은 컨트롤을
            만들지 않는다). 전부 담았으면 누를 대상이 없다.

            **이 섹션에 딸린 행동이라 제목 옆이 아니라 목록 위에 둔다.** 제목 옆은 이미
            `질문하고 메모하기`(다른 화면으로 가는 길)가 쓰고 있고, 둘을 나란히 두면 어느 것이
            지금 할 일인지 흐려진다.

            진행은 라벨로 말하고 버튼을 언마운트하지 않는다 — 웹에서 포커스된 요소가 사라지면
            `<body>`로 떨어진다(A-130).
          */}
          {unsaved.length > 1 ? (
            <Button
              testID="result-note-all"
              variant="secondary"
              tone="accent"
              hug
              label={busyAll ? '담는 중이에요' : '틀린 문항 모두 담기'}
              onPress={() => void addAllWrong()}
            />
          ) : null}
          {/*
            **알리는 시점이 담기 뒤가 아니라 앞이어야 한다.** 같은 문장이 오답노트 화면에도
            있지만(D-110) 그때는 이미 담은 뒤다. 무엇이 공개되는지 모른 채 담게 두지 않는다.
            문구는 오답노트와 한 글자도 다르지 않게 쓴다.
          */}
          {item.source === 'academy' ? (
            <AppText variant="caption" tone="secondary">
              {ACADEMY_MEMO_NOTICE}
            </AppText>
          ) : null}
          <Group>
            {/*
              발문만 두면 문법 세트처럼 발문이 같은 문항들이 전부 똑같아 보인다.
              정답 선지를 함께 보여 어느 문제인지 구분되게 한다.
            */}
            {wrong.map(({ q, i }) => (
              <Row
                key={q.qId}
                title={`${i + 1}. ${q.prompt}`}
                subtitle={`정답 · ${q.choices[q.answerIndex]}`}
                trailing={
                  <NoteToggle saved={hasNote(q.qId, item.id)} onPress={() => void toggleNote(q)} qId={q.qId} />
                }
              />
            ))}
          </Group>
        </Section>
      ) : null}

      {recommendations.length > 0 ? (
        <Section title="비슷한 유형으로 이어서 풀어요">
          <AppText variant="caption" tone="secondary">
            {/*
              위쪽에 `SourceTag`가 `학원 과제`라고 붙어 있으면 이 목록도 학원이 더 내준 것처럼
              읽힌다. 추천 후보는 개인 학습뿐이므로(`recommend.ts`) 그 사실을 문장으로 밝힌다 —
              오답노트 화면과 같은 문장이다(§18).
            */}
            오답노트에 담은 문항과 같은 유형의 개인 학습이에요. 담아 두면 나중에 이어서 풀 수
            있어요.
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

      {/*
        **이 학습으로 돌아가는 길은 줄 하나다.** 끝 행동이 `홈으로 갈게요` 하나였을 때, 방금 푼
        학습을 다시 풀려면 홈 → 학습 탭 → 목록에서 그 학습을 다시 찾아야 했다.
        확인 단계는 상세가 이미 갖고 있으므로(`app/student/[id].tsx`의 `ConfirmStep`) 여기서는
        그 화면으로 보내기만 한다 — 결과 화면이 재풀이 확인까지 안고 있을 이유는 없고,
        기록이 바뀐다는 고지도 한곳에만 있어야 한다.
        **바로 화면을 여는 줄이라 chevron을 둔다**(§8).
      */}
      <Group>
        <Row
          testID="result-retry"
          title="다시 풀기"
          subtitle="기록이 바뀌기 전에 한 번 더 물어봐요"
          showChevron
          onPress={() => router.push(`/student/${item.id}` as never)}
        />
      </Group>

      {/*
        화면을 끝내는 행동 하나만 남긴다. 오답노트로 가는 길은 그 문항들이 있는 섹션 제목 옆으로
        올라갔다 — 여기 나란히 두면 둘 다 `가기`로 끝나는 버튼이라 어느 것이 이 화면의 끝인지
        모양으로 알 수 없었다.

        **끝 행동은 다음에 할 일이 있으면 그것을 가리킨다.** 담아 둔 순서대로 푸는 학생은
        한 세트마다 `상세 → 풀이 → 결과 → 홈 → 히어로 → 상세`를 돌아 홈을 매번 경유했다.
        후보는 홈 히어로와 같고(위 `nextItem`), 없으면 지금처럼 홈으로 보낸다.
        `testID`는 둘이 같다 — 이 자리의 뜻은 `이 화면을 끝내는 행동`이고, 그것이 어디로 가는지는
        학생의 남은 할 일이 정한다(E2E도 그 자리를 누른다).
      */}
      {nextItem ? (
        <View style={styles.nextBlock}>
          {/*
            무엇을 풀게 되는지 버튼 밖 한 줄로 말한다 — `Button`에는 부제 자리가 없고, 라벨에
            제목을 넣으면 버튼 이름이 학습마다 달라져 같은 행동으로 읽히지 않는다(§8).
            그래서 이름은 `accessibilityLabel`이 지킨다.
            출처는 여기서도 태그다(§18) — 위쪽 태그는 방금 푼 학습, 이 태그는 다음 학습이다.
          */}
          <View style={styles.nextHead}>
            <SourceTag source={nextItem.source} />
            <AppText variant="caption" tone="secondary" style={styles.nextTitle}>
              {nextItem.title}
            </AppText>
          </View>
          <ActionBar>
            <Button
              testID="result-done"
              label="다음 학습 풀기"
              trailing={<Icon name="arrow-right" size={16} color={colors.accentText} />}
              accessibilityLabel={`다음 학습 풀기, ${nextItem.title}`}
              /*
                `replace`다 — 결과 화면이 스택에 쌓이면 다음 학습의 상세에서 뒤로가기가 방금 본
                결과로 돌아온다. `홈으로 갈게요`도 같은 이유로 `replace`였다.
              */
              onPress={() => router.replace(`/student/${nextItem.id}` as never)}
            />
          </ActionBar>
        </View>
      ) : (
        <ActionBar>
          <Button
            testID="result-done"
            label="홈으로 갈게요"
            onPress={() => router.replace('/student' as never)}
          />
        </ActionBar>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  /*
    이름 줄과 행동 줄을 한 덩어리로 묶는다. `Screen`의 컬럼 간격을 그대로 받으면 이름이 위
    섹션에 붙어 무엇에 대한 이름인지 흐려진다 — 음수 마진으로 당기지 않고 덩어리를 만든다.
  */
  nextBlock: { gap: spacing.sm },
  nextHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // 제목이 길면 태그 옆에서 접힌다.
  nextTitle: { flex: 1 },
});

/**
 * 오답노트 담기 토글. 안 담긴 상태는 책갈피, 담긴 상태는 체크로 바뀐다. 다시 누르면 빠진다.
 * 행 전체를 누르게 두면 눌릴 때 배경이 번쩍여서, 누를 곳은 이 버튼 하나로 좁혔다.
 */
function NoteToggle({ saved, onPress, qId }: { saved: boolean; onPress: () => void; qId: string }) {
  return (
    <IconButton
      testID={`note-toggle-${qId}`}
      variant="outlined"
      role="checkbox"
      name={saved ? 'check' : 'bookmark'}
      active={saved}
      label={saved ? '오답노트에서 빼기' : '오답노트에 담기'}
      size={18}
      onPress={onPress}
    />
  );
}

