import { View } from 'react-native';
import { Screen, Section, Group, Row, AppText } from '@/components';
import { useCurrentAccount } from '@/session';
import { useProgress } from '@/features/progress';
import { getClassesForAccount, getClass, getAccount, submissionStat } from '@/data';
import { spacing } from '@/theme/tokens';

/** 성과 분석 + 제출 현황. 배정 학습만 표시하고 학생 개인 학습 상세는 표시하지 않는다. */
export default function AcademyAnalytics() {
  const account = useCurrentAccount();
  const { assignments, academyNotesOf } = useProgress();
  const classIds = new Set(getClassesForAccount(account).map((c) => c.id));
  const scoped = assignments.filter((a) => classIds.has(a.classId));

  // 배정 학습에서 나온 오답노트만 모은다(개인 학습 상세는 정책상 열람 불가).
  const classStudentIds = Array.from(
    new Set(getClassesForAccount(account).flatMap((c) => c.studentIds)),
  );
  const academyNotes = classStudentIds.flatMap((sid) => {
    const student = getAccount(sid);
    return academyNotesOf(sid).map((n) => ({ note: n, studentName: student?.name ?? '학생' }));
  });

  // 다음 행동이 필요한 대상: 아직 안 낸 학생.
  const pending = scoped.flatMap((a) =>
    a.submissions
      .filter((s) => !s.submitted)
      .map((s) => ({
        key: `${a.id}-${s.studentId}`,
        name: getAccount(s.studentId)?.name ?? '학생',
        title: a.title,
        due: a.dueDate,
      })),
  );

  return (
    <Screen wide testID="academy-analytics" title="성과 분석">
      <AppText variant="caption" tone="tertiary">
        배정한 학습의 제출과 결과만 표시합니다. 학생 개인 학습 상세는 표시하지 않습니다.
      </AppText>

      {scoped.length === 0 ? (
        <Group>
          <View style={{ padding: spacing.lg }}>
            <AppText tone="secondary">아직 배정한 학습이 없어요.</AppText>
          </View>
        </Group>
      ) : (
        <Section title="배정 학습 · 제출 현황">
          <Group>
            {scoped.map((a) => {
              const s = submissionStat(a);
              const cls = getClass(a.classId);
              const meta = `제출 ${s.submitted}/${s.total}${s.avgAccuracy != null ? ` · 평균 ${s.avgAccuracy}%` : ''}`;
              return (
                <Row
                  key={a.id}
                  title={`${a.subject} · ${a.title}`}
                  subtitle={`${cls?.name ?? ''}${a.dueDate ? ` · ${a.dueDate} 마감` : ''}`}
                  meta={meta}
                />
              );
            })}
          </Group>
        </Section>
      )}

      <Section title={`배정 학습 오답노트 ${academyNotes.length}개`}>
        {academyNotes.length > 0 ? (
          <Group>
            {academyNotes.slice(0, 20).map(({ note, studentName }) => (
              <Row
                key={`${studentName}-${note.id}`}
                title={note.prompt}
                subtitle={`${studentName} · ${note.title} · 정답: ${note.choices[note.answerIndex]}`}
                meta={note.dig ? '메모 있음' : '메모 없음'}
              />
            ))}
          </Group>
        ) : (
          <Group>
            <View style={{ padding: spacing.lg, gap: spacing.xs }}>
              <AppText tone="secondary">배정 학습에서 담은 오답이 아직 없어요.</AppText>
              <AppText variant="caption" tone="tertiary">
                학생이 개인 학습에서 담은 오답은 학원에 공개되지 않아요.
              </AppText>
            </View>
          </Group>
        )}
      </Section>

      <Section title="확인이 필요한 학생">
        {pending.length > 0 ? (
          <Group>
            {pending.map((p) => (
              <Row
                key={p.key}
                title={p.name}
                subtitle={`${p.title} 미제출${p.due ? ` · ${p.due} 마감` : ''}`}
                meta="미제출"
              />
            ))}
          </Group>
        ) : (
          <Group>
            <View style={{ padding: spacing.lg }}>
              <AppText tone="secondary">
                {scoped.length === 0 ? '배정한 학습이 없어요.' : '모두 제출했어요.'}
              </AppText>
            </View>
          </Group>
        )}
      </Section>
    </Screen>
  );
}
