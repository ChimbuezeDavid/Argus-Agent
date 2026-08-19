import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';
import { useHCITheme } from '@/hooks/useHCITheme';

export interface ActionShortcut {
  id: string;
  label: string;
  icon: string;
  iconType: 'ionicons' | 'material' | 'feather';
  prompt: string;
}

interface SuggestedActionsProps {
  shortcuts?: ActionShortcut[];
  onSelectAction: (prompt: string) => void;
}

export function SuggestedActions({ shortcuts, onSelectAction }: SuggestedActionsProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  const defaultShortcuts: ActionShortcut[] = [
    {
      id: 'act_1',
      label: 'System Status',
      icon: 'shield-checkmark',
      iconType: 'ionicons',
      prompt: 'Argus, check device readiness and telemetry status',
    },
    {
      id: 'act_2',
      label: 'Navigate',
      icon: 'map',
      iconType: 'ionicons',
      prompt: 'Navigate to Eko Hotel Lagos on maps',
    },
    {
      id: 'act_3',
      label: 'Budget Pulse',
      icon: 'wallet-outline',
      iconType: 'ionicons',
      prompt: 'What is my budget status?',
    },
  ];

  const actionItems = shortcuts && shortcuts.length > 0 ? shortcuts : defaultShortcuts;

  const renderIcon = (action: ActionShortcut) => {
    switch (action.id) {
      case 'act_1':
        return <Ionicons name="shield-checkmark" size={14} color="#38bdf8" style={{ marginRight: 6 }} />;
      case 'act_2':
        return <Ionicons name="map" size={14} color="#f472b6" style={{ marginRight: 6 }} />;
      case 'act_3':
        return <Ionicons name="stats-chart" size={14} color="#34d399" style={{ marginRight: 6 }} />;
      default:
        return <Ionicons name="flash" size={14} color="#38bdf8" style={{ marginRight: 6 }} />;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionHeader, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
        SUGGESTED ACTIONS
      </Text>

      <View style={styles.chipsRow}>
        {actionItems.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={[styles.actionChip, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              triggerHaptic('selection');
              onSelectAction(action.prompt);
            }}
            activeOpacity={0.8}
          >
            {renderIcon(action)}
            <Text style={[styles.chipText, { color: colors.text, fontSize: scaleFont(12) }]} numberOfLines={1}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionHeader: {
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  chipText: {
    fontWeight: '700',
  },
});
