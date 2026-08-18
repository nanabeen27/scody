import { test, expect } from './_fixtures';
import { type Page } from '@playwright/test';
import { loginHere } from './_auth';
import { answerAll, keepWrongNotes, openFirstPersonal } from './_solve';

async function loginAs(page: Page, scodyId: string) {
  await page.goto('/login');
  await loginHere(page, scodyId);
}

/** 고2 · 독서 · 과학 유형 목록까지 들어간다(학습 1개). */
async function openScienceTopic(page: Page) {
  await page.getByRole('link', { name: '학습' }).click();
  await page.getByTestId('learn-pick').click();
  await page.getByTestId('learn-grade-2').click();
  await page.getByTestId('learn-area-독서').click();
  await page.getByTestId('learn-topic-과학').click();
}

/** 고1 · 문법 · 맞춤법 유형 목록까지 들어간다(학습 2개 — 순서 바꾸기를 볼 수 있다). */
async function openSpellingTopic(page: Page) {
  await page.getByRole('link', { name: '학습' }).click();
  await page.getByTestId('learn-pick').click();
  await page.getByTestId('learn-grade-1').click();
  await page.getByTestId('learn-area-문법').click();
  await page.getByTestId('learn-topic-어문 규정 - 맞춤법').click();
}

test.describe('M8 담아 둔 학습', () => {
  test('학습을 담으면 홈에 모이고, 전체 목록으로 넘어간다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await openScienceTopic(page);

    // 담기 전에는 담은 목록이 비어 있다
    const add = page.getByRole('checkbox', { name: '담아 두기' });
    await expect(add.first()).toBeVisible();
    await add.first().click();
    // 담기면 같은 자리에서 '빼기'로 바뀐다
    await expect(page.getByRole('checkbox', { name: '담아 둔 학습에서 빼기' }).first()).toBeVisible();

    // 홈에 담아 둔 학습이 모인다(히어로가 담은 학습을 먼저 쓴다)
    await page.getByTestId('brand-home').click();
    // 히어로 라벨은 상태와 무관하게 `오늘의 학습`이다(A-128) — 출처는 태그가 말한다.
    await expect(page.getByTestId('today-primary').getByText('개인 학습')).toBeVisible();
    await page.getByTestId('home-queue-all').click();
    await expect(page).toHaveURL(/\/student\/queue/);
    await expect(page.getByTestId('student-queue')).toBeVisible();
  });

  test('담아 둔 학습을 풀면 목록에서 빠진다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await openScienceTopic(page);
    await page.getByRole('checkbox', { name: '담아 두기' }).first().click();

    await page.getByTestId('brand-home').click();
    await page.getByText('시작하기').click();
    await page.getByTestId('detail-start').click();
    await answerAll(page);
    await page.getByTestId('solve-submit').click();
    await page.getByTestId('result-done').click();

    // 담았던 학습이 빠져서 빈 상태 안내가 나온다
    await expect(page.getByTestId('home-queue-empty-start')).toBeVisible();
  });

  test('학습 상세에서 담고 뺀다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await openScienceTopic(page);
    await page.getByText('탄소 순환과 바다').first().click();

    const queueBtn = page.getByTestId('detail-queue');
    await expect(queueBtn).toBeVisible();
    await expect(queueBtn.getByText('담아 두기')).toBeVisible();
    await queueBtn.click();
    await expect(queueBtn.getByText('담아 둔 학습에서 빼기')).toBeVisible();
    await queueBtn.click();
    await expect(queueBtn.getByText('담아 두기')).toBeVisible();
  });

  test('추천 행의 담기 버튼이 행 이동을 삼키지 않는다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await openFirstPersonal(page);
    await page.getByTestId('detail-start').click();
    await answerAll(page);
    await page.getByTestId('solve-submit').click();
    await keepWrongNotes(page); // 담은 오답이 있어야 추천이 나온다

    const reco = page.locator('[data-testid^="result-reco-"]').first();
    await expect(reco).toBeVisible();
    const toggle = page.locator('[data-testid^="reco-queue-"]').first();

    // 토글을 눌러도 화면이 바뀌지 않는다
    const before = page.url();
    await toggle.click();
    await expect(page).toHaveURL(before);
    await expect(page.getByRole('checkbox', { name: '담아 둔 학습에서 빼기' })).toHaveCount(1);

    // 행을 누르면 상세로 간다
    await reco.click();
    await expect(page.getByTestId('detail-start')).toBeVisible();
  });

  test('담은 순서를 바꾸고 여러 개를 뺀다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await openSpellingTopic(page);
    // 이 유형의 학습을 모두 담는다(최소 2개)
    const add = page.getByRole('checkbox', { name: '담아 두기' });
    const count = await add.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) await add.first().click();

    // 담아 둔 학습 진입은 학습 탭에 있다. 고르기 페이지에서 한 단계 돌아온 뒤 누른다.
    await page.getByRole('link', { name: '학습' }).click();
    await page.getByTestId('learn-queue-all').click();
    await expect(page).toHaveURL(/\/student\/queue/);

    const rows = page.locator('[data-testid^="queue-item-"]');
    const total = await rows.count();
    expect(total).toBe(count);

    if (total > 1) {
      const firstTitle = await rows.first().textContent();
      // 첫 줄을 아래로 내리면 순서가 바뀐다
      await rows.first().locator('[data-testid^="queue-down-"]').click();
      await expect(rows.first()).not.toHaveText(firstTitle!);
    }

    // 여러 개 빼기
    await page.getByTestId('queue-select-mode').click();
    await rows.first().locator('[data-testid^="queue-select-"]').click();
    await page.getByTestId('queue-remove-selected').click();
    await expect(page.getByText(/담아 둔 학습에서 뺐어요/)).toBeVisible();
    await expect(rows).toHaveCount(total - 1);
  });

  test('담아 둔 학습은 첫 번째부터 바로 시작할 수 있다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await openScienceTopic(page);
    await page.getByRole('checkbox', { name: '담아 두기' }).first().click();
    await page.getByRole('link', { name: '학습' }).click();
    await page.getByTestId('learn-queue-all').click();

    // 시작하는 행동이 목록 위에 있다(가장 무거운 버튼이 빼기가 아니다)
    const start = page.getByTestId('queue-start');
    await expect(start).toBeVisible();
    const startBox = await start.boundingBox();
    const firstRow = await page.locator('[data-testid^="queue-item-"]').first().boundingBox();
    expect(startBox!.y).toBeLessThan(firstRow!.y);

    await start.click();
    await expect(page.getByText('탄소 순환과 바다').first()).toBeVisible();
    await expect(page.getByTestId('detail-start')).toBeVisible();

    // 빼기 모드에서는 시작 버튼을 두지 않고, 고른 것이 없으면 빼기 버튼도 없다
    await page.goBack();
    await page.getByTestId('queue-select-mode').click();
    await expect(page.getByTestId('queue-start')).toHaveCount(0);
    await expect(page.getByTestId('queue-remove-selected')).toHaveCount(0);
    await expect(page.getByText('뺄 학습을 골라요.')).toBeVisible();
  });

  test('담아 둔 학습에서 뺀 것을 되돌릴 수 있다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await openSpellingTopic(page);
    const add = page.getByRole('checkbox', { name: '담아 두기' });
    const count = await add.count();
    expect(count).toBeGreaterThan(1);
    for (let i = 0; i < count; i++) await add.first().click();

    await page.getByRole('link', { name: '학습' }).click();
    await page.getByTestId('learn-queue-all').click();
    const rows = page.locator('[data-testid^="queue-item-"]');
    await expect(rows).toHaveCount(count);
    const firstTitle = await rows.first().textContent();

    // 한 개 빼기 → 되돌리면 원래 자리로 돌아온다
    await rows.first().locator('[data-testid^="queue-remove-"]').click();
    await expect(rows).toHaveCount(count - 1);
    await expect(page.getByText('담아 둔 학습에서 뺐어요')).toBeVisible();
    await page.getByTestId('queue-undo').click();
    await expect(rows).toHaveCount(count);
    await expect(rows.first()).toHaveText(firstTitle!);
    await expect(page.getByText('담아 둔 학습에서 뺐어요')).toHaveCount(0);

    // 여러 개 빼기도 함께 되돌린다
    await page.getByTestId('queue-select-mode').click();
    for (let i = 0; i < count; i++) {
      await rows.nth(i).locator('[data-testid^="queue-select-"]').click();
    }
    await page.getByTestId('queue-remove-selected').click();
    await expect(rows).toHaveCount(0);
    await expect(page.getByTestId('queue-empty-start')).toBeVisible();
    // 마지막 하나까지 빼도 안내는 남는다
    await page.getByTestId('queue-undo').click();
    await expect(rows).toHaveCount(count);
    await expect(rows.first()).toHaveText(firstTitle!);
  });

  test('담은 목록 화면: 비었을 때 안내가 있고 뒤로 나가면 홈으로 온다', async ({ page }) => {
    await loginAs(page, 'seojun');

    // 학습 탭에서 담고 → 홈 → 전체 보기
    await openScienceTopic(page);
    await page.getByRole('checkbox', { name: '담아 두기' }).first().click();
    await page.getByTestId('brand-home').click();
    await page.getByTestId('home-queue-all').click();
    await expect(page.getByTestId('student-queue')).toBeVisible();

    // 하나뿐인 학습을 빼면 빈 상태 안내가 나온다
    await page.locator('[data-testid^="queue-remove-"]').first().click();
    await expect(page.getByTestId('queue-empty-start')).toBeVisible();

    // 뒤로 나가면 홈으로 돌아온다
    await page.getByTestId('screen-back').click();
    await expect(page).toHaveURL(/\/student$/);
  });

  test('세션 없이 담은 목록 URL로 들어오면 로그인으로 보낸다', async ({ page }) => {
    // 프로토타입 세션은 메모리에만 있어서 직접 URL 진입은 항상 로그인으로 가드된다
    await page.goto('/student/queue');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId('login-submit')).toBeVisible();
  });

  test('학원 과제는 담을 수 없다', async ({ page }) => {
    await loginAs(page, 'yerin'); // 개인 + 학원 이용권을 함께 가진 학생
    await page.getByRole('link', { name: '학습' }).click();

    // 학원 과제 상세에는 담기 버튼이 없다
    await page.getByText('현대소설 점검').first().click();
    await expect(page.getByTestId('detail-start')).toBeVisible();
    await expect(page.getByTestId('detail-queue')).toHaveCount(0);

    // 개인 학습 상세에는 있다
    await openScienceTopic(page);
    await page.getByText('탄소 순환과 바다').first().click();
    await expect(page.getByTestId('detail-queue')).toBeVisible();
  });

  test('학원 이용권만 있는 학생에게는 담아 둔 학습 섹션을 띄우지 않는다', async ({ page }) => {
    await loginAs(page, 'doyun'); // 개인 이용권이 없다
    await expect(page.getByTestId('student-home')).toBeVisible();
    await expect(page.getByText('담아 둔 학습')).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: '담아 두기' })).toHaveCount(0);
  });
});
