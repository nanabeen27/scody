import { useRouter } from 'expo-router';
import { ContentComposer } from '@/components';
import { useCurrentAccount } from '@/session';

/** 학원(원장·선생) 문제 등록. 등록하면 배정에서 골라 학생에게 낼 수 있어요. */
export default function AcademyNew() {
  const router = useRouter();
  const account = useCurrentAccount();
  return (
    <ContentComposer
      title="문제 등록"
      // 학원 콘텐츠는 배정으로만 학생에게 간다. 개인 학습에는 공개하지 않는다.
      publishToStudents={false}
      ownerAcademyName={account.academyName}
      backFallback="/academy"
      onDone={() => router.replace('/academy/assign' as never)}
    />
  );
}
