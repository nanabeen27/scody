import { useEffect, useRef } from 'react';
import { StyleSheet, View, type View as RNView } from 'react-native';
import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { colors, spacing } from '@/theme/tokens';

/**
 * 되돌릴 수 없는 행동 앞의 확인 단계. **앱에 형태는 하나뿐이다.**
 *
 * **오른쪽 정렬이고 주 행동이 오른쪽 끝**이다 — 둘 중 하나를 고르는 자리라 화면 행동줄
 * (왼쪽 정렬)과 다르다. 읽는 방향의 끝에 결론이 온다.
 *
 * **포커스를 확인 버튼으로 옮긴다.** 화면들이 확인 상태에서 트리거 버튼을 언마운트하는데,
 * 그러면 웹에서 포커스가 `<body>`로 떨어져 키보드·스크린리더 사용자는 질문을 듣지도 못한 채
 * 문서 맨 위로 밀린다. 이것이 이 컴포넌트가 존재하는 진짜 이유다.
 *
 * 문구에 `role="alert"`을 준다 — 지금 답해야 하는 질문이다.
 */
export function ConfirmStep({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  destructive,
  confirmIcon,
  confirmTestID,
  confirmAccessibilityLabel,
}: {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** 되돌릴 수 없는 행동. `취소`와 같은 무게로 두지 않는다. */
  destructive?: boolean;
  confirmIcon?: IconName;
  confirmTestID?: string;
  confirmAccessibilityLabel?: string;
}) {
  const confirmRef = useRef<RNView>(null);
  useEffect(() => {
    // 웹에서만 있는 DOM 메서드다. 네이티브에는 포커스 개념이 없어 그냥 없다.
    (confirmRef.current as unknown as { focus?: () => void } | null)?.focus?.();
  }, []);

  return (
    <View style={{ gap: 0 }}>
      <AppText variant="caption" tone="secondary" role="alert">
        {message}
      </AppText>
      {/*
        확인 단계는 **그 자체가 고르는 단계**라 두 버튼이 한 덩어리다(`ActionBar`의 '한 줄에
        하나' 규칙에서 유일하게 빠지는 자리). `취소`가 결론 바로 옆에 없으면 되돌릴 길이
        멀어진다. 그래서 `ActionBar`를 쓰지 않고 자기 줄을 갖는다 — 오른쪽 끝 정렬은 같다.
      */}
      <View style={styles.row}>
        <Button variant="ghost" label="취소" onPress={onCancel} />
        <Button
          ref={confirmRef}
          testID={confirmTestID}
          variant="secondary"
          tone={destructive ? 'danger' : 'accent'}
          label={confirmLabel}
          accessibilityLabel={confirmAccessibilityLabel}
          leading={
            confirmIcon ? (
              <Icon
                name={confirmIcon}
                size={16}
                color={destructive ? colors.danger : colors.accent}
              />
            ) : undefined
          }
          onPress={onConfirm}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* `ActionBar`와 같은 자리·같은 간격이되, 여기만 둘이 나란히 선다. */
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm },
});
