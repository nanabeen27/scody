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
        small ? styles.linkSmall : styles.linkLarge,
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
    줄 높이는 그대로 둔다(`tap.textLine`이 캡션 한 줄에 하는 일과 같다).

    **되돌리는 값은 글자 높이에서 나온다**(`(44 − lineHeight) / 2`). 그래서 `tap.textLine`의
    12(20px 한 줄 기준)를 쓸 수 없고, 두 크기가 값을 나눠 갖는다. 한 값을 두 크기에 쓰면
    작은 워드마크가 자기 줄에 8px을 더한다 — 지금은 `small`에 `onPress`를 주는 자리가 없지만,
    값이 하나면 그런 자리가 생기는 순간 조용히 틀린다.
  */
  link: { alignSelf: 'flex-start', minHeight: touch.min, justifyContent: 'center' },
  linkLarge: { marginVertical: -5 }, // (44 − 34) / 2
  linkSmall: { marginVertical: -9 }, // (44 − 26) / 2
  linkCenter: { alignSelf: 'center' },
  logo: {
    fontFamily: typeface.wordmark,
    color: colors.ink,
    letterSpacing: font.tracking.tighter,
  },
  large: { fontSize: 30, lineHeight: 34 },
  small: { fontSize: 22, lineHeight: 26 },
});
