import { useState } from 'react';
import { Platform, View } from 'react-native';
import { motion } from '@/theme/motion';
import type { ReactNode } from 'react';

/**
 * Lottie 재생부.
 *
 * 별도 파일인 이유: 여기를 부르면 `lottie-react-native`와 `@lottiefiles/dotlottie-react`가
 * 번들에 들어간다(실측 **+60 kB gzip**). `app.json`이 `web.output: "single"`이라 코드 분할이
 * 없어서 함수 안에서 `require`로 미뤄도 **번들 크기는 줄지 않는다**(실행 시점만 늦춰진다).
 * 애셋을 통째로 빼기로 하면 `MotionAsset`에서 이 import 한 줄만 지우면 된다.
 * (파일명에 `.lottie`를 쓰지 않는다 — `metro.config.js`가 그 확장자를 애셋으로 잡아 모듈 해석이 깨진다.)
 *
 * 재생이 실패하면(WASM 미배치, CSP 차단, 구형 브라우저) 대체물로 떨어진다. 빈 자리를 두면
 * "기다리는 중"이라는 사실 자체가 화면에서 사라진다.
 */
export function LottiePlayer({
  source,
  size,
  loop,
  testID,
  still,
}: {
  source: unknown;
  size: number;
  loop: boolean;
  testID?: string;
  still: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  let LottieView: React.ComponentType<Record<string, unknown>>;
  try {
    if (Platform.OS === 'web') {
      /*
        첫 재생 전에 자체 호스팅 경로를 알려 준다. 안 하면 jsDelivr에서 1.79 MB WASM을
        받아온다 — 이 레포는 D-053에서 폰트를 10.7 MB → 2.5 MB로 줄여 첫 진입을 밀어
        넣은 이력이 있어 제3자 CDN에 첫 렌더를 묶지 않는다.
      */
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- 미루어 부르는 것이 목적이다.
      const { setWasmUrl } = require('@lottiefiles/dotlottie-react');
      setWasmUrl('/dotlottie-player.wasm');
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- 위와 같은 이유.
    LottieView = require('lottie-react-native').default;
  } catch {
    // 패키지가 없거나 초기화가 깨졌다. 화면은 그대로 둔다.
    return <>{still}</>;
  }

  if (failed) return <>{still}</>;

  /* 애셋이 자기 캔버스 크기를 들고 있다. 그 비율로 폭을 정해 눌리지 않게 한다. */
  const dim = source as { w?: number; h?: number };
  const ratio = dim?.w && dim?.h ? dim.w / dim.h : 1;
  const box = { width: Math.round(size * ratio), height: size };
  return (
    <View
      style={box}
      testID={testID}
      // 옆 글자가 같은 말을 한다. 두 번 읽히면 오히려 방해가 된다.
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <LottieView
        source={source}
        autoPlay
        loop={loop}
        speed={motion.asset.speed}
        /*
          웹 구현(`index.web.tsx`)은 `style`을 무시하고 `webStyle`만 읽는다.
          하나만 주면 한쪽 플랫폼에서 크기가 잡히지 않는다.
          `progress`는 웹에서 동작하지 않으므로(소스에 경고가 박혀 있다) 쓰지 않는다.
        */
        style={box}
        webStyle={box}
        onAnimationFailure={() => setFailed(true)}
      />
    </View>
  );
}
