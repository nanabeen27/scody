import { useRouter } from 'expo-router';
import { ContentComposer } from '@/components';
import { useCurrentAccount } from '@/session';

/**
 * 학원(원장·선생) 문제 등록. 메뉴가 아니라 `문제` 화면의 행동이다(D-017과 같은 판단).
 *
 * 등록을 마치면 방금 만든 학습을 실어 배정으로 이어 붙인다(`?content=`) — 배정 화면이 그
 * 쿼리를 받아 그 학습이 골라진 상태로 시작한다(D-062). 등록만 하고 나가려면 좌상단
 * 뒤로가기로 `문제` 목록으로 돌아간다.
 */
export default function AcademyNew() {
  const router = useRouter();
  const account = useCurrentAccount();
  return (
    <ContentComposer
      title="문제 등록"
      // 학원 콘텐츠는 배정으로만 학생에게 간다. 개인 학습에는 공개하지 않는다.
      publishToStudents={false}
      ownerAcademyName={account.academyName}
      backFallback="/academy/content"
      doneLabel="이어서 배정하기"
      onDone={(created) => router.replace(`/academy/assign?content=${created.id}` as never)}
    />
  );
}
