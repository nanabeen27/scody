import { test, expect, type Page } from '@playwright/test';
import { loginHere } from './_auth';

async function login(page: Page, scodyId: string) {
  await page.goto('/login');
  await loginHere(page, scodyId);
}

async function createGrammarSet(page: Page, title: string) {
  await page.getByTestId('admin-new').click();
  await expect(page).toHaveURL(/\/admin\/new/);
  await page.getByTestId('new-kind-grammar').click();
  await page.getByTestId('new-grade-2').click();
  await page.getByTestId('new-topic-어문 규정 - 맞춤법').click();
  await page.getByTestId('new-title').fill(title);
  await page.getByTestId('new-q0-prompt').fill('다음 중 맞춤법이 바른 것은?');
  await page.getByTestId('new-q0-c0').fill('오랫만에');
  await page.getByTestId('new-q0-c1').fill('오랜만에');
  await page.getByTestId('new-q0-c2').fill('오랫동안에');
  await page.getByTestId('new-q0-c3').fill('오랜동안');
  await page.getByTestId('new-q0-answer-1').click(); // 정답 = 오랜만에
  await page.getByTestId('new-q0-exp').fill('"오랜만에"가 바른 표기예요.');
  await page.getByTestId('new-save').click();
  await page.getByTestId('composer-done').click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe('총괄관리자 운영 화면', () => {
  test('메뉴에서 학원·계정·요금제·콘텐츠·운영 기록으로 갈 수 있다', async ({ page }) => {
    await login(page, 'admin');
    for (const [label, testId] of [
      ['학원', 'admin-academies'],
      ['계정', 'admin-users'],
      ['요금제', 'admin-billing'],
      ['콘텐츠', 'admin-content'],
      ['운영 기록', 'admin-ops'],
      ['개요', 'admin-home'],
    ] as const) {
      await page.getByRole('link', { name: label }).first().click();
      await expect(page.getByTestId(testId)).toBeVisible();
    }
  });

  test('콘텐츠는 영역으로 좁히고 페이지로 넘긴다', async ({ page }) => {
    await login(page, 'admin');
    await page.getByRole('link', { name: '콘텐츠' }).first().click();
    await expect(page.getByTestId('admin-content')).toBeVisible();

    // 페이지 크기는 10개. 시드 콘텐츠가 그보다 많아 다음 페이지가 있다.
    await expect(page.getByTestId('content-pager')).toContainText('1 / 2');
    await page.getByTestId('content-pager-next').click();
    await expect(page.getByTestId('content-pager')).toContainText('2 / 2');

    // 영역 칩으로 좁히면 첫 페이지로 돌아간다
    await page.getByTestId('content-area-문법').click();
    await expect(page.getByTestId('content-pager')).toContainText('1 /');
  });

  test('콘텐츠 상세에서 배정·개인 풀이 횟수와 문항 오답률을 본다', async ({ page }) => {
    await login(page, 'admin');
    await page.getByRole('link', { name: '콘텐츠' }).first().click();
    // 검색으로 좁혀 어느 페이지에 있든 같은 세트를 연다
    await page.getByTestId('content-search').fill('현대소설');
    await page.getByTestId('content-row-ct_acad_1').click();
    await expect(page.getByTestId('admin-content-detail')).toBeVisible();
    await expect(page.getByText('학원 배정 풀이')).toBeVisible();
    await expect(page.getByText('개인 학습 풀이')).toBeVisible();
    await expect(page.getByText('문항별 오답률')).toBeVisible();
    await expect(page.getByTestId('detail-q-ct_acad_1_q1')).toBeVisible();
    await expect(page.getByText(/테스트 집계/).first()).toBeVisible();
  });

  test('요금제에서 좌석 단가를 올리면 운영 기록에 남는다', async ({ page }) => {
    await login(page, 'admin');
    await page.getByRole('link', { name: '요금제' }).first().click();
    await expect(page.getByTestId('billing-academySeat-value')).toHaveText('₩12,000');
    await page.getByTestId('billing-academySeat-up').click();
    await expect(page.getByTestId('billing-academySeat-value')).toHaveText('₩12,500');

    await page.getByRole('link', { name: '운영 기록' }).first().click();
    await expect(page.getByTestId('admin-ops')).toBeVisible();
    await expect(page.getByText('학원 좌석 단가 ₩12,000 → ₩12,500')).toBeVisible();
    await expect(page.getByText('현재 ₩12,500')).toBeVisible();
  });

  test('학원 목록에서 학원 상세로 들어간다', async ({ page }) => {
    await login(page, 'admin');
    await page.getByRole('link', { name: '학원' }).first().click();
    await expect(page.getByTestId('admin-academies')).toBeVisible();
    await page.getByTestId('academy-row-한빛학원').click();
    await expect(page.getByTestId('admin-academy')).toBeVisible();
    await expect(page.getByText('배정 학습 제출률')).toBeVisible();
    await expect(page.getByText(/학생 개인 학습 상세는 여기서 보지 않아요/)).toBeVisible();
  });

  test('계정은 역할로 좁히고 검색한다', async ({ page }) => {
    await login(page, 'admin');
    await page.getByRole('link', { name: '계정' }).first().click();
    await expect(page.getByTestId('admin-users')).toBeVisible();
    await page.getByTestId('users-search').fill('doyun');
    await expect(page.getByTestId('user-row-u_student_academy')).toBeVisible();
    await page.getByTestId('users-role-parent').click();
    await expect(page.getByText('검색 결과가 없어요')).toBeVisible();
  });

  test('총괄관리자 외 역할은 관리자 화면에 들어갈 수 없다', async ({ page }) => {
    await login(page, 'seojun');
    await page.goto('/admin/billing');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('총괄관리자 문제 등록', () => {
  test('대시보드 지표가 테스트 데이터 기준임을 밝힌다', async ({ page }) => {
    await login(page, 'admin');
    await expect(page.getByText(/프로토타입 테스트 데이터 기준/)).toBeVisible();
    await expect(page.getByText(/실제 결제·정산 기록이 아닙니다/)).toBeVisible();
  });

  test('문제 등록을 그만두고 대시보드로 돌아갈 수 있다', async ({ page }) => {
    await login(page, 'admin');
    await page.getByTestId('admin-new').click();
    await expect(page).toHaveURL(/\/admin\/new/);
    await page.getByTestId('new-title').fill('중간에 그만둘 문제');
    await page.getByTestId('screen-back').click();
    await expect(page).toHaveURL(/\/admin$/);
  });

  test('총괄관리자만 접근할 수 있다', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('국어 문법 문제를 등록하면 콘텐츠 목록에 나타난다', async ({ page }) => {
    await login(page, 'admin');
    await expect(page).toHaveURL(/\/admin/);
    await createGrammarSet(page, 'E2E 문법 세트');
    await expect(page.getByText('E2E 문법 세트').first()).toBeVisible();
    await expect(page.getByText(/문법형/).first()).toBeVisible();
  });

  test('등록한 문제가 학생에게 공개되어 풀 수 있다', async ({ page }) => {
    await login(page, 'admin');
    await createGrammarSet(page, '학생공개 국어 세트');

    // 로그아웃 후 학생으로 로그인 (앱 내 이동 유지 — 전체 새로고침하면 메모리 콘텐츠가 초기화됨)
    await page.getByText('로그아웃').first().click();
    await expect(page).toHaveURL(/\/login/);
    await loginHere(page, 'seojun');
    await expect(page).toHaveURL(/\/student/);

    // 관리자가 만든 학습을 학년 → 영역 → 유형 뎁스로 찾아 들어간다
    await page.getByRole('link', { name: '학습' }).click();
    await page.getByTestId('learn-grade-2').click();
    await page.getByTestId('learn-area-문법').click();
    await page.getByTestId('learn-topic-어문 규정 - 맞춤법').click();
    await page.getByText('학생공개 국어 세트').first().click();
    await page.getByTestId('detail-start').click();
    await expect(page.getByText('1. 다음 중 맞춤법이 바른 것은?')).toBeVisible();

    // 등록할 때 쓴 해설이 결과 화면에 그대로 보인다
    await page.getByRole('radio').first().click();
    await page.getByTestId('solve-submit').click();
    await expect(page).toHaveURL(/\/student\/result\//);
    await expect(page.getByText('"오랜만에"가 바른 표기예요.')).toBeVisible();
  });
});
