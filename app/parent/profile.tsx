import { View } from 'react-native';
import { Screen, Section, Group, Row, AppText, AccountSettings } from '@/components';
import { maskPhone } from '@/data';
import { useCurrentAccount, useSession } from '@/session';
import { spacing } from '@/theme/tokens';

/** 내 정보: 구독 상태(자녀별 결제)와 계정. */
export default function ParentProfile() {
  const account = useCurrentAccount();
  const { childrenOf } = useSession();
  const children = childrenOf(account.userId);
  // 학생 `내 정보`와 같은 규칙으로 가린 번호. 없으면 `undefined`고 화면이 사실을 적는다.
  const phone = account.phone ? maskPhone(account.phone) : undefined;
  const paid = children.flatMap((c) =>
    c.entitlements
      .filter((e) => e.payer === 'parent')
      .map((e) => ({ child: c.name, label: e.label })),
  );

  return (
    <Screen testID="parent-profile" title="내 정보">
      <Section title="구독 상태">
        {paid.length > 0 ? (
          <Group>
            {paid.map((p, i) => (
              /* 어떤 이용권을 결제하고 있는지가 이 줄의 값이다 — `meta`가 아니라 `trailing`(§20). */
              <Row
                key={i}
                title={p.child}
                trailing={<AppText variant="label">{p.label}</AppText>}
              />
            ))}
          </Group>
        ) : (
          <Group>
            <View style={{ padding: spacing.lg }}>
              <AppText tone="secondary">학부모가 결제 중인 구독이 없어요.</AppText>
            </View>
          </Group>
        )}
      </Section>

      <Section title="계정">
        <Group>
          <Row
            title="스코디 아이디"
            trailing={<AppText variant="label">{account.scodyId}</AppText>}
          />
          {/*
            학생 `내 정보`와 같은 규칙이다: 값 자리에는 마스킹한 번호, 용도는 부제.
            마스킹은 운영자 계정 상세와 같은 `maskPhone`을 쓴다. 바꾸는 행동은 실제 인증이
            붙는 날 함께 온다(M-DB-2).
          */}
          <Row
            title="휴대폰 번호"
            subtitle="인증·복구·초대 확인에 써요"
            trailing={
              <AppText variant="label" tone={phone ? 'default' : 'secondary'}>
                {phone ?? '등록된 번호가 없어요'}
              </AppText>
            }
          />
        </Group>
      </Section>

      <AccountSettings />
    </Screen>
  );
}
