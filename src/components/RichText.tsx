import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { colors, spacing, radius, typeface, font } from '@/theme/tokens';

/** 인라인 조각. 마크다운 기호는 화면에 남기지 않는다. */
export interface InlineToken {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

/** 블록 한 줄. */
export interface RichBlock {
  kind: 'heading' | 'paragraph' | 'bullet' | 'number';
  tokens: InlineToken[];
  /** number 블록의 순번. */
  index?: number;
}

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`)/g;

/** `**굵게**`, `*기울임*`, `` `코드` `` 를 조각으로 나눈다. 기호는 버린다. */
export function parseInline(line: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;
  for (const match of line.matchAll(INLINE)) {
    const start = match.index ?? 0;
    if (start > last) tokens.push({ text: line.slice(last, start) });
    const raw = match[0];
    if (raw.startsWith('**') || raw.startsWith('__')) {
      tokens.push({ text: raw.slice(2, -2), bold: true });
    } else if (raw.startsWith('`')) {
      tokens.push({ text: raw.slice(1, -1), code: true });
    } else {
      tokens.push({ text: raw.slice(1, -1), italic: true });
    }
    last = start + raw.length;
  }
  if (last < line.length) tokens.push({ text: line.slice(last) });
  return tokens.filter((t) => t.text.length > 0);
}

/** 답변 문자열을 블록 목록으로 바꾼다. 빈 줄은 단락 구분으로만 쓴다. */
export function parseRich(text: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: 'heading', tokens: parseInline(heading[1]) });
      continue;
    }
    const bullet = line.match(/^[-*+]\s+(.*)$/);
    if (bullet) {
      blocks.push({ kind: 'bullet', tokens: parseInline(bullet[1]) });
      continue;
    }
    const numbered = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (numbered) {
      blocks.push({
        kind: 'number',
        index: Number(numbered[1]),
        tokens: parseInline(numbered[2]),
      });
      continue;
    }
    blocks.push({ kind: 'paragraph', tokens: parseInline(line) });
  }
  return blocks;
}

/**
 * AI 답변용 텍스트 렌더러.
 * 굵게·기울임·코드·제목·목록만 처리한다. 새 패키지를 쓰지 않고 화면에 기호가 남지 않게 한다.
 */
export function RichText({ text }: { text: string }) {
  const blocks = parseRich(text);
  return (
    <View style={{ gap: spacing.sm }}>
      {blocks.map((block, i) => (
        <View key={i} style={block.kind === 'paragraph' ? undefined : styles.listRow}>
          {block.kind === 'bullet' ? <AppText style={styles.marker}>·</AppText> : null}
          {block.kind === 'number' ? (
            <AppText style={styles.marker}>{block.index}.</AppText>
          ) : null}
          <AppText
            style={[
              styles.body,
              block.kind === 'heading' && styles.heading,
              block.kind !== 'paragraph' && { flex: 1 },
            ]}
          >
            {block.tokens.map((t, j) => (
              <AppText
                key={j}
                style={[
                  styles.body,
                  t.bold && { fontFamily: typeface.semibold },
                  t.italic && { fontStyle: 'italic' },
                  t.code && styles.code,
                ]}
              >
                {t.text}
              </AppText>
            ))}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    fontFamily: typeface.regular,
    color: colors.ink,
    fontSize: font.size.base,
    lineHeight: font.size.base * font.lineHeight.relaxed,
  },
  heading: { fontFamily: typeface.semibold, fontSize: font.size.lg },
  listRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  marker: { fontFamily: typeface.medium, color: colors.inkSecondary },
  code: {
    fontFamily: typeface.medium,
    backgroundColor: colors.offset,
    borderRadius: radius.sm,
    color: colors.ink,
  },
});
