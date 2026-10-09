import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  View,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Text } from '@/components/Themed';
import { useHCITheme } from '@/hooks/useHCITheme';
import { useSettingsStore } from '@/store/settingsStore';
import { RoutingMode } from '@/services/orchestrator/intentRouter';

export interface QuickActionChip {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  template: string;
}

const DEFAULT_QUICK_ACTIONS: QuickActionChip[] = [
  { id: 'vlc_music', label: 'Play Music', icon: 'musical-notes', template: 'Play music on VLC' },
  { id: 'phone_call', label: 'Call Contact', icon: 'call', template: 'Call ' },
  { id: 'voice_rec', label: 'Record Voice', icon: 'mic', template: 'Start recording audio' },
  { id: 'log_exp', label: 'Log Expense', icon: 'cash-outline', template: 'Log ₦3500 for ' },
  { id: 'new_note', label: 'Take Note', icon: 'document-text', template: 'Take a note: ' },
];

interface OmnibarProps {
  insetsBottom: number;
  isProcessing: boolean;
  pulseAnim?: Animated.Value;
  isListening?: boolean;
  isSpeaking?: boolean;
  inputText: string;
  routingMode?: RoutingMode;
  onSelectRoutingMode?: (mode: RoutingMode) => void;
  onChangeText?: (text: string) => void;
  onInputChange?: (text: string) => void;
  onSend: () => void;
  onOpenVoiceModal?: () => void;
  onOpenVoiceAssistant?: () => void;
}

export function Omnibar({
  insetsBottom,
  isProcessing,
  pulseAnim,
  isListening = false,
  isSpeaking = false,
  inputText,
  routingMode = 'auto',
  onSelectRoutingMode,
  onChangeText,
  onInputChange,
  onSend,
  onOpenVoiceModal,
  onOpenVoiceAssistant,
}: OmnibarProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();
  const { audioFeedbackEnabled, toggleAudioFeedback } = useSettingsStore();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleInputChange = onChangeText || onInputChange || (() => {});
  const handleVoicePress = onOpenVoiceModal || onOpenVoiceAssistant || (() => {});

  const handleApplyActionChip = (chip: QuickActionChip) => {
    triggerHaptic('selection');
    handleInputChange(chip.template);
  };

  const handleClearText = () => {
    triggerHaptic('light');
    handleInputChange('');
  };

  const safeBottomPadding = Math.max(insetsBottom || 0, Platform.OS === 'android' ? 24 : 16) + 6;

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.background, paddingBottom: safeBottomPadding }]}>
      {/* 1. Processing Indicator */}
      {isProcessing && (
        <View style={[styles.processingPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.processingText, { color: colors.primary, fontSize: scaleFont(11) }]}>
            {routingMode === 'ella_local' ? 'Ella executing on-device...' : 'Argus Agent orchestrating response...'}
          </Text>
        </View>
      )}

      {/* 2. Multi-Level Level 1: Routing Engine Mode Selector Pills */}
      <View style={styles.routingTiersRow}>
        <TouchableOpacity
          style={[
            styles.modePill,
            routingMode === 'auto'
              ? [styles.modePillActive, { borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.14)' }]
              : { borderColor: colors.border, backgroundColor: colors.surface },
          ]}
          onPress={() => {
            triggerHaptic('selection');
            onSelectRoutingMode?.('auto');
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="flash"
            size={11}
            color={routingMode === 'auto' ? '#10b981' : colors.textMuted}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.modePillText,
              {
                color: routingMode === 'auto' ? '#10b981' : colors.textSecondary,
                fontSize: scaleFont(10.5),
              },
            ]}
          >
            Auto Route
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modePill,
            routingMode === 'ella_local'
              ? [styles.modePillActive, { borderColor: '#06b6d4', backgroundColor: 'rgba(6, 182, 212, 0.14)' }]
              : { borderColor: colors.border, backgroundColor: colors.surface },
          ]}
          onPress={() => {
            triggerHaptic('selection');
            onSelectRoutingMode?.('ella_local');
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="hardware-chip-outline"
            size={11}
            color={routingMode === 'ella_local' ? '#06b6d4' : colors.textMuted}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.modePillText,
              {
                color: routingMode === 'ella_local' ? '#06b6d4' : colors.textSecondary,
                fontSize: scaleFont(10.5),
              },
            ]}
          >
            Ella Local (&lt;50ms)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modePill,
            routingMode === 'gemini_cloud'
              ? [styles.modePillActive, { borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.14)' }]
              : { borderColor: colors.border, backgroundColor: colors.surface },
          ]}
          onPress={() => {
            triggerHaptic('selection');
            onSelectRoutingMode?.('gemini_cloud');
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="cloud-outline"
            size={11}
            color={routingMode === 'gemini_cloud' ? '#8b5cf6' : colors.textMuted}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.modePillText,
              {
                color: routingMode === 'gemini_cloud' ? '#8b5cf6' : colors.textSecondary,
                fontSize: scaleFont(10.5),
              },
            ]}
          >
            Gemini AI
          </Text>
        </TouchableOpacity>
      </View>

      {/* 3. Multi-Level Level 2: Horizontally Scrollable Action Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.actionChipsScroll}
        style={styles.actionChipsContainer}
      >
        {DEFAULT_QUICK_ACTIONS.map((chip) => (
          <TouchableOpacity
            key={chip.id}
            style={[styles.actionChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => handleApplyActionChip(chip)}
            activeOpacity={0.75}
          >
            <Ionicons name={chip.icon} size={12} color={colors.primary} style={{ marginRight: 4 }} />
            <Text style={[styles.actionChipText, { color: colors.textSecondary, fontSize: scaleFont(10) }]}>
              {chip.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 4. Multi-Level Level 3: Dynamic Expanding Omnibar Dock */}
      <View
        style={[
          styles.capsuleDock,
          {
            backgroundColor: colors.surface,
            borderColor: routingMode === 'ella_local' ? '#06b6d4' : colors.primary,
          },
          isExpanded && styles.capsuleDockExpanded,
        ]}
      >
        {/* Left Circular Microphone Button */}
        <Animated.View style={{ transform: [{ scale: (isListening || isSpeaking) && pulseAnim ? pulseAnim : 1 }] }}>
          <TouchableOpacity
            style={[
              styles.micOrbBtn,
              isListening && styles.micOrbListening,
              isSpeaking && styles.micOrbSpeaking,
            ]}
            onPress={() => {
              triggerHaptic('selection');
              handleVoicePress();
            }}
            activeOpacity={0.8}
            accessibilityLabel="Open Ella voice assistant"
          >
            <Ionicons
              name={isSpeaking ? 'volume-high' : 'mic'}
              size={19}
              color="#ffffff"
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Text Input Prompt with Multi-line Expansion */}
        <TextInput
          style={[
            styles.input,
            { color: colors.text, fontSize: scaleFont(13.5) },
            isExpanded && styles.inputExpanded,
          ]}
          placeholder={
            routingMode === 'ella_local'
              ? 'Local command (e.g. play music, call, note)...'
              : 'Instruct Argus or speak naturally...'
          }
          placeholderTextColor={colors.textMuted}
          value={inputText}
          onChangeText={handleInputChange}
          onSubmitEditing={isExpanded ? undefined : onSend}
          returnKeyType={isExpanded ? 'default' : 'send'}
          multiline={isExpanded}
          textAlignVertical={isExpanded ? 'top' : 'center'}
        />

        {/* Clear Button (shown when text is present) */}
        {inputText.length > 0 && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={handleClearText}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Clear input"
          >
            <Ionicons name="close-circle" size={17} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* Multi-Level Height Expand/Collapse Button */}
        <TouchableOpacity
          style={[
            styles.expandBtn,
            { backgroundColor: isExpanded ? colors.primaryBg : 'transparent' },
          ]}
          onPress={() => {
            triggerHaptic('light');
            setIsExpanded(!isExpanded);
          }}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityLabel={isExpanded ? 'Collapse input' : 'Expand multiline editor'}
        >
          <Feather
            name={isExpanded ? 'minimize-2' : 'maximize-2'}
            size={15}
            color={isExpanded ? colors.primary : colors.textMuted}
          />
        </TouchableOpacity>

        {/* Audio Feedback Speaker Toggle Button */}
        <TouchableOpacity
          style={[
            styles.speakerToggleBtn,
            {
              backgroundColor: audioFeedbackEnabled ? colors.primaryBg : 'transparent',
              borderColor: audioFeedbackEnabled ? colors.primary : 'transparent',
            },
          ]}
          onPress={() => {
            triggerHaptic('selection');
            toggleAudioFeedback(!audioFeedbackEnabled);
          }}
          activeOpacity={0.7}
          accessibilityLabel="Toggle voice audio feedback"
        >
          <Ionicons
            name={audioFeedbackEnabled ? 'volume-high' : 'volume-mute-outline'}
            size={17}
            color={audioFeedbackEnabled ? colors.primary : colors.textMuted}
          />
        </TouchableOpacity>

        {/* Circular Send Arrow Button */}
        <TouchableOpacity
          style={[
            styles.sendCircleBtn,
            { backgroundColor: inputText.trim() ? colors.primary : colors.cardActive },
            !inputText.trim() && styles.sendBtnDisabled,
          ]}
          onPress={() => {
            triggerHaptic('light');
            onSend();
          }}
          disabled={!inputText.trim() || isProcessing}
          activeOpacity={0.8}
        >
          <Feather name="arrow-up" size={16} color={inputText.trim() ? '#ffffff' : colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  processingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'center',
    marginBottom: 6,
  },
  processingText: {
    fontWeight: '700',
  },
  routingTiersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    marginBottom: 6,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  modePillActive: {
    borderWidth: 1.2,
  },
  modePillText: {
    fontWeight: '700',
  },
  actionChipsContainer: {
    marginBottom: 8,
  },
  actionChipsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 8,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionChipText: {
    fontWeight: '600',
  },
  capsuleDock: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 26,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderWidth: 1.5,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  capsuleDockExpanded: {
    alignItems: 'flex-end',
    borderRadius: 20,
    paddingVertical: 8,
  },
  micOrbBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  micOrbListening: {
    backgroundColor: '#3b82f6',
  },
  micOrbSpeaking: {
    backgroundColor: '#8b5cf6',
  },
  input: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    maxHeight: 100,
  },
  inputExpanded: {
    height: 72,
    paddingTop: 4,
  },
  clearBtn: {
    padding: 4,
    marginRight: 2,
  },
  expandBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  speakerToggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    borderWidth: 1,
  },
  sendCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});
