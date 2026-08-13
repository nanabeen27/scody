import { test, expect } from './_fixtures';
import { dayFromToday, displayDate, sid } from './_ids';
import { type Page } from '@playwright/test';
import { loginHere } from './_auth';

const FUTURE_DUE = dayFromToday(14);
const PAST_DUE = dayFromToday(-14);

/**
 * 학원 · 학생 한 명 상세(`/academy/classes/student/[id]`, D-080).
 *
 * 이 화면의 마감일 재배정은 성과 분석과 **같은 쓰기**다. 예전에는 여기서만 빈 입력이 통과해
 * 마감일이 지워진 채 `다시 정했어요`라고 말했고, 마감이 비면 그 배정은 재배정 목록에서
 * 사라져 되돌릴 자리도 없었다. 그 회귀를 여기서 막는다.
 */
async function openStudent(page: Page, name: string) {
  await page.goto('/login');
  await loginHere(page, 'hanbit.director');
  await expect(page).toHaveURL(/\/academy/);
  await page.getByRole('link', { name: '반·학생' }).click();
  await page.getByTestId('class-goto-students').click();
  await page.getByTestId('student-search').fill(name);
  await page.getByText(name).first().click();
  await expect(page.getByTestId('academy-student')).toBeVisible();
}

test.describe('학원 학생 상세', () => {
  test('마감일을 비워 두고 다시 배정하면 막고, 마감은 그대로 남는다', async ({ page }) => {
    await openStudent(page, '박도윤');
    // 박도윤은 `현대소설 점검`(2026-07-24 마감)을 아직 내지 않았다.
    await expect(page.getByTestId(`student-pending-${sid('a_kor1_1')}`)).toContainText('마감이 지났어요');

    await page.getByTestId(`student-reassign-open-${sid('a_kor1_1')}`).click();
    // 이 조작의 대상이 학생 한 명이 아니라 반 전체임을 화면이 말한다.
    await expect(page.getByText('고1 국어 전체가 받은 과제예요.')).toBeVisible();

    await page.getByTestId(`student-reassign-submit-${sid('a_kor1_1')}`).click();
    await expect(page.getByText('새 마감일을 적어 주세요.')).toBeVisible();
    // 마감일이 지워지지 않았다 — 지워졌다면 이 행의 마감 문장이 사라진다.
    await expect(page.getByTestId(`student-pending-${sid('a_kor1_1')}`)).toContainText('마감이 지났어요');

    // 오늘·과거 날짜도 성과 분석과 같은 문장으로 막는다.
    await page.getByTestId(`student-due-${sid('a_kor1_1')}`).fill(PAST_DUE);
    await page.getByTestId(`student-reassign-submit-${sid('a_kor1_1')}`).click();
    await expect(page.getByText('오늘보다 뒤인 날짜로 정해 주세요.')).toBeVisible();

    await page.getByTestId(`student-due-${sid('a_kor1_1')}`).fill(FUTURE_DUE);
    await page.getByTestId(`student-reassign-submit-${sid('a_kor1_1')}`).click();
    await expect(page.getByTestId('toast')).toHaveText('마감일을 다시 정했어요');
    await expect(page.getByTestId(`student-pending-${sid('a_kor1_1')}`)).toContainText(
      `${displayDate(FUTURE_DUE)}까지`,
    );
  });

  test('낸 과제는 반 평균 대비를 늘 보여 주고, 추이는 제출일로 기간을 밝힌다', async ({
    page,
  }) => {
    await openStudent(page, '정예린');
    // `반 평균 대비`는 상담에서 가장 많이 쓰는 값이라 모바일에서도 접지 않는다.
    await expect(page.getByTestId('student-history')).toContainText('반 평균 대비');
    /*
      **정확한 수치를 박지 않는다.** 반 평균은 반 친구들의 제출에서 계산되고, seed가 바뀌면 값도
      바뀐다. 여기서 지킬 성질은 **부호와 단위를 갖춘 대비 값을 늘 보여 준다**는 것이다.
    */
    await expect(page.getByTestId('student-history')).toContainText(/[+-]\d+%p/);
    // 추이에 시간 축을 준다.
    /*
      **고정 날짜를 박지 않는다.** seed가 기록을 실행일 기준 상대 간격으로 넣으므로 구간의 날짜는
      돌리는 날마다 다르다. 지킬 성질은 **제출일로 기간을 밝힌다**는 것이다.
    */
    await expect(
      page.getByText(/\d+월 \d+일에 낸 것부터 \d+월 \d+일에 낸 것까지예요\./),
    ).toBeVisible();
    // 같은 값을 다른 기준으로 두 번 말하지 않는다(반 평균은 표의 열 하나뿐이다).
    await expect(page.getByText('가장 최근 배정')).toHaveCount(0);
  });

  test('낸 과제를 펼치면 틀린 문항과 정답이 보인다', async ({ page }) => {
    await openStudent(page, '정예린');
    // 정예린은 `현대소설 점검`을 80%로 냈다(시드에 틀린 문항 2개가 있다).
    const history = page.getByTestId('student-history');
    await expect(history).toContainText('현대소설 점검');
    await history.getByText('현대소설 점검').click();
    await expect(page.getByText(/10문항 중 2문항을 틀렸어요/)).toBeVisible();
    // 정답을 함께 적는다. 학생이 고른 답은 제출 기록에 없어 지어내지 않는다.
    await expect(page.getByText(/^정답 /).first()).toBeVisible();
  });

  test('소속 반에서 반 상세로 간다', async ({ page }) => {
    await openStudent(page, '박도윤');
    await page.getByTestId(`student-class-${sid('c_kor1')}`).click();
    await expect(page).toHaveURL(new RegExp(`/academy/classes/${sid('c_kor1')}`));
  });
});
