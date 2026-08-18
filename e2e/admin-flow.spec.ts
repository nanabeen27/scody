import { test, expect } from './_fixtures';
import { sid } from './_ids';
import { type Page } from '@playwright/test';
import { loginHere } from './_auth';
import { choices } from './_solve';

async function login(page: Page, scodyId: string) {
  await page.goto('/login');
  await loginHere(page, scodyId);
}

/**
 * 문제 등록은 **콘텐츠 화면 안의 행동**이다. 예전에는 개요에 전폭 primary로 있었는데,
 * 그러면 대시보드의 목적이 콘텐츠 작성인 것처럼 읽혔다(D-047의 전폭 규칙).
 */
async function gotoNewContent(page: Page) {
  await page.getByRole('link', { name: '콘텐츠' }).click();
  await page.getByTestId('admin-new').click();
}

async function createGrammarSet(page: Page, title: string) {
  await gotoNewContent(page);
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
  // 등록을 마치면 방금 만든 세트 상세로 간다(D-075 ⑧). 개요로 튀면 다시 검색해야 했다.
  // 새 콘텐츠 id는 uuid다(예전에는 `ct_new_0` 같은 메모리 카운터였다).
  await expect(page).toHaveURL(/\/admin\/content\/[0-9a-f-]{36}$/);
  await expect(page.getByText(title).first()).toBeVisible();
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
    await page.getByTestId(`content-row-${sid('ct_acad_1')}`).click();
    await expect(page.getByTestId('admin-content-detail')).toBeVisible();
    await expect(page.getByText('학원 배정 풀이')).toBeVisible();
    await expect(page.getByText('개인 학습 풀이')).toBeVisible();
    await expect(page.getByText('문항별 오답률')).toBeVisible();
    // 1번 문항은 이 세트에서 오답률이 가장 높아 미리보기 5문항 안에 온다.
    await expect(page.getByTestId(`detail-q-${sid('ct_acad_1_q1')}`)).toBeVisible();
    /*
      **단정이 바뀐 이유**: 사용 집계가 문항 id 해시로 만든 테스트 값을 떠나 `rpc_content_usage`가
      됐다. `테스트 집계`는 화면에 남아 있으면 거짓말이라 지웠고, 대신 값이 실제 풀이에서
      온다는 고지와 몇 명이 답했는지를 확인한다 — 표본 수가 없으면 88%가 8명 중 7명인지
      1명 중 1명인지 알 수 없다.
    */
    await expect(page.getByText(/실제 풀이 기록에서 세요/).first()).toBeVisible();
    await expect(page.getByText(/명이 답했어요/).first()).toBeVisible();
    await expect(page.getByText(/테스트 집계/)).toHaveCount(0);
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

    /*
      **정책과 기록은 서버에 남는다.** 예전에는 둘 다 provider의 `useState`라 새로고침하면
      단가가 되돌아가고 감사 로그가 사라졌다 — 접속기록이 사라지는 것은 없는 것과 같다.
    */
    await page.reload();
    await expect(page.getByTestId('admin-ops')).toBeVisible();
    await expect(page.getByText('학원 좌석 단가 ₩12,000 → ₩12,500')).toBeVisible();
    await expect(page.getByText('현재 ₩12,500')).toBeVisible();
  });

  test('운영자가 올린 좌석 단가를 원장 화면이 그대로 말한다', async ({ page }) => {
    /*
      A-098이 있던 자리다. 0024가 `pricing_policies`를 운영자로 좁힌 뒤 원장은 그 값을 읽을 수
      없어서 학원 관리 화면이 **코드 상수**(`DEFAULT_PRICING`)를 서버 값처럼 말했다 — 단가를
      올려도 학원 화면만 옛 값을 말한다. 0034의 뷰로 그 길을 열었으니(D-148) 두 화면이 같은
      값을 말하는지 계정을 바꿔 가며 확인한다.
    */
    await login(page, 'admin');
    await page.getByRole('link', { name: '요금제' }).first().click();
    await expect(page.getByTestId('billing-academySeat-value')).toHaveText('₩12,000');
    await page.getByTestId('billing-academySeat-up').click();
    await expect(page.getByTestId('billing-academySeat-value')).toHaveText('₩12,500');

    await page.getByRole('link', { name: '개요' }).first().click();
    await page.getByText('로그아웃').first().click();
    await expect(page).toHaveURL(/\/login/);
    await loginHere(page, 'hanbit.director');

    await page.getByRole('link', { name: '학원 관리' }).first().click();
    await expect(page.getByTestId('academy-manage')).toBeVisible();
    await expect(page.getByText('요금과 이용 인원')).toBeVisible();
    // 좌석 단가 줄이 방금 올린 값을 말한다(예전에는 ₩12,000에 머물렀다).
    await expect(page.getByText('₩12,500').first()).toBeVisible();
    await expect(page.getByText('₩12,000')).toHaveCount(0);
  });

  test('학원 목록에서 학원 상세로 들어간다', async ({ page }) => {
    await login(page, 'admin');
    await page.getByRole('link', { name: '학원' }).first().click();
    await expect(page.getByTestId('admin-academies')).toBeVisible();
    await page.getByTestId('academy-row-한빛학원').click();
    /*
      **단정을 더했다**: 주소가 학원 이름에서 `id`(uuid)로 바뀌었다. 이름이 조인 키였을 때는
      학원 이름을 바꾸는 순간 링크가 죽었다(확정 정책의 영구 식별자 원칙과 같은 이유).
    */
    await expect(page).toHaveURL(/\/admin\/academy\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId('admin-academy')).toBeVisible();
    await expect(page.getByText('배정 학습 제출률')).toBeVisible();
    await expect(page.getByText(/학생 개인 학습 상세는 여기서 보지 않아요/)).toBeVisible();

    /*
      **가장 중요한 회귀**: 이 세 값은 fixture 조인 결과라 구조적으로 언제나 0이었는데 화면은
      `실측` 배지를 달고 있었다. 지금은 서버 제출 기록에서 오므로 0이 아니고, `실측` 배지도 없다
      (모든 값이 서버 기록이라 배지가 뜻을 잃었다 — `추정`만 남는다).
    */
    const rate = page.getByText(/^\d+\/\d+건$/).first();
    await expect(rate).toBeVisible();
    await expect(page.getByTestId('academy-class')).toContainText('고1 국어');
  });

  test('계정은 역할로 좁히고 검색한다', async ({ page }) => {
    await login(page, 'admin');
    await page.getByRole('link', { name: '계정' }).first().click();
    await expect(page.getByTestId('admin-users')).toBeVisible();
    await page.getByTestId('users-search').fill('doyun');
    await expect(page.getByTestId(`user-row-${sid('u_student_academy')}`)).toBeVisible();
    // 필터는 접혀 있다 — 검색이 이 화면의 목적이라 검색창이 맨 위다. 사람처럼 펼치고 고른다.
    await page.getByTestId('users-filter-toggle').click();
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
  test('대시보드 지표의 출처와 기록 기간을 밝힌다', async ({ page }) => {
    await login(page, 'admin');
    /*
      **단정이 바뀐 이유**: 지표가 합성 활동 데이터를 떠나 서버 집계가 됐다. 그래서
      `합성 활동 데이터로 계산한 값이에요`는 더 이상 화면에 없고, 있으면 거짓말이다.
      대신 두 가지를 확인한다 — ①어디서 온 값인지 ②활동 기록이 언제부터인지(기간을 밝히지
      않으면 작은 값이 하락으로 읽힌다). 매출이 추정이라는 고지는 그대로 남는다.
    */
    await expect(page.getByText(/계정·학원·콘텐츠·풀이는 서버 기록이고 요금은 추정이에요/)).toBeVisible();
    await expect(page.getByText(/결제·정산 기록이 아니에요/)).toBeVisible();
    // 첫 줄이 기간을 말한다. 같은 문장이 빈 상태 설명에도 나오므로 첫 번째만 본다.
    await expect(page.getByText(/활동 기록은 \d{4}-\d{2}-\d{2}부터예요/).first()).toBeVisible();
    // 합성 고지가 남아 있으면 화면이 사실과 다른 말을 한다.
    await expect(page.getByText(/합성 활동 데이터/)).toHaveCount(0);

    /*
      **원천이 없는 지표는 0이 아니라 이유를 쓴다.** 기록이 이탈 창(28일)+비교 주(7일)보다
      짧으면 이탈·Quick Ratio를 판정할 수 없고, 기록 시작 전에 가입한 코호트는 잔존을 관찰하지
      못했다. 두 자리 모두 문장이 값을 대신한다.
    */
    const cohort = page.getByTestId('admin-cohort');
    const growth = page.getByTestId('admin-growth');
    // 표가 비었으면 이유가 함께 있어야 한다(빈 표만 두면 "코호트가 없다"로 읽힌다).
    for (const table of [cohort, growth]) {
      const text = (await table.textContent()) ?? '';
      if (text.includes('아직')) expect(text).toMatch(/활동 기록|일치예요/);
    }
  });

  test('문제 등록을 그만두고 대시보드로 돌아갈 수 있다', async ({ page }) => {
    await login(page, 'admin');
    await gotoNewContent(page);
    await expect(page).toHaveURL(/\/admin\/new/);
    await page.getByTestId('new-title').fill('중간에 그만둘 문제');
    await page.getByTestId('screen-back').click();
    // 들어온 화면(콘텐츠 목록)으로 돌아간다. 등록은 그 화면의 행동이다.
    await expect(page).toHaveURL(/\/admin\/content$/);
  });

  test('총괄관리자만 접근할 수 있다', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('국어 문법 문제를 등록하면 콘텐츠 목록에 나타난다', async ({ page }) => {
    await login(page, 'admin');
    await expect(page).toHaveURL(/\/admin/);
    await createGrammarSet(page, 'E2E 문법 세트');
    // 등록 직후에는 이미 그 세트 상세에 있다. 목록에서도 찾을 수 있는지 확인한다.
    await page.getByRole('link', { name: '콘텐츠' }).click();
    await page.getByTestId('content-search').fill('E2E 문법 세트');
    /*
      제목 열은 어느 폭에서도 접히지 않는다(priority 1). `세부 유형`은 390에서 접히므로
      목록에서 단정하지 않고 상세에서 확인한다 — 표가 좁은 화면에서 열을 접는 것은 의도다.
    */
    await expect(page.getByText('E2E 문법 세트').first()).toBeVisible();
    await page.getByText('E2E 문법 세트').first().click();
    await expect(page).toHaveURL(/\/admin\/content\//);
    await expect(page.getByText(/어문 규정 - 맞춤법/).first()).toBeVisible();
  });

  /**
   * 원천이 사라진 지표는 **정직한 빈 상태**가 된다.
   *
   * 합성 활동 데이터를 버리면서 코호트 잔존·Quick Ratio·이탈·Activation은 "그 사람의 그 기간을
   * 실제로 기록했는가"에 걸리게 됐다. 화면과 지표 사전은 남기고 값 자리에 이유를 적는다 —
   * 0으로 채우면 "활동이 없다"로 읽히는데 사실은 "아직 모른다"다.
   */
  test('원천이 아직 없는 지표는 0이 아니라 이유를 보여 준다', async ({ page }) => {
    await login(page, 'admin');
    await page.getByTestId('admin-goto-metrics').click();
    await expect(page.getByTestId('admin-metrics')).toBeVisible();

    // 지표를 지우지 않는다 — 정의는 목록에 그대로 있다.
    await expect(page.getByTestId('metrics-list')).toContainText('Quick Ratio');
    await expect(page.getByTestId('metrics-list')).toContainText('Activation율');
    await expect(page.getByText(/지표를 지우지 않고 값만 비워요/)).toBeVisible();

    // 낼 수 없는 지표는 이름과 이유가 함께 나온다.
    await expect(page.getByText(/지금 값을 낼 수 없는 지표 \(\d+개\)/)).toBeVisible();

    // 판정할 수 없을 때 예측력 자리에 `0.00배`를 쓰지 않는다.
    const ratio = page.getByTestId('metrics-predict-ratio');
    await expect(ratio).toBeVisible();
    await expect(ratio).not.toContainText('0.00배');
  });

  test('오답률 알림을 누르면 그 기준으로 좁힌 콘텐츠 목록이 열린다', async ({ page }) => {
    await login(page, 'admin');
    // 개요가 세어 준 것과 같은 기준으로 좁혀서 보내야 한다. 쿼리가 없으면 세트를 하나씩 열어야 했다.
    await page.getByText(/오답률 70% 이상 문항 \d+개/).click();
    await expect(page).toHaveURL(/\/admin\/content\?wrong=70/);
    await expect(page.getByText(/오답률 70% 이상인 문항이 있는 세트만 남겼어요/)).toBeVisible();
    // 좁힌 동안에는 점검할 문항 수가 열로 나온다.
    await expect(page.getByRole('button', { name: /점검 문항/ }).first()).toBeVisible();

    // 넓히는 길이 화면에 있어야 한다.
    await page.getByTestId('content-wrong-clear').click();
    await expect(page).toHaveURL(/\/admin\/content$/);
    await expect(page.getByText(/오답률 70% 이상인 문항이 있는 세트만 남겼어요/)).toHaveCount(0);
  });

  test('등록한 문제가 학생에게 공개되어 풀 수 있다', async ({ page }) => {
    await login(page, 'admin');
    await createGrammarSet(page, '학생공개 국어 세트');

    // 로그아웃 후 학생으로 로그인 (앱 내 이동 유지 — 전체 새로고침하면 메모리 콘텐츠가 초기화됨)
    // 로그아웃은 개요에만 있다(`AccountSettings`). 등록을 마치면 콘텐츠 상세에 있으므로 먼저 개요로.
    await page.getByRole('link', { name: '개요' }).first().click();
    await page.getByText('로그아웃').first().click();
    await expect(page).toHaveURL(/\/login/);
    await loginHere(page, 'seojun');
    await expect(page).toHaveURL(/\/student/);

    // 관리자가 만든 학습을 학년 → 영역 → 유형 뎁스로 찾아 들어간다
    await page.getByRole('link', { name: '학습' }).click();
    await page.getByTestId('learn-pick').click();
    await page.getByTestId('learn-grade-2').click();
    await page.getByTestId('learn-area-문법').click();
    await page.getByTestId('learn-topic-어문 규정 - 맞춤법').click();
    await page.getByText('학생공개 국어 세트').first().click();
    await page.getByTestId('detail-start').click();
    await expect(page.getByText('다음 중 맞춤법이 바른 것은?').first()).toBeVisible();

    // 등록할 때 쓴 해설이 결과 화면에 그대로 보인다
    await choices(page, 1).first().click();
    await page.getByTestId('solve-submit').click();
    await expect(page).toHaveURL(/\/student\/result\//);
    await expect(page.getByText('"오랜만에"가 바른 표기예요.')).toBeVisible();
  });
});

/**
 * 계정 목록에서 한 계정을 찾아 사유를 적고 대리 보기를 시작한다.
 * 사유 유형 칩 + 사유 입력이 모두 있어야 시작 버튼이 렌더된다(D-071).
 */
/**
 * `oldId`는 seed의 옛 fixture id다(`sid`가 uuid로 바꾼다).
 *
 * 문의 번호는 늘 채운다 — 학부모·학원 계정은 남의 기록까지 열리므로 **필수**이고(D-149),
 * 학생 계정에서는 선택이라 채워도 흐름이 같다.
 */
async function impersonate(page: Page, oldId: string, search: string, why = '문의 재현 확인') {
  await page.getByRole('link', { name: '계정' }).first().click();
  await page.getByTestId('users-search').fill(search);
  await page.getByTestId(`user-row-${sid(oldId)}`).click();
  await page.locator('[data-testid^="impersonate-kind-"]').first().click();
  await page.getByTestId('impersonate-why').fill(why);
  await page.getByTestId('impersonate-ticket').fill('2026-0814-01');
  await page.getByTestId('impersonate-start').click();
}

test.describe('총괄관리자 대리 보기', () => {
  test('사유를 적어야 시작하고, 읽기 전용으로 보고, 끝내면 운영자로 돌아온다', async ({ page }) => {
    await login(page, 'admin');
    await page.getByRole('link', { name: '계정' }).click();
    await page.getByTestId('users-search').fill('doyun');
    await page.getByTestId(`user-row-${sid('u_student_academy')}`).click();
    await expect(page).toHaveURL(new RegExp(`/admin/user/${sid('u_student_academy')}`));

    // 사유가 비면 시작 버튼을 렌더하지 않는다 — 못 누르는 버튼을 띄워 두지 않는다.
    await expect(page.getByTestId('impersonate-start')).toHaveCount(0);
    await page.locator('[data-testid^="impersonate-kind-"]').first().click();
    await page.getByTestId('impersonate-why').fill('홈에 과제가 안 보인다는 문의');
    await page.getByTestId('impersonate-start').click();

    // 대상의 홈으로 가고 배너가 상시 보인다.
    await expect(page).toHaveURL(/\/student$/);
    await expect(page.getByTestId('impersonation-banner')).toContainText('박도윤');
    await expect(page.getByTestId('impersonation-banner')).toContainText('읽기 전용');

    // 읽기 전용: 답을 골라도 저장되지 않아 제출 버튼이 나타나지 않는다.
    await page.getByRole('link', { name: '학습' }).click();
    await page.getByText('현대소설 점검').first().click();
    await page.getByTestId('detail-start').click();
    await page
      .getByRole('radio', { name: /보기 1$/ })
      .first()
      .click();
    await expect(page.getByTestId('solve-submit')).toHaveCount(0);
    // 몰입 모드는 화면 장식을 걷어내지만 배너는 남아야 한다.
    await expect(page.getByTestId('impersonation-banner')).toBeVisible();

    /*
      끝내면 운영자 계정으로, **조사하던 계정 상세로** 돌아온다(학생 라우트에 남으면 역할 가드에
      걸린다). 예전에는 `/admin`(개요)이어서 그 계정의 열람 기록을 보거나 다시 열려면 계정 검색을
      처음부터 다시 해야 했다.
    */
    await page.getByTestId('impersonation-end').click();
    await expect(page).toHaveURL(new RegExp(`/admin/user/${sid('u_student_academy')}$`));
    await expect(page.getByTestId('admin-user')).toBeVisible();
    await expect(page.getByTestId('impersonation-banner')).toHaveCount(0);

    // 시작 사실이 운영 기록에 남는다.
    await page.getByRole('link', { name: '운영 기록' }).click();
    await expect(page.getByText(/대리 보기 시작/)).toBeVisible();
    await expect(page.getByText(/홈에 과제가 안 보인다는 문의/)).toBeVisible();
  });

  /**
   * 배너는 `toBeVisible`만으로는 지켜지지 않는다. 데스크톱 `RoleShell`이 `flexDirection: 'row'`
   * 컨테이너라 그 안의 첫 자식이던 배너는 **사이드바 왼쪽의 세로 띠**(폭 약 128px)로 눌렸고,
   * 그래도 `toBeVisible`은 통과했다 — 누구로 보는 중인지·남은 시간이 화면에서 사라진 상태였다.
   */
  test('배너는 상단 가로 막대이고 이름·읽기 전용·남은 시간이 잘리지 않는다', async ({ page }) => {
    await login(page, 'admin');
    await impersonate(page, 'u_student_academy', 'doyun');
    await expect(page).toHaveURL(/\/student$/);

    const viewport = page.viewportSize();
    const box = await page.getByTestId('impersonation-banner').boundingBox();
    expect(box).not.toBeNull();
    // 화면 폭을 거의 다 쓰는 가로 막대다(세로 띠가 아니다).
    expect(box!.width).toBeGreaterThan((viewport?.width ?? 0) * 0.9);
    expect(box!.height).toBeLessThan(120);

    // 남은 시간은 첫 줄의 고정 요소다. 사유는 잘려도 되고 시간은 잘려선 안 된다.
    await expect(page.getByTestId('impersonation-left')).toBeVisible();
    const cut = await page
      .getByTestId('impersonation-who')
      .evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(cut).toBe(false);
  });

  test('대리 중에는 오답노트 별표가 바뀌지 않는다', async ({ page }) => {
    await login(page, 'admin');
    // 정예린은 오답노트 시드가 있는 계정이다(개인·학원 오답 모두).
    await impersonate(page, 'u_student_both', 'yerin');
    await expect(page).toHaveURL(/\/student$/);

    await page.getByRole('link', { name: '학습' }).click();
    await page.getByTestId('learn-notebook').click();
    /*
      목록은 다섯 개까지 보여 주고 나머지는 `오답 N개 더 보기`로 펼친다(§8의 상한). 정예린은
      시드 오답이 여덟 개이고 정리하지 않은 것이 먼저 오므로 이 문항은 접힌 쪽에 있다.
      **조회가 끝날 때까지 기다린 뒤 누른다** — `isVisible()`로 물으면 아직 없는 동안 false가
      돌아와 펼치지 않고 지나간다.
    */
    const more = page.getByTestId('notebook-more');
    await expect(more).toBeVisible();
    await more.click();
    const star = page.getByTestId(`note-star-${sid('ct_lit_1_q7')}`);
    await expect(star).toHaveAttribute('aria-label', '별표 달기');
    await star.click();
    // 눌려도 그대로다 — 별표는 학생의 집중 복습 목록이라 운영자가 바꾸면 안 된다.
    await expect(star).toHaveAttribute('aria-label', '별표 달기');
  });

  test('대리 중에는 담아 둔 학습에 담기지 않는다', async ({ page }) => {
    await login(page, 'admin');
    await impersonate(page, 'u_student_both', 'yerin');

    await page.getByRole('link', { name: '학습' }).click();
    await page.getByTestId('learn-pick').click();
    await page.getByTestId('learn-grade-2').click();
    await page.getByTestId('learn-area-독서').click();
    await page.getByTestId('learn-topic-과학').click();

    const add = page.getByRole('checkbox', { name: '담아 두기' }).first();
    await expect(add).toBeVisible();
    await add.click();
    await expect(page.getByRole('checkbox', { name: '담아 둔 학습에서 빼기' })).toHaveCount(0);
  });

  test('대상의 내 정보에는 로그아웃이 아니라 대리 보기 끝내기가 있다', async ({ page }) => {
    await login(page, 'admin');
    await impersonate(page, 'u_student_both', 'yerin');

    await page.getByRole('link', { name: '내 정보' }).click();
    // 로그아웃을 그대로 두면 운영자 세션까지 끊기고 종료 기록도 남지 않는다(A-070).
    await expect(page.getByText('로그아웃')).toHaveCount(0);
    const end = page.getByTestId('settings-impersonation-end');
    await expect(end).toBeVisible();
    await end.click();
    await expect(page).toHaveURL(new RegExp(`/admin/user/${sid('u_student_both')}$`));
    await expect(page.getByTestId('impersonation-banner')).toHaveCount(0);
  });

  test('공간 선택 화면에서도 배너와 끝내기가 남는다', async ({ page }) => {
    await login(page, 'admin');
    // 다역할 계정은 대리 시작 직후 `/select-space`로 간다 — `RoleShell` 밖 화면이다.
    await impersonate(page, 'u_teacher_parent', 'jihoon');
    await expect(page).toHaveURL(/\/select-space/);
    await expect(page.getByTestId('select-space')).toBeVisible();

    const banner = page.getByTestId('impersonation-banner');
    await expect(banner).toContainText('한지훈');
    await expect(banner).toContainText('읽기 전용');
    await expect(page.getByTestId('impersonation-left')).toBeVisible();

    await page.getByTestId('impersonation-end').click();
    await expect(page).toHaveURL(new RegExp(`/admin/user/${sid('u_teacher_parent')}$`));
  });

  test('시작과 종료가 대리 보기 분류로 남고 종료 기록에 열어 본 화면 수가 있다', async ({ page }) => {
    await login(page, 'admin');
    await impersonate(page, 'u_student_academy', 'doyun');
    await page.getByRole('link', { name: '학습' }).click();
    await expect(page).toHaveURL(/\/student\/learn/);
    await page.getByTestId('impersonation-end').click();
    // 끝낸 자리가 시작한 자리다 — 그 계정의 열람 기록이 여기 있다.
    await expect(page).toHaveURL(new RegExp(`/admin/user/${sid('u_student_academy')}$`));
    await expect(page.locator('[data-testid^="user-audit-"]')).toHaveCount(2);

    await page.getByRole('link', { name: '운영 기록' }).click();
    // 기록이 생긴 분류만 칩이 된다(D-065). 대리 보기 칩이 실제로 생겨야 한다.
    const chip = page.getByTestId('ops-filter-대리 보기');
    await expect(chip).toBeVisible();
    await chip.click();
    await expect(page.getByText(/대리 보기 시작/)).toBeVisible();
    await expect(
      page.getByText(/대리 보기 종료 .*수동 종료 · 열어 본 화면 [1-9]\d*개/),
    ).toBeVisible();

    // 계정 상세의 `이 계정을 누가 열어 봤나`는 시작·종료 두 건을 그 계정 것만 보여준다.
    await page.getByRole('link', { name: '계정' }).first().click();
    await page.getByTestId('users-search').fill('doyun');
    await page.getByTestId(`user-row-${sid('u_student_academy')}`).click();
    await expect(page.locator('[data-testid^="user-audit-"]')).toHaveCount(2);
    // 열람 기록은 서버에서 `subject_id`로 좁혀 오므로 새로고침해도 두 건 그대로다.
    await page.reload();
    await expect(page.locator('[data-testid^="user-audit-"]')).toHaveCount(2);
  });

  test('학부모 계정은 열리는 범위를 말하고 문의 번호를 받아야 시작한다', async ({ page }) => {
    /*
      A-079가 있던 자리다. 학부모를 대리하면 **자녀 기록 전부**(오답노트 메모 본문 포함)가
      열리는데, 예전에는 화면이 그 사실을 말하지 않고 사유 유형도 학생과 똑같았다.
      지금은 ①범위를 먼저 말하고 ②`데이터 점검`을 두지 않고 ③문의 번호를 받는다(D-149).
    */
    await login(page, 'admin');
    await page.getByRole('link', { name: '계정' }).first().click();
    await page.getByTestId('users-search').fill('minji');
    await page.getByTestId(`user-row-${sid('u_parent')}`).click();

    // ① 무엇이 열리는지 시작 전에 말한다
    const scope = page.getByTestId('impersonate-scope');
    await expect(scope).toContainText('연결된 자녀의 학습 기록 전부');
    // 메모 본문은 대리 보기에서 가려진다(D-071) — 범위 문장이 그 사실을 말한다.
    await expect(scope).toContainText('메모 본문은 가려요');

    // ② 넓게 여는 대상에는 `데이터 점검`을 두지 않는다
    await expect(page.getByTestId('impersonate-kind-자녀 리포트 문의')).toBeVisible();
    await expect(page.getByTestId('impersonate-kind-데이터 점검')).toHaveCount(0);

    // ③ 사유만 적어도 시작할 수 없다 — 문의 번호가 필요하다
    await page.getByTestId('impersonate-kind-자녀 리포트 문의').click();
    await page.getByTestId('impersonate-why').fill('자녀 리포트가 비어 있다는 문의');
    await expect(page.getByTestId('impersonate-start')).toHaveCount(0);
    await expect(page.getByText(/문의 번호를 적으면 시작할 수 있어요/)).toBeVisible();

    await page.getByTestId('impersonate-ticket').fill('2026-0814-77');
    await page.getByTestId('impersonate-start').click();
    await expect(page).toHaveURL(/\/parent$/);

    /*
      **문장이 아니라 벽을 시험한다.** 위 단정은 화면이 `메모 본문은 가려요`라고 **말하는지**만
      본다 — 마스크(`progress.tsx`의 `maskDig`)를 지워도 통과한다. 그래서 실제로 가려지는지를
      자녀 리포트에서 확인한다: `ChildReport`는 메모가 있을 때만 그 블록을 그린다.
    */
    await page.getByRole('link', { name: '리포트' }).first().click();
    await expect(page.getByTestId('parent-report')).toBeVisible();
    await expect(page.getByText('자녀가 정리한 메모')).toHaveCount(0);

    // 열람 범위가 운영 기록에 남는다 — 화면이 말한 문장과 같은 문장이다
    await page.getByTestId('impersonation-end').click();
    await expect(page).toHaveURL(new RegExp(`/admin/user/${sid('u_parent')}$`));
    await page.getByRole('link', { name: '운영 기록' }).first().click();
    await expect(
      page.getByText(/열람 범위: 연결된 자녀의 학습 기록 전부/).first(),
    ).toBeVisible();
    await expect(page.getByText(/문의 2026-0814-77/).first()).toBeVisible();
  });

  test('대리 중에는 학원 문제를 등록할 수 없다', async ({ page }) => {
    await login(page, 'admin');
    await impersonate(page, 'u_academy_director', 'hanbit.director');
    await expect(page).toHaveURL(/\/academy$/);

    await page.getByRole('link', { name: '문제' }).click();
    await page.getByTestId('academy-content-new').click();
    await page.getByTestId('new-kind-grammar').click();
    await page.getByTestId('new-title').fill('대리 중 등록 시도');
    await page.getByTestId('new-q0-prompt').fill('다음 중 맞춤법이 바른 것은?');
    for (let ci = 0; ci < 4; ci++) await page.getByTestId(`new-q0-c${ci}`).fill(`보기 ${ci + 1}`);
    await page.getByTestId('new-save').click();

    // 완료 화면으로 넘어가지 않고 거부한 이유를 말한다 — 등록된 것처럼 보이면 안 된다.
    await expect(page.getByTestId('new-refused')).toBeVisible();
    await expect(page.getByText('문제를 등록했어요')).toHaveCount(0);
  });

  /**
   * 대리 중 관리자 화면으로 되돌아가면 대상에게 admin 역할이 없어 `/login`으로 가드된다.
   * 운영자는 로그아웃된 줄 알고 다시 로그인한다 — 그때 대리 상태가 남아 있으면 방금 로그인한
   * 사람의 화면이 **남의 이름으로 읽기 전용**이 되고 쓰기가 조용히 거부됐다(A-053).
   */
  test('가드된 로그인 화면에도 배너가 남고, 다시 로그인하면 대리 상태가 지워진다', async ({
    page,
  }) => {
    await login(page, 'admin');
    await impersonate(page, 'u_student_both', 'yerin');
    await expect(page).toHaveURL(/\/student$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/login/);
    // 상태가 어긋난 것을 운영자가 화면에서 알 수 있다.
    await expect(page.getByTestId('impersonation-banner')).toContainText('정예린');

    await loginHere(page, 'yerin');
    await expect(page).toHaveURL(/\/student$/);
    await expect(page.getByTestId('impersonation-banner')).toHaveCount(0);

    // 방금 로그인한 사람의 쓰기가 살아 있다.
    await page.getByRole('link', { name: '학습' }).click();
    await page.getByTestId('learn-notebook').click();
    /*
      목록은 다섯 개까지 보여 주고 나머지는 `오답 N개 더 보기`로 펼친다(§8의 상한). 정예린은
      시드 오답이 여덟 개이고 정리하지 않은 것이 먼저 오므로 이 문항은 접힌 쪽에 있다.
      **조회가 끝날 때까지 기다린 뒤 누른다** — `isVisible()`로 물으면 아직 없는 동안 false가
      돌아와 펼치지 않고 지나간다.
    */
    const more = page.getByTestId('notebook-more');
    await expect(more).toBeVisible();
    await more.click();
    const star = page.getByTestId(`note-star-${sid('ct_lit_1_q7')}`);
    await expect(star).toHaveAttribute('aria-label', '별표 달기');
    await star.click();
    await expect(star).toHaveAttribute('aria-label', '별표 빼기');
  });
});
