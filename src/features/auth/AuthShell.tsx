import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Brand, Divider, ThemeToggle } from '@/components';
import { LEGAL_DOCS } from '@/features/legal/documents';
import { colors, radius, spacing, touch } from '@/theme/tokens';
import { useResponsive } from '@/theme/useResponsive';

/**
 * 로그인·가입 화면의 공통 껍데기.
 *
 * 기획 기준(오늘의집 로그인·가입 화면에서 가져온 구성 원칙):
 * - 화면에 이 일 하나만 있다. 좁은 한 컬럼을 화면 가운데에 두고 그 안에서만 묻는다.
 * - 입력과 주요 행동은 하나의 면(패널) 안에 모은다. 넓은 화면에서 요소가 흩어져 보이지 않게.
 * - 워드마크를 컬럼 맨 위에 둬서 어느 서비스의 로그인인지 먼저 알린다.
 *   파비콘 도형은 여기에 두지 않는다 — 브라우저 탭에서만 쓴다.
 * - 문서·테마 같은 부가 링크는 아래 푸터로 내린다.
 *
 * 스코디 규칙은 유지한다: 본문은 좌측 정렬, 카드는 주인공 표면에만, 그림자 없음.
 * 모바일에서는 패널 테두리를 없앤다(폭이 좁아 테두리가 화면 테두리와 겹쳐 보인다).
 */
export function AuthShell({
  onExit,
  exitLabel,
  exitTestID,
  children,
  below,
}: {
  /** 워드마크를 눌렀을 때 나가는 길. 화면마다 다르다. */
  onExit: () => void;
  exitLabel: string;
  exitTestID: string;
  children: ReactNode;
  /** 패널 밖 아래에 붙일 내용(예: 개발용 테스트 계정). */
  below?: ReactNode;
}) {
  const { isMobile } = useResponsive();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.page,
        {
          paddingTop: insets.top + (isMobile ? spacing.xxl : spacing.xxxl),
          paddingBottom: insets.bottom + spacing.xxl,
        },
      ]}
    >
      <View style={[styles.column, !isMobile && styles.columnCenter]}>
        {/*
          테마는 화면 전체에 걸리는 설정이라 본문이 아니라 상단 줄 오른쪽 끝에 둔다(D-165).
          예전에는 약관 문구 **아래**, 화면 맨 끝에 있었다 — 로그인하러 온 사람이 화면을 끝까지
          내렸을 때 마지막으로 만나는 것이 테마 전환이었다.
        */}
        <View style={styles.headRow}>
          <Brand center testID={exitTestID} accessibilityLabel={exitLabel} onPress={onExit} />
          <View style={styles.headTool}>
            <ThemeToggle />
          </View>
        </View>
        <View style={[styles.panel, isMobile && styles.panelFlat]}>{children}</View>
        {below}
        <AuthFooter />
      </View>
    </ScrollView>
  );
}

/** 패널 안의 화면 제목. 한 화면에 하나만 둔다. */
export function AuthHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={styles.heading}>
      {/* 이 화면의 제목이라 1단계다 — 인증 화면에는 이 위에 다른 제목이 없다. */}
      <AppText variant="title" headingLevel={1}>
        {title}
      </AppText>
      {sub ? (
        <AppText variant="bodyLg" tone="secondary">
          {sub}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * 단계형 화면의 진행 표시. 몇 단계가 남았는지 먼저 알려준다.
 *
 * **역할이 있어야 이름이 읽힌다.** 예전에는 이름만 붙인 맨 `View`였는데, 역할 없는 요소의
 * `aria-label`은 보조기술이 무시한다 — 막대 두 개가 눈에만 보이고 "2단계 중 1단계"는
 * 어디에도 없었다. `ProgressBar`와 같은 방식으로 둔다.
 */
export function AuthSteps({ step, total }: { step: number; total: number }) {
  return (
    <View
      style={styles.steps}
      accessibilityRole="progressbar"
      accessibilityLabel={`${total}단계 중 ${step}단계`}
      aria-valuenow={step}
      aria-valuemin={1}
      aria-valuemax={total}
    >
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.stepBar, i < step && styles.stepBarOn]} />
      ))}
    </View>
  );
}

/** 입력 묶음 앞에 붙이는 작은 제목. 무엇을 왜 묻는지 한 줄로 밝힌다. */
export function AuthSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        {/* 화면 제목 아래의 묶음이라 2단계다(가입 마지막 단계의 `역할`·`계정 정보`). */}
        <AppText variant="subheading" headingLevel={2}>
          {title}
        </AppText>
        {hint ? (
          <AppText variant="caption" tone="secondary">
            {hint}
          </AppText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** 가운데 글자가 들어간 구분선. 방법이 여러 개일 때 선택지를 갈라 준다. */
export function LabeledDivider({ label }: { label: string }) {
  return (
    <View style={styles.labeled}>
      <View style={styles.labeledLine} />
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <View style={styles.labeledLine} />
    </View>
  );
}

/** 본문 안의 글자 링크. 버튼을 여러 개 쌓지 않기 위해 보조 행동은 링크로 둔다. */
export function TextLink({
  label,
  onPress,
  testID,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}
    >
      <AppText variant="label" tone="accent">
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * 인라인 오류 문구. 색만으로 알리지 않고 문장으로 말한다.
 *
 * `role="alert"`을 준다 — 화면을 옮기지 않고 그 자리에 나타나므로, 없으면 보조기술 사용자는
 * 왜 다음 단계로 가지 않는지 알 수 없다(`ConfirmStep`이 같은 이유로 쓴다).
 */
export function AuthError({ children }: { children: string }) {
  return (
    <AppText variant="caption" style={styles.error} role="alert">
      {children}
    </AppText>
  );
}

/** 문서 링크와 테마. 로그인 화면에서도 약관·처리방침을 열 수 있어야 한다. */
function AuthFooter() {
  const router = useRouter();
  return (
    <View style={styles.footer}>
      <Divider />
      <View style={styles.footerLinks}>
        {LEGAL_DOCS.map((d) => (
          <Pressable
            key={d.slug}
            testID={`auth-footer-${d.slug}`}
            accessibilityRole="link"
            onPress={() => router.push(`/legal/${d.slug}` as never)}
            style={({ pressed }) => [styles.footerLink, pressed && { opacity: 0.6 }]}
          >
            <AppText variant="caption" tone="secondary">
              {d.label}
            </AppText>
          </Pressable>
        ))}
      </View>
      {/*
        **`tertiary`가 아니다.** 초안이라는 사실을 알리는 문장이라 반드시 읽혀야 하는데
        `inkTertiary`는 배경과 **2.96:1**(라이트, 실측)로 AA 4.5:1에 크게 미달했다.
        `inkSecondary`는 같은 자리에서 7:1 이상이다. 이 화면들의 안내 문구는 모두 이 톤이다.
      */}
      <AppText variant="caption" tone="secondary">
        이용약관과 개인정보처리방침은 검토 전 초안이에요.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  /* 워드마크는 가운데를 지키고 도구만 오른쪽 끝에 얹는다 — 절대 배치라 가운데 정렬이 흔들리지 않는다. */
  headRow: { width: '100%', justifyContent: 'center' },
  headTool: { position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center' },
  page: { flexGrow: 1, paddingHorizontal: spacing.xl, alignItems: 'center' },
  column: { width: '100%', maxWidth: 420, gap: spacing.xl },
  // 넓은 화면에서는 컬럼을 위아래 가운데에 둔다. 모바일은 키보드 때문에 위에서 시작한다.
  // `justifyContent: center`가 아니라 자동 여백을 쓴다. 내용이 화면보다 길어지면
  // 가운데 정렬은 위쪽을 잘라 스크롤로도 닿을 수 없게 만든다.
  columnCenter: { marginVertical: 'auto' },

  panel: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.xxl,
    gap: spacing.xl,
  },
  panelFlat: { backgroundColor: 'transparent', borderWidth: 0, padding: 0 },

  heading: { gap: spacing.sm },
  section: { gap: spacing.md },
  sectionHead: { gap: 2 },

  steps: { flexDirection: 'row', gap: spacing.xs },
  stepBar: { flex: 1, height: 3, borderRadius: radius.pill, backgroundColor: colors.offset },
  stepBarOn: { backgroundColor: colors.accent },

  labeled: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  labeledLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },

  /*
    인증 화면에서 가장 자주 눌리는 것이 이 링크들이다(회원가입·다른 방법으로 로그인·약관).
    커진 만큼 음수 마진으로 되돌려 패널 안 세로 리듬은 그대로 둔다.
  */
  link: {
    alignSelf: 'flex-start',
    minHeight: touch.min,
    justifyContent: 'center',
    marginVertical: -spacing.md,
  },
  error: { color: colors.danger },

  footer: { gap: spacing.md, alignItems: 'flex-start' },
  footerLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  footerLink: { minHeight: touch.min, justifyContent: 'center', marginVertical: -spacing.md },
});
