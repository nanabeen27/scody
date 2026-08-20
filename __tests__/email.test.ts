import { loginEmail, looksLikeEmail, normalizeEmail } from '@/session/email';

/*
  인증 경로의 첫 단위 테스트다. 그 전에는 로그인·가입의 안전망이 **100% Playwright**였고,
  그래서 문구 하나를 바꾸면 무엇이 깨지는지 3뷰포트를 다 돌려 봐야 알 수 있었다.
*/

describe('normalizeEmail', () => {
  it('앞뒤 공백을 버리고 소문자로 만든다', () => {
    expect(normalizeEmail('  Student1@Scody.Test \n')).toBe('student1@scody.test');
  });

  it('빈 입력은 빈 문자열이다', () => {
    expect(normalizeEmail('   ')).toBe('');
  });
});

describe('looksLikeEmail', () => {
  it('@가 없는 입력을 거른다 — 이것이 이 검사의 목적이다', () => {
    // 예전 로그인 칸은 `doyun` 같은 아이디를 받았다. 그 습관이 그대로 오면 서버가 영어로 답한다.
    expect(looksLikeEmail('doyun')).toBe(false);
  });

  it('점 없는 도메인과 공백 든 주소를 거른다', () => {
    expect(looksLikeEmail('a@b')).toBe(false);
    expect(looksLikeEmail('a b@c.test')).toBe(false);
    expect(looksLikeEmail('')).toBe(false);
  });

  it('정상 주소를 통과시킨다. 대문자와 공백은 먼저 다듬는다', () => {
    expect(looksLikeEmail('student1@scody.test')).toBe(true);
    expect(looksLikeEmail('  Parent1@Scody.Test  ')).toBe(true);
  });

  it('엄격하게 만들지 않는다 — 실재하는 모양을 거절하지 않는다', () => {
    expect(looksLikeEmail('hong.gil-dong+study@example.co.kr')).toBe(true);
  });
});

describe('loginEmail', () => {
  it('이메일은 그대로 둔다', () => {
    expect(loginEmail(' Student1@Scody.Test ')).toBe('student1@scody.test');
  });

  it('아이디에는 도메인을 붙인다 — /staff가 짧은 아이디를 계속 받는다', () => {
    expect(loginEmail('admin')).toBe('admin@scody.test');
    expect(loginEmail(' HanBit.Director ')).toBe('hanbit.director@scody.test');
  });
});
