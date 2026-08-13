import { useRouter } from 'expo-router';
import { Section } from './Section';
import { Group } from './Group';
import { Row } from './Row';
import { useFinishImpersonation } from './ImpersonationBanner';
import { useSession } from '@/session';
import { useTheme, THEME_LABEL } from '@/theme/ThemeProvider';

/**
 * 내 정보/관리 화면의 설정 묶음: 테마 전환 + 로그아웃.
 *
 * **대리 보기 중에는 로그아웃 자리를 `대리 보기 끝내기`로 바꾼다.** 그대로 두면 대상의
 * `내 정보`에서 누른 로그아웃이 운영자 세션까지 끊어 `/login`으로 떨어지고, 종료 기록도 남지
 * 않는다(A-070). `공간 바꾸기`도 대리 중에는 두지 않는다 — 대상의 다른 공간으로 옮기는 일은
 * 대리 보기가 할 일이 아니다. 대리 중이 아닐 때의 동작은 그대로다.
 */
export function AccountSettings() {
  const router = useRouter();
  const { account, signOut, impersonation } = useSession();
  const { mode, cycle } = useTheme();
  const finishImpersonation = useFinishImpersonation();
  // 한 계정이 여러 공간을 가지면 로그아웃 없이 전환할 수 있어야 한다.
  const multiSpace = (account?.roles.length ?? 0) > 1;

  return (
    <Section title="설정">
      <Group>
        {multiSpace && !impersonation ? (
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
        {impersonation ? (
          <Row
            title="대리 보기 끝내기"
            subtitle={`${impersonation.operator.name} 님 계정으로 돌아가요`}
            testID="settings-impersonation-end"
            onPress={() => void finishImpersonation('수동 종료')}
          />
        ) : (
          <Row
            title="로그아웃"
            onPress={() => {
              /*
                **로그아웃이 끝난 뒤에 이동한다.** 기다리지 않으면 로그인 화면에 먼저 도착하고,
                그 사이 다른 계정으로 로그인했을 때 **늦게 끝난 로그아웃이 방금 만든 세션을 지운다**
                (실측: 로그아웃 → 다른 계정 로그인이 로그인 화면에 머물렀다).
              */
              void (async () => {
                await signOut();
                router.replace('/login' as never);
              })();
            }}
          />
        )}
      </Group>
    </Section>
  );
}
