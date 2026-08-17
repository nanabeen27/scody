import { Pressable, View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { colors, control, touch } from '@/theme/tokens';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** 라벨 뒤 개수. 고르기 전에 결과 규모를 알 수 있다. */
  count?: number;
}

interface Props<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** testID 접두사. 각 칸은 `${testID}-${value}`가 된다. */
  testID?: string;
}

/**
 * 하나를 고르는 컨트롤. 트랙 안에서 고른 칸만 밝은 면으로 떠오른다.
 *
 * **프로젝트에서 하나를 고르는 자리는 전부 이것이다**(D-077) — 목록 필터, 보기 방식 전환,
 * 폼의 유형·학년·영역·정답까지. 칩이나 라디오를 손으로 다시 그리지 않는다.
 *
 * 옵션이 한 줄을 넘으면 트랙 안에서 줄바꿈한다. 가로로 잘라 숨기지 않는다 —
 * 모바일에서 오른쪽 옵션이 보이지 않으면 있는 줄도 모르고 지나친다.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  testID,
}: Props<T>) {
  return (
    /* 묶음에 역할을 주면 "3개 중 1번째"처럼 몇 개 중 몇 번째인지 함께 읽힌다. */
    <View style={styles.track} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={testID ? `${testID}-${o.value}` : undefined}
            /*
              **역할이 `button`이면 선택 상태를 말할 방법이 없다.** `aria-selected`를 주고 있었는데
              그 속성은 `option`·`tab`·`row` 같은 역할에만 쓰이고 `button`에서는 무시된다 — 고른 칸이
              밝은 면으로 떠올라도 스크린리더에는 그냥 버튼 셋이었다(실측: 소개 페이지에서
              `[aria-selected]` 3개인데 선택을 읽을 방법이 0개).

              하나만 고르는 컨트롤이라 `radio`가 맞는 역할이고, 그러면 상태가 `aria-checked`다.
              "라디오 버튼, 선택됨, 3개 중 1번째"로 읽힌다. `aria-pressed`는 웹에서는 맞지만
              **react-native의 `Pressable`이 모르는 속성이라** 네이티브에서 상태가 사라진다
              (RN은 `aria-checked`·`aria-selected`만 `accessibilityState`로 옮긴다).
              모양은 하나도 바뀌지 않는다.
            */
            accessibilityRole="radio"
            aria-checked={on}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [
              styles.item,
              on && styles.itemOn,
              pressed && !on && { backgroundColor: colors.hover },
            ]}
          >
            {/*
              줄높이를 **명시한다.** 예전에는 `fontSize`만 바꾸고 `body`의 23.25를 상속해
              컨트롤 높이가 31.25px이었다 — 아무도 적어 두지 않은 우연이었다.
            */}
            <AppText
              weight={on ? 'semibold' : 'medium'}
              style={{
                fontSize: control.labelSize,
                lineHeight: control.labelLineHeight,
                color: on ? colors.accent : colors.inkSecondary,
              }}
            >
              {o.count == null ? o.label : `${o.label} ${o.count}`}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'flex-start',
    backgroundColor: colors.offset,
    borderRadius: control.trackRadius,
    padding: control.trackPadding,
    gap: control.gap,
  },
  /*
    36px. 44에 미달하는 **문서화된 예외**다(§10) — 필터를 알약 44개로 늘어놓으면 화면이
    무거워진다는 판단이고, 칸이 서로 붙어 있어 오조준해도 이웃 칸에 떨어진다.
    WCAG 2.5.8(AA) 24는 넘고 2.5.5(AAA) 44에는 미달이다. **이 예외를 다른 컨트롤로 넓히지 않는다.**
  */
  item: {
    minHeight: touch.dense,
    justifyContent: 'center',
    paddingVertical: control.paddingY,
    paddingHorizontal: control.paddingX,
    borderRadius: control.itemRadius,
  },
  itemOn: { backgroundColor: colors.surface },
});
