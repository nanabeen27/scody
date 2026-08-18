import { useMemo } from 'react';
import { useContent } from './content';
import { useProgress } from './progress';
import { useCurrentAccount, useSession } from '@/session';
import { personalItems, findContent, type LearningItem, type ContentSet } from '@/data';
import { isActiveEntitlement } from '@/data/accountMeta';

export interface StudentItems {
  personal: LearningItem[];
  academy: LearningItem[];
  all: LearningItem[];
  hasPersonal: boolean;
}

/**
 * 표시용 날짜(`7월 24일`). ISO 문자열을 화면에 그대로 내보내지 않는다.
 * 학생·학부모·학원이 같은 형식을 쓰도록 한곳에 둔다.
 */
export function formatDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(m)}월 ${Number(d)}일`;
}

/**
 * 오늘 기준 마감 표시. 날짜만 비교하고 시각은 보지 않는다(로컬 자정 기준).
 * 지난 마감은 텍스트로 먼저 알린다 — 색만으로 뜻을 전하지 않는다.
 * 학생 홈·학부모 리포트·학원 성과 분석이 같은 문장을 쓰도록 한곳에 둔다.
 */
export function dueLabel(iso?: string): { text: string; overdue: boolean } | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { text: '마감이 지났어요', overdue: true };
  if (days === 0) return { text: '오늘까지', overdue: false };
  if (days === 1) return { text: '내일까지', overdue: false };
  return { text: `${m}월 ${d}일까지`, overdue: false };
}

/**
 * 마감일 입력을 검사한다. 배정과 재배정이 **같은 규칙**을 쓰도록 한곳에 둔다 —
 * 배정 화면은 형식만 보고 과거 날짜를 통과시켰고, 재배정 화면만 `오늘보다 뒤`를 요구했다.
 * 어제 날짜로 배정하면 그 즉시 마감이 지난 과제가 되어 학생 홈에 아예 뜨지 않는다(D-046).
 *
 * 정규식만으로는 `2026-13-45`가 통과한다. 실제 달·일까지 확인한다.
 * `allowToday`가 true면 오늘 마감을 허용한다(오늘까지 내는 과제는 정상 업무다).
 */
export function parseDueDate(
  input: string,
  today: string,
  opts: { allowToday?: boolean } = {},
): { ok: true; value?: string } | { ok: false; error: string } {
  const raw = input.trim();
  if (!raw) return { ok: true };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { ok: false, error: '마감일은 2026-08-11 형식으로 적어 주세요.' };
  }
  const [y, m, d] = raw.split('-').map(Number);
  const at = new Date(y, m - 1, d);
  if (at.getFullYear() !== y || at.getMonth() !== m - 1 || at.getDate() !== d) {
    return { ok: false, error: '없는 날짜예요. 달과 일을 다시 확인해 주세요.' };
  }
  const floor = opts.allowToday === false ? today : '';
  if (raw < today || (floor && raw <= floor)) {
    return { ok: false, error: '오늘 또는 오늘보다 뒤인 날짜로 정해 주세요.' };
  }
  return { ok: true, value: raw };
}

/** 오늘부터 며칠 뒤(YYYY-MM-DD). 마감일 빠른 선택 칩이 쓴다. */
export function dayAfter(today: string, days: number): string {
  const [y, m, d] = today.split('-').map(Number);
  const at = new Date(y, m - 1, d + days);
  const mm = `${at.getMonth() + 1}`.padStart(2, '0');
  const dd = `${at.getDate()}`.padStart(2, '0');
  return `${at.getFullYear()}-${mm}-${dd}`;
}

/**
 * 마감이 이른 것부터. 마감이 없는 개인 학습은 뒤로 보낸다.
 * 홈과 학습 탭이 같은 순서를 보여야 해서 한곳에 둔다.
 */
export function byDue(a: LearningItem, b: LearningItem): number {
  return (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99');
}

/** 남은 것을 먼저, 그 안에서 마감이 이른 것부터. 끝난 과제가 위를 차지하지 않게. */
export function byTodoThenDue(a: LearningItem, b: LearningItem): number {
  const aDone = a.status === 'done' ? 1 : 0;
  const bDone = b.status === 'done' ? 1 : 0;
  if (aDone !== bDone) return aDone - bDone;
  return byDue(a, b);
}

/**
 * 학생 학습 목록.
 * - 개인: 공개 콘텐츠에서 파생
 * - 학원: **나에게 배정된** 학습(배정 대상 행이 있는 것. 반 소속만으로는 받지 않는다)
 * 각 항목은 내 풀이 기록(attempt)으로 완료/정답률이 반영된다.
 */
export interface QueuedItems {
  /** 담은 순서대로. 공개가 끝난 학습은 빠진다. */
  items: LearningItem[];
  /** 콘텐츠가 없어져 빠진 개수. 0이면 화면에서 말하지 않는다. */
  dropped: number;
}

/**
 * 담아 둔 학습을 실제 학습 목록으로 바꾼다.
 *
 * 개인 학습(`personal`) 안에서만 찾는다 — 담긴 값이 어떻든 학원 과제가 여기로 나올 수 없게.
 * 학습 id가 바뀌었으면 `contentId`로 한 번 더 찾는다.
 * 화면은 항상 이 `items.length`를 쓴다(담긴 칸 수와 보이는 개수가 어긋나지 않게).
 */
export function useQueuedItems(): QueuedItems {
  const { personal } = useStudentItems();
  const { queue } = useProgress();

  const byId = new Map(personal.map((i) => [i.id, i]));
  const byContent = new Map(personal.map((i) => [i.contentId, i]));
  const items = queue
    .map((q) => byId.get(q.itemId) ?? byContent.get(q.contentId))
    .filter((i): i is LearningItem => !!i);

  return { items, dropped: queue.length - items.length };
}

/**
 * 이 학생에게 보이는 학습 전부.
 *
 * **결과를 메모한다.** `useQueuedItems`가 안에서 이 훅을 다시 부르므로 두 훅을 같이 쓰는 화면
 * (학생 홈·학습 탭)은 같은 렌더에서 계산이 두 벌 돌았다. 홈은 질문 입력 상태를 같은 컴포넌트에
 * 들고 있어 **글자 하나 칠 때마다** 두 벌이었다. 배정 필터가 앱 전체 제출 행을 훑기 때문에
 * (실측 16,899행 → 결과 15건) 값이 작지 않다.
 */
export function useStudentItems(): StudentItems {
  const { sets } = useContent();
  const account = useCurrentAccount();
  const { attempts, assignments } = useProgress();
  const { academyLinked, answers } = useSession();
  /*
    반 목록은 더 이상 재료가 아니다. 학원 과제 판정이 배정 대상 행만 보므로(아래
    `buildStudentItems`) 반 소속을 읽을 이유가 없어졌다 — 살아 있는 반을 넘기던 자리였다(S-013).
  */
  return useMemo(
    () => buildStudentItems({ sets, account, attempts, assignments, academyLinked, answers }),
    [sets, account, attempts, assignments, academyLinked, answers],
  );
}

/**
 * 훅이 쓰는 순수 계산. 학부모 쪽 `buildChildReport`와 같은 이유로 내보낸다 —
 * 배정 대상 판정을 provider 없이 단위 테스트로 지킬 수 있게(`__tests__/assignedTargets.test.ts`).
 * 화면은 이 함수를 직접 부르지 않고 `useStudentItems`를 쓴다.
 */
export function buildStudentItems({
  sets,
  account,
  attempts,
  assignments,
  academyLinked,
  answers,
}: {
  sets: ReturnType<typeof useContent>['sets'];
  account: ReturnType<typeof useCurrentAccount>;
  attempts: ReturnType<typeof useProgress>['attempts'];
  assignments: ReturnType<typeof useProgress>['assignments'];
  academyLinked: boolean;
  answers: ReturnType<typeof useSession>['answers'];
}): StudentItems {

  /**
   * 정적 학습 항목에 내 진행 상태를 얹는다.
   * - 제출한 기록(attempt)이 있으면 완료 + 정답률.
   * - 제출 전이라도 고른 답이 남아 있으면 진행 중 — 답안은 세션에 자동 저장된다.
   *   그래서 5문항 중 2개만 풀고 나온 학습을 목록에서 '이어서 하기'로 알아볼 수 있다.
   */
  const merge = (item: LearningItem): LearningItem => {
    const a = attempts[item.id];
    if (a) return { ...item, status: 'done', accuracy: a.accuracy };
    const picked = answers[item.id];
    const started = !!picked && Object.values(picked).some((choice) => choice != null);
    return started ? { ...item, status: 'in_progress' } : item;
  };

  /*
    **해지된 이용권은 세지 않는다.** `Account.entitlements`에는 해지 행도 그대로 담긴다
    (`toEntitlement`가 `canceled_at`을 `status: 'canceled'`로 옮긴다). 그래서 여기서 종류만 보면
    운영자 화면은 `해지`라고 하고 학생 화면은 개인 카탈로그를 계속 여는 상태가 된다 —
    서버 집계(0014)도 `canceled_at is null`만 센다. 판정을 `isActiveEntitlement` 한곳으로 모은다.
    (지금 seed에는 해지 행이 없어 화면 동작은 그대로다.)
  */
  const hasPersonal = account.entitlements.some(
    (e) => e.kind === 'personal' && isActiveEntitlement(e),
  );
  const personal = (hasPersonal ? personalItems(sets) : []).map(merge);

  /*
    내게 배정된 과제인지 판정한다. **근거는 배정 대상 행 하나뿐이다**(`Assignment.submissions`는
    `v_assignment_submissions` = `assignment_targets`에서 온다).

    대상 행은 배정하는 순간의 로스터로 한 번 박힌다
    (`rpc_add_assignment`가 `v_class_roster`에서 넣는다 —
    `supabase/migrations/0029_null_guards_and_invite_invariants.sql`). 반에 나중에 들어온 학생에게
    지난 배정을 소급하지 않는 것이 확정된 판단이고, `addStudentsToClass`도 대상 행을 채우지 않는다.

    예전에는 `반 소속 ∪ 대상 행`이었다(주석은 "새로 만든 반에 들어간 학생이 과제를 못 받는다"고
    적었다). 그런데 서버 제출 검사는 대상 행만 본다(`rpc_submit_attempt` → `배정받은 학습이
    아니에요.`). 그래서 그 합집합은 학생에게 **끝까지 풀 수 있지만 제출에서 거부되는 과제**를
    보여 주는 자리였고, 학원 집계는 같은 과제를 미제출로 세지도 않았다. 서버와 같은 기준으로
    좁혀 세 역할이 같은 사실을 말하게 한다.
  */
  const academy = assignments
    .filter((a) => a.submissions.some((s) => s.studentId === account.userId) && a.contentId)
    .map((a) => {
      const content = findContent(sets, a.contentId!) as ContentSet | undefined;
      const item: LearningItem = {
        id: a.id,
        source: 'academy',
        subject: '국어',
        area: content?.area ?? '문학',
        title: a.title,
        contentId: a.contentId!,
        questionCount: content?.questions.length ?? a.questionCount,
        status: 'todo',
        dueDate: a.dueDate,
      };
      return merge(item);
    });

  // 학원 연결을 끊으면 새 학원 학습은 감추되 완료 기록은 유지.
  const academyVisible = academyLinked ? academy : academy.filter((i) => i.status === 'done');
  return {
    personal,
    academy: academyVisible,
    all: [...academyVisible, ...personal],
    hasPersonal,
  };
}
