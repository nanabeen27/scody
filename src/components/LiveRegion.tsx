import { View } from 'react-native';
import { AppText } from './AppText';
import { a11y } from '@/theme/styles';

/**
 * 화면에는 안 보이고 스크린리더에만 읽히는 알림 자리.
 *
 * **항상 렌더된 채로 있어야 한다.** 영역이 내용과 같이 나타나면 대부분의 보조기술이 읽지
 * 않는다 — 그래서 `Toast`가 아니라 `ToastProvider`가 이것을 들고 **문구만 바뀐다.**
 *
 * `testID`를 주지 않는다: `e2e/_toast.ts`의 `waitForQuietToast`가 `getByTestId('toast')`의
 * 개수 0을 기다리므로, 같은 id를 쓰면 영원히 조용해지지 않는다.
 */
export function LiveRegion({ message, assertive }: { message: string | null; assertive?: boolean }) {
  return (
    <View
      style={a11y.srOnly}
      accessibilityLiveRegion={assertive ? 'assertive' : 'polite'}
      aria-live={assertive ? 'assertive' : 'polite'}
      role={assertive ? 'alert' : 'status'}
    >
      <AppText>{message ?? ''}</AppText>
    </View>
  );
}
