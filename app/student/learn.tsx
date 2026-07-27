import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { Screen, Section, Group, Row, LearningRow, AppText, Button } from '@/components';
import { useStudentItems } from '@/features/learning';
import { useContent } from '@/features/content';
import { useCurrentAccount, useSession } from '@/session';
import { AREAS, GRADES, findContent, topicsFor, type Grade, type KoreanArea } from '@/data';
import { spacing } from '@/theme/tokens';

/**
 * 학습: 학년 → 영역 → 세부 유형 순으로 좁혀 고른다.
 * 단계는 URL 쿼리에 남겨 브라우저 뒤로가기와 직접 진입이 모두 동작한다.
 */
export default function StudentLearn() {
  const router = useRouter();
  const params = useLocalSearchParams<{ grade?: string; area?: string; topic?: string }>();
  const { personal, academy, hasPersonal } = useStudentItems();
  const { sets } = useContent();
  const account = useCurrentAccount();
  const { academyLinked } = useSession();
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
    router.push((query ? `/student/learn?${query}` : '/student/learn') as never);
  };

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
    tagged.filter(
      (x) => x.grade === g && (!a || x.area === a) && (!t || x.topic === t),
    ).length;

  const matched = tagged.filter(
    (x) => x.grade === grade && x.area === area && (!topic || x.topic === topic),
  );

  return (
    <Screen testID="student-learn" title="학습">
      {/* 1단계: 학년 */}
      {!grade ? (
        <>
          <AppText variant="caption" tone="secondary">
            학년 → 영역 → 유형 순으로 골라요. 원하는 문제만 딱 찾을 수 있어요.
          </AppText>
          <Section title="개인 학습">
            {hasPersonal ? (
              <Group>
                {GRADES.map((g) => (
                  <Row
                    key={g}
                    testID={`learn-grade-${g}`}
                    title={`고${g}`}
                    subtitle={`${countFor(g)}개 학습`}
                    showChevron
                    onPress={() => step({ grade: g })}
                  />
                ))}
              </Group>
            ) : (
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
          </Section>

          <Section title="학원 학습">
            {academy.length > 0 ? (
              <Group>
                {academy.map((i) => (
                  <LearningRow key={i.id} item={i} onPress={() => go(i.id)} />
                ))}
              </Group>
            ) : (
              <Group>
                <View style={{ padding: spacing.lg }}>
                  <AppText tone="secondary">아직 학원에서 받은 학습이 없어요.</AppText>
                </View>
              </Group>
            )}
          </Section>
        </>
      ) : null}

      {/* 2단계: 영역 */}
      {grade && !area ? (
        <>
          <Button
            testID="learn-back-grade"
            variant="ghost"
            label="← 학년 다시 고르기"
            onPress={() => step({})}
          />
          <Section title={`고${grade} · 영역을 골라요`}>
            <Group>
              {AREAS.map((a) => (
                <Row
                  key={a}
                  testID={`learn-area-${a}`}
                  title={a}
                  subtitle={`${countFor(grade, a)}개 학습`}
                  showChevron
                  onPress={() => step({ grade, area: a })}
                />
              ))}
            </Group>
          </Section>
        </>
      ) : null}

      {/* 3단계: 세부 유형 */}
      {grade && area && !topic ? (
        <>
          <Button
            testID="learn-back-area"
            variant="ghost"
            label="← 영역 다시 고르기"
            onPress={() => step({ grade })}
          />
          <Section title={`고${grade} · ${area} · 유형을 골라요`}>
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
          </Section>
        </>
      ) : null}

      {/* 4단계: 학습 목록 */}
      {grade && area && topic ? (
        <>
          <Button
            testID="learn-back-topic"
            variant="ghost"
            label="← 유형 다시 고르기"
            onPress={() => step({ grade, area })}
          />
          <Section title={`고${grade} · ${area} · ${topic}`}>
            {matched.length > 0 ? (
              <Group>
                {matched.map((x) => (
                  <LearningRow key={x.item.id} item={x.item} onPress={() => go(x.item.id)} />
                ))}
              </Group>
            ) : (
              <Group>
                <View style={{ padding: spacing.lg }}>
                  <AppText tone="secondary">이 유형은 아직 준비 중이에요.</AppText>
                </View>
              </Group>
            )}
          </Section>
        </>
      ) : null}
    </Screen>
  );
}
