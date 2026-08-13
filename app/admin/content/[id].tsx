import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Screen,
  Section,
  Group,
  Row,
  Button,
  AppText,
  ProgressBar,
} from '@/components';
import { useContent } from '@/features/content';
import { share } from '@/features/revenue';
import { findContent, gradeLabel } from '@/data';
import { errorMessage } from '@/lib/supabase';
import { academiesAssigning } from '@/repo/admin';
import { contentUsage, emptyUsage, type ContentUsage } from '@/repo/content';
import { spacing } from '@/theme/tokens';

const KIND_LABEL = { passage: '지문형', grammar: '문법형' } as const;
/** 이 오답률부터 해설을 다시 본다. 개요 화면과 같은 기준이다. */
const HARD = 70;
/** 먼저 보여 줄 문항 수. 나머지는 `N개 더 보기`로 펼친다(DESIGN.md 8절). */
const PREVIEW = 5;

/**
 * 콘텐츠 한 세트의 사용 현황.
 *
 * 학원이 배정해 푼 횟수와 학생이 개인 학습에서 직접 골라 푼 횟수를 나눠 보여 주고,
 * 문항별 오답률로 어느 문항이 어려운지 짚는다.
 *
 * **집계는 서버가 한다**(`rpc_content_usage`). 예전에는 문항 id를 해시로 돌려 만든 테스트
 * 집계였고 화면이 그 사실을 배지로 밝혔다. 이제 실제 풀이에서 나오므로 배지가 없다 —
 * 아직 아무도 풀지 않은 세트는 `0회`가 아니라 `기록 없음`이라고 말한다.
 *
 * **지표를 카드로 만들지 않는다** — 한 세트의 소수 지표라 `Group`+`Row` 한 줄이고 값은
 * `trailing`의 `label`이다(D-050). 오답률 막대는 공용 `ProgressBar`를 쓰고, 어려운 문항은
 * 색이 아니라 글자로 밝힌다(DESIGN.md 11절).
 */
export default function AdminContentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sets, loading: contentLoading } = useContent();
  const [showAll, setShowAll] = useState(false);
  const setId = String(id);
  const set = findContent(sets, setId);

  const [usage, setUsage] = useState<ContentUsage | null>(null);
  const [assigned, setAssigned] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  /*
    조회를 시작할 때 다시 `loading`으로 돌린다 — 다른 세트로 옮겨 가는 동안 앞 세트의 수치를
    새 제목 아래에 그리면 화면이 틀린 말을 한다(`ContentProvider`와 같은 순서).
  */
  useEffect(() => {
    let alive = true;
    void (async () => {
      await Promise.resolve();
      if (!alive) return;
      setLoading(true);
      setError(undefined);
      try {
        const [u, a] = await Promise.all([contentUsage(setId), academiesAssigning(setId)]);
        if (!alive) return;
        setUsage(u);
        setAssigned(a);
      } catch (e) {
        if (alive) setError(errorMessage(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [setId]);

  /** 오답률 내림차순 문항. 순서를 화면에서 다시 정하지 않게 한곳에서 만든다. */
  const ranked = useMemo(() => {
    if (!set) return [];
    const rateOf = new Map(
      (usage?.wrongRateByQuestion ?? []).map((q) => [q.questionId, q] as const),
    );
    return set.questions
      .map((q, i) => {
        const stat = rateOf.get(q.id);
        return {
          id: q.id,
          prompt: q.prompt,
          number: i + 1,
          /** 아직 아무도 답하지 않은 문항은 오답률이 없다(0%가 아니다). */
          wrongRate: stat?.wrongRate ?? null,
          answered: stat?.answered ?? 0,
        };
      })
      .sort((a, b) => (b.wrongRate ?? -1) - (a.wrongRate ?? -1));
  }, [set, usage]);

  if (!set) {
    return (
      <Screen
        testID="admin-content-detail"
        backFallback="/admin/content"
        title={contentLoading ? '콘텐츠를 읽고 있어요' : '콘텐츠를 찾을 수 없어요'}
      >
        <Group>
          <Row
            title={contentLoading ? '잠시만 기다려 주세요' : '목록에서 다시 골라 주세요'}
            subtitle={contentLoading ? '' : '삭제되었거나 잘못된 주소예요'}
          />
        </Group>
      </Screen>
    );
  }

  const u = usage ?? emptyUsage(set.id);
  const solves = u.academySolves + u.personalSolves;
  const hardCount = ranked.filter((q) => (q.wrongRate ?? 0) >= HARD).length;
  const shownQuestions = showAll ? ranked : ranked.slice(0, PREVIEW);
  /** 값 자리에 쓰는 문장. 로딩 중에 `0회`가 사실처럼 보이지 않게 한다. */
  const pending = loading ? '읽고 있어요' : error ? '읽지 못했어요' : null;

  return (
    <Screen
      wide
      testID="admin-content-detail"
      backFallback="/admin/content"
      title={set.title}
      lead={`${set.grade ? `${gradeLabel(set.grade)} · ` : ''}${set.area} · ${
        set.topic ? `${set.topic} · ` : ''
      }${KIND_LABEL[set.kind]} · ${set.questions.length}문항`}
    >
      <AppText variant="caption" tone="tertiary">
        풀이 횟수와 오답률은 실제 풀이 기록에서 세요. 기록이 없으면 값 대신 그 사실을 적어요.
      </AppText>
      {error ? (
        <AppText variant="caption" tone="secondary">
          사용 집계를 읽지 못했어요. {error}
        </AppText>
      ) : null}

      <Section title="사용 현황">
        <Group>
          <Row
            title="누적 풀이"
            subtitle="학원 배정 + 개인 학습"
            trailing={
              <AppText variant="label">
                {pending ?? (solves ? `${solves.toLocaleString('en-US')}회` : '기록 없음')}
              </AppText>
            }
          />
          <Row
            title="학원 배정 풀이"
            subtitle={solves ? `전체의 ${share(u.academySolves, solves)}` : '아직 배정으로 푼 기록이 없어요'}
            trailing={
              <AppText variant="label">
                {pending ?? `${u.academySolves.toLocaleString('en-US')}회`}
              </AppText>
            }
          />
          <Row
            title="개인 학습 풀이"
            subtitle={
              solves ? `전체의 ${share(u.personalSolves, solves)}` : '아직 개인 학습으로 푼 기록이 없어요'
            }
            trailing={
              <AppText variant="label">
                {pending ?? `${u.personalSolves.toLocaleString('en-US')}회`}
              </AppText>
            }
          />
          <Row
            title="평균 정답률"
            subtitle={
              u.avgAccuracy == null
                ? '풀이 기록이 모이면 값이 나와요'
                : `오답률 ${100 - u.avgAccuracy}%${
                    hardCount ? ` · 오답률 ${HARD}% 이상 문항 ${hardCount}개` : ''
                  }`
            }
            trailing={
              <AppText variant="label">
                {pending ?? (u.avgAccuracy == null ? '기록 없음' : `${u.avgAccuracy}%`)}
              </AppText>
            }
          />
        </Group>
        <AppText variant="caption" tone="tertiary">
          평균 정답률은 문항 수로 가중한 값이에요. 세트 크기가 달라도 뜻이 유지돼요.
        </AppText>
      </Section>

      <Section
        title="문항별 오답률 · 어려운 문항 먼저"
        action={
          set.questions.length > PREVIEW ? (
            <Button
              testID="detail-q-more"
              hug
              size="sm"
              variant="secondary"
              tone="accent"
              label={showAll ? '접기' : `${set.questions.length - PREVIEW}개 더 보기`}
              onPress={() => setShowAll((v) => !v)}
            />
          ) : null
        }
      >
        <AppText variant="caption" tone="secondary">
          오답률이 높은 문항이 위에 와요. 번호는 세트에서의 문항 순서예요. 오답률 {HARD}% 이상인
          문항에는 해설을 다시 볼 문항이라고 적어 뒀어요.
        </AppText>
        <View style={styles.bars}>
          {shownQuestions.map((q) => (
            <View key={q.id} style={styles.bar} testID={`detail-q-${q.id}`}>
              <View style={styles.barHead}>
                <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.prompt}>
                  {q.number}. {q.prompt}
                </AppText>
                <AppText variant="label" style={styles.rate}>
                  {q.wrongRate == null ? '—' : `${q.wrongRate}%`}
                </AppText>
              </View>
              {/* 아직 답이 없는 문항에는 막대를 그리지 않는다 — 0%짜리 빈 막대는 "쉬운 문항"으로 읽힌다. */}
              {q.wrongRate == null ? (
                <AppText variant="caption" tone="tertiary">
                  아직 이 문항을 푼 기록이 없어요
                </AppText>
              ) : (
                <>
                  <ProgressBar value={q.wrongRate} />
                  <AppText variant="caption" tone="tertiary">
                    {q.answered.toLocaleString('en-US')}명이 답했어요
                  </AppText>
                  {q.wrongRate >= HARD ? (
                    <AppText variant="caption" tone="secondary">
                      해설을 다시 볼 문항이에요
                    </AppText>
                  ) : null}
                </>
              )}
            </View>
          ))}
        </View>
        {showAll || set.questions.length <= PREVIEW ? null : (
          <AppText variant="caption" tone="tertiary">
            오답률이 높은 {PREVIEW}문항만 보여 줘요. 나머지 {set.questions.length - PREVIEW}문항은
            더 보기로 펼쳐요.
          </AppText>
        )}
      </Section>

      <Section title="배정 현황">
        <Group>
          <Row
            title="이 콘텐츠를 배정한 학원"
            subtitle={
              assigned?.length ? assigned.join(', ') : '아직 배정한 학원이 없어요'
            }
            trailing={
              <AppText variant="label">{pending ?? `${assigned?.length ?? 0}곳`}</AppText>
            }
          />
          <Row
            title="개인 학습 공개"
            subtitle={
              set.publishToStudents
                ? '학생이 학습 탭에서 직접 고를 수 있어요'
                : '공개하지 않아 배정으로만 전달돼요'
            }
            trailing={
              <AppText variant="label">{set.publishToStudents ? '공개' : '비공개'}</AppText>
            }
          />
          <Row
            title="콘텐츠 소유"
            subtitle={
              set.ownerAcademyName
                ? `${set.ownerAcademyName}이 등록했어요. 그 학원만 배정할 수 있어요`
                : '운영자가 등록했어요'
            }
            trailing={<AppText variant="label">{set.ownerAcademyName ?? '운영자'}</AppText>}
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
  prompt: { flex: 1 },
  rate: { minWidth: 44, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
