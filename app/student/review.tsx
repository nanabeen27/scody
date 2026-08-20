import { useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Pressable, StyleSheet } from 'react-native';
import {
  ActionBar,
  AppText,
  AskField,
  Button,
  ConfirmStep,
  Divider,
  EmptyState,
  Group,
  Icon,
  IconButton,
  LoadFailed,
  MotionAsset,
  Passage,
  RichText,
  Row,
  Screen,
  Section,
  SourceTag,
  Steps,
} from '@/components';
import { useSession } from '@/session';
import { useActiveTime } from '@/features/activeTime';
import { useProgress, type WrongNote } from '@/features/progress';
import { useContent } from '@/features/content';
import { useToast } from '@/features/toast';
import { askScodyAIStream, isAiFailure, isAiSavable } from '@/features/openrouter';
import { SCODY_WRONG_SYSTEM, WRONG_MEMO_SYSTEM, wrongCtx } from '@/features/prompts';
import { findContent } from '@/data';
import type { NoteEvidence } from '@/data/types';
import type { LoggedReview } from '@/repo/notes';
import { addDaysISO, todayISO } from '@/features/clock';
import {
  ACADEMY_MEMO_NOTICE,
  choiceSeed,
  closingLine,
  EVIDENCE_ORDER,
  evidenceLabels,
  evidenceQuestion,
  GRADUATE_STREAK,
  nextReviewLabel,
  passesLeft,
  scopedDeck,
  shuffleOrder,
  todayDeck,
  todayResult,
} from '@/features/review';
import { colors, spacing, radius, typeface, font } from '@/theme/tokens';
import { useColumn } from '@/theme/useColumn';

/**
 * 화면 이름은 **`카드 복습` 하나**이고 범위를 앞에 붙인다(D-150).
 *
 * 접두어가 없는 것이 **오늘 볼 것**이다 — 서버가 정한 차례가 오늘인 카드만, 하루 상한까지.
 * 별표·영역·전체 덱은 학생이 범위를 직접 고른 것이라 차례를 보지 않는다(그 복습은 다음 차례를
 * 움직이지 않는다 — 서버가 그렇게 정한다).
 */
function deckTitle(area: string | undefined, onlyStarred: boolean, all: boolean): string {
  if (onlyStarred) return '별표 카드 복습';
  if (area) return `${area} 카드 복습`;
  return all ? '전체 카드 복습' : '카드 복습';
}

/** 완료 요약의 `헷갈린 문항` 상한(§8의 5줄 상한). 그 이상은 `N개 더 보기`로 펼친다. */
const MISSED_PREVIEW = 5;

/**
 * 빈 덱의 다섯 화면.
 *
 * 범위를 고른 덱 셋(별표·전체·영역)은 제목이 같고 부제만 갈린다. 담은 오답이 아예 없는 계정만
 * 학습 탭으로 보낸다 — 나머지는 오답노트에 볼 것이 있다.
 */
const EMPTY_DECK = {
  starred: {
    title: '이 범위에 복습할 오답이 없어요.',
    subtitle: '별표를 달거나, 오늘 본 오답은 내일 다시 볼 수 있어요.',
    to: 'notebook',
  },
  all: {
    title: '이 범위에 복습할 오답이 없어요.',
    subtitle: '오늘 본 오답은 빠져 있어요. 내일 다시 볼 수 있어요.',
    to: 'notebook',
  },
  area: {
    title: '이 범위에 복습할 오답이 없어요.',
    subtitle: '이 영역 오답을 담으면 여기에 모여요.',
    to: 'notebook',
  },
  doneToday: {
    title: '오늘 다시 볼 오답은 없어요.',
    subtitle: '차례가 되면 홈에서 알려 줄게요.',
    to: 'notebook',
  },
  none: {
    title: '복습할 오답이 없어요.',
    subtitle: '결과 화면에서 틀린 문제를 담으면 카드로 복습할 수 있어요.',
    to: 'learn',
  },
} as const;

/** 대화가 없을 때 돌려주는 값. 모듈 상수라 렌더마다 새 배열을 만들지 않는다. */
const EMPTY_CONVO: readonly { q: string; a: string }[] = [];

/**
 * 카드 한 장에 매달린 상태. **`id`가 이 상태의 주인이다.**
 *
 * 소속을 값 안에 두면 카드가 바뀔 때 초기화를 잊을 수 없고, 상태를 하나 늘릴 때 고칠 자리가
 * 하나다.
 */
interface CardState {
  id: string;
  /** 화면에 보이는 선지 자리(섞인 순서에서의 index). 원본 자리는 `pickedOriginal`이 안다. */
  slot: number | null;
  evidence: NoteEvidence | null;
  /** 서버가 채점해 돌려준 결과. 기록이 남은 뒤에만 채워진다. */
  result: LoggedReview | null;
  checkError: string | null;
  recap: string;
  recapSaved: string | null;
  convo: { q: string; a: string }[];
  /** 메모를 덮어쓰기 전 확인 중인지. 잃을 것이 있을 때만 세운다. */
  confirmMemo: boolean;
}

function emptyCard(id: string): CardState {
  return {
    id,
    slot: null,
    evidence: null,
    result: null,
    checkError: null,
    recap: '',
    recapSaved: null,
    convo: [],
    confirmMemo: false,
  };
}

/**
 * 카드 복습의 겉. **읽는 중 · 실패 · 덱을 셋으로 가른다**(D-133·D-136과 같은 규칙 · D-153).
 *
 * ## 왜 컴포넌트를 둘로 갈랐나
 *
 * `ReviewDeck`은 덱(카드 순서)을 **첫 렌더에 한 번** 고정한다. 그 스냅샷은 카드 안에서 별표를
 * 뺄 때 자리와 판정이 어긋나는 것을 막는 장치라 유지해야 한다(D-113). 그런데 조회가 끝나기 전에
 * 마운트되면 원본이 비어 있어 `deck = []`이 되고, 노트가 도착해도 다시 세우는 곳이 없어서
 * **`복습할 오답이 없어요.`가 그 화면의 영구 상태가 됐다**(실측).
 *
 * effect에서 덱을 다시 세우는 방법은 쓰지 않는다(`react-hooks` 린트가 effect 안의 `setState`를
 * 막고, 연쇄 렌더가 된다). 대신 **조회가 끝난 뒤에 덱 화면을 마운트한다.**
 *
 * ## 실패를 겉에서 다루지 않는다
 *
 * **첫 조회 실패만 여기서 말한다.** 예전에는 `loadError`가 있으면 언제나 `ReviewDeck`을
 * 언마운트했는데, 이 화면의 쓰기(별표·메모)는 실패하면 `reload()`를 부르므로 그 재조회가 실패한
 * 순간 **진행 중인 복습 세션이 통째로 사라졌다** — 덱 스냅샷·고른 답·근거·대화·쓰던 한 줄이
 * 전부. 게이트를 `loaded`로 좁힌 것과 같은 사고이고(D-163), §9가 "이미 읽어 둔 값은 지우지
 * 않는다 — 가진 것은 여전히 사실이다"라고 정한 규칙이다. 손에 노트가 있는 동안의 실패는
 * `ReviewDeck` 안에서 줄로 말한다.
 */
export default function Review() {
  const params = useLocalSearchParams<{ area?: string; starred?: string; all?: string }>();
  const {
    loaded: progressLoaded,
    loading: progressLoading,
    error: progressError,
    reload: reloadProgress,
    wrongNotes,
  } = useProgress();
  const {
    loaded: contentLoaded,
    loading: contentLoading,
    error: contentError,
    reload: reloadContent,
  } = useContent();
  const onlyStarred = params.starred === '1';
  /**
   * 담아 둔 오답 **전체**를 차례와 무관하게 연다.
   *
   * 학습 탭이 `오늘 볼 오답`과 `담아 둔 오답 전체 보기`를 다른 줄로 두므로, 두 줄이 같은 덱을
   * 열면 한 줄이 죽는다. 시험 직전에 범위를 넓게 돌아보는 것은 스케줄과 다른 목적이다.
   */
  const allNotes = params.all === '1';
  const title = deckTitle(params.area, onlyStarred, allNotes);

  const firstLoad = !progressLoaded || !contentLoaded;
  /** 다시 읽는 중. 실패 줄의 버튼이 그 사이 라벨로 진행을 말한다(A-130). */
  const retrying = (progressLoading || contentLoading) && !firstLoad;
  const loadError = retrying ? null : (progressError ?? contentError);
  const retry = () => void Promise.all([reloadProgress(), reloadContent()]);

  if (firstLoad) {
    return (
      <Screen testID="student-review" backFallback="/student/learn" title={title}>
        <AppText variant="caption" tone="secondary">
          오답을 불러오고 있어요.
        </AppText>
      </Screen>
    );
  }

  /*
    첫 조회가 끝났는데 읽은 것이 하나도 없고 실패했다면, 다시 시도가 이 화면의 유일한 다음
    행동이다(§9의 예외 — 본문이 아예 없는 자리).
  */
  if (loadError && wrongNotes.length === 0) {
    return (
      <Screen testID="student-review" backFallback="/student/learn" title={title}>
        <LoadFailed
          testID="review-load-failed"
          retryTestID="review-load-retry"
          what="오답"
          message={loadError}
          retrying={retrying}
          onRetry={retry}
        />
      </Screen>
    );
  }

  return (
    <ReviewDeck
      area={params.area}
      onlyStarred={onlyStarred}
      allNotes={allNotes}
      title={title}
      loadError={loadError}
      retrying={retrying}
      onRetry={retry}
    />
  );
}

/**
 * 오답노트 카드 복습. 카드 한 장에 문항 하나.
 *
 * ## 한 장의 순서
 *
 *   문항(지문은 접혀 있다) → 답 고르기 → **근거 고르기** → 확인 → 정오·처음 답·해설·다음 차례
 *   → **내 말로 한 줄**(선택) → 다음 → (더 파고들면) 질문하고 메모하기
 *
 * ## 왜 이 순서인가
 *
 * - **다시 풀기가 먼저다.** 인출이 재독보다 g=0.50 낫고(Rowland 2014), 교육 텍스트 재독은
 *   유의한 이득이 거의 없다(Callender & McDaniel 2009). 그래서 해설은 답을 낸 **뒤에만** 열린다.
 * - **정오를 화면이 정하지 않는다.** 고른 자리만 서버로 보내고 서버가 채점한다(0040). 앞선
 *   판본은 `isCorrect`를 인자로 보냈고, 그래서 학생이 문항을 열지도 않고 서로 다른 3일에
 *   `true`를 보내 졸업시킬 수 있었다 — `mastered`를 걷어낸 이유가 그대로 되살아났다.
 * - **지문은 접혀 있고 자동으로 펼치지 않는다.** 지문을 보면서 답하는 형태는 1주 후 망각이 더
 *   컸다(Agarwal et al. 2008). 확인 뒤 근거를 확인할 자리는 **접힌 지문이 거기 있는 것**으로
 *   충족된다 — 자동으로 펼치면 지문 높이(실측 최대 470px)만큼 문서가 위에서 자라 방금 확인한
 *   정답·해설이 화면 밖으로 밀린다.
 * - **선지 순서를 카드마다 섞는다.** 같은 문항을 다시 풀 때 인출되는 것이 근거가 아니라 답의
 *   위치일 수 있다.
 * - **근거를 확인 전에 묻는다.** 확인한 뒤에는 되짚을 수 없는 값이다. 지문이 없는 문항에서는
 *   문구가 갈린다(문법 세트에서 `지문에서 근거를 찾았어요`는 뜻이 서지 않는다).
 * - **정오만 주지 않는다.** 정오만 d=0.05 · 정답 제시 0.32 · 설명 피드백 0.49
 *   (Van der Kleij et al. 2015).
 * - **한 줄은 선택이다.** 자기설명은 g=0.55지만(Bisra et al. 2018) 쓰기를 강제하면 복습이
 *   노동이 된다. 안 쓰고 넘겨도 아무 말을 하지 않고, **쓴 것은 버리지 않는다**(넘길 때 저장한다).
 *
 * ## 없어진 것
 *
 * `이제 이해했어요`(`mastered`)를 지웠다. 자기 예측은 실제 성과와 무상관이고(Karpicke &
 * Roediger 2008) 그 값은 해제 경로도 없이 어떤 화면도 바꾸지 않았다(A-087).
 */
function ReviewDeck({
  area,
  onlyStarred,
  allNotes,
  title,
  loadError,
  retrying,
  onRetry,
}: {
  area?: string;
  onlyStarred: boolean;
  /** 차례와 무관하게 담아 둔 오답 전체를 연다. */
  allNotes: boolean;
  /** 겉에서 이미 계산했다 — 같은 규칙(D-150)을 두 자리에서 다시 쓰지 않는다. */
  title: string;
  /** 손에 값이 있는 동안의 재조회 실패. 세션을 지우지 않고 줄로 말한다. */
  loadError: string | null;
  retrying: boolean;
  onRetry: () => void;
}) {
  const router = useRouter();
  const { wrongNotes, noteReviews, toggleStar, setDig, logCard, setRecap, deferNote } =
    useProgress();
  const { sets } = useContent();
  const { readOnly } = useSession();
  const { show } = useToast();
  const { isMobile } = useColumn();
  /*
    **오답 복습 시간도 학습 시간이다.** `attempts.time_sec`은 제출한 학습에만 붙으므로, 이 화면의
    시간을 재지 않으면 하루의 절반을 오답 복습에 쓴 학생의 `실제 학습 시간`이 그만큼 비어 있다.
    측정 규칙은 풀이 화면과 같다(`src/features/activeTime.ts`).
  */
  const active = useActiveTime('review');
  /**
   * 세션이 시작된 날. **렌더마다 다시 계산하지 않는다.**
   *
   * `todayISO()`를 본문에서 부르면 매 렌더 새 값이 되고, 선지 순서의 씨앗이 `노트 id + 날짜`라
   * 자정을 넘기는 순간 `order`가 다른 순열로 바뀐다 — 학생이 누른 자리가 **다른 선지**를 가리켜
   * 엉뚱한 답으로 채점된다(23:59에 고르고 00:00에 리렌더되면 실제로 그렇게 된다).
   */
  const [today] = useState(() => todayISO());

  /**
   * 지금 조건에 맞는 오답. 세션 덱을 뽑는 원본이다.
   *
   * 접두어가 없는 덱은 **오늘 차례가 온 것**이고 하루 상한이 걸린다. 별표·영역·전체는 학생이
   * 범위를 고른 것이라 차례를 보지 않는다. 두 경로 모두 `stuck`을 뺀다 — 서버가 그 노트의
   * 복습을 받지 않으므로 카드를 열어도 확인할 수 없다.
   */
  const scoped = Boolean(area) || onlyStarred || allNotes;
  const pool = useMemo(
    () =>
      scoped
        ? scopedDeck(wrongNotes, noteReviews, { area, onlyStarred }, today)
        : todayDeck(wrongNotes, noteReviews, today).map((c) => c.note),
    [scoped, wrongNotes, noteReviews, area, onlyStarred, today],
  );

  /**
   * **덱은 세션이 시작될 때 한 번 고정한다.**
   *
   * 매 렌더의 필터 결과를 덱으로 쓰면 카드 안에서 별표를 빼거나 복습을 기록하는 순간 그 카드가
   * 목록에서 사라져 **같은 자리(index)가 다음 문항을 가리킨다**(D-113). 그래서 id 순서만 붙잡아
   * 두고 값은 매 렌더의 `wrongNotes`에서 다시 찾는다.
   */
  const [deck, setDeck] = useState<string[]>(() => pool.map((n) => n.id));
  const [index, setIndex] = useState(0);
  /**
   * **카드 한 장에 매달린 상태 전부.** `id`가 그 상태의 주인이다.
   *
   * 예전에는 여섯 개의 독립 `useState`와 "그게 어느 카드의 것인가"를 들고 있는 일곱 번째 상태
   * (`activeId`)로 나뉘어 있었다. 그래서 카드별 상태를 하나 늘릴 때마다 ①`useState` ②`resetCard`의
   * 초기화 ③파생 별칭 ④`setActiveId(card.id)` 반복 네 자리를 함께 고쳐야 했고, `resetCard`에서 한
   * 줄을 빠뜨리는 것이 정확히 아래 `live`가 막는 재발 경로다(D-113).
   *
   * 소속을 값 안에 넣으면 초기화가 `setCard(null)` 한 줄이 된다.
   */
  const [cardState, setCardState] = useState<CardState | null>(null);
  /** 카드 하나에 매이지 않는 것들 — 세션 전역이다. */
  const [saving, setSaving] = useState(false);
  const [question, setQuestion] = useState('');
  const [live, setLive] = useState('');
  const [busy, setBusy] = useState(false);
  const [askFailed, setAskFailed] = useState(false);
  /** 완료 요약의 `헷갈린 문항` 상한을 풀었는지. */
  const [showAllMissed, setShowAllMissed] = useState(false);

  /**
   * 지금 유효한 호출 회차.
   *
   * 카드를 넘기거나 다시 시작하면 올라가고, 그 전에 보낸 호출의 **결과와 조각을 모두 버린다.**
   * 이 검사가 없으면 A 카드에 보낸 답이 B 카드의 대화로 들어가고, 그 대화로 만든 메모가 B의
   * 오답노트 메모로 저장됐다.
   */
  const askSeq = useRef(0);

  const byId = useMemo(() => new Map(wrongNotes.map((n) => [n.id, n] as const)), [wrongNotes]);

  /**
   * 덱에 있던 문항을 다른 화면에서 지웠을 수 있다. 그 자리는 그릴 내용이 없으므로 **자리를
   * 지우지 않고 건너뛴다** — 덱에서 빼면 뒤 카드가 앞으로 밀려 위에서 막은 어긋남이 다시 생긴다.
   */
  const at = useMemo(() => {
    let i = index;
    while (i < deck.length && !byId.has(deck[i])) i += 1;
    return i;
  }, [index, deck, byId]);

  const card = at < deck.length ? byId.get(deck[at]) : undefined;
  /**
   * 덱에서 아직 살아 있는 id. **진행 표시와 완료 요약이 같은 값을 쓴다.**
   *
   * 예전에는 같은 필터가 세 자리(`total`·`seen`·완료 요약의 `alive`)에 있었다 — 조건이 바뀌면
   * 세 곳을 찾아야 하고, 진행 표시와 완료 요약이 다른 수를 말하는 자리가 생긴다.
   */
  const alive = useMemo(() => deck.filter((id) => byId.has(id)), [deck, byId]);
  const total = alive.length;
  /** 남아 있는 카드 중 몇 번째인가(0부터). 지운 자리는 세지 않는다. */
  const seen = useMemo(
    () => deck.slice(0, at).filter((id) => byId.has(id)).length,
    [deck, at, byId],
  );

  /**
   * 이 카드의 상태. **카드가 바뀌었으면 앞 카드의 것이므로 없는 것으로 읽는다.**
   *
   * 덱 자리(`at`)는 다른 화면에서 노트를 지우면 `useMemo` 안에서 조용히 다음 자리로 올라간다.
   * 그때 초기화는 불리지 않으므로(`nextCard`/`restart`에서만 부른다) 앞 카드의 답·판정·대화가
   * 새 카드에 남았다 — 결과는 ①**기록 없이 정답·해설 공개** ②학생이 누른 적 없는 선지에 `내 답`
   * ③앞 카드의 AI 대화가 **다른 노트의 메모로 저장**이다. D-113이 막았다고 적은 어긋남이 이
   * 경로로 재발했다. effect로 지우지 않고 소속을 확인한다.
   */
  const cs = card && cardState?.id === card.id ? cardState : null;
  const checked = cs?.result ?? null;
  const slot = cs?.slot ?? null;
  const pickedEvidence = cs?.evidence ?? null;
  const messages = cs?.convo ?? EMPTY_CONVO;
  const recap = cs?.recap ?? '';
  const recapSaved = cs?.recapSaved ?? null;
  const checkError = cs?.checkError ?? null;
  /** 카드 한 장의 진행 단계. 조건식을 세 자리에서 다시 조립하지 않는다. */
  const step = checked ? 'done' : slot == null ? 'pick' : pickedEvidence == null ? 'why' : 'confirm';

  const content = card?.contentId ? findContent(sets, card.contentId) : undefined;
  const hasPassage = Boolean(content?.passage);
  const labels = evidenceLabels(hasPassage);

  /**
   * 이 카드의 선지 표시 순서. **카드마다 한 번 계산하고 리렌더 중에는 움직이지 않는다.**
   *
   * 답을 고르는 중에 선지가 움직이면 누르려던 것과 눌리는 것이 달라진다.
   */
  /*
    **`useMemo`를 쓰지 않는다.** `shuffleOrder`는 결정적이라(씨앗이 `노트 id + 세션 날짜`) 매 렌더
    같은 순열을 낸다 — 메모는 정확성에 필요하지 않고 성능만을 위한 것이며, 그 성능은 React
    Compiler가 알아서 처리한다. 손으로 memo를 두면 컴파일러가 그것을 보존할 수 없다고 판단해
    이 컴포넌트의 최적화를 통째로 건너뛴다("Existing memoization could not be preserved").

    선지가 다섯 개 미만이라 계산은 사실상 공짜다. 카드가 바뀌면 씨앗이 바뀌므로 순열도 바뀐다.
  */
  const order = card ? shuffleOrder(choiceSeed(card.id, today), card.choices.length) : [];
  const pickedOriginal = slot == null ? null : (order[slot] ?? null);

  /**
   * 카드 한 장에 매달린 상태를 전부 되돌린다.
   * 카드를 넘길 때와 처음부터 다시 시작할 때가 **같은 것을 부른다**.
   */
  function resetCard() {
    // 앞 카드에 보낸 호출을 무효로 만든다. 남은 응답은 도착해도 버려진다.
    askSeq.current += 1;
    setCardState(null);
    setBusy(false);
    setSaving(false);
    setLive('');
    setQuestion('');
    setAskFailed(false);
  }

  /**
   * 이 카드의 상태를 고친다. 카드가 바뀌었으면 앞 카드의 값 위에 얹지 않고 새로 시작한다.
   *
   * **누른 순간에만 쓴다**(`pick`·`chooseEvidence`·입력·확인 단계). `await` 뒤에는 `patchLive`다.
   */
  function patchCard(id: string, patch: Partial<Omit<CardState, 'id'>>) {
    setCardState((prev) => ({ ...(prev?.id === id ? prev : emptyCard(id)), ...patch }));
  }

  /**
   * `await` 뒤에 도착한 갱신. **카드가 이미 바뀌었으면 버린다.**
   *
   * `patchCard`는 없는 상태를 만들어 주므로 늦게 도착한 갱신이 **앞 카드 id로 자리를 차지한다.**
   * 상태 자리는 하나뿐이라 그 순간 지금 보이는 카드의 `cs`가 `null`이 되고, 학생이 방금 고른
   * 답과 근거가 화면에서 사라진다(확인 버튼까지 함께 사라진다). 한 줄 저장 → 다음 문제 →
   * 새 카드에서 답 고르기 순으로 누르면 실제로 그렇게 된다 — 예전 `setRecapSaved`는 소속을
   * 건드리지 않아서 이 경로가 없었다.
   *
   * `prev`를 인자로 준다 — 목록에 덧붙이는 갱신(`convo`)이 렌더 시점의 사본이 아니라 지금 값
   * 위에 얹히게 한다.
   */
  function patchLive(id: string, patch: (prev: CardState) => Partial<Omit<CardState, 'id'>>) {
    setCardState((prev) => (prev?.id === id ? { ...prev, ...patch(prev) } : prev));
  }

  /**
   * 다음 카드로. **쓴 것을 버리지 않는다.**
   *
   * 한 줄은 선택이지만(§17) 쓴 것을 버려도 된다는 뜻은 아니다. 저장하지 않은 한 줄이 남아 있으면
   * 넘기기 전에 저장한다 — 확인 단계를 두지 않는다(선택 입력이고 서버는 오늘 한 행을 갱신한다).
   */
  function nextCard() {
    const pending = card && checked && !recapSaved ? recap.trim() : '';
    const noteId = card?.id;
    resetCard();
    setIndex(at + 1);
    if (pending && noteId) void setRecap(noteId, pending);
  }

  function restart() {
    // 덱을 지금 조건으로 다시 잡는다 — 오늘 복습한 것은 빠지고, 별표를 뺀 것도 빠진다.
    setDeck(pool.map((n) => n.id));
    setIndex(0);
    setShowAllMissed(false);
    resetCard();
  }

  function pick(nextSlot: number) {
    if (!card || checked) return;
    active.ping();
    patchCard(card.id, { slot: nextSlot, checkError: null });
  }

  function chooseEvidence(next: NoteEvidence) {
    if (!card || checked) return;
    active.ping();
    patchCard(card.id, { evidence: next });
  }

  /**
   * 확인. **여기서 서버에 기록이 남고, 서버가 채점한다.**
   *
   * 카드를 넘길 때 남기면 화면을 닫고 나간 학생의 진행이 사라진다(A-114). 기록이 남지 않았으면
   * 정답을 공개하지 않는다 — 공개한 뒤에는 다시 풀어 볼 수 없다.
   */
  async function check() {
    if (!card || pickedOriginal == null || !pickedEvidence || saving) return;
    setSaving(true);
    patchCard(card.id, { checkError: null });
    const res = await logCard({
      noteId: card.id,
      pickedIndex: pickedOriginal,
      evidence: pickedEvidence,
    });
    setSaving(false);
    if (!res.ok || !res.review) {
      const message = res.error ?? '복습을 기록하지 못했어요';
      patchLive(card.id, () => ({ checkError: message }));
      show(message, 'removed');
      return;
    }
    /*
      **서버가 돌려준 것을 그대로 담는다.** 정오·다음 차례·연속 횟수를 화면이 `card`(provider
      캐시)에서 다시 읽으면, 그 값이 낙관적 갱신에 의존하고 `scheduled`가 거짓일 때는 갱신되지도
      않는다 — 화면과 서버가 다른 날짜를 말할 자리가 생긴다.
    */
    patchLive(card.id, () => ({ result: res.review, checkError: null }));
    /*
      카드 한 장이 끝나는 자리에서 시간을 보낸다. 여기서 보내지 않으면 60초 주기와 화면을 떠날
      때만 남으므로, 카드 두 장을 풀고 홈으로 돌아간 학생의 기록이 오늘 안에서 늦게 반영된다
      (홈이 이 값을 읽는다).
    */
    void active.flush();
  }

  async function saveRecap() {
    if (!card || recapSaved) return;
    const text = recap.trim();
    if (!text) return;
    const res = await setRecap(card.id, text);
    if (!res.ok) {
      show(res.error ?? '한 줄을 저장하지 못했어요', 'removed');
      return;
    }
    patchLive(card.id, () => ({ recapSaved: text }));
    show('한 줄을 저장했어요');
  }

  /** 건너뛰기. 기록은 남기지 않고 **서버가 하루 미룬다** — 그러지 않으면 큐가 교착된다. */
  async function skip() {
    if (!card) return;
    const noteId = card.id;
    nextCard();
    const res = await deferNote(noteId);
    if (!res.ok) show(res.error ?? '건너뛰지 못했어요', 'removed');
  }

  async function ask() {
    if (!card) return;
    const q = question.trim();
    if (!q || busy) return;
    const seq = askSeq.current;
    setBusy(true);
    setAskFailed(false);
    setLive('');
    /*
      **`busy`는 `finally`에서 되돌린다.** 스트림이 끊기면 호출이 예외로 끝나고, 그때 `busy`가
      켜진 채 남아 이 카드에서 다시 물어볼 수 없었다(화면을 나가야 풀렸다).
    */
    let answer = '';
    try {
      answer = await askScodyAIStream(
        `${SCODY_WRONG_SYSTEM}\n\n[문항 정보]\n${wrongCtx(card, '지난번 내 답')}`,
        q,
        (chunk) => {
          if (askSeq.current !== seq) return;
          setLive((prev) => prev + chunk);
        },
      );
    } catch {
      // 끊긴 스트림은 값이 아니라 예외로 온다. 실패로 다루려면 빈 문장이어야 한다.
      answer = '';
    } finally {
      if (askSeq.current === seq) {
        setLive('');
        setBusy(false);
      }
    }
    if (askSeq.current !== seq) return;
    /*
      실패 문장을 `Scody AI`의 답으로 그리지 않는다(§19·D-107). 쓴 질문은 입력창에 그대로 남긴다.
    */
    if (isAiFailure(answer)) {
      setAskFailed(true);
      return;
    }
    patchLive(card.id, (prev) => ({ convo: [...prev.convo, { q, a: answer }] }));
    setQuestion('');
  }

  async function saveMemo() {
    if (!card || messages.length === 0 || busy) return;
    const seq = askSeq.current;
    setBusy(true);
    const text = messages.map((m) => `질문: ${m.q}\n답변: ${m.a}`).join('\n\n');
    let memo = '';
    try {
      memo = await askScodyAIStream(
        WRONG_MEMO_SYSTEM,
        `${wrongCtx(card, '지난번 내 답')}\n\n[대화]\n${text}`,
        () => {},
      );
    } catch {
      memo = '';
    } finally {
      if (askSeq.current === seq) setBusy(false);
    }
    if (askSeq.current !== seq) return;
    if (!isAiSavable(memo)) {
      show('지금은 정리하지 못했어요. 잠시 뒤 다시 해 주세요.', 'removed');
      return;
    }
    const res = await setDig(card.id, memo);
    if (!res.ok) {
      show(res.error ?? '정리를 저장하지 못했어요', 'removed');
      return;
    }
    show('노트에 정리했어요');
  }

  /**
   * 별표 켜고 끄기. 동사는 버튼 이름과 같게 쓴다(D-043).
   * **서버가 받아 준 뒤에 알린다** — 오답노트 화면과 같은 규칙이다.
   */
  async function star(c: WrongNote) {
    const on = !c.starred;
    const res = await toggleStar(c.id);
    if (!res.ok) {
      show(res.error ?? (on ? '별표를 달지 못했어요' : '별표를 빼지 못했어요'), 'removed');
      return;
    }
    show(on ? '별표를 달았어요' : '별표를 뺐어요', on ? 'added' : 'removed');
  }

  /** 손에 값이 있는 동안의 재조회 실패. 세션을 지우지 않고 맨 위 한 줄로 말한다(§9). */
  const failureRow = loadError ? (
    <LoadFailed
      testID="review-load-failed"
      retryTestID="review-load-retry"
      what="오답"
      again
      message={loadError}
      retrying={retrying}
      onRetry={onRetry}
    />
  ) : null;

  if (total === 0) {
    /*
      **다섯 가지 빈 화면을 표에서 꺼낸다.** 예전에는 제목·부제·행동이 각자 삼항 트리라 어떤
      조합이 어떤 화면을 만드는지 읽으려면 세 트리를 동시에 올려야 했고, 실제로 세 축이
      비대칭이었다(제목과 행동은 `hasAny`를 보는데 부제는 보지 않았다).

      가리는 것은 하나다 — **오늘 볼 것이 없는 것과 담은 오답이 없는 것은 다른 사실이다.** 같은
      문장으로 말하면 서른 개를 담아 두고 어제 다 복습한 학생이 `결과 화면에서 틀린 문제를
      담으면…`을 읽는다.
    */
    const kind = onlyStarred
      ? 'starred'
      : allNotes
        ? 'all'
        : area
          ? 'area'
          : wrongNotes.length > 0
            ? 'doneToday'
            : 'none';
    const empty = EMPTY_DECK[kind];
    /*
      **담은 오답이 아예 없으면 오답노트도 비어 있다.** 표의 `to`만 보면 범위 덱(별표·전체·영역)이
      항상 오답노트를 가리키는데, 노트가 0개인 계정에는 그쪽도 빈 화면이라 나갈 문이 없는 자리가
      된다 — 직접 URL(`?starred=1`·`?all=1`·`?area=…`)이나 마지막 노트를 지운 뒤 뒤로가기로
      실제로 닿는다. 표의 주석이 정한 규칙(`담은 오답이 아예 없는 계정만 학습 탭으로 보낸다`)을
      행동 축에서도 지킨다. 조건은 한 번만 묻는다.
    */
    const toNotebook = empty.to === 'notebook' && wrongNotes.length > 0;
    return (
      <Screen testID="student-review" backFallback="/student/learn" title={title}>
        {failureRow}
        <EmptyState
          title={empty.title}
          subtitle={empty.subtitle}
          action={
            <Button
              testID={toNotebook ? 'review-to-notebook' : 'review-to-learn'}
              variant="secondary"
              hug
              label={toNotebook ? '오답노트 보기' : '학습으로 돌아가기'}
              onPress={() =>
                router.replace((toNotebook ? '/student/notebook' : '/student/learn') as never)
              }
            />
          }
        />
      </Screen>
    );
  }

  // 마지막 카드까지 끝낸 상태
  if (!card) {
    /*
      **무엇이 헷갈렸는지 이름으로 말한다.** 예전에는 `3개는 아직 헷갈려요. 별표를 달아 두면…`
      이라고만 했다 — 화면은 그 셋이 무엇인지 알고 있으면서 말하지 않았다.

      기록을 근거로 센다(화면 로컬 상태가 아니다) — 중간에 나갔다 들어와도 같은 수가 나온다.
    */
    const missed = alive
      .map((id) => ({ note: byId.get(id)!, res: todayResult(id, noteReviews, today) }))
      .filter((r) => r.res && !r.res.isCorrect)
      .map((r) => r.note);
    const done = alive.filter((id) => todayResult(id, noteReviews, today)).length;
    const resting = missed.filter((n) => n.state === 'stuck');
    /**
     * 틀린 것 중 **내일 오지 않는** 것. `내일 다시 만나요`를 말할지 가른다.
     *
     * 상태로 세지 않는다 — 쉬는 것(`due_on`이 없다) 말고도 **차례가 아니었던 복습**이 있다.
     * 별표·영역·전체 덱은 차례를 보지 않고 열리므로 그 회차는 `due_on`을 움직이지 않고
     * (`scheduled: false`) 다음 차례가 그대로다. 서버가 정한 날짜를 그대로 읽는다.
     */
    const tomorrow = addDaysISO(today, 1);
    const notTomorrow = missed.filter((n) => n.dueOn !== tomorrow).length;
    const visibleMissed = showAllMissed ? missed : missed.slice(0, MISSED_PREVIEW);
    return (
      <Screen testID="student-review" backFallback="/student/learn" title="복습을 끝냈어요">
        {failureRow}
        <Group>
          <View style={{ padding: spacing.lg, gap: spacing.xs }}>
            <AppText variant="label">
              {done === 0
                ? '이번엔 다시 푼 문항이 없어요.'
                : `${done}개를 다시 풀었고 ${done - missed.length}개를 맞혔어요.`}
            </AppText>
            {/*
              **내일 오지 않는 카드에 `내일 다시 만나요`라고 말하지 않는다.** 쉬는 것(`due_on`이
              없다)과 차례가 아니었던 복습(`scheduled: false`) 둘 다 그렇다 — `notTomorrow`가
              그 둘을 날짜 하나로 센다. 한 흐름의 두 화면이 같은 카드의 일정을 반대로 말하던
              자리다.

              그리고 **`차례가 된 오답을 모두 봤어요`라고 단정하지 않는다.** 아래에 `남은 오답 더
              보기`가 함께 서면 두 문장이 서로를 부정한다.
            */}
            <AppText variant="caption" tone="secondary">
              {closingLine({ missed: missed.length, notTomorrow, done, remaining: pool.length })}
            </AppText>
            {resting.length > 0 ? (
              <AppText variant="caption" tone="secondary" testID="review-resting">
                {resting.length}개는 세 번 연속 헷갈려서 잠시 쉬어요. 오답노트에서 다시 넣을 수
                있어요.
              </AppText>
            ) : null}
          </View>
        </Group>

        {missed.length > 0 ? (
          <Section
            title="헷갈린 문항"
            /* 상한을 넘으면 펼친다(§8의 5줄 상한 · R2 한 벌). */
            action={
              missed.length > MISSED_PREVIEW ? (
                <Button
                  testID="review-missed-more"
                  variant="secondary"
                  size="sm"
                  tone="accent"
                  hug
                  aria-expanded={showAllMissed}
                  label={showAllMissed ? '접기' : `${missed.length - MISSED_PREVIEW}개 더 보기`}
                  onPress={() => setShowAllMissed((v) => !v)}
                />
              ) : undefined
            }
          >
            {/* 목록은 `Group`이 테두리와 행 사이 구분선을 그린다(§8). */}
            <Group>
              {visibleMissed.map((note) => (
                <Row
                  key={note.id}
                  testID={`review-missed-${note.qId}`}
                  title={note.prompt}
                  subtitle={`정답 · ${note.choices[note.answerIndex]}`}
                  /* 출처는 분류라 `meta`다. 이 목록에는 개인·학원 오답이 섞인다(§18). */
                  meta={note.source === 'academy' ? '학원 과제' : '개인 학습'}
                  showChevron
                  onPress={() => router.push(`/student/notebook?note=${note.id}` as never)}
                />
              ))}
            </Group>
            <AppText variant="caption" tone="secondary">
              오답노트에서 물어보고 메모할 수 있어요.
            </AppText>
          </Section>
        ) : null}

        {pool.length > 0 ? (
          <Group>
            <Row
              testID="review-restart"
              title="차례가 남은 오답 더 보기"
              subtitle={`${pool.length}개를 더 열어요`}
              onPress={restart}
            />
          </Group>
        ) : null}

        {/* 이 흐름을 끝내는 행동 하나만 남긴다 — 그래서 여기만 전폭 primary다(빈 덱은 `hug`). */}
        <ActionBar>
          <Button
            testID="review-done-to-learn"
            label="학습으로 돌아가기"
            onPress={() => router.replace('/student/learn' as never)}
          />
        </ActionBar>
      </Screen>
    );
  }

  /*
    **해설은 콘텐츠에만 있다** — 오답노트 행(`WrongNote`)에는 해설 필드가 없다. 콘텐츠 조회가
    실패했으면 위에서 이미 말했으므로, 여기서 `undefined`는 **이 문항에 해설이 등록되지 않았다**는
    뜻이다(`Question.explanation`은 선택 필드다).
  */
  const explanation = content?.questions.find((q) => q.id === card.qId)?.explanation;
  /*
    **서버가 돌려준 값을 읽는다.** `card`는 provider 캐시이고 `scheduled`가 거짓일 때는 갱신되지도
    않는다 — 확인 뒤 세 줄(익힘 도달 · 다음 차례 · 남은 횟수)이 캐시에 의존하면 화면과 서버가
    다른 사실을 말할 자리가 생긴다.
  */
  const left = passesLeft(checked ?? card);
  /**
   * **방금 익힘에 도달했는가.** `state === 'graduated'`만 보면 안 된다.
   *
   * 서버는 이미 졸업한 문항을 30일마다 유지 복습으로 되돌리고, 그 회차를 맞히면 `state`를 다시
   * `graduated`로(`streak`은 4·5…) 돌려준다. 그래서 상태만 보면 `서로 다른 날 세 번 맞혔어요`가
   * 유지 복습마다 되풀이되고, 이 줄이 if/else의 앞이라 **`review-next-due`가 유지 복습에서는
   * 한 번도 그려지지 않는다.** 처음 도달한 회차는 `streak`이 정확히 `GRADUATE_STREAK`이다.
   */
  const graduatedNow = Boolean(
    checked?.isCorrect && checked.scheduled && checked.streak === GRADUATE_STREAK,
  );
  /** 지금까지 이 문항을 몇 번 다시 풀었는가. 스트릭·포인트 대신 두는 사실이다. */
  const reviewCount = noteReviews[card.id]?.length ?? 0;
  /** 대리 보기에서는 이 화면의 쓰기가 전부 거부된다. 누르기 전에 한 번 말한다(§8·A-115). */
  const cannotWrite = readOnly;

  return (
    <Screen
      testID="student-review"
      backFallback="/student/learn"
      /* 카드를 넘기면 자리는 그대로이고 내용만 갈린다 — 맨 위로 되돌린다(D-095). */
      scrollResetKey={at}
      title={title}
      lead="다시 풀어 보고 정답을 확인해요."
    >
      {failureRow}

      {/*
        진행을 **읽을 수 있는 글자로** 말한다. 예전에는 `Screen`의 `eyebrow`(12px `tertiary`,
        대비 2.96:1 · AA 미달)가 유일한 진행 정보였고, 칸(`Steps`)은 13장부터 렌더되지 않아
        긴 덱에서는 그 12px 숫자 하나만 남았다.

        **칸은 끝낸 것만 칠한다**(`done={seen}`). `seen + 1`을 넘기면 아직 답하지 않은 현재 카드가
        칠해져, 마지막 카드에서 답하기 전에 칸이 전부 차고 학생이 끝난 줄 알고 나간다. 홈·풀이
        화면의 뜻(채운 칸 = 끝낸 것)과도 갈렸다.
      */}
      <View style={{ gap: spacing.sm }}>
        <Steps done={seen} total={total} />
        <AppText variant="caption" tone="secondary" testID="review-progress">
          {seen + 1}번째 카드 · 모두 {total}개
          {total - seen - 1 > 0 ? ` · ${total - seen - 1}개 남았어요` : ''}
        </AppText>
        {/*
          **무엇을 해야 하는 화면인지 첫 화면에서 말한다.** 예전에는 이 안내가 문서 맨 아래
          캡션이라 390에서 첫 화면 밖이었다 — 카드에 처음 들어온 학생 화면에는 버튼이 하나도 없고
          그 이유를 설명하는 문장도 보이지 않았다.
        */}
        {!checked ? (
          <AppText variant="caption" tone="secondary" testID="review-guide">
            {step === 'pick'
              ? explanation
                ? '답을 고르면 근거를 묻고, 확인하면 정답과 해설을 함께 볼 수 있어요.'
                : '답을 고르면 근거를 묻고, 확인하면 정답과 내 메모를 함께 볼 수 있어요.'
              : step === 'why'
                ? '근거를 고르면 확인할 수 있어요.'
                : '확인하면 답을 바꿀 수 없어요.'}
          </AppText>
        ) : null}
        {cannotWrite ? (
          <AppText variant="caption" tone="secondary" testID="review-readonly">
            대리 보기에서는 복습을 기록할 수 없어요.
          </AppText>
        ) : null}
      </View>

      {/*
        **지문은 접혀 있고 자동으로 펼치지 않는다.** 지문을 보면서 답하는 형태는 1주 후 망각이 더
        컸다(Agarwal et al. 2008). 확인 뒤 근거를 확인할 자리는 접힌 지문이 거기 있는 것으로
        충족된다 — 자동으로 펼치면 지문 높이만큼 문서가 **위에서** 자라(실측 최대 470px) 방금
        확인한 정답·해설이 화면 밖으로 밀린다. 커밋 `cb588f0`이 고친 것과 같은 계열이다.

        `key`는 카드가 아니라 **지문**이다: 같은 지문의 다음 문항으로 넘어가면 접어 둔 상태가
        그대로 남고, 다른 지문이 오면 새로 마운트된다.
      */}
      {content?.passage ? (
        <Passage key={card.contentId} passage={content.passage} collapsible defaultOpen={false} />
      ) : null}

      <View style={[styles.card, isMobile && styles.cardMobile]} testID={`review-card-${card.qId}`}>
        {/*
          **출처·영역·별표를 카드 안 첫 줄로 둔다.** 예전에는 카드 밖 형제였는데, 같은 화면에
          테두리를 가진 면이 둘(지문·문항)이라 그 줄이 어느 면의 머리인지 모양으로 알 수 없었다.
          오답노트가 `카드 첫 줄은 SourceTag다`(§17)를 그렇게 지킨다.
        */}
        <View style={styles.head}>
          <View style={styles.headMeta}>
            <SourceTag source={card.source} />
            <AppText variant="caption" tone="secondary" style={styles.headText}>
              {card.area} · {card.title}
            </AppText>
          </View>
          <IconButton
            testID={`review-star-${card.qId}`}
            inset
            name="star"
            active={card.starred}
            label={card.starred ? '별표 빼기' : '별표 달기'}
            onPress={() => void star(card)}
          />
        </View>

        <AppText variant="label">{card.prompt}</AppText>

        {/* 하나를 고르는 묶음이다. 한 화면에 묶음이 둘이라 각각 감싼다(§8 · D-166). */}
        <View
          style={{ gap: spacing.xs }}
          accessibilityRole="radiogroup"
          aria-label="답 고르기"
        >
          {order.map((original, s) => {
            const choice = card.choices[original];
            const isAnswer = original === card.answerIndex;
            const isPicked = slot === s;
            /*
              색만으로 정오를 말하지 않는다(§11). 확인한 뒤 그 줄이 무엇인지 글자로 붙인다.
              표식은 **선지 아래 줄**이다 — 같은 줄에 두면 390에서 본문 폭이 276 → 162px로
              깎여 정답 선지가 4줄이 됐다(확인 후 가장 오래 읽는 문장이다).
            */
            const mark = !checked
              ? null
              : isAnswer && isPicked
                ? '정답 · 내 답'
                : isAnswer
                  ? '정답'
                  : isPicked
                    ? '내 답'
                    : null;
            return (
              <Pressable
                key={original}
                testID={`review-choice-${s}`}
                accessibilityRole="radio"
                aria-checked={isPicked}
                accessibilityLabel={`보기 ${s + 1}`}
                /* 확인 전에는 답을 바꿀 수 있다 — 잘못 누른 것을 고칠 길이 있어야 한다. */
                disabled={Boolean(checked)}
                onPress={() => pick(s)}
                style={({ pressed }) => [
                  styles.choice,
                  isPicked && styles.choiceOn,
                  checked && isAnswer && styles.choiceAnswer,
                  pressed && !checked && !isPicked && { backgroundColor: colors.hover },
                ]}
              >
                <View style={styles.choiceRow}>
                  {/*
                    **동그라미가 함께 찬다** — 색만으로 선택을 말하지 않는다(§11·§16). 처음 푸는
                    화면(`solve`)과 같은 한 벌이다: 같은 문항의 같은 행위가 두 화면에서 다른
                    모양이면 학생이 무엇을 골랐는지 다시 확인해야 한다.
                    선지가 여러 줄이 되어도 동그라미는 첫 줄에 붙어 있어야 한다.
                  */}
                  <View style={[styles.radio, isPicked && styles.radioOn]}>
                    {isPicked ? <View style={styles.dot} /> : null}
                  </View>
                  <AppText
                    style={[
                      styles.choiceText,
                      isPicked && styles.choiceTextOn,
                      checked && isAnswer && { color: colors.success },
                      checked && !isAnswer && isPicked && { color: colors.danger },
                    ]}
                  >
                    {choice}
                  </AppText>
                </View>
                {mark ? (
                  <View style={styles.mark}>
                    <View
                      style={[
                        styles.markDot,
                        { backgroundColor: isAnswer ? colors.success : colors.danger },
                      ]}
                    />
                    <AppText
                      variant="caption"
                      style={{
                        color: isAnswer ? colors.success : colors.danger,
                        fontFamily: typeface.medium,
                      }}
                    >
                      {mark}
                    </AppText>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {/*
          **근거는 답을 확인하기 전에 묻는다.** 확인한 뒤에는 되짚을 수 없는 값이다 — 정답을 본
          다음에는 「지문에서 찾았다」고 답하게 된다.

          **선지와 다른 형태로 둔다.** 예전에는 선지와 같은 스타일이라 한 카드에 같은 모양의
          라디오 두 벌이 서고 어느 것이 답이고 어느 것이 근거인지 모양으로 갈리지 않았다.
          구분선 + 라벨 무게 + 동그라미 없는 줄로 가른다.

          확신도 슬라이더가 아니다. 일반 객관식에 확신도 평정만 덧붙이는 것은 실험에서 이득이
          없었다(32.1% vs 32.7%, n.s. — Sparck, Bjork & Bjork 2016). 이 3택은 정보량이 있고 찍어서
          맞힌 회차를 숙달로 세지 않는 데 쓰이지만, **효과크기로 뒷받침되지는 않는다.**
        */}
        {step === 'why' || step === 'confirm' ? (
          <View style={{ gap: spacing.sm }} testID="review-evidence">
            <Divider />
            <AppText variant="label">{evidenceQuestion(hasPassage)}</AppText>
            <View style={{ gap: spacing.xs }} accessibilityRole="radiogroup" aria-label="근거 고르기">
              {EVIDENCE_ORDER.map((key) => (
                <Pressable
                  key={key}
                  testID={`review-evidence-${key}`}
                  accessibilityRole="radio"
                  aria-checked={pickedEvidence === key}
                  onPress={() => chooseEvidence(key)}
                  style={({ pressed }) => [
                    styles.reason,
                    pickedEvidence === key && styles.reasonOn,
                    pressed && pickedEvidence !== key && { backgroundColor: colors.hover },
                  ]}
                >
                  <AppText
                    style={[styles.reasonText, pickedEvidence === key && styles.choiceTextOn]}
                  >
                    {labels[key]}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/*
          **모르는 문항을 넘길 수 있다**(A-114). 예전에는 답을 고르지 않으면 넘길 버튼이 렌더되지
          않아 좌상단 뒤로가기(= 세션 폐기)가 유일한 출구였다.

          **이 카드에 딸린 행동이라 카드 안에 둔다**(`ActionBar` 규칙 4). **기본 44다** —
          카드마다 반복되는 행동에는 `sm`(32)을 쓰지 않는다(§8·§10). 오답노트의
          `다시 복습 목록에 넣기`가 같은 이유로 기본 크기다.
        */}
        {!checked ? (
          <View style={{ gap: 6 }}>
            <Button
              testID="review-skip"
              variant="secondary"
              hug
              label="이 문항은 건너뛰기"
              onPress={() => void skip()}
            />
            <AppText variant="caption" tone="secondary">
              건너뛴 문항은 기록에 남지 않고 내일 다시 나와요.
            </AppText>
          </View>
        ) : null}

        {checked ? (
          <View style={{ gap: spacing.sm }} testID="review-feedback">
            <Divider />
            <AppText
              variant="label"
              style={{ color: checked.isCorrect ? colors.success : colors.danger }}
            >
              {checked.isCorrect ? '이번엔 맞혔어요.' : '아직 헷갈려요.'}
            </AppText>
            {/*
              **`정답 · …`을 여기서 또 말하지 않는다.** 바로 위 선지에 `정답` 표식이 이미 붙어
              있다(§14 — 한 사실은 한 자리에서만 말한다). 대신 **이번 답과 처음 답을 같은 형식으로
              나란히** 둔다 — 이름이 짝을 이루면 무엇이 달라졌는지 한 줄에서 읽힌다.
            */}
            {pickedOriginal != null ? (
              <AppText variant="caption" tone="secondary">
                이번 답 · {card.choices[pickedOriginal]}
              </AppText>
            ) : null}
            {card.pickedIndex != null ? (
              <AppText variant="caption" tone="secondary">
                처음 답 · {card.choices[card.pickedIndex]}
              </AppText>
            ) : null}

            {/*
              **왜 틀렸는지는 이 자리에서 말한다.** 정오만 알려주는 피드백은 d=0.05로 사실상
              효과가 없고 설명 피드백은 0.49다(Van der Kleij et al. 2015).

              **접지 않는다.** 해설은 한두 문장이고 이 화면에 온 목적 자체다.
            */}
            {explanation ? (
              <View style={{ gap: 4 }} testID="review-explanation">
                <AppText variant="caption" tone="secondary" weight="semibold">
                  해설
                </AppText>
                <AppText tone="secondary">{explanation}</AppText>
              </View>
            ) : null}

            {/*
              **다음 차례를 말한다.** 단계 숫자나 강등은 말하지 않는다 — 감점으로 읽히면 복습
              동기를 깎는다.

              **익힌 순간을 조용히 알린다.** 앱이 학생에게 제시하는 유일한 목표가 `연속 3번`인데
              도달하는 순간 그 접미사가 사라지는 것이 전부였다. 폭죽·배지는 두지 않는다(§9).

              **차례가 아닌 복습은 다음 차례를 움직이지 않는다**(`scheduled: false`) — 그 사실을
              말하지 않으면 학생은 방금 푼 것이 왜 일정에 반영되지 않는지 알 수 없다.
            */}
            {graduatedNow ? (
              <AppText variant="caption" tone="accent" testID="review-graduated">
                서로 다른 날 세 번 맞혔어요. 이제 한 달에 한 번만 확인해요.
              </AppText>
            ) : (
              <AppText variant="caption" tone="secondary" testID="review-next-due">
                {checked.scheduled
                  ? nextReviewLabel(checked, today)
                  : '차례가 아닌 복습이라 다음 차례는 그대로예요.'}
                {checked.scheduled && left > 0 && checked.state !== 'stuck'
                  ? ` · 다른 날에 ${left}번 더 맞히면 다 익힌 것으로 볼게요`
                  : ''}
              </AppText>
            )}
            {reviewCount > 0 ? (
              <AppText variant="caption" tone="secondary" testID="review-count">
                지금까지 {reviewCount}번 다시 풀었어요.
              </AppText>
            ) : null}

            {/*
              **무엇이 공개되는지 쓰기 전에 말한다**(D-110·D-054). 문장은 오답노트·결과 화면과
              한 글자도 다르지 않게 쓴다.
            */}
            {card.source === 'academy' ? (
              <AppText variant="caption" tone="secondary">
                {ACADEMY_MEMO_NOTICE}
              </AppText>
            ) : null}

            {/*
              **가린 것과 없는 것을 구분한다.** 대리 보기에서 메모를 가리는데(`maskDig`) 값만
              지우면 화면이 `아직 메모가 없어요`로 단정한다.
            */}
            {card.digHidden ? (
              <AppText variant="caption" tone="secondary">
                메모는 대리 보기에서 보이지 않아요.
              </AppText>
            ) : card.dig ? (
              <View style={{ gap: 4 }}>
                <AppText variant="caption" tone="accent" style={{ fontFamily: typeface.semibold }}>
                  내 오답노트 메모
                </AppText>
                <RichText text={card.dig} />
              </View>
            ) : (
              <AppText variant="caption" tone="secondary">
                아직 메모가 없어요. 아래에서 물어보고 정리해 둘 수 있어요.
              </AppText>
            )}

            {/*
              **한 줄은 선택이다.** 자기설명은 g=0.55지만(Bisra et al. 2018) 쓰기를 강제하면 복습이
              노동이 된다 — 한국에서 종이 오답노트가 실패한 단일 원인이다. 안 쓰고 넘겨도 아무 말을
              하지 않고, **쓴 것은 넘길 때 저장한다**(`nextCard`).

              문구가 정오로 갈린다 — 틀린 학생에게 "정답이 왜 정답인지 쓰라"고 하면 방금 읽은
              해설을 옮기게 된다. 자기설명의 자리는 **내 오답의 원인**이다.

              저장한 뒤에는 **쓴 문장을 그대로 보여 준다.** 어디로 갔는지 모르는 입력이 되지 않게.
            */}
            {recapSaved ? (
              <View style={{ gap: 4 }} testID="review-recap-done">
                <AppText variant="caption" tone="accent" style={{ fontFamily: typeface.semibold }}>
                  내 말로 쓴 한 줄
                </AppText>
                <AppText tone="secondary">{recapSaved}</AppText>
              </View>
            ) : cannotWrite ? null : (
              <View style={{ gap: 6 }}>
                <AppText variant="caption" tone="secondary" weight="semibold">
                  내 말로 한 줄
                </AppText>
                <AppText variant="caption" tone="secondary">
                  안 써도 괜찮아요. 다음 문제로 넘기면 저장돼요.
                </AppText>
                <AskField
                  testID="review-recap"
                  sendTestID="review-recap-save"
                  sendLabel="한 줄 저장"
                  accessibilityLabel="내 말로 한 줄"
                  maxHeight={120}
                  value={recap}
                  onChangeText={(t) => patchCard(card.id, { recap: t })}
                  onSubmit={() => void saveRecap()}
                  placeholder={
                    checked.isCorrect ? '왜 이게 답인지 한 줄로' : '내가 왜 그 선지를 골랐는지 한 줄로'
                  }
                />
              </View>
            )}
          </View>
        ) : null}
      </View>

      {/*
        **화면의 주 행동은 하나이고 질문 섹션보다 위에 있다.**

        예전에는 `다음 문제`가 `질문하고 메모하기` 섹션 **뒤**에 렌더돼, 섹션 밖으로 뺐어도
        문서 순서상 두 입력창 아래였다(`ActionBar`는 고정 바가 아니다). 물어볼 것이 없는 학생도
        카드마다 약 2화면을 내려가야 다음 카드로 갔다 — A-109가 적은 결함과 같은 동작이다.
        질문·메모는 "더 파고들 사람만 내려가는" 자리로 아래 남는다.

        확인 전에는 `확인하기`, 확인 뒤에는 `다음 문제`다 — 같은 자리에서 라벨만 바뀐다.
      */}
      {checked ? (
        <ActionBar>
          <Button
            testID="review-next"
            label={seen + 1 < total ? '다음 문제' : '복습 마치기'}
            trailing={<Icon name="arrow-right" size={16} color={colors.accentText} />}
            accessibilityLabel={seen + 1 < total ? '다음 문제' : '복습 마치기'}
            onPress={nextCard}
          />
        </ActionBar>
      ) : step === 'confirm' && !cannotWrite ? (
        /*
          **조건이 갖춰질 때만 그린다.** 답이나 근거가 없을 때 이 버튼을 꺼서 두면 눌러도 아무
          일이 없는 버튼이 된다(§8 · D-036 — 이 시스템의 `Button`에 `disabled`가 없는 이유다).
          대리 보기에서도 그리지 않는다 — 서버가 거부하므로 영구히 실패하는 버튼이다.
        */
        <ActionBar>
          <Button
            testID="review-check"
            label={saving ? '확인하는 중이에요' : '확인하기'}
            onPress={() => void check()}
          />
        </ActionBar>
      ) : null}

      {/* 실패는 인라인 캡션으로 남긴다 — 토스트는 2.4초 뒤 사라지고 이유가 화면에 없었다(§9). */}
      {checkError ? (
        <AppText variant="caption" tone="danger" testID="review-check-failed">
          {checkError}
        </AppText>
      ) : null}

      {checked && !cannotWrite ? (
        <Section
          /* **오답노트와 같은 이름을 쓴다**(D-150). 여기서 하는 일이 오답노트에서 하는 일과 같다. */
          title="질문하고 메모하기"
          action={
            messages.length > 0 ? (
              <Button
                testID="review-save-memo"
                variant="secondary"
                size="sm"
                tone="accent"
                hug
                /*
                  **라벨이 결과를 말한다.** 이 화면의 대화는 카드를 넘길 때마다 비므로, 오답노트에서
                  여러 번 물어 만든 긴 메모가 여기서 한 문답의 요약으로 **교체**된다. 학원 오답이면
                  담당 선생님이 보고 있던 값이다(D-054).
                */
                label={card.dig ? '대화 내용으로 메모 다시 쓰기' : '노트에 정리해 두기'}
                onPress={() => {
                  // 덮어쓸 것이 없으면 바로 저장한다. 확인 단계는 잃을 것이 있을 때만 둔다.
                  if (card.dig) patchCard(card.id, { confirmMemo: true });
                  else void saveMemo();
                }}
              />
            ) : undefined
          }
        >
          {cs?.confirmMemo ? (
            <ConfirmStep
              message="지금 오답노트에 있는 메모가 이 대화의 요약으로 바뀌어요. 되돌릴 수 없어요."
              confirmLabel="새로 쓰기"
              confirmTestID="review-save-memo-confirm"
              confirmAccessibilityLabel="대화 내용으로 메모 다시 쓰기"
              destructive
              onCancel={() => patchCard(card.id, { confirmMemo: false })}
              onConfirm={() => {
                patchCard(card.id, { confirmMemo: false });
                void saveMemo();
              }}
            />
          ) : null}
          {messages.map((m, i) => (
            <View key={i} style={{ gap: 6 }}>
              {/* 누가 한 말인지 가리는 이름표다. 읽혀야 하므로 `secondary`(A-123). */}
              <AppText variant="caption" tone="secondary">
                나
              </AppText>
              <AppText>{m.q}</AppText>
              <AppText variant="caption" tone="accent" style={{ fontFamily: typeface.semibold }}>
                Scody AI
              </AppText>
              <RichText text={m.a} />
            </View>
          ))}
          {busy || live ? (
            <View style={{ gap: 6 }} testID="review-stream">
              <AppText variant="caption" tone="accent" style={{ fontFamily: typeface.semibold }}>
                Scody AI
              </AppText>
              {/* 첫 조각이 오기 전에도 진행을 말한다(D-108 — 오답노트와 같은 문장). */}
              {live ? (
                <RichText text={live} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  {/* 상태를 말하는 유일한 문장이다 — `tertiary`는 AA 미달(A-123). */}
                  <AppText tone="secondary">답을 쓰고 있어요</AppText>
                  <MotionAsset name="pending" testID="review-pending-motion" />
                </View>
              )}
            </View>
          ) : null}

          {/* 실패는 답변이 아니라 사람 문장 한 줄로 말한다(§9). 쓴 질문은 입력창에 남아 있다. */}
          {askFailed ? (
            <AppText variant="caption" tone="danger" testID="review-ask-failed">
              지금은 답하지 못했어요. 잠시 뒤 다시 물어봐 주세요.
            </AppText>
          ) : null}

          <AskField
            testID="review-ask"
            sendTestID="review-send"
            accessibilityLabel="복습 질문 입력"
            value={question}
            onChangeText={setQuestion}
            onSubmit={ask}
            busy={busy}
            placeholder="이 문제, 어디가 헷갈리나요?"
          />
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.md,
  },
  /*
    390에서 좌우 24 + 24를 그대로 쓰면 358 중 48(13%)이 여백이고 선지 글자 폭이 276px(약 18자/줄)로
    눌린다. `Screen`이 같은 이유로 모바일에서 `xl → lg`를 쓴다(§10).
  */
  cardMobile: { padding: spacing.lg },
  head: {
    flexDirection: 'row',
    /*
      **아이콘을 첫 줄에 고정한다**(§17 · D-109). 세로 가운데에 두면 390에서 `{영역} · {제목}`이
      두 줄이 될 때 별표가 그 가운데에 걸려 스크롤하다 스친다.
    */
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headMeta: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  headText: { flex: 1 },
  choice: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    // 표식은 선지 아래 줄이다 — 같은 줄에 두면 390에서 본문 폭이 절반으로 깎인다.
    gap: 6,
  },
  choiceRow: {
    flexDirection: 'row',
    // 선지가 두 줄이 되어도 동그라미는 첫 줄에 붙어 있어야 한다.
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  choiceText: { flex: 1, color: colors.ink },
  choiceTextOn: { fontFamily: typeface.medium },
  choiceOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  choiceAnswer: { borderColor: colors.success },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  radioOn: { borderColor: colors.accent },
  dot: { width: 11, height: 11, borderRadius: radius.pill, backgroundColor: colors.accent },
  mark: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 34 },
  markDot: { width: 6, height: 6, borderRadius: 3 },
  /*
    근거 3택은 **선지와 다른 형태**다. 같은 스타일을 쓰면 한 카드에 같은 모양의 라디오 두 벌이
    서고 어느 것이 답이고 어느 것이 근거인지 모양으로 갈리지 않는다. 동그라미를 두지 않고
    선택은 면과 글자 무게로 말한다.
  */
  reason: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.offset,
  },
  reasonOn: { backgroundColor: colors.accentSoft },
  reasonText: {
    color: colors.ink,
    fontSize: font.size.base,
    lineHeight: font.size.base * font.lineHeight.normal,
  },
});
