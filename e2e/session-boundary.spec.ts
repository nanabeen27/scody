import { test, expect } from './_fixtures';
import { type Page } from '@playwright/test';
import { loginHere } from './_auth';
import { answerAll, keepWrongNotes, openFirstPersonal } from './_solve';

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
  await openFirstPersonal(page);
  await page.getByTestId('detail-start').click();
  await answerAll(page);
  await page.getByTestId('solve-submit').click();
  await expect(page).toHaveURL(/\/student\/result\//);
  await keepWrongNotes(page);
  // 담기면 토글이 '빼기'로 바뀐다
  await expect(page.getByRole('checkbox', { name: '오답노트에서 빼기' }).first()).toBeVisible();
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

    /*
      오답노트는 **학습 탭**에 있다(D-130). 담아 둔 오답이 없으면 섹션 자체를 그리지 않으므로,
      남의 오답이 넘어오지 않았다는 것은 **섹션도 문항도 없는 것**으로 확인한다.
    */
    await page.getByRole('link', { name: '학습' }).click();
    await expect(page.getByText('오답노트', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('learn-review')).toHaveCount(0);
    await expect(page.getByText(LEAK_QUESTION)).toHaveCount(0);
  });

  test('담아 둔 학습도 계정을 넘어가지 않는다', async ({ page }) => {
    await login(page, 'seojun');
    // 개인 학습 하나를 담는다
    await page.getByRole('link', { name: '학습' }).click();
    await page.getByTestId('learn-pick').click();
    await page.getByTestId('learn-grade-2').click();
    await page.getByTestId('learn-area-독서').click();
    await page.getByTestId('learn-topic-과학').click();
    await page.getByRole('checkbox', { name: '담아 두기' }).first().click();
    await page.getByTestId('brand-home').click();
    await expect(page.getByTestId('home-queue-all')).toBeVisible();

    // 개인 이용권이 있는 다른 학생으로 바꾸면 담은 목록이 비어 있다
    await logout(page);
    await loginHere(page, 'haeun');
    await expect(page.getByTestId('student-home')).toBeVisible();
    await expect(page.getByTestId('home-queue-all')).toHaveCount(0);
    await expect(page.getByTestId('home-queue-empty-start')).toBeVisible();
    await expect(page.getByText('탄소 순환과 바다')).toHaveCount(0);
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
