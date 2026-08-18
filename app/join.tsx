import { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Brand, Button, Group, Row } from '@/components';
import { AuthError, TextLink } from '@/features/auth/AuthShell';
import { acceptInvite, inviteInfo, type InviteLookup } from '@/repo/directory';
import { useSession } from '@/session';
import { DEV_LOGIN_ENABLED } from '@/session/devAccounts';
import { homeHrefFor } from '@/session/routing';
import { colors, spacing } from '@/theme/tokens';

const INVITEE_LABEL: Record<string, string> = {
  student: '학생',
  parent: '학부모',
  teacher: '선생님',
};

/**
 * 받침에 따라 조사를 고른다.
 *
 * 화면에 넣는 이름을 우리가 정하지 않는다 — 학원 이름은 `rpc_invite_info`가 준 값이고 역할
 * 이름은 위 표에서 온다. 고정 조사를 붙여 두면 `학부모으로 초대했어요`(실제로 그랬다)나
 * `새길아카데미과 연결됐어요`가 나온다. 한글이 아닌 글자로 끝나면 받침이 있는 쪽으로 둔다.
 */
function josa(word: string, withFinal: string, withoutFinal: string): string {
  const code = word.trim().slice(-1).charCodeAt(0);
  const hangul = code >= 0xac00 && code <= 0xd7a3;
  return !hangul || (code - 0xac00) % 28 !== 0 ? withFinal : withoutFinal;
}

/**
 * 로그인 수단이 아직 연결되지 않았다는 사실(M-DB-2 — 카카오 개발자 앱 등록과 SMS provider
 * 계약이 선행 조건이다).
 *
 * 로그인·가입 화면은 그 사실을 화면에서 밝히는데 초대 화면만 밝히지 않아서, **초대받은 사람만**
 * 그것을 모른 채 `로그인하면 연결할 수 있어요`를 읽고 로그인으로 갔다. 개발용 로그인이 켜진
 * 빌드에서는 실제로 들어갈 수 있으므로(D-135) 그때는 이 문장을 두지 않는다 — 거짓이 된다.
 */
const LOGIN_PENDING = DEV_LOGIN_ENABLED ? null : '카카오·휴대폰 로그인은 아직 연결되지 않았어요.';

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
 *
 * ## 어떤 상태에서도 여기서 할 수 있는 일이 하나는 있다
 *
 * 이 화면은 초대 링크를 누른 사람이 처음 만나는 화면이고, 히스토리가 없는 직접 진입이라 뒤로
 * 갈 앞 단계도 없다. 그런데 상태 다섯 개(만료·이미 사용·없는 토큰·코드 없는 주소·학부모)가
 * **누를 것이 없거나 문구와 다른 곳으로 보내는 버튼 하나**로 끝났다 — 학부모 분기는 버튼도
 * 링크도 0개였고, 나머지는 본문이 `학원에 새 링크를 요청해 주세요`라고 하면서 버튼은
 * `로그인으로` 하나였다(계정이 없는 사람에게는 아무것도 해결하지 못한다).
 *
 * 그래서 상태마다 **지금 할 수 있는 일**을 정한다(D-141: 할 수 없는 일에는 버튼을 두지 않고
 * 이유를 한 줄로 말한다). 공통 이탈 경로는 `exits`가 만들고, 워드마크도 나가는 길이다.
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

  /** 로그인·가입을 거쳐 이 화면으로 돌아올 주소. 토큰을 잃지 않는다. */
  const backHref = `/join?invite=${encodeURIComponent(token)}`;

  /**
   * 로그인을 거쳐 이 화면으로 돌아온다.
   *
   * **`push`가 아니라 `replace`다.** `push`로 가면 로그인이 이 화면을 되돌려 놓을 때 앞의
   * 초대 화면이 스택에 남아, 웹에서 같은 화면이 두 벌 붙는다(하나는 숨은 채로 조회를 또 한다).
   * 초대 링크는 한 번 쓰는 진입점이라 되돌아갈 앞 단계도 없다.
   */
  function goLogin() {
    router.replace(`/login?next=${encodeURIComponent(backHref)}` as never);
  }

  /**
   * 계정이 없는 사람의 다음 단계. 초대를 처음 받은 사람에게는 이쪽이 정상 경로다.
   *
   * **`next`를 실어 보내지만 `/signup`은 아직 그 값을 읽지 않는다.** 그래서 가입을 거치면 토큰이
   * 사라져 이 화면으로 돌아오지 못한다 — 고칠 자리는 `app/signup.tsx`(받아서 로그인 링크에 붙이기)와
   * `app/login.tsx`의 `회원가입` 링크(`next` 전달)이고 둘 다 이 화면의 파일이 아니다. 여기서는
   * 넘길 값을 정확히 넘긴다.
   */
  function goSignup() {
    router.replace(`/signup?next=${encodeURIComponent(backHref)}` as never);
  }

  /** 초대와 무관하게 이 화면에서 나가는 길. 워드마크가 쓴다(§15 — 누르면 나가는 길이다). */
  function exit() {
    if (account) {
      router.replace(homeHrefFor(account) as never);
      return;
    }
    if (router.canGoBack()) router.back();
    else if (Platform.OS === 'web') router.replace('/introduce' as never);
    else router.replace('/login' as never);
  }

  /**
   * 막힌 화면을 만들지 않기 위한 이탈 경로.
   *
   * - 계정이 있으면 자기 화면으로 나간다. 초대가 어떤 상태든 그 사람이 지금 쓸 수 있는 화면이다.
   * - 계정이 없으면 로그인이고, `signup`이면 가입 링크를 함께 둔다 — 초대를 처음 받은 사람에게
   *   `로그인`만 주면 그 사람이 할 수 있는 일은 0개다.
   * - `returnHere`는 **이 화면으로 돌아올 값이 있을 때만** 준다. 못 쓰는 링크로 돌아오게 하면
   *   로그인을 마치고 같은 막힌 화면을 다시 읽는다.
   */
  function exits({ signup, returnHere }: { signup?: boolean; returnHere?: boolean } = {}) {
    if (account) {
      return (
        <Button
          testID="join-exit"
          hug
          variant="secondary"
          label="내 화면으로 가기"
          onPress={() => router.replace(homeHrefFor(account) as never)}
        />
      );
    }
    return (
      <View style={styles.exits}>
        <Button
          testID="join-to-login"
          hug
          variant="secondary"
          label="로그인하기"
          onPress={returnHere ? goLogin : () => router.replace('/login' as never)}
        />
        {LOGIN_PENDING ? (
          <AppText variant="caption" tone="secondary">
            {LOGIN_PENDING}
          </AppText>
        ) : null}
        {signup ? (
          <TextLink
            testID="join-signup"
            label="계정이 없으면 회원가입"
            onPress={returnHere ? goSignup : () => router.replace('/signup' as never)}
          />
        ) : null}
      </View>
    );
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
        <>
          <View style={styles.hero}>
            <AppText variant="title">초대를 확인하지 못했어요</AppText>
            <AppText variant="bodyLg" tone="secondary">
              {lookup.error ?? '잠시 뒤 다시 시도해 주세요.'}
            </AppText>
          </View>
          {/*
            여기서 할 일은 다시 확인하는 것이고, 계속 실패하면 나갈 길이 있어야 한다 —
            설정이 없어서 실패하는 경우에는 몇 번을 눌러도 같은 화면이다.
          */}
          <Button
            testID="join-retry"
            hug
            label="다시 확인하기"
            onPress={() => setAttempt((n) => n + 1)}
          />
          {/*
            실패는 초대가 잘못됐다는 뜻이 아니다 — 서버에 닿지 못한 것일 수도 있다. 그래서
            토큰이 있으면 로그인 뒤 이 화면으로 돌아오게 두고, 없으면 돌아올 값이 없다.
          */}
          {exits({ returnHere: Boolean(token) })}
        </>
      );
    }

    if (lookup.status === 'missing') {
      /*
        **주소에 코드가 없는 것과 코드가 틀린 것을 가른다.** 예전에는 둘 다 `유효하지 않은 초대
        링크예요` + `학원에 다시 요청해 주세요`였다 — `/join`만 열어 본 사람에게는 결론이 과하고,
        요청할 학원도 우리가 모른다(토큰이 없으니 조회할 것도 없었다).
      */
      if (!token) {
        return (
          <>
            <View style={styles.hero}>
              <AppText variant="title">초대 코드가 없는 주소예요</AppText>
              <AppText variant="bodyLg" tone="secondary">
                받은 초대 링크를 그대로 열면 초대 내용이 보여요.
              </AppText>
            </View>
            {exits()}
          </>
        );
      }
      return (
        <>
          <View style={styles.hero}>
            <AppText variant="title">유효하지 않은 초대 링크예요</AppText>
            <AppText variant="bodyLg" tone="secondary">
              이 링크로는 연결할 수 없어요.
            </AppText>
            {/* 새 링크는 학원만 만들 수 있다. 여기서 대신 요청할 수단은 없어서 사실만 말한다. */}
            <AppText variant="caption" tone="secondary">
              링크를 보낸 학원에 새 링크를 요청해 주세요.
            </AppText>
          </View>
          {exits({ signup: true })}
        </>
      );
    }

    const invite = lookup.invite;
    if (!invite) {
      // 상태가 `missing`·`failed`가 아니면 초대가 있다. 타입을 좁히기 위한 자리다.
      return null;
    }
    const role = INVITEE_LABEL[invite.invitee] ?? invite.invitee;
    const asRole = `${role}${josa(role, '으로', '로')}`;

    if (lookup.status === 'expired') {
      return (
        <>
          <View style={styles.hero}>
            <AppText variant="title">기간이 지난 초대예요</AppText>
            <AppText variant="bodyLg" tone="secondary">
              {invite.academyName}에 새 링크를 요청해 주세요.
            </AppText>
            {/* 계정이 있는 사람은 새 링크만 받으면 되고, 없는 사람은 가입이 먼저다. */}
            <AppText variant="caption" tone="secondary">
              {account
                ? '새 링크를 받으면 그때 연결할 수 있어요.'
                : '계정을 먼저 만들어 두면 새 링크로 바로 연결할 수 있어요.'}
            </AppText>
          </View>
          {exits({ signup: true })}
        </>
      );
    }

    if (lookup.status === 'accepted') {
      return (
        <>
          <View style={styles.hero}>
            <AppText variant="title">이미 사용한 초대예요</AppText>
            <AppText variant="bodyLg" tone="secondary">
              이 링크로는 다시 연결할 수 없어요.
            </AppText>
            <AppText variant="caption" tone="secondary">
              {account
                ? '연결된 학원은 내 정보에서 확인할 수 있어요.'
                : '이미 연결했다면 로그인해서 확인할 수 있어요.'}
            </AppText>
            {/* 내가 쓴 초대가 아니라면 남은 길은 새 링크뿐이다. */}
            <AppText variant="caption" tone="secondary">
              연결한 적이 없다면 {invite.academyName}에 새 링크를 요청해 주세요.
            </AppText>
          </View>
          {exits({ signup: true })}
        </>
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
              {linked
                ? `${invite.academyName}${josa(invite.academyName, '과', '와')} 연결됐어요`
                : '연결을 확인하는 중이에요'}
            </AppText>
            <AppText variant="bodyLg" tone="secondary">
              {linked
                ? '학원이 배정한 학습이 이제 함께 보여요.'
                : '수락은 끝났어요. 소속이 아직 화면에 보이지 않으면 다시 확인해 주세요.'}
            </AppText>
          </View>
          {/*
            **값은 `meta`가 아니라 `trailing`이다**(§8). `meta`는 `inkTertiary`(2.96:1, AA 미달)라
            지금 무엇에 연결됐는지가 화면에서 가장 흐린 글자가 된다 — 이 화면에서 확인하러 온
            바로 그 값이다.
          */}
          <Group>
            <Row
              title="소속"
              trailing={
                <AppText variant="label">{account?.academyName ?? '확인되지 않았어요'}</AppText>
              }
            />
            <Row title="역할" trailing={<AppText variant="label">{role}</AppText>} />
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

      **그렇다고 누를 것이 0개인 화면으로 끝내지 않는다.** 예전에는 제목·설명·`Group`·캡션까지만
      있고 버튼도 링크도 없었다 — 로그인 상태든 아니든 여기서 나갈 길이 없었고, `학원에 요청해
      주세요`라고 하면서 그 학원에 연락할 수단도 없었다. 지금은 ①무엇을 기다리는지 ②그동안
      할 수 있는 일(자기 화면·로그인·가입)을 함께 둔다.
    */
    if (invite.invitee === 'parent') {
      return (
        <>
          <View style={styles.hero}>
            <AppText variant="eyebrow" tone="secondary">
              초대
            </AppText>
            <AppText variant="title">
              {invite.inviterLabel}
              {josa(invite.inviterLabel, '이', '가')} {asRole} 초대했어요
            </AppText>
            <AppText variant="bodyLg" tone="secondary">
              학부모 연결은 자녀 확인이 필요해요.
            </AppText>
            <AppText variant="caption" tone="secondary">
              이 링크만으로는 연결되지 않아요.
            </AppText>
          </View>
          <Group>
            <Row
              title="초대한 학원"
              trailing={<AppText variant="label">{invite.academyName}</AppText>}
            />
            <Row title="역할" trailing={<AppText variant="label">{role}</AppText>} />
          </Group>
          {/*
            기다리는 쪽이 학원이라는 사실을 밝힌다. 어느 자녀인지는 학원이 정하고(3절), 곧
            대상 학생이 토큰에 실린다 — 그때도 이 문장은 그대로 맞다.
          */}
          <AppText variant="body" tone="secondary">
            {invite.academyName}
            {josa(invite.academyName, '이', '가')} 자녀를 확인해 연결하면 리포트에서 자녀 학습을 볼
            수 있어요.
          </AppText>
          {exits({ signup: true })}
        </>
      );
    }

    return (
      <>
        <View style={styles.hero}>
          <AppText variant="eyebrow" tone="secondary">
            초대
          </AppText>
          <AppText variant="title">
            {invite.inviterLabel}
            {josa(invite.inviterLabel, '이', '가')} {asRole} 초대했어요
          </AppText>
          {/*
            로그인 수단이 연결되지 않은 빌드에서는 `로그인하면 연결할 수 있어요`가 거짓이다
            (M-DB-2). 그때는 필요한 조건만 말하고, 지금 안 되는 이유는 버튼 아래 캡션이 맡는다.
          */}
          <AppText variant="bodyLg" tone="secondary">
            {account
              ? `수락하면 ${invite.academyName} 소속이 추가돼요. 지금 계정과 학습 기록은 그대로예요.`
              : LOGIN_PENDING
                ? `${invite.academyName}에 연결하려면 로그인이 필요해요. 기존 계정이 있으면 새로 만들지 않고 소속만 추가돼요.`
                : `로그인하면 ${invite.academyName}에 연결할 수 있어요. 기존 계정이 있으면 새로 만들지 않고 소속만 추가돼요.`}
          </AppText>
        </View>
        <Group>
          <Row
            title="연결될 학원"
            trailing={<AppText variant="label">{invite.academyName}</AppText>}
          />
          <Row title="역할" trailing={<AppText variant="label">{role}</AppText>} />
        </Group>
        {error ? <AuthError>{error}</AuthError> : null}
        {account ? (
          <>
            <Button
              testID="join-accept"
              fullWidth
              label={busy ? '연결하고 있어요' : `${invite.academyName}에 연결하기`}
              accessibilityLabel={`${invite.academyName}에 ${asRole} 연결하기`}
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
          <View style={styles.exits}>
            <Button testID="join-login" fullWidth label="로그인하고 연결하기" onPress={goLogin} />
            {LOGIN_PENDING ? (
              <AppText variant="caption" tone="secondary">
                {LOGIN_PENDING}
              </AppText>
            ) : null}
            {/* 초대를 처음 받은 사람은 계정이 없다. 그 사람의 다음 단계를 남긴다. */}
            <TextLink testID="join-signup" label="계정이 없으면 회원가입" onPress={goSignup} />
          </View>
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
        {/* 워드마크는 어느 서비스인지 밝히면서 나가는 길도 된다(§15). 예전에는 누를 수 없었다. */}
        <Brand testID="join-brand" accessibilityLabel="스코디로 가기" onPress={exit} />
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
  /* 버튼과 그 버튼에 딸린 설명·링크는 한 덩어리다. 사이가 벌어지면 무엇에 대한 말인지 흐려진다. */
  exits: { gap: spacing.sm, alignItems: 'flex-start' },
});
