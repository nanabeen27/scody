import { View } from 'react-native';
import { Screen, Section, Group, Row, AppText, AccountSettings } from '@/components';
import { useCurrentAccount, useSession } from '@/session';
import { spacing } from '@/theme/tokens';

/** 내 정보: 구독 상태(자녀별 결제)와 계정. */
export default function ParentProfile() {
  const account = useCurrentAccount();
  const { childrenOf } = useSession();
  const children = childrenOf(account.userId);
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
              <Row key={i} title={p.child} meta={p.label} />
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
          <Row title="스코디 아이디" meta={account.scodyId} />
          <Row title="휴대폰 번호" meta="인증·복구·초대 확인용" />
        </Group>
      </Section>

      <AccountSettings />
    </Screen>
  );
}
