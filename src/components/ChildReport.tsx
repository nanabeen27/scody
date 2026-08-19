import { useState } from "react";
import { useRouter } from "expo-router";
import { View, Pressable, StyleSheet } from "react-native";
import { AppText } from "./AppText";
import { Section } from "./Section";
import { Group } from "./Group";
import { Row } from "./Row";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { LoadFailed } from "./LoadFailed";
import { Pager } from "./Pager";
import { RichText } from "./RichText";
import { SourceTag } from "./SourceTag";
import { ProgressBar } from "./ProgressBar";
import { MotionAsset } from "./MotionAsset";
import { BarRow } from "./BarRow";
import type { Account } from "@/data";
import { useSession } from "@/session";
import {
  useProgress,
  PRAISE_LABEL,
  type PraiseKind,
} from "@/features/progress";
import { useToast } from "@/features/toast";
import { todayISO } from "@/features/clock";
import { formatDate, formatDuration } from "@/features/learning";
import { askScodyAIResult, hasOpenRouterKey } from "@/features/openrouter";
import { SCODY_PARENT_WEEK_SYSTEM } from "@/features/prompts";
import {
  useChildReport,
  monthOf,
  monthLabel,
  weekFacts,
  weekFallback,
  tidySummary,
  weekOf,
  type WeekStat,
  WEAK_MIN_QUESTIONS,
  RANK_MIN_SUBMITTERS,
  WEAK_THRESHOLD,
  type MonthStat,
} from "@/features/report";
import { useResponsive } from "@/theme/useResponsive";
import { colors, radius, spacing, touch } from "@/theme/tokens";

/**
 * 주격 조사. 영역 이름이 데이터에서 오므로 `독서이`처럼 어색해지지 않게 받침을 본다.
 * 한글 음절은 (코드 - 0xAC00) % 28 이 0이면 받침이 없다.
 */
function subjectParticle(word: string): "이" | "가" {
  const last = word.trim().slice(-1).charCodeAt(0);
  if (Number.isNaN(last) || last < 0xac00 || last > 0xd7a3) return "가";
  return (last - 0xac00) % 28 === 0 ? "가" : "이";
}

/** 지난달과의 차이 한 줄. 비교할 지난달이 없으면 아무 말도 하지 않는다. */
function delta(
  now: number,
  before: number | undefined,
  unit: string,
): string | undefined {
  if (before == null) return undefined;
  const d = now - before;
  if (d === 0) return "지난달과 같아요";
  return d > 0
    ? `지난달보다 ${d}${unit} 많아요`
    : `지난달보다 ${-d}${unit} 적어요`;
}

/** 목록 미리보기. 나머지는 더 보기로 펼친다(DESIGN.md §8). */
const PREVIEW = 5;

/**
 * 지표 한 줄. **카드로 만들지 않는다** — 큰 상자를 세로로 쌓으면 390에서 화면을 다 먹는다.
 * 이름(왼쪽) · 비교(이름 아래 작게) · 값(오른쪽). `Row`의 `meta`는 가장 흐린 글자라 값에 쓰지 않는다.
 */
function Metric({
  label,
  value,
  note,
  testID,
}: {
  label: string;
  value: string;
  note?: string;
  testID?: string;
}) {
  return (
    <Row
      testID={testID}
      title={label}
      subtitle={note}
      trailing={<AppText variant="label">{value}</AppText>}
    />
  );
}

/**
 * 자녀 월간 리포트. **한 달이 리포트 하나이고, 학원 과제와 개인 학습을 갈라서 말한다.**
 *
 * **아는 것만 말한다.** 리포트의 모든 값이 두 조회에서 오므로 `읽는 중 · 실패 · 없음`을 셋으로
 * 가른다(§9 · D-136 · D-168). 조회 상태는 `useChildReport`가 계산과 함께 준다.
 *
 * 학부모는 휴대폰으로 본다. 그래서 지표를 카드가 아니라 목록 한 줄로 두고,
 * 블록을 학부모의 판단 순서로 놓는다: ① 지금 문제가 있나 → ② 어느 달 → ③ 이 달 요약 →
 * ④ 학원 과제(반 비교 포함) → ⑤ 개인 학습 → ⑥ 틀린 걸 다시 봤나 → ⑦ 어디가 약한가 →
 * ⑧ 근거 → ⑨ 달마다 어떻게 변했나.
 */
export function ChildReport({
  child,
  month: fromQuery,
}: {
  child: Account;
  month?: string;
}) {
  const router = useRouter();
  const { requestRetryFor, retryOf } = useProgress();
  const { show } = useToast();
  const { readOnly } = useSession();
  /*
    들어올 때 달이 지정되면 그 달로 연다. **고른 달은 URL에도 남긴다.**
    학부모 라우트는 `<Slot />` 하나라 `자세히 보기`로 넘어가는 순간 이 화면이 언마운트된다 —
    URL에 남기지 않으면 상세에서 뒤로 나올 때 달 없는 앞 주소로 돌아가 리포트가 이번 달로
    되돌아갔다(방금 6월을 보고 있었는데 8월이 열린다). 새로고침·주소 공유도 같은 달을 연다.
  */
  const [month, setMonth] = useState<string | undefined>(fromQuery);
  const r = useChildReport(child.userId, month);
  const [showAll, setShowAll] = useState(false);
  /*
    오답노트 페이지. 달이나 자녀가 바뀌면 처음으로 돌아가야 하는데, effect에서 setState를 하면
    렌더가 연쇄된다. 그래서 상태에 키를 함께 담아 **파생**으로 계산한다.
  */
  const [noteNav, setNoteNav] = useState({ key: "", page: 0 });
  const requested = retryOf(child.userId);
  const today = todayISO();
  const { isMobile } = useResponsive();

  const openDetail = (itemId: string) =>
    router.push(
      `/parent/attempt?child=${child.userId}&item=${itemId}` as never,
    );

  /** 달을 바꾼다. 바꾼 사실을 한 줄로 알린다 — 화면 아래쪽에서 바꾸면 위쪽 변화가 안 보인다. */
  function pickMonth(m: string) {
    setMonth(m);
    /*
      **주소를 바꿀 뿐 히스토리를 늘리지 않는다**(`setParams`는 `history.replaceState`로 내려간다).
      달을 다섯 번 넘긴 뒤 뒤로가기를 다섯 번 눌러야 홈으로 나가는 일이 없어야 한다.
    */
    router.setParams({ month: m });
    show(`${monthLabel(m, today)} 리포트로 바꿨어요`);
  }

  /**
   * 다시 풀게 하기.
   *
   * **서버가 요청을 받아 준 다음에 알린다.** 먼저 알리면 요청이 저장되지 않아도 화면은
   * `요청했어요`라고 말하고, 다음 조회에서 그 표시가 조용히 사라진다
   * (`app/parent/children.tsx`가 먼저 쓰던 규칙이다).
   */
  async function askRetry(itemId: string) {
    const res = await requestRetryFor(child.userId, itemId);
    // 대리 보기에서는 쓰기가 거부된다(D-071). 일어나지 않은 일을 알리지 않는다.
    if (readOnly) return;
    if (!res.ok) {
      show(res.error ?? "요청하지 못했어요", "removed");
      return;
    }
    show("다시 풀기를 요청했어요");
  }

  const { totals, prev, notes, bySource, academyCompare, academySubmit } = r;
  const weakest = r.byArea[0];
  const visible = showAll ? r.rows : r.rows.slice(0, PREVIEW);
  const noteKey = `${child.userId}-${r.month}`;
  const notePage = noteNav.key === noteKey ? noteNav.page : 0;
  const setNotePage = (page: number) => setNoteNav({ key: noteKey, page });
  const note =
    r.monthNotes[Math.min(notePage, Math.max(0, r.monthNotes.length - 1))];
  const hasAcademy = academySubmit.assigned > 0 || bySource.academy.count > 0;
  /** 보고 있는 달이 비었을 때 옮겨 갈 달. 없으면 null이라 길을 만들지 않는다. */
  const jumpTo = r.latest && r.latest !== r.month ? r.latest : null;
  /*
    상세로 가는 길을 둘지. **그 달에 푼 학습이 없어도 상세가 말할 것이 있으면 길을 둔다** —
    상세의 `학원 과제 현황`은 배정만 보고 그리고(`academySubmit.assigned`) 오답노트 블록은
    그 달에 담은 오답을 센다. 예전에는 이 버튼이 `푼 학습이 있는` 갈래 안에만 있어서,
    과제를 받아 두고 아직 풀지 않은 자녀의 리포트에는 상세로 가는 길이 화면에 없었다.
  */
  const canOpenDetail =
    totals.count > 0 || academySubmit.assigned > 0 || notes.added > 0;
  /**
   * 상세로 가는 버튼. 자리에 따라 크기만 다르다 —
   * 섹션 제목 옆은 R2(`sm`)이고, 빈 달 화면에서는 그 화면의 행동이라 터치 하한(44)을 지킨다.
   */
  const detailLink = (size: "sm" | "md") => (
    <Button
      testID="report-detail"
      variant="secondary"
      size={size}
      tone="accent"
      hug
      label="자세히 보기"
      trailing={<Icon name="arrow-right" size={15} color={colors.accent} />}
      onPress={() =>
        router.push(
          `/parent/detail?child=${child.userId}&month=${r.month}` as never,
        )
      }
    />
  );

  /*
    **읽는 중 · 실패 · 없음을 셋으로 가른다**(`DESIGN.md` §9 · D-136 · D-168).
    기준 구현은 `app/student/index.tsx`이고 상태 이름과 게이트 방식을 그대로 맞춘다.

    이 화면은 세 상태를 하나로 뭉개고 있었다: 리포트가 보는 값은 전부 두 조회에서 오는데
    (`useChildReport`) 조회 상태를 한 번도 보지 않아 `allRows`와 `pending`이 비어 있으면
    `아직 학습 기록이 없어요`라고 말했다 — 그 조건은 ①첫 조회 중과 ②조회가 실패한 뒤
    **영구히** 참이라, 같은 순간 학부모 홈이 `기록을 불러오고 있어요`라고 정확히 말하는
    동안 리포트 탭은 같은 자녀에게 기록이 없다고 단정했다(D-090이 홈에서 고친 결함이다).
  */
  /** **다시 조회가 도는 중**(첫 조회가 아니다). 실패 줄의 버튼이 그 사이 라벨로 진행을 말한다. */
  const retrying = r.loading && r.loaded;
  /** 손에 든 기록이 하나도 없다. 첫 조회 중과 실패 뒤에도 참이라 이것만으로 `없어요`를 말할 수 없다. */
  const nothing = r.allRows.length === 0 && r.pending.length === 0;
  /**
   * 실패 자리. **한 화면에 실패 면은 하나다**(§9) — 리포트의 모든 블록이 같은 두 조회에
   * 매달려 있어서 자리마다 빨간 줄을 두면 한 번의 실패가 열 번으로 읽힌다.
   *
   * `again`은 **이미 읽어 둔 리포트가 화면에 있을 때만** 준다(§9) — 그 화면은 지금 값을
   * 보여 주고 있으므로 `불러오지 못했어요`만 쓰면 아무것도 못 읽은 것처럼 읽힌다.
   * 손에 아무것도 없는 갈래는 실제로 처음부터 못 읽은 것이라 `다시`를 붙이지 않는다.
   */
  const failure = (again: boolean) =>
    r.error ? (
      <LoadFailed
        testID="report-load-failed"
        retryTestID="report-load-retry"
        what="기록"
        message={r.error}
        retrying={retrying}
        again={again}
        onRetry={() => void r.reload()}
      />
    ) : null;

  /*
    첫 조회 중에는 지표도 빈 상태도 그리지 않고 한 줄만 둔다. 문장은 학부모 홈과 같다
    (`app/parent/index.tsx`) — 두 탭이 같은 자녀에 대해 다른 말을 하지 않게.
    게이트는 `loaded`에 건다: 재조회마다 리포트가 사라지면 그것이 D-168이 고친 결함이다.
  */
  if (!r.loaded) {
    return (
      <AppText variant="caption" tone="secondary">
        기록을 불러오고 있어요.
      </AppText>
    );
  }

  /*
    손에 아무것도 없을 때. **못 읽은 것과 없는 것은 다르다** — 실패했으면 개수를 세지 않고
    `없어요`도 말하지 않는다(D-136). 그 자리에는 실패 문장과 다시 시도할 행동만 둔다.
  */
  if (nothing) {
    return (
      failure(false) ?? (
        <Group>
          <View style={{ padding: spacing.lg, gap: spacing.xs }}>
            <AppText variant="label">아직 학습 기록이 없어요</AppText>
            <AppText variant="caption" tone="secondary">
              자녀가 학습을 제출하면 달마다 리포트가 하나씩 쌓여요.
            </AppText>
          </View>
        </Group>
      )
    );
  }

  return (
    <View style={{ gap: isMobile ? spacing.lg : spacing.xl }}>
      {/*
        실패했지만 손에 기록이 있을 때. **이미 읽어 둔 값은 지우지 않는다**(D-136) —
        마지막으로 성공한 조회가 준 리포트는 여전히 사실이고, 실패했다는 사실만 위에 밝힌다.
      */}
      {failure(true)}

      {/* ① 달과 무관한 '지금' 상태. 없으면 그리지 않는다. */}
      {r.pending.length > 0 ? (
        <Section title={`아직 안 낸 학원 과제 ${r.pending.length}개`}>
          <Group>
            {r.pending.map((p) => (
              <Row
                key={p.id}
                testID={`report-pending-${p.id}`}
                title={p.title}
                subtitle={p.due?.text ?? "마감일 없음"}
                leading={<SourceTag source="academy" />}
              />
            ))}
          </Group>
        </Section>
      ) : null}

      {/* 칭찬은 달과 무관한 행동이라 요약 안에 두지 않는다. 지난달 리포트에서도 보낼 수 있다. */}
      <Praise child={child} />

      {/*
        ② 이번 주 요약. **리포트에서 가장 먼저 읽는 것**이라 위에 둔다.
        이번 달을 볼 때만 둔다 — 지난달 리포트에 '이번 주'를 두면 뜻이 어긋난다.
      */}
      {r.month === monthOf(today) ? (
        <WeekSummary
          child={child}
          week={r.week}
          prev={r.prevWeek}
          areas={r.weekAreas}
          overdue={r.now.overdue}
        />
      ) : null}

      {/* ③ 어느 달을 보는지 고른다. 왼쪽이 과거, 오른쪽이 미래다. */}
      <MonthNav
        months={r.months}
        month={r.month}
        label={r.label}
        today={today}
        onChange={pickMonth}
      />

      {totals.count === 0 ? (
        <Group>
          <View style={{ padding: spacing.lg, gap: spacing.xs }}>
            <AppText tone="secondary">{r.label}에는 푼 학습이 없어요.</AppText>
            {/*
              리포트는 늘 이번 달로 연다(D-090). 그래서 달이 막 바뀐 날에는 이 자리가 비는데,
              화살표만 두면 학부모가 "기록이 사라졌나" 하고 읽는다. 기록이 남아 있는 달과
              거기로 가는 길을 한 번 누르기로 준다.
            */}
            <AppText variant="caption" tone="tertiary">
              {jumpTo
                ? `${monthLabel(jumpTo, today)}까지의 기록은 그대로 있어요.`
                : "다른 달을 골라 지난 기록을 볼 수 있어요."}
            </AppText>
            {/*
              여기서 갈 수 있는 곳을 한 줄에 모은다. 둘 다 이 화면의 행동이라 터치 하한(44)을
              지킨다 — `sm`(32)은 섹션 제목 옆 전용이다(§10).
            */}
            {jumpTo || canOpenDetail ? (
              <View style={styles.emptyActions}>
                {jumpTo ? (
                  <Button
                    testID="report-latest-month"
                    variant="secondary"
                    tone="accent"
                    hug
                    label={`${monthLabel(jumpTo, today)} 리포트 보기`}
                    onPress={() => pickMonth(jumpTo)}
                  />
                ) : null}
                {/* 푼 학습이 없어도 배정·오답이 있으면 상세가 말할 것이 있다. */}
                {canOpenDetail ? detailLink("md") : null}
              </View>
            ) : null}
          </View>
        </Group>
      ) : (
        <>
          {/* ③ 이 달을 한 문장으로. */}
          <Section title={`${r.label} 학습`} action={detailLink("sm")}>
            <AppText tone="secondary">
              {r.label} 한 달 동안 {totals.days}일 공부하고 {totals.questions}
              문항을 풀었어요.
            </AppText>
            <Group>
              <Metric
                testID="metric-days"
                label="공부한 날"
                value={`${totals.days}일`}
                note={delta(totals.days, prev?.days, "일")}
              />
              <Metric
                testID="metric-time"
                label="학습 시간"
                value={formatDuration(totals.timeSec)}
                note={
                  prev ? `지난달 ${formatDuration(prev.timeSec)}` : undefined
                }
              />
            </Group>
            {r.undated > 0 ? (
              <AppText variant="caption" tone="secondary">
                학원에서 받은 제출 기록 {r.undated}건은 날짜가 남아 있지 않아
                어느 달에도 세지 않았어요.
              </AppText>
            ) : null}
          </Section>

          {/*
            ④ 학원 과제. **반 비교는 여기에만 둔다** — 또래 집단이 실제로 있는 곳이다.
            소속이 없는 자녀에게는 이 섹션을 그리지 않는다(D-031·D-042와 같은 규칙).
          */}
          {hasAcademy ? (
            <Section title={`${r.label} 학원 과제`}>
              <Group>
                {academySubmit.assigned > 0 ? (
                  <Metric
                    testID="metric-submit"
                    label="낸 과제"
                    value={`${academySubmit.submitted}/${academySubmit.assigned}`}
                    note={
                      academySubmit.submitted < academySubmit.assigned
                        ? `안 낸 과제 ${academySubmit.assigned - academySubmit.submitted}개`
                        : "모두 냈어요"
                    }
                  />
                ) : null}
                {bySource.academy.accuracy != null ? (
                  <Metric
                    testID="metric-academy-rate"
                    label="정답률"
                    value={`${bySource.academy.accuracy}%`}
                    note={
                      academyCompare
                        ? `반 평균 ${academyCompare.classAvg}%`
                        : `${bySource.academy.questions}문항`
                    }
                  />
                ) : null}
                {academyCompare ? (
                  <Metric
                    testID="metric-class"
                    label="반 평균보다 높은 과제"
                    value={`${academyCompare.beatAvg}/${academyCompare.total}`}
                    note={`비교한 과제 ${academyCompare.total}개`}
                  />
                ) : null}
              </Group>
              {academySubmit.noDueDate > 0 ? (
                <AppText variant="caption" tone="secondary">
                  마감일이 없는 배정 {academySubmit.noDueDate}개는 어느 달에도
                  세지 않았어요.
                </AppText>
              ) : null}
              {!academyCompare && bySource.academy.count > 0 ? (
                <AppText variant="caption" tone="secondary">
                  {r.rows.some((x) => x.source === "academy" && x.cls === null)
                    ? `반에서 낸 학생이 ${RANK_MIN_SUBMITTERS}명보다 적어 반 비교는 보여 주지 않아요.`
                    : "반 비교를 계산할 제출 기록이 아직 없어요."}
                </AppText>
              ) : null}
            </Section>
          ) : null}

          {/* ⑤ 개인 학습. 또래가 없으니 자기 지난달과만 비교한다. */}
          {bySource.personal.count > 0 ? (
            <Section title={`${r.label} 개인 학습`}>
              <Group>
                <Metric
                  testID="metric-personal-count"
                  label="푼 학습"
                  value={`${bySource.personal.count}개`}
                  note={`${bySource.personal.questions}문항 · ${bySource.personal.days}일`}
                />
                {bySource.personal.accuracy != null ? (
                  <Metric
                    testID="metric-personal-rate"
                    label="정답률"
                    value={`${bySource.personal.accuracy}%`}
                    note={`${bySource.personal.questions}문항 · 또래 비교는 두지 않아요`}
                  />
                ) : null}
              </Group>
            </Section>
          ) : null}
        </>
      )}

      {/* ⑥ 틀린 걸 다시 봤나. 담은 오답은 하나씩 넘겨 다 볼 수 있다. */}
      <Section title={`${r.label} 오답노트`}>
        {notes.added === 0 ? (
          <Group>
            <View style={{ padding: spacing.lg, gap: spacing.xs }}>
              <AppText tone="secondary">
                {r.label}에 담아 둔 오답이 없어요.
              </AppText>
              <AppText variant="caption" tone="tertiary">
                지금까지 담긴 오답은 모두 {notes.total}개예요.
              </AppText>
            </View>
          </Group>
        ) : (
          <>
            {/*
              이 세 값은 바로 아래 목록의 개수를 세는 것이라 지난달 비교가 붙지 않는다.
              목록 행으로 만들면 201px을 쓰는데 한 줄이면 20px이다.
            */}
            <AppText variant="label" testID="report-notes">
              담은 오답 {notes.added}개 · AI와 정리 {notes.organized}개 · 별표{" "}
              {notes.starred}개
            </AppText>
            {notes.total > 0 ? (
              <AppText variant="caption" tone="tertiary">
                지금까지 담긴 오답은 모두 {notes.total}개예요.
              </AppText>
            ) : null}
            {note ? (
              <Group>
                <View style={styles.note}>
                  <View style={styles.noteHead}>
                    <SourceTag source={note.source} />
                    {note.starred ? (
                      <Icon name="star" size={14} color={colors.accent} />
                    ) : null}
                  </View>
                  <AppText variant="label">{note.prompt}</AppText>
                  <AppText variant="caption" tone="tertiary">
                    {note.area} · {note.title}
                    {note.createdAt ? ` · ${formatDate(note.createdAt)}` : ""}
                  </AppText>
                  <AppText variant="caption" style={{ color: colors.success }}>
                    정답 · {note.choices[note.answerIndex]}
                  </AppText>
                  {note.dig ? (
                    <NoteMemo text={note.dig} />
                  ) : (
                    <AppText variant="caption" tone="tertiary">
                      아직 메모를 정리하지 않았어요.
                    </AppText>
                  )}
                </View>
              </Group>
            ) : null}
            {/* 한 개만 보여 주고 끝내지 않는다. 담은 만큼 다 넘겨 볼 수 있다. */}
            {r.monthNotes.length > 1 ? (
              <Pager
                testID="note-pager"
                total={r.monthNotes.length}
                page={notePage}
                pageSize={1}
                unit="개"
                onChange={setNotePage}
              />
            ) : null}
          </>
        )}
      </Section>

      {/* ⑦ 어디가 약한가(이 달). 문항 수를 함께 적는다. */}
      {r.byArea.length > 0 ? (
        <Section title="영역별 정답률">
          <AppText variant="caption" tone="secondary">
            학원 과제와 개인 학습을 합쳐 셌어요. 문항 {WEAK_MIN_QUESTIONS}개부터
            약한 영역으로 봐요.
          </AppText>
          {/*
            뺀 것을 밝힌다. 학원이 학생에게 공개하지 않은 세트는 학부모의 조회에서 영역이
            비어 오고(`content_sets_select`에 학부모 절이 없다), 그대로 세면 이름 없는 막대가
            하나 선다. 빼는 쪽을 골랐으니 몇 개를 뺐는지는 말해야 한다.
          */}
          {r.unknownArea > 0 ? (
            <AppText variant="caption" tone="secondary" testID="area-unknown">
              학원이 공개하지 않은 학습 {r.unknownArea}개는 영역을 알 수 없어
              빼고 셌어요.
            </AppText>
          ) : null}
          {weakest ? (
            <AppText variant="caption" tone="secondary">
              {!weakest.enough
                ? `${weakest.area}${subjectParticle(weakest.area)} ${weakest.rate}%로 가장 낮지만, ${weakest.total}문항이라 아직 판단하기 일러요.`
                : weakest.rate < WEAK_THRESHOLD
                  ? `${weakest.area}${subjectParticle(weakest.area)} ${weakest.total}문항에서 ${weakest.rate}%로 가장 약해요.`
                  : `가장 낮은 영역이 ${weakest.area} ${weakest.rate}%예요.`}
            </AppText>
          ) : null}
          {/*
            좁은 화면에서는 트랙이 남지 않아 두 줄로 쌓인다 — 어디서 쌓을지는 `BarRow`가
            컬럼 폭으로 판단한다(D-099). 손으로 쌓아 두면 넓은 화면에서도 계속 쌓인다.
          */}
          <View style={{ gap: spacing.md }}>
            {r.byArea.map((a) => (
              <BarRow
                key={a.area}
                label={a.area}
                value={a.rate}
                note={`${a.rate}% · ${a.total}문항`}
              />
            ))}
          </View>
        </Section>
      ) : null}

      {/* ⑧ 근거. 이 달에 푼 학습. 학원 과제 행에는 반 순위가 붙는다. */}
      {r.rows.length > 0 ? (
        <Section
          title={`${r.label} 학습 기록`}
          action={
            r.rows.length > PREVIEW ? (
              <Button
                testID="report-more"
                variant="secondary"
                size="sm"
                tone="accent"
                hug
                label={
                  showAll ? "접기" : `${r.rows.length - PREVIEW}개 더 보기`
                }
                onPress={() => setShowAll((v) => !v)}
              />
            ) : null
          }
        >
          {/*
            **누를 수 있다는 사실을 문장으로 남긴다.** 이 줄의 `trailing`은 재풀이 토글이라
            chevron을 둘 수 없어서(§8 — 둘을 함께 두면 chevron이 버튼 왼쪽으로 밀린다),
            누를 수 있는 행과 없는 행이 화면에서 완전히 같은 모양이었다. 문항별 내역으로 가는
            길은 레포에서 이 행뿐이라 발견되지 않으면 그 화면이 없는 것과 같다(§14-1과 같은 규칙 —
            색·기호만으로 뜻을 전하지 않고 문장으로 이유를 남긴다).
          */}
          {visible.some((a) => a.hasDetail) ? (
            <AppText variant="caption" tone="secondary">
              줄을 누르면 문항별로 볼 수 있어요.
            </AppText>
          ) : null}
          <Group>
            {visible.map((a) => {
              /*
                정답률을 `meta`가 아니라 이 줄 맨 앞에 둔다. `leading`+`meta`+버튼을 함께 두면
                390에서 본문이 109px로 눌려 제목이 두 줄로 접힌다(실측). `meta`를 비우면 185px이 된다.
              */
              const bits = [
                `정답률 ${a.accuracy}%`,
                a.area,
                `${a.questions}문항`,
                a.dateISO ? formatDate(a.dateISO) : "제출일 기록 없음",
                // 반 비교는 실제 제출 기록에서 계산된다. 없으면 말하지 않는다.
                a.cls ? `반 ${a.cls.submitters}명 중 ${a.cls.rank}번째` : null,
                /*
                  누를 수 없는 행은 그 이유를 말한다. 문구는 그 화면이 같은 사실을 말할 때
                  쓰는 것과 같다(`app/parent/attempt.tsx`) — 같은 사실이 두 문장이 되지 않게.
                */
                a.hasDetail ? null : "문항 내역이 남아 있지 않아요",
              ].filter(Boolean) as string[];
              return (
                <Row
                  key={a.itemId}
                  testID={`report-item-${a.itemId}`}
                  title={a.title}
                  subtitle={bits.join(" · ")}
                  leading={<SourceTag source={a.source} />}
                  onPress={a.hasDetail ? () => openDetail(a.itemId) : undefined}
                  trailing={
                    <RetryToggle
                      itemId={a.itemId}
                      done={requested.includes(a.itemId)}
                      onPress={() => void askRetry(a.itemId)}
                    />
                  }
                />
              );
            })}
          </Group>
          <AppText variant="caption" tone="secondary">
            요청해도 지금 기록은 지워지지 않아요. 자녀가 다시 풀면 새 결과로
            바뀌어요.
          </AppText>
        </Section>
      ) : null}

      {/* ⑨ 달마다 어떻게 변했나. 누적이 아니라 달끼리 비교한다. */}
      <MonthHistory
        history={r.history}
        today={today}
        current={r.month}
        onPick={pickMonth}
      />
    </View>
  );
}

/**
 * 이번 주 요약. 학부모가 리포트를 열고 가장 먼저 읽는 덩어리다.
 *
 * **한 번 만들면 그 주 내내 같은 문장이 보인다** — 볼 때마다 바뀌면 무엇을 믿어야 할지 알 수 없다.
 * AI에게는 이미 계산된 숫자만 넘긴다(`weekFacts`). 키가 없으면 같은 숫자로 만든 대체 문장을 쓴다.
 */
function WeekSummary({
  child,
  week,
  prev,
  areas,
  overdue,
}: {
  child: Account;
  week: WeekStat;
  prev: WeekStat | null;
  areas: readonly { area: string; rate: number; total: number }[];
  overdue: number;
}) {
  const { weekSummaryOf, setWeekSummary } = useProgress();
  const { show } = useToast();
  const { readOnly } = useSession();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const saved = weekSummaryOf(child.userId, week.monday);
  const nothing = week.count === 0;

  async function make() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    /*
      **`busy`는 `finally`에서 되돌린다.** AI 호출이 예외로 끝나면(스트림이 끊기거나 설정이
      없으면) `busy`가 켜진 채 남아 `요약하기` 버튼이 화면을 나갈 때까지 꺼져 있었다.
    */
    try {
      /*
        **AI가 실패하면 그 문장을 저장하지 않는다.** `askScodyAI`는 실패도 문장으로 돌려주므로
        그대로 저장하면 `Scody AI 호출 실패 (HTTP 402)…`가 그 주 내내 리포트 맨 위에 남는다.
        실패하면 같은 숫자로 만든 대체 문장을 쓰고 그 사실을 화면에 밝힌다.
      */
      let r: { ok: boolean; text: string };
      try {
        r = await askScodyAIResult(
          SCODY_PARENT_WEEK_SYSTEM,
          weekFacts(child.name, week, prev, areas, overdue),
        );
      } catch {
        // 예외도 실패로 다룬다 — 아래에서 같은 숫자로 만든 대체 문장을 쓴다.
        r = { ok: false, text: "" };
      }
      const byAI = r.ok;
      const text = byAI ? tidySummary(r.text) : weekFallback(week, prev);
      /*
        **저장을 기다린다.** 예전에는 기다리지 않고 곧바로 알려서, 저장이 거부되면 화면은
        `요약을 만들었어요`라고 말하는데 요약 블록은 여전히 `요약하기` 버튼 상태였다.
        `busy`도 저장이 끝날 때까지 켜 둔다 — 그 사이가 곧 저장하는 시간이다.
      */
      const saved = await setWeekSummary(child.userId, week.monday, text, byAI);
      setFailed(!byAI && hasOpenRouterKey());
      // 대리 보기에서는 저장이 거부된다(D-071). 만들지 못한 것을 만들었다고 하지 않는다.
      if (readOnly) return;
      if (!saved.ok) {
        show(saved.error ?? "요약을 저장하지 못했어요", "removed");
        return;
      }
      show(byAI ? "이번 주 요약을 만들었어요" : "숫자로 요약을 만들었어요");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="이번 주 요약">
      {nothing ? (
        // 리포트의 첫 블록이라 카드로 두면 '아무것도 안 했다'가 화면에서 가장 무거워진다.
        <AppText variant="caption" tone="secondary">
          이번 주({formatDate(week.monday)}부터)에는 아직 기록이 없어요. 이 달
          전체는 아래에서 볼 수 있어요.
        </AppText>
      ) : saved ? (
        <>
          <Group>
            <View style={styles.summary}>
              <RichText text={saved.text} />
            </View>
          </Group>
          <AppText variant="caption" tone="secondary">
            {formatDate(saved.at)}에 만든 요약이에요
            {saved.byAI ? "" : " · AI 없이 숫자만 이어 붙였어요"}
          </AppText>
          {failed ? (
            <AppText variant="caption" tone="secondary">
              AI 요약을 만들지 못해 숫자로 대신했어요. 잠시 뒤 다시 시도해 볼 수
              있어요.
            </AppText>
          ) : null}
          {/*
            **라벨을 고정한다.** 예전에는 `busy ? '만들고 있어요' : '다시 요약하기'`였는데,
            상태를 버튼 이름 자리에 넣으면 버튼인지 안내인지 알 수 없다(§8) — 바로 아래
            블록의 주석이 같은 규칙을 이미 적어 두고 있었다. 진행은 캡션이 맡는다.
            그리고 작업 중에는 **누를 수 없게 한다** — 예전에는 눌렸지만 `make`가 첫 줄에서
            되돌아가는 죽은 버튼이었다(§8 `눌러도 아무 일이 없는 버튼을 두지 않는다`).
          */}
          <Button
            testID="week-summary-again"
            variant="secondary"
            size="sm"
            tone="accent"
            hug
            label="다시 요약하기"
            leading={<Icon name="refresh-cw" size={14} color={colors.accent} />}
            onPress={busy ? undefined : make}
          />
          {busy ? <WeekSummaryPending /> : null}
        </>
      ) : (
        <>
          <Button
            testID="week-summary"
            hug
            label="이번 주 자녀 학습 요약하기"
            onPress={busy ? undefined : make}
          />
          {/* 상태를 버튼 라벨에 넣지 않는다(§8). 진행은 한 줄로 알린다. */}
          {busy ? <WeekSummaryPending /> : null}
        </>
      )}
    </Section>
  );
}

/**
 * 칭찬 보내기. 종류를 **자녀가 실제로 한 일**로 좁혔다 —
 * `대단해요`처럼 근거 없는 칭찬을 만들면 자녀에게도 뜻이 없다.
 * 보낸 것은 자녀 홈 맨 위에 한 줄로 뜨고, 자녀가 확인해 닫을 수 있다.
 */
function Praise({ child }: { child: Account }) {
  const { praiseFor, sendPraise } = useProgress();
  const { show } = useToast();
  const { readOnly } = useSession();
  const [open, setOpen] = useState(false);
  const sent = praiseFor(child.userId);
  const week = weekOf(todayISO());
  const thisWeek = sent.filter((p) => weekOf(p.at) === week);

  /**
   * 칭찬 하나를 보낸다. 고르는 줄은 곧바로 닫고(고른 것이 확실하다),
   * **보냈다는 말은 서버가 받아 준 뒤에** 한다 — 먼저 알리면 자녀 화면에 아무것도 가지 않아도
   * 학부모는 보냈다고 믿는다.
   */
  async function send(kind: PraiseKind) {
    setOpen(false);
    const res = await sendPraise(child.userId, kind);
    // 대리 보기에서는 보내지지 않는다(D-071).
    if (readOnly) return;
    if (!res.ok) {
      show(res.error ?? "칭찬을 보내지 못했어요", "removed");
      return;
    }
    show("칭찬을 보냈어요");
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {thisWeek.length > 0 ? (
        <AppText variant="caption" tone="accent" testID="praise-sent">
          이번 주에 보낸 칭찬 ·{" "}
          {Array.from(new Set(thisWeek.map((p) => PRAISE_LABEL[p.kind]))).join(
            " · ",
          )}
        </AppText>
      ) : null}
      {open ? (
        <>
          {/*
            **펼치면 제목이 사라진다** — 접힌 상태에서는 버튼 라벨(`칭찬 보내기`)이 곧 제목인데,
            펼치면 그 버튼이 없어져 선택지 넷만 남는다(실측 390: 화면에 무엇에 대한 고르기인지
            말하는 글자가 0개였다). 그리고 이 고르기는 **한 번 누르면 자녀에게 가고 되돌릴 수
            없다**(A-045). 두 사실을 한 줄로 말한다.
          */}
          <AppText variant="caption" tone="secondary" testID="praise-hint">
            고르면 자녀 홈에 바로 떠요. 보낸 뒤에는 지울 수 없어요.
          </AppText>
          <View style={styles.praiseRow}>
            {/*
            **한 번 누르면 되돌릴 수 없는 쓰기가 자녀에게 간다.** 그래서 기본 크기(44)를 쓴다 —
            `sm`(32)은 섹션 제목 옆 전용이고 터치 하한은 44다(§10, 예외는 `SegmentedControl` 하나).
          */}
            {(Object.keys(PRAISE_LABEL) as PraiseKind[]).map((kind) => (
              <Button
                key={kind}
                testID={`praise-${kind}`}
                variant="secondary"
                tone="accent"
                hug
                label={PRAISE_LABEL[kind]}
                onPress={() => void send(kind)}
              />
            ))}
            {/*
            마음이 바뀌면 나갈 길을 둔다 — 유일한 출구가 되돌릴 수 없는 쓰기이면 안 된다.
            **선택지 뒤에 둔다**(§8 ③) — 취소가 고를 것보다 앞에 오면 먼저 읽히고, 손가락도
            고르려던 자리에서 한 칸 밀린다.
          */}
            <Button
              testID="praise-close"
              variant="ghost"
              hug
              label="닫기"
              onPress={() => setOpen(false)}
            />
          </View>
        </>
      ) : (
        <Button
          testID="praise-open"
          variant="secondary"
          size="sm"
          tone="accent"
          hug
          label="칭찬 보내기"
          leading={<Icon name="star" size={15} color={colors.accent} />}
          onPress={() => setOpen(true)}
        />
      )}
    </View>
  );
}

/**
 * 달 이동. **왼쪽이 과거, 오른쪽이 미래**다 — 방향이 곧 시간이라 순서를 외울 것이 없다.
 *
 * 칩을 늘어놓지 않는 이유: 리포트는 달마다 하나씩 쌓여 5년이면 60개가 된다. 칩은 그 규모에서
 * 무너지고, 최신순으로 늘어놓으면 `7월` 오른쪽에 `6월`이 와서 시간 흐름과 반대가 된다.
 * 드롭다운도 쓰지 않는다 — 모바일에서 드롭다운은 조작이 느리고 오류가 늘어난다(리서치).
 * 학부모가 가장 많이 하는 일은 "지난달 보기"이고 그것이 한 번 누르기가 된다.
 *
 * 특정 달로 바로 가는 길은 아래 `달마다 어떻게 변했나`가 맡는다(그쪽도 오래된 달이 위).
 */
function MonthNav({
  months,
  month,
  label,
  today,
  onChange,
}: {
  months: readonly string[];
  month: string;
  label: string;
  today: string;
  onChange: (m: string) => void;
}) {
  // 오래된 것부터. 기록이 있는 달만 담겨 있어 빈 달로 이동하지 않는다.
  const ordered = [...months].sort();
  const at = ordered.indexOf(month);
  const older = at > 0 ? ordered[at - 1] : undefined;
  const newer =
    at >= 0 && at < ordered.length - 1 ? ordered[at + 1] : undefined;
  return (
    <View style={styles.monthNav}>
      <MonthStep
        testID="month-prev"
        icon="chevron-left"
        name={older ? monthLabel(older, today) : undefined}
        offName="더 이전 기록이 없어요"
        onPress={() => older && onChange(older)}
      />
      <AppText
        variant="subheading"
        testID="month-label"
        style={styles.monthLabel}
      >
        {label}
      </AppText>
      <MonthStep
        testID="month-next"
        icon="chevron-right"
        name={newer ? monthLabel(newer, today) : undefined}
        offName="더 최근 기록이 없어요"
        onPress={() => newer && onChange(newer)}
      />
    </View>
  );
}

/**
 * 달 이동 버튼 하나. 갈 곳이 없으면 눌리지 않는다.
 *
 * **막힌 상태에도 이름이 있어야 한다**(§11) — 예전에는 `accessibilityLabel`이 `undefined`가 되어
 * 스크린리더가 `버튼`이라고만 읽었다. 갈 곳이 없다는 사실을 그 자리에서 말한다.
 * 그리고 **불투명도로 흐리지 않는다**(§3) — `opacity`는 대비를 그만큼 곱해 버리므로
 * 상태는 색 토큰으로만 표현한다.
 */
function MonthStep({
  testID,
  icon,
  name,
  offName,
  onPress,
}: {
  testID: string;
  icon: "chevron-left" | "chevron-right";
  name?: string;
  /** 갈 곳이 없을 때 읽히는 이름. 방향마다 다른 사실이라 호출부가 준다. */
  offName: string;
  onPress: () => void;
}) {
  const off = !name;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={name ? `${name} 리포트 보기` : offName}
      disabled={off}
      onPress={onPress}
      style={styles.monthStep}
    >
      <Icon
        name={icon}
        size={18}
        color={off ? colors.inkTertiary : colors.ink}
      />
    </Pressable>
  );
}

/**
 * 최근 몇 달의 공부한 날 수. 막대 하나가 한 달이다.
 * 누적 그래프를 그리지 않는다 — 학부모가 보려는 것은 "요즘 어떤가"이지 평생 합계가 아니다.
 */
function MonthHistory({
  history,
  today,
  current,
  onPick,
}: {
  history: MonthStat[];
  today: string;
  current: string;
  onPick: (m: string) => void;
}) {
  const shown = history.filter((h) => h.count > 0);
  if (shown.length < 2) return null;
  const max = Math.max(...history.map((h) => h.days), 1);
  return (
    <Section title="달마다 어떻게 변했나">
      <AppText variant="caption" tone="secondary">
        공부한 날 수예요. 달을 누르면 그 달 리포트를 봐요.
      </AppText>
      <View style={{ gap: spacing.sm }}>
        {history.map((h) => (
          <Pressable
            key={h.month}
            testID={`history-${h.month}`}
            accessibilityRole="button"
            accessibilityLabel={`${monthLabel(h.month, today)} 리포트 보기`}
            disabled={h.count === 0}
            onPress={() => onPick(h.month)}
            style={({ pressed }) => [
              styles.histRow,
              pressed && { backgroundColor: colors.hover },
            ]}
          >
            <AppText
              variant="caption"
              tone={h.month === current ? "accent" : "secondary"}
              style={styles.histLabel}
            >
              {monthLabel(h.month, today)}
            </AppText>
            <View style={styles.histBar}>
              <ProgressBar value={(h.days / max) * 100} />
            </View>
            <AppText variant="caption" tone="tertiary" style={styles.histVal}>
              {h.count === 0 ? "—" : `${h.days}일`}
            </AppText>
          </Pressable>
        ))}
      </View>
    </Section>
  );
}

/**
 * 다시 풀게 하기. 목록 행에 두므로 아이콘 하나로 좁힌다 —
 * 라벨을 그대로 두면 390에서 출처 태그·정답률과 함께 본문을 한 글자 폭까지 밀어낸다.
 * 결과 화면의 담기 토글과 같은 모양이고, 이름은 `accessibilityLabel`이 지킨다.
 */
function RetryToggle({
  itemId,
  done,
  onPress,
}: {
  itemId: string;
  done: boolean;
  onPress: () => void;
}) {
  return (
    <IconButton
      testID={`retry-${itemId}`}
      variant="outlined"
      name={done ? "check" : "refresh-cw"}
      active={done}
      label={done ? "다시 풀기를 요청했어요" : "다시 풀게 하기"}
      onPress={done ? undefined : onPress}
    />
  );
}

/**
 * 자녀가 AI와 정리한 메모. 대화가 길면 요약도 길어져 리포트가 메모로 덮인다(A-030).
 * 서식이 있는 글이라 `RichText`로 그리고, 길면 접어 둔다.
 */
function NoteMemo({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const { isMobile } = useResponsive();
  // 390의 노트 내부 폭은 324px이라 한글 120자가 6줄이 된다. 좁은 화면에서는 더 일찍 접는다.
  const limit = isMobile ? 70 : 120;
  const long = text.length > limit;
  const shown = open || !long ? text : `${text.slice(0, limit)}…`;
  return (
    <View style={{ gap: 2, marginTop: 2 }}>
      <AppText variant="caption" tone="accent">
        자녀가 정리한 메모
      </AppText>
      <RichText text={shown} />
      {long ? (
        <Button
          variant="ghost"
          size="sm"
          tone="accent"
          hug
          label={open ? "접기" : "더 보기"}
          leading={
            <Icon
              name={open ? "arrow-up" : "arrow-down"}
              size={14}
              color={colors.accent}
            />
          }
          onPress={() => setOpen((v) => !v)}
        />
      ) : null}
    </View>
  );
}

/**
 * 주간 요약을 만드는 동안. 몇 초 걸리는 유일한 학부모 화면 동작이라 진행을 남긴다.
 * 두 분기(처음 만들기·다시 만들기)가 **같은 문구**를 써야 한다 — 갈리면 같은 일이
 * 다른 일처럼 보인다.
 */
function WeekSummaryPending() {
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
    >
      <AppText variant="caption" tone="secondary">
        요약을 만들고 있어요. 잠시만 기다려 주세요.
      </AppText>
      {/* 상태는 위 글자가 말한다. 이건 '멈춘 게 아니다'만 거든다. */}
      <MotionAsset name="pending" testID="week-summary-pending-motion" />
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { padding: spacing.lg },
  praiseRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  /* 빈 달에서 갈 수 있는 곳. 390에서 라벨이 길어지면 아래로 접힌다. */
  emptyActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthLabel: { flex: 1, textAlign: "center" },
  /**
   * 화살표만 남긴다 — 테두리를 두르면 버튼 두 개가 달 이름보다 무거워진다.
   * 보이는 것은 `<`·`>`뿐이지만 누름 영역은 44px을 지킨다(DESIGN.md §10).
   */
  monthStep: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  // 카드가 아니라 Group 안의 한 칸. 테두리는 Group이 긋는다.
  note: { padding: spacing.lg, gap: 3 },
  noteHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  /* 눌러서 그 달로 가는 진짜 내비게이션이다. 32px에 배경도 없어 버튼으로 안 보였다. */
  histRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: touch.min,
    paddingHorizontal: spacing.sm,
    marginHorizontal: -spacing.sm,
    borderRadius: radius.md,
  },
  histLabel: { width: 64 },
  histBar: { flex: 1 },
  histVal: { width: 40, textAlign: "right" },
});
