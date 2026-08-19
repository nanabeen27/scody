import { formatDuration } from '@/features/learning';

/*
  소요 시간 표시.

  **세 화면이 같은 값을 같은 형식으로 말해야 한다**(학부모 리포트 · 자세히 보기 · 학습 상세).
  예전에는 화면마다 `fmtTime`을 따로 두었고 그중 하나만 시간 분기가 없어서, 같은 4,512초가
  `자세히 보기`에서는 `1시간 15분`, 그 학습 상세에서는 `75분 12초`였다. 학부모가 두 화면을
  오가며 같은 사실을 두 번 계산해야 했다.
*/
describe('소요 시간 표시', () => {
  it('한 시간을 넘기면 시간과 분으로 접는다', () => {
    expect(formatDuration(4512)).toBe('1시간 15분');
    expect(formatDuration(3600)).toBe('1시간 0분');
    expect(formatDuration(7325)).toBe('2시간 2분');
  });

  it('한 시간 미만은 분과 초로 말한다', () => {
    expect(formatDuration(3599)).toBe('59분 59초');
    expect(formatDuration(723)).toBe('12분 3초');
    expect(formatDuration(60)).toBe('1분 0초');
  });

  it('1분 미만은 초만 말한다', () => {
    expect(formatDuration(48)).toBe('48초');
    expect(formatDuration(0)).toBe('0초');
  });
});
