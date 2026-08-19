import { expect, type Page } from '@playwright/test';

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

/**
 * 결과 화면에서 아직 담지 않은 오답을 위에서부터 오답노트에 담는다.
 *
 * **한 번 담긴 것을 확인한 뒤 다음을 누른다.** 예전에는 연속으로 눌렀는데, 담기가 서버를 한 번
 * 지나는 동안 그 줄의 이름이 아직 `오답노트에 담기`라서 `.first()`가 **같은 줄**을 다시 집었다.
 * 담기는 멱등이므로(`rpc_add_wrong_note`가 있으면 되살린다 — 지운 것을 다시 담는 길이다) 두 번째
 * 클릭이 조용히 삼켜지고 두 개를 담은 줄 알았던 테스트가 하나만 얻었다.
 *
 * 기다림이 곧 단정이다 — 이 헬퍼를 쓰는 스펙은 담긴 개수를 전제로 하므로, 여기서 어긋나면
 * 뒤에서 엉뚱한 자리가 실패한다.
 */
export async function keepWrongNotes(page: Page, count = 1) {
  const saved = page.getByRole('checkbox', { name: '오답노트에서 빼기' });
  for (let i = 0; i < count; i++) {
    const before = await saved.count();
    await page.getByRole('checkbox', { name: '오답노트에 담기' }).first().click();
    await expect(saved).toHaveCount(before + 1);
  }
}

/**
 * 카드 복습에서 카드 한 장을 끝낸다.
 *
 * **한 번의 클릭이 아니다.** 복습 한 장의 순서는 `답 고르기 → 근거 고르기 → 확인`이고, 근거는
 * 답을 **확인하기 전에** 물어야 하는 값이라 단계를 합칠 수 없다(확인한 뒤에 물으면 정답을 본
 * 다음의 답이 된다). 이 세 줄이 스펙 여러 곳에 복제되지 않게 여기 둔다.
 *
 * `slot`은 화면에 보이는 선지 자리다 — **원본 순서가 아니다.** 카드마다 선지를 섞으므로
 * (`shuffleOrder`) 몇 번째가 정답인지는 테스트가 알 수 없다. 정오에 기대는 단정을 쓰지 않는다.
 */
export async function reviewCard(
  page: Page,
  { slot = 0, evidence = 'passage' }: { slot?: number; evidence?: 'passage' | 'choices' | 'unsure' } = {},
) {
  await page.getByTestId(`review-choice-${slot}`).click();
  await page.getByTestId(`review-evidence-${evidence}`).click();
  await page.getByTestId('review-check').click();
  await page.getByTestId('review-feedback').waitFor();
}

/**
 * 학습 탭 → **오늘의 복습 덱**.
 *
 * 이 두 줄이 스펙 아홉 자리에 복제돼 있었다. `page.goto('/student/review')`로 줄이지 않는다 —
 * 새로 고치는 진입이라 대리 로그인 세션이 끊긴다(`admin-flow.spec.ts`의 `impersonate`).
 */
export async function openTodayDeck(page: Page) {
  await page.getByRole('link', { name: '학습' }).click();
  await page.getByTestId('learn-review-today').click();
}

/**
 * 학습 탭 → **오답노트**, 목록을 끝까지 펼친다.
 *
 * 목록은 5개에서 접히므로(`notebook-more`) 특정 노트를 찾는 단정은 펼침이 먼저다.
 * 접기 자체가 없는 계정에서도 그냥 통과하도록 개수를 보고 누른다.
 *
 * **개수를 보기 전에 조회가 끝나기를 기다린다.** `count()`는 기다리지 않으므로 조회 중에 물으면
 * 아직 없는 버튼을 0으로 읽고 펼치지 않은 채 지나간다 — 그러면 접힌 쪽에 있는 노트를 찾는
 * 호출부가 그 노트가 없다며 실패한다.
 */
export async function openNotebookAll(page: Page) {
  await page.getByRole('link', { name: '학습' }).click();
  await page.getByTestId('learn-notebook').click();
  await expect(page.getByText('오답을 불러오고 있어요.')).toHaveCount(0);
  const more = page.getByTestId('notebook-more');
  if ((await more.count()) > 0) await more.click();
}
