import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { AppText } from './AppText';
import { EmptyState } from './EmptyState';
import { Icon } from './Icon';
import {
  columnBreakpoints,
  colors,
  font,
  radius,
  spacing,
  touch,
  typeface,
} from '@/theme/tokens';
import { useColumn } from '@/theme/useColumn';

/**
 * 밀집 표.
 *
 * **왜 새로 만드나**: 운영자 화면은 여러 지표를 나란히 비교하는 곳이고, 비교되는 값은
 * 같은 x좌표에 서야 읽힌다. `Group`+`Row`로는 그게 안 된다 —
 * ① `Row`에 열 폭 개념이 없어(`main`이 `flex:1`) 값이 행마다 다른 위치에 온다.
 * ② 슬롯이 `title`·`subtitle`·`meta` 셋뿐이라 8열을 담을 수 없고, 지금은 `제출률 67% · 좌석 24명`
 *    처럼 `·`로 이어 붙이고 있다.
 * ③ `Row.meta`는 `inkTertiary`(대비 3.23:1, AA 미달)여서 **값이 화면에서 가장 흐린 글자**다.
 * ④ `minHeight:56`이라 20행이 1,120px이 된다.
 * ⑤ 헤더 행이 없어 정렬·단위 표기·스크린리더의 열 관계를 만들 수 없다.
 *
 * 카드를 쓰지 않는다: 테두리·라운드·배경 없이 행 사이 hairline만 둔다.
 */

export interface Column<T> {
  key: string;
  header: string;
  /** 문자열이면 표가 그린다. 노드를 주면 그대로 넣는다(추이선·막대). */
  cell: (row: T) => string | ReactNode;
  /** 고정 폭(px). 없으면 남는 폭을 나눈다. */
  width?: number;
  /** 숫자 열은 오른쪽 정렬 + 등폭. 자릿수 선이 맞아야 눈으로 비교된다. */
  align?: 'left' | 'right';
  /**
   * 주면 헤더를 눌러 정렬한다. 정렬 칩을 따로 두지 않아도 된다.
   *
   * **오름차순으로 정의한다**(`(a, b) => a.x - b.x`). **내림차순은 표가 뒤집는다** —
   * 같은 헤더를 한 번 더 누르면 결과를 뒤집고 화살표를 `arrow-down`으로 바꾼다.
   * 비교 함수를 `b - a`로 주면 첫 클릭이 내림차순인데 화살표는 오름차순을 말한다.
   */
  sort?: (a: T, b: T) => number;
  /**
   * **폭이 모자랄 때 포기하는 순서다. 분기점 등급이 아니다.**
   * 표는 지금 컬럼 폭에서 들어가는 만큼 보여 주고, 안 들어갈 때만 3 → 2 순으로 포기한다.
   *
   * **네 검사 중 하나에 걸리면 `1`이다 — 어떤 폭에서도 포기하지 않는다.**
   * ① 표 위 캡션이나 섹션 제목이 그 열을 언급하는가
   * ② 기본 정렬 기준인가
   * ③ 그 값이 없으면 이 행이 무엇에 대한 것인지 모르는가
   * ④ 그 값을 보고 다음에 할 일이 갈리는가
   *
   * `1`인 열이 절반을 넘으면 표가 아니라 화면 설계 문제다 — 열을 줄이거나 화면을 나눈다.
   */
  priority?: 1 | 2 | 3;
}

export interface TableProps<T> {
  columns: readonly Column<T>[];
  /**
   * 보여 줄 행.
   *
   * **페이지 슬라이스를 넘기면 정렬이 그 페이지 안에서만 일어난다** — 헤더 정렬은 받은 배열만
   * 다시 줄 세운다. 전체를 줄 세우려면 호출부가 정렬 상태를 갖고 페이지를 잘라야 한다(A-050).
   */
  rows: readonly T[];
  rowKey: (row: T) => string;
  /** 행을 누를 수 있으면 행 높이가 터치 기준(48)으로 커진다. */
  onRowPress?: (row: T) => void;
  /**
   * 스크린리더가 읽을 문장. 없으면 `열이름 값` 쌍을 조립한다.
   *
   * **노드를 반환하는 열이 있으면 반드시 준다 — 조립 라벨은 노드를 읽지 못한다.**
   * 조립할 때 노드 셀은 `열이름 (값을 읽을 수 없음)`으로만 적힌다(빠진 열이 있다는 사실 자체가
   * 정보라서 조용히 빼지 않는다). 추이선·출처 배지·색이 들어간 값은 전부 노드다.
   */
  rowLabel?: (row: T) => string;
  /** 행 아래에 펼칠 내용. 있으면 행을 눌러 접고 펼친다(한 번에 하나). */
  expand?: (row: T) => ReactNode;
  /** 합계 행. 열 key → 문자열. */
  footer?: Record<string, string>;
  empty: { title: string; subtitle?: string };
  /**
   * 컬럼이 `columnBreakpoints.tablet`(560)보다 좁을 때의 처리.
   *
   * - `'stack'`(기본) — 행 하나를 `제목 줄 + 라벨/값 줄`로 쌓는다. **열이 하나도 사라지지
   *   않고** 가로로 밀 것도 없다. 라벨이 고정 폭이라 값의 왼쪽 선은 레코드 사이에서 맞는다.
   * - `'scroll'` — 표 모양을 지키고 표 안에서 가로로 민다. **행과 열이 모두 같은 종류의
   *   축인 행렬에만**(코호트 = 가입주 × 경과주). 쌓으면 12행 × 9열이 108줄이 된다.
   */
  narrow?: 'stack' | 'scroll';
  /**
   * 정렬을 호출부가 쥔다(선택). `sort`와 함께 주면 표는 스스로 줄 세우지 않고 헤더 클릭만
   * 알려 준다 — 화살표는 이 값이 정한다.
   *
   * **왜 필요한가**: 위 `rows` 설명대로 페이지 슬라이스를 넘기면 정렬이 그 페이지 안에서만
   * 일어난다(A-050). 반 122개·학생 3,000명 목록에 헤더 정렬을 붙이면 화면이 거짓말을 한다.
   * 호출부가 전체를 줄 세운 뒤 잘라 넘기면 그 문제가 사라진다.
   * 세 값을 다 주지 않으면 지금까지처럼 표가 스스로 정렬한다.
   */
  sortKey?: string | null;
  sortDesc?: boolean;
  onSortChange?: (key: string, desc: boolean) => void;
  testID?: string;
}

/** 화면이 쥔 정렬 상태와, `Table`에 그대로 펼쳐 넘길 props. */
export interface TableSort<T> {
  /** **전체를 줄 세운 결과.** 여기서 페이지를 자른다. */
  rows: T[];
  props: Pick<TableProps<T>, 'sortKey' | 'sortDesc' | 'onSortChange'>;
}

/**
 * 표에 **페이지 슬라이스를 넘길 때** 쓰는 정렬 훅.
 *
 * `Table`이 스스로 정렬하면 받은 배열, 즉 그 페이지 안에서만 줄이 바뀐다(A-050) — 목록이
 * 122개인데 20개씩 자르면 화면이 약속한 `열 이름을 누르면 다시 정렬해요`가 거짓이 된다.
 * 호출부가 전체를 줄 세운 뒤 잘라 넘기면 그 문제가 사라진다.
 *
 * **`compare`는 컬럼의 `sort`와 같은 것을 쓴다** — 호출부가 맵을 한 번 정의하고
 * `sort: COMPARE.rate`처럼 컬럼에서 그 값을 가리키면 규칙이 두 벌이 되지 않는다.
 * 컬럼 배열을 그대로 받지 않는 이유는 순서 때문이다: 컬럼 셀이 이 훅의 결과(현재 페이지)를
 * 참조하는 화면이 있어, 컬럼을 먼저 만들면 순환이 된다.
 *
 * 비교 함수는 **오름차순으로 정의한다** — 내림차순은 여기서 뒤집고 표가 화살표를 맞춘다.
 * 키가 없으면 넘겨받은 순서를 그대로 둔다(기본 정렬은 호출부 몫).
 * `onChange`는 보통 페이지를 처음으로 되돌리는 데 쓴다 — 3페이지에서 정렬을 바꾸면 보고 있던
 * 행이 어디로 갔는지 알 수 없다.
 */
export function useTableSort<T>(
  rows: readonly T[],
  compare: Readonly<Record<string, (a: T, b: T) => number>>,
  onChange?: () => void,
): TableSort<T> {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDesc, setSortDesc] = useState(false);

  const cmp = sortKey ? compare[sortKey] : undefined;
  const sorted = useMemo(() => {
    if (!cmp) return [...rows];
    const out = [...rows].sort(cmp);
    return sortDesc ? out.reverse() : out;
  }, [rows, cmp, sortDesc]);

  const onSortChange = useCallback(
    (key: string, desc: boolean) => {
      setSortKey(key);
      setSortDesc(desc);
      onChange?.();
    },
    [onChange],
  );

  return { rows: sorted, props: { sortKey, sortDesc, onSortChange } };
}

/** 열 폭이 없을 때 나눠 갖는 최소 폭. */
const FLEX_MIN = 88;
/** 펼침 표시가 쓰는 열 폭. */
const EXPAND_W = 16;
/** 펼친 내용을 첫 열 아래로 들여쓸 때의 상한. 첫 열이 더 넓어도 여기까지만 민다. */
const EXPAND_INDENT_MAX = 132;

/** 지금 보이는 열이 실제로 필요한 폭. `minWidth`의 상한으로 쓴다. */
function neededWidth<T>(cols: readonly Column<T>[], hasExpand: boolean): number {
  const widths = cols.map((c) => c.width ?? FLEX_MIN);
  if (hasExpand) widths.push(EXPAND_W);
  const gaps = Math.max(widths.length - 1, 0) * spacing.sm;
  return widths.reduce((n, w) => n + w, 0) + gaps;
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  onRowPress,
  rowLabel,
  expand,
  footer,
  empty,
  narrow = 'stack',
  sortKey: sortKeyProp,
  sortDesc,
  onSortChange,
  testID,
}: TableProps<T>) {
  const { width: colW } = useColumn();
  const [ownKey, setOwnKey] = useState<string | null>(null);
  const [ownDesc, setOwnDesc] = useState(false);
  /** 호출부가 정렬을 쥐고 있는가. 그러면 표는 순서를 바꾸지 않고 화살표만 그린다. */
  const controlled = onSortChange != null;
  const sortKey = controlled ? (sortKeyProp ?? null) : ownKey;
  const desc = controlled ? !!sortDesc : ownDesc;
  const [open, setOpen] = useState<string | null>(null);

  /*
    **분기점이 아니라 맞춤이다.** 지금 컬럼 폭에서 들어가는 만큼 보여 주고, 안 들어갈 때만
    3 → 2 순으로 포기한다. 예전에는 분기점 판단과 맞춤 판단을 서로 다른 폭 개념으로 두 번 해서
    두 가지가 동시에 어긋났다 — 1100px 창은 680 컬럼인데 "데스크톱"이라 열을 다 펴고 스스로
    가로 스크롤했고, 390에서는 자리가 있어도 무조건 접었다.

    컬럼이 `tablet`(560)보다 좁으면 표 모양을 포기하고 `narrow`가 정한 방식으로 간다.
  */
  const tooNarrow = colW > 0 && colW < columnBreakpoints.tablet;
  const stacking = tooNarrow && narrow === 'stack';
  const fit = (() => {
    if (colW <= 0) return { maxPriority: 3 as const, overflow: false };
    for (const p of [3, 2, 1] as const) {
      const cols = columns.filter((c) => (c.priority ?? 1) <= p);
      if (neededWidth(cols, !!expand) <= colW) return { maxPriority: p, overflow: false };
    }
    return { maxPriority: 1 as const, overflow: true };
  })();
  const shown = stacking ? columns : columns.filter((c) => (c.priority ?? 1) <= fit.maxPriority);

  const sorted = (() => {
    if (controlled) return rows; // 호출부가 이미 줄 세워 넘겼다.
    const col = shown.find((c) => c.key === sortKey);
    if (!col?.sort) return rows;
    const out = [...rows].sort(col.sort);
    return desc ? out.reverse() : out;
  })();

  function toggleSort(col: Column<T>) {
    if (!col.sort) return;
    const next = sortKey === col.key ? !desc : false;
    if (controlled) {
      onSortChange(col.key, next);
      return;
    }
    setOwnKey(col.key);
    setOwnDesc(next);
  }

  /**
   * 스크린리더 문장. 열 이름과 값을 짝지어 읽게 한다.
   *
   * 노드 셀은 값을 꺼낼 수 없다 — 열 이름만이라도 읽게 해서 **빠진 열이 있다는 사실**을 남긴다.
   * 조용히 빼면 개발 중에도 라벨이 불완전한 것을 알 수 없다(`rowLabel`을 주면 이 조립을 쓰지 않는다).
   */
  function labelFor(row: T): string {
    if (rowLabel) return rowLabel(row);
    return shown
      .map((c) => {
        const v = c.cell(row);
        if (typeof v === 'string') return v ? `${c.header} ${v}` : null;
        return `${c.header} (값을 읽을 수 없음)`;
      })
      .filter(Boolean)
      .join(', ');
  }

  /*
    가로 스크롤은 **표 안에서만**, 그리고 **실제로 넘칠 때만** 쓴다.
    `narrow="scroll"`은 좁은 화면에서 표 모양을 지키겠다는 선언이라 넘침을 허용한다.
  */
  const need = neededWidth(shown, !!expand);
  const scrolls = !stacking && (fit.overflow || (tooNarrow && narrow === 'scroll'));
  /**
   * 모든 열이 고정 폭이면 표를 내용 폭에 맞춘다.
   * 늘어날 열이 없는데 컬럼 전체를 차지하면 구분선만 빈 공간으로 뻗어 빈 셀처럼 읽힌다.
   */
  const fitContent =
    !scrolls && !stacking && shown.length > 0 && shown.every((c) => c.width != null);
  /** 펼친 내용은 첫 열 아래로 들여쓴다. 좁은 화면은 글이 눌리므로 한 단계만 민다. */
  const expandIndent =
    stacking || tooNarrow
      ? spacing.xl
      : Math.min(shown[0]?.width ?? FLEX_MIN, EXPAND_INDENT_MAX) + spacing.sm;

  /*
    쌓기에서 열을 세 자리로 나눈다. **호출부가 자리를 고르지 않는다** — 첫 열이 제목이고,
    나머지는 `header` 유무로만 갈린다. `header`가 빈 열은 이동 표시 같은 장식이라
    늘 제목 줄 오른쪽으로 가고, 이름이 있는 열은 라벨/값 줄이 된다.
  */
  const titleCol = columns[0];
  const trailCols = columns.filter((c) => c !== titleCol && !c.header);
  const detailCols = columns.filter((c) => c !== titleCol && !!c.header);
  const sortable = columns.filter((c) => c.sort);

  /**
   * 좁은 화면의 한 레코드. **열을 하나도 버리지 않는다.**
   *
   * 접기는 *덜 중요한 열*을 지우는 도구인데, 이 앱의 표들은 접으면 *비교 대상*이 지워졌다 —
   * 반별 현황은 담당·학생·배정·정답률이, 선생님 마감 표는 반 이름이 사라졌다.
   * 쌓으면 세로로 길어지지만 화면이 약속한 것을 지킨다.
   */
  const stackBody = (
    <View>
      {sortable.length > 0 && sorted.length > 0 ? (
        <View style={styles.sortBar}>
          <AppText variant="caption" tone="tertiary">
            정렬
          </AppText>
          {sortable.map((c) => {
            const active = sortKey === c.key;
            return (
              <SortButton
                key={c.key}
                testID={testID ? `${testID}-sort-${c.key}` : undefined}
                header={c.header}
                active={active}
                desc={desc}
                onPress={() => toggleSort(c)}
                style={[styles.sortChip, active && styles.sortChipOn]}
              >
                <AppText
                  variant="caption"
                  tone={active ? 'accent' : 'secondary'}
                  weight={active ? 'semibold' : 'medium'}
                >
                  {c.header}
                </AppText>
                <SortArrow active={active} desc={desc} />
              </SortButton>
            );
          })}
        </View>
      ) : null}

      {sorted.length === 0 ? (
        <EmptyState plain title={empty.title} subtitle={empty.subtitle} />
      ) : (
        sorted.map((row) => {
          const key = rowKey(row);
          const isOpen = open === key;
          const pressable = !!onRowPress || !!expand;
          return (
            <RowShell
              key={key}
              testID={testID ? `${testID}-row-${key}` : undefined}
              label={labelFor(row)}
              pressable={pressable}
              open={isOpen}
              onPress={() => {
                if (expand) setOpen(isOpen ? null : key);
                onRowPress?.(row);
              }}
              indent={expandIndent}
              expand={expand ? () => expand(row) : undefined}
            >
              <View style={styles.stackRow}>
                <View style={styles.stackHead}>
                  <View style={styles.grow}>
                    {titleCol ? renderCell(titleCol.cell(row), styles.stackTitle) : null}
                  </View>
                  {trailCols.map((c) => (
                    <View key={c.key}>{renderCell(c.cell(row), styles.stackTitle)}</View>
                  ))}
                  {expand ? <ExpandChevron open={isOpen} /> : null}
                </View>
                {detailCols.map((c) => (
                  <View key={c.key} style={styles.stackPair}>
                    <AppText variant="caption" tone="tertiary" style={styles.stackLabel}>
                      {c.header}
                    </AppText>
                    <View style={styles.grow}>
                      {renderCell(c.cell(row), c.align === 'right' ? styles.numeric : undefined, 2)}
                    </View>
                  </View>
                ))}
              </View>
            </RowShell>
          );
        })
      )}

      {footer && sorted.length > 0 ? (
        <View style={[styles.stackRow, styles.footRow]}>
          <View style={styles.stackHead}>
            <AppText variant="label" weight="semibold" style={styles.grow}>
              {(titleCol && footer[titleCol.key]) || '합계'}
            </AppText>
          </View>
          {detailCols.map((c) =>
            footer[c.key] ? (
              <View key={c.key} style={styles.stackPair}>
                <AppText variant="caption" tone="tertiary" style={styles.stackLabel}>
                  {c.header}
                </AppText>
                <AppText variant="caption" weight="semibold" numeric style={styles.grow}>
                  {footer[c.key]}
                </AppText>
              </View>
            ) : null,
          )}
        </View>
      ) : null}
    </View>
  );

  const body = (
    <View style={[scrolls && { minWidth: need }, fitContent && styles.fit]}>
      <View style={styles.headRow}>
        {shown.map((c) => {
          const active = sortKey === c.key;
          const content = (
            <View style={styles.headCell}>
              <AppText
                variant="caption"
                tone={active ? 'default' : 'secondary'}
                style={active ? styles.headTextActive : styles.headText}
              >
                {c.header}
              </AppText>
              <SortArrow active={active} desc={desc} />
            </View>
          );
          return (
            <View key={c.key} style={[cellStyle(c), c.align === 'right' && styles.right]}>
              {c.sort ? (
                <SortButton
                  testID={testID ? `${testID}-sort-${c.key}` : undefined}
                  header={c.header}
                  active={active}
                  desc={desc}
                  onPress={() => toggleSort(c)}
                  style={styles.sortHit}
                >
                  {content}
                </SortButton>
              ) : (
                content
              )}
            </View>
          );
        })}
        {expand ? <View style={styles.expandCell} /> : null}
      </View>

      {sorted.length === 0 ? (
        <EmptyState plain title={empty.title} subtitle={empty.subtitle} />
      ) : (
        sorted.map((row) => {
          const key = rowKey(row);
          const isOpen = open === key;
          const pressable = !!onRowPress || !!expand;
          return (
            <RowShell
              key={key}
              testID={testID ? `${testID}-row-${key}` : undefined}
              label={labelFor(row)}
              pressable={pressable}
              open={isOpen}
              onPress={() => {
                if (expand) setOpen(isOpen ? null : key);
                onRowPress?.(row);
              }}
              indent={expandIndent}
              expand={expand ? () => expand(row) : undefined}
            >
              <View style={[styles.bodyRow, pressable && styles.bodyRowTouch]}>
                {shown.map((c) => {
                  const v = c.cell(row);
                  return (
                    <View key={c.key} style={[cellStyle(c), c.align === 'right' && styles.right]}>
                      {typeof v === 'string' ? (
                        <AppText
                          style={[styles.value, c.align === 'right' && styles.numeric]}
                          numberOfLines={1}
                        >
                          {v}
                        </AppText>
                      ) : (
                        v
                      )}
                    </View>
                  );
                })}
                {/* 펼칠 수 있다는 표시. 이동을 뜻하는 오른쪽 chevron과 방향이 달라야 한다. */}
                {expand ? (
                  <View style={styles.expandCell}>
                    <ExpandChevron open={isOpen} />
                  </View>
                ) : null}
              </View>
            </RowShell>
          );
        })
      )}

      {footer && sorted.length > 0 ? (
        <View style={[styles.bodyRow, styles.footRow]}>
          {shown.map((c) => (
            <View key={c.key} style={[cellStyle(c), c.align === 'right' && styles.right]}>
              <AppText
                style={[styles.footValue, c.align === 'right' && styles.numeric]}
                numberOfLines={1}
              >
                {footer[c.key] ?? ''}
              </AppText>
            </View>
          ))}
          {expand ? <View style={styles.expandCell} /> : null}
        </View>
      ) : null}
    </View>
  );

  /*
    가로 스크롤은 **표 안에서만**, 그리고 **실제로 넘칠 때만** 쓴다.
    넘치지 않는데 ScrollView로 감싸면 내용이 자기 폭으로만 커져서 `flex` 열이 컬럼을
    채우지 못한다(960 컬럼에 538px 표가 남는 것을 실측으로 확인했다).
  */
  if (stacking) {
    return (
      <View style={styles.scroll} testID={testID}>
        {stackBody}
      </View>
    );
  }
  if (scrolls) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        style={styles.scroll}
       
        testID={testID}
      >
        {body}
      </ScrollView>
    );
  }
  return (
    <View style={styles.scroll} testID={testID}>
      {body}
    </View>
  );
}

/**
 * 행 하나의 껍데기 — `testID`·누를 수 있는지·접근성 상태·펼침 패널.
 *
 * **표 모양과 쌓기 모양은 안쪽 내용만 다르고 이 계약은 같다.** 두 벌로 두면
 * `aria-expanded`·`accessibilityLabel`·`accessibilityRole`과 펼침 토글 규칙이 두 곳에 생겨,
 * 한쪽만 고쳤을 때 **좁은 화면에서만** 스크린리더가 다르게 읽는다 —
 * 데스크톱 폭으로 도는 테스트로는 잡히지 않는 종류의 어긋남이다.
 *
 * `expand`를 노드가 아니라 함수로 받는다 — 노드로 받으면 접혀 있는 행까지
 * 호출부의 패널을 매번 만들게 된다(`/admin/metrics`는 24행이 각자 패널을 갖는다).
 */
function RowShell({
  testID,
  label,
  pressable,
  open,
  onPress,
  indent,
  expand,
  children,
}: {
  testID?: string;
  label: string;
  pressable: boolean;
  open: boolean;
  onPress: () => void;
  indent: number;
  expand?: () => ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.rowWrap} testID={testID}>
      {pressable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          /*
            `aria-*`로 준다 — react-native-web은 `accessibilityState`를 DOM으로 옮기지 않고
            `aria-selected`·`aria-expanded`만 넘긴다(실측: 웹에서 `accessibilityState`는
            속성이 아예 붙지 않았다). 네이티브는 이 프롭을 `accessibilityState`로 되돌려 준다.
          */
          aria-expanded={expand ? open : undefined}
          onPress={onPress}
          style={({ pressed }) => (pressed ? { backgroundColor: colors.hover } : null)}
        >
          {children}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={label}>
          {children}
        </View>
      )}
      {/*
        들여쓰기가 없으면 펼친 내용이 새 행처럼 읽힌다.
        높이도 투명도도 애니메이션하지 않는다 — `LayoutAnimation`은 웹에서 동작하지 않아
        iOS에서만 움직이게 되고, 페이드는 펼칠 때마다 새로 마운트되는 이 자리에서
        첫 그림을 건너뛰는 규칙(`useReplayFade`)에 걸려 한 번도 실행되지 않았다.
      */}
      {open && expand ? (
        <View style={[styles.expand, { paddingLeft: indent }]}>{expand()}</View>
      ) : null}
    </View>
  );
}

/**
 * 정렬 컨트롤. 헤더(표)와 칩(쌓기)이 겉모습만 다르고 접근성 계약은 같다 —
 * 이름(`sortLabel`)·`aria-selected`·`testID` 규칙을 한곳에 둔다.
 * `style`만 호출부가 정하고, 눌림 배경은 여기서 붙인다.
 */
function SortButton({
  testID,
  header,
  active,
  desc,
  onPress,
  style,
  children,
}: {
  testID?: string;
  header: string;
  active: boolean;
  desc: boolean;
  onPress: () => void;
  style: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      aria-selected={active}
      accessibilityLabel={sortLabel(header, active, desc)}
      onPress={onPress}
      style={({ pressed }) => [style, pressed ? { backgroundColor: colors.hover } : null]}
    >
      {children}
    </Pressable>
  );
}

/**
 * 정렬 방향 화살표. **정렬 중인 열에만** 둔다 — 비활성 열까지 그리면 어느 열로 줄 서 있는지
 * 색으로만 갈리고(DESIGN.md 11절), 방향도 실제 순서와 무관한 그림이 된다.
 * 정렬할 수 있다는 사실은 헤더가 버튼이라는 것과 `accessibilityLabel`이 말한다.
 */
function SortArrow({ active, desc }: { active: boolean; desc: boolean }) {
  if (!active) return null;
  return <Icon name={desc ? 'arrow-down' : 'arrow-up'} size={12} color={colors.accent} />;
}

/** 정렬 헤더 이름. 지금 어느 방향인지와 누르면 무엇이 되는지를 함께 말한다. */
function sortLabel(header: string, active: boolean, desc: boolean): string {
  if (!active) return `${header} 기준으로 정렬`;
  return desc
    ? `${header} 내림차순 정렬 중, 오름차순으로 바꾸기`
    : `${header} 오름차순 정렬 중, 내림차순으로 바꾸기`;
}

/**
 * 펼침 표시. 접힘은 아래, 펼침은 위 chevron이다(D-074 ⑤).
 *
 * `IconName`에 `chevron-up`이 없어 펼침만 `chevron-down`을 180° 돌려 쓴다 — 아이콘 목록은
 * 앱 전체가 함께 쓰는 파일이라 이 표 하나 때문에 이름을 늘리지 않는다.
 * **이동을 뜻하는 오른쪽 chevron과 방향이 갈려야 한다** — 표의 마지막 열에 오는 `chevron-right`는
 * "눌리는 행"이라는 다른 뜻을 이미 갖고 있다(DESIGN.md 8절·D-084 ③).
 * 그래서 `Disclosure`의 `chevron-down`/`chevron-right` 관용구를 여기에 쓰지 않는다.
 */
function ExpandChevron({ open }: { open: boolean }) {
  return (
    <View style={open ? styles.chevronFlip : undefined}>
      <Icon name="chevron-down" size={16} color={colors.inkTertiary} />
    </View>
  );
}

/** 문자열이면 표가 그리고, 노드면 그대로 넣는다. 쌓기와 표가 같은 규칙을 쓴다. */
function renderCell(v: string | ReactNode, style?: object, lines = 1) {
  if (typeof v !== 'string') return v;
  return (
    <AppText style={style} numberOfLines={lines}>
      {v}
    </AppText>
  );
}

function cellStyle<T>(c: Column<T>) {
  return c.width ? { width: c.width } : { flex: 1, minWidth: FLEX_MIN };
}

const styles = StyleSheet.create({
  // 테두리·라운드·배경 없음. 카드가 아니다.
  scroll: { width: '100%' },
  /* 쌓기에서 정렬은 헤더가 없으므로 위쪽 줄로 옮긴다. 이름과 testID는 표와 같다. */
  sortBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: touch.dense,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.offset,
  },
  sortChipOn: { backgroundColor: colors.accentSoft },
  stackRow: { paddingVertical: spacing.md, gap: spacing.xs },
  stackHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stackTitle: { fontFamily: typeface.medium, fontSize: font.size.base },
  /* 라벨 96px. `평균 정답률`(6자)이 들어가고, 값에 254px이 남는다(358 컬럼 기준). */
  stackPair: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  stackLabel: { width: 96 },
  grow: { flex: 1 },
  /** 늘어날 열이 없을 때만. 구분선이 내용과 함께 끝난다. */
  fit: { alignSelf: 'flex-start' },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
    minHeight: 36,
  },
  headCell: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  /**
   * 정렬 헤더의 누름 영역 44px(§10). 정렬은 열 헤더가 맡는 유일한 컨트롤이라 작으면 안 된다.
   * 캡션 한 줄(20.15)에 위 16 + 아래 8을 더해 44를 만들고, **늘어난 만큼 음수 마진으로 되돌려**
   * 헤더 행 높이는 그대로 둔다(`BackLink`가 쓰는 방법). `hitSlop`은 react-native-web의
   * `Pressable`에서 동작하지 않아 쓰지 않는다.
   * 아래로 넘치는 8px은 `headRow`의 `paddingBottom`(8) 안이라 구분선을 넘지 않는다.
   */
  sortHit: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    marginTop: -spacing.lg,
    marginBottom: -spacing.sm,
    borderRadius: radius.md,
  },
  headText: { fontFamily: typeface.medium },
  /** 정렬 중인 열은 색 밖에서도 말한다(굵기 + `selected` 상태). */
  headTextActive: { fontFamily: typeface.semibold },
  rowWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 40,
    paddingVertical: 6,
  },
  /** 누를 수 있는 행은 터치 기준 44px 이상. */
  bodyRowTouch: { minHeight: 48 },
  footRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderStrong },
  right: { alignItems: 'flex-end' },
  /** 값은 `ink`다. `Row.meta`처럼 흐린 색을 값에 쓰지 않는다. */
  value: { color: colors.ink },
  /** 등폭 숫자. 자릿수 선이 맞아야 위아래로 훑으며 비교할 수 있다. */
  numeric: { fontVariant: ['tabular-nums'] },
  footValue: { color: colors.ink, fontFamily: typeface.semibold },
  expandCell: { width: EXPAND_W, alignItems: 'flex-end' },
  /** 펼쳤을 때만. 아래 chevron을 뒤집어 위 chevron으로 쓴다(`chevron-up`이 없다). */
  chevronFlip: { transform: [{ rotate: '180deg' }] },
  expand: { paddingBottom: spacing.md, gap: spacing.sm },
});
