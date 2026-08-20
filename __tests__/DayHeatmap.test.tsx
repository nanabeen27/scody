import { render, screen } from '@testing-library/react-native';

import { DayHeatmap } from '@/components';
import { STUDY_DAY_QUESTIONS } from '@/features/records';

/**
 * 잔디의 **세 단계를 글로도 말하는지** 고정한다.
 *
 * 중간 단계(손은 댔지만 학습일에 닿지 않은 날)는 예전에 `accentSoft` 면이라 빈 칸과 명도 대비가
 * 1.01:1이었고, 캡션과 `accessibilityLabel`은 그 단계를 아예 말하지 않았다 — 색만으로 뜻을
 * 전하지 않는다는 규칙(§11)이 깨진 자리다. 모양(테두리)은 스타일이라 여기서 세지 않고,
 * **글로 말하는지**를 센다.
 */
function day(n: number, isStudyDay: boolean) {
  return { day: `2026-08-${String(n).padStart(2, '0')}`, gradedQuestions: n, isStudyDay };
}

describe('DayHeatmap', () => {
  it('중간 단계가 있으면 캡션이 두 단계를 다 말한다', async () => {
    await render(
      <DayHeatmap
        studyDayQuestions={STUDY_DAY_QUESTIONS}
        days={[
          { day: '2026-08-01', gradedQuestions: 0, isStudyDay: false },
          { day: '2026-08-02', gradedQuestions: 1, isStudyDay: false },
          { day: '2026-08-03', gradedQuestions: 12, isStudyDay: true },
        ]}
      />,
    );
    expect(
      screen.getByText(
        `8월 1일 ~ 8월 3일 · 진한 칸은 ${STUDY_DAY_QUESTIONS}문항 이상 푼 날, 테두리 칸은 그보다 적게 푼 날이에요`,
      ),
    ).toBeTruthy();
  });

  it('중간 단계가 없으면 그 단계를 말하지 않는다 — 없는 칸을 찾게 만들지 않는다', async () => {
    await render(<DayHeatmap studyDayQuestions={STUDY_DAY_QUESTIONS} days={[day(3, true), day(4, true)]} />);
    expect(
      screen.getByText(
        `8월 3일 ~ 8월 4일 · 진한 칸은 ${STUDY_DAY_QUESTIONS}문항 이상 푼 날이에요`,
      ),
    ).toBeTruthy();
  });

  it('스크린리더 문장에 중간 단계 일수를 함께 담는다', async () => {
    await render(
      <DayHeatmap
        studyDayQuestions={STUDY_DAY_QUESTIONS}
        days={[
          { day: '2026-08-01', gradedQuestions: 1, isStudyDay: false },
          { day: '2026-08-02', gradedQuestions: 2, isStudyDay: false },
          { day: '2026-08-03', gradedQuestions: 12, isStudyDay: true },
        ]}
      />,
    );
    expect(
      screen.getByLabelText(
        `최근 3일 중 1일 공부했어요. 2일은 ${STUDY_DAY_QUESTIONS}문항에 닿지 않았어요.`,
      ),
    ).toBeTruthy();
  });

  it('중간 단계가 0이면 그 수를 말하지 않는다 — 뜻 없는 수치를 남기지 않는다', async () => {
    await render(<DayHeatmap studyDayQuestions={STUDY_DAY_QUESTIONS} days={[day(3, true), day(4, true)]} />);
    expect(screen.getByLabelText('최근 2일 중 2일 공부했어요.')).toBeTruthy();
  });
});
