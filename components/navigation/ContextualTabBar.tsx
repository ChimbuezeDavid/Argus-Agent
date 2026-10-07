import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHCITheme } from '@/hooks/useHCITheme';

export interface TabItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: number;
}

interface ContextualTabBarProps {
  tabs: TabItem[];
  activeKey: string;
  onTabChange: (key: string) => void;
}

export function ContextualTabBar({ tabs, activeKey, onTabChange }: ContextualTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      {tabs.map((tab) => {
        const isActive = activeKey === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabButton}
            onPress={() => {
              triggerHaptic('light');
              onTabChange(tab.key);
            }}
            activeOpacity={0.7}
          >
            {/* Active Pill Indicator */}
            <View
              style={[
                styles.iconContainer,
                isActive && {
                  backgroundColor: `${colors.primary}25`,
                },
              ]}
            >
              <Ionicons
                name={tab.icon}
                size={scaleFont(20)}
                color={isActive ? colors.primary : colors.textMuted}
              />
              {!!tab.badge && tab.badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{tab.badge > 99 ? '99+' : tab.badge}</Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.tabLabel,
                {
                  color: isActive ? colors.primary : colors.textMuted,
                  fontSize: scaleFont(11),
                  fontWeight: isActive ? '700' : '500',
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingTop: 8,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  iconContainer: {
    width: 48,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 3,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: 2,
    backgroundColor: '#ef4444',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  tabLabel: {
    letterSpacing: 0.2,
  },
});
