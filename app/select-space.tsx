import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Screen, Group, Row } from '@/components';
import type { Role } from '@/data';
import { useSession } from '@/session';
import { ROLE_HOME, ROLE_LABEL } from '@/session/routing';

/**
 * 공간마다 무엇을 하는 곳인지 한 줄.
 *
 * `Record<Role, …>`으로 둔다 — 예전 `Record<string, string>`은 `admin`이 빠진 채 타입 검사를
 * 통과해서, 다역할 총괄관리자가 생기면 그 줄의 부제만 조용히 비었다(`ROLE_LABEL`은 갖고 있었다).
 */
const ROLE_DESC: Record<Role, string> = {
  student: '내 학습과 기록',
  parent: '자녀 학습 확인',
  academy: '반·학생·학습 배정 관리',
  admin: '학원·계정·요금제 운영',
};

/**
 * 다역할 계정의 공간 선택. 한 계정으로 학생/학부모/학원을 오간다.
 *
 * 화면 이름은 들어오는 컨트롤과 같은 말로 둔다(`AccountSettings`의 `공간 바꾸기`).
 * 같은 일을 화면·컨트롤·랜딩이 저마다 다르게 부르면 같은 곳인지 알 수 없다.
 */
export default function SelectSpace() {
  const router = useRouter();
  const { account, loading, impersonation, signOut } = useSession();
  /**
   * 온 곳(`/select-space?from=…`). 진입 경로가 둘이다 — **로그인 직후**에는 되돌릴 곳이 없고
   * (`homeHrefFor`가 `replace`로 보낸다), **`내 정보 → 공간 바꾸기`**로 들어오면 있다.
   * 화면 스스로는 둘을 구분할 수 없어서 `AccountSettings`가 온 곳을 붙여 준다.
   *
   * **앱 안의 경로만 받는다.** `//other.example`을 그대로 따라가면 이 화면이 밖으로 내보내는
   * 문이 된다(`app/login.tsx`의 `next`와 같은 판단).
   */
  const { from } = useLocalSearchParams<{ from?: string }>();
  const backTo = typeof from === 'string' && /^\/(?!\/)/.test(from) ? from : undefined;
  // 직접 URL 진입이나 새로고침으로 세션이 없으면 흰 화면 대신 로그인으로 보낸다.
  if (loading) return null;
  if (!account) return <Redirect href={'/login' as never} />;

  return (
    <Screen
      testID="select-space"
      /*
        온 곳이 있을 때만 뒤로가기를 그린다. 그냥 확인만 하러 들어온 사람에게 공간 하나를
        고르는 것 말고 나갈 길이 없었다. 로그인 직후에는 되돌릴 곳이 로그인 전 화면이라 두지 않는다.
      */
      backFallback={backTo}
      eyebrow={account.name}
      title="공간 바꾸기"
      lead={
        backTo
          ? '한 계정에서 여러 공간을 사용할 수 있어요.'
          : '쓸 공간을 골라 주세요. 나중에 내 정보에서 바꿀 수 있어요.'
      }
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

      {/*
        로그인 직후에 이 화면으로 온 사람에게는 공간을 고르는 것 말고 나갈 길이 없다 —
        다른 계정으로 바꾸려면 아무 공간이나 골라 `내 정보`까지 가야 했다.
        **대리 보기 중에는 두지 않는다**: 대상의 로그아웃이 운영자 세션까지 끊는다(D-073).
      */}
      {!backTo && !impersonation ? (
        <Button
          testID="select-space-signout"
          variant="secondary"
          hug
          label="로그아웃"
          onPress={() => {
            // 로그아웃이 끝난 뒤에 이동한다(`AccountSettings`와 같은 이유 — 늦게 끝난
            // 로그아웃이 그 사이 만든 세션을 지운다).
            void (async () => {
              await signOut();
              router.replace('/login' as never);
            })();
          }}
        />
      ) : null}
    </Screen>
  );
}
