import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Screen,
  Section,
  Group,
  Row,
  Button,
  AppText,
  ProgressBar,
  StatTiles,
  AccountSettings,
  type Stat,
} from '@/components';
import { useContent } from '@/features/content';
import { useProgress } from '@/features/progress';
import { usePricing, academyMonthly, personalMonthly, won } from '@/features/pricing';
import { ACCOUNTS, ACADEMY_CLASSES, AREAS, TOPICS, getAccountsByRole } from '@/data';
import { contentUsage, totalSolves } from '@/data/usage';
import { colors, spacing, typeface } from '@/theme/tokens';

const HARD_WRONG_RATE = 70;
const KIND_LABEL = { passage: '지문형', grammar: '문법형' } as const;

/**
 * 총괄관리자 개요.
 *
 * 구성 순서는 운영자가 실제로 확인하는 순서다.
 * 1) 규모와 매출(지표 타일) 2) 확인이 필요한 것 3) 최근 등록 콘텐츠 4) 자세히 볼 곳 5) 지표 정의.
 * 장식 차트를 늘리지 않고, 각 지표가 무엇을 세는지 화면에서 밝힌다.
 */
export default function AdminHome() {
  const router = useRouter();
  const { sets } = useContent();
  const { assignments } = useProgress();
  const { policy } = usePricing();

  const academies = useMemo(
    () => Array.from(new Set(ACADEMY_CLASSES.map((c) => c.academyName))),
    [],
  );
  const students = useMemo(() => getAccountsByRole('student'), []);
  const academyStudentIds = useMemo(
    () => new Set(ACADEMY_CLASSES.flatMap((c) => c.studentIds)),
    [],
  );

  // 배정 제출 현황: 제출 여부는 좌석이 아니라 배정 건 단위로 센다.
  const rows = assignments.flatMap((a) => a.submissions);
  const submitted = rows.filter((s) => s.submitted).length;
  const submitRate = rows.length ? Math.round((submitted / rows.length) * 100) : 0;
  const notSubmitted = rows.length - submitted;

  // 추정 매출: 개인 이용권(결제 주체별) + 학원 좌석(규모 할인 적용)
  const money = useMemo(() => {
    let personal = 0;
    let personalCount = 0;
    for (const a of ACCOUNTS) {
      for (const e of a.entitlements) {
        if (e.kind !== 'personal') continue;
        personal += personalMonthly(policy, e.payer === 'parent' ? 'parent' : 'student');
        personalCount += 1;
      }
    }
    let academy = 0;
    for (const name of academies) {
      const seats = new Set(
        ACADEMY_CLASSES.filter((c) => c.academyName === name).flatMap((c) => c.studentIds),
      ).size;
      academy += academyMonthly(policy, seats);
    }
    const mrr = personal + academy;
    const payingUsers = personalCount + academyStudentIds.size;
    return { mrr, personal, academy, payingUsers, arpu: payingUsers ? mrr / payingUsers : 0 };
  }, [policy, academies, academyStudentIds]);

  // 콘텐츠 사용 집계(테스트 집계). 세부 유형 공백과 어려운 문항 수를 함께 센다.
  const content = useMemo(() => {
    let solves = 0;
    let hardQuestions = 0;
    for (const set of sets) {
      const u = contentUsage(set);
      solves += totalSolves(u);
      hardQuestions += Object.values(u.wrongRateByQ).filter((r) => r >= HARD_WRONG_RATE).length;
    }
    const covered = new Set(sets.map((s) => s.topic).filter(Boolean) as string[]);
    const allTopics = AREAS.flatMap((a) => TOPICS[a]);
    const emptyTopics = allTopics.filter((t) => !covered.has(t)).length;
    return { solves, hardQuestions, emptyTopics, totalTopics: allTopics.length };
  }, [sets]);

  const stats: Stat[] = [
    { label: '학원', value: `${academies.length}곳`, hint: `반 ${ACADEMY_CLASSES.length}개` },
    {
      label: '학생 계정',
      value: `${students.length.toLocaleString('en-US')}명`,
      hint: `학원 연계 ${academyStudentIds.size.toLocaleString('en-US')}명`,
    },
    { label: '추정 MRR', value: won(money.mrr), hint: `유료 ${money.payingUsers}건 기준` },
    { label: '추정 ARPU', value: won(money.arpu), hint: 'MRR ÷ 유료 건수' },
    {
      label: '콘텐츠',
      value: `${sets.length}개`,
      hint: `문항 ${sets.reduce((n, s) => n + s.questions.length, 0)}개`,
    },
    {
      label: '누적 풀이',
      value: `${content.solves.toLocaleString('en-US')}회`,
      hint: '배정 + 개인 학습',
    },
  ];

  const alerts = [
    notSubmitted > 0
      ? {
          title: `아직 안 낸 배정 학습 ${notSubmitted}건`,
          subtitle: `전체 배정 제출률 ${submitRate}%`,
          href: '/admin/academies',
        }
      : null,
    content.emptyTopics > 0
      ? {
          title: `콘텐츠가 없는 세부 유형 ${content.emptyTopics}개`,
          subtitle: `전체 ${content.totalTopics}개 유형 중`,
          href: '/admin/content',
        }
      : null,
    content.hardQuestions > 0
      ? {
          title: `오답률 ${HARD_WRONG_RATE}% 이상 문항 ${content.hardQuestions}개`,
          subtitle: '해설을 다시 볼 문항이에요',
          href: '/admin/content',
        }
      : null,
  ].filter(Boolean) as { title: string; subtitle: string; href: string }[];

  const recent = sets.slice(-5).reverse();

  return (
    <Screen wide testID="admin-home" eyebrow="총괄관리자" title="서비스 개요">
      <AppText variant="caption" tone="tertiary">
        프로토타입 테스트 데이터 기준입니다. 요금은 추정값이고 실제 결제·정산 기록이 아닙니다.
      </AppText>

      <StatTiles testID="admin-kpi" stats={stats} />

      <Section title="배정 학습 제출률">
        <View style={{ gap: spacing.sm }}>
          <View style={styles.lineRow}>
            <AppText variant="caption" tone="secondary">
              제출한 배정
            </AppText>
            <AppText variant="caption" tone="secondary" style={styles.lineValue}>
              {submitted}/{rows.length}건 · {submitRate}%
            </AppText>
          </View>
          <ProgressBar value={submitRate} />
        </View>
      </Section>

      <Section title="확인이 필요해요">
        <Group>
          {alerts.length ? (
            alerts.map((a) => (
              <Row
                key={a.title}
                title={a.title}
                subtitle={a.subtitle}
                onPress={() => router.push(a.href as never)}
                showChevron
              />
            ))
          ) : (
            <Row
              title="지금 확인할 일이 없어요"
              subtitle="제출·콘텐츠·문항 모두 기준을 넘었어요"
            />
          )}
        </Group>
      </Section>

      <Section title="최근 등록한 콘텐츠">
        <Button
          testID="admin-new"
          label="새 문제 등록하기"
          onPress={() => router.push('/admin/new' as never)}
        />
        <Group>
          {recent.length ? (
            recent.map((c) => (
              <Row
                key={c.id}
                title={c.title}
                subtitle={`국어 · ${c.area}${c.topic ? ` · ${c.topic}` : ''} · ${
                  KIND_LABEL[c.kind]
                } · ${c.questions.length}문항`}
                meta={c.publishToStudents ? '공개' : '비공개'}
                onPress={() => router.push(`/admin/content/${c.id}` as never)}
                showChevron
              />
            ))
          ) : (
            <Row title="등록한 콘텐츠가 없어요" subtitle="새 문제를 등록해 시작해요" />
          )}
        </Group>
      </Section>

      <Section title="자세히 보기">
        <Group>
          <Row
            title="학원"
            subtitle="학원별 좌석·청구액·수행률"
            onPress={() => router.push('/admin/academies' as never)}
            showChevron
          />
          <Row
            title="계정"
            subtitle="역할별 계정 검색"
            onPress={() => router.push('/admin/users' as never)}
            showChevron
          />
          <Row
            title="요금제"
            subtitle="월정액 단가와 할인 비율 설정"
            onPress={() => router.push('/admin/billing' as never)}
            showChevron
          />
          <Row
            title="콘텐츠"
            subtitle="영역별 목록과 문항 오답률"
            onPress={() => router.push('/admin/content' as never)}
            showChevron
          />
          <Row
            title="운영 기록"
            subtitle="설정 변경 내역과 데이터 출처"
            onPress={() => router.push('/admin/ops' as never)}
            showChevron
          />
        </Group>
      </Section>

      <Section title="지표를 어떻게 세나요">
        <View style={styles.defs}>
          <Def
            term="추정 MRR"
            desc="개인 이용권 월 환산액 + 학원 좌석 청구액. 요금제 화면의 단가·비율을 그대로 씁니다."
          />
          <Def
            term="추정 ARPU"
            desc="MRR ÷ 유료 건수. 유료 건수는 개인 이용권 수 + 학원 연계 학생 수입니다."
          />
          <Def term="배정 제출률" desc="배정 건별 제출 여부. 학생 수가 아니라 배정 건 수로 셉니다." />
          <Def
            term="누적 풀이"
            desc="콘텐츠별 배정 풀이 + 개인 학습 풀이. 테스트 집계이며 실제 로그가 아닙니다."
          />
        </View>
      </Section>

      <AccountSettings />
    </Screen>
  );
}

function Def({ term, desc }: { term: string; desc: string }) {
  return (
    <View style={styles.def}>
      <AppText variant="caption" style={styles.defTerm}>
        {term}
      </AppText>
      <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
        {desc}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  lineRow: { flexDirection: 'row', justifyContent: 'space-between' },
  lineValue: { fontFamily: typeface.medium },
  defs: { gap: spacing.sm },
  def: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  defTerm: { fontFamily: typeface.semibold, color: colors.ink, width: 92 },
});
