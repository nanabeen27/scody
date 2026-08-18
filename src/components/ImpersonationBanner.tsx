import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { useSession, IMPERSONATION_MINUTES } from '@/session';
import { useAudit } from '@/features/audit';
import { colors, radius, spacing, typeface } from '@/theme/tokens';

/**
 * 대리 보기를 끝내는 유일한 동작. 배너와 대상 계정의 `내 정보`가 함께 쓴다.
 *
 * 세 가지를 한 번에 한다. ① 세션 되돌리기 ② **종료를 감사 로그에 남기기**(열어 본 화면 수와
 * 경로, 종료 사유 — 개인정보 안전성 확보조치 기준 제8조의 '수행업무') ③ 운영자 라우트로 보내기.
 *
 * 끝낼 때 **운영자 라우트로 보내야 한다.** 계정만 되돌리면 화면은 아직 대상의 라우트에 있고
 * (예: `/student/solve/...`) 운영자에게는 그 역할이 없어서 역할 가드가 `/login`으로 보낸다 —
 * 운영자가 로그아웃된 것처럼 보인다(실측으로 확인했다). 시간 만료도 같은 경로를 탄다.
 *
 * **목적지는 조사하던 계정 상세**(`/admin/user/{대상}`)다. 운영자 라우트이므로 위의 역할 가드
 * 문제는 그대로 해결되고, 대리 보기는 늘 그 화면에서 시작하므로 끝낸 자리가 시작한 자리다 —
 * 예전에는 `/admin`(개요)으로 보내서, 방금 본 것을 열람 기록에서 확인하거나 다시 열려면
 * **계정 검색을 처음부터 다시** 해야 했다. `등록을 마치면 방금 만든 것을 보여 준다`와 같은
 * 판단이다(DESIGN.md §20). 시간 만료도 같은 목적지다 — 어디를 열어 보던 중이었는지와 무관하게
 * 조사 대상은 하나다.
 *
 * 기록을 `SessionProvider`가 아니라 여기서 남기는 이유는 `session.tsx`의 `ImpersonationEnd`
 * 주석에 있다(세션이 감사 로그 provider에 의존하지 않게 한다).
 */
export function useFinishImpersonation() {
  const { endImpersonation } = useSession();
  const { log } = useAudit();
  const router = useRouter();

  return useCallback(
    async (why: '수동 종료' | '시간 만료') => {
      const ended = endImpersonation(why);
      if (!ended) return;
      const seen = ended.visited.length
        ? `열어 본 화면 ${ended.visited.length}개: ${ended.visited.join(' · ')}`
        : '열어 본 화면 0개';
      /*
        **기록을 남긴 뒤에 화면을 옮긴다.** 종료 기록은 개인정보 안전성 확보조치 기준 제8조의
        '수행업무'에 해당해서, 남지 않은 채로 대리가 끝나면 안 된다.
      */
      await log({
        actor: ended.operator.name,
        action: '대리 보기',
        subjectId: ended.target.userId,
        detail: `대리 보기 종료 · ${ended.target.name}(${ended.target.userId}) · ${ended.why} · ${seen}`,
      });
      router.replace(`/admin/user/${ended.target.userId}` as never);
    },
    [endImpersonation, log, router],
  );
}

/**
 * 대리 보기 중임을 알리는 상시 배너.
 *
 * **모든 화면 위에 있어야 한다.** 조용한 대리는 운영 사고다 — 운영자가 자기가 누구로 보고
 * 있는지 잊고 조작한다. 그래서 `RoleShell`이 아니라 **`app/_layout.tsx`에서 `<Stack>`과 나란히**
 * 둔다. `RoleShell`의 세 반환 경로에 넣었을 때는 ① `RoleShell` 밖 화면(`/select-space`·
 * `/login`·`/legal/*`)에 배너·`끝내기`·만료 타이머가 전부 없었고 — 다역할 계정을 대리하면
 * 시작 직후 바로 `/select-space`로 간다 — ② 데스크톱 경로에서 배너가 `flexDirection: 'row'`
 * 컨테이너의 첫 자식이라 가로 막대가 아니라 사이드바 왼쪽의 세로 띠로 눌렸다.
 *
 * 노치는 배너가 직접 처리한다(`SafeAreaView edges={['top']}`). 루트에 있어 위에 아무것도 없다.
 *
 * **면은 `notice`다**(D-147). `danger`는 쓰지 않는다 — 오답·오류·파괴적 행동의 색이라 상시 배너를
 * 그 색으로 두면 오답률 신호가 죽는다. 예전에는 `offset`이었는데 본문과 라이트 1.09:1 ·
 * 다크 1.21:1이라 면으로는 구분이 사실상 없었고, 1px 테두리와 아이콘이 구분을 혼자 지고 있었다
 * (A-080). `notice`는 본문과 라이트 1.48:1 · 다크 1.70:1이다. 테두리(`borderStrong`)와
 * `alert-circle` 아이콘은 그대로 둔다 — 면·선·아이콘 셋이 함께 "본문이 아님"을 말한다.
 *
 * 시간이 지나면 스스로 끝낸다 — 열어 둔 채 잊어버리는 것을 막는다.
 */
export function ImpersonationBanner() {
  const { impersonation, noteVisit } = useSession();
  const pathname = usePathname();
  const finish = useFinishImpersonation();
  const [now, setNow] = useState(() => Date.now());

  // 남은 시간을 1초마다 갱신한다. 대리 중이 아니면 타이머를 두지 않는다.
  useEffect(() => {
    if (!impersonation) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [impersonation]);

  // 열어 본 화면을 모은다. 종료할 때 감사 로그에 함께 남는다(개인정보 접속기록의 '수행업무').
  useEffect(() => {
    if (impersonation && pathname) noteVisit(pathname);
  }, [impersonation, pathname, noteVisit]);

  const startedAt = impersonation ? new Date(impersonation.startedAt).getTime() : 0;
  const leftMs = impersonation ? startedAt + IMPERSONATION_MINUTES * 60_000 - now : 0;
  const expired = !!impersonation && leftMs <= 0;

  // 시간이 다 되면 자동으로 끝낸다.
  useEffect(() => {
    if (expired) void finish('시간 만료');
    // `finish`는 세션이 바뀔 때마다 새로 만들어지므로 의존성에 넣지 않는다 — 만료 여부만 본다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  if (!impersonation) return null;

  const left = Math.max(0, Math.floor(leftMs / 1000));
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.bar} testID="impersonation-banner">
        {/*
          남은 시간은 사유와 같은 줄에 두지 않는다. 390에서 그 줄은 잘리고, 15분 자동 종료가
          이 배너의 안전장치인데 그 값이 먼저 사라졌다. 사유는 잘려도 되고 시간은 안 된다.
        */}
        <View style={styles.head}>
          <Icon name="alert-circle" size={16} color={colors.ink} />
          <AppText
            testID="impersonation-who"
            variant="caption"
            style={[styles.strong, styles.who]}
            numberOfLines={1}
          >
            {impersonation.target.name} 님 계정 · 읽기 전용
          </AppText>
          <AppText
            testID="impersonation-left"
            variant="caption"
            style={styles.left}
            accessibilityLabel={`대리 보기 남은 시간 ${mm}분 ${ss}초`}
          >
            {`남은 ${mm}:${ss}`}
          </AppText>
          <Pressable
            testID="impersonation-end"
            accessibilityRole="button"
            accessibilityLabel="대리 보기 끝내기"
            onPress={() => void finish('수동 종료')}
            style={({ pressed }) => [styles.btn, pressed && { backgroundColor: colors.hover }]}
          >
            <AppText variant="caption" style={styles.strong}>
              끝내기
            </AppText>
          </Pressable>
        </View>
        <AppText variant="caption" tone="secondary" numberOfLines={1}>
          {impersonation.reason}
        </AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.notice },
  bar: {
    gap: 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.notice,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  who: { flex: 1 },
  /** 등폭 숫자. 매초 바뀌는 값이 좌우로 흔들리면 눈이 계속 끌린다. */
  left: {
    fontFamily: typeface.semibold,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  strong: { fontFamily: typeface.semibold, color: colors.ink },
  /** 44px. 대리 보기를 끝내는 유일한 길이라 타깃을 줄이지 않는다. */
  btn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
});
