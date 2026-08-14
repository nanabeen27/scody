import { test, expect } from './_fixtures';
import { type Page } from '@playwright/test';
import { loginHere } from './_auth';
import { actThenToast, waitForQuietToast } from './_toast';
import { answerAll, keepWrongNotes, openFirstPersonal } from './_solve';
import { assignLearning, expectAssigned } from './_assign';
import { dayFromToday, sid } from './_ids';

async function loginAs(page: Page, scodyId: string) {
  await page.goto('/login');
  await loginHere(page, scodyId);
  await expect(page).toHaveURL(/\/student/);
}

/** 학습 탭 → 고르기 페이지에서 고1 → 문법 → 맞춤법 유형까지 뎁스를 타고 들어간다. */
async function pickSpellingSet(page: Page) {
  await page.getByRole('link', { name: '학습' }).click();
  await page.getByTestId('learn-pick').click();
  await page.getByTestId('learn-grade-1').click();
  await page.getByTestId('learn-area-문법').click();
  await page.getByTestId('learn-topic-어문 규정 - 맞춤법').click();
}

test.describe('M2 학생 국어 학습 흐름', () => {
  test('지문형 학습: 지문을 읽고 풀어 제출한다', async ({ page }) => {
    await loginAs(page, 'seojun'); // 김서준, 개인 학습
    await openFirstPersonal(page);
    await expect(page).toHaveURL(/\/student\//);
    await expect(page.getByText('지문형')).toBeVisible();
    await page.getByTestId('detail-start').click();
    await expect(page).toHaveURL(/\/student\/solve\//);
    // 지문이 보인다
    await expect(page.getByText(/비판적 읽기는 글쓴이의 주장과 근거/)).toBeVisible();
    // 문항은 한 번에 5개까지만 나온다
    await expect(page.getByRole('radio', { name: /보기 1$/ })).toHaveCount(5);

    await answerAll(page);
    await page.getByTestId('solve-submit').click();
    await expect(page).toHaveURL(/\/student\/result\//);
    await expect(page.getByText('다 풀었어요.')).toBeVisible();
    await page.getByTestId('result-done').click();
    await expect(page).toHaveURL(/\/student$/);
  });

  test('문법형 학습도 풀 수 있다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await pickSpellingSet(page);
    await page.getByText('헷갈리는 맞춤법·어법').first().click();
    await page.getByTestId('detail-start').click();
    // 번호와 발문은 따로 놓인다(발문이 길어도 번호 아래로 흐르지 않게)
    await expect(page.getByText('맞춤법이 바른 문장은?').first()).toBeVisible();
    await expect(page.getByText(/1–5번 문항/)).toBeVisible();
  });

  test('문항을 5개씩 보거나 한 문항씩 보면서 풀 수 있다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await openFirstPersonal(page);
    await page.getByTestId('detail-start').click();

    // 기본은 5문항씩
    const firstChoices = page.getByRole('radio', { name: /보기 1$/ });
    await expect(firstChoices).toHaveCount(5);
    await expect(page.getByText('1 / 2')).toBeVisible();

    // 다음 페이지로 넘어가면 6번부터 나온다
    await page.getByTestId('solve-next').click();
    await expect(page.getByText(/6–\d+번 문항/)).toBeVisible();
    await expect(page.getByTestId('solve-next')).toHaveCount(0); // 마지막 페이지
    await page.getByTestId('solve-prev').click();
    await expect(page.getByText(/1–5번 문항/)).toBeVisible();

    // 한 문항씩 모드: 한 문제만 나오고 다음 버튼으로 넘어간다
    await page.getByTestId('solve-mode-one').click();
    await expect(firstChoices).toHaveCount(1);
    await expect(page.getByText('1번 문항')).toBeVisible();
    await page.getByTestId('solve-next').click();
    await expect(page.getByText('2번 문항')).toBeVisible();
    await expect(firstChoices).toHaveCount(1);

    // 다시 5문항씩으로 돌아오면 보던 문항이 들어 있는 페이지가 보인다
    await page.getByTestId('solve-mode-five').click();
    await expect(page.getByText(/1–5번 문항/)).toBeVisible();
  });

  test('제출 버튼은 문항을 다 푼 뒤에 나타난다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await openFirstPersonal(page);
    await page.getByTestId('detail-start').click();

    // 아직 아무것도 안 풀었으면 제출 버튼이 없다
    await expect(page.getByTestId('solve-submit')).toHaveCount(0);

    // 첫 페이지만 풀어도 아직 나오지 않는다
    const firstChoices = page.getByRole('radio', { name: /보기 1$/ });
    const count = await firstChoices.count();
    for (let i = 0; i < count; i++) await firstChoices.nth(i).click();
    await expect(page.getByTestId('solve-submit')).toHaveCount(0);

    // 마지막 문항까지 채우면 그때 나타난다
    await page.getByTestId('solve-next').click();
    const rest = page.getByRole('radio', { name: /보기 1$/ });
    const restCount = await rest.count();
    for (let i = 0; i < restCount; i++) await rest.nth(i).click();
    await expect(page.getByTestId('solve-submit')).toBeVisible();
  });

  test('이전과 다음 버튼의 크기가 같다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await openFirstPersonal(page);
    await page.getByTestId('detail-start').click();
    await page.getByTestId('solve-next').click();

    // 두 번째 페이지에는 이전만 있으므로 한 문항씩 모드에서 둘이 함께 보이는 지점을 쓴다
    await page.getByTestId('solve-mode-one').click();
    await page.getByTestId('solve-next').click();
    const prev = await page.getByTestId('solve-prev').boundingBox();
    const next = await page.getByTestId('solve-next').boundingBox();
    expect(prev!.height).toBeCloseTo(next!.height, 0);
    // 한쪽이 칸 전체로 늘어나면 폭이 두 배 이상 벌어진다
    expect(prev!.width).toBeLessThan(next!.width * 2);
  });

  test('오답노트에 담으면 담았다고 알려주고 알림은 스스로 사라진다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await openFirstPersonal(page);
    await page.getByTestId('detail-start').click();
    await answerAll(page);
    await page.getByTestId('solve-submit').click();

    const toast = page.getByTestId('toast');
    await expect(toast).toHaveCount(0);

    await page.getByRole('checkbox', { name: '오답노트에 담기' }).first().click();
    await expect(toast).toHaveText('문항을 오답노트에 담았어요');

    // 다시 누르면 뺐다고 알려준다
    await page.getByRole('checkbox', { name: '오답노트에서 빼기' }).first().click();
    await expect(toast).toHaveText('오답노트에서 뺐어요');

    // 누르지 않아도 사라진다
    await expect(toast).toHaveCount(0, { timeout: 6000 });
  });

  test('결과의 문항 리뷰는 다섯 개까지 보여주고 나머지는 펼쳐서 본다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await openFirstPersonal(page);
    await page.getByTestId('detail-start').click();
    await answerAll(page);
    await page.getByTestId('solve-submit').click();
    await expect(page).toHaveURL(/\/student\/result\//);

    // 리뷰 카드는 `N번` 머리글로 센다(문항 하나에 하나).
    const cards = page.getByText(/^\d+번$/);
    // 기본은 틀린 문항이고(D-030) 이 세트는 다섯 개를 넘지 않아 접을 것이 없다.
    const wrongCount = await cards.count();
    expect(wrongCount).toBeLessThanOrEqual(5);
    await expect(page.getByTestId('result-review-more')).toHaveCount(0);

    // 전체 10문항으로 넓히면 다섯 개만 남고 나머지는 제목 옆에서 펼친다
    await page.getByTestId('result-scope-all').click();
    await expect(cards).toHaveCount(5);
    const more = page.getByTestId('result-review-more');
    await expect(more).toHaveText('5개 더 보기');

    await more.click();
    await expect(cards).toHaveCount(10);
    await expect(more).toHaveText('접기');

    // 접으면 다시 다섯 개다
    await more.click();
    await expect(cards).toHaveCount(5);
  });

  test('제출 후 상세로 돌아오면 결과를 다시 볼 수 있다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await openFirstPersonal(page);
    const detailUrl = page.url();
    await page.getByTestId('detail-start').click();

    await answerAll(page);
    await page.getByTestId('solve-submit').click();
    await expect(page).toHaveURL(/\/student\/result\//);

    // 결과에서 뒤로가면 상세로 온다. 여기서 결과로 다시 갈 수 있어야 한다.
    await page.goBack();
    await expect(page).toHaveURL(detailUrl);
    await expect(page.getByTestId('detail-result')).toBeVisible();
    await page.getByTestId('detail-result').click();
    await expect(page).toHaveURL(/\/student\/result\//);
    await expect(page.getByText('다 풀었어요.')).toBeVisible();
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
    await openFirstPersonal(page);
    await page.getByTestId('detail-start').click();
    await answerAll(page);
    await page.getByTestId('solve-submit').click();
    await page.goBack();

    // 확인 단계 없이 바로 풀이로 넘어가지 않는다
    await page.getByTestId('detail-retry').click();
    await expect(page.getByText(/기록.*새 결과로 바뀌어요/)).toBeVisible();
    // 확인 단계의 형태는 앱에 하나뿐이다(`ConfirmStep`) — 되돌리는 쪽은 어디서나 `취소`다.
    await page.getByRole('button', { name: '취소' }).click();
    await expect(page.getByTestId('detail-retry')).toBeVisible();

    await page.getByTestId('detail-retry').click();
    await page.getByTestId('detail-start').click();
    await expect(page).toHaveURL(/\/student\/solve\//);
  });

  test('다시 풀기로 들어가면 지난 답이 지워지고 다 풀어야 제출할 수 있다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await openFirstPersonal(page);
    await page.getByTestId('detail-start').click();
    await answerAll(page);
    await page.getByTestId('solve-submit').click();
    await page.goBack();

    await page.getByTestId('detail-retry').click();
    await page.getByTestId('detail-start').click();
    await expect(page).toHaveURL(/\/student\/solve\//);

    // 지난 답이 칠해져 있지 않고, 제출 버튼도 아직 없다
    await expect(page.getByText(/0 \/ \d+ 풀었어요/)).toBeVisible();
    await expect(page.locator('[role="radio"][aria-checked="true"]')).toHaveCount(0);
    await expect(page.getByTestId('solve-submit')).toHaveCount(0);

    // 다시 다 풀면 그때 제출할 수 있다
    await answerAll(page);
    await page.getByTestId('solve-submit').click();
    await expect(page).toHaveURL(/\/student\/result\//);
  });

  test('이어서 풀기는 풀던 답이 그대로 남는다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await pickSpellingSet(page);
    await page.getByText('헷갈리는 맞춤법·어법').first().click();
    await page.getByTestId('detail-start').click();
    await page.getByRole('radio', { name: /보기 1$/ }).first().click();
    await page.getByTestId('focus-exit').click();

    await expect(page.getByTestId('detail-start')).toContainText('이어서 풀기');
    await page.getByTestId('detail-start').click();
    await expect(page.locator('[role="radio"][aria-checked="true"]')).toHaveCount(1);
  });

  test('학습 상세에서 뒤로 버튼으로 들어온 화면으로 돌아간다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await pickSpellingSet(page);
    const pickUrl = page.url();
    await page.getByText('헷갈리는 맞춤법·어법').first().click();
    await expect(page.getByTestId('screen-back')).toBeVisible();
    await page.getByTestId('screen-back').click();
    await expect(page).toHaveURL(pickUrl);
  });

  test('좌측 상단 Scody를 누르면 홈으로 돌아간다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await pickSpellingSet(page);
    await expect(page).toHaveURL(/\/student\/pick/);
    await page.getByTestId('brand-home').click();
    await expect(page).toHaveURL(/\/student$/);
  });

  test('학습 탭은 학원 학습을 먼저 보여주고 고르기는 별도 화면으로 넘긴다', async ({ page }) => {
    await loginAs(page, 'yerin'); // 개인 + 학원
    await page.getByRole('link', { name: '학습' }).click();

    // 학원 과제가 개인 학습보다 위에 있다(정해진 일이 먼저)
    const academy = await page.getByText('학원 학습', { exact: true }).boundingBox();
    const personal = await page.getByText('개인 학습', { exact: true }).first().boundingBox();
    expect(academy!.y).toBeLessThan(personal!.y);

    // 탭을 열자마자 학년 카테고리가 펼쳐져 있지 않다
    await expect(page.getByTestId('learn-grade-1')).toHaveCount(0);
    await page.getByTestId('learn-pick').click();
    await expect(page).toHaveURL(/\/student\/pick/);
    await expect(page.getByTestId('learn-grade-1')).toBeVisible();

    // 뒤로가기는 한 단계씩 물러나고, 첫 단계에서는 학습 탭으로 돌아간다
    await page.getByTestId('learn-grade-1').click();
    await page.getByTestId('screen-back').click();
    await expect(page.getByTestId('learn-grade-1')).toBeVisible();
    await page.getByTestId('screen-back').click();
    await expect(page).toHaveURL(/\/student\/learn/);
  });

  test('학습 탭 학원 목록은 마감이 이른 것부터 세 줄까지 보여준다', async ({ page }) => {
    // 정예린: 학원 과제 4개. seed가 마감을 오늘 기준 상대 간격으로 놓는다(가장 이른 것이 -8일).
    await loginAs(page, 'yerin');
    await page.getByRole('link', { name: '학습' }).click();

    // 세 줄까지만. 나머지는 더 보기 안에 있다 — 주요 행동이 화면 밖으로 밀리지 않게.
    const more = page.getByTestId('learn-academy-more');
    await expect(more).toBeVisible();

    /*
      급한 것부터: 마감이 가장 이른 `독서 - 비판적 읽기 점검`(-8일)이 가장 늦은
      `문법 - 맞춤법 점검`(-3일)보다 위에 있다.

      **날짜 문구로 세우지 않는다.** 목록 행도 이제 오늘 기준으로 말하므로(D-142) 마감이 지난
      네 과제가 모두 `마감이 지났어요`라 서로 구분되지 않는다. 예전 단정은 `7월 20일 마감`처럼
      고정 날짜였는데 seed가 상대 날짜로 바뀌면서 이미 깨져 있었다(기준 실패).
    */
    const first = await page.getByText('독서 - 비판적 읽기 점검').boundingBox();
    await more.click();
    const last = await page.getByText('문법 - 맞춤법 점검').boundingBox();
    expect(first!.y).toBeLessThan(last!.y);

    /*
      정예린은 네 과제를 모두 냈다. **낸 과제에는 지난 마감을 경고하지 않는다**(D-142) —
      날짜와 정답률만 남는다. 마감이 지났다고 말하는 것은 아직 남은 과제뿐이다
      (박도윤으로 확인한다: `남은 학원 과제가 히어로에 오고, 지난 마감을 알려준다`).
    */
    await expect(page.getByText('마감이 지났어요')).toHaveCount(0);
    await expect(page.getByText(/정답률 \d+%/).first()).toBeVisible();

    // 펼치면 주요 행동은 여전히 아래에 있다(순서는 D-039 그대로)
    await expect(page.getByTestId('learn-pick')).toBeVisible();
  });

  test('담아 두면 학습 탭의 개인 학습 안으로 들어간다', async ({ page }) => {
    await loginAs(page, 'yerin');
    await pickSpellingSet(page);
    await page.getByRole('checkbox', { name: '담아 두기' }).first().click();
    await expect(page.getByTestId('toast')).toHaveText('학습을 담아 뒀어요');

    await page.getByRole('link', { name: '학습' }).click();
    // 담아 둔 학습은 개인 학습 **안**에 있다. 학원 학습과 같은 층위로 올리지 않는다.
    const academy = await page.getByText('학원 학습', { exact: true }).boundingBox();
    const personal = await page.getByText('개인 학습', { exact: true }).first().boundingBox();
    const queued = await page.getByText(/담아 둔 학습 \d+개가 있어요/).boundingBox();
    expect(academy!.y).toBeLessThan(personal!.y);
    expect(personal!.y).toBeLessThan(queued!.y);

    // 갈 곳이 둘이면 버튼을 나란히 두지 않고 한 줄에 하나씩 고르게 한다(`ActionBar` 규칙 1).
    // 담아 둔 것이 있으면 그것부터 푸는 쪽이 위다.
    const solve = await page.getByTestId('learn-queue-all').boundingBox();
    const pick = await page.getByTestId('learn-pick').boundingBox();
    expect(queued!.y).toBeLessThan(solve!.y);
    expect(solve!.y).toBeLessThan(pick!.y);
    expect(solve!.x).toEqual(pick!.x);
  });

  test('학원 소속이 없는 학생에게는 학원 학습 섹션을 두지 않는다', async ({ page }) => {
    await loginAs(page, 'seojun'); // 개인 이용권만, 학원 소속 없음
    await page.getByRole('link', { name: '학습' }).click();

    // 없는 소속을 있는 것처럼 말하지 않는다
    await expect(page.getByText('학원 학습', { exact: true })).toHaveCount(0);
    await expect(page.getByText('아직 학원에서 받은 학습이 없어요')).toHaveCount(0);

    // 이 학생이 할 수 있는 일이 화면 첫 섹션으로 온다(사이드바가 아니라 본문에서 센다)
    const screen = page.getByTestId('student-learn');
    const personal = await screen.getByText('개인 학습', { exact: true }).boundingBox();
    const heading = await screen.getByText('학습', { exact: true }).boundingBox();
    const pick = await page.getByTestId('learn-pick').boundingBox();
    expect(heading!.y).toBeLessThan(personal!.y);
    expect(personal!.y).toBeLessThan(pick!.y);
    // 개인 학습 진입 버튼이 화면 제목 바로 아래 첫 행동이다
    expect(pick!.y - heading!.y).toBeLessThan(160);
  });

  test('공개 학습이 없는 영역은 눌리지 않고 이유를 말한다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await page.getByRole('link', { name: '학습' }).click();
    await page.getByTestId('learn-pick').click();
    await page.getByTestId('learn-grade-1').click();
    await expect(page).toHaveURL(/\/student\/pick\?grade=1$/);

    // 준비 중인 영역은 색이 아니라 문장으로 알린다
    const empty = page.getByTestId('learn-area-화법과 작문');
    await expect(empty).toBeVisible();
    await expect(empty.getByText('아직 준비 중이에요')).toBeVisible();

    // 눌러도 막힌 화면으로 넘어가지 않는다
    await empty.click();
    await expect(page).toHaveURL(/\/student\/pick\?grade=1$/);
    await expect(page.getByTestId('learn-area-문법')).toBeVisible();

    // 학습이 있는 영역은 그대로 들어간다
    await page.getByTestId('learn-area-문법').click();
    await expect(page).toHaveURL(/area=/);
  });

  test('고르기 화면은 경로를 본문 첫 줄에 두고 유형 이름을 두 번 쓰지 않는다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await pickSpellingSet(page);

    await expect(page.getByText('담을 학습을 골라요')).toBeVisible();
    // 경로는 한 줄로만 나온다(제목 옆·섹션 제목에서 반복하지 않는다)
    await expect(page.getByText('고1 · 문법 · 어문 규정 - 맞춤법')).toHaveCount(1);
    await expect(page.getByText('어문 규정 - 맞춤법', { exact: true })).toHaveCount(0);
  });

  test('담기 버튼이 있는 줄에는 이동 화살표를 두지 않는다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await pickSpellingSet(page);
    const toggle = page.getByRole('checkbox', { name: '담아 두기' }).first();
    await expect(toggle).toBeVisible();

    // 담기 버튼이 줄의 가장 오른쪽이다(화살표가 그 왼쪽에 끼어들지 않는다)
    const row = page.locator('[data-testid^="learn-queue-"]').first();
    const box = await row.boundingBox();
    const chevrons = await page.evaluate(() => {
      const marks = Array.from(document.querySelectorAll('div')).filter((d) => {
        const cs = getComputedStyle(d);
        const b = d.getBoundingClientRect();
        // 1×1로 잘라 둔 스크린리더 전용 영역(`LiveRegion`)은 절대 배치이지만 화살표가 아니다.
        return cs.position === 'absolute' && b.width >= 4 && b.width < 16 && b.height < 16;
      });
      return marks.length;
    });
    expect(chevrons).toBe(0);
    expect(box).not.toBeNull();
  });

  test('학원 과제로도 받은 학습은 고르기에서 그 사실을 알려준다', async ({ page }) => {
    // 정예린은 이 유형의 두 세트를 모두 학원 과제로 배정받았고, 같은 콘텐츠가 개인으로도 공개돼 있다
    await loginAs(page, 'yerin');
    await pickSpellingSet(page);
    await expect(page.getByText(/학원 과제로도 받은 학습이에요/).first()).toBeVisible();
    await expect(page.getByText(/학원 과제로도 받은 학습이에요/)).toHaveCount(2);

    // 학원 배정이 없는 학생에게는 붙지 않는다
    await page.getByRole('link', { name: '내 정보' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'seojun');
    await pickSpellingSet(page);
    await expect(page.getByText(/학원 과제로도 받은 학습이에요/)).toHaveCount(0);
  });

  test('담아 둔 학습은 순번을 왼쪽에 두고 이동 화살표를 남긴다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await pickSpellingSet(page);
    await page.getByRole('checkbox', { name: '담아 두기' }).first().click();
    await page.getByRole('link', { name: '학습' }).click();
    await page.getByTestId('learn-queue-all').click();
    await expect(page).toHaveURL(/\/student\/queue/);

    // 순번은 정보라 왼쪽에 둔다 → 오른쪽이 비어 이동 화살표가 남는다
    const chevrons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('div')).filter((d) => {
        const cs = getComputedStyle(d);
        const b = d.getBoundingClientRect();
        // 1×1로 잘라 둔 스크린리더 전용 영역(`LiveRegion`)은 절대 배치이지만 화살표가 아니다.
        return cs.position === 'absolute' && b.width >= 4 && b.width < 16 && b.height < 16;
      }).length;
    });
    expect(chevrons).toBeGreaterThan(0);

    // 고르기 모드에서는 오른쪽이 행동(체크박스)이라 화살표를 두지 않는다
    await page.getByTestId('queue-select-mode').click();
    const inSelect = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('div')).filter((d) => {
        const cs = getComputedStyle(d);
        const b = d.getBoundingClientRect();
        // 1×1로 잘라 둔 스크린리더 전용 영역(`LiveRegion`)은 절대 배치이지만 화살표가 아니다.
        return cs.position === 'absolute' && b.width >= 4 && b.width < 16 && b.height < 16;
      }).length;
    });
    expect(inSelect).toBe(0);
  });

  test('기록이 비어 있으면 학습을 고르러 갈 수 있다', async ({ page }) => {
    await loginAs(page, 'doyun'); // 아직 푼 학습이 없는 학생
    await page.getByRole('link', { name: '기록' }).click();
    await expect(page.getByText(/아직 제출한 학습이 없어요/)).toBeVisible();
    await page.getByTestId('records-empty-start').click();
    await expect(page).toHaveURL(/\/student\/learn/);
    // 학원 학습 섹션은 그대로 보인다
    await expect(page.getByText('학원 학습', { exact: true })).toBeVisible();
    // 개인 이용권이 없으면 고를 것이 없으므로 고르기 안내와 진입 버튼을 두지 않는다
    await expect(page.getByText(/학년 → 영역 → 유형 순으로 골라요/)).toHaveCount(0);
    await expect(page.getByTestId('learn-pick')).toHaveCount(0);
    // 학원이 결제하는 학생에게 '결제해야 쓸 수 있다'처럼 읽히는 문구를 띄우지 않는다
    await expect(page.getByText(/월정액을 시작하면 개인 국어 학습을 이용할 수 있어요/)).toHaveCount(0);
    await expect(page.getByText(/이용권으로 학원 학습을 이용하고 있어요/)).toBeVisible();
  });

  test('오답노트에서 지우면 바로 빠지고 되돌릴 수 있다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await openFirstPersonal(page);
    await page.getByTestId('detail-start').click();
    await answerAll(page);
    await page.getByTestId('solve-submit').click();
    await keepWrongNotes(page);
    await page.getByTestId('result-notebook').click();
    await expect(page).toHaveURL(/\/student\/notebook/);

    const question = page.getByText('윗글의 중심 내용으로 가장 적절한 것은?');
    await expect(question).toBeVisible();
    // 지문형 오답이면 지문도 맨 위에 함께 보인다
    await expect(page.getByText(/비판적 읽기는 글쓴이의 주장과 근거/)).toBeVisible();

    /*
      지우기는 별표 옆 휴지통. 누르면 바로 빠지고 **알림 안에서** 되돌릴 수 있다(D-091).
      예전에는 화면에 남는 배너였다 — 알림으로 옮기면서 되돌리기도 그 안으로 들어갔다.
    */
    await page.getByRole('button', { name: '이 문항 지우기' }).first().click();
    await expect(question).toHaveCount(0);
    await expect(page.getByTestId('toast')).toHaveText('오답노트에서 뺐어요');

    await page.getByTestId('toast-action').click();
    await expect(question).toBeVisible();

    // 다시 지우면 목록이 비고 빈 상태 안내가 나온다.
    // 앞 알림이 아직 떠 있으면 그 되돌리기를 누르게 되므로 먼저 비운다.
    await waitForQuietToast(page);
    await page.getByRole('button', { name: '이 문항 지우기' }).first().click();
    await expect(question).toHaveCount(0);
    // `EmptyState`는 제목/부제를 나눠 그리므로 문구에 마침표가 없다.
    await expect(page.getByText('담아 둔 오답이 없어요')).toBeVisible();
  });

  test('학원 과제가 남았으면 알려주고, 다 끝내면 할 수 있는 일만 말한다', async ({ page }) => {
    await page.goto('/login');
    await loginHere(page, 'doyun'); // 박도윤: 학원 이용권, 미제출 과제 1개
    await expect(page.getByText('학원에서 내준 과제가 있어요')).toBeVisible();

    // 과제를 끝내면 안내가 바뀐다
    await page.getByText('시작하기').click();
    await page.getByTestId('detail-start').click();
    await answerAll(page);
    await page.getByTestId('solve-submit').click();
    await page.getByTestId('result-done').click();
    await expect(page.getByTestId('academy-cleared')).toBeVisible();
    await expect(page.getByText('학원에서 내준 과제물을 모두 마쳤어요.')).toBeVisible();
    await expect(page.getByText('학원에서 내준 과제가 있어요')).toHaveCount(0);

    /*
      **개인 이용권이 없는 학생에게 개인 학습을 권하지 않는다**(D-141). 박도윤에게 학습 탭의
      개인 학습 진입 줄은 렌더되지 않으므로 `개인 학습 고르기`는 누를 것이 0개인 목적지였다.
      히어로 캡션도 이 학생에게 열려 있지 않은 길(새로 고르기)을 가리키지 않는다.
    */
    await expect(page.getByText('개인 학습을 해볼까요?')).toHaveCount(0);
    await expect(page.getByTestId('home-go-learn')).toHaveCount(0);
    await expect(page.getByText(/새 학습을 골라볼 수 있어요/)).toHaveCount(0);
    await expect(page.getByText('학원에서 과제를 내주면 여기에서 알려 줘요.')).toBeVisible();

    // 학원 학습이 없는 학생에게는 두 문구 모두 띄우지 않는다
    await page.getByRole('link', { name: '내 정보' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'seojun');
    await expect(page.getByTestId('student-home')).toBeVisible();
    await expect(page.getByText('학원에서 내준 과제가 있어요')).toHaveCount(0);
    await expect(page.getByTestId('academy-cleared')).toHaveCount(0);
  });

  test('남은 학원 과제가 히어로에 오고, 지난 마감을 알려준다', async ({ page }) => {
    /*
      박도윤: 남은 학원 과제가 `현대소설 점검` 하나이고 마감이 지났다(seed에서 -4일).
      예전에는 정예린으로 이 단정을 세웠는데 seed가 정예린의 배정 4건을 **모두 제출**로
      만들면서 그 계정의 히어로에는 학원 과제가 올 수 없게 됐다(기준 실패).
    */
    await loginAs(page, 'doyun');
    const hero = page.getByTestId('today-primary');
    await expect(hero.getByText('현대소설 점검')).toBeVisible();
    await expect(hero.getByText('마감이 지났어요')).toBeVisible();
    // 히어로가 이미 학원 과제를 가리키면 섹션에 같은 행동을 두 번 두지 않는다
    await expect(page.getByTestId('home-academy-first')).toHaveCount(0);

    /*
      **목록 행도 같은 문장을 쓴다**(D-142). 예전에는 이 줄만 `8월 10일 마감`이라 지난 마감이
      여유 있게 읽혔고, 오늘 기준으로 말하는 곳은 홈 히어로 하나뿐이었다.
    */
    await page.getByRole('link', { name: '학습' }).click();
    await expect(page.getByText('마감이 지났어요')).toBeVisible();
  });

  test('담아 둔 학습이 히어로를 차지하면 학원 과제로 가는 길을 따로 둔다', async ({ page }) => {
    /*
      정예린은 seed의 배정 4건을 모두 냈으므로 **남은 과제를 하나 만들어야** 이 상태가 된다.
      원장으로 반에 하나 배정하고(학원 흐름과 같은 헬퍼) 학생으로 돌아온다.
    */
    await page.goto('/login');
    await loginHere(page, 'hanbit.director');
    await page.getByRole('link', { name: '학습 배정' }).click();
    await assignLearning(page, {
      classId: sid('c_kor1'),
      contentId: sid('ct_gram_1'),
      search: '맞춤법',
      due: dayFromToday(14),
    });
    await expectAssigned(page);
    await page.getByRole('link', { name: '학원 관리' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'yerin');

    await page.getByRole('link', { name: '학습' }).click();
    await page.getByTestId('learn-pick').click();
    await page.getByTestId('learn-grade-2').click();
    await page.getByTestId('learn-area-독서').click();
    await page.getByTestId('learn-topic-과학').click();
    await page.getByRole('checkbox', { name: '담아 두기' }).first().click();

    await page.getByTestId('brand-home').click();
    await expect(page.getByTestId('today-primary').getByText('담아 둔 학습')).toBeVisible();

    // 히어로가 개인 학습을 가리키면 마감이 가장 이른 과제로 바로 갈 수 있다
    const first = page.getByTestId('home-academy-first');
    await expect(first).toBeVisible();
    await first.click();
    await expect(page.getByText('헷갈리는 맞춤법·어법').first()).toBeVisible();
    await expect(page.getByTestId('detail-start')).toBeVisible();
  });

  test('진행 상황은 학원 과제와 담아 둔 학습만 센다', async ({ page }) => {
    await loginAs(page, 'seojun'); // 개인 이용권만, 아직 담은 학습이 없다
    // 공개 카탈로그 개수를 할 일처럼 세지 않는다(공개 개수는 학습 탭이 말한다)
    await expect(page.getByTestId('home-progress')).toHaveCount(0);

    /*
      **히어로도 진행 상황과 같은 집합만 쓴다**(D-140). 아무도 고르지 않은 카탈로그의 첫 세트를
      `오늘의 학습`으로 올리지 않으므로 이 상태에는 시작할 것이 없다.

      **그리고 `끝냈다`고도 말하지 않는다**(D-143). 이 계정은 담은 것도 배정도 없고 낸 것도
      없다 — 약속된 일이 애초에 없었으므로 `오늘 할 일을 다 끝냈어요`는 거짓이다. 예전에는
      `nothingYet`이 `all.length === 0`을 봐서, `all`에 공개 카탈로그가 들어 있다는 이유로
      이 계정이 완료 면으로 떨어졌다.
    */
    await expect(page.getByTestId('today-primary')).toHaveCount(0);
    await expect(page.getByText('오늘 할 일을 다 끝냈어요')).toHaveCount(0);
    await expect(page.getByText('아직 시작한 학습이 없어요')).toBeVisible();
    // 개인 이용권이 있으니 고르러 가는 것이 실제 다음 행동이다(D-141).
    await expect(page.getByText('새 학습을 골라볼까요?')).toBeVisible();
    await expect(page.getByTestId('home-empty-start')).toBeVisible();

    await page.getByRole('link', { name: '학습' }).click();
    await page.getByTestId('learn-pick').click();
    await page.getByTestId('learn-grade-2').click();
    await page.getByTestId('learn-area-독서').click();
    await page.getByTestId('learn-topic-과학').click();
    await page.getByRole('checkbox', { name: '담아 두기' }).first().click();
    await page.getByTestId('brand-home').click();

    await expect(page.getByTestId('home-progress')).toBeVisible();
    await expect(page.getByText('남은 학습 1개')).toBeVisible();
    await expect(page.getByText('담아 둔 학습 1개')).toBeVisible();
    await expect(page.getByText('/ 1 완료')).toBeVisible();
    // 담아 두면 그것이 히어로가 된다 — 분모에 들어온 것이 곧 오늘의 학습이다
    await expect(page.getByTestId('today-primary').getByText('담아 둔 학습')).toBeVisible();
  });

  test('학습이 하나도 없는 계정에는 다 끝냈다고 말하지 않는다', async ({ page }) => {
    // 가입 직후 계정은 학원 과제도 담아 둔 학습도 없다
    await page.goto('/signup');
    await page.getByTestId('signup-kakao').click();
    await page.getByTestId('signup-name').fill('첫날학생');
    await page.getByTestId('signup-id').fill('firstday');
    await page.getByTestId('signup-pw').fill('test1234');
    await page.getByTestId('signup-submit').click();
    await expect(page).toHaveURL(/\/student/);

    await expect(page.getByText('아직 시작한 학습이 없어요')).toBeVisible();
    await expect(page.getByText('오늘 할 일을 다 끝냈어요')).toHaveCount(0);
    // 셀 것이 없으면 진행 상황도 두지 않는다
    await expect(page.getByTestId('home-progress')).toHaveCount(0);

    /*
      **이용권이 없으면 고르러 가는 버튼을 두지 않고 이유를 말한다**(D-141 · A-096).
      예전에는 여기에 `문제 담으러 가기`가 있었는데 그 목적지(학습 탭)에서 이 계정이 누를 수
      있는 것은 0개였다 — 공식 입구로 들어온 학생이 두 번째 화면에서 흐름이 끊긴 자리다.
      이용권을 시작하는 진입점은 결제 연결과 함께 온다(A-096).
    */
    await expect(page.getByTestId('home-empty-start')).toHaveCount(0);
    await expect(
      page.getByText('개인 학습 이용권이 없어서 아직 고를 수 있는 학습이 없어요.'),
    ).toBeVisible();
  });

  test('풀다 나온 학습은 이어서 하기로 알아볼 수 있다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await pickSpellingSet(page);
    const pickUrl = page.url();
    await page.getByText('헷갈리는 맞춤법·어법').first().click();
    await page.getByTestId('detail-start').click();

    // 한 문항만 고르고 나온다(답안은 자동 저장된다)
    await page.getByRole('radio', { name: /보기 1$/ }).first().click();
    await page.getByTestId('focus-exit').click();
    await expect(page.getByTestId('detail-start')).toContainText('이어서 풀기');

    // 목록에서도 진행 중임이 보인다
    await page.getByTestId('screen-back').click();
    await expect(page).toHaveURL(pickUrl);
    await expect(page.getByText('이어서 하기').first()).toBeVisible();
  });

  test('세션 없이 학습 URL로 직접 들어오면 로그인으로 보낸다', async ({ page }) => {
    await page.goto('/student/result/does-not-exist');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId('login-phone')).toBeVisible();
  });

  test('세션 없이 고르기 단계 URL로 들어오면 로그인으로 보낸다', async ({ page }) => {
    await page.goto('/student/pick?grade=1&area=문법');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId('login-phone')).toBeVisible();
  });

  test('풀이 중 이탈 후 돌아오면 선택이 유지된다(자동 저장)', async ({ page }) => {
    await loginAs(page, 'seojun');
    await openFirstPersonal(page);
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
    await openFirstPersonal(page);
    await page.getByTestId('detail-start').click();
    await answerAll(page);
    await page.getByTestId('solve-submit').click();
    // 오답 두 개를 담는다
    await keepWrongNotes(page, 2);
    await page.getByTestId('result-notebook').click();

    // 마무리하기 버튼은 맨 아래에 있고, 안 한 문제가 있으면 알려준다
    await page.getByTestId('notebook-wrapup').click();
    await expect(
      page.getByText('오답노트를 안 한 문제들이 있어요. 나중에 오답노트 하시겠어요?'),
    ).toBeVisible();
    await page.getByTestId('wrapup-continue').click();

    // 물어보기 전에는 정리 아이콘이 없다(눌러도 정리할 대화가 없으므로)
    const summ = page.locator('[data-testid^="summ-"]').first();
    await expect(summ).toHaveCount(0);

    // 물어보기 → 답변 뒤 정리 아이콘이 생기고, 누르면 완료 상태로 바뀐다
    const firstAsk = page.locator('[data-testid^="ask-"]').first();
    await firstAsk.fill('왜 이 답이 정답인가요?');
    const send = page.locator('[data-testid^="send-"]').first();
    await send.click();
    await expect(summ).toBeVisible();
    // 아이콘 버튼이라 이름으로 찾는다
    await expect(
      page.getByRole('button', { name: '노트에 정리해 두기' }).first(),
    ).toBeVisible();
    /*
      실제 OpenRouter 호출이라 실패할 수 있다. 실패하면 저장을 막으므로(D-102) 아래를
      검증할 수 없다 — 못 한 것을 통과로 위장하지 않고 건너뛴 사실을 남긴다.
    */
    await waitForQuietToast(page);
    await summ.click();
    await expect(page.getByTestId('toast')).toBeVisible();
    const saved = (await page.getByTestId('toast').textContent()) ?? '';
    if (!saved.includes('노트에 정리했어요')) {
      test.skip(true, `Scody AI 호출이 실패했다(업스트림 문제): ${saved}`);
    }
    await expect(page.getByText('내 오답노트 메모')).toBeVisible();
    await expect(page.getByRole('button', { name: '노트에 정리됐어요' }).first()).toBeVisible();

    // 정리한 뒤에는 다시 정리하거나 이어서 더 정리할 수 있다
    await expect(page.locator('[data-testid^="resum-"]').first()).toBeVisible();
    await expect(page.locator('[data-testid^="addsum-"]').first()).toBeVisible();
  });

  test('오답노트는 대화가 입력창 위에 오고, 지문은 첫 문항만 펼쳐진다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await openFirstPersonal(page);
    await page.getByTestId('detail-start').click();
    await answerAll(page);
    await page.getByTestId('solve-submit').click();
    await keepWrongNotes(page, 2); // 카드 두 개
    await page.getByTestId('result-notebook').click();

    // 첫 문항 지문은 펼쳐져 있고, 접을 수 있다
    await expect(page.getByRole('button', { name: '지문 접기' }).first()).toBeVisible();
    // 같은 지문의 둘째 카드는 접혀 있어 펼치기가 보인다
    await expect(page.getByRole('button', { name: '지문 펼치기' }).first()).toBeVisible();

    // 접힌 지문을 펼칠 수 있다
    const expand = page.getByRole('button', { name: '지문 펼치기' }).first();
    await expand.click();
    await expect(page.getByRole('button', { name: '지문 접기' })).toHaveCount(2);

    // 대화가 입력창 위에 온다
    const ask = page.locator('[data-testid^="ask-"]').first();
    await ask.fill('왜 이 답이 정답인가요?');
    await page.locator('[data-testid^="send-"]').first().click();
    await expect(page.locator('[data-testid^="summ-"]').first()).toBeVisible();

    const answer = await page.getByText('Scody AI').first().boundingBox();
    const input = await ask.boundingBox();
    expect(answer!.y).toBeLessThan(input!.y);
  });

  test('추천 학습을 담아도 담았다고 알려준다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await openFirstPersonal(page);
    await page.getByTestId('detail-start').click();
    await answerAll(page);
    await page.getByTestId('solve-submit').click();
    // 오답을 담으면 같은 유형 추천이 생긴다
    await keepWrongNotes(page, 1);

    const reco = page.locator('[data-testid^="reco-queue-"]').first();
    await expect(reco).toBeVisible();
    await reco.click();
    await expect(page.getByTestId('toast')).toHaveText('학습을 담아 뒀어요');

    // 다시 누르면 취소했다고 알린다
    await reco.click();
    await expect(page.getByTestId('toast')).toHaveText('담아 둔 학습에서 뺐어요');
  });

  test('추가 대화까지 다시 정리하고, 지우면 처음 상태로 돌아간다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await openFirstPersonal(page);
    await page.getByTestId('detail-start').click();
    await answerAll(page);
    await page.getByTestId('solve-submit').click();
    await keepWrongNotes(page, 1);
    await page.getByTestId('result-notebook').click();

    const ask = page.locator('[data-testid^="ask-"]').first();
    const send = page.locator('[data-testid^="send-"]').first();
    await ask.fill('왜 이 답이 정답인가요?');
    await send.click();
    await waitForQuietToast(page);
    await page.locator('[data-testid^="summ-"]').first().click();
    /*
      **이 테스트는 실제 OpenRouter 호출에 매달려 있다**(`.env`에 키가 있으면 e2e가 네트워크를
      탄다). 호출이 실패하면 정리할 메모가 없어 이 아래를 검증할 수 없다 —
      예전에는 실패 문장이 그대로 메모로 저장돼 테스트가 **틀린 이유로 통과**했다(D-102).
      지금은 저장을 막으므로, 못 한 것을 통과로 위장하지 않고 건너뛴 사실을 남긴다.
    */
    const failed = page.getByText('지금은 정리하지 못했어요. 잠시 뒤 다시 해 주세요.');
    if ((await failed.count()) > 0) {
      test.skip(true, 'Scody AI 호출이 실패해 정리할 메모가 없다(업스트림 문제, 화면 문제가 아니다)');
    }
    await expect(page.getByText('내 오답노트 메모')).toBeVisible();

    const memo = page.locator('[data-testid^="dig-"]').first();
    const first = (await memo.textContent()) ?? '';
    expect(first.length).toBeGreaterThan(0);

    /*
      더 물어본 뒤 다시 정리하면 **앞 메모 뒤에 붙이지 않고 전체를 다시 쓴다**(D-045).
      글이 달라지는 것까지 단정하지 않는다 — 실제 모델은 같은 대화에 같은 요약을 낼 수 있고
      (실측), 그것은 '전체를 다시 썼다'와 모순되지 않는다. 키가 없을 때만 프롬프트가 그대로
      되돌아와 늘 달라 보였을 뿐이다. 확인할 것은 이어 붙이지 않는다는 사실이다.
    */
    await ask.fill('예를 들어 설명해 주세요.');
    await send.click();
    /*
      답이 오기 전에 정리를 누르면 `busy` 가드에 막혀 아무 일도 일어나지 않는다(A-034 —
      `busy`가 전역 단일 값이다). 두 번째 질문이 대화에 실제로 올라온 뒤에 누른다.
    */
    await expect(page.getByText('예를 들어 설명해 주세요.')).toBeVisible();
    await expect(page.getByText('나', { exact: true })).toHaveCount(2);
    /*
      앞 정리의 토스트와 문구가 **같아서**(`노트에 정리했어요`) 앞것을 이것으로 착각할 수 있다.
      먼저 조용해지기를 기다린 뒤 눌러야 단정이 이 클릭의 결과를 본다.
    */
    await actThenToast(
      page,
      () => page.locator('[data-testid^="addsum-"]').first().click(),
      '노트에 정리했어요',
    );
    await waitForQuietToast(page);
    const again = (await memo.textContent()) ?? '';
    expect(again.length).toBeGreaterThan(0);
    expect(again.startsWith(first) && again.length > first.length).toBe(false);

    /*
      지우면 메모도 대화도 사라져 처음 상태로 돌아간다.
      **되돌릴 수 없어 확인 단계를 한 번 지난다** — 트리거를 누르면 질문이 뜨고,
      확인 버튼을 눌러야 실제로 지워진다.
    */
    await waitForQuietToast(page);
    /*
      **어느 문항의 확인인지 id로 묶는다.** `.first()`로 두면 메모가 둘 이상일 때
      누른 문항과 다른 확인 버튼을 집을 수 있다(전체 실행에서 한 번 흔들렸다).
    */
    const trigger = page.locator('[data-testid^="resum-"]').first();
    const qId = (await trigger.getAttribute('data-testid'))!.replace('resum-', '');
    await trigger.click();
    await expect(page.getByText(/되돌릴 수 없어요/)).toBeVisible();
    await page.getByTestId(`resum-confirm-${qId}`).click();
    await expect(page.getByTestId('toast')).toHaveText('정리와 대화를 지웠어요');
    await expect(page.getByText('내 오답노트 메모')).toHaveCount(0);
    await expect(page.locator('[data-testid^="summ-"]')).toHaveCount(0);
  });

  test('홈에서 바로 Scody AI에게 묻고 대화를 이어간다', async ({ page }) => {
    await loginAs(page, 'seojun');

    // 홈에는 버튼이 아니라 입력창이 있다. 비어 있으면 보내기 버튼을 누를 수 없다.
    const homeAsk = page.getByTestId('home-ask');
    await expect(homeAsk).toBeVisible();
    const homeSend = page.getByTestId('home-ask-send');
    await expect(homeSend).toHaveAttribute('aria-disabled', 'true');

    await homeAsk.fill('비판적 읽기가 뭔가요?');
    await expect(homeSend).not.toHaveAttribute('aria-disabled', 'true');
    // 보내기 버튼은 글 아래 오른쪽에 있다(글과 겹치지 않게)
    const box = await homeAsk.boundingBox();
    const btn = await homeSend.boundingBox();
    expect(btn!.y).toBeGreaterThanOrEqual(box!.y + box!.height - 1);
    expect(btn!.x).toBeGreaterThan(box!.x + box!.width / 2);

    // 보내면 대화 화면에서 그 질문의 답이 이어진다
    await homeSend.click();
    await expect(page).toHaveURL(/\/student\/ask/);
    await expect(page.getByTestId('ask-answer')).toBeVisible();
    // 모델이 질문을 되풀어 줄 수 있으니 첫 번째(내가 보낸 말)만 확인한다
    await expect(page.getByText('비판적 읽기가 뭔가요?').first()).toBeVisible();

    // 이어서 한 번 더 물으면 앞 대화가 남은 채로 답이 추가된다
    await page.getByTestId('ask-input').fill('예를 들어 설명해 주세요.');
    await page.getByTestId('ask-submit').click();
    await expect(page.getByText('예를 들어 설명해 주세요.').first()).toBeVisible();
    await expect(page.getByText('비판적 읽기가 뭔가요?').first()).toBeVisible();
    // 보낸 뒤 입력이 비면 버튼을 다시 누를 수 없다
    await expect(page.getByTestId('ask-submit')).toHaveAttribute('aria-disabled', 'true');
  });

  test('대화 화면은 입력창이 아래에 붙고 하단 탭을 숨긴다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await page.getByTestId('home-ask').fill('은유가 뭔가요?');
    await page.getByTestId('home-ask-send').click();
    await expect(page).toHaveURL(/\/student\/ask/);

    // 입력창이 대화 영역보다 아래에 있다(대화만 스크롤된다)
    const thread = await page.getByTestId('student-ask').boundingBox();
    const composer = await page.getByTestId('ask-input').boundingBox();
    expect(composer!.y).toBeGreaterThanOrEqual(thread!.y + thread!.height - 2);

    // 입력창과 겹치지 않게 하단 탭을 숨긴다(데스크톱 사이드바는 그대로 둔다).
    // 나가는 길은 좌상단 뒤로가기다.
    await expect(page.getByTestId('tab-bar')).toHaveCount(0);
    await expect(page.getByTestId('screen-back')).toBeVisible();
    await page.getByTestId('screen-back').click();
    await expect(page.getByTestId('student-home')).toBeVisible();
  });

  test('보낸 질문은 답을 기다리는 동안에도 화면에 남는다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await page.getByTestId('home-ask').fill('심상이 무엇인가요?');
    await page.getByTestId('home-ask-send').click();
    await expect(page).toHaveURL(/\/student\/ask/);
    // 답이 확정되기 전에도 내가 보낸 말이 보인다(홈에서 넘어와도 끊기지 않는다)
    await expect(page.getByTestId('ask-answer')).toBeVisible();
    await expect(page.getByText('심상이 무엇인가요?').first()).toBeVisible();
  });

  test('학습 탭의 오답노트 → 카드 복습에서 다시 풀고 별표로 집중 복습한다', async ({ page }) => {
    await loginAs(page, 'seojun');
    await openFirstPersonal(page);
    await page.getByTestId('detail-start').click();
    await answerAll(page);
    await page.getByTestId('solve-submit').click();
    await keepWrongNotes(page, 2);

    /*
      오답노트는 **학습 탭**에 있다(D-130) — 기록은 무엇을 했는지, 학습은 앞으로 할 일이다.
      캡션은 이 목록이 무엇을 고르는 것인지만 말한다(예전에는 목록과 같은 숫자를 두 번 말했다).
    */
    await page.getByRole('link', { name: '학습' }).click();
    await expect(page.getByText('오답노트', { exact: true })).toBeVisible();
    await expect(page.getByText('다시 풀 범위를 골라요.')).toBeVisible();

    // 카드 복습: 다시 풀면 정답과 내 메모 자리를 보여준다
    await page.getByTestId('learn-review').click();
    await expect(page).toHaveURL(/\/student\/review/);
    await expect(page.getByText('답을 고르면 정답과 내 메모를 함께 볼 수 있어요.')).toBeVisible();
    await page.getByTestId('review-choice-1').click();
    await expect(page.getByText(/이번엔 맞혔어요|아직 헷갈려요/)).toBeVisible();
    await expect(page.getByText('질문하고 메모하기')).toBeVisible();

    // 별표를 달면 집중 복습 목록에 들어간다
    await page.getByRole('button', { name: '별표 달기' }).click();
    await page.getByTestId('review-next').click();
    await page.getByRole('link', { name: '학습' }).click();
    const starred = page.getByTestId('learn-review-starred');
    await expect(starred).toBeVisible();
    await starred.click();
    await expect(page.getByText('별표 카드 복습')).toBeVisible();
    await expect(page.getByText(/1 \/ 1/)).toBeVisible();
  });

  test('오답노트: 카테고리 칩으로 걸러 보고 학원 오답은 학원에도 전달된다', async ({ page }) => {
    // 학원 과제를 풀고 오답을 담으면 학원 성과 분석에서 볼 수 있다(배정 학습만)
    await page.goto('/login');
    await loginHere(page, 'doyun');

    await page.getByRole('link', { name: '학습' }).click();
    await page.getByText('현대소설 점검').click();
    await page.getByTestId('detail-start').click();
    await answerAll(page);
    await page.getByTestId('solve-submit').click();
    await keepWrongNotes(page);

    await page.getByRole('link', { name: '내 정보' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'hanbit.director');

    await page.getByRole('link', { name: '성과 분석' }).click();
    await expect(page.getByText(/배정 학습 오답노트 [1-9]\d*개/)).toBeVisible();
    await expect(page.getByText('박도윤', { exact: false }).first()).toBeVisible();
  });
});
