import { render, screen, fireEvent } from '@testing-library/react-native';
import { SegmentedControl, type SegmentedOption } from '@/components';

/**
 * 프로젝트의 하나뿐인 선택 컨트롤이다(D-077). 여기서 깨지면 필터·폼·보기 전환이 한꺼번에 깨진다.
 * 화면이 기대는 계약만 확인한다 — 개수 표기, 선택 상태, testID 규약.
 */
const ROLES: readonly SegmentedOption<string>[] = [
  { value: '전체', label: '전체', count: 4187 },
  { value: 'student', label: '학생', count: 4100 },
  { value: 'parent', label: '학부모' },
];

describe('SegmentedControl', () => {
  it('count가 있으면 라벨 뒤에 붙고, 없으면 라벨만 남는다', async () => {
    await render(<SegmentedControl options={ROLES} value="전체" onChange={() => {}} />);
    expect(screen.getByText('학생 4100')).toBeTruthy();
    expect(screen.getByText('학부모')).toBeTruthy();
  });

  it('고른 칸만 선택 상태를 말한다 — 색 밖에서도 읽혀야 한다', async () => {
    await render(<SegmentedControl testID="users-role" options={ROLES} value="student" onChange={() => {}} />);
    expect(screen.getByTestId('users-role-student').props.accessibilityState?.selected).toBe(true);
    expect(screen.getByTestId('users-role-전체').props.accessibilityState?.selected).toBe(false);
  });

  it('값이 어느 칸과도 맞지 않으면 아무것도 고르지 않은 상태다', async () => {
    // 대리 보기 사유처럼 처음에는 고른 것이 없는 화면이 있다(app/admin/user/[id].tsx).
    await render(<SegmentedControl testID="r" options={ROLES} value="" onChange={() => {}} />);
    for (const o of ROLES) {
      expect(screen.getByTestId(`r-${o.value}`).props.accessibilityState?.selected).toBe(false);
    }
  });

  it('누르면 그 칸의 value를 넘긴다', async () => {
    const onChange = jest.fn();
    await render(<SegmentedControl testID="users-role" options={ROLES} value="전체" onChange={onChange} />);
    await fireEvent.press(screen.getByTestId('users-role-parent'));
    expect(onChange).toHaveBeenCalledWith('parent');
  });
});
