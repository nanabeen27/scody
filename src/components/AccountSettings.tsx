import { useRouter } from 'expo-router';
import { Section } from './Section';
import { Group } from './Group';
import { Row } from './Row';
import { useSession } from '@/session';
import { useTheme, THEME_LABEL } from '@/theme/ThemeProvider';

/** 내 정보/관리 화면의 설정 묶음: 테마 전환 + 로그아웃. */
export function AccountSettings() {
  const router = useRouter();
  const { account, signOut } = useSession();
  const { mode, cycle } = useTheme();
  // 한 계정이 여러 공간을 가지면 로그아웃 없이 전환할 수 있어야 한다.
  const multiSpace = (account?.roles.length ?? 0) > 1;

  return (
    <Section title="설정">
      <Group>
        {multiSpace ? (
          <Row
            title="공간 바꾸기"
            subtitle="학생·학부모·학원 공간을 오갈 수 있어요"
            testID="switch-space"
            showChevron
            onPress={() => router.push('/select-space' as never)}
          />
        ) : null}
        <Row
          title="테마"
          subtitle="화면 밝기"
          meta={THEME_LABEL[mode]}
          onPress={cycle}
          accessibilityLabel="테마 전환"
        />
        <Row
          title="로그아웃"
          onPress={() => {
            signOut();
            router.replace('/login' as never);
          }}
        />
      </Group>
    </Section>
  );
}
