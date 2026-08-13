import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { Group } from './Group';
import { endRow } from '@/theme/styles';
import { spacing } from '@/theme/tokens';

/**
 * 아직 아무것도 없을 때. **앱에 형태는 하나뿐이다.**
 *
 * 예전에는 세 가지가 섞여 있었다 — 화면마다 손으로 만든 `Group`+`View`, `Table`의 `empty` prop,
 * 그리고 `Row title="…없어요"`. 타이포까지 서로 달라서 같은 상황이 화면마다 다르게 보였다.
 *
 * `action`은 **여기서 할 수 있는 다음 행동 하나**다(§9). 둘 이상 두면 빈 화면이 메뉴가 된다.
 * 갈 곳이 없으면 주지 않는다 — 없는 길을 만들지 않는다.
 */
export function EmptyState({
  title,
  subtitle,
  action,
  plain,
  testID,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** 이미 테두리가 있는 자리(표 안). `Group`을 두르지 않고 위아래 여백만 준다. */
  plain?: boolean;
  testID?: string;
}) {
  const body = (
    <View style={plain ? styles.plain : styles.boxed} testID={testID}>
      <AppText variant="label">{title}</AppText>
      {subtitle ? (
        <AppText variant="caption" tone="secondary">
          {subtitle}
        </AppText>
      ) : null}
      {/*
        **정렬은 슬롯이 맡는다.** 행동은 마지막 줄의 오른쪽 끝이다(§8 규칙 ③). 호출부 셋이
        저마다 `alignSelf`를 붙이면 같은 빈 상태가 화면마다 다른 자리에 선다.
      */}
      {action ? <View style={[styles.action, endRow.action]}>{action}</View> : null}
    </View>
  );
  return plain ? body : <Group>{body}</Group>;
}

const styles = StyleSheet.create({
  boxed: { padding: spacing.lg, gap: spacing.xs },
  plain: { paddingVertical: spacing.xl, gap: spacing.xs },
  action: { marginTop: spacing.sm },
});
