import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { Screen, Group, Row, LearningRow, IconButton, AppText, Button, ActionBar } from '@/components';
import { useStudentItems } from '@/features/learning';
import { useContent } from '@/features/content';
import { useProgress } from '@/features/progress';
import { useToast } from '@/features/toast';
import { useCurrentAccount, useSession } from '@/session';
import {
  AREAS,
  GRADES,
  findContent,
  topicsFor,
  type Grade,
  type KoreanArea,
  type LearningItem,
} from '@/data';
import { spacing } from '@/theme/tokens';

/**
 * 개인 학습 고르기: 학년 → 영역 → 세부 유형 → 학습 목록.
 *
 * 학습 탭에서 `학습할 문제 담으러 가기`로 들어온다. 고르는 일에만 집중하는 화면이라
 * 학원 학습·담아 둔 학습은 두지 않는다.
 *
 * 단계는 URL 쿼리에 남긴다. 단계마다 히스토리가 쌓이므로 좌상단 뒤로가기가
 * 그대로 '한 단계 뒤로'가 되고, 마지막 단계에서 누르면 학습 탭으로 돌아간다.
 */
export default function StudentPick() {
  const router = useRouter();
  const params = useLocalSearchParams<{ grade?: string; area?: string; topic?: string }>();
  const { personal, academy, hasPersonal } = useStudentItems();
  const { addToQueue, removeFromQueue, isQueued } = useProgress();
  const { sets, loading: contentLoading } = useContent();
  const { show } = useToast();
  const account = useCurrentAccount();
  const { academyLinked, readOnly } = useSession();
  const academyPaid = !!account.academyName && academyLinked;

  const grade = params.grade ? (Number(params.grade) as Grade) : undefined;
  const area = params.area as KoreanArea | undefined;
  const topic = params.topic;

  const go = (id: string) => router.push(`/student/${id}` as never);
  const step = (next: { grade?: Grade; area?: KoreanArea; topic?: string }) => {
    const q = new URLSearchParams();
    if (next.grade) q.set('grade', String(next.grade));
    if (next.area) q.set('area', next.area);
    if (next.topic) q.set('topic', next.topic);
    const query = q.toString();
    router.push((query ? `/student/pick?${query}` : '/student/pick') as never);
  };

  /**
   * 담기/빼기. **서버가 받아 준 다음에 알린다** — 먼저 알리면 저장되지 않아도 담았다고 말하고
   * 다음 조회에서 조용히 사라진다(`app/parent/children.tsx`와 같은 규칙).
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

  /** 개인 학습 항목에 콘텐츠 분류를 붙인다. */
  const tagged = useMemo(
    () =>
      personal.map((item) => {
        const content = findContent(sets, item.contentId);
        return { item, grade: content?.grade, area: content?.area, topic: content?.topic };
      }),
    [personal, sets],
  );

  const countFor = (g: Grade, a?: KoreanArea, t?: string) =>
    tagged.filter((x) => x.grade === g && (!a || x.area === a) && (!t || x.topic === t)).length;

  const matched = tagged.filter(
    (x) => x.grade === grade && x.area === area && (!topic || x.topic === topic),
  );

  /**
   * 학원이 배정한 콘텐츠는 개인 학습으로도 공개돼 있을 수 있다(운영자 콘텐츠를 학원이 배정한 경우).
   * 그때 같은 제목이 학원 과제와 개인 목록에 따로 보이는데, 개인 쪽을 풀어도 학원 배정은
   * 미제출로 남는다. 관계를 한 줄로 알려 학생이 헛수고하지 않게 한다.
   */
  const assignedContentIds = useMemo(
    () => new Set(academy.map((a) => a.contentId)),
    [academy],
  );

  /**
   * 지나온 길. `Screen`의 `eyebrow`로 넘기지 않는다 — `eyebrow`는 대문자 변환과 넓은 자간이
   * 붙는 라틴 전용 변형이라 한글에서는 뜻 없이 글자만 벌어지고 대비도 낮다(`DESIGN.md` §4).
   */
  const trail = [grade ? `고${grade}` : null, area, topic].filter(Boolean).join(' · ');
  const title = !grade
    ? '학년을 골라요'
    : !area
      ? '영역을 골라요'
      : !topic
        ? '유형을 골라요'
        : '담을 학습을 골라요';

  /**
   * 개인 이용권이 없으면 고를 것이 자체가 없다(`src/features/learning.ts`가 `personal`을 비운다).
   * 그대로 단계를 그리면 모든 칸이 0개가 되어 '콘텐츠가 준비 중'이라고 잘못 말한다.
   * 문구는 학습 탭(`app/student/learn.tsx`)의 두 갈래를 그대로 쓴다 — M9-04로 결정 대기 중이라
   * 여기서 새로 만들지 않는다. 학습 탭에 진입 버튼이 없으므로 이 화면은 직접 URL 진입 경로다.
   */
  if (!hasPersonal) {
    return (
      <Screen testID="student-pick" backFallback="/student/learn" title="개인 학습">
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
        <ActionBar>
          <Button
            testID="pick-go-learn"
            variant="secondary"
            label="학습 탭으로 갈게요"
            onPress={() => router.replace('/student/learn' as never)}
          />
        </ActionBar>
      </Screen>
    );
  }

  return (
    <Screen testID="student-pick" backFallback="/student/learn" title={title}>
      {trail ? (
        <AppText variant="caption" tone="secondary">
          {trail}
        </AppText>
      ) : null}

      {/*
        **콘텐츠를 읽는 동안에는 개수를 말하지 않는다.**

        예전에는 로딩 중에도 학년 줄을 그렸고, 그때 개수가 0이라 세 학년 모두
        `아직 준비 중이에요`로 보였다. 사실이 아닌 문장이고, 그 순간 누른 사람에게는 아무 일도
        일어나지 않는 죽은 줄이었다(실측: E2E 5건이 이 창에서 갈렸다).

        화면 전체를 기다리게 두지는 않는다 — 역할 레이아웃에서 막아 봤더니 단계형 화면이
        쿼리 파라미터를 잃었다. 개수를 말하는 이 자리만 기다린다.
      */}
      {contentLoading ? (
        <AppText variant="caption" tone="secondary">
          학습을 불러오고 있어요.
        </AppText>
      ) : null}

      {/* 1단계: 학년 */}
      {!grade && !contentLoading ? (
        <>
          <AppText variant="caption" tone="secondary">
            학년 → 영역 → 유형 순으로 좁혀 가요. 원하는 문제만 딱 찾을 수 있어요.
          </AppText>
          {/* 고를 것이 없는 칸은 세 단계 모두 같은 규칙으로 막는다 — 들어가도 할 것이 없다. */}
          <Group>
            {GRADES.map((g) => {
              const n = countFor(g);
              return (
                <Row
                  key={g}
                  testID={`learn-grade-${g}`}
                  title={`고${g}`}
                  subtitle={n > 0 ? `${n}개 학습` : '아직 준비 중이에요'}
                  showChevron={n > 0}
                  onPress={n > 0 ? () => step({ grade: g }) : undefined}
                />
              );
            })}
          </Group>
        </>
      ) : null}

      {/* 2단계: 영역 */}
      {grade && !area && !contentLoading ? (
        <Group>
          {AREAS.map((a) => {
            const n = countFor(grade, a);
            return (
              <Row
                key={a}
                testID={`learn-area-${a}`}
                title={a}
                subtitle={n > 0 ? `${n}개 학습` : '아직 준비 중이에요'}
                showChevron={n > 0}
                onPress={n > 0 ? () => step({ grade, area: a }) : undefined}
              />
            );
          })}
        </Group>
      ) : null}

      {/* 3단계: 세부 유형 */}
      {grade && area && !topic && !contentLoading ? (
        <Group>
          {topicsFor(area).map((t) => {
            const n = countFor(grade, area, t);
            return (
              <Row
                key={t}
                testID={`learn-topic-${t}`}
                title={t}
                subtitle={n > 0 ? `${n}개 학습` : '아직 준비 중이에요'}
                showChevron={n > 0}
                onPress={n > 0 ? () => step({ grade, area, topic: t }) : undefined}
              />
            );
          })}
        </Group>
      ) : null}

      {/* 4단계: 학습 목록. 유형 이름은 위 경로에 이미 있으므로 섹션 제목으로 또 쓰지 않는다. */}
      {grade && area && topic ? (
        matched.length > 0 ? (
          <>
            <AppText variant="caption" tone="tertiary">
              지금 풀지 않아도 돼요. 담아 두면 홈에서 이어서 풀 수 있어요.
            </AppText>
            <Group>
              {matched.map((x) => (
                <LearningRow
                  key={x.item.id}
                  item={x.item}
                  onPress={() => go(x.item.id)}
                  note={
                    assignedContentIds.has(x.item.contentId)
                      ? '학원 과제로도 받은 학습이에요. 과제는 학원 학습에서 풀어야 제출돼요.'
                      : undefined
                  }
                  trailing={
                    <IconButton
                      testID={`learn-queue-${x.item.id}`}
                      variant="outlined"
                      role="checkbox"
                      name={isQueued(x.item.id) ? 'check' : 'plus'}
                      active={isQueued(x.item.id)}
                      label={isQueued(x.item.id) ? '담아 둔 학습에서 빼기' : '담아 두기'}
                      size={18}
                      onPress={() => void toggleQueue(x.item)}
                    />
                  }
                />
              ))}
            </Group>
          </>
        ) : (
          <Group>
            <View style={{ padding: spacing.lg }}>
              <AppText tone="secondary">이 유형은 아직 준비 중이에요.</AppText>
            </View>
          </Group>
        )
      ) : null}
    </Screen>
  );
}
