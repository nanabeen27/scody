import { Redirect, useLocalSearchParams } from 'expo-router';
import { useCurrentAccount, useSession } from '@/session';

/**
 * 옛 자녀 상세 경로. 리포트 탭이 정식 리포트가 되어 이리로 보낸다(D-048).
 *
 * 같은 화면으로 가는 길이 셋(홈·자녀 목록·리포트 탭)이었고 내용이 전부 같았다.
 * 링크와 뒤로가기가 살아 있도록 경로는 남기고 리다이렉트만 한다.
 *
 * **연결된 자녀인지 여기서 확인한다.** 리다이렉트로 바꾸면서 예전 화면이 하던 확인이 빠졌는데,
 * `/parent/report`는 모르는 `child`를 조용히 버리고 첫 자녀로 되돌린다 — 그러면 주소는 다른
 * 학생을 가리키는데 화면은 내 첫 자녀의 성적·약점·다시 풀기를 보여준다. 모르는 id는 붙이지 않는다.
 */
export default function ParentChildDetail() {
  const account = useCurrentAccount();
  const { childrenOf } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mine = !!id && childrenOf(account.userId).some((c) => c.userId === id);
  return <Redirect href={(mine ? `/parent/report?child=${id}` : '/parent/report') as never} />;
}
