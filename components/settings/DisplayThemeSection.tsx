import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHCITheme } from '@/hooks/useHCITheme';
import { ThemeMode, TextScale } from '@/store/settingsStore';
import { SectionCard, ToggleRow } from '@/components/shared';

interface DisplayThemeSectionProps {
  settings: any;
}

interface ThemeOptionItem {
  id: ThemeMode;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  previewBg: string;
  previewBorder: string;
  previewText: string;
}

interface ScaleOptionItem {
  id: TextScale;
  label: string;
  scalePercent: string;
  description: string;
}

export function DisplayThemeSection({ settings }: DisplayThemeSectionProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  const themeOptions: ThemeOptionItem[] = [
    {
      id: 'system',
      title: 'System Dynamic',
      subtitle: 'Automatically adapts to your Android OS dark or light setting',
      icon: 'phone-portrait-outline',
      previewBg: '#1e293b',
      previewBorder: '#475569',
      previewText: '#f8fafc',
    },
    {
      id: 'dark',
      title: 'OLED Pitch Black',
      subtitle: 'Pure AMOLED black with battery savings and high contrast',
      icon: 'moon',
      previewBg: '#09090b',
      previewBorder: '#27272a',
      previewText: '#fafafa',
    },
    {
      id: 'light',
      title: 'Clean Minimal Light',
      subtitle: 'Crisp white canvas designed for high daylight readability',
      icon: 'sunny',
      previewBg: '#ffffff',
      previewBorder: '#e2e8f0',
      previewText: '#0f172a',
    },
  ];

  const scaleOptions: ScaleOptionItem[] = [
    { id: 'small', label: 'Compact', scalePercent: '88%', description: 'Maximum screen density for power users' },
    { id: 'medium', label: 'Balanced', scalePercent: '100%', description: 'Default system sizing for clear readability' },
    { id: 'large', label: 'Expanded', scalePercent: '114%', description: 'Larger typography for effortless reading' },
    { id: 'xlarge', label: 'Accessibility', scalePercent: '128%', description: 'High-visibility text sizing for low vision' },
  ];

  return (
    <View style={styles.container}>
      {/* 1. Theme Palette Cards */}
      <SectionCard
        icon={<Ionicons name="color-palette-outline" size={scaleFont(20)} color="#a855f7" style={{ marginRight: 8 }} />}
        title="Visual Theme Palette"
        subtitle="Choose the interface appearance mode across all tabs and components."
      >
        <View style={styles.themeList}>
          {themeOptions.map((opt) => {
            const isSelected = settings.themeMode === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.themeCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isSelected ? '#a855f7' : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  settings.setThemeMode(opt.id);
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.themePreviewThumb,
                    { backgroundColor: opt.previewBg, borderColor: opt.previewBorder },
                  ]}
                >
                  <Ionicons name={opt.icon} size={18} color={opt.id === 'light' ? '#f59e0b' : '#38bdf8'} />
                </View>

                <View style={styles.themeMetaCol}>
                  <Text style={[styles.themeTitle, { color: colors.text, fontSize: scaleFont(13) }]}>
                    {opt.title}
                  </Text>
                  <Text style={[styles.themeSubtitle, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                    {opt.subtitle}
                  </Text>
                </View>

                <View style={styles.radioBox}>
                  {isSelected ? (
                    <Ionicons name="checkmark-circle" size={22} color="#a855f7" />
                  ) : (
                    <View style={[styles.radioEmpty, { borderColor: colors.border }]} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </SectionCard>

      {/* 2. Live Typography Preview Sandbox */}
      <View style={[styles.previewSandbox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sandboxHeader}>
          <Ionicons name="text-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.sandboxLabel, { color: colors.primary, fontSize: scaleFont(11) }]}>
            LIVE TYPOGRAPHY PREVIEW ({settings.textScale.toUpperCase()})
          </Text>
        </View>

        <Text style={[styles.previewHeading, { color: colors.text, fontSize: scaleFont(16) }]}>
          Argus Autonomous Agent
        </Text>
        <Text style={[styles.previewBody, { color: colors.textSecondary, fontSize: scaleFont(12) }]}>
          On-device intelligence with local SQLite persistence and natural speech synthesis.
        </Text>
        <Text style={[styles.previewAmount, { color: colors.primary, fontSize: scaleFont(20) }]}>
          ₦145,200.00 Ledger Balance
        </Text>
      </View>

      {/* 3. Text Scaling Cards */}
      <SectionCard
        icon={<Ionicons name="text" size={scaleFont(20)} color="#38bdf8" style={{ marginRight: 8 }} />}
        title="Text Scaling & Density"
        subtitle="Scale font sizes dynamically across buttons, bubbles, and cards."
      >
        <View style={styles.scaleGrid}>
          {scaleOptions.map((sc) => {
            const isSelected = settings.textScale === sc.id;
            return (
              <TouchableOpacity
                key={sc.id}
                style={[
                  styles.scaleCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isSelected ? '#38bdf8' : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  settings.setTextScale(sc.id);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.scaleCardTop}>
                  <Text style={[styles.scaleLabel, { color: colors.text, fontSize: scaleFont(13) }]}>
                    {sc.label}
                  </Text>
                  <View style={[styles.percentBadge, { backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.15)' : colors.background }]}>
                    <Text style={[styles.percentText, { color: isSelected ? '#38bdf8' : colors.textSecondary, fontSize: scaleFont(10) }]}>
                      {sc.scalePercent}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.scaleDesc, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
                  {sc.description}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SectionCard>

      {/* 4. High Contrast Accessibility Mode */}
      <SectionCard
        icon={<Ionicons name="contrast-outline" size={scaleFont(20)} color="#10b981" style={{ marginRight: 8 }} />}
        title="Accessibility Contrast"
        subtitle="Enhances visual separation for outdoor usage and low vision."
      >
        <ToggleRow
          label="High-Contrast Mode"
          description="Boosts card border outlines and typography contrast ratios"
          value={settings.highContrast}
          onValueChange={(val) => {
            triggerHaptic('selection');
            settings.toggleHighContrast(val);
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
  themeList: {
    gap: 10,
  },
  themeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
  },
  themePreviewThumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  themeMetaCol: {
    flex: 1,
    marginRight: 8,
  },
  themeTitle: {
    fontWeight: '700',
  },
  themeSubtitle: {
    marginTop: 2,
    lineHeight: 15,
  },
  radioBox: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioEmpty: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  previewSandbox: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  sandboxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sandboxLabel: {
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  previewHeading: {
    fontWeight: '800',
    marginBottom: 4,
  },
  previewBody: {
    lineHeight: 18,
    marginBottom: 8,
  },
  previewAmount: {
    fontWeight: '900',
  },
  scaleGrid: {
    gap: 10,
  },
  scaleCard: {
    padding: 14,
    borderRadius: 14,
  },
  scaleCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  scaleLabel: {
    fontWeight: '700',
  },
  percentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  percentText: {
    fontWeight: '800',
  },
  scaleDesc: {
    lineHeight: 15,
  },
});
