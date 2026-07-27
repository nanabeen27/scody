import { test, expect, type Page } from '@playwright/test';
import { loginHere } from './_auth';

async function loginAs(page: Page, scodyId: string) {
  await page.goto('/login');
  await loginHere(page, scodyId);
  await expect(page).toHaveURL(/\/student/);
}

/** 학습 탭에서 고1 → 문법 → 맞춤법 유형까지 뎁스를 타고 들어간다. */
async function pickSpellingSet(page: Page) {
  await page.getByRole('link', { name: '학습' }).click();
  await page.getByTestId('learn-grade-1').click();
  await page.getByTestId('learn-area-문법').click();
  await page.getByTestId('learn-topic-어문 규정 - 맞춤법').click();
}

test.describe('M2 학생 국어 학습 흐름', () => {
  test('지문형 학습: 지문을 읽고 풀어 제출한다', async ({ page }) => {
    await loginAs(page, 'seojun'); // 김서준, 개인 학습
    await page.getByText('시작하기').click();
    await expect(page).toHaveURL(/\/student\//);
    await expect(page.getByText('지문형')).toBeVisible();
    await page.getByTestId('detail-start').click();
    await expect(page).toHaveURL(/\/student\/solve\//);
    // 지문이 보인다
    await expect(page.getByText(/비판적 읽기는 글쓴이의 주장과 근거/)).toBeVisible();

    const radios = page.getByRole('radio');
    const count = await radios.count();
    const questions = count / 4;
    for (let q = 0; q < questions; q++) {
      await radios.nth(q * 4).click();
    }
    await page.getByTestId('solve-submit').click();
    await expect(page).toHaveURL(/\/student\/result\//);
    await expect(page.getByText('다 풀었어요!')).toBeVisible();
    await page.getByTestId('result-done').click();
    await expect(page).toHaveURL(/\/student$/);
  });

  test('문법형 학습도 풀 수 있다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await pickSpellingSet(page);
    await page.getByText('헷갈리는 맞춤법·어법').first().click();
    await page.getByTestId('detail-start').click();
    await expect(page.getByText('1. 맞춤법이 바른 문장은?')).toBeVisible();
  });

  test('제출 후 상세로 돌아오면 결과를 다시 볼 수 있다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await page.getByText('시작하기').click();
    const detailUrl = page.url();
    await page.getByTestId('detail-start').click();

    const radios = page.getByRole('radio');
    const questions = (await radios.count()) / 4;
    for (let q = 0; q < questions; q++) await radios.nth(q * 4).click();
    await page.getByTestId('solve-submit').click();
    await expect(page).toHaveURL(/\/student\/result\//);

    // 결과에서 뒤로가면 상세로 온다. 여기서 결과로 다시 갈 수 있어야 한다.
    await page.goBack();
    await expect(page).toHaveURL(detailUrl);
    await expect(page.getByTestId('detail-result')).toBeVisible();
    await page.getByTestId('detail-result').click();
    await expect(page).toHaveURL(/\/student\/result\//);
    await expect(page.getByText('다 풀었어요!')).toBeVisible();
  });

  test('풀이 중 나중에 다시 풀기를 누르면 들어온 상세 화면으로 돌아간다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await pickSpellingSet(page);
    await page.getByText('헷갈리는 맞춤법·어법').first().click();
    const detailUrl = page.url();
    await page.getByTestId('detail-start').click();
    await expect(page).toHaveURL(/\/student\/solve\//);

    await page.getByTestId('focus-exit').click();
    await expect(page).toHaveURL(detailUrl);
  });

  test('제출한 학습을 다시 풀기 전에 기록이 바뀐다고 알려준다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await page.getByText('시작하기').click();
    await page.getByTestId('detail-start').click();
    const radios = page.getByRole('radio');
    const questions = (await radios.count()) / 4;
    for (let q = 0; q < questions; q++) await radios.nth(q * 4).click();
    await page.getByTestId('solve-submit').click();
    await page.goBack();

    // 확인 단계 없이 바로 풀이로 넘어가지 않는다
    await page.getByTestId('detail-retry').click();
    await expect(page.getByText(/기록.*새 결과로 바뀌어요/)).toBeVisible();
    await page.getByText('그대로 둘게요').click();
    await expect(page.getByTestId('detail-retry')).toBeVisible();

    await page.getByTestId('detail-retry').click();
    await page.getByTestId('detail-start').click();
    await expect(page).toHaveURL(/\/student\/solve\//);
  });

  test('학습 상세에서 뒤로 버튼으로 들어온 화면으로 돌아간다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await pickSpellingSet(page);
    const learnUrl = page.url();
    await page.getByText('헷갈리는 맞춤법·어법').first().click();
    await expect(page.getByTestId('screen-back')).toBeVisible();
    await page.getByTestId('screen-back').click();
    await expect(page).toHaveURL(learnUrl);
  });

  test('좌측 상단 Scody를 누르면 홈으로 돌아간다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await pickSpellingSet(page);
    await expect(page).toHaveURL(/\/student\/learn/);
    await page.getByTestId('brand-home').click();
    await expect(page).toHaveURL(/\/student$/);
  });

  test('기록이 비어 있으면 학습을 고르러 갈 수 있다', async ({ page }) => {
    await loginAs(page, 'doyun'); // 아직 푼 학습이 없는 학생
    await page.getByRole('link', { name: '기록' }).click();
    await expect(page.getByText(/아직 제출한 학습이 없어요/)).toBeVisible();
    await page.getByTestId('records-empty-start').click();
    await expect(page).toHaveURL(/\/student\/learn/);
    // 학습 탭에서 학년부터 고르는 뎁스가 보인다
    await expect(page.getByText('학원 학습', { exact: true })).toBeVisible();
    await expect(page.getByText(/학년 → 영역 → 유형 순으로 골라요/)).toBeVisible();
    // 학원이 결제하는 학생에게 '결제해야 쓸 수 있다'처럼 읽히는 문구를 띄우지 않는다
    await expect(page.getByText(/월정액을 시작하면 개인 국어 학습을 이용할 수 있어요/)).toHaveCount(0);
    await expect(page.getByText(/이용권으로 학원 학습을 이용하고 있어요/)).toBeVisible();
  });

  test('오답노트 삭제는 한 번 더 확인한다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await page.getByText('시작하기').click();
    await page.getByTestId('detail-start').click();
    const radios = page.getByRole('radio');
    const questions = (await radios.count()) / 4;
    for (let q = 0; q < questions; q++) await radios.nth(q * 4).click();
    await page.getByTestId('solve-submit').click();
    await page.getByText('담기').first().click();
    await page.getByTestId('result-notebook').click();
    await expect(page).toHaveURL(/\/student\/notebook/);

    const question = page.getByText('윗글의 중심 내용으로 가장 적절한 것은?');
    await expect(question).toBeVisible();
    // 지문형 오답이면 지문도 맨 위에 함께 보인다
    await expect(page.getByText(/비판적 읽기는 글쓴이의 주장과 근거/)).toBeVisible();

    await page.getByText('오답노트에서 빼기').first().click();
    await expect(question).toBeVisible(); // 확인 전에는 지워지지 않는다
    await page.getByText('그대로 둘게요').click();
    await expect(question).toBeVisible();

    await page.getByText('오답노트에서 빼기').first().click();
    await page.getByText('메모까지 지울게요').click();
    await expect(question).toHaveCount(0);
    await expect(page.getByText('오답노트에서 뺏어요.')).toBeVisible();
    await expect(page.getByText('담아 둔 오답이 없어요.')).toBeVisible();
  });

  test('세션 없이 학습 URL로 직접 들어오면 로그인으로 보낸다', async ({ page }) => {
    await page.goto('/student/result/does-not-exist');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId('login-phone')).toBeVisible();
  });

  test('풀이 중 이탈 후 돌아오면 선택이 유지된다(자동 저장)', async ({ page }) => {
    await loginAs(page, 'seojun');
    await page.getByText('시작하기').click();
    await page.getByTestId('detail-start').click();
    await expect(page.getByText(/^0 \/ \d+ 풀었어요$/)).toBeVisible();
    await page.getByRole('radio').nth(1).click();
    await expect(page.getByText(/^1 \/ \d+ 풀었어요$/)).toBeVisible();
    await page.goBack();
    await page.getByTestId('detail-start').click();
    await expect(page.getByText(/^1 \/ \d+ 풀었어요$/)).toBeVisible();
  });

  test('오답노트: 요약 버튼이 추가됨 상태로 바뀌고 마무리에서 남은 문제를 알려준다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await page.getByText('시작하기').click();
    await page.getByTestId('detail-start').click();
    const radios = page.getByRole('radio');
    const questions = (await radios.count()) / 4;
    for (let q = 0; q < questions; q++) await radios.nth(q * 4).click();
    await page.getByTestId('solve-submit').click();
    // 오답 두 개를 담는다
    await page.getByText('담기').nth(0).click();
    await page.getByText('담기').nth(0).click();
    await page.getByTestId('result-notebook').click();

    // 마무리하기 버튼은 맨 아래에 있고, 안 한 문제가 있으면 알려준다
    await page.getByTestId('notebook-wrapup').click();
    await expect(
      page.getByText('오답노트를 안 한 문제들이 있어요. 나중에 오답노트 하시겠어요?'),
    ).toBeVisible();
    await page.getByTestId('wrapup-continue').click();

    // 물어보기 → 답변 뒤 노트 정리 → 버튼이 완료 상태로 바뀐다
    const firstAsk = page.locator('[data-testid^="ask-ct_read_1_q"]').first();
    await firstAsk.fill('왜 이 답이 정답인가요?');
    const send = page.locator('[data-testid^="send-ct_read_1_q"]').first();
    await send.click();
    const summ = page.locator('[data-testid^="summ-ct_read_1_q"]').first();
    await expect(summ).toBeVisible();
    await expect(summ.getByText('노트에 정리해 두기')).toBeVisible();
    await summ.click();
    await expect(page.getByText('노트에 추가됐어요')).toBeVisible();
    await expect(page.getByText('내 오답노트 메모')).toBeVisible();
  });

  test('질문 입력창: 글자를 넣으면 입력창 안 오른쪽에 보내기 버튼이 생긴다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await page.getByTestId('home-ask').click();
    await expect(page).toHaveURL(/\/student\/ask/);

    // 비어 있으면 버튼이 없다
    await expect(page.getByTestId('ask-submit')).toHaveCount(0);

    await page.getByTestId('ask-input').fill('비판적 읽기가 뭔가요?');
    const send = page.getByTestId('ask-submit');
    await expect(send).toBeVisible();
    // 입력창 오른쪽 안쪽에 놓인다
    const input = await page.getByTestId('ask-input').boundingBox();
    const btn = await send.boundingBox();
    expect(btn!.x).toBeGreaterThan(input!.x + input!.width / 2);
    expect(btn!.x + btn!.width).toBeLessThanOrEqual(input!.x + input!.width + 1);

    await send.click();
    await expect(page.getByTestId('ask-answer')).toBeVisible();
    // 보낸 뒤 입력이 비면 버튼도 사라진다
    await page.getByTestId('ask-input').fill('');
    await expect(page.getByTestId('ask-submit')).toHaveCount(0);
  });

  test('기록의 오답노트 학습 섹션 → 카드 복습에서 다시 풀고 별표로 집중 복습한다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await page.getByText('시작하기').click();
    await page.getByTestId('detail-start').click();
    const radios = page.getByRole('radio');
    const questions = (await radios.count()) / 4;
    for (let q = 0; q < questions; q++) await radios.nth(q * 4).click();
    await page.getByTestId('solve-submit').click();
    await page.getByText('담기').nth(0).click();
    await page.getByText('담기').nth(0).click();

    // 기록 탭에 오답노트로 공부하기 섹션이 있다(모아보기 버튼이 아니라 섹션)
    await page.getByRole('link', { name: '기록' }).click();
    await expect(page.getByText('오답노트로 공부하기')).toBeVisible();
    await expect(page.getByText(/오답 \d+개 · 별표 \d+개 · 메모 정리 \d+개/)).toBeVisible();
    // 카테고리(영역)별로 고를 수 있다
    await expect(page.getByTestId('review-area-독서')).toBeVisible();

    // 카드 복습: 다시 풀면 정답과 내 메모 자리를 보여준다
    await page.getByTestId('records-review').click();
    await expect(page).toHaveURL(/\/student\/review/);
    await expect(page.getByText('답을 고르면 정답과 내 메모를 함께 볼 수 있어요.')).toBeVisible();
    await page.getByTestId('review-choice-1').click();
    await expect(page.getByText(/이번엔 맞혔어요|아직 헷갈려요/)).toBeVisible();
    await expect(page.getByText('더 파고들기')).toBeVisible();

    // 별표를 달면 집중 복습 목록에 들어간다
    await page.getByRole('button', { name: '별표 달기' }).click();
    await page.getByTestId('review-next').click();
    await page.getByRole('link', { name: '기록' }).click();
    const starred = page.getByTestId('records-review-starred');
    await expect(starred).toBeVisible();
    await starred.click();
    await expect(page.getByText('별표 집중 복습')).toBeVisible();
    await expect(page.getByText(/1 \/ 1/)).toBeVisible();
  });

  test('오답노트: 카테고리 칩으로 걸러 보고 학원 오답은 학원에도 전달된다', async ({ page }) => {
    // 학원 과제를 풀고 오답을 담으면 학원 성과 분석에서 볼 수 있다(배정 학습만)
    await page.goto('/login');
    await loginHere(page, 'doyun');

    await page.getByRole('link', { name: '학습' }).click();
    await page.getByText('현대소설 점검').click();
    await page.getByTestId('detail-start').click();
    const radios = page.getByRole('radio');
    const questions = (await radios.count()) / 4;
    for (let q = 0; q < questions; q++) await radios.nth(q * 4).click();
    await page.getByTestId('solve-submit').click();
    const noteRow = page.getByText('담기').first();
    await noteRow.click();

    await page.getByRole('link', { name: '내 정보' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'hanbit.director');

    await page.getByRole('link', { name: '성과 분석' }).click();
    await expect(page.getByText(/배정 학습 오답노트 [1-9]\d*개/)).toBeVisible();
    await expect(page.getByText('박도윤', { exact: false }).first()).toBeVisible();
  });
});
