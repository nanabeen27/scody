import { useState } from 'react';
import { useRouter } from 'expo-router';

import {
  AppText,
  Button,
  EmptyState,
  Group,
  Icon,
  LoadFailed,
  Row,
  ScoreCard,
  Screen,
  Section,
  SegmentedControl,
  SourceTag,
  type SegmentedOption,
} from '@/components';
import { useCurrentAccount } from '@/session';
import { formatDate, useStudentItems } from '@/features/learning';
import { useProgress } from '@/features/progress';
import { colors } from '@/theme/tokens';

const RECENT = 5;

/** 출처 필터. 이 화면의 유일한 필터다(§8 · D-077). */
type SourceFilter = 'all' | 'academy' | 'personal';

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

/**
 * 기록: 내가 푼 학습의 출처·날짜·정답률·걸린 시간. 상단에 전체 정답률과 총 학습 시간.
 *
 * **오답노트는 여기 없다.** 기록은 "무엇을 했는지"를 보는 곳이고, 오답을 다시 푸는 것은
 * 앞으로 할 일이라 `학습` 탭에 있다(D-130).
 *
 * **줄마다 출처를 말한다**(확정 정책 2절 · `DESIGN.md` §18). 이 목록에는 학원 과제와 개인
 * 학습이 섞여 서는데, 앱의 다른 자리(홈 히어로·학습 탭·풀이·결과·오답노트·카드 복습·담아 둔
 * 학습)는 전부 `SourceTag`를 붙이고 이 화면만 빼먹고 있었다 — `정답률 60%`가 학원이 내준
 * 과제의 결과인지 내가 고른 학습의 결과인지 구분되지 않았다(둘 다 하는 학생에게는 다른 뜻이다).
 *
 * **날짜도 함께 말한다.** 목록은 제출일 내림차순인데 날짜가 화면에 없어서 왜 이 순서인지
 * 알 수 없었고, "지난주에 얼마나 했는지"를 이 화면에서 셀 수 없었다.
 */
export default function StudentRecords() {
  const router = useRouter();
  const account = useCurrentAccount();
  const { hasPersonal } = useStudentItems();
  const { attempts, loading, error, reload } = useProgress();
  const [showAll, setShowAll] = useState(false);
  const [source, setSource] = useState<SourceFilter>('all');
  const list = Object.values(attempts).sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));

  /*
    **읽는 중 · 실패 · 없음을 셋으로 가른다**(D-136 · A-116). 조회가 끝나기 전에도, 조회가
    실패해도 이 화면은 `아직 제출한 학습이 없어요`라고 단정하고 있었다 — 실패하면 `loading`이
    내려가므로 로딩 게이트만으로는 덮이지 않는다. 모양은 학생 화면 넷과 같다
    (`index.tsx` · `learn.tsx` · `pick.tsx` · `review.tsx`).

    **다시 읽는 중에는 실패 문장을 감춘다** — 실패 줄과 `불러오고 있어요`가 한 화면에 함께
    서면 지금 무슨 일이 일어나는지 알 수 없다(§9).
  */
  const reading = loading;
  const loadError = reading ? null : error;

  /*
    **손에 아무 기록도 없을 때만 읽는 중·실패로 갈린다.** 이미 읽어 둔 기록은 지우지 않는다
    (§9) — 다시 읽기가 실패해도 가진 기록은 여전히 사실이라 목록과 정답률은 그대로 둔다.
  */
  const empty = list.length === 0;

  const academyCount = list.filter((a) => a.source === 'academy').length;
  const personalCount = list.length - academyCount;
  /*
    **두 출처가 실제로 섞여 있을 때만 필터를 그린다.** 한쪽만 가진 학생에게 `전체`와
    그 출처 칸은 **같은 목록**이라 고를 것이 없다(§8의 `결과가 0건인 필터 칸은 렌더하지
    않는다` · D-075의 같은 판단). 출처별 개수는 아래 목록 줄의 `SourceTag`가 이미 말한다.
  */
  const canFilter = academyCount > 0 && personalCount > 0;
  /* 칸이 사라진 뒤에도 그 값이 남아 빈 목록이 되지 않게, 그릴 수 없으면 `전체`로 본다. */
  const filter = canFilter ? source : 'all';
  const filtered = filter === 'all' ? list : list.filter((a) => a.source === filter);
  const visible = showAll ? filtered : filtered.slice(0, RECENT);

  const sourceOptions: SegmentedOption<SourceFilter>[] = [
    { value: 'all', label: '전체', count: list.length },
    { value: 'academy', label: '학원 과제', count: academyCount },
    { value: 'personal', label: '개인 학습', count: personalCount },
  ];

  /*
    위 지표는 **필터를 따라가지 않는다.** 이 화면에 온 학생의 질문은 "지금까지 얼마나 했나"라
    그 답이 화면의 머리글자여야 하고, 필터를 누를 때마다 가장 큰 숫자가 튀면 무엇에 대한 값인지
    흐려진다. 필터는 아래 목록에 걸리고, 출처별 규모는 필터 칸의 개수가 말한다.
  */
  const avg = list.length
    ? Math.round(list.reduce((s, a) => s + a.accuracy, 0) / list.length)
    : null;
  const totalTime = list.reduce((s, a) => s + a.timeSec, 0);

  /**
   * 새로 고를 수 없는 계정에 그 이유(또는 지금 기다리는 것)를 말하는 한 줄.
   * **홈(`app/student/index.tsx`의 `noPickReason`)과 같은 문장이다** — 같은 학생이 같은 상황을
   * 두 화면에서 다른 말로 듣지 않게 한다.
   */
  const noPickReason = account.academyName
    ? '학원에서 과제를 내주면 여기에서 알려 줘요.'
    : '개인 학습 이용권이 없어서 아직 고를 수 있는 학습이 없어요.';

  return (
    <Screen testID="student-records" title="기록">
      {/*
        조회가 실패하면 기록이 없다고 말하지 않는다(D-136). 인라인 `danger` 캡션 + 다시 시도할
        행동 하나이고, 화면에 실패 면은 하나다 — 지표와 목록이 같은 조회에 매달려 있다.
      */}
      {loadError ? (
        <LoadFailed
          testID="records-load-failed"
          retryTestID="records-load-retry"
          what="기록"
          message={loadError}
          onRetry={() => void reload()}
        />
      ) : null}

      {avg != null ? (
        <ScoreCard rate={avg} detail={`완료 ${list.length}개 · 총 학습 시간 ${fmtTime(totalTime)}`} />
      ) : null}

      {/*
        읽지 못한 상태에서는 섹션 껍데기를 남기지 않는다(§9 `빈 카드를 남기지 않는다`).
        위 실패 줄이 이미 그 자리를 말했다.
      */}
      {empty && loadError ? null : (
        <Section
          title="완료한 학습"
          action={
            !empty && filtered.length > RECENT ? (
              <Button
                testID="records-more"
                variant="secondary"
                size="sm"
                tone="accent"
                hug
                label={showAll ? '접기' : `${filtered.length - RECENT}개 더 보기`}
                onPress={() => setShowAll((v) => !v)}
              />
            ) : null
          }
        >
          {!empty ? (
            <>
              {canFilter ? (
                <SegmentedControl
                  testID="records-source"
                  options={sourceOptions}
                  value={filter}
                  onChange={setSource}
                />
              ) : null}
              <Group>
                {visible.map((a) => (
                  <Row
                    key={a.itemId}
                    title={a.title}
                    /*
                      날짜를 넣어 정렬 근거를 화면에 남긴다. 형식은 `formatDate` 한곳에서 오고
                      (ISO 원문을 화면에 내보내지 않는다, §8) 제출일이 비어 있는 기록은
                      학부모 리포트와 같은 문장으로 말한다.
                    */
                    subtitle={[
                      '국어',
                      a.area,
                      a.dateISO ? formatDate(a.dateISO) : '제출일 기록 없음',
                      fmtTime(a.timeSec),
                    ].join(' · ')}
                    /* 출처는 손으로 쓴 글이 아니라 `SourceTag`다(§18). 줄의 첫 자리에 둔다. */
                    leading={<SourceTag source={a.source} />}
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
            </>
          ) : reading ? (
            /* 읽는 중에는 없다고 말하지 않는다(D-133). 무게는 다른 학생 화면과 같은 한 줄이다. */
            <AppText variant="caption" tone="secondary">
              기록을 불러오고 있어요.
            </AppText>
          ) : (
            /* 빈 상태의 형태는 앱에 하나뿐이다(D-104). 다음 행동도 하나만 둔다. */
            <EmptyState
              title="아직 제출한 학습이 없어요"
              /*
                **고를 수 없는 학생에게는 이유를 말한다**(D-141). 예전에는 누구에게나
                `학습을 제출하면 … 쌓여요.`라고만 하고 `문제 담으러 가기`를 함께 줬다.
              */
              subtitle={
                hasPersonal ? '학습을 제출하면 정답률과 걸린 시간이 여기에 쌓여요.' : noPickReason
              }
              action={
                /*
                  **이용권이 없으면 고르러 가는 행동을 두지 않는다**(D-141). 그 목적지에서 이
                  학생이 누를 수 있는 것은 0개다 — `learn.tsx`는 `hasPersonal`이 false면 고르기
                  진입 줄을 아예 렌더하지 않는다. 홈 세 자리에서 없앤 거짓말의 네 번째 자리였다.

                  남는 경우에도 무게는 앱 어디서나 같다: **강조색 + `hug` + 화살표**
                  (`index.tsx` 두 곳 · `queue.tsx` 두 곳도 같다, D-123). 다른 화면으로 보내기만
                  하는 버튼은 전폭이 아니다(§8).
                */
                hasPersonal ? (
                  <Button
                    testID="records-empty-start"
                    hug
                    label="문제 담으러 가기"
                    trailing={<Icon name="arrow-right" size={16} color={colors.accentText} />}
                    onPress={() => router.push('/student/learn' as never)}
                  />
                ) : null
              }
            />
          )}
        </Section>
      )}
    </Screen>
  );
}
