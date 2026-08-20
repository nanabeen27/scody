import { View, StyleSheet } from 'react-native';

import { AppText } from './AppText';
import { CountUp } from './CountUp';
import { colors, font, radius, spacing, typeface } from '@/theme/tokens';

/**
 * 방금 세운 기록 하나. **학습을 끝낸 화면에서만 쓴다.**
 *
 * ## 왜 이 자리에만 면(surface)을 두는가
 *
 * 이 레포는 모든 것을 카드로 감싸지 않는다(`CLAUDE.md` 디자인 규칙 — 카드는 정보의 소속·선택·
 * 상호작용을 설명할 때만). 여기서 면을 쓰는 이유는 이 블록이 **화면의 다른 값들과 다른 종류의
 * 사실**이기 때문이다: 정답률·걸린 시간은 이번 풀이의 결과이고, 이것은 **지금까지의 기록이
 * 바뀌었다**는 사실이다. 화면에서 한 번만 나타나고, 나타나지 않는 날이 대부분이다.
 *
 * ## 면은 `선택됨`과 갈라 둔다
 *
 * 처음에는 `accentSoft` 면 + `accent` 1px 테두리였다. 그런데 **그 한 벌은 이 앱에서 `선택됨/
 * 켜짐`의 표현**이다 — 풀이·복습 화면의 고른 선지(§16의 `choiceOn`), `IconButton`의 켜진 상태,
 * 활성 탭이 모두 같은 옷을 입는다. 그리고 이 블록이 서는 결과 화면 아래쪽에는 그 켜진
 * `IconButton`(오답노트 담기)이 실제로 있다. 방금 그 표현을 `내가 고른 답`으로 배운 학생에게
 * 화면에서 가장 눈에 띄는 블록이 **누를 수 있는 것처럼** 보이는데 눌러도 아무 일이 없다
 * (§8이 금지하는 상태다).
 *
 * 그래서 면은 `surface` + `border`, 즉 **`ScoreCard`와 같은 형태**다. 두 블록이 형제로 읽히고
 * 위계는 순서가 정한다. 강조색은 `eyebrow` 한 줄에만 남는다 — 그 줄이 `새로운 기록`·`달성`을
 * 말하는 자리다.
 *
 * ## 유치해지지 않게 하는 규칙
 *
 * - 이모지·반짝임·그라데이션을 두지 않는다(`CLAUDE.md`). 강조는 강조색 하나와 큰 숫자로 한다.
 * - 문장은 사실만 말한다. `대단해요`·`최고예요` 같은 칭찬을 붙이지 않는다 — 근거 없는 칭찬은
 *   AI가 쓴 화면처럼 읽히고, 여기서는 숫자가 이미 칭찬이다.
 * - 숫자는 한 번만 굴러간다(`CountUp`). 두 개 이상이 동시에 굴러가면 어느 것이 기록인지 흐려진다.
 */
export function RecordHighlight({
  eyebrow,
  title,
  value,
  format,
  detail,
  testID,
}: {
  /** 어떤 종류의 사실인가. `새로운 기록` · `달성`. */
  eyebrow: string;
  /** 무엇의 기록인가. `하루 최다 오답 해결`. */
  title: string;
  /** 굴러갈 숫자. */
  value: number;
  /** 숫자에 단위를 붙인다. */
  format: (n: number) => string;
  /** 근거 한 줄. `지난 최고 8개를 넘었어요`. */
  detail?: string;
  testID?: string;
}) {
  return (
    <View style={styles.card} testID={testID}>
      <AppText variant="caption" tone="accent" weight="semibold">
        {eyebrow}
      </AppText>
      <AppText variant="label" tone="secondary">
        {title}
      </AppText>
      <CountUp value={value} format={format} style={styles.number} />
      {detail ? (
        <AppText variant="caption" tone="secondary">
          {detail}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /*
    `ScoreCard`와 같은 면·선·라운드다(위 docblock의 근거). 값도 그 컴포넌트에서 그대로 가져왔다 —
    같은 화면에서 두 블록이 다른 모양이면 어느 쪽이 더 중요한지 화면이 잘못 말한다.
    `detail`(`tone="secondary"`)은 이 면 위에서 라이트 7.34:1 · 다크 7.91:1이다(실측 · AA).
  */
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xxs,
  },
  /*
    `ScoreCard`의 숫자와 같은 무게다 — 결과 화면에서 두 값이 위아래로 서므로 크기가 다르면
    어느 쪽이 더 중요한지 화면이 잘못 말한다.
  */
  number: {
    fontFamily: typeface.bold,
    color: colors.ink,
    fontSize: font.size.xxl,
    lineHeight: font.size.xxl * font.lineHeight.snug,
    letterSpacing: font.tracking.tight,
    marginTop: spacing.xxs,
  },
});
