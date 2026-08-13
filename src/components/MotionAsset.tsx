import { useMemo, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { PendingDots } from './PendingDots';
import { LottiePlayer } from './LottiePlayer';
import { motion } from '@/theme/motion';
import { useReduceMotion } from '@/theme/useReduceMotion';
import { useTheme } from '@/theme/ThemeProvider';
import { PALETTE_DARK, PALETTE_LIGHT } from '@/theme/palette';
// `@/*`는 `src/*`만 가리킨다. 애셋 레지스트리는 `assets/` 아래라 상대 경로로 부른다.
import { MOTION_ASSETS, type MotionName } from '../../assets/motion/registry';

/**
 * 상태를 말하는 모션 한 조각.
 *
 * **화면은 애셋도 색도 몰라도 된다.** 이 컴포넌트가 아래 순서로 떨어진다:
 *
 *   1. 모션 줄이기가 켜져 있다  → 대체물(정적)
 *   2. 그 외                    → Lottie 재생
 *   3. 재생이 실패했다          → 대체물
 *
 * 대체물의 기본값은 `PendingDots`다 — 의존성 없이 `opacity`만 움직인다. 그래서 Lottie가
 * 못 뜨는 환경(WASM 차단·구형 브라우저)에서도 "기다리는 중"이라는 사실은 남는다.
 *
 * **상태는 글자가 말한다.** 이 컴포넌트는 옆 글자를 거들 뿐이라 스크린리더에서 감춘다.
 * 넣는 자리마다 `답을 쓰고 있어요` 같은 문장이 반드시 함께 있어야 한다.
 */
export function MotionAsset({
  name,
  size = motion.asset.inline,
  loop = true,
  fallback,
  testID,
}: {
  name: MotionName;
  /**
   * **높이**다. 폭은 애셋이 선언한 비율(`w`/`h`)에서 나온다 — 가로로 긴 애니메이션을
   * 정사각에 넣으면 눌려 작아진다. `motion.asset`의 값만 쓴다.
   */
  size?: number;
  loop?: boolean;
  /** 모션을 줄이거나 재생이 실패했을 때 그릴 것. 기본은 점 셋. */
  fallback?: ReactNode;
  testID?: string;
}) {
  const reduced = useReduceMotion();
  const { mode } = useTheme();
  /*
    Lottie는 색을 애니메이션 안에 굽는다. `colors.*`는 웹에서 `var(--sc-*)` 문자열이라
    쓸 수 없어 **팔레트의 원래 hex**를 꺼낸다. `system`은 OS 설정을 따라간다 —
    `ThemeProvider`가 웹에서 `data-theme`을 지우고 미디어 쿼리에 맡기는 것과 같은 기준이다.
  */
  const dark =
    mode === 'dark' ||
    (mode === 'system' &&
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  const accent = (dark ? PALETTE_DARK : PALETTE_LIGHT).accent;

  // 색이나 이름이 바뀔 때만 다시 만든다. 렌더마다 만들면 Lottie가 매번 처음부터 돈다.
  const source = useMemo(() => MOTION_ASSETS[name](accent), [name, accent]);

  const still = fallback ?? <PendingDots testID={testID} />;
  if (reduced) return still;

  return <LottiePlayer source={source} size={size} loop={loop} testID={testID} still={still} />;
}
