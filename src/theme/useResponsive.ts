import { useWindowDimensions } from 'react-native';
import { breakpoints } from './tokens';

export type Device = 'mobile' | 'tablet' | 'desktop';

/** 화면 폭 기준 디바이스 구분. 정보 위계를 폭에 맞게 조정할 때 사용. */
export function useResponsive() {
  const { width } = useWindowDimensions();
  const device: Device =
    width >= breakpoints.desktop ? 'desktop' : width >= breakpoints.tablet ? 'tablet' : 'mobile';
  return {
    width,
    device,
    isMobile: device === 'mobile',
    isTablet: device === 'tablet',
    isDesktop: device === 'desktop',
  };
}
