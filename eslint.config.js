const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // `supabase/functions/*`는 Deno에서 돈다(전역·모듈 해석이 다르다).
    // `.claude/*`에는 병렬 작업용 git 워크트리가 들어온다 — 같은 소스의 사본이라 무시하지 않으면
    // 같은 경고가 워크트리 수만큼 반복되고 어느 체크아웃의 문제인지 구분되지 않는다.
    ignores: [
      '.claude/*',
      'dist/*',
      'node_modules/*',
      'playwright-report/*',
      'test-results/*',
      'supabase/functions/*',
    ],
  },
  {
    files: ['app/**/*.tsx', 'src/**/*.tsx'],
    rules: {
      /*
        react-native-web 0.21.2는 `accessibilityState`·`accessibilityValue` **객체**를 DOM으로
        옮기지 않는다(`dist/modules/forwardedProps/index.js`의 허용 목록에 두 이름이 없다).
        선언해도 조용히 사라져서, 화면에서는 상태가 바뀌는데 스크린리더는 계속 같은 값을 읽는다.

        반대로 `aria-*`를 직접 주면 네이티브가 되돌려 준다 —
        `react-native/Libraries/Components/View/View.js`와 `Pressable.js`가
        `aria-checked|selected|expanded|disabled|busy`를 보고 `accessibilityState`를 다시 만든다.
        그래서 `aria-*` 하나만 쓰는 것이 두 플랫폼 모두에서 맞다.
      */
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute[name.name="accessibilityState"]',
          message:
            'react-native-web이 DOM으로 옮기지 않는다. aria-selected/-checked/-expanded를 쓴다(네이티브는 View.js·Pressable.js가 되돌려 준다).',
        },
        {
          selector: 'JSXAttribute[name.name="accessibilityValue"]',
          message: '같은 이유로 aria-valuenow/-valuemin/-valuemax를 쓴다.',
        },
      ],
    },
  },
  {
    /*
      Playwright 픽스처의 `use(...)`는 React Hook이 아니다. 이름만 같아서 규칙이 잡는다.
      E2E 폴더에는 React가 없으므로 Hook 규칙을 끈다.
    */
    files: ['e2e/**/*.ts'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
]);
