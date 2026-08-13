import { test as base } from '@playwright/test';
import { reseed } from './_seed';

/**
 * 모든 E2E가 쓰는 `test`.
 *
 * **테스트마다 DB를 seed 상태로 되돌린다.** 프로토타입은 상태가 메모리에 있어 페이지를 새로 열면
 * 초기화됐지만, 지금은 서버에 남는다 — 한 테스트가 선생님을 제외하거나 반을 폐강하면 뒤 테스트가
 * 그 상태를 물려받는다.
 *
 * 비용은 재시드 약 330ms다(연결은 프로세스당 한 번). `workers: 1`이라 서로 밟지 않는다.
 *
 * 쓰는 법: `import { test } from './_fixtures';` — `expect`는 `@playwright/test`에서 그대로 쓴다.
 *
 * ## 주의: DB를 함께 쓴다
 *
 * 원격 프로젝트 하나를 브라우저 수동 확인과 E2E가 같이 쓴다. **둘을 동시에 돌리면 안 된다** —
 * 재시드가 `auth.users`를 지우고 다시 넣기 때문에 다른 쪽의 로그인 세션이 무효가 되고
 * (`/auth/v1/logout`이 403), 원인을 찾기 어려운 실패로 보인다(실측).
 */
export const test = base.extend({
  /*
    `page`를 감싸 재시드를 앞에 둔다. 별도 픽스처로 두고 `auto: true`를 쓰면 `page`가 만들어지는
    순서를 보장하지 못해, 브라우저가 먼저 열려 옛 상태를 본 채로 시작할 수 있다.
  */
  page: async ({ page }, use) => {
    await reseed();
    await use(page);
  },
});

export { expect } from '@playwright/test';
