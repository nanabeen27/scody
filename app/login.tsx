import { useState } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Brand, Button, Field, Group, Row, ThemeToggle, Divider } from '@/components';
import { useSession } from '@/session';
import { homeHrefFor, ROLE_LABEL } from '@/session/routing';
import {
  authenticateByPhone,
  signInWithKakaoDemo,
  ACCOUNTS,
  DEMO_PASSWORD,
  DEMO_PHONE_CODE,
} from '@/data';
import { colors, spacing } from '@/theme/tokens';

/**
 * 로그인 화면. 방법은 카카오와 휴대폰 번호 두 가지다.
 * 휴대폰은 번호 확인 → 인증번호 두 단계로 나눈다. 한 화면에서 한 가지만 물어본다.
 */
export default function Login() {
  const router = useRouter();
  const { signIn } = useSession();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'choose' | 'phone' | 'code'>('choose');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showDemo, setShowDemo] = useState(false);

  function enter(acc: import('@/data').Account) {
    signIn(acc);
    router.replace(homeHrefFor(acc) as never);
  }

  function onKakao() {
    const acc = signInWithKakaoDemo();
    if (acc) enter(acc);
  }

  /** 번호가 가입된 계정인지 먼저 확인한다. 없는 번호로 인증번호 단계까지 가지 않는다. */
  function onSendCode() {
    if (!phone.trim()) {
      setError('휴대폰 번호를 입력해 주세요.');
      return;
    }
    if (!authenticateByPhone(phone)) {
      setError('가입되지 않은 번호예요. 회원가입으로 시작할 수 있어요.');
      return;
    }
    setError(null);
    setStep('code');
  }

  function onSubmit() {
    const acc = authenticateByPhone(phone);
    if (!acc) {
      setError('가입되지 않은 번호예요. 회원가입으로 시작할 수 있어요.');
      return;
    }
    if (code.trim() !== DEMO_PHONE_CODE) {
      setError('인증번호가 맞지 않아요.');
      return;
    }
    setError(null);
    enter(acc);
  }

  function backToChoose() {
    setStep('choose');
    setCode('');
    setError(null);
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.huge, paddingBottom: insets.bottom + spacing.xxl },
      ]}
    >
      <View style={styles.column}>
        {/* 워드마크로 나가는 길. 들어온 화면이 있으면 그곳으로, 없으면 소개 페이지(앱은 그대로). */}
        <Brand
          testID="login-brand"
          accessibilityLabel="스코디 소개로 가기"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else if (Platform.OS === 'web') router.replace('/introduce' as never);
          }}
        />

        {step === 'choose' ? (
          <>
            <View style={styles.hero}>
              <AppText variant="title">로그인</AppText>
              <AppText variant="bodyLg" tone="secondary">
                하던 학습을 이어서 할 수 있어요.
              </AppText>
            </View>
            <View style={styles.actions}>
              <Button
                testID="login-kakao"
                variant="kakao"
                fullWidth
                label="카카오로 로그인"
                onPress={onKakao}
              />
              <Button
                testID="login-phone"
                variant="secondary"
                fullWidth
                label="휴대폰 번호로 로그인"
                onPress={() => {
                  setStep('phone');
                  setError(null);
                }}
              />
            </View>
          </>
        ) : (
          <>
            <View style={styles.hero}>
              <AppText variant="title">
                {step === 'phone' ? '휴대폰 번호를 알려주세요' : '인증번호를 입력해 주세요'}
              </AppText>
              <AppText variant="bodyLg" tone="secondary">
                {step === 'phone'
                  ? '가입할 때 쓴 번호로 로그인해요.'
                  : `${phone.trim()}으로 보낸 6자리 번호예요.`}
              </AppText>
            </View>
            <View style={styles.actions}>
              {step === 'phone' ? (
                <>
                  <Field
                    label="휴대폰 번호"
                    testID="login-phone-number"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="010-0000-0000"
                    onSubmitEditing={onSendCode}
                  />
                  {error ? <ErrorText>{error}</ErrorText> : null}
                  <Button
                    testID="login-phone-send"
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
                    hint={`프로토타입에서는 인증번호가 ${DEMO_PHONE_CODE}이에요.`}
                    onSubmitEditing={onSubmit}
                  />
                  {error ? <ErrorText>{error}</ErrorText> : null}
                  <Button testID="login-submit" fullWidth label="로그인" onPress={onSubmit} />
                </>
              )}
              <Button
                testID="login-back"
                variant="ghost"
                fullWidth
                label="다른 방법으로 로그인"
                onPress={backToChoose}
              />
            </View>
          </>
        )}

        <Divider />
        <View style={styles.signupBox}>
          <AppText variant="body" tone="secondary">
            스코디에 처음 오셨나요?
          </AppText>
          <Button
            testID="login-signup"
            variant="secondary"
            fullWidth
            label="회원가입"
            onPress={() => router.push('/signup' as never)}
          />
        </View>

        <View style={styles.demoBox}>
          <AppText variant="caption" tone="tertiary" onPress={() => setShowDemo((v) => !v)}>
            {showDemo ? '테스트 계정 숨기기' : '테스트 계정 보기'}
          </AppText>
          {showDemo ? (
            <>
              <AppText variant="caption" tone="tertiary">
                개발용 계정이에요. 실제 사용자 데이터가 아니에요.
              </AppText>
              <Group>
                {ACCOUNTS.filter((a) => a.phone).map((a) => (
                  <Row
                    key={a.userId}
                    title={`${a.name} · ${a.roles.map((r) => ROLE_LABEL[r]).join('/')}`}
                    subtitle={`${a.phone} · 인증번호 ${DEMO_PHONE_CODE} · 아이디 ${a.scodyId}/${DEMO_PASSWORD}`}
                    onPress={() => enter(a)}
                    showChevron
                  />
                ))}
              </Group>
            </>
          ) : null}
        </View>
        <ThemeToggle />
      </View>
    </ScrollView>
  );
}

function ErrorText({ children }: { children: string }) {
  return (
    <AppText variant="caption" style={{ color: colors.danger }}>
      {children}
    </AppText>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, alignItems: 'center' },
  column: { width: '100%', maxWidth: 420, gap: spacing.xxl },
  hero: { gap: spacing.sm },
  actions: { gap: spacing.md },
  signupBox: { gap: spacing.md },
  demoBox: { gap: spacing.md, alignItems: 'flex-start' },
});
