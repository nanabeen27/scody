module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  // `.claude/worktrees/`에는 병렬 작업용 git 워크트리가 들어온다. 그 안에도 같은 `__tests__`가
  // 있어서 무시하지 않으면 스위트 수가 워크트리 수만큼 배로 늘고, 어느 사본의 실패인지 구분되지 않는다.
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/e2e/', '/\\.claude/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|standard-navigation|expo-router))',
  ],
};
