import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Platform, View, type ViewStyle } from 'react-native';
import { useReduceMotion } from '@/theme/useReduceMotion';
import { motion } from '@/theme/motion';

interface Props {
  children: ReactNode;
  /** 나타나는 지연(ms). 같은 줄의 요소를 순차로 띄울 때. */
  delay?: number;
  /** 아래에서 위로 올라오는 정도(px). */
  offset?: number;
  /** 화면에 들어왔을 때 한 번 호출(카운트업 등 부수 애니메이션 트리거). */
  onVisible?: () => void;
  style?: ViewStyle | ViewStyle[];
}

/**
 * 스크롤로 화면에 들어오면 살짝 떠오르며 나타난다(토스식 부드러운 진입).
 * 웹에서는 IntersectionObserver로 감지하고, 네이티브에서는 항상 보인다.
 * 관찰 대상(바깥 View)의 ref는 react-native-web에서 실제 DOM 노드다.
 */
export function Reveal({ children, delay = 0, offset = 20, onVisible, style }: Props) {
  const isWeb = Platform.OS === 'web';
  const reduced = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(isWeb ? 0 : 1));
  const [translateY] = useState(() => new Animated.Value(isWeb ? offset : 0));
  const outerRef = useRef<View | null>(null);
  const [visible, setVisible] = useState(!isWeb);

  useEffect(() => {
    if (!isWeb) return;
    const el = outerRef.current as unknown as Element | null;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isWeb]);

  useEffect(() => {
    if (!visible) return;
    onVisible?.();
    // 모션 줄이기: 올라오지 않고 그 자리에 그대로 있다. 내용은 똑같이 보인다.
    if (reduced) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: motion.duration.slow, delay, useNativeDriver: false }),
      Animated.timing(translateY, { toValue: 0, duration: motion.duration.slow, delay, useNativeDriver: false }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduced]);

  // 레이아웃(style: flex·정렬·너비)은 바깥 View에 둔다 — 이 View가 부모(행/그리드)의
  // 실제 플렉스 자식이라서, 여기에 flex를 줘야 절반 컬럼이 제대로 늘어난다.
  // 안쪽 Animated.View는 진입 애니메이션(opacity/translateY)만 담당하고, 기본 stretch로
  // 바깥 View 폭을 그대로 채운다.
  return (
    <View ref={outerRef} style={style}>
      <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>
    </View>
  );
}
