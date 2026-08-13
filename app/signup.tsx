import { useState } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AppText, Button, Field, Group, Icon } from '@/components';
import {
  AuthError,
  AuthHeading,
  AuthSection,
  AuthShell,
  AuthSteps,
  LabeledDivider,
  TextLink,
} from '@/features/auth/AuthShell';
import { ROLE_LABEL } from '@/session/routing';
import type { Role } from '@/data';
import { isScodyIdTaken, isPhoneTaken } from '@/repo/directory';
import { colors, spacing, radius } from '@/theme/tokens';

const ROLE_OPTIONS: { role: Role; desc: string }[] = [
  { role: 'student', desc: '내 학습을 이어가요' },
  { role: 'parent', desc: '자녀 학습을 확인해요' },
  { role: 'academy', desc: '학원을 운영해요' },
];

/** 로그인으로 이어지는 오류. 문구가 가리키는 행동을 그 자리에서 할 수 있게 아래에 링크를 붙인다. */
const PHONE_TAKEN = '이미 가입된 번호예요. 로그인으로 들어올 수 있어요.';

/**
 * 중복 검사를 하지 못했을 때.
 *
 * 검사는 서버가 답한다(`rpc_signup_phone_taken`·`rpc_signup_scody_id_taken`). 조회가 실패하면
 * **쓸 수 있다고 말하지 않는다** — 예전 픽스처 검사가 하던 거짓말이 그 방향이었다.
 */
const CHECK_FAILED = '지금은 확인할 수 없어요. 잠시 뒤 다시 시도해 주세요.';

/** 프로토타입의 휴대폰 인증번호. 실제 발송은 SMS provider 계약과 함께 온다(A-020). */
const DEMO_PHONE_CODE = '000000';

/**
 * 계정 만들기가 아직 서버에 연결되지 않았다는 안내.
 *
 * 실제 계정 생성은 카카오·휴대폰 인증 연결과 함께 온다(확정 정책 D-020). 그때까지는 이 문장이
 * 사실이고, 화면은 테스트 계정으로 둘러볼 수 있다고 알려 준다.
 */
const SIGNUP_PENDING = '계정 만들기는 아직 연결되지 않았어요. 지금은 로그인 화면의 테스트 계정으로 둘러볼 수 있어요.';

/**
 * 신규 가입. 방법(카카오·휴대폰)을 먼저 고르고, 그다음 역할과 계정 정보를 채운다.
 * 휴대폰으로 가입하면 번호 확인을 거친다. 카카오는 연결만 하고 번호 단계를 건너뛴다.
 *
 * 마지막 단계는 묻는 것을 두 묶음으로 나눈다: 어떻게 쓸지(역할) → 계정 정보.
 * 역할을 먼저 물어야 학원일 때 학원 이름을 이어서 물을 수 있다.
 */
export default function Signup() {
  const router = useRouter();
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
  // 중복 검사를 서버에 묻는 동안. 같은 버튼을 두 번 누르면 두 번 묻는다.
  const [checking, setChecking] = useState(false);

  // 카카오는 번호 단계를 건너뛰므로 전체 단계 수가 다르다. 모르는 단계 수를 지어내지 않는다.
  const totalSteps = method === 'kakao' ? 2 : 3;
  const currentStep = step === 'phone' ? 2 : totalSteps;

  function toggle(role: Role) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  function startWith(next: 'kakao' | 'phone') {
    setMethod(next);
    setError(null);
    setStep(next === 'kakao' ? 'detail' : 'phone');
  }

  async function onSendCode() {
    if (checking) return;
    if (!phone.trim()) {
      setError('휴대폰 번호를 입력해 주세요.');
      return;
    }
    setChecking(true);
    const taken = await isPhoneTaken(phone);
    setChecking(false);
    // 서버가 답하지 못하면 넘기지 않는다. 통과시키면 "쓸 수 있는 번호"라고 말한 셈이 된다.
    if (taken == null) {
      setError(CHECK_FAILED);
      return;
    }
    if (taken) {
      setError(PHONE_TAKEN);
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

  async function onSubmit() {
    if (checking) return;
    if (!name.trim() || !id.trim() || !pw.trim()) {
      setError('이름, 아이디, 비밀번호를 모두 입력해 주세요.');
      return;
    }
    if (roles.length === 0) {
      setError('역할을 하나 이상 선택해 주세요.');
      return;
    }
    /*
      학원 이름은 서버에 묻기 전에 본다 — 입력만 보고 알 수 있는 것을 조회 뒤로 미루면
      사람이 기다린 다음에 "이름을 입력해 주세요"를 듣는다.
    */
    if (roles.includes('academy') && !academyName.trim()) {
      setError('학원 이름을 입력해 주세요.');
      return;
    }
    setChecking(true);
    const taken = await isScodyIdTaken(id);
    setChecking(false);
    if (taken == null) {
      setError(CHECK_FAILED);
      return;
    }
    if (taken) {
      setError('이미 사용 중인 아이디예요. 다른 아이디로 시작해 주세요.');
      return;
    }
    /*
      **계정을 만드는 경로가 아직 서버에 연결되지 않았다.**

      프로토타입은 `makeAccount`로 메모리에만 계정을 만들었다. 실제 서비스에서는 `auth.users`가
      먼저 있어야 프로필을 만들 수 있고, 그 계정을 만드는 수단은 확정 정책(D-020)이 정한 카카오와
      휴대폰 인증이다 — 그 연결이 다음 단계다.

      **만들어진 척하지 않는다.** 예전에는 여기서 이용권 없는 계정으로 홈에 들어가 두 번째 화면에서
      흐름이 끊겼다(A-096). 지금은 그 사실을 이 자리에서 말하고, 지금 할 수 있는 일로 보낸다.
    */
    setError(SIGNUP_PENDING);
  }

  /*
    오류가 다른 화면의 행동을 가리키면 그 링크를 오류 바로 아래에 둔다.
    이 단계에 보이는 `다른 방법으로 가입하기`는 뜻이 달라서 대신 쓸 수 없다.
  */
  const errorBlock = error ? (
    <View style={styles.errorBox}>
      <AuthError>{error}</AuthError>
      {error === PHONE_TAKEN ? (
        <TextLink
          testID="signup-error-login"
          label="로그인"
          onPress={() => router.replace('/login' as never)}
        />
      ) : null}
    </View>
  ) : null;

  return (
    <AuthShell
      exitTestID="signup-brand"
      exitLabel={step === 'method' ? '스코디 소개로 가기' : '앞 단계로 가기'}
      onExit={() => {
        // 단계 중이면 앞 단계로, 방법 선택 중이면 들어온 화면으로.
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
    >
      {step === 'method' ? (
        <>
          <AuthHeading
            title="스코디 시작하기"
            sub="가입 방법을 골라주세요. 다음 단계에서 어떻게 쓸지 정해요."
          />
          <View style={styles.actions}>
            <Button
              testID="signup-phone"
              /*
                이 앱의 실제 가입 경로라 맨 위에 둔다(카카오는 연결 없이 다음 단계로 넘어간다).
                크림 배경 위의 `secondary`는 면 색이 거의 같아 상자로만 보였다 — 주 행동이므로
                강조색을 칠한다.
              */
              size="lg"
              fullWidth
              label="휴대폰 번호로 가입하기"
              accessibilityLabel="휴대폰 번호로 가입하기"
              leading={<Icon name="smartphone" size={18} color={colors.accentText} />}
              onPress={() => startWith('phone')}
            />
            <AppText variant="caption" tone="tertiary">
              번호는 로그인·알림에만 쓰고, 학습 기록은 계정에 남아요.
            </AppText>
            <LabeledDivider label="또는" />
            <Button
              testID="signup-kakao"
              variant="kakao"
              size="lg"
              fullWidth
              label="카카오로 가입하기"
              accessibilityLabel="카카오로 가입하기"
              leading={<Icon name="message-circle" size={18} color={colors.kakaoText} />}
              onPress={() => startWith('kakao')}
            />
            {/* 무엇이 실제로 일어나는지 휴대폰 안내와 같은 무게로 밝힌다. */}
            <AppText variant="caption" tone="tertiary">
              프로토타입에서는 카카오 계정을 실제로 연결하지 않고 다음 단계로 넘어가요.
            </AppText>
          </View>
          <View style={styles.loginBox}>
            <AppText variant="body" tone="secondary">
              이미 계정이 있어요
            </AppText>
            <TextLink
              testID="signup-to-login"
              label="로그인"
              onPress={() => router.replace('/login' as never)}
            />
          </View>
        </>
      ) : null}

      {step === 'phone' ? (
        <>
          <AuthSteps step={currentStep} total={totalSteps} />
          <AuthHeading title="휴대폰 번호를 알려주세요" sub="번호는 로그인과 알림에만 써요." />
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
                /* 번호를 보냈다는 사실을 먼저 확인해 준다(로그인 화면은 단계를 갈라 같은 말을 한다). */
                hint={`${phone.trim()}으로 6자리 번호를 보냈어요. 프로토타입에서는 인증번호가 ${DEMO_PHONE_CODE}이에요.`}
                onSubmitEditing={onVerify}
              />
            ) : null}
            {errorBlock}
            {codeSent ? (
              <Button
                testID="signup-phone-next"
                size="lg"
                fullWidth
                label="다음"
                onPress={onVerify}
              />
            ) : (
              <Button
                testID="signup-phone-send"
                size="lg"
                fullWidth
                label={checking ? '확인하고 있어요' : '인증번호 받기'}
                onPress={onSendCode}
              />
            )}
          </View>
          <TextLink
            testID="signup-back"
            label="다른 방법으로 가입하기"
            onPress={() => {
              setStep('method');
              setCodeSent(false);
              setCode('');
              setError(null);
            }}
          />
        </>
      ) : null}

      {step === 'detail' ? (
        <>
          <AuthSteps step={currentStep} total={totalSteps} />
          <AuthHeading
            title="어떻게 사용할까요?"
            sub={
              method === 'kakao'
                ? '카카오 계정을 연결했어요. 나중에 공간을 추가할 수 있어요.'
                : '번호를 확인했어요. 나중에 공간을 추가할 수 있어요.'
            }
          />

          <AuthSection title="역할" hint="여러 개를 고를 수 있어요. 나중에 바꿀 수 있어요.">
            <Group>
              {ROLE_OPTIONS.map((opt) => {
                const on = roles.includes(opt.role);
                return (
                  <Pressable
                    key={opt.role}
                    accessibilityRole="checkbox"
                    aria-checked={on}
                    accessibilityLabel={`${ROLE_LABEL[opt.role]} 역할`}
                    testID={`signup-role-${opt.role}`}
                    onPress={() => toggle(opt.role)}
                    style={({ pressed }) => [
                      styles.role,
                      on && { backgroundColor: colors.accentSoft },
                      pressed && { backgroundColor: colors.hover },
                    ]}
                  >
                    <View style={[styles.check, on && styles.checkOn]}>
                      {on ? <Icon name="check" size={14} color={colors.accentText} /> : null}
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
          </AuthSection>

          <AuthSection title="계정 정보" hint="이름은 학원·학부모에게 보이는 이름이에요.">
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
          </AuthSection>

          {errorBlock}

          <View style={styles.submitBox}>
            <Button
              testID="signup-submit"
              size="lg"
              fullWidth
              label={checking ? '확인하고 있어요' : '스코디 시작하기'}
              onPress={onSubmit}
            />
            <View style={styles.consent}>
              <AppText variant="caption" tone="tertiary">
                시작하면 이용약관과 개인정보처리방침에 동의하게 돼요. 두 문서는 아직 검토 전
                초안이에요.
              </AppText>
              <View style={styles.consentLinks}>
                <TextLink
                  testID="signup-terms"
                  label="이용약관"
                  onPress={() => router.push('/legal/terms' as never)}
                />
                <TextLink
                  testID="signup-privacy"
                  label="개인정보처리방침"
                  onPress={() => router.push('/legal/privacy' as never)}
                />
              </View>
            </View>
          </View>

          {/*
            앞 단계로 가는 길이 워드마크에만 있으면 화면에는 로고로만 보인다.
            같은 행동을 글자로도 둔다(워드마크 동작은 그대로).
          */}
          <TextLink
            testID="signup-detail-back"
            label={method === 'phone' ? '번호 확인으로 돌아가기' : '다른 방법으로 가입하기'}
            onPress={() => {
              setStep(method === 'phone' ? 'phone' : 'method');
              setError(null);
            }}
          />
        </>
      ) : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.md },
  errorBox: { gap: spacing.md, alignItems: 'flex-start' },
  loginBox: { gap: spacing.sm, alignItems: 'flex-start' },
  submitBox: { gap: spacing.md },
  consent: { gap: spacing.sm },
  consentLinks: { flexDirection: 'row', gap: spacing.lg },
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
});
