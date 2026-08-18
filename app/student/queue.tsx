import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ActionBar,
  AppText,
  Button,
  EmptyState,
  Group,
  Icon,
  LearningRow,
  LoadFailed,
  Screen,
  Section,
} from '@/components';
import { useCurrentAccount, useSession } from '@/session';
import { useQueuedItems, useStudentItems } from '@/features/learning';
import { useContent } from '@/features/content';
import { useProgress, type QueueMove, type QueueRemoval } from '@/features/progress';
import { useToast } from '@/features/toast';
import { endRow } from '@/theme/styles';
import { colors, radius, spacing, typeface, touch } from '@/theme/tokens';
import type { LearningItem } from '@/data';

/**
 * 담아 둔 학습 전체 목록. 담은 순서대로 시작하고, 순서를 바꾸고 뺄 수 있다.
 *
 * 순서 바꾸기는 위·아래 버튼으로 한다. 드래그는 웹·터치·키보드에서 모두 되게 만들려면
 * 제스처 라이브러리가 필요하고, 학습 목록은 길지 않아 버튼으로 충분하다.
 * 탭에는 넣지 않는다(학생 탭은 홈·학습·기록·내 정보 네 개로 고정).
 */
export default function StudentQueue() {
  const router = useRouter();
  const { items, dropped } = useQueuedItems();
  const {
    queue,
    removeManyFromQueue,
    moveInQueue,
    restoreToQueue,
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
  const { hasPersonal } = useStudentItems();
  const account = useCurrentAccount();
  const { readOnly } = useSession();
  const { show } = useToast();

  /*
    **읽는 중 · 실패 · 빈 목록을 셋으로 가른다**(A-116 · D-136). 기준 구현은 `app/student/index.tsx`다.

    이 목록은 두 조회에서 온다 — 담긴 순서는 학습 기록에서, 학습 자체는 콘텐츠에서 온다
    (`useQueuedItems`). 첫 조회가 끝나기 전에는 `items`가 비어 있어서, 그 창에 빈 상태를 그리면
    담아 둔 학생에게 `담아 둔 학습이 없어요.`라고 단정한다(D-133).

    조회가 **실패해도** 같은 화면이 나온다 — 그때는 `loading`이 내려가므로 로딩 게이트가 덮지
    못한다(M-DB-16). 실패했을 때는 개수도 세지 않고 없다고도 하지 않는다.
  */
  const rereading = progressLoading || contentLoading;
  /**
   * 조회가 실패했을 때 보여 줄 문장. 서버가 준 것을 그대로 쓴다(`errorMessage`).
   * **다시 읽는 중에는 감춘다** — 실패 문장과 `불러오고 있어요`가 함께 서면 지금 무슨 일이
   * 일어나는지 알 수 없다(`DESIGN.md` §9).
   */
  const loadError = rereading ? null : (progressError ?? contentError);

  /**
   * 기다리는 화면을 그릴지. **손에 아무것도 없이 읽고 있을 때만 기다린다.**
   *
   * `loading`으로 목록의 마운트를 결정하지 않는다(D-163) — 순서 바꾸기나 빼기가 실패하면
   * `write`가 `reload()`를 부르고, 그때 `loading`이 다시 참이 된다. 그 값으로 게이트를 걸면
   * 실패 한 번에 목록이 사라지고 고르던 것(`selecting`·`picked`)만 남는다.
   * 그래서 첫 조회(`loaded`)를 기준으로 하고, 손에 목록이 있으면 다시 읽는 동안에도 그대로 둔다
   * (`items.length === 0`을 함께 보는 이유: 실패한 첫 조회를 다시 시도하는 동안 빈 목록을
   * `없어요`로 단정하지 않는다).
   */
  const waiting = !progressLoaded || !contentLoaded || (rereading && items.length === 0);

  /** 두 조회를 함께 다시 시도한다. 실패가 어느 쪽에서 왔는지 학생이 고를 일은 아니다. */
  async function retryLoad() {
    await Promise.all([reloadProgress(), reloadContent()]);
  }

  /**
   * 새로 고를 수 없는 계정에 그 이유(또는 지금 기다리는 것)를 말하는 한 줄.
   * **학생 홈(`app/student/index.tsx`)의 `noPickReason`과 같은 문장이다** — 같은 사실을 두
   * 화면이 다르게 말하면 학생은 둘 중 어느 쪽이 자기 상태인지 알 수 없다.
   */
  const noPickReason = account.academyName
    ? '학원에서 과제를 내주면 여기에서 알려 줘요.'
    : '개인 학습 이용권이 없어서 아직 고를 수 있는 학습이 없어요.';

  /**
   * 빈 상태의 부제. 셋 중 하나이고 순서가 중요하다.
   *
   * `!hasPersonal`을 먼저 본다 — 이용권이 없으면 개인 학습 자체가 비어서(`useStudentItems`)
   * 담아 둔 칸이 **전부** `dropped`로 세어진다. 그 숫자로 `공개가 끝났어요`라고 말하면
   * 이용권 문제를 콘텐츠 문제로 잘못 말한다(`pick.tsx`가 단계를 그리지 않는 것과 같은 판단).
   */
  const emptyReason = !hasPersonal
    ? noPickReason
    : dropped > 0
      ? `공개가 끝난 학습 ${dropped}개는 목록에서 빠졌어요.`
      : '학습 탭에서 풀고 싶은 학습을 담아 두면 여기에 모여요.';

  /** 방금 뺀 칸들. 되돌릴 수 있는 동안 화면에 안내를 남긴다(D-033). */
  const [undo, setUndo] = useState<QueueRemoval[] | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  function togglePick(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function leaveSelecting() {
    setSelecting(false);
    setPicked([]);
  }

  /**
   * 확인 단계 없이 바로 뺀다. 대신 원래 자리를 들고 있다가 되돌린다(D-033).
   * 자리는 화면에 보이는 목록이 아니라 담긴 순서(`queue`)에서 센다 —
   * 공개가 끝나 빠진 칸이 있으면 두 배열의 위치가 어긋난다.
   *
   * **되돌리기 안내는 서버가 빼기를 받아 준 뒤에 띄운다.** 먼저 띄우면 빠지지 않은 학습에도
   * `뺐어요`라고 말하고, 되돌리기를 누르면 이미 있는 학습을 다시 담으려 한다.
   */
  async function takeOut(itemIds: string[]) {
    const removals = itemIds
      .map((id) => {
        const index = queue.findIndex((q) => q.itemId === id);
        return index < 0 ? null : { entry: queue[index], index };
      })
      .filter((r): r is QueueRemoval => r !== null);
    if (removals.length === 0) return;
    const res = await removeManyFromQueue(itemIds);
    // 대리 보기에서는 쓰기가 거부된다(D-071). 빠지지 않은 것을 뺐다고 안내하지 않는다.
    if (readOnly) return;
    if (!res.ok) {
      show(res.error ?? '빼지 못했어요', 'removed');
      return;
    }
    setUndo(removals);
  }

  /** 되돌리기. 성공하면 목록에 다시 나타나므로 따로 알리지 않고, 실패만 말한다. */
  async function undoTakeOut(removals: readonly QueueRemoval[]) {
    const res = await restoreToQueue(removals);
    if (!res.ok) show(res.error ?? '되돌리지 못했어요', 'removed');
  }

  /**
   * 순서 한 칸 옮기기(A-099).
   *
   * **성공은 알리지 않는다** — 줄이 움직이는 것이 곧 결과다. 실패는 낙관적으로 옮긴 줄이
   * 원래 자리로 돌아가는 것으로만 보였는데, 왜 돌아갔는지 알 길이 없었다.
   * 같은 파일의 빼기·되돌리기는 이미 실패를 말한다 — 그 규칙을 여기에도 맞춘다.
   */
  async function move(itemId: string, dir: QueueMove) {
    const res = await moveInQueue(
      itemId,
      dir,
      items.map((i) => i.id),
    );
    // 대리 보기에서는 쓰기가 거부된다(D-071). 일어나지 않은 일을 알리지 않는다.
    if (readOnly) return;
    if (!res.ok) show(res.error ?? '순서를 바꾸지 못했어요', 'removed');
  }

  return (
    <Screen testID="student-queue" backFallback="/student" title="담아 둔 학습">
      {/*
        **실패 면은 화면에 하나다**(`DESIGN.md` §9). 목록·개수·빈 상태가 모두 같은 두 조회에
        매달려 있어서, 자리마다 빨간 줄을 두면 한 번의 실패가 여러 번으로 읽힌다.
        이미 읽어 둔 목록은 지우지 않는다 — 가진 것은 여전히 사실이다.
      */}
      {loadError ? (
        <LoadFailed
          testID="queue-load-failed"
          retryTestID="queue-load-retry"
          what="학습"
          message={loadError}
          onRetry={() => void retryLoad()}
        />
      ) : null}

      {/* 되돌리기는 사라지면 기회도 사라진다. 토스트가 아니라 화면에 남는 안내다(D-038). */}
      {undo ? (
        <View style={styles.undo}>
          <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
            담아 둔 학습에서 뺐어요
          </AppText>
          <Button
            testID="queue-undo"
            variant="ghost"
            tone="accent"
            hug
            leading={<Icon name="refresh-cw" size={16} color={colors.accent} />}
            label="되돌리기"
            onPress={() => {
              void undoTakeOut(undo);
              setUndo(null);
            }}
          />
        </View>
      ) : null}

      {waiting ? (
        /* 읽는 중에는 개수도 `없어요`도 말하지 않는다. 문장은 학생 화면 넷이 같다(D-133). */
        <AppText variant="caption" tone="secondary">
          학습을 불러오고 있어요.
        </AppText>
      ) : items.length === 0 ? (
        /*
          실패했으면 빈 상태를 그리지 않는다 — 못 읽은 목록을 없는 목록으로 말하지 않는다.
          위 실패 줄이 그 자리를 맡는다(M-DB-16).
        */
        loadError ? null : (
          /*
            **빈 상태는 `EmptyState` 하나다**(D-104 · A-094). 예전에는 이 자리만 손으로 만든
            `Group` + `ActionBar`여서, `기록` 탭의 같은 빈 상태(`EmptyState`)와 타이포도 버튼
            자리도 달랐다.

            **행동은 담을 수 있는 학생에게만 준다**(D-141). 개인 이용권이 없으면 그 목적지에서
            누를 수 있는 것이 0개다 — `learn.tsx`가 `hasPersonal`이 false면 진입 줄을 아예
            렌더하지 않는다. 홈이 세 자리에서 없앤 거짓말의 다섯 번째 자리가 여기였다.
            그때는 이유만 말한다(위 `emptyReason`). 이용권을 시작하는 진입점은 아직 없다(A-096).

            `문제 담으러 가기`의 무게는 앱 어디서나 같다: **강조색 + `hug` + 화살표**
            (`index.tsx` 두 곳 · `records.tsx` 한 곳도 같다 · D-123). §8이 이름까지 지목한
            `다른 화면으로 보내기만 하는 버튼`이라 전폭이 아니고, 높이는 기본(44)이다 —
            `sm`(32)은 목록 아래 보조 행동 자리에만 쓴다(아래 `queue-go-learn`).
            자리는 `EmptyState`가 정한다(마지막 줄 오른쪽 끝 · §8 규칙 ③).
          */
          <EmptyState
            testID="queue-empty"
            title="담아 둔 학습이 없어요."
            subtitle={emptyReason}
            action={
              hasPersonal ? (
                <Button
                  testID="queue-empty-start"
                  hug
                  label="문제 담으러 가기"
                  trailing={<Icon name="arrow-right" size={16} color={colors.accentText} />}
                  onPress={() => router.replace('/student/learn' as never)}
                />
              ) : undefined
            }
          />
        )
      ) : (
        <>
          <View style={styles.head}>
            {/* 빼기 모드에서는 안내가 바뀐다. 지시문을 버튼 라벨에 넣지 않는다(D-036과 같은 규칙). */}
            <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
              {selecting ? '뺄 학습을 골라요.' : '담은 순서대로 풀어요. 순서를 바꾸거나 뺄 수 있어요.'}
            </AppText>
            {selecting ? (
              <Button
                testID="queue-select-cancel"
                variant="ghost"
                label="취소"
                onPress={leaveSelecting}
              />
            ) : (
              <Button
                testID="queue-select-mode"
                variant="ghost"
                size="sm"
                label="여러 개 빼기"
                leading={<Icon name="minus-circle" size={15} color={colors.inkSecondary} />}
                onPress={() => setSelecting(true)}
              />
            )}
          </View>

          {/* 이 화면의 주요 행동. 맞춰 둔 순서의 첫 학습으로 바로 들어간다. */}
          {selecting ? null : (
            <ActionBar>
              <Button
                testID="queue-start"
                label="첫 번째 학습부터 시작하기"
                accessibilityLabel="첫 번째 학습부터 시작하기"
                trailing={<Icon name="arrow-right" size={16} color={colors.accentText} />}
                onPress={() => router.push(`/student/${items[0].id}` as never)}
              />
            </ActionBar>
          )}

          <Group>
            {items.map((item, i) => (
              <QueueRow
                key={item.id}
                item={item}
                index={i}
                last={i === items.length - 1}
                selecting={selecting}
                picked={picked.includes(item.id)}
                onOpen={() => router.push(`/student/${item.id}` as never)}
                onPick={() => togglePick(item.id)}
                /*
                  보이는 순서를 함께 넘긴다(`move`가 들고 간다). 공개가 끝나 빠진 칸이 옆에
                  있으면 그 칸과 자리를 맞바꿔 화면에서는 아무 일도 일어나지 않았다
                  (`takeOut`이 자리를 `queue`에서 세는 것과 같은 어긋남이다).
                */
                onMove={(dir) => void move(item.id, dir)}
                onRemove={() => void takeOut([item.id])}
              />
            ))}
          </Group>

          {/* 고른 것이 있을 때만 뺄 수 있다. 못 누르는 버튼을 띄워 두지 않는다(D-036). */}
          {selecting && picked.length > 0 ? (
            <ActionBar>
              <Button
                testID="queue-remove-selected"
                label={`${picked.length}개 빼기`}
                leading={<Icon name="minus-circle" size={16} color={colors.accentText} />}
                onPress={() => {
                  void takeOut(picked);
                  leaveSelecting();
                }}
              />
            </ActionBar>
          ) : null}

          {/*
            빠진 칸을 말하는 문장은 화면에 하나다 — 목록이 비면 같은 문장이 빈 상태의 부제로
            옮겨 간다(위 `emptyReason`). 두 자리는 서로 배타적이라 함께 서지 않는다.
          */}
          {dropped > 0 ? (
            <AppText variant="caption" tone="tertiary">
              공개가 끝난 학습 {dropped}개는 목록에서 빠졌어요.
            </AppText>
          ) : null}

          <Section title="더 담고 싶다면">
            {/*
              같은 이름의 같은 행동은 같은 무게다(위 빈 상태 주석). 이 화면을 끝내는 행동은
              위의 전폭 `첫 번째 학습부터 시작하기` 하나이고, 이것은 `hug`이라 폭으로 갈린다.
              자리도 같다 — 마지막 줄 오른쪽 끝(§8 규칙 ③ · 빈 상태의 행동과 같은 자리).

              높이만 빈 상태와 다르다: `sm`(32)은 **목록 아래 보조 행동** 자리라서 쓰고(§8),
              빈 상태에서는 그것이 화면의 유일한 행동이라 기본 44다.
            */}
            <View style={endRow.action}>
              <Button
                testID="queue-go-learn"
                size="sm"
                hug
                label="문제 담으러 가기"
                trailing={<Icon name="arrow-right" size={15} color={colors.accentText} />}
                onPress={() => router.push('/student/learn' as never)}
              />
            </View>
          </Section>
        </>
      )}
    </Screen>
  );
}

/**
 * 목록 한 줄. 학습을 누르면 상세로, 아래 줄에서 순서를 바꾸거나 뺀다.
 * 조작을 두 줄로 나눈 이유는 모바일(390) 한 줄에 버튼 셋이 들어가지 않기 때문이다.
 */
function QueueRow({
  item,
  index,
  last,
  selecting,
  picked,
  onOpen,
  onPick,
  onMove,
  onRemove,
}: {
  item: LearningItem;
  index: number;
  last: boolean;
  selecting: boolean;
  picked: boolean;
  onOpen: () => void;
  onPick: () => void;
  onMove: (dir: 'up' | 'down') => void;
  onRemove: () => void;
}) {
  return (
    <View testID={`queue-item-${item.id}`}>
      {/*
        순번은 정보라 왼쪽(`leading`)에 둔다. 오른쪽에 두면 `trailing`이 차 있다고 보고
        행의 이동 화살표가 사라져, 눌러서 들어갈 수 있다는 신호를 잃는다.
        고르기 모드에서만 오른쪽이 행동(체크박스)으로 채워진다.
      */}
      <LearningRow
        item={item}
        onPress={selecting ? onPick : onOpen}
        leading={
          selecting ? undefined : (
            <AppText variant="caption" tone="tertiary" style={styles.order}>
              {index + 1}
            </AppText>
          )
        }
        trailing={
          selecting ? (
            /*
              보이는 상자는 22px이지만 누르는 영역은 44px이다(§10).
              다중 선택은 줄마다 반복되는 행동이라 여기가 가장 자주 빗나가는 자리다.
            */
            <Pressable
              testID={`queue-select-${item.id}`}
              accessibilityRole="checkbox"
              aria-checked={picked}
              accessibilityLabel={`${item.title} 고르기`}
              onPress={onPick}
              style={styles.checkHit}
            >
              <View style={[styles.check, picked && styles.checkOn]}>
                {picked ? <Icon name="check" size={14} color={colors.accentText} /> : null}
              </View>
            </Pressable>
          ) : undefined
        }
      />
      {selecting ? null : (
        <View style={styles.tools}>
          {/* 글자만 두면 버튼으로 읽히지 않아 아이콘을 앞에 둔다(DESIGN.md §8). */}
          {index > 0 ? (
            <Button
              testID={`queue-up-${item.id}`}
              variant="ghost"
              size="sm"
              label="위로"
              leading={<Icon name="arrow-up" size={15} color={colors.inkSecondary} />}
              onPress={() => onMove('up')}
            />
          ) : null}
          {last ? null : (
            <Button
              testID={`queue-down-${item.id}`}
              variant="ghost"
              size="sm"
              label="아래로"
              leading={<Icon name="arrow-down" size={15} color={colors.inkSecondary} />}
              onPress={() => onMove('down')}
            />
          )}
          <Button
            testID={`queue-remove-${item.id}`}
            variant="ghost"
            size="sm"
            label="빼기"
            leading={<Icon name="minus-circle" size={15} color={colors.inkSecondary} />}
            onPress={onRemove}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  // 실패 줄. 문장 아래에 `hug` 버튼을 두므로 줄 폭까지 늘어나지 않게 왼쪽에 맞춘다.
  loadFailed: { gap: spacing.sm, alignItems: 'flex-start' },
  // 뺀 직후 안내. 되돌릴 수 있으니 확인 단계를 두지 않는다(오답노트와 같은 모양).
  undo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.offset,
  },
  // 되돌리기는 이 화면에서 가장 놓치기 쉬운 행동이라 누름 영역을 44px로 잡는다(§10).
  order: { fontFamily: typeface.medium, minWidth: 16, textAlign: 'right' },
  tools: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  checkHit: {
    width: touch.min,
    height: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
    // 커진 만큼 되돌려 줄 높이는 그대로 둔다.
    marginVertical: -spacing.md,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { borderColor: colors.accent, backgroundColor: colors.accent },
});
