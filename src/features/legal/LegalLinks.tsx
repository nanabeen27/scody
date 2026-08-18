import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components';
import { tap } from '@/theme/styles';
import { spacing } from '@/theme/tokens';
import { LEGAL_DOCS } from './documents';

/**
 * 푸터의 법률 문서 링크 한 줄(서비스 소개 · 이용약관 · 개인정보처리방침 · 사업자정보).
 *
 * **소개 페이지와 인증 화면이 이 블록을 각자 갖고 있었다** — 글자 하나까지 같고 `testID`
 * 접두사만 달랐다. 그래서 링크의 누름 영역이 44에 미달한다는 결함 하나를 고치는 데 두 파일을
 * 손대야 했다(D-166). 문구는 `documents.ts`가 원본이므로 화면은 이 컴포넌트만 부른다.
 *
 * 좁은 화면에서는 줄바꿈한다. 가로로 잘라 숨기면 있는 문서도 모르고 지나친다.
 */
export function LegalLinks({ testIDPrefix }: { testIDPrefix: string }) {
  const router = useRouter();
  return (
    <View style={styles.row}>
      {LEGAL_DOCS.map((d) => (
        <Pressable
          key={d.slug}
          testID={`${testIDPrefix}-${d.slug}`}
          accessibilityRole="link"
          onPress={() => router.push(`/legal/${d.slug}` as never)}
          style={({ pressed }) => [tap.textLine, pressed && { opacity: 0.6 }]}
        >
          <AppText variant="caption" tone="secondary">
            {d.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
});
