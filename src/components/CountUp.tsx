import { useEffect, useState } from 'react';
import { Animated, type TextStyle, type StyleProp } from 'react-native';

import { AppText } from './AppText';
import { motion } from '@/theme/motion';
import { useReduceMotion } from '@/theme/useReduceMotion';

/**
 * 숫자가 0에서 목표까지 올라간다. **기록이 쌓이는 순간에만 쓴다.**
 *
 * 왜 애니메이션인가: 결과 화면에서 `오늘 38문항`은 방금 일어난 일이다. 정지한 숫자는 이미
 * 있던 값처럼 읽히고, 올라가는 숫자는 그것이 지금 늘어났다고 말한다. 그 문장이 이 시스템의
 * 목적이다(`공부는 사라지지만 기록으로 남는다`).
 *
 * **`애니메이션이 있는 숫자`를 기본으로 두지 않는다.** 홈·기록 화면의 누적 값은 정지해 있어야
 * 한다 — 화면을 열 때마다 모든 숫자가 굴러가면 어느 것이 방금 바뀐 값인지 알 수 없다.
 *
 * ## 모션 줄이기
 *
 * 목표값을 즉시 그린다. 느리게 하는 것이 아니라 **하지 않는다**(`useMotion.ts`의 규칙).
 *
 * ## 접근성
 *
 * 중간 값은 스크린리더에게 소음이다. `accessibilityLabel`로 최종 문장을 고정해 두고, 굴러가는
 * 숫자는 눈으로만 보이게 한다.
 */
export interface CountUpProps {
  value: number;
  /** 숫자를 문장으로. 단위·천 단위 구분이 여기서 붙는다. */
  format?: (n: number) => string;
  duration?: number;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

export function CountUp({ value, format = (n) => String(n), ...rest }: CountUpProps) {
  const reduced = useReduceMotion();

  /*
    **정지한 숫자와 굴러가는 숫자를 다른 컴포넌트로 가른다.**

    한 컴포넌트에 두면 `value`가 바뀔 때 효과 안에서 `setShown(0)`을 불러야 하고, 그 동기
    setState는 이 레포의 린트가 막는다(`react-hooks/set-state-in-effect` — 연쇄 렌더를 만든다).
    `key`로 다시 마운트하면 초기 상태가 0이라 되돌릴 것이 없다.
  */
  if (reduced || value <= 0) {
    return (
      <AppText {...rest} numeric>
        {format(value)}
      </AppText>
    );
  }
  return <Rolling key={value} value={value} format={format} {...rest} />;
}

function Rolling({
  value,
  format,
  duration = motion.duration.slow,
  style,
  testID,
}: CountUpProps & { format: (n: number) => string }) {
  const [shown, setShown] = useState(0);
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    /*
      리스너로 갱신한다. `Animated`가 텍스트 내용을 직접 보간하지는 못한다 — RN에 숫자 텍스트를
      잇는 장치가 없다. 갱신은 프레임마다 한 번이고 이 컴포넌트만 다시 그린다(부모는 그대로다).
    */
    const id = anim.addListener(({ value: t }) => setShown(Math.round(t * value)));
    const run = Animated.timing(anim, {
      toValue: 1,
      duration,
      easing: motion.easing.decelerate,
      useNativeDriver: false,
    });
    // 마지막 프레임이 0.999에서 끝나면 반올림이 목표에 닿지 않는다. 끝에서 값을 못박는다.
    run.start(({ finished }) => {
      if (finished) setShown(value);
    });
    return () => {
      run.stop();
      anim.removeListener(id);
    };
  }, [anim, duration, value]);

  return (
    <AppText style={style} testID={testID} numeric accessibilityLabel={format(value)}>
      {format(shown)}
    </AppText>
  );
}
