import { useEffect, useRef, useState } from 'react';
import { Animated, type EasingFunction } from 'react-native';
import { motion } from './motion';
import { useReduceMotion } from './useReduceMotion';

/*
  `Animated.Value`는 `useState(() => new Animated.Value(x))`로 만든다.
  `useRef`로 만들면 Fast Refresh에서 값이 다시 생겨 화면이 튄다
  (`Toast.tsx`·`Reveal.tsx`가 이미 같은 형태를 쓴다).
*/

/**
 * `key`가 바뀔 때마다 `from` → 1로 다시 페이드하는 opacity 값.
 * **자리는 그대로인데 안에 든 내용만 갈릴 때** 쓴다(문항 페이지, 안내 문구 교체).
 *
 * `from`을 0으로 두지 않는 것이 기본이다 — 완전히 사라졌다 나타나면 잠깐의 빈 화면이
 * 로딩처럼 읽힌다. 0.35쯤이면 '갈렸다'는 것만 전해진다.
 */
export function useReplayFade(
  key: unknown,
  opts?: { from?: number; duration?: number; easing?: EasingFunction },
): Animated.Value {
  const from = opts?.from ?? 0.35;
  const [value] = useState(() => new Animated.Value(1));
  const reduced = useReduceMotion();
  // 첫 그림에는 움직이지 않는다. 들어오자마자 깜빡이면 그것부터 눈에 띈다.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // 모션 줄이기: 페이드 없이 바로 보인다. 느리게 하는 것이 아니라 하지 않는 것이다.
    if (reduced) {
      value.setValue(1);
      return;
    }
    value.setValue(from);
    Animated.timing(value, {
      toValue: 1,
      duration: opts?.duration ?? motion.duration.basic,
      easing: opts?.easing ?? motion.easing.decelerate,
      useNativeDriver: false,
    }).start();
    // `value`·`from`은 렌더마다 같고, 다시 그릴 기준은 `key` 하나다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reduced]);
  return value;
}

/**
 * `target`이 바뀌면 그 값으로 따라가는 Animated 값.
 * **켜짐/꺼짐이 있는 것**에 쓴다(별표, 담기, 펼침 여부).
 *
 * 크기·색으로 옮길 때는 받는 쪽에서 `interpolate`한다 — 여기서 정하면
 * 쓰는 곳마다 다른 범위를 넣게 된다.
 */
export function useAnimatedTo(
  target: number,
  opts?: { duration?: number; easing?: EasingFunction },
): Animated.Value {
  const [value] = useState(() => new Animated.Value(target));
  const reduced = useReduceMotion();
  useEffect(() => {
    // 모션 줄이기: 목표값으로 즉시 간다. 켜짐/꺼짐 자체는 그대로 보여야 한다.
    if (reduced) {
      value.setValue(target);
      return;
    }
    Animated.timing(value, {
      toValue: target,
      duration: opts?.duration ?? motion.duration.quick,
      easing: opts?.easing ?? motion.easing.standard,
      useNativeDriver: false,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduced]);
  return value;
}
