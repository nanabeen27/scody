import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Section, Group, Row, Button } from '@/components';
import { useCurrentAccount } from '@/session';
import { useProgress } from '@/features/progress';
import { useAcademyStaff } from '@/features/academy';
import { getClass, getClassesForAccount, getStudentsInClass, getAccount } from '@/data';

/** 반 상세: 담당 선생님과 학생 목록. 권한 밖 반은 접근 불가. */
export default function ClassDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const account = useCurrentAccount();
  const { assignments } = useProgress();
  const { isActiveTeacher } = useAcademyStaff();
  const allowed = getClassesForAccount(account).some((c) => c.id === id);
  const cls = id ? getClass(id) : undefined;

  if (!cls || !allowed) {
    return (
      <Screen wide testID="academy-class" title="반을 찾을 수 없어요">
        <Button label="반 목록으로" onPress={() => router.replace('/academy/classes' as never)} />
      </Screen>
    );
  }

  // 학원에서 제외된 선생님은 담당으로 표시하지 않는다.
  const teacher = isActiveTeacher(cls.teacherId) ? getAccount(cls.teacherId) : undefined;
  const students = getStudentsInClass(cls.id);
  // 학원은 배정 학습의 제출 결과만 본다. 개인 학습 기록은 여기에 쓰지 않는다.
  const classAssignments = assignments.filter((a) => a.classId === cls.id);
  const summaryFor = (studentId: string) => {
    const rows = classAssignments
      .map((a) => a.submissions.find((s) => s.studentId === studentId))
      .filter(Boolean) as { submitted: boolean; accuracy?: number }[];
    const submitted = rows.filter((s) => s.submitted);
    const accs = submitted.map((s) => s.accuracy).filter((v): v is number => v != null);
    const avg = accs.length ? Math.round(accs.reduce((x, y) => x + y, 0) / accs.length) : null;
    if (rows.length === 0) return '배정 학습 없음';
    return `제출 ${submitted.length}/${rows.length}${avg != null ? ` · 평균 ${avg}%` : ''}`;
  };

  return (
    <Screen
      wide
      testID="academy-class"
      backFallback="/academy/classes"
      eyebrow={cls.academyName}
      title={cls.name}
    >
      <Group>
        <Row title="담당 선생님" meta={teacher?.name ?? '미배정'} />
        <Row title="학생 수" meta={`${students.length}명`} />
      </Group>
      <Section title="학생">
        <Group>
          {students.map((st) => (
            <Row key={st.userId} title={st.name} subtitle={st.academyName ?? ''} meta={summaryFor(st.userId)} />
          ))}
        </Group>
      </Section>
    </Screen>
  );
}
