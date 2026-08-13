import { expect, type Page } from '@playwright/test';

/**
 * 학습 배정 3단계(반 → 학습 → 확인)를 지나 배정한다.
 *
 * 배정 화면이 한 페이지에 반 122개와 콘텐츠 전체를 라디오로 쏟던 것을 단계로 나눴다(D-062).
 * 여러 테스트가 같은 세 단계를 지나므로 여기 한곳에 둔다 — 흐름이 또 바뀌면 이 파일만 고친다.
 *
 * 콘텐츠는 **제목 검색**으로 고른다. 학년→영역→세부 유형 드릴다운도 있지만 세부 유형 이름에
 * 공백·중점이 섞여 있어(`어문 규정 - 맞춤법`) 테스트가 분류 표기 변경에 쉽게 깨진다.
 */
export async function assignLearning(
  page: Page,
  opts: { classId: string; contentId: string; search: string; due?: string },
) {
  await page.getByTestId(`assign-class-${opts.classId}`).click();
  await page.getByTestId('assign-content-search').fill(opts.search);
  await page.getByTestId(`assign-content-${opts.contentId}`).click();
  if (opts.due !== undefined) {
    await page.getByTestId('assign-due').fill(opts.due);
  }
  await page.getByTestId('assign-submit').click();
}

/** 배정이 끝났음을 확인한다. 완료 화면은 무엇을 냈는지 되짚어 준다. */
export async function expectAssigned(page: Page) {
  await expect(page.getByText('학습을 배정했어요')).toBeVisible();
}
