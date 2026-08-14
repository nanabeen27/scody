import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';
import { AppText, Brand, Button, Group, Icon, ProgressBar, Row, ThemeToggle, SegmentedControl } from '@/components';
import { colors, control, spacing, radius, typeface } from '@/theme/tokens';
import { useResponsive } from '@/theme/useResponsive';
import { useSession } from '@/session';
import { homeHrefFor, ROLE_LABEL } from '@/session/routing';
import { DEV_ACCOUNTS, DEV_LOGIN_ENABLED } from '@/session/devAccounts';
import { LEGAL_DOCS } from '@/features/legal/documents';
import { Reveal } from './Reveal';

/** 소개 페이지에서 고르는 방문자 유형. 앱 역할(Role)과 달리 '선생님'은 학원 역할을 가리킨다. */
type Visitor = 'student' | 'parent' | 'teacher';

const VISITOR_TABS: { value: Visitor; label: string }[] = [
  { value: 'student', label: '학생' },
  { value: 'parent', label: '학부모' },
  { value: 'teacher', label: '선생님' },
];

/** 서비스 한 줄 소개. 확정 문구라 임의로 바꾸지 않는다. */
const INTRO = 'Scody는 학생의 학습을 가장 효율적으로 만드는 학습 플랫폼입니다.';

/**
 * 큰 제목의 줄바꿈 규칙. React Native Web은 기본이 `break-word`라
 * '만드/는 학습'처럼 한글 단어 중간이 끊긴다. 웹에서만 어절 단위로 되돌린다.
 */
const keepAll = (Platform.OS === 'web'
  ? { wordBreak: 'keep-all' }
  : {}) as unknown as TextStyle;

/** 제목 안 핵심 어구에 메인 컬러(청록)를 입히는 인라인 강조. 부모 Text의 크기·굵기는 상속. */
function Hi({ children }: { children: React.ReactNode }) {
  return <Text style={styles.hi}>{children}</Text>;
}

/**
 * 웹 소개 페이지(`/introduce`). 로그인·가입은 별도 화면에서 하고, 여기서는 무엇을 주는지만 말한다.
 *
 * 기획 기준:
 * - 페이지에서 가장 먼저 서비스 한 줄 소개(INTRO)를 말한다. 방문자는 여기서 무엇인지 판단한다.
 * - 학생·학부모·선생님은 필요한 내용이 다르므로 본문을 방문자 토글로 갈아 끼운다.
 * - 실제로 제공하는 것(학년·영역·유형별 문제와 해설)을 밝히고, 근거 없는 수치·지표는 넣지 않는다.
 * - 목업은 '예시 화면'으로 표시한다. 실제 사용자 데이터가 아니다.
 *
 * 간격·길이 기준(쏠북·뱅크샐러드에서 가져온 규칙):
 * - 띠(band)마다 위아래 여백을 다르게 준다. 모든 섹션이 같은 높이면 리듬이 사라진다.
 * - 섹션 머리는 '작은 회색 한 문장 → 큰 제목' 순서. 대문자 eyebrow는 한글에 쓰지 않는다.
 * - 한글 제목은 줄간격 1.35 이상, 자간을 음수로 조이지 않는다.
 */
export function WebLanding() {
  const { isMobile, isDesktop } = useResponsive();
  const router = useRouter();
  const { account, signInWithTestAccount } = useSession();
  const [visitor, setVisitor] = useState<Visitor>('student');
  // 목업이 440px 고정폭이라 태블릿(820)에서 2단으로 두면 본문 컬럼이 짜부라진다.
  const heroTwoCol = isDesktop;
  const view = VISITOR_VIEW[visitor];

  /** 개발용 계정으로 바로 들어간다. 실제 로그인 수단은 `/login`에 있다. */
  async function enterDemo(scodyId: string) {
    const result = await signInWithTestAccount(scodyId);
    if (result.ok && result.account) {
      router.replace(homeHrefFor(result.account) as never);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.page}>
      {/* 상단 바 — 워드마크 좌, 로그인·회원가입 우 */}
      <View style={styles.navOuter}>
        <View style={styles.navInner}>
          <View style={styles.navLeft}>
            <Brand />
            {/* 방문자 토글은 워드마크 옆. 모바일은 폭이 모자라 아래 줄로 내린다. */}
            {isMobile ? null : <VisitorToggle value={visitor} onChange={setVisitor} />}
          </View>
          <View style={styles.navRight}>
            {account ? (
              <Button
                testID="landing-mine"
                label="내 공간으로 가기"
                onPress={() => router.replace(homeHrefFor(account) as never)}
              />
            ) : (
              <>
                {/*
                  히어로 CTA가 이 화면의 primary다. 상단 바까지 채운 버튼을 두면 같은 화면에
                  주인공이 둘이 된다 — 무게로 갈라 둔다(§8).
                */}
                <Button
                  testID="landing-login"
                  variant="ghost"
                  label="로그인"
                  onPress={() => router.push('/login' as never)}
                />
                <Button
                  testID="landing-signup"
                  variant="secondary"
                  tone="accent"
                  label="회원가입"
                  onPress={() => router.push('/signup' as never)}
                />
              </>
            )}
          </View>
        </View>
        {isMobile ? (
          <View style={styles.navToggleRow}>
            <VisitorToggle value={visitor} onChange={setVisitor} />
          </View>
        ) : null}
      </View>

      {/* 히어로 — 한 줄 소개 → 유형별 약속 */}
      <Band pt={band.sm} pb={band.lg}>
        <View style={styles.introBlock}>
          <AppText variant="body" tone="secondary">
            고등 국어, 수능과 내신을 같이 준비해요
          </AppText>
          <AppText
            variant="display"
            style={[styles.introTitle, isMobile && styles.introTitleMobile]}
          >
            {INTRO}
          </AppText>
        </View>

        <View style={[styles.hero, heroTwoCol && styles.heroRow]}>
          <View style={[styles.heroText, heroTwoCol && styles.heroTextCol]}>
            <AppText variant="title" style={[styles.heroTitle, isMobile && styles.heroTitleMobile]}>
              {view.title}
            </AppText>
            <AppText variant="bodyLg" tone="secondary" style={styles.heroSub}>
              {view.sub}
            </AppText>
            <View style={styles.bulletList}>
              {view.bullets.map((b) => (
                <View key={b} style={styles.bullet}>
                  <Icon name="check" size={15} color={colors.accent} />
                  <AppText variant="body" tone="secondary">
                    {b}
                  </AppText>
                </View>
              ))}
            </View>
            {account ? null : (
              <View style={styles.heroActions}>
                <Button
                  testID="hero-signup"
                  label={view.cta}
                  onPress={() => router.push(view.ctaHref as never)}
                  style={styles.heroBtn}
                />
                <Button
                  testID="hero-login"
                  variant="secondary"
                  label="이미 계정이 있어요"
                  onPress={() => router.push('/login' as never)}
                  style={styles.heroBtn}
                />
              </View>
            )}
          </View>

          <View style={[styles.heroVisual, heroTwoCol && styles.heroVisualCol]}>
            {view.visual()}
          </View>
        </View>
      </Band>

      {/* 왜 해설과 오답노트인가 — 설계 근거를 출처와 함께 밝힌다 */}
      <EvidenceBand />

      {/* 방문자 유형별 본문 */}
      {visitor === 'student' ? <StudentSections isDesktop={isDesktop} /> : null}
      {visitor === 'parent' ? <ParentSections /> : null}
      {visitor === 'teacher' ? <TeacherSections /> : null}

      {/* 마지막 CTA */}
      <Band tone="accent" pt={band.md} pb={band.md}>
        <Reveal style={styles.finalWrap}>
          <AppText variant="title" style={styles.finalTitle}>
            오늘의 국어, 지금 시작해요
          </AppText>
          <AppText variant="bodyLg" style={styles.finalSub}>
            가입은 잠깐이면 돼요. 카카오나 휴대폰 번호로 시작할 수 있어요.
          </AppText>
          <View style={styles.finalActions}>
            <Button
              testID="final-signup"
              variant="secondary"
              label="회원가입"
              onPress={() => router.push('/signup' as never)}
              style={styles.finalBtn}
            />
            <Button
              testID="final-signup-academy"
              variant="secondary"
              label="학원으로 가입하기"
              onPress={() => router.push('/signup?role=academy' as never)}
              style={styles.finalBtn}
            />
          </View>
        </Reveal>
      </Band>

      {/* 푸터 + 테마 + 테스트 계정 */}
      <View style={styles.footer}>
        <View style={styles.footerInner}>
          <View style={styles.footerTop}>
            <Brand small />
            <AppText variant="caption" tone="tertiary">
              스코디 · 고등 국어 학습 플랫폼
            </AppText>
          </View>
          <View style={styles.footerLinks}>
            {LEGAL_DOCS.map((d) => (
              <Pressable
                key={d.slug}
                testID={`footer-${d.slug}`}
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
          <AppText variant="caption" tone="tertiary">
            이용약관과 개인정보처리방침은 검토 전 초안이에요. 사업자 등록 정보는 아직 없어요.
          </AppText>
          <View style={styles.footerTools}>
            <ThemeToggle />
          </View>
          {/*
            개발용 로그인이 꺼진 빌드에는 이 목록을 두지 않는다(D-135). 공개 소개
            페이지라서, 켜져 있으면 아무나 계정 목록을 보고 들어올 수 있다.
          */}
          {DEV_LOGIN_ENABLED ? <DemoAccounts onEnter={(id) => void enterDemo(id)} /> : null}
        </View>
      </View>
    </ScrollView>
  );
}

/* ---------- 방문자 유형 ---------- */

interface VisitorView {
  title: React.ReactNode;
  sub: string;
  bullets: string[];
  cta: string;
  ctaHref: string;
  visual: () => React.ReactElement;
}

const VISITOR_VIEW: Record<Visitor, VisitorView> = {
  student: {
    title: (
      <>
        오늘 풀 것만 딱,{'\n'}
        <Hi>고민 없이 시작해요.</Hi>
      </>
    ),
    sub: '학년·영역·유형으로 고른 문제와 해설이 있어요. 시험 범위에 맞춰 골라 풀 수도 있어요.',
    bullets: [
      '문항마다 정답 근거와 오답 이유까지 해설',
      '시험 범위만 골라 담아 내신 대비',
      '틀린 문제는 오답노트에서 다시 풀기',
      '틀린 유형과 같은 문제를 다음 학습으로 추천',
    ],
    cta: '학생으로 시작하기',
    ctaHref: '/signup',
    visual: () => <PhoneMock />,
  },
  parent: {
    title: (
      <>
        자녀 학습을{'\n'}
        <Hi>리포트로 확인해요.</Hi>
      </>
    ),
    sub: '오늘 공부했는지, 어느 영역이 약한지 한 화면에서 볼 수 있어요.',
    bullets: [
      '주간 학습 횟수와 평균 정답률',
      '영역별 약점과 반복해 틀리는 문제',
      '연결된 자녀의 오답노트 열람',
    ],
    cta: '학부모로 시작하기',
    ctaHref: '/signup',
    visual: () => <ChildSummaryMock />,
  },
  teacher: {
    title: (
      <>
        숙제를 내고,{'\n'}
        <Hi>제출을 바로 확인해요.</Hi>
      </>
    ),
    sub: '학원 반과 학생에게 학습을 배정하고, 제출과 정답률을 한곳에서 봐요.',
    bullets: [
      '반 단위 배정과 학생별 추가 배정',
      '제출 여부·정답률·미제출 학생 확인',
      '학원 학습과 개인 학습을 구분해 관리',
    ],
    cta: '학원으로 가입하기',
    ctaHref: '/signup?role=academy',
    visual: () => <AssignMock />,
  },
};

/** 방문자 유형 토글. 모양·동작은 공통 `SegmentedControl`에 있다(같은 것을 두 벌 두지 않는다). */
function VisitorToggle({ value, onChange }: { value: Visitor; onChange: (v: Visitor) => void }) {
  return <SegmentedControl testID="visitor" options={VISITOR_TABS} value={value} onChange={onChange} />;
}

/* ---------- 유형별 본문 ---------- */

function StudentSections({ isDesktop }: { isDesktop: boolean }) {
  return (
    <>
      <FeatureRow
        index="01"
        lead="무엇을 풀지 고민하는 시간이 가장 아까워요"
        title={
          <>
            개인 문제,{'\n'}
            <Hi>골라서 풀어요.</Hi>
          </>
        }
        body="학년과 영역, 유형을 고르면 그에 맞는 문제와 해설이 나와요. 학교 시험 범위대로 담아 풀 수도 있어요."
        bullets={[
          '고1·고2·고3, 문학·독서·문법·화법과 작문',
          '지문형은 지문과 함께, 문법형은 문항으로',
          '문제마다 해설이 붙어요',
        ]}
        visual={<PickMock />}
      />

      <FeatureRow
        reverse
        index="02"
        lead="정답만 아는 것과 왜 그런지 아는 것은 달라요"
        title={
          <>
            해설은{'\n'}
            <Hi>근거 문장까지.</Hi>
          </>
        }
        body="답이 왜 그 답인지, 고른 선택지가 왜 틀렸는지 문항마다 설명해요. 지문형은 근거가 되는 문장을 함께 짚어요."
        bullets={[
          '정답 근거와 오답 이유를 함께 설명',
          '지문형은 근거 문장 위치까지 표시',
          '해설을 읽고도 막히면 Scody AI에게 되묻기',
        ]}
        visual={<ExplainMock />}
      />

      <FeatureRow
        index="03"
        lead="틀린 문제를 그냥 넘기면 다음에 또 틀려요"
        title={
          <>
            틀린 문제,{'\n'}
            <Hi>이유까지 물어봐요.</Hi>
          </>
        }
        body="틀린 문제는 오답노트에 자동으로 담겨요. 왜 틀렸는지 Scody AI에게 물어보고, 정리한 내용은 노트로 남아요."
        bullets={[
          '틀린 문제 자동 정리',
          '고른 이유를 적고 AI에게 되묻기',
          '별표한 문제만 모아 복습',
        ]}
        visual={<WrongNoteMock />}
      />

      <Band tone="bg" pt={band.md} pb={band.md}>
        <Reveal>
          <View style={styles.centerHead}>
            <AppText variant="body" tone="secondary">
              정답률만 보고 끝나면 무엇을 더 할지 모르겠어요
            </AppText>
            <AppText variant="title" style={styles.centerTitle}>
              약점은 <Hi>비슷한 문제로</Hi> 고쳐요
            </AppText>
            <AppText variant="bodyLg" tone="secondary" style={styles.centerSub}>
              틀린 문항의 세부 유형을 세어 같은 유형 학습을 다음에 추천해요. 왜 추천했는지도 함께
              보여줘요.
            </AppText>
          </View>
        </Reveal>
        <View style={[styles.dualWrap, isDesktop && styles.dualRow]}>
          <Reveal style={isDesktop ? styles.dualHalf : undefined}>
            <WeaknessMock />
          </Reveal>
          <Reveal delay={120} style={isDesktop ? styles.dualHalf : undefined}>
            <RecommendMock />
          </Reveal>
        </View>
      </Band>

      <CompareSection />
    </>
  );
}

function ParentSections() {
  return (
    <>
      <FeatureRow
        index="01"
        lead="공부했는지 매번 묻지 않아도 돼요"
        title={
          <>
            오늘 했는지,{'\n'}
            <Hi>한 화면에서 알아요.</Hi>
          </>
        }
        body="이번 주 학습 횟수와 미완료 학습이 먼저 보여요. 자녀가 무엇을 풀었는지도 그대로 볼 수 있어요."
        bullets={[
          '이번 주 학습 횟수와 미완료 학습',
          '자녀가 푼 학습과 제출 결과',
          '자녀 연결은 초대 링크로',
        ]}
        visual={<ChildSummaryMock />}
      />

      <FeatureRow
        reverse
        index="02"
        lead="점수 하나로는 나아졌는지 알기 어려워요"
        title={
          <>
            달라진 만큼,{'\n'}
            <Hi>그래프로 보여요.</Hi>
          </>
        }
        body="영역별 정답률이 주마다 어떻게 움직이는지 리포트로 보여줘요. 반복해서 틀리는 문제도 따로 알려줘요."
        bullets={['영역별 정답률 추이', '반복 오답 문항 수', '자녀별로 나눠 보는 리포트']}
        visual={<ReportMock />}
      />

      <FeatureRow
        index="03"
        lead="약한 영역을 알면 도와줄 방법이 생겨요"
        title={
          <>
            어디가 약한지,{'\n'}
            <Hi>먼저 알려드려요.</Hi>
          </>
        }
        body="영역별로 정답률을 나눠 보여주고, 다음에 무엇을 풀면 좋은지 함께 알려줘요. 학원 학습과 개인 학습은 출처를 구분해 표시해요."
        bullets={['영역별 약점 정리', '다음 학습 추천', '개인 학습과 학원 학습 구분 표시']}
        visual={<WeaknessMock />}
      />
    </>
  );
}

function TeacherSections() {
  return (
    <>
      <FeatureRow
        index="01"
        lead="반마다 진도가 다르면 숙제 내기가 번거로워요"
        title={
          <>
            반과 학생에게,{'\n'}
            <Hi>한 번에 배정해요.</Hi>
          </>
        }
        body="반을 고르고 학습을 배정하면 학생 화면에 오늘 할 일로 들어가요. 학생별로 따로 더 줄 수도 있어요."
        bullets={['반 단위 배정', '학생별 추가 배정', '마감일 표시']}
        visual={<AssignMock />}
      />

      <FeatureRow
        reverse
        index="02"
        lead="누가 안 냈는지 찾는 데 시간을 쓰지 않아요"
        title={
          <>
            제출과 정답률,{'\n'}
            <Hi>바로 검사해요.</Hi>
          </>
        }
        body="배정한 학습마다 제출 현황과 평균 정답률이 모여요. 미제출 학생과 많이 틀린 문항을 먼저 보여줘요."
        bullets={['제출 여부와 평균 정답률', '미제출 학생 확인', '많이 틀린 문항 파악']}
        visual={<SubmitMock />}
      />

      <FeatureRow
        index="03"
        lead="학원이 준 학습과 학생이 고른 학습은 다르게 다뤄야 해요"
        title={
          <>
            학원과 개인,{'\n'}
            <Hi>출처를 구분해요.</Hi>
          </>
        }
        body="학원이 배정한 학습과 학생 개인 학습은 출처가 나뉘어 보여요. 학원은 배정한 학습의 결과만 봐요."
        bullets={['학원 학습·개인 학습 구분', '원장과 선생님 권한 분리', '반 담당 범위만 열람']}
        visual={<SourceSplitMock />}
      />
    </>
  );
}

/* ---------- 레이아웃 헬퍼 ---------- */

/**
 * 띠 하나의 위아래 여백 단계. 모든 섹션에 같은 값을 쓰지 않기 위해 이름을 붙였다.
 * xs: 스쳐 지나가는 띠 / sm: 바로 위 요소와 이어지는 곳 / md: 일반 섹션 / lg: 크게 쉬는 곳.
 */
const band = {
  xs: spacing.xxl, // 36
  sm: spacing.xl, // 24
  md: spacing.xxxl + spacing.lg, // 72
  lg: spacing.huge, // 88
} as const;

function Band({
  children,
  tone = 'bg',
  pt = band.md,
  pb = band.md,
}: {
  children: React.ReactNode;
  tone?: 'bg' | 'offset' | 'accent';
  pt?: number;
  pb?: number;
}) {
  const bg = tone === 'offset' ? colors.offset : tone === 'accent' ? colors.accent : colors.bg;
  return (
    <View style={[styles.section, { backgroundColor: bg }]}>
      <View style={[styles.sectionInner, { paddingTop: pt, paddingBottom: pb }]}>{children}</View>
    </View>
  );
}

const GRADES = ['고1', '고2', '고3'];

/**
 * 스코디가 해설과 오답노트에 집중한 근거. 교육학에서 성취도 영향 요인으로 다루는 것들이다.
 * 인용한 수치와 출처를 함께 적고, 논쟁이 있는 수치는 그 사실도 밝힌다.
 */
const EVIDENCE = [
  {
    claim: '답만 알려주면 잘 안 늘어요',
    detail: '왜 그 답인지 설명해 줄 때 학습 효과가 가장 컸어요.',
    figure: '설명 있는 해설 0.49 · 정답만 0.32 · 맞았는지만 0.05',
    source: 'Van der Kleij, Feskens & Eggen (2015)',
  },
  {
    claim: '틀린 문제는 다시 풀어야 남아요',
    detail: '눈으로 다시 읽는 것보다, 직접 다시 풀 때 오래 기억했어요.',
    figure: '다시 풀기 효과 0.50',
    source: 'Rowland (2014); Roediger & Karpicke (2006)',
  },
  {
    claim: '무엇이 틀렸는지 짚어주는 게 중요해요',
    detail: '피드백은 평균적으로 성적을 올렸어요. 다만 어떻게 알려주는지에 따라 차이가 컸어요.',
    figure: '피드백 평균 0.41',
    source: 'Kluger & DeNisi (1996); Hattie',
  },
];

/**
 * 설계 근거 띠. "우리가 대단하다"가 아니라 "무엇을 근거로 이 순서를 만들었다"를 말한다.
 * 스코디 자체의 성적 향상 수치는 주장하지 않는다(측정한 적이 없다).
 */
function EvidenceBand() {
  const { isDesktop } = useResponsive();
  return (
    <Band tone="offset" pt={band.md} pb={band.md}>
      <View style={[styles.evidenceLayout, isDesktop && styles.evidenceLayoutRow]}>
        <Reveal style={isDesktop ? styles.evidenceLead : undefined}>
          <AppText variant="body" tone="secondary">
            공부법은 취향으로 고르지 않아요
          </AppText>
          <AppText variant="title" style={styles.evidenceTitle}>
            성적을 올린다고{'\n'}
            <Hi>입증된 방법만</Hi> 담아요
          </AppText>
          <AppText variant="bodyLg" tone="secondary" style={styles.evidenceBody}>
            과학적으로 성적을 올리는 데 입증된 방식만을 적극적으로 반영하는 것이 Scody의 목표예요.
          </AppText>
          <AppText variant="body" tone="secondary" style={styles.evidenceFlow}>
            그래서 화면 순서도 이렇게 만들었어요.{'\n'}문제 풀기 → 자세한 해설 → 오답노트 → 같은
            유형 다시 풀기
          </AppText>
        </Reveal>

        <View style={isDesktop ? styles.evidenceList : styles.evidenceListMobile}>
          {EVIDENCE.map((e, i) => (
            <Reveal key={e.claim} delay={i * 80}>
              <View style={styles.evidenceItem}>
                <AppText variant="subheading">{e.claim}</AppText>
                <AppText variant="body" tone="secondary">
                  {e.detail}
                </AppText>
                <View style={styles.evidenceMeta}>
                  <AppText variant="caption" tone="accent" style={styles.aiName}>
                    {e.figure}
                  </AppText>
                  <AppText variant="caption" tone="tertiary">
                    {e.source}
                  </AppText>
                </View>
              </View>
            </Reveal>
          ))}
          <AppText variant="caption" tone="tertiary">
            숫자는 교육 연구에서 쓰는 효과 크기예요. 0.4 이상이면 의미 있는 차이로 봐요. 스코디를 쓴
            학생의 성적 변화는 아직 측정하지 않았어요.
          </AppText>
        </View>
      </View>
    </Band>
  );
}

function FeatureRow({
  index,
  lead,
  title,
  body,
  bullets,
  visual,
  reverse,
}: {
  index: string;
  lead: string;
  title: React.ReactNode;
  body: string;
  bullets: string[];
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  const { isDesktop: row } = useResponsive();
  return (
    <Band tone={reverse ? 'offset' : 'bg'} pt={band.md} pb={band.md}>
      <View style={[styles.feature, row && (reverse ? styles.featureRowRev : styles.featureRow)]}>
        <Reveal style={row ? styles.featureHalf : undefined}>
          <View style={styles.featureIndexRow}>
            <AppText variant="eyebrow" tone="accent" style={styles.featureIndex}>
              {index}
            </AppText>
            <AppText variant="caption" tone="secondary">
              {lead}
            </AppText>
          </View>
          <AppText variant="title" style={styles.featureTitle}>
            {title}
          </AppText>
          <AppText variant="bodyLg" tone="secondary" style={styles.featureBody}>
            {body}
          </AppText>
          <View style={styles.bulletList}>
            {bullets.map((b) => (
              <View key={b} style={styles.bullet}>
                <Icon name="check" size={15} color={colors.accent} />
                <AppText variant="body" tone="secondary">
                  {b}
                </AppText>
              </View>
            ))}
          </View>
        </Reveal>
        <Reveal
          delay={120}
          style={
            row
              ? [styles.featureHalf, { alignItems: reverse ? 'flex-start' : 'flex-end' }]
              : styles.featureVisualMobile
          }
        >
          {visual}
        </Reveal>
      </View>
    </Band>
  );
}

/** 미리보기의 한 줄(라벨 좌 · 값 우). 값만 굵게 — 뱅크샐러드 목록 규칙. */
function PreviewLine({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.previewLine}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <AppText variant="caption" tone={strong ? 'accent' : 'default'} style={styles.previewValue}>
        {value}
      </AppText>
    </View>
  );
}

/** 목업 머리 — 무엇을 보여주는 화면인지와 예시임을 함께 밝힌다. */
function MockHead({ title }: { title: string }) {
  return (
    <View style={styles.mockRow}>
      <AppText variant="label">{title}</AppText>
      <AppText variant="caption" tone="tertiary">
        예시 화면
      </AppText>
    </View>
  );
}

/* ---------- 미리보기 목업(제품 화면 대체) ---------- */

function PhoneMock() {
  return (
    <View style={styles.phone}>
      <View style={styles.phoneHeader}>
        <Brand small />
        <AppText variant="caption" tone="tertiary">
          예시 화면
        </AppText>
      </View>
      <View style={styles.phoneHero}>
        <AppText variant="caption" tone="secondary">
          오늘의 학습
        </AppText>
        <AppText variant="subheading">현대소설 · 지문 독해</AppText>
        <AppText variant="caption" tone="secondary">
          12문항 · 약 15분
        </AppText>
        <View style={styles.phonePrimary}>
          <AppText variant="label" style={{ color: colors.accentText }}>
            시작하기
          </AppText>
        </View>
      </View>
      <View style={styles.phoneProgress}>
        <View style={styles.phoneProgressHead}>
          <AppText variant="caption" tone="secondary">
            오늘 진행률
          </AppText>
          <AppText variant="caption" tone="secondary">
            2/5
          </AppText>
        </View>
        <ProgressBar value={40} />
      </View>
      <Group>
        <Row title="문법 · 음운의 변동" subtitle="학원 과제 · 오늘 마감" />
        <Row title="오답 복습 5문항" subtitle="지난 학습에서 틀린 문제" />
      </Group>
    </View>
  );
}

/** 개인 문제를 고르는 화면. 학년·영역·유형으로 좁혀 담는다. */
function PickMock() {
  return (
    <View style={styles.mockCard}>
      <MockHead title="문제 고르기" />
      <View style={styles.pickRow}>
        {GRADES.map((g, i) => (
          <View key={g} style={[styles.pickSegment, i === 0 && styles.pickSegmentOn]}>
            <AppText
              variant="caption"
              tone={i === 0 ? 'accent' : 'secondary'}
              style={i === 0 ? styles.previewValue : undefined}
            >
              {g}
            </AppText>
          </View>
        ))}
      </View>
      <Group>
        <Row title="문학 · 현대소설" subtitle="지문형 · 해설 포함" meta="12문항" />
        <Row title="문법 · 음운의 변동" subtitle="문법형 · 해설 포함" meta="8문항" />
        <Row title="독서 · 과학 지문" subtitle="지문형 · 해설 포함" meta="10문항" />
      </Group>
      <AppText variant="caption" tone="tertiary">
        시험 범위에 맞춰 영역과 유형을 골라 담아요.
      </AppText>
    </View>
  );
}

/** 해설 화면. 정답 근거와 오답 이유를 함께 보여주는 형태를 그대로 옮겼다. */
function ExplainMock() {
  return (
    <View style={styles.mockCard}>
      <MockHead title="3번 문항 해설" />
      <View style={styles.explainRow}>
        <View style={[styles.explainTag, { backgroundColor: colors.accentSoft }]}>
          <AppText variant="caption" tone="accent" style={styles.aiName}>
            정답 ②
          </AppText>
        </View>
        <AppText variant="caption" tone="secondary" style={styles.itemFlex}>
          3문단 &lsquo;그러나&rsquo; 뒤 문장이 근거예요. 앞 문장과 반대되는 주장을 담고 있어요.
        </AppText>
      </View>
      <View style={styles.explainRow}>
        <View style={[styles.explainTag, { backgroundColor: colors.offset }]}>
          <AppText variant="caption" tone="secondary" style={styles.aiName}>
            내가 고른 ④
          </AppText>
        </View>
        <AppText variant="caption" tone="secondary" style={styles.itemFlex}>
          2문단 내용을 확대해석했어요. 지문에는 &lsquo;모든&rsquo;이라는 범위가 없어요.
        </AppText>
      </View>
      <View style={styles.mockTag}>
        <Icon name="check" size={14} color={colors.success} />
        <AppText variant="caption" tone="secondary">
          문항마다 근거와 오답 이유를 함께 적어요
        </AppText>
      </View>
    </View>
  );
}

/** 오답에서 나온 추천. 추천 이유를 그대로 보여준다(제품 화면과 같은 문장 형태). */
function RecommendMock() {
  return (
    <View style={styles.mockCard}>
      <MockHead title="이어서 풀 학습" />
      <Group>
        <Row title="음운의 변동 심화" subtitle="문법 · 음운의 변동에서 2문항 틀렸어요" meta="8문항" />
        <Row title="표준 발음 점검" subtitle="문법 · 어문 규정 - 표준 발음에서 1문항 틀렸어요" meta="10문항" />
      </Group>
      <View style={styles.mockTag}>
        <Icon name="check" size={14} color={colors.accent} />
        <AppText variant="caption" tone="secondary">
          틀린 문항의 유형을 세어 고른 학습이에요
        </AppText>
      </View>
    </View>
  );
}

/** 학부모가 보는 자녀 요약. 실제 이름 대신 '자녀'로 둔다. */
function ChildSummaryMock() {
  return (
    <View style={styles.mockCard}>
      <MockHead title="자녀 · 이번 주" />
      <PreviewLine label="학습 횟수" value="5회" />
      <PreviewLine label="평균 정답률" value="78%" strong />
      <PreviewLine label="반복 오답" value="3문항" />
      <PreviewLine label="미완료 학습" value="1개" />
      <View style={styles.mockTag}>
        <Icon name="check" size={14} color={colors.success} />
        <AppText variant="caption" tone="secondary">
          어제 학습을 마쳤어요
        </AppText>
      </View>
    </View>
  );
}

/** 학원이 반에 학습을 배정한 화면. */
function AssignMock() {
  return (
    <View style={styles.mockCard}>
      <MockHead title="학습 배정" />
      <Group>
        <Row title="고2 A반" subtitle="문학 · 현대소설 12문항" meta="오늘 마감" />
        <Row title="고3 B반" subtitle="문법 · 음운의 변동 8문항" meta="내일 마감" />
      </Group>
      <AppText variant="caption" tone="tertiary">
        반 단위로 배정하고, 학생별로 더 줄 수 있어요.
      </AppText>
    </View>
  );
}

/** 배정한 학습의 제출 현황. */
function SubmitMock() {
  return (
    <View style={styles.mockCard}>
      <MockHead title="제출 현황 · 고2 A반" />
      <PreviewLine label="제출" value="21/24" strong />
      <PreviewLine label="평균 정답률" value="76%" />
      <View style={styles.previewProgress}>
        <View style={styles.previewProgressHead}>
          <AppText variant="caption" tone="tertiary">
            수행률
          </AppText>
          <AppText variant="caption" tone="tertiary">
            87%
          </AppText>
        </View>
        <ProgressBar value={87} />
      </View>
      <View style={styles.mockTag}>
        <Icon name="check" size={14} color={colors.accent} />
        <AppText variant="caption" tone="secondary">
          미제출 학생을 따로 모아 볼 수 있어요
        </AppText>
      </View>
    </View>
  );
}

/** 학원 학습과 개인 학습의 출처 구분. */
function SourceSplitMock() {
  return (
    <View style={styles.mockCard}>
      <MockHead title="학습 목록" />
      <Group>
        <Row title="음운의 변동" subtitle="학원 학습 · 학원이 배정" meta="검사 대기" />
        <Row title="현대소설 독해" subtitle="개인 학습 · 학생이 고름" meta="완료" />
      </Group>
      <AppText variant="caption" tone="tertiary">
        학원은 배정한 학습의 결과만 봐요. 개인 학습은 학생 것이에요.
      </AppText>
    </View>
  );
}

function WrongNoteMock() {
  return (
    <View style={styles.mockCard}>
      <View style={styles.mockRowLeft}>
        <View style={[styles.dot, { backgroundColor: colors.danger }]} />
        <AppText variant="label">비문학 · 과학 지문 3번</AppText>
      </View>
      <AppText variant="caption" tone="secondary">
        선택지 분석에서 근거 문장을 잘못 연결했어요.
      </AppText>
      <View style={styles.aiBubble}>
        <AppText variant="caption" tone="accent" style={styles.aiName}>
          Scody AI
        </AppText>
        <AppText variant="caption" tone="secondary">
          3번은 &lsquo;그러나&rsquo; 뒤 문장이 핵심이에요. 앞 문장과 반대되는 근거를 먼저 찾아볼까요?
        </AppText>
      </View>
      <View style={styles.mockTag}>
        <Icon name="check" size={14} color={colors.success} />
        <AppText variant="caption" tone="secondary">
          노트에 정리 완료
        </AppText>
      </View>
    </View>
  );
}

const WEAK = [
  { name: '화법과 작문', pct: 90 },
  { name: '문학', pct: 82 },
  { name: '문법', pct: 71 },
  { name: '독서(비문학)', pct: 58, weak: true },
];

function WeaknessMock() {
  return (
    <View style={styles.mockCard}>
      <MockHead title="영역별 정답률" />
      <View style={styles.weakList}>
        {WEAK.map((w) => (
          <View key={w.name} style={styles.weakItem}>
            <View style={styles.weakLabelRow}>
              <AppText variant="caption" tone={w.weak ? 'default' : 'secondary'}>
                {w.name}
              </AppText>
              <AppText
                variant="caption"
                tone={w.weak ? 'default' : 'secondary'}
                style={w.weak ? styles.weakPct : undefined}
              >
                {w.pct}%
              </AppText>
            </View>
            <View style={styles.weakTrack}>
              <View
                style={[
                  styles.weakFill,
                  { width: `${w.pct}%`, backgroundColor: w.weak ? colors.danger : colors.accent },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
      <View style={styles.weakTag}>
        <AppText variant="caption" tone="accent" style={styles.aiName}>
          독서(비문학)부터 잡아요
        </AppText>
        <AppText variant="caption" tone="secondary">
          다음 학습에서 이 영역을 먼저 추천해요.
        </AppText>
      </View>
    </View>
  );
}

const REPORT = [54, 61, 63, 72, 79, 86];

function ReportMock() {
  const W = 320;
  const H = 150;
  const pad = 10;
  const yMin = 40;
  const yMax = 100;
  const x = (i: number) => pad + (i * (W - pad * 2)) / (REPORT.length - 1);
  const y = (v: number) => pad + ((yMax - v) / (yMax - yMin)) * (H - pad * 2);
  const line = REPORT.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const area = `M ${x(0)},${H - pad} L ${REPORT.map((v, i) => `${x(i)},${y(v)}`).join(' L ')} L ${x(
    REPORT.length - 1,
  )},${H - pad} Z`;
  const grid = [40, 60, 80, 100];
  return (
    <View style={styles.mockCard}>
      <View style={styles.mockRow}>
        <View>
          <AppText variant="label">최근 6주 정답률</AppText>
          <AppText variant="caption" tone="tertiary">
            비문학 영역 · 예시 화면
          </AppText>
        </View>
        <View style={styles.deltaBadge}>
          <AppText variant="caption" tone="accent" style={styles.aiName}>
            +32%p
          </AppText>
        </View>
      </View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {grid.map((g) => (
          <Line
            key={g}
            x1={pad}
            x2={W - pad}
            y1={y(g)}
            y2={y(g)}
            stroke={colors.border}
            strokeWidth={1}
          />
        ))}
        <Path d={area} fill={colors.accentSoft} />
        <Polyline points={line} fill="none" stroke={colors.accent} strokeWidth={3} />
        {REPORT.map((v, i) => (
          <Circle
            key={i}
            cx={x(i)}
            cy={y(v)}
            r={i === REPORT.length - 1 ? 5 : 3.5}
            fill={colors.accent}
          />
        ))}
      </Svg>
      <View style={styles.reportAxis}>
        {['1주', '2주', '3주', '4주', '5주', '6주'].map((w) => (
          <AppText key={w} variant="caption" tone="tertiary">
            {w}
          </AppText>
        ))}
      </View>
    </View>
  );
}

/* ---------- 비교(일반 공부 vs 스코디) ---------- */

const PLAIN = [
  '뭘 풀지 매번 고민',
  '틀려도 그냥 넘어감',
  '약점을 모른 채 반복',
  '성적 변화가 안 보임',
];
const SCODY = [
  '오늘 풀 것만 딱 정해줘요',
  '틀리면 오답노트 + AI 복습',
  '약점을 콕 집어 추천',
  '리포트로 성장 확인',
];

function CompareSection() {
  const { isMobile } = useResponsive();
  const row = !isMobile;
  return (
    <Band tone="offset" pt={band.md} pb={band.md}>
      <Reveal>
        <View style={styles.centerHead}>
          <AppText variant="body" tone="secondary">
            문제집만으로 국어를 준비하기는 어려워요
          </AppText>
          <AppText variant="title" style={styles.centerTitle}>
            혼자 하던 국어, <Hi>이렇게 달라져요</Hi>
          </AppText>
        </View>
      </Reveal>
      <View style={[styles.compareWrap, row && styles.compareRow]}>
        <Reveal style={row ? styles.compareHalf : undefined}>
          <View style={styles.comparePlain}>
            <AppText variant="subheading" tone="secondary">
              그냥 문제집으로
            </AppText>
            <View style={styles.compareList}>
              {PLAIN.map((t) => (
                <View key={t} style={styles.compareItem}>
                  <View style={styles.compareDash} />
                  <AppText variant="body" tone="secondary">
                    {t}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        </Reveal>
        <Reveal delay={120} style={row ? styles.compareHalf : undefined}>
          <View style={styles.compareScody}>
            <Brand small />
            <View style={styles.compareList}>
              {SCODY.map((t) => (
                <View key={t} style={styles.compareItem}>
                  <Icon name="check" size={16} color={colors.accent} />
                  <AppText variant="body">{t}</AppText>
                </View>
              ))}
            </View>
          </View>
        </Reveal>
      </View>
    </Band>
  );
}

/* ---------- 테스트 계정 ---------- */

function DemoAccounts({ onEnter }: { onEnter: (scodyId: string) => void }) {
  const [show, setShow] = useState(false);
  // seed가 만든 개발용 계정. 로그인 전에는 DB에서 아무것도 읽을 수 없어 목록이 클라이언트에 있다.
  const accounts = DEV_ACCOUNTS;
  return (
    <View style={styles.demoBox}>
      <Pressable onPress={() => setShow((v) => !v)} accessibilityRole="button">
        <AppText variant="caption" tone="tertiary">
          {show ? '테스트 계정 숨기기' : '테스트 계정 보기'}
        </AppText>
      </Pressable>
      {show ? (
        <>
          <AppText variant="caption" tone="tertiary">
            개발용 계정이에요. 실제 사용자 데이터가 아니에요.
          </AppText>
          <Group>
            {accounts.map((a) => (
              <Row
                key={a.scodyId}
                title={`${a.name} · ${a.roles.map((r) => ROLE_LABEL[r]).join('/')}`}
                subtitle={a.note}
                onPress={() => onEnter(a.scodyId)}
                showChevron
              />
            ))}
          </Group>
        </>
      ) : null}
    </View>
  );
}

const MAXW = 1040;

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  page: { paddingBottom: 0 },
  hi: { color: colors.accent },

  navOuter: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.bg,
  },
  navInner: {
    width: '100%',
    maxWidth: MAXW,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  navToggleRow: {
    width: '100%',
    maxWidth: MAXW,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },

  section: { width: '100%', alignItems: 'center' },
  sectionInner: { width: '100%', maxWidth: MAXW, paddingHorizontal: spacing.xl },

  // 한 줄 소개 — 페이지에서 가장 먼저 읽히는 문장.
  introBlock: { gap: spacing.md, maxWidth: 760 },
  introTitle: { ...keepAll, fontSize: 42, lineHeight: 58, letterSpacing: -0.2, marginTop: spacing.xs },
  introTitleMobile: { fontSize: 30, lineHeight: 42 },

  // 히어로 — 제목·본문·행동 사이 간격을 서로 다르게 준다.
  hero: { gap: spacing.xxl, marginTop: spacing.xxl },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.huge },
  heroText: { gap: spacing.md },
  heroTextCol: { flex: 1 },
  heroTitle: { ...keepAll, fontSize: 34, lineHeight: 46, letterSpacing: -0.2 },
  heroTitleMobile: { fontSize: 28, lineHeight: 40 },
  heroSub: { maxWidth: 460, marginTop: spacing.xs },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  heroBtn: { height: 52, borderRadius: radius.lg, paddingHorizontal: spacing.xl },

  heroVisual: { alignItems: 'center' },
  heroVisualCol: { flex: 1 },

  // 설계 근거 — 왼쪽에 메시지, 오른쪽에 근거 목록. 카드로 감싸지 않는다.
  evidenceLayout: { gap: spacing.xxl },
  evidenceLayoutRow: { flexDirection: 'row', gap: spacing.huge, alignItems: 'flex-start' },
  evidenceLead: { flex: 1 },
  evidenceTitle: { ...keepAll, marginTop: spacing.sm, fontSize: 32, lineHeight: 44 },
  evidenceBody: { marginTop: spacing.lg, maxWidth: 420 },
  evidenceFlow: { marginTop: spacing.lg, maxWidth: 420 },
  evidenceList: { flex: 1, gap: spacing.xl },
  evidenceListMobile: { gap: spacing.xl },
  evidenceItem: {
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
    paddingTop: spacing.md,
  },
  evidenceMeta: { gap: 2, marginTop: spacing.xs },

  compareWrap: { gap: spacing.lg },
  compareRow: { flexDirection: 'row', gap: spacing.xl, alignItems: 'stretch' },
  compareHalf: { flex: 1 },
  comparePlain: {
    height: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
  },
  compareScody: {
    height: '100%',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  compareList: { gap: spacing.md, marginTop: spacing.xs },
  compareItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  compareDash: {
    width: 14,
    height: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.inkTertiary,
  },

  phone: {
    width: '100%',
    maxWidth: 300,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  phoneHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  phoneHero: {
    backgroundColor: colors.offset,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  phonePrimary: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneProgress: { gap: spacing.sm },
  phoneProgressHead: { flexDirection: 'row', justifyContent: 'space-between' },

  // 소개 블록 — 제목 아래 본문·목록 간격을 단계적으로 벌린다.
  feature: { gap: spacing.xxl },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.huge },
  featureRowRev: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.huge },
  featureHalf: { flex: 1 },
  featureVisualMobile: { alignItems: 'center' },
  featureIndexRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  featureIndex: { opacity: 0.6 },
  featureTitle: {
    ...keepAll,
    marginTop: spacing.md,
    fontSize: 32,
    lineHeight: 44,
    letterSpacing: -0.2,
  },
  featureBody: { marginTop: spacing.md, maxWidth: 440 },
  bulletList: { marginTop: spacing.xl, gap: spacing.sm },
  bullet: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  mockCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
  },
  mockRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  mockRowLeft: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 999, marginRight: spacing.sm },
  aiBubble: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  aiName: { fontFamily: typeface.semibold },
  mockTag: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },

  explainRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  explainTag: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  itemFlex: { flex: 1 },

  // 소개 페이지의 정지 화면 미리보기. 실제 `SegmentedControl`과 같은 모양이어야
  // 소개가 앱과 어긋나지 않는다(누를 수 없으므로 컴포넌트를 쓰지는 않는다).
  pickRow: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: colors.offset,
    borderRadius: control.trackRadius,
    padding: control.trackPadding,
    gap: control.gap,
  },
  pickSegment: {
    paddingVertical: control.paddingY,
    paddingHorizontal: control.paddingX,
    borderRadius: control.itemRadius,
  },
  pickSegmentOn: { backgroundColor: colors.surface },

  weakList: { gap: spacing.md, marginVertical: spacing.xs },
  weakItem: { gap: spacing.xs },
  weakLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weakPct: { fontFamily: typeface.semibold },
  weakTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.offset,
    overflow: 'hidden',
  },
  weakFill: { height: '100%', borderRadius: radius.pill },
  weakTag: {
    marginTop: spacing.xs,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 2,
  },

  deltaBadge: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  reportAxis: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 },

  // 가운데 머리 — 작은 회색 한 문장 → 큰 제목 → 보조 문장.
  centerHead: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xxl },
  centerTitle: {
    ...keepAll,
    textAlign: 'center',
    fontSize: 32,
    lineHeight: 44,
    letterSpacing: -0.2,
  },
  centerSub: { textAlign: 'center', maxWidth: 600, marginTop: spacing.xs },

  dualWrap: { gap: spacing.lg, alignItems: 'center' },
  dualRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  dualHalf: { flex: 1 },

  previewLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  previewValue: { fontFamily: typeface.semibold },
  previewProgress: { gap: spacing.xs, marginTop: spacing.md },
  previewProgressHead: { flexDirection: 'row', justifyContent: 'space-between' },

  finalWrap: { alignItems: 'center', gap: spacing.sm },
  finalTitle: {
    ...keepAll,
    color: colors.accentText,
    textAlign: 'center',
    fontSize: 32,
    lineHeight: 44,
    letterSpacing: -0.2,
  },
  finalSub: { color: colors.accentText, opacity: 0.9, textAlign: 'center', maxWidth: 480 },
  finalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.xl,
    justifyContent: 'center',
  },
  finalBtn: { height: 52, borderRadius: radius.lg, paddingHorizontal: spacing.xl },

  footer: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footerInner: {
    width: '100%',
    maxWidth: MAXW,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.lg,
  },
  footerTop: { gap: spacing.xs },
  footerLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  footerLink: { paddingVertical: 2 },
  footerTools: { alignSelf: 'flex-start' },
  demoBox: { gap: spacing.md, alignItems: 'flex-start' },
});
