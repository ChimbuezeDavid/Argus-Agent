import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from '@/components/Themed';
import * as voiceService from '@/services/voice/voiceService';
import { useHCITheme } from '@/hooks/useHCITheme';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: any[];
  toolResults?: any[];
  actionType?: 'launch_app' | 'make_call' | 'expense' | 'budget';
  actionData?: any;
}

interface ChatBubbleProps {
  item: Message;
  copiedId: string | null;
  onCopy: (id: string, content: string) => void;
}

export function ChatBubble({ item, copiedId, onCopy }: ChatBubbleProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();
  const isUser = item.role === 'user';
  const isCopied = copiedId === item.id;

  const handleCopy = () => {
    triggerHaptic('selection');
    onCopy(item.id, item.content);
  };

  const formatTime = (ts?: string) => {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };

  const formattedTime = formatTime(item.timestamp);

  return (
    <View style={[styles.msgContainer, isUser ? styles.msgUserContainer : styles.msgAssistantContainer]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onLongPress={handleCopy}
        style={[
          styles.bubble,
          isUser
            ? [styles.bubbleUser, { backgroundColor: colors.primary }]
            : [styles.bubbleAssistant, { backgroundColor: colors.card, borderColor: colors.border }],
        ]}
      >
        <Text
          selectable={true}
          style={[
            styles.bubbleText,
            { fontSize: scaleFont(13) },
            isUser ? styles.bubbleTextUser : [styles.bubbleTextAssistant, { color: colors.text }],
          ]}
        >
          {item.content}
        </Text>

        {/* Tool Action Proof Badges */}
        {item.toolCalls && Array.isArray(item.toolCalls) && item.toolCalls.filter(Boolean).length > 0 && (
          <View style={styles.toolTraceRow}>
            <Ionicons name="flash" size={12} color="#34d399" style={{ marginRight: 4 }} />
            <Text style={[styles.toolTraceText, { fontSize: scaleFont(10) }]}>
              Action:{' '}
              {item.toolCalls
                .filter(Boolean)
                .map((t: any) => (typeof t === 'string' ? t : t?.name || t?.functionCall?.name || 'Executed'))
                .join(', ')}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Message Action & Time Footers */}
      <View style={[styles.msgFooterRow, isUser && { justifyContent: 'flex-end' }]}>
        {!isUser && (
          <TouchableOpacity
            style={styles.msgActionBtn}
            onPress={() => {
              triggerHaptic('light');
              voiceService.speak(item.content);
            }}
          >
            <Ionicons name="volume-high-outline" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.msgActionBtn}
          onPress={handleCopy}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons
            name={isCopied ? 'checkmark-circle' : 'copy-outline'}
            size={13}
            color={isCopied ? '#34d399' : colors.textSecondary}
          />
        </TouchableOpacity>

        {formattedTime ? (
          <Text style={[styles.timeText, { color: colors.textMuted, fontSize: scaleFont(10) }]}>
            {formattedTime}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  msgContainer: {
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  msgUserContainer: {
    alignItems: 'flex-end',
  },
  msgAssistantContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 14,
    padding: 12,
  },
  bubbleUser: {},
  bubbleAssistant: {
    borderWidth: 1,
  },
  bubbleText: {
    lineHeight: 19,
  },
  bubbleTextUser: {
    color: '#ffffff',
    fontWeight: '500',
  },
  bubbleTextAssistant: {},
  toolTraceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: 'transparent',
  },
  toolTraceText: {
    color: '#34d399',
    fontWeight: '600',
  },
  msgFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    backgroundColor: 'transparent',
  },
  msgActionBtn: {
    padding: 4,
  },
  timeText: {
    fontWeight: '600',
    alignSelf: 'center',
    marginLeft: 2,
  },
});
