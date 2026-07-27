import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { SessionProvider } from '@/session';
import { ContentProvider } from '@/features/content';
import { ProgressProvider } from '@/features/progress';
import { AcademyStaffProvider } from '@/features/academy';
import { PricingProvider } from '@/features/pricing';
import { AuditProvider } from '@/features/audit';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  // 본문·제목은 Pretendard(레포에 번들, OFL). Space Grotesk는 "Scody" 워드마크에만 쓴다.
  // 키 이름은 `src/theme/tokens.ts`의 `typeface`·`FONT_KEYS`와 짝을 맞춘다.
  const [loaded] = useFonts({
    Pretendard_400Regular: require('../assets/fonts/Pretendard-Regular.ttf'),
    Pretendard_500Medium: require('../assets/fonts/Pretendard-Medium.ttf'),
    Pretendard_600SemiBold: require('../assets/fonts/Pretendard-SemiBold.ttf'),
    Pretendard_700Bold: require('../assets/fonts/Pretendard-Bold.ttf'),
    SpaceGrotesk_700Bold,
  });

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {/* 요금 정책·감사 로그는 계정과 무관한 서비스 설정이라 세션 밖에 둔다. */}
        <PricingProvider>
        <AuditProvider>
        <ContentProvider>
          {/* ProgressProvider는 로그인 계정별로 기록을 나누므로 SessionProvider 안에 있어야 한다. */}
          <SessionProvider>
            <ProgressProvider>
              <AcademyStaffProvider>
              <StatusBar style="auto" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.bg },
                }}
              />
              </AcademyStaffProvider>
            </ProgressProvider>
          </SessionProvider>
        </ContentProvider>
        </AuditProvider>
        </PricingProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
