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
 * 봉투 마크. **카카오 심볼과 무게를 맞추려고 채운 실루엣이다.**
 *
 * `DESIGN.md` §15가 정해 둔 규칙이다: 카카오 공식 심볼이 채워진 도형이라 그 옆에 서는 마크도
 * 채운 실루엣이어야 한다 — 얇은 선 아이콘 하나만 남으면 같은 크기인데 한쪽만 비어 보인다.
 * 그래서 Feather의 `mail`(선 아이콘)을 `IconName`에 더하는 쪽을 버렸다.
 *
 * 뚜껑의 V는 `fillRule="evenodd"`로 **뚫는다**(`PhoneMark`와 같은 관용구). 배경색을 칠해 덮으면
 * 버튼 색이 바뀔 때마다 따라 고쳐야 하는데, 구멍은 어느 배경 위에서도 맞다.
 *
 * **`PhoneMark`를 잇는다.** 그 마크는 `휴대폰 번호로 가입하기` 버튼 하나를 위한 자산이었고,
 * D-184가 그 버튼을 `이메일로 가입하기`로 바꾸면서 호출부가 0이 됐다. 번호 인증이 붙는 날
 * (A-020·A-021) 같은 관용구로 다시 만들면 된다.
 */
export function MailMark({ size = 18, color }: { size?: number; color: string }) {
  const w = size;
  const h = Math.round((size * 13) / 18);
  /*
    뚜껑은 몸통 안쪽에 겹치는 얇은 V다. 두께를 1.5로 둬서 18px에서도 선이 사라지지 않는다 —
    더 얇게 하면 안티에일리어싱에 먹혀 채운 사각형으로만 보인다(실측).
  */
  const flap = 'M1.9,3.1 L9,8.2 L16.1,3.1 L16.1,4.9 L9,10 L1.9,4.9 Z';
  const d = [roundedRect(0, 0, 18, 13, 2.2), flap].join(' ');
  return (
    <Svg width={w} height={h} viewBox="0 0 18 13">
      <Path d={d} fill={color} fillRule="evenodd" />
    </Svg>
  );
}
