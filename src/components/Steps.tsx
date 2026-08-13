import { View, StyleSheet } from 'react-native';
import { colors, radius } from '@/theme/tokens';

/** 이보다 많아지면 칸이 실 같아져 셀 수 없다. 그때는 이 컴포넌트를 쓰지 않는다. */
const MAX = 12;

/**
 * 셀 수 있는 진행. **한 칸이 하나를 뜻한다** — 5문항이면 칸이 다섯이다.
 *
 * 진행률 막대(`ProgressBar`)를 쓰지 않는 이유: 옆에 `3 / 5 완료`라고 적어 두고 그 아래
 * 같은 비율을 막대로 한 번 더 그리면 **같은 말을 두 번 하는 장식**이 된다
 * (§13 `의미 없는 배지·수치·그래프`). 칸으로 두면 비율이 아니라 **개수**가 보여서
 * 숫자와 다른 것을 말한다 — 몇 개 남았는지가 한눈에 들어온다.
 *
 * 막대는 **여러 값을 나란히 비교할 때만** 쓴다(`BarRow` — 영역별 정답률처럼 길이를 훑는 자리).
 *
 * 개수가 많으면(> 12) 칸이 의미를 잃는다. 그런 자리는 숫자만 두는 것이 맞다.
 *
 * **스크린리더에서는 감춘다**(`PendingDots`와 같은 판단). 이 칸들은 항상 같은 값을 말하는
 * 글자 옆에 놓인다 — 홈 `3 / 5 완료`, 풀이 `3 / 5 풀었어요`, 복습 `2 / 8`. 이름 없는
 * `progressbar`로 두면 무엇의 진행인지 모른 채 숫자만 한 번 더 읽히고, 이름을 붙이면
 * 옆 글자와 같은 말이 두 번 읽힌다. 값을 말하는 것은 글자이고 칸은 그 값을 눈으로 세게
 * 도울 뿐이므로, 역할과 값을 모두 뺀다.
 */
export function Steps({ done, total }: { done: number; total: number }) {
  if (total <= 0 || total > MAX) return null;
  const filled = Math.max(0, Math.min(total, Math.round(done)));
  return (
    <View
      style={styles.row}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.step, i < filled && styles.on]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 3 },
  /*
    칸은 균등하게 늘어난다. 고정 폭으로 두면 문항 수가 다른 화면마다 줄 길이가 달라져
    같은 뜻이 다르게 보인다.
  */
  step: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: colors.offset },
  on: { backgroundColor: colors.accent },
});
