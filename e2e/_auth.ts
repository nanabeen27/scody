import { expect, type Page } from '@playwright/test';
import { demoPassword, devPassword } from './_seed';

/**
 * E2E 로그인 헬퍼.
 *
 * ## 폼에 타이핑한다 (D-184)
 *
 * 로그인 화면의 정식 수단은 **이메일 + 비밀번호**다. 예전에는 계정 패널의 행을 눌러 들어갔는데
 * (한 번 누르기가 두 칸 채우기보다 짧았다) 그 경로가 사라졌다: 패널이 **읽는 목록**이 됐다.
 *
 * 왜 사라졌나 — 클릭 로그인은 비밀번호가 **클라이언트에** 있어야 한다. 화면에 보이는 여섯은
 * 데모 계정이고 그 비밀번호는 접두어 없는 환경변수라 번들에 없다(D-184, 그것이 의도다).
 * 그래서 사람도 이 헬퍼도 같은 길로 들어간다 — **화면이 실제로 제공하는 길을 검증한다.**
 *
 * 부수로 얻은 것: 이 헬퍼가 seed의 **열일곱 계정 전부**에 닿는다. 예전에는 패널에 있는 것만
 * 쓸 수 있었다.
 *
 * 데이터가 Supabase로 옮겨 가면서 **로그인 전에는 DB에서 아무것도 읽을 수 없다**(RLS가 익명에게
 * 0행을 준다). 휴대폰은 확정 정책 2절의 자리(인증·복구·초대 확인·연락처 변경·알림)에 있고
 * 로그인·가입 어느 화면에서도 받지 않는다.
 *
 * 카카오는 아직 연결되지 않았다(M-DB-2). 개발용 로그인이 켜진 빌드에서만 데모 계정으로 들어가고,
 * 꺼진 빌드에는 버튼이 없다. 그 갈림은 `auth-flow` 스펙이 확인한다.
 */

/**
 * 테스트 계정의 화면 표시 이름.
 *
 * **로그인에는 더 이상 쓰지 않는다**(폼에 이메일을 넣는다). 남은 쓰임은 로그인 **뒤** 화면에서
 * 그 사람이 맞는지 확인하는 것과, 계정 패널이 그 이름을 보여 주는지 보는 것이다.
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
  // 데모 계정 6종(D-184). 로그인 화면의 계정 목록이 보여 주는 것이 이 여섯이다.
  student1: '유하람',
  student2: '노도현',
  parent1: '유선경',
  parent2: '노태식',
  academy1: '데모 원장',
  academy2: '데모 선생',
};

/**
 * 데모 등급 계정. **비밀번호가 다르다** — 이 여섯만 `DEMO_LOGIN_PASSWORD`를 쓰고 나머지 열하나는
 * `EXPO_PUBLIC_DEV_LOGIN_PASSWORD`(16자 이상)를 쓴다(D-184).
 */
const DEMO_IDS = new Set(['student1', 'student2', 'parent1', 'parent2', 'academy1', 'academy2']);

/** 그 계정의 로그인 주소. seed가 `{아이디}@scody.test`로 만든다(`scripts/gen-seed.ts`). */
export const emailOf = (scodyId: string): string => `${scodyId}@scody.test`;

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
  const password = DEMO_IDS.has(scodyId) ? demoPassword() : devPassword();

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
    /*
      **이미 로그인한 상태면 폼이 없다.** 그때 화면은 `이미 로그인했어요` + `내 공간으로 가기` +
      `다른 계정으로 로그인`이다(`app/login.tsx`). 이 헬퍼는 계정 전환에도 쓰이므로 먼저 세션을
      닫아야 한다 — 놓치면 전환 스펙이 조용히 **이전 계정으로** 계속 간다(폼을 못 찾아 던지지도
      않는다: 아래 `fill`이 실패하고 재시도가 돌 뿐이다).
    */
    const emailField = page.getByTestId('login-email');
    if (!(await emailField.isVisible().catch(() => false))) {
      const switchLink = page.getByTestId('login-switch');
      if (await switchLink.isVisible().catch(() => false)) await switchLink.click();
      await expect(emailField).toBeVisible({ timeout: 6_000 });
    }
    await emailField.fill(emailOf(scodyId));
    await page.getByTestId('login-password').fill(password);
    await page.getByTestId('login-submit').click();
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
