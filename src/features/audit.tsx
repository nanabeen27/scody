import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { errorMessage } from '@/lib/supabase';
import * as repo from '@/repo/ops';
import { useSession } from '@/session';

/**
 * 운영자 행동 기록(감사 로그).
 *
 * 요금 정책 변경·문제 등록처럼 서비스 전체에 영향을 주는 조작은 누가 언제 무엇을 바꿨는지
 * 남긴다. 관리자 화면에서 되짚을 수 있어야 한다.
 *
 * **기록은 서버에 남는다**(`audit_logs`). 이 provider는 메모리 저장소였다 — 새로고침하면
 * 감사 로그가 전부 사라졌고, 접속기록이 사라지는 것은 기록이 없는 것과 같다. 지금은 넣을 수만
 * 있고 고치거나 지우는 경로가 서버에 없다(append-only). 시각도 서버가 정한다.
 *
 * **분류를 미리 늘려 두지 않는다.** 호출부가 없는 분류는 영구히 0건이고, 그것을 필터 칩으로
 * 두면 눌러도 빈 목록만 나오는 죽은 버튼이 된다(D-036·D-042와 같은 판단). 그래서
 * `app/admin/ops.tsx`는 **기록이 실제로 생긴 분류만** 칩으로 그린다.
 *
 * **`SessionProvider` 안에 둔다**(D-116). 쓰기를 들고 있는 provider는 로그인한 사람을 알아야
 * 한다 — 읽기가 `is_admin()`이라 계정이 바뀌면 다시 읽어야 하고, `session.tsx`는 여전히 이
 * provider를 부르지 않는다(대리 보기 종료 정보를 호출부에 돌려준다).
 */

export type AuditAction = repo.AuditAction;
export type AuditEntry = repo.AuditEntry;
export type WriteResult = repo.WriteResult;

export const AUDIT_LIMIT = repo.AUDIT_LIMIT;

interface AuditValue {
  /** 최근 기록(최대 `AUDIT_LIMIT`건). 새것부터. 운영자가 아니면 비어 있다. */
  entries: AuditEntry[];
  /** 첫 조회가 끝나기 전에는 참이다. 화면이 `기록이 없어요`라고 말하지 않게. */
  loading: boolean;
  /**
   * 기록 한 줄을 남긴다.
   *
   * 성공하면 목록을 서버에서 다시 읽는다 — 화면에 붙여만 두면 방금 남긴 줄의 id·시각이
   * 서버 값과 다른 채로 남는다.
   */
  log: (entry: Omit<AuditEntry, 'id' | 'atISO'>) => Promise<WriteResult>;
}

const AuditContext = createContext<AuditValue | null>(null);

export function AuditProvider({ children }: { children: ReactNode }) {
  const { account } = useSession();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  /** 다시 읽기 신호. 값이 바뀌면 아래 효과가 다시 돈다. */
  const [nonce, setNonce] = useState(0);

  /*
    로그인한 사람이 바뀌면 다시 읽는다 — 읽기가 `is_admin()`이라 운영자에게만 결과가 있다.
    로그아웃하면 비운다.

    **모든 setState가 비동기 콜백 안에 있다.** 효과 본문에서 곧바로 부르면 렌더가 한 번 더 돌고
    린트가 그것을 막는다.
  */
  useEffect(() => {
    let alive = true;
    void (async () => {
      let next: AuditEntry[] = [];
      if (account) {
        /*
          **조회를 시작할 때 다시 `loading`으로 돌린다.** 계정이 없는 첫 렌더에서 false로
          내려 두면 로그인 뒤 조회가 도는 동안에도 false로 남아, 화면이 빈 목록을
          `아직 기록이 없어요`라고 말한다(`content.tsx`와 같은 이유).
        */
        await Promise.resolve();
        if (!alive) return;
        setLoading(true);
        try {
          /*
            **운영자만 읽는다.** `audit_logs`의 select 정책이 `is_admin()`이라 다른 역할에는
            언제나 빈 배열이 온다 — 학생·학부모·선생 로그인이 그 사실을 확인하려고 앱 루트에서
            왕복 한 번을 쓸 이유가 없다(`progress.tsx`의 `isAcademy` 분기와 같은 판단).
          */
          next = account.roles.includes('admin') ? await repo.listAuditLogs() : [];
        } catch (e) {
          console.warn('운영 기록을 읽지 못했어요:', errorMessage(e));
          return;
        } finally {
          if (alive) setLoading(false);
        }
      }
      if (alive) {
        setEntries(next);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [account, nonce]);

  const log = useCallback<AuditValue['log']>(async (entry) => {
    const res = await repo.writeAuditLog(entry);
    if (!res.ok) {
      console.warn('운영 기록을 남기지 못했어요:', res.error);
      return res;
    }
    setNonce((n) => n + 1);
    return res;
  }, []);

  const value = useMemo(() => ({ entries, loading, log }), [entries, loading, log]);
  return <AuditContext.Provider value={value}>{children}</AuditContext.Provider>;
}

export function useAudit(): AuditValue {
  const ctx = useContext(AuditContext);
  if (!ctx) throw new Error('useAudit must be used within AuditProvider');
  return ctx;
}

/** 목록에 보여줄 시각 표기: `07-27 14:03`. */
export function auditTime(atISO: string): string {
  const [date, time] = atISO.split('T');
  const [, m, d] = date.split('-');
  return `${m}-${d} ${time?.slice(0, 5) ?? ''}`;
}
