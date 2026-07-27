import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Screen,
  Section,
  Group,
  Row,
  Pager,
  ProgressBar,
  AppText,
  StatTiles,
  type Stat,
} from '@/components';
import { useProgress } from '@/features/progress';
import { usePricing, academyMonthly, won } from '@/features/pricing';
import { ACADEMY_CLASSES, getAccount } from '@/data';
import { spacing, typeface } from '@/theme/tokens';

const PAGE_SIZE = 10;

/**
 * 학원 한 곳의 운영 현황.
 * 좌석·청구액 → 배정 제출률 → 반 목록(제출률 낮은 반부터) 순으로 본다.
 * 학생 개인 학습 상세는 여기서 보지 않는다(확정 정책: 학원 데이터 경계).
 */
export default function AdminAcademyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const name = decodeURIComponent(String(id));
  const { assignments } = useProgress();
  const { policy } = usePricing();
  const [page, setPage] = useState(0);

  const classes = useMemo(() => ACADEMY_CLASSES.filter((c) => c.academyName === name), [name]);

  const detail = useMemo(() => {
    const classIds = new Set(classes.map((c) => c.id));
    const related = assignments.filter((a) => classIds.has(a.classId));
    const rows = related.flatMap((a) => a.submissions);
    const submitted = rows.filter((s) => s.submitted).length;
    const accuracies = rows
      .filter((s) => s.submitted && s.accuracy != null)
      .map((s) => s.accuracy as number);
    const seats = new Set(classes.flatMap((c) => c.studentIds)).size;
    const teachers = new Set(classes.map((c) => c.teacherId)).size;
    return {
      seats,
      teachers,
      assignedCount: related.length,
      rows: rows.length,
      submitted,
      submitRate: rows.length ? Math.round((submitted / rows.length) * 100) : 0,
      avgAccuracy: accuracies.length
        ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length)
        : null,
      monthly: academyMonthly(policy, seats),
    };
  }, [classes, assignments, policy]);

  const classRows = useMemo(
    () =>
      classes
        .map((c) => {
          const related = assignments.filter((a) => a.classId === c.id);
          const rows = related.flatMap((a) => a.submissions);
          const submitted = rows.filter((s) => s.submitted).length;
          const teacher = getAccount(c.teacherId);
          return {
            id: c.id,
            name: c.name,
            students: c.studentIds.length,
            teacher: teacher?.name ?? '미배정',
            assigned: related.length,
            rate: rows.length ? Math.round((submitted / rows.length) * 100) : null,
          };
        })
        .sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101)),
    [classes, assignments],
  );

  const pageItems = classRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (!classes.length) {
    return (
      <Screen testID="admin-academy" backFallback="/admin/academies" title="학원을 찾을 수 없어요">
        <Group>
          <Row title="목록에서 다시 골라 주세요" subtitle="이름이 바뀌었거나 잘못된 주소예요" />
        </Group>
      </Screen>
    );
  }

  const stats: Stat[] = [
    { label: '좌석', value: `${detail.seats.toLocaleString('en-US')}명`, hint: '중복 없는 재원생' },
    {
      label: '월 청구액',
      value: won(detail.monthly),
      hint:
        detail.seats >= policy.seatDiscountFrom
          ? `규모 할인 ${policy.seatDiscountPct}% 적용`
          : '할인 없음',
    },
    {
      label: '반 · 선생님',
      value: `${classes.length} · ${detail.teachers}`,
      hint: '반 수 · 선생님 수',
    },
    {
      label: '평균 정답률',
      value: detail.avgAccuracy == null ? '기록 없음' : `${detail.avgAccuracy}%`,
      hint: '제출된 배정 기준',
    },
  ];

  return (
    <Screen
      wide
      testID="admin-academy"
      backFallback="/admin/academies"
      eyebrow="학원"
      title={name}
      lead="좌석과 청구액, 반별 제출률을 봐요."
    >
      <AppText variant="caption" tone="tertiary">
        프로토타입 테스트 데이터입니다. 학생 개인 학습 상세는 여기서 보지 않아요.
      </AppText>

      <StatTiles testID="academy-kpi" stats={stats} />

      <Section title="배정 학습 제출률">
        <View style={{ gap: spacing.sm }}>
          <View style={styles.lineRow}>
            <AppText variant="caption" tone="secondary">
              제출한 배정
            </AppText>
            <AppText variant="caption" tone="secondary" style={styles.lineValue}>
              {detail.submitted}/{detail.rows}건 · {detail.submitRate}%
            </AppText>
          </View>
          <ProgressBar value={detail.submitRate} />
          <AppText variant="caption" tone="tertiary">
            배정 {detail.assignedCount}건 기준이에요.
          </AppText>
        </View>
      </Section>

      <Section title={`반 (${classRows.length}개) · 제출률 낮은 순`}>
        <Group>
          {pageItems.map((c) => (
            <Row
              key={c.id}
              title={c.name}
              subtitle={`선생님 ${c.teacher} · 학생 ${c.students}명 · 배정 ${c.assigned}건`}
              meta={c.rate == null ? '배정 없음' : `제출률 ${c.rate}%`}
            />
          ))}
        </Group>
        <Pager
          testID="academy-class-pager"
          total={classRows.length}
          page={page}
          pageSize={PAGE_SIZE}
          onChange={setPage}
        />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lineRow: { flexDirection: 'row', justifyContent: 'space-between' },
  lineValue: { fontFamily: typeface.medium },
});
