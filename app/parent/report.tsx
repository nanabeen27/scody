import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Screen,
  SegmentedControl,
  ChildReport,
  EmptyState,
  AppText,
  Button,
  ActionBar,
} from '@/components';
import { useCurrentAccount, useSession } from '@/session';

/**
 * 리포트: 학부모 기능의 중심 화면.
 * 자녀 리포트로 가는 길은 여기 하나다 — 홈·자녀 목록·자녀 상세가 모두 이 화면으로 온다.
 *
 * **어느 자녀를 보는지는 주소에 남는다.** 새로고침·주소 공유·상세에서 뒤로가기가 모두 같은
 * 자녀를 열어야 한다(예전에는 눌러서 고른 자녀가 화면 상태로만 살아 있어서, 새로고침하면
 * 첫 자녀가 열렸다). 달도 같은 이유로 `ChildReport`가 주소에 남긴다.
 */
export default function ParentReport() {
  const router = useRouter();
  const account = useCurrentAccount();
  const { childrenOf } = useSession();
  const { child: fromQuery, month: monthQuery } = useLocalSearchParams<{
    child?: string;
    month?: string;
  }>();
  const children = childrenOf(account.userId);
  const mine = fromQuery ? children.some((c) => c.userId === fromQuery) : false;
  // 어느 자녀를 볼지: 주소에 지정된 것 > 첫 자녀(홈에서 들어오는 정상 경로).
  const selected = mine ? fromQuery : children[0]?.userId;
  const child = children.find((c) => c.userId === selected);

  /**
   * 자녀를 바꾼다. **주소를 바꿀 뿐 히스토리를 늘리지 않는다**(`setParams`) —
   * 자녀를 세 번 바꾼 뒤 뒤로가기를 세 번 눌러야 홈으로 나가는 일이 없어야 한다.
   *
   * 달은 함께 비운다. 달은 그 자녀의 기록에 붙은 값이라, 6월을 보다 다른 자녀로 넘어가면
   * 그 자녀의 6월이 열려 방금 본 달이 남은 것처럼 읽힌다.
   */
  function pickChild(userId: string) {
    if (userId === selected) return;
    router.setParams({ child: userId, month: undefined });
  }

  if (children.length === 0) {
    return (
      <Screen testID="parent-report" title="리포트">
        {/* 홈·자녀 탭과 같은 빈 상태다(D-104). 문구가 갈리지 않게 형태도 같게 둔다. */}
        <EmptyState
          title="아직 연결된 자녀가 없어요"
          subtitle="자녀 연결은 학원이 보낸 초대 링크로 해요."
        />
      </Screen>
    );
  }

  /*
    **모르는 자녀를 조용히 다른 자녀로 바꿔 보여 주지 않는다.**
    예전에는 `?child=`가 내 자녀가 아니면 아무 말 없이 첫 자녀의 리포트를 열었다 — 학부모는
    주소에 적힌 자녀를 보고 있다고 믿는데 화면은 다른 자녀의 학습을 말한다. 연결 여부는 세션
    스냅샷(`childrenOf`)이 지금 답하는 사실이라 조회와 무관하게 갈라 말할 수 있고, 문장은
    `app/parent/detail.tsx`와 같은 것을 쓴다. 쿼리가 아예 없을 때는 첫 자녀를 연다 —
    그것이 리포트 탭으로 들어오는 정상 경로다.
  */
  if (fromQuery && !mine) {
    return (
      <Screen testID="parent-report" title="자녀를 찾을 수 없어요">
        <AppText tone="secondary">연결된 자녀만 볼 수 있어요.</AppText>
        <ActionBar>
          <Button
            testID="report-my-children"
            variant="secondary"
            label="내 자녀 리포트 볼게요"
            onPress={() => router.replace('/parent/report' as never)}
          />
        </ActionBar>
      </Screen>
    );
  }

  return (
    // 화면에서 가장 큰 글자가 "지금 누구를 보고 있는지"를 말해야 한다.
    <Screen testID="parent-report" title={child ? `${child.name} 님 리포트` : '리포트'}>
      {children.length > 1 ? (
        <SegmentedControl
          testID="report-child"
          options={children.map((c) => ({ value: c.userId, label: c.name }))}
          value={selected ?? ''}
          onChange={pickChild}
        />
      ) : null}
      {/* key를 자녀로 두어 전환 시 달·펼침·요약 진행 상태가 남지 않게 한다. */}
      {child ? <ChildReport key={child.userId} child={child} month={monthQuery} /> : null}
    </Screen>
  );
}
