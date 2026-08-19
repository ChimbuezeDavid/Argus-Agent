import React from 'react';
import { StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';

interface Shortcut {
  label: string;
  prompt: string;
}

interface ExecutiveReadinessCardProps {
  shortcuts: Shortcut[];
  onShortcutPress: (prompt: string) => void;
}

export function ExecutiveReadinessCard({ shortcuts, onShortcutPress }: ExecutiveReadinessCardProps) {
  return (
    <ScrollView
      style={styles.deckScroll}
      contentContainerStyle={styles.deckHeroContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Executive Readiness Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroBadgeRow}>
          <View style={styles.pulseDot} />
          <Text style={styles.heroBadgeText}>ARGUS EXECUTIVE AGENT</Text>
        </View>
        <Text style={styles.heroTitle}>Ready for command</Text>
        <Text style={styles.heroSubtitle}>
          Voice or text instruction ready. Tap the Voice Orb or type to make calls, launch apps, search knowledge, or log expenses.
        </Text>
      </View>

      {/* Quick Command Shortcuts */}
      <Text style={styles.shortcutsHeaderTitle}>INSTANT COMMAND SHORTCUTS</Text>
      <View style={styles.shortcutsGrid}>
        {shortcuts.map((item, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.shortcutChip}
            onPress={() => onShortcutPress(item.prompt)}
            activeOpacity={0.8}
          >
            <Text style={styles.shortcutChipText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  deckScroll: {
    flex: 1,
  },
  deckHeroContent: {
    padding: 16,
  },
  heroCard: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#27272a',
    marginTop: 8,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginBottom: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34d399',
    marginRight: 8,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#34d399',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fafafa',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 12,
    color: '#a1a1aa',
    lineHeight: 18,
  },
  shortcutsHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#71717a',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 10,
  },
  shortcutsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'transparent',
  },
  shortcutChip: {
    backgroundColor: '#18181b',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  shortcutChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fafafa',
  },
});
