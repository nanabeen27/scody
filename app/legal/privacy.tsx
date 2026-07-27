import { LegalDocView } from '@/features/legal/LegalDocView';
import { legalDoc } from '@/features/legal/documents';

/** 푸터 문서: privacy. 내용은 `src/features/legal/documents.ts`에 있다. */
export default function Page() {
  return <LegalDocView doc={legalDoc('privacy')!} />;
}
