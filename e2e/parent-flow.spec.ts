import { test, expect, type Page } from '@playwright/test';
import { loginHere } from './_auth';

async function loginParent(page: Page) {
  await page.goto('/login');
  await loginHere(page, 'minji');
  await expect(page).toHaveURL(/\/parent/);
}

test.describe('M3 학부모 흐름', () => {
  test('종합 리포트에 정답률·취약 영역이 나오고 상세 리포트로 들어간다', async ({ page }) => {
    await page.goto('/login');
    await loginHere(page, 'yerin');
    await page.getByText('시작하기').click();
    await page.getByTestId('detail-start').click();
    const radios = page.getByRole('radio');
    const questions = (await radios.count()) / 4;
    for (let q = 0; q < questions; q++) await radios.nth(q * 4).click();
    await page.getByTestId('solve-submit').click();
    await expect(page).toHaveURL(/\/student\/result\//);

    await page.getByRole('link', { name: '내 정보' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'minji');
    await page.getByText('정예린').click();

    // 종합 리포트: 지표 + 영역별 정답률 + 취약 영역 안내
    await expect(page.getByText('종합 리포트')).toBeVisible();
    await expect(page.getByText('평균 정답률')).toBeVisible();
    await expect(page.getByText('총 학습 시간')).toBeVisible();
    await expect(page.getByText('영역별 정답률')).toBeVisible();
    await expect(page.getByText(/영역이 \d+%로 가장 약해요|고르게 하고 있어요/)).toBeVisible();

    // 상세 리포트: 문항별 내역
    await expect(page.getByText('학습별 상세 리포트')).toBeVisible();
    await page
      .getByText(/정답률 \d+% · 오답 \d+개/)
      .first()
      .click();
    await expect(page).toHaveURL(/\/parent\/attempt/);
    await expect(page.getByText('문항별 전체 내역')).toBeVisible();
    await expect(page.getByText('걸린 시간')).toBeVisible();
    await expect(page.getByText(/자녀 답:/).first()).toBeVisible();

    // 상세에서 바로 다시 풀기를 요청할 수 있다
    await page.getByTestId('attempt-retry').click();
    await expect(page.getByText(/다시 풀기를 요청했어요/)).toBeVisible();

    // 뒤로 나가면 종합 리포트로 돌아온다
    await page.getByTestId('screen-back').click();
    await expect(page.getByText('종합 리포트')).toBeVisible();
  });

  test('다시 풀게 해도 자녀의 기존 학습 기록은 지워지지 않는다', async ({ page }) => {
    await page.goto('/login');
    await loginHere(page, 'yerin');
    // 학원 과제를 제출한다
    await page.getByRole('link', { name: '학습' }).click();
    await page.getByText('현대소설 점검').click();
    await page.getByTestId('detail-start').click();
    const radios = page.getByRole('radio');
    const questions = (await radios.count()) / 4;
    for (let q = 0; q < questions; q++) await radios.nth(q * 4).click();
    await page.getByTestId('solve-submit').click();
    await expect(page).toHaveURL(/\/student\/result\//);

    await page.getByRole('link', { name: '내 정보' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'minji');

    await page.getByText('정예린').click();
    await expect(page.getByText('다시 풀게 하기')).toBeVisible();
    await page.getByTestId('retry-a_kor1_1').click();
    await expect(page.getByText('요청했어요').first()).toBeVisible();

    // 자녀 기록은 그대로 남아 있어야 한다
    await page.getByRole('link', { name: '내 정보' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'yerin');
    await page.getByRole('link', { name: '기록' }).click();
    await expect(page.getByText('현대소설 점검')).toBeVisible();
  });

  test('연결된 자녀의 오답노트는 학부모가 볼 수 있다', async ({ page }) => {
    // 정예린(자녀)이 오답을 담고, 학부모 최민지가 그 오답을 리포트에서 본다
    await page.goto('/login');
    await loginHere(page, 'yerin');
    await page.getByText('시작하기').click();
    await page.getByTestId('detail-start').click();
    const radios = page.getByRole('radio');
    const questions = (await radios.count()) / 4;
    for (let q = 0; q < questions; q++) await radios.nth(q * 4).click();
    await page.getByTestId('solve-submit').click();
    await page.getByText('담기').first().click();

    await page.getByRole('link', { name: '내 정보' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'minji');

    await page.getByText('정예린').click();
    await expect(page).toHaveURL(/\/parent\/child\//);
    await expect(page.getByText('담긴 오답이 아직 없어요.')).toHaveCount(0);
  });


  test('홈에서 자녀 목록을 보고 자녀 리포트를 연다', async ({ page }) => {
    await loginParent(page);
    await expect(page.getByText('최민지 님')).toBeVisible();
    await expect(page.getByText('이하은')).toBeVisible();
    await expect(page.getByText('정예린')).toBeVisible();

    await page.getByText('정예린').click();
    await expect(page).toHaveURL(/\/parent\/child\//);
    await expect(page.getByText('정예린 님')).toBeVisible();
    // 학부모는 종합 지표와 학습별 상세 진입점을 본다
    await expect(page.getByText('종합 리포트')).toBeVisible();
    await expect(page.getByText('평균 정답률')).toBeVisible();
    await expect(page.getByText('학습별 상세 리포트')).toBeVisible();
    // 시드에서 두 과제를 모두 제출한 자녀라 정답률이 집계돼 보인다
    await expect(page.getByText('영역별 정답률')).toBeVisible();
    await expect(page.getByText(/정답률 \d+%/).first()).toBeVisible();
  });

  test('리포트 탭에서 자녀를 전환한다', async ({ page }) => {
    await loginParent(page);
    await page.getByRole('link', { name: '리포트' }).click();
    await expect(page).toHaveURL(/\/parent\/report/);
    await page.getByRole('tab', { name: '정예린' }).click();
    await expect(page.getByText('종합 리포트')).toBeVisible();
    await expect(page.getByText('학습별 상세 리포트')).toBeVisible();
  });

  test('자녀가 정리한 오답노트 메모와 별표를 학부모가 본다', async ({ page }) => {
    await page.goto('/login');
    await loginHere(page, 'yerin');
    await page.getByText('시작하기').click();
    await page.getByTestId('detail-start').click();
    const radios = page.getByRole('radio');
    const questions = (await radios.count()) / 4;
    for (let q = 0; q < questions; q++) await radios.nth(q * 4).click();
    await page.getByTestId('solve-submit').click();
    await page.getByText('담기').first().click();

    // 오답노트에서 별표를 달고 메모를 정리한다
    await page.getByTestId('result-notebook').click();
    await page.getByRole('button', { name: '별표 달기' }).first().click();
    const ask = page.locator('[data-testid^="ask-ct_"]').first();
    await ask.fill('왜 이게 정답인가요?');
    await page.locator('[data-testid^="send-ct_"]').first().click();
    await page.locator('[data-testid^="summ-ct_"]').first().click();
    await expect(page.getByText('노트에 추가됐어요')).toBeVisible();

    await page.getByRole('link', { name: '내 정보' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'minji');
    await page.getByText('정예린').click();

    await expect(page.getByText(/자녀의 오답노트 \d+개/)).toBeVisible();
    await expect(page.getByText(/별표 1개 · 메모 정리 1개/)).toBeVisible();
    await expect(page.getByText('자녀가 정리한 메모')).toBeVisible();
  });
});
