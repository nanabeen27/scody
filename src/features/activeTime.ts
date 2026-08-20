import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { logStudyTime } from '@/repo/records';
import { now } from './clock';

/**
 * 실제 학습 시간을 잰다. **화면을 열어 둔 시간이 아니다.**
 *
 * ## 왜 벽시계를 버리는가
 *
 * 풀이 화면은 마운트 시각을 한 번 잡고 제출에서 뺐다(`startRef`). 탭을 열어 둔 채 세 시간 뒤에
 * 제출하면 `10800초`가 기록되고, 학부모 화면이 그 값을 **실제 학습 시간**이라고 부른다.
 * 그것은 측정이 아니라 추측이고, 이 시스템에서 학부모에게 주려는 것은 신뢰다.
 *
 * ## 무엇을 세는가
 *
 * **활동이 있는 동안만** 센다. 마지막 활동으로부터 `IDLE_MS` 안에 있고 화면이 앞에 있을 때만
 * 시간이 자란다. `IDLE_MS`가 0이 아닌 이유: 지문을 읽는 동안에는 아무 이벤트도 나지 않는다.
 * 읽기는 공부이므로 마지막 활동 뒤 1분까지는 계속 세고, 그 뒤로는 자리를 떠났다고 본다.
 *
 * `MAX_TICK_MS`가 두 번째 방어선이다. 브라우저는 보이지 않는 탭의 타이머를 분 단위로 늦추므로,
 * 한 번의 tick이 실제로는 60초 뒤에 올 수 있다. 그때 `now - lastTickAt`을 그대로 더하면 백그라운드
 * 시간이 학습 시간으로 들어온다 — 한 tick이 더할 수 있는 양을 tick 간격의 두 배로 묶는다.
 *
 * ## 왜 순수 함수로 갈라 두는가
 *
 * 시간 계산은 단위 테스트로 고정해야 하는 규칙이다(`__tests__/records.test.ts`). 훅 안에 있으면
 * 타이머와 플랫폼 이벤트를 흉내 내야 확인할 수 있다.
 */

/** 마지막 활동 뒤로 이만큼까지는 계속 센다. */
export const IDLE_MS = 60_000;
/** 재는 간격. */
export const TICK_MS = 1_000;
/** 한 tick이 더할 수 있는 최대. 백그라운드 스로틀이 만든 큰 간격을 여기서 자른다. */
export const MAX_TICK_MS = TICK_MS * 2;
/** 이만큼 모이면 서버로 보낸다. */
export const FLUSH_SEC = 60;

export interface ActiveTimeState {
  /** 지금까지 센 활동 시간(ms). */
  activeMs: number;
  /** 마지막으로 tick한 시각. */
  lastTickAt: number;
  /** 마지막 활동 시각. */
  lastActivityAt: number;
  /** 서버에 보낸 초. `activeMs`에서 이만큼은 이미 기록됐다. */
  flushedSec: number;
}

export function initActiveTime(atMs: number): ActiveTimeState {
  return { activeMs: 0, lastTickAt: atMs, lastActivityAt: atMs, flushedSec: 0 };
}

/**
 * 한 번의 tick. **`lastTickAt`은 세지 않아도 항상 전진한다** — 멈춰 두면 다음 tick이 유휴 구간까지
 * 한꺼번에 더한다(`MAX_TICK_MS`가 그것을 2초로 자르지만, 그 2초도 세지 않아야 하는 시간이다).
 */
export function tickActiveTime(
  state: ActiveTimeState,
  atMs: number,
  foreground: boolean,
): ActiveTimeState {
  const elapsed = Math.min(Math.max(atMs - state.lastTickAt, 0), MAX_TICK_MS);
  const awake = foreground && atMs - state.lastActivityAt <= IDLE_MS;
  return {
    ...state,
    activeMs: awake ? state.activeMs + elapsed : state.activeMs,
    lastTickAt: atMs,
  };
}

/** 활동이 있었다고 표시한다. 이 시각으로부터 `IDLE_MS`까지 시간이 자란다. */
export function noteActivity(state: ActiveTimeState, atMs: number): ActiveTimeState {
  return { ...state, lastActivityAt: atMs };
}

/** 지금까지 센 활동 시간(초). 화면과 제출이 쓰는 값이다. */
export function activeSeconds(state: ActiveTimeState): number {
  return Math.floor(state.activeMs / 1000);
}

/** 아직 서버에 보내지 않은 초. */
export function pendingSeconds(state: ActiveTimeState): number {
  return Math.max(0, activeSeconds(state) - state.flushedSec);
}

/** 화면이 앞에 있는가. 웹은 탭 가시성, 네이티브는 앱 상태다. */
function foreground(): boolean {
  if (Platform.OS === 'web') {
    // SSR·테스트 환경에는 `document`가 없다. 그때는 앞에 있다고 본다(세지 않으면 0이 된다).
    if (typeof document === 'undefined') return true;
    return document.visibilityState !== 'hidden';
  }
  return AppState.currentState === 'active';
}

/**
 * 웹에서 사람이 실제로 무언가 하고 있다는 신호.
 *
 * `mousemove`는 넣지 않는다 — 지나가는 커서 한 번이 유휴 창을 1분 늘린다. 스크롤·키·누름은
 * 사람이 화면을 다루고 있다는 뜻이고, 지문을 읽는 동안 나오는 이벤트가 스크롤이다.
 *
 * **`scroll`은 등록하지 않는다.** 본문은 `Screen`의 `ScrollView`(웹에서 `overflow:auto` div)
 * 안이고 `scroll` 이벤트는 **버블하지 않아** document 리스너에 닿지 않는다 — 죽은 등록이었다.
 * 지문을 읽는 중의 유휴 창 연장은 실제로 `wheel`(데스크톱)과 `touchstart`(모바일)가 맡는다.
 */
const WEB_ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

export interface ActiveTimeHandle {
  /** 활동이 있었다고 알린다. 학습 화면의 상호작용에서 부른다. */
  ping: () => void;
  /** 지금까지 센 활동 시간(초). */
  seconds: () => number;
  /** 아직 보내지 않은 시간을 지금 보낸다. 제출 직전에 부른다. */
  flush: () => Promise<void>;
}

/**
 * 학습 화면의 활동 시간을 재서 서버에 쌓는다.
 *
 * **상태를 `useRef`에만 둔다.** 1초마다 리렌더하면 풀이 화면의 지문·문항이 매초 다시 그려진다 —
 * 이 값은 화면을 바꾸지 않고 제출과 서버 기록에만 쓰인다.
 *
 * @param kind 어느 화면인가. 나중에 화면별 시간을 갈라 보기 위해 남는다.
 * @param refId 되짚을 대상(콘텐츠 세트 id·노트 id). 없어도 된다.
 * @param enabled 끄면 재지 않는다 — 읽는 중·실패 화면에서 시간이 자라지 않게 한다.
 */
export function useActiveTime(
  kind: 'solve' | 'review',
  refId?: string,
  enabled = true,
): ActiveTimeHandle {
  const state = useRef<ActiveTimeState>(initActiveTime(now()));
  /** 보내는 중. 같은 시간을 두 번 보내지 않는다(중복 집계를 막는 자리다). */
  const sending = useRef(false);

  const ping = useCallback(() => {
    state.current = noteActivity(state.current, now());
  }, []);

  const seconds = useCallback(() => activeSeconds(state.current), []);

  const flush = useCallback(async () => {
    if (sending.current) return;
    const pending = pendingSeconds(state.current);
    if (pending <= 0) return;
    sending.current = true;
    try {
      const written = await logStudyTime(kind, pending, refId);
      /*
        **서버가 실제로 넣은 초만 보냈다고 센다.** 하루 상한에 걸려 깎였으면 그 차이는 다시
        보내지 않는다 — 상한은 서버가 정하는 사실이고, 남겨 두면 매 tick마다 같은 값을 다시
        보낸다. 실패했으면 `flushedSec`이 그대로라 다음 flush가 함께 보낸다.
      */
      if (written > 0) {
        state.current = { ...state.current, flushedSec: state.current.flushedSec + written };
      } else if (written === 0) {
        // 상한을 채웠다. 더 보내도 0이므로 이미 기록된 것으로 취급해 왕복을 멈춘다.
        state.current = { ...state.current, flushedSec: activeSeconds(state.current) };
      }
    } catch {
      // 다음 flush가 다시 시도한다. 학습을 막을 이유가 없어 화면에 알리지 않는다.
    } finally {
      sending.current = false;
    }
  }, [kind, refId]);

  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      state.current = tickActiveTime(state.current, now(), foreground());
      if (pendingSeconds(state.current) >= FLUSH_SEC) void flush();
    }, TICK_MS);

    /*
      **화면을 떠날 때 남은 시간을 보낸다.** 제출하지 않고 나간 학습의 시간도 그 날의 기록이다 —
      절반쯤 풀다 그만둔 30분을 0으로 세면 `실제 학습 시간`이 실제보다 작아진다.
    */
    const onHide = () => {
      state.current = tickActiveTime(state.current, now(), foreground());
      void flush();
    };

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const onActivity = () => ping();
      for (const name of WEB_ACTIVITY_EVENTS) {
        document.addEventListener(name, onActivity, { passive: true });
      }
      document.addEventListener('visibilitychange', onHide);
      return () => {
        clearInterval(timer);
        for (const name of WEB_ACTIVITY_EVENTS) document.removeEventListener(name, onActivity);
        document.removeEventListener('visibilitychange', onHide);
        onHide();
      };
    }

    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') onHide();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
      onHide();
    };
  }, [enabled, flush, ping]);

  return { ping, seconds, flush };
}
