import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { View, Pressable, StyleSheet } from 'react-native';
import {
  Screen,
  Section,
  Group,
  LearningRow,
  Steps,
  Button,
  AppText,
  AskField,
  EmptyState,
  LoadFailed,
  Icon,
  IconButton,
  SourceTag,
} from '@/components';
import { useCurrentAccount, useSession } from '@/session';
import { useStudentItems, useQueuedItems, byDue, dueLabel } from '@/features/learning';
import { useContent } from '@/features/content';
import { formatCount, streakLine, todayLine } from '@/features/records';
import type { StudentRecords } from '@/repo/records';
import { useProgress, PRAISE_LABEL } from '@/features/progress';
import { todayCount } from '@/features/review';
import { todayISO } from '@/features/clock';
import { useToast } from '@/features/toast';
import { useResponsive } from '@/theme/useResponsive';
import { tap } from '@/theme/styles';
import { colors, spacing, radius, typeface, font, touch } from '@/theme/tokens';

/** 홈 목록은 다섯 줄까지만. 그 아래는 전체 목록으로 넘긴다. */
const PREVIEW = 5;

/**
 * 홈의 연속 학습 한 줄. **이 화면에는 값의 자리가 없어서 문장이 수를 함께 말한다.**
 *
 * `streakLine`은 조건만 말한다 — 수는 `Row`의 `trailing`이 맡는다(기록 화면·결과 화면). 홈은
 * 조용한 한 줄이라 그 자리가 없으므로 앞에 `N일 연속 ·`을 붙인다. 그래도 화면에 수는 한 번이고,
 * 연속이 0인 계정에는 붙이지 않는다(`0일 연속`은 뜻이 없는 수치다 — §13).
 */
function streakSummary(records: StudentRecords): string {
  const { current } = records.streak;
  if (current === 0) return streakLine(records);
  return `${formatCount(current)}일 연속 · ${streakLine(records)}`;
}

/**
 * 학생 홈. 3초 안에 "오늘 뭘 해야 하는지" 이해되도록 **세 덩어리**로 흐른다.
 *
 * 1. **확인할 것** — 칭찬 · 새 과제 · 조회 실패. 조용한 한 줄들이고, 확인하면 사라진다.
 * 2. **할 일** — 오늘의 학습(히어로) → 진행 상황 → 남은 학원 과제 → 담아 둔 학습.
 * 3. **막혔을 때** — Scody AI에게 물어보기.
 *
 * 이 순서가 규칙이다. 예전에는 AI 입력창이 2번 덩어리 **중간**(진행 상황과 학원 과제 사이)에
 * 있어서 할 일을 훑는 시선이 큰 입력 박스에 걸려 끊겼다.
 *
 * **한 사실은 한 자리에서만 말한다.** 이 화면은 그 규칙을 세 자리에서 어기고 있었다 —
 * 남은 과제가 하나인 학생에게 그 하나를 네 번 말했고(히어로 · 진행 상황 · 섹션 제목 ·
 * `위에 있는 과제 하나가 남았어요.`), 아무것도 시작하지 않은 학생에게 같은 목적지로 가는
 * `문제 담으러 가기`를 두 번 줬고, 다 끝낸 학생에게 `개인 학습 고르기`와 `문제 담으러 가기`가
 * 같은 곳으로 가는 다른 이름의 버튼으로 함께 서 있었다.
 *
 * **오답노트로 가는 길은 여기 없다**(D-132). 다시 푸는 일은 학습 탭이 맡는다(D-130) —
 * 홈은 오늘 할 일을 말하는 곳이라, 이미 푼 것을 다시 하라는 말이 그 아래에 붙으면
 * 오늘 할 일이 둘로 갈린다.
 *
 * - 오늘의 학습은 **마감이 급한 것부터** 쓴다. 출처가 순서를 정하지 않는다(아래 `next` 주석).
 * - 학원 과제와 담아 둔 학습은 개수를 따로 센다. 합쳐 세면 "학원 과제가 16개"처럼 읽힌다.
 * - Scody AI는 버튼이 아니라 입력창이다. 보내면 대화 화면에서 답이 이어진다.
 */
export default function StudentHome() {
  const router = useRouter();
  // 덩어리 사이 간격을 폭에 맞춰 벌린다(`askGroupGap`).
  const { isMobile } = useResponsive();
  const account = useCurrentAccount();
  const { academy, hasPersonal } = useStudentItems();
  const queued = useQueuedItems();
  const [ask, setAsk] = useState('');
  const [showAllAcademy, setShowAllAcademy] = useState(false);
  const {
    praiseFor,
    dismissPraise,
    wrongNotes,
    attempts,
    records,
    loading: progressLoading,
    loaded: progressLoaded,
    error: progressError,
    reload: reloadProgress,
  } = useProgress();
  const {
    loading: contentLoading,
    loaded: contentLoaded,
    error: contentError,
    reload: reloadContent,
  } = useContent();
  // `answers`는 제출 전 자동 저장 답안이다. 히어로가 `N / M 풀었어요`를 말할 때 센다(A-112).
  const { readOnly, answers } = useSession();
  const { show } = useToast();
  // 부모님이 보낸 칭찬 중 아직 확인하지 않은 것만. 확인하면 다시 뜨지 않는다.
  const praise = praiseFor(account.userId).filter((p) => !p.seen);

  /**
   * 칭찬을 확인해 닫는다. 줄은 곧바로 사라지고 **서버가 받지 못했을 때만** 말한다 —
   * 예전에는 거부돼도 아무 말이 없어서, 다음 조회에서 그 줄이 이유 없이 다시 나타났다.
   * 확인은 성공을 따로 알리지 않는다: 줄이 사라지는 것이 그 자체로 결과다.
   * 대리 보기에서는 쓰기가 거부된다(D-071). 일어나지 않은 일을 알리지 않는다.
   *
   * **확인 한 번은 그 줄 하나만 닫는다.** 예전에는 미확인 전부를 닫았는데(`praise.map`),
   * 화면은 `praise[0]` 하나만 그리고 나머지를 `외 N개`로 접는다 — 그래서 부모가 세 종류를
   * 보내면 자녀는 **하나만 읽고 확인 한 번으로 나머지를 영구히 잃었다.** 학생이 지난 칭찬을
   * 다시 볼 화면은 앱에 없고(`praiseFor`를 읽는 곳은 이 홈과 학부모 리포트뿐), 목록은
   * `sent_on` 오름차순이라(`src/repo/parent.ts`) 보이는 것이 **가장 오래된** 것이었다.
   * 이제 누를 때마다 다음 칭찬이 이어서 나오고, `외 N개`가 하나씩 줄어들며 개수도 맞는다.
   */
  async function seePraise(id: string) {
    const result = await dismissPraise(id);
    if (readOnly) return;
    if (!result.ok) show(result.error ?? '확인하지 못했어요', 'removed');
  }

  /*
    **읽는 중 · 실패 · 빈 목록을 셋으로 가른다.**

    학습 목록은 콘텐츠 조회와 학습 기록 조회 둘에서 온다(`src/features/learning.ts`). 첫 조회가
    끝나기 전에는 배정도 담아 둔 학습도 비어 있어서, 그 창에 개수나 `없어요`를 그리면 학원 과제
    4개가 있는 학생에게 `아직 시작한 학습이 없어요`를 먼저 보여 준다(D-133).

    조회가 **실패해도** 같은 화면이 나온다 — 그때는 `loading`이 내려가므로 로딩 게이트가 덮지
    못했다(M-DB-16). 이제 두 provider가 `error`를 값으로 내보내므로, 개수와 `없어요`를 말하는
    자리마다 실패를 함께 본다. 실패했을 때는 아무것도 단정하지 않고 실패 문장 한 줄과
    다시 시도할 행동만 둔다.

    화면 전체를 기다리게 두지는 않는다 — 개수를 말하는 자리만 기다린다(같은 규칙: `pick.tsx`
    학년 목록 · `result/[id].tsx` `결과를 찾지 못했어요`).
  */
  /**
   * **게이트는 첫 조회에만 걸린다.**
   *
   * 두 provider의 `loading`은 `reading || !loaded`라 **다시 읽을 때마다** 참이 된다
   * (`src/features/progress.tsx` · `src/features/content.tsx`). 그런데 이 화면의 쓰기는 실패하면
   * `reload()`를 부르므로(예: 칭찬 확인), 그 재조회가 도는 동안 `loading`을 보던 네 블록이
   * **통째로 사라졌다** — 진행 상황 · 학원 과제 섹션 · `학원에서 내준 과제물을 모두 마쳤어요.` ·
   * 담아 둔 학습. 게다가 `학습을 불러오고 있어요.` 한 줄은 히어로의 `next`가 없는 가지에만 있어서,
   * 오늘의 학습이 있는 계정에서는 **아무 문장도 없이** 목록이 이유 없이 비었다.
   *
   * 그래서 `loading`이 아니라 **`loaded`**(첫 조회가 끝났는지)를 본다 — `review.tsx`가 D-163으로
   * 같은 사고를 이미 고쳐 둔 방식이다. 손에 있는 목록은 사실이므로 재조회 중에 지울 이유가 없다.
   *
   * **첫 조회가 실패해도 `loaded`는 참이 된다** — 두 provider가 `finally`(콘텐츠는 `done`)에서
   * `loadedFor`를 세팅해 성공·실패 모두 끝으로 보기 때문이다. 그 결정이 이 구조가 성립하는
   * 이유다: 실패해도 게이트가 풀리므로 아래 `loadError` 줄이 정상적으로 나오고, 화면이
   * `불러오고 있어요`에서 영구히 멈추지 않는다.
   */
  const firstLoad = !progressLoaded || !contentLoaded;
  /**
   * **다시 조회가 도는 중**(첫 조회가 아니다). `loading`은 `reading || !loaded`이므로 그것과
   * `loaded`를 함께 보면 재조회만 남는다. 실패 줄의 버튼이 그 사이 라벨로 진행을 말한다(A-130).
   */
  const retrying = (progressLoading || contentLoading) && !firstLoad;
  /**
   * 조회가 실패했을 때 보여 줄 문장. 서버가 준 것을 그대로 쓴다(`errorMessage`).
   *
   * **첫 조회 중에는 감춘다** — 계정을 바꿔 첫 조회가 도는 동안 앞 계정의 실패 문장이 남으면
   * 지금 무슨 일이 일어나는지 알 수 없다(D-136이 `다시 시도`에 대해 정한 것과 같은 이유).
   * 재조회 중에는 감추지 않는다: 그때 화면에는 손에 있는 목록이 그대로 있고, 마지막으로 아는
   * 사실은 여전히 `실패했다`다.
   */
  const loadError = firstLoad ? null : (progressError ?? contentError);

  /**
   * 두 조회가 끝나고 실패도 없을 때만 개수와 `없어요`를 말한다. **네 블록이 같은 조건을
   * 쓴다**(새 과제 알림 · 진행 상황 · 학원 과제 · 담아 둔 학습) — 이름을 하나 두면 다섯 번째
   * 블록이 빠뜨릴 수 없다.
   *
   * 실패했을 때 개수를 세지 않고 `없어요`도 말하지 않는 것은 D-136이 정한 것이라 그대로다 —
   * 바뀐 것은 **언제 기다리는지**(모든 조회 → 첫 조회)뿐이다.
   */
  const ready = !firstLoad && !loadError;

  /** 두 조회를 함께 다시 시도한다. 실패가 어느 쪽에서 왔는지 학생이 고를 일은 아니다. */
  async function retryLoad() {
    await Promise.all([reloadProgress(), reloadContent()]);
  }

  /*
    마감이 이른 과제부터. 학습 탭도 같은 정렬을 쓴다(`byTodoThenDue`).

    **`all`을 거치지 않는다.** D-140이 히어로 후보를 학원 과제로 좁힌 뒤로 `all`(= 학원 배정 +
    공개 개인 학습 전부)을 정렬하고 걸러 낸 결과에서 학원 것만 다시 남기고 있었다 — 카탈로그
    전체를 복사·정렬한 다음 버리는 셈이었다. `academy`가 이미 학원 항목만이므로 거기서 시작한다.
  */
  const academyTodo = academy.filter((i) => i.status !== 'done').sort(byDue);
  // 학원 학습이 아예 없는 학생에게는 학원 얘기를 하지 않는다.
  const hasAcademy = academy.length > 0;

  /**
   * 진행 상황은 학생이 **약속한 일**만 센다: 학원 과제 + 담아 둔 학습.
   * 공개 카탈로그 전체를 분모로 쓰면 아무도 시키지 않은 크기가 할 일로 읽히고,
   * 콘텐츠를 더할 때마다 완료율이 내려간다(공개 개수는 학습 탭이 말한다).
   *
   * - 학원 과제는 배정 수가 곧 목표라 다 풀어도 분모에 남는다(4개 중 4개 완료).
   * - 담아 둔 학습은 풀면 큐에서 빠지므로(`src/features/progress.tsx`) 남은 개수로만 센다.
   *   그래서 완료 수는 학원 과제에서만 늘고, 분자와 분모가 어긋나지 않는다.
   */
  const goalTotal = academy.length + queued.items.length;
  const goalTodo = academyTodo.length + queued.items.length;
  const goalDone = academy.length - academyTodo.length;
  // 0개인 항목은 빼고, 둘 다 비면 줄을 두지 않는다('학원 과제 0개'로 읽히지 않게).
  const goalParts = [
    academyTodo.length > 0 ? `학원 과제 ${academyTodo.length}개` : null,
    queued.items.length > 0 ? `담아 둔 학습 ${queued.items.length}개` : null,
  ].filter((s): s is string => !!s);

  /**
   * 오늘의 학습 후보는 **학생이 약속한 일**뿐이다: 담아 둔 학습 + 남은 학원 과제(D-140).
   * 바로 아래 진행 상황의 분모(`goalTotal`)와 **같은 집합**이라, 진행 상황이
   * `남은 학습이 없어요`라고 말하는 화면에서 히어로만 `시작하기`를 내놓는 일이 없다.
   *
   * **공개 카탈로그(`all` 안의 개인 학습)는 후보가 아니다.** 예전에는 `todo[0]`이라
   * 담아 둔 것도 배정도 없는 학생에게 카탈로그의 첫 세트가 `오늘의 학습`으로 올라왔다 —
   * 학생이 고른 적도, 누가 시킨 적도 없는 항목이다. D-034가 진행 상황에서 이미 같은 판단을
   * 했고(카탈로그 크기를 할 일로 읽지 않는다) 히어로도 같은 기준을 쓴다. 새로 고르는 일은
   * 아래 캡션과 `담아 둔 학습` 빈 상태가 맡는다.
   *
   * **순서를 정하는 것은 출처가 아니라 마감이다.** D-140의 값은 `queued.items[0] ?? academyTodo[0]`
   * 이라 담아 둔 학습이 하나라도 있으면 무조건 그것이 히어로였다. 그래서 개인 학습을 담아 두고
   * 학원 과제 마감이 지난 학생의 홈에서는 **가장 큰 글자(제목)가 마감 없는 개인 학습**이고, 지난
   * 마감은 아래 목록 한 줄과 `sm` 보조 버튼(`과제 먼저 하기`)으로만 나왔다 — 급한 것이 안 급한
   * 것보다 작았다. 마스터 플랜 4절은 홈이 "오늘 해야 하는 학습을 **우선순위로**" 말하는 곳이라고
   * 적는데, 그 우선순위가 마감이 아니라 출처였다.
   *
   * 이제 두 목록을 합쳐 `byDue` 하나로 고른다(학습 탭·학원 과제 목록과 같은 정렬 함수 — D-043):
   * **마감이 있는 것 먼저 → 마감이 이른 순**. 마감이 없는 것끼리는 정렬이 안정적이라 입력 순서가
   * 그대로 남으므로, 담아 둔 학습을 앞에 놓아 **담은 순서**를 지킨다(개인 학습에는 마감이 없다 —
   * `contentToPersonalItem`). 급한 과제가 없는 학생에게는 예전과 같은 화면이다.
   */
  const next = [...queued.items, ...academyTodo].sort(byDue)[0];
  const nextDue = dueLabel(next?.dueDate);
  /**
   * 히어로가 가리키는 학습을 **이미 시작했는지**. 한 문항이라도 답을 고르면 `in_progress`가 된다
   * (`buildStudentItems`의 `merge` — 답안은 제출 전에도 자동 저장된다).
   */
  const nextStarted = next?.status === 'in_progress';
  /**
   * 이어서 풀 학습이면 어디까지 풀었는지 말한다(A-112). 형식은 풀이 화면과 같은
   * `N / M 풀었어요`라, 홈에서 읽은 숫자가 들어간 화면 첫 줄에 그대로 이어진다.
   *
   * 세는 값은 자동 저장된 답안이다. 문항이 줄어든 세트에 지난 답이 남아 있으면 문항 수보다 큰
   * 숫자가 나올 수 있어 잘라 둔다 — `4 / 3 풀었어요`는 학생이 고칠 수 없는 말이다.
   */
  const nextAnswered = next
    ? Math.min(
        Object.values(answers[next.id] ?? {}).filter((c) => c != null).length,
        next.questionCount,
      )
    : 0;
  /**
   * 아직 아무 학습도 없는 계정에는 `다 끝냈어요`라고 말하지 않는다.
   *
   * **기준은 `all`이 아니라 약속된 집합이다**(D-143). 예전에는 `all.length === 0`을 봤는데,
   * `all`에는 공개 카탈로그가 들어 있어서 **개인 이용권이 있으면 아무것도 안 해도** 이 값이
   * 거짓이 됐다. 그러면 담은 것도 배정도 없고 낸 것도 없는 학생에게 히어로가
   * `오늘 할 일을 다 끝냈어요`라고 말한다 — 끝낸 것이 하나도 없는데.
   *
   * D-140이 히어로 후보를 약속한 일로 좁혔으니 `완료` 판정도 같은 집합을 봐야 한다.
   * `goalTotal`(남은 학원 과제 + 담아 둔 학습 + 낸 학원 과제)이 0이면 약속된 일이 애초에
   * 없었다는 뜻이므로 `끝냈다`가 성립하지 않는다.
   *
   * **그런데 `goalTotal`만 보면 반대쪽으로 틀린다**(D-154). 개인 학습을 제출하면 서버가 그
   * 학습을 담아 둔 목록에서 지우고(`rpc_submit_attempt`), 고르기에서 담지 않고 바로 푼 학습은
   * 애초에 그 목록에 들어오지 않는다. 그래서 **학원 소속이 없는 학생은 공부를 할수록
   * `goalTotal`이 0으로 돌아온다** — 방금 한 세트를 다 푼 김서준의 홈이
   * `아직 시작한 학습이 없어요`였다(실측). D-143이 없앤 거짓말의 정확한 반대쪽이다.
   *
   * 그래서 **제출 기록이 하나라도 있으면 `아직 시작한 학습이 없어요`라고 하지 않는다.**
   * 그 학생은 약속된 일이 없을 뿐 시작은 했고, 그때 할 수 있는 일은 아래 캡션(`restCaption`)이
   * 이미 열린 길만 가리켜 말한다.
   */
  const nothingYet = goalTotal === 0 && Object.keys(attempts).length === 0;
  /**
   * **오늘 낸 것이 있는가.** `오늘 할 일을 다 끝냈어요`가 `오늘`을 말할 자격의 근거다(M9-15 ②).
   *
   * 그 문장의 실제 조건은 `약속된 일(학원 배정 + 담아 둔 학습)이 0개이고 과거 제출이 있다`였고
   * 시점 개념이 없었다. 그래서 **개인 이용권 계정에는 학습을 시작한 다음 날부터 영구 상태**가
   * 됐다 — 마지막 제출이 이틀 전인 학생이 오늘 아무것도 하지 않아도 홈의 가장 큰 글자가
   * `오늘 할 일을 다 끝냈어요`였다. 마스터 플랜 1절(`학생은 오늘 무엇을 해야 하는지 바로 안다`)이
   * 그 계정군에서 뒤집힌다 — 홈이 매일 "오늘은 안 해도 된다"고 말한다.
   *
   * **`약속된 일이 없다`와 `오늘 할 일을 끝냈다`는 다른 사실이다.** 둘을 갈라 말한다.
   * 히어로 후보를 새로 만들지는 않는다 — 그것은 D-140·D-034를 다시 여는 일이다(M9-15 ③).
   */
  const doneToday = Object.values(attempts).some((a) => a.dateISO === todayISO());
  /**
   * 히어로가 `문제 담으러 가기`를 내놓는 상태. 그러면 아래 `담아 둔 학습` 빈 상태에서는
   * 같은 버튼을 두지 않는다 — 같은 목적지로 가는 같은 이름의 버튼이 한 화면에 둘이 된다.
   */
  const heroOffersPick = nothingYet && hasPersonal;
  /**
   * `학원에서 내준 과제물을 모두 마쳤어요.` 한 줄이 그려지는 상태. 그 줄은 스스로 경계선이
   * 없어서 뒤에 오는 블록과 맞닿으면 구분이 사라진다 — 그때만 뒤 섹션에 hairline을 준다(§6).
   */
  const academyCleared = hasAcademy && academyTodo.length === 0;
  // 히어로에 올린 학습은 아래 목록에서 뺀다. 같은 것이 두 번 보이지 않게.
  const academyList = academyTodo.filter((i) => i.id !== next?.id);
  const queueList = queued.items.filter((i) => i.id !== next?.id);
  const visibleAcademy = showAllAcademy ? academyList : academyList.slice(0, PREVIEW);
  // 히어로가 이미 학원 과제를 가리키면 같은 행동을 두 번 두지 않는다.
  const academyFirst = next?.source === 'academy' ? undefined : academyList[0];

  /**
   * 아직 손대지 않은 학원 과제. 한 문항이라도 풀면 `in_progress`가 되어 빠진다(D-035).
   * 마감이 지난 것은 세지 않는다 — 이미 늦은 일을 '새로 왔다'고 알리면 재촉이 된다.
   * 선생님이 마감일을 다시 정해 주면(재배정) 여기에 다시 들어온다.
   */
  const freshAcademy = academyTodo.filter(
    (i) => i.status === 'todo' && !dueLabel(i.dueDate)?.overdue,
  );

  /*
    **할 수 없는 일에는 버튼을 두지 않고 이유를 한 줄로 말한다**(`DESIGN.md` §8 · D-141).

    개인 이용권이 없는 학생에게 이 화면은 세 자리에서 사실이 아닌 말을 했다: `개인 학습 고르기`가
    고를 것이 하나도 없는 학습 탭으로 보냈고(`learn.tsx`는 `hasPersonal`이 false면 진입 줄을
    아예 렌더하지 않는다), `오늘 할 일을 다 끝냈어요` 캡션이 오답노트가 비어 있는데도 오답 복습을
    가리켰고, 배정을 아직 받지 못한 학원 학생에게 `문제 담으러 가기`를 줬다.

    이용권을 시작하는 진입점은 아직 없다(A-096 · 결제는 5절 범위 밖) — 그래서 없는 길을
    가리키지 않고 지금의 사실만 말한다.
  */
  /** 오답노트에 담아 둔 것이 있을 때만 오답 복습을 가리킬 수 있다. */
  const canReview = wrongNotes.length > 0;
  /**
   * 오늘 차례가 온 오답 수. **홈에 복습을 두는 근거가 이 값이다.**
   *
   * D-132는 홈에 오답노트로 가는 길을 두지 않기로 정했고, 근거는 "이미 푼 것을 다시 하라는 말이
   * 오늘 할 일 아래에 붙으면 오늘 할 일이 둘로 갈린다"였다. **그 근거는 복습에 시점이 없을 때
   * 성립한다** — 아무 때나 해도 되는 일은 오늘 할 일이 아니다. 서버가 정한 차례가 오늘이면
   * 그것은 오늘 할 일이고, D-170이 정한 것도 히어로의 순서를 정하는 것은 출처가 아니라 마감이라는
   * 규칙이다.
   *
   * **그래도 히어로에는 올리지 않는다.** 히어로는 하나이고, 복습이 그 자리를 차지하면 마감이 오늘인
   * 학원 과제를 밀어낼 수 있다. `확인할 것` 줄에 둔다 — 화면 맨 위는 확인할 것이고 그 아래가
   * 할 일이라는 이 화면의 위계를 그대로 쓴다.
   */
  const dueToday = useMemo(() => todayCount(wrongNotes, todayISO()), [wrongNotes]);
  /** 새로 고를 수 없는 계정에 그 이유(또는 지금 기다리는 것)를 말하는 한 줄. */
  const noPickReason = account.academyName
    ? '학원에서 과제를 내주면 여기에서 알려 줘요.'
    : '개인 학습 이용권이 없어서 아직 고를 수 있는 학습이 없어요.';
  /** `오늘 할 일을 다 끝냈어요` 아래 한 줄. 실제로 열려 있는 길만 가리킨다. */
  const restCaption =
    canReview && hasPersonal
      ? '학습 탭에서 오답을 다시 풀거나 새 학습을 골라볼 수 있어요.'
      : canReview
        ? '학습 탭에서 오답을 다시 풀어볼 수 있어요.'
        : hasPersonal
          ? '학습 탭에서 새 학습을 골라볼 수 있어요.'
          : noPickReason;

  /**
   * `담아 둔 학습` 섹션을 그릴지.
   *
   * ①조회가 끝났고 ②히어로가 이미 `문제 담으러 가기`를 내놓지 않았고 ③이용권이 있거나 담은 것이
   * 있을 때 그린다.
   *
   * **섹션을 통째로 감추지는 않는다**(A-127). 담은 것이 하나이고 그것이 히어로일 때 학원 쪽처럼
   * 섹션째 없애 봤는데, 그러면 **홈에서 담아 둔 학습 화면으로 가는 길이 사라진다**(`전체 N개`가
   * 그 유일한 진입점이다 — E2E 둘이 그 여정을 지키고 있었다). 없애야 하는 것은 목록 대신 있던
   * `담아 둔 학습을 위에서 이어서 풀어요.` 한 줄뿐이다: 그것은 히어로를 보면 아는 사실이고,
   * 제목과 링크는 각자 다른 일을 한다(묶음 이름 · 전체로 가는 문).
   */
  const showQueue = ready && !heroOffersPick && (hasPersonal || queued.items.length > 0);

  const go = (id: string) => router.push(`/student/${id}` as never);

  function sendAsk() {
    const q = ask.trim();
    if (!q) return;
    setAsk('');
    router.push(`/student/ask?q=${encodeURIComponent(q)}` as never);
  }

  return (
    <Screen testID="student-home">
      <AppText variant="caption" tone="secondary">
        {account.name} 님, 오늘도 반가워요
      </AppText>

      {/*
        ## 오늘의 기록과 연속 학습

        **인사 바로 아래, 확인할 것보다 위에 둔다.** 이 줄은 `무엇이 달라졌는지`(칭찬·새 과제·
        오늘 볼 오답)가 아니라 **지금 내 상태**라, 그 셋과 섞이면 학생이 눌러야 할 것을 고르지
        못한다. 그래서 자리는 위이고 **색은 강조색이 아니다** — 아래 세 줄이 강조색을 쓰고,
        이 줄이 같은 색이면 넷 다 알림처럼 보인다.

        **카드로 만들지 않는다.** 히어로(오늘의 학습)가 이 화면의 하나뿐인 주요 행동이고,
        위에 면을 하나 더 두면 무엇을 먼저 볼지 갈린다(D-167). 큰 숫자와 축하는 결과 화면과
        기록 화면이 맡는다.

        **`ready`를 기다린다.** 조회 전에 `기록이 시작돼요`를 그리면, 17일 이어 온 학생에게
        한 프레임 동안 거짓을 말한다(이 파일이 `loadedFor`로 이미 한 번 고친 창이다).
      */}
      {ready && records ? (
        <Pressable
          testID="home-record"
          accessibilityRole="link"
          accessibilityLabel={`${streakSummary(records)}${
            todayLine(records) ? `. 오늘 ${todayLine(records)}` : ''
          }. 나의 기록 보기`}
          onPress={() => router.push('/student/records' as never)}
          /*
            **`tap.textLine`을 쓰지 않는다.** 그 상수의 음수 마진(-12)은 **캡션 한 줄(약 20px)**
            기준이고(`src/theme/styles.ts`가 그렇게 적어 두었다) 이 줄은 캡션 둘(약 42px)이라,
            늘어난 높이가 아니라 **덩어리 사이 간격을 먹었다** — 모바일에서 위아래가 약 5px로
            붙었다(실측). 내용이 이미 44에 가까우므로 여기서는 `minHeight`만 준다
            (`Brand`가 같은 이유로 자기 높이로 계산하는 선례다).
          */
          style={({ pressed }) => [
            styles.notice,
            styles.recordRow,
            pressed && { backgroundColor: colors.hover },
          ]}
        >
          <Icon name="activity" size={15} color={colors.inkSecondary} />
          <View style={styles.recordLines}>
            <AppText variant="caption" weight="semibold">
              {streakSummary(records)}
            </AppText>
            {todayLine(records) ? (
              <AppText testID="home-record-today" variant="caption" tone="tertiary">
                오늘 {todayLine(records)}
              </AppText>
            ) : null}
          </View>
          {/*
            **눌린다는 신호가 이 화면에서 가장 흐린 색이면 안 된다.** 예전에는
            `size={14}` + `inkTertiary`(§3이 `bg` 위 2.96:1로 실측해 둔 토큰)였고, 정작 눌리지 않는
            아래 줄들은 전부 강조색이었다 — 강조색을 안 쓴 유일한 줄이 눌리는 줄이었다.
            무게는 `Row`의 chevron과 같은 18로 올리고 색은 대비가 있는 `inkSecondary`로 둔다.
            **강조색으로 바꾸지 않는다**: 아래 세 줄이 강조색이라 넷 다 알림처럼 보인다(D-179).
          */}
          <Icon name="chevron-right" size={18} color={colors.inkSecondary} />
        </Pressable>
      ) : null}

      {/*
        부모님이 보낸 칭찬. 히어로보다 위에 **조용한 한 줄**로 둔다 — 카드로 만들면
        오늘 할 일보다 무거워진다. 확인하면 사라지므로 화면에 영구히 박히지 않는다.
      */}
      {praise[0] ? (
        <View style={styles.notice}>
          <Icon name="star" size={15} color={colors.accent} />
          <AppText variant="caption" tone="accent" style={styles.noticeText}>
            {praise[0].from} 님이 칭찬을 보냈어요 · {PRAISE_LABEL[praise[0].kind]}
            {praise.length > 1 ? ` 외 ${praise.length - 1}개` : ''}
          </AppText>
          {/*
            **`IconButton`이 이 일을 한다** — 글리프는 그대로 두고 누름 영역만 44로 키운다.
            맨 `Pressable` + `Icon` + `minHeight/minWidth: 44` 스타일로 손으로 쌓고 있었는데,
            그것이 정확히 그 컴포넌트의 정의다(`DESIGN.md` §8).
          */}
          <IconButton
            testID={`praise-seen-${praise[0].id}`}
            name="check"
            label="칭찬 확인"
            active
            onPress={() => void seePraise(praise[0].id)}
          />
        </View>
      ) : null}

      {/*
        **새로 온 과제는 히어로가 대신 말할 수 없다.**

        히어로는 *무엇을* 할지 말하고, 이 줄은 *무엇이 달라졌는지* 말한다 — 어제 `마감이
        지났어요`를 봤던 학생이 오늘 다시 열렸다는 사실을 아는 곳이다. 예전에는 이 줄이 학원 과제
        **섹션 안**에 있어서, 새로 온 과제가 히어로에 올라가면(= 배정이 그것 하나면) 목록이 비어
        섹션째로 사라지거나 `위에 있는 과제 하나가 남았어요.` 옆에 붙어 있었다.

        그래서 칭찬과 같은 자리로 올린다. 화면 맨 위는 **확인할 것**이고 그 아래가 할 일이다.
        카드로 만들지 않는다 — 조용한 한 줄이어야 오늘 할 일보다 무거워지지 않는다.
      */}
      {ready && freshAcademy.length > 0 ? (
        <View style={styles.notice}>
          <Icon name="file-plus" size={15} color={colors.accent} />
          <AppText testID="home-academy-new" variant="caption" tone="accent" style={styles.noticeText}>
            {freshAcademy.length > 1
              ? `아직 시작하지 않은 과제가 ${freshAcademy.length}개 있어요`
              : '아직 시작하지 않은 과제가 있어요'}
          </AppText>
        </View>
      ) : null}

      {/*
        **오늘 차례가 온 오답.** 담기는 1클릭인데 돌아올 이유가 화면 어디에도 없던 것이 이
        흐름의 가장 큰 결함이었다 — 남은 과제가 하나라도 있으면 홈은 오답을 한 글자도 말하지
        않았고, 학습 탭 세 번째 섹션까지 스크롤해야 `오답 20개`를 만났다.

        **개수는 밀린 것을 앞세우지 않는다.** 서른 개가 밀려도 오늘 볼 것은 하루 상한까지다 —
        「37개 밀렸어요」는 겁주는 문장이고, 큐를 정직하게 쌓아 둔 서비스에서 반복 관찰된 이탈
        원인이다. 위 학원 과제 줄과 같은 모양의 조용한 한 줄로 둔다(카드로 만들지 않는다).
      */}
      {ready && dueToday > 0 ? (
        /*
          **글자 한 줄인 링크는 `tap.textLine`으로 44를 만든다**(§10 · D-166). 캡션 한 줄의 높이는
          약 20px이고, 이 줄은 홈에서 카드 복습으로 가는 두 진입점 중 하나다 — 손가락으로 조준할
          수 없으면 없는 것과 같다. 음수 마진이 늘어난 높이를 되돌리므로 덩어리 여백은 그대로다.

          **위아래 두 줄(칭찬·새 과제)은 눌리지 않는다.** 같은 모양이면 학생은 이 줄이 눌린다는
          것을 모른다 — 이동 표시를 오른쪽 끝에 둔다(§8).
        */
        <Pressable
          testID="home-review-due"
          accessibilityRole="link"
          accessibilityLabel={`오늘 다시 볼 오답 ${dueToday}개, 카드 복습으로 가기`}
          onPress={() => router.push('/student/review' as never)}
          style={({ pressed }) => [
            styles.notice,
            tap.textLine,
            pressed && { backgroundColor: colors.hover },
          ]}
        >
          <Icon name="refresh-cw" size={15} color={colors.accent} />
          <AppText variant="caption" tone="accent" style={styles.noticeText}>
            오늘 다시 볼 오답 {dueToday}개가 있어요
          </AppText>
          <Icon name="chevron-right" size={14} color={colors.accent} />
        </Pressable>
      ) : null}

      {/*
        **조회가 실패하면 계정이 비었다고 말하지 않는다**(M-DB-16). 인라인 `danger` 캡션 +
        다시 시도할 행동 한 줄이다(`DESIGN.md` §9 · `app/academy/manage.tsx`의
        `초대를 불러오지 못했어요`와 같은 갈래).

        면을 하나만 둔다 — 아래 히어로·진행 상황·학원 과제·담아 둔 학습이 모두 이 조회에
        매달려 있어서, 자리마다 빨간 줄을 두면 한 번의 실패가 네 번으로 읽힌다.
        조회가 절반만 성공해도(콘텐츠는 왔고 기록은 못 왔거나 그 반대) 이 줄은 남는다.
      */}
      {loadError ? (
        <LoadFailed
          testID="home-load-failed"
          retryTestID="home-load-retry"
          what="학습"
          message={loadError}
          retrying={retrying}
          onRetry={() => void retryLoad()}
        />
      ) : null}

      {next ? (
        <View testID="today-primary" style={styles.hero}>
          <View style={styles.heroTop}>
            <AppText variant="caption" tone="secondary" style={styles.heroLabel}>
              오늘의 학습
            </AppText>
            <SourceTag source={next.source} />
          </View>
          {/*
            **히어로 제목이 이 화면의 1단계 제목이다.**

            `variant="title"`이라 크기(xxl 27)와 무게(bold)는 그대로이고, 줄간격·자간이 §4의
            규칙 값으로 간다(1.3 = 35.1px · -0.3). 손으로 쌓은 스타일은 1.2 · -0.4라 §4의 하한
            (큰 한글 제목 1.3 이상 · 자간 -0.2 정도까지)을 벗어나 390에서 두 줄이 된 긴 제목이
            뭉쳤다 — D-166이 없앤 우회가 이 자리에 남아 있었다.

            `headingLevel`은 크기와 별개로 **문서 구조**를 말한다(D-166). 이 화면은 `Screen`에
            `title`을 주지 않아 h1이 없었고, 남는 제목은 조건부 섹션 둘(h2)뿐이라 처음 온 학생과
            과제를 다 낸 학원 학생의 홈에는 **제목이 0개**였다(학생 탭 넷 중 홈만 그랬다).
            히어로 제목 세 가지에 모두 주므로 어느 상태에서도 h1이 정확히 하나다.
          */}
          <AppText variant="title" headingLevel={1}>
            {next.title}
          </AppText>
          {/*
            **이어서 풀 학습이면 문항 수 대신 진행을 말한다**(A-112). 예전에는 이 줄이 늘
            `문항 수 · 마감`이라, 3문항까지 풀어 둔 학생의 홈이 그 사실을 한 글자도 말하지 않고
            처음 시작하는 학습처럼 보였다. 분모가 문항 수라 `10문항`을 함께 두면 같은 숫자를
            한 줄에서 두 번 말한다.
          */}
          <AppText variant="caption" tone="secondary">
            국어 · {next.area} ·{' '}
            {nextStarted
              ? `${nextAnswered} / ${next.questionCount} 풀었어요`
              : `${next.questionCount}문항`}
            {nextDue && !nextDue.overdue ? ` · ${nextDue.text}` : ''}
          </AppText>
          {/* 지난 마감은 다른 메타에 묻히지 않게 한 줄로 분리한다. */}
          {nextDue?.overdue ? (
            <AppText variant="caption" style={styles.overdue}>
              {nextDue.text}
            </AppText>
          ) : null}
          {/* 남은 개수는 바로 아래 진행 상황이 말한다. 히어로에서 또 말하지 않는다. */}
          <View style={styles.heroCta}>
            {/*
              **같은 행동은 같은 이름이다**(A-112). 이 버튼은 상태를 보지 않고 늘 `시작하기`라서
              풀던 학습에 대해서도 처음 시작한다고 말했다 — 같은 학습을 목록은 `이어서 하기`,
              상세는 `이어서 풀기`라고 부르고 있어 한 행동의 이름이 셋이었다. 이어서 푸는 일의
              이름은 `이어서 풀기` 한 벌로 두고, 목적지(학습 상세)의 버튼과 글자까지 맞춘다.
            */}
            <Button label={nextStarted ? '이어서 풀기' : '시작하기'} onPress={() => go(next.id)} />
          </View>
        </View>
      ) : firstLoad ? (
        /*
          첫 조회 중에는 히어로를 그리지 않고 한 줄만 둔다. 카드를 남겨 제목 자리를 비우면
          빈 카드가 곧 `할 일이 없다`는 뜻으로 읽힌다. 문장과 무게는 `pick.tsx`와 같다.

          재조회 중에는 이 가지에 오지 않는다 — 그때 `next`가 없다는 것은 손에 있는 목록이
          실제로 비었다는 뜻이고, 아래 세 가지가 그 상태를 말한다.
        */
        <AppText variant="caption" tone="secondary">
          학습을 불러오고 있어요.
        </AppText>
      ) : loadError ? (
        /*
          실패했을 때는 히어로를 그리지 않는다. `아직 시작한 학습이 없어요`도
          `오늘 할 일을 다 끝냈어요`도 모르는 상태에서는 둘 다 거짓말이다 —
          위의 실패 줄이 그 자리를 대신한다.
        */
        null
      ) : nothingYet ? (
        <View style={styles.hero}>
          <AppText variant="caption" tone="secondary" style={styles.heroLabel}>
            오늘의 학습
          </AppText>
          <AppText variant="title" headingLevel={1}>
            아직 시작한 학습이 없어요
          </AppText>
          <AppText variant="caption" tone="secondary">
            {hasPersonal ? '새 학습을 골라볼까요?' : noPickReason}
          </AppText>
          {/*
            **이용권이 없으면 고르러 가는 행동을 두지 않는다**(D-141). 그 목적지에서 이 학생이
            누를 수 있는 것은 0개다 — 가입 직후 계정이 두 번째 화면에서 흐름이 끊긴 자리가
            여기였다(A-096). 위 캡션이 이유를 말한다.

            이 버튼이 남는 경우는 **개인 이용권이 있고 약속된 일이 아직 없을 때**다
            (담아 둔 것도 학원 배정도 없는 계정 — seed의 김서준이 그렇다). 그 학생에게는
            고르러 가는 것이 실제로 다음 행동이다.
          */}
          {hasPersonal ? (
            <View style={styles.heroCta}>
              {/*
                `문제 담으러 가기`의 무게는 앱 어디서나 같다: **강조색 + `hug` + 화살표**
                (`queue.tsx` 두 곳 · `records.tsx` 한 곳도 같다). §8이 이름까지 지목한
                `다른 화면으로 보내기만 하는 버튼`이라 전폭이 아니고, 그래도 화면의 다음
                행동이라 강조색은 남긴다. 폭이 위계를 말한다 — 전폭은 그 화면을 끝내는
                버튼만 쓴다.
              */}
              <Button
                testID="home-empty-start"
                hug
                label="문제 담으러 가기"
                trailing={<Icon name="arrow-right" size={16} color={colors.accentText} />}
                onPress={() => router.push('/student/learn' as never)}
              />
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.hero}>
          <AppText variant="caption" tone="secondary" style={styles.heroLabel}>
            오늘의 학습
          </AppText>
          <AppText variant="title" headingLevel={1}>
            {doneToday ? '오늘 할 일을 다 끝냈어요' : '지금 해야 할 학습이 없어요'}
          </AppText>
          {/*
            **가리키는 곳이 실제로 열려 있어야 한다**(D-141). 이 문장은 오래 두 절을 고정으로
            말했는데, 오답노트가 비어 있고 개인 이용권도 없는 학생에게는 **두 절 모두 거짓**이었다.
          */}
          <AppText variant="caption" tone="secondary">
            {restCaption}
          </AppText>
        </View>
      )}

      {/*
        진행 상황: 출처를 섞어 세지 않는다.

        **줄과 칸을 한 덩어리로 묶는다.** 예전에는 줄에 `marginBottom: -spacing.md`를 상시로
        걸어 칸을 끌어올렸는데, `Steps`는 개수가 12를 넘으면 스스로 아무것도 그리지 않는다.
        그때는 음수 마진이 다음 섹션을 끌어당겨 `남은 학습 13개`와 `Scody AI에게 물어보기`가
        4px 사이로 붙어 한 덩어리로 읽혔다. 이제 바깥 컬럼 간격은 이 덩어리 하나에만 걸린다.
      */}
      {/*
        조회 중에는 세지 않는다 — 절반만 온 목록으로 `남은 학습 2개`라고 말하게 된다.
        실패했을 때도 세지 않는다: 못 읽은 목록으로 센 숫자는 로딩 중에 센 숫자와 똑같이 거짓이다.
      */}
      {ready && goalTotal > 0 ? (
        <View style={styles.progressBlock}>
          <View testID="home-progress" style={styles.progress}>
            <View style={styles.progressText}>
              {/*
                **다 끝낸 화면에서는 남은 개수를 말하지 않는다.** 바로 위 히어로가 이미
                `오늘 할 일을 다 끝냈어요`라고 말하는데 여기서 `남은 학습이 없어요`라고 또 하면
                같은 사실이 두 번이다. 그때 이 줄이 말할 것은 **얼마나 했는지**다.
              */}
              <AppText variant="label">
                {goalTodo === 0 ? '마친 학습' : `남은 학습 ${goalTodo}개`}
              </AppText>
              {/*
                **한 종류만 남아도 그 종류를 말한다.** `학원 과제 1개` 아래 `남은 학습 1개`가
                같은 숫자를 두 번 말하는 것처럼 보여 한때 이 줄을 두 종류일 때만 그렸는데,
                이 줄의 일은 숫자가 아니라 **출처**다 — `남은 학습 1개`만으로는 그것이 학원이
                내준 것인지 내가 담은 것인지 알 수 없다. 확정 정책 4절이 "남은 개수는 학원 과제와
                개인 학습을 따로 센다"고 정해 두었고, E2E 둘이 그 계약을 지키고 있었다
                (`auth-flow` 학생 홈은 남은 학습을 출처별로 센다 · `student-flow` 진행 상황은
                학원 과제와 담아 둔 학습만 센다).
              */}
              {goalParts.length > 0 ? (
                <AppText variant="caption" tone="secondary">
                  {goalParts.join(' · ')}
                </AppText>
              ) : null}
            </View>
            {/*
              **분자가 정의상 0인 계정에는 완료 숫자를 두지 않는다**(M9-16 ①).
              `rpc_submit_attempt`가 개인 학습을 제출하면 담아 둔 목록에서 그 세트를 지우므로
              `goalDone = academy.length - academyTodo.length`는 학원 소속이 없는 학생에게
              **항상 `0 - 0`**이다 — 담아 둔 3개 중 2개를 푼 학생이 `0 / 1 완료`와 전부 회색인
              칸을 봤다. 그 학생에게 지워도 잃는 정보가 없고, 왼쪽 두 줄(`남은 학습 N개` ·
              `담아 둔 학습 N개`)이 말할 것을 다 말한다.

              분자를 실제로 늘리는 쪽(제출한 개인 학습을 분자·분모에 더하기)은 확정 정책 4절의
              분모 정의와 D-034를 다시 여는 일이라 하지 않았다(M9-16 ②).

              `/ N 완료`는 **큰 숫자가 무슨 뜻인지 말하는 유일한 글자**라 `tertiary`로 두지 않는다
              (A-123의 방향 — 정보를 담은 캡션은 `secondary`다).
            */}
            {hasAcademy ? (
              <View style={styles.progressRight}>
                <AppText style={styles.progressNum}>{goalDone}</AppText>
                <AppText variant="caption" tone="secondary" style={styles.progressTotal}>
                  / {goalTotal} 완료
                </AppText>
              </View>
            ) : null}
          </View>
          {/*
            비율 막대가 아니라 **칸**이다. 옆에 `3 / 5 완료`라고 이미 적혀 있어서 같은 비율을
            막대로 또 그리면 같은 말이 두 번이 된다. 칸은 개수를 말한다 — 몇 개 남았는지가 보인다.
            셀 것이 하나뿐이면 `Steps`가 스스로 그리지 않는다.
          */}
          {hasAcademy ? <Steps done={goalDone} total={goalTotal} /> : null}
        </View>
      ) : null}

      {/*
        학원 과제. 조회 중에도, 조회가 실패했을 때도 이 면을 두지 않는다 — 배정을 못 읽은
        상태에서 `학원에서 내준 과제물을 모두 마쳤어요.`가 나오면 마치지 않은 과제를 마쳤다고
        말한다. 실패는 위 한 줄이 이미 말했다.
      */}
      {/*
        **목록이 있을 때만 섹션을 둔다.**

        예전에는 남은 과제가 하나(= 히어로에 올라간 그것)뿐인 학생에게도 이 섹션이 그려져
        `학원에서 내준 과제가 있어요` 제목 아래 `위에 있는 과제 하나가 남았어요.`가 남았다.
        둘 다 히어로를 보면 아는 사실이라, 과제 1개인 화면이 그 하나를 **네 번** 말하고 있었다
        (히어로 · 진행 상황 · 이 제목 · 이 문장).

        새로 온 과제 알림은 화면 맨 위로 올렸다 — 히어로에 올라갔든 아니든 보여야 하는
        상태 변화이기 때문이다.

        `academyList ⊂ academyTodo ⊂ academy`라 `hasAcademy`·`academyTodo.length > 0`을 다시
        묻지 않는다. 아래 `academyCleared`와 형제로 두면 조건 하나가 곧 그려지는 블록 하나다.
      */}
      {ready && academyList.length > 0 ? (
        <Section
          title="학원에서 내준 과제"
          action={
            academyFirst ? (
              <Button
                testID="home-academy-first"
                variant="secondary"
                size="sm"
                label="과제 먼저 하기"
                tone="accent"
                trailing={<Icon name="arrow-right" size={15} color={colors.accent} />}
                onPress={() => go(academyFirst.id)}
              />
            ) : null
          }
        >
          <Group>
            {visibleAcademy.map((i) => (
              <LearningRow key={i.id} item={i} onPress={() => go(i.id)} />
            ))}
          </Group>
          {/*
            **펼친 것은 접을 수 있어야 한다**(A-131). 한 방향뿐이라 배정이 6건 이상인 학생이 한 번
            펼치면 그 세션 동안 홈이 계속 길었다. D-144가 결과 화면에서 정한 `N개 더 보기` ↔ `접기`
            한 벌을 그대로 쓴다.
          */}
          {academyList.length > PREVIEW ? (
            <Button
              testID="home-academy-more"
              variant="secondary"
              size="sm"
              tone="accent"
              hug
              label={showAllAcademy ? '접기' : `과제 ${academyList.length - PREVIEW}개 더 보기`}
              onPress={() => setShowAllAcademy((v) => !v)}
            />
          ) : null}
        </Section>
      ) : null}

      {/*
        **다 마쳤다는 사실은 한 줄이다.**

        카드였고 그 안에 `개인 학습을 해볼까요?`와 `개인 학습 고르기` 버튼이 있었다. 그런데
        그 버튼의 목적지(`/student/learn`)는 아래 `담아 둔 학습`의 `문제 담으러 가기`와
        **같은 곳**이다 — 이름만 다른 같은 행동이 한 화면에 둘이었고, 그 위 히어로 캡션까지
        같은 길을 글로 가리켜 셋이 됐다. 새로 고르는 행동은 `담아 둔 학습`이 맡는다(거기가
        담긴 것을 보여 주는 자리이므로 비었을 때 채우라고 말하는 것이 자연스럽다).

        면도 벗겼다. 없다는 사실을 카드로 감싸면 있는 것보다 무거워진다(§6 — 단순한 구분은
        여백·타이포가 한다). 조회 중·실패에는 두지 않는다 — 배정을 못 읽은 상태에서 이 문장은
        마치지 않은 과제를 마쳤다고 말한다.
      */}
      {ready && academyCleared ? (
        <AppText testID="academy-cleared" variant="label">
          학원에서 내준 과제를 모두 마쳤어요.
        </AppText>
      ) : null}

      {/*
        담아 둔 개인 학습. `hasPersonal`은 이용권이라 조회를 기다리지 않고 참이 되는데,
        담아 둔 목록은 두 조회가 끝나야 채워진다(담긴 값은 개인 학습에서 찾는다). 그 창에
        이 면을 두면 담아 둔 학습이 있는 학생에게 `담아 둔 학습이 없어요.`를 보여 준다.
        실패했을 때도 같다 — 못 읽은 목록을 없는 목록으로 말하지 않는다.
      */}
      {/*
        **히어로가 이미 이 자리의 말을 다 했으면 섹션을 두지 않는다.**

        아직 아무것도 시작하지 않은 학생(`heroOffersPick`)에게 히어로는 `아직 시작한 학습이
        없어요` · `새 학습을 골라볼까요?` · `문제 담으러 가기`를 말한다. 그 아래 이 섹션이
        `담아 둔 학습이 없어요.` · `담아 두면 여기에 모여요.`를 또 두면 **없다는 말을 두 번**
        하는 것이다(실측: 김서준의 홈). 그 상태에서 담아 둔 목록은 반드시 0개이므로(`goalTotal`에
        들어간다) 감춰도 잃는 정보가 없고, 하나라도 담으면 섹션이 나타난다.
      */}
      {showQueue ? (
        <Section
          title="담아 둔 학습"
          /*
            앞이 `학원에서 내준 과제물을 모두 마쳤어요.` 한 줄일 때만 hairline을 둔다.
            그 줄은 스스로 경계선이 없어서 이 섹션 제목과 맞닿으면 어디서 끊기는지 보이지
            않는다 — §6이 정한 유일한 예외가 정확히 이 경우다. 조건은 **앞 블록이 선을 갖는지**
            하나다(이 섹션의 내용은 목록이든 빈 상태든 `Group` 안이라 제목 아래에서 스스로 선다).
          */
          separated={academyCleared}
          action={
            queued.items.length > 0 ? (
              <Pressable
                testID="home-queue-all"
                accessibilityRole="link"
                accessibilityLabel="담아 둔 학습 전체 보기"
                onPress={() => router.push('/student/queue' as never)}
                style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.6 }]}
              >
                <AppText variant="caption" tone="accent" style={styles.linkText}>
                  전체 {queued.items.length}개
                </AppText>
                <Icon name="chevron-right" size={14} color={colors.accent} />
              </Pressable>
            ) : null
          }
        >
          {queued.items.length === 0 ? (
            /*
              **빈 상태는 `EmptyState` 하나다**(D-104). 여기서 제목·부제·행동을 손으로 다시
              쌓고 있었는데, 그러면 같은 상황이 앱에서 세 형태가 된다(`records.tsx`는
              `EmptyState`, `queue.tsx`는 손으로 만든 것, 그리고 이 자리) — A-094가 적어 둔
              바로 그 갈림이다. 정렬·간격·행동 자리는 컴포넌트가 정한다.

              `sm`을 주지 않는다: 같은 이름의 이 버튼이 놓인 빈 상태 넷 중 여기만 32px이라
              패턴에서도 벗어나고 §10의 터치 하한에도 미달했다(실측).
            */
            <EmptyState
              title="담아 둔 학습이 없어요"
              /*
                **빠진 이유를 이 자리에서 말한다**(A-133). `useQueuedItems`가 `dropped`를 주는데
                홈이 쓰지 않아서, 담아 둔 것이 전부 공개 종료로 빠지면 화면은 `없어요`만 말하고
                이유를 알 길이 없었다 — 그 설명이 있는 `담아 둔 학습` 화면으로 가는 `전체 N개`
                링크도 담은 것이 있을 때만 그려지기 때문이다.
              */
              subtitle={
                queued.dropped > 0
                  ? `공개가 끝난 학습 ${queued.dropped}개는 목록에서 빠졌어요. 학습 탭에서 새로 담아 둘 수 있어요.`
                  : '학습 탭에서 풀고 싶은 학습을 담아 두면 여기에 모여요.'
              }
              action={
                <Button
                  testID="home-queue-empty-start"
                  hug
                  label="문제 담으러 가기"
                  trailing={<Icon name="arrow-right" size={16} color={colors.accentText} />}
                  onPress={() => router.push('/student/learn' as never)}
                />
              }
            />
          ) : queueList.length > 0 ? (
            <Group>
              {queueList.slice(0, PREVIEW).map((i) => (
                <LearningRow
                  key={i.id}
                  testID={`home-queue-${i.id}`}
                  item={i}
                  onPress={() => go(i.id)}
                />
              ))}
            </Group>
          ) : null}
        </Section>
      ) : null}
      {/*
        Scody AI — 버튼이 아니라 물어볼 곳.

        **할 일 목록 아래다.** 예전에는 진행 상황과 학원 과제 사이에 있어서, 오늘 할 일을 훑는
        시선이 화면 중앙의 큰 입력 박스에 걸려 끊겼다(실측: 마감이 지난 과제 하나뿐인 홈에서
        두 번째로 큰 요소가 이 입력창이었다). 물어보는 일은 **막혔을 때** 하는 일이라 할 일보다
        앞에 설 이유가 없다 — 홈의 순서는 확인할 것 → 할 일 → 막혔을 때다.
      */}
      <View style={[styles.askBox, isMobile ? styles.askGroupGapMobile : styles.askGroupGap]}>
        <View style={styles.askHead}>
          <Icon name="message-circle" size={16} color={colors.accent} />
          <AppText variant="label">Scody AI에게 물어보기</AppText>
        </View>
        <AskField
          testID="home-ask"
          sendTestID="home-ask-send"
          accessibilityLabel="Scody AI에게 질문 입력"
          value={ask}
          onChangeText={setAsk}
          onSubmit={sendAsk}
          placeholder="국어 공부하다 막힌 곳을 물어보세요"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.surface,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: { fontFamily: typeface.medium },
  /*
    히어로 제목에는 스타일이 없다 — `AppText variant="title"`이 크기·무게·줄간격·자간을 모두
    정한다(§4). 손으로 쌓은 `heroTitle`(1.2 · -0.4)이 §4의 하한을 벗어나 있었다.
  */
  /*
    화면 맨 위 **확인할 것** 줄(칭찬 · 새 과제). 카드가 아니다 — 오늘 할 일보다 무거워지면
    안 되고, 둘이 같은 종류라 같은 모양을 쓴다.
  */
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  /* 기록 줄은 두 줄이 될 수 있다. 한 덩어리 안에서 줄만 갈리므로 `xxs`다. */
  recordLines: { flex: 1, gap: spacing.xxs },
  /*
    누름 영역 44(§10). **음수 마진을 두지 않는다** — 이 줄은 두 줄이 될 수 있어서 내용 높이가
    이미 42px 안팎이고, `tap.textLine`의 보정값(캡션 한 줄 기준)을 그대로 쓰면 덩어리 간격이
    사라진다(위 호출부의 근거). 한 줄인 날(오늘 한 일이 없을 때)은 이 값이 높이를 채운다.
  */
  recordRow: { minHeight: touch.min },
  noticeText: { flex: 1 },
  /*
    히어로 카드 안 마지막 줄. **행동은 오른쪽 끝**이다(§8 규칙 ③ · `endRow`).
    전폭인 `시작하기`(primary)는 줄 전체를 채우므로 이 값이 닿지 않고, `hug`인
    `문제 담으러 가기`만 오른쪽으로 간다 — 제목 옆이 아니라 아래 줄이라
    27px 제목의 글자 칸이 좁아지지 않는다.
  */
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  overdue: { color: colors.danger, fontFamily: typeface.medium },

  // 칸은 줄에 딸린 것이라 붙여 둔다(`spacing.xs` = 한 덩어리 안에서 줄만 갈릴 때).
  progressBlock: { gap: spacing.xs },
  progress: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  progressText: { gap: 2, flex: 1 },
  progressRight: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  progressNum: {
    fontFamily: typeface.bold,
    color: colors.ink,
    fontSize: font.size.xl,
    lineHeight: font.size.xl * 1.2,
    letterSpacing: -0.3,
  },
  progressTotal: { fontFamily: typeface.medium },

  /*
    **여기서 덩어리가 바뀐다.** 위는 할 일이고 이 아래는 막혔을 때 하는 일이다.
    `Screen`의 컬럼 간격은 가로 여백과 **같은 값**이라 모든 경계가 같은 무게인데, 그러면 세
    덩어리(확인할 것 · 할 일 · 막혔을 때)가 한 줄기로 읽힌다. 그래서 이 경계만 벌린다.

    **더하는 값은 폭에 따라 다르다.** 그 컬럼 간격이 모바일 `lg`(16) · 그 위 `xl`(24)이라
    (`src/components/Screen.tsx`), 한 값을 고정하면 데스크톱에서 32가 되어 §5에 없는 간격이
    된다(고정 8로 두었다가 그랬다).

    **그런데 모바일에만 더하면 820·1280에서는 벌어지지 않는다.** `isMobile`일 때만 8을 더해
    모바일은 24가 됐지만 태블릿·데스크톱은 24 + 0 = 24 — 이 화면의 **다른 모든 경계와 같은
    값**이라, §14가 이름까지 붙여 경계한 상태가 두 뷰포트에 그대로 남아 있었다. 그래서 폭마다
    §5의 다음 토큰에 착지시킨다: 모바일 `lg` → `xl`(16 + 8 = 24) · 그 위 `xl` → `xxl`
    (24 + 12 = 36). 항목 사이는 각각 16 · 24로 남으므로 덩어리 경계가 한 단계 더 무겁다.
  */
  askBox: { gap: spacing.sm },
  askGroupGapMobile: { marginTop: spacing.xl - spacing.lg },
  askGroupGap: { marginTop: spacing.xxl - spacing.xl },
  askHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  /*
    섹션 제목 옆 작은 링크. 화면의 주요 행동('시작하기')과 무게를 다르게 둔다.
    누름 영역 44는 `tap.textLine`이 맡는다 — 글자 높이가 20px이라 §10의 하한에 미달했다(실측).
  */
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, ...tap.textLine },
  linkText: { fontFamily: typeface.medium },

});
