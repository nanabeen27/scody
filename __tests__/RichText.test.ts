import { parseInline, parseRich } from '@/components';

describe('AI 답변 마크다운 렌더', () => {
  it('굵게 표시 기호는 화면 문자열에 남지 않는다', () => {
    const tokens = parseInline('정답은 **비판적 읽기**예요');
    expect(tokens.map((t) => t.text).join('')).toBe('정답은 비판적 읽기예요');
    expect(tokens.some((t) => t.bold)).toBe(true);
    expect(tokens.some((t) => t.text.includes('*'))).toBe(false);
  });

  it('기울임과 코드도 기호 없이 처리한다', () => {
    const tokens = parseInline('이건 *조금* 다르고 `코드`예요');
    expect(tokens.map((t) => t.text).join('')).toBe('이건 조금 다르고 코드예요');
    expect(tokens.find((t) => t.italic)?.text).toBe('조금');
    expect(tokens.find((t) => t.code)?.text).toBe('코드');
  });

  it('제목·글머리표·번호 목록을 블록으로 나눈다', () => {
    const blocks = parseRich(
      ['### 정리', '- 첫째 이유', '2. 둘째 이유', '', '마지막 한 줄이에요'].join('\n'),
    );
    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'bullet', 'number', 'paragraph']);
    expect(blocks[0].tokens[0].text).toBe('정리');
    expect(blocks[2].index).toBe(2);
    const all = blocks.flatMap((b) => b.tokens.map((t) => t.text)).join(' ');
    expect(all).not.toMatch(/[#*]/);
  });

  it('빈 줄은 블록을 만들지 않는다', () => {
    expect(parseRich(['첫 줄', '', '', '두 번째 줄'].join('\n'))).toHaveLength(2);
  });
});
