import type { ReactNode } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { SourceTag } from './SourceTag';
import type { LearningItem } from '@/data';
import { dueLabel, formatDate } from '@/features/learning';
import { colors, spacing, typeface } from '@/theme/tokens';

interface Props {
  item: LearningItem;
  onPress?: () => void;
  /**
   * 행 왼쪽에 붙는 표시(순번 등). 누르는 영역 **안**에 둔다 — 행동이 아니라 정보이므로
   * 행과 함께 눌려도 된다. 행동을 왼쪽에 두지 않는다.
   */
  leading?: ReactNode;
  /**
   * 행 오른쪽에 붙는 행동(담기 토글 등).
   * 누르는 영역 **밖**에 둔다 — 안에 넣으면 누를 때 행 배경이 함께 번쩍인다.
   */
  trailing?: ReactNode;
  /** 이 학습에 대해 한 줄 더 알릴 것(예: 학원 과제로도 받았다는 사실). */
  note?: string;
  testID?: string;
}

/** 학습 항목 한 줄. 출처 태그 + 과목·제목 + 부가정보. Group 안에서 사용. */
export function LearningRow({ item, onPress, leading, trailing, note, testID }: Props) {
  /**
   * 마감은 **오늘 기준**으로 말한다(`dueLabel` · D-142). 예전에는 이 줄만 늘 `8월 6일 마감`이라
   * 마감이 지난 과제가 여유 있게 읽혔다 — 오늘 기준으로 말하는 곳은 학생 홈 히어로 하나뿐이어서,
   * 담아 둔 학습이 히어로를 차지한 학생은 지난 마감을 **어느 화면에서도** 듣지 못했다.
   *
   * 히어로와 같은 순서로 알린다: **글자가 먼저 바뀌고 색은 그다음**이다(§11 — 색만으로 뜻을
   * 전하지 않는다). 그래서 지난 마감은 `마감이 지났어요`로 글이 바뀐 뒤에만 `danger`가 얹힌다.
   *
   * **이미 낸 학습에는 쓰지 않는다.** 히어로는 아직 남은 학습만 올리므로 이 상황이 없었는데,
   * 목록에는 완료한 과제가 함께 서 있다. 실측(정예린 학습 탭): 제출을 마친 네 줄이 모두 빨간
   * `마감이 지났어요`가 되어 **할 일이 남은 것처럼** 보였다. 낸 과제에게 마감일은 지난 일이라,
   * 날짜만 적고 그 줄이 알릴 것(정답률)을 남긴다(지금 모습은 `docs/evidence/learn-due-done-*`).
   */
  const due = item.status === 'done' ? null : dueLabel(item.dueDate);
  /** 마감 뒤에 붙는 나머지 메타. 순서(문항 → 마감 → 상태)는 그대로 둔다. */
  const tail = [
    item.status === 'done' && item.dueDate ? `${formatDate(item.dueDate)} 마감` : null,
    item.status === 'done' && item.accuracy != null ? `정답률 ${item.accuracy}%` : null,
    item.status === 'in_progress' ? '이어서 하기' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.wrap} testID={testID}>
      <Pressable
        accessibilityRole="button"
        /*
          **메타를 이름에 함께 넣는다.** `aria-label`은 접근 가능한 이름 계산에서 자손 텍스트를
          덮으므로, 예전 라벨(`과목 제목`)만 두면 `10문항 · 마감이 지났어요 · 정답률 80%`가
          스크린리더에 닿지 않았다. D-142가 색 대신 **글자**로 지난 마감을 말하기로 했는데
          그 글자가 이름에서 빠지면 §11(색만으로 뜻을 전하지 않는다)이 지켜지지 않는다.
        */
        accessibilityLabel={[
          `${item.subject} ${item.title}`,
          `${item.questionCount}문항`,
          due?.text,
          tail || null,
          note,
        ]
          .filter(Boolean)
          .join(', ')}
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          leading != null && styles.rowWithLeading,
          pressed && onPress && { backgroundColor: colors.hover },
        ]}
      >
        {leading != null ? <View style={styles.leading}>{leading}</View> : null}
        <View style={styles.main}>
          <SourceTag source={item.source} />
          <AppText variant="label">
            {item.subject} · {item.title}
          </AppText>
          {/*
            한 줄 안에서 마감만 색과 무게가 달라질 수 있어 그 조각만 감싼 `AppText`로 둔다.
            줄을 따로 빼지 않는 이유는 목록 행이 촘촘해야 하기 때문이다 — 히어로는 제목 아래에
            자리가 있어 지난 마감을 한 줄로 분리한다.
          */}
          <AppText variant="caption" tone="tertiary">
            {item.questionCount}문항
            {due ? (
              <AppText
                variant="caption"
                tone={due.overdue ? 'danger' : 'tertiary'}
                style={due.overdue ? styles.overdue : undefined}
              >
                {` · ${due.text}`}
              </AppText>
            ) : null}
            {tail ? ` · ${tail}` : ''}
          </AppText>
          {note ? (
            <AppText variant="caption" tone="secondary">
              {note}
            </AppText>
          ) : null}
        </View>
        {/*
          chevron은 누르는 영역 기준 absolute right다. `trailing`이 붙으면 그 영역의
          오른쪽 경계가 안으로 밀려 chevron이 행동 버튼 왼쪽으로 끌려 들어온다.
          오른쪽에 행동이 있으면 chevron을 두지 않는다 — 누를 곳은 행 자체로 남는다.
        */}
        {onPress && !trailing ? <View style={styles.chevron} /> : null}
      </Pressable>
      {trailing ? <View style={styles.trail}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center' },
  row: { flex: 1, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: 6 },
  // leading이 있으면 가로로 나눈다. 세로 gap은 안쪽 main이 갖는다.
  rowWithLeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  leading: { minWidth: 20, alignItems: 'center' },
  main: { flex: 1, gap: 6 },
  // 지난 마감. 색은 `tone="danger"`가 주고 여기서는 무게만 올린다(학생 홈 히어로와 같은 한 벌).
  overdue: { fontFamily: typeface.medium },
  trail: { paddingRight: spacing.lg, paddingLeft: spacing.sm },
  chevron: {
    position: 'absolute',
    right: spacing.lg,
    top: spacing.lg,
    width: 7,
    height: 7,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: colors.inkTertiary,
    transform: [{ rotate: '45deg' }],
  },
});
