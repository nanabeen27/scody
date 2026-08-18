import { expect, type Page } from '@playwright/test';

/**
 * E2E 로그인 헬퍼.
 *
 * ## 왜 계정 패널을 쓰는가
 *
 * 로그인 화면의 정식 수단은 **스코디 아이디 + 비밀번호**다(D-166) — `auth-flow` 스펙이 그 길을
 * 직접 확인한다. 여기서 쓰지 않는 이유는 하나뿐이다: 이 헬퍼는 계정을 **골라** 들어가고,
 * 패널의 한 번 누르기가 아이디·비밀번호 두 칸을 채우는 것보다 짧다.
 *
 * 데이터가 Supabase로 옮겨 가면서 **로그인 전에는 DB에서 아무것도 읽을 수 없다**(RLS가 익명에게
 * 0행을 준다). 그래서 프로토타입의 휴대폰 조회 로그인은 없어졌다 — 휴대폰은 확정 정책 2절의
 * 자리(인증·복구·초대 확인·연락처 변경·알림)로 돌아갔고 로그인 화면에서는 내렸다.
 *
 * 카카오는 아직 연결되지 않았다(M-DB-2). 개발용 로그인이 켜진 빌드에서만 데모 계정으로 들어가고,
 * 꺼진 빌드에는 버튼이 없다. 그 갈림은 `auth-flow` 스펙이 확인한다.
 */

/**
 * 테스트 계정의 화면 표시 이름. 패널의 행 제목이 `이름 · 역할` 형태라 이름으로 찾는다.
 * `src/session/devAccounts.ts`와 짝을 맞춘다.
 */
export const NAME_BY_ID: Record<string, string> = {
  seojun: '김서준',
  haeun: '이하은',
  doyun: '박도윤',
  yerin: '정예린',
  minji: '최민지',
  'hanbit.director': '한빛 원장',
  'hanbit.teacher': '오선생',
  jihoon: '한지훈',
  admin: '스코디 관리자',
  // 다른 학원(새길학원). 격리를 화면에서 확인하는 스펙이 쓴다.
  'saegil.director': '새길 원장',
  'saegil.teacher': '새길 선생',
};

/**
 * 프로토타입 테스트 계정의 휴대폰 번호(합성 값).
 *
 * **로그인에는 쓰지 않는다** — 로그인 화면에는 번호 단계가 없다(D-166). 남은 쓰임은 가입 쪽의
 * `이미 가입된 번호예요` 검사뿐이다(`rpc_signup_phone_taken`).
 */
export const PHONE_BY_ID: Record<string, string> = {
  seojun: '010-1000-0001',
  haeun: '010-1000-0002',
  doyun: '010-1000-0003',
  yerin: '010-1000-0004',
  minji: '010-2000-0001',
  'hanbit.director': '010-3000-0001',
  'hanbit.teacher': '010-3000-0002',
  jihoon: '010-3000-0003',
  admin: '010-9000-0001',
  'saegil.director': '010-4000-0001',
  'saegil.teacher': '010-4000-0002',
};

/**
 * 가입 화면의 휴대폰 인증번호(`DEMO_PHONE_CODE`).
 *
 * **번호·아이디 중복 확인은 이제 서버가 답한다**(`rpc_signup_phone_taken`·
 * `rpc_signup_scody_id_taken`, 0025) — 예전에는 번들에 실린 `ACCOUNTS` 픽스처를 뒤져서
 * 합성 로스터 번호를 `이미 가입된 번호예요`라고 말했다.
 *
 * 아직 픽스처인 것은 이 **고정 인증번호** 하나뿐이다(실제 발송은 SMS provider 계약과 함께
 * 온다 — A-020). 계정을 실제로 만드는 마지막 단계는 "연결되지 않았다"고 말한다
 * (`SIGNUP_PENDING`).
 */
export const DEMO_CODE = '000000';

/** 계정 만들기가 아직 연결되지 않았다는 안내. `app/signup.tsx`와 같은 값을 쓴다. */
export const SIGNUP_PENDING =
  '계정 만들기는 아직 연결되지 않았어요. 지금은 로그인 화면의 테스트 계정으로 둘러볼 수 있어요.';

/**
 * 현재 로그인 화면에서 테스트 계정으로 들어간다(새로고침 없이 계정 전환).
 *
 * 로그인은 이제 서버 왕복이라 즉시 끝나지 않는다. 목적지 URL은 호출부가 단정한다 —
 * 역할마다 다르고, 다역할 계정은 공간 선택으로 간다.
 */
export async function loginHere(page: Page, scodyId: string) {
  const name = NAME_BY_ID[scodyId];
  if (!name) throw new Error(`테스트 계정을 찾을 수 없어요: ${scodyId}`);
  const row = page.getByRole('button', { name: new RegExp(`^${name} · `) });

  /*
    **인증 rate limit을 견딘다.**

    Supabase GoTrue는 짧은 창에 로그인이 몰리면 `429 Request rate limit reached`를 준다
    (실측 2026-08-14: 연속 40회 중 30회째부터 9건 실패). 이 스위트는 테스트마다 로그인하고
    여러 스펙이 로그아웃 뒤 다시 로그인하므로 10분 실행에서 그 한도를 넘는다.

    그래서 전체 실행의 실패 수가 실행마다 달랐다 — 걸리는 테스트가 매번 바뀌고, 그 테스트는
    단독으로 돌리면 늘 통과했다. 제품 결함이 아니라 **검증 환경의 한도**다(M-DB-15).

    단정은 그대로 두고 재시도만 한다. 진짜 로그인 실패는 재시도를 다 쓴 뒤 같은 단정으로
    똑같이 드러난다 — 이 재시도가 가리는 것은 429뿐이다.
  */
  const ATTEMPTS = 4;
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    // 패널이 이미 열려 있을 수 있다(같은 화면에서 계정을 두 번 바꾸는 스펙이 있다).
    if (!(await row.isVisible().catch(() => false))) {
      await page.getByTestId('login-demo-toggle').click();
    }
    await row.click();
    // 로그인 화면을 벗어날 때까지 기다린다. 여기서 멈추면 뒤 단정이 전부 로그인 화면을 본다.
    const left = await page
      .waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 6_000 })
      .then(() => true)
      .catch(() => false);
    if (left) return;
    if (attempt < ATTEMPTS - 1) {
      // 한도가 풀릴 시간을 준다. 뒤로 갈수록 길게 기다린다.
      await page.waitForTimeout(3_000 * (attempt + 1));
    }
  }
  // 재시도를 다 썼다. 원래 단정으로 실패시켜 이유가 리포트에 남게 한다.
  await expect(page).not.toHaveURL(/\/login/);
}

/** 로그인 화면으로 이동해 테스트 계정으로 들어간다. */
export async function login(page: Page, scodyId: string) {
  await page.goto('/login');
  await loginHere(page, scodyId);
}
