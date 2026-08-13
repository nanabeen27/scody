import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Screen,
  Section,
  Group,
  Row,
  AppText,
  SourceBadge,
  Table,
  type Column,
  type Source,
} from '@/components';
import * as M from '@/features/adminMetrics';
import { spacing } from '@/theme/tokens';

/**
 * 지표 사전.
 *
 * **메뉴가 아니다.** 총괄관리자 내비는 6개로 고정이고(D-017) 이 화면은 개요의
 * `지표 사전 보기` 행에서 들어온다. 그래서 `backFallback`이 있다.
 *
 * **정의를 여기서 다시 쓰지 않는다.** 이름·수식·설명·출처는 전부
 * `src/features/adminMetrics.ts`의 `METRICS`에서 가져온다. 화면에 정의를 옮겨 적으면 두 곳이
 * 갈린다(metric drift) — 이 레포는 그 결함을 이미 두 번 고쳤다(D-048·D-061).
 *
 * **구성 순서**: 시간 축 → 활성의 정의 → 지표 목록 → 마일스톤 검증 → 아직 값을 낼 수 없는 지표 →
 * 만들지 않은 지표 → 코호트 읽는 법. 활성을 앞에 두는 이유는 다른 지표가 전부 그 판정에 걸려
 * 있어서다.
 *
 * 카드를 쓰지 않는다 — 지표 타일(`StatTiles`)을 두지 않고, 목록은 `Group`+`Row`,
 * 나란히 비교하는 곳은 `Table`이다.
 */
export default function AdminMetrics() {
  const overview = M.useAdminOverview();
  const activityQuery = M.useActivityData();
  const remote = M.useCombined(overview, activityQuery);

  const activity = useMemo(
    () =>
      M.activityStats(
        activityQuery.data?.events ?? [],
        activityQuery.data?.daily ?? [],
        overview.data?.students ?? 0,
      ),
    [activityQuery.data, overview.data],
  );
  const predict = useMemo(
    () =>
      M.activationPredictiveness(
        activityQuery.data?.signups ?? [],
        activityQuery.data?.events ?? [],
        activity,
      ),
    [activityQuery.data, activity],
  );
  const growth = useMemo(
    () => M.growth(activityQuery.data?.events ?? [], activity),
    [activityQuery.data, activity],
  );
  const cohorts = useMemo(
    () =>
      M.cohorts(activityQuery.data?.signups ?? [], activityQuery.data?.events ?? [], activity),
    [activityQuery.data, activity],
  );

  const rows = useMemo(
    () => Object.entries(M.METRICS).map(([key, def]) => ({ key, def })),
    [],
  );
  const milestoneOk = predict.ratio != null && predict.ratio >= M.MILESTONE_MIN_RATIO;

  /** 지금 값을 낼 수 없는 지표와 그 이유. 목록을 손으로 적지 않고 계산에서 받아 온다. */
  const blocked = [
    { label: M.METRICS.activation.label, reason: predict.reason },
    { label: M.METRICS.churn.label, reason: growth.reason },
    { label: M.METRICS.quickRatio.label, reason: growth.reason },
    { label: M.METRICS.cc.label, reason: growth.reason },
    { label: '주간 코호트 잔존', reason: cohorts.reason },
  ].filter((b): b is { label: string; reason: string } => !!b.reason);

  return (
    <Screen
      wide
      testID="admin-metrics"
      backFallback="/admin"
      title="지표 사전"
      lead="운영자 화면의 숫자가 무엇을 세는지, 어떻게 오작동할 수 있는지 모아 뒀어요."
    >
      {/* 1. 시간 축과 기록 기간. 다른 무엇보다 먼저 밝힌다. */}
      <View style={styles.notice}>
        <AppText variant="label">{M.asOfLabel(overview.data, activity)}</AppText>
        <AppText variant="caption" tone="secondary">
          모든 화면이 실제 오늘을 봐요. 예전에는 운영자 지표만 고정 기준일을 쓰고 합성 활동
          데이터로 계산했는데, 이제 학습 이벤트가 원천이라 두 축을 나눌 이유가 없어요.
        </AppText>
        <AppText variant="caption" tone="secondary">
          활동 기록은 서버를 붙인 날부터 쌓여요. 그래서 기록보다 긴 기간이 필요한 지표는 값 대신
          그 사실을 적어요 — 0으로 채우면 &ldquo;활동이 없다&rdquo;로 읽히는데 사실은 &ldquo;아직
          모른다&rdquo;예요.
        </AppText>
        {remote.error ? (
          <AppText variant="caption" tone="secondary">
            기록 기간을 읽지 못했어요. {remote.error}
          </AppText>
        ) : null}
      </View>

      {/* 2. 활성의 정의. 다른 모든 지표가 여기 걸린다. */}
      <Section title="활성의 정의">
        {/* `쓰는 지표` 열은 모바일에서 접힌다(priority 2). 그러면 두 열이 폭에 들어와 가로
            스크롤이 필요 없다 — 그래서 `minWidth`를 주지 않는다. */}
        <Table
          testID="metrics-active"
          columns={activeColumns()}
          rows={ACTIVE_DEFS}
          rowKey={(r) => r.key}
          rowLabel={(r) => `${r.name}: ${r.rule}. 쓰는 지표 ${r.used}`}
          empty={{ title: '정의가 없어요' }}
        />
        <AppText variant="caption" tone="secondary">
          로그인은 활성이 아니에요. 알림을 눌러 화면만 열어도 세어지면 활성이 부풀려지고, 그 값은
          학생이 무엇을 받았는지 말해 주지 않아요. 그래서 활성은 문제를 푸는 행동으로 잡아요.
        </AppText>
        {/* 화면에 내부 표·컬럼 이름을 쓰지 않는다 — 읽는 사람은 운영자다. */}
        <AppText variant="caption" tone="tertiary">
          활성과 완료는 학생이 실제로 남긴 학습 기록에서 세요. 이탈 판정 창은{' '}
          {M.CHURN_WINDOW_DAYS}일이에요 — 7·14일로 두면 방학과 시험 주가 이탈로 잡혀요.
        </AppText>
      </Section>

      {/* 3. 지표 목록. 값은 개요에 있고 여기는 정의만 둔다. */}
      <Section title={`지표 ${rows.length}개`}>
        <AppText variant="caption" tone="secondary">
          행을 누르면 무엇을 뜻하는지와 가짜 상승 경로를 볼 수 있어요. 정의만 적어 두면 숫자가
          올랐을 때 좋은 일인지 판단할 근거가 없어요.
        </AppText>
        {/*
          `minWidth`를 주지 않는다. 코호트·성장 표는 숫자라 가로 스크롤이 통하지만, 수식은 읽는
          글이라 옆으로 밀어 읽게 하면 문장이 끊긴다. 좁은 화면에서는 수식 열이 줄바꿈하도록
          두고 세 열을 모두 보인다.
        */}
        <Table
          testID="metrics-list"
          columns={metricColumns()}
          rows={rows}
          rowKey={(r) => r.key}
          rowLabel={(r) => `${r.def.label}, 수식 ${r.def.formula}, 출처 ${r.def.source}`}
          expand={(r) => (
            <View style={styles.expand}>
              <AppText variant="caption" tone="secondary">
                {r.def.desc}
              </AppText>
              {r.def.fake ? (
                <AppText variant="caption">가짜 상승 경로 · {r.def.fake}</AppText>
              ) : (
                <AppText variant="caption" tone="tertiary">
                  가짜 상승 경로는 아직 적어 두지 않았어요.
                </AppText>
              )}
            </View>
          )}
          empty={{ title: '지표 사전이 비어 있어요' }}
        />
        <AppText variant="caption" tone="tertiary">
          추이는 완성된 주까지만 그려요. 오늘이 주 중간이면 마지막 점이 2~3일치라 값이 절반으로
          떨어져 보여요.
        </AppText>
        <AppText variant="caption" tone="tertiary">
          비율 지표의 변화는 %p로, 나머지는 %로 읽어요. 섞으면 부호가 뒤집혀 읽혀요.
        </AppText>
      </Section>

      {/* 4. 마일스톤 검증. 예측하지 못하는 마일스톤은 올려도 뜻이 없다. */}
      {/* 앞 섹션도 문단 글로 끝난다. 경계가 없으면 표 설명이 이어지는 글로 읽힌다. */}
      <Section separated title="Activation 마일스톤이 리텐션을 예측하나요">
        <AppText variant="caption" tone="secondary">
          {M.METRICS.activation.label} · {M.METRICS.activation.formula}
        </AppText>
        <AppText variant="caption" tone="secondary">
          {M.METRICS.activation.desc}
        </AppText>
        <Group>
          <Row
            testID="metrics-predict-reached"
            title="도달군의 28일 잔존"
            subtitle={`가입 ${M.ACTIVATION_DAYS}일 안에 학습을 1건 완료한 사람`}
            trailing={<Val loading={remote.loading} value={predict.reached} suffix="%" />}
          />
          <Row
            testID="metrics-predict-missed"
            title="미도달군의 28일 잔존"
            subtitle="같은 기간에 완료가 없던 사람"
            trailing={<Val loading={remote.loading} value={predict.missed} suffix="%" />}
          />
          <Row
            testID="metrics-predict-ratio"
            title="예측력"
            subtitle={`도달군 ÷ 미도달군. ${M.MILESTONE_MIN_RATIO}배 이상이어야 마일스톤을 쓸 수 있어요`}
            trailing={<Val loading={remote.loading} value={predict.ratio} suffix="배" digits={2} />}
          />
        </Group>
        {/* 판정할 수 없을 때 판정 문장을 쓰지 않는다 — `0.00배라 마일스톤을 다시 정해야 해요`는 거짓이다. */}
        {predict.reason ? (
          <AppText variant="caption" tone="secondary">
            {predict.reason}.
          </AppText>
        ) : (
          <AppText variant="caption" tone={milestoneOk ? 'secondary' : 'default'}>
            {milestoneOk
              ? `지금은 ${predict.ratio?.toFixed(2)}배라 이 마일스톤을 그대로 써요.`
              : `지금은 ${predict.ratio?.toFixed(2)}배로 ${M.MILESTONE_MIN_RATIO}배 미만이에요. 마일스톤을 다시 정해야 해요 — 이 기준으로 Activation율이 올라도 리텐션이 따라온다고 말할 수 없어요.`}
          </AppText>
        )}
        <AppText variant="caption" tone="tertiary">
          가입 후 {M.CHURN_WINDOW_DAYS}일이 지나지 않은 코호트는 아직 판정할 수 없어 계산에서
          빼요. 활동 기록이 시작되기 전에 가입한 계정도 빼요 — 그 사람들의 첫 7일을 보지 못했어요.
        </AppText>
      </Section>

      {/* 5. 지금 값을 낼 수 없는 지표. **없는 이유를 밝히는 것이 이 화면의 기능이다.** */}
      <Section title={`지금 값을 낼 수 없는 지표 (${blocked.length}개)`}>
        <Group>
          {blocked.length ? (
            blocked.map((b) => (
              <Row
                key={b.label}
                testID={`metrics-blocked-${b.label}`}
                title={b.label}
                subtitle={b.reason}
              />
            ))
          ) : (
            <Row
              title={remote.loading ? '기록 기간을 읽고 있어요' : '모든 지표에 값이 있어요'}
              subtitle={remote.loading ? '' : '기록이 충분히 모였어요'}
            />
          )}
        </Group>
        <AppText variant="caption" tone="tertiary">
          지표를 지우지 않고 값만 비워요. 무엇을 세려 했는지가 사라지면 기록이 쌓인 뒤에 다시
          발명해야 해요.
        </AppText>
      </Section>

      {/* 6. 만들지 않은 지표. 없는 이유를 밝히는 것이 이 화면의 기능이다(D-051과 같은 판단). */}
      <Section title="만들지 않은 지표와 이유">
        <Group>
          <Row
            title="LTV · CAC · Payback"
            subtitle="획득 비용 기록이 없고 마진을 발명해야 해요. 지어낸 마진으로 계산한 회수 기간은 판단 근거가 못 돼요"
          />
          <Row
            title="NRR"
            subtitle="개인 구독에 확장 개념이 없고 학원 좌석 변경 이력도 없어요. 그래서 해지만 반영하는 GRR만 둬요"
          />
          <Row
            title="Rolling retention"
            subtitle="'이후에 한 번이라도 돌아왔는지'로 세면 과거 수치가 계속 올라가요. 대시보드에서 지난주와 비교할 수 없어요"
          />
          <Row
            title="외부 벤치마크선"
            subtitle="활성 정의가 출처마다 달라 비교가 성립하지 않아요. 사내 추이만 봐요"
          />
          <Row
            title="규모의 과거 추이"
            subtitle="계정·구독·좌석이 그 시점에 몇이었는지 남긴 기록이 없어요. 지금 값만 말하고 추이 열은 만들지 않아요"
          />
          <Row
            title="또래·전국 평균"
            subtitle="아직 표본이 적어요. 몇 명의 풀이로 낸 값을 평균이라고 부르면 안 돼요"
          />
        </Group>
      </Section>

      {/* 7. 코호트 표 읽는 법. 잘못 읽으면 사고처럼 보이는 자리가 셋 있다. */}
      <Section title="코호트 표를 읽는 법">
        <Group>
          <Row
            title="Day 0은 가입일이에요"
            subtitle="첫 핵심 행동일로 두면 활성화하지 못한 사람이 분모에서 빠져 잔존이 부풀려져요"
          />
          <Row
            title="W0은 강조하지 않아요"
            subtitle="가입한 주라서 정의상 거의 100%예요. 여기가 높은 것은 좋은 신호가 아니에요"
          />
          <Row
            title="아직 오지 않은 주는 비워 둬요"
            subtitle="0%로 채우면 잔존이 떨어진 것처럼 읽혀요"
          />
          <Row
            title="기록 시작 전에 가입한 코호트는 줄을 만들지 않아요"
            subtitle="그 사람들의 활동을 우리가 보지 않았어요. 0%로 적으면 전원 이탈로 읽혀요"
          />
          <Row
            title={`코호트가 ${M.COHORT_MIN_SIZE}명 미만이면 흐리게 둬요`}
            subtitle="그 정도 크기에서는 한 사람이 빠질 때 값이 몇 %p씩 움직여요"
          />
          <Row
            title={`경과 ${M.COHORT_WEEKS}주까지 봐요`}
            subtitle="최근 코호트가 위에 오고, 아래로 갈수록 오래된 코호트예요"
          />
        </Group>
      </Section>
    </Screen>
  );
}

/** 값 한 칸. 판정할 수 없으면 숫자를 쓰지 않는다 — `0.0%`는 "아무도 남지 않았다"로 읽힌다. */
function Val({
  value,
  suffix,
  loading,
  digits = 1,
}: {
  value: number | null;
  suffix: string;
  loading: boolean;
  digits?: number;
}) {
  return (
    <AppText variant="label" numeric>
      {loading ? '읽고 있어요' : value == null ? '판정 불가' : `${value.toFixed(digits)}${suffix}`}
    </AppText>
  );
}

/* ────────────────────────── 활성 판정 ────────────────────────── */

interface ActiveDef {
  key: string;
  name: string;
  rule: string;
  /** 이 판정에 걸리는 지표. 이름은 지표 사전에서 가져온다. */
  used: string;
}

/**
 * 세 가지 판정. `learning_events`의 두 종류와 이탈 창이 그대로 대응한다.
 * 지표 이름은 `METRICS`에서 가져와 여기서 다시 쓰지 않는다.
 */
const ACTIVE_DEFS: readonly ActiveDef[] = [
  {
    key: 'active',
    name: '활성',
    rule: '그 날 문항 1개 이상 답을 저장했어요',
    used: [M.METRICS.wau, M.METRICS.mau, M.METRICS.dau, M.METRICS.stickiness]
      .map((d) => d.label)
      .join(' · '),
  },
  {
    key: 'done',
    name: '학습 완료',
    rule: '그 날 학습 1건을 제출해 끝냈어요. 활성의 부분집합이에요',
    used: [M.METRICS.wal, M.METRICS.activation].map((d) => d.label).join(' · '),
  },
  {
    key: 'churn',
    name: '이탈',
    rule: `${M.CHURN_WINDOW_DAYS}일 연속 활성이 0건이에요`,
    used: [M.METRICS.churn, M.METRICS.quickRatio, M.METRICS.cc].map((d) => d.label).join(' · '),
  },
];

function activeColumns(): Column<ActiveDef>[] {
  return [
    {
      key: 'name',
      header: '구분',
      width: 84,
      cell: (r) => <AppText variant="label">{r.name}</AppText>,
    },
    {
      key: 'rule',
      header: '판정 기준',
      cell: (r) => (
        <AppText variant="caption" tone="secondary">
          {r.rule}
        </AppText>
      ),
    },
    {
      key: 'used',
      header: '쓰는 지표',
      priority: 2,
      cell: (r) => (
        <AppText variant="caption" tone="secondary">
          {r.used}
        </AppText>
      ),
    },
  ];
}

/* ────────────────────────── 지표 목록 ────────────────────────── */

interface MetricRow {
  key: string;
  def: M.MetricDef;
}

function metricColumns(): Column<MetricRow>[] {
  return [
    {
      key: 'label',
      header: '지표',
      width: 132,
      cell: (r) => (
        <View style={styles.nameCell}>
          <AppText variant="label">{r.def.label}</AppText>
          {r.def.fake ? (
            <AppText variant="caption" tone="tertiary">
              가짜 상승 경로 있음
            </AppText>
          ) : null}
        </View>
      ),
    },
    {
      key: 'formula',
      header: '수식',
      cell: (r) => (
        <AppText variant="caption" tone="secondary">
          {r.def.formula}
        </AppText>
      ),
    },
    {
      /*
        이제 `MetricSource`와 배지의 `Source`가 같은 낱말을 쓴다(`실측`·`추정`) — 예전에는
        `실측(세션)`이라 배지로 옮겨 적어야 했고, 그 옮겨 적기가 바로 이 화면이 막으려는
        drift였다. 같은 값이므로 배지를 그대로 쓴다.
      */
      key: 'source',
      header: '출처',
      width: 64,
      cell: (r) => <SourceBadge source={r.def.source as Source} />,
    },
  ];
}

const styles = StyleSheet.create({
  notice: { gap: spacing.sm },
  nameCell: { gap: 2 },
  expand: { gap: spacing.xs },
});
