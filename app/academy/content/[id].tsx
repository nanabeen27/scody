import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Screen, Section, Group, Row, Button, AppText, Icon, Passage } from '@/components';
import { useCurrentAccount } from '@/session';
import { useAcademyStaff } from '@/features/academy';
import { useContent } from '@/features/content';
import { useProgress } from '@/features/progress';
import { findContent, gradeLabel, type Question } from '@/data';
import { dueLabel } from '@/features/learning';
import { colors, spacing } from '@/theme/tokens';

const KIND_LABEL = { passage: '지문형', grammar: '문법형' } as const;

/**
 * 우리 학원이 등록한 문제 한 세트. 문항·보기·정답·해설을 그대로 확인한다.
 *
 * 다른 학원 콘텐츠와 운영자 콘텐츠는 이 경로로 열 수 없다 — 주소를 직접 쳐도 목록으로 되돌린다
 * (마스터 플랜 2절: 다른 학원 콘텐츠는 보이지 않는다).
 *
 * 고치기·지우기는 두지 않았다. `useContent`에 수정·삭제 API가 없고, 무엇보다 이미 배정한
 * 학습을 고치면 학생이 푼 기록과 어긋난다. 화면에서 그 사실을 문장으로 밝힌다.
 */
export default function AcademyContentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const account = useCurrentAccount();
  const { sets } = useContent();
  const { assignments, loading: progressLoading } = useProgress();
  const { classesFor } = useAcademyStaff();

  const found = findContent(sets, String(id));
  const set =
    found && found.ownerAcademyName && found.ownerAcademyName === account.academyName
      ? found
      : undefined;

  /**
   * 이 학습을 낸 기록. 제출이 있으면 되돌릴 수 없는 상태다.
   *
   * **반 목록은 세션 스냅샷에서 온다**(원장은 학원 전체, 선생님은 담당 반). 예전에는
   * `ACADEMY_CLASSES` fixture와 맞춰 봤는데, fixture의 반 id는 `c_kor1` 같은 문자열이고
   * 서버 `class_id`는 uuid라서 **이 목록은 구조적으로 항상 비어 있었다** — 배정한 학습에도
   * `아직 배정하지 않았어요`가 뜨고, 아래 고지 문장이 틀린 쪽을 골랐다.
   */
  const assigned = useMemo(() => {
    if (!set) return [];
    const ours = classesFor(account);
    return assignments
      .filter((a) => a.contentId === set.id && ours.some((c) => c.id === a.classId))
      .map((a) => ({
        id: a.id,
        className: ours.find((c) => c.id === a.classId)?.name ?? '반',
        due: dueLabel(a.dueDate)?.text ?? '마감 없음',
        submitted: a.submissions.filter((s) => s.submitted).length,
        total: a.submissions.length,
      }));
  }, [set, assignments, classesFor, account]);

  if (!set) {
    return (
      <Screen
        testID="academy-content-detail"
        backFallback="/academy/content"
        title="문제를 찾을 수 없어요"
      >
        <Group>
          <Row
            title="목록에서 다시 골라 주세요"
            subtitle="우리 학원이 등록한 문제만 여기서 볼 수 있어요"
          />
        </Group>
      </Screen>
    );
  }

  return (
    <Screen
      wide
      testID="academy-content-detail"
      backFallback="/academy/content"
      title={set.title}
      lead={[
        set.grade ? gradeLabel(set.grade) : null,
        set.area,
        set.topic,
        KIND_LABEL[set.kind],
        `${set.questions.length}문항`,
      ]
        .filter(Boolean)
        .join(' · ')}
    >
      <AppText variant="caption" tone="secondary">
        {assigned.length > 0
          ? '이미 배정한 학습이라 고칠 수 없어요. 학생이 푼 기록과 어긋나요.'
          : '지금은 등록한 문제를 고치거나 지우는 기능이 없어요. 내용을 바꾸려면 새로 등록해 주세요.'}
      </AppText>

      {set.kind === 'passage' && set.passage ? <Passage passage={set.passage} /> : null}

      <Section
        title={`문항 ${set.questions.length}개`}
        action={
          <Button
            testID="academy-content-assign"
            variant="secondary"
            tone="accent"
            size="sm"
            hug
            label="이 학습 배정하기"
            leading={<Icon name="edit-3" size={15} color={colors.accent} />}
            onPress={() => router.push(`/academy/assign?content=${set.id}` as never)}
          />
        }
      >
        <Group>
          {set.questions.map((q, i) => (
            <QuestionBlock key={q.id} index={i} question={q} />
          ))}
        </Group>
      </Section>

      {/* 아직 못 읽은 값을 `0회`로 단정하지 않는다 — 없는 것과 모르는 것은 다르다. */}
      <Section title={progressLoading ? '배정' : `배정 ${assigned.length}회`}>
        <Group>
          {progressLoading ? (
            <Row title="배정 기록을 불러오고 있어요" />
          ) : assigned.length ? (
            assigned.map((a) => (
              <Row
                key={a.id}
                testID={`academy-content-assigned-${a.id}`}
                title={a.className}
                subtitle={`${a.due} · 낸 학생 ${a.submitted}/${a.total}명`}
              />
            ))
          ) : (
            <Row
              title="아직 배정하지 않았어요"
              subtitle="배정하면 반 학생의 홈과 학습 탭에 나타나요"
            />
          )}
        </Group>
      </Section>

      <AppText variant="caption" tone="tertiary">
        이 문제는 우리 학원만 배정할 수 있어요. 다른 학생의 개인 학습에는 올라가지 않아요.
      </AppText>
    </Screen>
  );
}

/**
 * 문항 한 덩어리. 발문 · 보기 · 정답 · 해설을 순서대로 둔다.
 * 이 화면에서만 쓰는 표시라 공용 컴포넌트로 올리지 않았다 —
 * `QuestionReview`는 풀이 기록(정답/오답)이 있어야 뜻이 서는 컴포넌트다.
 */
function QuestionBlock({ index, question }: { index: number; question: Question }) {
  return (
    <View style={styles.q} testID={`academy-content-q-${question.id}`}>
      <AppText variant="label">
        {index + 1}. {question.prompt}
      </AppText>
      <View style={styles.choices}>
        {question.choices.map((c, ci) => {
          const answer = ci === question.answerIndex;
          return (
            <View key={ci} style={styles.choice}>
              <AppText variant="caption" tone="tertiary" style={styles.no}>
                {ci + 1}
              </AppText>
              {/* 정답은 색만으로 말하지 않는다 — `· 정답`을 함께 적는다(DESIGN.md §11). */}
              <AppText
                variant="caption"
                tone={answer ? 'accent' : 'secondary'}
                style={styles.choiceText}
              >
                {c}
                {answer ? ' · 정답' : ''}
              </AppText>
            </View>
          );
        })}
      </View>
      {question.explanation ? (
        <View style={styles.explain}>
          <AppText variant="caption" tone="tertiary">
            해설
          </AppText>
          <AppText variant="caption" tone="secondary">
            {question.explanation}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  q: { paddingVertical: spacing.lg, paddingHorizontal: spacing.lg, gap: spacing.sm },
  choices: { gap: spacing.xs },
  // 선지는 두 줄 이상이 흔하다. 번호는 첫 줄에 고정하고 본문만 접힌다(DESIGN.md §16).
  choice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  no: { minWidth: 14 },
  choiceText: { flex: 1 },
  explain: {
    gap: 2,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
