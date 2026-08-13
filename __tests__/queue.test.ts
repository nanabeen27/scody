import { moveQueueEntry, restoreQueueEntries, type QueueEntry } from '@/features/progress';

const list: QueueEntry[] = [
  { itemId: 'a', contentId: 'ct_a' },
  { itemId: 'b', contentId: 'ct_b' },
  { itemId: 'c', contentId: 'ct_c' },
];
const ids = (l: readonly QueueEntry[]) => l.map((q) => q.itemId).join(',');

describe('moveQueueEntry', () => {
  it('가운데 항목을 위로 올린다', () => {
    expect(ids(moveQueueEntry(list, 'b', 'up'))).toBe('b,a,c');
  });

  it('가운데 항목을 아래로 내린다', () => {
    expect(ids(moveQueueEntry(list, 'b', 'down'))).toBe('a,c,b');
  });

  it('맨 위에서 위로는 그대로 둔다', () => {
    expect(ids(moveQueueEntry(list, 'a', 'up'))).toBe('a,b,c');
  });

  it('맨 아래에서 아래로는 그대로 둔다', () => {
    expect(ids(moveQueueEntry(list, 'c', 'down'))).toBe('a,b,c');
  });

  it('없는 학습이면 그대로 둔다', () => {
    expect(ids(moveQueueEntry(list, 'zzz', 'up'))).toBe('a,b,c');
  });

  it('원래 배열을 바꾸지 않는다', () => {
    moveQueueEntry(list, 'b', 'up');
    expect(ids(list)).toBe('a,b,c');
  });

  it('한 개짜리 목록도 안전하다', () => {
    const one: QueueEntry[] = [{ itemId: 'a', contentId: 'ct_a' }];
    expect(ids(moveQueueEntry(one, 'a', 'down'))).toBe('a');
    expect(ids(moveQueueEntry(one, 'a', 'up'))).toBe('a');
  });

  /*
    공개가 끝난 학습은 화면에서 빠지므로(`useQueuedItems`) 담긴 순서와 보이는 순서가 어긋난다.
    그때 바로 옆 칸과 바꾸면 보이지 않는 칸과 자리를 맞바꿔 **화면에서는 아무 일도 없었다** —
    학생에게는 순서 바꾸기 버튼이 죽은 것으로 보인다.
  */
  it('보이지 않는 칸은 건너뛰고 보이는 칸끼리 바꾼다', () => {
    // 'a'가 공개가 끝나 화면에는 b, c만 있다.
    expect(ids(moveQueueEntry(list, 'b', 'up', ['b', 'c']))).toBe('a,b,c');
    expect(ids(moveQueueEntry(list, 'c', 'up', ['b', 'c']))).toBe('a,c,b');
  });

  it('보이는 칸이 옆에 없으면 그대로 둔다', () => {
    // 'b'만 보인다 — 위로도 아래로도 바꿀 상대가 없다.
    expect(ids(moveQueueEntry(list, 'b', 'up', ['b']))).toBe('a,b,c');
    expect(ids(moveQueueEntry(list, 'b', 'down', ['b']))).toBe('a,b,c');
  });

  it('가운데가 빠져 있으면 그 칸을 건너뛰어 바꾼다', () => {
    const four: QueueEntry[] = [...list, { itemId: 'd', contentId: 'ct_d' }];
    // 'b'가 안 보인다: 화면은 a, c, d다. a를 내리면 c와 바뀐다.
    expect(ids(moveQueueEntry(four, 'a', 'down', ['a', 'c', 'd']))).toBe('c,b,a,d');
  });
});

describe('restoreQueueEntries', () => {
  it('가운데에서 뺀 학습을 원래 자리로 되돌린다', () => {
    const after: QueueEntry[] = [list[0], list[2]];
    expect(ids(restoreQueueEntries(after, [{ entry: list[1], index: 1 }]))).toBe('a,b,c');
  });

  it('맨 앞에서 뺀 학습도 맨 앞으로 돌아온다', () => {
    const after: QueueEntry[] = [list[1], list[2]];
    expect(ids(restoreQueueEntries(after, [{ entry: list[0], index: 0 }]))).toBe('a,b,c');
  });

  it('여러 개를 함께 되돌리면 원래 순서가 그대로 살아난다', () => {
    const after: QueueEntry[] = [list[1]];
    const removals = [
      { entry: list[2], index: 2 },
      { entry: list[0], index: 0 },
    ];
    expect(ids(restoreQueueEntries(after, removals))).toBe('a,b,c');
  });

  it('전부 뺐다가 전부 되돌린다', () => {
    const removals = list.map((entry, index) => ({ entry, index }));
    expect(ids(restoreQueueEntries([], removals))).toBe('a,b,c');
  });

  it('이미 목록에 있는 학습은 두 번 넣지 않는다', () => {
    expect(ids(restoreQueueEntries(list, [{ entry: list[1], index: 1 }]))).toBe('a,b,c');
  });

  it('목록이 짧아졌으면 맨 뒤에 붙인다', () => {
    expect(ids(restoreQueueEntries([list[0]], [{ entry: list[2], index: 9 }]))).toBe('a,c');
  });

  it('되돌릴 것이 없으면 그대로 둔다', () => {
    expect(ids(restoreQueueEntries(list, []))).toBe('a,b,c');
  });

  it('원래 배열을 바꾸지 않는다', () => {
    const after: QueueEntry[] = [list[0], list[2]];
    restoreQueueEntries(after, [{ entry: list[1], index: 1 }]);
    expect(ids(after)).toBe('a,c');
  });
});
