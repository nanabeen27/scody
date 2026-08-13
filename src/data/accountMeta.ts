import { joinDateOf, lastActiveOf } from './activity';
import { ANCHOR_INDEX, dateOfIndex, indexOfDate } from './calendar';
import { digits, pick } from './hash';
import type { Account, Entitlement } from './types';

/**
 * 계정에서 파생하는 값들.
 *
 * **필드로 저장하지 않고 파생하는 이유**: 같은 사실이 두 곳에 있으면 갈린다(D-048이 홈과
 * 리포트 사이에서 고친 것과 같은 종류). 가입일은 활동 데이터와 **같은 해시**에서 나와야
 * "가입 전에 활동한 학생"이 생기지 않고, 최근 활동일은 활동 기록 그 자체가 답이다.
 *
 * `Account.createdAt`·`grade`는 **덮어쓰기 값**이다. 로그인 테스트 계정처럼 날짜가 뜻을
 * 가져야 하는 곳에만 넣고, 로스터 3천 개는 비워 두고 파생값을 쓴다.
 */

/** 계정을 만든 날. 필드가 있으면 그 값, 없으면 활동 데이터와 같은 해시에서 파생. */
export function createdAtOf(account: Account): string {
  return account.createdAt ?? joinDateOf(account.userId);
}

/**
 * 학습 기록을 가질 수 있는 역할인지.
 *
 * **학생만 문항을 푼다.** 합성 활동 기록(`activityOf`)은 `userId` 하나만 보고 누구에게나
 * 주별 활동을 만들어 주기 때문에, 역할을 보지 않으면 원장·선생님·학부모·운영자 계정에도
 * "문항 1개 이상 답을 저장한 날"이 생긴다 — 화면이 사실이 아닌 근거를 주게 된다.
 * `gradeOf`가 학년을 학생에게만 주는 것과 같은 판정이다.
 */
export function hasLearningRecords(account: Account): boolean {
  return account.roles.includes('student');
}

/** 마지막 활동일. 활동 기록이 없으면 `undefined`. */
export function lastActiveAtOf(account: Account): string | undefined {
  if (!hasLearningRecords(account)) return undefined;
  return lastActiveOf(account.userId);
}

/**
 * 화면에 쓰는 최근 활동 표기. 최근 활동은 항상 노출한다(D-072).
 *
 * 학습하지 않는 역할에는 `해당 없음`이라고 적는다 — `기록 없음`은 "학생인데 아직 안 했다"로
 * 읽히고, 날짜를 적으면 원장이 국어 문항을 풀었다는 뜻이 된다.
 */
export function lastActiveLabelOf(account: Account): string {
  if (!hasLearningRecords(account)) return '해당 없음';
  return lastActiveAtOf(account) ?? '기록 없음';
}

/*
  `gradeOf`는 여기 두지 않는다.
  ------------------------------------------------------------------
  예전에는 이 파일에도 `gradeOf`가 있었고, 저장된 학년과 반 이름이 모두 없으면
  **해시로 학년을 정했다**(`pick('grade:'+userId, 1, 3)`). `src/repo/admin.ts`에도 같은 이름의
  함수가 있어서 같은 계정이 두 값을 보고할 수 있었다 — 화면에서는 `고2`, 여기서는 `고3`.
  운영 경로는 `src/repo/admin.ts`의 `gradeOf` 하나만 쓴다. 그 함수는 없는 학년을 지어내지 않고
  `undefined`를 돌려주고, 화면이 `없음`이라고 적는다.
*/

/**
 * 고객지원 코드.
 *
 * **왜 필요한가**: 카카오 로그인이 주 수단이면 서비스가 항상 갖는 값은 **앱별 회원번호**
 * 하나뿐이다. 닉네임·이메일·전화번호는 선택 동의라 없을 수 있고, 카카오 공식 문서는
 * "이메일을 동일 사용자 판단 기준으로 쓰지 말라"고 명시한다. 그런데 회원번호는 사용자
 * 본인이 알 방법이 없다. 그래서 **사용자가 말할 수 있는 짧은 코드**가 필요하다.
 *
 * 규칙: 6자, 혼동하는 글자(`I`·`L`·`O`·`U`·`0`·`1`)를 뺀 알파벳·숫자. `userId`에서 파생하므로
 * 저장하지 않고 마이그레이션도 필요 없다. **이 코드로는 로그인할 수 없다** — 화면에서 밝힌다.
 */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

export function supportCodeOf(userId: string): string {
  const out = digits(`code:${userId}`, CODE_ALPHABET.length, 6)
    .map((d) => CODE_ALPHABET[d])
    .join('');
  return `${out.slice(0, 3)}-${out.slice(3)}`;
}

/** 화면에 보여 줄 때 쓰는 정규화. 사용자가 소문자·공백으로 말해도 찾히게 한다. */
export function normalizeSupportCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/** 코드 형태인지. 검색창의 붙여넣기 타입 자동 판별에 쓴다. */
export function looksLikeSupportCode(input: string): boolean {
  const raw = normalizeSupportCode(input);
  return raw.length === 6 && [...raw].every((c) => CODE_ALPHABET.includes(c));
}

/** 구독 시작일. 필드가 없으면 계정 가입일로 본다. */
export function startedAtOf(account: Account, e: Entitlement): string {
  return e.startedAt ?? createdAtOf(account);
}

/** 지금 살아 있는 구독인지. `status`가 없으면 살아 있는 것으로 본다(기존 시드 호환). */
export function isActiveEntitlement(e: Entitlement): boolean {
  return e.status !== 'canceled' && !e.canceledAt;
}

/**
 * 개인 구독을 해지한 **날**. 해지가 아니면 `undefined`.
 *
 * **해지 여부를 여기서 다시 정하지 않는다.** 유일한 사실은 `Entitlement.status`다
 * (`src/data/solo.ts`가 유료 개인 구독의 약 10%에 `canceled`를 넣는다). 예전에는 이 함수가
 * 자기 해시로 **독립적으로 다시** 10%를 해지로 골라, 같은 계정이 개요에서는 `해지`,
 * 계정 표에서는 `개인`, 계정 상세에서는 `이용 중`으로 나왔다 — D-048·D-061이 두 번 고친
 * metric drift와 같은 종류다.
 *
 * 로그인 테스트 계정 보호는 `solo.ts`가 맡는다: 해지를 넣는 계정은 전부 생성된 개인
 * 사용자이고 비밀번호가 없어 로그인할 수 없다. 그래서 화면 확인용 계정의 이용권은 사라지지
 * 않는다.
 *
 * 날짜 필드(`canceledAt`)가 없으면 **시작일과 기준일 사이**에서 결정적으로 정한다 — 해지
 * 시점이 시계열에 놓여야 `개인학습 구독자` 추이와 GRR을 주별로 낼 수 있다. 마지막 활동일을
 * 쓰지 않는 이유: 합성 활동은 구독 해지와 무관하게 이어지므로 활동하는 구독자의 마지막
 * 활동일이 전부 기준일 근처가 되고, 해지 23건이 마지막 주 한 칸에 몰려 추이가 절벽이 됐다.
 */
export function canceledPersonalAt(account: Account): string | undefined {
  const canceled = account.entitlements.find(
    (e) => e.kind === 'personal' && !isActiveEntitlement(e),
  );
  if (!canceled) return undefined;
  if (canceled.canceledAt) return canceled.canceledAt;
  const start = Math.max(0, indexOfDate(startedAtOf(account, canceled)));
  const span = ANCHOR_INDEX - start;
  if (span <= 0) return dateOfIndex(ANCHOR_INDEX);
  // 남은 기간에 비례해 흩뜨린다. 늦게 가입한 사람은 늦게 해지한다.
  const at = start + Math.round((pick(`cancelspan:${account.userId}`, 1, 100) / 100) * span);
  return dateOfIndex(Math.min(ANCHOR_INDEX, at));
}
