import { sparkLabel } from '@/components/Sparkline';

/**
 * `sparkLabel`은 **스크린리더에게만 보이는 문장**이라 화면을 봐도 틀린 것을 알 수 없다.
 * 두 번 틀렸던 자리라 여기서 고정한다 — 마지막 점을 `지금`이라 부른 것과,
 * 점 단위를 `주`로 못박아 회차 추이를 `주`로 읽은 것.
 */
describe('sparkLabel', () => {
  it('마지막 점을 `지금`이라고 부르지 않는다 — 끝난 주까지만 그리므로 지난주 값이다', () => {
    const text = sparkLabel('제출률', [70, 80, 75], '%');
    expect(text).toContain('마지막 75%');
    expect(text).not.toContain('지금');
  });

  it('점 하나가 무엇인지 호출부가 정한다 — 회차 추이를 주로 읽지 않는다', () => {
    expect(sparkLabel('정답률', [40, 90], '%')).toContain('최근 2주 추이');
    expect(sparkLabel('정답률', [40, 90], '%', '번')).toContain('최근 2번 추이');
  });

  it('가장 낮은 값과 가장 높은 값을 함께 읽는다', () => {
    const text = sparkLabel('활동일 수', [3, 1, 7], '일');
    expect(text).toContain('가장 낮은 1일');
    expect(text).toContain('가장 높은 7일');
  });

  it('점이 없으면 추이가 없다고 말한다', () => {
    expect(sparkLabel('제출률', [], '%')).toBe('제출률 추이 없음');
  });

  it('천 단위를 끊어 읽는다', () => {
    expect(sparkLabel('학습자', [1204, 2573], '명')).toContain('가장 높은 2,573명');
  });
});
