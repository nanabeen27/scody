import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Screen,
  Section,
  Group,
  Row,
  AppText,
  BarRow,
  Sparkline,
  sparkLabel,
  SourceBadge,
  Table,
  SegmentedControl,
  AccountSettings,
  type Column,
  type Source,
} from '@/components';
import { useContent } from '@/features/content';
import { usePricing, won } from '@/features/pricing';
import { share } from '@/features/revenue';
import * as M from '@/features/adminMetrics';
import { AREAS, TOPICS } from '@/data';
import { errorMessage } from '@/lib/supabase';
import { contentUsageAll, type BulkUsage } from '@/repo/content';
import { colors, spacing } from '@/theme/tokens';

const HARD_WRONG_RATE = 70;

/** 코호트 표에 두는 가입 주 수. 섹션 제목이 이 값을 그대로 말한다. */
const COHORT_ROWS = 12;

/** 화면에서 고를 수 있는 기간. **선택은 하나뿐이다** — 블록마다 다르면 서로 다른 기간을 비교한다. */
const RANGES = [
  { value: '4', label: '4주' },
  { value: '12', label: '12주' },
  { value: '26', label: '26주' },
] as const;
type Range = (typeof RANGES)[number]['value'];

/**
 * 총괄관리자 개요.
 *
 * **구성 원칙**
 * - 지표를 **카드로 만들지 않는다.** 여러 지표를 나란히 비교하는 자리는 표다 — 값이 같은
 *   x좌표에 서야 위아래로 훑으며 비교된다. 카드가 늘어서면 전체 파악이 오히려 늦어진다.
 * - **위계를 준다**: 북극성 1개 → 입력 지표 → 규모 → 매출 → 유지 → 성장 구성 → 적재용량.
 *   리텐션을 유입보다 앞에 두는 것은 "떠나지 않는 제품을 먼저 만든다"는 순서다.
 * - **지표마다 수식을 함께 적는다.** 정의가 흩어지면 같은 이름의 값이 화면마다 달라진다.
 * - **`값`이 있으면 `추이`도 있어야 한다.** 추이 열 제목을 걸어 놓고 칸을 비우면 "추이가
 *   없다"는 사실조차 전달되지 않는다. 만들 수 없으면 `추이 없음`이라고 글자로 말하고,
 *   표 전체에 추이가 없으면 `변화`·`추이` 열을 아예 만들지 않는다.
 * - 좌측 내비를 글자로 복제하지 않는다(예전 `자세히 보기` 5행, `학원 보러 가기` primary).
 *   개요에는 primary가 없다 — 이 화면의 행동은 `확인이 필요해요`의 행이 맡는다.
 * - `배정 학습 제출률`은 두지 않는다 — 운영자가 학원 대신 미제출을 쫓는 일은 없다.
 *   그 값은 학원 선생님 화면(D-061)과 학원 상세가 이미 말한다.
 *
 * **숫자의 출처가 바뀌었다.** 예전에는 합성 활동 데이터로 계산해 지표마다 `합성` 배지를 달았다.
 * 지금은 전부 서버 집계이고 배지는 `추정`(요금 정책으로 계산한 금액)만 남는다. 대신 **기록이
 * 짧아 아직 낼 수 없는 지표**가 생겼다 — 그 자리는 0이 아니라 이유를 적는다.
 */
export default function AdminHome() {
  const router = useRouter();
  const { sets } = useContent();
  const { policy } = usePricing();
  const [range, setRange] = useState<Range>('12');

  const weeks = Number(range);
  const tail = <T,>(a: readonly T[]) => a.slice(-weeks);

  const overview = M.useAdminOverview();
  const revenue = M.useRevenue();
  const staff = M.useStaffCounts();
  const academies = M.useAcademies();
  const activityQuery = M.useActivityData();
  const remote = M.useCombined(overview, revenue, staff, academies, activityQuery);

  const activity = useMemo(
    () =>
      M.activityStats(
        activityQuery.data?.events ?? [],
        activityQuery.data?.daily ?? [],
        overview.data?.students ?? 0,
      ),
    [activityQuery.data, overview.data],
  );
  /*
    빈 배열 기본값을 매 렌더 새로 만들면 아래 `useMemo`가 전부 다시 돈다 — 지표 계산이 렌더마다
    반복된다. 한 번만 만들어 둔다.
  */
  const signups = useMemo(() => activityQuery.data?.signups ?? [], [activityQuery.data]);
  const events = useMemo(() => activityQuery.data?.events ?? [], [activityQuery.data]);

  const growth = useMemo(() => M.growth(events, activity), [events, activity]);
  const cc = useMemo(() => M.carryingCapacity(growth, activity.mau), [growth, activity.mau]);
  const cohorts = useMemo(
    () => M.cohorts(signups, events, activity),
    [signups, events, activity],
  );
  const predict = useMemo(
    () => M.activationPredictiveness(signups, events, activity),
    [signups, events, activity],
  );
  const activation = useMemo(
    () => M.activationRate(signups, events, activity),
    [signups, events, activity],
  );
  const use = useMemo(() => M.academyUse(academies.data ?? []), [academies.data]);
  const seatUse = useMemo(() => M.seatUsePct(academies.data ?? []), [academies.data]);

  /** 콘텐츠 점검 대상. 실제 풀이에서 나온 문항 오답률로 센다. */
  const [usage, setUsage] = useState<BulkUsage | null>(null);
  const [usageError, setUsageError] = useState<string | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void (async () => {
      await Promise.resolve();
      if (!alive) return;
      setUsageError(undefined);
      try {
        const next = await contentUsageAll();
        if (alive) setUsage(next);
      } catch (e) {
        if (alive) setUsageError(errorMessage(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const content = useMemo(() => {
    let hard = 0;
    if (usage) {
      for (const set of sets) {
        for (const q of set.questions) {
          const rate = usage.wrongRateByQuestion.get(q.id);
          if (rate != null && rate >= HARD_WRONG_RATE) hard += 1;
        }
      }
    }
    const covered = new Set(sets.map((s) => s.topic).filter(Boolean) as string[]);
    const allTopics = AREAS.flatMap((a) => TOPICS[a]);
    return { hard, empty: allTopics.filter((t) => !covered.has(t)).length, total: allTopics.length };
  }, [sets, usage]);

  /** 지금 확인해야 하는 것. 목적지가 답을 줄 수 있는 것만 둔다. */
  const alerts: { title: string; subtitle: string; href?: string }[] = [];
  const renewSoon = use.filter(
    (a) =>
      a.status === '계약 중' &&
      a.renewalInDays != null &&
      a.renewalInDays <= 30 &&
      a.renewalInDays > -60,
  );
  const lowSeat = use.filter((a) => a.status === '계약 중' && a.usePct < 60);
  if (renewSoon.length > 0) {
    alerts.push({
      title: `갱신이 30일 안인 학원 ${renewSoon.length}곳`,
      subtitle: renewSoon
        .slice(0, 3)
        .map((a) => `${a.name} ${(a.renewalInDays ?? 0) >= 0 ? `D-${a.renewalInDays}` : '지남'}`)
        .join(' · '),
      href: '/admin/academies',
    });
  }
  if (lowSeat.length > 0) {
    alerts.push({
      title: `좌석 활용률 60% 미만 학원 ${lowSeat.length}곳`,
      subtitle: '갱신 이탈 선행 신호예요',
      href: '/admin/academies',
    });
  }
  // 예측력을 아직 판정할 수 없으면 경고하지 않는다 — 못 낸 값으로 행동을 요구하지 않는다.
  if (predict.ratio != null && predict.ratio > 0 && predict.ratio < M.MILESTONE_MIN_RATIO) {
    alerts.push({
      title: `Activation 마일스톤의 예측력이 ${predict.ratio.toFixed(2)}배`,
      subtitle: `도달군 잔존 ${Math.round(predict.reached ?? 0)}% · 미도달군 ${Math.round(
        predict.missed ?? 0,
      )}%. ${M.MILESTONE_MIN_RATIO}배 미만이면 기준을 다시 정해요`,
      href: '/admin/metrics',
    });
  }
  if (content.empty > 0) {
    alerts.push({
      title: `콘텐츠가 없는 세부 유형 ${content.empty}개`,
      subtitle: `전체 ${content.total}개 유형 중`,
      href: '/admin/content',
    });
  }
  if (content.hard > 0) {
    alerts.push({
      title: `오답률 ${HARD_WRONG_RATE}% 이상 문항 ${content.hard}개`,
      subtitle: '해설을 다시 볼 문항이에요',
      // 세어 준 기준으로 좁힌 목록으로 보낸다. 쿼리가 없으면 세트를 하나씩 열어야 한다.
      href: `/admin/content?wrong=${HARD_WRONG_RATE}`,
    });
  }

  const loading = remote.loading;
  /** 값 자리에 쓰는 문장. 로딩 중에 `0명`이 사실처럼 보이지 않게 한다. */
  const pending = loading ? '읽고 있어요' : null;
  const num = (n: number | null | undefined, unit: string) =>
    pending ?? (n == null ? '기록 없음' : `${n.toLocaleString('en-US')}${unit}`);

  return (
    <Screen wide testID="admin-home" title="개요">
      <AppText variant="caption" tone="tertiary">
        {M.asOfLabel(overview.data, activity)}. 계정·학원·콘텐츠·풀이는 서버 기록이고 요금은
        추정이에요. 결제·정산 기록이 아니에요.
      </AppText>
      {remote.error || usageError ? (
        <AppText variant="caption" tone="secondary">
          지표를 읽지 못했어요. {remote.error ?? usageError}
        </AppText>
      ) : null}
      <SegmentedControl
        testID="admin-range"
        options={RANGES.map((r) => ({ value: r.value, label: r.label }))}
        value={range}
        onChange={(v) => setRange(v as Range)}
      />

      {/* 1. 북극성. 테두리·배경 없이 타이포그래피만으로 위계를 준다. */}
      <Section title="북극성 · 주간 학습 완료 학습자">
        <View style={styles.northWrap}>
          <View style={styles.northHead}>
            {/* 숫자 크기는 토큰이 정한다(`display` = 34/39). 임의 픽셀을 쓰지 않는다. */}
            <AppText variant="display" style={styles.north}>
              {num(activity.wal, '명')}
            </AppText>
            {activity.walWeekly.length > 1 ? (
              <Delta
                value={
                  activity.walWeekly[activity.walWeekly.length - 1] -
                  activity.walWeekly[activity.walWeekly.length - 2]
                }
                unit="명"
              />
            ) : null}
          </View>
          <AppText variant="caption" tone="secondary">
            {M.METRICS.wal.formula}
          </AppText>
          {activity.walWeekly.length > 1 ? (
            <Sparkline
              testID="admin-north-spark"
              values={tail(activity.walWeekly)}
              label={sparkLabel(M.METRICS.wal.label, tail(activity.walWeekly), '명')}
              width={320}
              height={44}
            />
          ) : (
            /*
              완성된 주가 두 개 미만이면 추이를 그리지 않는다. 점 하나를 선으로 그리면 평평한
              추이가 되어 "변화가 없다"고 말한다 — 사실은 비교할 주가 아직 없다.
            */
            <AppText variant="caption" tone="tertiary">
              추이는 완성된 주가 두 주 이상 모이면 나와요.
            </AppText>
          )}
          <AppText variant="caption" tone="tertiary">
            {M.METRICS.wal.desc} {M.METRICS.wal.fake ? `주의: ${M.METRICS.wal.fake}` : ''}
          </AppText>
        </View>
      </Section>

      {/* 2. 확인이 필요한 것을 지표보다 먼저 둔다 — 첫 화면이 판단을 돕게. */}
      <Section title="확인이 필요해요">
        <Group>
          {alerts.length ? (
            alerts.map((a) => (
              <Row
                key={a.title}
                title={a.title}
                subtitle={a.subtitle}
                onPress={a.href ? () => router.push(a.href as never) : undefined}
                showChevron={!!a.href}
              />
            ))
          ) : (
            <Row
              title={loading ? '지표를 읽고 있어요' : '지금 확인할 일이 없어요'}
              subtitle={loading ? '' : '갱신·좌석·콘텐츠 모두 기준 안이에요'}
            />
          )}
        </Group>
      </Section>

      {/* 3. 입력 지표 */}
      <Section title="입력 지표">
        <MetricTable
          testID="admin-input"
          weeks={weeks}
          rows={[
            {
              key: 'wau',
              value: num(activity.wau, '명'),
              values: activity.wauWeekly,
              unit: '명',
            },
            {
              key: 'mau',
              value: num(activity.mau, '명'),
              values: activity.mauWeekly,
              unit: '명',
            },
            { key: 'dau', value: num(activity.dau, '명'), values: [], unit: '명' },
            {
              key: 'stickiness',
              value:
                pending ??
                (activity.mau && activity.dau != null
                  ? `${Math.round((activity.dau / activity.mau) * 100)}%`
                  : '기록 없음'),
              values: [],
            },
            {
              /*
                **값과 수식이 같은 것을 말해야 한다.** 수식은 `그 주에 계정을 만든 학생 수`이므로
                값도 주간이다 — 누적 계정 수를 여기 쓰면 표 한 줄이 자기 안에서 다른 말을 한다
                (누적은 `학생 계정` 행이 규모에서 이미 말한다).
              */
              key: 'signup',
              value: (() => {
                const weekly = M.signupWeekly(signups, activity.weekLabels);
                const last = weekly[weekly.length - 1];
                return last == null ? '' : `${last.toLocaleString('en-US')}명`;
              })(),
              unavailable:
                pending ??
                (activity.weekLabels.length === 0
                  ? '완성된 주가 아직 없어요. 한 주가 끝나면 값이 나와요'
                  : undefined),
              values: M.signupWeekly(signups, activity.weekLabels),
              unit: '명',
            },
            {
              key: 'activation',
              value: activation.value == null ? '' : `${activation.value}%`,
              unavailable: pending ?? activation.reason,
              values: [],
            },
            {
              key: 'churn',
              value: growth.weeks.length
                ? `${(growth.weeks[growth.weeks.length - 1]?.churned ?? 0).toLocaleString('en-US')}명`
                : '',
              unavailable: pending ?? growth.reason,
              values: growth.weeks.map((g) => g.churned),
              unit: '명',
            },
          ]}
        />
      </Section>

      {/* 4. 규모 */}
      <Section title="규모">
        <MetricTable
          testID="admin-scale"
          weeks={weeks}
          rows={[
            {
              key: 'personalSubs',
              value: num(overview.data?.personalActive, '건'),
              values: [],
              note: `해지 ${overview.data?.personalCanceled ?? 0}건`,
            },
            {
              key: 'academyCount',
              value: num(overview.data?.academies, '곳'),
              values: [],
              note: `이탈 ${overview.data?.academiesChurned ?? 0}곳`,
            },
            {
              key: 'academySeats',
              value: num(revenue.data?.academySeatCount, '명'),
              values: [],
            },
            {
              key: 'seatUse',
              value: pending ?? (seatUse == null ? '기록 없음' : `${seatUse}%`),
              values: [],
            },
            { key: 'directors', value: num(staff.data?.directors, '명'), values: [] },
            { key: 'teachers', value: num(staff.data?.teachers, '명'), values: [] },
            { key: 'students', value: num(overview.data?.students, '명'), values: [] },
            { key: 'parents', value: num(overview.data?.parents, '명'), values: [] },
          ]}
        />
        {/*
          **없는 추이를 만들지 않는다.** 예전에는 계정·구독·좌석의 26주 누적을 합성 시간축에서
          재구성했다. 지금은 그 시점의 상태를 남긴 기록이 없어서 지금 값만 말한다.
        */}
        <AppText variant="caption" tone="tertiary">
          규모는 지금 값이에요. 과거 시점의 규모를 남긴 기록이 없어서 추이는 두지 않아요.
        </AppText>
      </Section>

      {/* 5. 매출 */}
      <Section title="매출 추정">
        <MetricTable
          testID="admin-money"
          weeks={weeks}
          rows={[
            {
              key: 'mrr',
              value: pending ?? (revenue.data ? won(revenue.data.mrr) : '기록 없음'),
              values: [],
              money: true,
            },
            {
              key: 'arr',
              value: pending ?? (revenue.data ? won(revenue.data.arr) : '기록 없음'),
              values: [],
              money: true,
            },
            {
              key: 'arppu',
              value: pending ?? (revenue.data ? won(revenue.data.arppu) : '기록 없음'),
              values: [],
              money: true,
              note: `유료 ${(revenue.data?.payingPeople ?? 0).toLocaleString('en-US')}명`,
            },
            {
              key: 'arpu',
              value: (() => {
                const v = revenue.data ? M.arpu(revenue.data, activity.mau) : null;
                return v == null ? '' : won(v);
              })(),
              unavailable:
                pending ??
                (activity.mau ? undefined : 'MAU가 있어야 나와요. 활동 기록이 모이면 값이 나와요'),
              values: [],
              money: true,
              note: activity.mau ? `MAU ${activity.mau.toLocaleString('en-US')}명` : undefined,
            },
            {
              key: 'grr',
              value: pending ?? (overview.data ? `${M.personalGrr(overview.data)}%` : '기록 없음'),
              values: [],
            },
          ]}
        />
        <View style={{ gap: spacing.xs }}>
          <SourceLegend items={[{ source: '추정', what: '개인 · 학원 구성비' }]} />
          {revenue.data ? (
            <AppText variant="caption" tone="secondary">
              개인 {share(revenue.data.personal, revenue.data.mrr)} · 학원{' '}
              {share(revenue.data.academy, revenue.data.mrr)}
            </AppText>
          ) : null}
        </View>
        <AppText variant="caption" tone="tertiary">
          지금 단가·할인율로 계산한 값이에요(과거 단가 기록은 있지만 과거 규모 기록이 없어요).
          해지한 개인 구독과 이탈한 학원에는 청구하지 않아요. 학원 좌석은{' '}
          {policy.seatDiscountFrom}명부터 {policy.seatDiscountPct}% 할인이에요.
        </AppText>
      </Section>

      {/* 6. 유지 — 코호트 삼각표. 미완성 셀은 비워 둔다. 기간 토글이 닿지 않아 제목에 못박는다. */}
      <Section title={`주간 코호트 잔존 (최근 ${COHORT_ROWS}개 코호트 · 경과 ${M.COHORT_WEEKS}주)`}>
        <AppText variant="caption" tone="secondary">
          가입 주가 행, 경과 주가 열이에요. W0는 정의상 거의 100%예요. 아직 오지 않은 주는
          비워 둬요 — 0%로 채우면 떨어진 것처럼 읽혀요. 코호트가 {M.COHORT_MIN_SIZE}명 미만이면
          흐리게 뒀어요.
        </AppText>
        <Table
          testID="admin-cohort"
          narrow="scroll"
          columns={cohortColumns()}
          rows={cohorts.rows.slice(0, COHORT_ROWS)}
          rowKey={(r) => r.label}
          rowLabel={(r) =>
            `${r.label} 가입 ${r.size}명, ${r.cells
              .map((c, i) => (c == null ? '' : `${i}주 ${c}%`))
              .filter(Boolean)
              .join(', ')}`
          }
          /*
            **0%로 채운 표를 그리지 않는다.** 활동을 기록하기 시작한 날보다 먼저 가입한 코호트는
            잔존을 관찰하지 못했다 — 빈칸을 0%로 두면 화면이 "전원 이탈"이라고 말한다.
          */
          empty={{
            title: loading ? '코호트를 읽고 있어요' : '아직 코호트를 만들 수 없어요',
            subtitle: loading ? '' : (cohorts.reason ?? ''),
          }}
        />
      </Section>

      <Section title="주 중 학습일 분포 (최근 7일)">
        <AppText variant="caption" tone="secondary">
          {M.METRICS.mau.label} 한 숫자가 지워 버리는 분산을 드러내요. 오른쪽으로 갈수록 자주
          쓰는 학생이에요.
        </AppText>
        {activity.l7 ? (
          <>
            <View style={{ gap: spacing.sm }}>
              {activity.l7.map((b) => (
                <BarRow
                  key={b.days}
                  label={`${b.days}일`}
                  value={(b.count / Math.max(...activity.l7!.map((x) => x.count), 1)) * 100}
                  note={`${b.count.toLocaleString('en-US')}명`}
                  labelWidth={32}
                  noteWidth={72}
                />
              ))}
            </View>
            {/*
              `0일` 칸을 지우면 분모가 화면에서 사라진다. 가장 큰 집단을 빼 놓고 "분산을 드러낸다"고
              말할 수는 없다.
            */}
            <AppText variant="caption" tone="tertiary">
              0일은 최근 7일에 활동이 없던 학생이에요. 학생{' '}
              {(overview.data?.students ?? 0).toLocaleString('en-US')}명 중{' '}
              {(activity.l7.find((b) => b.days === 0)?.count ?? 0).toLocaleString('en-US')}명이에요.
            </AppText>
          </>
        ) : (
          <AppText variant="caption" tone="tertiary">
            {loading ? '활동 기록을 읽고 있어요.' : '아직 활동 기록이 모이지 않았어요.'}
          </AppText>
        )}
      </Section>

      {/* 7. 성장 구성 */}
      <Section title="성장 구성">
        <AppText variant="caption" tone="secondary">
          시험 주기에 돌아오는 학생이 많은 제품이라 부활을 신규와 섞지 않아요.
        </AppText>
        <AppText variant="caption" tone="secondary">
          Quick Ratio는 {M.METRICS.quickRatio.formula}예요. 1 이상이면 활성이 늘어요. 이탈이 0인
          주는 값을 낼 수 없어 —로 둬요.
        </AppText>
        <Table
          testID="admin-growth"
          narrow="scroll"
          columns={growthColumns()}
          rows={growth.weeks.slice(-weeks).reverse()}
          rowKey={(g) => g.label}
          rowLabel={growthRowLabel}
          empty={{
            title: loading ? '성장 구성을 읽고 있어요' : '아직 성장 구성을 만들 수 없어요',
            subtitle: loading ? '' : (growth.reason ?? ''),
          }}
        />
      </Section>

      {/* 8. 적재용량. 기간 토글이 닿지 않는 블록이라 제목에 기간을 못박는다. */}
      <Section title={`적재용량 (최근 ${M.CC_WEEKS}주 유입·이탈 기준)`}>
        <MetricTable
          testID="admin-cc"
          weeks={weeks}
          rows={[
            {
              key: 'ccUse',
              value: cc.usedPct != null ? `${cc.usedPct.toFixed(1)}%` : '',
              unavailable: pending ?? cc.reason ?? (cc.usedPct == null ? '이탈이 0이라 상한을 낼 수 없어요' : undefined),
              values: [],
            },
            {
              key: 'cc',
              value:
                cc.capacity != null ? `${Math.round(cc.capacity).toLocaleString('en-US')}명` : '',
              unavailable:
                pending ?? cc.reason ?? (cc.capacity == null ? '이탈이 0이라 상한을 낼 수 없어요' : undefined),
              values: [],
              note: cc.reason
                ? undefined
                : `유입 ${cc.dailyInflow.toFixed(1)}명/일 · 이탈 ${(cc.dailyChurnRate * 100).toFixed(3)}%/일`,
            },
          ]}
        />
        <View style={{ gap: 2 }}>
          <AppText variant="caption" tone="tertiary">
            이 값은 지금 유입·이탈이 유지될 때의 상한이에요. 세 가지를 반영하지 않아요.
          </AppText>
          <AppText variant="caption" tone="tertiary">
            · 시장 크기(도달 가능한 학생 수)
          </AppText>
          <AppText variant="caption" tone="tertiary">
            · 유입과 이탈은 상수가 아니라 변수예요(초기 사용자와 나중 사용자가 다르게 남아요)
          </AppText>
          <AppText variant="caption" tone="tertiary">
            · 광고로 얻는 사용자의 지속 가능성은 따로 봐야 해요
          </AppText>
        </View>
      </Section>

      <Section title="지표 정의와 수식">
        <Group>
          <Row
            testID="admin-goto-metrics"
            title="지표 사전 보기"
            subtitle="정의 · 수식 · 활성 판정 기준 · 아직 값을 낼 수 없는 지표와 그 이유"
            onPress={() => router.push('/admin/metrics' as never)}
            showChevron
          />
        </Group>
      </Section>

      <AccountSettings />
    </Screen>
  );
}

/* ────────────────────────── 표 조립 ────────────────────────── */

/** 낮을수록 좋은 지표. 증가를 좋은 색으로 칠하면 화면이 틀린 말을 한다. */
const LOWER_IS_BETTER = new Set(['churn']);

interface MetricRowData {
  key: string;
  value: string;
  /** 추이. 두 점 미만이면 추이를 만들 수 없다는 사실을 셀에 글자로 적는다. */
  values: readonly number[];
  /** 값 옆 보조 사실. */
  note?: string;
  /** 변화·추이에 붙이는 단위. 비율 지표는 `%p`를 쓰므로 여기 두지 않는다. */
  unit?: string;
  /** 금액이면 변화도 `₩`로 쓴다. */
  money?: boolean;
  /**
   * 값을 낼 수 없는 이유.
   *
   * **있으면 값 대신 이 문장을 쓴다.** 0으로 채우면 "활동이 없다"로 읽히는데, 사실은
   * "아직 모른다"다 — 앞의 것은 사고이고 뒤의 것은 기다림이다.
   */
  unavailable?: string;
}

/** 변화 텍스트. 스크린리더 문장과 셀이 같은 말을 하도록 한곳에서 만든다. */
function deltaText(row: MetricRowData): string {
  if (row.unavailable) return '없음';
  if (row.values.length < 2) return '없음';
  const value = row.values[row.values.length - 1] - row.values[row.values.length - 2];
  const abs = Math.abs(value).toLocaleString('en-US');
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  if (M.METRICS[row.key].ratio) return `${sign}${abs}%p`;
  if (row.money) return `${sign}₩${abs}`;
  return `${sign}${abs}${row.unit ?? ''}`;
}

/**
 * 지표 표.
 *
 * 열: 지표(+수식) / 값 / 변화 / 추이 / 출처. 숫자는 오른쪽 정렬 + 등폭이라 자릿수 선이 맞는다.
 * **표 전체에 추이가 하나도 없으면 `변화`·`추이` 열을 만들지 않는다** — 빈 칸 두 줄은
 * 정보가 아니라 잡음이다.
 */
function MetricTable({
  rows,
  weeks,
  testID,
}: {
  rows: MetricRowData[];
  weeks: number;
  testID: string;
}) {
  const hasTrend = rows.some((r) => r.values.length > 1);
  /** 추이가 있는 행과 없는 행이 섞이면 `—`의 뜻을 표 아래에서 밝힌다. */
  const mixed = hasTrend && rows.some((r) => r.values.length < 2);
  /**
   * `출처` 열은 **추정이 섞여 있을 때만** 만든다.
   *
   * 예전에는 지표마다 `합성`·`추정`이 갈려서 열이 필요했다. 지금 규모 표는 전부 서버 집계라
   * 열을 두면 헤더 하나와 빈 칸 여덟 개가 남는다 — 빈 칸은 정보가 아니라 잡음이다.
   */
  const hasEstimate = rows.some((r) => M.METRICS[r.key].source === '추정');

  const columns: Column<MetricRowData>[] = [
    // 폭을 고정하지 않는다 — 남는 폭을 이름·수식이 갖는다(수식이 두 줄로 접히지 않게).
    { key: 'name', header: '지표', cell: (r) => <NameCell row={r} /> },
    {
      key: 'value',
      header: '값',
      width: 132,
      align: 'right',
      cell: (r) =>
        r.unavailable ? (
          <AppText variant="caption" tone="secondary">
            {r.unavailable}
          </AppText>
        ) : (
          r.value
        ),
    },
    ...(hasTrend
      ? ([
          {
            key: 'delta',
            header: '변화',
            width: 84,
            align: 'right',
            cell: (r) => <DeltaCell row={r} />,
          },
          {
            key: 'trend',
            header: `추이(${weeks}주)`,
            width: 84,
            // ① 파일 머리말: 값이 있으면 추이도 있어야 한다.
            priority: 1,
            cell: (r) =>
              !r.unavailable && r.values.length > 1 ? (
                <Sparkline
                  values={r.values.slice(-weeks)}
                  label={sparkLabel(M.METRICS[r.key].label, r.values.slice(-weeks), r.unit)}
                />
              ) : (
                // 빈 칸으로 두면 "추이가 없다"는 사실조차 전달되지 않는다.
                <AppText variant="caption" tone="tertiary">
                  추이 없음
                </AppText>
              ),
          },
        ] as Column<MetricRowData>[])
      : []),
    ...(hasEstimate
      ? ([
          {
            key: 'source',
            header: '출처',
            width: 56,
            priority: 1,
            /*
              `추정`만 배지가 남는다 — 나머지는 전부 서버 집계다. 예전에는 지표마다 `합성` 배지가
              붙어 있었고, 그 배지가 사라진 것이 이 작업의 결과다.
            */
            cell: (r) =>
              M.METRICS[r.key].source === '추정' ? <SourceBadge source={'추정' as Source} /> : '',
          },
        ] as Column<MetricRowData>[])
      : []),
  ];
  return (
    <>
      <Table
        testID={testID}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.key}
        rowLabel={(r) =>
          [
            `${M.METRICS[r.key].label} ${r.unavailable ?? r.value}`,
            r.note,
            hasTrend ? `변화 ${deltaText(r)}` : null,
            hasEstimate ? `출처 ${M.METRICS[r.key].source}` : null,
          ]
            .filter(Boolean)
            .join(', ')
        }
        empty={{ title: '보여 줄 지표가 없어요' }}
      />
      {mixed ? (
        <AppText variant="caption" tone="tertiary">
          변화는 직전 주와 비교한 값이에요. 지금 값 하나만 있는 지표는 비교할 주가 없어 —로 둬요.
        </AppText>
      ) : null}
    </>
  );
}

/** 지표 이름 + 수식 한 줄. 수식이 숫자 옆에 있어야 읽힌다. */
function NameCell({ row }: { row: MetricRowData }) {
  const def = M.METRICS[row.key];
  return (
    <View style={{ gap: 1 }}>
      <AppText variant="label">{def.label}</AppText>
      <AppText variant="caption" tone="tertiary" numberOfLines={2}>
        {def.formula}
      </AppText>
      {row.note ? (
        <AppText variant="caption" tone="secondary">
          {row.note}
        </AppText>
      ) : null}
    </View>
  );
}

function DeltaCell({ row }: { row: MetricRowData }) {
  if (row.unavailable || row.values.length < 2) return <AppText tone="secondary">—</AppText>;
  const last = row.values[row.values.length - 1];
  const prev = row.values[row.values.length - 2];
  return (
    <Delta
      value={last - prev}
      ratio={M.METRICS[row.key].ratio}
      lowerIsBetter={LOWER_IS_BETTER.has(row.key)}
      unit={row.unit}
      money={row.money}
    />
  );
}

/**
 * 변화량. **비율 지표는 `%p`, 절대량은 그 지표의 단위**를 쓴다 — 섞으면 부호가 뒤집혀 읽힌다.
 * 색은 텍스트 색으로만, 좋아짐·나빠짐 두 가지만.
 *
 * 변화가 0일 때도 단위를 붙인다. 단위 없는 `0`은 비율인지 사람 수인지 알 수 없다.
 * 색은 `inkTertiary`(대비 3.23:1)를 쓰지 않는다 — 이번 개편이 값에서 걷어낸 색이다.
 */
function Delta({
  value,
  ratio,
  lowerIsBetter,
  unit,
  money,
}: {
  value: number;
  ratio?: boolean;
  lowerIsBetter?: boolean;
  unit?: string;
  money?: boolean;
}) {
  const abs = Math.abs(value).toLocaleString('en-US');
  const suffix = ratio ? '%p' : (unit ?? '');
  const body = money ? `₩${abs}` : `${abs}${suffix}`;
  if (value === 0) {
    return <AppText tone="secondary">{body}</AppText>;
  }
  // 이탈처럼 낮을수록 좋은 지표는 증가가 나쁜 일이다.
  const good = lowerIsBetter ? value < 0 : value > 0;
  return (
    <AppText style={{ color: good ? colors.accent : colors.danger }}>
      {value > 0 ? '+' : '−'}
      {body}
    </AppText>
  );
}

/**
 * 표 위에 두는 출처 범례.
 *
 * 셀마다 배지를 붙이면 좁은 열에서 값이 덮인다. 학원 목록·요금제 표가 이미 쓰는 방법이다(D-068).
 */
function SourceLegend({ items }: { items: { source: Source; what: string }[] }) {
  return (
    <View style={styles.legend}>
      {items.map((it) => (
        <View key={it.what} style={styles.legendItem}>
          <SourceBadge source={it.source} />
          <AppText variant="caption" tone="secondary">
            {it.what}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function cohortColumns(): Column<M.CohortRow>[] {
  const cols: Column<M.CohortRow>[] = [
    {
      key: 'week',
      header: '가입 주',
      width: 120,
      cell: (r) => (
        <View style={{ gap: 1 }}>
          <AppText variant="label" style={r.size < M.COHORT_MIN_SIZE ? styles.faint : undefined}>
            {r.label.slice(5)}
          </AppText>
          <AppText variant="caption" tone="tertiary">
            {r.size}명
          </AppText>
        </View>
      ),
    },
  ];
  for (let n = 0; n < M.COHORT_WEEKS; n += 1) {
    cols.push({
      key: `w${n}`,
      header: `W${n}`,
      width: 52,
      align: 'right',
      cell: (r) => {
        const v = r.cells[n];
        // 아직 오지 않은 주는 비워 둔다. 0%로 채우면 리텐션이 떨어진 것처럼 읽힌다.
        if (v == null) return '';
        // W0은 정의상 거의 100%라 강조하지 않는다.
        const faint = n === 0 || r.size < M.COHORT_MIN_SIZE;
        return (
          <AppText numeric tone={faint ? 'tertiary' : 'default'}>
            {v}%
          </AppText>
        );
      },
    });
  }
  return cols;
}

/** Quick Ratio가 1을 넘는지 **글자로도** 말한다. 색만으로 좋고 나쁨을 가르지 않는다(§11). */
function quickRatioText(value: number | null): string {
  if (value == null) return '—';
  return value >= 1 ? '1 이상' : '1 미만';
}

function growthRowLabel(g: M.GrowthWeek): string {
  const qr =
    g.quickRatio == null
      ? '없음(이탈 0)'
      : `${g.quickRatio.toFixed(2)} ${quickRatioText(g.quickRatio)}`;
  return `${g.label.slice(5)} 주, 신규 ${g.isNew}명, 유지 ${g.retained.toLocaleString(
    'en-US',
  )}명, 부활 ${g.resurrected}명, 이탈 ${g.churned}명, Quick Ratio ${qr}`;
}

function growthColumns(): Column<M.GrowthWeek>[] {
  return [
    { key: 'week', header: '주', width: 84, cell: (g) => g.label.slice(5) },
    { key: 'new', header: '신규', width: 68, align: 'right', cell: (g) => `${g.isNew}` },
    { key: 'ret', header: '유지', width: 78, align: 'right', cell: (g) => g.retained.toLocaleString('en-US') },
    { key: 'res', header: '부활', width: 68, align: 'right', cell: (g) => `${g.resurrected}` },
    { key: 'churn', header: '이탈', width: 68, align: 'right', cell: (g) => `${g.churned}` },
    {
      key: 'qr',
      header: 'Quick Ratio',
      width: 92,
      align: 'right',
      cell: (g) =>
        g.quickRatio == null ? (
          '—'
        ) : (
          <View style={styles.qrCell}>
            <AppText numeric tone={g.quickRatio >= 1 ? 'accent' : 'danger'}>
              {g.quickRatio.toFixed(2)}
            </AppText>
            <AppText variant="caption" tone="secondary">
              {quickRatioText(g.quickRatio)}
            </AppText>
          </View>
        ),
    },
  ];
}

const styles = StyleSheet.create({
  northWrap: { gap: spacing.sm },
  northHead: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  north: { fontVariant: ['tabular-nums'] },
  faint: { color: colors.inkTertiary, fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  qrCell: { alignItems: 'flex-end' },
});
