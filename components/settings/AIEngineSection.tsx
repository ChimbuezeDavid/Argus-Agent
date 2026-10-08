import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useHCITheme } from '@/hooks/useHCITheme';
import { SectionCard, ToggleRow, ChipSelector, ChipOption } from '@/components/shared';

export interface ModelOption {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  description: string;
  icon: any;
  speed: 'Ultra Fast' | 'Fast' | 'Deep Reasoning';
  contextWindow: string;
}

export const STRICT_GEMINI_MODELS: ModelOption[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    badge: 'Next-Gen Speed',
    badgeColor: '#10b981',
    description: 'Ultra low-latency next-gen reasoning with optimized real-time tool execution.',
    icon: 'flash',
    speed: 'Ultra Fast',
    contextWindow: '1M Tokens',
  },
  {
    id: 'gemini-3.8-pro',
    name: 'Gemini 3.8 Pro',
    badge: 'Apex Frontier',
    badgeColor: '#6366f1',
    description: 'Premier next-generation model for deep synthesis, complex coding, and orchestration.',
    icon: 'hardware-chip',
    speed: 'Deep Reasoning',
    contextWindow: '2M Tokens',
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    badge: 'Flagship Speed',
    badgeColor: '#ec4899',
    description: 'State-of-the-art multimodal reasoning, tool calling, and high context capacity.',
    icon: 'flash',
    speed: 'Ultra Fast',
    contextWindow: '1M Tokens',
  },
  {
    id: 'gemini-3.7-pro',
    name: 'Gemini 3.7 Pro',
    badge: 'Flagship Logic',
    badgeColor: '#8b5cf6',
    description: 'Deep analytical reasoning, multi-step problem solving, and architecture logic.',
    icon: 'hardware-chip',
    speed: 'Deep Reasoning',
    contextWindow: '2M Tokens',
  },
];

interface AIEngineSectionProps {
  settings: any;
}

export function AIEngineSection({ settings }: AIEngineSectionProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  // Manual API Key State
  const [keyInput, setKeyInput] = useState('');
  const [isSecure, setIsSecure] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const currentKey = settings.apiKey || '';
  const hasKey = !!currentKey;

  const tempOptions: ChipOption[] = [
    { id: '0.0', label: '0.0', description: 'Precise' },
    { id: '0.2', label: '0.2', description: 'Balanced' },
    { id: '0.7', label: '0.7', description: 'Creative' },
  ];

  const handleSaveCustomKey = async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Please enter a valid Google Gemini API key.');
      return;
    }
    triggerHaptic('selection');
    setIsSaving(true);
    try {
      await settings.setApiKey(trimmed);
      setKeyInput('');
      triggerHaptic('success');
      Alert.alert('Key Saved', 'Gemini API key saved to device SecureStore.');
    } catch (e: any) {
      Alert.alert('Save Error', e.message || 'Failed to save API key.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearKey = async () => {
    triggerHaptic('warning');
    Alert.alert(
      'Remove API Key',
      'Are you sure you want to delete your saved Gemini API key from this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await SecureStore.deleteItemAsync('GEMINI_API_KEY');
            await settings.setApiKey('');
            triggerHaptic('success');
            Alert.alert('Key Removed', 'Gemini API key removed from device.');
          },
        },
      ]
    );
  };

  const handleTestKey = async () => {
    const keyToTest = keyInput.trim() || currentKey;
    if (!keyToTest) {
      Alert.alert('No Key', 'Please enter or save an API key to test.');
      return;
    }

    triggerHaptic('selection');
    setIsTesting(true);

    try {
      const activeModel = settings.geminiModel || 'gemini-3.8-flash';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${keyToTest}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond with the single word: OK' }] }],
        }),
      });

      const data = await res.json();

      if (res.status === 200) {
        triggerHaptic('success');
        Alert.alert(
          'API Key Valid & Ready!',
          `Successfully connected to ${activeModel}. Response: "${data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'OK'}".`
        );
      } else if (res.status === 402) {
        triggerHaptic('warning');
        Alert.alert(
          'Quota Depleted (HTTP 402)',
          'This API key belongs to a project whose prepayment credits are depleted. Please top up credits or use a key from a fresh account.'
        );
      } else if (res.status === 400) {
        triggerHaptic('warning');
        Alert.alert('Invalid Key (HTTP 400)', data?.error?.message || 'API key not valid.');
      } else {
        triggerHaptic('warning');
        Alert.alert(`Error (${res.status})`, data?.error?.message || 'Failed connecting to Gemini endpoint.');
      }
    } catch (e: any) {
      Alert.alert('Network Error', e.message || 'Could not reach Google servers.');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Interactive API Key Configuration Card */}
      <View style={[styles.keyConfigCard, { backgroundColor: colors.surface, borderColor: hasKey ? '#10b981' : '#f59e0b' }]}>
        <View style={styles.keyHeaderRow}>
          <View style={styles.keyBadge}>
            <Ionicons
              name={hasKey ? 'checkmark-circle' : 'key-outline'}
              size={16}
              color={hasKey ? '#10b981' : '#f59e0b'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.keyBadgeText,
                { color: hasKey ? '#10b981' : '#f59e0b', fontSize: scaleFont(12) },
              ]}
            >
              {hasKey ? 'API Key Active (On-Device)' : 'API Key Required'}
            </Text>
          </View>
          <View style={[styles.activeDot, { backgroundColor: hasKey ? '#10b981' : '#f59e0b' }]} />
        </View>

        <Text style={[styles.keyStatusText, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
          {hasKey
            ? `Active Key: ••••••••••••${currentKey.slice(-6)} (Protected in SecureStore)`
            : 'Enter your personal Google Gemini API key below to enable chat, voice, and intelligent agent actions.'}
        </Text>

        {/* Manual Input Field */}
        <View style={styles.inputWrap}>
          <TextInput
            style={[
              styles.keyInput,
              {
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.border,
                fontSize: scaleFont(12),
              },
            ]}
            placeholder="Paste your Gemini API key (AIza... / AQ...)"
            placeholderTextColor={colors.textMuted}
            value={keyInput}
            onChangeText={setKeyInput}
            secureTextEntry={isSecure}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setIsSecure((prev) => !prev)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name={isSecure ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionBtnRow}>
          {keyInput.trim().length > 0 && (
            <TouchableOpacity
              style={[styles.btnPrimary, { backgroundColor: colors.primary }]}
              onPress={handleSaveCustomKey}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={14} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={[styles.btnTextWhite, { fontSize: scaleFont(11) }]}>Save Key</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.btnOutline, { borderColor: colors.border, backgroundColor: colors.background }]}
            onPress={handleTestKey}
            disabled={isTesting}
            activeOpacity={0.8}
          >
            {isTesting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons name="pulse-outline" size={14} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={[styles.btnTextOutline, { color: colors.primary, fontSize: scaleFont(11) }]}>
                  Test Key Live
                </Text>
              </>
            )}
          </TouchableOpacity>

          {hasKey && (
            <TouchableOpacity
              style={[styles.btnReset, { backgroundColor: '#ef444420', flexDirection: 'row', alignItems: 'center' }]}
              onPress={handleClearKey}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={13} color="#ef4444" style={{ marginRight: 4 }} />
              <Text style={[styles.btnResetText, { color: '#ef4444', fontSize: scaleFont(11) }]}>
                Remove Key
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. Active Model Selection Cards */}
      <SectionCard
        icon={<Ionicons name="sparkles" size={scaleFont(20)} color="#8b5cf6" style={{ marginRight: 8 }} />}
        title="Active Gemini Model"
        subtitle="Select the primary neural architecture for multimodal reasoning and on-device execution."
      >
        <View style={styles.modelGrid}>
          {STRICT_GEMINI_MODELS.map((m) => {
            const isSelected = settings.geminiModel === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.modelCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isSelected ? m.badgeColor : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  settings.setGeminiModel(m.id);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.modelCardTop}>
                  <View style={styles.modelTitleRow}>
                    <Ionicons name={m.icon} size={18} color={m.badgeColor} style={{ marginRight: 6 }} />
                    <Text style={[styles.modelName, { color: colors.text, fontSize: scaleFont(13) }]}>
                      {m.name}
                    </Text>
                  </View>
                  <View style={[styles.modelBadge, { backgroundColor: `${m.badgeColor}20` }]}>
                    <Text style={[styles.modelBadgeText, { color: m.badgeColor, fontSize: scaleFont(10) }]}>
                      {m.badge}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.modelDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  {m.description}
                </Text>

                <View style={styles.modelFooter}>
                  <Text style={[styles.modelMeta, { color: colors.textMuted, fontSize: scaleFont(10) }]}>
                    ⚡ {m.speed} • 📚 {m.contextWindow}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={18} color={m.badgeColor} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </SectionCard>

      {/* 3. Generation Temperature */}
      <SectionCard
        icon={<Ionicons name="thermometer-outline" size={scaleFont(20)} color="#f59e0b" style={{ marginRight: 8 }} />}
        title="Generation Temperature"
        subtitle="Lower values produce deterministic, factual outputs. Higher values allow creative suggestions."
      >
        <ChipSelector
          options={tempOptions}
          selectedId={String(settings.temperature ?? 0.2)}
          onSelect={(id) => {
            triggerHaptic('selection');
            settings.setTemperature(parseFloat(id));
          }}
          equalWidth
        />
      </SectionCard>

      {/* 4. Autonomous Agent Features */}
      <SectionCard
        icon={<Ionicons name="bulb-outline" size={scaleFont(20)} color="#38bdf8" style={{ marginRight: 8 }} />}
        title="Agent Behavior"
        subtitle="Tune proactive decision making and autonomous background analysis."
      >
        <ToggleRow
          label="Proactive Suggestions"
          description="Suggest action cards, reminders, and shortcuts based on context"
          value={settings.showSuggestions}
          onValueChange={(val) => {
            triggerHaptic('selection');
            settings.toggleSuggestions(val);
          }}
        />

        <ToggleRow
          label="Auto-Categorize Transactions"
          description="Use Gemini to categorize incoming bank SMS receipts automatically"
          value={settings.autoCategorize}
          onValueChange={(val) => {
            triggerHaptic('selection');
            settings.toggleAutoCategorize(val);
          }}
          style={{ marginTop: 10 }}
        />
      </SectionCard>

      {/* 5. Hands-Free Voice & Wake Word */}
      <SectionCard
        icon={<Ionicons name="mic-outline" size={scaleFont(20)} color="#10b981" style={{ marginRight: 8 }} />}
        title="Hands-Free Voice & Wake Word"
        subtitle="Control your device hands-free using the 'Hey Argus' acoustic wake word."
      >
        <ToggleRow
          label="'Hey Argus' Wake Word"
          description="Continuously listen for 'Hey Argus' to awaken the agent hands-free without touching the screen"
          value={settings.alwaysOnVoiceEnabled}
          onValueChange={(val) => {
            triggerHaptic('selection');
            settings.toggleAlwaysOnVoice(val);
          }}
        />

        <ToggleRow
          label="Spoken Audio Feedback"
          description="Speak agent responses out loud using the device's native speech synthesis engine"
          value={settings.audioFeedbackEnabled}
          onValueChange={(val) => {
            triggerHaptic('selection');
            settings.toggleAudioFeedback(val);
          }}
          style={{ marginTop: 10 }}
        />
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  keyConfigCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
  },
  keyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  keyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  keyBadgeText: {
    fontWeight: '800',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  keyStatusText: {
    marginBottom: 12,
  },
  inputWrap: {
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 10,
  },
  keyInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingRight: 40,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
  },
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  btnTextWhite: {
    color: '#ffffff',
    fontWeight: '700',
  },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  btnTextOutline: {
    fontWeight: '700',
  },
  btnReset: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  btnResetText: {
    fontWeight: '600',
  },
  modelGrid: {
    gap: 10,
  },
  modelCard: {
    borderRadius: 14,
    padding: 14,
  },
  modelCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modelName: {
    fontWeight: '800',
  },
  modelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  modelBadgeText: {
    fontWeight: '700',
  },
  modelDesc: {
    lineHeight: 16,
    marginBottom: 10,
  },
  modelFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modelMeta: {
    fontWeight: '600',
  },
});
