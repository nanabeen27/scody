import type { NoteEvidence, NoteState } from '@/data/types';
import type { WrongNote } from '@/repo/learning';
import type { NoteReview } from '@/repo/notes';
import { daysBetweenISO, todayISO } from './clock';

/**
 * 오답 복습의 순수 규칙 — 오늘 볼 것 고르기 · 우선순위 · 요약.
 *
 * **스케줄을 정하는 곳이 아니다.** 다음에 볼 날은 서버만 정한다
 * (`supabase/migrations/0040_note_review_hardening.sql` — `0038`의 판본을 교체했다). 여기 있는
 * 것은 이미 정해진 `dueOn`을 보고
 * **오늘 무엇을 몇 개 보여 줄지** 고르는 규칙이다. 그 둘을 섞으면 화면이 자기 일정을 앞당길 수
 * 있고, 그러면 스케줄이 서버 규칙이 아니라 클라이언트 값이 된다.
 *
 * ## 하루 상한이 알고리즘보다 먼저다
 *
 * 밀린 큐를 이긴 서비스는 스케줄러를 개선한 것이 아니라 **큐를 없앴다** — 한 곳은 하루 한 번
 * 12시간 쿨다운으로, 다른 곳은 매일 새 세션으로 갈아치운다. 정직한 백로그를 유지한 쪽에서는
 * 사용자가 하루 1,671장을 받고 그만두는 서술이 반복된다. 고3의 하루는 이미 꽉 차 있다.
 *
 * 그래서 **밀린 것은 큐 크기를 늘리지 않고 우선순위만 바꾼다.** 30개가 밀려도 오늘 볼 것은
 * `DAILY_CAP`개다. 화면 문구도 밀린 개수를 앞에 두지 않는다 — 겁주거나 재촉하지 않는다.
 */

/**
 * 하루에 보여 줄 카드 수.
 *
 * 재노출 3회 부근에서 효과가 가장 컸다는 교실 메타분석(Mawson & Kang 2025)과, 국어 한 문항이
 * 지문·선지를 함께 읽어야 해서 어휘 카드보다 한 장이 무겁다는 점을 함께 봤다. **근거로
 * 고정된 숫자가 아니다** — 밀린 큐가 이탈을 만든다는 인과 자체는 동료심사 근거가 없고,
 * 커뮤니티 관찰과 큐를 없앤 서비스가 이긴 사실이 근거다.
 */
export const DAILY_CAP = 5;

/**
 * 서로 다른 날 연속 정답 3회면 익힌 것으로 본다.
 *
 * **판정하는 곳은 서버다**(`supabase/migrations/0040_note_review_hardening.sql`의 정답 분기 —
 * 그 파일에는 이름 없는 리터럴 `3`이다). 이 값은 화면이 `연속 N번 더`를 세는 데만 쓴다. 두
 * 자리가 갈리면 화면이 서버와 다른 수를 말하므로, 서버 규칙을 고칠 때 함께 고친다.
 *
 * ## 사다리 숫자에 대한 정정
 *
 * `0038`의 주석은 "7일이 중심이다"라며 확장 간격과 균등 간격의 차이가 유의하지 않다는 것
 * (g=0.034 · Latimier et al. 2021)과 교실에서 7일 고정이 가장 일관되게 양의 효과를 냈다는 것
 * (Mawson & Kang 2025)을 근거로 들었다. **그 두 인용은 균등 간격을 지지하는데 구현은
 * `1 → 7 → 21 → 30` 확장 곡선이다.** 인용이 붙은 숫자는 7일 하나이고 `21`·`30`은 근거가 없다.
 *
 * 정확히 말하면 이렇다: 확장과 균등의 차이가 **유의하지 않으므로** 확장을 고르는 것이 문헌에
 * 반하지는 않는다. 그러나 문헌이 확장을 **지지하지도** 않으므로, 이 사다리는 근거로 고정된 것이
 * 아니라 **선택**이다. 총 간격량이 중요하다는 것만 확립돼 있다.
 *
 * `stuck`을 3회로 좁힌 근거도 틀렸다 — `0038`은 "Anki의 8회는 몇 달이 걸린다"고 적었지만 오답은
 * 항상 다음 날이므로 **8회면 8일**이다. 3이라는 숫자 역시 근거가 아니라 선택이다(국어 문항 수와
 * 세션 빈도를 보고 정했다).
 */
export const GRADUATE_STREAK = 3;

/**
 * 오늘 볼 카드 한 장.
 *
 * `overdueDays`·`keeping`은 **정렬 비교자만 읽는다**(`dueCards`). 화면은 노트와 `noteReviews`에서
 * 필요한 것을 직접 세므로 호출자에게 노출할 이유가 없지만, 정렬 근거를 값으로 남겨 두면 그
 * 규칙을 테스트가 단정할 수 있다.
 */
export interface ReviewCard {
  note: WrongNote;
  /** 며칠 밀렸는가. 0이면 오늘이 그날이다. */
  overdueDays: number;
  /** 이번이 유지 복습인가(이미 졸업한 문항). */
  keeping: boolean;
}

function isDue(note: WrongNote, today: string): boolean {
  if (note.state === 'stuck' || !note.dueOn) return false;
  return daysBetweenISO(note.dueOn, today) >= 0;
}

/**
 * 오늘 볼 카드. **상한을 넘기지 않는다.**
 *
 * 우선순위:
 * 1. **다시 틀린 것 먼저**(`missStreak > 0`). 1회 오답은 노이즈가 섞이지만(찍어서 틀림·시간
 *    부족) 복습에서 또 틀린 것은 신호다. 시험 직전에 볼 목록이 이것 하나여야 한다는 국내 지도
 *    조언과, 「2회 이상 틀린 것만」을 별도 개념으로 둔 서비스들이 같은 지점을 가리킨다.
 * 2. **아직 졸업하지 않은 것**을 유지 복습보다 앞에 둔다. 이미 맞히고 있는 것을 섞으면 복습
 *    자체를 그만두게 된다(한 서비스가 7년째 같은 불만을 받고 있다).
 * 3. 오래 밀린 것.
 * 4. 담은 순서(같은 조건이면 결정적이어야 한다 — 화면이 매 렌더 흔들리지 않게).
 */
export function dueCards(
  notes: readonly WrongNote[],
  today: string = todayISO(),
  cap: number = DAILY_CAP,
): ReviewCard[] {
  const cards = notes
    .filter((n) => isDue(n, today))
    .map<ReviewCard>((note) => ({
      note,
      overdueDays: note.dueOn ? daysBetweenISO(note.dueOn, today) : 0,
      keeping: note.state === 'graduated',
    }));
  cards.sort((a, b) => {
    const missed = Number(b.note.missStreak > 0) - Number(a.note.missStreak > 0);
    if (missed !== 0) return missed;
    const keep = Number(a.keeping) - Number(b.keeping);
    if (keep !== 0) return keep;
    if (b.overdueDays !== a.overdueDays) return b.overdueDays - a.overdueDays;
    return (a.note.createdAt ?? '').localeCompare(b.note.createdAt ?? '');
  });
  return cards.slice(0, Math.max(0, cap));
}

/** 차례가 온 것이 몇 개인지(상한 적용 전). 우선순위 계산과 진단에만 쓴다. */
export function dueCount(notes: readonly WrongNote[], today: string = todayISO()): number {
  return notes.filter((n) => isDue(n, today)).length;
}

/**
 * **화면이 학생에게 말하는 개수.** 상한을 적용한 값이다.
 *
 * 밀린 개수를 앞세우지 않는다 — 서른 개가 밀려도 오늘 볼 것은 `DAILY_CAP`개다. 세 화면이 각자
 * `Math.min`을 곱하면 한 곳에서 빠뜨리고, 실제로 학습 탭 캡션이 원값(`40개예요`)을 말하면서 바로
 * 아래 줄이 `5개`를 말하는 상태가 됐다. 개수를 세는 곳은 하나다.
 */
export function todayCount(
  notes: readonly WrongNote[],
  today: string = todayISO(),
  cap: number = DAILY_CAP,
): number {
  return Math.min(dueCount(notes, today), Math.max(0, cap));
}

/**
 * 오늘 이미 복습한 노트는 큐에서 뺀다.
 *
 * **진행을 따로 저장하지 않는 이유가 이것이다.** 서버가 하루 한 노트 한 행만 허용하므로
 * (`note_reviews`의 `(note_id, reviewed_on)` 유니크), "오늘 본 것"이 곧 복습 기록이다. 8장 중
 * 5장을 풀고 나간 학생이 다시 들어오면 남은 3장이 나온다 — 예전에는 화면 로컬 상태여서 1번
 * 카드부터였다(A-114).
 */
export function notReviewedToday(
  cards: readonly ReviewCard[],
  reviews: Record<string, readonly NoteReview[]>,
  today: string = todayISO(),
): ReviewCard[] {
  return cards.filter((c) => !todayResult(c.note.id, reviews, today));
}

/**
 * 오늘 볼 덱. **화면이 부르는 것은 이 함수 하나다.**
 *
 * `차례가 온 것 → 오늘 아직 안 본 것 → 상한` 순서로 좁힌다. 순서가 중요하다: 상한을 먼저
 * 걸면 오늘 이미 세 장을 본 학생의 남은 덱이 두 장으로 줄어든다(다섯 장이 차례인데도).
 */
export function todayDeck(
  notes: readonly WrongNote[],
  reviews: Record<string, readonly NoteReview[]>,
  today: string = todayISO(),
  cap: number = DAILY_CAP,
): ReviewCard[] {
  const due = dueCards(notes, today, Number.MAX_SAFE_INTEGER);
  return notReviewedToday(due, reviews, today).slice(0, Math.max(0, cap));
}

/**
 * 학생이 범위를 직접 고른 덱(별표·영역·전체). **차례를 보지 않는다.**
 *
 * 시험 직전에 특정 영역만 돌아보는 것은 스케줄과 다른 목적이고, 그 판단은 학생의 시험 일정이
 * 정한다 — 알고리즘이 정한 날짜가 학생의 일정보다 우선할 이유가 없다. 상한도 두지 않는다:
 * 범위를 좁힌 것이 이미 학생의 선택이다.
 *
 * **차례가 아닌 복습은 다음 차례를 움직이지 않는다**(서버가 그렇게 정한다 — 0040). 그러지
 * 않으면 3일 연속 전체 복습으로 사다리를 3일로 압축해 전부 졸업시킬 수 있다.
 *
 * 빼는 것 둘:
 * - **오늘 이미 복습한 것** — 서버가 하루 한 노트 한 번만 받으므로(0037의 유니크 키) 남겨 두면
 *   눌러도 거부되는 카드가 된다.
 * - **쉬고 있는 문항**(`stuck`) — 서버가 그 노트의 복습을 받지 않는다. 남겨 두면 카드가 열리고
 *   확인할 수 없으며, 화면은 그 문항을 복습시키면서 `지금은 복습 목록에서 쉬고 있어요`라고
 *   말한다. 큐로 돌아오는 문은 오답노트의 `다시 복습 목록에 넣기` 하나다.
 */
export function scopedDeck(
  notes: readonly WrongNote[],
  reviews: Record<string, readonly NoteReview[]>,
  filter: { area?: string; onlyStarred?: boolean },
  today: string = todayISO(),
): WrongNote[] {
  return notes.filter(
    (n) =>
      n.state !== 'stuck' &&
      (!filter.area || n.area === filter.area) &&
      (!filter.onlyStarred || n.starred) &&
      !todayResult(n.id, reviews, today),
  );
}

/** 오늘 이 노트를 복습해서 나온 결과. 없으면 아직 안 본 것. */
export function todayResult(
  noteId: string,
  reviews: Record<string, readonly NoteReview[]>,
  today: string = todayISO(),
): NoteReview | undefined {
  return (reviews[noteId] ?? []).find((r) => r.reviewedOn === today);
}

/**
 * 노트 상태별 개수. **`dueToday`는 상한 적용 전 원값이다.**
 *
 * 화면이 학생에게 말하는 개수는 `todayCount`(상한 적용)다. 예전에는 이 필드가 `today`였고
 * `todayCount`도 `오늘`이라 이름이 같아서, 화면이 어느 쪽을 골라야 하는지 알 수 없었다 —
 * 실제로 오답노트 두 자리가 원값에 `Math.min`을 손으로 곱했다(`todayCount`가 없애려던 식이다).
 */
export interface NoteStateCounts {
  dueToday: number;
  later: number;
  graduated: number;
  stuck: number;
}

/**
 * 노트 목록의 상태 요약. **한 번 훑어 네 칸을 함께 센다.**
 *
 * 학생에게 말하는 `오늘` 개수는 여기서 읽지 않는다 — 상한을 적용한 `todayCount`가 그 자리다.
 * 이 함수의 소비처는 오답노트의 칸 목록이다(`쉬는 중` 칸을 둘지, 칸마다 몇 개인지).
 *
 * `stuck`을 `멈춤`이라고 부르지 않는다 — 화면 문구는 그 상태를 학생 탓으로 말하지 않는다.
 */
export function stateCounts(
  notes: readonly WrongNote[],
  today: string = todayISO(),
): NoteStateCounts {
  let dueToday = 0;
  let later = 0;
  let graduated = 0;
  let stuck = 0;
  for (const n of notes) {
    if (n.state === 'stuck') stuck += 1;
    else if (isDue(n, today)) dueToday += 1;
    else if (n.state === 'graduated') graduated += 1;
    else later += 1;
  }
  return { dueToday, later, graduated, stuck };
}

/**
 * 가장 이른 차례까지 며칠. 차례가 있는 노트가 없으면 `null`.
 *
 * **담은 날에는 차례가 없다.** 틀린 직후 같은 세션에서 다시 묻는 것은 근거가 없고(집중 반복은
 * 1회 후 빼는 것과 차이가 없다), 그래서 새로 담은 오답의 첫 차례는 내일이다. 담은 날 할 일은
 * 오답노트에서 정리하는 것이고 — 설명 피드백이 그 자리다 — 다시 푸는 것은 그다음이다.
 *
 * 화면이 이 값을 모르면 `차례가 된 오답이 없어요`라고만 말한다. 방금 다섯 개를 담은 학생에게
 * 그 문장은 기능이 죽은 것처럼 읽힌다.
 */
export function soonestDueDays(
  notes: readonly WrongNote[],
  today: string = todayISO(),
): number | null {
  let best: number | null = null;
  for (const n of notes) {
    if (n.state === 'stuck' || !n.dueOn) continue;
    const days = Math.max(0, daysBetweenISO(today, n.dueOn));
    if (best === null || days < best) best = days;
  }
  return best;
}

/**
 * 다음에 볼 날을 사람 문장으로.
 *
 * **날짜를 그대로 쓰지 않는다.** `2026-09-09`는 학생이 오늘로부터 며칠인지 세어야 하는 값이다.
 * 그리고 단계 숫자(`3단계`)나 강등을 말하지 않는다 — 감점으로 읽히면 복습 동기를 깎는다.
 */
export function nextReviewLabel(
  /** 노트(`dueOn?: string`)와 서버 응답(`dueOn: string | null`)을 둘 다 받는다. */
  note: { state: NoteState; dueOn?: string | null },
  today: string = todayISO(),
): string {
  if (note.state === 'stuck') return '지금은 복습 목록에서 쉬고 있어요';
  if (!note.dueOn) return '';
  const days = daysBetweenISO(today, note.dueOn);
  if (days <= 0) return '오늘 다시 볼 차례예요';
  if (days === 1) return '내일 다시 만나요';
  if (days < 7) return `${days}일 뒤에 다시 만나요`;
  if (days < 30) return `${Math.round(days / 7)}주 뒤에 다시 만나요`;
  return '한 달쯤 뒤에 다시 만나요';
}

/** 숙달까지 남은 정답 횟수. 졸업했으면 0이다. */
export function passesLeft(note: { state: NoteState; streak: number }): number {
  if (note.state === 'graduated') return 0;
  return Math.max(0, GRADUATE_STREAK - note.streak);
}

/**
 * 학원 과제 오답의 메모 공개 고지(D-054 · D-110).
 *
 * **결과 화면·오답노트·카드 복습 세 곳이 같은 문장을 말한다.** 세 화면의 주석이 모두 "한 글자도
 * 다르지 않게 쓴다"고 적었는데 리터럴 복제로는 컴파일러가 그 약속을 지켜 주지 않는다 — 공개
 * 범위를 말하는 문장이라 한 자리만 바뀌면 나머지 두 화면이 다른 범위를 약속한다.
 *
 * 컴포넌트로 만들지 않는다: 조건과 톤은 같아도 배치 맥락이 달라(결과는 목록 위, 복습은 피드백
 * 아래, 오답노트는 카드 안) 감싸는 요소가 화면마다 다르다.
 */
export const ACADEMY_MEMO_NOTICE = '학원 과제에서 담은 오답의 메모는 선생님이 볼 수 있어요.';

/**
 * 근거 3택의 화면 문구. 값과 문구를 한곳에 둔다.
 *
 * **지문이 없는 문항에서는 다른 말을 쓴다.** 문법 세트는 지문이 없는데(`ct_gram_1`·`문법 종합
 * 24문항`) 첫 선택지가 `지문에서 근거를 찾았어요`였다 — 뜻이 서지 않는 3택에서 학생은 아무거나
 * 골라야 확인 버튼이 나타났고, 그렇게 모인 값은 데이터로도 쓸모가 없었다. 문법은 오답이 가장
 * 많이 쌓이는 영역이다.
 *
 * 값 공간(`NoteEvidence`)은 그대로 둔다 — 스키마를 건드리지 않고 문구만 가른다. `passage`는
 * "근거를 확인하고 골랐다", `choices`는 "선지를 보고 골랐다"라는 뜻으로 두 갈래에서 같다.
 */
const EVIDENCE_LABELS: Record<NoteEvidence, string> = {
  passage: '지문에서 근거를 찾았어요',
  choices: '선지만 보고 판단했어요',
  unsure: '잘 모르겠어요',
};

/** 지문이 없는 문항(문법·어휘)의 근거 3택 문구. */
const EVIDENCE_LABELS_NO_PASSAGE: Record<NoteEvidence, string> = {
  passage: '규칙을 알고 골랐어요',
  choices: '선지를 보고 골랐어요',
  unsure: '잘 모르겠어요',
};

/** 근거를 묻는 문장. 지문 유무로 갈린다. */
export function evidenceQuestion(hasPassage: boolean): string {
  return hasPassage ? '이 답의 근거를 어디서 잡았나요?' : '어떻게 답을 골랐나요?';
}

export function evidenceLabels(hasPassage: boolean): Record<NoteEvidence, string> {
  return hasPassage ? EVIDENCE_LABELS : EVIDENCE_LABELS_NO_PASSAGE;
}

/**
 * 근거 3택을 묻는 순서. **라벨과 같은 자리에서 정한다.**
 *
 * 화면이 따로 나열하면 값 공간이 두 곳에 있고 순서만 어긋나도 타입 검사가 잡지 못한다.
 */
export const EVIDENCE_ORDER = Object.keys(EVIDENCE_LABELS) as readonly NoteEvidence[];

/**
 * 지금 이 문항에 무엇을 권할지.
 *
 * `stuck`이 조용한 삭제가 되지 않게, 화면이 **다른 길**을 제시하는 근거다. 같은 문항을 무한히
 * 반복시키는 것은 학습이 아니다.
 */
export function stuckAdvice(note: Pick<WrongNote, 'source'>): string {
  return note.source === 'academy'
    ? '세 번 연속 헷갈렸어요. 오답노트에서 물어보거나 선생님께 여쭤보는 게 빨라요.'
    : '세 번 연속 헷갈렸어요. 같은 유형을 다시 풀어 보는 게 빨라요.';
}

/**
 * 선지를 섞는 순서. **정답 자리를 기억하는 것으로 복습이 끝나지 않게 한다.**
 *
 * 같은 문항을 다시 풀 때 학생이 인출하는 것이 근거가 아니라 답의 위치일 수 있다. 다른 과목의
 * 문제은행 사용자들이 2회독에서 정확히 그것을 보고했다("답을 그냥 기억해서 20분에 끝났다").
 * **국어는 더 심하다** — 지문까지 기억에 남아 읽지 않고도 고를 수 있다.
 *
 * `Math.random`을 쓰지 않는다. 리렌더마다 순서가 바뀌면 누르는 중에 선지가 움직이고, 테스트가
 * 결정적이지 않게 된다. **씨앗은 `노트 id + 날짜`다** — 같은 날 같은 카드는 같은 순서이고
 * 다음 세션에는 달라진다.
 *
 * 근거로 뒷받침된 개선이 아니다(문항 형식 변환의 보존 효과는 d=0.07로 작다). 답 위치 기억을
 * 막는 것이 목적이고, 그 관찰은 사용자 서술에서 왔다.
 */
export function shuffleOrder(seed: string, count: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i -= 1) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h ^= h >>> 13;
    const j = Math.abs(h) % (i + 1);
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  return order;
}

/** 카드 하나의 선지 순서 씨앗. 화면과 테스트가 같은 규칙을 쓰게 한곳에 둔다. */
export function choiceSeed(noteId: string, today: string = todayISO()): string {
  return `${noteId}:${today}`;
}

/**
 * 완료 요약의 마지막 한 줄.
 *
 * 조기 반환이라 조건 하나를 더할 자리가 명확하고, 문구 우선순위가 렌더 트리에 묻히지 않는다.
 *
 * **첫 조건이 규칙이다** — 틀린 카드가 전부 내일 오지 않는다면 `내일 다시 만나요`는 거짓이다.
 * 내일 오지 않는 갈래는 둘이고 서버가 정한다(0040):
 *
 * 1. **쉬는 것**: 서로 다른 날 세 번 연속 틀리면 큐에서 내린다(`due_on`이 없다).
 * 2. **차례가 아닌 복습**: 별표·영역·전체 덱은 차례를 보지 않고 열리므로, 그 회차는 기록만
 *    남고 `due_on`을 움직이지 않는다(`scheduled: false`) — 그 카드의 다음 차례는 그대로다.
 *
 * 그래서 `notTomorrow`는 상태가 아니라 **다음 차례가 내일인지**로 센다. ②를 빼먹으면 같은 흐름의
 * 두 화면이 같은 카드의 일정을 반대로 말한다 — 카드 화면은 `차례가 아닌 복습이라 다음 차례는
 * 그대로예요`라고 말하고 완료 요약은 `내일 다시 만나요`라고 말했다.
 */
export function closingLine({
  missed,
  notTomorrow,
  done,
  remaining,
}: {
  missed: number;
  /** 틀린 것 중 **다음 차례가 내일이 아닌** 개수(쉬는 것 · 차례가 아니었던 복습). */
  notTomorrow: number;
  done: number;
  remaining: number;
}): string {
  if (missed > notTomorrow) return '헷갈린 문항은 내일 다시 만나요.';
  if (done === 0) return '건너뛴 문항은 다음 차례에 다시 나와요.';
  return remaining > 0 ? '오늘 몫을 마쳤어요.' : '차례가 된 오답을 모두 봤어요.';
}
