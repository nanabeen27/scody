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
  SegmentedControl,
  Pager,
  AppText,
  Icon,
  type SegmentedOption,
  ActionBar,
} from '@/components';
import { useCurrentAccount } from '@/session';
import { useAcademyStaff } from '@/features/academy';
import { useContent } from '@/features/content';
import { useProgress } from '@/features/progress';
import { AREAS, gradeLabel, type ContentSet, type KoreanArea } from '@/data';
import { colors, spacing } from '@/theme/tokens';

const PAGE_SIZE = 10;
const KIND_LABEL = { passage: '지문형', grammar: '문법형' } as const;

type AreaFilter = '전체' | KoreanArea;

/**
 * 우리 학원이 등록한 문제 목록.
 *
 * 학원 메뉴의 `문제`는 등록(행동)이 아니라 우리가 가진 콘텐츠(대상)다 — 등록한 문제를 다시 볼
 * 화면이 없어서 몇 개를 가졌는지도, 어떤 문항을 냈는지도 확인할 수 없었다.
 * **운영자 공개 콘텐츠는 여기 두지 않는다** — 이 화면은 "우리가 만든 것"이고, 둘을 함께 고르는
 * 일은 학습 배정이 맡는다(D-062의 출처 필터).
 */
export default function AcademyContentList() {
  const router = useRouter();
  const account = useCurrentAccount();
  const { sets } = useContent();
  const { assignments, loading: progressLoading } = useProgress();
  const { classesFor } = useAcademyStaff();
  const [area, setArea] = useState<AreaFilter>('전체');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  // 다른 학원 콘텐츠는 보이지 않는다(마스터 플랜 2절).
  const mine = useMemo(
    () => sets.filter((s) => !!s.ownerAcademyName && s.ownerAcademyName === account.academyName),
    [sets, account.academyName],
  );

  /**
   * 내가 볼 수 있는 반에 낸 횟수(원장은 학원 전체, 선생님은 담당 반).
   *
   * **반 목록은 세션 스냅샷에서 온다.** 예전에는 `ACADEMY_CLASSES` fixture를 배정과 맞춰
   * 봤는데, fixture의 반 id는 `c_kor1` 같은 문자열이고 서버 `class_id`는 uuid라서 **어떤
   * 배정도 걸리지 않았다** — 이 숫자는 구조적으로 항상 0이었다.
   */
  const assignedCount = useMemo(() => {
    const ours = new Set(classesFor(account).map((c) => c.id));
    const map: Record<string, number> = {};
    for (const a of assignments) {
      if (!a.contentId || !ours.has(a.classId)) continue;
      map[a.contentId] = (map[a.contentId] ?? 0) + 1;
    }
    return map;
  }, [assignments, classesFor, account]);

  const areaOptions: readonly SegmentedOption<AreaFilter>[] = useMemo(
    () => [
      { value: '전체', label: '전체', count: mine.length },
      ...AREAS.map((a) => ({
        value: a as AreaFilter,
        label: a,
        count: mine.filter((s) => s.area === a).length,
      })),
    ],
    [mine],
  );

  const filtered = useMemo(() => {
    const q = query.trim();
    let list = mine;
    if (area !== '전체') list = list.filter((s) => s.area === area);
    if (q) list = list.filter((s) => s.title.includes(q));
    // 최근 등록이 위로. 등록 시각이 없어 목록에 쌓인 순서를 뒤집어 쓴다.
    return [...list].reverse();
  }, [mine, area, query]);

  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  /** 한 줄 설명. 학년·영역·세부 유형·유형·문항 수를 그대로 말한다. */
  const describe = (s: ContentSet) =>
    [s.grade ? gradeLabel(s.grade) : null, s.area, s.topic, KIND_LABEL[s.kind]]
      .filter(Boolean)
      .join(' · ') + ` · ${s.questions.length}문항`;

  /** 목록이 한 화면을 넘길 때만 좁히는 도구를 둔다 — 결과가 0인 필터는 누를 곳이 아니다(D-062). */
  const narrow = mine.length > PAGE_SIZE;

  return (
    <Screen
      wide
      testID="academy-content"
      title="문제"
      lead="우리 학원이 등록한 문제예요. 배정하면 반 학생에게 전달돼요."
      scrollResetKey={page}
    >
      <AppText variant="caption" tone="tertiary">
        스코디가 제공하는 문제는 이 목록에 없어요. 학습 배정에서 함께 고를 수 있어요.
      </AppText>

      {mine.length === 0 ? (
        <>
          <Group>
            <View style={{ padding: spacing.lg, gap: spacing.xs }}>
              <AppText tone="secondary">아직 등록한 문제가 없어요.</AppText>
              <AppText variant="caption" tone="tertiary">
                등록하면 여기에 모이고, 배정에서 골라 반 학생에게 낼 수 있어요.
              </AppText>
            </View>
          </Group>
          {/* 다른 화면으로 보내는 버튼이라 전폭으로 늘리지 않는다(D-047) — 그래서 `hug`이고,
              `ActionBar`가 줄의 오른쪽 끝에 세운다(§8 규칙 ③). */}
          <ActionBar>
            <Button
              testID="academy-content-new"
              hug
              label="문제 등록하기"
              trailing={<Icon name="arrow-right" size={16} color={colors.accentText} />}
              onPress={() => router.push('/academy/content/new' as never)}
            />
          </ActionBar>
        </>
      ) : (
        <>
          {narrow ? (
            <View style={{ gap: spacing.md }}>
              <SegmentedControl
                testID="academy-content-area"
                options={areaOptions}
                value={area}
                onChange={(next) => {
                  setArea(next);
                  setPage(0);
                }}
              />
              <Field
                label="제목으로 찾기"
                testID="academy-content-search"
                value={query}
                onChangeText={(t) => {
                  setQuery(t);
                  setPage(0);
                }}
                placeholder="예: 맞춤법"
                autoCorrect={false}
              />
            </View>
          ) : null}

          <Section
            title={`등록한 문제 ${mine.length}개`}
            /* 목록으로 가는 보조 행동이라 제목 옆 `sm`이다 — 운영자 문제 목록과 같은 모양(§20). */
            action={
              <Button
                testID="academy-content-new"
                variant="secondary"
                tone="accent"
                size="sm"
                hug
                label="문제 등록하기"
                onPress={() => router.push('/academy/content/new' as never)}
              />
            }
          >
            <Group>
              {pageItems.length ? (
                pageItems.map((s) => (
                  <Row
                    key={s.id}
                    testID={`academy-content-row-${s.id}`}
                    title={s.title}
                    subtitle={describe(s)}
                    /* 아직 못 읽은 값을 0회로 단정하지 않는다 — 없는 것과 모르는 것은 다르다. */
                    trailing={
                      progressLoading ? undefined : (
                        <AppText variant="label" tone="secondary">
                          배정 {assignedCount[s.id] ?? 0}회
                        </AppText>
                      )
                    }
                    onPress={() => router.push(`/academy/content/${s.id}` as never)}
                  />
                ))
              ) : (
                <Row title="조건에 맞는 문제가 없어요" subtitle="영역이나 검색어를 바꿔 보세요" />
              )}
            </Group>
            {progressLoading ? (
              <AppText variant="caption" tone="secondary">
                배정 횟수를 불러오고 있어요.
              </AppText>
            ) : null}
            {filtered.length > PAGE_SIZE ? (
              <Pager
                testID="academy-content-pager"
                total={filtered.length}
                page={page}
                pageSize={PAGE_SIZE}
                onChange={setPage}
              />
            ) : null}
          </Section>
        </>
      )}
    </Screen>
  );
}
