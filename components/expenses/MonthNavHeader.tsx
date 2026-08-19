import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHCITheme } from '@/hooks/useHCITheme';

interface MonthNavHeaderProps {
  monthLabel: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export function MonthNavHeader({ monthLabel, onPrevMonth, onNextMonth }: MonthNavHeaderProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  return (
    <View style={[styles.monthNavContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity
        style={[styles.monthNavButton, { backgroundColor: colors.surface }]}
        onPress={() => {
          triggerHaptic('selection');
          onPrevMonth();
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
      </TouchableOpacity>

      <View style={styles.monthNavCenter}>
        <Ionicons name="calendar" size={15} color={colors.primary} style={{ marginRight: 6 }} />
        <Text style={[styles.monthNavTitle, { color: colors.text, fontSize: scaleFont(14) }]}>{monthLabel}</Text>
      </View>

      <TouchableOpacity
        style={[styles.monthNavButton, { backgroundColor: colors.surface }]}
        onPress={() => {
          triggerHaptic('selection');
          onNextMonth();
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  monthNavContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  monthNavButton: {
    padding: 6,
    borderRadius: 8,
  },
  monthNavCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthNavTitle: {
    fontWeight: '700',
  },
});
