import { createHash } from 'node:crypto';

/**
 * 옛 fixture id → seed가 만든 uuid.
 *
 * ## 왜 필요한가
 *
 * 화면의 여러 `testID`가 데이터 id를 담고 있다(`assign-class-<반id>`·`retry-<배정id>`). 프로토타입은
 * 그 id가 `c_kor1`처럼 사람이 읽는 문자열이라 테스트가 그대로 적을 수 있었다. DB로 옮기면서 id가
 * uuid가 됐다.
 *
 * seed는 **옛 id의 해시로 uuid를 만든다**(`scripts/gen-seed.ts`의 `uuidFor`). 같은 규칙을 여기 두면
 * 테스트가 `sid('c_kor1')`로 그 반을 계속 가리킬 수 있다.
 *
 * **더 나은 방향은 화면의 `testID`에서 id를 빼는 것이다** — 이 레포의 규칙은 보이는 텍스트·역할로
 * 테스트를 쓰라고 말한다(`CLAUDE.md` 검증). 그 변경은 화면 쪽 작업이라 따로 다룬다. 그때 이 파일을
 * 지운다.
 */
export function sid(oldId: string): string {
  const h = createHash('sha1').update(`scody-seed:${oldId}`).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** 개인 학습의 화면용 학습 id. `li_<콘텐츠 uuid>` 형태다(`itemIdOf`). */
export function personalItemId(contentOldId: string): string {
  return `li_${sid(contentOldId)}`;
}

/**
 * 오늘부터 `days`일 뒤(`YYYY-MM-DD`). 로컬 시간 기준이다(`todayISO`와 같은 규칙).
 *
 * **고정 날짜를 쓰지 않는다.** 예전에는 `2026-08-11`처럼 미래 날짜를 박아 두었는데, 그 날이
 * 지나면 마감일 검증이 `오늘 또는 오늘보다 뒤`에서 막아 배정 자체가 실패한다(실측: 학원 흐름
 * 2건이 이 때문에 갈렸다).
 */
export function dayFromToday(days: number): string {
  const at = new Date();
  at.setDate(at.getDate() + days);
  const m = `${at.getMonth() + 1}`.padStart(2, '0');
  const d = `${at.getDate()}`.padStart(2, '0');
  return `${at.getFullYear()}-${m}-${d}`;
}

/** `YYYY-MM-DD` → 화면 표기(`8월 11일`). `formatDate`와 같은 규칙이다. */
export function displayDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(m)}월 ${Number(d)}일`;
}

/**
 * seed 기록이 놓인 달과 그 달의 학습일 수.
 *
 * ## 왜 계산해서 쓰는가
 *
 * seed는 원본 시드의 고정 날짜를 **실행일 기준 상대 간격**으로 옮긴다(`scripts/gen-seed.ts`).
 * 그래서 기록이 어느 달에 놓이는지는 seed를 돌린 날에 따라 달라진다 — 이하은의 기록 세 건이
 * 오늘이 8월 13일이면 `8월 2건 · 7월 1건`이고, 8월 3일이면 `8월 1건 · 7월 2건`이다.
 *
 * 예전 테스트는 `7월`·`6월`을 박아 두었다가 달이 바뀌면 통째로 깨졌다(D-090이 기록한 그 문제다).
 * 여기서 오프셋으로부터 계산하면 어느 날에 돌려도 맞는다.
 *
 * 오프셋은 `src/data/attempts.ts`의 시드 날짜를 기준일(`2026-07-28`)에서 뺀 값이다.
 */
export interface SeedMonth {
  /** 화면 표기(`7월`, 해가 다르면 `2025년 12월`). */
  label: string;
  /** 그 달에 공부한 날 수. 같은 날 두 건은 하루로 센다. */
  days: number;
}

/** `YYYY-MM-DD` → 화면 표기. `monthLabel`과 같은 규칙이다. */
export function monthLabelOf(iso: string, today = dayFromToday(0)): string {
  const [y, m] = iso.split('-');
  return today.slice(0, 4) === y ? `${Number(m)}월` : `${y}년 ${Number(m)}월`;
}

/** 오프셋 목록(일 단위, 과거는 음수) → 최근 달부터의 목록. */
export function seedMonths(offsets: readonly number[]): SeedMonth[] {
  const byMonth = new Map<string, Set<string>>();
  for (const off of offsets) {
    const iso = dayFromToday(off);
    const key = iso.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? new Set()).add(iso));
  }
  return [...byMonth.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, days]) => ({ label: monthLabelOf(`${key}-01`), days: days.size }));
}

/** 이하은의 개인 학습 기록 오프셋(`ct_lit_2`·`ct_gram_core`·`ct_read_3`). */
export const HAEUN_OFFSETS = [-2, -4, -30] as const;

/** 정예린의 개인 학습 기록 오프셋(`ct_lit_1`·`ct_read_2`·`ct_lit_3`). */
export const YERIN_OFFSETS = [-1, -5, -33] as const;
