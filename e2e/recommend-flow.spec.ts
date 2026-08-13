import { test, expect } from './_fixtures';
import { type Page } from '@playwright/test';
import { login } from './_auth';
import { answerAll, keepWrongNotes } from './_solve';

/** 개인 학습 하나를 일부러 틀리게 풀고 제출한다(모두 1번 보기 선택). */
async function solveWithMistakes(page: Page) {
  await page.getByText('시작하기').click();
  await page.getByTestId('detail-start').click();
  await answerAll(page);
  await page.getByTestId('solve-submit').click();
  await expect(page).toHaveURL(/\/student\/result\//);
}

test.describe('M7 문항 추천', () => {
  test('오답을 담으면 결과 화면에서 같은 유형 학습을 추천한다', async ({ page }) => {
    await login(page, 'seojun');
    await solveWithMistakes(page);

    // 담기 전에는 추천 근거가 없다
    await expect(page.getByText('비슷한 유형으로 이어서 풀어요')).toHaveCount(0);

    await keepWrongNotes(page);
    await expect(page.getByText('비슷한 유형으로 이어서 풀어요')).toBeVisible();
    // 추천 이유를 문장으로 보여준다
    await expect(page.getByText(/문항 틀렸어요/).first()).toBeVisible();
  });

  test('추천 학습을 누르면 그 학습 상세로 간다', async ({ page }) => {
    await login(page, 'seojun');
    await solveWithMistakes(page);
    const resultUrl = page.url();
    await keepWrongNotes(page);

    const reco = page.locator('[data-testid^="result-reco-"]').first();
    await expect(reco).toBeVisible();
    await reco.click();
    await expect(page).not.toHaveURL(resultUrl);
    await expect(page).toHaveURL(/\/student\//);
    await expect(page.getByTestId('detail-start')).toBeVisible();
  });

  test('오답노트 화면에서도 같은 유형을 추천한다', async ({ page }) => {
    await login(page, 'seojun');
    await solveWithMistakes(page);
    await keepWrongNotes(page);
    await page.getByTestId('result-notebook').click();

    await expect(page.getByText('이 유형 더 풀어볼까요?')).toBeVisible();
    await expect(page.getByText(/문항 틀렸어요/).first()).toBeVisible();
  });

  test('오답이 없으면 추천하지 않는다', async ({ page }) => {
    await login(page, 'seojun');
    await page.getByRole('link', { name: '기록' }).click();
    await expect(page.getByText('이 유형 더 풀어볼까요?')).toHaveCount(0);
  });
});
