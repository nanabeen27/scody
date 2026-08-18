import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Screen,
  Section,
  Group,
  Row,
  Button,
  Field,
  SegmentedControl,
  Pager,
  useTableSort,
  AppText,
  Table,
  type SegmentedOption,
  type Column,
} from '@/components';
import { useContent } from '@/features/content';
import { AREAS, TOPICS, gradeLabel, type KoreanArea, type ContentSet } from '@/data';
import { errorMessage } from '@/lib/supabase';
import { contentUsageAll, type BulkUsage } from '@/repo/content';
import { spacing } from '@/theme/tokens';

const PAGE_SIZE = 10;

/** 목록 아래 보조 섹션에서 미리 보여 주는 빈 유형 수. 좁혀 왔을 때는 전부 보여 준다. */
const EMPTY_PREVIEW = 12;

/**
 * 열 정렬. **한 곳에 두고 컬럼과 정렬 훅이 같은 값을 가리킨다.** 오름차순으로 정의하고
 * 내림차순은 표가 뒤집는다. 기본 순서(최근 등록순 · 좁혔을 때는 점검 문항 많은 순)는
 * `filtered`가 이미 세워 둔 그대로다.
 */
const COMPARE: Record<string, (a: ContentRow, b: ContentRow) => number> = {
  hard: (a, b) => a.hard - b.hard,
  title: (a, b) => a.set.title.localeCompare(b.set.title),
  questions: (a, b) => a.set.questions.length - b.set.questions.length,
  solves: (a, b) => a.solves - b.solves,
  // 기록이 없는 세트(`null`)는 오름차순에서 맨 뒤다 — 0%로 두면 가장 어려운 세트가 된다.
  // **내림차순(헤더 두 번 클릭)에서는 맨 앞으로 온다**(A-122).
  accuracy: (a, b) => (a.accuracy ?? 101) - (b.accuracy ?? 101),
};


type AreaFilter = '전체' | KoreanArea;

interface ContentRow {
  set: ContentSet;
  /** 등록 순서. 최근 등록순 정렬의 기준이다. */
  index: number;
  solves: number;
  /** 평균 정답률(%). 풀이 기록이 없으면 `null`. */
  accuracy: number | null;
  /** `?wrong=` 기준을 넘는 문항 수. 기준이 없으면 0이다. */
  hard: number;
}

/**
 * `?wrong=`으로 받은 오답률 기준. 범위를 벗어난 값은 무시하고 전체 목록을 보여 준다 —
 * 주소를 손으로 고쳤을 때 빈 화면이 되지 않게.
 */
function wrongThreshold(raw: string | string[] | undefined): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null;
  return Math.round(n);
}

/**
 * `?empty=1`로 좁혀 왔는지. 아는 값(`1`·`true`)만 켜고 나머지는 전체 화면 그대로다 —
 * `?wrong=`과 같은 규칙이다(주소를 손으로 고쳐도 화면이 뒤집히지 않게).
 */
function emptyOnlyFlag(raw: string | string[] | undefined): boolean {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === '1' || v === 'true';
}

/**
 * 콘텐츠 목록. 문항이 수천 개가 되어도 다룰 수 있어야 한다.
 *
 * **정렬은 표 헤더가 맡는다.** 예전에는 영역 칩 아래에 정렬 칩(최근·많이 푼 순·오답률 높은 순)이
 * 또 있어서 무엇이 걸러지고 무엇이 다시 줄 세워지는지 읽히지 않았다 —
 * 목록을 걸러내는 것은 `SegmentedControl`, 같은 목록을 다르게 줄 세우는 것은 표의 열 헤더다(DESIGN.md 8절).
 *
 * **`?wrong=N`을 받는다.** 개요의 `오답률 N% 이상 문항` 알림이 세어 준 것을 여기서 이어 받아
 * 그 기준을 넘는 문항이 있는 세트만 남긴다 — 알림을 눌러 온 사람이 세트 12개를 하나씩 열어
 * 눈으로 훑지 않게 한다. 무엇으로 좁혔는지와 전체로 돌아가는 길을 화면에서 말한다.
 * 문항별 오답률은 상세 화면과 같은 표에서 같은 수식으로 나온다(`contentUsageAll`).
 *
 * **`?empty=1`도 같은 방식으로 받는다.** 개요의 `콘텐츠가 없는 세부 유형 N개` 알림이 세어 준
 * 것을 이어 받아 ① `콘텐츠가 없는 세부 유형` 섹션을 목록보다 **위로** 올리고(그 섹션은 원래
 * 표 10행 + 페이저 아래라, 세어 준 수를 보고 온 사람이 화면 끝까지 내려가야 했다) ② 좁힌 이유와
 * `전체 목록 보기`를 두고 ③ 유형마다 **그 유형이 골라진 등록 폼**으로 가는 길을 둔다. 예전에는
 * 목적지에서 할 수 있는 일이 없어서 유형 이름을 외워 나가 영역·세부 유형을 손으로 다시 골랐다
 * (S-011이 완료 조건으로 걸어 둔 작업의 입구다).
 */
export default function AdminContentList() {
  const router = useRouter();
  const { wrong, empty } = useLocalSearchParams<{ wrong?: string; empty?: string }>();
  /*
    `sets`의 `loading`도 함께 본다. 빈 유형 섹션은 **없다고 말하는 자리**라 조회가 끝나기 전에는
    29개 유형 전부가 비어 보인다(D-133). 등록 폼으로 가는 길이 붙은 뒤로는 그 거짓이 더 비싸다 —
    이미 있는 유형을 채우러 보내게 된다.
  */
  const { sets, loading: setsLoading } = useContent();
  const [area, setArea] = useState<AreaFilter>('전체');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const wrongMin = wrongThreshold(wrong);
  const emptyOnly = emptyOnlyFlag(empty);

  /*
    **사용 집계는 서버에서 한 번에 읽는다.** 예전에는 문항 id를 해시로 돌린 테스트 집계였다.
    조회를 시작할 때 `loading`을 다시 올려 로딩 중에 `0회`가 사실처럼 보이지 않게 한다.
  */
  const [usage, setUsage] = useState<BulkUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void (async () => {
      await Promise.resolve();
      if (!alive) return;
      setLoading(true);
      setError(undefined);
      try {
        const next = await contentUsageAll();
        if (alive) setUsage(next);
      } catch (e) {
        if (alive) setError(errorMessage(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const enriched = useMemo<ContentRow[]>(
    () =>
      sets.map((set, index) => {
        const stat = usage?.bySet.get(set.id);
        const rates = set.questions
          .map((q) => usage?.wrongRateByQuestion.get(q.id))
          .filter((r): r is number => r != null);
        return {
          set,
          index,
          solves: (stat?.academySolves ?? 0) + (stat?.personalSolves ?? 0),
          accuracy: stat && stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : null,
          hard: wrongMin == null ? 0 : rates.filter((r) => r >= wrongMin).length,
        };
      }),
    [sets, usage, wrongMin],
  );

  const areaOptions: readonly SegmentedOption<AreaFilter>[] = useMemo(
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
    if (wrongMin != null) {
      // 점검할 문항이 많은 세트가 위에 온다 — 좁혀서 온 목적이 그것이다.
      return list.filter((e) => e.hard > 0).sort((a, b) => b.hard - a.hard || b.index - a.index);
    }
    // 기본은 최근 등록순. 다른 순서는 열 헤더로 고른다.
    return [...list].sort((a, b) => b.index - a.index);
  }, [enriched, area, query, wrongMin]);


  const totals = useMemo(
    () => ({
      questions: filtered.reduce((n, e) => n + e.set.questions.length, 0),
      solves: filtered.reduce((n, e) => n + e.solves, 0),
      hard: filtered.reduce((n, e) => n + e.hard, 0),
    }),
    [filtered],
  );

  /**
   * 영역 안에서 콘텐츠가 아직 없는 세부 유형. 어디를 채워야 하는지 바로 보인다.
   *
   * **영역을 함께 들고 있는다.** 유형 이름만으로는 등록 폼의 영역을 고를 수 없고(`전체`로 보면
   * 네 영역이 섞인다) 그래서 예전에는 운영자가 유형 이름을 외워 나가 영역부터 다시 골랐다.
   */
  const emptyTopics = useMemo<{ area: KoreanArea; topic: string }[]>(() => {
    const covered = new Set(sets.map((s) => s.topic).filter(Boolean) as string[]);
    const scope: readonly KoreanArea[] = area === '전체' ? AREAS : [area];
    return scope.flatMap((a) =>
      TOPICS[a].filter((t) => !covered.has(t)).map((t) => ({ area: a, topic: t })),
    );
  }, [sets, area]);
  /** 지금 보고 있는 범위의 전체 유형 수. 좁힌 규모를 말할 때 분모가 된다. */
  const topicTotal =
    area === '전체' ? AREAS.reduce((n, a) => n + TOPICS[a].length, 0) : TOPICS[area].length;

  /**
   * 좁혀서 볼 때만 두는 열. 왜 이 세트가 남았는지를 값으로 말한다.
   * `priority: 1`인 이유: 이 기준으로 좁혀서 왔으니 390에서 접히면 안 된다.
   */
  const hardColumn: Column<ContentRow> | null =
    wrongMin == null
      ? null
      : {
          key: 'hard',
          header: '점검 문항',
          width: 84,
          align: 'right',
          sort: COMPARE.hard,
          cell: (r) => `${r.hard}문항`,
        };

  const columns: Column<ContentRow>[] = [
    {
      key: 'title',
      header: '제목',
      cell: (r) => r.set.title,
      sort: COMPARE.title,
    },
    {
      key: 'grade',
      header: '학년',
      width: 56,
      priority: 2,
      cell: (r) => (r.set.grade ? gradeLabel(r.set.grade) : '—'),
    },
    { key: 'area', header: '영역', width: 76, priority: 2, cell: (r) => r.set.area },
    { key: 'topic', header: '세부 유형', width: 132, priority: 3, cell: (r) => r.set.topic ?? '—' },
    {
      key: 'questions',
      header: '문항',
      width: 60,
      align: 'right',
      priority: 2,
      // 오름차순으로 정의한다. 내림차순은 표가 뒤집는다(D-074).
      sort: COMPARE.questions,
      cell: (r) => `${r.set.questions.length}`,
    },
    {
      key: 'solves',
      header: '누적 풀이',
      width: 88,
      align: 'right',
      // 오답률로 좁혀서 왔을 때는 점검 문항 수가 먼저다 — 그때만 이 열을 태블릿부터 보인다.
      priority: wrongMin == null ? 1 : 2,
      sort: COMPARE.solves,
      cell: (r) => `${r.solves.toLocaleString('en-US')}회`,
    },
    ...(hardColumn ? [hardColumn] : []),
    {
      key: 'accuracy',
      header: '평균 정답률',
      width: 92,
      align: 'right',
      // 오답률 높은 순 = 정답률 낮은 순. 먼저 손볼 세트가 위에 온다.
      sort: COMPARE.accuracy,
      // 풀이가 없으면 `0%`가 아니라 `기록 없음`이다.
      cell: (r) => (r.accuracy == null ? '기록 없음' : `${r.accuracy}%`),
    },
  ];

  /**
   * 정렬은 **화면이 쥔다.** 표에 페이지 슬라이스를 넘기므로 표가 스스로 정렬하면 그 10줄
   * 안에서만 줄이 바뀐다(A-050) — 열 헤더를 눌러도 다음 페이지의 행은 섞이지 않았다.
   * 합계 행은 원래부터 전체 모수라, 정렬만 전체로 올리면 둘이 같은 목록을 말한다.
   */
  const sorted = useTableSort(filtered, COMPARE, () => setPage(0));
  const pageItems = sorted.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  /** 화면에 그리는 빈 유형. 좁혀서 온 사람에게 `나머지는 영역을 좁혀 확인해요`는 답이 아니다. */
  const shownEmpty = emptyOnly ? emptyTopics : emptyTopics.slice(0, EMPTY_PREVIEW);

  const listSection = (
    <Section
      title={`목록 (${filtered.length}개)`}
      action={
        <Button
          testID="admin-new"
          hug
          size="sm"
          variant="secondary"
          tone="accent"
          label="새 문제 등록하기"
          onPress={() => router.push('/admin/new' as never)}
        />
      }
    >
      {/* 무엇으로 좁혔는지와 전체로 돌아가는 길을 화면이 말한다. 주소만 아는 상태로 두지 않는다. */}
      {wrongMin != null ? (
        <View style={styles.narrowed}>
          <AppText variant="caption" tone="secondary" style={styles.narrowedText}>
            오답률 {wrongMin}% 이상인 문항이 있는 세트만 남겼어요. {filtered.length}개 세트에{' '}
            {totals.hard}문항이고, 점검할 문항이 많은 세트가 위에 와요.
          </AppText>
          <Button
            testID="content-wrong-clear"
            hug
            size="sm"
            variant="secondary"
            label="전체 목록 보기"
            onPress={() => router.replace('/admin/content' as never)}
          />
        </View>
      ) : null}
      {/*
        출처 배지를 두지 않는다 — 이 표의 모든 값이 실제 풀이 기록에서 나온다. 배지는 성격이
        다른 값이 섞여 있을 때만 뜻이 있다(예전에는 합성 집계와 세션 실측이 한 열에 섞여 있었다).
      */}
      {loading ? (
        <AppText variant="caption" tone="secondary">
          사용 집계를 읽고 있어요.
        </AppText>
      ) : null}
      <Table
        testID="content"
        columns={columns}
        rows={pageItems}
        {...sorted.props}
        rowKey={(r) => r.set.id}
        rowLabel={(r) =>
          `${r.set.title} ${r.set.grade ? gradeLabel(r.set.grade) : ''} ${r.set.area}${
            r.set.topic ? ` ${r.set.topic}` : ''
          }, 문항 ${r.set.questions.length}개, 누적 풀이 ${r.solves}회${
            wrongMin == null ? '' : `, 오답률 ${wrongMin}% 이상 ${r.hard}문항`
          }, 평균 정답률 ${r.accuracy == null ? '기록 없음' : `${r.accuracy}%`}`
        }
        onRowPress={(r) => router.push(`/admin/content/${r.set.id}` as never)}
        footer={{
          title: `이 조건 ${filtered.length}개`,
          questions: `${totals.questions.toLocaleString('en-US')}`,
          solves: `${totals.solves.toLocaleString('en-US')}회`,
          hard: `${totals.hard.toLocaleString('en-US')}문항`,
        }}
        empty={
          wrongMin == null
            ? {
                title: '조건에 맞는 콘텐츠가 없어요',
                subtitle: '영역이나 검색어를 바꿔 보세요',
              }
            : {
                title: `오답률 ${wrongMin}% 이상인 문항이 없어요`,
                subtitle: '영역·검색을 지우거나 전체 목록으로 돌아가 보세요',
              }
        }
      />
      <Pager
        testID="content-pager"
        total={filtered.length}
        page={page}
        pageSize={PAGE_SIZE}
        onChange={setPage}
      />
    </Section>
  );

  /**
   * 콘텐츠가 없는 세부 유형.
   *
   * **행마다 등록 폼으로 가는 길이 있다.** 예전에는 눌리지 않는 행이어서, 여기까지 온 운영자가
   * 유형 이름을 외워 나가 `새 문제 등록하기` → 영역 → 세부 유형을 손으로 다시 골랐다. 지금은
   * 영역·세부 유형이 골라진 폼으로 바로 간다(`/admin/new?area=&topic=`).
   */
  const emptyTopicsSection = (
    <Section
      // 개수는 조회가 끝난 뒤에만 말한다 — 읽는 중에는 29개 유형 전부가 비어 보인다(D-133).
      title={
        setsLoading
          ? '콘텐츠가 없는 세부 유형'
          : `콘텐츠가 없는 세부 유형 (${emptyTopics.length}개)`
      }
    >
      {/* 좁혀 왔으면 좁힌 이유와 전체로 돌아가는 길을 말한다(`?wrong=`과 같은 형태, D-075). */}
      {emptyOnly ? (
        <View style={styles.narrowed}>
          <AppText variant="caption" tone="secondary" style={styles.narrowedText}>
            {setsLoading
              ? '콘텐츠가 없는 세부 유형을 먼저 보여 줘요.'
              : `콘텐츠가 없는 세부 유형을 먼저 보여 줘요. ${
                  area === '전체' ? '전체' : area
                } ${topicTotal}개 유형 중 ${emptyTopics.length}개예요.`}
          </AppText>
          <Button
            testID="content-empty-clear"
            hug
            size="sm"
            variant="secondary"
            label="전체 목록 보기"
            onPress={() => router.replace('/admin/content' as never)}
          />
        </View>
      ) : null}
      {setsLoading ? (
        <AppText variant="caption" tone="secondary">
          세부 유형을 확인하고 있어요.
        </AppText>
      ) : (
        <Group>
          {shownEmpty.length ? (
            shownEmpty.map((e) => (
              <Row
                key={`${e.area}-${e.topic}`}
                testID={`content-empty-${e.topic}`}
                title={e.topic}
                subtitle={`${e.area} · 아직 등록된 세트가 없어요`}
                accessibilityLabel={`${e.area} ${e.topic}, 등록된 세트가 없어요. 문제 등록하기`}
                onPress={() =>
                  router.push(
                    `/admin/new?area=${encodeURIComponent(e.area)}&topic=${encodeURIComponent(
                      e.topic,
                    )}` as never,
                  )
                }
                showChevron
              />
            ))
          ) : (
            <Row title="모든 세부 유형에 콘텐츠가 있어요" subtitle="비어 있는 유형이 없습니다" />
          )}
        </Group>
      )}
      {/*
        예전에는 `나머지 N개는 영역을 좁혀 확인해요`로 끝났다 — 채울 유형을 세어 주고 보는 길은
        운영자에게 떠넘긴 셈이다. 전부 보는 화면으로 가는 길을 함께 둔다.
      */}
      {!setsLoading && !emptyOnly && emptyTopics.length > EMPTY_PREVIEW ? (
        <View style={styles.narrowed}>
          <AppText variant="caption" tone="tertiary" style={styles.narrowedText}>
            {EMPTY_PREVIEW}개만 보여 줘요. 비어 있는 유형은 {emptyTopics.length}개예요.
          </AppText>
          <Button
            testID="content-empty-all"
            hug
            size="sm"
            variant="secondary"
            label="전부 보기"
            onPress={() => router.push('/admin/content?empty=1' as never)}
          />
        </View>
      ) : null}
    </Section>
  );

  return (
    <Screen
      wide
      testID="admin-content"
      title="콘텐츠"
      lead="영역으로 좁혀 보고, 한 세트를 눌러 문항별 오답률까지 확인해요."
      scrollResetKey={page}
    >
      <AppText variant="caption" tone="tertiary">
        누적 풀이와 오답률은 실제 풀이 기록에서 세요. 기록이 없는 세트는 값 대신 그 사실을 적어요.
      </AppText>
      {error ? (
        <AppText variant="caption" tone="secondary">
          사용 집계를 읽지 못했어요. {error}
        </AppText>
      ) : null}

      <View style={{ gap: spacing.md }}>
        <SegmentedControl
          testID="content-area"
          options={areaOptions}
          value={area}
          onChange={(next) => {
            setArea(next);
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

      {/*
        **순서를 쿼리가 정한다.** `?empty=1`로 온 사람의 목적은 비어 있는 유형이라 그것이 먼저다 —
        표 10행과 페이저를 지나 화면 맨 아래에서 찾게 두지 않는다. 그 밖에는 목록이 먼저다.
      */}
      {emptyOnly ? emptyTopicsSection : null}
      {listSection}
      {emptyOnly ? null : emptyTopicsSection}
    </Screen>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  /**
   * 사실 한 줄(문장) + 그에 대한 길(버튼). 좁힌 이유와 `전체 목록 보기`, 미리 보여 준 개수와
   * `전부 보기`가 같은 모양을 쓴다. 좁은 화면에서는 버튼이 아래로 접힌다.
   */
  narrowed: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md },
  narrowedText: { flex: 1, minWidth: 220 },
});
