import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AppText, EmptyState, Group, LoadFailed, Row, Screen, Section } from '@/components';
import { useCurrentAccount, useSession } from '@/session';
import { useChildReports } from '@/features/report';
import { useProgress } from '@/features/progress';
import { useContent } from '@/features/content';
import { spacing } from '@/theme/tokens';

/**
 * 학부모 홈: **마감이 지난 학원 과제**를 먼저 말하고, 자녀별 이 달 요약으로 리포트로 보낸다.
 *
 * 리포트의 축약본을 또 그리지 않는다 — 자녀가 한두 명인 화면에서 집계 타일은 정보를 더하지
 * 않고(학년·과목이 다른 자녀의 평균 정답률은 뜻이 없다), 같은 목록이 리포트 탭과 겹친다.
 * 숫자는 리포트와 **같은 계산**(`useChildReports`)에서 온다.
 *
 * **맨 위 섹션의 이름이 그 섹션이 세는 것과 같다.** 예전 이름은 `지금 확인할 것`인데 담긴 것은
 * `pending` 중 **마감이 지난 것만**이어서, 마감이 남은 미제출이 3개인 자녀에게도
 * `지금 확인할 건 없어요`가 떴다 — 바로 아래 자녀 줄은 같은 화면에서 `안 낸 과제 3개`를 말한다.
 * 한 화면이 자기 안에서 다른 말을 했다. 이름을 좁혀 `없어요` 문장이 무엇에 대한 것인지 말하게
 * 하고, 마감이 남은 미제출은 자녀 줄과 리포트 첫 섹션(D-048 ①)이 맡는다.
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

    **게이트는 `loading`이 아니라 `loaded`다.** `loading`은 재조회마다 다시 참이 되므로, 쓰기
    실패가 부른 `reload()` 한 번에 **이미 읽어 둔 숫자가 `기록을 불러오고 있어요`로 덮인다** —
    가진 것은 여전히 사실이다(§9 "이미 읽어 둔 값은 지우지 않는다"). 여기서 필요한 것은
    `첫 조회가 끝났는가`이고 provider가 그것을 값으로 준다.
  */
  const { loaded: progressLoaded, error: progressError, reload: reloadProgress } = useProgress();
  const { loaded: contentLoaded, error: contentError, reload: reloadContent } = useContent();
  const reading = !progressLoaded || !contentLoaded;
  /**
   * 조회가 실패했을 때 보여 줄 문장. 서버가 준 것을 그대로 쓴다(`errorMessage`).
   *
   * **실패는 빈 목록과 다르게 말한다**(§9 · M-DB-16). 실패하면 `loaded`가 참이 되므로 로딩
   * 게이트가 덮지 못한다 — 그 창에서 이 화면은 `마감을 넘긴 과제가 없어요`와
   * `학습 기록 없음`을 단정했다. 못 읽은 목록으로 센 값은 읽는 중에 센 값과 똑같이 거짓이다.
   * 다시 읽는 중에는 감춘다 — 실패 문장과 `불러오고 있어요`가 함께 서면 안 된다.
   */
  const loadError = reading ? null : (progressError ?? contentError);

  /** 두 조회를 함께 다시 시도한다. 실패가 어느 쪽에서 왔는지 학부모가 고를 일은 아니다. */
  async function retryLoad() {
    await Promise.all([reloadProgress(), reloadContent()]);
  }

  const open = (childId: string) => router.push(`/parent/report?child=${childId}` as never);

  /*
    자녀를 가로질러 **마감이 지난** 미제출만 모은다. 오래 지난 것이 위로 온다 —
    `pending`은 자녀별로만 정렬돼 있어(`src/features/report.ts`) 자녀가 둘이면 두 번째 자녀의
    한 달 지난 과제가 첫 자녀의 어제 과제 아래로 갔다.
  */
  const overdue = children
    .flatMap((c) =>
      (reports[c.userId]?.pending ?? [])
        .filter((p) => p.due?.overdue)
        .map((p) => ({ key: `${c.userId}-${p.id}`, childId: c.userId, name: c.name, row: p })),
    )
    .sort((a, b) => (a.row.dueDate ?? '').localeCompare(b.row.dueDate ?? ''));

  if (children.length === 0) {
    return (
      <Screen testID="parent-home" title={`${account.name} 님`}>
        <NoChildren />
      </Screen>
    );
  }

  return (
    <Screen testID="parent-home" title={`${account.name} 님`}>
      {/*
        **한 화면에 실패 면은 하나다**(§9). 아래 두 섹션이 같은 조회에 매달려 있어서, 자리마다
        빨간 줄을 두면 한 번의 실패가 두 번으로 읽힌다.
      */}
      {loadError ? (
        <LoadFailed
          testID="parent-load-failed"
          retryTestID="parent-load-retry"
          what="자녀 기록"
          message={loadError}
          onRetry={() => void retryLoad()}
        />
      ) : null}

      {/*
        **실패했을 때는 이 섹션을 두지 않는다.** 못 읽은 목록으로는 `없어요`도 개수도 말할 수
        없고(§9), 제목만 남기면 빈 껍데기가 "없다"는 뜻으로 읽힌다. 위 실패 줄이 그 자리다.
      */}
      {loadError ? null : (
        <Section title="마감이 지난 학원 과제">
          {reading ? (
            <Group>
              <View style={{ padding: spacing.lg }}>
                <AppText tone="secondary">기록을 불러오고 있어요.</AppText>
              </View>
            </Group>
          ) : overdue.length > 0 ? (
            <Group>
              {overdue.map((a) => (
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
                {/*
                  섹션 이름을 그대로 되풀이하지 않는다 — 제목과 같은 문구를 쓰면 화면에 같은 말이
                  두 줄 서고, 텍스트로 찾을 때 제목과 구별되지 않는다.
                */}
                <AppText tone="secondary">마감을 넘긴 과제가 없어요.</AppText>
              </View>
            </Group>
          )}
        </Section>
      )}

      <Section title="자녀">
        <Group>
          {children.map((c) => {
            const r = reports[c.userId];
            // 이 달 기준으로 말한다. 누적 총합은 오래 쓸수록 뜻을 잃는다(D-049).
            const bits = reading
              ? ['기록을 불러오고 있어요']
              : loadError
                ? // 실패했을 때는 개수도 `없음`도 말하지 않는다. 실패 문장은 위에 한 줄뿐이다.
                  ['기록을 불러오지 못했어요']
                : [
                    // `7월 2일`처럼 날짜로 읽히지 않게 조사를 넣는다.
                    r ? `${r.label}에 ${r.totals.days}일 공부했어요` : null,
                    r?.totals.accuracy != null ? `정답률 ${r.totals.accuracy}%` : null,
                    /*
                      **위 섹션과 같은 집합을 센다.** `now.pending`은 마감이 지난 것까지 포함한
                      미제출 전부이고(`src/features/report.ts`), 마감이 지난 것만 위 섹션에 줄로
                      선다. 그래서 `안 낸 과제 3개`와 `마감을 넘긴 과제가 없어요`가 함께 서도
                      두 문장이 서로를 부정하지 않는다.
                    */
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
