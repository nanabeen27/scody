import { Text, Pressable, StyleSheet } from 'react-native';
import { colors, typeface, font, touch } from '@/theme/tokens';

/**
 * 스코디 워드마크. "Scody"를 Space Grotesk 폰트로 표기한 로고.
 * `onPress`를 주면 누를 수 있는 링크가 된다(홈이나 소개 페이지로 나가는 길).
 *
 * **앱 화면에는 워드마크만 둔다.** 파비콘 도형(`public/favicon.svg`)은 브라우저 탭에서만 쓴다 —
 * 같은 도형을 화면 안에도 두면 로고가 둘이 되고, 인증 화면처럼 글자가 적은 곳에서
 * 가장 먼저 눈에 띄는 것이 서비스 이름이 아니라 아이콘이 된다.
 */
export function Brand({
  small,
  center,
  onPress,
  accessibilityLabel,
  testID,
}: {
  small?: boolean;
  center?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const content = <Text style={[styles.logo, small ? styles.small : styles.large]}>Scody</Text>;
  if (!onPress) return content;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? '스코디'}
      onPress={onPress}
      style={({ pressed }) => [
        styles.link,
        center && styles.linkCenter,
        pressed && { opacity: 0.6 },
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /*
    누를 수 있는 워드마크는 인증 화면에서 **나가는 유일한 길**이다(`AuthShell`의 `onExit`).
    글자 높이가 34라 누름 영역이 §10의 하한 44에 미달했다 — 커진 만큼 음수 마진으로 되돌려
    줄 높이는 그대로 둔다(`AuthShell`의 링크·푸터가 쓰는 방법과 같다).
  */
  link: {
    alignSelf: 'flex-start',
    minHeight: touch.min,
    justifyContent: 'center',
    marginVertical: -5,
  },
  linkCenter: { alignSelf: 'center' },
  logo: {
    fontFamily: typeface.wordmark,
    color: colors.ink,
    letterSpacing: font.tracking.tighter,
  },
  large: { fontSize: 30, lineHeight: 34 },
  small: { fontSize: 22, lineHeight: 26 },
});
