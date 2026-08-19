// Settings & HCI Control Architecture for Argus Agent
// Comprehensive Human-Computer Interaction (HCI) Personalization Hub:
// 1. Profile & Account Management (Name, Email, Connected X/GitHub, Sign Out, Account Deletion)
// 2. Display & Theme (Dark/Light/System, Text Scaling, High Contrast)
// 3. Notifications & Alerts (Push Controls, Category Toggles, Sound/Vibe Styles)
// 4. Interaction & Feedback (Haptic Vibration, In-App Sound Effects, Reduced Motion)
// 5. Data & Privacy (Analytics, Ad Tracking, Crash Reports, CSV Export, DB Verify)
// 6. AI Intelligence & Gemini Models (Strictly Gemini 3.5 - 3.7)
// 7. Localization & Currency
// 8. Hardware Security & Sensors (Biometrics, Usage Stats, Bank Listener)

import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  Platform,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Text,
  View,
  TouchableWithoutFeedback,
  AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { Ionicons, MaterialCommunityIcons, Feather, FontAwesome6, Octicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useSettingsStore, ThemeMode, TextScale, NotificationStyle } from '@/store/settingsStore';
import { useHCITheme } from '@/hooks/useHCITheme';
import { initializeDatabase } from '@/services/database/db';
import { listExpenses } from '@/services/database/expensesRepo';
import { authenticateUser } from '@/services/security/securityService';
import * as oauthService from '@/services/auth/oauthService';
import { CategoryIcon } from '@/components/CategoryIcon';
import ArgusSystemMonitors from '@/modules/argus-system-monitors';

import { DisplayThemeSection } from '@/components/settings/DisplayThemeSection';
import { NotificationsSection } from '@/components/settings/NotificationsSection';
import { InteractionFeedbackSection } from '@/components/settings/InteractionFeedbackSection';
import { PrivacySection } from '@/components/settings/PrivacySection';
import { CurrencySection } from '@/components/settings/CurrencySection';

export interface ModelOption {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  description: string;
  icon: any;
  speed: 'Ultra Fast' | 'Fast' | 'Deep Reasoning';
  contextWindow: string;
}

export const PRIMARY_3X_MODELS: ModelOption[] = [
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    badge: 'Flagship Speed',
    badgeColor: '#ec4899',
    description: 'Ultra-fast multimodal reasoning, tool calling, and high context capacity.',
    icon: 'flash',
    speed: 'Ultra Fast',
    contextWindow: '1M Tokens',
  },
  {
    id: 'gemini-3.7-pro',
    name: 'Gemini 3.7 Pro',
    badge: 'Flagship Logic',
    badgeColor: '#8b5cf6',
    description: 'Deep multi-step analytical reasoning, complex planning, and code architecture.',
    icon: 'hardware-chip',
    speed: 'Deep Reasoning',
    contextWindow: '2M Tokens',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    badge: 'Low Latency',
    badgeColor: '#3b82f6',
    description: 'High-throughput lightweight model optimized for instant response.',
    icon: 'rocket',
    speed: 'Ultra Fast',
    contextWindow: '1M Tokens',
  },
  {
    id: 'gemini-3.5-pro',
    name: 'Gemini 3.5 Pro',
    badge: 'Precision Pro',
    badgeColor: '#06b6d4',
    description: 'Balanced precision intelligence for financial synthesis and agent logic.',
    icon: 'speedometer',
    speed: 'Fast',
    contextWindow: '1M Tokens',
  },
];

export const ALL_GEMINI_3X_MODELS: ModelOption[] = [
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    badge: 'Ultra Flagship',
    badgeColor: '#ec4899',
    description: 'State-of-the-art multimodal reasoning, ultra-fast latency, and high context capacity.',
    icon: 'flash',
    speed: 'Ultra Fast',
    contextWindow: '1M Tokens',
  },
  {
    id: 'gemini-3.7-pro',
    name: 'Gemini 3.7 Pro',
    badge: 'Deep Reasoning',
    badgeColor: '#8b5cf6',
    description: 'Specialized deep analytical reasoning, complex coding, and multi-tool orchestration.',
    icon: 'hardware-chip',
    speed: 'Deep Reasoning',
    contextWindow: '2M Tokens',
  },
  {
    id: 'gemini-3.7-flash-thinking',
    name: 'Gemini 3.7 Flash Thinking',
    badge: 'Chain-of-Thought',
    badgeColor: '#f59e0b',
    description: 'Step-by-step thinking loop before action execution for maximum accuracy.',
    icon: 'sparkles',
    speed: 'Deep Reasoning',
    contextWindow: '1M Tokens',
  },
  {
    id: 'gemini-3.6-pro',
    name: 'Gemini 3.6 Pro',
    badge: 'Advanced Pro',
    badgeColor: '#a855f7',
    description: 'High-precision analytical engine for document, code, and finance processing.',
    icon: 'shield-checkmark',
    speed: 'Fast',
    contextWindow: '1M Tokens',
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    badge: 'Optimized Flash',
    badgeColor: '#3b82f6',
    description: 'Low-latency agent engine fine-tuned for rapid function calling.',
    icon: 'flash-outline',
    speed: 'Ultra Fast',
    contextWindow: '1M Tokens',
  },
  {
    id: 'gemini-3.5-pro',
    name: 'Gemini 3.5 Pro',
    badge: 'Precision Multimodal',
    badgeColor: '#06b6d4',
    description: 'Established 3.5 Pro architecture for complex reasoning and data queries.',
    icon: 'speedometer',
    speed: 'Fast',
    contextWindow: '1M Tokens',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    badge: 'Instant Response',
    badgeColor: '#10b981',
    description: 'High-throughput lightweight model engineered for instant device orchestration.',
    icon: 'rocket',
    speed: 'Ultra Fast',
    contextWindow: '1M Tokens',
  },
  {
    id: 'gemini-3.5-flash-thinking',
    name: 'Gemini 3.5 Flash Thinking',
    badge: 'Fast CoT',
    badgeColor: '#eab308',
    description: 'Fast chain-of-thought planner for multi-step task breakdowns.',
    icon: 'bulb-outline',
    speed: 'Fast',
    contextWindow: '1M Tokens',
  },
];

const CURRENCIES = [
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
];

export default function SettingsModal() {
  const settings = useSettingsStore();
  const insets = useSafeAreaInsets();
  const { colors, scaleFont, isDark, triggerHaptic } = useHCITheme();

  // Profile Form State
  const [nameInput, setNameInput] = useState(settings.profileName);
  const [emailInput, setEmailInput] = useState(settings.profileEmail);
  const [isProfileEditing, setIsProfileEditing] = useState(false);

  // API Key & Model State
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [modelInput, setModelInput] = useState('gemini-3.7-flash');
  const [isSecure, setIsSecure] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState<string | null>(null);

  // Model Picker Modal
  const [modelPickerModalVisible, setModelPickerModalVisible] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [hasPostNotifications, setHasPostNotifications] = useState(false);

  useEffect(() => {
    settings.loadSettings();
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS as any).then(setHasPostNotifications);
    } else {
      setHasPostNotifications(true);
    }

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        settings.syncSystemPermissions();
        if (Platform.OS === 'android' && Platform.Version >= 33) {
          PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS as any).then(setHasPostNotifications);
        }
      }
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    setNameInput(settings.profileName);
    setEmailInput(settings.profileEmail);
    setApiKeyInput(settings.apiKey);
    if (settings.geminiModel) {
      setModelInput(settings.geminiModel);
    }
  }, [settings.profileName, settings.profileEmail, settings.apiKey, settings.geminiModel]);

  const handleSaveProfile = async () => {
    triggerHaptic('selection');
    if (!nameInput.trim()) {
      Alert.alert('Validation', 'Please provide a profile name.');
      return;
    }
    await settings.updateProfile(nameInput.trim(), emailInput.trim());
    setIsProfileEditing(false);
    triggerHaptic('success');
    Alert.alert('Profile Saved', 'Your user profile details have been updated.');
  };

  const handleSaveApiKey = async () => {
    triggerHaptic('selection');
    if (!apiKeyInput.trim()) {
      Alert.alert('API Key Required', 'Please provide a valid Gemini API key.');
      return;
    }
    await settings.setApiKey(apiKeyInput.trim());
    triggerHaptic('success');
    Alert.alert('Success', 'Gemini API key saved securely in phone hardware keystore.');
  };

  const handleSelectModel = async (modelId: string) => {
    triggerHaptic('selection');
    setModelInput(modelId);
    await settings.setGeminiModel(modelId);
    const matched = ALL_GEMINI_3X_MODELS.find((m) => m.id === modelId);
    Alert.alert('Model Updated', `Active AI engine switched to ${matched?.name || modelId}.`);
  };

  // 𝕏 (Twitter) In-App Browser OAuth Sign-In
  const handleVerifyXOAuth = async () => {
    triggerHaptic('selection');
    setIsAuthenticating('x');
    try {
      const profile = await oauthService.authenticateX();
      await settings.setXAccount(profile.identifier);
      triggerHaptic('success');
      Alert.alert('𝕏 Sign-In Successful', `Authenticated as ${profile.identifier}. OAuth 2.0 token verified.`);
    } catch (e: any) {
      if (!e.message?.includes('cancelled')) {
        Alert.alert('𝕏 Sign-In Error', e.message || 'Authentication session failed');
      }
    } finally {
      setIsAuthenticating(null);
    }
  };

  const handleDisconnectX = async () => {
    triggerHaptic('selection');
    Alert.alert('Disconnect 𝕏', 'Are you sure you want to sign out and unlink your 𝕏 Account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out & Unlink',
        style: 'destructive',
        onPress: async () => {
          await settings.disconnectXAccount();
          triggerHaptic('medium');
          Alert.alert('Signed Out', '𝕏 account disconnected.');
        },
      },
    ]);
  };

  // GitHub In-App Browser OAuth Sign-In
  const handleVerifyGitHub = async () => {
    triggerHaptic('selection');
    setIsAuthenticating('github');
    try {
      const profile = await oauthService.authenticateGitHub();
      await settings.setGithubAccount(profile.identifier);
      triggerHaptic('success');
      Alert.alert('GitHub Sign-In Successful', `Authenticated as @${profile.identifier}.`);
    } catch (e: any) {
      if (!e.message?.includes('cancelled')) {
        Alert.alert('GitHub Sign-In Error', e.message || 'Authentication session failed');
      }
    } finally {
      setIsAuthenticating(null);
    }
  };

  const handleDisconnectGitHub = async () => {
    triggerHaptic('selection');
    Alert.alert('Disconnect GitHub', 'Are you sure you want to sign out and unlink your GitHub Account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out & Unlink',
        style: 'destructive',
        onPress: async () => {
          await settings.disconnectGithubAccount();
          triggerHaptic('medium');
          Alert.alert('Signed Out', 'GitHub account disconnected.');
        },
      },
    ]);
  };

  const handleSignOutAll = () => {
    triggerHaptic('warning');
    Alert.alert('Sign Out', 'Sign out of all connected accounts and remove saved session credentials?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out All',
        style: 'destructive',
        onPress: async () => {
          await settings.signOutAndClearAuth();
          triggerHaptic('medium');
          Alert.alert('Signed Out', 'All session credentials and OAuth tokens cleared.');
        },
      },
    ]);
  };

  const handleDeleteAccountData = () => {
    triggerHaptic('error');
    Alert.alert(
      '⚠️ Delete All Local Data',
      'This will permanently erase all SQLite tables, financial transactions, saved notes, geofences, and chat history from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Permanently Erase All Data',
          style: 'destructive',
          onPress: async () => {
            await settings.deleteAccountAndPurgeData();
            triggerHaptic('heavy');
            Alert.alert('Data Purged', 'All local data has been completely erased.');
          },
        },
      ]
    );
  };

  // Phone Security
  const handleToggleAppLock = async (enabled: boolean) => {
    triggerHaptic('selection');
    if (enabled) {
      const auth = await authenticateUser('Verify Biometrics or PIN to Enable App Lock');
      if (!auth.success) {
        Alert.alert('Authentication Failed', 'Could not verify phone security credentials.');
        return;
      }
    }
    await settings.toggleAppLock(enabled);
  };



  const handleRequestNotifications = async () => {
    triggerHaptic('selection');
    if (Platform.OS === 'android') {
      try {
        if (Platform.Version >= 33) {
          const res = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS as any,
            {
              title: 'Argus Agent Notifications',
              message: 'Allow Argus to notify you of budget threshold warnings and bank transactions.',
              buttonPositive: 'Allow',
              buttonNegative: 'Deny',
            }
          );
          if (res === PermissionsAndroid.RESULTS.GRANTED) {
            setHasPostNotifications(true);
            Alert.alert('Notifications Allowed', 'Argus Agent notifications are now enabled.');
            return;
          }
        }
        await ArgusSystemMonitors.openAppNotificationSettings();
      } catch (e) {
        await ArgusSystemMonitors.openAppNotificationSettings();
      }
    }
  };

  const isXConnected = !!settings.xAccount;
  const isGithubConnected = !!settings.githubAccount;

  const filteredCatalog = ALL_GEMINI_3X_MODELS.filter((m) =>
    m.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
    m.badge.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
    m.description.toLowerCase().includes(modelSearchQuery.toLowerCase())
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.contentContainer, { paddingBottom: Math.max(insets.bottom, 40) }]}
    >
      <Stack.Screen
        options={{
          title: 'Settings & HCI',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />

      {/* ================= GROUP 1: USER PROFILE & ACCOUNT MANAGEMENT ================= */}
      <View style={[styles.groupCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.groupHeader}>
          <Ionicons name="person-circle-outline" size={scaleFont(20)} color={colors.primary} style={{ marginRight: 8 }} />
          <Text style={[styles.groupTitle, { color: colors.text, fontSize: scaleFont(14) }]}>Profile & Account</Text>
        </View>
        <Text style={[styles.groupSubtitle, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
          Manage your personal identity, connected developer accounts, and authentication sessions.
        </Text>

        {/* Profile Card */}
        <View style={[styles.subItemBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.avatarCircle, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}>
                <Text style={[styles.avatarText, { color: colors.primary, fontSize: scaleFont(14) }]}>
                  {nameInput ? nameInput.charAt(0).toUpperCase() : 'A'}
                </Text>
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={[styles.subItemTitle, { color: colors.text, fontSize: scaleFont(13) }]}>
                  {settings.profileName || 'Argus User'}
                </Text>
                <Text style={[styles.subItemDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  {settings.profileEmail || 'No email attached (Local only)'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.smallActionBtn, { borderColor: colors.borderStrong }]}
              onPress={() => setIsProfileEditing(!isProfileEditing)}
              activeOpacity={0.8}
            >
              <Text style={[styles.smallActionBtnText, { color: colors.primary, fontSize: scaleFont(11) }]}>
                {isProfileEditing ? 'Cancel' : 'Edit'}
              </Text>
            </TouchableOpacity>
          </View>

          {isProfileEditing && (
            <View style={{ marginTop: 8, gap: 8 }}>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text, fontSize: scaleFont(12) }]}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Full Name"
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={[styles.fieldInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text, fontSize: scaleFont(12) }]}
                value={emailInput}
                onChangeText={setEmailInput}
                placeholder="Email Address"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[styles.saveKeyBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveProfile}
                activeOpacity={0.8}
              >
                <Text style={[styles.saveKeyBtnText, { fontSize: scaleFont(12) }]}>Update Profile</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Connected Accounts */}
        <Text style={[styles.fieldLabel, { color: colors.textMuted, fontSize: scaleFont(11), marginTop: 14 }]}>
          CONNECTED ACCOUNTS
        </Text>

        {/* 1A. 𝕏 (Twitter) */}
        <View style={[styles.subItemBox, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 6 }]}>
          <View style={styles.subItemTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.brandIconBox, { backgroundColor: '#000000' }]}>
                <Ionicons name="logo-twitter" size={16} color="#ffffff" />
              </View>
              <View>
                <Text style={[styles.subItemTitle, { color: colors.text, fontSize: scaleFont(13) }]}>𝕏 (Twitter)</Text>
                <Text style={[styles.subItemDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  {isXConnected ? `Signed in as ${settings.xAccount}` : 'OAuth 2.0 PKCE sign-in'}
                </Text>
              </View>
            </View>
            <View style={[styles.badge, isXConnected ? styles.badgeActive : styles.badgeInactive]}>
              <Text style={[styles.badgeText, isXConnected ? styles.badgeTextActive : styles.badgeTextInactive]}>
                {isXConnected ? '✓ Signed In' : 'Not Connected'}
              </Text>
            </View>
          </View>

          {!isXConnected ? (
            <TouchableOpacity
              style={styles.connectBtn}
              onPress={handleVerifyXOAuth}
              disabled={isAuthenticating === 'x'}
              activeOpacity={0.8}
            >
              {isAuthenticating === 'x' ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={[styles.connectBtnText, { fontSize: scaleFont(12) }]}>Sign In with 𝕏</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.btnActionRow}>
              <TouchableOpacity
                style={[styles.secondaryBtn, { backgroundColor: colors.cardActive, borderColor: colors.border }]}
                onPress={() => Linking.openURL('https://x.com')}
                activeOpacity={0.8}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.text, fontSize: scaleFont(11) }]}>Open 𝕏</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dangerSmallBtn} onPress={handleDisconnectX} activeOpacity={0.8}>
                <Text style={[styles.dangerSmallBtnText, { fontSize: scaleFont(11) }]}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 1B. GitHub */}
        <View style={[styles.subItemBox, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 10 }]}>
          <View style={styles.subItemTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.brandIconBox, { backgroundColor: '#24292e' }]}>
                <Ionicons name="logo-github" size={16} color="#ffffff" />
              </View>
              <View>
                <Text style={[styles.subItemTitle, { color: colors.text, fontSize: scaleFont(13) }]}>GitHub</Text>
                <Text style={[styles.subItemDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  {isGithubConnected ? `Signed in as @${settings.githubAccount}` : 'Repository and profile access'}
                </Text>
              </View>
            </View>
            <View style={[styles.badge, isGithubConnected ? styles.badgeActive : styles.badgeInactive]}>
              <Text style={[styles.badgeText, isGithubConnected ? styles.badgeTextActive : styles.badgeTextInactive]}>
                {isGithubConnected ? '✓ Signed In' : 'Not Connected'}
              </Text>
            </View>
          </View>

          {!isGithubConnected ? (
            <TouchableOpacity
              style={[styles.connectBtn, { backgroundColor: '#24292e' }]}
              onPress={handleVerifyGitHub}
              disabled={isAuthenticating === 'github'}
              activeOpacity={0.8}
            >
              {isAuthenticating === 'github' ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={[styles.connectBtnText, { fontSize: scaleFont(12) }]}>Sign In with GitHub</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.btnActionRow}>
              <TouchableOpacity
                style={[styles.secondaryBtn, { backgroundColor: colors.cardActive, borderColor: colors.border }]}
                onPress={handleVerifyGitHub}
                activeOpacity={0.8}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.text, fontSize: scaleFont(11) }]}>Re-Authenticate</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dangerSmallBtn} onPress={handleDisconnectGitHub} activeOpacity={0.8}>
                <Text style={[styles.dangerSmallBtnText, { fontSize: scaleFont(11) }]}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Global Sign Out & Delete Action Row */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <TouchableOpacity
            style={[styles.dataActionBtn, { flex: 1, borderColor: colors.borderStrong }]}
            onPress={handleSignOutAll}
            activeOpacity={0.8}
          >
            <Feather name="log-out" size={14} color={colors.warning} style={{ marginRight: 6 }} />
            <Text style={[styles.dataActionBtnText, { color: colors.warning, fontSize: scaleFont(11) }]}>Sign Out All</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dataActionBtn, { flex: 1, borderColor: colors.danger }]}
            onPress={handleDeleteAccountData}
            activeOpacity={0.8}
          >
            <Feather name="trash-2" size={14} color={colors.danger} style={{ marginRight: 6 }} />
            <Text style={[styles.dataActionBtnText, { color: colors.danger, fontSize: scaleFont(11) }]}>Purge All Data</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ================= GROUP 2: DISPLAY & THEME ================= */}
      <DisplayThemeSection settings={settings} />

      {/* ================= GROUP 3: NOTIFICATIONS & ALERTS ================= */}
      <NotificationsSection settings={settings} />

      {/* ================= GROUP 4: INTERACTION & FEEDBACK ================= */}
      <InteractionFeedbackSection settings={settings} />

      {/* ================= GROUP 5: DATA SHARING & PRIVACY ================= */}
      <PrivacySection settings={settings} />

      {/* ================= GROUP 6: AI INTELLIGENCE & GEMINI TIER ================= */}
      <View style={[styles.groupCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.groupHeader}>
          <Ionicons name="flash-outline" size={scaleFont(20)} color="#ec4899" style={{ marginRight: 8 }} />
          <Text style={[styles.groupTitle, { color: colors.text, fontSize: scaleFont(14) }]}>AI Intelligence & Gemini Tier</Text>
        </View>
        <Text style={[styles.groupSubtitle, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
          Next-generation Gemini reasoning models with real-time tool calling and system observability.
        </Text>

        {/* API Key Input */}
        <Text style={[styles.fieldLabel, { color: colors.textMuted, fontSize: scaleFont(11) }]}>GEMINI API KEY</Text>
        <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[styles.fieldInput, { flex: 1, backgroundColor: 'transparent', color: colors.text, fontSize: scaleFont(12) }]}
            value={apiKeyInput}
            onChangeText={setApiKeyInput}
            placeholder="AIzaSy..."
            placeholderTextColor={colors.textMuted}
            secureTextEntry={isSecure}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.showBtn} onPress={() => setIsSecure(!isSecure)}>
            <Text style={[styles.showBtnText, { color: colors.primary, fontSize: scaleFont(11) }]}>{isSecure ? 'Show' : 'Hide'}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.saveKeyBtn, { backgroundColor: colors.primary, marginTop: 8 }]}
          onPress={handleSaveApiKey}
          activeOpacity={0.8}
        >
          <Text style={[styles.saveKeyBtnText, { fontSize: scaleFont(12) }]}>Save Key to Keystore</Text>
        </TouchableOpacity>

        {/* Primary 3.5 - 3.7 Model Tiers */}
        <Text style={[styles.fieldLabel, { color: colors.textMuted, fontSize: scaleFont(11), marginTop: 14 }]}>
          PRIMARY MODEL TIERS (3.5 – 3.7)
        </Text>
        <View style={{ gap: 8 }}>
          {PRIMARY_3X_MODELS.map((m) => {
            const isSelected = modelInput === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.modelOptionRow,
                  {
                    backgroundColor: isSelected ? colors.primaryBg : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => handleSelectModel(m.id)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Ionicons name={m.icon} size={scaleFont(18)} color={m.badgeColor} style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modelName, { color: colors.text, fontSize: scaleFont(13) }]}>{m.name}</Text>
                    <Text style={[styles.modelDescText, { color: colors.textSecondary, fontSize: scaleFont(11) }]} numberOfLines={1}>
                      {m.description}
                    </Text>
                  </View>
                </View>
                <View style={[styles.badgePill, { backgroundColor: `${m.badgeColor}20`, borderColor: `${m.badgeColor}40` }]}>
                  <Text style={[styles.badgeTextSmall, { color: m.badgeColor, fontSize: scaleFont(10) }]}>{m.badge}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.moreModelsBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => {
            triggerHaptic('selection');
            setModelPickerModalVisible(true);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="apps-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.moreModelsBtnText, { color: colors.primary, fontSize: scaleFont(12) }]}>
            Browse All Gemini 3.5 – 3.7 Models ({ALL_GEMINI_3X_MODELS.length})...
          </Text>
        </TouchableOpacity>
      </View>

      {/* ================= GROUP 7: LOCALIZATION & CURRENCY ================= */}
      <CurrencySection settings={settings} />

      {/* ================= GROUP 8: HARDWARE SECURITY & OBSERVERS ================= */}
      <View style={[styles.groupCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.groupHeader}>
          <Ionicons name="shield-checkmark-outline" size={scaleFont(20)} color="#10b981" style={{ marginRight: 8 }} />
          <Text style={[styles.groupTitle, { color: colors.text, fontSize: scaleFont(14) }]}>Security & Background Observers</Text>
        </View>
        <Text style={[styles.groupSubtitle, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
          Biometric fingerprint, PIN security, and automated background sensors.
        </Text>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.text, fontSize: scaleFont(12) }]}>Biometric & PIN App Lock</Text>
            <Text style={[styles.rowDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
              Require Fingerprint / Face ID to open Argus
            </Text>
          </View>
          <Switch
            value={settings.appLockEnabled}
            onValueChange={handleToggleAppLock}
            trackColor={{ false: '#3f3f46', true: colors.primary }}
            thumbColor={settings.appLockEnabled ? '#ffffff' : '#a1a1aa'}
          />
        </View>

        {settings.appLockEnabled && (
          <View style={{ marginTop: 12, paddingLeft: 4 }}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted, fontSize: scaleFont(10), marginBottom: 6 }]}>
              LOCK TIMEOUT (KEEP UNLOCKED FOR)
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[
                { label: 'Instant', value: 0 },
                { label: '1 min', value: 60 },
                { label: '5 mins', value: 300 },
                { label: '15 mins', value: 900 },
                { label: '1 hr', value: 3600 },
              ].map((opt) => {
                const isSelected = settings.appLockTimeout === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.scaleChip,
                      {
                        backgroundColor: isSelected ? colors.primaryBg : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => {
                      triggerHaptic('selection');
                      settings.setAppLockTimeout(opt.value);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={{
                        color: isSelected ? colors.primary : colors.textSecondary,
                        fontSize: scaleFont(11),
                        fontWeight: isSelected ? '800' : '600',
                      }}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <View style={[styles.toggleRow, { marginTop: 14 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.text, fontSize: scaleFont(12) }]}>Always-On "Hey Argus"</Text>
            <Text style={[styles.rowDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
              Background voice hotword listener
            </Text>
          </View>
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

        <View style={[styles.toggleRow, { marginTop: 10 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.text, fontSize: scaleFont(12) }]}>Bank Notification Listener</Text>
            <Text style={[styles.rowDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
              Auto-detect bank debit/credit receipts
            </Text>
          </View>
          <Switch
            value={settings.notificationsTracking}
            onValueChange={(val) => {
              triggerHaptic('selection');
              settings.toggleNotificationsTracking(val);
            }}
            trackColor={{ false: '#3f3f46', true: colors.primary }}
            thumbColor={settings.notificationsTracking ? '#ffffff' : '#a1a1aa'}
          />
        </View>

        <View style={[styles.toggleRow, { marginTop: 10 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.text, fontSize: scaleFont(12) }]}>Screen Time & Telemetry</Text>
            <Text style={[styles.rowDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
              Query foreground app sessions
            </Text>
          </View>
          <Switch
            value={settings.appUsageTracking}
            onValueChange={(val) => {
              triggerHaptic('selection');
              settings.toggleAppUsageTracking(val);
            }}
            trackColor={{ false: '#3f3f46', true: colors.primary }}
            thumbColor={settings.appUsageTracking ? '#ffffff' : '#a1a1aa'}
          />
        </View>

        {Platform.OS === 'android' && (
          <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, gap: 10 }}>
            <TouchableOpacity
              style={[styles.manageBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => ArgusSystemMonitors.openNotificationListenerSettings()}
              activeOpacity={0.8}
            >
              <Ionicons name="receipt-outline" size={16} color={colors.success} style={{ marginRight: 6 }} />
              <Text style={[styles.manageBtnText, { color: colors.success, fontSize: scaleFont(12) }]}>
                Open Notification Listener Settings
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ================= HCI POPUP: ALL GEMINI 3.5 - 3.7 MODELS SELECTION ================= */}
      {/* ================= HCI FULL POPUP: ALL GEMINI 3.5 - 3.7 MODELS SELECTION ================= */}
      <Modal visible={modelPickerModalVisible} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setModelPickerModalVisible(false)}>
          <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border, height: '92%', maxHeight: '94%', paddingBottom: Math.max(insets.bottom, 20) }]}>
                <View style={styles.sheetHandle} />

                <View style={styles.modalHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="sparkles" size={20} color={colors.primary} style={{ marginRight: 8 }} />
                    <View>
                      <Text style={[styles.modalTitle, { color: colors.text, fontSize: scaleFont(16) }]}>Gemini Model Catalog</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: scaleFont(11), marginTop: 2 }}>
                        Google DeepMind Foundation Models
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setModelPickerModalVisible(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={24} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={[styles.searchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="search" size={15} color={colors.textMuted} style={{ marginRight: 6 }} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.text, fontSize: scaleFont(12) }]}
                    value={modelSearchQuery}
                    onChangeText={setModelSearchQuery}
                    placeholder="Search Gemini models or capabilities..."
                    placeholderTextColor={colors.textMuted}
                  />
                  {modelSearchQuery ? (
                    <TouchableOpacity onPress={() => setModelSearchQuery('')}>
                      <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingVertical: 10, gap: 10, paddingBottom: 30 }}
                  keyboardShouldPersistTaps="handled"
                  automaticallyAdjustKeyboardInsets={true}
                  showsVerticalScrollIndicator={false}
                >
                  {filteredCatalog.map((m) => {
                    const isSelected = modelInput === m.id;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[
                          styles.catalogItemCard,
                          {
                            backgroundColor: isSelected ? colors.primaryBg : colors.surface,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => {
                          triggerHaptic('selection');
                          handleSelectModel(m.id);
                          setModelPickerModalVisible(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.catalogTop}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name={m.icon} size={16} color={m.badgeColor} style={{ marginRight: 8 }} />
                            <Text style={[styles.catalogName, { color: colors.text, fontSize: scaleFont(13) }]}>{m.name}</Text>
                          </View>
                          <View style={[styles.badgePill, { backgroundColor: `${m.badgeColor}20`, borderColor: `${m.badgeColor}40` }]}>
                            <Text style={[styles.badgeTextSmall, { color: m.badgeColor, fontSize: scaleFont(10) }]}>{m.badge}</Text>
                          </View>
                        </View>
                        <Text style={[styles.catalogDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>{m.description}</Text>
                        <View style={styles.catalogMetaRow}>
                          <View style={[styles.metaChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Text style={[styles.metaChipText, { color: colors.textMuted, fontSize: scaleFont(10) }]}>⚡ {m.speed}</Text>
                          </View>
                          <View style={[styles.metaChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Text style={[styles.metaChipText, { color: colors.textMuted, fontSize: scaleFont(10) }]}>📚 {m.contextWindow}</Text>
                          </View>
                          {isSelected && (
                            <View style={[styles.activeCheckBadge, { backgroundColor: colors.successBg, borderColor: colors.success }]}>
                              <Text style={[styles.activeCheckBadgeText, { color: colors.success, fontSize: scaleFont(10) }]}>Active</Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 14,
    gap: 14,
  },
  groupCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  groupTitle: {
    fontWeight: '800',
  },
  groupSubtitle: {
    lineHeight: 16,
    marginBottom: 12,
  },
  fieldLabel: {
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  subItemBox: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  brandIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  subItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: 'transparent',
  },
  subItemTitle: {
    fontWeight: '700',
  },
  subItemDesc: {
    marginTop: 2,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontWeight: '800',
  },
  smallActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  smallActionBtnText: {
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  badgeInactive: {
    backgroundColor: 'rgba(113, 113, 122, 0.15)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  badgeTextActive: {
    color: '#34d399',
  },
  badgeTextInactive: {
    color: '#71717a',
  },
  connectBtn: {
    backgroundColor: '#1d9bf0',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  btnActionRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'transparent',
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontWeight: '600',
  },
  dangerSmallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerSmallBtnText: {
    color: '#f87171',
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'transparent',
  },
  themeChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  scaleChip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  chipTitle: {
    fontWeight: '700',
    marginBottom: 2,
  },
  chipDesc: {
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  rowLabel: {
    fontWeight: '700',
    marginBottom: 2,
  },
  rowDesc: {
    lineHeight: 15,
  },
  dataActionsGrid: {
    gap: 8,
    backgroundColor: 'transparent',
  },
  dataActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  dataActionBtnText: {
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  fieldInput: {
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  showBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  showBtnText: {
    fontWeight: '700',
  },
  saveKeyBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveKeyBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  modelOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  modelName: {
    fontWeight: '700',
  },
  modelDescText: {
    marginTop: 2,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeTextSmall: {
    fontWeight: '700',
  },
  moreModelsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
  },
  moreModelsBtnText: {
    fontWeight: '700',
  },
  currencyRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'transparent',
  },
  currencyChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  currSymbol: {
    fontWeight: '800',
    marginBottom: 2,
  },
  currCode: {
    fontWeight: '600',
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  manageBtnText: {
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 12,
    borderWidth: 1,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#52525b',
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  modalTitle: {
    fontWeight: '800',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
  },
  catalogItemCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  catalogTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  catalogName: {
    fontWeight: '700',
  },
  catalogDesc: {
    lineHeight: 16,
    marginBottom: 8,
  },
  catalogMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'transparent',
  },
  metaChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  metaChipText: {
    fontWeight: '600',
  },
  activeCheckBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  activeCheckBadgeText: {
    fontWeight: '700',
  },
});
