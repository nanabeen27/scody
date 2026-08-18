import { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, Button, Divider, Field, KakaoSymbol } from '@/components';
import {
  AuthError,
  AuthHeading,
  AuthShell,
  LabeledDivider,
  TextLink,
} from '@/features/auth/AuthShell';
import { DemoAccounts } from '@/features/auth/DemoAccounts';
import { useSession } from '@/session';
import { DEV_KAKAO_SCODY_ID, DEV_LOGIN_ENABLED } from '@/session/devAccounts';
import { homeHrefFor } from '@/session/routing';
import type { Account } from '@/data';
import { spacing } from '@/theme/tokens';

/**
 * 로그인 화면.
 *
 * ## 무엇을 묻는가 (D-166)
 *
 * **스코디 아이디 + 비밀번호가 정식 로그인이다.** 가입 화면이 그 둘을 받는데(`app/signup.tsx`의
 * `signup-id`·`signup-pw`) 그것을 쓰는 공개 로그인이 없었고, 대신 이 화면은 휴대폰 번호를 받아
 * **인증번호 단계로 가는 척**했다. 실제로는 `setStep('code')`를 부르는 자리가 코드에 없어서
 * 인증번호 입력칸·`로그인` 버튼·그 `onSubmit`이 전부 죽은 코드였다
 * (`e2e/auth-flow.spec.ts`가 `login-phone-code`의 부재를 단정한다). 그런데 화면은
 * `AuthSteps step={1} total={2}`로 다음 단계가 있다고 말하고 `2단계 중 1단계`로 낭독됐다.
 *
 * 그래서 **단계를 없애고 한 화면에서 자격 증명을 받는다.** 서버는 이미 그 길을 안다 —
 * `signInWithScodyId`(= `supabase.auth.signInWithPassword`)를 `/staff`가 같은 방식으로 쓴다.
 * 휴대폰 번호는 확정 정책 2절의 원래 자리(인증·복구·초대 확인·연락처 변경·알림)로 돌려보냈다.
 *
 * ## 순서와 무게
 *
 * 지금 실제로 되는 것이 주 경로다: 아이디+비밀번호 → `또는` → 카카오. 카카오는 아직 연결되지
 * 않았고(M-DB-2) 개발용 로그인이 꺼진 빌드에서는 **버튼을 두지 않는다** — 눌러도 아무 일이 없는
 * 버튼을 두는 대신 이유를 한 줄로 말한다(D-141 · `DESIGN.md` §8).
 *
 * 구성은 `AuthShell`에 있다. 여기서는 무엇을 묻고 어떤 오류를 보여줄지만 정한다.
 */

/**
 * 자격 증명이 맞지 않을 때. **어느 쪽이 틀렸는지 말하지 않는다** — 아이디가 있는지 없는지를
 * 알려 주면 계정을 셀 수 있다(`/staff`가 같은 문장을 쓴다, D-165).
 *
 * 미가입 아이디와 비밀번호 오타가 같은 문장을 보는 것은 **의도**다. 가입 쪽은 반대로 갈라 말할 수
 * 있다(`이미 가입된 번호예요` + 로그인 링크, D-126) — 그쪽은 번호 소유자가 자기 번호를 물어보는
 * 자리이고, 이쪽은 남의 아이디를 넣어 보는 자리다.
 */
const SIGNIN_FAILED = '아이디나 비밀번호를 확인해 주세요.';

/**
 * `errorMessage`가 인증 실패에 붙이는 문장(`src/lib/supabase.ts`).
 *
 * **로그인 화면에서는 뜻이 통하지 않는다** — 방금 로그인을 시도한 사람에게 `다시 로그인해
 * 주세요.`는 무엇을 하라는 말인지 알려 주지 않는다. 그 문장이 오면 위 문구로 바꾼다. 그 밖의
 * 실패(연결 끊김 등)는 서버가 준 문장을 그대로 쓴다 — 원인이 다르면 다르게 말해야 한다.
 */
const RELOGIN_MESSAGE = '다시 로그인해 주세요.';

export default function Login() {
  const router = useRouter();
  /**
   * `account`를 읽는다. 이미 로그인한 사람이 `/login`으로 오면 예전에는 화면이 그 사실을 몰라서
   * `하던 학습을 이어서 할 수 있어요.`를 보여 주고, 카카오를 누르면 **조용히 다른 계정으로**
   * 세션이 갈렸다. 소개 페이지(`WebLanding`)는 이미 `내 공간으로 가기` 하나로 바꾼다.
   */
  const { account, loading, signInWithScodyId, signInWithTestAccount, signOut } = useSession();
  /**
   * 로그인 뒤 돌아갈 곳(`/login?next=…`). 초대 링크가 로그인을 거쳐도 이어지게 한다 —
   * 예전에는 `/join`에서 로그인으로 오면 토큰이 사라졌다.
   *
   * **앱 안의 경로만 받는다.** 웹에서 `//other.example`이나 `https://…`을 그대로 따라가면
   * 로그인 화면이 밖으로 내보내는 문이 된다.
   */
  const { next } = useLocalSearchParams<{ next?: string }>();
  const returnTo = typeof next === 'string' && /^\/(?!\/)/.test(next) ? next : undefined;
  const [scodyId, setScodyId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * 세션 복원 중. **`busy`일 때는 아니다** — `openSession`이 진행 중에도 `loading`을 올리므로,
   * 이 값을 그대로 쓰면 로그인을 누른 순간 폼과 오류 자리가 사라졌다 되돌아온다.
   */
  const restoring = loading && !busy && !account;

  function goHome(target: Account) {
    router.replace((returnTo ?? homeHrefFor(target)) as never);
  }

  /*
    세 갈래 모두 `finally`로 `busy`를 되돌린다. 던지는 경로가 남으면 `busy`가 참으로 굳고, 그
    상태에서는 `if (busy) return`이 모든 버튼을 조용히 삼킨다 — 이 화면에서 고치고 있는 바로 그
    증상("눌러도 아무 일이 없다")을 만드는 방향이다.
  */

  /** 아이디 + 비밀번호. 이 화면의 주 경로다(D-166). */
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await signInWithScodyId(scodyId, password);
      if (!result.ok || !result.account) {
        // 빈 칸 안내(`아이디를 적어 주세요.`)는 세션이 그대로 돌려주므로 그 문장을 살린다.
        setError(!result.error || result.error === RELOGIN_MESSAGE ? SIGNIN_FAILED : result.error);
        return;
      }
      goHome(result.account);
    } finally {
      setBusy(false);
    }
  }

  /** 개발용 계정으로 들어간다(패널·카카오 데모가 함께 쓴다). */
  async function enterTest(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await signInWithTestAccount(id);
      if (!result.ok || !result.account) {
        setError(result.error ?? '로그인하지 못했어요.');
        return;
      }
      goHome(result.account);
    } finally {
      setBusy(false);
    }
  }

  /*
    카카오는 아직 연결되지 않았다(M-DB-2). 개발용 로그인이 켜져 있으면 지금까지처럼 데모 계정으로
    들어간다. 꺼진 빌드에는 이 버튼 자체가 없으므로(아래 참고) 여기 오지 않는다 — 그래도 방어로
    남긴다: 스위치와 비밀번호는 따로 들어오고, 한쪽만 있으면 세션이 실패만 돌려준다(D-135).
  */
  function onKakao() {
    if (!DEV_LOGIN_ENABLED) {
      setError('카카오 로그인은 아직 연결되지 않았어요.');
      return;
    }
    void enterTest(DEV_KAKAO_SCODY_ID);
  }

  /** 다른 계정으로 들어가려면 지금 세션을 먼저 닫는다. 닫으면 이 화면이 폼으로 돌아온다. */
  async function switchAccount() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signOut();
    } finally {
      setBusy(false);
    }
  }

  /*
    **오류 자리는 두 갈래 모두에 있다.** 로그인한 상태에서도 테스트 계정 패널이 로그인을 시도할 수
    있는데, 오류 블록이 폼 쪽에만 있으면 그 실패가 조용히 사라진다(실측: 로그아웃 뒤 다시 로그인할
    때 아무 일도 일어나지 않는 것처럼 보였다).

    오류가 가리키는 행동을 그 자리에 두는 것은 D-126이다. 이 화면은 이제 **한 단계뿐이라**
    `회원가입` 링크가 오류와 같은 화면에 늘 함께 서 있다 — 그래서 오류 아래에 같은 라벨을 한 번 더
    두지 않는다. 예전에는 `테스트 계정 보기`가 오류 아래와 패널 토글에 **둘** 있었고, 둘의 상태가
    서로 어긋났다(하나는 열기 전용, 하나는 토글).
  */
  const errorBlock = error ? <AuthError>{error}</AuthError> : null;

  return (
    <AuthShell
      exitTestID="login-brand"
      exitLabel="스코디 소개로 가기"
      onExit={() => {
        // 들어온 화면이 있으면 그곳으로, 없으면 소개 페이지(앱은 그대로).
        if (router.canGoBack()) router.back();
        else if (Platform.OS === 'web') router.replace('/introduce' as never);
      }}
      /*
        **개발용 로그인이 꺼진 빌드에는 이 패널을 두지 않는다**(D-135). 호출부가 이렇게 감싸야
        꺼진 빌드에서 계정 목록이 번들에서 빠진다(D-165가 그 실수를 한 번 했다).
      */
      below={DEV_LOGIN_ENABLED ? <DemoAccounts onEnter={(id) => void enterTest(id)} /> : null}
    >
      {account ? (
        /*
          이미 로그인한 사람. 로그인을 다시 묻지 않고 **지금 갈 수 있는 곳**을 준다.
          초대 링크에서 왔으면(`returnTo`) 그곳으로 이어진다.
        */
        <>
          <AuthHeading title="이미 로그인했어요" sub={`${account.name}님으로 들어와 있어요.`} />
          <View style={styles.actions}>
            {errorBlock}
            <Button
              testID="login-mine"
              size="lg"
              fullWidth
              label="내 공간으로 가기"
              onPress={() => goHome(account)}
            />
            <TextLink
              testID="login-switch"
              label="다른 계정으로 로그인"
              onPress={() => void switchAccount()}
            />
          </View>
        </>
      ) : restoring ? (
        /*
          **읽는 중에는 없다고 말하지 않는다**(D-133). 저장된 세션을 복원하는 동안 폼을 그리면,
          이미 로그인한 사람이 로그인을 요구받았다가 화면이 바뀐다.
        */
        <>
          <AuthHeading title="로그인" />
          <AppText variant="caption" tone="secondary">
            로그인 상태를 확인하고 있어요.
          </AppText>
        </>
      ) : (
        <>
          <AuthHeading
            title="로그인"
            // 초대 링크에서 온 사람은 로그인 자체가 목적이 아니다. 돌아간다는 사실을 먼저 말한다.
            sub={returnTo ? '로그인하면 하던 곳으로 돌아가요.' : '아이디와 비밀번호로 들어가요.'}
          />
          <View style={styles.actions}>
            {errorBlock}
            {/* 예시 값에 실재하는 계정 식별자를 쓰지 않는다(D-158). */}
            <Field
              testID="login-id"
              label="스코디 아이디"
              value={scodyId}
              onChangeText={setScodyId}
              placeholder="영문 아이디"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Field
              testID="login-password"
              label="비밀번호"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              /* 키보드만으로 끝낼 수 있어야 한다 — Enter가 아래 버튼과 같은 자리에 닿는다. */
              onSubmitEditing={() => void submit()}
            />
            <Button
              testID="login-submit"
              /* 이 화면의 목적을 끝내는 하나뿐인 행동이라 강조색 전폭이다(§8 R1 · §15). */
              size="lg"
              fullWidth
              label={busy ? '들어가는 중이에요' : '로그인'}
              onPress={() => void submit()}
            />
            {DEV_LOGIN_ENABLED ? (
              <>
                <LabeledDivider label="또는" />
                <Button
                  testID="login-kakao"
                  variant="kakao"
                  size="lg"
                  fullWidth
                  label="카카오로 로그인"
                  accessibilityLabel="카카오로 로그인"
                  /* 카카오 공식 심볼. 범용 말풍선 아이콘이 아니다(D-165). */
                  leading={<KakaoSymbol size={18} />}
                  onPress={onKakao}
                />
                {/* 눌렀을 때 무엇이 열리는지 밝힌다. */}
                <AppText variant="caption" tone="tertiary">
                  프로토타입에서는 카카오로 들어가면 정해진 데모 계정으로 연결돼요. 그 계정의 기록은
                  실제 사용자 데이터가 아니에요.
                </AppText>
              </>
            ) : (
              /*
                연결되지 않은 수단에는 버튼을 두지 않는다(D-141). 눌러도 안내만 나오는 전폭 버튼이
                주 경로와 같은 무게로 서 있으면, 처음 온 사람은 그 버튼을 먼저 누른다.
              */
              <AppText variant="caption" tone="tertiary">
                카카오 로그인은 아직 연결되지 않았어요. 지금은 아이디와 비밀번호로 들어올 수 있어요.
              </AppText>
            )}
          </View>
          <Divider />
          <View style={styles.signupBox}>
            <AppText variant="body" tone="secondary">
              스코디에 처음 오셨나요?
            </AppText>
            <TextLink
              testID="login-signup"
              label="회원가입"
              onPress={() => router.push('/signup' as never)}
            />
          </View>
        </>
      )}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.md },
  signupBox: { gap: spacing.sm, alignItems: 'flex-start' },
});
