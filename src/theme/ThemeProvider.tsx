import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { FOCUS_CSS, THEME_CSS } from './palette';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeValue {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  cycle: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

const ORDER: ThemeMode[] = ['system', 'light', 'dark'];

function injectCss() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById('sc-theme-vars')) return;
  const style = document.createElement('style');
  style.id = 'sc-theme-vars';
  // 팔레트와 포커스 링을 같은 자리에서 넣는다. 둘 다 CSS 변수를 쓰므로 테마 전환이 그대로 먹는다.
  style.textContent = THEME_CSS + FOCUS_CSS;
  document.head.appendChild(style);
}

function applyMode(mode: ThemeMode) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
}

/** 라이트/다크 테마 제공. 웹은 CSS 변수 + data-theme으로 즉시 전환. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // 기본은 라이트. 시스템 설정을 따르려면 사용자가 직접 '시스템'으로 바꾼다.
  const [mode, setModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    injectCss();
  }, []);
  useEffect(() => {
    applyMode(mode);
  }, [mode]);

  const setMode = useCallback((m: ThemeMode) => setModeState(m), []);
  const cycle = useCallback(
    () => setModeState((m) => ORDER[(ORDER.indexOf(m) + 1) % ORDER.length]),
    [],
  );

  const value = useMemo(() => ({ mode, setMode, cycle }), [mode, setMode, cycle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export const THEME_LABEL: Record<ThemeMode, string> = {
  system: '시스템',
  light: '라이트',
  dark: '다크',
};
