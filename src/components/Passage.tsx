/* eslint-disable react-hooks/refs -- PanResponder는 지연 콜백에서 ref를 쓰는 표준 패턴 */
import { useMemo, useRef, useState } from 'react';
import { View, PanResponder, StyleSheet, Pressable, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AppText } from './AppText';
import { Divider } from './Divider';
import type { Passage as PassageData } from '@/data';
import { colors, spacing, font, typeface, radius } from '@/theme/tokens';

/**
 * 독해 지문. 기사처럼 읽히게 하고, 아이패드 펜(또는 터치)으로 지문 위에 필기할 수 있다.
 * '필기' 버튼을 켜면 지문 위 오버레이가 손/펜 입력을 받아 선을 그린다.
 */
export function Passage({ passage }: { passage: PassageData }) {
  const [annotate, setAnnotate] = useState(false);
  const [strokes, setStrokes] = useState<string[]>([]);
  const [current, setCurrent] = useState<string>('');
  const [size, setSize] = useState({ w: 0, h: 0 });
  const pts = useRef<string>('');

  const responder = useMemo(
    () =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        pts.current = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setCurrent(pts.current);
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        pts.current += ` L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setCurrent(pts.current);
      },
      onPanResponderRelease: () => {
        if (pts.current) setStrokes((prev) => [...prev, pts.current]);
        pts.current = '';
        setCurrent('');
      },
    }),
    [],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <AppText variant="eyebrow" tone="tertiary">
          지문
        </AppText>
        <View style={styles.tools}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={annotate ? '읽기 모드' : '필기 모드'}
            onPress={() => setAnnotate((v) => !v)}
            style={[styles.tool, annotate && styles.toolOn]}
          >
            <AppText
              variant="caption"
              style={{ color: annotate ? colors.accentText : colors.inkSecondary }}
            >
              {annotate ? '필기 중' : '필기'}
            </AppText>
          </Pressable>
          {strokes.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="필기 지우기"
              onPress={() => setStrokes([])}
              style={styles.tool}
            >
              <AppText variant="caption" tone="secondary">
                지우기
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.canvasWrap} onLayout={onLayout}>
        {passage.title ? <AppText style={styles.title}>{passage.title}</AppText> : null}
        <AppText style={styles.body}>{passage.body}</AppText>

        {(strokes.length > 0 || current || annotate) && size.w > 0 ? (
          <View
            style={StyleSheet.absoluteFill}
            pointerEvents={annotate ? 'auto' : 'none'}
            {...(annotate ? responder.panHandlers : {})}
          >
            <Svg width={size.w} height={size.h}>
              {strokes.map((d, i) => (
                <Path
                  key={i}
                  d={d}
                  stroke={colors.accent}
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {current ? (
                <Path
                  d={current}
                  stroke={colors.accent}
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
            </Svg>
          </View>
        ) : null}
      </View>
      <Divider />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tools: { flexDirection: 'row', gap: spacing.sm },
  tool: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  toolOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  canvasWrap: { gap: spacing.md, position: 'relative' },
  title: {
    fontFamily: typeface.semibold,
    color: colors.ink,
    fontSize: font.size.lg,
    lineHeight: font.size.lg * 1.4,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: typeface.regular,
    color: colors.ink,
    fontSize: 17,
    lineHeight: 17 * 1.9,
    marginBottom: spacing.md,
  },
});
