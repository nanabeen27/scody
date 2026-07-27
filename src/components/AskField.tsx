import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { colors, spacing, radius, typeface, font } from '@/theme/tokens';

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
  /** 답을 받는 중이면 버튼을 눌리지 않게 한다. */
  busy?: boolean;
  multiline?: boolean;
  /** 카드 안에 얹어 쓰는 형태. 자체 테두리·배경 없이 위쪽 경계선만 남긴다. */
  flat?: boolean;
  testID?: string;
  sendTestID?: string;
  accessibilityLabel?: string;
}

/**
 * 질문 입력창. 전송 버튼은 입력창 안 오른쪽에 있고, 글자를 입력했을 때만 나타난다.
 * 버튼은 강조색 원 안의 위쪽 화살표다.
 */
export function AskField({
  value,
  onChangeText,
  onSubmit,
  placeholder,
  busy,
  multiline,
  flat,
  testID,
  sendTestID,
  accessibilityLabel,
}: Props) {
  const canSend = value.trim().length > 0;
  return (
    <View style={styles.wrap}>
      <TextInput
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkTertiary}
        multiline={multiline}
        onSubmitEditing={() => {
          if (canSend && !busy) onSubmit();
        }}
        style={[styles.input, multiline && styles.inputMultiline, flat && styles.inputFlat]}
      />
      {canSend ? (
        <Pressable
          testID={sendTestID}
          accessibilityRole="button"
          accessibilityLabel="물어보기"
          accessibilityState={{ disabled: !!busy }}
          disabled={busy}
          onPress={onSubmit}
          style={({ pressed }) => [
            styles.send,
            busy && styles.sendBusy,
            pressed && styles.sendPressed,
          ]}
        >
          <Icon name="arrow-up" size={18} color={colors.accentText} />
        </Pressable>
      ) : null}
    </View>
  );
}

const SEND = 34;

const styles = StyleSheet.create({
  wrap: { position: 'relative', justifyContent: 'center' },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingLeft: spacing.lg,
    // 버튼 자리를 비워 둔다
    paddingRight: SEND + spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: typeface.regular,
    fontSize: font.size.base,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  inputMultiline: { minHeight: 96, paddingTop: 14, textAlignVertical: 'top' },
  inputFlat: {
    // 문제 카드와 한 몸처럼 붙인다. 위쪽 얇은 선으로만 구분.
    borderWidth: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderRadius: 0,
    backgroundColor: 'transparent',
    minHeight: 48,
  },
  send: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    width: SEND,
    height: SEND,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBusy: { opacity: 0.5 },
  sendPressed: { opacity: 0.85 },
});
