// Reusable SectionCard component — wraps a group of settings/content with icon header
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHCITheme } from '@/hooks/useHCITheme';

interface SectionCardProps {
  icon?: React.ReactNode | keyof typeof Ionicons.glyphMap | string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function SectionCard({ icon, title, subtitle, children, style }: SectionCardProps) {
  const { colors, scaleFont } = useHCITheme();

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return icon;
    }
    if (typeof icon === 'string') {
      return (
        <Ionicons
          name={icon as any}
          size={scaleFont(16)}
          color="#38bdf8"
          style={{ marginRight: 8 }}
        />
      );
    }
    return null;
  };

  return (
    <View style={[styles.groupCard, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      <View style={styles.groupHeader}>
        {renderIcon()}
        <Text style={[styles.groupTitle, { color: colors.text, fontSize: scaleFont(14) }]}>{title}</Text>
      </View>
      {subtitle ? (
        <Text style={[styles.groupSubtitle, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
          {subtitle}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  groupCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  groupTitle: {
    fontWeight: '800',
  },
  groupSubtitle: {
    marginBottom: 12,
    lineHeight: 16,
  },
});
