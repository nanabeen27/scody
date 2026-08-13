import { type Page } from '@playwright/test';

/**
 * 풀이 화면에서 모든 문항의 첫 보기를 고른다.
 * 문항은 한 화면에 최대 5개만 나오므로 '다음'으로 페이지를 넘기며 고른다.
 * 보기 수가 문항마다 달라도 되도록 '…보기 1' 라디오만 눌러 센다.
 */
export async function answerAll(page: Page) {
  // 페이지 수 상한. 무한 루프를 막는 안전장치다(문항 100개까지).
  for (let guard = 0; guard < 20; guard++) {
    const firstChoices = page.getByRole('radio', { name: /보기 1$/ });
    const count = await firstChoices.count();
    for (let i = 0; i < count; i++) await firstChoices.nth(i).click();
    const next = page.getByTestId('solve-next');
    if ((await next.count()) === 0) return;
    await next.click();
  }
  throw new Error('문항 페이지가 20장을 넘었어요. 풀이 화면 페이지 나누기를 확인해 주세요.');
}

/** 결과 화면에서 아직 담지 않은 오답을 위에서부터 오답노트에 담는다. */
export async function keepWrongNotes(page: Page, count = 1) {
  for (let i = 0; i < count; i++) {
    await page.getByRole('checkbox', { name: '오답노트에 담기' }).first().click();
  }
}
