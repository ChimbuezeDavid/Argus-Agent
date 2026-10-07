import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHCITheme } from '@/hooks/useHCITheme';

interface MaterialTopBarProps {
  title?: string;
  subtitle?: string;
  badgeText?: string;
  badgeDotColor?: string;
  onOpenDrawer: () => void;
  onOpenHistory?: () => void;
  onSync?: () => void;
  rightAction?: React.ReactNode;
}

export function MaterialTopBar({
  title,
  subtitle,
  badgeText,
  badgeDotColor = '#10b981',
  onOpenDrawer,
  onOpenHistory,
  onSync,
  rightAction,
}: MaterialTopBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: Math.max(insets.top, 10),
          borderBottomColor: colors.border,
        },
      ]}
    >
      {/* 1. Hamburger Menu Button */}
      <TouchableOpacity
        style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => {
          triggerHaptic('selection');
          onOpenDrawer();
        }}
        activeOpacity={0.7}
        accessibilityLabel="Open navigation drawer"
      >
        <Ionicons name="menu" size={22} color={colors.text} />
      </TouchableOpacity>

      {/* 2. Center Content / Title / Badge */}
      <View style={styles.centerContainer}>
        {badgeText ? (
          <View style={[styles.badgePill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statusDot, { backgroundColor: badgeDotColor }]} />
            <Text style={[styles.badgeText, { color: colors.text, fontSize: scaleFont(11) }]} numberOfLines={1}>
              {badgeText}
            </Text>
          </View>
        ) : (
          <View style={styles.titleCol}>
            {title && (
              <Text style={[styles.titleText, { color: colors.text, fontSize: scaleFont(16) }]} numberOfLines={1}>
                {title}
              </Text>
            )}
            {subtitle && (
              <Text style={[styles.subtitleText, { color: colors.textSecondary, fontSize: scaleFont(11) }]} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* 3. Right Action Buttons */}
      <View style={styles.rightActionsRow}>
        {rightAction ? (
          rightAction
        ) : (
          <>
            {onSync && (
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => {
                  triggerHaptic('selection');
                  onSync();
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="sync-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            )}

            {onOpenHistory && (
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => {
                  triggerHaptic('selection');
                  onOpenHistory();
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    alignItems: 'center',
  },
  titleText: {
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitleText: {
    fontWeight: '500',
    marginTop: 1,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    gap: 7,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  badgeText: {
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
