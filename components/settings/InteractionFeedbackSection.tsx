import React from 'react';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHCITheme } from '@/hooks/useHCITheme';
import { SectionCard, ToggleRow } from '@/components/shared';

interface InteractionFeedbackSectionProps {
  settings: any;
}

export function InteractionFeedbackSection({ settings }: InteractionFeedbackSectionProps) {
  const { scaleFont, triggerHaptic } = useHCITheme();

  return (
    <SectionCard
      icon={<Ionicons name="hardware-chip-outline" size={scaleFont(20)} color="#10b981" style={{ marginRight: 8 }} />}
      title="Interaction & Feedback"
      subtitle="Fine-tune vibration haptics, voice sound effects, and motion sickness reduction."
    >
      <ToggleRow
        label="Haptic Vibration Feedback"
        description="Physical vibration clicks on buttons, voice taps, and expense logs"
        value={settings.hapticFeedbackEnabled}
        onValueChange={(val) => {
          settings.toggleHapticFeedback(val);
          if (val) triggerHaptic('success');
        }}
      />

      <ToggleRow
        label="Read Agent Responses Aloud (Voice Output)"
        description="Automatically speak Argus responses with text-to-speech voice"
        value={settings.audioFeedbackEnabled}
        onValueChange={(val) => {
          triggerHaptic('selection');
          settings.toggleAudioFeedback(val);
        }}
        style={styles.marginTop}
      />

      <ToggleRow
        label="In-App Sound Effects & Chimes"
        description="Audio chimes on voice recognition start and action completions"
        value={settings.soundEffectsEnabled}
        onValueChange={(val) => {
          triggerHaptic('selection');
          settings.toggleSoundEffects(val);
        }}
        style={styles.marginTop}
      />

      <ToggleRow
        label="Reduce Motion & Heavy Animation"
        description="Mute pulsing visual effects for motion sensitivity"
        value={settings.reduceMotion}
        onValueChange={(val) => {
          triggerHaptic('selection');
          settings.toggleReduceMotion(val);
        }}
        style={styles.marginTop}
      />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  marginTop: {
    marginTop: 10,
  },
});
