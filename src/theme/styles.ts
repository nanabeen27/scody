import { StyleSheet } from 'react-native';
import { spacing } from './tokens';

/*
  여기 `row.center`·`row.between`·`row.wrap`·`row.baseline`·`row.end`가 있었다. **지운다.**

  다섯 개 모두 호출부가 0곳인데 `row.end`의 주석만 "오른쪽 정렬은 이 하나로만 한다"고
  규칙을 선언하고 있었다 — 손으로 쓴 `flexDirection: 'row'` 뭉치가 60곳, `space-between`이
  23곳 남은 채로. **지켜지지 않는 규칙을 선언한 파일이 제일 나쁘다**: 다음 사람이 화면의
  실제 코드와 이 파일 중 어느 쪽을 믿어야 하는지 알 수 없다.

  다시 넣으려면 **먼저 호출부를 옮기고** 그 다음에 상수를 둔다. 순서가 반대면 또 이렇게 된다.
*/

/**
 * 면(카드·패널·빈 상태) 안 **마지막 줄에 붙는 행동**을 오른쪽 끝에 세운다(DESIGN.md §8 규칙 ③).
 *
 * `alignItems: 'flex-end'`가 아니라 **가로 줄 + `justifyContent`**다. 곁다리 버튼은 거의 다
 * `hug`(= `alignSelf: 'flex-start'`)을 들고 있어서, 세로 줄에서는 `alignItems`가 그 `alignSelf`에
 * 진다. 가로 줄에서는 `alignSelf`가 세로 축이 되어 아무 일도 하지 않는다 — `Section`의 `action`과
 * `Row`의 `trailing`이 감싸는 View를 두는 것과 같은 이유이고, 호출부에서 `hug`을 빼지 않아도 된다.
 *
 * 글자가 함께 들어 있는 자리(`inset.panel` 등)에는 두지 않는다. 본문까지 오른쪽으로 붙는다.
 */
const endAligned = {
  flexDirection: 'row',
  justifyContent: 'flex-end',
  alignItems: 'center',
} as const;

/** 면 안 마지막 줄의 행동 자리. 버튼 하나를 감싼다(`endRow.action`). */
export const endRow = StyleSheet.create({ action: endAligned });

/** `Group` 안, 행 아래에 붙는 자리. 좌우 선을 행 본문과 맞춘다. */
export const inset = StyleSheet.create({
  /**
   * 설명·입력이 들어가는 패널.
   * **정렬은 주지 않는다** — 글자가 함께 들어 있어서 오른쪽으로 붙이면 본문까지 따라간다.
   * 패널 맨 아래 버튼을 오른쪽에 세우려면 그 버튼만 `endRow.action`으로 감싼다.
   */
  panel: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  /** 보조 행동 한 줄. 행동은 줄의 오른쪽 끝에 선다(§8 규칙 ③). */
  action: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, ...endAligned },
});

export const a11y = StyleSheet.create({
  /**
   * 화면에서는 안 보이고 스크린리더만 읽는 자리.
   *
   * `opacity: 0`이나 `display: none`을 쓰지 않는다 — 여러 보조기술이 그런 요소를 아예 건너뛴다.
   * 1×1로 잘라 두는 것이 표준 기법이다.
   */
  srOnly: { position: 'absolute', width: 1, height: 1, margin: -1, overflow: 'hidden' },
});
