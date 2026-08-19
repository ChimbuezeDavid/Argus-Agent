import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  PermissionsAndroid,
  AppState,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as LocalAuthentication from 'expo-local-authentication';
import ArgusSystemMonitors from '@/modules/argus-system-monitors';
import { useSettingsStore } from '@/store/settingsStore';
import { useHCITheme } from '@/hooks/useHCITheme';

interface OnboardingAccessModalProps {
  visible: boolean;
  onComplete: () => void;
}

export function OnboardingAccessModal({ visible, onComplete }: OnboardingAccessModalProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();
  const settings = useSettingsStore();

  const [hasMicPerm, setHasMicPerm] = useState(false);
  const [hasNotifListenerPerm, setHasNotifListenerPerm] = useState(false);
  const [hasLocationPerm, setHasLocationPerm] = useState(false);
  const [hasUsagePerm, setHasUsagePerm] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const checkAllPermissions = async () => {
    try {
      if (Platform.OS === 'android') {
        const [mPerm, nPerm, uPerm, locStatus, bio] = await Promise.all([
          PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO),
          ArgusSystemMonitors?.hasNotificationListenerPermission?.(),
          ArgusSystemMonitors?.hasUsageStatsPermission?.(),
          Location.getForegroundPermissionsAsync(),
          LocalAuthentication.hasHardwareAsync(),
        ]);
        setHasMicPerm(!!mPerm);
        setHasNotifListenerPerm(!!nPerm);
        setHasUsagePerm(!!uPerm);
        setHasLocationPerm(locStatus.granted);
        setBiometricAvailable(bio);
      }
    } catch (e) {
      console.warn('Error checking onboarding permissions:', e);
    }
  };

  useEffect(() => {
    if (visible) {
      checkAllPermissions();
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          checkAllPermissions();
        }
      });
      return () => sub.remove();
    }
  }, [visible]);

  const handleGrantMic = async () => {
    triggerHaptic('selection');
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
          title: 'Microphone Permission',
          message: 'Argus Agent requires microphone access for Voice Assistance & Spoken Commands.',
          buttonPositive: 'Allow Microphone',
        });
        setHasMicPerm(granted === PermissionsAndroid.RESULTS.GRANTED);
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const handleGrantLocation = async () => {
    triggerHaptic('selection');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        await Location.requestBackgroundPermissionsAsync().catch(() => {});
        setHasLocationPerm(true);
      }
    } catch (err) {
      console.warn(err);
    }
  };

  const handleFinish = async () => {
    triggerHaptic('success');
    await settings.completeOnboarding();
    onComplete();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
        >
          {/* Header Badge */}
          <View style={styles.headerArea}>
            <View style={[styles.shieldCircle, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}>
              <Ionicons name="shield-checkmark" size={36} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text, fontSize: scaleFont(20) }]}>
              Argus Agent Access Control
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: scaleFont(13) }]}>
              Configure system permissions for your autonomous executive assistant. All data stays 100% encrypted and local on your device.
            </Text>
          </View>

          {/* 1. Voice & Audio Control */}
          <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: '#3b82f620' }]}>
                <Ionicons name="mic" size={20} color="#3b82f6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(14) }]}>
                  Voice Assistance (Microphone)
                </Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  Enables multimodal voice recognition, Gemini audio reasoning, and hands-free spoken commands.
                </Text>
              </View>
            </View>
            <View style={styles.cardActionRow}>
              <View style={[styles.statusBadge, hasMicPerm ? styles.badgeActive : styles.badgeInactive]}>
                <Text style={[styles.statusBadgeText, { color: hasMicPerm ? '#10b981' : '#71717a' }]}>
                  {hasMicPerm ? 'Granted' : 'Not Granted'}
                </Text>
              </View>
              {!hasMicPerm && (
                <TouchableOpacity
                  style={[styles.grantBtn, { backgroundColor: colors.primary }]}
                  onPress={handleGrantMic}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.grantBtnText, { fontSize: scaleFont(11) }]}>Grant Permission</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 2. Bank Alert & Notification Interceptor */}
          <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: '#10b98120' }]}>
                <Ionicons name="notifications" size={20} color="#10b981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(14) }]}>
                  Bank Alerts & SMS Interceptor
                </Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  Automatically parses Nigerian bank SMS & debit alerts (OPay, GTBank, Kuda, PalmPay) into your live budget ledger.
                </Text>
              </View>
            </View>
            <View style={styles.cardActionRow}>
              <View style={[styles.statusBadge, hasNotifListenerPerm ? styles.badgeActive : styles.badgeInactive]}>
                <Text style={[styles.statusBadgeText, { color: hasNotifListenerPerm ? '#10b981' : '#71717a' }]}>
                  {hasNotifListenerPerm ? 'Granted' : 'Not Granted'}
                </Text>
              </View>
              {!hasNotifListenerPerm && (
                <TouchableOpacity
                  style={[styles.grantBtn, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    triggerHaptic('selection');
                    ArgusSystemMonitors.openNotificationListenerSettings();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.grantBtnText, { fontSize: scaleFont(11) }]}>Enable Access</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 3. Location & Geofencing */}
          <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: '#f43f5e20' }]}>
                <Ionicons name="location" size={20} color="#f43f5e" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(14) }]}>
                  Boundary Monitoring & Geofences
                </Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  Monitors on-device boundary arrivals and departures to execute your Habit Stacking (HS) routines.
                </Text>
              </View>
            </View>
            <View style={styles.cardActionRow}>
              <View style={[styles.statusBadge, hasLocationPerm ? styles.badgeActive : styles.badgeInactive]}>
                <Text style={[styles.statusBadgeText, { color: hasLocationPerm ? '#10b981' : '#71717a' }]}>
                  {hasLocationPerm ? 'Granted' : 'Not Granted'}
                </Text>
              </View>
              {!hasLocationPerm && (
                <TouchableOpacity
                  style={[styles.grantBtn, { backgroundColor: colors.primary }]}
                  onPress={handleGrantLocation}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.grantBtnText, { fontSize: scaleFont(11) }]}>Grant Location</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 4. Foreground Usage & Telemetry */}
          <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: '#8b5cf620' }]}>
                <Ionicons name="hardware-chip" size={20} color="#8b5cf6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(14) }]}>
                  Screen Time & Usage Telemetry
                </Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  Provides daily app usage breakdowns and digital wellbeing telemetry inside your Vault.
                </Text>
              </View>
            </View>
            <View style={styles.cardActionRow}>
              <View style={[styles.statusBadge, hasUsagePerm ? styles.badgeActive : styles.badgeInactive]}>
                <Text style={[styles.statusBadgeText, { color: hasUsagePerm ? '#10b981' : '#71717a' }]}>
                  {hasUsagePerm ? 'Granted' : 'Not Granted'}
                </Text>
              </View>
              {!hasUsagePerm && (
                <TouchableOpacity
                  style={[styles.grantBtn, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    triggerHaptic('selection');
                    ArgusSystemMonitors.openUsageAccessSettings();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.grantBtnText, { fontSize: scaleFont(11) }]}>Grant Access</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 5. Biometric Lock */}
          {biometricAvailable && (
            <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.iconBox, { backgroundColor: '#eab30820' }]}>
                  <Ionicons name="finger-print" size={20} color="#eab308" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(14) }]}>
                    Hardware Biometric Lock
                  </Text>
                  <Text style={[styles.cardDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                    Require fingerprint or face authentication whenever Argus Agent is opened.
                  </Text>
                </View>
              </View>
              <View style={styles.cardActionRow}>
                <Text style={{ color: colors.textSecondary, fontSize: scaleFont(12), fontWeight: '600' }}>
                  {settings.appLockEnabled ? 'Lock Enabled' : 'Lock Disabled'}
                </Text>
                <Switch
                  value={settings.appLockEnabled}
                  onValueChange={(val) => {
                    triggerHaptic('selection');
                    settings.toggleAppLock(val);
                  }}
                  trackColor={{ false: '#3f3f46', true: colors.primary }}
                  thumbColor={settings.appLockEnabled ? '#ffffff' : '#a1a1aa'}
                />
              </View>
            </View>
          )}

          {/* Finish & Launch Button */}
          <TouchableOpacity
            style={[styles.finishBtn, { backgroundColor: colors.primary }]}
            onPress={handleFinish}
            activeOpacity={0.85}
          >
            <Ionicons name="rocket-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={[styles.finishBtnText, { fontSize: scaleFont(14) }]}>
              Complete Setup & Launch Argus
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: 24,
  },
  shieldCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 10,
  },
  permCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontWeight: '800',
    marginBottom: 4,
  },
  cardDesc: {
    lineHeight: 16,
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#27272a40',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeActive: {
    backgroundColor: '#10b98120',
  },
  badgeInactive: {
    backgroundColor: '#27272a60',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  grantBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  grantBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 12,
  },
  finishBtnText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
