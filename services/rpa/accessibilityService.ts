import { Platform, Linking } from 'react-native';
import ArgusSystemMonitors from '@/modules/argus-system-monitors';

export interface ScreenNode {
  text: string;
  contentDescription: string;
  viewId: string;
  className: string;
  packageName: string;
  isClickable: boolean;
  isEditable: boolean;
  isScrollable: boolean;
  isFocused: boolean;
  isEnabled: boolean;
  bounds?: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    centerX: number;
    centerY: number;
  };
}

export interface ScreenHierarchyReport {
  packageName: string;
  interactiveElementsCount: number;
  nodes: ScreenNode[];
}

/**
 * Checks if the Argus Accessibility RPA Service is currently enabled and active in Android Settings.
 */
export async function isAccessibilityEnabled(): Promise<boolean> {
  if (Platform.OS !== 'android' || !ArgusSystemMonitors) return false;
  try {
    return await ArgusSystemMonitors.hasAccessibilityPermission();
  } catch (e) {
    console.warn('[RPA] Failed to check accessibility status:', e);
    return false;
  }
}

/**
 * Opens Android Accessibility Settings so the user can toggle on the Argus Autonomous Service.
 */
export async function openAccessibilitySettings(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    if (ArgusSystemMonitors && typeof ArgusSystemMonitors.openAccessibilitySettings === 'function') {
      const res = await ArgusSystemMonitors.openAccessibilitySettings();
      if (res) return true;
    }
  } catch (e) {}

  try {
    await Linking.sendIntent('android.settings.ACCESSIBILITY_SETTINGS');
    return true;
  } catch (e) {
    try {
      await Linking.openSettings();
      return true;
    } catch (err) {
      console.warn('[RPA] Failed to open accessibility settings:', err);
      return false;
    }
  }
}

/**
 * Inspects all visible UI elements, buttons, and text fields on the current active foreground screen.
 */
export async function inspectScreen(): Promise<ScreenHierarchyReport> {
  if (Platform.OS !== 'android' || !ArgusSystemMonitors) {
    return { packageName: 'unknown', interactiveElementsCount: 0, nodes: [] };
  }

  try {
    const rawNodes = await ArgusSystemMonitors.inspectScreenNodes();
    const nodes: ScreenNode[] = Array.isArray(rawNodes) ? rawNodes : [];
    const activePkg = nodes.length > 0 ? nodes[0].packageName : 'unknown';
    const interactiveCount = nodes.filter((n) => n.isClickable || n.isEditable).length;

    return {
      packageName: activePkg,
      interactiveElementsCount: interactiveCount,
      nodes,
    };
  } catch (e) {
    console.error('[RPA] Failed to inspect screen nodes:', e);
    return { packageName: 'error', interactiveElementsCount: 0, nodes: [] };
  }
}

/**
 * Finds and clicks a button or element matching the given text or description on screen.
 */
export async function clickElement(targetText: string, exactMatch: boolean = false): Promise<boolean> {
  if (Platform.OS !== 'android' || !ArgusSystemMonitors) return false;
  try {
    return await ArgusSystemMonitors.clickScreenElement(targetText, exactMatch);
  } catch (e) {
    console.error(`[RPA] Failed to click element "${targetText}":`, e);
    return false;
  }
}

/**
 * Clicks a view by its resource ID (e.g. "com.whatsapp:id/send").
 */
export async function clickElementById(viewId: string): Promise<boolean> {
  if (Platform.OS !== 'android' || !ArgusSystemMonitors) return false;
  try {
    return await ArgusSystemMonitors.clickScreenElementById(viewId);
  } catch (e) {
    console.error(`[RPA] Failed to click view ID "${viewId}":`, e);
    return false;
  }
}

/**
 * Types text into an editable input field on the foreground screen.
 */
export async function typeText(text: string, options?: { viewId?: string; targetText?: string }): Promise<boolean> {
  if (Platform.OS !== 'android' || !ArgusSystemMonitors) return false;
  try {
    return await ArgusSystemMonitors.typeTextIntoScreen(
      text,
      options?.viewId || null,
      options?.targetText || null
    );
  } catch (e) {
    console.error('[RPA] Failed to type text into screen:', e);
    return false;
  }
}

/**
 * Injects a tap at exact screen coordinates (x, y).
 */
export async function tapCoordinates(x: number, y: number): Promise<boolean> {
  if (Platform.OS !== 'android' || !ArgusSystemMonitors) return false;
  try {
    return await ArgusSystemMonitors.tapScreenCoordinates(x, y);
  } catch (e) {
    console.error(`[RPA] Failed to tap coordinates (${x}, ${y}):`, e);
    return false;
  }
}

/**
 * Scrolls the current foreground screen UP or DOWN.
 */
export async function scrollScreen(direction: 'UP' | 'DOWN' = 'DOWN'): Promise<boolean> {
  if (Platform.OS !== 'android' || !ArgusSystemMonitors) return false;
  try {
    return await ArgusSystemMonitors.scrollScreen(direction);
  } catch (e) {
    console.error(`[RPA] Failed to scroll screen ${direction}:`, e);
    return false;
  }
}

/**
 * Performs a global phone action (HOME, BACK, RECENTS, NOTIFICATIONS, QUICK_SETTINGS, LOCK_SCREEN).
 */
export async function performGlobalPhoneAction(
  action: 'HOME' | 'BACK' | 'RECENTS' | 'NOTIFICATIONS' | 'QUICK_SETTINGS' | 'LOCK_SCREEN'
): Promise<boolean> {
  if (Platform.OS !== 'android' || !ArgusSystemMonitors) return false;
  try {
    return await ArgusSystemMonitors.performPhoneGlobalAction(action);
  } catch (e) {
    console.error(`[RPA] Failed to perform global action "${action}":`, e);
    return false;
  }
}
