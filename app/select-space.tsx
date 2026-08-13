import { Redirect, useRouter } from 'expo-router';
import { Screen, Group, Row } from '@/components';
import { useSession } from '@/session';
import { ROLE_HOME, ROLE_LABEL } from '@/session/routing';

const ROLE_DESC: Record<string, string> = {
  student: '내 학습과 기록',
  parent: '자녀 학습 확인',
  academy: '반·학생·학습 배정 관리',
};

/** 다역할 계정의 공간 선택. 한 계정으로 학생/학부모/학원을 오간다. */
export default function SelectSpace() {
  const router = useRouter();
  const { account, loading } = useSession();
  // 직접 URL 진입이나 새로고침으로 세션이 없으면 흰 화면 대신 로그인으로 보낸다.
  if (loading) return null;
  if (!account) return <Redirect href={'/login' as never} />;

  return (
    <Screen
      testID="select-space"
      eyebrow={account.name}
      title="어디로 갈까요"
      lead="한 계정에서 여러 공간을 사용할 수 있어요."
    >
      <Group>
        {account.roles.map((role) => (
          <Row
            key={role}
            title={`${ROLE_LABEL[role]} 공간`}
            subtitle={ROLE_DESC[role]}
            onPress={() => router.replace(ROLE_HOME[role] as never)}
            showChevron
          />
        ))}
      </Group>
    </Screen>
  );
}
