import { test, expect, type Page } from '@playwright/test';
import { loginHere } from './_auth';

const LEAK_MARKER = '정보의 홍수와 비판적 읽기';
const LEAK_QUESTION = '윗글의 중심 내용으로 가장 적절한 것은?';

async function login(page: Page, scodyId: string) {
  await page.goto('/login');
  await loginHere(page, scodyId);
}


async function logout(page: Page) {
  await page.getByRole('link', { name: '내 정보' }).click();
  await page.getByText('로그아웃').click();
  await expect(page).toHaveURL(/\/login/);
}

/** 개인 학습 하나를 끝까지 풀고 틀린 문제를 오답노트에 담는다. */
async function solveAndSaveWrongNote(page: Page) {
  await page.getByText('시작하기').click();
  await page.getByTestId('detail-start').click();
  const radios = page.getByRole('radio');
  const questions = (await radios.count()) / 4;
  for (let q = 0; q < questions; q++) await radios.nth(q * 4).click();
  await page.getByTestId('solve-submit').click();
  await expect(page).toHaveURL(/\/student\/result\//);
  await page.getByText('담기').first().click();
  await expect(page.getByText('오답노트에 담겼어요').first()).toBeVisible();
}

test.describe('세션 경계: 계정을 바꾸면 이전 계정의 기록이 남지 않는다', () => {
  test('다른 학생으로 로그인하면 이전 학생의 학습 기록이 보이지 않는다', async ({ page }) => {
    await login(page, 'seojun');
    await solveAndSaveWrongNote(page);

    await page.getByRole('link', { name: '기록' }).click();
    await expect(page.getByText(LEAK_MARKER)).toBeVisible();

    await logout(page);
    await loginHere(page, 'doyun'); // 학원 이용권만 가진 다른 학생

    await page.getByRole('link', { name: '기록' }).click();
    await expect(page.getByText(LEAK_MARKER)).toHaveCount(0);
    await expect(page.getByText(/아직 제출한 학습이 없어요/)).toBeVisible();

    // 오답노트 학습 섹션도 비어 있어야 한다(남의 오답이 넘어오지 않는다)
    await expect(page.getByText('오답노트로 공부하기')).toBeVisible();
    await expect(page.getByText('담아 둔 오답이 없어요.')).toBeVisible();
    await expect(page.getByText(LEAK_QUESTION)).toHaveCount(0);
    await expect(page.getByTestId('records-review')).toHaveCount(0);
  });

  test('학원 성과 분석에 학생의 개인 학습 오답이 노출되지 않는다', async ({ page }) => {
    await login(page, 'seojun');
    await solveAndSaveWrongNote(page);

    await logout(page);
    await loginHere(page, 'hanbit.director');

    await page.getByRole('link', { name: '성과 분석' }).click();
    await expect(page.getByText(/학생 개인 학습 상세는 표시하지 않습니다/)).toBeVisible();
    await expect(page.getByText(LEAK_QUESTION)).toHaveCount(0);
    await expect(page.getByText(LEAK_MARKER)).toHaveCount(0);
  });
});
