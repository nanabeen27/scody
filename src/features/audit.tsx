import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * 운영자 행동 기록(감사 로그).
 *
 * 요금 정책 변경·콘텐츠 공개 전환처럼 서비스 전체에 영향을 주는 조작은
 * 누가 언제 무엇을 바꿨는지 남긴다. 관리자 화면에서 되짚을 수 있어야 한다.
 *
 * 프로토타입 경계: 메모리에만 남고 새로고침하면 사라진다.
 * 운영에서는 서버가 기록하고 지울 수 없어야 한다(감사 로그는 append-only).
 */

export type AuditAction = '요금 정책' | '콘텐츠' | '계정' | '기타';

export interface AuditEntry {
  id: string;
  /** 발생 시각. `YYYY-MM-DDTHH:mm:ss` 형태의 로컬 시간 문자열. */
  atISO: string;
  /** 행동한 사람(계정 이름). */
  actor: string;
  /** 행동 분류. 목록에서 필터로 쓴다. */
  action: AuditAction;
  /** 사람이 읽는 한 줄 설명. */
  detail: string;
}

interface AuditValue {
  entries: AuditEntry[];
  log: (entry: Omit<AuditEntry, 'id' | 'atISO'>) => void;
}

const AuditContext = createContext<AuditValue | null>(null);

/** `YYYY-MM-DDTHH:mm:ss`. 초까지만 남긴다(밀리초는 목록에서 의미 없다). */
function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:${p(d.getSeconds())}`;
}

export function AuditProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  const log = useCallback((entry: Omit<AuditEntry, 'id' | 'atISO'>) => {
    setEntries((prev) => [
      { ...entry, id: `audit_${prev.length + 1}`, atISO: stamp() },
      ...prev,
    ]);
  }, []);

  const value = useMemo(() => ({ entries, log }), [entries, log]);
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
