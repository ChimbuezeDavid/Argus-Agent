// Unified Native Module Bridge with resilient fallback handlers for Android System Monitoring, Storage & Automation
import { requireNativeModule, EventEmitter, EventSubscription } from 'expo-modules-core';
import { Platform, Linking } from 'react-native';

let rawNativeModule: any = null;
let speechEventEmitter: any = null;
try {
  rawNativeModule = requireNativeModule('ArgusSystemMonitors');
  if (rawNativeModule) {
    speechEventEmitter = new (EventEmitter as any)(rawNativeModule);
  }
} catch (e) {
  // Module not found or running on Web/Expo Go
}

export interface AppUsageStats {
  packageName: string;
  totalTimeVisible: number; // in milliseconds
  lastTimeUsed: number;     // Epoch timestamp in milliseconds
}

export interface StorageFileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  lastModified: number;
}

export interface StorageDirectories {
  root: string;
  downloads: string;
  documents: string;
  dcim: string;
  pictures: string;
}

export interface ArgusSystemMonitorsType {
  // Telemetry & Permissions
  hasUsageStatsPermission(): Promise<boolean>;
  getAppUsageStats(startTimeMs: number, endTimeMs: number): Promise<AppUsageStats[]>;
  hasNotificationListenerPermission(): Promise<boolean>;
  launchApp(packageName: string): Promise<boolean>;
  openNotificationListenerSettings(): Promise<boolean>;
  openAppNotificationSettings(): Promise<boolean>;
  openUsageAccessSettings(): Promise<boolean>;

  // Phase 1: Storage & File System
  hasStoragePermission(): Promise<boolean>;
  openAllFilesAccessSettings(): Promise<boolean>;
  getStorageDirectories(): Promise<StorageDirectories>;
  listFiles(directoryPath: string, extensionFilter?: string, maxDepth?: number): Promise<StorageFileItem[]>;
  searchFiles(query: string, rootPath?: string, maxResults?: number): Promise<StorageFileItem[]>;
  readFileContent(filePath: string, maxBytes?: number): Promise<string>;
  writeFileContent(filePath: string, content: string, append?: boolean): Promise<boolean>;
  deleteFile(filePath: string): Promise<boolean>;

  // Phase 2: App Automation & Intents
  sendWhatsAppMessage(phone: string | undefined | null, message: string): Promise<boolean>;
  sendEmail(recipient?: string | null, subject?: string | null, body?: string | null): Promise<boolean>;
  sendSMS(phone: string | undefined | null, message: string): Promise<boolean>;
  openMapLocation(queryOrAddress?: string | null, lat?: number | null, lon?: number | null): Promise<boolean>;
  openCalendarEvent(title: string, startTimeMs?: number | null, location?: string | null, description?: string | null): Promise<boolean>;
  openWebSearch(query: string): Promise<boolean>;

  // Phase 3: Accessibility RPA Autonomous Screen Controller
  hasAccessibilityPermission(): Promise<boolean>;
  openAccessibilitySettings(): Promise<boolean>;
  inspectScreenNodes(): Promise<any[]>;
  clickScreenElement(targetText: string, exactMatch?: boolean): Promise<boolean>;
  clickScreenElementById(viewId: string): Promise<boolean>;
  typeTextIntoScreen(text: string, viewId?: string | null, targetText?: string | null): Promise<boolean>;
  tapScreenCoordinates(x: number, y: number): Promise<boolean>;
  scrollScreen(direction: string): Promise<boolean>;
  performPhoneGlobalAction(actionName: string): Promise<boolean>;

  // Phase 4: On-Device Speech Recognition & Voice Assistant
  isSpeechRecognitionAvailable(): Promise<boolean>;
  startSpeechRecognition(): Promise<boolean>;
  stopSpeechRecognition(): Promise<boolean>;
  cancelSpeechRecognition(): Promise<boolean>;
  promptAndroidVoiceAssistant(): Promise<string>;
  startAudioCapture(): Promise<any>;
  stopAudioCapture(): Promise<string>;
  getAudioCaptureAmplitude(): Promise<number>;
  addSpeechListener(
    event: 'onSpeechPartialResults' | 'onSpeechResults' | 'onSpeechError' | 'onSpeechEnd' | 'onSpeechRmsChanged',
    listener: (data: any) => void
  ): EventSubscription | null;
}

export const ArgusSystemMonitors: ArgusSystemMonitorsType = {
  hasUsageStatsPermission: async () => {
    try {
      if (rawNativeModule && typeof rawNativeModule.hasUsageStatsPermission === 'function') {
        return await rawNativeModule.hasUsageStatsPermission();
      }
    } catch (e) {}
    return false;
  },

  getAppUsageStats: async (startTimeMs: number, endTimeMs: number) => {
    try {
      if (rawNativeModule && typeof rawNativeModule.getAppUsageStats === 'function') {
        return await rawNativeModule.getAppUsageStats(startTimeMs, endTimeMs);
      }
    } catch (e) {}
    return [];
  },

  hasNotificationListenerPermission: async () => {
    try {
      if (rawNativeModule && typeof rawNativeModule.hasNotificationListenerPermission === 'function') {
        return await rawNativeModule.hasNotificationListenerPermission();
      }
    } catch (e) {}
    return false;
  },

  launchApp: async (packageName: string) => {
    try {
      if (rawNativeModule && typeof rawNativeModule.launchApp === 'function') {
        return await rawNativeModule.launchApp(packageName);
      }
    } catch (e) {}
    return false;
  },

  openNotificationListenerSettings: async () => {
    try {
      if (rawNativeModule && typeof rawNativeModule.openNotificationListenerSettings === 'function') {
        const res = await rawNativeModule.openNotificationListenerSettings();
        if (res) return true;
      }
    } catch (e) {}

    try {
      if (Platform.OS === 'android') {
        await Linking.sendIntent('android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS');
        return true;
      }
    } catch (e) {}

    try {
      await Linking.openSettings();
      return true;
    } catch (err) {
      return false;
    }
  },

  openAppNotificationSettings: async () => {
    try {
      if (rawNativeModule && typeof rawNativeModule.openAppNotificationSettings === 'function') {
        const res = await rawNativeModule.openAppNotificationSettings();
        if (res) return true;
      }
    } catch (e) {}

    try {
      if (Platform.OS === 'android') {
        await Linking.sendIntent('android.settings.APP_NOTIFICATION_SETTINGS', [
          { key: 'android.provider.extra.APP_PACKAGE', value: 'com.argus.agent' },
        ]);
        return true;
      }
    } catch (e) {}

    try {
      await Linking.openSettings();
      return true;
    } catch (err) {
      return false;
    }
  },

  openUsageAccessSettings: async () => {
    try {
      if (rawNativeModule && typeof rawNativeModule.openUsageAccessSettings === 'function') {
        const res = await rawNativeModule.openUsageAccessSettings();
        if (res) return true;
      }
    } catch (e) {}

    try {
      if (Platform.OS === 'android') {
        await Linking.sendIntent('android.settings.USAGE_ACCESS_SETTINGS');
        return true;
      }
    } catch (e) {}

    try {
      await Linking.openSettings();
      return true;
    } catch (err) {
      return false;
    }
  },

  // =========================================================================
  // Phase 1: Storage & Files
  // =========================================================================

  hasStoragePermission: async () => {
    try {
      if (rawNativeModule && typeof rawNativeModule.hasStoragePermission === 'function') {
        return await rawNativeModule.hasStoragePermission();
      }
    } catch (e) {}
    return false;
  },

  openAllFilesAccessSettings: async () => {
    try {
      if (rawNativeModule && typeof rawNativeModule.openAllFilesAccessSettings === 'function') {
        return await rawNativeModule.openAllFilesAccessSettings();
      }
    } catch (e) {}

    try {
      await Linking.openSettings();
      return true;
    } catch (e) {
      return false;
    }
  },

  getStorageDirectories: async () => {
    try {
      if (rawNativeModule && typeof rawNativeModule.getStorageDirectories === 'function') {
        return await rawNativeModule.getStorageDirectories();
      }
    } catch (e) {}
    return {
      root: '/storage/emulated/0',
      downloads: '/storage/emulated/0/Download',
      documents: '/storage/emulated/0/Documents',
      dcim: '/storage/emulated/0/DCIM',
      pictures: '/storage/emulated/0/Pictures',
    };
  },

  listFiles: async (directoryPath: string, extensionFilter?: string, maxDepth?: number) => {
    try {
      if (rawNativeModule && typeof rawNativeModule.listFiles === 'function') {
        return await rawNativeModule.listFiles(directoryPath, extensionFilter || null, maxDepth || 2);
      }
    } catch (e) {}
    return [];
  },

  searchFiles: async (query: string, rootPath?: string, maxResults?: number) => {
    try {
      if (rawNativeModule && typeof rawNativeModule.searchFiles === 'function') {
        return await rawNativeModule.searchFiles(query, rootPath || null, maxResults || 30);
      }
    } catch (e) {}
    return [];
  },

  readFileContent: async (filePath: string, maxBytes?: number) => {
    try {
      if (rawNativeModule && typeof rawNativeModule.readFileContent === 'function') {
        return await rawNativeModule.readFileContent(filePath, maxBytes || 100000);
      }
    } catch (e) {}
    return '';
  },

  writeFileContent: async (filePath: string, content: string, append?: boolean) => {
    try {
      if (rawNativeModule && typeof rawNativeModule.writeFileContent === 'function') {
        return await rawNativeModule.writeFileContent(filePath, content, append || false);
      }
    } catch (e) {}
    return false;
  },

  deleteFile: async (filePath: string) => {
    try {
      if (rawNativeModule && typeof rawNativeModule.deleteFile === 'function') {
        return await rawNativeModule.deleteFile(filePath);
      }
    } catch (e) {}
    return false;
  },

  // =========================================================================
  // Phase 2: App Automation & Intents
  // =========================================================================

  sendWhatsAppMessage: async (phone: string | undefined | null, message: string) => {
    try {
      if (rawNativeModule && typeof rawNativeModule.sendWhatsAppMessage === 'function') {
        const res = await rawNativeModule.sendWhatsAppMessage(phone || null, message);
        if (res) return true;
      }
    } catch (e) {}

    // Cross-platform fallback via Linking
    try {
      const cleanPhone = phone ? phone.replace(/[^0-9+]/g, '') : '';
      const url = cleanPhone
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
      await Linking.openURL(url);
      return true;
    } catch (e) {
      return false;
    }
  },

  sendEmail: async (recipient?: string | null, subject?: string | null, body?: string | null) => {
    try {
      if (rawNativeModule && typeof rawNativeModule.sendEmail === 'function') {
        const res = await rawNativeModule.sendEmail(recipient || null, subject || null, body || null);
        if (res) return true;
      }
    } catch (e) {}

    try {
      const query = [
        subject ? `subject=${encodeURIComponent(subject)}` : '',
        body ? `body=${encodeURIComponent(body)}` : '',
      ].filter(Boolean).join('&');
      const url = `mailto:${recipient || ''}${query ? '?' + query : ''}`;
      await Linking.openURL(url);
      return true;
    } catch (e) {
      return false;
    }
  },

  sendSMS: async (phone: string | undefined | null, message: string) => {
    try {
      if (rawNativeModule && typeof rawNativeModule.sendSMS === 'function') {
        const res = await rawNativeModule.sendSMS(phone || null, message);
        if (res) return true;
      }
    } catch (e) {}

    try {
      const url = `sms:${phone || ''}?body=${encodeURIComponent(message)}`;
      await Linking.openURL(url);
      return true;
    } catch (e) {
      return false;
    }
  },

  openMapLocation: async (queryOrAddress?: string | null, lat?: number | null, lon?: number | null) => {
    try {
      if (rawNativeModule && typeof rawNativeModule.openMapLocation === 'function') {
        const res = await rawNativeModule.openMapLocation(queryOrAddress || null, lat || null, lon || null);
        if (res) return true;
      }
    } catch (e) {}

    try {
      const url = lat != null && lon != null
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryOrAddress || '')}`;
      await Linking.openURL(url);
      return true;
    } catch (e) {
      return false;
    }
  },

  openCalendarEvent: async (title: string, startTimeMs?: number | null, location?: string | null, description?: string | null) => {
    try {
      if (rawNativeModule && typeof rawNativeModule.openCalendarEvent === 'function') {
        return await rawNativeModule.openCalendarEvent(title, startTimeMs || null, location || null, description || null);
      }
    } catch (e) {}
    return false;
  },

  openWebSearch: async (query: string) => {
    try {
      if (rawNativeModule && typeof rawNativeModule.openWebSearch === 'function') {
        const res = await rawNativeModule.openWebSearch(query);
        if (res) return true;
      }
    } catch (e) {}

    try {
      await Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
      return true;
    } catch (e) {
      return false;
    }
  },

  // Phase 3: Accessibility RPA Autonomous Screen Controller
  hasAccessibilityPermission: async () => {
    try {
      if (rawNativeModule && typeof rawNativeModule.hasAccessibilityPermission === 'function') {
        return await rawNativeModule.hasAccessibilityPermission();
      }
    } catch (e) {}
    return false;
  },

  openAccessibilitySettings: async () => {
    try {
      if (rawNativeModule && typeof rawNativeModule.openAccessibilitySettings === 'function') {
        const res = await rawNativeModule.openAccessibilitySettings();
        if (res) return true;
      }
    } catch (e) {}

    try {
      if (Platform.OS === 'android') {
        await Linking.sendIntent('android.settings.ACCESSIBILITY_SETTINGS');
        return true;
      }
    } catch (e) {
      try {
        await Linking.openSettings();
        return true;
      } catch (err) {}
    }
    return false;
  },

  inspectScreenNodes: async () => {
    try {
      if (rawNativeModule && typeof rawNativeModule.inspectScreenNodes === 'function') {
        return await rawNativeModule.inspectScreenNodes();
      }
    } catch (e) {}
    return [];
  },

  clickScreenElement: async (targetText: string, exactMatch?: boolean) => {
    try {
      if (rawNativeModule && typeof rawNativeModule.clickScreenElement === 'function') {
        return await rawNativeModule.clickScreenElement(targetText, exactMatch ?? false);
      }
    } catch (e) {}
    return false;
  },

  clickScreenElementById: async (viewId: string) => {
    try {
      if (rawNativeModule && typeof rawNativeModule.clickScreenElementById === 'function') {
        return await rawNativeModule.clickScreenElementById(viewId);
      }
    } catch (e) {}
    return false;
  },

  typeTextIntoScreen: async (text: string, viewId?: string | null, targetText?: string | null) => {
    try {
      if (rawNativeModule && typeof rawNativeModule.typeTextIntoScreen === 'function') {
        return await rawNativeModule.typeTextIntoScreen(text, viewId || null, targetText || null);
      }
    } catch (e) {}
    return false;
  },

  tapScreenCoordinates: async (x: number, y: number) => {
    try {
      if (rawNativeModule && typeof rawNativeModule.tapScreenCoordinates === 'function') {
        return await rawNativeModule.tapScreenCoordinates(x, y);
      }
    } catch (e) {}
    return false;
  },

  scrollScreen: async (direction: string) => {
    try {
      if (rawNativeModule && typeof rawNativeModule.scrollScreen === 'function') {
        return await rawNativeModule.scrollScreen(direction);
      }
    } catch (e) {}
    return false;
  },

  performPhoneGlobalAction: async (actionName: string) => {
    try {
      if (rawNativeModule && typeof rawNativeModule.performPhoneGlobalAction === 'function') {
        return await rawNativeModule.performPhoneGlobalAction(actionName);
      }
    } catch (e) {}
    return false;
  },

  // Phase 4: On-Device Speech Recognition & Voice Assistant
  isSpeechRecognitionAvailable: async () => {
    try {
      if (rawNativeModule && typeof rawNativeModule.isSpeechRecognitionAvailable === 'function') {
        return await rawNativeModule.isSpeechRecognitionAvailable();
      }
    } catch (e) {}
    return false;
  },

  startSpeechRecognition: async () => {
    try {
      if (rawNativeModule && typeof rawNativeModule.startSpeechRecognition === 'function') {
        return await rawNativeModule.startSpeechRecognition();
      }
    } catch (e) {}
    return false;
  },

  stopSpeechRecognition: async () => {
    try {
      if (rawNativeModule && typeof rawNativeModule.stopSpeechRecognition === 'function') {
        return await rawNativeModule.stopSpeechRecognition();
      }
    } catch (e) {}
    return false;
  },

  cancelSpeechRecognition: async () => {
    try {
      if (rawNativeModule && typeof rawNativeModule.cancelSpeechRecognition === 'function') {
        return await rawNativeModule.cancelSpeechRecognition();
      }
    } catch (e) {}
    return false;
  },

  promptAndroidVoiceAssistant: async (): Promise<string> => {
    try {
      if (rawNativeModule && typeof rawNativeModule.promptAndroidVoiceAssistant === 'function') {
        return await rawNativeModule.promptAndroidVoiceAssistant();
      }
    } catch (e) {}
    return '';
  },

  startAudioCapture: async (): Promise<any> => {
    try {
      if (rawNativeModule && typeof rawNativeModule.startAudioCapture === 'function') {
        return await rawNativeModule.startAudioCapture();
      }
    } catch (e: any) {
      return JSON.stringify({ success: false, error: e.message });
    }
    return JSON.stringify({ success: false, error: 'Audio capture module not available' });
  },

  stopAudioCapture: async (): Promise<string> => {
    try {
      if (rawNativeModule && typeof rawNativeModule.stopAudioCapture === 'function') {
        return await rawNativeModule.stopAudioCapture();
      }
    } catch (e) {}
    return '';
  },

  getAudioCaptureAmplitude: async (): Promise<number> => {
    try {
      if (rawNativeModule && typeof rawNativeModule.getAudioCaptureAmplitude === 'function') {
        return await rawNativeModule.getAudioCaptureAmplitude();
      }
    } catch (e) {}
    return 0;
  },

  addSpeechListener: (
    event: 'onSpeechPartialResults' | 'onSpeechResults' | 'onSpeechError' | 'onSpeechEnd' | 'onSpeechRmsChanged',
    listener: (data: any) => void
  ): EventSubscription | null => {
    try {
      if (speechEventEmitter && typeof speechEventEmitter.addListener === 'function') {
        return speechEventEmitter.addListener(event, listener);
      }
      if (rawNativeModule && typeof rawNativeModule.addListener === 'function') {
        return rawNativeModule.addListener(event, listener);
      }
    } catch (e) {}
    return null;
  },
};

export default ArgusSystemMonitors;

