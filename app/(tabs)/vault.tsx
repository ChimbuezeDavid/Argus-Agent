import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useHCITheme } from '@/hooks/useHCITheme';

import NotesTab from '@/components/vault/NotesTab';
import TelemetryTab from '@/components/vault/TelemetryTab';
import GeofencesTab from '@/components/vault/GeofencesTab';

type VaultLens = 'notes' | 'telemetry' | 'geofences';

export default function VaultScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, scaleFont, triggerHaptic } = useHCITheme();
  const [activeLens, setActiveLens] = useState<VaultLens>('notes');
  const [refreshSignal, setRefreshSignal] = useState(0);

  const switchLens = (lens: VaultLens) => {
    triggerHaptic('light');
    setActiveLens(lens);
  };

  // Increment refresh signal on focus to trigger tab data refresh
  useFocusEffect(
    useCallback(() => {
      setRefreshSignal((prev) => prev + 1);
    }, [])
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 12) }]}>
      {/* Top Header Row (Hub & Tools + Settings Gear) */}
      <View style={styles.topHeaderRow}>
        <Text style={[styles.topHeaderTitle, { color: colors.text, fontSize: scaleFont(22) }]}>Hub & Tools</Text>
        <TouchableOpacity
          style={[styles.settingsCircleBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => {
            triggerHaptic('selection');
            router.push('/modal');
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="settings-sharp" size={17} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Top 3 Segmented Tabs (Notes • Screen Time • Geofences) */}
      <View style={styles.segmentedControl}>
        {/* Tab 1: Notes */}
        <TouchableOpacity
          style={[
            styles.segmentButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            activeLens === 'notes' && { backgroundColor: colors.primary, borderColor: colors.primary },
          ]}
          onPress={() => switchLens('notes')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="document-text"
            size={14}
            color={activeLens === 'notes' ? '#ffffff' : colors.textMuted}
            style={{ marginRight: 5 }}
          />
          <Text
            style={[
              styles.segmentText,
              { color: activeLens === 'notes' ? '#ffffff' : colors.textMuted, fontSize: scaleFont(12) },
            ]}
          >
            Notes
          </Text>
        </TouchableOpacity>

        {/* Tab 2: Screen Time */}
        <TouchableOpacity
          style={[
            styles.segmentButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            activeLens === 'telemetry' && [styles.segmentActive, { backgroundColor: colors.primaryBg, borderColor: colors.primary }],
          ]}
          onPress={() => switchLens('telemetry')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="timer-outline"
            size={14}
            color={activeLens === 'telemetry' ? colors.primary : colors.textMuted}
            style={{ marginRight: 5 }}
          />
          <Text
            style={[
              styles.segmentText,
              { color: activeLens === 'telemetry' ? colors.primary : colors.textMuted, fontSize: scaleFont(12) },
            ]}
          >
            Screen Time
          </Text>
        </TouchableOpacity>

        {/* Tab 3: Geofences */}
        <TouchableOpacity
          style={[
            styles.segmentButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            activeLens === 'geofences' && [styles.segmentActive, { backgroundColor: colors.primaryBg, borderColor: colors.primary }],
          ]}
          onPress={() => switchLens('geofences')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="location-sharp"
            size={14}
            color={activeLens === 'geofences' ? '#f43f5e' : colors.textMuted}
            style={{ marginRight: 5 }}
          />
          <Text
            style={[
              styles.segmentText,
              { color: activeLens === 'geofences' ? colors.primary : colors.textMuted, fontSize: scaleFont(12) },
            ]}
          >
            Geofences
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contentBox}>
        {activeLens === 'notes' && <NotesTab refreshSignal={refreshSignal} />}
        {activeLens === 'telemetry' && <TelemetryTab refreshSignal={refreshSignal} />}
        {activeLens === 'geofences' && <GeofencesTab refreshSignal={refreshSignal} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  topHeaderTitle: {
    fontWeight: '800',
  },
  settingsCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  segmentActive: {},
  segmentText: {
    fontWeight: '700',
  },
  contentBox: {
    flex: 1,
  },
});
