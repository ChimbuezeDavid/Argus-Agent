import { useMemo, useCallback } from 'react';
import { useColorScheme as useRNColorScheme, Vibration, Platform } from 'react-native';
import * as Speech from 'expo-speech';
import Colors, { ColorPalette, DarkPalette, LightPalette, HighContrastDarkPalette, HighContrastLightPalette } from '@/constants/Colors';
import { useSettingsStore } from '@/store/settingsStore';

export type TextScaleLevel = 'small' | 'medium' | 'large' | 'xlarge';

export const FONT_SCALE_FACTORS: Record<TextScaleLevel, number> = {
  small: 0.88,
  medium: 1.0,
  large: 1.14,
  xlarge: 1.28,
};

export function useHCITheme() {
  const rnColorScheme = useRNColorScheme();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const textScale = useSettingsStore((s) => s.textScale);
  const highContrast = useSettingsStore((s) => s.highContrast);
  const hapticFeedbackEnabled = useSettingsStore((s) => s.hapticFeedbackEnabled);
  const soundEffectsEnabled = useSettingsStore((s) => s.soundEffectsEnabled);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);

  const effectiveScheme: 'light' | 'dark' = useMemo(() => {
    if (themeMode === 'system') {
      return rnColorScheme === 'light' ? 'light' : 'dark';
    }
    return themeMode === 'light' ? 'light' : 'dark';
  }, [themeMode, rnColorScheme]);

  const isDark = effectiveScheme === 'dark';

  const colors: ColorPalette = useMemo(() => {
    if (highContrast) {
      return isDark ? HighContrastDarkPalette : HighContrastLightPalette;
    }
    return isDark ? DarkPalette : LightPalette;
  }, [highContrast, isDark]);

  const fontMultiplier = FONT_SCALE_FACTORS[textScale] || 1.0;

  const scaleFont = useCallback(
    (baseSize: number): number => {
      return Math.round(baseSize * fontMultiplier);
    },
    [fontMultiplier]
  );

  const triggerHaptic = useCallback(
    (type: 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error' = 'light') => {
      if (!hapticFeedbackEnabled) return;
      try {
        if (Platform.OS === 'android' || Platform.OS === 'ios') {
          switch (type) {
            case 'selection':
              Vibration.vibrate(35);
              break;
            case 'light':
              Vibration.vibrate(30);
              break;
            case 'medium':
              Vibration.vibrate(60);
              break;
            case 'heavy':
              Vibration.vibrate(100);
              break;
            case 'success':
              Vibration.vibrate([0, 35, 65, 55]);
              break;
            case 'warning':
              Vibration.vibrate([0, 50, 80, 60]);
              break;
            case 'error':
              Vibration.vibrate([0, 70, 90, 110]);
              break;
            default:
              Vibration.vibrate(35);
          }
        }
      } catch {
        // Haptic fallback
      }
    },
    [hapticFeedbackEnabled]
  );

  const triggerChime = useCallback(
    (type: 'confirm' | 'alert' | 'complete' = 'confirm') => {
      if (!soundEffectsEnabled) return;
      try {
        // Safe micro-speech or audio chime
        if (Platform.OS !== 'web') {
          Speech.stop();
        }
      } catch {
        // Sound fallback
      }
    },
    [soundEffectsEnabled]
  );

  return {
    colors,
    isDark,
    themeMode,
    textScale,
    highContrast,
    fontMultiplier,
    scaleFont,
    hapticFeedbackEnabled,
    soundEffectsEnabled,
    reduceMotion,
    triggerHaptic,
    triggerChime,
  };
}
