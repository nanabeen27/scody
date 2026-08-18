import { test, expect } from './_fixtures';
import { dayFromToday, displayDate, sid } from './_ids';
import { type Page } from '@playwright/test';
import { loginHere } from './_auth';
import { answerAll } from './_solve';
import { assignLearning, expectAssigned } from './_assign';

/** 배정·재배정에 쓰는 날짜. 고정 날짜를 박으면 그 날이 지나는 순간 검증에 막힌다. */
const FUTURE_DUE = dayFromToday(14);
const PAST_DUE = dayFromToday(-14);

async function loginAs(page: Page, scodyId: string) {
  await page.goto('/login');
  await loginHere(page, scodyId);
  await expect(page).toHaveURL(/\/academy/);
}

test.describe('M4 학원 흐름', () => {
  test('학생이 학원 과제를 제출하면 학원 제출 현황에 반영된다', async ({ page }) => {
    // 박도윤: 학원 이용권만. 시드에서 '현대소설 점검' 미제출(제출 1/2).
    await page.goto('/login');
    await loginHere(page, 'doyun');
    await expect(page).toHaveURL(/\/student/);

    await page.getByRole('link', { name: '학습' }).click();
    await page.getByText('현대소설 점검').click();
    await page.getByTestId('detail-start').click();
    await answerAll(page);
    await page.getByTestId('solve-submit').click();
    await expect(page).toHaveURL(/\/student\/result\//);

    await page.getByRole('link', { name: '내 정보' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'hanbit.director');

    await page.getByRole('link', { name: '성과 분석' }).click();
    // 학원 배정이 수백 건이라 이름으로 좁혀서 찾는다(실제 선생님도 같은 길을 쓴다).
    await page.getByTestId('submit-search').fill('현대소설 점검');
    await expect(page.getByText(/현대소설 점검/).first()).toBeVisible();
    await expect(page.getByText(/제출 9\/9/)).toBeVisible();
    // 미제출이 사라지면 확인 대상에서도 빠진다
    await page.getByTestId('need-search').fill('박도윤');
    await expect(page.getByText('박도윤')).toHaveCount(0);
  });

  test('원장: 성과 분석에서 미제출 학생을 이름으로 확인한다', async ({ page }) => {
    await loginAs(page, 'hanbit.director');
    await page.getByRole('link', { name: '성과 분석' }).click();
    await expect(page.getByText('확인이 필요한 학생')).toBeVisible();
    await page.getByTestId('need-search').fill('박도윤');
    await expect(page.getByText('박도윤')).toBeVisible();
    await expect(page.getByText(/현대소설 점검 미제출/)).toBeVisible();
  });


  test('원장: 대시보드→반·학생→반 상세', async ({ page }) => {
    await loginAs(page, 'hanbit.director');
    // 대시보드는 내비를 글자로 복제하지 않는다. 지표와 반별 수행률이 그 자리를 대신한다(D-061).
    await expect(page.getByTestId('academy-kpi')).toBeVisible();
    /*
      추이선과 반별 표가 지표 자리를 대신한다.
      390에서는 추이가 접혀 있다 — `확인이 필요해요`를 첫 화면 안으로 끌어올리기 위해서다.
      사람과 똑같이 눌러서 펼친다.
    */
    const trendToggle = page.getByTestId('academy-trend-toggle');
    if ((await trendToggle.count()) > 0) {
      const open = await trendToggle.getAttribute('aria-expanded');
      if (open !== 'true') await trendToggle.click();
    }
    await expect(page.getByTestId('academy-trend-rate')).toBeVisible();
    await expect(page.getByText('반별 현황').first()).toBeVisible();
    await page.getByRole('link', { name: '반·학생' }).click();
    // 반 122개는 제출률 낮은 순이라 특정 반은 이름으로 좁혀서 찾는다.
    await expect(page.getByText('고1 국어', { exact: true })).toBeVisible();
    await page.getByText('고1 국어', { exact: true }).click();
    await expect(page).toHaveURL(/\/academy\/classes\//);
    await expect(page.getByText('담당 선생님')).toBeVisible();
    await expect(page.getByText('오선생')).toBeVisible();
    await expect(page.getByText('정예린')).toBeVisible();
  });

  test('원장: 학습 배정 → 성과 분석에 반영', async ({ page }) => {
    await loginAs(page, 'hanbit.director');
    await page.getByRole('link', { name: '학습 배정' }).click();
    await assignLearning(page, {
      classId: sid('c_kor1'),
      contentId: sid('ct_gram_1'),
      search: '맞춤법',
    });
    await expectAssigned(page);
    await page.getByTestId('assign-goto-analytics').click();
    await expect(page).toHaveURL(/\/academy\/analytics/);
    await expect(page.getByText(/헷갈리는 맞춤법·어법/).first()).toBeVisible();
  });

  test('원장: 반 상세에서 학생별 제출 요약을 보고 목록으로 돌아간다', async ({ page }) => {
    await loginAs(page, 'hanbit.director');
    await page.getByRole('link', { name: '반·학생' }).click();
    const listUrl = page.url();
    // 반이 5개를 넘지 않으면 검색창을 두지 않는다(`SEARCH_FROM`). 목록에서 바로 누른다.
    await page.getByText('고1 국어', { exact: true }).click();

    await expect(page.getByText('정예린')).toBeVisible();
    await expect(page.getByText(/제출 1\/1 · 평균 80%/).first()).toBeVisible();
    await expect(page.getByText(/제출 0\/1/).first()).toBeVisible();

    await page.getByTestId('screen-back').click();
    await expect(page).toHaveURL(listUrl);
  });

  test('배정할 때 정한 마감일이 학생 화면까지 전달된다', async ({ page }) => {
    await loginAs(page, 'hanbit.director');
    await page.getByRole('link', { name: '학습 배정' }).click();
    await assignLearning(page, {
      classId: sid('c_kor1'),
      contentId: sid('ct_gram_1'),
      search: '맞춤법',
      due: FUTURE_DUE,
    });
    await expectAssigned(page);

    await page.getByTestId('assign-goto-analytics').click();
    await page.getByTestId('submit-search').fill('헷갈리는 맞춤법·어법');
    // 학원 화면도 학생·학부모와 같은 마감 문장을 쓴다(ISO 원문 금지).
    // ISO 원문(`2026-08-27`)이 아니라 학생·학부모와 같은 문장으로 말한다.
    await expect(page.getByText(`${displayDate(FUTURE_DUE)}까지`).first()).toBeVisible();
    await expect(page.getByText(FUTURE_DUE)).toHaveCount(0);

    await page.getByRole('link', { name: '학원 관리' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'yerin'); // 고1 국어 반 학생

    await page.getByRole('link', { name: '학습' }).click();
    // 목록은 급한 것부터 세 줄까지 보여 준다. 새 배정은 마감이 가장 멀어 더 보기 안에 있다.
    await page.getByTestId('learn-academy-more').click();
    await expect(page.getByText(`${displayDate(FUTURE_DUE)}까지`).first()).toBeVisible();
  });

  test('새로 배정한 과제는 학생 홈에 알림으로 뜨고, 한 문항이라도 풀면 사라진다', async ({
    page,
  }) => {
    await loginAs(page, 'hanbit.director');
    await page.getByRole('link', { name: '학습 배정' }).click();
    await assignLearning(page, {
      classId: sid('c_kor1'),
      contentId: sid('ct_gram_1'),
      search: '맞춤법',
      due: FUTURE_DUE,
    });
    await expectAssigned(page);

    await page.getByRole('link', { name: '학원 관리' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'yerin'); // 고1 국어 반 학생

    await expect(page.getByTestId('home-academy-new')).toHaveText('새 과제가 배정되었어요');

    // 한 문항만 고르고 나온다. 답이 저장되는 순간 '진행 중'이 되어 새 과제에서 빠진다.
    await page.getByRole('link', { name: '학습' }).click();
    await page.getByTestId('learn-academy-more').click();
    await page.getByText('헷갈리는 맞춤법·어법').click();
    await page.getByTestId('detail-start').click();
    await page
      .getByRole('radio', { name: /보기 1$/ })
      .first()
      .click();

    // 풀이 화면은 집중 모드라 탭이 없다. 들어온 길로 나와 홈으로 간다.
    await page.getByTestId('focus-exit').click();
    await page.getByTestId('brand-home').click();
    await expect(page.getByText('학원에서 내준 과제가 있어요')).toBeVisible();
    await expect(page.getByTestId('home-academy-new')).toHaveCount(0);
  });

  test('마감이 지난 미제출 과제는 새 과제로 알리지 않고, 재배정하면 다시 알린다', async ({
    page,
  }) => {
    // 박도윤: 현대소설 점검(2026-07-24 마감)이 미제출로 남아 있다.
    await page.goto('/login');
    await loginHere(page, 'doyun');
    await expect(page.getByText('학원에서 내준 과제가 있어요')).toBeVisible();
    await expect(page.getByTestId('home-academy-new')).toHaveCount(0);

    await page.getByRole('link', { name: '내 정보' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'hanbit.director');

    await page.getByRole('link', { name: '성과 분석' }).click();
    await page.getByTestId('submit-search').fill('현대소설 점검');
    await page.getByTestId(`reassign-open-${sid('a_kor1_1')}`).click();
    await page.getByTestId(`reassign-due-${sid('a_kor1_1')}`).fill(PAST_DUE);
    await page.getByTestId(`reassign-submit-${sid('a_kor1_1')}`).click();
    await expect(page.getByText('오늘보다 뒤인 날짜로 정해 주세요.')).toBeVisible();

    await page.getByTestId(`reassign-due-${sid('a_kor1_1')}`).fill(FUTURE_DUE);
    await page.getByTestId(`reassign-submit-${sid('a_kor1_1')}`).click();
    await expect(page.getByTestId('toast')).toHaveText('마감일을 다시 정했어요');
    // 마감일이 다시 열렸으므로 이 목록에서 빠진다.
    await expect(page.getByTestId(`reassign-open-${sid('a_kor1_1')}`)).toHaveCount(0);

    await page.getByRole('link', { name: '학원 관리' }).click();
    await page.getByText('로그아웃').click();
    await loginHere(page, 'doyun');
    await expect(page.getByTestId('home-academy-new')).toHaveText('새 과제가 배정되었어요');
  });

  test('잘못된 마감일은 배정 전에 알려준다', async ({ page }) => {
    await loginAs(page, 'hanbit.director');
    await page.getByRole('link', { name: '학습 배정' }).click();
    // 마감일 입력은 반과 학습을 고른 뒤 확인 단계에만 있다(D-062).
    await page.getByTestId(`assign-class-${sid('c_kor1')}`).click();
    await page.getByTestId('assign-content-search').fill('맞춤법');
    await page.getByTestId(`assign-content-${sid('ct_gram_1')}`).click();

    await page.getByTestId('assign-due').fill('8/11');
    await page.getByTestId('assign-submit').click();
    await expect(page.getByText(/마감일은 2026-08-11 형식으로/)).toBeVisible();
    await expect(page.getByText('학습을 배정했어요')).toHaveCount(0);

    // 형식은 맞지만 없는 날짜도 걸러낸다(`parseDueDate`가 실제 달·일까지 본다).
    await page.getByTestId('assign-due').fill('2026-13-45');
    await page.getByTestId('assign-submit').click();
    await expect(page.getByText('없는 날짜예요. 달과 일을 다시 확인해 주세요.')).toBeVisible();
    await expect(page.getByText('학습을 배정했어요')).toHaveCount(0);
  });

  test('원장: 학원 관리에 초대와 선생님 목록', async ({ page }) => {
    await loginAs(page, 'hanbit.director');
    await page.getByRole('link', { name: '학원 관리' }).click();
    /*
      앞 두 줄은 **초대 목록의 행**이다(seed가 한빛학원에 학생·학부모·선생님 초대를 하나씩 심는다 —
      `scripts/gen-seed.ts`). 만들기 UI는 종류를 고르는 컨트롤이 생기면서 `초대 만들기` 한 섹션이
      되었으므로 그것을 따로 단정한다. 제목은 여러 곳에 나오므로 첫 번째로 좁힌다.
    */
    await expect(page.getByText('학생 초대').first()).toBeVisible();
    await expect(page.getByText('선생님 초대').first()).toBeVisible();
    await expect(page.getByText('초대 만들기').first()).toBeVisible();
    await expect(page.getByTestId('invite-kind-parent')).toBeVisible();
    await expect(page.getByText('오선생').first()).toBeVisible();
  });

  /*
    **규모용 로스터를 버렸다**(2026-08-13). 예전에는 반 122개·학생 3,002명을 단정하며 페이저가
    필요한 상태를 확인했는데, 그 데이터는 합성이었고 지금은 seed의 반 2개뿐이다. 페이저 자체는
    `admin` 목록에서 확인한다 — 여기서는 개수를 말하는 방식과 검색이 되는지를 본다.
  */
  test('원장: 반·학생 수가 보이고 반 목록에서 반 상세로 간다', async ({ page }) => {
    await loginAs(page, 'hanbit.director');
    await page.getByRole('link', { name: '반·학생' }).click();
    await expect(page.getByText(/반 \d+개 · 학생 [\d,]+명/)).toBeVisible();

    /*
      **검색창은 반이 5개를 넘을 때만 나온다**(`SEARCH_FROM`). seed에는 반이 2개라 지금은 없다 —
      찾을 것이 없는데 찾는 칸을 두지 않는 것이 맞다. 목록에서 바로 상세로 갈 수 있는지를 본다.
    */
    await expect(page.getByTestId('class-search')).toHaveCount(0);
    await page.getByText('고2 국어', { exact: true }).click();
    await expect(page).toHaveURL(/\/academy\/classes\//);
  });

  /*
    **선생님을 원장이 대신 만들지 않는다.** 예전에는 이름과 아이디를 받아 그 자리에서 구성원을
    만들었는데, 그렇게 만든 계정은 비밀번호가 없어 로그인할 수 없었고 실제 인증에서는 아예 만들
    수 없다 — 계정은 초대받은 사람이 자기 손으로 만든다(마스터 플랜 3절). 그래서 이 화면은
    **초대 링크를 만든다.**
  */
  test('원장: 선생님을 초대하고 구성원을 제외한다', async ({ page }) => {
    await loginAs(page, 'hanbit.director');
    await page.getByRole('link', { name: '학원 관리' }).click();
    // 원장은 선생님 수에 넣지 않는다. 제목은 구성원, 캡션이 둘을 갈라 말한다.
    await expect(page.getByText(/구성원 \d+명/)).toBeVisible();
    await expect(page.getByText(/원장 1명 · 선생님 \d+명/)).toBeVisible();

    /*
      초대 만들기는 세 종류가 되었고(학생·학부모·선생님, 확정 정책 3절) 기본값이 선생님이다.
      testID도 종류를 가리지 않는 이름으로 바뀌었다(`teacher-add` → `invite-create`,
      `teacher-invite-new` → `invite-new`).
    */
    await page.getByTestId('invite-create').click();
    await expect(page.getByTestId('toast')).toHaveText('초대 링크를 만들었어요');
    // 만든 링크를 그 자리에서 전달할 수 있다.
    await expect(page.getByTestId('invite-new')).toContainText('/join?invite=INV-T-');
    // 만든 뒤에 무엇이 남았는지 말한다 — 담당 반은 수락 뒤에 정한다.
    await expect(
      page.getByText('수락하면 구성원 목록에 나타나요. 그때 반 상세에서 담당으로 정할 수 있어요.'),
    ).toBeVisible();

    // 제외는 한 번 더 확인한다. 담당 반이 있는 선생님으로 확인한다.
    await page.getByTestId('teacher-search').fill('hanbit.teacher');
    await page.getByTestId('teacher-remove-hanbit.teacher').click();
    await expect(page.getByText('정말 제외할까요?')).toBeVisible();
    await page.getByTestId('teacher-remove-confirm-hanbit.teacher').click();
    await expect(page.getByText('오선생', { exact: true })).toHaveCount(0);
    await expect(page.getByText('찾는 선생님이 없어요')).toBeVisible();
  });

  /*
    **학부모 초대는 대상 학생을 고르는 단계가 있다**(확정 정책 3절 — 학원이 자녀 관계를 확인하고
    연결을 승인한다). 그 값이 초대 행에 적히고(`invites.target_student_id`, 0036), 수락한 계정이
    그 학생과 연결된다. 고르기 전에는 만들기 버튼을 두지 않는다 — 서버가 거부하는 버튼이다.
  */
  test('원장: 학부모 초대는 자녀를 고른 뒤에 만든다', async ({ page }) => {
    await loginAs(page, 'hanbit.director');
    await page.getByRole('link', { name: '학원 관리' }).click();
    await page.getByTestId('invite-kind-parent').click();
    await expect(page.getByTestId('invite-create')).toHaveCount(0);

    await page.getByTestId('invite-child-search').fill('박도윤');
    await page.getByTestId(`invite-child-${sid('u_student_academy')}`).click();
    await page.getByTestId('invite-create').click();

    await expect(page.getByTestId('toast')).toHaveText('초대 링크를 만들었어요');
    await expect(page.getByTestId('invite-new')).toContainText('박도윤');
    await expect(page.getByTestId('invite-new')).toContainText('/join?invite=INV-T-');
    // 목록에도 어느 자녀의 초대인지 남는다.
    await expect(page.getByText('학부모 초대 · 박도윤 학생').first()).toBeVisible();
  });

  test('원장: 선생님을 제외하면 담당 반이 미배정으로 바뀐다', async ({ page }) => {
    await loginAs(page, 'hanbit.director');
    await page.getByRole('link', { name: '반·학생' }).click();
    // 반이 5개를 넘지 않으면 검색창을 두지 않는다(`SEARCH_FROM`). 목록에서 바로 누른다.
    await page.getByText('고1 국어', { exact: true }).click();
    await expect(page.getByText('오선생').first()).toBeVisible();

    await page.getByRole('link', { name: '학원 관리' }).click();
    await page.getByTestId('teacher-search').fill('hanbit.teacher');
    await page.getByTestId('teacher-remove-hanbit.teacher').click();
    await page.getByTestId('teacher-remove-confirm-hanbit.teacher').click();

    await page.getByRole('link', { name: '반·학생' }).click();
    // 반이 5개를 넘지 않으면 검색창을 두지 않는다(`SEARCH_FROM`). 목록에서 바로 누른다.
    await page.getByText('고1 국어', { exact: true }).click();
    await expect(page.getByText('오선생')).toHaveCount(0);
    await expect(page.getByText('미배정').first()).toBeVisible();
  });

  test('원장: 반을 만들 때 정한 학년으로 배정 화면이 좁혀진다', async ({ page }) => {
    await loginAs(page, 'hanbit.director');
    await page.getByRole('link', { name: '반·학생' }).click();
    await page.getByTestId('class-new-open').click();
    // 이름에 학년이 없는 반이다 — 이름을 파싱하던 때는 어느 학년에도 걸리지 않았다.
    await page.getByTestId('class-new-name').fill('국어 심화반');
    await page.getByTestId('class-new-grade-3').click();
    await page.getByTestId('class-new-submit').click();
    await expect(page).toHaveURL(/\/academy\/classes\//);
    await expect(page.getByText('국어 심화반').first()).toBeVisible();

    /*
      **학년은 반 이름에서 읽지 않는다** — 이 반 이름(`국어 심화반`)에는 학년이 없다.

      학년 값이 어디에 쓰이는지 확인하던 자리는 배정 화면의 학년 필터였는데, 그 필터는 반이 한
      페이지를 넘을 때만 나온다(`assign.tsx`의 `big`). 규모용 로스터를 버린 뒤에는 반이 세 개라
      필터 자체가 없다 — 찾을 것이 없는데 필터를 두지 않는 것이 맞다.
      **학년으로 묶는 규칙은 단위 테스트가 지킨다**(`__tests__/academyStats.test.ts`의
      `학년이 있는 반만 학년으로 묶고, 학년을 이름에서 추측하지 않는다`).
      여기서는 이름에 학년이 없어도 반이 만들어지고 배정에 쓸 수 있는지를 본다.
    */
    await page.getByRole('link', { name: '학습 배정' }).click();
    await expect(page.getByText('국어 심화반').first()).toBeVisible();
  });

  test('원장: 학년을 정하지 않은 반은 학년 미정으로 모인다', async ({ page }) => {
    await loginAs(page, 'hanbit.director');
    await page.getByRole('link', { name: '반·학생' }).click();
    await page.getByTestId('class-new-open').click();
    await page.getByTestId('class-new-name').fill('주말 보충반');
    // 학년을 고르지 않으면 그 사실과 결과를 화면이 먼저 말한다.
    await expect(page.getByText(/학년별 요약에서/)).toBeVisible();
    await page.getByTestId('class-new-submit').click();

    // 학년을 비운 반도 배정할 수 있다. 학년별 요약에서만 `학년 미정`으로 모인다.
    await page.getByRole('link', { name: '학습 배정' }).click();
    await expect(page.getByText('주말 보충반').first()).toBeVisible();
  });

  test('선생님: 담당 반만 보이고 관리 권한이 제한된다', async ({ page }) => {
    await loginAs(page, 'hanbit.teacher'); // 오선생, 고1 국어만
    await page.getByRole('link', { name: '반·학생' }).click();
    await expect(page.getByText('고1 국어', { exact: true })).toBeVisible();
    await expect(page.getByText('고2 국어')).toHaveCount(0);
    await page.getByRole('link', { name: '학원 관리' }).click();
    // 지시문이 아니라 사실만 말하고, 담당 반으로 가는 길을 준다.
    await expect(page.getByText('초대와 요금제는 원장님이 관리해요.')).toBeVisible();
    await page.getByTestId('manage-goto-classes').click();
    await expect(page).toHaveURL(/\/academy\/classes/);
  });
});
