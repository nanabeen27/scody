import { test, expect } from './_fixtures';
import { login, PHONE_BY_ID, PHONE_PENDING } from './_auth';
import { answerAll, openFirstPersonal } from './_solve';

test.describe('M6 접근성', () => {
  test('로그인 폼 요소에 접근 가능한 라벨이 있다', async ({ page }) => {
    await page.goto('/login');
    // 버튼은 역할과 이름으로 접근 가능
    await expect(page.getByRole('button', { name: '카카오로 로그인' })).toBeVisible();
    await page.getByTestId('login-phone').click();
    // 입력 필드가 접근 가능한 이름을 가진다
    await expect(page.getByRole('textbox', { name: '휴대폰 번호' })).toBeVisible();
    await page.getByTestId('login-phone-number').fill(PHONE_BY_ID.seojun);
    await page.getByTestId('login-phone-send').click();
    // 휴대폰 인증은 아직 연결되지 않았다. 안내도 접근 가능한 텍스트로 읽혀야 한다.
    await expect(page.getByText(PHONE_PENDING)).toBeVisible();
  });

  test('담기 토글 두 개가 서로 다른 이름으로 읽힌다', async ({ page }) => {
    await login(page, 'seojun');
    // 학습 담기
    await page.getByRole('link', { name: '학습' }).click();
    await page.getByTestId('learn-pick').click();
    await page.getByTestId('learn-grade-2').click();
    await page.getByTestId('learn-area-독서').click();
    await page.getByTestId('learn-topic-과학').click();
    const addQueue = page.getByRole('checkbox', { name: '담아 두기' });
    await expect(addQueue).toHaveCount(1);
    await addQueue.click();
    await expect(page.getByRole('checkbox', { name: '담아 둔 학습에서 빼기' })).toHaveCount(1);

    // 오답노트 담기 — 이름이 겹치지 않는다
    await page.getByTestId('brand-home').click();
    await page.getByText('시작하기').click();
    await page.getByTestId('detail-start').click();
    await answerAll(page);
    await page.getByTestId('solve-submit').click();
    await expect(page.getByRole('checkbox', { name: '오답노트에 담기' }).first()).toBeVisible();
    await expect(page.getByRole('checkbox', { name: '담아 두기' })).toHaveCount(0);
  });

  test('문제 보기는 라디오 역할과 이름을 가진다', async ({ page }) => {
    await login(page, 'seojun');
    await openFirstPersonal(page);
    await page.getByTestId('detail-start').click();
    const radios = page.getByRole('radio');
    expect(await radios.count()).toBeGreaterThan(0);
    await expect(radios.first()).toBeVisible();
  });
});
