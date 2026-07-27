import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  Screen,
  Section,
  Group,
  Row,
  Button,
  Field,
  Chips,
  Pager,
  AppText,
  StatTiles,
  type ChipOption,
  type Stat,
} from '@/components';
import { useContent } from '@/features/content';
import { useProgress } from '@/features/progress';
import { AREAS, TOPICS, type KoreanArea } from '@/data';
import { contentUsage, totalSolves } from '@/data/usage';
import { spacing } from '@/theme/tokens';

const PAGE_SIZE = 10;
const KIND_LABEL = { passage: '지문형', grammar: '문법형' } as const;

type AreaFilter = '전체' | KoreanArea;
type Sort = 'recent' | 'solves' | 'wrong';

const SORTS: readonly ChipOption<Sort>[] = [
  { value: 'recent', label: '최근 등록' },
  { value: 'solves', label: '많이 푼 순' },
  { value: 'wrong', label: '오답률 높은 순' },
];

/**
 * 콘텐츠 목록. 문항이 수천 개가 되어도 다룰 수 있어야 한다.
 * 영역(문학·독서·화법과 작문·문법)으로 좁히고 → 검색·정렬 → 페이지 이동 → 한 세트로 들어간다.
 */
export default function AdminContentList() {
  const router = useRouter();
  const { sets } = useContent();
  const { assignments } = useProgress();
  const [area, setArea] = useState<AreaFilter>('전체');
  const [sort, setSort] = useState<Sort>('recent');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  // 세션에서 실제로 제출된 배정 횟수. 테스트 집계 위에 더해 보여 준다.
  const liveAssigned = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of assignments) {
      if (!a.contentId) continue;
      map[a.contentId] = (map[a.contentId] ?? 0) + a.submissions.filter((s) => s.submitted).length;
    }
    return map;
  }, [assignments]);

  const enriched = useMemo(
    () =>
      sets.map((set, index) => {
        const usage = contentUsage(set, { academySolves: liveAssigned[set.id] ?? 0 });
        return { set, usage, index, solves: totalSolves(usage), wrong: 100 - usage.avgAccuracy };
      }),
    [sets, liveAssigned],
  );

  const areaOptions: readonly ChipOption<AreaFilter>[] = useMemo(
    () => [
      { value: '전체', label: '전체', count: sets.length },
      ...AREAS.map((a) => ({
        value: a as AreaFilter,
        label: a,
        count: sets.filter((s) => s.area === a).length,
      })),
    ],
    [sets],
  );

  const filtered = useMemo(() => {
    const q = query.trim();
    let list = enriched;
    if (area !== '전체') list = list.filter((e) => e.set.area === area);
    if (q) {
      list = list.filter(
        (e) => e.set.title.includes(q) || (e.set.topic ? e.set.topic.includes(q) : false),
      );
    }
    const sorted = [...list];
    if (sort === 'solves') sorted.sort((a, b) => b.solves - a.solves);
    else if (sort === 'wrong') sorted.sort((a, b) => b.wrong - a.wrong);
    else sorted.sort((a, b) => b.index - a.index);
    return sorted;
  }, [enriched, area, query, sort]);

  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const summary: Stat[] = useMemo(() => {
    const questions = filtered.reduce((n, e) => n + e.set.questions.length, 0);
    const solves = filtered.reduce((n, e) => n + e.solves, 0);
    const assigned = filtered.reduce((n, e) => n + e.usage.academySolves, 0);
    const personal = filtered.reduce((n, e) => n + e.usage.personalSolves, 0);
    return [
      { label: '세트', value: `${filtered.length}개`, hint: `문항 ${questions}개` },
      { label: '누적 풀이', value: `${solves.toLocaleString('en-US')}회`, hint: '배정 + 개인' },
      {
        label: '학원 배정 풀이',
        value: `${assigned.toLocaleString('en-US')}회`,
        hint: '학원이 배정해 푼 횟수',
      },
      {
        label: '개인 학습 풀이',
        value: `${personal.toLocaleString('en-US')}회`,
        hint: '학생이 직접 골라 푼 횟수',
      },
    ];
  }, [filtered]);

  // 영역 안에서 콘텐츠가 아직 없는 세부 유형. 어디를 채워야 하는지 바로 보인다.
  const emptyTopics = useMemo(() => {
    const covered = new Set(sets.map((s) => s.topic).filter(Boolean) as string[]);
    const scope = area === '전체' ? AREAS.flatMap((a) => TOPICS[a]) : TOPICS[area];
    return scope.filter((t) => !covered.has(t));
  }, [sets, area]);

  return (
    <Screen
      wide
      testID="admin-content"
      backFallback="/admin"
      eyebrow="총괄관리자"
      title="콘텐츠"
      lead="영역으로 좁혀 보고, 한 세트를 눌러 문항별 오답률까지 확인해요."
    >
      <AppText variant="caption" tone="tertiary">
        풀이 횟수와 오답률은 프로토타입 테스트 집계입니다. 실제 사용 로그가 아닙니다.
      </AppText>

      <View style={{ gap: spacing.md }}>
        <Chips
          testID="content-area"
          options={areaOptions}
          value={area}
          onChange={(next) => {
            setArea(next);
            setPage(0);
          }}
        />
        <Chips
          testID="content-sort"
          options={SORTS}
          value={sort}
          onChange={(s) => {
            setSort(s);
            setPage(0);
          }}
        />
        <Field
          testID="content-search"
          label="제목·세부 유형 검색"
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setPage(0);
          }}
          placeholder="예: 현대소설, 음운"
          autoCorrect={false}
        />
      </View>

      <StatTiles testID="content-kpi" stats={summary} />

      <Section title={`목록 (${filtered.length}개)`}>
        <Button
          testID="admin-new"
          label="새 문제 등록하기"
          onPress={() => router.push('/admin/new' as never)}
        />
        <Group>
          {pageItems.length ? (
            pageItems.map((e) => (
              <Row
                key={e.set.id}
                testID={`content-row-${e.set.id}`}
                title={e.set.title}
                subtitle={`${e.set.area}${e.set.topic ? ` · ${e.set.topic}` : ''} · ${
                  KIND_LABEL[e.set.kind]
                } · ${e.set.questions.length}문항 · ${e.set.publishToStudents ? '공개' : '비공개'}`}
                meta={`풀이 ${e.solves}회 · 정답률 ${e.usage.avgAccuracy}%`}
                onPress={() => router.push(`/admin/content/${e.set.id}` as never)}
                showChevron
              />
            ))
          ) : (
            <Row title="조건에 맞는 콘텐츠가 없어요" subtitle="영역이나 검색어를 바꿔 보세요" />
          )}
        </Group>
        <Pager
          testID="content-pager"
          total={filtered.length}
          page={page}
          pageSize={PAGE_SIZE}
          onChange={setPage}
        />
      </Section>

      <Section title={`콘텐츠가 없는 세부 유형 (${emptyTopics.length}개)`}>
        <Group>
          {emptyTopics.length ? (
            emptyTopics
              .slice(0, 12)
              .map((t) => <Row key={t} title={t} subtitle="아직 등록된 세트가 없어요" />)
          ) : (
            <Row title="모든 세부 유형에 콘텐츠가 있어요" subtitle="비어 있는 유형이 없습니다" />
          )}
        </Group>
        {emptyTopics.length > 12 ? (
          <AppText variant="caption" tone="tertiary">
            12개만 보여 줘요. 나머지 {emptyTopics.length - 12}개는 영역을 좁혀 확인해요.
          </AppText>
        ) : null}
      </Section>
    </Screen>
  );
}
