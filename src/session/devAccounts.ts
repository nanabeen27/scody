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

export interface DevAccount {
  name: string;
  scodyId: string;
  roles: Role[];
  /** 합성 번호다. 실제 번호가 아니다. */
  phone: string;
  /** 화면에서 어떤 상태를 확인할 수 있는 계정인지. */
  note: string;
}

export const DEV_ACCOUNTS: readonly DevAccount[] = [
  { name: '김서준', scodyId: 'seojun', roles: ['student'], phone: '010-1000-0001', note: '개인 학습만 · 기록 없음' },
  { name: '이하은', scodyId: 'haeun', roles: ['student'], phone: '010-1000-0002', note: '학부모 결제 · 개인 기록 3건' },
  { name: '박도윤', scodyId: 'doyun', roles: ['student'], phone: '010-1000-0003', note: '학원 학습 · 미제출 과제' },
  { name: '정예린', scodyId: 'yerin', roles: ['student'], phone: '010-1000-0004', note: '개인 + 학원 둘 다' },
  { name: '최민지', scodyId: 'minji', roles: ['parent'], phone: '010-2000-0001', note: '자녀 2명' },
  { name: '한빛 원장', scodyId: 'hanbit.director', roles: ['academy'], phone: '010-3000-0001', note: '반·학생 관리' },
  { name: '오선생', scodyId: 'hanbit.teacher', roles: ['academy'], phone: '010-3000-0002', note: '고1 국어 담당' },
  { name: '한지훈', scodyId: 'jihoon', roles: ['academy', 'parent'], phone: '010-3000-0003', note: '다역할 · 공간 전환' },
  { name: '스코디 관리자', scodyId: 'admin', roles: ['admin'], phone: '010-9000-0001', note: '운영자 화면' },
];

/** 카카오 데모가 들어가는 계정. 프로토타입의 `DEMO_KAKAO_USER`와 같은 사람이다. */
export const DEV_KAKAO_SCODY_ID = 'yerin';
