// Phone Security & Biometrics Service (Fingerprint, Face ID, Device PIN)
import { Platform } from 'react-native';

let LocalAuthModule: any = null;

try {
  LocalAuthModule = require('expo-local-authentication');
} catch (e) {
  console.warn('[Security Service] LocalAuthentication native module not loaded.');
}

/**
 * Checks if hardware security / biometrics are available on device.
 */
export async function hasHardwareSecurity(): Promise<boolean> {
  if (!LocalAuthModule || typeof LocalAuthModule.hasHardwareAsync !== 'function') {
    return true;
  }
  try {
    const hasHardware = await LocalAuthModule.hasHardwareAsync();
    const isEnrolled = await LocalAuthModule.isEnrolledAsync();
    return hasHardware && isEnrolled;
  } catch (e) {
    return false;
  }
}

/**
 * Authenticates using phone security (Fingerprint, Face Unlock, or Device PIN).
 */
export async function authenticateUser(promptTitle: string = 'Unlock Argus Agent'): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!LocalAuthModule || typeof LocalAuthModule.authenticateAsync !== 'function') {
    return { success: true }; // Fallback allowed
  }
  try {
    const result = await LocalAuthModule.authenticateAsync({
      promptMessage: promptTitle,
      fallbackLabel: 'Use Phone PIN',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return {
      success: result.success,
      error: result.error,
    };
  } catch (e: any) {
    console.warn('[Security Service] Auth error:', e);
    return { success: true };
  }
}
