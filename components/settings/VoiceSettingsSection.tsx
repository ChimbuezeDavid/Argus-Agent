import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, TextInput, Alert, ActivityIndicator, Platform, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHCITheme } from '@/hooks/useHCITheme';
import { SectionCard, ToggleRow, ChipSelector, ChipOption } from '@/components/shared';
import ArgusSystemMonitors from '@/modules/argus-system-monitors';

export const WAKE_WORD_PRESETS: ChipOption[] = [
  { id: 'Hey Ella', label: 'Hey Ella' },
  { id: 'Ella', label: 'Ella' },
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
  const [isBatteryExempt, setIsBatteryExempt] = useState(false);

  const checkBatteryStatus = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const exempt = await ArgusSystemMonitors.isIgnoringBatteryOptimizations();
        setIsBatteryExempt(!!exempt);
      } catch (e) {
        console.warn('Failed to check battery optimization status:', e);
      }
    }
  }, []);

  useEffect(() => {
    checkBatteryStatus();
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkBatteryStatus();
      }
    });
    return () => sub.remove();
  }, [checkBatteryStatus]);

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

  const handleRequestBatteryExemption = async () => {
    triggerHaptic('selection');
    try {
      await ArgusSystemMonitors.requestIgnoreBatteryOptimizations();
    } catch (e: any) {
      Alert.alert('Battery Settings', 'Could not open battery optimization settings.');
    }
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

        {/* OEM Background Persistence / Battery Optimization Exemption */}
        <View
          style={[
            styles.batteryStatusCard,
            {
              backgroundColor: colors.surface,
              borderColor: isBatteryExempt ? '#10b98140' : '#f59e0b40',
            },
          ]}
        >
          <View style={styles.batteryStatusHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.batteryTitle, { color: colors.text, fontSize: scaleFont(12) }]}>
                Recents Swipe Persistence
              </Text>
              <Text style={[styles.batteryDesc, { color: colors.textMuted, fontSize: scaleFont(10.5) }]}>
                {isBatteryExempt
                  ? 'Battery optimization exempted. Argus daemon maintains active listening when swiped from recent apps.'
                  : 'Android and OEM ROMs kill background services when swiped from Recents unless battery optimization is disabled.'}
              </Text>
            </View>
            <View
              style={[
                styles.batteryBadge,
                { backgroundColor: isBatteryExempt ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)' },
              ]}
            >
              <Ionicons
                name={isBatteryExempt ? 'shield-checkmark' : 'warning-outline'}
                size={12}
                color={isBatteryExempt ? '#10b981' : '#f59e0b'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.batteryBadgeText,
                  { color: isBatteryExempt ? '#10b981' : '#f59e0b', fontSize: scaleFont(10) },
                ]}
              >
                {isBatteryExempt ? 'Unrestricted' : 'Optimized'}
              </Text>
            </View>
          </View>

          {!isBatteryExempt && Platform.OS === 'android' && (
            <TouchableOpacity
              style={[styles.exemptButton, { backgroundColor: '#f59e0b18', borderColor: '#f59e0b60' }]}
              onPress={handleRequestBatteryExemption}
              activeOpacity={0.8}
            >
              <Ionicons name="battery-charging-outline" size={15} color="#f59e0b" style={{ marginRight: 6 }} />
              <Text style={[styles.exemptButtonText, { color: '#f59e0b', fontSize: scaleFont(11.5) }]}>
                Exempt from Battery Optimizations
              </Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.oemNote, { color: colors.textMuted, fontSize: scaleFont(10) }]}>
            For Xiaomi, Samsung, Oppo/Vivo, or Infinix/Tecno: Set App Battery behavior to "Unrestricted" and enable "Auto-start" in App Info.
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

      {/* 3. Ella Assistant & Transparent Overlay (Like Bixby) */}
      <SectionCard
        icon={<Ionicons name="layers-outline" size={scaleFont(20)} color="#38bdf8" />}
        title="Ella Overlay & System Assistant"
        subtitle="Trigger Ella as a lightweight transparent HUD over active apps without opening the full UI."
      >
        <View style={styles.assistantCard}>
          <Text style={[styles.assistantCardDesc, { color: colors.textSecondary, fontSize: scaleFont(12) }]}>
            Ella uses Android VoiceInteractionSession to appear as a floating capsule directly over whatever app you're currently using. Device actions execute in &lt;50ms without internet dependency.
          </Text>

          {/* Test Overlay Button */}
          <TouchableOpacity
            style={[styles.assistantActionBtn, { backgroundColor: '#38bdf818', borderColor: '#38bdf860', marginBottom: 8 }]}
            onPress={async () => {
              triggerHaptic('selection');
              const res = await ArgusSystemMonitors.triggerEllaOverlay();
              if (!res) {
                Alert.alert(
                  'Ella Overlay',
                  'To use Ella as your global assistant, enable Ella as the Default Digital Assistant in Android settings below.'
                );
              }
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles" size={15} color="#38bdf8" style={{ marginRight: 6 }} />
            <Text style={[styles.assistantActionBtnText, { color: '#38bdf8', fontSize: scaleFont(12) }]}>
              Test Ella Transparent Overlay HUD
            </Text>
          </TouchableOpacity>

          {/* Open Android Assistant Settings */}
          {Platform.OS === 'android' && (
            <TouchableOpacity
              style={[styles.assistantActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => {
                triggerHaptic('selection');
                ArgusSystemMonitors.openDefaultAssistantSettings();
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="settings-outline" size={15} color={colors.text} style={{ marginRight: 6 }} />
              <Text style={[styles.assistantActionBtnText, { color: colors.text, fontSize: scaleFont(12) }]}>
                Set Ella as Default Phone Assistant
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SectionCard>

      {/* 4. Spoken Audio Feedback */}
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
  batteryStatusCard: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  batteryStatusHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  batteryTitle: {
    fontWeight: '700',
    marginBottom: 3,
  },
  batteryDesc: {
    lineHeight: 15,
  },
  batteryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  batteryBadgeText: {
    fontWeight: '700',
  },
  exemptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
  },
  exemptButtonText: {
    fontWeight: '700',
  },
  oemNote: {
    marginTop: 8,
    lineHeight: 14,
    fontStyle: 'italic',
  },
  assistantCard: {
    paddingTop: 4,
  },
  assistantCardDesc: {
    lineHeight: 17,
    marginBottom: 12,
  },
  assistantActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  assistantActionBtnText: {
    fontWeight: '700',
  },
});
