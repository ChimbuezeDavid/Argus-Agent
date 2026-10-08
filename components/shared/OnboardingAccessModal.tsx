import React, { useState, useEffect, useCallback } from 'react';
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
  Alert,
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
  canDismiss?: boolean;
}

export function OnboardingAccessModal({ visible, onComplete, canDismiss = true }: OnboardingAccessModalProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();
  const settings = useSettingsStore();

  const [hasMicPerm, setHasMicPerm] = useState(false);
  const [hasBatteryOptimExempt, setHasBatteryOptimExempt] = useState(false);
  const [hasOverlayPerm, setHasOverlayPerm] = useState(false);
  const [hasNotifListenerPerm, setHasNotifListenerPerm] = useState(false);
  const [hasSmsPerm, setHasSmsPerm] = useState(false);
  const [hasLocationPerm, setHasLocationPerm] = useState(false);
  const [hasUsagePerm, setHasUsagePerm] = useState(false);
  const [hasStoragePerm, setHasStoragePerm] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const checkAllPermissions = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        const [
          mPerm,
          battExempt,
          overlay,
          nPerm,
          smsPerm,
          uPerm,
          storePerm,
          locStatus,
          bio,
        ] = await Promise.all([
          PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO),
          ArgusSystemMonitors?.isIgnoringBatteryOptimizations?.() ?? Promise.resolve(false),
          ArgusSystemMonitors?.hasOverlayPermission?.() ?? Promise.resolve(false),
          ArgusSystemMonitors?.hasNotificationListenerPermission?.() ?? Promise.resolve(false),
          PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS),
          ArgusSystemMonitors?.hasUsageStatsPermission?.() ?? Promise.resolve(false),
          ArgusSystemMonitors?.hasStoragePermission?.() ?? Promise.resolve(false),
          Location.getForegroundPermissionsAsync().catch(() => ({ granted: false })),
          LocalAuthentication.hasHardwareAsync().catch(() => false),
        ]);

        setHasMicPerm(!!mPerm);
        setHasBatteryOptimExempt(!!battExempt);
        setHasOverlayPerm(!!overlay);
        setHasNotifListenerPerm(!!nPerm);
        setHasSmsPerm(!!smsPerm);
        setHasUsagePerm(!!uPerm);
        setHasStoragePerm(!!storePerm);
        setHasLocationPerm(!!locStatus.granted);
        setBiometricAvailable(!!bio);
      }
    } catch (e) {
      console.warn('Error checking onboarding permissions:', e);
    }
  }, []);

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
  }, [visible, checkAllPermissions]);

  const handleGrantMic = async () => {
    triggerHaptic('selection');
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
          title: 'Microphone Permission',
          message: 'Argus Agent requires microphone access for hands-free voice assistance and acoustic commands.',
          buttonPositive: 'Allow Microphone',
        });
        setHasMicPerm(granted === PermissionsAndroid.RESULTS.GRANTED);
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const handleRequestBatteryOptim = async () => {
    triggerHaptic('selection');
    if (Platform.OS === 'android') {
      await ArgusSystemMonitors?.requestIgnoreBatteryOptimizations?.();
      setTimeout(checkAllPermissions, 1500);
    }
  };

  const handleOpenAssistantSettings = async () => {
    triggerHaptic('selection');
    if (Platform.OS === 'android') {
      await ArgusSystemMonitors?.openDefaultAssistantSettings?.();
      setTimeout(checkAllPermissions, 1500);
    }
  };

  const handleOpenOverlaySettings = async () => {
    triggerHaptic('selection');
    if (Platform.OS === 'android') {
      await ArgusSystemMonitors?.openOverlayPermissionSettings?.();
      setTimeout(checkAllPermissions, 1500);
    }
  };

  const handleGrantSms = async () => {
    triggerHaptic('selection');
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
          title: 'SMS Permission',
          message: 'Argus parses incoming debit alerts & bank receipts to update your budget ledger automatically.',
          buttonPositive: 'Allow SMS Access',
        });
        setHasSmsPerm(granted === PermissionsAndroid.RESULTS.GRANTED);
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
    // If background voice is enabled, kick off the daemon immediately
    if (settings.alwaysOnVoiceEnabled && Platform.OS === 'android') {
      ArgusSystemMonitors?.startVoiceDaemon?.().catch(() => {});
    }
    onComplete();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={canDismiss ? onComplete : undefined}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Bar with Optional Close */}
        <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
          <Text style={[styles.topBarTitle, { color: colors.text, fontSize: scaleFont(14) }]}>
            System Setup & Permissions
          </Text>
          {canDismiss && (
            <TouchableOpacity onPress={handleFinish} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
        >
          {/* Header Area */}
          <View style={styles.headerArea}>
            <View style={[styles.shieldCircle, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}>
              <Ionicons name="shield-checkmark" size={36} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text, fontSize: scaleFont(20) }]}>
              Argus Agent Access Control
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: scaleFont(12.5) }]}>
              Grant device privileges so Argus can listen hands-free in the background, track expenses, and manage routines. All data stays 100% encrypted on your phone.
            </Text>
          </View>

          {/* SECTION 1: HANDS-FREE VOICE & BACKGROUND DAEMON */}
          <View style={styles.sectionHeader}>
            <Ionicons name="mic-outline" size={16} color="#3b82f6" style={{ marginRight: 6 }} />
            <Text style={[styles.sectionHeaderText, { color: '#3b82f6', fontSize: scaleFont(12) }]}>
              BACKGROUND VOICE & WAKE WORD (BIXBY ARCHITECTURE)
            </Text>
          </View>

          {/* 1.1 Microphone Permission */}
          <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: '#3b82f620' }]}>
                <Ionicons name="mic" size={20} color="#3b82f6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(13.5) }]}>
                  Microphone Access
                </Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  Enables real-time acoustic listening and multimodal speech execution.
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

          {/* 1.2 Battery Optimization (Unrestricted Mode) */}
          <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: '#f59e0b20' }]}>
                <Ionicons name="battery-charging" size={20} color="#f59e0b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(13.5) }]}>
                  Battery Optimization (Unrestricted)
                </Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  Prevents Android from killing the Voice Daemon when the app is swiped away or closed.
                </Text>
              </View>
            </View>
            <View style={styles.cardActionRow}>
              <View style={[styles.statusBadge, hasBatteryOptimExempt ? styles.badgeActive : styles.badgeInactive]}>
                <Text style={[styles.statusBadgeText, { color: hasBatteryOptimExempt ? '#10b981' : '#f59e0b' }]}>
                  {hasBatteryOptimExempt ? 'Unrestricted' : 'Optimized (Restricted)'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.grantBtn, { backgroundColor: '#f59e0b20', borderColor: '#f59e0b', borderWidth: 1 }]}
                onPress={handleRequestBatteryOptim}
                activeOpacity={0.8}
              >
                <Text style={[styles.grantBtnText, { color: '#f59e0b', fontSize: scaleFont(11) }]}>
                  {hasBatteryOptimExempt ? 'Adjust Battery' : 'Set Unrestricted'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 1.3 Default Digital Assistant App */}
          <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: '#8b5cf620' }]}>
                <Ionicons name="sparkles" size={20} color="#8b5cf6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(13.5) }]}>
                  Default Digital Assistant App
                </Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  Required by Android 11+ to permit background microphone listening outside the app. Set Argus Agent as default.
                </Text>
              </View>
            </View>
            <View style={styles.cardActionRow}>
              <Text style={{ color: colors.textMuted, fontSize: scaleFont(11) }}>
                Settings → Default Apps → Assistant
              </Text>
              <TouchableOpacity
                style={[styles.grantBtn, { backgroundColor: '#8b5cf620', borderColor: '#8b5cf6', borderWidth: 1 }]}
                onPress={handleOpenAssistantSettings}
                activeOpacity={0.8}
              >
                <Text style={[styles.grantBtnText, { color: '#8b5cf6', fontSize: scaleFont(11) }]}>
                  Open Assistant Settings
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 1.4 Appear On Top (Floating Capsule Overlay) */}
          <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: '#10b98120' }]}>
                <Ionicons name="albums" size={20} color="#10b981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(13.5) }]}>
                  Appear On Top (Capsule Overlay)
                </Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  Displays the Samsung Bixby-style heads-up floating pill over any app when the wake word is detected.
                </Text>
              </View>
            </View>
            <View style={styles.cardActionRow}>
              <View style={[styles.statusBadge, hasOverlayPerm ? styles.badgeActive : styles.badgeInactive]}>
                <Text style={[styles.statusBadgeText, { color: hasOverlayPerm ? '#10b981' : '#71717a' }]}>
                  {hasOverlayPerm ? 'Granted' : 'Not Granted'}
                </Text>
              </View>
              {!hasOverlayPerm && (
                <TouchableOpacity
                  style={[styles.grantBtn, { backgroundColor: colors.primary }]}
                  onPress={handleOpenOverlaySettings}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.grantBtnText, { fontSize: scaleFont(11) }]}>Grant Overlay</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 1.5 Background Daemon Toggle */}
          <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: '#06b6d420' }]}>
                <Ionicons name="radio" size={20} color="#06b6d4" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(13.5) }]}>
                  Activate Voice Daemon Now
                </Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  Keeps the sticky background listener active for "{settings.customWakeWord || 'Hey Argus'}" with a persistent notification.
                </Text>
              </View>
            </View>
            <View style={styles.cardActionRow}>
              <Text style={{ color: colors.textSecondary, fontSize: scaleFont(11.5), fontWeight: '600' }}>
                {settings.alwaysOnVoiceEnabled ? 'Daemon Active' : 'Daemon Paused'}
              </Text>
              <Switch
                value={settings.alwaysOnVoiceEnabled}
                onValueChange={(val) => {
                  triggerHaptic('selection');
                  settings.toggleAlwaysOnVoice(val);
                }}
                trackColor={{ false: '#3f3f46', true: colors.primary }}
                thumbColor={settings.alwaysOnVoiceEnabled ? '#ffffff' : '#a1a1aa'}
              />
            </View>
          </View>

          {/* SECTION 2: AUTONOMOUS FINANCIAL PARSING */}
          <View style={styles.sectionHeader}>
            <Ionicons name="wallet-outline" size={16} color="#10b981" style={{ marginRight: 6 }} />
            <Text style={[styles.sectionHeaderText, { color: '#10b981', fontSize: scaleFont(12) }]}>
              BANK TRANSACTION INTERCEPTOR
            </Text>
          </View>

          {/* 2.1 Notification Listener */}
          <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: '#10b98120' }]}>
                <Ionicons name="notifications" size={20} color="#10b981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(13.5) }]}>
                  Notification Listener Access
                </Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  Intercepts live bank app debit pushes (OPay, Kuda, GTBank, PalmPay) for instant budget tracking.
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

          {/* 2.2 Direct SMS Inbox Access */}
          <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: '#10b98120' }]}>
                <Ionicons name="chatbubble-ellipses" size={20} color="#10b981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(13.5) }]}>
                  Direct SMS Inbox Reading
                </Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  Scans bank SMS receipts so offline transactions appear on your balance automatically.
                </Text>
              </View>
            </View>
            <View style={styles.cardActionRow}>
              <View style={[styles.statusBadge, hasSmsPerm ? styles.badgeActive : styles.badgeInactive]}>
                <Text style={[styles.statusBadgeText, { color: hasSmsPerm ? '#10b981' : '#71717a' }]}>
                  {hasSmsPerm ? 'Granted' : 'Not Granted'}
                </Text>
              </View>
              {!hasSmsPerm && (
                <TouchableOpacity
                  style={[styles.grantBtn, { backgroundColor: colors.primary }]}
                  onPress={handleGrantSms}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.grantBtnText, { fontSize: scaleFont(11) }]}>Allow SMS</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* SECTION 3: SYSTEM CONTEXT & STORAGE */}
          <View style={styles.sectionHeader}>
            <Ionicons name="hardware-chip-outline" size={16} color="#f43f5e" style={{ marginRight: 6 }} />
            <Text style={[styles.sectionHeaderText, { color: '#f43f5e', fontSize: scaleFont(12) }]}>
              CONTEXT & ENVIRONMENT
            </Text>
          </View>

          {/* 3.1 Location */}
          <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: '#f43f5e20' }]}>
                <Ionicons name="location" size={20} color="#f43f5e" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(13.5) }]}>
                  Location & Boundary Geofences
                </Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  Detects arrivals & departures at Home or Work to execute Habit Stacking routines.
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

          {/* 3.2 Storage Access */}
          <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: '#0ea5e920' }]}>
                <Ionicons name="folder-open" size={20} color="#0ea5e9" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(13.5) }]}>
                  Device File & Storage Manager
                </Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  Allows Argus to export budget reports, read local documents, and search device files.
                </Text>
              </View>
            </View>
            <View style={styles.cardActionRow}>
              <View style={[styles.statusBadge, hasStoragePerm ? styles.badgeActive : styles.badgeInactive]}>
                <Text style={[styles.statusBadgeText, { color: hasStoragePerm ? '#10b981' : '#71717a' }]}>
                  {hasStoragePerm ? 'Granted' : 'Not Granted'}
                </Text>
              </View>
              {!hasStoragePerm && (
                <TouchableOpacity
                  style={[styles.grantBtn, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    triggerHaptic('selection');
                    ArgusSystemMonitors.openAllFilesAccessSettings();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.grantBtnText, { fontSize: scaleFont(11) }]}>Grant Storage</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 3.3 Screen Time Usage */}
          <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: '#8b5cf620' }]}>
                <Ionicons name="time" size={20} color="#8b5cf6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(13.5) }]}>
                  Screen Time & Usage Telemetry
                </Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  Tracks daily screen time and digital wellbeing telemetry inside your Vault.
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

          {/* 3.4 Hardware Biometric Lock */}
          {biometricAvailable && (
            <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.iconBox, { backgroundColor: '#eab30820' }]}>
                  <Ionicons name="finger-print" size={20} color="#eab308" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(13.5) }]}>
                    Hardware Biometric Security
                  </Text>
                  <Text style={[styles.cardDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                    Require fingerprint or face authentication whenever Argus Agent is opened.
                  </Text>
                </View>
              </View>
              <View style={styles.cardActionRow}>
                <Text style={{ color: colors.textSecondary, fontSize: scaleFont(11.5), fontWeight: '600' }}>
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

          {/* Brand-Specific Device Tip Card */}
          <View style={[styles.tipCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.tipHeaderRow}>
              <Ionicons name="information-circle-outline" size={18} color="#38bdf8" style={{ marginRight: 6 }} />
              <Text style={[styles.tipTitle, { color: colors.text, fontSize: scaleFont(12) }]}>
                Tecno / Samsung / Xiaomi Device Tip
              </Text>
            </View>
            <Text style={[styles.tipText, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
              • On Tecno/Infinix: In <Text style={{ fontWeight: '700' }}>Phone Master → Auto-start management</Text>, ensure Argus is enabled.{"\n"}
              • On Recent Apps screen: Pull down on Argus card and tap the <Text style={{ fontWeight: '700' }}>Lock 🔒</Text> icon so "Clear All" won't kill it.
            </Text>
          </View>

          {/* Finish & Launch Button */}
          <TouchableOpacity
            style={[styles.finishBtn, { backgroundColor: colors.primary }]}
            onPress={handleFinish}
            activeOpacity={0.85}
          >
            <Ionicons name="rocket-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={[styles.finishBtnText, { fontSize: scaleFont(14) }]}>
              Save Setup & Launch Argus v2.0
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 14 : 44,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  topBarTitle: {
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: 20,
  },
  shieldCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionHeaderText: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  permCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontWeight: '700',
    marginBottom: 2,
  },
  cardDesc: {
    lineHeight: 15,
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeActive: {
    backgroundColor: '#10b98118',
  },
  badgeInactive: {
    backgroundColor: '#71717a18',
  },
  statusBadgeText: {
    fontWeight: '700',
    fontSize: 11,
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
  tipCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 10,
    marginBottom: 20,
  },
  tipHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  tipTitle: {
    fontWeight: '700',
  },
  tipText: {
    lineHeight: 18,
  },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  finishBtnText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
