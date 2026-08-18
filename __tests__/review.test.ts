import { addDaysISO } from '../src/features/clock';
import {
  choiceSeed,
  DAILY_CAP,
  evidenceLabels,
  evidenceQuestion,
  dueCards,
  dueCount,
  nextReviewLabel,
  notReviewedToday,
  passesLeft,
  scopedDeck,
  shuffleOrder,
  soonestDueDays,
  stateCounts,
  todayCount,
  todayDeck,
  todayResult,
} from '../src/features/review';
import type { WrongNote } from '../src/repo/learning';
import type { NoteReview } from '../src/repo/notes';

const TODAY = '2026-08-19';

function note(id: string, over: Partial<WrongNote> = {}): WrongNote {
  return {
    id,
    itemId: `li_c_${id}`,
    contentId: `c_${id}`,
    source: 'personal',
    area: '문학',
    title: `세트 ${id}`,
    qId: `q_${id}`,
    prompt: `발문 ${id}`,
    choices: ['가', '나', '다', '라', '마'],
    answerIndex: 0,
    createdAt: '2026-07-01',
    state: 'queued',
    dueOn: TODAY,
    streak: 0,
    missStreak: 0,
    ...over,
  };
}

function review(noteId: string, on: string, isCorrect = true): NoteReview {
  return { id: `r_${noteId}_${on}`, noteId, reviewedOn: on, isCorrect };
}

describe('오늘 볼 카드', () => {
  it('아직 그날이 아닌 노트는 큐에 오지 않는다', () => {
    const notes = [
      note('a', { dueOn: TODAY }),
      note('b', { dueOn: addDaysISO(TODAY, 3) }),
    ];
    expect(dueCards(notes, {}, TODAY).map((c) => c.note.id)).toEqual(['a']);
  });

  it('멈춘 노트는 다시 볼 날이 없어 큐에 오지 않는다', () => {
    const notes = [note('a', { state: 'stuck', dueOn: undefined, missStreak: 3 })];
    expect(dueCards(notes, {}, TODAY)).toHaveLength(0);
    expect(dueCount(notes, TODAY)).toBe(0);
  });

  it('밀려도 하루 상한을 넘기지 않는다', () => {
    // 30개가 밀린 상태. 큐 크기를 늘리지 않고 우선순위만 바꾼다.
    const notes = Array.from({ length: 30 }, (_, i) =>
      note(`n${i}`, { dueOn: addDaysISO(TODAY, -i - 1) }),
    );
    expect(dueCount(notes, TODAY)).toBe(30);
    expect(dueCards(notes, {}, TODAY)).toHaveLength(DAILY_CAP);
  });

  it('다시 틀린 것을 먼저 보여 준다', () => {
    const notes = [
      note('오래밀림', { dueOn: addDaysISO(TODAY, -20) }),
      note('다시틀림', { dueOn: TODAY, missStreak: 1 }),
    ];
    expect(dueCards(notes, {}, TODAY, 2).map((c) => c.note.id)).toEqual([
      '다시틀림',
      '오래밀림',
    ]);
  });

  it('이미 익힌 것(유지 복습)은 아직 못 익힌 것보다 뒤에 둔다', () => {
    const notes = [
      note('졸업', { state: 'graduated', dueOn: addDaysISO(TODAY, -5), streak: 3 }),
      note('복습중', { state: 'queued', dueOn: TODAY }),
    ];
    const ids = dueCards(notes, {}, TODAY, 2).map((c) => c.note.id);
    expect(ids).toEqual(['복습중', '졸업']);
  });

  it('같은 조건이면 담은 순서로 — 매 렌더 흔들리지 않는다', () => {
    const notes = [
      note('나중', { createdAt: '2026-07-10' }),
      note('먼저', { createdAt: '2026-07-01' }),
    ];
    const once = dueCards(notes, {}, TODAY).map((c) => c.note.id);
    const twice = dueCards([...notes].reverse(), {}, TODAY).map((c) => c.note.id);
    expect(once).toEqual(['먼저', '나중']);
    expect(twice).toEqual(once);
  });

  it('졸업한 카드는 유지 복습으로 표시된다', () => {
    const cards = dueCards([note('a', { state: 'graduated', streak: 3 })], {}, TODAY);
    expect(cards[0].keeping).toBe(true);
  });

  it('밀린 일수와 지금까지 복습 횟수를 함께 준다', () => {
    const n = note('a', { dueOn: addDaysISO(TODAY, -4) });
    const cards = dueCards([n], { a: [review('a', '2026-08-01'), review('a', '2026-08-10')] }, TODAY);
    expect(cards[0].overdueDays).toBe(4);
    expect(cards[0].reviewCount).toBe(2);
  });
});

describe('중간에 나가도 진행이 남는다 (A-114)', () => {
  it('오늘 이미 복습한 카드는 다시 나오지 않는다', () => {
    const notes = [note('a'), note('b'), note('c')];
    const cards = dueCards(notes, {}, TODAY);
    const reviews = { a: [review('a', TODAY)], b: [review('b', TODAY)] };
    expect(notReviewedToday(cards, reviews, TODAY).map((c) => c.note.id)).toEqual(['c']);
  });

  it('어제 복습한 것은 오늘 다시 나온다', () => {
    const cards = dueCards([note('a')], {}, TODAY);
    const reviews = { a: [review('a', addDaysISO(TODAY, -1))] };
    expect(notReviewedToday(cards, reviews, TODAY)).toHaveLength(1);
  });

  it('오늘 결과를 되짚을 수 있다', () => {
    const reviews = { a: [review('a', addDaysISO(TODAY, -1), true), review('a', TODAY, false)] };
    expect(todayResult('a', reviews, TODAY)?.isCorrect).toBe(false);
    expect(todayResult('b', reviews, TODAY)).toBeUndefined();
  });
});

describe('상태 요약', () => {
  it('오늘·나중·익힘·쉬는 것을 가른다', () => {
    const notes = [
      note('오늘1', { dueOn: TODAY }),
      note('오늘2', { dueOn: addDaysISO(TODAY, -2) }),
      note('나중', { dueOn: addDaysISO(TODAY, 5) }),
      note('졸업나중', { state: 'graduated', dueOn: addDaysISO(TODAY, 20), streak: 3 }),
      note('멈춤', { state: 'stuck', dueOn: undefined, missStreak: 3 }),
    ];
    expect(stateCounts(notes, TODAY)).toEqual({ today: 2, later: 1, graduated: 1, stuck: 1 });
  });

  it('졸업했지만 오늘이 그날이면 오늘로 센다 — 큐에 나오는 것과 어긋나지 않게', () => {
    const notes = [note('a', { state: 'graduated', dueOn: TODAY, streak: 3 })];
    expect(stateCounts(notes, TODAY).today).toBe(1);
    expect(stateCounts(notes, TODAY).graduated).toBe(0);
    expect(dueCards(notes, {}, TODAY)).toHaveLength(1);
  });
});

describe('다음 차례를 사람 문장으로', () => {
  it('날짜를 그대로 보여 주지 않는다', () => {
    expect(nextReviewLabel({ state: 'queued', dueOn: TODAY }, TODAY)).toBe('오늘 다시 볼 차례예요');
    expect(nextReviewLabel({ state: 'queued', dueOn: addDaysISO(TODAY, 1) }, TODAY)).toBe(
      '내일 다시 만나요',
    );
    expect(nextReviewLabel({ state: 'queued', dueOn: addDaysISO(TODAY, 3) }, TODAY)).toBe(
      '3일 뒤에 다시 만나요',
    );
    expect(nextReviewLabel({ state: 'queued', dueOn: addDaysISO(TODAY, 21) }, TODAY)).toBe(
      '3주 뒤에 다시 만나요',
    );
    expect(nextReviewLabel({ state: 'graduated', dueOn: addDaysISO(TODAY, 30) }, TODAY)).toBe(
      '한 달쯤 뒤에 다시 만나요',
    );
  });

  it('멈춘 문항은 학생 탓으로 말하지 않는다', () => {
    const label = nextReviewLabel({ state: 'stuck', dueOn: undefined }, TODAY);
    expect(label).toBe('지금은 복습 목록에서 쉬고 있어요');
  });

  it('밀린 것도 오늘로 말한다 — 며칠 밀렸다고 앞세우지 않는다', () => {
    expect(nextReviewLabel({ state: 'queued', dueOn: addDaysISO(TODAY, -9) }, TODAY)).toBe(
      '오늘 다시 볼 차례예요',
    );
  });
});

describe('숙달까지 남은 횟수', () => {
  it('연속 정답이 쌓이면 줄어든다', () => {
    expect(passesLeft({ state: 'queued', streak: 0 })).toBe(3);
    expect(passesLeft({ state: 'queued', streak: 2 })).toBe(1);
  });

  it('졸업하면 0이다', () => {
    expect(passesLeft({ state: 'graduated', streak: 3 })).toBe(0);
  });
});

describe('선지 섞기', () => {
  it('같은 씨앗은 같은 순서 — 리렌더 중에 선지가 움직이지 않는다', () => {
    const a = shuffleOrder(choiceSeed('n1', TODAY), 5);
    const b = shuffleOrder(choiceSeed('n1', TODAY), 5);
    expect(a).toEqual(b);
  });

  it('날짜가 바뀌면 순서가 바뀐다 — 답 위치를 기억하는 것으로 끝나지 않게', () => {
    const today = shuffleOrder(choiceSeed('n1', TODAY), 5);
    const other = shuffleOrder(choiceSeed('n1', addDaysISO(TODAY, 7)), 5);
    expect(other).not.toEqual(today);
  });

  it('선지를 잃거나 중복하지 않는다', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      const order = shuffleOrder(choiceSeed(id, TODAY), 5);
      expect([...order].sort()).toEqual([0, 1, 2, 3, 4]);
    }
  });

  it('선지가 하나여도 성립한다', () => {
    expect(shuffleOrder(choiceSeed('n1', TODAY), 1)).toEqual([0]);
  });
});

describe('오늘 덱', () => {
  it('차례 → 오늘 안 본 것 → 상한 순서로 좁힌다', () => {
    // 여섯 장이 차례이고 그중 둘은 오늘 이미 봤다. 상한을 먼저 걸면 남은 덱이 3장으로 줄어든다.
    const notes = Array.from({ length: 6 }, (_, i) => note(`n${i}`, { dueOn: TODAY }));
    const reviews = { n0: [review('n0', TODAY)], n1: [review('n1', TODAY)] };
    const deck = todayDeck(notes, reviews, TODAY);
    expect(deck).toHaveLength(4);
    expect(deck.map((c) => c.note.id)).toEqual(['n2', 'n3', 'n4', 'n5']);
  });

  it('상한을 넘지 않는다', () => {
    const notes = Array.from({ length: 12 }, (_, i) => note(`n${i}`, { dueOn: TODAY }));
    expect(todayDeck(notes, {}, TODAY)).toHaveLength(DAILY_CAP);
  });

  it('차례가 아닌 것은 오늘 덱에 없다', () => {
    const notes = [note('a', { dueOn: addDaysISO(TODAY, 2) })];
    expect(todayDeck(notes, {}, TODAY)).toHaveLength(0);
  });
});

describe('범위를 고른 덱', () => {
  it('차례를 보지 않는다 — 시험 직전에 영역만 돌아볼 수 있어야 한다', () => {
    const notes = [
      note('문법1', { area: '문법', dueOn: addDaysISO(TODAY, 20) }),
      note('문학1', { area: '문학', dueOn: TODAY }),
    ];
    expect(scopedDeck(notes, {}, { area: '문법' }, TODAY).map((n) => n.id)).toEqual(['문법1']);
  });

  it('별표만 모은다', () => {
    const notes = [note('a', { starred: true }), note('b')];
    expect(scopedDeck(notes, {}, { onlyStarred: true }, TODAY).map((n) => n.id)).toEqual(['a']);
  });

  it('오늘 이미 본 것은 뺀다 — 눌러도 거부되는 카드를 두지 않는다', () => {
    const notes = [note('a', { starred: true }), note('b', { starred: true })];
    const reviews = { a: [review('a', TODAY)] };
    expect(scopedDeck(notes, reviews, { onlyStarred: true }, TODAY).map((n) => n.id)).toEqual(['b']);
  });

  it('멈춘 문항은 어느 덱에도 오지 않는다 — 서버가 그 노트의 복습을 받지 않는다', () => {
    /*
      예전에는 범위 덱에 넣었는데, 그러면 카드가 열리고 확인은 서버가 거부하며 화면은 그 문항을
      복습시키면서 `지금은 복습 목록에서 쉬고 있어요`라고 말했다. 큐로 돌아오는 문은 오답노트의
      `다시 복습 목록에 넣기` 하나다(0040).
    */
    const notes = [note('멈춤', { area: '문법', state: 'stuck', dueOn: undefined, missStreak: 3 })];
    expect(scopedDeck(notes, {}, { area: '문법' }, TODAY)).toHaveLength(0);
    expect(todayDeck(notes, {}, TODAY)).toHaveLength(0);
  });
});

describe('가장 이른 차례', () => {
  it('담은 날에는 차례가 없고 내일이 첫 차례다', () => {
    // 새로 담은 오답은 서버가 `내일`로 잡는다(틀린 직후 같은 세션 재시험은 근거가 없다).
    const notes = [note('a', { dueOn: addDaysISO(TODAY, 1) })];
    expect(dueCount(notes, TODAY)).toBe(0);
    expect(soonestDueDays(notes, TODAY)).toBe(1);
  });

  it('가장 이른 것을 고른다', () => {
    const notes = [
      note('a', { dueOn: addDaysISO(TODAY, 7) }),
      note('b', { dueOn: addDaysISO(TODAY, 3) }),
      note('c', { state: 'graduated', dueOn: addDaysISO(TODAY, 30), streak: 3 }),
    ];
    expect(soonestDueDays(notes, TODAY)).toBe(3);
  });

  it('밀린 것은 0으로 센다 — 음수를 화면에 넘기지 않는다', () => {
    const notes = [note('a', { dueOn: addDaysISO(TODAY, -9) })];
    expect(soonestDueDays(notes, TODAY)).toBe(0);
  });

  it('쉬고 있는 문항만 있으면 차례가 없다', () => {
    const notes = [note('a', { state: 'stuck', dueOn: undefined, missStreak: 3 })];
    expect(soonestDueDays(notes, TODAY)).toBeNull();
  });

  it('노트가 없으면 차례가 없다', () => {
    expect(soonestDueDays([], TODAY)).toBeNull();
  });
});

describe('화면이 말하는 개수', () => {
  it('상한을 적용한다 — 밀린 개수를 앞세우지 않는다', () => {
    const notes = Array.from({ length: 30 }, (_, i) =>
      note(`n${i}`, { dueOn: addDaysISO(TODAY, -i - 1) }),
    );
    expect(dueCount(notes, TODAY)).toBe(30);
    expect(todayCount(notes, TODAY)).toBe(DAILY_CAP);
  });

  it('상한보다 적으면 그 수를 말한다', () => {
    const notes = [note('a'), note('b')];
    expect(todayCount(notes, TODAY)).toBe(2);
  });

  it('차례가 없으면 0이다', () => {
    expect(todayCount([note('a', { dueOn: addDaysISO(TODAY, 3) })], TODAY)).toBe(0);
  });
});

describe('근거 3택 문구', () => {
  it('지문이 없는 문항에서는 다른 말을 쓴다', () => {
    expect(evidenceLabels(true).passage).toBe('지문에서 근거를 찾았어요');
    expect(evidenceLabels(false).passage).toBe('규칙을 알고 골랐어요');
    expect(evidenceQuestion(true)).toBe('이 답의 근거를 어디서 잡았나요?');
    expect(evidenceQuestion(false)).toBe('어떻게 답을 골랐나요?');
  });

  it('값 공간은 갈리지 않는다 — 스키마를 건드리지 않는다', () => {
    expect(Object.keys(evidenceLabels(true))).toEqual(Object.keys(evidenceLabels(false)));
  });
});
