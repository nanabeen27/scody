import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { AcademyClass, Account, Grade } from '@/data/types';
import * as repo from '@/repo/directory';
import { useSession } from '@/session';

/**
 * 학원 인사·반·학생 경계.
 *
 * ## 프로토타입에서 무엇이 사라졌는가
 *
 * 예전 이 파일은 `ACADEMY_CLASSES` fixture 위에 **오버레이**를 얹어 세션 안의 변경을 기억했다
 * (`created`·`archivedIds`·`patches`·`added`·`removedIds`, 약 120줄). 그래서 학원이 만든 반이
 * 학생·학부모 화면에 나타나지 않았다(마스터 플랜 S-013·S-014).
 *
 * 지금은 반·학생이 서버에 있고 모든 역할이 같은 표를 읽는다. **오버레이가 사라져서 그 두 항목이
 * 함께 닫혔다.**
 *
 * ## 권한
 *
 * 규칙은 RLS가 강제한다(`classes_write`·`class_students_write`: 원장만, 자기 학원만).
 * 여기 있는 검사는 화면에 **말할 문장**을 만들기 위한 것이고, 통과해도 서버가 다시 판단한다.
 */

export interface AcademyWriteResult {
  ok: boolean;
  error?: string;
}

/** 선생님 초대 결과. 기존 이름을 유지한다(호출부가 그대로 쓴다). */
export type AddTeacherResult = AcademyWriteResult & {
  /** 초대 토큰. 원장이 선생님에게 전달한다. */
  token?: string;
};

interface AcademyStaffValue {
  /** 우리 학원의 현재 구성원(원장 포함). 제외된 사람은 빠진다. */
  teachers: Account[];
  /**
   * 선생님을 **초대한다**.
   *
   * 프로토타입은 이름과 아이디만으로 로그인할 수 없는 계정을 메모리에 만들었다. 실제 인증에서는
   * `auth.users` 없이 프로필을 만들 수 없고, 마스터 플랜 3절도 초대 방식으로 정한다.
   * 그래서 이 함수는 **초대 링크를 만들고 토큰을 돌려준다.**
   */
  addTeacher: () => Promise<AddTeacherResult>;
  /** 선생님을 학원에서 제외한다. 담당 반은 미배정으로 남는다. 서버가 거부하면 그 문장을 돌려준다. */
  removeTeacher: (userId: string) => Promise<AcademyWriteResult>;
  /** 반 담당자가 아직 학원에 있는지. 제외된 선생님이 담당으로 남지 않게 한다. */
  isActiveTeacher: (userId: string) => boolean;
  classesFor: (account: Account) => AcademyClass[];
  classById: (classId: string) => AcademyClass | undefined;
  studentsIn: (classId: string) => Account[];
  /**
   * 지금 로그인한 계정이 볼 수 있는 학생 하나. 권한 밖이면 `undefined`.
   * 원장은 우리 학원 학생 전체, 선생님은 담당 반 학생만이다.
   */
  studentInScope: (userId: string) => Account | undefined;
  addClass: (input: {
    name: string;
    teacherId?: string;
    grade?: Grade;
  }) => Promise<AcademyWriteResult & { id?: string }>;
  renameClass: (classId: string, name: string) => Promise<AcademyWriteResult>;
  /** 폐강. **삭제가 아니다** — 배정·제출 기록은 그대로 남는다(D-013). */
  archiveClass: (classId: string) => Promise<AcademyWriteResult>;
  addStudentsToClass: (classId: string, userIds: readonly string[]) => Promise<AcademyWriteResult>;
  removeStudentFromClass: (classId: string, userId: string) => Promise<AcademyWriteResult>;
  setClassTeacher: (classId: string, teacherId: string) => Promise<AcademyWriteResult>;
}

const AcademyStaffContext = createContext<AcademyStaffValue | null>(null);

const NO_STUDENTS: Account[] = [];

export function AcademyStaffProvider({ children }: { children: ReactNode }) {
  const {
    account,
    academy,
    teachers,
    classesFor,
    classById,
    studentsIn,
    academyStudents,
    readOnly,
    reload,
  } = useSession();

  /**
   * 반·학생을 바꿀 수 있는지. **원장만**이다(마스터 플랜 3절).
   * 막을 이유가 있으면 그 문장을, 없으면 `null`을 준다. 서버가 같은 판정을 다시 한다.
   */
  const denyManage = useCallback((): string | null => {
    if (readOnly) return '대리 보기 중에는 바꿀 수 없어요.';
    if (!account || !account.roles.includes('academy') || !academy) {
      return '학원 정보를 찾을 수 없어요.';
    }
    if (account.academyRole !== 'director') return '반 관리는 원장님만 할 수 있어요.';
    return null;
  }, [account, academy, readOnly]);

  /** 쓰기 뒤에는 스냅샷을 다시 읽는다 — 화면이 방금 바꾼 값을 보여 줘야 한다. */
  const afterWrite = useCallback(
    async (result: AcademyWriteResult): Promise<AcademyWriteResult> => {
      if (result.ok) await reload();
      return result;
    },
    [reload],
  );

  const isActiveTeacher = useCallback(
    (userId: string) => !!userId && teachers.some((t) => t.userId === userId),
    [teachers],
  );

  const studentInScope = useCallback<AcademyStaffValue['studentInScope']>(
    (userId) => {
      if (!account || !academy || !userId) return undefined;
      const student = academyStudents.find((s) => s.userId === userId);
      if (!student) return undefined;
      // 선생님은 담당 반에 속한 학생만 본다. 원장은 반이 없는 학생도 본다(반에 넣어야 하므로).
      if (account.academyRole !== 'director') {
        const mine = classesFor(account);
        if (!mine.some((c) => c.studentIds.includes(userId))) return undefined;
      }
      return student;
    },
    [account, academy, academyStudents, classesFor],
  );

  const addTeacher = useCallback<AcademyStaffValue['addTeacher']>(
    async () => {
      const denied = denyManage();
      if (denied) return { ok: false, error: denied };
      if (!academy) return { ok: false, error: '학원 정보를 찾을 수 없어요.' };
      /*
        이름과 아이디는 받지 않는다 — 계정은 초대받은 사람이 자기 손으로 만든다. 원장이 대신
        정하면 그 사람이 로그인할 수 없는 계정이 생긴다(프로토타입이 그랬다).
      */
      return repo.inviteTeacher(academy.id);
    },
    [academy, denyManage],
  );

  const removeTeacher = useCallback<AcademyStaffValue['removeTeacher']>(
    async (userId) => {
      // 대리 보기 중에는 아무것도 바꾸지 않는다(D-071). 원장 자신은 제외할 수 없다.
      if (!userId) return { ok: false, error: '제외할 선생님을 고르지 못했어요.' };
      const denied = denyManage();
      if (denied) return { ok: false, error: denied };
      if (userId === account?.userId) return { ok: false, error: '자기 자신은 제외할 수 없어요.' };
      if (!academy) return { ok: false, error: '학원 정보를 찾을 수 없어요.' };
      /*
        **결과를 버리지 않는다.** 예전에는 `await repo.removeMember(...)`의 결과를 무시하고
        곧바로 다시 읽어서, RLS가 거부해도 화면은 `제외했어요`라고 말하고 그 선생님이 목록에
        그대로 남았다. `afterWrite`가 다른 쓰기와 같은 규칙으로 다시 읽는다.
      */
      return afterWrite(await repo.removeMember(academy.id, userId));
    },
    [account?.userId, academy, afterWrite, denyManage],
  );

  const addClass = useCallback<AcademyStaffValue['addClass']>(
    async (input) => {
      const denied = denyManage();
      if (denied) return { ok: false, error: denied };
      if (!academy) return { ok: false, error: '학원 정보를 찾을 수 없어요.' };
      const name = input.name.trim();
      if (!name) return { ok: false, error: '반 이름을 입력해 주세요.' };
      if (input.teacherId && !teachers.some((t) => t.userId === input.teacherId)) {
        return { ok: false, error: '우리 학원 선생님만 담당으로 정할 수 있어요.' };
      }
      const result = await repo.createClass({
        academyId: academy.id,
        name,
        teacherId: input.teacherId,
        grade: input.grade,
      });
      if (result.ok) await reload();
      return result;
    },
    [academy, denyManage, reload, teachers],
  );

  const renameClass = useCallback<AcademyStaffValue['renameClass']>(
    async (classId, name) => {
      const denied = denyManage();
      if (denied) return { ok: false, error: denied };
      const next = name.trim();
      if (!next) return { ok: false, error: '반 이름을 입력해 주세요.' };
      return afterWrite(await repo.renameClass(classId, next));
    },
    [afterWrite, denyManage],
  );

  const archiveClass = useCallback<AcademyStaffValue['archiveClass']>(
    async (classId) => {
      const denied = denyManage();
      if (denied) return { ok: false, error: denied };
      return afterWrite(await repo.archiveClass(classId));
    },
    [afterWrite, denyManage],
  );

  const addStudentsToClass = useCallback<AcademyStaffValue['addStudentsToClass']>(
    async (classId, userIds) => {
      const denied = denyManage();
      if (denied) return { ok: false, error: denied };
      // 우리 학원 학생만 넣는다. 서버도 같은 경계를 보지만 화면에 말할 문장은 여기서 만든다.
      const valid = userIds.filter((id) => academyStudents.some((s) => s.userId === id));
      if (valid.length === 0) return { ok: false, error: '추가할 학생을 고르지 못했어요.' };
      return afterWrite(await repo.addStudentsToClass(classId, valid));
    },
    [academyStudents, afterWrite, denyManage],
  );

  const removeStudentFromClass = useCallback<AcademyStaffValue['removeStudentFromClass']>(
    async (classId, userId) => {
      const denied = denyManage();
      if (denied) return { ok: false, error: denied };
      return afterWrite(await repo.removeStudentFromClass(classId, userId));
    },
    [afterWrite, denyManage],
  );

  const setClassTeacher = useCallback<AcademyStaffValue['setClassTeacher']>(
    async (classId, teacherId) => {
      const denied = denyManage();
      if (denied) return { ok: false, error: denied };
      const id = teacherId.trim();
      if (id && !teachers.some((t) => t.userId === id)) {
        return { ok: false, error: '우리 학원 선생님만 담당으로 정할 수 있어요.' };
      }
      return afterWrite(await repo.setClassTeacher(classId, id));
    },
    [afterWrite, denyManage, teachers],
  );

  const value = useMemo<AcademyStaffValue>(
    () => ({
      teachers,
      addTeacher,
      removeTeacher,
      isActiveTeacher,
      classesFor,
      classById,
      studentsIn: (classId: string) => studentsIn(classId) ?? NO_STUDENTS,
      studentInScope,
      addClass,
      renameClass,
      archiveClass,
      addStudentsToClass,
      removeStudentFromClass,
      setClassTeacher,
    }),
    [
      teachers,
      addTeacher,
      removeTeacher,
      isActiveTeacher,
      classesFor,
      classById,
      studentsIn,
      studentInScope,
      addClass,
      renameClass,
      archiveClass,
      addStudentsToClass,
      removeStudentFromClass,
      setClassTeacher,
    ],
  );
  return <AcademyStaffContext.Provider value={value}>{children}</AcademyStaffContext.Provider>;
}

export function useAcademyStaff(): AcademyStaffValue {
  const ctx = useContext(AcademyStaffContext);
  if (!ctx) throw new Error('useAcademyStaff must be used within AcademyStaffProvider');
  return ctx;
}
