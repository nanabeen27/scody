import { useRef, useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  type TextStyle,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
} from 'react-native';
import { Icon } from './Icon';
import { colors, spacing, radius, touch, typeface, font } from '@/theme/tokens';

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
  /** 답을 받는 중이면 버튼을 눌리지 않게 한다. */
  busy?: boolean;
  /** 카드 안에 얹어 쓰는 형태. 자체 테두리·배경 없이 쓴다(구분선은 카드가 그린다). */
  flat?: boolean;
  /**
   * 자동 확장 상한. 화면 하단에 고정해 쓰는 곳은 낮춘다 —
   * 200이면 키보드까지 떴을 때 대화가 보일 자리가 남지 않는다.
   */
  maxHeight?: number;
  testID?: string;
  sendTestID?: string;
  accessibilityLabel?: string;
}

/**
 * 브라우저 기본 포커스 링을 끈다. 사각형으로 그려져 입력창의 둥근 모서리와 어긋난다.
 * 상한에 닿으면 안에서 스크롤한다(기본값에 맡기지 않고 명시한다).
 */
const webInput = (
  Platform.OS === 'web' ? { outlineStyle: 'none', overflowY: 'auto' } : {}
) as unknown as TextStyle;

/** 한 줄 높이(16 × 1.55 ≈ 24.8)보다 커야 첫 줄이 잘리지 않는다. */
const MIN_H = 26;
/** 이 높이를 넘으면 더 자라지 않고 안에서 스크롤한다. 화면을 입력창이 다 먹지 않게. */
const MAX_H = 200;

/**
 * 질문 입력창(컴포저). ChatGPT·Perplexity의 입력 방식을 따른다.
 *
 * - 텍스트 영역과 전송 버튼을 **위아래 두 층**으로 나눈다. 한 줄에 겹쳐 두면 글이 버튼 아래로 흐른다.
 * - 여러 줄을 쓸 수 있고, 줄이 늘면 입력창이 함께 자란다(최대 높이 뒤 내부 스크롤).
 * - **Enter는 보내기, Shift+Enter는 줄바꿈.** react-native-web의 TextInput이 이 규칙을
 *   이미 구현하고 있어서(`multiline` + `blurOnSubmit` + `onSubmitEditing`) 직접 키를 잡지 않는다.
 *   한글 조합 중에는 전송하지 않는 처리도 그쪽에 있다.
 * - 보내면 포커스가 빠지므로(웹 기본 동작) 다시 포커스를 준다. 이어서 물어볼 때 끊기지 않게.
 *
 * 높이는 웹과 네이티브가 다른 길로 잰다. 웹에서 `onContentSizeChange`만 쓰면
 * **줄어드는 방향을 감지할 수 없다** — textarea에 명시적 height가 걸려 있으면
 * `scrollHeight`가 그 아래로 내려가지 않고, react-native-web이 같은 값을 캐시로 걸러
 * 콜백을 아예 부르지 않는다. 그래서 웹은 높이를 풀고 직접 잰다.
 */
export function AskField({
  value,
  onChangeText,
  onSubmit,
  placeholder,
  busy,
  flat,
  maxHeight,
  testID,
  sendTestID,
  accessibilityLabel,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [height, setHeight] = useState(MIN_H);
  const inputRef = useRef<TextInput>(null);
  const canSend = value.trim().length > 0;
  const cap = maxHeight ?? MAX_H;
  const clamp = (n: number) => Math.max(MIN_H, Math.min(cap, n));

  function send() {
    if (!canSend || busy) return;
    onSubmit();
    setHeight(MIN_H);
    // 이어서 쓸 수 있게 커서를 돌려준다.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  /** 네이티브 전용. `contentSize`가 실제로 줄어들기 때문에 이 값을 그대로 믿는다. */
  function onContentSize(e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) {
    if (Platform.OS === 'web') return;
    setHeight(clamp(e.nativeEvent.contentSize.height));
  }

  /**
   * 웹 전용. 높이를 0으로 풀어 내용 높이를 재고 다시 채운다.
   * 재는 동안만 스타일을 만지므로 화면에는 중간 상태가 보이지 않는다.
   */
  function measureWeb() {
    const node = inputRef.current as unknown as HTMLTextAreaElement | null;
    if (!node?.style) return;
    const before = node.style.height;
    node.style.height = '0px';
    const next = node.scrollHeight;
    node.style.height = before;
    setHeight(clamp(next));
  }

  function change(next: string) {
    onChangeText(next);
    if (Platform.OS === 'web') measureWeb();
  }

  return (
    <View
      style={[
        styles.box,
        flat && styles.boxFlat,
        focused && (flat ? styles.boxFlatOn : styles.boxOn),
      ]}
    >
      <TextInput
        ref={inputRef}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={change}
        placeholder={placeholder}
        placeholderTextColor={colors.inkTertiary}
        multiline
        // Enter로 보내려면 이 두 개가 함께 있어야 한다(웹 구현 기준).
        blurOnSubmit
        onSubmitEditing={send}
        onContentSizeChange={onContentSize}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, { height }, webInput]}
      />
      <View style={styles.tools}>
        <Pressable
          testID={sendTestID}
          accessibilityRole="button"
          accessibilityLabel="물어보기"
          disabled={!canSend || busy}
          onPress={send}
          style={({ pressed }) => [
            styles.send,
            (!canSend || busy) && styles.sendOff,
            pressed && canSend && !busy && styles.sendPressed,
          ]}
        >
          <Icon
            name="arrow-up"
            size={18}
            color={canSend && !busy ? colors.accentText : colors.inkTertiary}
          />
        </Pressable>
      </View>
    </View>
  );
}

/** 보내기 버튼. 대화 화면에서 가장 자주 누르는 것이라 터치 하한을 지킨다. */
const SEND = touch.min;

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  boxFlat: {
    // 문항 카드와 한 몸처럼 붙인다. 구분선은 카드(Group)가 이미 긋는다.
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.lg,
  },
  boxOn: { borderColor: colors.ink },
  boxFlatOn: { backgroundColor: colors.offset },

  /*
    입력 글자는 본문(15)이 아니라 `md`(16)다. **iOS Safari는 16px 미만인 입력에 포커스하면
    페이지를 자동으로 확대한다** — 홈의 `Scody AI에게 물어보기`를 누르는 순간 화면이 커진다.
    줄 높이도 같은 비율(normal)로 함께 올려 자동 확장 계산이 어긋나지 않게 한다.
  */
  input: {
    fontFamily: typeface.regular,
    fontSize: font.size.md,
    lineHeight: font.size.md * font.lineHeight.normal,
    color: colors.ink,
    padding: 0,
    textAlignVertical: 'top',
  },
  // 전송 버튼은 글 아래 오른쪽. 글과 겹치지 않는다.
  tools: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  send: {
    width: SEND,
    height: SEND,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { backgroundColor: colors.offset },
  sendPressed: { opacity: 0.85 },
});
