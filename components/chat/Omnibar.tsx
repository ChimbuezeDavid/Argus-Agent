import React from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Animated, View } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Text } from '@/components/Themed';
import { useHCITheme } from '@/hooks/useHCITheme';
import { useSettingsStore } from '@/store/settingsStore';

interface OmnibarProps {
  insetsBottom: number;
  isProcessing: boolean;
  pulseAnim?: Animated.Value;
  isListening?: boolean;
  isSpeaking?: boolean;
  inputText: string;
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
  onChangeText,
  onInputChange,
  onSend,
  onOpenVoiceModal,
  onOpenVoiceAssistant,
}: OmnibarProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();
  const { audioFeedbackEnabled, toggleAudioFeedback } = useSettingsStore();

  const handleInputChange = onChangeText || onInputChange || (() => {});
  const handleVoicePress = onOpenVoiceModal || onOpenVoiceAssistant || (() => {});

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.background, paddingBottom: 6 }]}>
      {/* Processing Indicator */}
      {isProcessing && (
        <View style={[styles.processingPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.processingText, { color: colors.primary, fontSize: scaleFont(11) }]}>
            Argus Agent is thinking...
          </Text>
        </View>
      )}

      {/* Floating Capsule Dock */}
      <View style={[styles.capsuleDock, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
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
            accessibilityLabel="Open voice assistant"
          >
            <Ionicons
              name={isSpeaking ? 'volume-high' : 'mic'}
              size={20}
              color="#ffffff"
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Text Input Prompt */}
        <TextInput
          style={[styles.input, { color: colors.text, fontSize: scaleFont(14) }]}
          placeholder="Instruct Argus Agent..."
          placeholderTextColor={colors.textMuted}
          value={inputText}
          onChangeText={handleInputChange}
          onSubmitEditing={onSend}
          returnKeyType="send"
          multiline={false}
        />

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
            size={18}
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
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  processingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'center',
    marginBottom: 8,
  },
  processingText: {
    fontWeight: '700',
  },
  capsuleDock: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderWidth: 1.5,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  micOrbBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  micOrbListening: {
    backgroundColor: '#3b82f6',
  },
  micOrbSpeaking: {
    backgroundColor: '#8b5cf6',
  },
  input: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
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
