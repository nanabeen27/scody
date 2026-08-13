/* global jest */
/**
 * Jest 준비 파일.
 *
 * `AsyncStorage`는 네이티브 모듈이라 Node에서 그대로 불러오면 터진다. Supabase 클라이언트가
 * 세션 저장소로 쓰고 있어서(`src/lib/supabase.ts`) 그 파일을 거치는 테스트 전부에 걸린다.
 * 패키지가 제공하는 공식 목을 쓴다.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
