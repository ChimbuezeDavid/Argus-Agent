import React from 'react';
import { StyleSheet, TouchableOpacity, View, ScrollView } from 'react-native';
import { Text } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';
import { useHCITheme } from '@/hooks/useHCITheme';

export interface ActionShortcut {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
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
      iconColor: '#38bdf8',
      prompt: 'Argus, check device readiness and telemetry status',
    },
    {
      id: 'act_2',
      label: 'Navigate',
      icon: 'navigate',
      iconColor: '#f472b6',
      prompt: 'Argus, open maps navigation to current destination',
    },
    {
      id: 'act_3',
      label: 'Budget Pulse',
      icon: 'pie-chart',
      iconColor: '#34d399',
      prompt: 'Argus, give me a quick summary of my monthly budget and spending',
    },
    {
      id: 'act_4',
      label: 'Today Plan',
      icon: 'calendar',
      iconColor: '#f59e0b',
      prompt: 'Argus, what plans and tasks do I have scheduled for today?',
    },
  ];

  const actionItems = shortcuts && shortcuts.length > 0 ? shortcuts : defaultShortcuts;

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionHeader, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
        SUGGESTED ACTIONS
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {actionItems.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={[
              styles.actionChip,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={() => {
              triggerHaptic('selection');
              onSelectAction(action.prompt);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, { backgroundColor: `${action.iconColor}18` }]}>
              <Ionicons name={action.icon} size={15} color={action.iconColor} />
            </View>
            <Text style={[styles.chipText, { color: colors.text, fontSize: scaleFont(12) }]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 14,
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  chipText: {
    fontWeight: '700',
  },
});
