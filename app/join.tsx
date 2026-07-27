import { View, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Brand, Button, Group, Row } from '@/components';
import { useSession } from '@/session';
import { homeHrefFor } from '@/session/routing';
import { getInvite, signInWithKakaoDemo } from '@/data';
import { colors, spacing } from '@/theme/tokens';

const INVITEE_LABEL: Record<string, string> = {
  student: '학생',
  parent: '학부모',
  teacher: '선생님',
};

/** 초대 링크 진입: /join?invite=TOKEN. 토큰으로 역할·학원을 자동 인식. */
export default function Join() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();
  const { invite } = useLocalSearchParams<{ invite?: string }>();
  const found = invite ? getInvite(invite) : undefined;

  function enterKakao() {
    const acc = signInWithKakaoDemo();
    if (acc) {
      signIn(acc);
      router.replace(homeHrefFor(acc) as never);
    }
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.huge }]}
    >
      <View style={styles.column}>
        <Brand />
        {found ? (
          <>
            <View style={styles.hero}>
              <AppText variant="eyebrow" tone="tertiary">
                초대
              </AppText>
              <AppText variant="title">
                {found.inviterLabel}이 {INVITEE_LABEL[found.invitee]}으로 초대했어요
              </AppText>
              <AppText variant="bodyLg" tone="secondary">
                로그인하면 {found.academyName}과 연결됩니다. 기존 계정이 있으면 새로 만들지 않고 소속만
                추가돼요.
              </AppText>
            </View>
            <Group>
              <Row title="연결될 학원" meta={found.academyName} />
              <Row title="역할" meta={INVITEE_LABEL[found.invitee]} />
            </Group>
            <Button
              testID="join-kakao"
              variant="kakao"
              fullWidth
              label="카카오로 계속하기"
              onPress={enterKakao}
            />
            <Button
              variant="ghost"
              fullWidth
              label="다른 방법으로 로그인"
              onPress={() => router.push('/login' as never)}
            />
          </>
        ) : (
          <View style={styles.hero}>
            <AppText variant="title">유효하지 않은 초대 링크예요</AppText>
            <AppText variant="bodyLg" tone="secondary">
              링크가 만료되었거나 올바르지 않습니다. 학원에 다시 요청해 주세요.
            </AppText>
            <Button label="로그인으로" onPress={() => router.replace('/login' as never)} />
          </View>
        )}
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
