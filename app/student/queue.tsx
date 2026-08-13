import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ActionBar, Screen, Section, Group, Button, AppText, Icon, LearningRow } from '@/components';
import { useSession } from '@/session';
import { useQueuedItems } from '@/features/learning';
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
  const { queue, removeManyFromQueue, moveInQueue, restoreToQueue } = useProgress();
  const { readOnly } = useSession();
  const { show } = useToast();
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

      {items.length === 0 ? (
        <>
          <Group>
            <View style={styles.empty}>
              <AppText tone="secondary">담아 둔 학습이 없어요.</AppText>
              <AppText variant="caption" tone="tertiary">
                학습 탭에서 풀고 싶은 학습을 담아 두면 여기에 모여요.
              </AppText>
            </View>
          </Group>
          {/*
            `문제 담으러 가기`의 무게는 앱 어디서나 같다: **강조색 + `hug` + 화살표**
            (`index.tsx` 두 곳 · `records.tsx` 한 곳도 같다). §8이 이름까지 지목한
            `다른 화면으로 보내기만 하는 버튼`이라 전폭이 아니다 — `hug`을 받은
            `ActionBar`는 줄의 오른쪽 끝에 세운다(규칙 ③).
          */}
          <ActionBar>
            <Button
              testID="queue-empty-start"
              hug
              label="문제 담으러 가기"
              trailing={<Icon name="arrow-right" size={16} color={colors.accentText} />}
              onPress={() => router.replace('/student/learn' as never)}
            />
          </ActionBar>
        </>
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

          {dropped > 0 ? (
            <AppText variant="caption" tone="tertiary">
              공개가 끝난 학습 {dropped}개는 목록에서 빠졌어요.
            </AppText>
          ) : null}

          <Section title="더 담고 싶다면">
            {/*
              같은 이름의 같은 행동은 같은 무게다(위 빈 상태 주석). 이 화면을 끝내는 행동은
              위의 전폭 `첫 번째 학습부터 시작하기` 하나이고, 이것은 `hug`이라 폭으로 갈린다.
              자리도 같다 — 마지막 줄 오른쪽 끝(§8 규칙 ③ · 빈 상태의 `ActionBar`와 같은 자리).
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
  empty: { padding: spacing.lg, gap: spacing.xs },
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
