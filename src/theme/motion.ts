import { Easing } from 'react-native';

/**
 * 모션 토큰. 시간과 곡선 두 벌뿐이고, 화면에서 ms를 직접 쓰지 않는다.
 *
 * 이름은 '얼마나 걸리나'가 아니라 '무엇에 쓰나'로 짓는다 — 같은 종류의 변화가
 * 화면마다 다른 속도로 움직이면 앱이 균일하지 않게 느껴진다.
 *
 * **높이·레이아웃은 애니메이션하지 않는다.** `LayoutAnimation`은 react-native-web에서
 * 아무 일도 하지 않는다(`UIManager.configureNextLayoutAnimation`이 완료 콜백만 즉시 부른다).
 * 웹이 주 타깃이라 iOS에서만 움직이는 모션은 넣지 않고 `opacity`·`transform`만 쓴다.
 *
 * 구현은 레포에 이미 있는 방식(`Animated` + `useNativeDriver: false`)만 쓴다.
 * 새 의존성을 넣지 않는다(D-038).
 *
 * `tokens.ts`가 아니라 이 파일에 두는 이유: `tokens.ts`는 런타임 의존성이 없는 순수 값이고
 * `Easing`은 `react-native`에서 온다.
 */
export const motion = {
  duration: {
    /** 상태가 즉시 갈리는 것: 페이드 인·아웃, 눌림, 토글. */
    quick: 180,
    /** 내용이 갈리는 것: 문항 페이지 교차 페이드, 펼친 내용 나타나기, 안내 뜨기. */
    basic: 260,
    /** 처음 나타나는 큰 면: 랜딩의 섹션 등장. */
    slow: 620,
  },
  easing: {
    /** 사용자가 시작한 변화의 기본 곡선. 빠르게 떠나 부드럽게 도착한다. */
    standard: Easing.bezier(0.2, 0, 0, 1),
    /** 나타나기 전용. 끝에서 완전히 멈춘다 — 튕기지 않는다. */
    decelerate: Easing.out(Easing.cubic),
  },
  /**
   * 모션 애셋(`MotionAsset`)의 치수와 속도. **화면에서 px·배속을 직접 정하지 않는다** —
   * 같은 뜻의 표시가 화면마다 다른 크기로 뜨면 앱이 균일하지 않게 느껴진다.
   */
  asset: {
    /** 글자 옆에 인라인으로 붙는 **높이**. 본문 줄 높이를 넘지 않아야 줄이 흔들리지 않는다. */
    inline: 12,
    /** 아이콘 자리를 대신하는 크기(정사각). 토스트의 완료 체크가 여기 든다. */
    sm: 20,
    /** 블록 하나를 차지하는 크기. 지금 쓰는 곳은 없다 */
    md: 40,
    /** 원본 속도 그대로. 빠르게 돌리면 급해 보이고 느리면 멈춘 것처럼 보인다. */
    speed: 1,
  },
} as const;
