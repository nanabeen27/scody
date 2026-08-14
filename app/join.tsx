import { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Brand, Button, Group, Row } from '@/components';
import { AuthError, TextLink } from '@/features/auth/AuthShell';
import { acceptInvite, inviteInfo, type InviteLookup } from '@/repo/directory';
import { useSession } from '@/session';
import { homeHrefFor } from '@/session/routing';
import { colors, spacing } from '@/theme/tokens';

const INVITEE_LABEL: Record<string, string> = {
  student: '학생',
  parent: '학부모',
  teacher: '선생님',
};

/**
 * 초대 링크 진입: `/join?invite=TOKEN`.
 *
 * ## 토큰은 서버에서 확인한다
 *
 * 예전에는 `getInvite`(fixture 3개)로 해석했다. 그래서 `INV-STUDENT` 같은 가짜 토큰이 완전한
 * 초대 화면을 만들고, 원장이 실제로 만든 토큰(`inviteTeacher`)은 `유효하지 않은 링크`로 떨어졌다.
 * 지금은 `rpc_invite_info`가 답한다 — 토큰을 아는 사람에게 학원 이름과 대상 역할만 준다.
 *
 * ## 읽는 동안 없다고 말하지 않는다
 *
 * 조회는 왕복이 필요하다. 그 사이에 `유효하지 않은 초대 링크`를 보여 주면, 정상 링크로 들어온
 * 사람이 먼저 그 문장을 읽는다. 그래서 확인 중 상태를 따로 둔다.
 */
export default function Join() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { account, loading: sessionLoading, reload, readOnly } = useSession();
  const { invite: param } = useLocalSearchParams<{ invite?: string }>();
  const token = String(param ?? '').trim();

  /** 다시 시도 횟수. 값이 바뀌면 조회를 다시 한다. */
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 수락을 끝낸 토큰. 끝나면 소속이 실제로 생겼는지 세션 스냅샷으로 확인한다. */
  const [acceptedToken, setAcceptedToken] = useState<string | null>(null);

  /*
    조회 결과를 **어떤 조회의 결과인지와 함께** 들고 있는다. 토큰이 바뀌거나 다시 시도하면
    키가 어긋나 곧바로 `확인 중`으로 돌아간다 — 효과 안에서 상태를 비우지 않고도 예전 초대가
    새 토큰의 답으로 보이는 일을 막는다.
  */
  const key = `${attempt}:${token}`;
  const [answer, setAnswer] = useState<{ key: string; result: InviteLookup } | null>(null);
  const lookup = answer?.key === key ? answer.result : null;
  const joined = acceptedToken === token;

  useEffect(() => {
    let alive = true;
    void inviteInfo(token).then((result) => {
      if (alive) setAnswer({ key, result });
    });
    return () => {
      alive = false;
    };
  }, [key, token]);

  /**
   * 로그인을 거쳐 이 화면으로 돌아온다. 토큰을 잃지 않는다.
   *
   * **`push`가 아니라 `replace`다.** `push`로 가면 로그인이 이 화면을 되돌려 놓을 때 앞의
   * 초대 화면이 스택에 남아, 웹에서 같은 화면이 두 벌 붙는다(하나는 숨은 채로 조회를 또 한다).
   * 초대 링크는 한 번 쓰는 진입점이라 되돌아갈 앞 단계도 없다.
   */
  function goLogin() {
    const back = `/join?invite=${encodeURIComponent(token)}`;
    router.replace(`/login?next=${encodeURIComponent(back)}` as never);
  }

  async function accept() {
    if (busy) return;
    /*
      **대리 보기 중에는 수락하지 않는다**(D-071). 이 화면은 provider를 지나지 않고
      `acceptInvite`를 직접 부르는 앱 안 유일한 쓰기라, provider들이 쥔 `readOnly` 검사 밖에
      혼자 남아 있었다. 대리 중에는 `auth.uid()`가 운영자이므로(M-DB-6) 그대로 부르면
      **운영자 계정에** 소속과 역할이 붙고 초대가 소진되며, `tg_invites_immutable`(0031)이
      되돌리기를 막는다 — 실제 초대 대상은 `이미 사용한 초대예요`를 보게 된다.
    */
    if (readOnly) {
      setError('대리 보기 중에는 초대를 수락할 수 없어요.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await acceptInvite(token);
    if (!result.ok) {
      setBusy(false);
      setError(result.error ?? '초대를 수락하지 못했어요.');
      return;
    }
    /*
      **소속을 읽어 다시 그린다.** 수락은 서버에서 끝났지만 화면의 계정 스냅샷은 아직 예전
      값이다. 다시 읽지 않으면 `연결됐어요`라고 말하면서 소속은 비어 있는 화면이 된다.
    */
    await reload();
    setBusy(false);
    setAcceptedToken(token);
  }

  const body = (() => {
    // 세션 복원과 초대 조회가 끝나기 전에는 아무 판단도 하지 않는다.
    if (sessionLoading || !lookup) {
      return (
        <View style={styles.hero}>
          <AppText variant="title">초대를 확인하고 있어요</AppText>
          <AppText variant="bodyLg" tone="secondary">
            잠깐만 기다려 주세요.
          </AppText>
        </View>
      );
    }

    if (lookup.status === 'failed') {
      return (
        <View style={styles.hero}>
          <AppText variant="title">초대를 확인하지 못했어요</AppText>
          <AppText variant="bodyLg" tone="secondary">
            {lookup.error ?? '잠시 뒤 다시 시도해 주세요.'}
          </AppText>
          <Button
            testID="join-retry"
            hug
            label="다시 확인하기"
            onPress={() => setAttempt((n) => n + 1)}
          />
        </View>
      );
    }

    if (lookup.status === 'missing') {
      return (
        <View style={styles.hero}>
          <AppText variant="title">유효하지 않은 초대 링크예요</AppText>
          <AppText variant="bodyLg" tone="secondary">
            링크가 올바르지 않아요. 학원에 다시 요청해 주세요.
          </AppText>
          {/* 다른 화면으로 보내기만 하는 버튼은 전폭이 아니다(§8). 정상 경로와 모양이 갈려야 한다. */}
          <Button hug label="로그인으로" onPress={() => router.replace('/login' as never)} />
        </View>
      );
    }

    const invite = lookup.invite;
    if (!invite) {
      // 상태가 `missing`·`failed`가 아니면 초대가 있다. 타입을 좁히기 위한 자리다.
      return null;
    }
    const role = INVITEE_LABEL[invite.invitee] ?? invite.invitee;

    if (lookup.status === 'expired') {
      return (
        <View style={styles.hero}>
          <AppText variant="title">기간이 지난 초대예요</AppText>
          <AppText variant="bodyLg" tone="secondary">
            {invite.academyName}에 새 링크를 요청해 주세요.
          </AppText>
          <Button hug label="로그인으로" onPress={() => router.replace('/login' as never)} />
        </View>
      );
    }

    if (lookup.status === 'accepted') {
      return (
        <View style={styles.hero}>
          <AppText variant="title">이미 사용한 초대예요</AppText>
          <AppText variant="bodyLg" tone="secondary">
            이 링크로는 다시 연결할 수 없어요. 이미 연결했다면 로그인해서 확인할 수 있어요.
          </AppText>
          <Button hug label="로그인으로" onPress={() => router.replace('/login' as never)} />
        </View>
      );
    }

    // 여기부터는 아직 쓸 수 있는 초대다.
    if (joined) {
      /*
        **소속이 생겼다는 말은 스냅샷에서 확인한 뒤에 한다.** `academyName`은 `academy_members`를
        읽어 채운 값이다(`loadDirectory`). 비어 있으면 그 사실을 말한다.
      */
      const linked = account?.academyName === invite.academyName;
      return (
        <>
          <View style={styles.hero}>
            <AppText variant="title">
              {linked ? `${invite.academyName}과 연결됐어요` : '연결을 확인하는 중이에요'}
            </AppText>
            <AppText variant="bodyLg" tone="secondary">
              {linked
                ? '학원이 배정한 학습이 이제 함께 보여요.'
                : '수락은 끝났어요. 소속이 아직 화면에 보이지 않으면 다시 확인해 주세요.'}
            </AppText>
          </View>
          <Group>
            <Row title="소속" meta={account?.academyName ?? '확인되지 않았어요'} />
            <Row title="역할" meta={role} />
          </Group>
          {account ? (
            <Button
              testID="join-home"
              fullWidth
              label="내 화면으로 가기"
              onPress={() => router.replace(homeHrefFor(account) as never)}
            />
          ) : null}
          {!linked ? (
            <TextLink
              testID="join-recheck"
              label="소속 다시 확인하기"
              onPress={() => void reload()}
            />
          ) : null}
        </>
      );
    }

    /*
      학부모 초대는 소속이 아니라 자녀 연결이다. 어느 자녀인지 토큰만으로는 알 수 없어서
      서버가 수락을 거부한다(`rpc_accept_invite`). 누르면 거부되는 버튼을 두지 않고 미리 말한다.
    */
    if (invite.invitee === 'parent') {
      return (
        <>
          <View style={styles.hero}>
            <AppText variant="eyebrow" tone="tertiary">
              초대
            </AppText>
            <AppText variant="title">
              {invite.inviterLabel}이 {role}으로 초대했어요
            </AppText>
            <AppText variant="bodyLg" tone="secondary">
              학부모 연결은 자녀 확인이 필요해요. 이 링크만으로는 연결되지 않아요.
            </AppText>
          </View>
          <Group>
            <Row title="초대한 학원" meta={invite.academyName} />
            <Row title="역할" meta={role} />
          </Group>
          <AppText variant="caption" tone="tertiary">
            학원에 자녀 확인을 요청해 주세요.
          </AppText>
        </>
      );
    }

    return (
      <>
        <View style={styles.hero}>
          <AppText variant="eyebrow" tone="tertiary">
            초대
          </AppText>
          <AppText variant="title">
            {invite.inviterLabel}이 {role}으로 초대했어요
          </AppText>
          <AppText variant="bodyLg" tone="secondary">
            {account
              ? `수락하면 ${invite.academyName} 소속이 추가돼요. 지금 계정과 학습 기록은 그대로예요.`
              : `로그인하면 ${invite.academyName}에 연결할 수 있어요. 기존 계정이 있으면 새로 만들지 않고 소속만 추가돼요.`}
          </AppText>
        </View>
        <Group>
          <Row title="연결될 학원" meta={invite.academyName} />
          <Row title="역할" meta={role} />
        </Group>
        {error ? <AuthError>{error}</AuthError> : null}
        {account ? (
          <>
            <Button
              testID="join-accept"
              fullWidth
              label={busy ? '연결하고 있어요' : `${invite.academyName}에 연결하기`}
              accessibilityLabel={`${invite.academyName}에 ${role}으로 연결하기`}
              onPress={() => void accept()}
            />
            {/*
              인증 화면의 보조 행동은 전폭 버튼을 하나 더 쌓지 않고 링크로 내린다(§15).
              지금 계정이 초대받은 사람이 아닐 수 있어서 계정을 바꿀 길을 남긴다.
            */}
            <TextLink
              testID="join-other"
              label={`${account.name} 아닌가요? 다른 계정으로 로그인`}
              onPress={goLogin}
            />
          </>
        ) : (
          <Button
            testID="join-login"
            fullWidth
            label="로그인하고 연결하기"
            onPress={goLogin}
          />
        )}
      </>
    );
  })();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.huge }]}
    >
      <View style={styles.column}>
        <Brand />
        {body}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, alignItems: 'center' },
  column: { width: '100%', maxWidth: 460, gap: spacing.xxl },
  hero: { gap: spacing.sm },
});
