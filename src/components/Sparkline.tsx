import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { View } from 'react-native';
import { colors } from '@/theme/tokens';

/**
 * 아주 작은 추이선(sparkline).
 *
 * 축·격자·라벨·점을 두지 않는다 — 글자 한 개 크기의 그림이라 **모양만** 보여 주고,
 * 정확한 값은 옆의 숫자 열이 말한다. 장식 잉크를 늘리지 않는 것이 목적이다.
 *
 * 새 의존성을 쓰지 않는다: `react-native-svg`는 이미 레포에 있고
 * `src/features/landing/WebLanding.tsx`가 같은 `Polyline`으로 추이선을 그린다.
 *
 * **선은 텍스트가 아니다.** `label`을 반드시 받아 스크린리더가 읽을 문장을 만든다.
 */
export function Sparkline({
  values,
  label,
  width = 72,
  height = 20,
  baseline,
  testID,
}: {
  values: readonly number[];
  /** 스크린리더용 요약. 예: `12주 추이, 가장 낮은 1,204 가장 높은 2,573`. */
  label: string;
  width?: number;
  height?: number;
  /** 옅은 수평 기준선. 목표선이나 1.0 같은 경계에 쓴다. */
  baseline?: number;
  testID?: string;
}) {
  // 점이 두 개 미만이면 선이 되지 않는다. 자리만 비워 두고 아무것도 그리지 않는다.
  if (values.length < 2) {
    return <View style={{ width, height }} testID={testID} accessibilityLabel={label} />;
  }

  const min = Math.min(...values, baseline ?? Infinity);
  const max = Math.max(...values, baseline ?? -Infinity);
  // 값이 모두 같으면 가운데 수평선으로 그린다(0으로 나누지 않게).
  const span = max - min || 1;
  const pad = 1.5; // 선 굵기 때문에 위아래가 잘리지 않게 남기는 여백
  const x = (i: number) => (i / (values.length - 1)) * width;
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);

  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const lastX = x(values.length - 1);
  const lastY = y(values[values.length - 1]);

  return (
    <View
      style={{ width, height }}
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <Svg width={width} height={height}>
        {baseline != null ? (
          <Line
            x1={0}
            y1={y(baseline)}
            x2={width}
            y2={y(baseline)}
            stroke={colors.border}
            strokeWidth={1}
          />
        ) : null}
        <Polyline
          points={points}
          fill="none"
          stroke={colors.accent}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* 마지막 점만 찍는다 — 지금 값이 어디인지 눈이 먼저 찾게. */}
        <Circle cx={lastX} cy={lastY} r={2} fill={colors.accent} />
      </Svg>
    </View>
  );
}

/**
 * 스크린리더 문장을 만든다. 화면마다 다르게 쓰지 않도록 한곳에 둔다.
 *
 * **마지막 점을 `지금`이라고 부르지 않는다.** 추이는 끝난 주까지만 그리므로(`lastCompleteWeek`)
 * 마지막 점은 지난주 값이다 — 보는 사람은 화면 위 지표에서 지금 값을 읽는데 스크린리더만
 * 지난주 값을 `지금`으로 들었다.
 *
 * `step`은 **점 하나가 무엇인지**다. 기본은 주간 추이지만 학생 상세의 정답률 추이는
 * 낸 순서(회차)라, 못박아 두면 `16번`을 `16주`라고 읽는다.
 */
export function sparkLabel(
  name: string,
  values: readonly number[],
  unit = '',
  step = '주',
): string {
  if (values.length === 0) return `${name} 추이 없음`;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const last = values[values.length - 1];
  return `${name} 최근 ${values.length}${step} 추이, 가장 낮은 ${min.toLocaleString('en-US')}${unit}, 가장 높은 ${max.toLocaleString('en-US')}${unit}, 마지막 ${last.toLocaleString('en-US')}${unit}`;
}
