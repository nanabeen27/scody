import { test, expect } from '@playwright/test';
import { login, PHONE_BY_ID } from './_auth';

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
    await expect(page.getByRole('textbox', { name: '인증번호' })).toBeVisible();
  });

  test('문제 보기는 라디오 역할과 이름을 가진다', async ({ page }) => {
    await login(page, 'seojun');
    await page.getByText('시작하기').click();
    await page.getByTestId('detail-start').click();
    const radios = page.getByRole('radio');
    expect(await radios.count()).toBeGreaterThan(0);
    await expect(radios.first()).toBeVisible();
  });
});
