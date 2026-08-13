import { expect, type Page } from '@playwright/test';

/**
 * 토스트가 비기를 기다린다.
 *
 * 토스트는 한 자리에 하나씩 뜨고 약 2.4초 뒤 사라진다. **되돌리기가 붙은 알림은 6초**다(D-091) —
 * 기본 타임아웃 8초는 그것까지 덮는다. 앞 행동의 토스트가 남아 있는 동안
 * 다음을 단정하면 그 문구를 읽어 엉뚱하게 실패한다. 더 나쁜 경우도 있다 — 오답노트의 `busy`가
 * 전역 단일 값이라(A-034) AI 작업이 끝나기 전에 누른 클릭은 **가드에 막혀 아무 일도 일어나지
 * 않고**, 그래서 기다리던 토스트가 영원히 오지 않는다.
 *
 * 그래서 AI를 쓰는 화면에서는 다음 행동 **전에** 이 함수로 조용해질 때까지 기다린다.
 */
export async function waitForQuietToast(page: Page, timeout = 8000) {
  await expect(page.getByTestId('toast')).toHaveCount(0, { timeout });
}

/** 앞 토스트가 비기를 기다린 뒤 `action`을 실행하고, 그 결과 토스트를 단정한다. */
export async function actThenToast(page: Page, action: () => Promise<void>, text: string) {
  await waitForQuietToast(page);
  await action();
  await expect(page.getByTestId('toast')).toHaveText(text);
}
