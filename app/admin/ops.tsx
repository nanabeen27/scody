import { useMemo, useState } from 'react';
import { Screen, Section, Group, Row, Chips, AppText, type ChipOption } from '@/components';
import { useAudit, auditTime, type AuditAction } from '@/features/audit';
import { usePricing, DEFAULT_PRICING, won, type PricingPolicy } from '@/features/pricing';
import { useContent } from '@/features/content';
import { ACCOUNTS, ACADEMY_CLASSES } from '@/data';

type Filter = '전체' | AuditAction;

const LABELS: Record<keyof PricingPolicy, string> = {
  studentPaid: '개인 월정액 · 학생 결제',
  parentPaid: '개인 월정액 · 학부모 결제',
  academySeat: '학원 좌석 단가',
  seatDiscountPct: '학원 규모 할인율',
  seatDiscountFrom: '규모 할인 시작 좌석',
  annualDiscountPct: '연 결제 할인율',
  annualSharePct: '연 결제 비율',
};

/** 항목별 단위. 비율을 단위 없이 적으면 "현재 20"처럼 읽혀 무슨 값인지 알 수 없다. */
const UNITS: Record<keyof PricingPolicy, '원' | '%' | '명'> = {
  studentPaid: '원',
  parentPaid: '원',
  academySeat: '원',
  seatDiscountPct: '%',
  seatDiscountFrom: '명',
  annualDiscountPct: '%',
  annualSharePct: '%',
};

function format(key: keyof PricingPolicy, value: number): string {
  const unit = UNITS[key];
  return unit === '원' ? won(value) : `${value}${unit}`;
}

/**
 * 운영 기록. 무엇을 바꿨는지(감사 로그)와 화면의 숫자가 어디서 왔는지(데이터 출처)를 한곳에 둔다.
 * 숫자를 믿을 수 있게 만드는 화면이라 지표 타일을 두지 않는다.
 */
export default function AdminOps() {
  const { entries } = useAudit();
  const { policy } = usePricing();
  const { sets } = useContent();
  const [filter, setFilter] = useState<Filter>('전체');

  const counts = useMemo(() => {
    const by = (a: AuditAction) => entries.filter((e) => e.action === a).length;
    return {
      all: entries.length,
      price: by('요금 정책'),
      content: by('콘텐츠'),
      account: by('계정'),
      etc: by('기타'),
    };
  }, [entries]);

  const options: readonly ChipOption<Filter>[] = [
    { value: '전체', label: '전체', count: counts.all },
    { value: '요금 정책', label: '요금 정책', count: counts.price },
    { value: '콘텐츠', label: '콘텐츠', count: counts.content },
    { value: '계정', label: '계정', count: counts.account },
    { value: '기타', label: '기타', count: counts.etc },
  ];

  const shown = filter === '전체' ? entries : entries.filter((e) => e.action === filter);

  // 기본값과 다른 요금 항목. 지금 서비스가 어떤 정책으로 돌고 있는지 한눈에 본다.
  const overrides = (Object.keys(DEFAULT_PRICING) as (keyof PricingPolicy)[])
    .filter((k) => policy[k] !== DEFAULT_PRICING[k])
    .map((k) => ({
      key: k,
      label: LABELS[k],
      from: format(k, DEFAULT_PRICING[k]),
      to: format(k, policy[k]),
    }));

  return (
    <Screen
      wide
      testID="admin-ops"
      backFallback="/admin"
      eyebrow="총괄관리자"
      title="운영 기록"
      lead="설정을 누가 언제 바꿨는지, 화면의 숫자가 어디서 왔는지 확인해요."
    >
      <Section title={`현재 요금 정책 (기본값과 다른 항목 ${overrides.length}개)`}>
        <Group>
          {overrides.length ? (
            overrides.map((o) => (
              <Row key={o.key} title={o.label} subtitle={`기본값 ${o.from}`} meta={`현재 ${o.to}`} />
            ))
          ) : (
            <Row title="모두 기본값이에요" subtitle="요금제 화면에서 바꾼 항목이 없어요" />
          )}
        </Group>
      </Section>

      <Section title={`변경 기록 (${entries.length}건)`}>
        <Chips testID="ops-filter" options={options} value={filter} onChange={setFilter} />
        <Group>
          {shown.length ? (
            shown.map((e) => (
              <Row
                key={e.id}
                testID={`ops-row-${e.id}`}
                title={e.detail}
                subtitle={`${e.action} · ${e.actor}`}
                meta={auditTime(e.atISO)}
              />
            ))
          ) : (
            <Row title="아직 기록이 없어요" subtitle="요금제나 콘텐츠를 바꾸면 여기에 남아요" />
          )}
        </Group>
        <AppText variant="caption" tone="tertiary">
          프로토타입이라 기록은 이 세션에만 남아요. 운영에서는 서버가 남기고 지울 수 없어야 해요.
        </AppText>
      </Section>

      <Section title="이 숫자는 어디서 왔나요">
        <Group>
          <Row
            title="계정 · 학원 · 반"
            subtitle="결정적 fixture와 규모 확인용 로스터"
            meta={`계정 ${ACCOUNTS.length.toLocaleString('en-US')} · 반 ${ACADEMY_CLASSES.length}`}
          />
          <Row
            title="콘텐츠 · 문항"
            subtitle="시드 콘텐츠 + 이 세션에 등록한 문제"
            meta={`세트 ${sets.length} · 문항 ${sets.reduce((n, s) => n + s.questions.length, 0)}`}
          />
          <Row title="배정 · 제출" subtitle="배정 시드와 이 세션의 제출 기록" meta="메모리" />
          <Row
            title="풀이 횟수 · 문항 오답률"
            subtitle="콘텐츠 id로 만든 테스트 집계(src/data/usage.ts). 실제 로그가 아니에요"
            meta="테스트 집계"
          />
          <Row
            title="요금·매출"
            subtitle="요금제 화면 설정으로 계산한 추정값. 실제 결제·정산 기록이 아니에요"
            meta="추정"
          />
        </Group>
      </Section>

      <Section title="아직 없는 것">
        <Group>
          <Row
            title="실제 인증·서버 권한"
            subtitle="지금은 클라이언트 provider에서만 막고 있어요"
          />
          <Row title="영속 데이터베이스" subtitle="새로고침하면 이 세션의 변경이 사라져요" />
          <Row title="결제·정산 연동" subtitle="승인·영수증·갱신·환불이 없어요" />
        </Group>
      </Section>
    </Screen>
  );
}
