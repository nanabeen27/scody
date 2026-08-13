import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Screen, Section, Group, Row, AppText, EmptyState } from '@/components';
import { useCurrentAccount, useSession } from '@/session';
import { useChildReports } from '@/features/report';
import { useProgress } from '@/features/progress';
import { useContent } from '@/features/content';
import { spacing } from '@/theme/tokens';

/**
 * 학부모 홈: 자녀별로 **지금 확인할 것**을 먼저 말한다.
 *
 * 리포트의 축약본을 또 그리지 않는다 — 자녀가 한두 명인 화면에서 집계 타일은 정보를 더하지
 * 않고(학년·과목이 다른 자녀의 평균 정답률은 뜻이 없다), 같은 목록이 리포트 탭과 겹친다.
 * 숫자는 리포트와 **같은 계산**(`useChildReports`)에서 온다.
 */
export default function ParentHome() {
  const router = useRouter();
  const account = useCurrentAccount();
  const { childrenOf } = useSession();
  const children = childrenOf(account.userId);
  const reports = useChildReports(children.map((c) => c.userId));
  /*
    **불러오는 중에는 숫자를 말하지 않는다.** 조회가 끝나기 전에는 기록이 빈 배열이라
    `0일 공부했어요 · 학습 기록 없음`이 나온다 — 없는 것이 아니라 아직 모르는 것이다.
    실측: 리포트가 같은 달에 `5일`을 말하는데 홈은 `0일 · 학습 기록 없음`이었다(D-090 위반).
  */
  const { loading: progressLoading } = useProgress();
  const { loading: contentLoading } = useContent();
  const loading = progressLoading || contentLoading;

  const open = (childId: string) => router.push(`/parent/report?child=${childId}` as never);

  // 자녀를 가로질러 지금 손이 필요한 것만 모은다. 마감이 지난 것이 먼저 온다.
  const alerts = children.flatMap((c) =>
    (reports[c.userId]?.pending ?? [])
      .filter((p) => p.due?.overdue)
      .map((p) => ({ key: `${c.userId}-${p.id}`, childId: c.userId, name: c.name, row: p })),
  );

  if (children.length === 0) {
    return (
      <Screen testID="parent-home" title={`${account.name} 님`}>
        <NoChildren />
      </Screen>
    );
  }

  return (
    <Screen testID="parent-home" title={`${account.name} 님`}>
      <Section title="지금 확인할 것">
        {loading ? (
          <Group>
            <View style={{ padding: spacing.lg }}>
              <AppText tone="secondary">기록을 불러오고 있어요.</AppText>
            </View>
          </Group>
        ) : alerts.length > 0 ? (
          <Group>
            {alerts.map((a) => (
              <Row
                key={a.key}
                testID={`parent-alert-${a.row.id}`}
                title={`${a.name} · ${a.row.title}`}
                subtitle={`${a.row.due?.text} · 아직 안 냈어요`}
                showChevron
                onPress={() => open(a.childId)}
              />
            ))}
          </Group>
        ) : (
          <Group>
            <View style={{ padding: spacing.lg }}>
              <AppText tone="secondary">지금 확인할 건 없어요.</AppText>
            </View>
          </Group>
        )}
      </Section>

      <Section title="자녀">
        <Group>
          {children.map((c) => {
            const r = reports[c.userId];
            // 이 달 기준으로 말한다. 누적 총합은 오래 쓸수록 뜻을 잃는다(D-049).
            const bits = loading
              ? ['기록을 불러오고 있어요']
              : [
                  // `7월 2일`처럼 날짜로 읽히지 않게 조사를 넣는다.
                  r ? `${r.label}에 ${r.totals.days}일 공부했어요` : null,
                  r?.totals.accuracy != null ? `정답률 ${r.totals.accuracy}%` : null,
                  r && r.now.pending > 0 ? `안 낸 과제 ${r.now.pending}개` : null,
                  r?.lastDate ? null : '학습 기록 없음',
                ].filter(Boolean);
            return (
              <Row
                key={c.userId}
                testID={`parent-child-${c.userId}`}
                title={c.name}
                subtitle={bits.join(' · ')}
                meta={c.academyName}
                showChevron
                onPress={() => open(c.userId)}
              />
            );
          })}
        </Group>
      </Section>
    </Screen>
  );
}

/**
 * 자녀가 없을 때. **실제로 가능한 방법만 말한다** —
 * 예전 문구가 약속하던 '연결 요청'은 앱에 없는 기능이었다. 연결은 학원 초대 링크(`/join`)로만 된다.
 *
 * 형태는 `EmptyState` 하나다(D-104). 같은 문구를 리포트 탭·자녀 탭도 쓴다 —
 * 다음에 문구를 고칠 때 세 화면이 갈리지 않게 세 곳 모두 같은 컴포넌트로 그린다.
 * `action`은 두지 않는다: 앱 안에서 학부모가 스스로 연결을 시작할 길이 없다.
 */
export function NoChildren() {
  return (
    <EmptyState
      title="아직 연결된 자녀가 없어요"
      subtitle="자녀 연결은 학원이 보낸 초대 링크로 해요."
    />
  );
}
