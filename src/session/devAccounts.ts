import type { Role } from '@/data/types';

/**
 * 개발용 테스트 계정 목록.
 *
 * ## 왜 클라이언트에 두는가
 *
 * 로그인 **전에는** DB에서 아무것도 읽을 수 없다(RLS가 익명에게 0행을 준다 — 검증함). 그래서
 * 로그인 화면의 테스트 계정 패널이 보여 줄 목록은 여기 있어야 한다.
 *
 * **`supabase/seed.sql`이 원본이다.** 이 표는 그 seed가 만든 계정을 화면에 나열하기 위한 것이고,
 * 진짜 계정·비밀번호는 서버에 있다. seed의 계정을 바꾸면 여기도 함께 고친다
 * (`scripts/gen-seed.ts`의 `ACCOUNTS`).
 *
 * 확정 정책(D-020)의 로그인 수단은 카카오와 휴대폰 두 가지다. 이 패널은 그 수단이 아니라
 * **개발용 진입로**이고, 화면이 그 사실을 밝힌다. 실제 인증을 붙이면 이 파일을 지운다.
 */

/**
 * 개발용 로그인을 켤지. **기본값은 꺼짐이다**(D-135).
 *
 * ## 왜 스위치를 두는가
 *
 * 실제 인증이 아직 없어서(M-DB-2: 카카오 개발자 앱 등록·SMS provider 계약이 선행) 이 경로가
 * 지금은 유일한 로그인이다. 그런데 그 사실 때문에 **운영 빌드에 개발용 로그인이 그대로 실려
 * 나갈 수 있다** — 독립 검증이 실측했다: 번들에 `signInWithTestAccount`와 리터럴 비밀번호가
 * 들어 있고, 그 자격 증명으로 `admin` 계정에 로그인해 `rpc_admin_overview`까지 불렸다.
 *
 * 그래서 **없으면 닫힌다**로 뒤집는다. 개발·E2E는 `.env`에 두 값을 넣어 켜고, 그 값을 넣지 않은
 * 빌드에는 이 경로가 없다. 실수로 켜지는 방향이 아니라 실수로 꺼지는 방향이라야 안전하다.
 *
 * 비밀번호도 환경변수로 뺀다 — 소스에 리터럴로 두면 스위치를 꺼도 **번들에 문자열이 남는다.**
 */
export const DEV_LOGIN_ENABLED = process.env.EXPO_PUBLIC_ENABLE_DEV_LOGIN === '1';

/**
 * 개발용 계정 공용 비밀번호. `.env`의 `EXPO_PUBLIC_DEV_LOGIN_PASSWORD`에서 읽는다.
 * 없으면 빈 문자열이고, 그때는 `DEV_LOGIN_ENABLED`도 꺼져 있어야 한다(둘을 함께 넣는다).
 */
export const DEV_LOGIN_PASSWORD = process.env.EXPO_PUBLIC_DEV_LOGIN_PASSWORD ?? '';

/**
 * 개발용 계정의 로그인 이메일. **꺼져 있으면 빈 문자열이다.**
 *
 * 이 자리에서 만드는 이유는 아래 `DEV_ACCOUNTS`와 같다(D-145) — Metro에는 tree shaking이 없지만
 * `process.env.EXPO_*`는 빌드 때 문자열로 인라인되므로 이 삼항은 상수로 접히고, 꺼진 빌드에서는
 * `@scody.test` 도메인 문자열까지 번들에서 사라진다. 세션 쪽에 템플릿 리터럴로 두었을 때는
 * 스위치를 꺼도 **그 문자열이 운영 번들에 남았다**(실측: `expo export` 산출물에 1회).
 */
export const devLoginEmail = (scodyId: string): string =>
  !DEV_LOGIN_ENABLED ? '' : `${scodyId.trim().toLowerCase()}@scody.test`;

export interface DevAccount {
  name: string;
  scodyId: string;
  roles: Role[];
  /** 합성 번호다. 실제 번호가 아니다. */
  phone: string;
  /** 화면에서 어떤 상태를 확인할 수 있는 계정인지. */
  note: string;
}

/*
  **꺼져 있으면 목록 자체를 비운다.** Metro에는 tree shaking이 없어서, 배열을 무조건 두면
  이름과 합성 번호가 운영 번들에 죽은 데이터로 남는다(실측으로 확인했다). `process.env.EXPO_*`는
  빌드 때 문자열로 인라인되므로 이 삼항은 상수로 접히고 쓰지 않는 쪽 가지가 사라진다.
*/
export const DEV_ACCOUNTS: readonly DevAccount[] = !DEV_LOGIN_ENABLED ? [] : [
  { name: '김서준', scodyId: 'seojun', roles: ['student'], phone: '010-1000-0001', note: '개인 학습만 · 기록 없음' },
  { name: '이하은', scodyId: 'haeun', roles: ['student'], phone: '010-1000-0002', note: '학부모 결제 · 개인 기록 3건' },
  { name: '박도윤', scodyId: 'doyun', roles: ['student'], phone: '010-1000-0003', note: '학원 학습 · 미제출 과제' },
  { name: '정예린', scodyId: 'yerin', roles: ['student'], phone: '010-1000-0004', note: '개인 + 학원 둘 다' },
  { name: '최민지', scodyId: 'minji', roles: ['parent'], phone: '010-2000-0001', note: '자녀 2명' },
  { name: '한빛 원장', scodyId: 'hanbit.director', roles: ['academy'], phone: '010-3000-0001', note: '반·학생 관리' },
  { name: '오선생', scodyId: 'hanbit.teacher', roles: ['academy'], phone: '010-3000-0002', note: '고1 국어 담당' },
  { name: '한지훈', scodyId: 'jihoon', roles: ['academy', 'parent'], phone: '010-3000-0003', note: '다역할 · 공간 전환' },
  { name: '스코디 관리자', scodyId: 'admin', roles: ['admin'], phone: '010-9000-0001', note: '운영자 화면' },
  // 다른 학원(새길학원). 학원 간 격리를 눈으로도 확인할 수 있게 둔다(M-DB-13).
  { name: '새길 원장', scodyId: 'saegil.director', roles: ['academy'], phone: '010-4000-0001', note: '다른 학원 · 격리 확인' },
  { name: '새길 선생', scodyId: 'saegil.teacher', roles: ['academy'], phone: '010-4000-0002', note: '다른 학원 · 반 1개' },
];

/** 카카오 데모가 들어가는 계정. 프로토타입의 `DEMO_KAKAO_USER`와 같은 사람이다. */
export const DEV_KAKAO_SCODY_ID = 'yerin';
