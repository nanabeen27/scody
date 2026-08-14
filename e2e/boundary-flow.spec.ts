import { test, expect } from './_fixtures';
import { sid } from './_ids';
import { type Page } from '@playwright/test';
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
    // `문제 등록` 탭을 내리고 `문제`(우리 학원 콘텐츠) 화면 안 행동으로 옮겼다(D-064).
    await page.getByRole('link', { name: '문제' }).click();
    await page.getByTestId('academy-content-new').click();

    await page.getByTestId('new-kind-grammar').click();
    await page.getByTestId('new-title').fill(ACADEMY_CONTENT);
    await page.getByTestId('new-q0-prompt').fill('다음 중 맞춤법이 바른 것은?');
    for (let ci = 0; ci < 4; ci++) await page.getByTestId(`new-q0-c${ci}`).fill(`보기 ${ci + 1}`);
    await page.getByTestId('new-save').click();
    await expect(page.getByText('문제를 등록했어요')).toBeVisible();
    // 등록을 마치면 방금 만든 학습이 실려 배정으로 이어진다(D-064).
    await page.getByTestId('composer-done').click();
    await page.getByTestId(`assign-class-${sid('c_kor1')}`).click();
    await expect(page.getByText(ACADEMY_CONTENT).first()).toBeVisible();

    await page.getByRole('link', { name: '학원 관리' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'seojun'); // 다른 학원과 무관한 개인 구독 학생

    await page.getByRole('link', { name: '학습' }).click();
    await expect(page.getByText('개인 학습').first()).toBeVisible();
    // 어느 학년·영역으로 들어가도 학원 전용 콘텐츠는 없다
    await page.getByTestId('learn-pick').click();
    await page.getByTestId('learn-grade-1').click();
    await page.getByTestId('learn-area-문법').click();
    await expect(page.getByText(ACADEMY_CONTENT)).toHaveCount(0);
  });


  test('다른 학원이 등록한 문제는 배정 목록에 보이지 않는다', async ({ page }) => {
    /*
      **두 번째 학원은 seed에 있다**(M-DB-13). 예전에는 이 테스트가 가입 화면으로 새길학원 원장을
      만들어 시작했는데, 가입은 아직 계정을 만들지 못한다(M-DB-2) — 그래서 첫 단계에서 실패했다.
      지금은 seed의 새길학원 원장으로 들어가 그 학원이 이미 가진 콘텐츠를 쓴다.
    */
    await login(page, 'saegil.director');
    await expect(page).toHaveURL(/\/academy/);

    // 자기 학원 콘텐츠는 자기에게 보인다(아래 `안 보인다`가 공허하지 않다는 근거).
    await page.getByRole('link', { name: '문제' }).click();
    await expect(page.getByText(OTHER_ACADEMY_CONTENT).first()).toBeVisible();

    await page.getByRole('link', { name: '학원 관리' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'hanbit.director');

    await page.getByRole('link', { name: '학습 배정' }).click();
    await page.getByTestId(`assign-class-${sid('c_kor1')}`).click();
    // 운영자 공개 콘텐츠는 배정할 수 있다
    await page.getByTestId('assign-content-search').fill('정보의 홍수');
    await expect(page.getByText('정보의 홍수와 비판적 읽기').first()).toBeVisible();
    /*
      다른 학원 전용 콘텐츠는 검색해도 나오지 않는다.
      예전에는 첫 화면에 전체 목록이 있어 "안 보인다"가 우연히 통과했다 —
      이제는 이름으로 직접 찾아도 없다는 것을 확인한다.
    */
    await page.getByTestId('assign-content-search').fill(OTHER_ACADEMY_CONTENT);
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
