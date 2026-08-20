import { useState } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AppText, Button, Field, Group, Icon, KakaoSymbol, MailMark } from '@/components';
import {
  AuthError,
  AuthHeading,
  AuthSection,
  AuthShell,
  LabeledDivider,
  TextLink,
} from '@/features/auth/AuthShell';
import { DEV_LOGIN_ENABLED } from '@/session/devAccounts';
import { ROLE_LABEL } from '@/session/routing';
import type { Role } from '@/data';
import { looksLikeEmail } from '@/session/email';
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

/** 이메일 형태가 아닐 때. 로그인 화면과 같은 문장을 쓴다 — 같은 판정이 두 말을 갖지 않게. */
const EMAIL_INVALID = '이메일 주소를 다시 확인해 주세요.';

/*
  **이메일 중복을 서버에 묻지 않는다.**

  예전에는 번호를(`rpc_signup_phone_taken`) 그리고 아이디를(`rpc_signup_scody_id_taken`) 익명으로
  물었다. 이메일에 같은 함수를 하나 더 만들지 않는 이유 넷.

  ① `profiles`에 email 컬럼이 없다 — 이메일은 `auth.users`에만 있어서, 묻자면 `security definer`
     함수의 권한 범위를 `public` 밖으로 내보내야 한다.
  ② **이메일은 번호보다 열거하기 쉽다.** 번호 열거는 형식 공간을 훑는 일이고 이메일 열거는 남이
     만든 유출 목록을 그대로 넣는 일이다. A-100이 그 오라클에 상한이 없다는 것을 이미 실측해
     미해결로 올려 두었는데(익명 키 40회가 1,932ms에 전부 200), 거기에 **더 나쁜 키로** 하나를
     더 얹는 방향이다.
  ③ Supabase 자신이 `signUp` 응답을 흐리게 만들어 이 누출을 막는다 — 그 플랫폼 보호를 우리가
     우회하는 함수가 된다.
  ④ **지금 그 검사의 쓸모가 0이다.** 계정은 어차피 만들어지지 않는다(M-DB-2). 값 없는 기능에
     오라클을 붙이는 것은 D-141의 반대 방향이다.

  중복 판정은 계정 생성이 붙는 날 **서버의 `signUp` 응답**이 답한다(A-152) — 익명 사전 조회가
  아니라 의사를 밝힌 뒤의 판정이라 오라클이 아니다.
*/

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
 * 신규 가입. 방법(이메일·카카오)을 먼저 고르고, 그다음 역할과 계정 정보를 채운다.
 *
 * ## 두 단계다 (D-184)
 *
 * 예전에는 휴대폰 경로가 3단계였다(방법 → 번호 확인 → 상세). 그 중간 단계가 사라진 이유 둘.
 *
 * **① 이메일만 담은 중간 화면은 서버에 물을 것도, 갈라 보낼 곳도 없다.** 번호 단계는
 * `rpc_signup_phone_taken`을 물어서 존재 이유가 있었는데(위 상수 블록이 왜 그것을 이메일로
 * 옮기지 않는지 적어 두었다), 그것이 없으면 필드 하나를 담은 빈 단계가 된다 — 로그인 화면이
 * 2단계를 버린 것과 같은 논리다(`app/login.tsx`).
 *
 * **② 인증번호 칸은 그 존재 자체가 D-141 위반이었다.** 메일 발송 provider가 없고(M-DB-2에
 * SMS만 적혀 있고 메일은 아예 없다) 옛 번호 칸도 실제로는 보내지 않아서, `hint`가 "발송은 아직
 * 연결되지 않았어요"라고 **고백하는 칸**이었다. 할 수 없는 일에는 칸을 두지 않고 이유를 한 줄로
 * 말한다 — 그 한 줄은 이미 첫 화면에 있다.
 *
 * 그래서 `AuthSteps` 호출부가 0이 됐다. 부품은 `AuthShell`에 남긴다 — §15가 규칙으로 적어 둔
 * 어휘이고, 계정 복구(A-021)가 단계형으로 오면 그 자리에서 쓴다.
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
  const [step, setStep] = useState<'method' | 'detail'>('method');
  const [method, setMethod] = useState<'kakao' | 'email'>('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [roles, setRoles] = useState<Role[]>(() =>
    rolesFromParam(typeof role === 'string' ? role : undefined),
  );
  const [academyName, setAcademyName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function toggle(role: Role) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  function startWith(next: 'kakao' | 'email') {
    setMethod(next);
    setError(null);
    setStep('detail');
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
      setStep('method');
      return;
    }
    // 방법 선택 중이면 들어온 화면으로.
    if (router.canGoBack()) router.back();
    else if (Platform.OS === 'web') router.replace('/introduce' as never);
  }

  /* 단계가 둘이라 이탈 경로도 둘이다. 예전의 `번호 확인으로 돌아가기`는 그 단계와 함께 사라졌다. */
  const backLabel = step === 'method' ? '스코디 소개로 가기' : '다른 방법으로 가입하기';

  function onSubmit() {
    /*
      **카카오 경로는 자격 증명을 묻지 않는다.** 카카오가 곧 자격 증명이다. 예전에는 카카오로
      와도 아이디·비밀번호를 물어서 앞뒤가 맞지 않았다 — `카카오 연결은 건너뛴다`고 말한 화면이
      바로 아래에서 비밀번호를 정하라고 했다.
    */
    if (method === 'email') {
      if (!looksLikeEmail(email)) {
        setError(EMAIL_INVALID);
        return;
      }
      if (!name.trim() || !pw.trim()) {
        setError('이름과 비밀번호를 모두 입력해 주세요.');
        return;
      }
    } else if (!name.trim()) {
      setError('이름을 입력해 주세요.');
      return;
    }
    if (roles.length === 0) {
      setError('역할을 하나 이상 선택해 주세요.');
      return;
    }
    if (roles.includes('academy') && !academyName.trim()) {
      setError('학원 이름을 입력해 주세요.');
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

      **서버 왕복이 없어졌다.** 아이디 중복을 묻던 자리인데 아이디를 더 이상 받지 않는다(D-184 —
      스코디 아이디는 표시·검색용으로만 남고 계정을 만들 때 서버가 만든다, A-153). 그래서
      `checking` 상태와 `확인하고 있어요` 라벨도 함께 사라졌다.
    */
    setError(SIGNUP_PENDING);
  }

  /*
    오류가 다른 화면의 행동을 가리키면 그 링크를 오류 바로 아래에 둔다(D-126).
    이 단계에 보이는 `다른 방법으로 가입하기`는 뜻이 달라서 대신 쓸 수 없다.

    `SIGNUP_PENDING`도 로그인 화면을 가리키는데 링크가 없었다 — "로그인 화면으로 가라"고 말하고
    갈 길은 앞 단계에만 뒀다. 다만 그 뒷문장은 개발용 로그인이 켜진 빌드에만 있으므로(위 상수)
    링크도 그때만 둔다. 가리킬 곳이 없는 링크는 그 자체로 또 하나의 거짓이다.

    `이미 가입된 번호예요`도 이 목록에 있었다. 번호 중복 검사가 사라져(D-184) 그 문장과 함께
    빠졌다 — 이메일 중복은 이 화면이 묻지 않는다(위 상수 블록).
  */
  const errorPointsToLogin = error === SIGNUP_PENDING && DEV_LOGIN_ENABLED;
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
            {/* 읽어야 하는 문장이라 `tertiary`를 쓰지 않는다 — 대비 2.96:1로 AA 미달이다(D-166). */}
            <AppText variant="caption" tone="secondary">
              {DEV_LOGIN_ENABLED
                ? '이미 계정이 있거나 지금 둘러보려면 로그인 화면의 테스트 계정을 쓸 수 있어요.'
                : '이미 계정이 있으면 로그인할 수 있어요.'}
            </AppText>
            <TextLink testID="signup-to-login" label="로그인으로 가기" onPress={toLogin} />
          </View>
          <View style={styles.actions}>
            <Button
              testID="signup-email"
              /*
                이 앱의 실제 가입 경로라 맨 위에 둔다(카카오는 연결 없이 다음 단계로 넘어간다).
                크림 배경 위의 `secondary`는 면 색이 거의 같아 상자로만 보였다 — 주 행동이므로
                강조색을 칠한다.
              */
              size="lg"
              fullWidth
              label="이메일로 가입하기"
              accessibilityLabel="이메일로 가입하기"
              /* 카카오 심볼과 무게를 맞춘 채운 봉투다(§15). 선 아이콘을 쓰지 않는다. */
              leading={<MailMark size={18} color={colors.accentText} />}
              onPress={() => startWith('email')}
            />
            {/*
              **알림을 약속하지 않는다.** 옛 문장은 `번호는 로그인·알림에만 쓰고`였는데, 메일
              발송 provider가 없어서(M-DB-2) 알림을 말하면 거짓이 된다. 뒷절은 확정 정책 2절의
              `계정 식별자`다 — 기록은 이메일이 아니라 영구 `user_id`에 붙는다.
            */}
            <AppText variant="caption" tone="secondary">
              이메일로 로그인해요. 이메일을 바꿔도 학습 기록은 계정에 남아요.
            </AppText>
            <LabeledDivider label="또는" />
            <Button
              testID="signup-kakao"
              variant="kakao"
              size="lg"
              fullWidth
              label="카카오로 가입하기"
              accessibilityLabel="카카오로 가입하기"
              /*
                카카오 공식 심볼이다(D-165). 범용 말풍선 아이콘(`message-circle`)을 쓰고 있었는데,
                로그인 화면은 공식 심볼이라 **같은 카카오가 두 화면에서 다른 그림**이었다.
                브랜드 마크는 닮은 것으로 대체하지 않는다.
              */
              leading={<KakaoSymbol size={18} />}
              onPress={() => startWith('kakao')}
            />
            {/* 무엇이 실제로 일어나는지 휴대폰 안내와 같은 무게로 밝힌다. */}
            <AppText variant="caption" tone="secondary">
              프로토타입에서는 카카오 계정을 실제로 연결하지 않고 다음 단계로 넘어가요.
            </AppText>
          </View>
        </>
      ) : null}

      {step === 'detail' ? (
        <>
          <AuthHeading
            title="어떻게 사용할까요?"
            sub={
              method === 'kakao'
                ? /* 연결하지 않은 것을 `연결했어요`라고 말하던 자리다. 방법 선택 화면의 캡션과 같은 사실을 말한다. */
                  '카카오 연결은 프로토타입에서 건너뛰어요.'
                : /* 옛 문장은 `번호가 이미 가입돼 있지 않은지 확인했어요.`였다 — 그 검사가 없어져 거짓이 됐다. */
                  '역할을 고르고 계정 정보를 적으면 끝이에요.'
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
                      <AppText variant="caption" tone="secondary">
                        {opt.desc}
                      </AppText>
                    </View>
                  </Pressable>
                );
              })}
            </Group>
          </AuthSection>

          <AuthSection
            title="계정 정보"
            /*
              **placeholder로 라벨을 되풀이하지 않는다**(§15 — 같은 말을 두 번 쓰지 않는다).
              `이름`·`비밀번호` 칸이 라벨과 똑같은 placeholder를 갖고 있었는데, 이메일 칸을
              placeholder 없이 두면서 한 묶음 안에서 기준이 갈렸다.
            */
            hint={
              method === 'email'
                ? '이름은 학원·학부모에게 보이는 이름이에요. 이메일과 비밀번호로 로그인해요.'
                : '이름은 학원·학부모에게 보이는 이름이에요.'
            }
          >
            {/*
              `autoComplete`를 준다 — 비밀번호 관리자와 브라우저 자동 채우기가 이것으로
              무슨 칸인지 안다. 없으면 학생이 휴대폰에서 이메일·비밀번호를 손으로 다 적는다.
            */}
            {/*
              **이름이 먼저다.** 두 경로가 함께 묻는 것이 이름 하나라서, 그것을 맨 위에 두면
              카카오로 와도 이 묶음의 첫 칸이 같은 자리에 있다. 그리고 이메일·비밀번호가 **붙어**
              있어야 비밀번호 관리자가 한 쌍으로 본다(로그인 화면도 두 칸이 나란하다).
            */}
            <Field
              label="이름"
              testID="signup-name"
              autoComplete="name"
              value={name}
              onChangeText={setName}
            />
            {method === 'email' ? (
              <Field
                label="이메일"
                testID="signup-email-address"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
              />
            ) : null}
            {/*
              **스코디 아이디를 묻지 않는다**(D-184). 이메일로 로그인하면 그 값은 사용자에게 아무
              힘이 없다 — 운영자 화면이 이미 `카카오로 가입한 학생은 자기 scodyId를 모른다`고 적어
              두었다(`app/admin/users.tsx`). 표시·검색용으로 컬럼에 남고 계정을 만들 때 서버가
              만든다(A-153). 로그인에 쓰지 않는 값을 가입 폼에서 고민하게 만들 이유가 없다.
            */}
            {method === 'email' ? (
              <Field
                label="비밀번호"
                testID="signup-pw"
                secureTextEntry
                autoComplete="new-password"
                value={pw}
                onChangeText={setPw}
              />
            ) : null}
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
            {/* 읽어야 하는 고지라 `secondary`다(D-166 — `tertiary`는 대비 2.96:1로 AA 미달). */}
            <AppText variant="caption" tone="secondary">
              지금은 입력한 내용만 확인해요. 계정은 아직 만들어지지 않아요.
            </AppText>
            <Button
              testID="signup-submit"
              size="lg"
              fullWidth
              label="입력한 내용 확인하기"
              onPress={onSubmit}
            />
            <View style={styles.consent}>
              {/* 이 버튼으로 동의가 기록되지 않는다 — 동의는 계정을 만드는 날의 일이다. */}
              <AppText variant="caption" tone="secondary">
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
