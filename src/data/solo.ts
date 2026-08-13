import { pick } from './hash';
import type { Account, Entitlement } from './types';

/**
 * 학원에 속하지 않은 학생(개인 사용자).
 *
 * **왜 필요한가**: 로스터 학생 전원이 학원 이용권을 갖고 있어서 세 지표가 뜻을 잃었다.
 * ① `개인학습 구독자`가 로그인 테스트 계정 3명뿐이었다 — 사용자가 화면에서 보고 싶다고
 * 명시한 값이다. ② **무료 사용자가 0명이라 `ARPU`가 `ARPPU`보다 커졌다**(실측). ARPU의 분모는
 * 활성 사용자 전체이고 ARPPU의 분모는 돈을 내는 사람이라, 무료 사용자가 없으면 산술이
 * 뒤집혀 "소수가 매출을 지탱하는지"를 판단할 수 없다. ③ 해지가 0건이라 GRR이 늘 100%였다.
 *
 * 그래서 학원 밖 학생을 둔다. 실제 서비스에서도 B2C 개인 사용자가 학원 학생과 별도로 있다.
 * 결정적으로 생성하며 로그인할 수 없다(비밀번호·전화번호 없음). 실제 사용자 데이터가 아니다.
 */

/** 개인 사용자 수. 무료 대 유료 비율을 볼 수 있는 최소 규모다. */
const SOLO_COUNT = 600;

const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오'];
const GIVEN = ['민준', '서연', '도윤', '지우', '예준', '하윤', '시우', '지민', '주원', '서현'];

/**
 * 이 학생의 개인 이용권.
 *
 * 약 40%가 유료, 그중 일부는 해지했다. 나머지는 무료로 쓴다 — 무료 사용자가 있어야
 * `ARPU < ARPPU`가 성립하고 유료 전환율을 말할 수 있다.
 * 결제 주체는 학생 본인과 학부모로 갈린다(요금이 다르다 — `personalMonthly`).
 *
 * **해지의 유일한 사실은 여기서 넣는 `status`다.** 해지가 하나도 없으면 GRR과 구독 이탈률이
 * 늘 100%·0%로 나와 화면이 그 지표를 한 번도 보여 주지 못한다. 그 필요는 이 생성기가 채우고,
 * `accountMeta.canceledPersonalAt`은 **날짜만** 알려 준다(해지 여부를 다시 정하지 않는다).
 * **로그인 테스트 계정은 여기 없다** — 이 모듈이 만드는 계정은 전부 비밀번호·전화번호가 없어
 * 로그인할 수 없으므로, 화면 확인에 쓰는 계정의 이용권이 해지로 바뀔 일이 없다.
 */
function entitlementsFor(userId: string): Entitlement[] {
  const roll = pick(`solo:paid:${userId}`, 0, 99);
  if (roll >= 40) return []; // 무료
  const byParent = pick(`solo:payer:${userId}`, 0, 1) === 1;
  const canceled = pick(`solo:cancel:${userId}`, 0, 9) === 0; // 유료 중 약 10%가 해지
  return [
    {
      kind: 'personal',
      payer: byParent ? 'parent' : 'student',
      label: byParent ? '개인 이용권(학부모 결제)' : '개인 이용권',
      status: canceled ? 'canceled' : 'active',
    },
  ];
}

export const SOLO_STUDENTS: readonly Account[] = Array.from(
  { length: SOLO_COUNT },
  (_, i): Account => {
    const userId = `u_solo_${String(i + 1).padStart(4, '0')}`;
    return {
      userId,
      name: `${SURNAMES[i % SURNAMES.length]}${GIVEN[(i * 3) % GIVEN.length]}`,
      scodyId: `solo.s${String(i + 1).padStart(4, '0')}`,
      roles: ['student'],
      entitlements: entitlementsFor(userId),
      // 개인 사용자의 절반 가까이가 카카오로 가입한다 — 카카오가 주 로그인 수단이다.
      kakaoLinked: pick(`solo:kakao:${userId}`, 0, 9) < 6,
    };
  },
);
