import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import Feather from '@expo/vector-icons/Feather';
import { SessionProvider } from '@/session';
import { ContentProvider } from '@/features/content';
import { ProgressProvider } from '@/features/progress';
import { AcademyStaffProvider } from '@/features/academy';
import { PricingProvider } from '@/features/pricing';
import { AuditProvider } from '@/features/audit';
import { ToastProvider } from '@/features/toast';
import { ImpersonationBanner } from '@/components';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { applyWebIcons } from '@/theme/webHead';
import { SOURCES } from '@/theme/fonts';
import { useFontsReady } from '@/theme/useFontsReady';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  /*
    본문·제목은 Pretendard(레포에 번들, OFL). Space Grotesk는 "Scody" 워드마크에만 쓴다.
    파일과 패밀리 이름은 플랫폼마다 다르다 — `src/theme/fonts.ts`(네이티브 TTF)와
    `fonts.web.ts`(woff2 서브셋)에 함께 두어 `typeface`와 어긋나지 않게 한다.

    **아이콘 폰트(`Feather.font`)를 같은 배치에 넣는다.** 이게 없으면 첫 진입에서 폰트가
    두 번 바뀐다: `expo-font`의 웹 구현이 `document.head.appendChild(style)`로 **이미 붙어
    있는 `<style>`을 다시 붙이는데**(remove→insert), 그러면 CSSOM이 재파싱되어 **이미 받아
    둔 폰트가 전부 무효화된다.** `Icon`이 처음 마운트되며 feather를 따로 부르는 시점이
    하필 아래 게이트가 풀린 직후라, 게이트가 지킨 폰트를 게이트가 풀리자마자 스스로 버렸다.
    같은 배치로 등록하면 나중 호출이 `if (isLoaded(...)) return;`에서 즉시 되돌아간다.
  */
  const [loaded, error] = useFonts({ ...SOURCES, SpaceGrotesk_700Bold, ...Feather.font });
  // 규칙이 등록된 뒤에만 켠다. 등록 전에는 `document.fonts.ready`가 즉시 resolve된다.
  const fontsReady = useFontsReady(loaded);

  // 파비콘 링크는 Expo 웹 템플릿에 없어서 문서에 직접 붙인다(`src/theme/webHead.ts` 주석 참고).
  useEffect(() => {
    applyWebIcons();
  }, []);

  /*
    **폰트를 못 받아도 화면은 뜬다.** 예전에는 `error`를 받지 않아, 회선이 느려
    `FontFaceObserver`의 12초 타임아웃을 넘기면 `loaded`가 영원히 거짓이 되어
    **화면이 흰 채로 굳었다**(1.6Mbps에서 60초까지 확인). 폰트를 못 받는 것보다
    앱이 안 뜨는 것이 나쁘다 — 실패하면 폴백으로라도 그린다.

    성공했을 때는 `fontsReady`까지 기다린다. 그래야 첫 글자가 폴백으로 한 번
    그려졌다 바뀌는 일이 없다(실측 비용: 프로덕션 첫 페인트 +111ms).
  */
  if (!error && (!loaded || !fontsReady)) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {/* ProgressProvider는 로그인 계정별로 기록을 나누므로 SessionProvider 안에 있어야 한다. */}
        <SessionProvider>
          {/*
            AuditProvider·PricingProvider·ContentProvider가 모두 SessionProvider 안이다 —
            쓰기를 들고 있는 provider는 세션 안에 둔다(D-116). ① 대리 보기 중 쓰기를 거부하려면
            `readOnly`를 읽어야 하고(D-071) ② 서버에서 읽는 범위가 역할에 따라 달라서
            (감사 로그는 `is_admin()`, 요금 정책은 운영자만) 계정이 바뀌면 다시 읽어야 한다.
            `session.tsx`는 여전히 감사 로그를 부르지 않는다 — 대리 보기 종료 정보를 호출부에
            돌려주므로 의존 방향이 한쪽이다.
          */}
          <AuditProvider>
            <PricingProvider>
            <ContentProvider>
            {/*
              AcademyStaffProvider가 ProgressProvider보다 바깥이다 — 배정 권한 검사와 학원
              오답노트 열람이 '지금 살아 있는 반 목록'을 봐야 하고, 그 목록은 fixture가 아니라
              학원 provider가 갖는다(원장이 만든 반·폐강·학생 이동을 반영, D-063).
            */}
            <AcademyStaffProvider>
            <ProgressProvider>
              {/* 한 줄 알림은 화면 위에 떠야 해서 라우터를 감싸는 가장 안쪽에 둔다. */}
              <ToastProvider>
              <StatusBar style="auto" />
              {/*
                대리 보기 배너는 `<Stack>`과 나란히 둔다 — `RoleShell`에 두면 그 밖의 화면
                (`/select-space`·`/login`·`/legal/*`)에서 배너·`끝내기`·만료 타이머가 사라진다.
                다역할 계정을 대리하면 시작 직후 `/select-space`로 가므로 실제로 도달한다(A-061).
                감사 로그(`AuditProvider`)와 세션이 모두 위에 있어야 하는 자리다.
              */}
              <ImpersonationBanner />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.bg },
                }}
              />
              </ToastProvider>
            </ProgressProvider>
            </AcademyStaffProvider>
            </ContentProvider>
            </PricingProvider>
          </AuditProvider>
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
