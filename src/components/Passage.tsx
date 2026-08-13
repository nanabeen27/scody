import { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { AppText } from './AppText';
import { Icon } from './Icon';
import type { Passage as PassageData } from '@/data';
import { colors, spacing, font, touch, typeface, radius } from '@/theme/tokens';

interface Props {
  passage: PassageData;
  /** 접었다 펼 수 있게 한다. 같은 화면에 지문이 여럿일 때만 쓴다. */
  collapsible?: boolean;
  /** `collapsible`일 때 처음 펼쳐져 있는지. */
  defaultOpen?: boolean;
}

/**
 * 독해 지문. 기사처럼 읽히게 한다.
 *
 * 접을 때는 본문을 **렌더하지 않는다**(높이만 0으로 감추지 않는다) — 화면에 지문이 여럿이면
 * 감춘 글자까지 검색에 걸려 무엇을 가리키는지 알 수 없게 된다.
 *
 * **접기는 제목 줄 전체가 맡는다.** 예전에는 테두리 알약 버튼이었는데, 지문 위에 알약이
 * 둘셋 떠 있으면 읽을 것보다 도구가 먼저 보인다(§13 `장식이 내용보다 먼저 보이는 화면`).
 * 지금은 `지문`이라는 글자와 화살표뿐이고, 누르는 자리는 줄 전체라 오히려 더 넓다.
 */
export function Passage({ passage, collapsible, defaultOpen = true }: Props) {
  const paragraphs = useMemo(
    () =>
      passage.body
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean),
    [passage.body],
  );
  const [open, setOpen] = useState(defaultOpen);

  // 접기를 켜지 않은 화면은 늘 펼쳐져 있다.
  const shown = !collapsible || open;

  const bar = (
    <>
      <AppText variant="caption" tone="secondary" weight="semibold">
        지문
      </AppText>
      {collapsible ? (
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={16} color={colors.inkTertiary} />
      ) : null}
    </>
  );

  return (
    <View style={[styles.wrap, !shown && styles.wrapClosed]}>
      {collapsible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? '지문 접기' : '지문 펼치기'}
          aria-expanded={open}
          onPress={() => setOpen((v) => !v)}
          style={({ pressed }) => [styles.bar, styles.barTap, pressed && styles.barPressed]}
        >
          {bar}
        </Pressable>
      ) : (
        <View style={styles.bar}>{bar}</View>
      )}

      {shown ? (
        <View style={styles.body}>
          {passage.title ? <AppText style={styles.title}>{passage.title}</AppText> : null}
          {/* 단락(\n)마다 끊어 읽기 좋게 띄운다. 한 덩어리로 쏟으면 어디까지 읽었는지 놓친다. */}
          {paragraphs.map((p, i) => (
            <AppText key={i} style={styles.text}>
              {p}
            </AppText>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // 지문은 이 화면에서 계속 되돌아와 읽는 곳이다. 하나의 면으로 묶어
  // 문제 영역과 확실히 갈라 둔다(문제는 면 밖에 있다).
  wrap: {
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.card,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  // 접히면 제목 줄만 남는다. 빈 카드처럼 보이지 않게 위아래를 좁힌다.
  wrapClosed: { paddingVertical: spacing.md },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  /* 누르는 자리는 줄 전체다. 카드 좌우 여백까지 넓혀 손가락이 편하게 닿게 한다. */
  barTap: {
    minHeight: touch.min,
    marginHorizontal: -spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  barPressed: { backgroundColor: colors.hover },
  body: { gap: spacing.md },
  title: {
    fontFamily: typeface.semibold,
    color: colors.ink,
    fontSize: font.size.lg,
    lineHeight: font.size.lg * 1.4,
    letterSpacing: -0.2,
  },
  text: {
    fontFamily: typeface.regular,
    color: colors.ink,
    fontSize: font.size.reading,
    lineHeight: font.size.reading * font.lineHeight.reading,
  },
});
