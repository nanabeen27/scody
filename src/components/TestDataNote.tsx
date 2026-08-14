import { AppText } from './AppText';

/**
 * 학원 화면의 테스트 데이터 고지. **문장은 한곳에만 있다.**
 *
 * 예전에는 같은 함수가 `app/academy/index.tsx`와 `analytics.tsx`에 글자 단위로 복사돼 있었다.
 * 이 문장은 fixture를 실제 재원생 기록으로 오해하지 않게 하는 장치이므로(`CLAUDE.md` 데이터 절)
 * 두 화면이 다른 말을 하게 될 자리를 두지 않는다.
 */
export function TestDataNote() {
  return (
    <AppText variant="caption" tone="tertiary">
      개발·테스트 계정 기준입니다. 실제 재원생 기록이 아니에요. 값은 실제 제출 기록에서 계산해요.
    </AppText>
  );
}
