import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Button } from './Button';
import { spacing } from '@/theme/tokens';

/**
 * 조회가 실패했을 때의 한 줄과 `다시 불러오기`. **학생 화면 넷이 같은 모양을 쓴다**(D-136) —
 * 홈 · 학습 탭 · 고르기 · 결과.
 *
 * ## 왜 컴포넌트인가
 *
 * 네 화면에 글자까지 같은 블록이 있었고, 그래서 아래 두 결함을 고치려면 네 곳을 손대야 했다
 * (A-130). 문구는 화면마다 다른 것 하나(`무엇을` 불러오지 못했는지)뿐이다.
 *
 * ## 다시 시도가 도는 동안
 *
 * **버튼을 언마운트하지 않는다.** 예전에는 누르면 `loading`이 올라가 이 블록이 통째로 사라졌고,
 * 웹에서 포커스된 요소가 사라지면 포커스가 `<body>`로 떨어진다(`Button`이 이미 아는 동작).
 * 키보드·스크린리더 사용자는 포커스를 잃고, 눌렸는지도 알 수 없었다 — 새로 마운트되는 영역은
 * 대부분의 보조기술이 읽지 않기 때문이다(§11이 항상 마운트된 `LiveRegion`을 그래서 둔다).
 *
 * 그래서 **같은 버튼의 라벨만 갈아** 진행을 말한다(`/staff`의 `들어가는 중이에요`와 같은 방법).
 * 포커스가 살아 있고, 누르는 곳이 그대로 있고, 두 번 눌러도 조회가 두 번 돌지 않는다.
 */
export function LoadFailed({
  testID,
  retryTestID,
  /** `무엇을` 불러오지 못했는지. 예: `학습` · `결과` */
  what,
  /** 서버가 준 문장(`errorMessage`). 사람이 읽을 말이다. */
  message,
  /** 다시 조회가 도는 중. `loading && loaded`가 그 상태다(첫 조회가 아니라 재조회). */
  retrying,
  /**
   * **이미 읽어 둔 값이 화면에 있는데 재조회가 실패한 경우.** 문장이 `다시`를 붙인다 —
   * 그 화면은 지금 값을 보여 주고 있으므로 `불러오지 못했어요`만 쓰면 아무것도 못 읽은
   * 것처럼 읽힌다. 목록을 지우지 않는다는 §9의 규칙과 같은 자리다.
   */
  again,
  onRetry,
}: {
  testID: string;
  retryTestID: string;
  what: string;
  message: string;
  retrying?: boolean;
  again?: boolean;
  onRetry: () => void;
}) {
  return (
    <View testID={testID} style={styles.box}>
      <AppText variant="caption" tone="danger">
        {what}을 {again ? '다시 ' : ''}불러오지 못했어요. {message}
      </AppText>
      {/* 다시 시도는 그 화면의 주 행동이 아니다 — `hug`인 보조 버튼이다(§8). */}
      <Button
        testID={retryTestID}
        variant="secondary"
        hug
        label={retrying ? '다시 불러오고 있어요' : '다시 불러오기'}
        onPress={() => {
          if (retrying) return;
          onRetry();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /* 카드로 만들지 않는다 — 실패는 알려야 하지만 화면에서 가장 무거운 것이 될 이유는 없다. */
  box: { gap: spacing.sm, alignItems: 'flex-start' },
});
