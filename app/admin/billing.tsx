import { useMemo } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Screen, Section, Group, Row, AppText, Icon, StatTiles, type Stat } from '@/components';
import {
  usePricing,
  academyMonthly,
  personalMonthly,
  won,
  PRICING_LIMITS,
  type PricingPolicy,
} from '@/features/pricing';
import { useAudit } from '@/features/audit';
import { useSession } from '@/session';
import { ACCOUNTS, ACADEMY_CLASSES } from '@/data';
import { colors, radius, spacing, typeface } from '@/theme/tokens';

interface Knob {
  key: keyof PricingPolicy;
  label: string;
  desc: string;
  unit: '원' | '%' | '명';
}

/** 단가 먼저, 비율 나중. 운영자가 바꾸는 빈도 순서다. */
const KNOBS: Knob[] = [
  {
    key: 'studentPaid',
    label: '개인 월정액 · 학생 결제',
    desc: '학생이 직접 결제하는 이용권',
    unit: '원',
  },
  {
    key: 'parentPaid',
    label: '개인 월정액 · 학부모 결제',
    desc: '학부모가 결제하고 관리하는 이용권',
    unit: '원',
  },
  {
    key: 'academySeat',
    label: '학원 좌석 단가',
    desc: '학원이 부담하는 재원생 1인당 월 금액',
    unit: '원',
  },
  {
    key: 'seatDiscountPct',
    label: '학원 규모 할인율',
    desc: '좌석이 기준을 넘는 학원에 적용',
    unit: '%',
  },
  {
    key: 'seatDiscountFrom',
    label: '규모 할인 시작 좌석',
    desc: '이 인원부터 규모 할인을 적용',
    unit: '명',
  },
  {
    key: 'annualDiscountPct',
    label: '연 결제 할인율',
    desc: '연 단위로 결제할 때 깎아 주는 비율',
    unit: '%',
  },
  {
    key: 'annualSharePct',
    label: '연 결제 비율',
    desc: '연 결제를 고른 이용권 비율(추정에 사용)',
    unit: '%',
  },
];

/**
 * 요금제. 월정액 단가와 할인 비율을 정하고, 바꾼 값이 추정 매출에 즉시 반영되는 것을 보여 준다.
 * 값은 메모리에만 있고 실제 청구와 연결되지 않는다.
 */
export default function AdminBilling() {
  const { policy, bump, reset, changed } = usePricing();
  const { log } = useAudit();
  const { account } = useSession();
  const actor = account?.name ?? '운영자';

  const seatsByAcademy = useMemo(() => {
    const names = Array.from(new Set(ACADEMY_CLASSES.map((c) => c.academyName)));
    return names.map((name) => ({
      name,
      seats: new Set(
        ACADEMY_CLASSES.filter((c) => c.academyName === name).flatMap((c) => c.studentIds),
      ).size,
    }));
  }, []);

  const revenue = useMemo(() => {
    let personal = 0;
    let personalCount = 0;
    for (const a of ACCOUNTS) {
      for (const e of a.entitlements) {
        if (e.kind !== 'personal') continue;
        personal += personalMonthly(policy, e.payer === 'parent' ? 'parent' : 'student');
        personalCount += 1;
      }
    }
    const academy = seatsByAcademy.reduce((n, a) => n + academyMonthly(policy, a.seats), 0);
    const mrr = personal + academy;
    return {
      personal,
      academy,
      mrr,
      personalCount,
      personalShare: share(personal, mrr),
      academyShare: share(academy, mrr),
    };
  }, [policy, seatsByAcademy]);

  const stats: Stat[] = [
    { label: '추정 MRR', value: won(revenue.mrr), hint: '개인 + 학원' },
    { label: '추정 ARR', value: won(revenue.mrr * 12), hint: 'MRR × 12' },
    {
      label: '개인 매출',
      value: won(revenue.personal),
      hint: `${revenue.personalShare} · ${revenue.personalCount}건`,
    },
    {
      label: '학원 매출',
      value: won(revenue.academy),
      hint: `${revenue.academyShare} · ${seatsByAcademy.length}곳`,
    },
  ];

  function change(knob: Knob, direction: 1 | -1) {
    const before = policy[knob.key];
    const limits = PRICING_LIMITS[knob.key];
    const after = Math.min(limits.max, Math.max(limits.min, before + direction * limits.step));
    if (after === before) return;
    bump(knob.key, direction);
    log({
      actor,
      action: '요금 정책',
      detail: `${knob.label} ${format(before, knob.unit)} → ${format(after, knob.unit)}`,
    });
  }

  return (
    <Screen
      wide
      testID="admin-billing"
      backFallback="/admin"
      eyebrow="총괄관리자"
      title="요금제"
      lead="월정액 단가와 할인 비율을 정해요. 바꾸면 아래 추정 매출이 바로 바뀌어요."
    >
      <AppText variant="caption" tone="tertiary">
        프로토타입입니다. 설정은 이 세션에만 남고 실제 결제·정산에는 반영되지 않아요.
      </AppText>

      <StatTiles testID="billing-kpi" stats={stats} />

      <Section title="단가와 비율">
        <View style={styles.knobs}>
          {KNOBS.map((k) => (
            <View key={k.key} style={styles.knob}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="label">{k.label}</AppText>
                <AppText variant="caption" tone="tertiary">
                  {k.desc}
                </AppText>
              </View>
              <View style={styles.stepper}>
                <StepBtn
                  testID={`billing-${k.key}-down`}
                  label={`${k.label} 내리기`}
                  sign="minus"
                  onPress={() => change(k, -1)}
                />
                <AppText testID={`billing-${k.key}-value`} style={styles.knobValue}>
                  {format(policy[k.key], k.unit)}
                </AppText>
                <StepBtn
                  testID={`billing-${k.key}-up`}
                  label={`${k.label} 올리기`}
                  sign="plus"
                  onPress={() => change(k, 1)}
                />
              </View>
            </View>
          ))}
        </View>
        {changed ? (
          <Pressable
            testID="billing-reset"
            accessibilityRole="button"
            onPress={() => {
              reset();
              log({ actor, action: '요금 정책', detail: '기본값으로 되돌림' });
            }}
            style={({ pressed }) => [styles.reset, pressed && { backgroundColor: colors.hover }]}
          >
            <AppText variant="caption" tone="secondary">
              기본값으로 되돌리기
            </AppText>
          </Pressable>
        ) : null}
      </Section>

      <Section title="학원별 월 청구액">
        <Group>
          {seatsByAcademy.map((a) => {
            const amount = academyMonthly(policy, a.seats);
            const discounted = a.seats >= policy.seatDiscountFrom;
            return (
              <Row
                key={a.name}
                title={a.name}
                subtitle={
                  discounted
                    ? `좌석 ${a.seats}명 · 규모 할인 ${policy.seatDiscountPct}% 적용`
                    : `좌석 ${a.seats}명 · 할인 없음`
                }
                meta={`${won(amount)}/월`}
              />
            );
          })}
        </Group>
      </Section>

      <Section title="이 값을 어떻게 쓰나요">
        <Group>
          <Row
            title="개인 이용권 월 환산"
            subtitle="정가 × (1 − 연 결제 비율) + 연 결제가 × 연 결제 비율"
          />
          <Row
            title="학원 청구액"
            subtitle={`좌석 × 좌석 단가. 좌석이 ${policy.seatDiscountFrom}명 이상이면 ${policy.seatDiscountPct}% 할인`}
          />
          <Row title="변경 기록" subtitle="바꾼 값은 운영 기록에 남아요" />
        </Group>
      </Section>
    </Screen>
  );
}

function StepBtn({
  sign,
  onPress,
  label,
  testID,
}: {
  sign: 'plus' | 'minus';
  onPress: () => void;
  label: string;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.stepBtn, pressed && { backgroundColor: colors.hover }]}
    >
      {sign === 'plus' ? (
        <Icon name="plus" size={15} color={colors.ink} />
      ) : (
        <View style={styles.minus} />
      )}
    </Pressable>
  );
}

/** 구성비. 0으로 반올림되면 "1% 미만"이라고 밝힌다(0%는 없는 것처럼 읽힌다). */
function share(part: number, whole: number): string {
  if (!whole || part <= 0) return '0%';
  const pct = Math.round((part / whole) * 100);
  return pct === 0 ? '1% 미만' : `${pct}%`;
}

function format(value: number, unit: '원' | '%' | '명'): string {
  if (unit === '원') return won(value);
  return `${value}${unit}`;
}

const styles = StyleSheet.create({
  knobs: { gap: spacing.xs },
  knob: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  knobValue: {
    fontFamily: typeface.semibold,
    color: colors.ink,
    minWidth: 82,
    textAlign: 'right',
  },
  stepBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  minus: { width: 11, height: 1.5, backgroundColor: colors.ink },
  reset: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
