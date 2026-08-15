/**
 * `/staff` 로그인이 쓰는 계정 주소(D-165).
 *
 * ## 왜 `devAccounts.ts`에 두지 않는가
 *
 * 그 파일은 **개발 전용**이다 — `DEV_LOGIN_ENABLED`가 꺼지면 계정 목록과 이메일 생성이
 * 상수로 접혀 통째로 사라져야 한다(D-145). 이 함수는 반대로 **운영에서도 동작해야 한다.**
 *
 * 실제로 같은 파일에 두었더니 그 접기가 깨졌다(실측: `EXPO_PUBLIC_ENABLE_DEV_LOGIN=0`으로
 * export한 번들에 `DEV_ACCOUNTS` 배열이 그대로 남아 `doyun`·`010-1000-0003` 같은 실재 seed
 * 식별자가 실렸다 — D-158이 없앤 것이 되돌아왔다). 수명이 다른 것을 한 모듈에 두면 이렇게
 * 한쪽이 다른 쪽을 살려 둔다.
 *
 * 도메인 자체는 비밀이 아니다 — 벽은 난수 비밀번호와 Supabase 인증이고, 그 비밀번호는 공개
 * 저장소에 없다(D-157).
 */
export const staffEmail = (scodyId: string): string => `${scodyId.trim().toLowerCase()}@scody.test`;
