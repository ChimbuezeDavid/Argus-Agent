// Reusable ToggleRow component — label + description + Switch
import React from 'react';
import { View, Text, Switch, StyleSheet, ViewStyle } from 'react-native';
import { useHCITheme } from '@/hooks/useHCITheme';

interface ToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  style?: ViewStyle;
  /** If true, suppress automatic haptic on toggle. Caller handles custom haptic. */
  suppressHaptic?: boolean;
}

export function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  style,
  suppressHaptic = false,
}: ToggleRowProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  const handleChange = (val: boolean) => {
    if (!suppressHaptic) {
      triggerHaptic('selection');
    }
    onValueChange(val);
  };

  return (
    <View style={[styles.toggleRow, style]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.text, fontSize: scaleFont(12) }]}>{label}</Text>
        {description ? (
          <Text style={[styles.rowDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={handleChange}
        trackColor={{ false: '#33353d', true: colors.primary }}
        thumbColor={value ? '#ffffff' : '#9ba0a6'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  rowLabel: {
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: 0.1,
  },
  rowDesc: {
    lineHeight: 16,
    marginRight: 14,
  },
});
