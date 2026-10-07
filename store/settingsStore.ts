import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getDatabase, saveSetting } from '../services/database/db';
import ArgusSystemMonitors from '@/modules/argus-system-monitors';

export type ThemeMode = 'system' | 'dark' | 'light';
export type TextScale = 'small' | 'medium' | 'large' | 'xlarge';
export type NotificationStyle = 'sound_and_vibe' | 'sound_only' | 'vibe_only' | 'silent';

interface SettingsState {
  apiKey: string;
  geminiModel: string;
  currency: string;
  temperature: number;
  showSuggestions: boolean;
  autoCategorize: boolean;
  geofenceTracking: boolean;
  notificationsTracking: boolean;
  appUsageTracking: boolean;
  xAccount: string;
  githubAccount: string;
  appLockEnabled: boolean;
  appLockTimeout: number; // In seconds: 0, 60, 300, 900, 3600
  alwaysOnVoiceEnabled: boolean;
  audioFeedbackEnabled: boolean;
  hasCompletedOnboarding: boolean;
  isLoading: boolean;

  // HCI: Display & Theme
  themeMode: ThemeMode;
  textScale: TextScale;
  highContrast: boolean;

  // HCI: Notifications & Alerts
  pushNotificationsEnabled: boolean;
  alertBudgetWarnings: boolean;
  alertBankTransactions: boolean;
  alertGeofences: boolean;
  alertDailySummary: boolean;
  notificationStyle: NotificationStyle;

  // HCI: Interaction & Feedback
  hapticFeedbackEnabled: boolean;
  soundEffectsEnabled: boolean;
  reduceMotion: boolean;

  // HCI: Account & Privacy
  profileName: string;
  profileEmail: string;
  analyticsEnabled: boolean;
  adTrackingEnabled: boolean;
  crashReportingEnabled: boolean;

  // Actions
  loadSettings: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  syncSystemPermissions: () => Promise<void>;
  setApiKey: (key: string) => Promise<void>;
  setGeminiModel: (model: string) => Promise<void>;
  setCurrency: (currency: string) => Promise<void>;
  setTemperature: (temp: number) => Promise<void>;
  setXAccount: (handle: string) => Promise<void>;
  setGithubAccount: (username: string) => Promise<void>;
  disconnectXAccount: () => Promise<void>;
  disconnectGithubAccount: () => Promise<void>;
  toggleAppLock: (enabled: boolean) => Promise<void>;
  setAppLockTimeout: (seconds: number) => Promise<void>;
  toggleAlwaysOnVoice: (enabled: boolean) => Promise<void>;
  toggleAudioFeedback: (enabled: boolean) => Promise<void>;
  toggleSuggestions: (enabled: boolean) => Promise<void>;
  toggleAutoCategorize: (enabled: boolean) => Promise<void>;
  toggleGeofenceTracking: (enabled: boolean) => Promise<void>;
  toggleNotificationsTracking: (enabled: boolean) => Promise<void>;
  toggleAppUsageTracking: (enabled: boolean) => Promise<void>;

  // HCI Actions
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setTextScale: (scale: TextScale) => Promise<void>;
  toggleHighContrast: (enabled: boolean) => Promise<void>;
  togglePushNotifications: (enabled: boolean) => Promise<void>;
  toggleAlertBudgetWarnings: (enabled: boolean) => Promise<void>;
  toggleAlertBankTransactions: (enabled: boolean) => Promise<void>;
  toggleAlertGeofences: (enabled: boolean) => Promise<void>;
  toggleAlertDailySummary: (enabled: boolean) => Promise<void>;
  setNotificationStyle: (style: NotificationStyle) => Promise<void>;
  toggleHapticFeedback: (enabled: boolean) => Promise<void>;
  toggleSoundEffects: (enabled: boolean) => Promise<void>;
  toggleReduceMotion: (enabled: boolean) => Promise<void>;
  updateProfile: (name: string, email: string) => Promise<void>;
  toggleAnalytics: (enabled: boolean) => Promise<void>;
  toggleAdTracking: (enabled: boolean) => Promise<void>;
  toggleCrashReporting: (enabled: boolean) => Promise<void>;
  clearChatHistory: () => Promise<void>;
  signOutAndClearAuth: () => Promise<void>;
  deleteAccountAndPurgeData: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || '',
  geminiModel: 'gemini-3.7-flash',
  currency: 'NGN',
  temperature: 0.2,
  showSuggestions: true,
  autoCategorize: true,
  geofenceTracking: false,
  notificationsTracking: false,
  appUsageTracking: false,
  xAccount: '',
  githubAccount: '',
  appLockEnabled: false,
  appLockTimeout: 0,
  alwaysOnVoiceEnabled: false,
  audioFeedbackEnabled: false,
  isLoading: false,

  // HCI Defaults
  themeMode: 'system',
  textScale: 'medium',
  highContrast: false,
  pushNotificationsEnabled: true,
  alertBudgetWarnings: true,
  alertBankTransactions: true,
  alertGeofences: true,
  alertDailySummary: false,
  notificationStyle: 'sound_and_vibe',
  hapticFeedbackEnabled: true,
  soundEffectsEnabled: true,
  reduceMotion: false,
  profileName: 'Argus User',
  profileEmail: '',
  analyticsEnabled: false,
  adTrackingEnabled: false,
  crashReportingEnabled: true,
  hasCompletedOnboarding: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      // 1. Load API Key from environment or secure store
      const envKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
      const savedKey = (await SecureStore.getItemAsync('GEMINI_API_KEY')) || '';
      const apiKey = envKey || savedKey;

      // 2. Load other settings from SQLite
      const db = await getDatabase();
      const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');

      const settingsMap: Record<string, string> = {};
      rows.forEach((row) => {
        settingsMap[row.key] = row.value;
      });

      let savedModel = settingsMap['gemini_model'] || 'gemini-3.7-flash';
      if (savedModel.includes('3.5') || savedModel.includes('3.6') || savedModel.includes('1.5') || savedModel.includes('2.0')) {
        savedModel = 'gemini-3.7-flash';
      }
      const savedCurrency = settingsMap['primary_currency'] || 'NGN';
      const savedTemp = settingsMap['temperature'] ? parseFloat(settingsMap['temperature']) : 0.2;
      const savedSuggestions = settingsMap['show_suggestions'] !== '0';
      const savedAutoCat = settingsMap['auto_categorize'] !== '0';
      const savedX = settingsMap['x_account'] || '';
      const savedGithub = settingsMap['github_account'] || '';
      const savedAppLock = settingsMap['app_lock_enabled'] === '1';
      const savedLockTimeout = settingsMap['app_lock_timeout'] ? parseInt(settingsMap['app_lock_timeout'], 10) : 0;
      const savedAlwaysOnVoice = settingsMap['always_on_voice_enabled'] === '1';
      const savedAudioFeedback = settingsMap['audio_feedback_enabled'] === '1';
      const savedOnboarding = settingsMap['has_completed_onboarding'] === '1';

      set({
        apiKey,
        geminiModel: savedModel,
        currency: savedCurrency,
        temperature: savedTemp,
        showSuggestions: savedSuggestions,
        autoCategorize: savedAutoCat,
        xAccount: savedX,
        githubAccount: savedGithub,
        appLockEnabled: savedAppLock,
        appLockTimeout: savedLockTimeout,
        alwaysOnVoiceEnabled: savedAlwaysOnVoice,
        audioFeedbackEnabled: savedAudioFeedback,
        hasCompletedOnboarding: savedOnboarding,
        geofenceTracking: settingsMap['geofence_tracking_enabled'] === '1',
        notificationsTracking: settingsMap['notifications_tracking_enabled'] === '1',
        appUsageTracking: settingsMap['app_usage_tracking_enabled'] === '1',

        // HCI Mappings
        themeMode: (settingsMap['theme_mode'] as ThemeMode) || 'system',
        textScale: (settingsMap['text_scale'] as TextScale) || 'medium',
        highContrast: settingsMap['high_contrast'] === '1',
        pushNotificationsEnabled: settingsMap['push_notifications_enabled'] !== '0',
        alertBudgetWarnings: settingsMap['alert_budget_warnings'] !== '0',
        alertBankTransactions: settingsMap['alert_bank_transactions'] !== '0',
        alertGeofences: settingsMap['alert_geofences'] !== '0',
        alertDailySummary: settingsMap['alert_daily_summary'] === '1',
        notificationStyle: (settingsMap['notification_style'] as NotificationStyle) || 'sound_and_vibe',
        hapticFeedbackEnabled: settingsMap['haptic_feedback_enabled'] !== '0',
        soundEffectsEnabled: settingsMap['sound_effects_enabled'] !== '0',
        reduceMotion: settingsMap['reduce_motion'] === '1',
        profileName: settingsMap['profile_name'] || 'Argus User',
        profileEmail: settingsMap['profile_email'] || '',
        analyticsEnabled: settingsMap['analytics_enabled'] === '1',
        adTrackingEnabled: settingsMap['ad_tracking_enabled'] === '1',
        crashReportingEnabled: settingsMap['crash_reporting_enabled'] !== '0',
      });

      // Automatically sync active system permission states on startup
      get().syncSystemPermissions();
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  completeOnboarding: async () => {
    await saveSetting('has_completed_onboarding', '1');
    set({ hasCompletedOnboarding: true });
  },

  syncSystemPermissions: async () => {
    try {
      if (Platform.OS === 'android') {
        const [nPerm, uPerm] = await Promise.all([
          ArgusSystemMonitors?.hasNotificationListenerPermission?.(),
          ArgusSystemMonitors?.hasUsageStatsPermission?.(),
        ]);
        if (typeof nPerm === 'boolean') {
          await saveSetting('notifications_tracking_enabled', nPerm ? '1' : '0');
          set({ notificationsTracking: nPerm });
        }
        if (typeof uPerm === 'boolean') {
          await saveSetting('app_usage_tracking_enabled', uPerm ? '1' : '0');
          set({ appUsageTracking: uPerm });
        }
      }
    } catch (e) {
      console.warn('Error syncing system permissions:', e);
    }
  },

  setApiKey: async (key: string) => {
    try {
      if (key) {
        await SecureStore.setItemAsync('GEMINI_API_KEY', key);
      } else {
        await SecureStore.deleteItemAsync('GEMINI_API_KEY');
      }
      set({ apiKey: key });
    } catch (error) {
      console.error('Failed to save API key:', error);
      throw error;
    }
  },

  setGeminiModel: async (model: string) => {
    await saveSetting('gemini_model', model);
    set({ geminiModel: model });
  },

  setCurrency: async (currency: string) => {
    await saveSetting('primary_currency', currency);
    set({ currency });
  },

  setTemperature: async (temperature: number) => {
    await saveSetting('temperature', String(temperature));
    set({ temperature });
  },

  setXAccount: async (handle: string) => {
    await saveSetting('x_account', handle);
    set({ xAccount: handle });
  },

  setGithubAccount: async (username: string) => {
    await saveSetting('github_account', username);
    set({ githubAccount: username });
  },

  disconnectXAccount: async () => {
    try {
      const db = await getDatabase();
      await db.runAsync('DELETE FROM settings WHERE key = ?', 'x_account');
      await SecureStore.deleteItemAsync('X_AUTH_TOKEN').catch(() => {});
      set({ xAccount: '' });
    } catch (error) {
      console.error('Failed to disconnect X account:', error);
    }
  },

  disconnectGithubAccount: async () => {
    try {
      const db = await getDatabase();
      await db.runAsync('DELETE FROM settings WHERE key = ?', 'github_account');
      await SecureStore.deleteItemAsync('GITHUB_AUTH_TOKEN').catch(() => {});
      set({ githubAccount: '' });
    } catch (error) {
      console.error('Failed to disconnect GitHub account:', error);
    }
  },

  toggleAppLock: async (enabled: boolean) => {
    await saveSetting('app_lock_enabled', enabled ? '1' : '0');
    set({ appLockEnabled: enabled });
  },

  setAppLockTimeout: async (seconds: number) => {
    await saveSetting('app_lock_timeout', String(seconds));
    set({ appLockTimeout: seconds });
  },

  toggleAlwaysOnVoice: async (enabled: boolean) => {
    await saveSetting('always_on_voice_enabled', enabled ? '1' : '0');
    set({ alwaysOnVoiceEnabled: enabled });
  },

  toggleAudioFeedback: async (enabled: boolean) => {
    await saveSetting('audio_feedback_enabled', enabled ? '1' : '0');
    set({ audioFeedbackEnabled: enabled });
  },

  toggleSuggestions: async (enabled: boolean) => {
    await saveSetting('show_suggestions', enabled ? '1' : '0');
    set({ showSuggestions: enabled });
  },

  toggleAutoCategorize: async (enabled: boolean) => {
    await saveSetting('auto_categorize', enabled ? '1' : '0');
    set({ autoCategorize: enabled });
  },

  toggleGeofenceTracking: async (enabled: boolean) => {
    await saveSetting('geofence_tracking_enabled', enabled ? '1' : '0');
    set({ geofenceTracking: enabled });
  },

  toggleNotificationsTracking: async (enabled: boolean) => {
    await saveSetting('notifications_tracking_enabled', enabled ? '1' : '0');
    set({ notificationsTracking: enabled });
  },

  toggleAppUsageTracking: async (enabled: boolean) => {
    await saveSetting('app_usage_tracking_enabled', enabled ? '1' : '0');
    set({ appUsageTracking: enabled });
  },

  // HCI Setters
  setThemeMode: async (mode: ThemeMode) => {
    await saveSetting('theme_mode', mode);
    set({ themeMode: mode });
  },

  setTextScale: async (scale: TextScale) => {
    await saveSetting('text_scale', scale);
    set({ textScale: scale });
  },

  toggleHighContrast: async (enabled: boolean) => {
    await saveSetting('high_contrast', enabled ? '1' : '0');
    set({ highContrast: enabled });
  },

  togglePushNotifications: async (enabled: boolean) => {
    await saveSetting('push_notifications_enabled', enabled ? '1' : '0');
    set({ pushNotificationsEnabled: enabled });
  },

  toggleAlertBudgetWarnings: async (enabled: boolean) => {
    await saveSetting('alert_budget_warnings', enabled ? '1' : '0');
    set({ alertBudgetWarnings: enabled });
  },

  toggleAlertBankTransactions: async (enabled: boolean) => {
    await saveSetting('alert_bank_transactions', enabled ? '1' : '0');
    set({ alertBankTransactions: enabled });
  },

  toggleAlertGeofences: async (enabled: boolean) => {
    await saveSetting('alert_geofences', enabled ? '1' : '0');
    set({ alertGeofences: enabled });
  },

  toggleAlertDailySummary: async (enabled: boolean) => {
    await saveSetting('alert_daily_summary', enabled ? '1' : '0');
    set({ alertDailySummary: enabled });
  },

  setNotificationStyle: async (style: NotificationStyle) => {
    await saveSetting('notification_style', style);
    set({ notificationStyle: style });
  },

  toggleHapticFeedback: async (enabled: boolean) => {
    await saveSetting('haptic_feedback_enabled', enabled ? '1' : '0');
    set({ hapticFeedbackEnabled: enabled });
  },

  toggleSoundEffects: async (enabled: boolean) => {
    await saveSetting('sound_effects_enabled', enabled ? '1' : '0');
    set({ soundEffectsEnabled: enabled });
  },

  toggleReduceMotion: async (enabled: boolean) => {
    await saveSetting('reduce_motion', enabled ? '1' : '0');
    set({ reduceMotion: enabled });
  },

  updateProfile: async (name: string, email: string) => {
    await saveSetting('profile_name', name);
    await saveSetting('profile_email', email);
    set({ profileName: name, profileEmail: email });
  },

  toggleAnalytics: async (enabled: boolean) => {
    await saveSetting('analytics_enabled', enabled ? '1' : '0');
    set({ analyticsEnabled: enabled });
  },

  toggleAdTracking: async (enabled: boolean) => {
    await saveSetting('ad_tracking_enabled', enabled ? '1' : '0');
    set({ adTrackingEnabled: enabled });
  },

  toggleCrashReporting: async (enabled: boolean) => {
    await saveSetting('crash_reporting_enabled', enabled ? '1' : '0');
    set({ crashReportingEnabled: enabled });
  },

  clearChatHistory: async () => {
    try {
      const db = await getDatabase();
      await db.runAsync('DELETE FROM messages');
      await db.runAsync('DELETE FROM conversations');
    } catch (error) {
      console.error('Failed to clear chat history:', error);
    }
  },

  signOutAndClearAuth: async () => {
    try {
      const db = await getDatabase();
      await db.runAsync('DELETE FROM settings WHERE key IN (?, ?, ?)', 'x_account', 'github_account', 'profile_email');
      await SecureStore.deleteItemAsync('X_AUTH_TOKEN').catch(() => {});
      await SecureStore.deleteItemAsync('GITHUB_AUTH_TOKEN').catch(() => {});
      set({
        xAccount: '',
        githubAccount: '',
        profileEmail: '',
      });
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  },

  deleteAccountAndPurgeData: async () => {
    try {
      const db = await getDatabase();
      await db.runAsync('DELETE FROM messages');
      await db.runAsync('DELETE FROM conversations');
      await db.runAsync('DELETE FROM expenses');
      await db.runAsync('DELETE FROM notes');
      await db.runAsync('DELETE FROM geofences');
      await db.runAsync('DELETE FROM geofence_events');
      await db.runAsync('DELETE FROM monthly_budgets');
      await db.runAsync('DELETE FROM notification_events');
      await db.runAsync('DELETE FROM app_usage_sessions');
      await db.runAsync('DELETE FROM settings');
      await SecureStore.deleteItemAsync('GEMINI_API_KEY').catch(() => {});
      await SecureStore.deleteItemAsync('X_AUTH_TOKEN').catch(() => {});
      await SecureStore.deleteItemAsync('GITHUB_AUTH_TOKEN').catch(() => {});
      
      set({
        apiKey: '',
        geminiModel: 'gemini-3.7-flash',
        currency: 'NGN',
        temperature: 0.2,
        showSuggestions: true,
        autoCategorize: true,
        geofenceTracking: false,
        notificationsTracking: false,
        appUsageTracking: false,
        xAccount: '',
        githubAccount: '',
        appLockEnabled: false,
        themeMode: 'system',
        textScale: 'medium',
        highContrast: false,
        pushNotificationsEnabled: true,
        alertBudgetWarnings: true,
        alertBankTransactions: true,
        alertGeofences: true,
        alertDailySummary: false,
        notificationStyle: 'sound_and_vibe',
        hapticFeedbackEnabled: true,
        soundEffectsEnabled: true,
        reduceMotion: false,
        profileName: 'Argus User',
        profileEmail: '',
        analyticsEnabled: false,
        adTrackingEnabled: false,
        crashReportingEnabled: true,
      });
    } catch (error) {
      console.error('Failed to purge account data:', error);
    }
  },
}));

