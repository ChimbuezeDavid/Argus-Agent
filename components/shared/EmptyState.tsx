// Reusable EmptyState component — placeholder for empty lists
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHCITheme } from '@/hooks/useHCITheme';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  style?: ViewStyle;
}

export function EmptyState({ icon = 'folder-open-outline', title, subtitle, style }: EmptyStateProps) {
  const { colors, scaleFont } = useHCITheme();

  return (
    <View style={[styles.container, style]}>
      <Ionicons name={icon} size={48} color={colors.textMuted} style={{ marginBottom: 12 }} />
      <Text style={[styles.title, { color: colors.textSecondary, fontSize: scaleFont(15) }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.textMuted, fontSize: scaleFont(12) }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 18,
  },
});
