import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import {
  AppText,
  Button,
  Group,
  LearningRow,
  LoadFailed,
  Row,
  Screen,
  Section,
} from '@/components';
import { useContent } from '@/features/content';
import { useProgress } from '@/features/progress';
import { todayISO } from '@/features/clock';
import { DAILY_CAP, scopedDeck, soonestDueDays, todayCount } from '@/features/review';
import { useStudentItems, useQueuedItems, byTodoThenDue } from '@/features/learning';
import { useCurrentAccount, useSession } from '@/session';
import { spacing } from '@/theme/tokens';

/**
 * 미리보기는 세 줄까지. 나머지는 더 보기·전체 목록으로 넘긴다.
 * 다섯 줄이면 두 섹션만으로 화면이 차서 이 탭의 주요 행동(고르러 가기)이 화면 밖으로 밀렸다.
 */
const PREVIEW = 3;

/**
 * 학습 탭. 이 화면은 "무엇을 할 수 있는지"만 보여 주고 고르는 일은 넘긴다.
 *
 * 순서: 학원 학습 → 개인 학습 → 오답노트.
 * 학원 과제는 남이 정해 준 일이라 먼저, 내가 새로 고르는 것이 그다음, **이미 푼 것을 다시
 * 하는 일이 마지막**이다(D-130). 담아 둔 학습은 개인 학습 안에 있다(D-047).
 * 학년·영역·유형 드릴다운은 `/student/pick`으로 옮겼다 — 탭을 열자마자 카테고리가
 * 펼쳐져 있으면 이 화면이 무엇을 위한 곳인지 읽히지 않는다.
 */
export default function StudentLearn() {
  const router = useRouter();
  const { academy, hasPersonal } = useStudentItems();
  const queued = useQueuedItems();
  const {
    wrongNotes,
    noteReviews,
    loading: progressLoading,
    loaded: progressLoaded,
    error: progressError,
    reload: reloadProgress,
  } = useProgress();
  const {
    loading: contentLoading,
    loaded: contentLoaded,
    error: contentError,
    reload: reloadContent,
  } = useContent();
  const [showAllAcademy, setShowAllAcademy] = useState(false);
  const account = useCurrentAccount();
  const { academyLinked } = useSession();
  const academyPaid = !!account.academyName && academyLinked;
  /**
   * 학원 소속이 있는 학생에게만 학원 섹션을 둔다 — 없는 소속을 있는 것처럼 말하지 않는다(D-031).
   * 소속은 있고 배정만 없는 학생에게는 빈 안내가 사실이므로 그대로 남긴다.
   * 기준은 `academyPaid`가 아니라 소속(`academyName`)이다. 연결을 끊은 학생도
   * 학원 얘기를 하던 학생이라 "받은 학습이 없어요"까지는 알려 줘야 한다.
   */
  const inAcademy = !!account.academyName;

  /*
    **읽는 중 · 실패 · 빈 목록을 셋으로 가른다.** 배정은 학습 기록 조회에서, 문항 수·영역은
    콘텐츠 조회에서 온다. 첫 조회가 끝나기 전에는 `academy`가 비어 있어서 소속이 있는 학생에게
    `아직 학원에서 받은 학습이 없어요.`를 먼저 보여 준다(D-133).

    조회가 **실패해도** 그 문장이 나왔다 — `loading`이 내려가기 때문이다(M-DB-16).
    이제 두 provider가 `error`를 내보내므로 실패는 실패라고 말하고 다시 시도할 행동을 둔다.
    홈과 같은 규칙이다(`app/student/index.tsx`).
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
  /** 조회 실패 문장. 다시 읽는 중에는 감춘다(홈과 같다 — 실패와 로딩을 함께 세우지 않는다). */
  const loadError = reading ? null : (progressError ?? contentError);

  /** 두 조회를 함께 다시 시도한다. */
  async function retryLoad() {
    await Promise.all([reloadProgress(), reloadContent()]);
  }

  const hasQueue = queued.items.length > 0;

  /**
   * 각 줄이 실제로 열 덱. **줄에 적는 개수와 덱 개수가 같아야 한다.**
   *
   * 범위 덱은 오늘 이미 본 것과 쉬는 것을 뺀다(서버가 그 노트의 복습을 받지 않는다). 그러지
   * 않으면 `오답 60개`를 누른 학생이 `모두 55개`를 받고 왜 다른지 알 길이 없다.
   */
  /** 이 렌더의 기준일. 네 계산이 같은 날을 봐야 한다(오답노트와 같은 형태). */
  const today = todayISO();
  const allDeck = useMemo(
    () => scopedDeck(wrongNotes, noteReviews, {}, today),
    [wrongNotes, noteReviews, today],
  );
  const starredDeck = useMemo(
    () => scopedDeck(wrongNotes, noteReviews, { onlyStarred: true }, today),
    [wrongNotes, noteReviews, today],
  );
  /** 화면이 말하는 오늘 개수. 상한이 적용된 값이다(밀린 것을 앞세우지 않는다). */
  const today0 = useMemo(() => todayCount(wrongNotes, today), [wrongNotes, today]);
  /**
   * 가장 이른 차례까지 며칠.
   *
   * **담은 날에는 차례가 없다** — 새로 담은 오답의 첫 차례는 내일이다(틀린 직후 같은 세션의
   * 재시험은 근거가 없다). 이 값을 모르면 화면이 방금 다섯 개를 담은 학생에게 `차례가 된 오답이
   * 없어요`라고 말해서 기능이 죽은 것처럼 읽힌다.
   */
  const soonest = useMemo(() => soonestDueDays(wrongNotes, today), [wrongNotes, today]);
  /** 영역별 오답 수. 약한 영역부터 고를 수 있게 많은 순으로. */
  const byArea = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const n of wrongNotes) acc[n.area] = (acc[n.area] ?? 0) + 1;
    return Object.entries(acc)
      .map(([area, count]) => ({ area, count }))
      .sort((a, b) => b.count - a.count);
  }, [wrongNotes]);

  const go = (id: string) => router.push(`/student/${id}` as never);
  // 홈과 같은 순서를 보여 준다 — 남은 과제를 먼저, 그 안에서 마감이 이른 것부터.
  const sortedAcademy = [...academy].sort(byTodoThenDue);
  const visibleAcademy = showAllAcademy ? sortedAcademy : sortedAcademy.slice(0, PREVIEW);

  return (
    <Screen testID="student-learn" title="학습">
      {/*
        **조회가 실패하면 목록이 비었다고 말하지 않는다**(M-DB-16). 인라인 `danger` 캡션 +
        다시 시도할 행동이다(`DESIGN.md` §9 · 홈과 같은 모양).

        학원 섹션 안이 아니라 화면 맨 위에 둔다 — 소속이 없는 학생에게는 그 섹션이 아예 없어서
        실패가 어디에도 남지 않고, 이 화면의 개인 학습·오답노트도 같은 조회에 매달려 있다.
      */}
      {loadError ? (
        <LoadFailed
          testID="learn-load-failed"
          retryTestID="learn-load-retry"
          what="학습"
          message={loadError}
          retrying={retrying}
          onRetry={() => void retryLoad()}
        />
      ) : null}

      {/*
        학원 과제가 먼저. 내가 고르는 것보다 정해진 일이 앞이다.
        **실패했을 때 빈 안내만 남는 섹션은 그리지 않는다** — 받은 학습이 없다는 말이 사실인지
        모르는 상태다. 이미 읽어 둔 배정이 있으면 그것은 사실이므로 목록은 그대로 보여 준다.
      */}
      {academy.length > 0 || (inAcademy && !loadError) ? (
        <Section title="학원 학습">
          {academy.length > 0 ? (
            <>
              <Group>
                {visibleAcademy.map((i) => (
                  <LearningRow key={i.id} item={i} onPress={() => go(i.id)} />
                ))}
              </Group>
              {!showAllAcademy && academy.length > PREVIEW ? (
                <Button
                  testID="learn-academy-more"
                  variant="secondary"
                  size="sm"
                  hug
                  label={`학원 학습 ${academy.length - PREVIEW}개 더 보기`}
                  onPress={() => setShowAllAcademy(true)}
                />
              ) : null}
            </>
          ) : reading ? (
            /* 조회 중에는 없다고 말하지 않는다. 문장과 무게는 `pick.tsx`·홈과 같다. */
            <AppText variant="caption" tone="secondary">
              학습을 불러오고 있어요.
            </AppText>
          ) : (
            <Group>
              <View style={{ padding: spacing.lg }}>
                <AppText tone="secondary">아직 학원에서 받은 학습이 없어요.</AppText>
              </View>
            </Group>
          )}
        </Section>
      ) : null}

      {/*
        담아 둔 학습은 개인 학습 **안**에 둔다. 내가 담은 것도 개인 학습이라, 밖으로 빼면
        학원 학습과 같은 층위로 읽힌다. 목록은 전용 화면의 몫이다 — 이 탭에 줄까지
        늘어놓으면 정작 이 화면의 주요 행동이 첫 화면 밖으로 밀린다.
      */}
      <Section title="개인 학습">
        {hasQueue ? (
          <AppText variant="caption" tone="secondary">
            담아 둔 학습 {queued.items.length}개가 있어요. 담은 순서대로 풀 수 있어요.
          </AppText>
        ) : null}
        {hasPersonal ? (
          <AppText variant="caption" tone="secondary">
            학년 → 영역 → 유형 순으로 골라요. 원하는 문제만 딱 찾을 수 있어요.
          </AppText>
        ) : (
          // 이용권이 없어도 이미 담아 둔 것은 풀 수 있다. 담으러 가는 길만 막힌다.
          <Group>
            <View style={{ padding: spacing.lg, gap: spacing.xs }}>
              {academyPaid ? (
                <>
                  <AppText tone="secondary">
                    {account.academyName} 이용권으로 학원 학습을 이용하고 있어요.
                  </AppText>
                  <AppText variant="caption" tone="tertiary">
                    개인 맞춤 학습을 더 하고 싶으면 개인 월정액을 따로 시작할 수 있어요.
                  </AppText>
                </>
              ) : (
                <AppText tone="secondary">
                  월정액을 시작하면 개인 국어 학습을 이용할 수 있어요.
                </AppText>
              )}
            </View>
          </Group>
        )}

        {/*
          **갈 곳이 둘이면 버튼을 늘어놓지 않고 목록으로 고르게 한다**(`ActionBar` 규칙 1).
          예전에는 `풀러 가기`와 `학습할 문제 담으러 가기`가 한 줄에 나란히 서서, 폭이 다른 두
          버튼 중 어느 것이 주 행동인지 모양으로 읽히지 않았다. 지금은 순서가 위계다 —
          이미 고르는 일을 끝낸 학생에게 먼저 보일 것은 담아 둔 학습이고(D-047),
          새로 고르러 가는 줄이 그 아래다.
          `풀러 가기`는 목록 줄에서는 뜻이 서지 않아 스크린리더가 읽던 이름을 그대로 제목으로 올렸다.
        */}
        {hasQueue || hasPersonal ? (
          <Group>
            {hasQueue ? (
              <Row
                testID="learn-queue-all"
                title="담아 둔 학습 풀러 가기"
                showChevron
                onPress={() => router.push('/student/queue' as never)}
              />
            ) : null}
            {hasPersonal ? (
              <Row
                testID="learn-pick"
                title="학습할 문제 담으러 가기"
                showChevron
                onPress={() => router.push('/student/pick' as never)}
              />
            ) : null}
          </Group>
        ) : null}
      </Section>

      {/*
        **오답노트는 기록이 아니라 학습이다**(D-130). 기록은 "무엇을 했는지"를 보는 곳이고,
        오답을 다시 푸는 것은 앞으로 할 일이다. 새로 고르는 것보다는 뒤에 둔다.

        섹션 안에 목적지가 둘이다 — 목록은 **다시 풀 범위 고르기**(`/student/review`)이고,
        질문·메모(`/student/notebook`)는 다른 일이라 제목 옆에 둔다(§8 ④).
      */}
      {wrongNotes.length > 0 ? (
        <Section
          title="오답노트"
          action={
            <Button
              testID="learn-notebook"
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
          {/*
            예전에는 여기에 `오답 8개 · 별표 3개 · 메모 정리 5개`가 있었는데, 앞의 두 값이
            바로 아래 목록과 **같은 숫자를 두 번 말했다.** 남는 `메모 정리`는 대응하는 줄이
            없어 어디로 가야 하는지도 알 수 없었다 — 그 일은 제목 옆 버튼이 맡는다.
            여기서는 이 목록이 무엇을 고르는 것인지만 말한다.
          */}
          {/*
            **왜 지금 해야 하는지를 말한다.** 예전 문장(`다시 풀 범위를 골라요.`)은 이 목록이
            무엇인지만 말했고, 담아 둔 오답을 다시 열 이유는 화면 어디에도 없었다 — 담기는
            1클릭인데 돌아올 유인이 0이었다.
          */}
          <AppText variant="caption" tone="secondary">
            {/*
              **밀린 개수를 앞세우지 않는다.** 여기서 원값(`dueCount`)을 말하면 서른 개가
              밀린 학생이 `30개예요`를 읽고 바로 아래 줄에서 `5개`를 읽는다 — 한 블록이 두 숫자를
              말한다. 개수를 세는 곳은 `todayCount` 하나다.

              **`방금 담은`이라고 단정하지 않는다.** 조건은 `차례가 내일`뿐이라, 어제 다시 틀려
              내일이 차례가 된 노트도 같은 문장을 받았다.
            */}
            {today0 > 0
              ? `오늘 다시 볼 오답이 ${today0}개예요.`
              : soonest === 1
                ? '다시 볼 차례는 내일이에요.'
                : soonest != null
                  ? `다시 볼 차례는 ${soonest}일 뒤예요.`
                  : '차례가 된 오답이 없어요. 범위를 골라 더 볼 수 있어요.'}
          </AppText>
          <Group>
            {/*
              **오늘 볼 것이 첫 줄이다.** 서버가 정한 차례이고 하루 상한이 걸려 있어, 서른 개가
              밀려도 다섯 개다 — 큐 크기를 늘리지 않고 우선순위만 바꾼다. 아래 세 줄(전체·별표·
              영역)은 학생이 범위를 직접 고르는 길이고 차례를 보지 않는다.

              차례가 온 것이 없으면 그리지 않는다(§8) — 눌러도 빈 덱이 나온다.
            */}
            {today0 > 0 ? (
              <Row
                testID="learn-review-today"
                title="오늘 볼 오답 복습하기"
                /* 숫자 형식을 나머지 세 줄과 한 벌로 맞춘다(D-130) — `5개`만 단위가 달랐다. */
                meta={`오답 ${today0}개`}
                subtitle={`하루에 ${DAILY_CAP}개까지 봐요`}
                onPress={() => router.push('/student/review' as never)}
              />
            ) : null}
            {/*
              숫자는 부제가 아니라 `meta`(오른쪽)에 두고 **형식을 하나로** 맞춘다.
              예전에는 줄마다 `오답 8개` / `3개`(단위 없음) / `오답 4개 · 별표 2개`로 갈려
              오른쪽 열을 세로로 훑을 수 없었다.
            */}
            {/*
              **범위를 고르는 줄이다.** 첫 줄(오늘 볼 오답)과 목적지가 같은 주소이면 두 줄이
              같은 일을 하게 되므로, 이 줄은 `?area=`를 붙이지 않는 대신 차례를 보지 않는 덱을
              연다 — `/student/review?all=1`이 그 뜻이다.
            */}
            {/*
              **줄에 적은 개수와 덱 개수를 맞춘다.** `wrongNotes.length`를 쓰면 `오답 60개`를
              누른 학생이 `모두 55개`를 받는다 — 오늘 이미 본 것과 쉬는 것이 덱에서 빠지는데
              그 사실이 어디에도 없었다. 개수는 덱을 만드는 같은 함수로 센다.
            */}
            {allDeck.length > 0 ? (
              <Row
                testID="learn-review"
                title="담아 둔 오답 전체 보기"
                meta={`오답 ${allDeck.length}개`}
                showChevron
                onPress={() => router.push('/student/review?all=1' as never)}
              />
            ) : null}
            {starredDeck.length > 0 ? (
              <Row
                testID="learn-review-starred"
                title="별표 친 것만 복습하기"
                meta={`오답 ${starredDeck.length}개`}
                showChevron
                onPress={() => router.push('/student/review?starred=1' as never)}
              />
            ) : null}
            {/*
              영역이 하나뿐이면 그 줄은 `전체 복습하기`와 **같은 덱**이라 그리지 않는다.
              이름에서 `만`을 뺐다 — `별표 친 것만`(상태)과 `문학만`(분류)이 같은 접미사로
              다른 뜻이었고, `화법과 작문만 복습하기`는 조사가 붙어 읽히지 않았다.
            */}
            {byArea.length > 1
              ? byArea.map((a) => (
                  <Row
                    key={a.area}
                    testID={`review-area-${a.area}`}
                    title={`${a.area} 복습하기`}
                    meta={`오답 ${a.count}개`}
                    showChevron
                    onPress={() => router.push(`/student/review?area=${a.area}` as never)}
                  />
                ))
              : null}
          </Group>
        </Section>
      ) : null}
    </Screen>
  );
}
