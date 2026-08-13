import { Children, Fragment, type ReactNode, isValidElement } from 'react';
import { View, StyleSheet } from 'react-native';
import { Divider } from './Divider';
import { colors, radius } from '@/theme/tokens';

/**
 * 얇은 테두리로 감싼 조용한 그룹. 자식(Row) 사이에 hairline 구분선을 자동 삽입.
 *
 * 구분선은 기본으로 왼쪽 16px을 비운다(목록에서 글 시작선에 맞추는 관례).
 * 카드 전체를 가로지르는 선이 필요하면 `dividerInset={0}`을 쓴다 —
 * 입력창처럼 면이 바뀌는 자리에서는 선이 끝까지 이어져야 한쪽만 끊겨 보이지 않는다.
 */
export function Group({
  children,
  dividerInset = 16,
}: {
  children: ReactNode;
  dividerInset?: number;
}) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.group}>
      {items.map((child, i) => (
        <Fragment key={i}>
          {i > 0 && <Divider inset={dividerInset} />}
          {child}
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
});
