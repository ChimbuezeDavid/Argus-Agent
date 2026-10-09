import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useHCITheme } from '@/hooks/useHCITheme';

import PlanTab from '@/components/vault/PlanTab';
import NotesTab from '@/components/vault/NotesTab';
import TelemetryTab from '@/components/vault/TelemetryTab';
import GeofencesTab from '@/components/vault/GeofencesTab';
import { MaterialTopBar, NavigationDrawer, ContextualTabBar, TabItem } from '@/components/navigation';

type VaultLens = 'plan' | 'notes' | 'geofences' | 'telemetry';

const VAULT_TABS: TabItem[] = [
  { key: 'plan', label: 'Plan', icon: 'checkbox-outline' },
  { key: 'notes', label: 'Notes', icon: 'document-text-outline' },
  { key: 'geofences', label: 'Geofences', icon: 'location-outline' },
  { key: 'telemetry', label: 'Screen Time', icon: 'hardware-chip-outline' },
];

export default function VaultScreen() {
  const insets = useSafeAreaInsets();
  const { colors, triggerHaptic } = useHCITheme();
  const [activeLens, setActiveLens] = useState<VaultLens>('plan');
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

  const getSubtitle = () => {
    switch (activeLens) {
      case 'plan':
        return 'Executive Schedule & Tasks';
      case 'notes':
        return 'Knowledge Vault & Drafts';
      case 'geofences':
        return 'Active Geofence Boundaries';
      case 'telemetry':
        return 'App Usage & Screen Time';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 1. Material Top Bar with Hamburger Menu */}
      <MaterialTopBar
        title="Vault"
        subtitle={getSubtitle()}
        onOpenDrawer={() => setDrawerVisible(true)}
      />

      {/* 2. Active Tab Content Surface */}
      <View style={styles.contentBox}>
        {activeLens === 'plan' && <PlanTab refreshSignal={refreshSignal} />}
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
  contentBox: {
    flex: 1,
  },
});
