import { Children, isValidElement, type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { layout, spacing } from '@/theme/tokens';

/**
 * 화면의 행동 줄.
 *
 * 규칙 넷. 전부 **어긴 화면을 보고 나서** 정했다.
 *
 * 1. **한 줄에 버튼 하나.** 둘을 나란히 두면 어느 것이 주 행동인지 모양으로 알 수 없고,
 *    셋이면 사용자가 고르기 전에 읽어야 할 것이 셋이 된다. 선택지가 여럿이면 버튼을
 *    늘어놓지 말고 **한 버튼을 누른 뒤 그 안에서 고르게** 하거나 `Row` 목록으로 편다.
 * 2. **주 행동(`primary`)은 좌우로 늘인다.** 강조색이 칠해진 버튼은 이 화면에서 할 일
 *    그 자체라, 폭이 곧 위계다. **늘이는 것은 `Button`이 스스로 한다** — 행동 줄 밖
 *    (히어로 카드 등)에 있어도 같은 폭이어야 하기 때문이다. 여기서는 줄의 정렬만 정한다.
 * 3. **그 밖의 버튼은 오른쪽 끝에 둔다.** 되돌아가기·건너뛰기처럼 곁다리인 것을 전폭으로
 *    늘이면 주 행동과 같은 무게가 된다. 왼쪽에 몰면 본문 글줄과 붙어 어디까지가 읽을
 *    것이고 어디부터가 누를 것인지 흐려진다.
 * 4. **한 대상에 속한 행동은 여기 두지 않는다.** 카드 한 줄에 딸린 것은 그 줄의
 *    `trailing`으로, 섹션에 딸린 것은 `Section`의 `action`으로 간다. 화면 아래로
 *    내려오면 무엇에 대한 행동인지 사라진다.
 *
 * 늘어난 폭도 읽기 폭(680)에서 멈춘다 — `wide`(960) 화면에서 960px 버튼은 배너로 읽힌다.
 */
export function ActionBar({
  children,
  stretch,
  testID,
}: {
  children: ReactNode;
  /** 자동 판단을 덮어쓴다. `primary`가 아닌데 화면의 목적을 끝내는 드문 자리에만. */
  stretch?: boolean;
  testID?: string;
}) {
  const list = Children.toArray(children);
  if (__DEV__ && list.length > 1) {
    // 조용히 두면 다시 늘어난다. 화면을 짜는 사람이 바로 보게 한다.
    console.warn(
      'ActionBar: 한 줄에 버튼은 하나다. 선택지가 여럿이면 한 버튼 + 고르는 단계로 바꾼다.',
    );
  }
  /*
    **늘이는 판단은 `Button`이 한다**(`primary`면 전폭). 여기서는 줄의 정렬만 정한다 —
    전폭 버튼이 들어오면 세로 한 칸이어야 하고, 곁다리면 오른쪽 끝이다.
  */
  const only = list[0];
  const variant =
    isValidElement<{ variant?: string; hug?: boolean }>(only)
      ? (only.props.variant ?? 'primary')
      : undefined;
  const hugged = isValidElement<{ hug?: boolean }>(only) ? !!only.props.hug : false;
  const wide = stretch ?? (list.length === 1 && variant === 'primary' && !hugged);

  return (
    <View testID={testID} style={[styles.bar, wide ? styles.stretch : styles.row]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { maxWidth: layout.actionBarMaxWidth, gap: spacing.sm },
  /* 오른쪽 끝. 한 줄에 하나뿐이라 `wrap`이 필요 없다. */
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  // 세로 한 칸. 안의 버튼이 `alignItems: stretch`를 받아 줄 전체를 채운다.
  stretch: { alignSelf: 'stretch' },
});
