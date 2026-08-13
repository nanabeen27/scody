import { createContext, useContext } from 'react';
import { columnBreakpoints } from './tokens';
import { useResponsive, type Device } from './useResponsive';

const ColumnWidth = createContext<number>(0);
export const ColumnWidthProvider = ColumnWidth.Provider;

export interface Column {
  width: number;
  device: Device;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

/**
 * **본문 컬럼**의 폭. 창 폭이 아니다.
 *
 * 데스크톱은 사이드바(248)와 좌우 여백을 뺀 뒤 `contentMaxWidth`(680)·`wideMaxWidth`(960)에서
 * 멈춘다. 1100px 창의 표가 스스로를 "데스크톱"이라 여겨 열을 다 펼친 뒤 자기 안에서 가로로
 * 스크롤하던 것이 창 폭과 컬럼 폭의 이 차이 때문이다.
 *
 * 값이 0이면 아직 컬럼 안이 아니다(랜딩·인증 화면) — 그때는 창 폭 판단으로 되돌아간다.
 *
 * **한계**: 이것은 `Screen`의 본문 컬럼이다. 나중에 2단 레이아웃이 생기면 그 컨테이너가
 * 자기 폭으로 `ColumnWidthProvider`를 다시 제공해야 한다. 창 폭으로 되돌아가지 않는다.
 */
export function useColumn(): Column {
  const width = useContext(ColumnWidth);
  const win = useResponsive();
  if (!width) return win;
  const device: Device =
    width >= columnBreakpoints.desktop
      ? 'desktop'
      : width >= columnBreakpoints.tablet
        ? 'tablet'
        : 'mobile';
  return {
    width,
    device,
    isMobile: device === 'mobile',
    isTablet: device === 'tablet',
    isDesktop: device === 'desktop',
  };
}
