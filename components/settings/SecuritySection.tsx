import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform, Alert, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHCITheme } from '@/hooks/useHCITheme';
import { SectionCard, ToggleRow, ChipSelector, ChipOption } from '@/components/shared';
import { authenticateUser } from '@/services/security/securityService';
import { openAccessibilitySettings, isAccessibilityEnabled } from '@/services/rpa/accessibilityService';
import ArgusSystemMonitors from '@/modules/argus-system-monitors';

interface SecuritySectionProps {
  settings: any;
}

export function SecuritySection({ settings }: SecuritySectionProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();
  const [hasUsagePerm, setHasUsagePerm] = useState(false);
  const [hasNotificationPerm, setHasNotificationPerm] = useState(false);
  const [hasAccessibilityPerm, setHasAccessibilityPerm] = useState(false);

  const checkPermissions = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const [uPerm, nPerm, aPerm] = await Promise.all([
          ArgusSystemMonitors?.hasUsageStatsPermission?.(),
          ArgusSystemMonitors?.hasNotificationListenerPermission?.(),
          isAccessibilityEnabled(),
        ]);
        setHasUsagePerm(!!uPerm);
        setHasNotificationPerm(!!nPerm);
        setHasAccessibilityPerm(!!aPerm);
      } catch (e) {
        console.warn('Error checking security permissions:', e);
      }
    }
  }, []);

  useEffect(() => {
    checkPermissions();
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkPermissions();
      }
    });
    return () => sub.remove();
  }, [checkPermissions]);

  const handleToggleAppLock = async (enabled: boolean) => {
    triggerHaptic('selection');
    if (enabled) {
      const auth = await authenticateUser('Verify Biometrics or PIN to Enable App Lock');
      if (!auth.success) {
        Alert.alert('Authentication Failed', 'Could not verify biometric credentials.');
        return;
      }
    }
    await settings.toggleAppLock(enabled);
  };

  const timeoutOptions: ChipOption[] = [
    { id: '0', label: 'Immediate' },
    { id: '60000', label: '1 min' },
    { id: '300000', label: '5 min' },
    { id: '900000', label: '15 min' },
  ];

  return (
    <View style={styles.container}>
      {/* 1. Hardware Lock & Biometrics */}
      <SectionCard
        icon={<Ionicons name="finger-print-outline" size={scaleFont(20)} color="#10b981" style={{ marginRight: 8 }} />}
        title="Biometric & Screen Lock"
        subtitle="Require fingerprint, face recognition, or phone PIN to open Argus."
      >
        <ToggleRow
          label="Require Phone Lock"
          description="Authenticate via biometrics when app launches or returns from background"
          value={settings.appLockEnabled}
          onValueChange={handleToggleAppLock}
        />

        {settings.appLockEnabled && (
          <View style={styles.timeoutWrapper}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
              AUTO-LOCK TIMEOUT
            </Text>
            <ChipSelector
              options={timeoutOptions}
              selectedId={String(settings.appLockTimeout || 0)}
              onSelect={(id) => {
                triggerHaptic('selection');
                settings.setAppLockTimeout(parseInt(id, 10));
              }}
              equalWidth
            />
          </View>
        )}
      </SectionCard>

      {/* 2. Observer & RPA Autonomous Permissions */}
      <SectionCard
        icon={<Ionicons name="shield-checkmark" size={scaleFont(20)} color="#38bdf8" style={{ marginRight: 8 }} />}
        title="Observer & RPA Permissions"
        subtitle="On-device permissions for automated UI actions and screen awareness."
      >
        <View style={styles.permRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.permTitle, { color: colors.text, fontSize: scaleFont(13) }]}>
              Accessibility RPA Controller
            </Text>
            <Text style={[styles.permDesc, { color: colors.textMuted, fontSize: scaleFont(10) }]}>
              Autonomous screen reader and touch engine
            </Text>
          </View>
          <View style={[styles.permBadge, hasAccessibilityPerm ? styles.permBadgeOn : styles.permBadgeOff]}>
            <Text style={[styles.permBadgeText, hasAccessibilityPerm ? styles.permBadgeTextOn : styles.permBadgeTextOff]}>
              {hasAccessibilityPerm ? 'Active' : 'Disabled'}
            </Text>
          </View>
        </View>

        {!hasAccessibilityPerm && Platform.OS === 'android' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#064e3b', borderColor: '#059669' }]}
            onPress={() => {
              triggerHaptic('selection');
              openAccessibilitySettings();
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="finger-print-outline" size={16} color="#34d399" style={{ marginRight: 6 }} />
            <Text style={[styles.actionBtnText, { color: '#34d399', fontSize: scaleFont(12) }]}>
              Enable Argus in Accessibility Settings
            </Text>
          </TouchableOpacity>
        )}

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.permRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.permTitle, { color: colors.text, fontSize: scaleFont(13) }]}>
              Notification Listener
            </Text>
            <Text style={[styles.permDesc, { color: colors.textMuted, fontSize: scaleFont(10) }]}>
              Captures financial transactions and bank alerts
            </Text>
          </View>
          <View style={[styles.permBadge, hasNotificationPerm ? styles.permBadgeOn : styles.permBadgeOff]}>
            <Text style={[styles.permBadgeText, hasNotificationPerm ? styles.permBadgeTextOn : styles.permBadgeTextOff]}>
              {hasNotificationPerm ? 'Active' : 'Disabled'}
            </Text>
          </View>
        </View>

        {!hasNotificationPerm && Platform.OS === 'android' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => {
              triggerHaptic('selection');
              ArgusSystemMonitors.openNotificationListenerSettings();
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="notifications-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.actionBtnText, { color: colors.primary, fontSize: scaleFont(12) }]}>
              Grant Notification Access
            </Text>
          </TouchableOpacity>
        )}

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.permRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.permTitle, { color: colors.text, fontSize: scaleFont(13) }]}>
              Usage Stats Access
            </Text>
            <Text style={[styles.permDesc, { color: colors.textMuted, fontSize: scaleFont(10) }]}>
              Monitors foreground application usage & screen time
            </Text>
          </View>
          <View style={[styles.permBadge, hasUsagePerm ? styles.permBadgeOn : styles.permBadgeOff]}>
            <Text style={[styles.permBadgeText, hasUsagePerm ? styles.permBadgeTextOn : styles.permBadgeTextOff]}>
              {hasUsagePerm ? 'Granted' : 'Missing'}
            </Text>
          </View>
        </View>

        {!hasUsagePerm && Platform.OS === 'android' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => {
              triggerHaptic('selection');
              ArgusSystemMonitors.openUsageAccessSettings();
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="hardware-chip-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.actionBtnText, { color: colors.primary, fontSize: scaleFont(12) }]}>
              Grant Usage Access
            </Text>
          </TouchableOpacity>
        )}

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {Platform.OS === 'android' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => {
              triggerHaptic('selection');
              ArgusSystemMonitors.openAppNotificationSettings();
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="settings-outline" size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.actionBtnText, { color: colors.textSecondary, fontSize: scaleFont(12) }]}>
              System App Notification Settings
            </Text>
          </TouchableOpacity>
        )}
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  timeoutWrapper: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
  },
  fieldLabel: {
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  permTitle: {
    fontWeight: '700',
  },
  permDesc: {
    marginTop: 2,
  },
  permBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  permBadgeOn: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
  },
  permBadgeOff: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  permBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  permBadgeTextOn: {
    color: '#34d399',
  },
  permBadgeTextOff: {
    color: '#f87171',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  actionBtnText: {
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
});
