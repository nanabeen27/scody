import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Screen, SegmentedControl, ChildReport, EmptyState } from '@/components';
import { useCurrentAccount, useSession } from '@/session';

/**
 * 리포트: 학부모 기능의 중심 화면.
 * 자녀 리포트로 가는 길은 여기 하나다 — 홈·자녀 목록·자녀 상세가 모두 이 화면으로 온다.
 */
export default function ParentReport() {
  const account = useCurrentAccount();
  const { childrenOf } = useSession();
  const { child: fromQuery, month: monthQuery } = useLocalSearchParams<{
    child?: string;
    month?: string;
  }>();
  const children = childrenOf(account.userId);
  const [picked, setPicked] = useState<string | null>(null);
  // 어느 자녀를 볼지: 눌러서 고른 것 > 들어올 때 지정된 것 > 첫 자녀.
  const selected = picked ?? (fromQuery && children.some((c) => c.userId === fromQuery)
    ? fromQuery
    : children[0]?.userId);
  const child = children.find((c) => c.userId === selected);

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

  return (
    // 화면에서 가장 큰 글자가 "지금 누구를 보고 있는지"를 말해야 한다.
    <Screen testID="parent-report" title={child ? `${child.name} 님 리포트` : '리포트'}>
      {children.length > 1 ? (
        <SegmentedControl
          testID="report-child"
          options={children.map((c) => ({ value: c.userId, label: c.name }))}
          value={selected ?? ''}
          onChange={setPicked}
        />
      ) : null}
      {/* key를 자녀로 두어 전환 시 달·펼침·요약 진행 상태가 남지 않게 한다. */}
      {child ? <ChildReport key={child.userId} child={child} month={monthQuery} /> : null}
    </Screen>
  );
}
