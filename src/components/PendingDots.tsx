import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, spacing } from '@/theme/tokens';
import { motion } from '@/theme/motion';
import { useReduceMotion } from '@/theme/useReduceMotion';

/** 점 세 개. 넷 이상이면 줄이 길어져 옆 글자와 경쟁한다. */
const DOTS = [0, 1, 2];
/** 한 점이 옅어졌다 돌아오는 데 걸리는 시간. 셋이 이 간격만큼 어긋나 차례로 움직인다. */
const STEP = motion.duration.basic;

/**
 * 기다리는 중을 말하는 가장 작은 표시. 점 셋이 차례로 옅어졌다 돌아온다.
 *
 * **상태는 글자가 말한다**(`답을 쓰고 있어요`). 이건 "멈춘 게 아니다"만 전한다 —
 * 그래서 스크린리더에서는 감춘다. 옆 글자가 이미 같은 말을 하고 있다.
 *
 * `opacity`만 움직인다. 크기·자리·줄 높이는 그대로다(§8) — 대기가 끝나고 본문이
 * 들어올 때 줄이 흔들리면 그것부터 눈에 띈다.
 *
 * **모션 줄이기가 켜져 있으면 점 셋을 정적으로 그린다.** 표시가 사라지면 기다리는
 * 중이라는 사실까지 사라진다 — 움직임만 뺀다.
 */
export function PendingDots({ testID }: { testID?: string }) {
  const reduced = useReduceMotion();
  /*
    `Animated.Value`는 `useState(() => …)`로 만든다. `useRef`로 만들면 Fast Refresh에서
    값이 다시 생겨 화면이 튄다(`useMotion.ts`·`Toast.tsx`가 이미 같은 형태다).
  */
  const [values] = useState(() => DOTS.map(() => new Animated.Value(1)));

  useEffect(() => {
    if (reduced) return;
    const loops = values.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          // 점마다 STEP씩 늦게 출발해 물결처럼 보인다.
          Animated.delay(i * (STEP / DOTS.length)),
          Animated.timing(value, {
            toValue: 0.25,
            duration: STEP,
            easing: motion.easing.standard,
            useNativeDriver: false,
          }),
          Animated.timing(value, {
            toValue: 1,
            duration: STEP,
            easing: motion.easing.standard,
            useNativeDriver: false,
          }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduced, values]);

  return (
    <View
      style={styles.row}
      testID={testID}
      // 옆 글자가 같은 말을 한다. 두 번 읽히면 오히려 방해가 된다.
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {values.map((value, i) => (
        <Animated.View
          key={i}
          style={[styles.dot, { opacity: reduced ? 0.45 : value }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
});
