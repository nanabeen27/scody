import { test, expect } from './_fixtures';

test.describe('테마', () => {
  test('테마 토글이 라이트/다크를 전환한다', async ({ page }) => {
    await page.goto('/login');
    const root = page.locator('html');
    // 기본은 라이트. 토글은 라이트 → 다크 → 시스템 순서로 돈다.
    await expect(root).toHaveAttribute('data-theme', 'light');
    await page.getByTestId('theme-toggle').click();
    await expect(root).toHaveAttribute('data-theme', 'dark');
    // 다크에서 배경색이 어두운지 확인
    const bg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--sc-bg').trim(),
    );
    expect(bg).toBe('#091717');
  });
});
