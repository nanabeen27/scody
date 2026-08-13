import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * 폰트가 **실제로 그려질 준비**가 됐는가.
 *
 * `useFonts`의 `loaded`만으로는 부족하다. 그 값이 참이 된 뒤에도 브라우저가 폰트를
 * 적용하기 전 한 프레임이 있고, 그 프레임이 폴백으로 그려진다 — 사용자가 본
 * "폰트가 바뀐다"의 마지막 한 조각이다.
 *
 * **반드시 `loaded === true` 뒤에만 켠다.** `@font-face`가 등록되기 전에
 * `document.fonts.ready`를 부르면 **즉시 resolve된다**(실측: 2,398ms에 `size === 0`,
 * `status === "loaded"`). 규칙이 하나도 없으면 기다릴 것도 없기 때문이다.
 * 같은 이유로 `document.fonts.check()`도 쓰지 않는다 — 매칭되는 face가 없으면
 * 명세상 `true`를 돌려준다.
 *
 * 네이티브는 폰트가 앱 번들에 있어 기다릴 것이 없다. 바로 참이다.
 */
export function useFontsReady(enabled: boolean): boolean {
  const [ready, setReady] = useState(
    () => Platform.OS !== 'web' || typeof document === 'undefined' || !('fonts' in document),
  );

  useEffect(() => {
    if (ready || !enabled) return;
    let alive = true;
    document.fonts.ready.then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [ready, enabled]);

  return ready;
}
