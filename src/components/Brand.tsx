import { Text, Pressable, StyleSheet } from 'react-native';
import { colors, typeface, font } from '@/theme/tokens';

/**
 * 스코디 워드마크. "Scody"를 Space Grotesk 폰트로 표기한 로고.
 * `onPress`를 주면 누를 수 있는 링크가 된다(홈이나 소개 페이지로 나가는 길).
 */
export function Brand({
  small,
  onPress,
  accessibilityLabel,
  testID,
}: {
  small?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const text = <Text style={[styles.logo, small ? styles.small : styles.large]}>Scody</Text>;
  if (!onPress) return text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? '스코디'}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}
    >
      {text}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'flex-start' },
  logo: {
    fontFamily: typeface.wordmark,
    color: colors.ink,
    letterSpacing: font.tracking.tighter,
  },
  large: { fontSize: 30, lineHeight: 34 },
  small: { fontSize: 22, lineHeight: 26 },
});
