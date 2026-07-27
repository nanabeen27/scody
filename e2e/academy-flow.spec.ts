import { test, expect, type Page } from '@playwright/test';
import { loginHere } from './_auth';

async function loginAs(page: Page, scodyId: string) {
  await page.goto('/login');
  await loginHere(page, scodyId);
  await expect(page).toHaveURL(/\/academy/);
}

test.describe('M4 학원 흐름', () => {
  test('학생이 학원 과제를 제출하면 학원 제출 현황에 반영된다', async ({ page }) => {
    // 박도윤: 학원 이용권만. 시드에서 '현대소설 점검' 미제출(제출 1/2).
    await page.goto('/login');
    await loginHere(page, 'doyun');
    await expect(page).toHaveURL(/\/student/);

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
    await loginHere(page, 'hanbit.director');

    await page.getByRole('link', { name: '성과 분석' }).click();
    await expect(page.getByText(/현대소설 점검/).first()).toBeVisible();
    await expect(page.getByText(/제출 2\/2/)).toBeVisible();
    // 미제출이 사라지면 확인 대상도 비워진다
    await expect(page.getByText('모두 제출했어요.')).toBeVisible();
  });

  test('원장: 성과 분석에서 미제출 학생을 이름으로 확인한다', async ({ page }) => {
    await loginAs(page, 'hanbit.director');
    await page.getByRole('link', { name: '성과 분석' }).click();
    await expect(page.getByText('확인이 필요한 학생')).toBeVisible();
    await expect(page.getByText('박도윤')).toBeVisible();
    await expect(page.getByText(/현대소설 점검 미제출/)).toBeVisible();
  });


  test('원장: 대시보드→반·학생→반 상세', async ({ page }) => {
    await loginAs(page, 'hanbit.director');
    await expect(page.getByText('제출 현황')).toBeVisible();
    await page.getByRole('link', { name: '반·학생' }).click();
    await expect(page.getByText('고1 국어', { exact: true })).toBeVisible();
    await expect(page.getByText('고2 국어')).toBeVisible();
    await page.getByText('고1 국어', { exact: true }).click();
    await expect(page).toHaveURL(/\/academy\/class\//);
    await expect(page.getByText('담당 선생님')).toBeVisible();
    await expect(page.getByText('오선생')).toBeVisible();
    await expect(page.getByText('정예린')).toBeVisible();
  });

  test('원장: 학습 배정 → 성과 분석에 반영', async ({ page }) => {
    await loginAs(page, 'hanbit.director');
    await page.getByRole('link', { name: '학습 배정' }).click();
    await page.getByTestId('assign-class-c_kor1').click();
    await page.getByTestId('assign-content-ct_gram_1').click();
    await page.getByTestId('assign-submit').click();
    await expect(page.getByText('학습을 배정했어요')).toBeVisible();
    await page.getByTestId('assign-goto-analytics').click();
    await expect(page).toHaveURL(/\/academy\/analytics/);
    await expect(page.getByText(/헷갈리는 맞춤법·어법/).first()).toBeVisible();
  });

  test('원장: 반 상세에서 학생별 제출 요약을 보고 목록으로 돌아간다', async ({ page }) => {
    await loginAs(page, 'hanbit.director');
    await page.getByRole('link', { name: '반·학생' }).click();
    const listUrl = page.url();
    await page.getByText('고1 국어', { exact: true }).click();

    await expect(page.getByText('정예린')).toBeVisible();
    await expect(page.getByText(/제출 1\/1 · 평균 80%/)).toBeVisible();
    await expect(page.getByText(/제출 0\/1/)).toBeVisible();

    await page.getByTestId('screen-back').click();
    await expect(page).toHaveURL(listUrl);
  });

  test('배정할 때 정한 마감일이 학생 화면까지 전달된다', async ({ page }) => {
    await loginAs(page, 'hanbit.director');
    await page.getByRole('link', { name: '학습 배정' }).click();
    await page.getByTestId('assign-class-c_kor1').click();
    await page.getByTestId('assign-content-ct_gram_1').click();
    await page.getByTestId('assign-due').fill('2026-08-11');
    await page.getByTestId('assign-submit').click();
    await expect(page.getByText('학습을 배정했어요')).toBeVisible();

    await page.getByTestId('assign-goto-analytics').click();
    await expect(page.getByText('고1 국어 · 2026-08-11 마감')).toBeVisible();

    await page.getByRole('link', { name: '학원 관리' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'yerin'); // 고1 국어 반 학생

    await page.getByRole('link', { name: '학습' }).click();
    await expect(page.getByText(/8월 11일 마감/).first()).toBeVisible();
  });

  test('잘못된 마감일 형식은 배정 전에 알려준다', async ({ page }) => {
    await loginAs(page, 'hanbit.director');
    await page.getByRole('link', { name: '학습 배정' }).click();
    await page.getByTestId('assign-due').fill('8/11');
    await page.getByTestId('assign-submit').click();
    await expect(page.getByText(/마감일은 2026-08-11 형식으로/)).toBeVisible();
    await expect(page.getByText('학습을 배정했어요')).toHaveCount(0);
  });

  test('원장: 학원 관리에 초대와 선생님 목록', async ({ page }) => {
    await loginAs(page, 'hanbit.director');
    await page.getByRole('link', { name: '학원 관리' }).click();
    await expect(page.getByText('학생 초대')).toBeVisible();
    await expect(page.getByText('선생님 초대')).toBeVisible();
    await expect(page.getByText('오선생')).toBeVisible();
  });

  test('원장: 규모 있는 학원의 반·학생 수가 보이고 반을 검색한다', async ({ page }) => {
    await loginAs(page, 'hanbit.director');
    await page.getByRole('link', { name: '반·학생' }).click();
    await expect(page.getByText(/반 \d{3}개 · 학생 \d{4}명/)).toBeVisible();

    // 전부 한 번에 쏟지 않고 더보기로 넓힌다
    await expect(page.getByTestId('class-more')).toBeVisible();
    await page.getByTestId('class-search').fill('고3 국어 7반');
    await expect(page.getByText('고3 국어 7반')).toBeVisible();
    await expect(page.getByText('고1 국어 1반')).toHaveCount(0);
  });

  test('원장: 선생님을 추가하고 다시 제외한다', async ({ page }) => {
    await loginAs(page, 'hanbit.director');
    await page.getByRole('link', { name: '학원 관리' }).click();
    await expect(page.getByText(/선생님 \d{2}명/)).toBeVisible();

    await page.getByTestId('teacher-new-name').fill('신규 선생');
    await page.getByTestId('teacher-new-id').fill('hanbit.new01');
    await page.getByTestId('teacher-add').click();
    await expect(page.getByText(/신규 선생 선생님을 추가했어요/)).toBeVisible();
    await page.getByTestId('teacher-search').fill('hanbit.new01');
    await expect(page.getByText('신규 선생', { exact: true })).toBeVisible();

    // 같은 아이디는 다시 추가되지 않는다
    await page.getByTestId('teacher-new-name').fill('중복 선생');
    await page.getByTestId('teacher-new-id').fill('hanbit.new01');
    await page.getByTestId('teacher-add').click();
    await expect(page.getByText('이미 사용 중인 아이디예요.')).toBeVisible();

    // 제외는 한 번 더 확인한다
    await page.getByTestId('teacher-search').fill('hanbit.new01');
    await page.getByTestId('teacher-remove-hanbit.new01').click();
    await expect(page.getByText('정말 제외할까요?')).toBeVisible();
    await page.getByTestId('teacher-remove-confirm-hanbit.new01').click();
    await expect(page.getByText('신규 선생', { exact: true })).toHaveCount(0);
    await expect(page.getByText('찾는 선생님이 없어요.')).toBeVisible();
  });

  test('원장: 선생님을 제외하면 담당 반이 미배정으로 바뀐다', async ({ page }) => {
    await loginAs(page, 'hanbit.director');
    await page.getByRole('link', { name: '반·학생' }).click();
    await page.getByText('고1 국어', { exact: true }).click();
    await expect(page.getByText('오선생')).toBeVisible();

    await page.getByRole('link', { name: '학원 관리' }).click();
    await page.getByTestId('teacher-search').fill('hanbit.teacher');
    await page.getByTestId('teacher-remove-hanbit.teacher').click();
    await page.getByTestId('teacher-remove-confirm-hanbit.teacher').click();

    await page.getByRole('link', { name: '반·학생' }).click();
    await page.getByText('고1 국어', { exact: true }).click();
    await expect(page.getByText('오선생')).toHaveCount(0);
    await expect(page.getByText('미배정')).toBeVisible();
  });

  test('선생님: 담당 반만 보이고 관리 권한이 제한된다', async ({ page }) => {
    await loginAs(page, 'hanbit.teacher'); // 오선생, 고1 국어만
    await page.getByRole('link', { name: '반·학생' }).click();
    await expect(page.getByText('고1 국어', { exact: true })).toBeVisible();
    await expect(page.getByText('고2 국어')).toHaveCount(0);
    await page.getByRole('link', { name: '학원 관리' }).click();
    await expect(page.getByText('담당 반 관리에 집중해 주세요')).toBeVisible();
  });
});
