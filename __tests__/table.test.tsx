import { render, screen, fireEvent } from '@testing-library/react-native';
import { useState } from 'react';
import { AppText, Pager, Table, SourceBadge, useTableSort, type Column } from '@/components';

/**
 * 뷰포트를 갈아 끼운다. `useResponsive`가 쓰는 `useWindowDimensions`를 바꿔
 * 분기점(720 · 1024)을 실제로 지나게 한다 — 화면 코드와 같은 규칙을 확인하기 위해서다.
 * (jest 모듈 팩토리는 `mock`으로 시작하는 변수만 참조할 수 있다.)
 */
let mockWidth = 1280;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 900, scale: 1, fontScale: 1 }),
}));

interface Cell {
  name: string;
  value: number;
  note: string;
}

const ROWS: readonly Cell[] = [
  { name: '가', value: 3, note: '메모 가' },
  { name: '나', value: 1, note: '메모 나' },
  { name: '다', value: 2, note: '메모 다' },
];

/** 열 구성은 운영자 표와 같은 모양이다: 이름은 flex, 숫자는 오른쪽 정렬, 출처는 노드 셀. */
const COLUMNS: readonly Column<Cell>[] = [
  { key: 'name', header: '이름', cell: (r) => r.name },
  {
    key: 'value',
    header: '값',
    width: 110,
    align: 'right',
    // 오름차순으로 정의한다. 내림차순은 표가 뒤집는다.
    sort: (a, b) => a.value - b.value,
    cell: (r) => `${r.value}`,
  },
  { key: 'note', header: '메모', width: 78, priority: 2, cell: (r) => r.note },
  { key: 'src', header: '출처', width: 56, priority: 3, cell: () => <SourceBadge source="실측" /> },
];

function names() {
  return screen.getAllByText(/^[가나다]$/).map((n) => n.props.children);
}

async function renderTable(extra?: Partial<React.ComponentProps<typeof Table<Cell>>>) {
  return render(
    <Table
      testID="t"
      columns={COLUMNS}
      rows={ROWS}
      rowKey={(r) => r.name}
      empty={{ title: '없어요' }}
      {...extra}
    />,
  );
}

describe('Table 열 접기', () => {
  it('데스크톱은 모든 열을 그린다', async () => {
    mockWidth = 1280;
    await renderTable();
    for (const header of ['이름', '값', '메모', '출처']) {
      expect(screen.getByText(header)).toBeTruthy();
    }
  });

  /*
    **`priority`는 분기점 등급이 아니라 폭이 모자랄 때 포기하는 순서다.**
    예전에는 태블릿이면 무조건 3을 접었는데, 그러면 자리가 남아도 열이 사라졌다.
  */
  it('들어가면 접지 않는다', async () => {
    mockWidth = 820;
    await renderTable();
    // 네 열이 356px이면 되고 컬럼은 그보다 넓다 — 포기할 이유가 없다.
    for (const header of ['이름', '값', '메모', '출처']) {
      expect(screen.getByText(header)).toBeTruthy();
    }
  });

  it('모자라면 우선순위가 낮은 열부터 포기한다', async () => {
    mockWidth = 620;
    await renderTable({
      columns: COLUMNS.map((c) => (c.key === 'name' ? { ...c, width: 420 } : c)),
    });
    expect(screen.getByText('값')).toBeTruthy();
    expect(screen.queryByText('출처')).toBeNull();
  });

  /*
    좁은 화면에서는 **열을 하나도 버리지 않고 쌓는다.** 접기는 덜 중요한 열을 지우는 도구인데
    이 앱의 표들은 접으면 비교 대상이 지워졌다(반별 현황의 담당·학생·정답률, 마감 표의 반 이름).
  */
  it('좁으면 열을 버리지 않고 쌓는다', async () => {
    mockWidth = 390;
    await renderTable();
    // 제목은 첫 열이 맡고, 나머지는 `라벨 + 값` 쌍으로 전부 남는다.
    expect(screen.getByText('가')).toBeTruthy();
    // 라벨은 레코드마다 한 번씩(3행). `값`은 정렬 줄에도 있어 4개다.
    expect(screen.getAllByText('메모')).toHaveLength(ROWS.length);
    expect(screen.getAllByText('출처')).toHaveLength(ROWS.length);
    expect(screen.getAllByText('값')).toHaveLength(ROWS.length + 1);
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('메모 가')).toBeTruthy();
  });

  it('쌓아도 정렬은 남는다 — 헤더가 없어 위쪽 줄로 옮긴다', async () => {
    mockWidth = 390;
    await renderTable();
    expect(screen.getByLabelText('값 기준으로 정렬')).toBeTruthy();
  });
});

describe('Table 정렬', () => {
  it('첫 클릭은 오름차순, 다시 누르면 내림차순이다', async () => {
    mockWidth = 1280;
    await renderTable();
    expect(names()).toEqual(['가', '나', '다']);

    await fireEvent.press(screen.getByLabelText('값 기준으로 정렬'));
    expect(names()).toEqual(['나', '다', '가']);

    await fireEvent.press(screen.getByLabelText('값 오름차순 정렬 중, 내림차순으로 바꾸기'));
    expect(names()).toEqual(['가', '다', '나']);
    expect(screen.getByLabelText('값 내림차순 정렬 중, 오름차순으로 바꾸기')).toBeTruthy();
  });

  it('정렬 중인 열은 색 밖에서도 말한다', async () => {
    mockWidth = 1280;
    await renderTable();
    const head = screen.getByLabelText('값 기준으로 정렬');
    expect(head.props.accessibilityState?.selected).toBe(false);

    await fireEvent.press(head);
    const active = screen.getByLabelText('값 오름차순 정렬 중, 내림차순으로 바꾸기');
    expect(active.props.accessibilityState?.selected).toBe(true);
  });

  it('정렬할 수 없는 열은 헤더가 버튼이 아니다', async () => {
    mockWidth = 1280;
    await renderTable();
    expect(screen.queryByLabelText('이름 기준으로 정렬')).toBeNull();
  });
});

describe('Table 스크린리더 라벨', () => {
  it('rowLabel이 없으면 노드 셀도 열 이름을 읽는다', async () => {
    mockWidth = 1280;
    await renderTable();
    // 값을 꺼낼 수 없다는 사실을 남긴다 — 조용히 빼면 빠진 열이 있는 줄도 모른다.
    expect(screen.getByLabelText('이름 가, 값 3, 메모 메모 가, 출처 (값을 읽을 수 없음)')).toBeTruthy();
  });

  it('rowLabel을 주면 그 문장만 읽는다', async () => {
    mockWidth = 1280;
    await renderTable({ rowLabel: (r) => `${r.name} 값 ${r.value}` });
    expect(screen.getByLabelText('가 값 3')).toBeTruthy();
    expect(screen.queryByLabelText(/값을 읽을 수 없음/)).toBeNull();
  });
});

/**
 * 상태는 `aria-expanded`·`aria-selected`로 준다(react-native-web이 `accessibilityState`를
 * DOM으로 옮기지 않는다). `View`가 그 값을 다시 `accessibilityState`로 내려 주므로
 * 여기서는 내려온 값을 확인한다 — 두 플랫폼이 같은 상태를 말하는지 보는 것이다.
 */
describe('Table 펼치기', () => {
  it('펼친 상태를 상태 값으로 말하고 내용을 보여 준다', async () => {
    mockWidth = 1280;
    await renderTable({
      rowLabel: (r) => `${r.name} 행`,
      expand: (r) => <AppText>{`${r.name} 자세히`}</AppText>,
    });

    const row = screen.getByLabelText('가 행');
    expect(row.props.accessibilityState?.expanded).toBe(false);
    expect(screen.queryByText('가 자세히')).toBeNull();

    await fireEvent.press(row);
    expect(screen.getByText('가 자세히')).toBeTruthy();
    expect(screen.getByLabelText('가 행').props.accessibilityState?.expanded).toBe(true);

    // 한 번에 하나만 열린다. 다른 행을 누르면 먼저 열린 것이 닫힌다.
    await fireEvent.press(screen.getByLabelText('나 행'));
    expect(screen.queryByText('가 자세히')).toBeNull();
    expect(screen.getByText('나 자세히')).toBeTruthy();
  });

  it('펼침이 없는 표는 expanded 상태를 말하지 않는다', async () => {
    mockWidth = 1280;
    await renderTable({ rowLabel: (r) => `${r.name} 행`, onRowPress: () => {} });
    expect(screen.getByLabelText('가 행').props.accessibilityState?.expanded).toBeUndefined();
  });
});

/**
 * 화면이 정렬을 쥐는 경우(A-050). 목록이 페이지보다 길 때 **표에 넘긴 페이지 안에서만**
 * 정렬되면 화면이 약속한 `열 이름을 누르면 다시 정렬해요`가 거짓이 된다.
 */
const PAGE = 2;
const COMPARE = { value: (a: Cell, b: Cell) => a.value - b.value };

function Paged() {
  const [page, setPage] = useState(0);
  const sorted = useTableSort(ROWS, COMPARE, () => setPage(0));
  const shown = sorted.rows.slice(page * PAGE, (page + 1) * PAGE);
  return (
    <>
      <Table
        testID="paged"
        columns={COLUMNS}
        rows={shown}
        {...sorted.props}
        rowKey={(r) => r.name}
        rowLabel={(r) => `${r.name} ${r.value}`}
        empty={{ title: '없어요' }}
      />
      <Pager testID="paged-pager" total={ROWS.length} page={page} pageSize={PAGE} onChange={setPage} />
    </>
  );
}

describe('useTableSort', () => {
  beforeEach(() => {
    mockWidth = 1280;
  });

  it('페이지 밖의 행까지 함께 줄 세운다', async () => {
    await render(<Paged />);
    // 기본 순서는 가(3) · 나(1) — 첫 페이지에 3이 있다.
    expect(screen.getByLabelText('가 3')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('값 기준으로 정렬'));
    // 오름차순이면 가장 작은 나(1)·다(2)가 첫 페이지로 온다. 가(3)는 다음 페이지로 밀린다.
    expect(screen.getByLabelText('나 1')).toBeTruthy();
    expect(screen.getByLabelText('다 2')).toBeTruthy();
    expect(screen.queryByLabelText('가 3')).toBeNull();
  });

  it('정렬을 바꾸면 첫 페이지로 되돌린다', async () => {
    await render(<Paged />);
    await fireEvent.press(screen.getByTestId('paged-pager-next'));
    // 2페이지는 다(2) 하나다.
    expect(screen.getByLabelText('다 2')).toBeTruthy();
    expect(screen.queryByLabelText('가 3')).toBeNull();

    await fireEvent.press(screen.getByLabelText('값 기준으로 정렬'));
    // 3개 중 1–2로 돌아왔다.
    expect(screen.getByLabelText('나 1')).toBeTruthy();
  });
});
