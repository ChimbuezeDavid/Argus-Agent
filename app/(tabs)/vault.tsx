import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useHCITheme } from '@/hooks/useHCITheme';

import NotesTab from '@/components/vault/NotesTab';
import TelemetryTab from '@/components/vault/TelemetryTab';
import GeofencesTab from '@/components/vault/GeofencesTab';
import { MaterialTopBar, NavigationDrawer, ContextualTabBar, TabItem } from '@/components/navigation';

type VaultLens = 'notes' | 'telemetry' | 'geofences';

const VAULT_TABS: TabItem[] = [
  { key: 'notes', label: 'Notes', icon: 'document-text-outline' },
  { key: 'geofences', label: 'Geofences', icon: 'location-outline' },
  { key: 'telemetry', label: 'Screen Time', icon: 'hardware-chip-outline' },
];

export default function VaultScreen() {
  const insets = useSafeAreaInsets();
  const { colors, triggerHaptic } = useHCITheme();
  const [activeLens, setActiveLens] = useState<VaultLens>('notes');
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const switchLens = (lens: string) => {
    triggerHaptic('light');
    setActiveLens(lens as VaultLens);
  };

  // Increment refresh signal on focus to trigger tab data refresh
  useFocusEffect(
    useCallback(() => {
      setRefreshSignal((prev) => prev + 1);
    }, [])
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 1. Material Top Bar with Hamburger Menu */}
      <MaterialTopBar
        title="Vault"
        subtitle={activeLens === 'notes' ? 'Executive Notes & Drafts' : activeLens === 'geofences' ? 'Active Geofence Boundaries' : 'App Usage & Screen Time'}
        onOpenDrawer={() => setDrawerVisible(true)}
      />

      {/* 2. Active Tab Content Surface */}
      <View style={styles.contentBox}>
        {activeLens === 'notes' && <NotesTab refreshSignal={refreshSignal} />}
        {activeLens === 'telemetry' && <TelemetryTab refreshSignal={refreshSignal} />}
        {activeLens === 'geofences' && <GeofencesTab refreshSignal={refreshSignal} />}
      </View>

      {/* 3. Material Contextual Bottom Sub-Tabs */}
      <ContextualTabBar
        tabs={VAULT_TABS}
        activeKey={activeLens}
        onTabChange={switchLens}
      />

      {/* 4. Global Navigation Drawer */}
      <NavigationDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        activeScreen="vault"
      />
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
