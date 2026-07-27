import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, ChildReport, Button } from '@/components';
import { useCurrentAccount } from '@/session';
import { getChildren } from '@/data';

/** 자녀 상세 리포트. 연결된 자녀만 열람 가능(권한 경계). */
export default function ParentChildDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const account = useCurrentAccount();
  const child = getChildren(account.userId).find((c) => c.userId === id);

  if (!child) {
    return (
      <Screen testID="parent-child" title="자녀를 찾을 수 없어요">
        <Button label="홈으로" onPress={() => router.replace('/parent' as never)} />
      </Screen>
    );
  }

  return (
    <Screen testID="parent-child" eyebrow="자녀 리포트" title={`${child.name} 님`}>
      <ChildReport child={child} allowRetry />
    </Screen>
  );
}
