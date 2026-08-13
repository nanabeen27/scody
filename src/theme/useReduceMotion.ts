import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * 사용자가 '모션 줄이기'를 켜 두었는가.
 *
 * **플랫폼 분기가 필요 없다.** react-native-web(0.21.2)이 `AccessibilityInfo`를
 * `matchMedia('(prefers-reduced-motion: reduce)')`로 구현해 둔다
 * (`node_modules/react-native-web/dist/exports/AccessibilityInfo/index.js`에서 확인).
 * 네이티브는 OS 설정을 그대로 읽는다. 그래서 이 훅 하나가 웹·네이티브를 모두 덮는다.
 *
 * **`matchMedia`가 없는 환경에서는 `true`(=모션 끔)가 온다.** RNW가 그렇게 정해 두었다 —
 * 안전한 쪽으로 기울어 있으니 그대로 따른다. 다만 "왜 애니메이션이 안 보이지"의 원인이
 * 될 수 있어 적어 둔다.
 *
 * 쓰는 쪽 규칙: 애니메이션을 **느리게 만들지 말고 아예 하지 않는다.** 목표값으로 즉시
 * 가거나 정적인 대체물을 그린다. 무거운 것(모션 애셋)은 **불러오지도 않는다.**
 */
/**
 * 첫 렌더에 쓸 값. **웹에서는 동기로 읽는다.**
 *
 * `AccessibilityInfo.isReduceMotionEnabled()`는 Promise라 첫 프레임에는 값이 없다.
 * 그동안 `false`로 두면 모션을 쓰는 자리가 한 번 켜졌다 꺼지는데, **무거운 것(Lottie
 * 렌더러·WASM)은 그 한 번으로 이미 내려받아진다** — 실측으로 모션 줄이기를 켠 방문자도
 * WASM을 받고 있었다. 웹은 같은 미디어 쿼리를 동기로 읽을 수 있어 그 창을 없앤다.
 */
function initialReduced(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(initialReduced);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive) setReduced(on);
    });
    // 사용자가 보는 중에 설정을 바꿀 수 있다(웹은 OS 설정을 미디어 쿼리가 그대로 따른다).
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => {
      setReduced(on);
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
