import { useState } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AppText, Button, Field, Group, Icon, KakaoSymbol, PhoneMark } from '@/components';
import {
  AuthError,
  AuthHeading,
  AuthSection,
  AuthShell,
  AuthSteps,
  LabeledDivider,
  TextLink,
} from '@/features/auth/AuthShell';
import { DEV_LOGIN_ENABLED } from '@/session/devAccounts';
import { ROLE_LABEL } from '@/session/routing';
import type { Role } from '@/data';
import { isScodyIdTaken, isPhoneTaken } from '@/repo/directory';
import { colors, spacing, radius } from '@/theme/tokens';

const ROLE_OPTIONS: { role: Role; desc: string }[] = [
  { role: 'student', desc: '내 학습을 이어가요' },
  { role: 'parent', desc: '자녀 학습을 확인해요' },
  { role: 'academy', desc: '학원을 운영해요' },
];

/**
 * 소개 페이지의 역할별 CTA가 붙여 오는 `?role=`.
 *
 * **학원만 알아듣던 자리다.** 예전에는 `role === 'academy' ? ['academy'] : ['student']`여서
 * `학부모로 시작하기`를 누르고 온 사람에게 **학생**이 골라져 있었다 — 그대로 진행하면 자녀를
 * 확인하러 온 사람이 학생 계정을 만든다. `ROLE_OPTIONS`에 있는 역할만 인정하고, 모르는 값이면
 * 학생으로 시작한다(운영자 역할은 이 목록에 없으므로 주소로 고를 수 없다).
 */
function rolesFromParam(param?: string): Role[] {
  const known = ROLE_OPTIONS.find((o) => o.role === param);
  return [known?.role ?? 'student'];
}

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
 * 사실이다.
 *
 * **뒷문장은 테스트 계정 패널이 있을 때만 사실이다.** 그 패널은 개발용 로그인이 켜져 있을 때만
 * 그려지는데(D-135) 예전에는 이 상수가 빌드와 무관하게 `로그인 화면의 테스트 계정으로 둘러볼 수
 * 있어요`라고 말했다 — 운영 빌드에서는 없는 것을 가리키는 거짓 문장이었다. 로그인 화면은 같은
 * 문제를 이미 분기로 처리해 뒀고(`PHONE_PENDING`), 이 화면만 빠져 있었다.
 */
const SIGNUP_PENDING = DEV_LOGIN_ENABLED
  ? '계정 만들기는 아직 연결되지 않았어요. 지금은 로그인 화면의 테스트 계정으로 둘러볼 수 있어요.'
  : '계정 만들기는 아직 연결되지 않았어요.';

/**
 * 신규 가입. 방법(카카오·휴대폰)을 먼저 고르고, 그다음 역할과 계정 정보를 채운다.
 * 휴대폰으로 가입하면 번호 확인을 거친다. 카카오는 연결만 하고 번호 단계를 건너뛴다.
 *
 * 마지막 단계는 묻는 것을 두 묶음으로 나눈다: 어떻게 쓸지(역할) → 계정 정보.
 * 역할을 먼저 물어야 학원일 때 학원 이름을 이어서 물을 수 있다.
 *
 * ## 막히는 사실은 첫 화면에서 말한다
 *
 * 계정을 만드는 경로가 아직 없다(M-DB-2). 예전에는 그 사실을 **3단계를 다 걸은 뒤**에 말했다 —
 * 이름·아이디·비밀번호·인증번호를 받고 아이디 중복까지 서버에 물어본 다음이었다. 가입하러 온
 * 사람이 가장 먼저 알아야 하는 것은 "지금 무엇이 되고 무엇이 안 되는지"이므로, 방법을 고르는
 * 화면에서 먼저 말하고 지금 할 수 있는 일(로그인)로 가는 링크를 그 자리에 둔다(D-126).
 * 절차 자체는 그대로 걸어 볼 수 있다.
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
  const [roles, setRoles] = useState<Role[]>(() =>
    rolesFromParam(typeof role === 'string' ? role : undefined),
  );
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

  function toLogin() {
    router.replace('/login' as never);
  }

  /**
   * 앞 단계로 가기. 워드마크와 본문 링크가 **같은 함수와 같은 이름**을 쓴다.
   *
   * 예전에는 같은 행동에 이름이 둘이었다(워드마크 `앞 단계로 가기` + 본문
   * `번호 확인으로 돌아가기`). 이름이 갈리면 화면에 두 가지 이탈 경로가 있는 것처럼 읽힌다.
   */
  function stepBack() {
    setError(null);
    if (step === 'detail') {
      setStep(method === 'phone' ? 'phone' : 'method');
      return;
    }
    if (step === 'phone') {
      setStep('method');
      setCodeSent(false);
      setCode('');
      return;
    }
    // 방법 선택 중이면 들어온 화면으로.
    if (router.canGoBack()) router.back();
    else if (Platform.OS === 'web') router.replace('/introduce' as never);
  }

  const backLabel =
    step === 'method'
      ? '스코디 소개로 가기'
      : step === 'detail' && method === 'phone'
        ? '번호 확인으로 돌아가기'
        : '다른 방법으로 가입하기';

  async function onCheckPhone() {
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

  /**
   * 번호를 고치면 확인 결과를 버린다.
   *
   * 중복 검사는 **그때 입력돼 있던 번호**에 대한 답이다. 결과를 남겨 두면 안 쓰는 번호로 확인을
   * 받은 뒤 이미 가입된 번호로 바꿔 넣고 `000000`으로 다음 단계까지 갈 수 있었다.
   */
  function onChangePhone(next: string) {
    setPhone(next);
    if (!codeSent) return;
    setCodeSent(false);
    setCode('');
    setError(null);
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
      흐름이 끊겼다(A-096). 이제 이 사실은 첫 화면에서 이미 말했고, 여기서는 되풀이만 한다 —
      마지막까지 온 사람이 결과를 못 듣고 끝나지 않게.
    */
    setError(SIGNUP_PENDING);
  }

  /*
    오류가 다른 화면의 행동을 가리키면 그 링크를 오류 바로 아래에 둔다(D-126).
    이 단계에 보이는 `다른 방법으로 가입하기`는 뜻이 달라서 대신 쓸 수 없다.

    `SIGNUP_PENDING`도 로그인 화면을 가리키는데 링크가 없었다 — "로그인 화면으로 가라"고 말하고
    갈 길은 앞 단계에만 뒀다. 다만 그 뒷문장은 개발용 로그인이 켜진 빌드에만 있으므로(위 상수)
    링크도 그때만 둔다. 가리킬 곳이 없는 링크는 그 자체로 또 하나의 거짓이다.
  */
  const errorPointsToLogin =
    error === PHONE_TAKEN || (error === SIGNUP_PENDING && DEV_LOGIN_ENABLED);
  const errorBlock = error ? (
    <View style={styles.errorBox}>
      <AuthError>{error}</AuthError>
      {errorPointsToLogin ? (
        <TextLink testID="signup-error-login" label="로그인으로 가기" onPress={toLogin} />
      ) : null}
    </View>
  ) : null;

  return (
    <AuthShell exitTestID="signup-brand" exitLabel={backLabel} onExit={stepBack}>
      {step === 'method' ? (
        <>
          <AuthHeading title="스코디 시작하기" sub="지금은 계정을 만들 수 없어요." />
          {/*
            **막히는 사실과 지금 할 수 있는 일을 첫 화면에 함께 둔다.** 이 화면의 종착점은
            "아무것도 만들 수 없다"이고, 그것을 3단계 뒤에 말하면 이름·아이디·비밀번호를 다 적은
            사람이 마지막에 듣는다. 로그인 링크는 하나만 둔다 — `이미 계정이 있어요` 블록과
            나누면 같은 목적지로 가는 링크가 한 화면에 둘이 된다.
          */}
          <View style={styles.notice}>
            <AppText variant="body" tone="secondary">
              가입 절차는 끝까지 볼 수 있지만, 마지막에 계정이 만들어지지 않아요.
            </AppText>
            <AppText variant="caption" tone="tertiary">
              {DEV_LOGIN_ENABLED
                ? '이미 계정이 있거나 지금 둘러보려면 로그인 화면의 테스트 계정을 쓸 수 있어요.'
                : '이미 계정이 있으면 로그인할 수 있어요.'}
            </AppText>
            <TextLink testID="signup-to-login" label="로그인으로 가기" onPress={toLogin} />
          </View>
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
              /* 로그인 화면과 같은 마크를 쓴다. 같은 방법이 화면마다 다른 아이콘이면 다른 것으로 읽힌다. */
              leading={<PhoneMark size={18} color={colors.accentText} />}
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
              /* 카카오 공식 심볼. 범용 말풍선 아이콘이 아니다(D-165). */
              leading={<KakaoSymbol size={18} />}
              onPress={() => startWith('kakao')}
            />
            {/* 무엇이 실제로 일어나는지 휴대폰 안내와 같은 무게로 밝힌다. */}
            <AppText variant="caption" tone="tertiary">
              프로토타입에서는 카카오 계정을 실제로 연결하지 않고 다음 단계로 넘어가요.
            </AppText>
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
              onChangeText={onChangePhone}
              placeholder="010-0000-0000"
              onSubmitEditing={onCheckPhone}
            />
            {codeSent ? (
              <Field
                label="인증번호"
                testID="signup-phone-code"
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
                placeholder="6자리"
                /*
                  **보내지 않은 번호를 보냈다고 말하지 않는다.** 예전 문구는
                  `{번호}으로 6자리 번호를 보냈어요.`로 시작했는데 발송은 연결돼 있지 않다
                  (로그인 화면은 같은 자리에서 `보낼 수 없다`고 말한다 — 한 수단이 두 화면에서
                  다르게 말하고 있었다). 프로토타입 통과 코드는 그 자리에서 정직하게 알린다.
                */
                hint={`인증번호 발송은 아직 연결되지 않았어요. 프로토타입에서는 ${DEMO_PHONE_CODE}을 넣으면 다음 단계로 가요.`}
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
                /* 이 버튼이 실제로 하는 일은 발송이 아니라 이미 가입된 번호인지 확인하는 것이다. */
                label={checking ? '확인하고 있어요' : '번호 확인하기'}
                onPress={onCheckPhone}
              />
            )}
          </View>
          <TextLink testID="signup-back" label={backLabel} onPress={stepBack} />
        </>
      ) : null}

      {step === 'detail' ? (
        <>
          <AuthSteps step={currentStep} total={totalSteps} />
          <AuthHeading
            title="어떻게 사용할까요?"
            sub={
              method === 'kakao'
                ? /* 연결하지 않은 것을 `연결했어요`라고 말하던 자리다. 방법 선택 화면의 캡션과 같은 사실을 말한다. */
                  '카카오 연결은 프로토타입에서 건너뛰어요.'
                : '번호가 이미 가입돼 있지 않은지 확인했어요.'
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
                placeholder="예: 서울국어학원"
              />
            ) : null}
          </AuthSection>

          {errorBlock}

          <View style={styles.submitBox}>
            {/*
              **버튼은 하는 일만 말한다.** `스코디 시작하기`는 계정이 만들어진다는 약속인데
              지금 일어나는 일은 입력 검사와 아이디 중복 확인까지다. 무엇이 일어나는지 누르기
              전에 밝히고, 계정 만들기가 연결되면 라벨이 다시 `스코디 시작하기`로 돌아온다.
            */}
            <AppText variant="caption" tone="tertiary">
              지금은 입력한 내용만 확인해요. 계정은 아직 만들어지지 않아요.
            </AppText>
            <Button
              testID="signup-submit"
              size="lg"
              fullWidth
              label={checking ? '확인하고 있어요' : '입력한 내용 확인하기'}
              onPress={onSubmit}
            />
            <View style={styles.consent}>
              {/* 이 버튼으로 동의가 기록되지 않는다 — 동의는 계정을 만드는 날의 일이다. */}
              <AppText variant="caption" tone="tertiary">
                계정을 만들 때 이용약관과 개인정보처리방침에 동의하게 돼요. 두 문서는 아직 검토 전
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
            같은 행동을 글자로도 둔다(이름은 워드마크와 같다 — `backLabel`).
          */}
          <TextLink testID="signup-detail-back" label={backLabel} onPress={stepBack} />
        </>
      ) : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.md },
  errorBox: { gap: spacing.md, alignItems: 'flex-start' },
  notice: { gap: spacing.sm, alignItems: 'flex-start' },
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
