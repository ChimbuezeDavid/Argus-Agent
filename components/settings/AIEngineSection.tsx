import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

  const tempOptions: ChipOption[] = [
    { id: '0.0', label: '0.0', description: 'Precise' },
    { id: '0.2', label: '0.2', description: 'Balanced' },
    { id: '0.7', label: '0.7', description: 'Creative' },
  ];

  return (
    <View style={styles.container}>
      {/* 1. Environment API Key Status Card */}
      <View style={[styles.envKeyCard, { backgroundColor: colors.surface, borderColor: '#10b981' }]}>
        <View style={styles.envKeyHeader}>
          <View style={styles.envKeyBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#10b981" style={{ marginRight: 6 }} />
            <Text style={[styles.envKeyBadgeText, { color: '#10b981', fontSize: scaleFont(12) }]}>
              API Key Active (.env)
            </Text>
          </View>
          <View style={[styles.activeDot, { backgroundColor: '#10b981' }]} />
        </View>
        <Text style={[styles.envKeyDesc, { color: colors.textSecondary, fontSize: scaleFont(12) }]}>
          Your Google Gemini API key is routed securely from the on-device environment file. Manual entry is not required.
        </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  envKeyCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
  },
  envKeyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  envKeyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  envKeyBadgeText: {
    fontWeight: '800',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  envKeyDesc: {
    lineHeight: 18,
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
