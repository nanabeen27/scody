import type { Account } from '@/data';

/**
 * 대리 보기의 **열람 범위와 사유 유형**을 대상 역할에서 계산한다(M9-08 ③ → D-149).
 *
 * ## 왜 역할을 가르나
 *
 * D-071·D-073은 "문제가 있는 계정"만 말하고 역할을 가르지 않았다. 그런데 대리 보기가 여는 양은
 * 대상 역할마다 다르다 — 학생은 자기 기록이지만, **학부모를 열면 자녀 기록 전부**(오답노트 메모
 * 본문 포함)가 열리고 **원장을 열면 그 학원 학생 전체**의 제출과 배정 학습 메모(D-054)가 열린다.
 * 남의 기록이 함께 열리는데 화면은 그 사실을 말하지 않고, 사유도 학생과 똑같이 세 유형이었다
 * (A-079).
 *
 * 대상을 학생으로 제한하는 길(M9-08 ②)은 고르지 않았다 — "학부모가 자녀 리포트를 못 본다"는
 * 문의를 재현할 수 없게 된다. 대신 **넓게 여는 대리에는 더 좁은 사유와 문의 번호를 요구하고,
 * 무엇이 열리는지 시작 전에 말하고, 그 범위를 감사 로그에 남긴다.**
 *
 * 순수 함수만 둔다 — 화면(`app/admin/user/[id].tsx`)과 감사 로그가 **같은 문장**을 써야 한다.
 * 두 곳에서 따로 쓰면 화면이 말한 범위와 기록에 남은 범위가 갈린다.
 */

/**
 * 사유 유형. 대상 역할에 따라 고를 수 있는 것이 다르다.
 *
 * 자유 입력(`무엇을 확인하나요`)은 어느 역할에서도 필수다 — 유형만으로는 무엇을 봤는지 모른다.
 */
export type ReasonKind =
  | '문의 재현'
  | '오류 확인'
  | '데이터 점검'
  | '자녀 리포트 문의'
  | '학원 문의 재현';

/** 남의 기록이 함께 열리는 역할. 이 둘에는 더 좁은 사유와 문의 번호를 요구한다. */
function opensOthers(target: Account): boolean {
  return target.roles.includes('parent') || target.roles.includes('academy');
}

/**
 * 고를 수 있는 사유 유형.
 *
 * 학생 대상에는 세 유형 그대로다. **남의 기록이 함께 열리는 대상에서는 `데이터 점검`을 뺀다** —
 * 특정 문의나 오류 없이 "그냥 보는" 열람을 자녀·학원 기록까지 넓히지 않는다(최소권한).
 */
export function reasonKindsFor(target: Account): readonly ReasonKind[] {
  const kinds: ReasonKind[] = [];
  if (target.roles.includes('parent')) kinds.push('자녀 리포트 문의');
  if (target.roles.includes('academy')) kinds.push('학원 문의 재현');
  if (!opensOthers(target)) kinds.push('문의 재현');
  kinds.push('오류 확인');
  if (!opensOthers(target)) kinds.push('데이터 점검');
  return kinds;
}

/**
 * 문의 번호를 반드시 받아야 하는지.
 *
 * 남의 기록까지 열 때는 **그 열람이 어느 문의에 붙는지** 기록에 남아야 한다. 학생 대상은
 * 그대로 선택이다 — 오류를 눈으로 확인하는 일이 문의보다 먼저 오는 경우가 있다.
 */
export function ticketRequiredFor(target: Account): boolean {
  return opensOthers(target);
}

/**
 * 이 대리 보기가 여는 것. 화면이 시작 전에 보여 주고 감사 로그가 같은 문장을 남긴다.
 *
 * 역할이 여럿이면 줄도 여럿이다(선생님 겸 학부모 계정은 두 줄이다).
 */
export function impersonationScope(target: Account): string[] {
  const lines: string[] = [];
  if (target.roles.includes('student')) {
    lines.push('이 학생의 개인 학습·학원 과제 기록과 오답노트 문항');
  }
  /*
    **메모 본문은 어느 역할에서도 열리지 않는다**(D-071). `wrongNotes`·`wrongNotesOf`·
    `academyNotesOf`가 대리 중에 `dig`를 값째 지운다. 이 문장이 화면과 감사 로그에 함께 남으므로,
    실제로 열리지 않는 것을 열린다고 적으면 접속기록을 읽는 사람이 잘못 판단한다 — 같은 화면이
    13줄 위에서 `오답노트에 AI와 정리한 메모는 보이지 않아요.`라고 이미 말하고 있었다.
  */
  if (target.roles.includes('parent')) {
    lines.push('연결된 자녀의 학습 기록 전부 — 오답노트는 문항과 별표까지(메모 본문은 가려요)');
  }
  /*
    **소속이 실제로 있을 때만 학원 범위를 말한다.** `removeMember`는 `academy_members.left_at`만
    채우고 `user_roles`의 `academy` 행은 남기므로, 학원에서 제외된 계정은 `roles: ['academy']`인데
    `academyName`·`academyRole`이 비어 있다. 그때 예전 코드는 `academyRole !== 'teacher'`라는
    이유로 **원장 범위**를 말했다 — 원장이 아니고, 소속이 없고, 실제로는 아무것도 열리지 않는다.
  */
  if (target.roles.includes('academy') && !target.academyName) {
    lines.push('학원 소속이 끝난 계정이라 학원 화면에서는 아무것도 열리지 않아요');
  } else if (target.roles.includes('academy')) {
    const where = target.academyName;
    lines.push(
      target.academyRole === 'teacher'
        ? `${where} 담당 반 학생의 제출 결과와 배정 학습의 오답 문항`
        : `${where} 전체의 반·학생·제출 결과와 배정 학습의 오답 문항`,
    );
  }
  // 역할이 하나도 없는 계정(가입만 한 상태)도 있다. 빈 배열을 그대로 두지 않는다.
  return lines.length > 0 ? lines : ['이 계정의 프로필과 이용권'];
}

/** 감사 로그 한 줄에 넣는 형태. 줄바꿈 없이 `·`로 잇는다. */
export function scopeForLog(target: Account): string {
  return impersonationScope(target).join(' · ');
}
