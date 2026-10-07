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
      return (
        <View style={[styles.iconWrapper, { backgroundColor: `${colors.primary}18` }]}>
          {icon}
        </View>
      );
    }
    if (typeof icon === 'string') {
      return (
        <View style={[styles.iconWrapper, { backgroundColor: `${colors.primary}18` }]}>
          <Ionicons
            name={icon as any}
            size={scaleFont(18)}
            color={colors.primary}
          />
        </View>
      );
    }
    return null;
  };

  return (
    <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      <View style={styles.groupHeader}>
        {renderIcon()}
        <View style={{ flex: 1 }}>
          <Text style={[styles.groupTitle, { color: colors.text, fontSize: scaleFont(15) }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.groupSubtitle, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  groupCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitle: {
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  groupSubtitle: {
    marginTop: 2,
    lineHeight: 16,
  },
});
