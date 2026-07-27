import { test, expect } from '@playwright/test';
import { login, loginHere, PHONE_BY_ID, DEMO_CODE } from './_auth';

const INTRO = 'Scody는 학생의 학습을 가장 효율적으로 만드는 학습 플랫폼입니다.';

test.describe('M1 소개·로그인·역할 분기', () => {
  test('로그인하지 않으면 소개 페이지로 보낸다', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/introduce/);
    await expect(page.getByText(INTRO)).toBeVisible();
  });

  test('소개 페이지: 상단에서 로그인·회원가입으로 갈 수 있다', async ({ page }) => {
    await page.goto('/introduce');
    await page.getByTestId('landing-login').click();
    await expect(page).toHaveURL(/\/login/);
    await page.goBack();
    await page.getByTestId('landing-signup').click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('소개 페이지: 방문자 토글로 내용이 바뀐다', async ({ page }) => {
    await page.goto('/introduce');
    // 토글은 상단 바(워드마크 옆). 모바일은 그 아래 줄에 있다.
    await expect(page.getByTestId('visitor-student')).toBeVisible();

    // 학생: 개인 문제 제공이 드러난다
    await expect(page.getByText('시험 범위만 골라 담아 내신 대비')).toBeVisible();

    await page.getByTestId('visitor-parent').click();
    await expect(page.getByText('주간 학습 횟수와 평균 정답률')).toBeVisible();
    await expect(page.getByText('시험 범위만 골라 담아 내신 대비')).toHaveCount(0);

    await page.getByTestId('visitor-teacher').click();
    await expect(page.getByText('제출 여부·정답률·미제출 학생 확인')).toBeVisible();
    await expect(page.getByText('반 단위 배정', { exact: true })).toBeVisible();

    await page.getByTestId('visitor-student').click();
    await expect(page.getByText('시험 범위만 골라 담아 내신 대비')).toBeVisible();
  });

  test('소개 페이지는 설계 근거를 출처와 함께 밝힌다', async ({ page }) => {
    await page.goto('/introduce');
    await expect(
      page.getByText(/과학적으로 성적을 올리는 데 입증된 방식만을 적극적으로 반영/),
    ).toBeVisible();
    await expect(page.getByText('답만 알려주면 잘 안 늘어요')).toBeVisible();
    await expect(page.getByText(/설명 있는 해설 0.49/)).toBeVisible();
    await expect(page.getByText(/Van der Kleij, Feskens & Eggen \(2015\)/)).toBeVisible();
    await expect(page.getByText(/다시 풀기 효과 0.50/)).toBeVisible();
    // 우리 서비스 자체 효과를 주장하지 않는다는 문장도 함께 둔다
    await expect(page.getByText(/성적 변화는 아직 측정하지 않았어요/)).toBeVisible();
  });

  test('푸터에서 문서 네 개를 열고 서로 이동한다', async ({ page }) => {
    await page.goto('/introduce');

    // 서비스 소개
    await page.getByTestId('footer-about').click();
    await expect(page).toHaveURL(/\/legal\/about/);
    await expect(page.getByTestId('legal-about')).toBeVisible();
    await expect(page.getByText('무엇을 제공하나요')).toBeVisible();

    // 이용약관 — 초안임을 밝힌다
    await page.getByTestId('legal-link-terms').click();
    await expect(page).toHaveURL(/\/legal\/terms/);
    await expect(page.getByTestId('legal-terms').getByText(/검토 전 초안이에요/)).toBeVisible();
    await expect(page.getByText('제8조 (청약철회와 환불)')).toBeVisible();

    // 개인정보처리방침 — 법정 항목과 구제 절차
    await page.getByTestId('legal-link-privacy').click();
    await expect(page).toHaveURL(/\/legal\/privacy/);
    await expect(page.getByText('3. 개인정보의 처리 및 보유 기간')).toBeVisible();
    await expect(page.getByText(/개인정보침해 신고센터: 118/)).toBeVisible();

    // 사업자정보 — 값이 없다는 사실을 밝힌다
    await page.getByTestId('legal-link-business').click();
    await expect(page).toHaveURL(/\/legal\/business/);
    await expect(page.getByText(/사업자 등록을 하지 않은 프로토타입/)).toBeVisible();
    await expect(page.getByText('사업자등록번호')).toBeVisible();
    await expect(page.getByText('준비 중').first()).toBeVisible();

    // 문서에서 소개 페이지로 돌아온다
    await page.getByTestId('legal-home').click();
    await expect(page).toHaveURL(/\/introduce/);
  });

  test('로그인 화면에서 워드마크를 누르면 소개 페이지로 나간다', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-brand').click();
    await expect(page).toHaveURL(/\/introduce/);
  });

  test('가입 화면에서 워드마크를 누르면 앞 단계로 돌아간다', async ({ page }) => {
    await page.goto('/signup');
    await page.getByTestId('signup-phone').click();
    await expect(page.getByTestId('signup-phone-number')).toBeVisible();
    await page.getByTestId('signup-brand').click();
    // 방법 선택 단계로 돌아온다
    await expect(page.getByTestId('signup-kakao')).toBeVisible();
    // 한 번 더 누르면 화면 밖으로 나간다
    await page.getByTestId('signup-brand').click();
    await expect(page).toHaveURL(/\/introduce/);
  });

  test('로그인 없이 학생 공간 접근 시 로그인으로 가드된다', async ({ page }) => {
    await page.goto('/student');
    await expect(page).toHaveURL(/\/login/);
  });

  test('카카오로 로그인 → 학생 홈, 개인/학원 출처 구분', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-kakao').click();
    await expect(page).toHaveURL(/\/student/);
    // 홈: 오늘의 학습이 가장 크게, 진행률이 보인다
    await expect(page.getByText('오늘의 학습')).toBeVisible();
    await expect(page.getByText('학습 진행률')).toBeVisible();
    // 학습 탭에서 개인/학원 출처가 분리되어 보인다
    await page.getByRole('link', { name: '학습' }).click();
    await expect(page.getByText('개인 학습').first()).toBeVisible();
    await expect(page.getByText('학원 학습').first()).toBeVisible();
  });

  test('휴대폰 번호로 로그인한다', async ({ page }) => {
    await login(page, 'doyun');
    await expect(page).toHaveURL(/\/student/);
    await expect(page.getByText(/박도윤님/)).toBeVisible();
  });

  test('가입되지 않은 번호는 인증번호 단계로 가지 않는다', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-phone').click();
    await page.getByTestId('login-phone-number').fill('010-0000-0000');
    await page.getByTestId('login-phone-send').click();
    await expect(page.getByText(/가입되지 않은 번호예요/)).toBeVisible();
    await expect(page.getByTestId('login-phone-code')).toHaveCount(0);
    await expect(page).toHaveURL(/\/login/);
  });

  test('잘못된 인증번호는 오류를 보여준다', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-phone').click();
    await page.getByTestId('login-phone-number').fill(PHONE_BY_ID.doyun);
    await page.getByTestId('login-phone-send').click();
    await page.getByTestId('login-phone-code').fill('123456');
    await page.getByTestId('login-submit').click();
    await expect(page.getByText('인증번호가 맞지 않아요.')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('학원 원장 로그인 → 대시보드와 사이드바 메뉴', async ({ page }) => {
    await login(page, 'hanbit.director');
    await expect(page).toHaveURL(/\/academy/);
    await expect(page.getByText('대시보드').first()).toBeVisible();
    await expect(page.getByText('제출 현황')).toBeVisible();
    await expect(page.getByText('학습 배정').first()).toBeVisible();
  });

  test('다역할 계정은 공간을 선택한다', async ({ page }) => {
    await login(page, 'jihoon');
    await expect(page).toHaveURL(/\/select-space/);
    await expect(page.getByText('어디로 갈까요')).toBeVisible();
    await page.getByText('학원 공간').click();
    await expect(page).toHaveURL(/\/academy/);
  });

  test('초대 링크는 역할과 학원을 인식한다', async ({ page }) => {
    await page.goto('/join?invite=INV-STUDENT');
    await expect(page.getByText(/학생으로 초대/)).toBeVisible();
    await expect(page.getByText('한빛학원').first()).toBeVisible();
    await expect(page.getByTestId('join-kakao')).toBeVisible();
  });

  test('키보드만으로 로그인할 수 있다(인증번호에서 Enter)', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-phone').click();
    await page.getByTestId('login-phone-number').fill(PHONE_BY_ID.seojun);
    await page.getByTestId('login-phone-number').press('Enter');
    await page.getByTestId('login-phone-code').fill(DEMO_CODE);
    await page.getByTestId('login-phone-code').press('Enter');
    await expect(page).toHaveURL(/\/student/);
  });

  test('세션 없이 공간 선택 URL로 들어오면 로그인으로 보낸다', async ({ page }) => {
    await page.goto('/select-space');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId('login-phone')).toBeVisible();
  });

  test('다역할 계정은 로그아웃 없이 공간을 바꿀 수 있다', async ({ page }) => {
    await login(page, 'jihoon'); // 선생님 + 학부모
    await expect(page).toHaveURL(/\/select-space/);

    await page.getByText(/학부모 공간/).click();
    await expect(page).toHaveURL(/\/parent/);

    await page.getByRole('link', { name: '내 정보' }).click();
    await page.getByTestId('switch-space').click();
    await expect(page).toHaveURL(/\/select-space/);
    const academySpace = page.getByRole('button', { name: '학원 공간' });
    await expect(academySpace).toBeVisible();
    await academySpace.click();
    await expect(page).toHaveURL(/\/academy/);
  });

  test('로그아웃 후 같은 화면에서 다른 계정으로 로그인한다', async ({ page }) => {
    await login(page, 'minji');
    await expect(page).toHaveURL(/\/parent/);
    await page.getByRole('link', { name: '내 정보' }).click();
    await page.getByText('로그아웃').click();
    await expect(page).toHaveURL(/\/login/);
    await loginHere(page, 'seojun');
    await expect(page).toHaveURL(/\/student/);
  });

  test('신규 가입: 휴대폰 번호로 시작한다', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-signup').click();
    await expect(page).toHaveURL(/\/signup/);

    await page.getByTestId('signup-phone').click();
    await page.getByTestId('signup-phone-number').fill('010-5000-1234');
    await page.getByTestId('signup-phone-send').click();
    await page.getByTestId('signup-phone-code').fill(DEMO_CODE);
    await page.getByTestId('signup-phone-next').click();

    await page.getByTestId('signup-name').fill('새사용자');
    await page.getByTestId('signup-id').fill('newbie');
    await page.getByTestId('signup-pw').fill('test1234');
    // 기본 학생 역할로 시작
    await page.getByTestId('signup-submit').click();
    await expect(page).toHaveURL(/\/student/);
    await expect(page.getByText(/새사용자님/)).toBeVisible();
  });

  test('이미 가입된 번호로는 가입할 수 없다', async ({ page }) => {
    await page.goto('/signup');
    await page.getByTestId('signup-phone').click();
    await page.getByTestId('signup-phone-number').fill(PHONE_BY_ID.doyun);
    await page.getByTestId('signup-phone-send').click();
    await expect(page.getByText(/이미 가입된 번호예요/)).toBeVisible();
    await expect(page.getByTestId('signup-phone-code')).toHaveCount(0);
  });

  test('신규 가입: 카카오로 가입하면 번호 단계를 건너뛴다', async ({ page }) => {
    await page.goto('/signup');
    await page.getByTestId('signup-kakao').click();
    await expect(page.getByText(/카카오 계정을 연결했어요/)).toBeVisible();
    await page.getByTestId('signup-name').fill('카카오가입');
    await page.getByTestId('signup-id').fill('kakaonew');
    await page.getByTestId('signup-pw').fill('test1234');
    await page.getByTestId('signup-submit').click();
    await expect(page).toHaveURL(/\/student/);
  });

  test('신규 가입 다역할 선택 시 공간 선택으로 간다', async ({ page }) => {
    await page.goto('/signup');
    await page.getByTestId('signup-phone').click();
    await page.getByTestId('signup-phone-number').fill('010-5000-5678');
    await page.getByTestId('signup-phone-send').click();
    await page.getByTestId('signup-phone-code').fill(DEMO_CODE);
    await page.getByTestId('signup-phone-next').click();

    await page.getByTestId('signup-name').fill('두역할');
    await page.getByTestId('signup-id').fill('dualrole');
    await page.getByTestId('signup-pw').fill('test1234');
    await page.getByTestId('signup-role-parent').click(); // 학생 + 학부모
    await page.getByTestId('signup-submit').click();
    await expect(page).toHaveURL(/\/select-space/);
  });
});
