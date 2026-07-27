import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Screen,
  Section,
  Group,
  Row,
  Field,
  Pager,
  AppText,
  StatTiles,
  type Stat,
} from '@/components';
import { useProgress } from '@/features/progress';
import { usePricing, academyMonthly, won } from '@/features/pricing';
import { ACADEMY_CLASSES } from '@/data';

const PAGE_SIZE = 10;

/** 학원 목록. 좌석·청구액·제출률을 한 줄로 보고, 눌러서 학원 상세로 들어간다. */
export default function AdminAcademies() {
  const router = useRouter();
  const { assignments } = useProgress();
  const { policy } = usePricing();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const academies = useMemo(() => {
    const names = Array.from(new Set(ACADEMY_CLASSES.map((c) => c.academyName)));
    return names.map((name) => {
      const classes = ACADEMY_CLASSES.filter((c) => c.academyName === name);
      const classIds = new Set(classes.map((c) => c.id));
      const seats = new Set(classes.flatMap((c) => c.studentIds)).size;
      const rows = assignments.filter((a) => classIds.has(a.classId)).flatMap((a) => a.submissions);
      const submitted = rows.filter((s) => s.submitted).length;
      return {
        name,
        classes: classes.length,
        seats,
        assigned: rows.length,
        submitted,
        submitRate: rows.length ? Math.round((submitted / rows.length) * 100) : null,
        monthly: academyMonthly(policy, seats),
      };
    });
  }, [assignments, policy]);

  const filtered = useMemo(() => {
    const q = query.trim();
    const list = q ? academies.filter((a) => a.name.includes(q)) : academies;
    return [...list].sort((a, b) => b.seats - a.seats);
  }, [academies, query]);

  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const stats: Stat[] = [
    { label: '학원', value: `${filtered.length}곳`, hint: '검색 결과 기준' },
    {
      label: '좌석 합계',
      value: `${filtered.reduce((n, a) => n + a.seats, 0).toLocaleString('en-US')}명`,
      hint: '중복 없는 재원생 수',
    },
    {
      label: '월 청구액 합계',
      value: won(filtered.reduce((n, a) => n + a.monthly, 0)),
      hint: '요금제 설정 반영',
    },
    { label: '반', value: `${filtered.reduce((n, a) => n + a.classes, 0)}개`, hint: '전체 반 수' },
  ];

  return (
    <Screen
      wide
      testID="admin-academies"
      backFallback="/admin"
      eyebrow="총괄관리자"
      title="학원"
      lead="좌석과 청구액, 배정 제출률을 함께 봐요."
    >
      <AppText variant="caption" tone="tertiary">
        프로토타입 테스트 데이터입니다. 청구액은 요금제 설정으로 계산한 추정값이에요.
      </AppText>

      <StatTiles testID="academies-kpi" stats={stats} />

      <Field
        testID="academy-search"
        label="학원 이름 검색"
        value={query}
        onChangeText={(t) => {
          setQuery(t);
          setPage(0);
        }}
        placeholder="예: 한빛"
        autoCorrect={false}
      />

      <Section title={`목록 (${filtered.length}곳)`}>
        <Group>
          {pageItems.length ? (
            pageItems.map((a) => (
              <Row
                key={a.name}
                testID={`academy-row-${a.name}`}
                title={a.name}
                subtitle={`반 ${a.classes}개 · 좌석 ${a.seats}명${
                  a.submitRate == null ? ' · 배정 없음' : ` · 제출률 ${a.submitRate}%`
                }`}
                meta={`${won(a.monthly)}/월`}
                onPress={() => router.push(`/admin/academy/${encodeURIComponent(a.name)}` as never)}
                showChevron
              />
            ))
          ) : (
            <Row title="검색 결과가 없어요" subtitle="다른 이름으로 찾아 보세요" />
          )}
        </Group>
        <Pager
          testID="academies-pager"
          total={filtered.length}
          page={page}
          pageSize={PAGE_SIZE}
          unit="곳"
          onChange={setPage}
        />
      </Section>
    </Screen>
  );
}
