import { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Brand, Button, Field, Group, Divider } from '@/components';
import { useSession } from '@/session';
import { homeHrefFor, ROLE_LABEL } from '@/session/routing';
import { makeAccount, isScodyIdTaken, isPhoneTaken, DEMO_PHONE_CODE, type Role } from '@/data';
import { colors, spacing, radius } from '@/theme/tokens';

const ROLE_OPTIONS: { role: Role; desc: string }[] = [
  { role: 'student', desc: '내 학습을 이어가요' },
  { role: 'parent', desc: '자녀 학습을 확인해요' },
  { role: 'academy', desc: '학원을 운영해요' },
];

/**
 * 신규 가입. 방법(카카오·휴대폰)을 먼저 고르고, 그다음 역할과 계정 정보를 채운다.
 * 휴대폰으로 가입하면 번호 확인을 거친다. 카카오는 연결만 하고 번호 단계를 건너뛴다.
 */
export default function Signup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const [step, setStep] = useState<'method' | 'phone' | 'detail'>('method');
  const [method, setMethod] = useState<'kakao' | 'phone'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [roles, setRoles] = useState<Role[]>(role === 'academy' ? ['academy'] : ['student']);
  const [academyName, setAcademyName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function toggle(role: Role) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  function startWith(next: 'kakao' | 'phone') {
    setMethod(next);
    setError(null);
    setStep(next === 'kakao' ? 'detail' : 'phone');
  }

  function onSendCode() {
    if (!phone.trim()) {
      setError('휴대폰 번호를 입력해 주세요.');
      return;
    }
    if (isPhoneTaken(phone)) {
      setError('이미 가입된 번호예요. 로그인으로 들어올 수 있어요.');
      return;
    }
    setError(null);
    setCodeSent(true);
  }

  function onVerify() {
    if (code.trim() !== DEMO_PHONE_CODE) {
      setError('인증번호가 맞지 않아요.');
      return;
    }
    setError(null);
    setStep('detail');
  }

  function onSubmit() {
    if (!name.trim() || !id.trim() || !pw.trim()) {
      setError('이름, 아이디, 비밀번호를 모두 입력해 주세요.');
      return;
    }
    if (roles.length === 0) {
      setError('역할을 하나 이상 선택해 주세요.');
      return;
    }
    if (isScodyIdTaken(id)) {
      setError('이미 사용 중인 아이디예요. 다른 아이디로 시작해 주세요.');
      return;
    }
    if (roles.includes('academy') && !academyName.trim()) {
      setError('학원 이름을 입력해 주세요.');
      return;
    }
    const acc = makeAccount({
      name,
      scodyId: id,
      password: pw,
      roles,
      academyName,
      phone: method === 'phone' ? phone : undefined,
      kakaoLinked: method === 'kakao' ? true : undefined,
    });
    signIn(acc);
    router.replace(homeHrefFor(acc) as never);
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl },
      ]}
    >
      <View style={styles.column}>
        {/* 워드마크로 나가는 길. 방법 선택 중이면 들어온 화면으로, 단계 중이면 앞 단계로. */}
        <Brand
          testID="signup-brand"
          accessibilityLabel={step === 'method' ? '스코디 소개로 가기' : '앞 단계로 가기'}
          onPress={() => {
            if (step === 'detail') {
              setStep(method === 'phone' ? 'phone' : 'method');
              setError(null);
              return;
            }
            if (step === 'phone') {
              setStep('method');
              setCodeSent(false);
              setCode('');
              setError(null);
              return;
            }
            if (router.canGoBack()) router.back();
            else if (Platform.OS === 'web') router.replace('/introduce' as never);
          }}
        />

        {step === 'method' ? (
          <>
            <View style={styles.head}>
              <AppText variant="title">스코디 시작하기</AppText>
              <AppText variant="bodyLg" tone="secondary">
                가입 방법을 골라주세요. 다음 단계에서 어떻게 쓸지 정해요.
              </AppText>
            </View>
            <View style={styles.actions}>
              <Button
                testID="signup-kakao"
                variant="kakao"
                fullWidth
                label="카카오로 가입하기"
                onPress={() => startWith('kakao')}
              />
              <Button
                testID="signup-phone"
                variant="secondary"
                fullWidth
                label="휴대폰 번호로 가입하기"
                onPress={() => startWith('phone')}
              />
            </View>
            <Divider />
            <Button
              testID="signup-to-login"
              variant="ghost"
              fullWidth
              label="이미 계정이 있어요"
              onPress={() => router.replace('/login' as never)}
            />
          </>
        ) : null}

        {step === 'phone' ? (
          <>
            <View style={styles.head}>
              <AppText variant="title">휴대폰 번호를 알려주세요</AppText>
              <AppText variant="bodyLg" tone="secondary">
                번호는 로그인과 알림에만 써요.
              </AppText>
            </View>
            <View style={styles.actions}>
              <Field
                label="휴대폰 번호"
                testID="signup-phone-number"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                placeholder="010-0000-0000"
                onSubmitEditing={onSendCode}
              />
              {codeSent ? (
                <Field
                  label="인증번호"
                  testID="signup-phone-code"
                  keyboardType="number-pad"
                  value={code}
                  onChangeText={setCode}
                  placeholder="6자리"
                  hint={`프로토타입에서는 인증번호가 ${DEMO_PHONE_CODE}이에요.`}
                  onSubmitEditing={onVerify}
                />
              ) : null}
              {error ? (
                <AppText variant="caption" style={{ color: colors.danger }}>
                  {error}
                </AppText>
              ) : null}
              {codeSent ? (
                <Button testID="signup-phone-next" fullWidth label="다음" onPress={onVerify} />
              ) : (
                <Button
                  testID="signup-phone-send"
                  fullWidth
                  label="인증번호 받기"
                  onPress={onSendCode}
                />
              )}
              <Button
                testID="signup-back"
                variant="ghost"
                fullWidth
                label="다른 방법으로 가입하기"
                onPress={() => {
                  setStep('method');
                  setCodeSent(false);
                  setCode('');
                  setError(null);
                }}
              />
            </View>
          </>
        ) : null}

        {step === 'detail' ? (
          <>
            <View style={styles.head}>
              <AppText variant="title">어떻게 사용할까요?</AppText>
              <AppText variant="bodyLg" tone="secondary">
                {method === 'kakao'
                  ? '카카오 계정을 연결했어요. 나중에 공간을 추가할 수 있어요.'
                  : '번호를 확인했어요. 나중에 공간을 추가할 수 있어요.'}
              </AppText>
            </View>

            <View style={{ gap: spacing.md }}>
              <Field
                label="이름"
                testID="signup-name"
                value={name}
                onChangeText={setName}
                placeholder="이름"
              />
              <Field
                label="스코디 아이디"
                testID="signup-id"
                autoCapitalize="none"
                value={id}
                onChangeText={setId}
                placeholder="영문 아이디"
              />
              <Field
                label="비밀번호"
                testID="signup-pw"
                secureTextEntry
                value={pw}
                onChangeText={setPw}
                placeholder="비밀번호"
              />
              {roles.includes('academy') ? (
                <Field
                  label="학원 이름"
                  testID="signup-academy-name"
                  value={academyName}
                  onChangeText={setAcademyName}
                  placeholder="예: 한빛학원"
                />
              ) : null}
            </View>

            <View style={{ gap: spacing.sm }}>
              <AppText variant="caption" tone="secondary">
                역할 (복수 선택 가능)
              </AppText>
              <Group>
                {ROLE_OPTIONS.map((opt) => {
                  const on = roles.includes(opt.role);
                  return (
                    <Pressable
                      key={opt.role}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`${ROLE_LABEL[opt.role]} 역할`}
                      testID={`signup-role-${opt.role}`}
                      onPress={() => toggle(opt.role)}
                      style={({ pressed }) => [
                        styles.role,
                        pressed && { backgroundColor: colors.hover },
                      ]}
                    >
                      <View style={[styles.check, on && styles.checkOn]}>
                        {on ? <View style={styles.checkMark} /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText variant="label">{ROLE_LABEL[opt.role]}</AppText>
                        <AppText variant="caption" tone="tertiary">
                          {opt.desc}
                        </AppText>
                      </View>
                    </Pressable>
                  );
                })}
              </Group>
            </View>

            {error ? (
              <AppText variant="caption" style={{ color: colors.danger }}>
                {error}
              </AppText>
            ) : null}

            <Button testID="signup-submit" fullWidth label="스코디 시작하기" onPress={onSubmit} />
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, alignItems: 'center' },
  column: { width: '100%', maxWidth: 460, gap: spacing.xl },
  head: { gap: spacing.sm },
  actions: { gap: spacing.md },
  role: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  checkMark: { width: 10, height: 10, borderRadius: 2, backgroundColor: colors.accentText },
});
