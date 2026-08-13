import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Screen,
  Section,
  Group,
  Row,
  ScoreCard,
  Button,
  Icon,
  AppText,
  EmptyState,
} from '@/components';
import { useProgress } from '@/features/progress';
import { colors } from '@/theme/tokens';

const RECENT = 5;

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

/**
 * 기록: 내가 푼 학습의 정답률·걸린 시간. 상단에 전체 정답률과 총 학습 시간.
 *
 * **오답노트는 여기 없다.** 기록은 "무엇을 했는지"를 보는 곳이고, 오답을 다시 푸는 것은
 * 앞으로 할 일이라 `학습` 탭에 있다(D-130).
 */
export default function StudentRecords() {
  const router = useRouter();
  const { attempts } = useProgress();
  const [showAll, setShowAll] = useState(false);
  const list = Object.values(attempts).sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
  const visible = showAll ? list : list.slice(0, RECENT);

  const avg = list.length
    ? Math.round(list.reduce((s, a) => s + a.accuracy, 0) / list.length)
    : null;
  const totalTime = list.reduce((s, a) => s + a.timeSec, 0);

  return (
    <Screen testID="student-records" title="기록">
      {avg != null ? (
        <ScoreCard rate={avg} detail={`완료 ${list.length}개 · 총 학습 시간 ${fmtTime(totalTime)}`} />
      ) : null}

      <Section
        title="완료한 학습"
        action={
          list.length > RECENT ? (
            <Button
              testID="records-more"
              variant="secondary"
              size="sm"
              tone="accent"
              hug
              label={showAll ? '접기' : `${list.length - RECENT}개 더 보기`}
              onPress={() => setShowAll((v) => !v)}
            />
          ) : null
        }
      >
        {list.length === 0 ? (
          /* 빈 상태의 형태는 앱에 하나뿐이다(D-104). 다음 행동도 하나만 둔다. */
          <EmptyState
            title="아직 제출한 학습이 없어요"
            subtitle="학습을 제출하면 정답률과 걸린 시간이 여기에 쌓여요."
            action={
              /*
                다른 화면으로 보내기만 하는 버튼은 전폭이 아니다(§8).
                `문제 담으러 가기`의 무게는 앱 어디서나 같다: **강조색 + `hug` + 화살표**
                (`index.tsx` 두 곳 · `queue.tsx` 두 곳도 같다).
              */
              <Button
                testID="records-empty-start"
                hug
                label="문제 담으러 가기"
                trailing={<Icon name="arrow-right" size={16} color={colors.accentText} />}
                onPress={() => router.push('/student/learn' as never)}
              />
            }
          />
        ) : (
          <Group>
            {visible.map((a) => (
              <Row
                key={a.itemId}
                title={a.title}
                subtitle={`국어 · ${a.area} · ${fmtTime(a.timeSec)}`}
                /* 이 화면의 핵심 값이다. `meta`는 `inkTertiary`(3.23:1, AA 미달)라 쓰지 않는다(§8). */
                trailing={<AppText variant="label" numeric>{`${a.accuracy}%`}</AppText>}
                /*
                  `trailing`이 있으면 chevron을 두지 않는다(§8·`Row` docblock). `trailing`은 누름
                  영역 밖에 붙어서, 함께 주면 순서가 `[제목 … >][80%]`가 되어 이 화면의 핵심 값이
                  이동 표시 뒤로 밀린다. 화살표가 없어도 행은 그대로 눌린다.
                */
                onPress={() => router.push(`/student/result/${a.itemId}` as never)}
              />
            ))}
          </Group>
        )}
      </Section>

    </Screen>
  );
}
