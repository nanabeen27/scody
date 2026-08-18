import { useRouter } from 'expo-router';
import { Platform, View, StyleSheet } from 'react-native';
import { Screen, Section, Group, Row, AppText, Button } from '@/components';
import { useSession } from '@/session';
import { homeHrefFor } from '@/session/routing';
import { colors, spacing, radius } from '@/theme/tokens';
import { LEGAL_DOCS, type LegalDoc } from './documents';

/**
 * 푸터 문서 화면의 공통 뷰. 문서마다 라우트 파일을 두고 이 뷰를 렌더한다.
 * 한 동적 라우트로 묶으면 문서끼리 이동할 때 Expo Router가 같은 화면을 재사용해 내용이 바뀌지 않는다.
 */
export function LegalDocView({ doc }: { doc: LegalDoc }) {
  const router = useRouter();
  const { account } = useSession();
  /*
    **돌아갈 곳은 온 곳이다.** 문서를 여는 자리가 넷이다 — 랜딩 푸터(`WebLanding`),
    로그인·가입 푸터(`AuthShell`), **진행 중인 가입의 동의 문구**(`app/signup.tsx`), 다른 문서.
    앞의 셋은 `push`이고 문서끼리는 `replace`라 히스토리 깊이가 그대로이므로, 히스토리가 있으면
    `back()`이 정확히 그 자리다. 예전에는 이 자리가 `/introduce` 고정이어서 **가입하던 사람이
    약관을 열면 가입 화면 대신 소개 페이지로 나갔다.**
  */
  const canGoBack = router.canGoBack();
  /*
    히스토리가 없는 직접 진입(링크 공유·새로고침·딥링크)에만 쓰는 자리.
    소개 페이지는 웹에만 있다 — 앱에서 `/introduce`는 `/login`으로 되돌려지므로
    (`app/introduce.tsx`) 그대로 두면 **로그인한 사람까지 로그인 화면에 떨어졌다.**
  */
  const exit = account
    ? { href: homeHrefFor(account), label: '내 화면으로 가기' }
    : Platform.OS === 'web'
      ? { href: '/introduce', label: '소개 페이지로 가기' }
      : { href: '/login', label: '로그인으로 가기' };

  return (
    <Screen
      testID={`legal-${doc.slug}`}
      backFallback={exit.href}
      eyebrow={doc.eyebrow}
      title={doc.title}
    >
      {doc.notice ? (
        <View style={styles.notice}>
          <AppText variant="caption" tone="secondary">
            {doc.notice}
          </AppText>
        </View>
      ) : null}

      {doc.blocks.map((b, i) => (
        <Section key={b.heading ?? `block-${i}`} title={b.heading}>
          {b.paragraphs?.map((p) => (
            <AppText key={p} variant="body" tone="secondary">
              {p}
            </AppText>
          ))}
          {b.items ? (
            <View style={styles.list}>
              {b.items.map((it) => (
                <View key={it} style={styles.item}>
                  <AppText variant="body" tone="tertiary">
                    ·
                  </AppText>
                  <AppText variant="body" tone="secondary" style={styles.itemText}>
                    {it}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}
          {b.rows ? (
            <Group>
              {b.rows.map((r) => (
                <Row key={r.label} title={r.label} meta={r.value} />
              ))}
            </Group>
          ) : null}
        </Section>
      ))}

      <Section title="다른 문서">
        <Group>
          {LEGAL_DOCS.filter((d) => d.slug !== doc.slug).map((d) => (
            <Row
              key={d.slug}
              testID={`legal-link-${d.slug}`}
              title={d.label}
              // 문서끼리는 바꿔 연다. push하면 문서 화면이 스택에 쌓여 뒤로가기가 길어진다.
              onPress={() => router.replace(`/legal/${d.slug}` as never)}
              showChevron
            />
          ))}
        </Group>
      </Section>

      {/*
        문서가 길어 좌상단 뒤로가기는 다 읽은 자리에서 화면 밖에 있다. 같은 판단을
        (`BackLink`와 동일) 본문 끝에 한 번 더 두고, 라벨만 이 자리에서 더 길게 말한다.
        `push`가 아니라 `back`/`replace`인 이유: `push`는 온 화면 위에 다시 화면을 쌓아
        뒤로가기가 문서를 다시 열었다.
        누를 때 다시 묻는다 — 라벨은 렌더 시점 값으로 쓰지만 실제 이동은 누른 시점의
        히스토리를 따라야 한다. 문서끼리는 `replace`라 이 값은 그사이 변하지 않는다.
      */}
      <Button
        testID="legal-home"
        variant="secondary"
        hug
        label={canGoBack ? '돌아가기' : exit.label}
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace(exit.href as never);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: {
    backgroundColor: colors.offset,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  list: { gap: spacing.sm },
  item: { flexDirection: 'row', gap: spacing.sm },
  itemText: { flex: 1 },
});
