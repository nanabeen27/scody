import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Screen, Section, Group, Row, AppText, StatTiles, type Stat } from '@/components';
import { useContent } from '@/features/content';
import { useProgress } from '@/features/progress';
import { ACADEMY_CLASSES, findContent, gradeLabel } from '@/data';
import { contentUsage, hardestQuestions, totalSolves } from '@/data/usage';
import { colors, radius, spacing, typeface } from '@/theme/tokens';

const KIND_LABEL = { passage: '지문형', grammar: '문법형' } as const;
const HARD = 70;

/** 구성비. 0으로 반올림되면 "1% 미만"이라고 밝힌다(0%는 없는 것처럼 읽힌다). */
function share(part: number, whole: number): string {
  if (!whole || part <= 0) return '0%';
  const pct = Math.round((part / whole) * 100);
  return pct === 0 ? '1% 미만' : `${pct}%`;
}

/**
 * 콘텐츠 한 세트의 사용 현황.
 * 학원이 배정해 푼 횟수와 학생이 개인 학습에서 직접 골라 푼 횟수를 나눠 보여 주고,
 * 문항별 오답률로 어느 문항이 어려운지 짚는다.
 */
export default function AdminContentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sets } = useContent();
  const { assignments } = useProgress();
  const set = findContent(sets, String(id));

  const live = useMemo(() => {
    if (!set) return { academySolves: 0, assigned: [] as string[] };
    const related = assignments.filter((a) => a.contentId === set.id);
    const academySolves = related.reduce(
      (n, a) => n + a.submissions.filter((s) => s.submitted).length,
      0,
    );
    const academies = new Set(
      related
        .map((a) => ACADEMY_CLASSES.find((c) => c.id === a.classId)?.academyName)
        .filter(Boolean) as string[],
    );
    return { academySolves, assigned: Array.from(academies) };
  }, [set, assignments]);

  if (!set) {
    return (
      <Screen
        testID="admin-content-detail"
        backFallback="/admin/content"
        title="콘텐츠를 찾을 수 없어요"
      >
        <Group>
          <Row title="목록에서 다시 골라 주세요" subtitle="삭제되었거나 잘못된 주소예요" />
        </Group>
      </Screen>
    );
  }

  const usage = contentUsage(set, { academySolves: live.academySolves });
  const solves = totalSolves(usage);
  const hardest = hardestQuestions(set, usage, 5);

  const stats: Stat[] = [
    { label: '누적 풀이', value: `${solves.toLocaleString('en-US')}회`, hint: '배정 + 개인' },
    {
      label: '학원 배정 풀이',
      value: `${usage.academySolves.toLocaleString('en-US')}회`,
      hint: `전체의 ${share(usage.academySolves, solves)}`,
    },
    {
      label: '개인 학습 풀이',
      value: `${usage.personalSolves.toLocaleString('en-US')}회`,
      hint: `전체의 ${share(usage.personalSolves, solves)}`,
    },
    {
      label: '평균 정답률',
      value: `${usage.avgAccuracy}%`,
      hint: `오답률 ${100 - usage.avgAccuracy}%`,
      alert: usage.avgAccuracy < 50,
    },
  ];

  return (
    <Screen
      wide
      testID="admin-content-detail"
      backFallback="/admin/content"
      eyebrow={`국어 · ${set.area}`}
      title={set.title}
      lead={`${set.grade ? `${gradeLabel(set.grade)} · ` : ''}${
        set.topic ? `${set.topic} · ` : ''
      }${KIND_LABEL[set.kind]} · ${set.questions.length}문항`}
    >
      <AppText variant="caption" tone="tertiary">
        풀이 횟수와 오답률은 프로토타입 테스트 집계입니다. 실제 사용 로그가 아닙니다.
      </AppText>

      <StatTiles testID="detail-kpi" stats={stats} />

      <Section title="문항별 오답률">
        <View style={styles.bars}>
          {set.questions.map((q, i) => {
            const rate = usage.wrongRateByQ[q.id] ?? 0;
            return (
              <View key={q.id} style={styles.bar} testID={`detail-q-${q.id}`}>
                <View style={styles.barHead}>
                  <AppText variant="caption" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
                    {i + 1}. {q.prompt}
                  </AppText>
                  <AppText
                    variant="caption"
                    style={[styles.rate, rate >= HARD && { color: colors.danger }]}
                  >
                    {rate}%
                  </AppText>
                </View>
                <View style={styles.track}>
                  <View
                    style={[
                      styles.fill,
                      {
                        width: `${rate}%`,
                        backgroundColor: rate >= HARD ? colors.danger : colors.accent,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </Section>

      <Section title="어려운 문항 먼저 보기">
        <Group>
          {hardest.map((h, i) => (
            <Row
              key={h.id}
              title={`${i + 1}. ${h.prompt}`}
              subtitle={h.wrongRate >= HARD ? '해설을 다시 볼 문항이에요' : '오답률 기준 상위'}
              meta={`오답률 ${h.wrongRate}%`}
            />
          ))}
        </Group>
      </Section>

      <Section title="배정 현황">
        <Group>
          <Row
            title="이 콘텐츠를 배정한 학원"
            subtitle={live.assigned.length ? live.assigned.join(', ') : '아직 배정한 학원이 없어요'}
            meta={`${live.assigned.length}곳`}
          />
          <Row
            title="개인 학습 공개"
            subtitle={
              set.publishToStudents
                ? '학생이 학습 탭에서 직접 고를 수 있어요'
                : '공개하지 않아 배정으로만 전달돼요'
            }
            meta={set.publishToStudents ? '공개' : '비공개'}
          />
          <Row
            title="콘텐츠 소유"
            subtitle={
              set.ownerAcademyName
                ? `${set.ownerAcademyName}이 등록했어요. 그 학원만 배정할 수 있어요`
                : '운영자가 등록했어요'
            }
            meta={set.ownerAcademyName ?? '운영자'}
          />
        </Group>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bars: { gap: spacing.md },
  bar: { gap: spacing.xs },
  barHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rate: { fontFamily: typeface.semibold, color: colors.ink, minWidth: 40, textAlign: 'right' },
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.offset,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
});
