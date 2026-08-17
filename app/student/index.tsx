import { useState } from 'react';
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
  Icon,
  SourceTag,
} from '@/components';
import { useCurrentAccount, useSession } from '@/session';
import { useStudentItems, useQueuedItems, byDue, dueLabel } from '@/features/learning';
import { useContent } from '@/features/content';
import { useProgress, PRAISE_LABEL } from '@/features/progress';
import { useToast } from '@/features/toast';
import { endRow } from '@/theme/styles';
import { colors, spacing, radius, typeface, font, touch } from '@/theme/tokens';

/** 홈 목록은 다섯 줄까지만. 그 아래는 전체 목록으로 넘긴다. */
const PREVIEW = 5;

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
 * - 오늘의 학습은 담아 둔 학습을 먼저 쓴다. 학생이 직접 담은 것이 있으면 그것부터가 자연스럽다.
 * - 학원 과제와 담아 둔 학습은 개수를 따로 센다. 합쳐 세면 "학원 과제가 16개"처럼 읽힌다.
 * - Scody AI는 버튼이 아니라 입력창이다. 보내면 대화 화면에서 답이 이어진다.
 */
export default function StudentHome() {
  const router = useRouter();
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
    loading: progressLoading,
    error: progressError,
    reload: reloadProgress,
  } = useProgress();
  const { loading: contentLoading, error: contentError, reload: reloadContent } = useContent();
  const { readOnly } = useSession();
  const { show } = useToast();
  // 부모님이 보낸 칭찬 중 아직 확인하지 않은 것만. 확인하면 다시 뜨지 않는다.
  const praise = praiseFor(account.userId).filter((p) => !p.seen);

  /**
   * 칭찬을 확인해 닫는다. 줄은 곧바로 사라지고 **서버가 받지 못했을 때만** 말한다 —
   * 예전에는 거부돼도 아무 말이 없어서, 다음 조회에서 그 줄이 이유 없이 다시 나타났다.
   * 확인은 성공을 따로 알리지 않는다: 줄이 사라지는 것이 그 자체로 결과다.
   * 대리 보기에서는 쓰기가 거부된다(D-071). 일어나지 않은 일을 알리지 않는다.
   */
  async function seePraise() {
    const results = await Promise.all(praise.map((p) => dismissPraise(p.id)));
    if (readOnly) return;
    const failed = results.find((r) => !r.ok);
    if (failed) show(failed.error ?? '확인하지 못했어요', 'removed');
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
  const reading = progressLoading || contentLoading;
  /**
   * 조회가 실패했을 때 보여 줄 문장. 서버가 준 것을 그대로 쓴다(`errorMessage`).
   *
   * **다시 읽는 중에는 감춘다** — 다시 시도를 누른 학생에게 실패 문장과 `불러오고 있어요`가
   * 한 화면에 함께 서면 지금 무슨 일이 일어나는지 알 수 없다.
   */
  const loadError = reading ? null : (progressError ?? contentError);

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
   * 오늘의 학습 후보는 **학생이 약속한 일**뿐이다: 담아 둔 학습 → 남은 학원 과제(D-140).
   * 바로 아래 진행 상황의 분모(`goalTotal`)와 **같은 집합**이라, 진행 상황이
   * `남은 학습이 없어요`라고 말하는 화면에서 히어로만 `시작하기`를 내놓는 일이 없다.
   *
   * **공개 카탈로그(`all` 안의 개인 학습)는 후보가 아니다.** 예전에는 `todo[0]`이라
   * 담아 둔 것도 배정도 없는 학생에게 카탈로그의 첫 세트가 `오늘의 학습`으로 올라왔다 —
   * 학생이 고른 적도, 누가 시킨 적도 없는 항목이다. D-034가 진행 상황에서 이미 같은 판단을
   * 했고(카탈로그 크기를 할 일로 읽지 않는다) 히어로도 같은 기준을 쓴다. 새로 고르는 일은
   * 아래 캡션과 `담아 둔 학습` 빈 상태가 맡는다.
   */
  const next = queued.items[0] ?? academyTodo[0];
  const fromQueue = !!queued.items[0];
  const nextDue = dueLabel(next?.dueDate);
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
        {account.name}님, 오늘도 반가워요
      </AppText>

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
          <Pressable
            testID={`praise-seen-${praise[0].id}`}
            accessibilityRole="button"
            accessibilityLabel="칭찬 확인"
            onPress={() => void seePraise()}
            style={styles.praiseClose}
          >
            <Icon name="check" size={15} color={colors.accent} />
          </Pressable>
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
      {!reading && !loadError && freshAcademy.length > 0 ? (
        <View style={styles.notice}>
          <Icon name="file-plus" size={15} color={colors.accent} />
          <AppText testID="home-academy-new" variant="caption" tone="accent" style={styles.noticeText}>
            {freshAcademy.length > 1
              ? `새 과제가 ${freshAcademy.length}개 배정되었어요`
              : '새 과제가 배정되었어요'}
          </AppText>
        </View>
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
        <View testID="home-load-failed" style={styles.loadFailed}>
          <AppText variant="caption" tone="danger">
            학습을 불러오지 못했어요. {loadError}
          </AppText>
          {/* 다시 시도는 이 화면의 주 행동이 아니다 — `hug`인 보조 버튼이다(§8). */}
          <Button
            testID="home-load-retry"
            variant="secondary"
            hug
            label="다시 불러오기"
            onPress={() => void retryLoad()}
          />
        </View>
      ) : null}

      {next ? (
        <View testID="today-primary" style={styles.hero}>
          <View style={styles.heroTop}>
            <AppText variant="caption" tone="secondary" style={styles.heroLabel}>
              {fromQueue ? '담아 둔 학습' : '오늘의 학습'}
            </AppText>
            <SourceTag source={next.source} />
          </View>
          <AppText style={styles.heroTitle}>{next.title}</AppText>
          <AppText variant="caption" tone="secondary">
            국어 · {next.area} · {next.questionCount}문항
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
            <Button label="시작하기" onPress={() => go(next.id)} />
          </View>
        </View>
      ) : reading ? (
        /*
          조회 중에는 히어로를 그리지 않고 한 줄만 둔다. 카드를 남겨 제목 자리를 비우면
          빈 카드가 곧 `할 일이 없다`는 뜻으로 읽힌다. 문장과 무게는 `pick.tsx`와 같다.
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
          <AppText style={styles.heroTitle}>아직 시작한 학습이 없어요</AppText>
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
          {heroOffersPick ? (
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
          <AppText style={styles.heroTitle}>오늘 할 일을 다 끝냈어요</AppText>
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
      {!reading && !loadError && goalTotal > 0 ? (
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
            <View style={styles.progressRight}>
              <AppText style={styles.progressNum}>{goalDone}</AppText>
              <AppText variant="caption" tone="tertiary" style={styles.progressTotal}>
                / {goalTotal} 완료
              </AppText>
            </View>
          </View>
          {/*
            비율 막대가 아니라 **칸**이다. 옆에 `3 / 5 완료`라고 이미 적혀 있어서 같은 비율을
            막대로 또 그리면 같은 말이 두 번이 된다. 칸은 개수를 말한다 — 몇 개 남았는지가 보인다.

            **한 칸은 그리지 않는다.** 셀 것이 하나면 칸이 개수를 말해 주지 못하고, 옆의
            `0 / 1 완료`가 이미 같은 말을 한다 — 남는 것은 폭만 채운 선 하나다.
          */}
          {goalTotal > 1 ? <Steps done={goalDone} total={goalTotal} /> : null}
        </View>
      ) : null}


      {/*
        학원 과제. 조회 중에도, 조회가 실패했을 때도 이 면을 두지 않는다 — 배정을 못 읽은
        상태에서 `학원에서 내준 과제물을 모두 마쳤어요.`가 나오면 마치지 않은 과제를 마쳤다고
        말한다. 실패는 위 한 줄이 이미 말했다.
      */}
      {!reading && !loadError && hasAcademy ? (
        academyTodo.length > 0 ? (
          /*
            **목록이 있을 때만 섹션을 둔다.**

            예전에는 남은 과제가 하나(= 히어로에 올라간 그것)뿐인 학생에게도 이 섹션이 그려져
            `학원에서 내준 과제가 있어요` 제목 아래 `위에 있는 과제 하나가 남았어요.`가 남았다.
            둘 다 히어로를 보면 아는 사실이라, 과제 1개인 화면이 그 하나를 **네 번** 말하고 있었다
            (히어로 · 진행 상황 · 이 제목 · 이 문장).

            새로 온 과제 알림은 화면 맨 위로 올렸다 — 히어로에 올라갔든 아니든 보여야 하는
            상태 변화이기 때문이다.
          */
          academyList.length > 0 ? (
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
              {!showAllAcademy && academyList.length > PREVIEW ? (
                <Button
                  testID="home-academy-more"
                  variant="ghost"
                  label={`과제 ${academyList.length - PREVIEW}개 더 보기`}
                  onPress={() => setShowAllAcademy(true)}
                />
              ) : null}
            </Section>
          ) : null
        ) : (
          /*
            **다 마쳤다는 사실은 한 줄이다.**

            카드였고 그 안에 `개인 학습을 해볼까요?`와 `개인 학습 고르기` 버튼이 있었다. 그런데
            그 버튼의 목적지(`/student/learn`)는 바로 아래 `담아 둔 학습`의 `문제 담으러 가기`와
            **같은 곳**이다 — 이름만 다른 같은 행동이 한 화면에 둘이었고, 그 위 히어로 캡션까지
            같은 길을 글로 가리켜 셋이 됐다. 새로 고르는 행동은 `담아 둔 학습`이 맡는다(거기가
            담긴 것을 보여 주는 자리이므로 비었을 때 채우라고 말하는 것이 자연스럽다).

            면도 벗겼다. 없다는 사실을 카드로 감싸면 있는 것보다 무거워진다(§6 — 단순한 구분은
            여백·타이포가 한다).
          */
          <AppText testID="academy-cleared" variant="label">
            학원에서 내준 과제물을 모두 마쳤어요.
          </AppText>
        )
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
      {!reading && !loadError && !heroOffersPick && (hasPersonal || queued.items.length > 0) ? (
        <Section
          title="담아 둔 학습"
          /*
            앞이 `학원에서 내준 과제물을 모두 마쳤어요.` 한 줄일 때만 hairline을 둔다.
            그 줄과 이 섹션의 빈 상태는 **둘 다 스스로 경계선이 없어서** 맞닿으면 어디서
            끊기는지 보이지 않는다 — §6이 정한 유일한 예외가 정확히 이 경우다.
            목록(`Group`)이 있을 때는 그 선과 두 겹이 되므로 두지 않는다.
          */
          separated={academyCleared && queued.items.length === 0}
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
            /* 면을 벗겼다 — 없다는 사실이 카드가 되면 있는 것보다 무거워진다(위 주석과 같은 이유). */
            <View style={styles.empty}>
              <AppText variant="label">담아 둔 학습이 없어요.</AppText>
              <AppText variant="caption" tone="secondary">
                학습 탭에서 풀고 싶은 학습을 담아 두면 여기에 모여요.
              </AppText>
              {/*
                **히어로가 이미 같은 버튼을 주고 있으면 두지 않는다.** 아무것도 시작하지 않은
                학생의 화면에서는 히어로가 `문제 담으러 가기`를 내놓는데, 여기에 또 두면 처음
                온 학생이 **같은 목적지로 가는 같은 버튼을 두 개** 받는다(실측: 김서준의 홈).
                그때는 위 문장 두 줄이 이 자리가 무엇인지 설명하는 몫만 한다.
              */}
              {heroOffersPick ? null : (
                <View style={[styles.emptyAction, endRow.action]}>
                  <Button
                    testID="home-queue-empty-start"
                    hug
                    /*
                      **`sm`을 쓰지 않는다.** 같은 이름의 이 버튼이 놓인 다섯 자리 중 빈 상태 넷
                      (`home-empty-start` · `queue-empty-start` · `records-empty-start`)은 기본
                      크기(44)이고 `sm`은 목록 아래 보조 행동(`queue-go-learn`)에만 쓴다 —
                      여기만 32px이라 패턴에서도 벗어나고 §10의 터치 하한에도 미달했다(실측).
                    */
                    label="문제 담으러 가기"
                    trailing={<Icon name="arrow-right" size={16} color={colors.accentText} />}
                    onPress={() => router.push('/student/learn' as never)}
                  />
                </View>
              )}
            </View>
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
          ) : (
            <AppText variant="caption" tone="secondary">
              담아 둔 학습을 위에서 이어서 풀어요.
            </AppText>
          )}
        </Section>
      ) : null}
      {/*
        Scody AI — 버튼이 아니라 물어볼 곳.

        **할 일 목록 아래다.** 예전에는 진행 상황과 학원 과제 사이에 있어서, 오늘 할 일을 훑는
        시선이 화면 중앙의 큰 입력 박스에 걸려 끊겼다(실측: 마감이 지난 과제 하나뿐인 홈에서
        두 번째로 큰 요소가 이 입력창이었다). 물어보는 일은 **막혔을 때** 하는 일이라 할 일보다
        앞에 설 이유가 없다 — 홈의 순서는 확인할 것 → 할 일 → 막혔을 때다.
      */}
      <View style={styles.askBox}>
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
  heroTitle: {
    fontFamily: typeface.bold,
    color: colors.ink,
    fontSize: font.size.xxl,
    lineHeight: font.size.xxl * 1.2,
    letterSpacing: -0.4,
  },
  /*
    실패 문장 + 다시 시도. 카드로 만들지 않는다 — 실패는 알려야 하지만 화면에서 가장
    무거운 것이 될 이유는 없다. 버튼이 `hug`이라 줄을 왼쪽으로 모은다.
  */
  loadFailed: { gap: spacing.sm, alignItems: 'flex-start' },
  /*
    화면 맨 위 **확인할 것** 줄(칭찬 · 새 과제). 카드가 아니다 — 오늘 할 일보다 무거워지면
    안 되고, 둘이 같은 종류라 같은 모양을 쓴다.
  */
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noticeText: { flex: 1 },
  praiseClose: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
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
    `Screen`의 컬럼 간격은 가로 여백과 같은 값(모바일 16)이라 모든 경계가 같은 무게인데,
    그러면 세 덩어리(확인할 것 · 할 일 · 막혔을 때)가 한 줄기로 읽힌다. 8을 더해 24 —
    §5가 정한 섹션 간격 `xl`이 되게 한다. 앞 블록이 무엇이든(진행 상황 · 담아 둔 학습) 같다.
  */
  askBox: { gap: spacing.sm, marginTop: spacing.sm },
  askHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  /*
    섹션 제목 옆 작은 링크·버튼. 화면의 주요 행동('시작하기')과 무게를 다르게 둔다.

    글자 높이가 20px이라 §10의 하한 44에 미달했다 — 이 화면에서 유일하게 모자란 누름 영역이었다
    (실측). 커진 만큼 음수 마진으로 되돌려 제목 줄 높이는 그대로 둔다(`AuthShell`의 링크와 같은 방법).
  */
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: touch.min,
    marginVertical: -spacing.md,
  },
  linkText: { fontFamily: typeface.medium },

  /*
    빈 상태. **카드가 아니다** — 테두리와 면을 두르면 `없어요`가 화면에서 가장 무거운 것이 되고,
    히어로까지 합쳐 카드가 셋·넷으로 쌓인다(§6 · §13 `모든 내용을 카드로 감싸기`).
    구분은 섹션 제목과 여백이 이미 하고 있다.
  */
  empty: { gap: spacing.sm, alignItems: 'flex-start' },
  /*
    `empty`가 `alignItems: 'flex-start'`(글자를 왼쪽에 두기 위한 값)라 그 안의 줄도
    내용폭으로 줄어든다. 오른쪽 끝까지 닿으려면 이 줄만 폭을 편다.
  */
  emptyAction: { alignSelf: 'stretch' },
});