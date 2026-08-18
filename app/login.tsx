import { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, Button, Divider, Field, KakaoSymbol, PhoneMark } from '@/components';
import {
  AuthError,
  AuthHeading,
  AuthShell,
  AuthSteps,
  LabeledDivider,
  TextLink,
} from '@/features/auth/AuthShell';
import { DemoAccounts } from '@/features/auth/DemoAccounts';
import { useSession } from '@/session';
import { DEV_KAKAO_SCODY_ID, DEV_LOGIN_ENABLED } from '@/session/devAccounts';
import { homeHrefFor } from '@/session/routing';
import { colors, spacing } from '@/theme/tokens';

/**
 * 로그인 화면. 방법은 카카오와 휴대폰 번호 두 가지다(D-020).
 * 휴대폰은 번호 확인 → 인증번호 두 단계로 나눈다. 한 화면에서 한 가지만 물어본다.
 *
 * 구성은 `AuthShell`에 있다. 여기서는 무엇을 묻고 어떤 오류를 보여줄지만 정한다.
 */
export default function Login() {
  const router = useRouter();
  const { signInWithTestAccount } = useSession();
  /**
   * 로그인 뒤 돌아갈 곳(`/login?next=…`). 초대 링크가 로그인을 거쳐도 이어지게 한다 —
   * 예전에는 `/join`에서 로그인으로 오면 토큰이 사라졌다.
   *
   * **앱 안의 경로만 받는다.** 웹에서 `//other.example`이나 `https://…`을 그대로 따라가면
   * 로그인 화면이 밖으로 내보내는 문이 된다.
   */
  const { next } = useLocalSearchParams<{ next?: string }>();
  const returnTo = typeof next === 'string' && /^\/(?!\/)/.test(next) ? next : undefined;
  const [step, setStep] = useState<'choose' | 'phone' | 'code'>('choose');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showDemo, setShowDemo] = useState(false);
  const [busy, setBusy] = useState(false);

  /** 개발용 계정으로 들어간다. 실제 수단(카카오·휴대폰)은 다음 단계다. */
  async function enterTest(scodyId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await signInWithTestAccount(scodyId);
    setBusy(false);
    if (!result.ok || !result.account) {
      setError(result.error ?? '로그인하지 못했어요.');
      return;
    }
    router.replace((returnTo ?? homeHrefFor(result.account)) as never);
  }

  /*
    카카오는 아직 연결되지 않았다(M-DB-2). 개발용 로그인이 켜져 있으면 지금까지처럼 데모
    계정으로 들어가고, 꺼진 빌드에서는 **연결되지 않았다는 사실을 말한다** — 그 빌드에서
    `enterTest`는 실패만 돌려주므로 오류 문장이 그 자리에 그대로 남는다(D-135).
  */
  function onKakao() {
    if (!DEV_LOGIN_ENABLED) {
      setError('카카오 로그인은 아직 연결되지 않았어요.');
      return;
    }
    void enterTest(DEV_KAKAO_SCODY_ID);
  }

  /*
    휴대폰 인증은 아직 서버에 연결되지 않았다. 프로토타입은 fixture 번호를 조회하고 고정
    인증번호(`000000`)를 받았는데, 그 조회는 로그인 전에 계정을 읽는 일이라 실제 서비스에서는
    할 수 없다(RLS가 익명에게 아무것도 주지 않는다).

    **없는 기능을 있는 것처럼 두지 않는다.** 번호를 받는 단계까지는 그대로 두고, 인증번호를
    보낼 수 없다는 사실을 그 자리에서 말한다.
  */
  /*
    뒷문장은 **테스트 계정 패널이 있을 때만** 사실이다. 개발용 로그인이 꺼진 빌드에는 그 패널이
    없으므로(D-135) 가리킬 곳이 없다고 말한다 — 없는 것을 가리키면 그 문장이 거짓이 된다.
  */
  const PHONE_PENDING = DEV_LOGIN_ENABLED
    ? '휴대폰 인증은 아직 연결되지 않았어요. 아래 테스트 계정으로 들어갈 수 있어요.'
    : '휴대폰 인증은 아직 연결되지 않았어요.';

  function onSendCode() {
    if (!phone.trim()) {
      setError('휴대폰 번호를 입력해 주세요.');
      return;
    }
    setError(PHONE_PENDING);
  }

  function onSubmit() {
    setError(PHONE_PENDING);
  }

  function backToChoose() {
    setStep('choose');
    setCode('');
    setError(null);
  }

  /*
    오류가 다른 화면의 행동을 가리키면 그 링크를 오류 바로 아래에 둔다.
    인증이 연결되기 전에는 테스트 계정 패널이 그 자리다 — 아래 `테스트 계정 보기`를 가리킨다.
  */
  const errorBlock = error ? (
    <View style={styles.errorBox}>
      <AuthError>{error}</AuthError>
      {error === PHONE_PENDING ? (
        <TextLink
          testID="login-error-demo"
          label="테스트 계정 보기"
          onPress={() => {
            setShowDemo(true);
            setStep('choose');
          }}
        />
      ) : null}
    </View>
  ) : null;

  return (
    <AuthShell
      exitTestID="login-brand"
      exitLabel="스코디 소개로 가기"
      onExit={() => {
        // 들어온 화면이 있으면 그곳으로, 없으면 소개 페이지(앱은 그대로).
        if (router.canGoBack()) router.back();
        else if (Platform.OS === 'web') router.replace('/introduce' as never);
      }}
      below={
        /*
          **개발용 로그인이 꺼진 빌드에는 이 패널을 두지 않는다**(D-135). 눌러도 되지 않는
          것을 두면 `눌러도 아무 일이 없는 버튼`이 된다(`DESIGN.md` §8).
        */
        !DEV_LOGIN_ENABLED ? null : (
          <DemoAccounts
            testID="login-demo-toggle"
            open={showDemo}
            onOpenChange={setShowDemo}
            onEnter={(id) => void enterTest(id)}
          />
        )
      }
    >
      {step === 'choose' ? (
        <>
          <AuthHeading
            title="로그인"
            // 초대 링크에서 온 사람은 로그인 자체가 목적이 아니다. 돌아간다는 사실을 먼저 말한다.
            sub={returnTo ? '로그인하면 하던 곳으로 돌아가요.' : '하던 학습을 이어서 할 수 있어요.'}
          />
          <View style={styles.actions}>
            {/*
              **첫 화면에도 오류 자리가 있어야 한다.** 테스트 계정 패널과 카카오 버튼이 이 단계에서
              로그인을 시도하는데, 오류 블록이 휴대폰 단계에만 있어서 실패가 조용히 사라졌다
              (실측: 로그아웃 뒤 다시 로그인할 때 아무 일도 일어나지 않는 것처럼 보였다).
            */}
            {errorBlock}
            <Button
              testID="login-phone"
              /*
                이 앱의 실제 로그인 경로라 맨 위에 둔다(카카오는 데모 계정으로 들어간다).
                크림 배경 위의 `secondary`는 면 색이 거의 같아 상자로만 보였다 — 주 행동이므로
                강조색을 칠한다.
              */
              size="lg"
              fullWidth
              label="휴대폰 번호로 로그인"
              accessibilityLabel="휴대폰 번호로 로그인"
              leading={<PhoneMark size={18} color={colors.accentText} />}
              onPress={() => {
                setStep('phone');
                setError(null);
              }}
            />
            <AppText variant="caption" tone="secondary">
              번호는 로그인과 알림에만 써요.
            </AppText>
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
            {/*
              눌렀을 때 무엇이 열리는지 휴대폰 안내와 같은 무게로 밝힌다. 개발용 로그인이 꺼진
              빌드에서는 데모 계정으로 가지 않으므로 그 문장을 두지 않는다(D-135).
            */}
            <AppText variant="caption" tone="secondary">
              {DEV_LOGIN_ENABLED
                ? '프로토타입에서는 카카오로 들어가면 정해진 데모 계정으로 연결돼요. 그 계정의 기록은 실제 사용자 데이터가 아니에요.'
                : '카카오 로그인은 아직 연결되지 않았어요.'}
            </AppText>
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
      ) : (
        <>
          <AuthSteps step={step === 'phone' ? 1 : 2} total={2} />
          <AuthHeading
            title={step === 'phone' ? '휴대폰 번호를 알려주세요' : '인증번호를 입력해 주세요'}
            sub={
              step === 'phone'
                ? '가입할 때 쓴 번호로 로그인해요.'
                : `${phone.trim()}으로 보낸 6자리 번호예요.`
            }
          />
          <View style={styles.actions}>
            {step === 'phone' ? (
              <>
                <Field
                  label="휴대폰 번호"
                  testID="login-phone-number"
                  keyboardType="phone-pad"
                  /* 브라우저·비밀번호 관리자가 번호 칸임을 알아야 자동으로 채워 준다. */
                  autoComplete="tel"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="010-0000-0000"
                  onSubmitEditing={onSendCode}
                />
                {errorBlock}
                <Button
                  testID="login-phone-send"
                  size="lg"
                  fullWidth
                  label="인증번호 받기"
                  onPress={onSendCode}
                />
              </>
            ) : (
              <>
                <Field
                  label="인증번호"
                  testID="login-phone-code"
                  keyboardType="number-pad"
                  value={code}
                  onChangeText={setCode}
                  placeholder="6자리"
                  hint="인증번호 발송은 아직 연결되지 않았어요."
                  onSubmitEditing={onSubmit}
                />
                {errorBlock}
                <Button
                  testID="login-submit"
                  size="lg"
                  fullWidth
                  label="로그인"
                  onPress={onSubmit}
                />
              </>
            )}
          </View>
          <TextLink testID="login-back" label="다른 방법으로 로그인" onPress={backToChoose} />
        </>
      )}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.md },
  errorBox: { gap: spacing.md, alignItems: 'flex-start' },
  signupBox: { gap: spacing.sm, alignItems: 'flex-start' },
});
