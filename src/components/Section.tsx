import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { Divider } from './Divider';
import { spacing } from '@/theme/tokens';

/**
 * 제목이 있는 섹션 묶음.
 * `action`은 제목 오른쪽에 붙는 작은 행동(전체 보기 등). 화면의 주요 행동은 여기에 두지 않는다.
 */
export function Section({
  title,
  action,
  separated,
  children,
}: {
  title?: string;
  action?: ReactNode;
  /**
   * 앞 섹션과 사이에 hairline 한 줄을 긋는다.
   *
   * **기본은 여백만이다**(`DESIGN.md` §5·§6). 이 값을 주는 경우는 하나뿐이다 —
   * **스스로 어떤 경계선도 갖지 않는 블록**(가로 막대 목록·문단 글·캡션)이 연달아 맞닿아
   * 어디서 끊기는지 안 보일 때. `Group`·`Table`·`Passage`처럼 이미 선을 가진 블록의
   * 앞뒤에는 두지 않는다 — 선이 두 겹으로 보인다.
   */
  separated?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      {separated ? <Divider /> : null}
      {title || action ? (
        <View style={styles.head}>
          {/*
            **섹션 제목은 2단계다**(D-166 · `DESIGN.md` §4) — `Screen`의 화면 제목이 1단계이므로
            단계를 건너뛰지 않는다. 호출부 124곳이 각자 붙이게 두면 규칙만 문서에 남는다.
            섹션 안에 섹션을 두는 자리가 생기면 그때 `headingLevel` prop을 열어 3을 받는다.
          */}
          {title ? (
            <AppText variant="subheading" headingLevel={2} style={styles.title}>
              {title}
            </AppText>
          ) : null}
          {/*
            **감싸는 View가 필요하다.** 행동 버튼은 보통 `hug`(= `alignSelf: 'flex-start'`)인데,
            가로 줄에서 `alignSelf`는 **세로** 축이라 부모의 `alignItems: center`를 덮어써서
            제목 옆이 아니라 위로 붙는다. 내용 높이인 이 View 안에서는 그 값이 아무 일도
            하지 않으므로, 바깥에서는 가운데 정렬이 그대로 산다.
          */}
          {action ? <View>{action}</View> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: { flex: 1 },
});
