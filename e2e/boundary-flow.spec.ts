import { test, expect, type Page } from '@playwright/test';
import { loginHere } from './_auth';

async function login(page: Page, scodyId: string) {
  await page.goto('/login');
  await loginHere(page, scodyId);
}

const ACADEMY_CONTENT = '한빛 문법 점검';
const OTHER_ACADEMY_CONTENT = '새길 전용 자료';

test.describe('M5 이용권·소속 경계', () => {
  test('학원이 등록한 문제는 다른 학생의 개인 학습에 공개되지 않는다', async ({ page }) => {
    await page.goto('/login');
    await loginHere(page, 'hanbit.teacher');
    await page.getByRole('link', { name: '문제 등록' }).click();

    await page.getByTestId('new-kind-grammar').click();
    await page.getByTestId('new-title').fill(ACADEMY_CONTENT);
    await page.getByTestId('new-q0-prompt').fill('다음 중 맞춤법이 바른 것은?');
    for (let ci = 0; ci < 4; ci++) await page.getByTestId(`new-q0-c${ci}`).fill(`보기 ${ci + 1}`);
    await page.getByTestId('new-save').click();
    await expect(page.getByText('문제를 등록했어요')).toBeVisible();
    await page.getByTestId('composer-done').click();
    // 배정 목록에서는 고를 수 있다
    await expect(page.getByText(ACADEMY_CONTENT).first()).toBeVisible();

    await page.getByRole('link', { name: '학원 관리' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'seojun'); // 다른 학원과 무관한 개인 구독 학생

    await page.getByRole('link', { name: '학습' }).click();
    await expect(page.getByText('개인 학습').first()).toBeVisible();
    // 어느 학년·영역으로 들어가도 학원 전용 콘텐츠는 없다
    await page.getByTestId('learn-grade-1').click();
    await page.getByTestId('learn-area-문법').click();
    await expect(page.getByText(ACADEMY_CONTENT)).toHaveCount(0);
  });


  test('다른 학원이 등록한 문제는 배정 목록에 보이지 않는다', async ({ page }) => {
    // 새 학원 원장으로 가입해 그 학원 전용 문제를 등록한다
    await page.goto('/signup');
    await page.getByTestId('signup-kakao').click(); // 방법 선택 후 상세 단계로
    await page.getByTestId('signup-name').fill('새길 원장');
    await page.getByTestId('signup-id').fill('saegil.director');
    await page.getByTestId('signup-pw').fill('test1234');
    await page.getByTestId('signup-role-academy').click();
    await page.getByTestId('signup-academy-name').fill('새길학원');
    await page.getByTestId('signup-submit').click();
    await expect(page).toHaveURL(/\/select-space/);
    await page.getByText(/학원 공간/).click();
    await expect(page).toHaveURL(/\/academy/);

    await page.getByRole('link', { name: '문제 등록' }).click();
    await page.getByTestId('new-kind-grammar').click();
    await page.getByTestId('new-title').fill(OTHER_ACADEMY_CONTENT);
    await page.getByTestId('new-q0-prompt').fill('다음 중 띄어쓰기가 옳은 것은?');
    for (let ci = 0; ci < 4; ci++) await page.getByTestId(`new-q0-c${ci}`).fill(`보기 ${ci + 1}`);
    await page.getByTestId('new-save').click();
    await page.getByTestId('composer-done').click();

    await page.getByRole('link', { name: '학원 관리' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'hanbit.director');

    await page.getByRole('link', { name: '학습 배정' }).click();
    // 운영자 공개 콘텐츠는 배정할 수 있다
    await expect(page.getByText('정보의 홍수와 비판적 읽기').first()).toBeVisible();
    // 다른 학원 전용 콘텐츠는 보이지 않는다
    await expect(page.getByText(OTHER_ACADEMY_CONTENT)).toHaveCount(0);
  });

  test('개인·학원 이용권을 함께 표시한다', async ({ page }) => {
    await login(page, 'yerin'); // 정예린: 개인 + 학원
    await page.getByRole('link', { name: '내 정보' }).click();
    await expect(page.getByText('개인 월정액', { exact: true })).toBeVisible();
    await expect(page.getByText('학원 이용권', { exact: true })).toBeVisible();
    await expect(page.getByText(/함께 가지고 있어요/)).toBeVisible();
  });

  test('학원 연결을 끊으면 학원 학습은 사라지고 안내가 남는다', async ({ page }) => {
    await login(page, 'yerin');
    // 학습 탭에 학원 학습이 보인다
    await page.getByRole('link', { name: '학습' }).click();
    await expect(page.getByText('현대소설 점검')).toBeVisible();
    // 내 정보에서 연결 끊기
    await page.getByRole('link', { name: '내 정보' }).click();
    await page.getByTestId('academy-unlink').click();
    await page.getByTestId('academy-unlink-confirm').click();
    await expect(page.getByText('학원 연결이 끝났어요')).toBeVisible();
    // 학습 탭의 학원 학습이 사라진다
    await page.getByRole('link', { name: '학습' }).click();
    await expect(page.getByText('현대소설 점검')).toHaveCount(0);
    await expect(page.getByText('아직 학원에서 받은 학습이 없어요')).toBeVisible();
  });

  test('중복 아이디로는 가입할 수 없다', async ({ page }) => {
    await page.goto('/signup');
    await page.getByTestId('signup-kakao').click(); // 방법 선택 후 상세 단계로
    await page.getByTestId('signup-name').fill('중복');
    await page.getByTestId('signup-id').fill('yerin');
    await page.getByTestId('signup-pw').fill('test1234');
    await page.getByTestId('signup-submit').click();
    await expect(page.getByText(/이미 사용 중인 아이디/)).toBeVisible();
  });

  test('학원은 학생의 개인 학습을 볼 수 없다', async ({ page }) => {
    await login(page, 'hanbit.director');
    await page.getByRole('link', { name: '성과 분석' }).click();
    // 배정 학습만 보이고, 개인 학습 콘텐츠 제목은 나타나지 않는다
    await expect(page.getByText(/학생 개인 학습 상세는 표시하지 않습니다/)).toBeVisible();
    await expect(page.getByText('정보의 홍수와 비판적 읽기')).toHaveCount(0);
    await expect(page.getByText('헷갈리는 맞춤법·어법')).toHaveCount(0);
  });
});
