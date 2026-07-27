import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Screen, Group, Row, AppText } from '@/components';
import { useCurrentAccount } from '@/session';
import { getChildren } from '@/data';
import { spacing } from '@/theme/tokens';

/** 자녀: 연결된 자녀 목록에서 자녀를 선택해 전환한다. */
export default function ParentChildren() {
  const router = useRouter();
  const account = useCurrentAccount();
  const children = getChildren(account.userId);

  return (
    <Screen testID="parent-children" title="자녀">
      {children.length === 0 ? (
        <Group>
          <View style={{ padding: spacing.lg }}>
            <AppText tone="secondary">연결된 자녀가 없어요.</AppText>
          </View>
        </Group>
      ) : (
        <Group>
          {children.map((c) => (
            <Row
              key={c.userId}
              title={c.name}
              subtitle={c.academyName ? `${c.academyName} 연계` : '개인 학습'}
              showChevron
              onPress={() => router.push(`/parent/child/${c.userId}` as never)}
            />
          ))}
        </Group>
      )}
    </Screen>
  );
}
