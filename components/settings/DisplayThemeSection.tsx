import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHCITheme } from '@/hooks/useHCITheme';
import { ThemeMode, TextScale } from '@/store/settingsStore';
import { SectionCard, ChipSelector, ToggleRow, ChipOption } from '@/components/shared';

interface DisplayThemeSectionProps {
  settings: any;
}

export function DisplayThemeSection({ settings }: DisplayThemeSectionProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  const themeOptions: ChipOption<ThemeMode>[] = [
    { id: 'system', label: 'System', description: 'Follow OS' },
    { id: 'dark', label: 'Dark', description: 'OLED Black' },
    { id: 'light', label: 'Light', description: 'Clean White' },
  ];

  const scaleOptions: ChipOption<TextScale>[] = [
    { id: 'small', label: 'Small', description: '88%' },
    { id: 'medium', label: 'Medium', description: '100%' },
    { id: 'large', label: 'Large', description: '114%' },
    { id: 'xlarge', label: 'XL', description: '128%' },
  ];

  return (
    <SectionCard
      icon={<Ionicons name="color-palette-outline" size={scaleFont(20)} color="#a855f7" style={{ marginRight: 8 }} />}
      title="Display & Visual Theme"
      subtitle="Choose light/dark visual theme, adjust typography scale, or enable high-contrast accessibility."
    >
      <Text style={[styles.fieldLabel, { color: colors.textMuted, fontSize: scaleFont(11) }]}>VISUAL PALETTE</Text>
      <ChipSelector<ThemeMode>
        options={themeOptions}
        selectedId={settings.themeMode}
        onSelect={(id) => {
          triggerHaptic('selection');
          settings.setThemeMode(id);
        }}
        style={{ marginBottom: 14 }}
      />

      <Text style={[styles.fieldLabel, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
        TEXT SCALING & READABILITY
      </Text>
      <ChipSelector<TextScale>
        options={scaleOptions}
        selectedId={settings.textScale}
        onSelect={(id) => {
          triggerHaptic('selection');
          settings.setTextScale(id);
        }}
        style={{ marginBottom: 14 }}
      />

      <ToggleRow
        label="High-Contrast Mode"
        description="Maximize color borders and typography contrast for low vision"
        value={settings.highContrast}
        onValueChange={(val) => {
          triggerHaptic('selection');
          settings.toggleHighContrast(val);
        }}
        style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}
      />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
});
