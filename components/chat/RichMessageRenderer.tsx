import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Themed';
import { useHCITheme } from '@/hooks/useHCITheme';

interface RichMessageRendererProps {
  content: string;
  isUser: boolean;
  selectable?: boolean;
}

/**
 * Parses inline formatting like **bold**, *italic*, and `code` into nested Text components.
 */
function renderInlineText(
  text: string,
  baseColor: string,
  boldColor: string,
  fontSize: number,
  isUser: boolean
): React.ReactNode[] {
  if (!text) return [];

  // Match bold (**...**), inline code (`...`), or italic (*...*)
  const regex = /(\*\*[\s\S]+?\*\*|`[^`]+`|\*[^*\n]+?\*)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const inner = part.slice(2, -2);
      return (
        <Text
          key={index}
          style={{
            fontWeight: '700',
            color: boldColor,
            fontSize,
          }}
        >
          {inner}
        </Text>
      );
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      const inner = part.slice(1, -1);
      return (
        <Text
          key={index}
          style={[
            styles.inlineCode,
            {
              backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : 'rgba(99, 102, 241, 0.12)',
              color: isUser ? '#ffffff' : '#6366f1',
              fontSize: fontSize * 0.9,
            },
          ]}
        >
          {inner}
        </Text>
      );
    }

    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2 && !part.startsWith('**')) {
      const inner = part.slice(1, -1);
      return (
        <Text
          key={index}
          style={{
            fontStyle: 'italic',
            color: baseColor,
            fontSize,
          }}
        >
          {inner}
        </Text>
      );
    }

    return (
      <Text
        key={index}
        style={{
          color: baseColor,
          fontSize,
          fontWeight: isUser ? '500' : '400',
        }}
      >
        {part}
      </Text>
    );
  });
}

/**
 * Enhanced Rich Message Typography Renderer for Argus Command Deck.
 * Eliminates raw markdown tokens (**, -, *) and presents an articulate,
 * beautifully formatted executive UI.
 */
export function RichMessageRenderer({ content, isUser, selectable = true }: RichMessageRendererProps) {
  const { colors, scaleFont } = useHCITheme();

  const baseFontSize = scaleFont(13);
  const baseColor = isUser ? '#ffffff' : colors.text;
  const boldColor = isUser ? '#ffffff' : (colors.text || '#0f172a');

  if (!content || !content.trim()) {
    return null;
  }

  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check for fenced code block ```
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // Close code block
        const codeText = codeBlockLines.join('\n');
        renderedElements.push(
          <View
            key={`code-block-${i}`}
            style={[
              styles.codeBlockCard,
              {
                backgroundColor: isUser ? 'rgba(0,0,0,0.2)' : colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              selectable={selectable}
              style={[
                styles.codeBlockText,
                {
                  fontSize: scaleFont(11.5),
                  color: isUser ? '#ffffff' : colors.text,
                },
              ]}
            >
              {codeText}
            </Text>
          </View>
        );
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        // Open code block
        inCodeBlock = true;
        codeBlockLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    // Empty lines indicate paragraph breaks
    if (trimmed === '') {
      renderedElements.push(<View key={`spacer-${i}`} style={styles.paragraphSpacer} />);
      continue;
    }

    // Headings (e.g. ### Heading or ## Heading)
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const headingText = headingMatch[2];
      renderedElements.push(
        <View key={`heading-${i}`} style={styles.headingWrap}>
          <Text
            selectable={selectable}
            style={[
              styles.headingText,
              {
                fontSize: scaleFont(14.5),
                color: boldColor,
              },
            ]}
          >
            {renderInlineText(headingText, baseColor, boldColor, scaleFont(14.5), isUser)}
          </Text>
        </View>
      );
      continue;
    }

    // Bullet list items (e.g. "- item" or "* item" or "• item")
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      const itemContent = bulletMatch[1].trim();

      // Check if bullet starts with an emoji (e.g. "- 💰 Log an expense")
      const emojiMatch = itemContent.match(/^(\p{Extended_Pictographic}|\p{Emoji_Presentation})\s*(.*)$/u);

      if (emojiMatch) {
        const emoji = emojiMatch[1];
        const restOfText = emojiMatch[2];
        renderedElements.push(
          <View key={`bullet-${i}`} style={styles.bulletRow}>
            <Text style={[styles.bulletIcon, { fontSize: scaleFont(13) }]}>{emoji}</Text>
            <Text
              selectable={selectable}
              style={[
                styles.bulletBody,
                {
                  fontSize: baseFontSize,
                  lineHeight: Math.round(baseFontSize * 1.45),
                },
              ]}
            >
              {renderInlineText(restOfText, baseColor, boldColor, baseFontSize, isUser)}
            </Text>
          </View>
        );
      } else {
        renderedElements.push(
          <View key={`bullet-${i}`} style={styles.bulletRow}>
            <View
              style={[
                styles.bulletDot,
                {
                  backgroundColor: isUser ? '#ffffff' : colors.primary,
                },
              ]}
            />
            <Text
              selectable={selectable}
              style={[
                styles.bulletBody,
                {
                  fontSize: baseFontSize,
                  lineHeight: Math.round(baseFontSize * 1.45),
                },
              ]}
            >
              {renderInlineText(itemContent, baseColor, boldColor, baseFontSize, isUser)}
            </Text>
          </View>
        );
      }
      continue;
    }

    // Numbered list items (e.g. "1. Step description")
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      const number = numberedMatch[1];
      const itemContent = numberedMatch[2];
      renderedElements.push(
        <View key={`num-${i}`} style={styles.bulletRow}>
          <Text
            style={[
              styles.numberBadge,
              {
                fontSize: baseFontSize * 0.9,
                color: isUser ? '#ffffff' : colors.primary,
              },
            ]}
          >
            {number}.
          </Text>
          <Text
            selectable={selectable}
            style={[
              styles.bulletBody,
              {
                fontSize: baseFontSize,
                lineHeight: Math.round(baseFontSize * 1.45),
              },
            ]}
          >
            {renderInlineText(itemContent, baseColor, boldColor, baseFontSize, isUser)}
          </Text>
        </View>
      );
      continue;
    }

    // Standard paragraph line
    renderedElements.push(
      <Text
        key={`para-${i}`}
        selectable={selectable}
        style={[
          styles.paragraphText,
          {
            fontSize: baseFontSize,
            lineHeight: Math.round(baseFontSize * 1.45),
          },
        ]}
      >
        {renderInlineText(rawLine, baseColor, boldColor, baseFontSize, isUser)}
      </Text>
    );
  }

  return <View style={styles.container}>{renderedElements}</View>;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  paragraphText: {
    marginBottom: 4,
  },
  paragraphSpacer: {
    height: 6,
  },
  headingWrap: {
    marginTop: 6,
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  headingText: {
    fontWeight: '700',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 5,
    paddingLeft: 2,
    backgroundColor: 'transparent',
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 7,
    marginRight: 8,
  },
  bulletIcon: {
    marginRight: 6,
    marginTop: 1,
  },
  numberBadge: {
    fontWeight: '700',
    marginRight: 6,
    marginTop: 1,
    minWidth: 16,
  },
  bulletBody: {
    flex: 1,
  },
  inlineCode: {
    fontFamily: 'monospace',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  codeBlockCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginVertical: 6,
  },
  codeBlockText: {
    fontFamily: 'monospace',
    lineHeight: 18,
  },
});
