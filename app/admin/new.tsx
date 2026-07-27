import { useRouter } from 'expo-router';
import { ContentComposer } from '@/components';

/** 총괄관리자 문제 등록. */
export default function AdminNew() {
  const router = useRouter();
  return (
    <ContentComposer
      title="문제를 등록해볼까요?"
      // 운영자 콘텐츠는 학생 개인 학습에 공개한다.
      publishToStudents
      backFallback="/admin"
      onDone={() => router.replace('/admin' as never)}
    />
  );
}
