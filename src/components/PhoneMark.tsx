import Svg, { Path } from 'react-native-svg';

/** 둥근 사각형 path. `evenodd`로 겹치면 안쪽이 구멍이 된다. */
function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  return [
    `M${x + r},${y}`,
    `H${x + w - r}`,
    `A${r},${r} 0 0 1 ${x + w},${y + r}`,
    `V${y + h - r}`,
    `A${r},${r} 0 0 1 ${x + w - r},${y + h}`,
    `H${x + r}`,
    `A${r},${r} 0 0 1 ${x},${y + h - r}`,
    `V${y + r}`,
    `A${r},${r} 0 0 1 ${x + r},${y}`,
    'Z',
  ].join(' ');
}

/**
 * 휴대폰 마크. **카카오 심볼과 무게를 맞추려고 채운 실루엣이다.**
 *
 * 예전에는 Feather의 `smartphone`(얇은 선)이었는데, 옆 카카오 버튼이 채워진 공식 심볼로 바뀌자
 * 두 버튼의 아이콘 무게가 눈에 띄게 어긋났다 — 같은 크기인데 한쪽만 비어 보였다.
 *
 * 화면과 스피커는 `fillRule="evenodd"`로 **뚫는다**. 배경색을 칠해 덮으면 버튼 색이 바뀔 때마다
 * 따라 고쳐야 하는데, 구멍은 어느 배경 위에서도 맞다.
 *
 * 말풍선을 쓰지 않는 이유: 바로 옆이 카카오 말풍선이라 둘이 같은 부류로 읽힌다 —
 * 이 버튼이 말하는 것은 **번호**다.
 */
export function PhoneMark({ size = 18, color }: { size?: number; color: string }) {
  const h = size;
  const w = Math.round((size * 12) / 18);
  const d = [
    roundedRect(0, 0, 12, 18, 2.6), // 기기
    roundedRect(1.5, 3.2, 9, 11.2, 0.9), // 화면(구멍)
    roundedRect(4.4, 1.5, 3.2, 0.9, 0.45), // 스피커(구멍)
  ].join(' ');
  return (
    <Svg width={w} height={h} viewBox="0 0 12 18">
      <Path d={d} fill={color} fillRule="evenodd" />
    </Svg>
  );
}
