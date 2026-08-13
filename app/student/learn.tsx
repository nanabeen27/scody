import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Screen, Section, Group, Row, LearningRow, AppText, Button } from '@/components';
import { useProgress } from '@/features/progress';
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
  const { wrongNotes } = useProgress();
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

  const hasQueue = queued.items.length > 0;

  const starred = wrongNotes.filter((n) => n.starred).length;
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
      {/* 학원 과제가 먼저. 내가 고르는 것보다 정해진 일이 앞이다. */}
      {academy.length > 0 || inAcademy ? (
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
          <AppText variant="caption" tone="secondary">
            다시 풀 범위를 골라요.
          </AppText>
          <Group>
            {/*
              숫자는 부제가 아니라 `meta`(오른쪽)에 두고 **형식을 하나로** 맞춘다.
              예전에는 줄마다 `오답 8개` / `3개`(단위 없음) / `오답 4개 · 별표 2개`로 갈려
              오른쪽 열을 세로로 훑을 수 없었다.
            */}
            <Row
              testID="learn-review"
              title="전체 복습하기"
              meta={`오답 ${wrongNotes.length}개`}
              showChevron
              onPress={() => router.push('/student/review' as never)}
            />
            {starred > 0 ? (
              <Row
                testID="learn-review-starred"
                title="별표 친 것만 복습하기"
                meta={`오답 ${starred}개`}
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
