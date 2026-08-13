/**
 * 모션 애셋을 **직접 만든다.**
 *
 * 남의 애셋을 쓰지 않는 이유는 `README.md`에 있다 — 상업 서비스에 안전하다고 검증된
 * 범용 CC0 Lottie 라이브러리가 없다(LottieFiles "Free"는 share-alike + 비침해 보증 없음).
 * **우리가 만들면 저작권자가 우리라서 그 문제가 통째로 사라진다.**
 *
 * 파일이 아니라 함수인 이유: **색이 테마마다 다르다.** 강조색이 라이트 `#20808d`,
 * 다크 `#3aa7b1`이고 Lottie는 색을 파일 안에 굽는다. 정적 파일로 두면 다크에서 색이
 * 틀리거나 같은 그림을 두 벌 들고 있어야 한다. `lottie-react-native`는 `source`로
 * **객체**를 받으므로(웹은 `sourceJson`, 네이티브도 같은 경로) 그릴 때 색을 넣는다.
 *
 * 형태 규칙(`README.md`의 상한과 짝):
 *  - 순수 벡터만. 이미지 임베드·매트·마스크를 쓰지 않는다
 *  - 레이어 하나, 그룹 몇 개. 참고로 토스의 토스트 체크마크는 2 레이어 3.0 kB다
 *  - 색은 강조색 하나. 여러 색을 쓰면 팔레트 밖 색이 화면에 생긴다
 */

/** `#20808d` → `[0.125, 0.502, 0.553, 1]`. Lottie 색은 0~1 정규화 RGBA다. */
function rgba(hex: string): [number, number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
}

/** 부드럽게 들어가고 나오는 기본 곡선. `motion.easing.standard`와 같은 성격이다. */
const EASE = { i: { x: [0.2], y: [1] }, o: { x: [0.3], y: [0] } };

interface Frame {
  t: number;
  s: number[];
  i?: { x: number[]; y: number[] };
  o?: { x: number[]; y: number[] };
}

/** 마지막 키프레임에는 곡선을 넣지 않는다(Lottie 규약). */
function keys(frames: [number, number[]][]): Frame[] {
  return frames.map(([t, s], i) => (i === frames.length - 1 ? { t, s } : { t, s, ...EASE }));
}

/**
 * 답을 기다리는 동안. 점 셋이 차례로 작아졌다 돌아온다.
 *
 * 코드 대체물(`PendingDots`)은 불투명도만 바꾸는데, 여기서는 **크기까지 함께** 줄여
 * 숨 쉬듯 보인다. 글자 옆 20px 안에 들어가고 줄 높이를 넘지 않는다.
 */
export function buildPending(hex: string) {
  const color = rgba(hex);
  /*
    캔버스를 **가로로 길게** 잡는다. 정사각으로 두면 글자 옆 높이에 맞출 때 점이 눌려
    작아지고 위아래에 빈 자리가 생긴다. `MotionAsset`이 이 `w`/`h` 비율로 폭을 정한다.
  */
  const W = 42;
  const H = 14;
  const R = 5;
  const GAP = 13;
  const CYCLE = 54;
  /** 점마다 6프레임씩 늦게 출발해 물결이 된다. */
  const STAGGER = 6;

  return {
    v: '5.7.4',
    fr: 60,
    ip: 0,
    op: CYCLE,
    w: W,
    h: H,
    nm: 'pending',
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'dots',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          r: { a: 0, k: 0 },
          p: { a: 0, k: [W / 2, H / 2, 0] },
          a: { a: 0, k: [0, 0, 0] },
          s: { a: 0, k: [100, 100, 100] },
        },
        ao: 0,
        shapes: [0, 1, 2].map((i) => {
          const d = i * STAGGER;
          return {
            ty: 'gr',
            nm: `dot${i}`,
            it: [
              { ty: 'el', d: 1, p: { a: 0, k: [0, 0] }, s: { a: 0, k: [R * 2, R * 2] }, nm: 'e' },
              { ty: 'fl', c: { a: 0, k: color }, o: { a: 0, k: 100 }, r: 1, nm: 'f' },
              {
                ty: 'tr',
                p: { a: 0, k: [(i - 1) * GAP, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 1, k: keys([[d, [100, 100]], [d + 18, [62, 62]], [d + 36, [100, 100]]]) },
                r: { a: 0, k: 0 },
                o: { a: 1, k: keys([[d, [100]], [d + 18, [28]], [d + 36, [100]]]) },
              },
            ],
          };
        }),
        ip: 0,
        op: CYCLE,
        st: 0,
        bm: 0,
      },
    ],
  };
}

/**
 * 완료 체크. 선이 스스로 그려진다(trim path).
 *
 * **코드로 하기 어려운 것이라 Lottie를 쓸 값이 있는 자리다** — `react-native-svg`의
 * `strokeDashoffset`을 `Animated`로 몰아야 하고, 그 경로는 이 레포에 없다.
 * 토스도 토스트 완료 아이콘을 같은 방식으로 만든다(`check-green-spot.json`, 2 레이어 3.0 kB).
 *
 * 한 번만 그리고 멈춘다(`loop=false`). 반복하면 완료가 아니라 진행 중으로 읽힌다.
 */
export function buildCheck(hex: string) {
  const SIZE = 48;
  return {
    v: '5.7.4',
    fr: 60,
    ip: 0,
    op: 30,
    w: SIZE,
    h: SIZE,
    nm: 'check',
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'stroke',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          r: { a: 0, k: 0 },
          p: { a: 0, k: [SIZE / 2, SIZE / 2, 0] },
          a: { a: 0, k: [0, 0, 0] },
          s: { a: 0, k: [100, 100, 100] },
        },
        ao: 0,
        shapes: [
          {
            ty: 'gr',
            nm: 'g',
            it: [
              {
                ty: 'sh',
                ind: 0,
                nm: 'path',
                ks: {
                  a: 0,
                  k: {
                    i: [[0, 0], [0, 0], [0, 0]],
                    o: [[0, 0], [0, 0], [0, 0]],
                    v: [[-11, 1], [-4, 8], [11, -8]],
                    c: false,
                  },
                },
              },
              {
                ty: 'st',
                c: { a: 0, k: rgba(hex) },
                o: { a: 0, k: 100 },
                w: { a: 0, k: 4 },
                lc: 2,
                lj: 2,
                nm: 's',
              },
              // 시작은 0%, 끝이 0 → 100%로 자라면서 선이 그려진다.
              { ty: 'tm', s: { a: 0, k: 0 }, e: { a: 1, k: keys([[2, [0]], [22, [100]]]) }, o: { a: 0, k: 0 }, m: 1, nm: 't' },
              {
                ty: 'tr',
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 },
              },
            ],
          },
        ],
        ip: 0,
        op: 30,
        st: 0,
        bm: 0,
      },
    ],
  };
}
