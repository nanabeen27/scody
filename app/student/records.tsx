import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Screen, Section, Group, Row, ScoreCard, Button, AppText } from '@/components';
import { useProgress } from '@/features/progress';
import { spacing } from '@/theme/tokens';

const RECENT = 5;

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

/** 기록: 내가 푼 학습의 정답률·걸린 시간. 상단에 전체 정답률과 총 학습 시간. */
export default function StudentRecords() {
  const router = useRouter();
  const { attempts, wrongNotes } = useProgress();
  const [showAll, setShowAll] = useState(false);
  const list = Object.values(attempts).sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
  const visible = showAll ? list : list.slice(0, RECENT);

  const starred = wrongNotes.filter((n) => n.starred).length;
  const withMemo = wrongNotes.filter((n) => n.dig).length;
  /** 카테고리(영역)별 오답 수. 학생이 약한 영역부터 고를 수 있게 많은 순으로. */
  const byArea = useMemo(() => {
    const acc: Record<string, { count: number; starred: number }> = {};
    for (const n of wrongNotes) {
      acc[n.area] = acc[n.area] ?? { count: 0, starred: 0 };
      acc[n.area].count += 1;
      if (n.starred) acc[n.area].starred += 1;
    }
    return Object.entries(acc)
      .map(([area, v]) => ({ area, ...v }))
      .sort((a, b) => b.count - a.count);
  }, [wrongNotes]);

  const avg = list.length
    ? Math.round(list.reduce((s, a) => s + a.accuracy, 0) / list.length)
    : null;
  const totalTime = list.reduce((s, a) => s + a.timeSec, 0);

  return (
    <Screen testID="student-records" title="기록">
      {avg != null ? (
        <ScoreCard rate={avg} detail={`완료 ${list.length}개 · 총 학습 시간 ${fmtTime(totalTime)}`} />
      ) : null}

      <Section title="완료한 학습">
        {list.length === 0 ? (
          <>
            <Group>
              <View style={{ padding: spacing.lg }}>
                <AppText tone="secondary">
                아직 제출한 학습이 없어요. 학습을 제출하면 정답률과 걸린 시간이 여기에 쌓여요.
              </AppText>
              </View>
            </Group>
            <Button
              testID="records-empty-start"
              label="학습 탭에서 문제 고르기"
              onPress={() => router.push('/student/learn' as never)}
            />
          </>
        ) : (
          <>
            <Group>
              {visible.map((a) => (
                <Row
                  key={a.itemId}
                  title={a.title}
                  subtitle={`국어 · ${a.area} · ${fmtTime(a.timeSec)}`}
                  meta={`정답률 ${a.accuracy}%`}
                  showChevron
                  onPress={() => router.push(`/student/result/${a.itemId}` as never)}
                />
              ))}
            </Group>
            {list.length > RECENT ? (
              <Button
                variant="ghost"
                label={showAll ? '최근 기록만 보기' : `지난 기록 더보기 (${list.length - RECENT}개)`}
                onPress={() => setShowAll((v) => !v)}
              />
            ) : null}
          </>
        )}
      </Section>

      <Section title="오답노트로 공부하기">
        {wrongNotes.length === 0 ? (
          <Group>
            <View style={{ padding: spacing.lg, gap: spacing.xs }}>
              <AppText tone="secondary">담아 둔 오답이 없어요.</AppText>
              <AppText variant="caption" tone="tertiary">
                결과 화면에서 틀린 문제를 담으면 여기서 카테고리별로 복습할 수 있어요.
              </AppText>
            </View>
          </Group>
        ) : (
          <>
            <AppText variant="caption" tone="secondary">
              오답 {wrongNotes.length}개 · 별표 {starred}개 · 메모 정리 {withMemo}개
            </AppText>
            <Group>
              {byArea.map((a) => (
                <Row
                  key={a.area}
                  testID={`review-area-${a.area}`}
                  title={a.area}
                  subtitle={`오답 ${a.count}개${a.starred > 0 ? ` · 별표 ${a.starred}개` : ''}`}
                  showChevron
                  onPress={() => router.push(`/student/review?area=${a.area}` as never)}
                />
              ))}
            </Group>
            <Button
              testID="records-review"
              fullWidth
              label="오답노트 복습하기"
              onPress={() => router.push('/student/review' as never)}
            />
            {starred > 0 ? (
              <Button
                testID="records-review-starred"
                variant="secondary"
                fullWidth
                label={`별표 ${starred}개만 집중 복습하기`}
                onPress={() => router.push('/student/review?starred=1' as never)}
              />
            ) : null}
            <Button
              testID="records-notebook"
              variant="ghost"
              label="오답노트에서 질문하고 메모하기"
              onPress={() => router.push('/student/notebook' as never)}
            />
          </>
        )}
      </Section>
    </Screen>
  );
}
