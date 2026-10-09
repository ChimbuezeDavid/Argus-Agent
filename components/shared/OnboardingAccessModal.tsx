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
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
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
          PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO).catch(() => false),
          ArgusSystemMonitors?.isIgnoringBatteryOptimizations?.() ?? Promise.resolve(false),
          ArgusSystemMonitors?.hasOverlayPermission?.() ?? Promise.resolve(false),
          ArgusSystemMonitors?.hasNotificationListenerPermission?.() ?? Promise.resolve(false),
          PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS).catch(() => false),
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
          message: 'Argus parses incoming debit alerts and bank receipts to update your budget ledger automatically.',
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
      // Only request standard foreground location to prevent disruptive redirection into OS settings
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasLocationPerm(status === 'granted');
    } catch (err) {
      console.warn(err);
    }
  };

  const handleDismiss = async () => {
    triggerHaptic('selection');
    try {
      await settings.completeOnboarding();
    } catch (e) {
      console.warn('[OnboardingAccessModal] completeOnboarding warning:', e);
    }
    onComplete();
  };

  const handleFinish = async () => {
    triggerHaptic('success');
    try {
      await settings.completeOnboarding();
    } catch (e) {
      console.warn('[OnboardingAccessModal] completeOnboarding warning:', e);
    }
    try {
      if (settings.alwaysOnVoiceEnabled && Platform.OS === 'android') {
        ArgusSystemMonitors?.startVoiceDaemon?.().catch(() => {});
      }
    } catch (e) {}
    onComplete();
  };

  const topInset = Math.max(insets.top, Platform.OS === 'android' ? 36 : 48);
  const bottomInset = Math.max(insets.bottom, 20) + 32;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={canDismiss ? handleDismiss : undefined}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Safe Top Navigation Header */}
        <View style={[styles.topBar, { paddingTop: topInset, borderBottomColor: colors.border }]}>
          <View style={styles.topBarLeft}>
            <Text style={[styles.topBarTitle, { color: colors.text, fontSize: scaleFont(14) }]}>
              System Setup & Permissions
            </Text>
          </View>
          {canDismiss && (
            <TouchableOpacity
              onPress={handleDismiss}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Dismiss System Setup & Permissions"
            >
              <Ionicons name="close-circle-sharp" size={28} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset }]}
        >
          {/* Header Hero */}
          <View style={styles.headerArea}>
            <View style={[styles.shieldCircle, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}>
              <Ionicons name="shield-checkmark" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text, fontSize: scaleFont(18) }]}>
              Argus Agent Access Control
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: scaleFont(12) }]}>
              Grant device privileges so Argus can listen hands-free, track expenses, and manage routines. All data stays 100% encrypted and local on your phone.
            </Text>
          </View>

          {/* GROUP 1: VOICE & BACKGROUND RUNTIME */}
          <View style={styles.sectionHeader}>
            <Ionicons name="mic-outline" size={15} color="#3b82f6" style={{ marginRight: 6 }} />
            <Text style={[styles.sectionHeaderText, { color: '#3b82f6', fontSize: scaleFont(11.5) }]}>
              VOICE & BACKGROUND RUNTIME
            </Text>
          </View>

          {/* 1.1 Microphone */}
          <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: '#3b82f618' }]}>
                <Ionicons name="mic" size={18} color="#3b82f6" />
              </View>
              <View style={styles.cardTextCol}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(13) }]}>
                  Microphone Access
                </Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  Enables acoustic listening and multimodal speech execution.
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
                  <Text style={[styles.grantBtnText, { fontSize: scaleFont(11.5) }]}>Grant Permission</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 1.2 Battery Optimization */}
          <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: '#f59e0b18' }]}>
                <Ionicons name="battery-charging" size={18} color="#f59e0b" />
              </View>
              <View style={styles.cardTextCol}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(13) }]}>
                  Battery Optimization (Unrestricted)
                </Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  Prevents Android from killing the Voice Daemon when the app is swiped away.
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
                <Text style={[styles.grantBtnText, { color: '#f59e0b', fontSize: scaleFont(11.5) }]}>
                  {hasBatteryOptimExempt ? 'Adjust Battery' : 'Set Unrestricted'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 1.3 Default Digital Assistant */}
          <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: '#8b5cf618' }]}>
                <Ionicons name="sparkles" size={18} color="#8b5cf6" />
              </View>
              <View style={styles.cardTextCol}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(13) }]}>
                  Default Digital Assistant App
                </Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  Required by Android 11+ to permit microphone access in the background. Set Argus Agent as default assistant.
                </Text>
              </View>
            </View>
            <View style={styles.cardActionRow}>
              <View style={styles.hintBadge}>
                <Text style={[styles.hintBadgeText, { color: colors.textSecondary, fontSize: scaleFont(10.5) }]}>
                  Default Apps
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.grantBtn, { backgroundColor: '#8b5cf620', borderColor: '#8b5cf6', borderWidth: 1 }]}
                onPress={handleOpenAssistantSettings}
                activeOpacity={0.8}
              >
                <Text style={[styles.grantBtnText, { color: '#8b5cf6', fontSize: scaleFont(11.5) }]}>
                  Open Assistant Settings
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 1.4 Appear On Top */}
          <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: '#10b98118' }]}>
                <Ionicons name="albums" size={18} color="#10b981" />
              </View>
              <View style={styles.cardTextCol}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(13) }]}>
                  Appear On Top (Capsule Overlay)
                </Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  Displays the floating heads-up pill over other apps when wake word is spoken.
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
                  <Text style={[styles.grantBtnText, { fontSize: scaleFont(11.5) }]}>Grant Overlay</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 1.5 Background Daemon Switch */}
          <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: '#06b6d418' }]}>
                <Ionicons name="radio" size={18} color="#06b6d4" />
              </View>
              <View style={styles.cardTextCol}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(13) }]}>
                  Activate Voice Daemon Now
                </Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  Runs continuous background listening for "{settings.customWakeWord || 'Hey Argus'}".
                </Text>
              </View>
            </View>
            <View style={styles.cardActionRow}>
              <Text style={{ color: colors.textSecondary, fontSize: scaleFont(11.5), fontWeight: '600' }}>
                {settings.alwaysOnVoiceEnabled ? 'Daemon Running' : 'Daemon Paused'}
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

          {/* GROUP 2: FINANCIAL & TRANSACTION INTERCEPTOR */}
          <View style={styles.sectionHeader}>
            <Ionicons name="wallet-outline" size={15} color="#10b981" style={{ marginRight: 6 }} />
            <Text style={[styles.sectionHeaderText, { color: '#10b981', fontSize: scaleFont(11.5) }]}>
              FINANCIAL & TRANSACTION INTERCEPTOR
            </Text>
          </View>

          {/* 2.1 Notifications */}
          <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: '#10b98118' }]}>
                <Ionicons name="notifications" size={18} color="#10b981" />
              </View>
              <View style={styles.cardTextCol}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(13) }]}>
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
                  <Text style={[styles.grantBtnText, { fontSize: scaleFont(11.5) }]}>Enable Access</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 2.2 SMS */}
          <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: '#10b98118' }]}>
                <Ionicons name="chatbubble-ellipses" size={18} color="#10b981" />
              </View>
              <View style={styles.cardTextCol}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(13) }]}>
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
                  <Text style={[styles.grantBtnText, { fontSize: scaleFont(11.5) }]}>Allow SMS</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* GROUP 3: DEVICE CONTEXT & SECURITY */}
          <View style={styles.sectionHeader}>
            <Ionicons name="hardware-chip-outline" size={15} color="#f43f5e" style={{ marginRight: 6 }} />
            <Text style={[styles.sectionHeaderText, { color: '#f43f5e', fontSize: scaleFont(11.5) }]}>
              DEVICE CONTEXT & SECURITY
            </Text>
          </View>

          {/* 3.1 Location */}
          <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: '#f43f5e18' }]}>
                <Ionicons name="location" size={18} color="#f43f5e" />
              </View>
              <View style={styles.cardTextCol}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(13) }]}>
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
                  <Text style={[styles.grantBtnText, { fontSize: scaleFont(11.5) }]}>Grant Location</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 3.2 Storage */}
          <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: '#0ea5e918' }]}>
                <Ionicons name="folder-open" size={18} color="#0ea5e9" />
              </View>
              <View style={styles.cardTextCol}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(13) }]}>
                  Device File & Storage Manager
                </Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  Allows Argus to export budget statements and inspect device files.
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
                  <Text style={[styles.grantBtnText, { fontSize: scaleFont(11.5) }]}>Grant Storage</Text>
                </TouchableOpacity>
              )}
            </View>
            {!hasStoragePerm && (
              <View style={[styles.tipCard, { backgroundColor: '#0ea5e912', borderColor: '#0ea5e933', marginTop: 10, marginBottom: 0 }]}>
                <View style={styles.tipHeaderRow}>
                  <Ionicons name="information-circle-outline" size={14} color="#0ea5e9" style={{ marginRight: 6 }} />
                  <Text style={[styles.tipTitle, { color: '#0ea5e9', fontSize: scaleFont(11.5) }]}>
                    If toggle is disabled
                  </Text>
                </View>
                <Text style={[styles.tipText, { color: colors.textSecondary, fontSize: scaleFont(10.5) }]}>
                  On Android 13+, sideloaded apps require permission unblocking: Open Settings &gt; Apps &gt; Argus Agent &gt; tap ⋮ (top-right) &gt; "Allow restricted settings".
                </Text>
              </View>
            )}
          </View>

          {/* 3.3 Screen Time */}
          <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: '#8b5cf618' }]}>
                <Ionicons name="time" size={18} color="#8b5cf6" />
              </View>
              <View style={styles.cardTextCol}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(13) }]}>
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
                  <Text style={[styles.grantBtnText, { fontSize: scaleFont(11.5) }]}>Grant Access</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 3.4 Biometric Lock */}
          {biometricAvailable && (
            <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.iconBox, { backgroundColor: '#eab30818' }]}>
                  <Ionicons name="finger-print" size={18} color="#eab308" />
                </View>
                <View style={styles.cardTextCol}>
                  <Text style={[styles.cardTitle, { color: colors.text, fontSize: scaleFont(13) }]}>
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

          {/* Finish & Launch Button */}
          <TouchableOpacity
            style={[styles.finishBtn, { backgroundColor: colors.primary }]}
            onPress={handleFinish}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-done" size={20} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={[styles.finishBtnText, { fontSize: scaleFont(13.5) }]}>
              Done • Enter Argus Agent
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
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  topBarLeft: {
    flex: 1,
  },
  topBarTitle: {
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  closeBtn: {
    marginLeft: 12,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: 16,
  },
  shieldCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionHeaderText: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  permCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
    marginBottom: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardTextCol: {
    flex: 1,
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
    paddingTop: 2,
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
  hintBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  hintBadgeText: {
    fontWeight: '600',
  },
  grantBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grantBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  tipCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  tipHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  tipTitle: {
    fontWeight: '700',
  },
  tipText: {
    lineHeight: 16,
  },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  finishBtnText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
