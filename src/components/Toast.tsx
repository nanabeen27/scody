import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { MotionAsset } from './MotionAsset';
import { motion } from '@/theme/motion';
import { useReduceMotion } from '@/theme/useReduceMotion';
import { colors, radius, spacing, touch, typeface } from '@/theme/tokens';

/** 스스로 사라지기까지의 시간. 읽고 인지할 만큼 두되 길게 붙어 있지 않게. */
const SHOW_MS = 2400;
/**
 * 되돌리기 같은 행동이 붙었을 때. 문장을 읽고 판단해 손가락을 옮길 시간이 필요하다.
 * **8초를 넘기면 안 된다** — `e2e/_toast.ts`의 `waitForQuietToast` 기본 타임아웃이 8초다.
 */
const SHOW_ACTION_MS = 6000;

/** 무엇이 일어났는지. 아이콘만 달라지고 문장이 뜻을 다 말한다. */
export type ToastKind = 'added' | 'removed';

/** 알림에 붙는 행동 하나. 짧은 동사로 쓴다(`되돌리기`). */
export interface ToastAction {
  label: string;
  onPress: () => void;
}

interface Props {
  /** 보여줄 문장. `null`이면 렌더하지 않는다. 같은 문장을 다시 띄우려면 `key`를 바꾼다. */
  message: string | null;
  kind?: ToastKind;
  /** 누를 수 있는 행동. 주면 알림이 눌리게 되고 더 오래 머문다. */
  action?: ToastAction | null;
  /** 스스로 사라질 때 호출. 부모가 상태를 비운다. */
  onHide: () => void;
  testID?: string;
}

/**
 * 화면 아래에서 잠깐 올라왔다 사라지는 알림.
 *
 * 되돌릴 수 있는 행동을 알리는 데 쓴다 — 확인 단계를 두지 않고 한 줄로 알리기만 한다.
 * **`action`을 주면 되돌리기까지 이 안에서 한다**(D-091). 그때만 누름을 받고,
 * 그러지 않으면 알림은 화면을 가로막지 않는다.
 *
 * 애니메이션은 레포에 이미 있는 방식(`Animated` + `useNativeDriver: false`)을 그대로 쓴다.
 * 새 의존성을 넣지 않는다.
 */
export function Toast({ message, kind = 'added', action, onHide, testID }: Props) {
  const insets = useSafeAreaInsets();
  const reduced = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(12));
  // onHide가 매 렌더 새 함수여도 타이머를 다시 걸지 않게 최신 값만 들고 있는다.
  const hideRef = useRef(onHide);
  useEffect(() => {
    hideRef.current = onHide;
  }, [onHide]);

  useEffect(() => {
    if (!message) return;
    /*
      모션 줄이기: 뜨고 지는 것을 움직이지 않는다. 알림 자체는 그대로 뜬다 —
      사라지는 시점도 같다. 미끄러짐만 뺀다.
    */
    if (reduced) {
      opacity.setValue(1);
      translateY.setValue(0);
      const timer = setTimeout(() => hideRef.current(), action ? SHOW_ACTION_MS : SHOW_MS);
      return () => clearTimeout(timer);
    }
    opacity.setValue(0);
    translateY.setValue(12);
    /** 뜨고 지는 동작이 같아서 목표값만 받는다. 두 벌로 두면 한쪽만 고쳐진다. */
    const slide = (to: number, y: number) =>
      Animated.parallel(
        [
          [opacity, to],
          [translateY, y],
        ].map(([value, toValue]) =>
          Animated.timing(value as Animated.Value, {
            toValue: toValue as number,
            duration: motion.duration.quick,
            useNativeDriver: false,
          }),
        ),
      );

    slide(1, 0).start();

    const timer = setTimeout(
      () => slide(0, 12).start(() => hideRef.current()),
      action ? SHOW_ACTION_MS : SHOW_MS,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, reduced]);

  if (!message) return null;

  /*
    아이콘은 문장의 형제로 둔다. testID가 붙은 요소 안에 넣으면 Feather 글리프가
    그 요소의 텍스트에 섞여 문구를 그대로 확인하는 테스트가 깨진다.
    장식이므로 이름을 주지 않는다 — 뜻은 문장이 다 말한다.
  */
  const body = (
    <>
      {kind === 'removed' ? (
        <Icon name="minus-circle" size={18} color={colors.accent} />
      ) : (
        /*
          완료는 선이 스스로 그려지는 체크로 말한다(`loop=false` — 반복하면 완료가 아니라
          진행 중으로 읽힌다). 토스도 토스트 완료 아이콘을 같은 방식으로 만든다.
          빼기(`removed`)는 완료가 아니라 상태 되돌림이라 정적 글리프 그대로 둔다.
          모션을 줄이면 `MotionAsset`이 정적 체크로 떨어진다.
        */
        <MotionAsset
          name="check"
          loop={false}
          size={motion.asset.sm}
          fallback={<Icon name="check-circle" size={18} color={colors.accent} />}
        />
      )}
      <AppText testID={testID} variant="label" style={styles.text} aria-hidden>
        {message}
      </AppText>
    </>
  );

  return (
    /*
      기본은 누름을 막지 않는다 — 알림이 떠 있는 동안에도 아래 화면을 계속 쓸 수 있어야 한다.
      행동이 있을 때만 `box-none`으로 바꿔 **그 버튼 하나만** 누름을 받는다.
      문구 쪽은 다시 `none`으로 막는다. 알약 전체가 눌리면 390 화면에서 6초 동안
      아래 화면을 덮는다.
      아래 여백도 함께 키운다 — 태블릿의 떠 있는 탭 알약과 사이가 7px뿐이다.
    */
    <View
      pointerEvents={action ? 'box-none' : 'none'}
      style={[
        styles.wrap,
        { paddingBottom: insets.bottom + spacing.huge + (action ? spacing.xxl : 0) },
      ]}
    >
      <Animated.View
        pointerEvents={action ? 'box-none' : undefined}
        style={[styles.toast, { opacity, transform: [{ translateY }] }]}
      >
        {action ? (
          <View pointerEvents="none" style={styles.body}>
            {body}
          </View>
        ) : (
          body
        )}
        {action ? (
          /*
            `Button`을 쓰지 않는다 — 알림 배경이 `ink`인데 `Button`의 ghost 라벨색도 `ink`라
            글자가 보이지 않는다. 오른쪽 음수 마진은 44px 누름 영역이 알약을 넓히지 않게 한다.
          */
          <Pressable
            testID={testID ? `${testID}-action` : undefined}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
          >
            <AppText variant="label" style={styles.actionText}>
              {action.label}
            </AppText>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  // 떠 있는 요소라 그림자를 아주 옅게 하나만 둔다(DESIGN.md 7절 예외).
  // 배경은 진하게 두고 강조색은 아이콘에만 쓴다 — 배경을 강조색으로 바꾸면
  // 다크에서 글자색이 뒤집히고(accentText가 거의 검정) 대비가 크게 떨어진다.
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: 420,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    // 다크에서는 검정 그림자가 보이지 않는다. 탭바처럼 얇은 테두리로 경계를 남긴다.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  text: { color: colors.bg, textAlign: 'center' },
  // 행동이 있을 때만 쓰는 묶음. 알약의 flex 배치를 그대로 이어받는다.
  body: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  /*
    **글자 색을 강조색으로 두지 않는다.** 알림 배경이 `ink`라 `accent` 글자는 라이트 3.9:1 ·
    다크 2.9:1로 양쪽 다 AA 미달이었다(15px semibold는 large text가 아니다).
    문구와 같은 대비 쌍(`bg` on `ink`)을 쓰되, 면을 채워 버튼임을 분명히 한다.
  */
  action: {
    minHeight: touch.min,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginLeft: spacing.xs,
    marginRight: -spacing.xs,
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
  },
  actionText: { color: colors.ink, fontFamily: typeface.semibold },
});
