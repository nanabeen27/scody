import { useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Screen, Section, Group, Row, AppText } from '@/components';
import { useCurrentAccount } from '@/session';
import { useProgress } from '@/features/progress';
import { getClassesForAccount, submissionStat } from '@/data';
import { colors, spacing, radius, typeface } from '@/theme/tokens';

/** 학원 대시보드: 지표 스트립 + 실제로 이동하는 바로가기. 장식 없이 기능적으로. */
export default function AcademyDashboard() {
  const router = useRouter();
  const account = useCurrentAccount();
  const { assignments } = useProgress();
  const isDirector = account.academyRole === 'director';

  const classes = getClassesForAccount(account);
  const classIds = new Set(classes.map((c) => c.id));
  const scoped = assignments.filter((a) => classIds.has(a.classId));
  const unsubmitted = scoped.reduce((n, a) => n + a.submissions.filter((s) => !s.submitted).length, 0);
  const stats = scoped.map(submissionStat).filter((s) => s.avgAccuracy != null);
  const avg = stats.length
    ? Math.round(stats.reduce((x, s) => x + (s.avgAccuracy ?? 0), 0) / stats.length)
    : null;

  const metrics = [
    { label: '미제출', value: `${unsubmitted}명` },
    { label: '배정 학습', value: `${scoped.length}개` },
    { label: '평균 정답률', value: avg != null ? `${avg}%` : '—' },
  ];

  return (
    <Screen wide testID="academy-dashboard" eyebrow={account.academyName} title="대시보드">
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

      <Section title="바로가기">
        <Group>
          <Row
            title="제출 현황"
            subtitle="배정 학습별 제출·정답률"
            showChevron
            onPress={() => router.push('/academy/analytics' as never)}
          />
          <Row
            title="학습 배정"
            subtitle="반에 새 학습 배정"
            showChevron
            onPress={() => router.push('/academy/assign' as never)}
          />
          <Row
            title="반·학생"
            subtitle={`담당 반 ${classes.length}개`}
            showChevron
            onPress={() => router.push('/academy/classes' as never)}
          />
          {isDirector ? (
            <Row
              title="학원 관리"
              subtitle="초대·선생님·요금제"
              showChevron
              onPress={() => router.push('/academy/manage' as never)}
            />
          ) : null}
        </Group>
      </Section>
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
