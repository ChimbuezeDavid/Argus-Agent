import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState, useRef } from 'react';
import { LogBox, AppState, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { useSettingsStore } from '@/store/settingsStore';
import { initializeDatabase } from '@/services/database/db';
import { authenticateWithBiometrics } from '@/services/security/authGateService';
import { WelcomeSplashScreen } from '@/components/shared/WelcomeSplashScreen';
import { OnboardingAccessModal } from '@/components/shared/OnboardingAccessModal';
import { HabitStackTakeoverModal, HabitTakeoverData } from '@/components/shared/HabitStackTakeoverModal';
import { subscribeHabitTrigger, HabitTakeoverPayload } from '@/services/observation/geofenceService';
import { useHCITheme } from '@/hooks/useHCITheme';

// Suppress dev-only LogBox dialog crashes during fast-refresh window detachment
LogBox.ignoreLogs([
  'View=DecorView',
  'not attached to window manager',
  'Cannot find native module',
]);

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const { colors, scaleFont } = useHCITheme();
  const appLockEnabled = useSettingsStore((s) => s.appLockEnabled);
  const appLockTimeout = useSettingsStore((s) => s.appLockTimeout);
  const hasCompletedOnboarding = useSettingsStore((s) => s.hasCompletedOnboarding);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [habitTakeoverData, setHabitTakeoverData] = useState<HabitTakeoverPayload | null>(null);
  const appState = useRef(AppState.currentState);
  const lastBackgroundTime = useRef<number>(Date.now());

  useEffect(() => {
    const unsub = subscribeHabitTrigger((payload) => {
      setHabitTakeoverData(payload);
    });
    return unsub;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await initializeDatabase();
        await loadSettings();
      } catch (err) {
        console.warn('App startup DB/settings init warning:', err);
      }
    })();
  }, [loadSettings]);

  // Trigger onboarding or biometric unlock after welcome splash completes
  const handleSplashFinish = async () => {
    setShowSplash(false);
    if (!hasCompletedOnboarding) {
      setShowOnboarding(true);
    } else if (appLockEnabled) {
      setIsLocked(true);
      const res = await authenticateWithBiometrics('Unlock Argus Agent');
      if (res.success) {
        setIsLocked(false);
      }
    } else {
      setIsLocked(false);
    }
  };

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    if (appLockEnabled) {
      setIsLocked(true);
      const res = await authenticateWithBiometrics('Unlock Argus Agent');
      if (res.success) {
        setIsLocked(false);
      }
    }
  };

  // Re-lock with configurable Timeout when app moves to background and returns to active
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        lastBackgroundTime.current = Date.now();
      }

      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        appLockEnabled &&
        !showSplash
      ) {
        const elapsedSeconds = Math.floor((Date.now() - lastBackgroundTime.current) / 1000);
        // If elapsed time is greater than or equal to timeout, lock and prompt
        if (appLockTimeout === 0 || elapsedSeconds >= appLockTimeout) {
          setIsLocked(true);
          const res = await authenticateWithBiometrics('Unlock Argus Agent');
          if (res.success) {
            setIsLocked(false);
          }
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [appLockEnabled, appLockTimeout, showSplash]);

  const handleManualUnlock = async () => {
    const res = await authenticateWithBiometrics('Unlock Argus Agent');
    if (res.success) {
      setIsLocked(false);
    }
  };

  // Immediately dismiss native Android splash screen on layout mount so WelcomeSplashScreen takes over
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <>
      <RootLayoutNav />

      {/* 1. Welcome Splash Screen (renders over navigation until finished) */}
      {showSplash && (
        <WelcomeSplashScreen onFinish={handleSplashFinish} />
      )}

      {/* 2. Onboarding Access Modal */}
      {showOnboarding && (
        <OnboardingAccessModal visible={showOnboarding} onComplete={handleOnboardingComplete} />
      )}

      {/* 3. Biometric App Lock Shield (renders over navigation when locked) */}
      {!showSplash && !showOnboarding && isLocked && (
        <View style={[StyleSheet.absoluteFill, styles.lockContainer, { backgroundColor: colors.background, zIndex: 9999 }]}>
          <View
            style={[
              styles.lockShieldCircle,
              {
                backgroundColor: colors.primaryBg,
                borderColor: colors.primary,
              },
            ]}
          >
            <Ionicons name="shield-checkmark" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.lockTitle, { color: colors.text, fontSize: scaleFont(22) }]}>
            Argus Agent Protected
          </Text>
          <Text style={[styles.lockSubtitle, { color: colors.textSecondary, fontSize: scaleFont(13) }]}>
            Fingerprint or Device Biometric authorization is required to access your autonomous agent.
          </Text>
          <TouchableOpacity
            style={[styles.unlockBtn, { backgroundColor: colors.primary }]}
            onPress={handleManualUnlock}
            activeOpacity={0.8}
          >
            <Ionicons name="finger-print" size={20} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={[styles.unlockBtnText, { fontSize: scaleFont(14) }]}>Unlock with Biometrics</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 4. Full-Screen Habit Stacking Takeover Overlay */}
      <HabitStackTakeoverModal
        visible={!!habitTakeoverData}
        data={habitTakeoverData}
        onClose={() => setHabitTakeoverData(null)}
      />
    </>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  lockContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  lockShieldCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
  },
  lockTitle: {
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  lockSubtitle: {
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 28,
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  unlockBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
