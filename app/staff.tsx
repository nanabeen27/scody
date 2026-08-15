import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText, Button, Field } from '@/components';
import { AuthError, AuthHeading, AuthShell } from '@/features/auth/AuthShell';
import { useSession } from '@/session';
import { homeHrefFor } from '@/session/routing';
import { spacing } from '@/theme/tokens';

/**
 * 내부용 로그인 `/staff` — 아이디와 비밀번호로 들어간다(D-165).
 *
 * ## 왜 별도 주소인가
 *
 * 카카오·휴대폰 인증이 아직 없어서(M-DB-2) 공개 사이트에서는 아무도 로그인할 수 없다. 그렇다고
 * 로그인 화면에 계정 목록을 띄우면 seed 계정 11종(운영자 포함)이 **공개된 사이트에서 원클릭**이
 * 된다 — D-157이 닫은 구멍이 그대로 다시 열린다.
 *
 * 그래서 ①화면 어디에서도 링크하지 않는 주소를 하나 두고 ②거기서 **아이디와 비밀번호를
 * 받는다.** 주소를 아는 것은 벽이 아니다. 진짜 벽은 Supabase 인증이고, 비밀번호는 공개
 * 저장소에 없는 난수다(D-157). 운영자 로그인과 테스트 로그인이 같은 자리를 쓴다 — 역할은
 * 계정이 정하지 화면이 정하지 않는다.
 *
 * 원클릭 개발 패널(`DEV_LOGIN_ENABLED`)은 그대로 꺼진 채 둔다. 그 경로와 이 화면은 목적이
 * 다르다 — 그쪽은 개발 중 계정을 빠르게 갈아타는 도구이고, 이쪽은 **자격 증명을 확인하는
 * 로그인**이다.
 */
export default function StaffLogin() {
  const router = useRouter();
  const { signInWithScodyId } = useSession();
  const [scodyId, setScodyId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await signInWithScodyId(scodyId, password);
    setBusy(false);
    if (!result.ok || !result.account) {
      // 어느 쪽이 틀렸는지 말하지 않는다 — 아이디가 있는지 없는지를 알려 주면 계정을 셀 수 있다.
      setError(result.error ?? '아이디나 비밀번호를 확인해 주세요.');
      return;
    }
    router.replace(homeHrefFor(result.account) as never);
  }

  return (
    <AuthShell
      onExit={() => router.replace('/' as never)}
      exitLabel="처음 화면으로"
      exitTestID="staff-exit"
    >
      <AuthHeading title="내부 로그인" sub="아이디와 비밀번호로 들어가요." />
      <View style={styles.form}>
        {error ? <AuthError>{error}</AuthError> : null}
        <Field
          testID="staff-id"
          label="스코디 아이디"
          value={scodyId}
          onChangeText={setScodyId}
          placeholder="예: admin"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Field
          testID="staff-password"
          label="비밀번호"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={() => void submit()}
        />
        <Button
          testID="staff-submit"
          size="lg"
          fullWidth
          /* 진행은 라벨이 말한다 — 이 화면의 유일한 행동이라 따로 캡션을 두지 않는다(§8). */
          label={busy ? '들어가는 중이에요' : '로그인'}
          onPress={() => void submit()}
        />
        <AppText variant="caption" tone="tertiary">
          운영·개발용 계정으로 들어가는 자리예요. 학생·학부모는 처음 화면에서 시작해 주세요.
        </AppText>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
});
