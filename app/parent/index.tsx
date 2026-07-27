import { useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Screen, Section, Group, Row, AppText } from '@/components';
import { useCurrentAccount } from '@/session';
import { useProgress } from '@/features/progress';
import { getChildren, getChildSummary } from '@/data';
import { colors, spacing, radius, typeface } from '@/theme/tokens';

/** 학부모 홈: 자녀 학습을 한눈에. 요약 지표 + 자녀별 현황 + 다음 할 일. */
export default function ParentHome() {
  const router = useRouter();
  const account = useCurrentAccount();
  const { wrongNotes } = useProgress();
  const children = getChildren(account.userId);

  const summaries = children.map((c) => getChildSummary(c.userId));
  const accs = summaries.map((s) => s.recentAccuracy).filter((v): v is number => v != null);
  const avg = accs.length ? Math.round(accs.reduce((a, b) => a + b, 0) / accs.length) : null;

  const metrics = [
    { label: '자녀', value: `${children.length}명` },
    { label: '평균 정답률', value: avg != null ? `${avg}%` : '—' },
    { label: '확인할 오답', value: `${wrongNotes.length}개` },
  ];

  return (
    <Screen testID="parent-home" eyebrow="학부모" title={`${account.name} 님`}>
      {children.length === 0 ? (
        <Group>
          <View style={{ padding: spacing.lg, gap: spacing.xs }}>
            <AppText variant="label">아직 연결된 자녀가 없어요</AppText>
            <AppText variant="caption" tone="secondary">
              학원 초대나 연결 요청으로 자녀를 추가할 수 있어요.
            </AppText>
          </View>
        </Group>
      ) : (
        <>
          <View style={styles.metrics}>
            {metrics.map((m) => (
              <View key={m.label} style={styles.metric}>
                <AppText variant="caption" tone="secondary">
                  {m.label}
                </AppText>
                <AppText style={styles.metricValue}>{m.value}</AppText>
              </View>
            ))}
          </View>

          <Section title="자녀별 현황">
            <Group>
              {children.map((c, i) => {
                const s = summaries[i];
                const sub = [
                  `미완료 ${s.incomplete}`,
                  s.recentAccuracy != null ? `정답률 ${s.recentAccuracy}%` : '기록 없음',
                  s.repeatWrong > 0 ? `다시 볼 학습 ${s.repeatWrong}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <Row
                    key={c.userId}
                    title={c.name}
                    subtitle={sub}
                    showChevron
                    onPress={() => router.push(`/parent/child/${c.userId}` as never)}
                  />
                );
              })}
            </Group>
          </Section>

          <AppText variant="caption" tone="tertiary">
            자녀 이름을 누르면 학습별 문항·정답·해설을 보고 다시 풀기를 요청할 수 있어요.
          </AppText>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', gap: spacing.md },
  metric: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: 2,
  },
  metricValue: { fontFamily: typeface.bold, color: colors.ink, fontSize: 22, letterSpacing: -0.3 },
});
