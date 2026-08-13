import { useRouter } from 'expo-router';
import { ContentComposer } from '@/components';
import { useAudit } from '@/features/audit';
import { useSession } from '@/session';
import { gradeLabel } from '@/data';

/**
 * 총괄관리자 문제 등록. 메뉴가 아니라 `콘텐츠` 화면의 행동이다(D-017).
 *
 * **기록은 여기서 남긴다.** `ContentComposer`는 학원 등록(`app/academy/new.tsx`)과 공용이라
 * 폼 안에서 기록하면 학원 조작까지 운영자 감사 로그에 섞인다. `onDone` 콜백은 운영자 경로에만
 * 있으므로 이 자리에 붙인다.
 *
 * **끝내면 방금 만든 세트를 연다.** 예전에는 개요로 보냈는데 개요에는 `최근 등록 콘텐츠` 섹션이
 * 없어서(개편 때 지표가 그 자리를 썼다) 콘텐츠 목록에서 시작한 흐름이 아무 답 없는 화면으로
 * 튀었고, 방금 만든 것을 보려면 콘텐츠 → 검색을 다시 해야 했다. 학원 경로도 같은 판단으로
 * 배정으로 이어 붙인다(`app/academy/new.tsx`, D-064). 상세의 뒤로가기가 목록으로 데려간다.
 */
export default function AdminNew() {
  const router = useRouter();
  const { log } = useAudit();
  const { account } = useSession();
  return (
    <ContentComposer
      title="문제를 등록해볼까요?"
      // 운영자 콘텐츠는 학생 개인 학습에 공개한다.
      publishToStudents
      // 들어온 화면으로 돌아간다. 직접 URL 진입에도 목록이 안전한 상위 경로다.
      backFallback="/admin/content"
      doneLabel="등록한 문제 보기"
      onDone={(created) => {
        // 기록은 서버에 남는다. 목적지로 옮기는 것을 기록이 끝날 때까지 붙잡지 않는다 —
        // 실패하면 provider가 `console.warn`으로 알리고 등록 자체는 이미 끝났다.
        void log({
          actor: account?.name ?? '운영자',
          action: '콘텐츠',
          // 제목·영역·문항 수·공개 여부. 나중에 이 줄만 읽고도 무엇이 늘었는지 알 수 있어야 한다.
          detail: [
            `문제 등록 · ${created.title}`,
            // 학년이 비어 있으면 지어내지 않고 영역만 적는다.
            created.grade ? `${gradeLabel(created.grade)} ${created.area}` : created.area,
            `${created.questions.length}문항`,
            created.publishToStudents ? '학생 공개' : '비공개',
          ].join(' · '),
        });
        router.replace(`/admin/content/${created.id}` as never);
      }}
    />
  );
}
