import { type Page } from '@playwright/test';

/**
 * 풀이 화면의 **보기** 라디오. 이름으로 고른다.
 *
 * 순서로 세면(`getByRole('radio').first()`) 화면 맨 위 `5문항씩 / 한 문항씩` 보기 방식 토글이
 * 먼저 걸린다 — 그 토글도 하나를 고르는 라디오 묶음이기 때문이다(D-166). 이름 규칙은
 * 풀이 화면 한 곳이 정하므로, 스펙들이 정규식을 각자 적으면 그 한 문자열이 바뀔 때
 * 다섯 파일을 찾아야 한다.
 *
 * `n`을 주면 그 번째 보기만(`보기 1`), 없으면 모든 보기다.
 */
export const choices = (page: Page, n?: number) =>
  page.getByRole('radio', { name: n == null ? /보기 \d+$/ : new RegExp(`보기 ${n}$`) });

/**
 * 풀이 화면에서 모든 문항의 첫 보기를 고른다.
 * 문항은 한 화면에 최대 5개만 나오므로 '다음'으로 페이지를 넘기며 고른다.
 * 보기 수가 문항마다 달라도 되도록 '…보기 1' 라디오만 눌러 센다.
 */
export async function answerAll(page: Page) {
  // 페이지 수 상한. 무한 루프를 막는 안전장치다(문항 100개까지).
  for (let guard = 0; guard < 20; guard++) {
    const firstChoices = choices(page, 1);
    const count = await firstChoices.count();
    for (let i = 0; i < count; i++) await firstChoices.nth(i).click();
    const next = page.getByTestId('solve-next');
    if ((await next.count()) === 0) return;
    await next.click();
  }
  throw new Error('문항 페이지가 20장을 넘었어요. 풀이 화면 페이지 나누기를 확인해 주세요.');
}

/**
 * 개인 학습 하나(고1 · 독서 · `인문(일반)` · `정보의 홍수와 비판적 읽기`)의 상세로 들어간다.
 *
 * 예전에는 이 자리가 홈 히어로의 `시작하기` 한 번이었다. 히어로 후보가 **학생이 약속한 일**
 * (담아 둔 학습 → 남은 학원 과제)로 좁혀지면서(D-140) 담은 것도 배정도 없는 계정의 홈에는
 * 히어로가 `오늘 할 일을 다 끝냈어요`라 `시작하기`가 없다 — 개인 학습은 학습 탭에서 고른다.
 *
 * 여는 세트를 고정한 이유: 예전 히어로는 `공개 카탈로그의 첫 세트`라 콘텐츠가 늘거나 순서가
 * 바뀌면 다른 학습이 열렸다. 이제 테스트가 무엇을 푸는지 이름으로 남는다.
 */
export async function openFirstPersonal(page: Page) {
  await pickTopic(page, { grade: 1, area: '독서', topic: '인문(일반)' });
  await page.getByText('정보의 홍수와 비판적 읽기').first().click();
}

/**
 * 학습 탭 → 고르기에서 학년 → 영역 → 세부 유형까지 뎁스를 타고 들어간다.
 *
 * 이 다섯 줄이 스펙 여섯 곳에 복제돼 있었다. `learn-*` testID나 분류 이름이 하나 바뀌면
 * 그만큼을 찾아야 했다.
 */
export async function pickTopic(
  page: Page,
  { grade, area, topic }: { grade: 1 | 2 | 3; area: string; topic: string },
) {
  await page.getByRole('link', { name: '학습' }).click();
  await page.getByTestId('learn-pick').click();
  await page.getByTestId(`learn-grade-${grade}`).click();
  await page.getByTestId(`learn-area-${area}`).click();
  await page.getByTestId(`learn-topic-${topic}`).click();
}

/** 결과 화면에서 아직 담지 않은 오답을 위에서부터 오답노트에 담는다. */
export async function keepWrongNotes(page: Page, count = 1) {
  for (let i = 0; i < count; i++) {
    await page.getByRole('checkbox', { name: '오답노트에 담기' }).first().click();
  }
}
