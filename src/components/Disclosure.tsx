import { useState, type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from './Button';
import { Icon } from './Icon';
import { colors, spacing } from '@/theme/tokens';

/**
 * 접었다 펴는 자리.
 *
 * 모바일에서 **판단에 쓰는 것을 화면 밖으로 밀어내는 블록**을 접을 때 쓴다 — 학원 대시보드의
 * 추이 두 개, 성과 분석의 필터 다섯 줄, 관리자 계정의 필터 두 줄. 접기 자체가 목적이 아니라
 * **그 아래에 있는 것을 첫 화면 안으로 끌어올리는 것**이 목적이다.
 *
 * 트리거 라벨에 **지금 상태를 담는다**(`필터 · 마감 지남 · 고1 국어 3반`). 접힌 것이 무엇인지
 * 모르면 펴 볼 이유도 알 수 없다.
 */
export function Disclosure({
  label,
  children,
  defaultOpen,
  testID,
}: {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
  testID?: string;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <View style={styles.wrap}>
      <Button
        testID={testID}
        variant="secondary"
        tone="accent"
        size="sm"
        hug
        label={label}
        accessibilityLabel={label}
        aria-expanded={open}
        leading={
          <Icon name={open ? 'chevron-down' : 'chevron-right'} size={15} color={colors.accent} />
        }
        onPress={() => setOpen((v) => !v)}
      />
      {open ? children : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
});
