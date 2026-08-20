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
/*
  **화면에 보여 주는 것은 데모 계정 여섯뿐이다**(D-184).

  seed는 열일곱 계정을 만들지만(기존 열하나 + 데모 여섯) 그 열하나는 **비밀번호가 16자 이상**이라
  사람이 손으로 칠 수 없다. 목록은 사람이 실제로 들어갈 수 있는 것만 담는다 — 들어갈 수 없는
  계정을 나열하는 것은 눌러도 아무 일이 없는 버튼과 같다(D-141).

  기존 열하나는 검증 스크립트와 E2E가 계속 쓴다(`e2e/_auth.ts`가 `.env`의 비밀번호로 폼에
  타이핑한다). 여기서 사라진 것은 **화면의 목록**이고 계정은 그대로 있다.

  여섯이 서로 맞물려 있다: 학원 하나에 원장·선생(반 담당)·학생 둘이 있고 학부모 둘이 각각
  학생 하나를 자녀로 갖는다. 어느 계정으로 들어가도 화면이 비지 않는다.
*/
export const DEV_ACCOUNTS: readonly DevAccount[] = !DEV_LOGIN_ENABLED ? [] : [
  { name: '유하람', scodyId: 'student1', roles: ['student'], phone: '010-6000-0001', note: '개인 + 학원 · 기록 많음' },
  { name: '노도현', scodyId: 'student2', roles: ['student'], phone: '010-6000-0002', note: '학원 학습 · 미제출 과제' },
  { name: '유선경', scodyId: 'parent1', roles: ['parent'], phone: '010-6000-0011', note: '자녀 1명 · 기록 많음' },
  { name: '노태식', scodyId: 'parent2', roles: ['parent'], phone: '010-6000-0012', note: '자녀 1명 · 미제출 확인' },
  { name: '데모 원장', scodyId: 'academy1', roles: ['academy'], phone: '010-6000-0021', note: '반·학생·좌석 관리' },
  { name: '데모 선생', scodyId: 'academy2', roles: ['academy'], phone: '010-6000-0022', note: '데모 고1 국어 담당' },
];

/**
 * 카카오 데모가 들어가는 계정. 프로토타입의 `DEMO_KAKAO_USER`와 같은 사람이다.
 *
 * **데모 계정 여섯 중 하나로 옮길 수 없다.** 이 경로는 `signInWithTestAccount`이고 그 함수는
 * 클라이언트가 가진 `DEV_LOGIN_PASSWORD`(16자)를 쓴다 — 데모 여섯의 비밀번호는 접두어 없는
 * 환경변수라 **번들에 없다**(D-184, 그것이 의도다). 그래서 기존 등급 계정을 계속 가리킨다.
 *
 * 그 계정이 아래 목록에는 없다. 버튼 옆 캡션이 `정해진 데모 계정으로 연결되고 그 기록은 실제
 * 사용자 데이터가 아니다`라고 이미 말하므로(D-125) 남의 기록을 자기 것으로 읽을 위험은 그
 * 문장이 막는다. 카카오 OAuth가 실제로 연결되면(M-DB-2) 이 상수와 함께 사라진다.
 */
export const DEV_KAKAO_SCODY_ID = 'yerin';
