import { test, expect } from './_fixtures';
import { HAEUN_OFFSETS, personalItemId, seedMonths, sid } from './_ids';
import { type Page } from '@playwright/test';
import { loginHere } from './_auth';
import { answerAll, keepWrongNotes, openFirstPersonal } from './_solve';

async function loginParent(page: Page) {
  await page.goto('/login');
  await loginHere(page, 'minji');
  await expect(page).toHaveURL(/\/parent/);
  /*
    홈이 조회를 마칠 때까지 기다린다. 홈은 불러오는 중에 숫자 대신 `기록을 불러오고 있어요`를
    말한다 — 그 사이에 본문을 읽으면 아직 모르는 값을 읽는다.
  */
  await expect(page.getByText('기록을 불러오고 있어요').first()).toHaveCount(0, { timeout: 15000 });
}

/**
 * 기록이 있는 달로 옮긴다.
 *
 * 리포트는 늘 **이번 달**로 열린다(D-090) — 홈과 같은 달을 말해야 하기 때문이다. 시드 기록은
 * 2026-07까지라 달이 바뀐 뒤에는 이번 달이 비어 있고, 화면이 그때 `7월 리포트 보기`를 준다.
 * 이 함수는 그 버튼을 사람과 똑같이 누른다 — 없으면(이번 달에 기록이 있으면) 아무것도 하지 않는다.
 * 달 자체를 확인하는 테스트는 이 함수를 쓰지 않고 화살표를 직접 누른다.
 */
async function openRecordedMonth(page: Page) {
  const jump = page.getByTestId('report-latest-month');
  if ((await jump.count()) > 0) await jump.click();
}

test.describe('M3 학부모 흐름', () => {
  test('종합 리포트에 정답률·취약 영역이 나오고 상세 리포트로 들어간다', async ({ page }) => {
    await page.goto('/login');
    await loginHere(page, 'yerin');
    await openFirstPersonal(page);
    await page.getByTestId('detail-start').click();
    await answerAll(page);
    await page.getByTestId('solve-submit').click();
    await expect(page).toHaveURL(/\/student\/result\//);

    await page.getByRole('link', { name: '내 정보' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'minji');
    await page.getByText('정예린').click();

    // 종합 리포트: 지표 + 영역별 정답률 + 취약 영역 안내
    await expect(page.getByText(/\d+월 학습$/)).toBeVisible();
    await expect(page.getByTestId('metric-days')).toContainText('공부한 날');
    // 정답률은 합치지 않고 출처별로 말한다
    await expect(page.getByTestId('metric-academy-rate')).toContainText('정답률');
    await expect(page.getByText('영역별 정답률')).toBeVisible();
    // 표본이 적으면 약점으로 단정하지 않는다
    await expect(page.getByText(/가장 약해요|아직 판단하기 일러요|가장 낮은 영역이/)).toBeVisible();

    // 학습 기록에서 문항별 내역으로 들어간다
    await expect(page.getByText(/\d+월 학습 기록/)).toBeVisible();
    await page.locator('[data-testid^="report-item-"]').first().click();
    await expect(page).toHaveURL(/\/parent\/attempt/);
    await expect(page.getByText('문항별로 확인해요')).toBeVisible();
    await expect(page.getByText('걸린 시간')).toBeVisible();
    await expect(page.getByText(/자녀가 고른 답/).first()).toBeVisible();

    // 상세에서 바로 다시 풀기를 요청할 수 있다
    await page.getByTestId('attempt-retry').click();
    await expect(page.getByTestId('toast')).toHaveText('다시 풀기를 요청했어요');

    // 뒤로 나가면 리포트로 돌아온다
    await page.getByTestId('screen-back').click();
    await expect(page.getByText(/\d+월 학습$/)).toBeVisible();
  });

  /*
    **아직 내지 않은 학생으로 확인한다.** 예전에는 정예린으로 했는데, 정예린은 seed에서 이미 그
    과제를 냈다 — 그때는 학생 화면이 제출 기록을 보지 않아 미제출로 보였고(A-026) 그래서 `풀기`
    버튼이 있었다. 제출 판정이 서버의 풀이 기록 하나로 모이면서 그 결함이 닫혔으므로, 실제로 안 낸
    학생이 필요하다. 박도윤(미제출)과 그 학부모 한지훈(선생님 겸 학부모)으로 확인한다.
  */
  test('다시 풀게 해도 자녀의 기존 학습 기록은 지워지지 않는다', async ({ page }) => {
    await page.goto('/login');
    await loginHere(page, 'doyun');
    // 학원 과제를 제출한다
    await page.getByRole('link', { name: '학습' }).click();
    await page.getByText('현대소설 점검').click();
    await page.getByTestId('detail-start').click();
    await answerAll(page);
    await page.getByTestId('solve-submit').click();
    await expect(page).toHaveURL(/\/student\/result\//);

    await page.getByRole('link', { name: '내 정보' }).click();
    await page.getByText('로그아웃').click();
    // 한지훈은 다역할이라 공간을 고른다.
    await loginHere(page, 'jihoon');
    await page.getByText(/학부모 공간/).click();

    await page.getByText('박도윤').click();
    await page.getByTestId(`retry-${sid('a_kor1_1')}`).click();
    await expect(page.getByTestId('toast')).toHaveText('다시 풀기를 요청했어요');
    await expect(page.getByRole('button', { name: '다시 풀기를 요청했어요' }).first()).toBeVisible();

    // 자녀 기록은 그대로 남아 있어야 한다
    await page.getByRole('link', { name: '내 정보' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'doyun');
    await page.getByRole('link', { name: '기록' }).click();
    await expect(page.getByText('현대소설 점검')).toBeVisible();
  });

  test('학부모가 요청하면 자녀 화면에 안내가 뜬다', async ({ page }) => {
    // 학원 제출 기록만 있는 과제도 요청이 자녀에게 보여야 한다.
    await loginParent(page);
    await page.getByText('정예린').click();
    await openRecordedMonth(page);
    await page.getByTestId(`retry-${sid('a_kor1_1')}`).click();
    await expect(page.getByRole('button', { name: '다시 풀기를 요청했어요' }).first()).toBeVisible();

    await page.getByRole('link', { name: '내 정보' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'yerin');

    await page.getByRole('link', { name: '학습' }).click();
    await page.getByText('현대소설 점검').click();
    await expect(page.getByText('다시 풀어보라는 요청이 왔어요')).toBeVisible();
  });

  test('연결된 자녀의 오답노트는 학부모가 볼 수 있다', async ({ page }) => {
    // 정예린(자녀)이 오답을 담고, 학부모 최민지가 그 오답을 리포트에서 본다
    await page.goto('/login');
    await loginHere(page, 'yerin');
    await openFirstPersonal(page);
    await page.getByTestId('detail-start').click();
    await answerAll(page);
    await page.getByTestId('solve-submit').click();
    await keepWrongNotes(page);

    await page.getByRole('link', { name: '내 정보' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'minji');

    await page.getByText('정예린').click();
    await expect(page).toHaveURL(/\/parent\/report/);
    await expect(page.getByText('아직 담아 둔 오답이 없어요.')).toHaveCount(0);
  });

  test('홈은 확인할 것을 먼저 말하고 리포트로 보낸다', async ({ page }) => {
    await loginParent(page);
    await expect(page.getByText('최민지 님')).toBeVisible();
    await expect(page.getByText('지금 확인할 것')).toBeVisible();
    await expect(page.getByText('이하은')).toBeVisible();
    await expect(page.getByText('정예린')).toBeVisible();

    await page.getByText('정예린').click();
    await expect(page).toHaveURL(/\/parent\/report/);
    await expect(page.getByText('정예린 님 리포트')).toBeVisible();
    await openRecordedMonth(page);
    await expect(page.getByText(/\d+월 학습$/)).toBeVisible();
    await expect(page.getByText(/\d+월 학습 기록/)).toBeVisible();
    await expect(page.getByText('영역별 정답률')).toBeVisible();
  });

  test('홈과 리포트가 같은 달의 같은 숫자를 말한다', async ({ page }) => {
    await loginParent(page);
    // 홈의 자녀 줄은 달 이름과 공부한 날을 함께 말한다
    const home = await page.getByTestId(`parent-child-${sid('u_student_both')}`).textContent();
    const said = home?.match(/(\d+월)에 (\d+)일 공부했어요/);
    expect(said).toBeTruthy();
    const [, homeMonth, homeDays] = said!;

    await page.getByText('정예린').click();
    // 리포트가 여는 달은 홈이 말한 달과 같다(D-090). 여기서 달을 옮기지 않는다.
    await expect(page.getByTestId('month-label')).toHaveText(homeMonth);
    if (homeDays === '0') {
      // 기록이 없는 달이면 숫자를 지어내지 않고, 기록이 남은 달로 가는 길을 준다
      await expect(page.getByText(/에는 푼 학습이 없어요/)).toBeVisible();
      await expect(page.getByTestId('report-latest-month')).toBeVisible();
    } else {
      const days = await page.getByTestId('metric-days').textContent();
      expect(days).toContain(`${homeDays}일`);
    }
  });

  test('마감이 지난 미제출은 홈 맨 위와 리포트 맨 위에 온다', async ({ page }) => {
    // 한지훈의 자녀 박도윤: 학습 기록이 없고 마감이 지난 미제출 과제만 있다.
    await page.goto('/login');
    await loginHere(page, 'jihoon');
    await page.getByText(/학부모 공간/).click(); // 선생님 + 학부모 다역할
    await expect(page.getByTestId(`parent-child-${sid('u_student_academy')}`)).toBeVisible();
    await page.getByTestId(`parent-child-${sid('u_student_academy')}`).click();
    await expect(page).toHaveURL(/\/parent\/report/);
    // 확인이 필요한 것이 리포트 본문보다 먼저 온다.
    // 박도윤은 푼 학습이 0건이라 `N월 학습` 섹션이 없고 빈 안내가 그 자리에 온다.
    const pending = await page.getByText(/아직 안 낸 학원 과제 \d+개/).boundingBox();
    const body = await page.getByText(/에는 푼 학습이 없어요/).boundingBox();
    expect(pending!.y).toBeLessThan(body!.y);
    await expect(page.getByText('마감이 지났어요').first()).toBeVisible();
  });

  test('학습 기록이 없는 자녀에게 없는 숫자를 지어내지 않는다', async ({ page }) => {
    await page.goto('/login');
    await loginHere(page, 'jihoon');
    await page.getByText(/학부모 공간/).click();
    await page.getByTestId(`parent-child-${sid('u_student_academy')}`).click();
    // 기록이 0건이면 지표를 지어내지 않고 없다고 말한다
    await expect(page.getByTestId('metric-days')).toHaveCount(0);
    await expect(page.getByText(/에는 푼 학습이 없어요/)).toBeVisible();
    await expect(page.getByText(/에 담아 둔 오답이 없어요/)).toBeVisible();
  });

  test('학원 과제와 개인 학습을 갈라서 센다', async ({ page }) => {
    await loginParent(page);
    // 이하은은 개인 학습만 한다(학원 소속 없음)
    await page.getByText('이하은').click();
    await openRecordedMonth(page);
    // 학원 소속이 없으면 학원 블록 자체를 그리지 않는다(`학원 과제 0`이라고 쓰지 않는다)
    await expect(page.getByText(/월 학원 과제$/)).toHaveCount(0);
    await expect(page.getByTestId('metric-personal-rate')).toBeVisible();

    // 정예린은 둘 다 있다
    await page.getByRole('button', { name: '정예린' }).click();
    await openRecordedMonth(page);
    await expect(page.getByText(/월 학원 과제$/)).toBeVisible();
    await expect(page.getByText(/월 개인 학습$/)).toBeVisible();
  });

  test('제출일이 없는 학원 기록은 마감일을 제출일이라고 말하지 않는다', async ({ page }) => {
    await loginParent(page);
    await page.getByText('정예린').click();
    await openRecordedMonth(page);
    // 학원 제출 시드에는 제출일이 있고, 마감과 따로 표시된다.
    // 목록은 다섯 줄까지만 보여 주므로 나머지를 펼친다.
    await page.getByTestId('report-more').click();
    await page.getByTestId(`report-item-${sid('a_kor2_2')}`).click();
    await expect(page).toHaveURL(/\/parent\/attempt/);
    await expect(page.getByText('제출한 날')).toBeVisible();
    await expect(page.getByText('마감', { exact: true })).toBeVisible();
    // 어떤 선지를 골랐는지 없는 기록임을 한 번만 밝힌다
    await expect(page.getByText('어떤 선지를 골랐는지는 남아 있지 않아요')).toBeVisible();
  });

  test('학원 과제에는 반 순위와 반 평균이 나오고 개인 학습에는 없다', async ({ page }) => {
    await loginParent(page);
    await page.getByText('정예린').click();
    await openRecordedMonth(page);

    // 월 집계: 반 평균 대비. 순위를 평균 내지 않고 '반 평균보다 높은 과제 수'로 센다.
    await expect(page.getByTestId('metric-academy-rate')).toContainText('반 평균');
    await expect(page.getByTestId('metric-class')).toBeVisible();
    // 개인 학습에는 또래 비교가 없다
    await expect(page.getByTestId('metric-personal-rate')).toContainText('또래 비교는 두지 않아요');

    // 과제 행에는 순위가 붙는다
    await expect(page.getByTestId(`report-item-${sid('a_kor1_1')}`)).toContainText('번째');
    // 개인 학습 행에는 붙지 않는다
    await expect(page.getByTestId(`report-item-${personalItemId('ct_lit_1')}`)).not.toContainText('번째');

    // 과제 상세에도 반 비교가 있다
    await page.getByTestId(`report-item-${sid('a_kor1_1')}`).click();
    await expect(page.getByTestId('attempt-class')).toContainText('반 평균');
  });

  test('제출한 학생이 적으면 반 비교를 만들지 않는다', async ({ page }) => {
    // 새로 배정한 과제는 아무도 안 냈으므로 순위가 없다.
    await page.goto('/login');
    await loginHere(page, 'hanbit.director');
    await page.getByRole('link', { name: '학습 배정' }).click();
    await page.getByTestId(`assign-class-${sid('c_kor1')}`).click();
    await page.getByTestId('assign-content-search').fill('평상 위의 노인');
    await page.getByTestId(`assign-content-${sid('ct_lit_1')}`).click();
    await page.getByTestId('assign-submit').click();

    await page.getByRole('link', { name: '학원 관리' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'yerin');
    await page.getByRole('link', { name: '학습' }).click();
    await page.getByTestId('learn-academy-more').click();
    await page.getByText('평상 위의 노인').first().click();
    await page.getByTestId('detail-start').click();
    await answerAll(page);
    await page.getByTestId('solve-submit').click();

    await page.getByRole('link', { name: '내 정보' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'minji');
    await page.getByText('정예린').click();
    // 제출자가 한 명뿐인 과제에는 순위를 붙이지 않는다
    /*
      방금 만든 배정의 행. id가 uuid라 접두로 구분할 수 없다 — 제목으로 찾는다.
      (예전에는 메모리 카운터라 `a_new_0` 접두가 통했다.)
    */
    const row = page.getByTestId(/^report-item-/).filter({ hasText: '평상 위의 노인' }).first();
    await expect(row).toBeVisible();
    await expect(row).not.toContainText('번째');
  });

  test('자녀가 앱에서 낸 학원 과제도 리포트가 제출일과 문항 내역을 보여 준다', async ({ page }) => {
    /*
      회귀 방지(D-060). 예전에는 이 경로에서 리포트가 죽었다 —
      `markAssignmentSubmitted`가 `wrongQIds`를 저장하지 않아 행의 정답 수가 비었고,
      `correctOf`가 자기를 다시 호출해 스택 오버플로가 났다. 시드 제출에는 `wrongQIds`가
      있어서 E2E 전체가 통과하는 동안 이 경로만 비어 있었다.
    */
    const crashes: string[] = [];
    page.on('pageerror', (e) => crashes.push(e.message));

    await page.goto('/login');
    await loginHere(page, 'yerin');
    await page.getByRole('link', { name: '학습' }).click();
    await page.getByText('현대소설 점검').first().click();
    await page.getByTestId('detail-start').click();
    await answerAll(page);
    await page.getByTestId('solve-submit').click();
    await expect(page).toHaveURL(/\/student\/result\//);

    await page.getByRole('link', { name: '내 정보' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'minji');
    await page.getByRole('link', { name: '리포트' }).click();
    await page.getByText('정예린').click();

    // 화면이 살아 있고, 마감일을 제출일 자리에 넣지 않는다(D-048).
    await expect(page.getByText(/\d+월 학습$/)).toBeVisible();
    await expect(page.getByText('제출일 기록 없음')).toHaveCount(0);
    expect(crashes).toEqual([]);
  });

  test('담은 오답을 하나씩 넘겨 다 볼 수 있다', async ({ page }) => {
    await loginParent(page);
    await page.getByText('정예린').click();
    await openRecordedMonth(page);
    /*
      7월 오답 8개(개인 3 + 학원 배정 5) → 하나씩 넘겨 다 볼 수 있다.
      학부모는 자녀의 개인·학원 오답을 모두 본다(마스터 플랜 2절) — 학원은 배정 오답만 본다.
    */
    await expect(page.getByTestId('note-pager')).toContainText('8개 중 1–1');
    const first = await page.getByText('자녀가 정리한 메모').first().isVisible();
    expect(first).toBe(true);

    await page.getByTestId('note-pager-next').click();
    await expect(page.getByTestId('note-pager')).toContainText('8개 중 2–2');
    await page.getByTestId('note-pager-next').click();
    await expect(page.getByTestId('note-pager')).toContainText('8개 중 3–3');
    await page.getByTestId('note-pager-prev').click();
    await expect(page.getByTestId('note-pager')).toContainText('8개 중 2–2');
  });

  test('이번 주 요약을 만들면 그 주 내내 남는다', async ({ page }) => {
    /*
      요약은 **이번 주에 기록이 있을 때만** 만들 수 있다. 시드 기록은 2026-07에 멈춰 있어
      주가 바뀌면 자동으로 비므로, 자녀가 이번 주에 하나 제출한 상태를 이 테스트가 직접 만든다.
      (달력에 기대는 대신 스스로 조건을 갖춘다 — 같은 파일의 다른 테스트들과 같은 방식이다.)
    */
    await page.goto('/login');
    await loginHere(page, 'yerin');
    await openFirstPersonal(page);
    await page.getByTestId('detail-start').click();
    await answerAll(page);
    await page.getByTestId('solve-submit').click();
    await expect(page).toHaveURL(/\/student\/result\//);
    await page.getByRole('link', { name: '내 정보' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'minji');
    await page.getByText('정예린').click();

    // 요약이 없으면 버튼 하나만 있다
    await expect(page.getByTestId('week-summary')).toBeVisible();
    await page.getByTestId('week-summary').click();
    await expect(page.getByTestId('toast')).toHaveText('이번 주 요약을 만들었어요');
    // 만든 뒤에는 버튼이 사라지고 요약과 다시 만들기가 남는다
    await expect(page.getByTestId('week-summary')).toHaveCount(0);
    await expect(page.getByTestId('week-summary-again')).toBeVisible();
    await expect(page.getByText(/에 만든 요약이에요/)).toBeVisible();

    /*
      다른 자녀를 보고 돌아와도 그대로 남아 있다.

      **이하은에게 "이번 주 기록 없음"을 기대하지 않는다.** seed 날짜는 돌린 날 기준 상대값이라
      (`HAEUN_OFFSETS = [-2, -4, -30]`) 오늘이 무슨 요일인지에 따라 이번 주에 들어온다.
      여기서 확인할 성질은 **요약이 자녀별로 따로 남는다**는 것이고, 그건 날짜와 무관하다.
    */
    await page.getByRole('button', { name: '이하은' }).click();
    await expect(page.getByTestId('week-summary-again')).toHaveCount(0);
    await page.getByRole('button', { name: '정예린' }).click();
    await expect(page.getByTestId('week-summary-again')).toBeVisible();
  });

  test('지난달 리포트에는 이번 주 요약을 두지 않는다', async ({ page }) => {
    await loginParent(page);
    await page.getByText('정예린').click();
    // 리포트는 이번 달로 열린다(D-090). 그 달에만 '이번 주'가 뜻을 가진다.
    await expect(page.getByText('이번 주 요약')).toBeVisible();
    const thisMonth = await page.getByTestId('month-label').textContent();
    await page.getByTestId('month-prev').click();
    await expect(page.getByTestId('month-label')).not.toHaveText(thisMonth!);
    // '이번 주'는 이번 달 리포트에서만 뜻이 있다
    await expect(page.getByText('이번 주 요약')).toHaveCount(0);
    await expect(page.getByTestId('week-summary')).toHaveCount(0);
  });

  test('칭찬을 보내면 자녀 홈 맨 위에 뜨고 자녀가 확인해 닫는다', async ({ page }) => {
    await loginParent(page);
    await page.getByText('정예린').click();
    await page.getByTestId('praise-open').click();
    await page.getByTestId('praise-steady').click();
    await expect(page.getByTestId('toast')).toHaveText('칭찬을 보냈어요');
    await expect(page.getByTestId('praise-sent')).toContainText('꾸준히 했어요');

    await page.getByRole('link', { name: '내 정보' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'yerin');

    /*
      히어로보다 위에 온다. 히어로를 **보이는 문장**으로 잡는다 — 정예린은 담아 둔 학습도 남은
      학원 과제도 없어서 히어로에 올라갈 학습이 없고(D-140) `today-primary`가 그리지 않는다.
      확인하려는 것은 자리(칭찬 한 줄이 히어로 위)이므로 그 자리에 실제로 서는 면을 잡는다.
    */
    const line = page.getByText(/님이 칭찬을 보냈어요/);
    const praise = await line.boundingBox();
    const hero = await page.getByText('오늘 할 일을 다 끝냈어요').boundingBox();
    expect(praise!.y).toBeLessThan(hero!.y);
    await expect(line).toContainText('꾸준히 했어요');

    // 확인하면 사라진다
    await page.getByRole('button', { name: '칭찬 확인' }).click();
    await expect(page.getByText(/님이 칭찬을 보냈어요/)).toHaveCount(0);
  });

  test('자세히 보기에서 기한 내 제출과 반 구간을 보고 리포트로 돌아온다', async ({ page }) => {
    await loginParent(page);
    await page.getByText('정예린').click();
    await openRecordedMonth(page);
    await page.getByTestId('report-detail').click();
    await expect(page).toHaveURL(/\/parent\/detail/);

    await expect(page.getByTestId('detail-ontime')).toContainText('기한 내 제출');
    await expect(page.getByTestId('detail-complete')).toContainText('완료율');
    // 등수와 구간을 함께 말한다
    await expect(page.getByTestId(`detail-rank-${sid('a_kor1_1')}`)).toContainText('번째');
    await expect(page.getByTestId(`detail-rank-${sid('a_kor1_1')}`)).toContainText('위권');
    // 없는 것을 밝힌다
    await expect(page.getByText('이 리포트가 말하지 않는 것')).toBeVisible();
    await expect(page.getByText(/등급이나 예상 점수는 만들지 않아요/)).toBeVisible();
    // 순공부 시간이 아니라는 사실을 밝힌다
    await expect(page.getByText(/순공부 시간은 아니에요/)).toBeVisible();

    await page.getByTestId('screen-back').click();
    await expect(page).toHaveURL(/\/parent\/report/);
  });

  test('리포트 탭에서 자녀를 전환한다', async ({ page }) => {
    await loginParent(page);
    await page.getByRole('link', { name: '리포트' }).click();
    await expect(page).toHaveURL(/\/parent\/report/);
    await page.getByRole('button', { name: '정예린' }).click();
    await expect(page.getByText('정예린 님 리포트')).toBeVisible();
    await openRecordedMonth(page);
    await expect(page.getByText(/\d+월 학습$/)).toBeVisible();
    await expect(page.getByText(/\d+월 학습 기록/)).toBeVisible();
  });

  test('자녀 탭에서 이용권을 보고 내가 대신 낼 수 있다', async ({ page }) => {
    await loginParent(page);
    await page.getByRole('link', { name: '자녀' }).click();
    // 학원 이용권과 개인 이용권을 동시에 가질 수 있다(이용권 병존)
    await expect(page.getByText('한빛학원').first()).toBeVisible();
    await expect(page.getByTestId(`billing-personal-${sid('u_student_both')}`)).toContainText(
      '자녀 본인이 내고 있어요',
    );

    await page.getByTestId(`billing-offer-${sid('u_student_both')}`).click();
    await expect(page.getByTestId('toast')).toHaveText('내가 내기로 표시했어요');
    await expect(page.getByText(/내가 내기로 표시했어요/).first()).toBeVisible();
    // 실제 청구가 아니라는 사실을 화면이 밝힌다
    await expect(page.getByText(/결제 연결은 아직 준비 중이에요/)).toBeVisible();

    /*
      **표시는 서버에 남는다.** 예전에는 provider의 `useState`라 새로고침하면 사라졌고, 화면은
      그 사이 `표시했어요`라고 말했다. 새로고침 뒤에도 `표시 취소`가 있어야 한다.
    */
    await page.reload();
    await expect(page.getByTestId(`billing-cancel-${sid('u_student_both')}`)).toBeVisible();
    await expect(page.getByTestId(`billing-offer-${sid('u_student_both')}`)).toHaveCount(0);

    await page.getByTestId(`billing-cancel-${sid('u_student_both')}`).click();
    await expect(page.getByTestId(`billing-offer-${sid('u_student_both')}`)).toBeVisible();
    // 취소도 남는다 — `canceled_at`을 채우므로 다시 열어도 표시가 없다.
    await page.reload();
    await expect(page.getByTestId(`billing-offer-${sid('u_student_both')}`)).toBeVisible();
  });

  test('리포트는 달마다 하나이고 누적하지 않는다', async ({ page }) => {
    await loginParent(page);
    await page.getByText('이하은').click();
    await openRecordedMonth(page);
    /*
      **달마다 하나이고 합치지 않는다.** 기록이 놓인 달과 일수는 seed 오프셋에서 계산한다 —
      고정 달을 박으면 달이 바뀌는 순간 통째로 깨진다(D-090이 기록한 문제).
    */
    const [recent, older] = seedMonths(HAEUN_OFFSETS);
    await expect(page.getByTestId('month-label')).toHaveText(recent.label);
    expect(await page.getByTestId('metric-days').textContent()).toContain(`${recent.days}일`);

    // 왼쪽 화살표가 과거다. 지난달이 이번 달 오른쪽에 오지 않는다.
    await page.getByTestId('month-prev').click();
    await expect(page.getByTestId('month-label')).toHaveText(older.label);
    expect(await page.getByTestId('metric-days').textContent()).toContain(`${older.days}일`);

    // 오른쪽은 미래로 되돌아온다
    await page.getByTestId('month-next').click();
    await expect(page.getByTestId('month-label')).toHaveText(recent.label);
  });

  test('달 이동은 왼쪽이 과거이고 갈 곳이 없으면 막힌다', async ({ page }) => {
    await loginParent(page);
    await page.getByText('이하은').click();
    // 리포트는 이번 달로 열린다. 목록에서 가장 나중 달이라 오른쪽(미래)은 갈 곳이 없다.
    await expect(page.getByTestId('month-next')).toBeDisabled();
    await expect(page.getByTestId('month-prev')).toBeEnabled();

    // 왼쪽은 과거다. 끝까지 가면 이하은의 가장 오래된 기록이 있는 달에서 멈춘다.
    for (let i = 0; i < 12 && (await page.getByTestId('month-prev').isEnabled()); i++) {
      await page.getByTestId('month-prev').click();
    }
    const months = seedMonths(HAEUN_OFFSETS);
    await expect(page.getByTestId('month-label')).toHaveText(months[months.length - 1].label);
    // 6월에서 왼쪽(더 과거)은 갈 곳이 없다
    await expect(page.getByTestId('month-prev')).toBeDisabled();
    await expect(page.getByTestId('month-next')).toBeEnabled();
  });

  test('오답노트를 얼마나 했는지 달마다 보여준다', async ({ page }) => {
    await loginParent(page);
    await page.getByText('이하은').click();
    await openRecordedMonth(page);
    // 달 이름은 seed 오프셋에서 계산한다 — 고정하면 달이 바뀔 때 깨진다.
    await expect(page.getByText(`${seedMonths(HAEUN_OFFSETS)[0].label} 오답노트`)).toBeVisible();
    await expect(page.getByTestId('report-notes')).toContainText('담은 오답');
    await expect(page.getByTestId('report-notes')).toContainText('AI와 정리');
    // 없앤 지표가 어디에도 남아 있지 않다
    await expect(page.getByText('이해 완료')).toHaveCount(0);
  });

  test('자녀가 정리한 오답노트 메모와 별표를 학부모가 본다', async ({ page }) => {
    await page.goto('/login');
    await loginHere(page, 'yerin');
    await openFirstPersonal(page);
    await page.getByTestId('detail-start').click();
    await answerAll(page);
    await page.getByTestId('solve-submit').click();
    await keepWrongNotes(page);

    /*
      오답노트에서 별표를 달고 메모를 정리한다. **방금 담은 오답**(목록 맨 아래)에 한다 —
      맨 위는 지난달 시드 오답이라, 거기에 붙이면 학부모가 이번 달 리포트에서 볼 수 없다.
    */
    await page.getByTestId('result-notebook').click();
    await page.getByRole('button', { name: '별표 달기' }).last().click();
    const ask = page.locator('[data-testid^="ask-"]').last();
    await ask.fill('왜 이게 정답인가요?');
    await page.locator('[data-testid^="send-"]').last().click();
    /*
      앞 행동(오답 담기)의 토스트가 아직 화면에 있으면 다음 토스트를 단정하다 그 문구를 읽는다.
      토스트는 한 자리에 하나씩 뜨므로 먼저 비워야 한다(A-047, D-045 검증에서 쓴 방식과 같다).
    */
    await expect(page.getByTestId('toast')).toHaveCount(0, { timeout: 6000 });
    await page.locator('[data-testid^="summ-"]').last().click();
    await expect(page.getByTestId('toast')).toHaveText('노트에 정리했어요');

    await page.getByRole('link', { name: '내 정보' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'minji');
    await page.getByText('정예린').click();
    await openRecordedMonth(page);

    await expect(page.getByText(/\d+월 오답노트/)).toBeVisible();
    await expect(page.getByTestId('report-notes')).toContainText('담은 오답');
    // 자녀가 단 별표도 학부모가 센 수에 들어온다
    await expect(page.getByTestId('report-notes')).toContainText(/별표 [1-9]/);
    /*
      리포트는 담은 오답을 한 장씩 보여 준다. 메모는 그중 한 장에만 붙어 있으므로 넘겨서 찾는다.
      (예전에는 시드 오답 첫 장에 메모가 있어 넘기지 않아도 보였다 — 이 테스트가 확인하려는 것은
      **방금 자녀가 정리한 메모**라 첫 장에 있는지에 기대면 안 된다.)
    */
    const memo = page.getByText('자녀가 정리한 메모');
    const next = page.getByTestId('note-pager-next');
    for (let i = 0; i < 12 && (await memo.count()) === 0 && (await next.count()) > 0; i++) {
      await next.click();
    }
    await expect(memo.first()).toBeVisible();
  });
});
