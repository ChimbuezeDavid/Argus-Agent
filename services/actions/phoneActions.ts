// Action handlers for device actions like dialing and launching apps
import { Linking, Platform } from 'react-native';
import ArgusSystemMonitors from '@/modules/argus-system-monitors';

/**
 * Places a direct phone call.
 */
export async function placeCall(phoneNumber: string): Promise<{ success: boolean; message: string }> {
  try {
    const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
    const url = `tel:${cleanNumber}`;
    await Linking.openURL(url);
    return { success: true, message: `Initiated call to ${phoneNumber}` };
  } catch (error: any) {
    console.error('Failed to place call:', error);
    return { success: false, message: `Failed to place call: ${error.message}` };
  }
}

/**
 * Normalizes app aliases to full Android package names.
 */
export function resolvePackageAlias(name: string): string {
  if (!name || typeof name !== 'string') return 'com.whatsapp';
  const clean = name.toLowerCase().trim().replace(/['"]/g, '');
  const aliasMap: Record<string, string> = {
    'whatsapp': 'com.whatsapp',
    'whats app': 'com.whatsapp',
    'x': 'com.twitter.android',
    '𝕏': 'com.twitter.android',
    'twitter': 'com.twitter.android',
    'chrome': 'com.android.chrome',
    'google chrome': 'com.android.chrome',
    'youtube': 'com.google.android.youtube',
    'instagram': 'com.instagram.android',
    'facebook': 'com.facebook.katana',
    'spotify': 'com.spotify.music',
    'maps': 'com.google.android.apps.maps',
    'google maps': 'com.google.android.apps.maps',
    'gmail': 'com.google.android.gm',
    'vlc': 'org.videolan.vlc',
    'vlc player': 'org.videolan.vlc',
    'mx player': 'com.mxtech.videoplayer.ad',
    'mxplayer': 'com.mxtech.videoplayer.ad',
    'telegram': 'org.telegram.messenger',
    'audiomack': 'com.audiomack',
    'tiktok': 'com.zhiliaoapp.musically',
    'files': 'com.google.android.apps.nbu.files',
    'file manager': 'com.google.android.apps.nbu.files',
    'dialer': 'com.google.android.dialer',
    'phone': 'com.google.android.dialer',
  };
  return aliasMap[clean] || clean;
}

export const resolvePackageName = resolvePackageAlias;

/**
 * Launches an app by package name or alias directly using Android Intent URIs and native bridge.
 */
export async function openApp(packageName: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!packageName) {
      return { success: false, message: 'App name or package is required.' };
    }

    const pkg = resolvePackageName(packageName);
    console.log(`[Phone Actions] Launching app: "${packageName}" -> resolved to "${pkg}"`);

    // 1. Try native launch directly if Kotlin module has launchApp
    if (Platform.OS === 'android' && ArgusSystemMonitors && typeof ArgusSystemMonitors.launchApp === 'function') {
      try {
        const launched = await ArgusSystemMonitors.launchApp(pkg);
        if (launched) {
          return { success: true, message: `Successfully opened ${pkg}` };
        }
      } catch (nativeErr) {
        console.warn('Native launchApp exception, trying Intent URI fallback:', nativeErr);
      }
    }

    // 2. Android Direct Intent URI launcher (Launches installed app directly without Play Store)
    if (Platform.OS === 'android') {
      try {
        const intentUri = `intent:#Intent;package=${pkg};action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;end`;
        await Linking.openURL(intentUri);
        return { success: true, message: `Successfully launched ${pkg}` };
      } catch (intentErr) {
        console.warn('Direct intent launch failed, trying scheme fallback:', intentErr);
      }
    }

    // 3. Known app URI schemes fallback
    const appSchemes: Record<string, string[]> = {
      'com.whatsapp': ['whatsapp://', 'https://api.whatsapp.com/send'],
      'com.twitter.android': ['twitter://', 'https://twitter.com'],
      'com.android.chrome': ['googlechrome://', 'https://www.google.com'],
      'com.google.android.youtube': ['vnd.youtube://', 'youtube://', 'https://www.youtube.com'],
      'com.instagram.android': ['instagram://', 'https://instagram.com'],
      'com.facebook.katana': ['fb://', 'https://facebook.com'],
      'com.spotify.music': ['spotify://'],
      'com.google.android.apps.maps': ['geo:0,0', 'google.maps:q='],
      'com.google.android.gm': ['googlegmail://', 'mailto:'],
    };

    const candidateSchemes = appSchemes[pkg] || [];
    for (const scheme of candidateSchemes) {
      try {
        await Linking.openURL(scheme);
        return { success: true, message: `Opened app ${pkg} via ${scheme}` };
      } catch (e) {
        // try next scheme
      }
    }

    return { success: false, message: `Could not launch ${pkg}. Please verify ${pkg} is installed.` };
  } catch (error: any) {
    console.error('Failed to open app:', error);
    return { success: false, message: `Failed to open app: ${error.message}` };
  }
}
