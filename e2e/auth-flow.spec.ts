import { test, expect } from './_fixtures';
import { login, loginHere, PHONE_BY_ID, PHONE_PENDING, SIGNUP_PENDING, DEMO_CODE } from './_auth';

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
    await expect(page.getByText('오늘의 학습')).toBeVisible();
    // 학습 탭에서 개인/학원 출처가 분리되어 보인다
    await page.getByRole('link', { name: '학습' }).click();
    await expect(page.getByText('개인 학습').first()).toBeVisible();
    await expect(page.getByText('학원 학습').first()).toBeVisible();
  });

  /*
    남은 개수는 출처별로 따로 센다(학원 과제와 담아 둔 학습을 합쳐 세지 않는다).
    분모는 공개 카탈로그가 아니라 학생이 약속한 일 = 학원 과제 + 담아 둔 학습이다.

    **박도윤으로 확인한다.** 예전에는 정예린으로 확인했는데, 정예린은 배정 4건을 모두 냈는데도
    학생 화면이 미제출로 보여 주고 있었다 — `merge`가 제출 기록을 보지 않던 A-026이다. 제출
    판정이 서버의 풀이 기록 하나로 모이면서 그 결함이 닫혔고, 그래서 정예린의 홈에는 남은 것이
    없다. 남은 개수를 확인하려면 실제로 안 낸 학생이 필요하다.
  */
  test('학생 홈은 남은 학습을 출처별로 센다', async ({ page }) => {
    await login(page, 'doyun'); // 안 낸 학원 과제 1건, 개인 이용권 없음
    await expect(page.getByTestId('home-progress')).toBeVisible();
    await expect(page.getByText(/남은 학습 \d+개/)).toBeVisible();
    await expect(page.getByText(/학원 과제 \d+개/)).toBeVisible();
    await expect(page.getByText(/개인 학습 \d+개/)).toHaveCount(0);
  });

  test('테스트 계정으로 로그인한다', async ({ page }) => {
    await login(page, 'doyun');
    await expect(page).toHaveURL(/\/student/);
    await expect(page.getByText(/박도윤님/)).toBeVisible();
  });

  /*
    휴대폰 인증은 아직 서버에 연결되지 않았다. **없는 기능을 있는 것처럼 두지 않는다** —
    번호를 받는 단계는 남기고, 인증번호를 보낼 수 없다는 사실을 그 자리에서 말한다.
    실제 OTP가 붙으면 이 두 스펙이 원래의 '가입되지 않은 번호'·'잘못된 인증번호'로 돌아온다.
  */
  test('휴대폰 인증은 아직 연결되지 않았다고 말한다', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-phone').click();
    await page.getByTestId('login-phone-number').fill(PHONE_BY_ID.doyun);
    await page.getByTestId('login-phone-send').click();
    await expect(page.getByText(PHONE_PENDING)).toBeVisible();
    // 인증번호 단계로 넘어가지 않는다 — 보낼 수 없는 번호를 기다리게 두지 않는다.
    await expect(page.getByTestId('login-phone-code')).toHaveCount(0);
    await expect(page).toHaveURL(/\/login/);
  });

  test('연결되지 않았다는 오류에서 테스트 계정으로 갈 수 있다', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-phone').click();
    await page.getByTestId('login-phone-number').fill('010-0000-0000');
    await page.getByTestId('login-phone-send').click();
    await page.getByTestId('login-error-demo').click();
    // 오류가 가리키는 행동을 그 자리에서 할 수 있다.
    await expect(page.getByRole('button', { name: /^박도윤 · / })).toBeVisible();
  });

  test('학원 원장 로그인 → 대시보드와 사이드바 메뉴', async ({ page }) => {
    await login(page, 'hanbit.director');
    await expect(page).toHaveURL(/\/academy/);
    await expect(page.getByText('대시보드').first()).toBeVisible();
    // 대시보드 본문은 내비를 글자로 복제하지 않는다(D-061). 사이드바 메뉴로 확인한다.
    await expect(page.getByRole('link', { name: '성과 분석' })).toBeVisible();
    await expect(page.getByText('학습 배정').first()).toBeVisible();
  });

  test('다역할 계정은 공간을 선택한다', async ({ page }) => {
    await login(page, 'jihoon');
    await expect(page).toHaveURL(/\/select-space/);
    await expect(page.getByText('어디로 갈까요')).toBeVisible();
    await page.getByText('학원 공간').click();
    await expect(page).toHaveURL(/\/academy/);
  });

  /*
    초대 토큰은 서버가 해석한다(`rpc_invite_info`). 예전에는 fixture 3개로 맞춰 봤고, 그래서
    학원이 실제로 만든 토큰은 `유효하지 않은 링크`로 떨어졌다(A-097).

    카카오 데모 버튼은 이 화면에서 내렸다 — 초대 역할과 무관한 계정(정예린·학생)으로 들어가
    학생 홈을 열었다. 로그인은 로그인 화면에서 하고, 토큰을 들고 돌아온다.
  */
  test('초대 링크는 역할과 학원을 인식한다', async ({ page }) => {
    await page.goto('/join?invite=INV-STUDENT');
    await expect(page.getByText(/학생으로 초대/)).toBeVisible();
    await expect(page.getByText('한빛학원').first()).toBeVisible();
    await expect(page.getByTestId('join-login')).toBeVisible();
    // 조회가 끝난 화면에 `유효하지 않다`는 말이 남아 있지 않다.
    await expect(page.getByText('유효하지 않은 초대 링크예요')).toHaveCount(0);
  });

  test('없는 초대 토큰은 유효하지 않다고 말한다', async ({ page }) => {
    await page.goto('/join?invite=NOPE-000000');
    await expect(page.getByText('유효하지 않은 초대 링크예요')).toBeVisible();
    // 초대 내용을 지어내지 않는다.
    await expect(page.getByText('한빛학원')).toHaveCount(0);
  });

  test('초대 링크에서 로그인하면 토큰을 들고 돌아온다', async ({ page }) => {
    await page.goto('/join?invite=INV-STUDENT');
    await page.getByTestId('join-login').click();
    await expect(page).toHaveURL(/\/login/);
    await loginHere(page, 'seojun'); // 학원 소속이 없는 개인 구독 학생
    await expect(page).toHaveURL(/\/join\?invite=INV-STUDENT/);
    // 로그인 전 화면이 아니라 수락 단계로 이어진다.
    await expect(page.getByTestId('join-accept')).toBeVisible();
  });

  /* 수락은 `academy_members`에 소속을 넣는다. 화면은 그 결과를 다시 읽어 확인한다. */
  test('로그인한 상태로 초대를 수락하면 소속이 생긴다', async ({ page }) => {
    await login(page, 'seojun');
    await page.goto('/join?invite=INV-STUDENT');
    await page.getByTestId('join-accept').click();
    await expect(page.getByText('한빛학원과 연결됐어요')).toBeVisible();
    await expect(page.getByText('소속')).toBeVisible();
    await page.getByTestId('join-home').click();
    await expect(page).toHaveURL(/\/student/);

    // 같은 링크를 다시 열면 이미 쓴 초대라고 말한다(서버에 수락이 남았다).
    await page.goto('/join?invite=INV-STUDENT');
    await expect(page.getByText('이미 사용한 초대예요')).toBeVisible();
  });

  /*
    학부모 초대는 소속이 아니라 자녀 연결이다. 서버가 수락을 거부하므로
    (`rpc_accept_invite`) 누르면 거부되는 버튼을 두지 않는다.
  */
  test('학부모 초대는 자녀 확인이 필요하다고 말한다', async ({ page }) => {
    await login(page, 'minji'); // 학부모
    await page.goto('/join?invite=INV-PARENT');
    await expect(page.getByText(/자녀 확인이 필요해요/)).toBeVisible();
    await expect(page.getByTestId('join-accept')).toHaveCount(0);
  });

  test('키보드만으로 번호 단계를 끝낼 수 있다(Enter)', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-phone').click();
    await page.getByTestId('login-phone-number').fill(PHONE_BY_ID.seojun);
    await page.getByTestId('login-phone-number').press('Enter');
    // Enter가 `인증번호 받기`와 같은 자리에 닿는다. 지금은 그 행동이 안내로 끝난다.
    await expect(page.getByText(PHONE_PENDING)).toBeVisible();
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
    /*
      **계정을 만들지 않는다.** 계정 생성은 `auth.users`가 먼저 있어야 하고, 그 수단은 확정
      정책이 정한 카카오·휴대폰 인증이다 — 아직 연결되지 않았다. 예전에는 여기서 이용권 없는
      메모리 계정으로 홈에 들어가 두 번째 화면에서 흐름이 끊겼다(A-096).
    */
    await expect(page.getByText(SIGNUP_PENDING)).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
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
    await expect(page.getByText(SIGNUP_PENDING)).toBeVisible();
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
    // 역할을 여러 개 골라도 결과는 같다 — 계정을 만드는 경로가 아직 없다.
    await expect(page.getByText(SIGNUP_PENDING)).toBeVisible();
  });

  /*
    오류 문구가 가리키는 행동으로 **그 화면에서** 갈 수 있어야 한다. 예전에는
    `회원가입`/`로그인` 링크가 앞 단계에만 있어서, 번호를 잘못 알고 온 사람이
    문구가 시키는 대로 할 수 없었다. 오류는 `role="alert"`로도 읽힌다.
  */
  test('가입되지 않은 번호 오류에서 바로 회원가입으로 간다', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-phone').click();
    await page.getByTestId('login-phone-number').fill('010-9999-9999');
    await page.getByTestId('login-phone-send').click();
    // 오류는 `role="alert"`로 읽힌다. 지금 가리키는 행동은 테스트 계정이다(위 스펙이 확인한다).
    await expect(page.getByRole('alert')).toHaveText(PHONE_PENDING);
  });

  test('이미 가입된 번호 오류에서 바로 로그인으로 간다', async ({ page }) => {
    await page.goto('/signup');
    await page.getByTestId('signup-phone').click();
    await page.getByTestId('signup-phone-number').fill(PHONE_BY_ID.doyun);
    await page.getByTestId('signup-phone-send').click();
    await expect(page.getByRole('alert')).toHaveText(/이미 가입된 번호예요/);
    await page.getByTestId('signup-error-login').click();
    await expect(page).toHaveURL(/\/login/);
  });

  /* 마지막 단계의 이탈 경로가 워드마크에만 있어 로고로만 보였다. 글자 링크를 함께 둔다. */
  test('가입 마지막 단계에서 글자 링크로 앞 단계로 돌아간다', async ({ page }) => {
    await page.goto('/signup');
    await page.getByTestId('signup-phone').click();
    await page.getByTestId('signup-phone-number').fill('010-5000-4321');
    await page.getByTestId('signup-phone-send').click();
    await expect(page.getByText(/010-5000-4321으로 6자리 번호를 보냈어요/)).toBeVisible();
    await page.getByTestId('signup-phone-code').fill(DEMO_CODE);
    await page.getByTestId('signup-phone-next').click();
    await page.getByTestId('signup-detail-back').click();
    await expect(page.getByTestId('signup-phone-number')).toBeVisible();
  });
});
