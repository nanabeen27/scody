import { Children, Fragment, type ReactNode, isValidElement } from 'react';
import { View, StyleSheet } from 'react-native';
import { Divider } from './Divider';
import { colors, radius } from '@/theme/tokens';

/** 얇은 테두리로 감싼 조용한 그룹. 자식(Row) 사이에 hairline 구분선을 자동 삽입. */
export function Group({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.group}>
      {items.map((child, i) => (
        <Fragment key={i}>
          {i > 0 && <Divider inset={16} />}
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
