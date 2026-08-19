import { addDaysISO, todayISO } from '@/features/clock';
import { SEED_CONTENT } from './content';
import { EXTRA_CONTENT } from './contentExtra';
import type { ContentSet, NoteEvidence, NoteState } from './types';

/**
 * 개발용 풀이 기록 시드.
 *
 * 학부모 리포트는 자녀가 실제로 푼 기록 위에서만 뜻이 생긴다. 시드가 없으면 리포트에
 * 학원 제출 기록만 남아 "학원 과제와 개인 학습 구분"을 화면에서 확인할 방법이 없다.
 *
 * 실제 사용자 데이터가 아니다. 결정적 고정값이고 화면에서 실제 기록처럼 표현하지 않는다.
 * 빈 상태를 확인하려면 한지훈(`u_teacher_parent`)의 자녀 박도윤(`u_student_academy`)을 본다 —
 * 그 학생은 기록이 없고 미제출 과제만 있다.
 */
interface AttemptSeed {
  studentId: string;
  /** 개인 학습은 공개 콘텐츠에서 파생된다(`contentToPersonalItem`과 같은 `li_` 접두). */
  contentId: string;
  source: 'personal' | 'academy';
  /** 푼 날(YYYY-MM-DD). 오늘은 2026-07-28 기준으로 잡았다. */
  dateISO: string;
  timeSec: number;
  /** 틀린 문항 번호(1부터). 나머지는 맞은 것으로 본다. */
  wrongNumbers: readonly number[];
}

const SEEDS: readonly AttemptSeed[] = [
  // 정예린 — 학원 과제(제출 기록)와 개인 학습을 함께 하는 자녀
  {
    studentId: 'u_student_both',
    contentId: 'ct_lit_1',
    source: 'personal',
    dateISO: '2026-07-27',
    timeSec: 512,
    wrongNumbers: [3, 7],
  },
  {
    studentId: 'u_student_both',
    contentId: 'ct_read_2',
    source: 'personal',
    dateISO: '2026-07-23',
    timeSec: 734,
    wrongNumbers: [1, 2, 5, 8, 10],
  },
  {
    studentId: 'u_student_both',
    contentId: 'ct_lit_3',
    source: 'personal',
    dateISO: '2026-06-25',
    timeSec: 601,
    wrongNumbers: [2, 6, 9],
  },
  // 이하은 — 학부모가 결제하는 개인 학습만 하는 자녀(학원 소속 없음)
  {
    studentId: 'u_student_parentpaid',
    contentId: 'ct_lit_2',
    source: 'personal',
    dateISO: '2026-07-26',
    timeSec: 448,
    wrongNumbers: [4],
  },
  {
    studentId: 'u_student_parentpaid',
    contentId: 'ct_gram_core',
    source: 'personal',
    dateISO: '2026-07-24',
    timeSec: 1180,
    wrongNumbers: [2, 5, 9, 13, 18, 21],
  },
  {
    studentId: 'u_student_parentpaid',
    contentId: 'ct_read_3',
    source: 'personal',
    dateISO: '2026-06-28',
    timeSec: 690,
    wrongNumbers: [2, 3, 6, 9],
  },
];

/** 시드 한 줄을 화면이 쓰는 풀이 기록으로 편다. 문항은 콘텐츠에서 그대로 가져온다. */
function build(seed: AttemptSeed, sets: readonly ContentSet[]) {
  const content = sets.find((s) => s.id === seed.contentId);
  if (!content) return null;
  const wrong = new Set(seed.wrongNumbers);
  const perQuestion = content.questions.map((q, i) => {
    const correct = !wrong.has(i + 1);
    return {
      qId: q.id,
      prompt: q.prompt,
      choices: q.choices,
      answerIndex: q.answerIndex,
      // 틀린 문항은 정답이 아닌 선지를 고른 것으로 둔다 — 학부모 상세에서 고른 답이 보여야 한다.
      pickedIndex: correct ? q.answerIndex : (q.answerIndex + 1) % q.choices.length,
      correct,
    };
  });
  const total = perQuestion.length;
  const correct = perQuestion.filter((q) => q.correct).length;
  return {
    itemId: `li_${content.id}`,
    title: content.title,
    area: content.area as string,
    source: seed.source,
    timeSec: seed.timeSec,
    correct,
    total,
    accuracy: total ? Math.round((correct / total) * 100) : 0,
    dateISO: seed.dateISO,
    perQuestion,
  };
}

export type SeededAttempt = NonNullable<ReturnType<typeof build>>;

/**
 * 오답노트 시드. 학부모 월간 리포트의 "이 달에 복습을 얼마나 했나"를 화면에서 확인하려면
 * 담은 날짜가 있는 오답이 있어야 한다. 실제 사용자 데이터가 아니다.
 */
interface NoteSeed {
  studentId: string;
  contentId: string;
  /** 담은 문항 번호(1부터). */
  n: number;
  createdAt: string;
  source: 'personal' | 'academy';
  /**
   * 학원 배정 오답이면 그 배정 id. **학원 학습의 `itemId`는 배정 id다**(`learning.ts`) —
   * `li_${contentId}` 형태로 두면 학원 화면의 출처 검사(`academyNotesOf`)를 통과하지 못한다.
   */
  assignmentId?: string;
  /** AI와 정리한 메모. 없으면 아직 정리하지 않은 것. */
  dig?: string;
  starred?: boolean;
  /**
   * 복습 스케줄. 개발·테스트 fixture에서만 손으로 정한다 — **실제로는 서버만 쓴다**
   * (`supabase/migrations/0040_note_review_hardening.sql`의 가드 트리거 — 0037에서 도입하고
   * 0040이 정체성 컬럼까지 넓혔다).
   *
   * 생략하면 `queued · 오늘 · 0 · 0`이다. 화면을 보려면 세 상태가 다 있어야 해서
   * (`오늘 볼 것` · `졸업` · `멈춤`) 시드에 섞어 둔다.
   */
  state?: NoteState;
  /** `+N`은 오늘부터 N일 뒤. 생략하면 오늘(=이미 밀린 것). `stuck`이면 무시된다. */
  dueInDays?: number;
  streak?: number;
  missStreak?: number;
  /**
   * 복습 기록. **상태를 주장하면 근거 행이 있어야 한다.**
   *
   * `state: 'graduated', streak: 3`은 "서로 다른 날 세 번 맞혔다"는 주장인데 그 근거가 되는
   * `note_reviews` 행이 0개면, 화면의 `지금까지 N번 다시 풀었어요`가 어떤 카드에도 뜨지 않고
   * 시드가 스스로와 모순된다.
   *
   * `-N`은 오늘부터 N일 전이다.
   */
  reviews?: readonly { agoDays: number; correct: boolean; evidence?: NoteEvidence; recap?: string }[];
  mastered?: boolean;
}

const NOTE_SEEDS: readonly NoteSeed[] = [
  {
    studentId: 'u_student_both',
    contentId: 'ct_lit_1',
    n: 3,
    createdAt: '2026-07-27',
    source: 'personal',
    dig: '인물의 심리를 묻는 문항은 **행동 묘사**부터 찾는다. 직접 말하지 않고 행동으로 드러낸다.',
    starred: true,
    /*
      **익힌 것도 큐에서 빠지지 않는다** — 30일마다 유지 복습으로 돌아온다(1회 정답 후 시험을
      중단하면 지연 회상 이득이 사라진다: Karpicke & Roediger 2008). 화면에서 그 상태를 확인할
      수 있게 하나 둔다.
    */
    state: 'graduated',
    dueInDays: 22,
    streak: 3,
    /* 서로 다른 날 세 번 맞혔다는 주장의 근거다. 이 행이 없으면 시드가 스스로와 모순된다. */
    reviews: [
      { agoDays: 29, correct: true, evidence: 'passage' },
      { agoDays: 22, correct: true, evidence: 'passage', recap: '행동 묘사에서 심리를 읽는다' },
      { agoDays: 8, correct: true, evidence: 'passage' },
    ],
  },
  {
    studentId: 'u_student_both',
    contentId: 'ct_lit_1',
    n: 7,
    createdAt: '2026-07-27',
    source: 'personal',
  },
  {
    studentId: 'u_student_both',
    contentId: 'ct_read_2',
    n: 5,
    createdAt: '2026-07-23',
    source: 'personal',
    dig: '글쓴이의 주장과 근거를 갈라 읽어야 한다. 근거가 사실인지 의견인지 먼저 본다.',
    /*
      `mastered`는 남겨 둔다 — 확정 정책 2절이 이 이름으로 학원 공개 여부를 정하고
      `__tests__/report.test.ts`가 학부모 리포트에서의 부재를 고정한다. **학생 화면은 이제 이
      값을 보지 않는다**(A-087).
    */
    mastered: true,
    /*
      세 번 연속 틀려 복습 목록에서 쉬고 있는 문항. 같은 문항을 무한히 반복시키지 않고 다른
      길(개념 학습·질문)로 넘기는 화면을 확인하려면 하나가 필요하다.
    */
    state: 'stuck',
    missStreak: 3,
    reviews: [
      { agoDays: 5, correct: false, evidence: 'unsure' },
      { agoDays: 3, correct: false, evidence: 'choices' },
      { agoDays: 1, correct: false, evidence: 'unsure' },
    ],
  },
  /*
    학원 배정에서 나온 오답. 문항 번호는 `fixtures.ts`의 제출 기록 `wrongQIds`와 일치시킨다 —
    실제로 틀린 문항만 담아야 화면의 사실이 어긋나지 않는다.
    학원 성과 분석은 이 노트만 볼 수 있다(D-014). 위의 개인 학습 오답은 공개되지 않는다.
  */
  {
    studentId: 'u_student_both',
    contentId: 'ct_acad_1',
    assignmentId: 'a_kor1_1',
    n: 5,
    createdAt: '2026-07-23',
    source: 'academy',
    dig: '서술자가 누구인지 먼저 정한다. **1인칭이면 아는 것이 제한**되므로 인물의 속마음을 단정한 선택지를 지운다.',
    starred: true,
  },
  {
    studentId: 'u_student_both',
    contentId: 'ct_acad_1',
    assignmentId: 'a_kor1_1',
    n: 9,
    createdAt: '2026-07-23',
    source: 'academy',
  },
  {
    studentId: 'u_student_both',
    contentId: 'ct_read_1',
    assignmentId: 'a_kor2_2',
    n: 2,
    createdAt: '2026-07-19',
    source: 'academy',
    dig: '글의 목적을 묻는 문항은 **첫 문단과 마지막 문단**만 다시 읽는다. 가운데 예시에 끌리면 틀린다.',
  },
  {
    studentId: 'u_student_both',
    contentId: 'ct_read_1',
    assignmentId: 'a_kor2_2',
    n: 7,
    createdAt: '2026-07-20',
    source: 'academy',
    starred: true,
  },
  {
    studentId: 'u_student_both',
    contentId: 'ct_gram_1',
    assignmentId: 'a_kor2_1',
    n: 7,
    createdAt: '2026-07-25',
    source: 'academy',
    dig: '띄어쓰기는 **의존 명사**부터 찾는다. `수 있다`의 `수`는 앞말과 띄어 쓴다.',
  },
  {
    studentId: 'u_student_parentpaid',
    contentId: 'ct_lit_2',
    n: 4,
    createdAt: '2026-07-26',
    source: 'personal',
    dig: '비유가 가리키는 대상을 앞 문단에서 찾는다.',
  },
  {
    studentId: 'u_student_parentpaid',
    contentId: 'ct_gram_core',
    n: 5,
    createdAt: '2026-07-24',
    source: 'personal',
    starred: true,
  },
  {
    studentId: 'u_student_parentpaid',
    contentId: 'ct_read_3',
    n: 6,
    createdAt: '2026-06-30',
    source: 'personal',
    dig: '지난달에 정리한 메모예요.',
    mastered: true,
  },
];

export interface SeededNote {
  id: string;
  itemId: string;
  contentId: string;
  source: 'personal' | 'academy';
  area: string;
  title: string;
  qId: string;
  prompt: string;
  choices: string[];
  answerIndex: number;
  pickedIndex?: number;
  dig?: string;
  starred?: boolean;
  mastered?: boolean;
  createdAt: string;
  state: NoteState;
  dueOn?: string;
  streak: number;
  missStreak: number;
  reviews: readonly { on: string; correct: boolean; evidence?: NoteEvidence; recap?: string }[];
}

/** 학생별 오답노트 시드. `progress.tsx`의 초기 상태로 들어간다. */
export const WRONG_NOTES_SEED: Record<string, SeededNote[]> = (() => {
  const sets = [...SEED_CONTENT, ...EXTRA_CONTENT];
  const out: Record<string, SeededNote[]> = {};
  for (const seed of NOTE_SEEDS) {
    const content = sets.find((s) => s.id === seed.contentId);
    const q = content?.questions[seed.n - 1];
    if (!content || !q) continue;
    out[seed.studentId] = [
      ...(out[seed.studentId] ?? []),
      {
        id: `wn_${q.id}`,
        itemId: seed.assignmentId ?? `li_${content.id}`,
        contentId: content.id,
        source: seed.source,
        area: content.area as string,
        title: content.title,
        qId: q.id,
        prompt: q.prompt,
        choices: q.choices,
        answerIndex: q.answerIndex,
        pickedIndex: (q.answerIndex + 1) % q.choices.length,
        dig: seed.dig,
        starred: seed.starred,
        mastered: seed.mastered,
        createdAt: seed.createdAt,
        state: seed.state ?? 'queued',
        // `stuck`만 다시 볼 날이 없다(DB의 `wrong_notes_due_matches_state`와 같은 규칙).
        dueOn:
          (seed.state ?? 'queued') === 'stuck'
            ? undefined
            : addDaysISO(todayISO(), seed.dueInDays ?? 0),
        streak: seed.streak ?? 0,
        missStreak: seed.missStreak ?? 0,
        reviews: (seed.reviews ?? []).map((r) => ({
          on: addDaysISO(todayISO(), -Math.abs(r.agoDays)),
          correct: r.correct,
          evidence: r.evidence,
          recap: r.recap,
        })),
      },
    ];
  }
  return out;
})();

/** 학생별 풀이 기록 시드. `progress.tsx`의 초기 상태로 들어간다. */
export const ATTEMPTS_SEED: Record<string, Record<string, SeededAttempt>> = (() => {
  const sets = [...SEED_CONTENT, ...EXTRA_CONTENT];
  const out: Record<string, Record<string, SeededAttempt>> = {};
  for (const seed of SEEDS) {
    const attempt = build(seed, sets);
    if (!attempt) continue;
    out[seed.studentId] = { ...out[seed.studentId], [attempt.itemId]: attempt };
  }
  return out;
})();
