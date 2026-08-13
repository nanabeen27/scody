import { Button } from './Button';
import { useTheme, THEME_LABEL } from '@/theme/ThemeProvider';

/**
 * 테마 전환 버튼(시스템→라이트→다크 순환).
 *
 * **앱의 버튼 모양을 그대로 쓴다.** 예전에는 테두리만 있는 알약을 여기서 따로 그렸는데,
 * `Passage`의 도구 버튼과 **바이트 단위로 같은 스타일**이 두 곳에 복사돼 있었고
 * 둘 다 다른 버튼들과 모양이 달랐다. 한 벌만 남기고 `Button`으로 맞춘다.
 */
export function ThemeToggle({ compact }: { compact?: boolean }) {
  const { mode, cycle } = useTheme();
  return (
    <Button
      testID="theme-toggle"
      variant="secondary"
      hug
      label={compact ? THEME_LABEL[mode] : `테마 · ${THEME_LABEL[mode]}`}
      accessibilityLabel={`테마 ${THEME_LABEL[mode]}, 눌러서 전환`}
      onPress={cycle}
    />
  );
}
