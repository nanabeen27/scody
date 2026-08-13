import { buildCheck, buildPending } from './build';

/**
 * 모션 애셋 레지스트리 — 이름 하나가 애니메이션 하나를 가리킨다.
 *
 * 값이 파일이 아니라 **함수**인 이유는 `build.ts`에 있다: Lottie는 색을 파일 안에 굽는데
 * 우리 강조색이 테마마다 다르다(라이트 `#20808d` / 다크 `#3aa7b1`). 그릴 때 색을 넣는다.
 *
 * 화면은 파일도 색도 모르고 **이름**만 쓴다(`<MotionAsset name="pending" />`).
 * 그래야 애셋이 바뀌어도 화면 코드를 건드리지 않는다.
 *
 * 남의 애셋을 넣으려면 `README.md`의 라이선스 확인 절차를 먼저 거친다.
 * 직접 만든 것은 그 절차가 필요 없다 — 저작권자가 우리다.
 */
export type MotionName =
  /** 답·요약을 기다리는 동안. 유일한 실제 대기 구간(AI 호출)에 쓴다. */
  | 'pending'
  /** 되돌릴 수 있는 행동을 알릴 때(`Toast`). 한 번만 그려지고 멈춘다. */
  | 'check';

/** 이름 → 애니메이션을 만드는 함수. 인자는 강조색 hex다. */
export const MOTION_ASSETS: Record<MotionName, (hex: string) => object> = {
  pending: buildPending,
  check: buildCheck,
};
