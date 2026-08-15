import { IconButton } from './IconButton';
import type { IconName } from './Icon';
import { useTheme, THEME_LABEL } from '@/theme/ThemeProvider';

const THEME_ICON: Record<'system' | 'light' | 'dark', IconName> = {
  system: 'monitor',
  light: 'sun',
  dark: 'moon',
};

/**
 * 테마 전환(시스템→라이트→다크 순환). **아이콘 하나다.**
 *
 * ## 왜 아이콘만인가, 그리고 왜 상단인가
 *
 * 테마는 **행동이 아니라 설정**이다. 그 화면에서 하려는 일(로그인·가입·서비스 이해)과 경쟁하면
 * 안 된다. 예전에는 `테마 · 라이트` 라벨을 단 `secondary` 버튼이 로그인 화면 **맨 아래 약관
 * 밑**에 있었다 — 그 화면을 끝까지 내린 사람이 마지막으로 보는 것이 테마 전환이었다.
 *
 * 지금은 **상단 바 오른쪽 끝의 아이콘 하나**다. 근거 셋:
 *
 * 1. 테마는 화면 하나가 아니라 **앱 전체**에 걸린다. 전역 설정은 본문이 아니라 화면 상단의
 *    전역 영역에 두는 것이 자리에 맞다.
 * 2. 아이콘만 두면 본문의 위계를 건드리지 않는다 — 소개 페이지의 주인공은 히어로 CTA이고
 *    로그인 화면의 주인공은 로그인 버튼이다(§8: 화면당 주요 행동 하나).
 * 3. 지금 상태가 아이콘 모양으로 보인다(해·달·모니터). 라벨이 있어야 알 수 있는 값이 아니다.
 *    이름은 `accessibilityLabel`이 지킨다.
 *
 * 로그인한 뒤에는 `내 정보 → AccountSettings`의 테마 줄이 정석 자리다. 이 컴포넌트는 계정이
 * 없어 설정 화면이 없는 **로그인 전 화면**(소개·로그인·가입)을 위한 것이다.
 */
export function ThemeToggle() {
  const { mode, cycle } = useTheme();
  return (
    <IconButton
      testID="theme-toggle"
      name={THEME_ICON[mode]}
      size={18}
      inset
      label={`테마 ${THEME_LABEL[mode]}, 눌러서 전환`}
      onPress={cycle}
    />
  );
}
