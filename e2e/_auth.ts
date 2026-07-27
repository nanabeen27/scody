import { type Page } from '@playwright/test';

/**
 * 프로토타입 테스트 계정의 휴대폰 번호. `src/data/fixtures.ts`의 합성 번호와 짝을 맞춘다.
 * 실제 사용자 번호가 아니다.
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
};

/** 프로토타입 공용 인증번호(`DEMO_PHONE_CODE`). */
export const DEMO_CODE = '000000';

/** 현재 로그인 화면에서 휴대폰 번호로 로그인한다(새로고침 없이 계정 전환). */
export async function loginHere(page: Page, scodyId: string) {
  const phone = PHONE_BY_ID[scodyId];
  if (!phone) throw new Error(`테스트 계정에 번호가 없어요: ${scodyId}`);
  await page.getByTestId('login-phone').click();
  await page.getByTestId('login-phone-number').fill(phone);
  await page.getByTestId('login-phone-send').click();
  await page.getByTestId('login-phone-code').fill(DEMO_CODE);
  await page.getByTestId('login-submit').click();
}

/** 로그인 화면으로 이동해 휴대폰 번호로 로그인한다. */
export async function login(page: Page, scodyId: string) {
  await page.goto('/login');
  await loginHere(page, scodyId);
}
