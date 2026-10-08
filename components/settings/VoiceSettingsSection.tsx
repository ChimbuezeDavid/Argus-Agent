import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHCITheme } from '@/hooks/useHCITheme';
import { SectionCard, ToggleRow, ChipSelector, ChipOption } from '@/components/shared';

export const WAKE_WORD_PRESETS: ChipOption[] = [
  { id: 'Hey Argus', label: 'Hey Argus' },
  { id: 'Hey Dave', label: 'Hey Dave' },
  { id: 'Dave', label: 'Dave' },
  { id: 'Hey Gee', label: 'Hey Gee' },
  { id: 'Gee', label: 'Gee' },
  { id: 'Siri', label: 'Siri' },
];

interface VoiceSettingsSectionProps {
  settings: any;
}

export function VoiceSettingsSection({ settings }: VoiceSettingsSectionProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  const [customWakeWordInput, setCustomWakeWordInput] = useState(settings.customWakeWord || 'Hey Argus');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings.customWakeWord) {
      setCustomWakeWordInput(settings.customWakeWord);
    }
  }, [settings.customWakeWord]);

  const activeWakeWord = settings.customWakeWord || 'Hey Argus';
  const isModified = customWakeWordInput.trim().length > 0 && customWakeWordInput.trim().toLowerCase() !== activeWakeWord.toLowerCase();

  const handleSaveWakeWord = async (wordToSave?: string) => {
    const target = (wordToSave !== undefined ? wordToSave : customWakeWordInput).trim() || 'Hey Argus';
    triggerHaptic('selection');
    setIsSaving(true);
    try {
      await settings.setCustomWakeWord(target);
      setCustomWakeWordInput(target);
      triggerHaptic('success');
      Alert.alert('Wake Word Updated', `Argus will now awaken to "${target}".`);
    } catch (e: any) {
      triggerHaptic('warning');
      Alert.alert('Error', e.message || 'Failed to update wake word.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearInput = () => {
    triggerHaptic('light');
    setCustomWakeWordInput('');
  };

  return (
    <View style={styles.container}>
      {/* 1. Background Wake Word Daemon */}
      <SectionCard
        icon={<Ionicons name="mic" size={scaleFont(20)} color="#06b6d4" />}
        title="Background Acoustic Sensing"
        subtitle="Continuous hands-free wake word detection powered by a dedicated low-power daemon service."
      >
        <ToggleRow
          label="Background Wake Word Daemon"
          description="Isolated background daemon keeps microphone listening even when Argus is closed or the device is locked"
          value={settings.alwaysOnVoiceEnabled}
          onValueChange={(val) => {
            triggerHaptic('selection');
            settings.toggleAlwaysOnVoice(val);
          }}
        />

        {/* Daemon Status Banner */}
        <View
          style={[
            styles.statusBanner,
            {
              backgroundColor: settings.alwaysOnVoiceEnabled ? '#10b98114' : colors.surface,
              borderColor: settings.alwaysOnVoiceEnabled ? '#10b98140' : colors.border,
            },
          ]}
        >
          <View style={styles.statusIndicatorRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: settings.alwaysOnVoiceEnabled ? '#10b981' : colors.textMuted },
              ]}
            />
            <Text
              style={[
                styles.statusTitle,
                {
                  color: settings.alwaysOnVoiceEnabled ? '#10b981' : colors.textSecondary,
                  fontSize: scaleFont(12),
                },
              ]}
            >
              {settings.alwaysOnVoiceEnabled
                ? 'Daemon Armed & Running in Background'
                : 'Daemon Inactive (Tap toggle above to enable)'}
            </Text>
          </View>
          <Text style={[styles.statusDescription, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
            Energy-optimized native audio pipeline with exact alarms ensures continuous acoustic vigilance without battery drain.
          </Text>
        </View>
      </SectionCard>

      {/* 2. Wake Trigger & Custom Hotword Selection */}
      <SectionCard
        icon={<Ionicons name="radio" size={scaleFont(20)} color="#10b981" />}
        title="Wake Word & Trigger Phrase"
        subtitle="Configure the acoustic keyphrase that instantly awakens Argus."
      >
        {/* Active Trigger Display Badge */}
        <View style={[styles.activeTriggerCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.activeTriggerLabel, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
            Active Wake Phrase
          </Text>
          <View style={styles.activeTriggerValueRow}>
            <Ionicons name="mic-circle" size={20} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.activeTriggerValue, { color: colors.text, fontSize: scaleFont(15) }]}>
              "{activeWakeWord}"
            </Text>
          </View>
        </View>

        {/* Preset Chips */}
        <View style={{ marginTop: 14 }}>
          <Text style={[styles.inputSectionLabel, { color: colors.textSecondary, fontSize: scaleFont(11.5) }]}>
            Preset Wake Phrases
          </Text>
          <ChipSelector
            options={WAKE_WORD_PRESETS}
            selectedId={activeWakeWord}
            onSelect={(id) => {
              handleSaveWakeWord(id);
            }}
          />
        </View>

        {/* HCI Compliant Custom Hotword Input */}
        <View style={{ marginTop: 16 }}>
          <Text style={[styles.inputSectionLabel, { color: colors.textSecondary, fontSize: scaleFont(11.5) }]}>
            Custom Hotword Phrase
          </Text>
          <Text style={[styles.inputSectionDesc, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
            Type any personalized wake phrase (e.g., "Jarvis", "Computer", "Hey Friday").
          </Text>

          <View style={styles.hciInputRow}>
            {/* Input Field Container */}
            <View
              style={[
                styles.hciInputBox,
                {
                  backgroundColor: colors.background,
                  borderColor: isModified ? colors.primary : colors.border,
                },
              ]}
            >
              <Ionicons
                name="pencil-outline"
                size={16}
                color={isModified ? colors.primary : colors.textSecondary}
                style={styles.inputLeftIcon}
              />
              <TextInput
                style={[
                  styles.hciTextInput,
                  {
                    color: colors.text,
                    fontSize: scaleFont(13),
                  },
                ]}
                placeholder="Enter custom phrase..."
                placeholderTextColor={colors.textMuted}
                value={customWakeWordInput}
                onChangeText={setCustomWakeWordInput}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => isModified && handleSaveWakeWord()}
              />
              {customWakeWordInput.length > 0 && (
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={handleClearInput}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel="Clear custom wake word"
                >
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* HCI Save Action Button */}
            <TouchableOpacity
              style={[
                styles.hciSaveBtn,
                {
                  backgroundColor: isModified ? colors.primary : `${colors.border}40`,
                  borderColor: isModified ? colors.primary : colors.border,
                },
              ]}
              onPress={() => handleSaveWakeWord()}
              disabled={!isModified || isSaving}
              activeOpacity={0.75}
              accessibilityLabel="Save custom wake word"
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={isModified ? '#ffffff' : colors.textMuted}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.hciSaveBtnText,
                      {
                        color: isModified ? '#ffffff' : colors.textMuted,
                        fontSize: scaleFont(12),
                      },
                    ]}
                  >
                    Save
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SectionCard>

      {/* 3. Spoken Audio Feedback */}
      <SectionCard
        icon={<Ionicons name="volume-high" size={scaleFont(20)} color="#f59e0b" />}
        title="Spoken Audio Feedback"
        subtitle="Audible voice responses using native on-device speech synthesis."
      >
        <ToggleRow
          label="Spoken Audio Responses"
          description="Speak agent answers and confirmations out loud using on-device text-to-speech synthesis"
          value={settings.audioFeedbackEnabled}
          onValueChange={(val) => {
            triggerHaptic('selection');
            settings.toggleAudioFeedback(val);
          }}
        />
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  statusBanner: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusTitle: {
    fontWeight: '700',
  },
  statusDescription: {
    lineHeight: 16,
  },
  activeTriggerCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 4,
  },
  activeTriggerLabel: {
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeTriggerValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeTriggerValue: {
    fontWeight: '800',
  },
  inputSectionLabel: {
    fontWeight: '700',
    marginBottom: 4,
  },
  inputSectionDesc: {
    lineHeight: 15,
    marginBottom: 10,
  },
  hciInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hciInputBox: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  inputLeftIcon: {
    marginRight: 8,
  },
  hciTextInput: {
    flex: 1,
    height: '100%',
    fontWeight: '600',
  },
  clearBtn: {
    padding: 4,
    marginLeft: 4,
  },
  hciSaveBtn: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hciSaveBtnText: {
    fontWeight: '700',
  },
});
