import { rankRecommendations, type Candidate, type WeakSignal } from '../src/features/recommend';
import type { LearningItem } from '../src/data';

function item(id: string, title: string, area: LearningItem['area']): LearningItem {
  return {
    id,
    source: 'personal',
    subject: '국어',
    area,
    title,
    contentId: `c_${id}`,
    questionCount: 10,
    status: 'todo',
  };
}

const 음운: Candidate = {
  item: item('a', '음운의 변동 심화', '문법'),
  area: '문법',
  topic: '음운의 변동',
  grade: 1,
};
const 맞춤법: Candidate = {
  item: item('b', '맞춤법 점검', '문법'),
  area: '문법',
  topic: '어문 규정 - 맞춤법',
  grade: 1,
};
const 현대소설: Candidate = {
  item: item('c', '현대소설 독해', '문학'),
  area: '문학',
  topic: '현대소설',
  grade: 2,
};

describe('rankRecommendations', () => {
  it('오답이 없으면 추천하지 않는다', () => {
    expect(rankRecommendations([음운, 맞춤법], [])).toEqual([]);
  });

  it('같은 세부 유형을 같은 영역보다 먼저 추천한다', () => {
    const signals: WeakSignal[] = [{ area: '문법', topic: '음운의 변동', grade: 1 }];
    const out = rankRecommendations([맞춤법, 음운], signals);
    expect(out[0].item.id).toBe('a');
    expect(out[0].reason).toBe('문법 · 음운의 변동에서 1문항 틀렸어요');
    // 같은 영역이라 맞춤법도 후보에는 남는다
    expect(out.map((r) => r.item.id)).toContain('b');
  });

  it('관련 없는 영역은 추천하지 않는다', () => {
    const out = rankRecommendations([음운, 현대소설], [{ area: '문법', topic: '음운의 변동' }]);
    expect(out.map((r) => r.item.id)).not.toContain('c');
  });

  it('같은 유형 오답이 많을수록 앞에 온다', () => {
    const signals: WeakSignal[] = [
      { area: '문법', topic: '어문 규정 - 맞춤법' },
      { area: '문법', topic: '어문 규정 - 맞춤법' },
      { area: '문법', topic: '음운의 변동' },
    ];
    const out = rankRecommendations([음운, 맞춤법], signals);
    expect(out[0].item.id).toBe('b');
    expect(out[0].matched).toBe(2);
    expect(out[0].reason).toBe('문법 · 어문 규정 - 맞춤법에서 2문항 틀렸어요');
  });

  it('별표한 오답은 두 배로 본다', () => {
    const signals: WeakSignal[] = [
      { area: '문법', topic: '음운의 변동', starred: true },
      { area: '문법', topic: '어문 규정 - 맞춤법' },
    ];
    const out = rankRecommendations([맞춤법, 음운], signals);
    expect(out[0].item.id).toBe('a');
  });

  it('limit보다 많이 돌려주지 않는다', () => {
    const out = rankRecommendations([음운, 맞춤법], [{ area: '문법' }], 1);
    expect(out).toHaveLength(1);
  });

  it('세부 유형 정보가 없으면 영역 기준으로만 추천한다', () => {
    const noTopic: Candidate = { item: item('d', '문법 종합', '문법'), area: '문법' };
    const out = rankRecommendations([noTopic], [{ area: '문법', topic: '음운의 변동' }]);
    expect(out[0].reason).toBe('문법에서 1문항 틀렸어요');
  });
});
