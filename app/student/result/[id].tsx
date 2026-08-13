import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActionBar,
  Screen,
  Section,
  Group,
  Button,
  SegmentedControl,
  IconButton,
  ScoreCard,
  SourceTag,
  QuestionReview,
  Row,
  AppText,
} from '@/components';
import { useSession } from '@/session';
import { useStudentItems } from '@/features/learning';
import { useContent } from '@/features/content';
import { useProgress, type PerQuestion } from '@/features/progress';
import { useRecommendations } from '@/features/recommend';
import { useToast } from '@/features/toast';
import { findContent, type LearningItem } from '@/data';

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
  const { sets, loading: contentLoading } = useContent();
  const {
    attempts,
    addWrongNote,
    removeWrongNote,
    hasNote,
    wrongNotes,
    addToQueue,
    removeFromQueue,
    isQueued,
    loading: progressLoading,
  } = useProgress();
  // 오답노트에 담은 문항을 근거로 다음에 풀 학습을 고른다. 담긴 오답이 없으면 비어 있다.
  const recommendations = useRecommendations(2);
  const [scope, setScope] = useState<'wrong' | 'all'>('wrong');
  const { show } = useToast();

  const item = all.find((i) => i.id === id);
  const content = item ? findContent(sets, item.contentId) : undefined;
  const attempt = id ? attempts[id] : undefined;

  /*
    **읽는 중과 없는 것을 가른다.** 학습·콘텐츠·풀이 기록은 세 조회에서 오고, 첫 조회가 끝나기
    전에는 셋 다 비어 있다 — 그 창에 `결과를 찾지 못했어요`를 그리면 결과 주소로 바로 들어온
    학생에게 없는 기록을 없다고 단정한다(다른 화면과 같은 규칙 — `app/admin/content/[id].tsx`).
  */
  const reading = progressLoading || contentLoading;

  if (!item || !content || !attempt) {
    return (
      <Screen
        testID="student-result"
        title={reading ? '결과를 불러오고 있어요' : '결과를 찾지 못했어요'}
      >
        {reading ? (
          <Group>
            <Row title="잠시만 기다려 주세요" />
          </Group>
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
  // 다 맞았으면 고를 것이 없으니 전체를 보여준다.
  const effectiveScope = wrong.length === 0 ? 'all' : scope;
  const listed = effectiveScope === 'wrong' ? wrong : indexed;

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
    show('문항을 오답노트에 담았어요');
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

      <Section title="문항별로 확인해요">
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
          {listed.map(({ q, i }) => (
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
            끝내는 행동이 아니다(기록 화면의 `질문하고 메모하기`와 같은 자리·같은 규칙).
          */
          action={
            <Button
              testID="result-notebook"
              variant="secondary"
              size="sm"
              tone="accent"
              hug
              label="오답노트 하러 가기"
              onPress={() => router.push('/student/notebook' as never)}
            />
          }
        >
          <AppText variant="caption" tone="secondary">
            담아 두면 오답노트에서 Scody AI와 함께 다시 볼 수 있어요.
          </AppText>
          {/*
            **알리는 시점이 담기 뒤가 아니라 앞이어야 한다.** 같은 문장이 오답노트 화면에도
            있지만(D-110) 그때는 이미 담은 뒤다. 무엇이 공개되는지 모른 채 담게 두지 않는다.
            문구는 오답노트와 한 글자도 다르지 않게 쓴다.
          */}
          {item.source === 'academy' ? (
            <AppText variant="caption" tone="secondary">
              학원 과제에서 담은 오답의 메모는 선생님이 볼 수 있어요.
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
        화면을 끝내는 행동 하나만 남긴다. 오답노트로 가는 길은 그 문항들이 있는 섹션 제목 옆으로
        올라갔다 — 여기 나란히 두면 둘 다 `가기`로 끝나는 버튼이라 어느 것이 이 화면의 끝인지
        모양으로 알 수 없었다.
      */}
      <ActionBar>
        <Button
          testID="result-done"
          label="홈으로 갈게요"
          onPress={() => router.replace('/student' as never)}
        />
      </ActionBar>
    </Screen>
  );
}

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

