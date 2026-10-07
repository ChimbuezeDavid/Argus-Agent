import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useHCITheme } from '@/hooks/useHCITheme';

interface TelemetryHeaderProps {
  insetsTop: number;
  locationName?: string;
  onOpenDrawer?: () => void;
  onOpenHistory?: () => void;
  onSync?: () => void;
}

export function TelemetryHeader({
  insetsTop,
  locationName = 'Asubi • Home',
  onOpenDrawer,
  onOpenHistory,
  onSync,
}: TelemetryHeaderProps) {
  const router = useRouter();
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  return (
    <View style={[styles.headerContainer, { backgroundColor: colors.background, paddingTop: Math.max(insetsTop, 12) }]}>
      {/* 0. Hamburger Navigation Button */}
      {onOpenDrawer && (
        <TouchableOpacity
          style={[styles.actionCircleBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => {
            triggerHaptic('selection');
            onOpenDrawer();
          }}
          activeOpacity={0.8}
          accessibilityLabel="Open navigation drawer"
        >
          <Ionicons name="menu" size={20} color={colors.text} />
        </TouchableOpacity>
      )}

      {/* 2. Active Geofence / Location Pill */}
      <TouchableOpacity
        style={[styles.locationPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => {
          triggerHaptic('selection');
          router.push('/(tabs)/vault');
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="location" size={13} color="#f43f5e" style={{ marginRight: 4 }} />
        <Text style={[styles.locationText, { color: colors.text, fontSize: scaleFont(12) }]} numberOfLines={1}>
          {locationName}
        </Text>
      </TouchableOpacity>

      {/* 3. Actions: Sync & Command History */}
      <View style={styles.actionsRow}>
        {onSync && (
          <TouchableOpacity
            style={[styles.actionCircleBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => {
              triggerHaptic('selection');
              onSync();
            }}
            activeOpacity={0.8}
            accessibilityLabel="Sync on-device services"
          >
            <Ionicons name="sync-outline" size={17} color={colors.primary} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionCircleBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => {
            triggerHaptic('selection');
            onOpenHistory?.();
          }}
          activeOpacity={0.8}
          accessibilityLabel="Open session history"
        >
          <Ionicons name="time-outline" size={17} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  onDevicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  onDeviceText: {
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  locationPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  locationText: {
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
