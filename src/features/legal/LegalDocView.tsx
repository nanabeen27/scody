import { useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Screen, Section, Group, Row, AppText, Button } from '@/components';
import { colors, spacing, radius } from '@/theme/tokens';
import { LEGAL_DOCS, type LegalDoc } from './documents';

/**
 * 푸터 문서 화면의 공통 뷰. 문서마다 라우트 파일을 두고 이 뷰를 렌더한다.
 * 한 동적 라우트로 묶으면 문서끼리 이동할 때 Expo Router가 같은 화면을 재사용해 내용이 바뀌지 않는다.
 */
export function LegalDocView({ doc }: { doc: LegalDoc }) {
  const router = useRouter();

  return (
    <Screen
      testID={`legal-${doc.slug}`}
      backFallback="/introduce"
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

      <Button
        testID="legal-home"
        variant="secondary"
        fullWidth
        label="소개 페이지로 돌아가기"
        onPress={() => router.push('/introduce' as never)}
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
