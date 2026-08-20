import { errorMessage, supabase } from '@/lib/supabase';

/**
 * 학습 기록. **읽기는 함수 하나, 쓰기는 함수 하나다.**
 *
 * 값은 전부 서버에서 파생된다(`v_daily_learning_stats` → `rpc_student_records`). 클라이언트가
 * 누적을 세지 않는 것이 이 설계의 요점이다 — 세면 화면마다 다른 답이 나오고, 저장하면 중복
 * 집계가 생긴다(`supabase/migrations/0044_learning_records.sql`의 근거).
 */

/** 하루의 학습 사실. */
export interface DayRecord {
  day: string;
  solvedQuestions: number;
  correctQuestions: number;
  setsCompleted: number;
  activeSec: number;
  reviewsDone: number;
  reviewsCorrect: number;
  notesAdded: number;
  notesMastered: number;
  gradedQuestions: number;
  isStudyDay: boolean;
}

/** 한 주의 학습 사실. `monday`가 그 주를 가리킨다(ISO 주 — 월요일 시작). */
export interface WeekRecord {
  monday: string;
  /**
   * 이 창의 마지막 날. `lastWeekToDate`에만 있다 — 지난주의 **같은 시점까지**를 뜻한다.
   *
   * 완성된 주(`lastWeek`)와 이번 주(`week`)에는 없다: 앞은 늘 7일이고 뒤는 늘 오늘까지다.
   */
  throughDay?: string;
  studyDays: number;
  activeSec: number;
  solvedQuestions: number;
  setsCompleted: number;
  reviewsDone: number;
  reviewsCorrect: number;
  notesAdded: number;
  notesMastered: number;
}

export interface StreakRecord {
  /** 지금 이어지고 있는 연속 학습일. 오늘이 아직 학습일이 아니어도 끊기지 않는다. */
  current: number;
  longest: number;
  /**
   * 남은 기록 보호 수. 주간 목표를 채운 주마다 **2개**(주말 이틀만큼) 생기고 보유 상한은 2다.
   *
   * 하나만 주던 판본에서는 주 5일을 지키는 학생의 연속이 일요일에 끊겼다
   * (`supabase/migrations/0047_streak_grant_and_week_to_date.sql`).
   */
  protections: number;
  /** 보호 하나를 얻는 데 필요한 한 주의 학습일. */
  weekGoal: number;
  /**
   * **지금 이어지고 있는 연속을 지킨** 보호의 날들(오래된 것부터).
   *
   * 연속이 끊기는 자리에서 비워지므로, 여기 있는 날은 모두 화면에 서 있는 연속 일수를 만든
   * 보호다 — 석 달 전에 쓴 보호를 `방금 하나 썼어요`처럼 말하지 않기 위해서다.
   */
  protectedDays: string[];
}

export interface Totals {
  studyDays: number;
  activeSec: number;
  solvedQuestions: number;
  correctQuestions: number;
  setsCompleted: number;
  reviewsDone: number;
  reviewsCorrect: number;
  notesAdded: number;
  /** 익힘에 **처음** 닿은 오답의 수. 익힘에서 떨어져도 줄지 않는다. */
  notesMastered: number;
  /** 첫 기록이 있는 날. 없으면 `null`이다. */
  firstDay: string | null;
}

/** 최고 기록 하나와 그 날. */
export interface BestDay {
  value: number;
  day: string | null;
}

export interface Bests {
  questions: BestDay;
  activeSec: BestDay;
  reviewsCorrect: BestDay;
  week: { value: number; monday: string | null };
}

/**
 * **오늘(이번 주)을 뺀** 최고 기록.
 *
 * 결과 화면이 `8개 → 11개`를 말하는 근거다. 갱신 시점을 따로 저장하지 않는 이유는
 * `오늘 > 오늘 뺀 최고`가 언제 다시 계산해도 같은 답이기 때문이다 — 두 번 봐도 두 번 세지 않는다.
 */
export interface PrevBests {
  questions: number;
  activeSec: number;
  reviewsCorrect: number;
  week: number;
}

/** 최근 4주 주당 평균. 이번 주는 넣지 않는다(아직 끝나지 않았다). */
export interface Avg4Weeks {
  solvedQuestions: number;
  activeSec: number;
  studyDays: number;
}

export interface StudentRecords {
  studentId: string;
  /**
   * 학습일로 인정되는 최소 채점 문항. **서버가 판정에 쓰는 값 그대로다**
   * (`v_daily_learning_stats.counts_as_study_day`).
   *
   * 화면이 이 규칙을 말할 때(`오늘 3문항을 풀면 이어져요`) 클라이언트 상수를 읽으면 규칙 하나가
   * 두 진실을 갖는다 — 같은 종류인 `streak.weekGoal`이 이미 서버에서 오는 방식이다.
   * `src/features/records.ts`의 `STUDY_DAY_QUESTIONS`는 이제 검증 스크립트의 기대값으로만 남는다.
   */
  studyDayQuestions: number;
  today: DayRecord;
  streak: StreakRecord;
  totals: Totals;
  bests: Bests;
  prevBests: PrevBests;
  week: WeekRecord;
  /** 완성된 지난주 7일. `주간 최다 풀이`와 주가 끝난 뒤의 비교가 쓴다. */
  lastWeek: WeekRecord;
  /**
   * 지난주의 **같은 시점까지**. 진행 중인 이번 주와 비교할 때 쓴다.
   *
   * `lastWeek`로 비교하면 월요일 아침에 `-100%`가 뜬다 — 3일치를 7일치와 나눈 값이다.
   * 이 레포가 `DESIGN.md` §18-0에서 학원 추이선에 대해 이미 고친 것과 같은 결함이다.
   */
  lastWeekToDate: WeekRecord;
  avg4Weeks: Avg4Weeks;
  /** 최근 28일. 없는 날도 0으로 들어 있다 — 빈 칸이 없으면 화면이 날짜를 셀 수 없다. */
  days: { day: string; gradedQuestions: number; activeSec: number; isStudyDay: boolean }[];
  /** 최근 8주. 추이선이 쓴다. */
  weeks: { monday: string; solvedQuestions: number; studyDays: number; activeSec: number }[];
}

/**
 * 내가 볼 수 있는 학생들의 기록. **본인 + 연결된 자녀이고, 대상은 서버가 정한다.**
 *
 * 자녀 목록을 클라이언트에서 만들면 디렉터리 조회 순서에 따라 첫 렌더가 비고, 풀이가 없는
 * 자녀가 빠진다(`supabase/migrations/0045_readable_records.sql`의 근거).
 */
export async function loadReadableRecords(): Promise<Record<string, StudentRecords>> {
  const { data, error } = await supabase().rpc('rpc_readable_records');
  if (error) throw new Error(errorMessage(error));
  return (data ?? {}) as unknown as Record<string, StudentRecords>;
}

/**
 * 활동이 있었던 학습 시간을 더한다. **서버가 실제로 기록한 초를 돌려준다.**
 *
 * 보낸 값보다 작으면 상한에 깎인 것이고, 0이면 하루 상한을 채웠다는 뜻이다
 * (`rpc_log_study_time`). 부르는 쪽은 그 차이를 다시 보내지 않는다.
 */
export async function logStudyTime(
  kind: 'solve' | 'review',
  activeSec: number,
  refId?: string,
): Promise<number> {
  const { data, error } = await supabase().rpc('rpc_log_study_time', {
    p_kind: kind,
    p_active_sec: activeSec,
    // 기본값이 있는 인자는 생성된 타입이 optional이다 — `null`이 아니라 생략으로 넘긴다.
    p_ref_id: refId ?? undefined,
  });
  if (error) throw new Error(errorMessage(error));
  return (data as number | null) ?? 0;
}
