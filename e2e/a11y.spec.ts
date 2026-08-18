import { test, expect } from './_fixtures';
import { login } from './_auth';
import { answerAll, choices, openFirstPersonal } from './_solve';

test.describe('M6 접근성', () => {
  test('로그인 폼 요소에 접근 가능한 라벨이 있다', async ({ page }) => {
    await page.goto('/login');
    // 입력 필드가 접근 가능한 이름을 가진다(로그인은 아이디 + 비밀번호다, D-171)
    await expect(page.getByRole('textbox', { name: '스코디 아이디' })).toBeVisible();
    await expect(page.getByLabel('비밀번호')).toBeVisible();
    // 버튼은 역할과 이름으로 접근 가능
    await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '카카오로 로그인' })).toBeVisible();
    // 펼침 컨트롤은 상태까지 읽힌다
    const demo = page.getByRole('button', { name: /테스트 계정/ });
    await expect(demo).not.toHaveAttribute('aria-expanded', 'true');
    await demo.click();
    await expect(demo).toHaveAttribute('aria-expanded', 'true');
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
    // 보기만 센다 — 이름 규칙은 `_solve.ts`의 `choices`가 갖는다. 풀이 화면에는 보기 말고도
    // 라디오가 있다(`5문항씩`/`한 문항씩` 토글이 D-166에서 `radio` 역할이 됐다).
    const radios = choices(page);
    expect(await radios.count()).toBeGreaterThan(0);
    await expect(radios.first()).toBeVisible();
  });
});
