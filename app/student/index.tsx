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
import { colors, spacing, radius, typeface, font } from '@/theme/tokens';

/** 홈 목록은 다섯 줄까지만. 그 아래는 전체 목록으로 넘긴다. */
const PREVIEW = 5;

/**
 * 학생 홈. 3초 안에 "오늘 뭘 해야 하는지" 이해되도록 시선이 흐른다:
 * 오늘의 학습 → 진행 상황 → Scody AI → 학원 과제 → 담아 둔 학습.
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
  const { all, academy, hasPersonal } = useStudentItems();
  const queued = useQueuedItems();
  const [ask, setAsk] = useState('');
  const [showAllAcademy, setShowAllAcademy] = useState(false);
  const {
    praiseFor,
    dismissPraise,
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

  // 마감이 이른 과제부터. 학습 탭도 같은 정렬을 쓴다(`byTodoThenDue`).
  const items = [...all].sort(byDue);
  const todo = items.filter((i) => i.status !== 'done');
  const academyTodo = todo.filter((i) => i.source === 'academy');
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

  // 담아 둔 학습이 있으면 그것부터. 없으면 남은 학습의 첫 번째.
  const next = queued.items[0] ?? todo[0];
  const fromQueue = !!queued.items[0];
  const nextDue = dueLabel(next?.dueDate);
  // 아직 아무 학습도 없는 계정(가입 직후)에는 '다 끝냈어요'라고 말하지 않는다.
  const nothingYet = all.length === 0 && queued.items.length === 0;
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
        <View style={styles.praise}>
          <Icon name="star" size={15} color={colors.accent} />
          <AppText variant="caption" tone="accent" style={{ flex: 1 }}>
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
            새 학습을 골라볼까요?
          </AppText>
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
        </View>
      ) : (
        <View style={styles.hero}>
          <AppText variant="caption" tone="secondary" style={styles.heroLabel}>
            오늘의 학습
          </AppText>
          <AppText style={styles.heroTitle}>오늘 할 일을 다 끝냈어요</AppText>
          <AppText variant="caption" tone="secondary">
            학습 탭에서 오답을 다시 풀거나 새 학습을 골라볼 수 있어요.
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
              <AppText variant="label">
                {goalTodo === 0 ? '남은 학습이 없어요' : `남은 학습 ${goalTodo}개`}
              </AppText>
              {goalParts.length > 0 ? (
                <AppText variant="caption" tone="tertiary">
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
          */}
          <Steps done={goalDone} total={goalTotal} />
        </View>
      ) : null}

      {/* Scody AI — 버튼이 아니라 물어볼 곳. */}
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

      {/*
        학원 과제. 조회 중에도, 조회가 실패했을 때도 이 면을 두지 않는다 — 배정을 못 읽은
        상태에서 `학원에서 내준 과제물을 모두 마쳤어요.`가 나오면 마치지 않은 과제를 마쳤다고
        말한다. 실패는 위 한 줄이 이미 말했다.
      */}
      {!reading && !loadError && hasAcademy ? (
        academyTodo.length > 0 ? (
          <Section
            title="학원에서 내준 과제가 있어요"
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
            {/* 새로 받은 과제가 있으면 먼저 알린다. 한 문항이라도 풀면 사라진다. */}
            {freshAcademy.length > 0 ? (
              <AppText testID="home-academy-new" variant="label" tone="accent">
                {freshAcademy.length > 1
                  ? `새 과제가 ${freshAcademy.length}개 배정되었어요`
                  : '새 과제가 배정되었어요'}
              </AppText>
            ) : null}
            {academyList.length > 0 ? (
              <>
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
              </>
            ) : (
              <AppText variant="caption" tone="secondary">
                위에 있는 과제 하나가 남았어요.
              </AppText>
            )}
          </Section>
        ) : (
          <View testID="academy-cleared" style={styles.cleared}>
            <AppText variant="label">학원에서 내준 과제물을 모두 마쳤어요.</AppText>
            <AppText variant="caption" tone="secondary">
              개인 학습을 해볼까요?
            </AppText>
            {/*
              면 안 마지막 줄의 행동은 오른쪽 끝이다(§8 규칙 ③). 위 두 줄은 글자라
              왼쪽에 그대로 두고 이 줄만 감싼다 — `cleared`째로 오른쪽에 붙이면 문장까지 따라간다.
              `hug`을 함께 준다: 부모의 `alignItems: 'flex-start'`에 기대고 있던 폭이라
              감싸는 줄 안에서는 늘어난다.
            */}
            <View style={[styles.clearedAction, endRow.action]}>
              <Button
                testID="home-go-learn"
                variant="secondary"
                hug
                label="개인 학습 고르기"
                onPress={() => router.push('/student/learn' as never)}
              />
            </View>
          </View>
        )
      ) : null}

      {/*
        담아 둔 개인 학습. `hasPersonal`은 이용권이라 조회를 기다리지 않고 참이 되는데,
        담아 둔 목록은 두 조회가 끝나야 채워진다(담긴 값은 개인 학습에서 찾는다). 그 창에
        이 면을 두면 담아 둔 학습이 있는 학생에게 `담아 둔 학습이 없어요.`를 보여 준다.
        실패했을 때도 같다 — 못 읽은 목록을 없는 목록으로 말하지 않는다.
      */}
      {!reading && !loadError && (hasPersonal || queued.items.length > 0) ? (
        <Section
          title="담아 둔 학습"
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
            <View style={styles.cleared}>
              <AppText variant="label">담아 둔 학습이 없어요.</AppText>
              <AppText variant="caption" tone="secondary">
                학습 탭에서 풀고 싶은 학습을 담아 두면 여기에 모여요.
              </AppText>
              {/* 같은 이름의 같은 행동은 같은 무게다(위 히어로 주석). 자리도 같다 — 마지막 줄 오른쪽 끝. */}
              <View style={[styles.clearedAction, endRow.action]}>
                <Button
                  testID="home-queue-empty-start"
                  hug
                  size="sm"
                  label="문제 담으러 가기"
                  trailing={<Icon name="arrow-right" size={15} color={colors.accentText} />}
                  onPress={() => router.push('/student/learn' as never)}
                />
              </View>
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
  // 조용한 한 줄. 카드가 아니다 — 오늘 할 일보다 무거워지면 안 된다.
  praise: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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

  askBox: { gap: spacing.sm },
  askHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // 섹션 제목 옆 작은 링크·버튼. 화면의 주요 행동('시작하기')과 무게를 다르게 둔다.
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  linkText: { fontFamily: typeface.medium },

  cleared: {
    gap: spacing.sm,
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  /*
    `cleared`가 `alignItems: 'flex-start'`(글자를 왼쪽에 두기 위한 값)라 그 안의 줄도
    내용폭으로 줄어든다. 오른쪽 끝까지 닿으려면 이 줄만 면 폭으로 편다.
  */
  clearedAction: { alignSelf: 'stretch' },
});
