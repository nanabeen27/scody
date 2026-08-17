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

  /*
    상태를 `selected`에서 `checked`로 옮겼다. 역할이 `button`이던 동안 `aria-selected`를 주고
    있었는데 그 조합은 보조기술이 무시한다 — 이제 역할이 `radio`이고 상태가 `aria-checked`다.
    확인하는 것은 그대로다: **고른 칸만 선택 상태를 말한다.**
  */
  it('고른 칸만 선택 상태를 말한다 — 색 밖에서도 읽혀야 한다', async () => {
    await render(<SegmentedControl testID="users-role" options={ROLES} value="student" onChange={() => {}} />);
    expect(screen.getByTestId('users-role-student').props.accessibilityState?.checked).toBe(true);
    expect(screen.getByTestId('users-role-전체').props.accessibilityState?.checked).toBe(false);
  });

  /*
    묶음(`radiogroup`)은 여기서 확인하지 않는다 — RNTL의 `getByRole`은 `accessible`한 요소만
    찾는데, 트랙에 `accessible`을 주면 **네이티브에서 칸 셋이 하나로 합쳐져** 각 칸을 고를 수
    없게 된다. 트랙의 역할은 웹에서 확인했다(`[role="radiogroup"]` 1개).
  */
  it('칸마다 하나씩 고르는 컨트롤로 읽힌다', async () => {
    await render(<SegmentedControl testID="r" options={ROLES} value="student" onChange={() => {}} />);
    expect(screen.getAllByRole('radio')).toHaveLength(ROLES.length);
  });

  it('값이 어느 칸과도 맞지 않으면 아무것도 고르지 않은 상태다', async () => {
    // 대리 보기 사유처럼 처음에는 고른 것이 없는 화면이 있다(app/admin/user/[id].tsx).
    await render(<SegmentedControl testID="r" options={ROLES} value="" onChange={() => {}} />);
    for (const o of ROLES) {
      expect(screen.getByTestId(`r-${o.value}`).props.accessibilityState?.checked).toBe(false);
    }
  });

  it('누르면 그 칸의 value를 넘긴다', async () => {
    const onChange = jest.fn();
    await render(<SegmentedControl testID="users-role" options={ROLES} value="전체" onChange={onChange} />);
    await fireEvent.press(screen.getByTestId('users-role-parent'));
    expect(onChange).toHaveBeenCalledWith('parent');
  });
});
