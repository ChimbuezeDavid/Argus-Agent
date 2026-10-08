// Hierarchical Android-style Settings for Argus Agent
// Categorized drill-down architecture:
// 1. 🔒 Security & Permissions (Biometrics, RPA Accessibility, Notification listener, Usage access)
// 2. 🧠 AI Engine & Models (Strictly Gemini 3.8 & 3.7, env API key, temperature, proactive rules)
// 3. 🔔 Notifications & Alerts (Push alerts, bank SMS intercepts, budget threshold warnings)
// 4. 🎨 Display & Theme (Dark/Light/System, text scaling, high-contrast)
// 5. 📳 Interaction & Feedback (Haptics, voice read-aloud, sound chimes, reduced motion)
// 6. 💱 Preferences & Currency (Default currency formatting)
// 7. 🛡️ Data & Privacy (CSV export, database verification, chat history reset)

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  PermissionsAndroid,
  AppState,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

import { useSettingsStore } from '@/store/settingsStore';
import { useHCITheme } from '@/hooks/useHCITheme';

// Modular Category Detail Views
import { SecuritySection } from '@/components/settings/SecuritySection';
import { AIEngineSection } from '@/components/settings/AIEngineSection';
import { NotificationsSection } from '@/components/settings/NotificationsSection';
import { DisplayThemeSection } from '@/components/settings/DisplayThemeSection';
import { InteractionFeedbackSection } from '@/components/settings/InteractionFeedbackSection';
import { CurrencySection } from '@/components/settings/CurrencySection';
import { PrivacySection } from '@/components/settings/PrivacySection';
import { OnboardingAccessModal } from '@/components/shared/OnboardingAccessModal';

type SettingsCategory =
  | 'security'
  | 'ai'
  | 'notifications'
  | 'display'
  | 'interaction'
  | 'currency'
  | 'data';

interface CategoryItem {
  id: SettingsCategory;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  badge?: string;
}

export default function SettingsModal() {
  const router = useRouter();
  const settings = useSettingsStore();
  const insets = useSafeAreaInsets();
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  const [activeCategory, setActiveCategory] = useState<SettingsCategory | null>(null);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);

  useEffect(() => {
    settings.loadSettings();

    // Check notification permission on Android 13+
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS as any).catch(() => {});
    }

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        settings.syncSystemPermissions();
      }
    });

    return () => sub.remove();
  }, []);

  // Handle native Android hardware back button
  useEffect(() => {
    const onBackPress = () => {
      if (activeCategory !== null) {
        triggerHaptic('light');
        setActiveCategory(null);
        return true; // Prevent default action (stay in settings)
      }
      return false; // Allow default action (exit settings)
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [activeCategory, triggerHaptic]);

  const CATEGORIES: CategoryItem[] = [
    {
      id: 'security',
      title: 'Security & Permissions',
      subtitle: 'RPA Accessibility, Notification listener, Usage access, App lock',
      icon: 'shield-checkmark',
      iconColor: '#10b981',
    },
    {
      id: 'ai',
      title: 'AI Engine & Models',
      subtitle: `${settings.geminiModel || 'gemini-3.8-flash'} • API key & model settings`,
      icon: 'hardware-chip',
      iconColor: '#8b5cf6',
      badge: '3.7 & 3.8',
    },
    {
      id: 'notifications',
      title: 'Notifications & Alerts',
      subtitle: 'Push notifications, bank alerts, budget threshold warnings',
      icon: 'notifications',
      iconColor: '#f59e0b',
    },
    {
      id: 'display',
      title: 'Display & Theme',
      subtitle: `Theme: ${settings.themeMode} • Scale: ${settings.textScale}`,
      icon: 'color-palette',
      iconColor: '#3b82f6',
    },
    {
      id: 'interaction',
      title: 'Interaction & Feedback',
      subtitle: 'Haptic vibration, voice read-aloud, sound effects, motion',
      icon: 'hand-left',
      iconColor: '#ec4899',
    },
    {
      id: 'currency',
      title: 'Currency',
      subtitle: `Primary currency: ${settings.currency || 'NGN'}`,
      icon: 'cash',
      iconColor: '#14b8a6',
    },
    {
      id: 'data',
      title: 'Data & Storage',
      subtitle: 'Export statement, verify database, purge data',
      icon: 'server',
      iconColor: '#6366f1',
    },
  ];

  const getActiveCategoryTitle = () => {
    const found = CATEGORIES.find((c) => c.id === activeCategory);
    return found ? found.title : 'Settings';
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top Header Bar */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: Math.max(insets.top, 14),
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
          onPress={() => {
            triggerHaptic('light');
            if (activeCategory !== null) {
              setActiveCategory(null);
            } else {
              router.back();
            }
          }}
          activeOpacity={0.7}
          accessibilityLabel={activeCategory !== null ? 'Back to settings list' : 'Close settings'}
        >
          <Ionicons
            name={activeCategory !== null ? 'arrow-back' : 'chevron-down'}
            size={20}
            color={colors.text}
          />
        </TouchableOpacity>

        <View style={styles.titleColumn}>
          <Text style={[styles.headerTitle, { color: colors.text, fontSize: scaleFont(17) }]}>
            {activeCategory !== null ? getActiveCategoryTitle() : 'Settings'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
            {activeCategory !== null ? 'Configure preferences' : 'Argus System Configuration'}
          </Text>
        </View>

        {activeCategory === null ? (
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: `${colors.primary}20`, borderColor: colors.primary }]}
            onPress={() => {
              triggerHaptic('success');
              router.back();
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.doneBtnText, { color: colors.primary, fontSize: scaleFont(12) }]}>Done</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Body Content */}
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: Math.max(insets.bottom, 40) + 16 },
        ]}
      >
        {activeCategory === null ? (
          <>
            {/* Android-Style Category Master List */}
            <View style={[styles.categoryListCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {CATEGORIES.map((cat, idx) => (
              <React.Fragment key={cat.id}>
                <TouchableOpacity
                  style={styles.categoryRow}
                  onPress={() => {
                    triggerHaptic('selection');
                    setActiveCategory(cat.id);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconBox, { backgroundColor: `${cat.iconColor}18` }]}>
                    <Ionicons name={cat.icon} size={20} color={cat.iconColor} />
                  </View>

                  <View style={styles.categoryInfo}>
                    <View style={styles.categoryTitleRow}>
                      <Text style={[styles.categoryTitle, { color: colors.text, fontSize: scaleFont(14) }]}>
                        {cat.title}
                      </Text>
                      {cat.badge && (
                        <View style={[styles.catBadge, { backgroundColor: `${cat.iconColor}20` }]}>
                          <Text style={[styles.catBadgeText, { color: cat.iconColor, fontSize: scaleFont(10) }]}>
                            {cat.badge}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[styles.categorySubtitle, { color: colors.textMuted, fontSize: scaleFont(11) }]}
                      numberOfLines={1}
                    >
                      {cat.subtitle}
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>

                {idx < CATEGORIES.length - 1 && (
                  <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
                )}
              </React.Fragment>
            ))}
          </View>

          {/* Version Footer */}
          <View style={styles.footerWrap}>
            <Text style={[styles.footerText, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
              Argus Agent v2.0.0 • On-Device Neural Executive
            </Text>
          </View>
        </>
        ) : (
          /* Hierarchical Detailed Category Sub-Page */
          <View style={styles.detailWrapper}>
            {activeCategory === 'security' && <SecuritySection settings={settings} />}
            {activeCategory === 'ai' && <AIEngineSection settings={settings} />}
            {activeCategory === 'notifications' && <NotificationsSection settings={settings} />}
            {activeCategory === 'display' && <DisplayThemeSection settings={settings} />}
            {activeCategory === 'interaction' && <InteractionFeedbackSection settings={settings} />}
            {activeCategory === 'currency' && <CurrencySection settings={settings} />}
            {activeCategory === 'data' && <PrivacySection settings={settings} />}
          </View>
        )}
      </ScrollView>

      {/* Onboarding Access & Permissions Checklist Modal */}
      <OnboardingAccessModal
        visible={showPermissionsModal}
        onComplete={() => setShowPermissionsModal(false)}
        canDismiss={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleColumn: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontWeight: '800',
  },
  headerSubtitle: {
    marginTop: 1,
  },
  doneBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  doneBtnText: {
    fontWeight: '700',
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  categoryListCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  categoryInfo: {
    flex: 1,
    marginRight: 8,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryTitle: {
    fontWeight: '700',
  },
  catBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  catBadgeText: {
    fontWeight: '700',
  },
  categorySubtitle: {
    marginTop: 3,
  },
  rowDivider: {
    height: 1,
    marginLeft: 72,
  },
  detailWrapper: {
    gap: 14,
  },
  footerWrap: {
    marginTop: 24,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  permissionsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 16,
  },
  bannerIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bannerTitle: {
    fontWeight: '800',
  },
  bannerBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bannerSubtitle: {
    marginTop: 2,
    lineHeight: 15,
  },
});
