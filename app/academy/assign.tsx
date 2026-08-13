import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActionBar,
  Screen,
  Section,
  Group,
  Row,
  Button,
  Field,
  SegmentedControl,
  Pager,
  AppText,
  Icon,
  type SegmentedOption,
} from '@/components';
import { useCurrentAccount } from '@/session';
import { useAcademyStaff } from '@/features/academy';
import { useProgress } from '@/features/progress';
import { useContent } from '@/features/content';
import { useToast } from '@/features/toast';
import { dayAfter, dueLabel, formatDate, parseDueDate } from '@/features/learning';
import { todayISO } from '@/features/clock';
import {
  AREAS,
  GRADES,
  gradeLabel,
  topicsFor,
  type AcademyClass,
  type ContentSet,
  type Grade,
  type KoreanArea,
} from '@/data';
import { colors, spacing } from '@/theme/tokens';

const KIND_LABEL = { passage: '지문형', grammar: '문법형' } as const;

/** 반 122개·학생 3천 명 규모에서도 한 화면에 쏟지 않는다(마스터 플랜 4절). */
const CLASS_PAGE = 10;
const CONTENT_PAGE = 10;

type GradeFilter = 'all' | '1' | '2' | '3' | 'none';
/** 콘텐츠 출처. 값이 그대로 testID가 되므로 라틴 문자로 둔다. */
type OwnerFilter = 'all' | 'ours' | 'scody';
type DueQuick = 'today' | 'tomorrow' | 'friday' | 'none' | 'custom';

/**
 * 학습 배정: **반 → 학습 → 확인** 세 단계.
 *
 * 단계는 URL 쿼리(`?class=&grade=&area=&topic=&content=`)에 남긴다. 단계마다 히스토리가
 * 쌓이므로 좌상단 뒤로가기가 그대로 '한 단계 뒤로'가 되고, 별도 `다시 고르기` 버튼을
 * 두지 않는다(D-039와 같은 근거). 첫 단계는 학원 탭의 시작점이라 뒤로가기를 두지 않는다.
 * 정한 마감일도 쿼리(`&due=`)로 넘긴다 — 단계를 옮기면 화면 상태가 다시 만들어지므로,
 * 배정을 되돌렸을 때 적어 둔 날짜가 사라지지 않게 한다.
 *
 * 반과 학습을 미리 골라 두지 않는다 — 구경하다 `배정하기`를 누르면 반 전원에게 과제가
 * 바로 나간다(D-046). 무엇을 누구에게 언제까지 내는지는 확인 단계가 문장으로 말하고,
 * 배정 뒤에도 `방금 배정한 것 되돌리기`를 화면에 남긴다(D-033 — 사라지는 토스트에 두면
 * 되돌릴 기회도 함께 사라진다).
 *
 * 다른 화면에서 문맥을 실어 보낼 수 있다: `?class=c_kor1`이면 그 반이, `?content=ct_x`면
 * 그 학습이 골라진 상태로 시작한다.
 */
export default function AcademyAssign() {
  const router = useRouter();
  const account = useCurrentAccount();
  const { addAssignment, removeAssignment, assignments } = useProgress();
  // 반 목록은 fixture가 아니라 살아 있는 값이다 — 원장이 방금 만든 반에도 배정할 수 있다(D-063).
  const { classesFor } = useAcademyStaff();
  const { sets: allSets } = useContent();
  const { show } = useToast();
  const params = useLocalSearchParams<{
    class?: string;
    grade?: string;
    area?: string;
    topic?: string;
    content?: string;
    due?: string;
    assigned?: string;
  }>();

  const isDirector = account.academyRole === 'director';
  const classes = classesFor(account);
  // 운영자 공개 콘텐츠 + 우리 학원이 등록한 콘텐츠만 배정할 수 있다(D-012).
  const sets = useMemo(
    () => allSets.filter((s) => !s.ownerAcademyName || s.ownerAcademyName === account.academyName),
    [allSets, account.academyName],
  );

  const [classQuery, setClassQuery] = useState('');
  const [classGrade, setClassGrade] = useState<GradeFilter>('all');
  const [classPage, setClassPage] = useState(0);
  const [titleQuery, setTitleQuery] = useState('');
  const [owner, setOwner] = useState<OwnerFilter>('all');
  const [contentPage, setContentPage] = useState(0);
  const [due, setDue] = useState(params.due ?? '');
  const [error, setError] = useState<string | null>(null);

  const today = todayISO();

  /** 지금 단계. 모두 쿼리에서 읽는다 — 뒤로가기·직접 URL 진입이 같은 결과를 낸다. */
  const cls = params.class ? classes.find((c) => c.id === params.class) : undefined;
  const grade = params.grade ? (Number(params.grade) as Grade) : undefined;
  const area = params.area as KoreanArea | undefined;
  const topic = params.topic;
  const content = params.content ? sets.find((s) => s.id === params.content) : undefined;
  const assigned = params.assigned ? assignments.find((a) => a.id === params.assigned) : undefined;

  const hrefFor = (next: {
    class?: string;
    grade?: Grade;
    area?: KoreanArea;
    topic?: string;
    content?: string;
    due?: string;
    assigned?: string;
  }) => {
    const q = new URLSearchParams();
    if (next.class) q.set('class', next.class);
    if (next.grade) q.set('grade', String(next.grade));
    if (next.area) q.set('area', next.area);
    if (next.topic) q.set('topic', next.topic);
    if (next.content) q.set('content', next.content);
    if (next.due) q.set('due', next.due);
    if (next.assigned) q.set('assigned', next.assigned);
    const query = q.toString();
    return query ? `/academy/assign?${query}` : '/academy/assign';
  };

  const step = (next: Parameters<typeof hrefFor>[0], replace = false) => {
    const url = hrefFor(next) as never;
    if (replace) router.replace(url);
    else router.push(url);
  };

  /**
   * 히스토리 없는 직접 진입에서도 정확히 한 단계만 물러나게 한다.
   * 첫 단계(반 고르기)는 학원 탭의 시작점이라 뒤로가기를 두지 않는다.
   */
  const backFallback = !params.class
    ? // 문제 상세·문제 등록에서 학습을 실어 보내면 되돌아갈 곳이 분명하다(Q-036과 같은 뿌리).
      params.content
      ? `/academy/content/${params.content}`
      : undefined
    : params.assigned || params.content
      ? hrefFor({ class: params.class, grade, area, topic })
      : topic
        ? hrefFor({ class: params.class, grade, area })
        : area
          ? hrefFor({ class: params.class, grade })
          : grade
            ? hrefFor({ class: params.class })
            : '/academy/assign';

  const ownerLabel = (s: ContentSet) => (s.ownerAcademyName ? '우리 학원' : '스코디 제공');
  /** 확인·완료 화면의 한 줄 설명. 학년·영역·세부 유형·문항 수·출처를 함께 말한다. */
  const describe = (s: ContentSet) =>
    [
      s.grade ? gradeLabel(s.grade) : null,
      s.area,
      s.topic,
      `${s.questions.length}문항`,
      ownerLabel(s),
    ]
      .filter(Boolean)
      .join(' · ');

  // ---------- 마감일 ----------
  const [ty, tm, td] = today.split('-').map(Number);
  const dow = new Date(ty, tm - 1, td).getDay();
  /** 다가오는 금요일. 오늘이 금요일이면 다음 주 금요일이 된다. */
  const toFriday = (5 - dow + 7) % 7 || 7;
  const fridayISO = dayAfter(today, toFriday);
  const dueOptions: readonly SegmentedOption<DueQuick>[] = [
    { value: 'today', label: '오늘' },
    { value: 'tomorrow', label: '내일' },
    {
      value: 'friday',
      label: `${toFriday <= 6 - dow ? '이번 주' : '다음 주'} 금요일(${formatDate(fridayISO)})`,
    },
    { value: 'none', label: '마감 없음' },
  ];
  const quick: DueQuick = !due.trim()
    ? 'none'
    : due === today
      ? 'today'
      : due === dayAfter(today, 1)
        ? 'tomorrow'
        : due === fridayISO
          ? 'friday'
          : 'custom';
  function pickDue(next: DueQuick) {
    setError(null);
    if (next === 'none') return setDue('');
    if (next === 'today') return setDue(today);
    if (next === 'tomorrow') return setDue(dayAfter(today, 1));
    if (next === 'friday') return setDue(fridayISO);
  }
  // 형식·없는 날짜·과거 날짜를 한곳에서 검사한다(`parseDueDate`). 화면에 정규식을 두지 않는다.
  const parsedDue = parseDueDate(due, today, { allowToday: true });
  const dueText = !due.trim()
    ? '마감 없음'
    : parsedDue.ok && parsedDue.value
      ? (dueLabel(parsedDue.value)?.text ?? '마감 없음')
      : '확인이 필요해요';

  // ---------- 1단계: 반 ----------
  /**
   * 학년은 **값(`AcademyClass.grade`)으로 가른다.** 예전에는 반 이름을 파싱했는데
   * (`c.name.startsWith('고1')`), 원장이 `국어 심화반`처럼 이름을 지으면 어느 학년에도 걸리지
   * 않았고 이름을 바꾸면 조용히 학년이 바뀌었다 — 대시보드의 학년별 요약은 값을 쓰고 이 화면만
   * 이름을 써서, 같은 반을 두 화면이 다르게 잡았다.
   */
  const gradeMatch = (c: AcademyClass, g: GradeFilter) =>
    g === 'all' ? true : g === 'none' ? c.grade == null : c.grade === Number(g);
  const classCount = (g: GradeFilter) => classes.filter((c) => gradeMatch(c, g)).length;
  const classOptions: readonly SegmentedOption<GradeFilter>[] = [
    { value: 'all', label: '전체', count: classCount('all') },
    { value: '1', label: '고1', count: classCount('1') },
    { value: '2', label: '고2', count: classCount('2') },
    { value: '3', label: '고3', count: classCount('3') },
    // 학년을 정하지 않은 반이 있을 때만 칸을 만든다(0건인 칸은 두지 않는다, D-042).
    ...(classCount('none') > 0
      ? [{ value: 'none' as const, label: '학년 미정', count: classCount('none') }]
      : []),
  ];
  const classTerm = classQuery.trim();
  const filteredClasses = classes.filter(
    (c) => gradeMatch(c, classGrade) && (!classTerm || c.name.includes(classTerm)),
  );
  const classItems = filteredClasses.slice(classPage * CLASS_PAGE, (classPage + 1) * CLASS_PAGE);

  // ---------- 2단계: 학습 ----------
  const ourCount = useMemo(() => sets.filter((s) => !!s.ownerAcademyName).length, [sets]);
  const ownerOptions: readonly SegmentedOption<OwnerFilter>[] = [
    { value: 'all', label: '전체', count: sets.length },
    { value: 'ours', label: '우리 학원', count: ourCount },
    { value: 'scody', label: '스코디 제공', count: sets.length - ourCount },
  ];
  const pool = useMemo(
    () =>
      sets.filter(
        (s) => owner === 'all' || (owner === 'ours' ? !!s.ownerAcademyName : !s.ownerAcademyName),
      ),
    [sets, owner],
  );
  const countFor = (g: Grade, a?: KoreanArea, t?: string) =>
    pool.filter((s) => s.grade === g && (!a || s.area === a) && (!t || s.topic === t)).length;
  const matched = pool.filter(
    (s) => s.grade === grade && s.area === area && (!topic || s.topic === topic),
  );
  const titleTerm = titleQuery.trim().toLowerCase();
  const searched = titleTerm
    ? pool.filter((s) => s.title.toLowerCase().includes(titleTerm))
    : ([] as ContentSet[]);
  const searchItems = searched.slice(contentPage * CONTENT_PAGE, (contentPage + 1) * CONTENT_PAGE);
  /** 학년·세부 유형이 없는 콘텐츠는 드릴다운에 나타날 자리가 없다. 감추지 않고 알린다. */
  const unclassified = pool.filter((s) => !s.grade || !s.topic).length;

  async function onAssign() {
    if (!cls || !content) {
      setError('반과 학습을 골라 주세요.');
      return;
    }
    if (!parsedDue.ok) {
      setError(parsedDue.error);
      return;
    }
    /*
      과목·문항 수·대상 학생을 넘기지 않는다 — 서버가 콘텐츠와 반에서 직접 읽는다
      (`rpc_add_assignment`). 화면이 넘긴 값과 서버의 값이 갈릴 자리를 두지 않는다.
    */
    const r = await addAssignment({
      classId: cls.id,
      title: content.title,
      contentId: content.id,
      dueDate: parsedDue.value,
    });
    if (!r.ok || !r.id) {
      setError(r.error ?? '배정하지 못했어요.');
      return;
    }
    setError(null);
    step(
      {
        class: cls.id,
        grade,
        area,
        topic,
        content: content.id,
        due: parsedDue.value,
        assigned: r.id,
      },
      true,
    );
  }

  async function onUndo() {
    if (!assigned) return;
    const r = await removeAssignment(assigned.id);
    if (!r.ok) {
      setError(r.error ?? '되돌리지 못했어요.');
      return;
    }
    setError(null);
    show('배정을 되돌렸어요', 'removed');
    // 확인 단계로 돌아간다. 고른 반·학습과 마감일이 남아 있어 바로 다시 낼 수 있다.
    step(
      {
        class: params.class,
        grade,
        area,
        topic,
        content: params.content,
        due: assigned.dueDate,
      },
      true,
    );
  }

  function onAssignMore() {
    setDue('');
    setError(null);
    setClassQuery('');
    setClassGrade('all');
    setClassPage(0);
    setTitleQuery('');
    setOwner('all');
    setContentPage(0);
    step({}, true);
  }

  /*
    반이 없으면 배정할 대상이 없다. **원장과 선생님은 할 수 있는 일이 다르다** —
    원장은 반을 만들 수 있고(3절: 반·학생 관리는 원장) 선생님은 원장이 정해 주기를 기다린다.
    예전에는 둘 다 `배정할 담당 반이 없어요.` 한 줄이었는데, 원장은 담당이 아니라 학원 전체를
    보므로 틀린 말이었고 다음 행동도 없었다. 문구는 대시보드 알림과 같게 둔다.
  */
  if (classes.length === 0) {
    return (
      <Screen wide testID="academy-assign" title="학습 배정">
        <Group>
          <View style={{ padding: spacing.lg, gap: spacing.xs }}>
            <AppText tone="secondary">
              {isDirector ? '아직 등록된 반이 없어요.' : '담당하는 반이 아직 없어요.'}
            </AppText>
            <AppText variant="caption" tone="tertiary">
              {isDirector
                ? '반을 만들고 학생을 넣으면 학습을 배정할 수 있어요.'
                : '원장이 반을 배정하면 여기에 보여요.'}
            </AppText>
          </View>
        </Group>
        {isDirector ? (
          <ActionBar>
            <Button
              testID="assign-goto-classes"
              /* 빈 상태의 다음 행동은 `hug`이다(§8). `ActionBar`가 줄의 오른쪽 끝에 세운다(규칙 ③). */
              hug
              label="반 만들러 가기"
              trailing={<Icon name="arrow-right" size={16} color={colors.accentText} />}
              onPress={() => router.navigate('/academy/classes' as never)}
            />
          </ActionBar>
        ) : null}
      </Screen>
    );
  }

  // ---------- 완료 ----------
  // 제목 문장이 이미 완료를 말하므로 `eyebrow`를 두지 않는다(한글 eyebrow 금지, DESIGN.md §4).
  if (assigned && cls) {
    const set = sets.find((s) => s.id === assigned.contentId);
    return (
      <Screen
        wide
        testID="academy-assign"
        backFallback={backFallback}
        title="학습을 배정했어요"
      >
        <Group>
          <Row
            title={assigned.title}
            subtitle={set ? describe(set) : `${assigned.questionCount}문항`}
            /*
              **되돌리기는 방금 만든 이 배정에 딸린 행동**이라 그 줄 안에 둔다. 화면 아래
              행동줄에 두면 무엇을 되돌리는 것인지가 대상과 떨어지고, 아래 `이어서 할 일`과
              같은 무게로 읽힌다. 되돌릴 기회 자체는 화면에 그대로 남는다(D-033 — 사라지는
              토스트에 두면 되돌릴 기회도 함께 사라진다).
            */
            trailing={
              <Button
                testID="assign-undo"
                variant="secondary"
                size="sm"
                hug
                label="되돌리기"
                accessibilityLabel="방금 배정한 것 되돌리기"
                onPress={onUndo}
              />
            }
          />
          <Row
            title="반"
            subtitle={`학생 ${cls.studentIds.length}명`}
            trailing={<AppText variant="label">{cls.name}</AppText>}
          />
          <Row
            title="마감"
            trailing={
              <AppText variant="label">{dueLabel(assigned.dueDate)?.text ?? '마감 없음'}</AppText>
            }
          />
        </Group>
        <AppText variant="caption" tone="secondary">
          이 반 학생의 홈과 학습 탭에 바로 나타나요.
        </AppText>
        {error ? (
          <AppText variant="caption" style={{ color: colors.danger }}>
            {error}
          </AppText>
        ) : null}

        <Section title="이어서 할 일">
          {/*
            **여기서 끝난 일은 배정이고, 남은 둘은 모두 '다음에 할 일'이다.** 그래서 버튼을
            늘어놓지 않고 고르는 목록으로 둔다.

            먼저 오는 것이 `학습 하나 더 배정하기`다 — 배정은 한 번에 한 반이라(1단계 안내)
            원장·선생님은 보통 다음 반으로 이어 간다. `제출 현황 보기`는 방금 낸 과제라 지금
            열면 아직 아무도 내지 않은 `제출 0/N`뿐이어서, 오늘이 아니라 내일 쓰는 길이다.

            화살표(`arrow-right`)는 붙이지 않는다 — 배정은 이미 끝났고 여기서 고르는 것은
            다음에 어디로 갈지다(§8). 목록 행이라 이동 표시는 chevron이다.
          */}
          <Group>
            <Row
              testID="assign-again"
              title="학습 하나 더 배정하기"
              subtitle="반 고르기부터 다시 시작해요"
              showChevron
              onPress={onAssignMore}
            />
            <Row
              testID="assign-goto-analytics"
              title="제출 현황 보기"
              subtitle="학생이 내면 성과 분석에 쌓여요"
              showChevron
              onPress={() => router.navigate('/academy/analytics' as never)}
            />
          </Group>
        </Section>
      </Screen>
    );
  }

  // ---------- 1단계: 반 고르기 ----------
  if (!cls) {
    const big = classes.length > CLASS_PAGE;
    return (
      <Screen
        wide
        testID="academy-assign"
        backFallback={backFallback}
        title="어느 반에 낼까요?"
      >
        {/* 실려 온 학습을 1단계에서도 말한다 — 확인 단계까지 가야 무엇을 내는지 알 수 있었다. */}
        {content ? (
          <AppText variant="caption" tone="secondary">
            낼 학습 · {content.title}
          </AppText>
        ) : null}
        <AppText variant="caption" tone="secondary">
          한 번에 한 반에 배정해요.
        </AppText>
        {big ? (
          <>
            <SegmentedControl
              testID="assign-class-grade"
              options={classOptions}
              value={classGrade}
              onChange={(g) => {
                setClassGrade(g);
                setClassPage(0);
              }}
            />
            <Field
              label="반 이름으로 찾기"
              testID="assign-class-search"
              value={classQuery}
              onChangeText={(v) => {
                setClassQuery(v);
                setClassPage(0);
              }}
              placeholder="예: 고2 국어 3반"
            />
          </>
        ) : null}
        {classItems.length > 0 ? (
          <Group>
            {classItems.map((c) => (
              <Row
                key={c.id}
                testID={`assign-class-${c.id}`}
                title={c.name}
                subtitle={`학생 ${c.studentIds.length}명`}
                showChevron
                onPress={() => step({ class: c.id, content: params.content })}
              />
            ))}
          </Group>
        ) : (
          <Group>
            <View style={{ padding: spacing.lg }}>
              <AppText tone="secondary">찾는 반이 없어요.</AppText>
            </View>
          </Group>
        )}
        {filteredClasses.length > CLASS_PAGE ? (
          <Pager
            testID="assign-class-pager"
            total={filteredClasses.length}
            page={classPage}
            pageSize={CLASS_PAGE}
            unit="개"
            onChange={setClassPage}
          />
        ) : null}
      </Screen>
    );
  }

  // ---------- 2단계: 학습 고르기 ----------
  if (!content) {
    // 첫 칸은 반 이름이고 뒤는 지나온 분류다. 반 이름도 `고1 …`로 시작해 섞이므로 이름을 붙여 준다.
    const trail = [`반 ${cls.name}`, grade ? gradeLabel(grade) : null, area, topic]
      .filter(Boolean)
      .join(' · ');
    return (
      <Screen wide testID="academy-assign" backFallback={backFallback} title="어떤 학습을 낼까요?">
        <AppText variant="caption" tone="secondary">
          {trail}
        </AppText>

        {/* 우리 학원이 등록한 콘텐츠가 있을 때만 출처를 가른다 — 0개인 필터는 두지 않는다. */}
        {ourCount > 0 ? (
          <SegmentedControl
            testID="assign-owner"
            options={ownerOptions}
            value={owner}
            onChange={(o) => {
              setOwner(o);
              setContentPage(0);
            }}
          />
        ) : null}

        <Field
          label="학습 제목으로 찾기"
          testID="assign-content-search"
          value={titleQuery}
          onChangeText={(v) => {
            setTitleQuery(v);
            setContentPage(0);
          }}
          placeholder="예: 맞춤법"
        />

        {titleTerm ? (
          searched.length > 0 ? (
            <>
              <AppText variant="caption" tone="tertiary">
                제목으로 찾으면 학년·영역과 상관없이 모두 보여줘요.
              </AppText>
              <Group>
                {searchItems.map((s) => (
                  <Row
                    key={s.id}
                    testID={`assign-content-${s.id}`}
                    title={s.title}
                    subtitle={[
                      s.grade ? gradeLabel(s.grade) : null,
                      s.area,
                      s.topic,
                      `${s.questions.length}문항`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    meta={ownerLabel(s)}
                    showChevron
                    onPress={() => step({ class: cls.id, content: s.id })}
                  />
                ))}
              </Group>
              {searched.length > CONTENT_PAGE ? (
                <Pager
                  testID="assign-content-pager"
                  total={searched.length}
                  page={contentPage}
                  pageSize={CONTENT_PAGE}
                  unit="개"
                  onChange={setContentPage}
                />
              ) : null}
            </>
          ) : (
            <Group>
              <View style={{ padding: spacing.lg }}>
                <AppText tone="secondary">찾는 학습이 없어요.</AppText>
              </View>
            </Group>
          )
        ) : !grade ? (
          /* 학년 → 영역 → 세부 유형. 0개인 칸은 세 단계 모두 같은 규칙으로 막는다(D-042). */
          <>
            <Group>
              {GRADES.map((g) => {
                const n = countFor(g);
                return (
                  <Row
                    key={g}
                    testID={`assign-grade-${g}`}
                    title={gradeLabel(g)}
                    subtitle={n > 0 ? `${n}개 학습` : '아직 준비 중이에요'}
                    showChevron={n > 0}
                    onPress={n > 0 ? () => step({ class: cls.id, grade: g }) : undefined}
                  />
                );
              })}
            </Group>
            {unclassified > 0 ? (
              <AppText variant="caption" tone="tertiary">
                학년이나 세부 유형이 없는 학습 {unclassified}개는 제목으로 찾을 수 있어요.
              </AppText>
            ) : null}
          </>
        ) : !area ? (
          <Group>
            {AREAS.map((a) => {
              const n = countFor(grade, a);
              return (
                <Row
                  key={a}
                  testID={`assign-area-${a}`}
                  title={a}
                  subtitle={n > 0 ? `${n}개 학습` : '아직 준비 중이에요'}
                  showChevron={n > 0}
                  onPress={n > 0 ? () => step({ class: cls.id, grade, area: a }) : undefined}
                />
              );
            })}
          </Group>
        ) : !topic ? (
          <Group>
            {topicsFor(area).map((t) => {
              const n = countFor(grade, area, t);
              return (
                <Row
                  key={t}
                  testID={`assign-topic-${t}`}
                  title={t}
                  subtitle={n > 0 ? `${n}개 학습` : '아직 준비 중이에요'}
                  showChevron={n > 0}
                  onPress={n > 0 ? () => step({ class: cls.id, grade, area, topic: t }) : undefined}
                />
              );
            })}
          </Group>
        ) : matched.length > 0 ? (
          <Group>
            {matched.map((s) => (
              <Row
                key={s.id}
                testID={`assign-content-${s.id}`}
                title={s.title}
                subtitle={`${KIND_LABEL[s.kind]} · ${s.questions.length}문항`}
                meta={ownerLabel(s)}
                showChevron
                onPress={() => step({ class: cls.id, grade, area, topic, content: s.id })}
              />
            ))}
          </Group>
        ) : (
          <Group>
            <View style={{ padding: spacing.lg }}>
              <AppText tone="secondary">이 유형은 아직 준비 중이에요.</AppText>
            </View>
          </Group>
        )}
      </Screen>
    );
  }

  // ---------- 3단계: 확인 ----------
  // 반과 학습이 둘 다 정해진 단계라 `배정하기`는 늘 누를 수 있다(D-036 — 못 누르는 버튼을 두지 않는다).
  return (
    <Screen wide testID="academy-assign" backFallback={backFallback} title="이렇게 배정할까요?">
      {/*
        무엇을 · 누구에게 · 언제까지. 학습 제목은 값이 아니라 이 배정의 이름이라 행 제목으로 둔다 —
        긴 제목을 `trailing`에 넣으면 390에서 옆 설명이 200px로 눌려 `10문항`이 글자 사이에서 끊긴다
        (`DESIGN.md` §19의 같은 실측 근거).
      */}
      <Group>
        <Row title={content.title} subtitle={describe(content)} />
        <Row
          title="반"
          subtitle={`학생 ${cls.studentIds.length}명`}
          trailing={<AppText variant="label">{cls.name}</AppText>}
        />
        <Row title="마감" trailing={<AppText variant="label">{dueText}</AppText>} />
      </Group>

      <Section title="마감일">
        <SegmentedControl testID="assign-due-quick" options={dueOptions} value={quick} onChange={pickDue} />
        <Field
          label="직접 정하기"
          testID="assign-due"
          value={due}
          onChangeText={(v) => {
            setDue(v);
            setError(null);
          }}
          placeholder="예: 2026-08-11"
          hint="비워 두면 마감 없이 배정돼요."
          autoCapitalize="none"
          autoCorrect={false}
        />
      </Section>

      <AppText variant="caption" tone="secondary">
        배정하면 학생 {cls.studentIds.length}명의 홈과 학습 탭에 바로 나타나요. 아직 낸 학생이
        없으면 되돌릴 수 있어요.
      </AppText>
      {error ? (
        <AppText variant="caption" style={{ color: colors.danger }}>
          {error}
        </AppText>
      ) : null}
      {/* 이 화면의 목적을 끝내는 유일한 행동이라 전폭이 맞다(§8). 폭은 읽기 폭에서 멈춘다. */}
      <ActionBar>
        <Button testID="assign-submit" fullWidth label="배정하기" onPress={onAssign} />
      </ActionBar>
    </Screen>
  );
}
