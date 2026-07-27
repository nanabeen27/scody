import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { getTeachersForAcademy, isScodyIdTaken, type Account } from '@/data';
import { useSession } from '@/session';

export interface AddTeacherResult {
  ok: boolean;
  error?: string;
}

interface AcademyStaffValue {
  /** 우리 학원의 현재 선생님(원장 포함). 추가분 포함, 제외분 제거. */
  teachers: Account[];
  addTeacher: (input: { name: string; scodyId: string }) => AddTeacherResult;
  removeTeacher: (userId: string) => void;
  /** 반 담당자가 아직 학원에 있는지. 제외된 선생님이 담당으로 남지 않게 한다. */
  isActiveTeacher: (userId: string) => boolean;
}

const AcademyStaffContext = createContext<AcademyStaffValue | null>(null);

/**
 * 학원 인사(선생님) 상태 경계. 프로토타입은 메모리에 보관한다.
 * 추가한 선생님은 비밀번호가 없어 로그인할 수 없다. 실제 서비스에서는 초대 링크로 계정을 연결한다.
 */
export function AcademyStaffProvider({ children }: { children: ReactNode }) {
  const { account } = useSession();
  const academyName = account?.academyName ?? '';
  const [added, setAdded] = useState<Account[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);

  const teachers = useMemo(() => {
    if (!academyName) return [];
    const base = getTeachersForAcademy(academyName);
    const mine = added.filter((a) => a.academyName === academyName);
    return [...base, ...mine].filter((t) => !removedIds.includes(t.userId));
  }, [academyName, added, removedIds]);

  const addTeacher = useCallback<AcademyStaffValue['addTeacher']>(
    ({ name, scodyId }) => {
      const trimmedName = name.trim();
      const id = scodyId.trim();
      if (!trimmedName || !id) return { ok: false, error: '이름과 스코디 아이디를 입력해 주세요.' };
      if (!academyName) return { ok: false, error: '학원 정보를 찾을 수 없어요.' };
      const taken =
        isScodyIdTaken(id) || added.some((a) => a.scodyId.toLowerCase() === id.toLowerCase());
      if (taken) return { ok: false, error: '이미 사용 중인 아이디예요.' };

      setAdded((prev) => [
        ...prev,
        {
          userId: `u_t_added_${id.toLowerCase()}`,
          name: trimmedName,
          scodyId: id,
          roles: ['academy'],
          academyRole: 'teacher',
          academyName,
          entitlements: [],
        },
      ]);
      return { ok: true };
    },
    [academyName, added],
  );

  const removeTeacher = useCallback(
    (userId: string) => {
      // 원장 자신은 제외할 수 없다.
      if (!userId || userId === account?.userId) return;
      setRemovedIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
    },
    [account?.userId],
  );

  const isActiveTeacher = useCallback(
    (userId: string) => !!userId && !removedIds.includes(userId),
    [removedIds],
  );

  const value = useMemo<AcademyStaffValue>(
    () => ({ teachers, addTeacher, removeTeacher, isActiveTeacher }),
    [teachers, addTeacher, removeTeacher, isActiveTeacher],
  );
  return <AcademyStaffContext.Provider value={value}>{children}</AcademyStaffContext.Provider>;
}

export function useAcademyStaff(): AcademyStaffValue {
  const ctx = useContext(AcademyStaffContext);
  if (!ctx) throw new Error('useAcademyStaff must be used within AcademyStaffProvider');
  return ctx;
}
