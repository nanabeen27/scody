import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { LiveRegion, Toast, type ToastAction, type ToastKind } from '@/components';

interface ToastApi {
  /**
   * 한 줄 알림을 띄운다. 같은 문장을 연달아 띄워도 다시 보인다.
   *
   * `action`을 주면 누를 수 있는 버튼이 하나 붙고 알림이 더 오래 머문다.
   * 되돌릴 수 있는 지우기가 여기에 해당한다(D-091).
   */
  show: (message: string, kind?: ToastKind, action?: ToastAction) => void;
}

const Ctx = createContext<ToastApi>({ show: () => {} });

/**
 * 화면 아래 한 줄 알림을 한곳에서 그린다.
 *
 * 여러 화면이 같은 알림을 쓰기 때문에 provider로 올렸다. 화면마다 상태를 들고
 * `Screen` 밖에 토스트를 두려면 화면마다 감싸는 구조를 바꿔야 했다.
 * 알림은 화면 위에 떠 있고 누름을 막지 않으므로 어느 화면에서 띄워도 같다.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  // `n`은 같은 문장을 다시 띄우기 위한 카운터다. `key`로 넘겨 애니메이션을 다시 시작한다.
  const [state, setState] = useState<{
    message: string | null;
    kind: ToastKind;
    action: ToastAction | null;
    n: number;
  }>({ message: null, kind: 'added', action: null, n: 0 });

  const show = useCallback((message: string, kind: ToastKind = 'added', action?: ToastAction) => {
    setState((prev) => ({ message, kind, action: action ?? null, n: prev.n + 1 }));
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {/*
        스크린리더용. **항상 렌더된 채로 있어야** 문구가 바뀔 때 읽힌다 —
        `Toast`는 `key`로 다시 마운트되므로 여기에 둘 수 없다.
      */}
      <LiveRegion message={state.message} assertive={!!state.action} />
      <Toast
        key={state.n}
        testID="toast"
        message={state.message}
        kind={state.kind}
        action={state.action}
        onHide={() => setState((prev) => ({ ...prev, message: null, action: null }))}
      />
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(Ctx);
}
