/**
 * 로그인 입력을 계정 주소로 옮긴다. **운영에서도 도는 코드다.**
 *
 * ## 왜 `devAccounts.ts`에 두지 않는가
 *
 * 그 파일은 **개발 전용**이다 — `DEV_LOGIN_ENABLED`가 꺼지면 계정 목록과 이메일 생성이 상수로
 * 접혀 통째로 사라져야 한다(D-145). 이 모듈은 반대로 **꺼진 빌드에서도 살아 있어야 한다.**
 *
 * 실제로 같은 파일에 두었더니 그 접기가 깨졌다(실측: `EXPO_PUBLIC_ENABLE_DEV_LOGIN=0`으로
 * export한 번들에 `DEV_ACCOUNTS` 배열이 그대로 남아 `doyun`·`010-1000-0003` 같은 실재 seed
 * 식별자가 실렸다 — D-158이 없앤 것이 되돌아왔다). **수명이 다른 것은 파일을 나눈다**(D-165).
 * 이 파일은 `staffEmail.ts`를 잇는다 — 그때는 `/staff` 전용이었고, D-184가 공개 로그인을
 * 이메일로 바꾸면서 같은 규칙이 두 화면의 것이 됐다.
 *
 * 도메인 자체는 비밀이 아니다 — 벽은 난수 비밀번호와 Supabase 인증이고, 그 비밀번호는 공개
 * 저장소에 없다(D-157).
 */

/** seed가 만든 개발 계정의 주소 도메인. 이메일이 아닌 입력에 이것을 붙인다. */
const FALLBACK_DOMAIN = '@scody.test';

/** 앞뒤 공백을 버리고 소문자로. 이메일은 대소문자를 가리지 않고 GoTrue도 소문자로 저장한다. */
export const normalizeEmail = (input: string): string => input.trim().toLowerCase();

/**
 * 이메일 형태인가. **형식 검사의 목적은 거절이 아니라 안내다** — 서버가 돌려주는 형식 오류는
 * 영어이고(`src/lib/supabase.ts`의 `errorMessage`가 잡지 못하면 그대로 화면에 나간다),
 * 학생·학부모가 읽는 자리다. 그래서 보내기 전에 한국어로 말해 준다.
 *
 * 엄격하게 만들지 않는다. RFC를 정규식으로 옮기면 실재하는 주소를 거절하기 시작하고, 진짜
 * 판정은 어차피 서버가 한다 — 여기서 잡으려는 것은 `doyun`처럼 **@가 아예 없는 입력**이다.
 */
export const looksLikeEmail = (input: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(input));

/**
 * 로그인 입력 → 계정 주소. 이메일이면 그대로, 아이디면 도메인을 붙인다.
 *
 * **둘 다 받는 이유**: 공개 로그인은 이메일을 받지만(D-184) `/staff`는 스코디 아이디를 계속
 * 받는다(운영자에게 `admin`이 `admin@scody.test`보다 빠르고, 그 화면의 벽은 주소가 아니라
 * 비밀번호다 — D-165⑤). 검증 스크립트(`scripts/_verify.ts`)도 아이디로 부른다.
 */
export const loginEmail = (input: string): string => {
  const v = normalizeEmail(input);
  return v.includes('@') ? v : `${v}${FALLBACK_DOMAIN}`;
};
