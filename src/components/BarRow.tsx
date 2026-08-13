import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { ProgressBar } from './ProgressBar';
import { useColumn } from '@/theme/useColumn';
import { spacing, touch } from '@/theme/tokens';

/**
 * 라벨 / 막대 / 값. 비율을 나란히 비교하는 자리는 도넛·게이지가 아니라 이 형태다(D-078).
 *
 * **트랙이 자기 값 글자보다 좁아지면 그건 막대가 아니다.** 390에서 학원 영역별은 트랙이
 * 94px, 학생 상세는 82px까지 눌려 있었다 — 값 텍스트의 절반이다. 트랙이 `MIN_TRACK`보다
 * 좁아지는 폭에서는 한 줄을 포기하고 **두 줄로 쌓는다**: 위에 `라벨 ⟷ 값`, 아래에 전폭 트랙.
 *
 * 폭 판단은 **창이 아니라 컬럼**으로 한다(`useColumn`) — 데스크톱은 사이드바와 최대폭 때문에
 * 창 폭과 다르다.
 *
 * `ProgressBar`에 **이름을 준다.** 그러지 않으면 스크린리더가 "progress bar"라고만 읽는다.
 */
const MIN_TRACK = 120;

export function BarRow({
  label,
  value,
  note,
  muted,
  labelWidth = 92,
  noteWidth = 148,
  testID,
}: {
  label: string;
  /** 0~100. 트랙을 채우는 비율. */
  value: number;
  /** 오른쪽 값 글자. `72% · 1,204문항 · 표본 적음`처럼 길 수 있다. */
  note: string;
  /** 값이 없는 칸. 자리는 남기고 트랙을 비운다 — 분모를 지우면 분포가 목록이 된다. */
  muted?: boolean;
  labelWidth?: number;
  noteWidth?: number;
  testID?: string;
}) {
  const { width } = useColumn();
  const track = width - labelWidth - noteWidth - spacing.md * 2;
  const stacked = width > 0 && track < MIN_TRACK;

  const labelText = (
    <AppText
      variant="caption"
      tone={muted ? 'tertiary' : 'default'}
      numberOfLines={2}
      style={stacked ? styles.grow : { width: labelWidth }}
    >
      {label}
    </AppText>
  );
  const noteText = (
    <AppText
      variant="caption"
      tone={muted ? 'tertiary' : 'secondary'}
      numeric
      style={stacked ? undefined : [styles.note, { width: noteWidth }]}
    >
      {note}
    </AppText>
  );

  if (stacked) {
    return (
      <View testID={testID} style={styles.stack} accessibilityLabel={`${label} ${note}`}>
        <View style={styles.stackHead}>
          {labelText}
          {noteText}
        </View>
        <ProgressBar value={muted ? 0 : value} />
      </View>
    );
  }
  /*
    한 줄일 때 순서는 **라벨 / 트랙 / 값**이다(DESIGN.md 18절 `비율 비교는 가로 막대` · D-078 ④).
    값을 트랙 앞에 두면 막대가 오른쪽 끝에 붙어 서로 다른 라벨 길이에서 시작점이 흔들린다.
    쌓을 때만 값이 라벨 옆으로 올라온다 — 그 줄에는 트랙이 없다.
  */
  return (
    <View testID={testID} style={styles.row} accessibilityLabel={`${label} ${note}`}>
      {labelText}
      <View style={styles.grow}>
        <ProgressBar value={muted ? 0 : value} />
      </View>
      {noteText}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touch.dense,
  },
  stack: { gap: spacing.xs, minHeight: touch.dense, justifyContent: 'center' },
  stackHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1 },
  note: { textAlign: 'right' },
});
