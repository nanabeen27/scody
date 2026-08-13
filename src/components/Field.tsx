import { useState } from 'react';
import { View, TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { AppText } from './AppText';
import { colors, radius, spacing, font, typeface } from '@/theme/tokens';

interface Props extends TextInputProps {
  label: string;
  hint?: string;
}

export function Field({ label, hint, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <TextInput
        {...rest}
        accessibilityLabel={rest.accessibilityLabel ?? label}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        placeholderTextColor={colors.inkTertiary}
        style={[styles.input, focused && { borderColor: colors.accent }, style]}
      />
      {hint ? (
        <AppText variant="caption" tone="tertiary">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  /*
    입력 글자는 본문(15)이 아니라 `md`(16)다. **iOS Safari는 16px 미만인 입력에 포커스하면
    페이지를 자동으로 확대한다** — 로그인에서 번호 칸을 누르는 순간 화면이 커지고 그대로
    다음 단계까지 이어져 좌우 스크롤이 생긴다. 라벨·힌트는 그대로 캡션이다.
    높이는 고정 50이라 글자를 키워도 변하지 않는다(터치 하한 44 이상).
  */
  input: {
    height: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    fontFamily: typeface.regular,
    fontSize: font.size.md,
    color: colors.ink,
  },
});
