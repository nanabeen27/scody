import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import {
  Screen,
  Section,
  Group,
  Row,
  Button,
  AppText,
  BarRow,
  ActionBar,
  LoadFailed,
} from '@/components';
import { useCurrentAccount, useSession } from '@/session';
import { formatDate, formatDuration } from '@/features/learning';
import { useChildReport, RANK_MIN_SUBMITTERS } from '@/features/report';
import { spacing } from '@/theme/tokens';

/** 반에서 어느 구간인지. 정확한 등수보다 압박이 적고, 등수와 함께 두면 뜻이 분명해진다. */
function band(rank: number, submitters: number): string {
  const pct = rank / submitters;
  if (pct <= 1 / 3) return '상위권';
  if (pct <= 2 / 3) return '중위권';
  return '하위권';
}

/**
 * 자녀 리포트 자세히 보기.
 *
 * 핵심 리포트는 짧게 두고 세부는 이 화면으로 넘긴다 — 휴대폰에서 한 화면에 다 펴면
 * 학부모가 무엇부터 볼지 알 수 없다. 여기 있는 값은 전부 그 달 기준이다.
 *
 * 맨 아래 `이 리포트가 말하지 않는 것`은 장식이 아니다. 없는 것을 있다고 오해하지 않게
 * 무엇을 왜 두지 않았는지 밝힌다.
 */
export default function ParentDetail() {
  const router = useRouter();
  const account = useCurrentAccount();
  const { childrenOf } = useSession();
  const { child: childId, month } = useLocalSearchParams<{ child?: string; month?: string }>();
  const child = childrenOf(account.userId).find((c) => c.userId === childId);
  const r = useChildReport(childId ?? '', month);

  /*
    **연결이 아니라 조회가 문제일 수 있다.** 이 갈래는 세션 스냅샷만 보므로(`childrenOf`)
    조회 상태와 무관하게 판정할 수 있다 — 그래서 권한 문장은 여기에만 둔다.
    학습 기록이 아직 오지 않은 것은 아래에서 따로 말한다.
  */
  if (!child) {
    return (
      <Screen testID="parent-detail" backFallback="/parent/report" title="자녀를 찾을 수 없어요">
        <AppText tone="secondary">연결된 자녀만 볼 수 있어요.</AppText>
        <ActionBar>
          <Button
            variant="secondary"
            label="리포트로 갈게요"
            onPress={() => router.replace('/parent/report' as never)}
          />
        </ActionBar>
      </Screen>
    );
  }

  const { academySubmit, onTime, bySource } = r;
  const ranked = r.rows.filter((x) => x.source === 'academy' && x.cls);
  const maxDay = Math.max(...r.byDay.map((d) => d.questions), 1);
  const maxLoad = Math.max(...r.byWeekday.map((d) => d.count), 1);
  const perQuestion =
    r.totals.questions > 0 ? Math.round(r.totals.timeSec / r.totals.questions) : 0;
  // 어느 갈래에서도 같은 제목과 같은 이탈 경로를 쓴다 — 상태에 따라 나가는 길이 달라지지 않게.
  const back = `/parent/report?child=${child.userId}&month=${r.month}`;
  const title = `${child.name} 님 ${r.label} 자세히`;

  /*
    **읽는 중 · 실패 · 없음을 셋으로 가른다**(§9 · D-136 · D-168 · 기준 구현 `app/student/index.tsx`).
    이 화면은 조회 중에도 `{N}월에는 푼 학습이 없어요`라고 말했다 — 리포트에서 `자세히 보기`를
    누르면 조회가 다시 도는 창이 있어서, 학부모는 방금 지표를 본 달을 비었다고 읽었다.
  */
  /** **다시 조회가 도는 중**(첫 조회가 아니다). 실패 줄의 버튼이 그 사이 라벨로 진행을 말한다. */
  const retrying = r.loading && r.loaded;
  /** 이 화면이 셀 것이 손에 하나도 없다(그 달 학습 · 담긴 오답 · 학원 배정 전부). */
  const nothing = r.totals.count === 0 && r.notes.total === 0 && academySubmit.assigned === 0;
  /**
   * 실패 자리. 이 화면의 모든 값이 같은 두 조회에서 오므로 면은 하나다(§9).
   *
   * `again`은 **이미 읽어 둔 값이 화면에 있을 때만** 준다(§9) — 그 화면은 지금 값을 보여 주고
   * 있으므로 `불러오지 못했어요`만 쓰면 아무것도 못 읽은 것처럼 읽힌다. 손에 아무것도 없는
   * 갈래(바로 아래 `nothing`)는 처음부터 못 읽은 것이라 `다시`를 붙이지 않는다.
   */
  const failure = (again: boolean) =>
    r.error ? (
      <LoadFailed
        testID="detail-load-failed"
        retryTestID="detail-load-retry"
        what="기록"
        message={r.error}
        retrying={retrying}
        again={again}
        onRetry={() => void r.reload()}
      />
    ) : null;

  /* 첫 조회 중에는 아무것도 세지 않는다. 문장은 학부모 홈·리포트와 같다. */
  if (!r.loaded) {
    return (
      <Screen testID="parent-detail" backFallback={back} title={title}>
        <AppText variant="caption" tone="secondary">
          기록을 불러오고 있어요.
        </AppText>
      </Screen>
    );
  }

  /* 손에 아무것도 없는데 조회가 실패했다면 `없어요`는 거짓이다 — 실패만 말한다(D-136). */
  if (nothing && r.error) {
    return (
      <Screen testID="parent-detail" backFallback={back} title={title}>
        {failure(false)}
      </Screen>
    );
  }

  return (
    <Screen testID="parent-detail" backFallback={back} title={title}>
      {/* 실패했지만 읽어 둔 값이 있을 때. 가진 것은 여전히 사실이라 지우지 않는다(D-136). */}
      {failure(true)}

      {r.totals.count === 0 ? (
        <Group>
          <View style={{ padding: spacing.lg }}>
            <AppText tone="secondary">{r.label}에는 푼 학습이 없어요.</AppText>
          </View>
        </Group>
      ) : null}

      {/* 1. 학원 과제 — 냈는지, 제때 냈는지, 어느 요일에 몰렸는지 */}
      {academySubmit.assigned > 0 ? (
        <Section title="학원 과제 현황">
          <Group>
            <Row
              testID="detail-complete"
              title="완료율"
              subtitle={`배정 ${academySubmit.assigned}개 중 ${academySubmit.submitted}개`}
              trailing={
                <AppText variant="label">
                  {Math.round((academySubmit.submitted / academySubmit.assigned) * 100)}%
                </AppText>
              }
            />
            {onTime.total > 0 ? (
              <Row
                testID="detail-ontime"
                title="기한 내 제출"
                subtitle={`제출일과 마감일이 함께 남은 ${onTime.total}개 기준`}
                trailing={
                  <AppText variant="label">
                    {onTime.inTime}/{onTime.total}
                  </AppText>
                }
              />
            ) : null}
          </Group>
          {/*
            달과 무관한 미제출 목록은 여기에 두지 않는다 — 6월 상세에 7월 마감 미제출이
            6월 것으로 읽힌다. 리포트 최상단의 `아직 안 낸 학원 과제`가 그 일을 맡는다.
          */}
          {r.byWeekday.length > 1 && maxLoad > 1 ? (
            <>
              <AppText variant="caption" tone="secondary">
                마감이 어느 요일에 몰렸는지 봐요.
              </AppText>
              <View style={{ gap: spacing.sm }}>
                {r.byWeekday.map((d) => (
                  // 폭은 예전 손막대 그대로다(요일 24 · 값 52). 390에서도 트랙이 남아 한 줄로 그려진다.
                  <BarRow
                    key={d.label}
                    label={d.label}
                    value={(d.count / maxLoad) * 100}
                    note={`${d.count}개`}
                    labelWidth={24}
                    noteWidth={52}
                  />
                ))}
              </View>
            </>
          ) : null}
        </Section>
      ) : null}

      {/* 2. 반에서 — 등수와 구간을 함께. 제출자가 적으면 그리지 않는다(D-050). */}
      {ranked.length > 0 ? (
        <Section title="반에서">
          <Group>
            {ranked.map((x) => (
              <Row
                key={x.itemId}
                testID={`detail-rank-${x.itemId}`}
                title={x.title}
                subtitle={`제출한 ${x.cls!.submitters}명 중 ${x.cls!.rank}번째 · ${band(
                  x.cls!.rank,
                  x.cls!.submitters,
                )}`}
                trailing={
                  <AppText variant="label">
                    {x.accuracy}% / 반 {x.cls!.avg}%
                  </AppText>
                }
              />
            ))}
          </Group>
          {/* 같은 하한을 리포트도 말한다(`ChildReport`) — 같은 사실이 두 말투가 되지 않게. */}
          <AppText variant="caption" tone="secondary">
            제출한 학생이 {RANK_MIN_SUBMITTERS}명보다 적은 과제는 비교하지 않아요.
          </AppText>
        </Section>
      ) : null}

      {/*
        3. 제재·갈래별 — 문항 수를 반드시 함께 낸다.
        앞 섹션이 캡션으로 끝나고 여기는 막대로 시작한다 — 사이에 선이 없으면 어디서 끊기는지 안 보인다.
      */}
      {r.byTopic.length > 0 ? (
        <Section separated title="제재·갈래별 성취도">
          {/*
            **합친 사실을 밝힌다.** 계산(`report.ts`의 `byTopic`)이 개인 학습과 학원 과제를 출처
            구분 없이 누적하는데, 이 섹션이 학원 전용 블록(`학원 과제 현황`·`반에서`) 바로 아래에
            있어 학원 성적으로 읽혔다. 문장은 같은 성질의 `영역별 정답률`이 쓰는 것과 같다
            (`src/components/ChildReport.tsx`) — 같은 사실을 두 문장으로 말하지 않는다.
          */}
          <AppText variant="caption" tone="secondary">
            학원 과제와 개인 학습을 합쳐 셌어요. 자녀가 푼 학습만 나와요. 유형마다 세트가 하나뿐인
            경우가 많아 문항 수를 함께 봐 주세요.
          </AppText>
          {/*
            제재 이름은 길어서 좁은 화면에서는 트랙이 남지 않는다. 어디서 쌓을지는 `BarRow`가
            컬럼 폭으로 판단한다 — 손으로 쌓아 두면 데스크톱에서도 계속 쌓인다.
          */}
          <View style={{ gap: spacing.md }}>
            {r.byTopic.map((t) => (
              <BarRow
                key={t.topic}
                label={t.topic}
                value={t.rate}
                note={`${t.rate}% · ${t.total}문항`}
              />
            ))}
          </View>
        </Section>
      ) : null}

      {/* 4. 일별 학습 */}
      {r.byDay.length > 0 ? (
        <Section separated title="날짜별 학습">
          <View style={{ gap: spacing.sm }}>
            {r.byDay.map((d) => (
              // 날짜 64 · 값 52로 예전 폭을 그대로 둔다.
              <BarRow
                key={d.date}
                label={formatDate(d.date)}
                value={(d.questions / maxDay) * 100}
                note={`${d.questions}문항`}
                labelWidth={64}
                noteWidth={52}
              />
            ))}
          </View>
          <AppText variant="caption" tone="secondary">
            한 번에 여러 학습을 풀면 같은 날로 묶여요.
          </AppText>
        </Section>
      ) : null}

      {/* 5. 시간 — 벽시계 시간임을 밝힌다 */}
      {perQuestion > 0 ? (
        <Section title="풀이 시간">
          <Group>
            <Row
              testID="detail-per-question"
              title="문항당 평균"
              subtitle="학습 하나를 시작해 제출할 때까지의 시간을 문항 수로 나눈 값이에요"
              trailing={<AppText variant="label">{formatDuration(perQuestion)}</AppText>}
            />
            <Row
              title={`${r.label} 학습 시간`}
              subtitle="화면을 켜 둔 시간도 포함돼요. 순공부 시간은 아니에요"
              trailing={<AppText variant="label">{formatDuration(r.totals.timeSec)}</AppText>}
            />
          </Group>
        </Section>
      ) : null}

      {/* 6. 오답노트 — '복습률'이 아니라 '정리율'이다 */}
      <Section title="오답노트">
        {/*
          **빈 카드를 남기지 않는다**(§9). 담은 오답이 하나도 없으면 이 섹션이 `0개 · — · 0개`
          세 줄로 서서, 아무 뜻도 없는 자리가 화면에서 가장 큰 블록이 됐다. 문장은 리포트가 같은
          사실을 말할 때 쓰는 것과 같다(`src/components/ChildReport.tsx`).
        */}
        {r.notes.added === 0 && r.notes.total === 0 ? (
          <Group>
            <View style={{ padding: spacing.lg }}>
              <AppText tone="secondary">{r.label}에 담아 둔 오답이 없어요.</AppText>
            </View>
          </Group>
        ) : (
          <Group>
            <Row
              testID="detail-notes"
              title={`${r.label}에 담은 오답`}
              subtitle={`지금까지 모두 ${r.notes.total}개`}
              trailing={<AppText variant="label">{r.notes.added}개</AppText>}
            />
            <Row
              testID="detail-organized"
              title="AI와 정리한 비율"
              subtitle="담은 오답 중 메모로 정리한 비율이에요"
              trailing={
                <AppText variant="label">
                  {r.notes.added > 0
                    ? `${Math.round((r.notes.organized / r.notes.added) * 100)}%`
                    : '—'}
                </AppText>
              }
            />
            <Row
              title="별표"
              subtitle="자녀가 다시 볼 것으로 골라 둔 문항이에요"
              trailing={<AppText variant="label">{r.notes.starred}개</AppText>}
            />
          </Group>
        )}
      </Section>

      {/* 7. 개인 학습과 학원 과제 비율 */}
      {r.totals.count > 0 ? (
        <Section title="스스로 한 공부의 비중">
          <Group>
            <Row
              testID="detail-ratio"
              title="개인 학습"
              subtitle={`학원 과제 ${bySource.academy.count}개 · 개인 학습 ${bySource.personal.count}개`}
              trailing={
                <AppText variant="label">
                  {Math.round((bySource.personal.count / r.totals.count) * 100)}%
                </AppText>
              }
            />
          </Group>
          <AppText variant="caption" tone="secondary">
            시킨 공부만 하는지, 스스로 고른 공부도 하는지 봐요.
          </AppText>
        </Section>
      ) : null}

      {/*
        8. 없는 것을 밝힌다. 학부모가 이 리포트로 판단하는 범위를 정확히 알아야 한다.
      */}
      <Section title="이 리포트가 말하지 않는 것">
        {/* 네 문장을 목록으로 둔다 — 캡션 네 단락은 위계가 없어 읽히지 않는다. */}
        <Group>
          <Row
            title="또래·전국 평균"
            subtitle="비교할 만한 기록이 아직 모이지 않았어요. 반 비교는 같은 반 친구들이 실제로 낸 결과에서만 계산해요."
          />
          <Row
            title="문항별 능력"
            subtitle="추론·요약처럼 문제마다 어떤 능력을 묻는지 표시가 붙어 있지 않아 나누지 못해요."
          />
          <Row
            title="읽는 속도와 답 변경 습관"
            subtitle="기록하지 않아요. 학습 하나에 걸린 시간만 남아요."
          />
          <Row
            title="등급이나 예상 점수"
            subtitle="등급이나 예상 점수는 만들지 않아요. 근거가 되는 자료가 없어요."
          />
        </Group>
      </Section>
    </Screen>
  );
}
