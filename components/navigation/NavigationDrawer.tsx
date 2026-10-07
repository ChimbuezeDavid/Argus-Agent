import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHCITheme } from '@/hooks/useHCITheme';
import { useSettingsStore } from '@/store/settingsStore';

interface NavigationDrawerProps {
  visible: boolean;
  onClose: () => void;
  activeScreen?: 'argus' | 'finance' | 'vault';
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.8, 320);

export function NavigationDrawer({ visible, onClose, activeScreen = 'argus' }: NavigationDrawerProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, scaleFont, triggerHaptic } = useHCITheme();
  const settings = useSettingsStore();

  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleNavigate = (route: string) => {
    triggerHaptic('selection');
    onClose();
    setTimeout(() => {
      router.push(route as any);
    }, 150);
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Scrim / Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]} />
        </TouchableWithoutFeedback>

        {/* Drawer Content */}
        <Animated.View
          style={[
            styles.drawerContainer,
            {
              width: DRAWER_WIDTH,
              backgroundColor: colors.surface,
              paddingTop: Math.max(insets.top, 24),
              paddingBottom: Math.max(insets.bottom, 24),
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          {/* Header Card */}
          <View style={styles.header}>
            <View style={[styles.avatarBox, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}>
              <Ionicons name="sparkles" size={24} color={colors.primary} />
            </View>
            <View style={styles.headerTextCol}>
              <Text style={[styles.title, { color: colors.text, fontSize: scaleFont(16) }]}>
                Argus Agent
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                Autonomous Executive Assistant
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Navigation Items */}
          <View style={styles.navSection}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted, fontSize: scaleFont(10) }]}>
              PRIMARY SPACES
            </Text>

            {/* 1. Command Deck */}
            <TouchableOpacity
              style={[
                styles.navItem,
                activeScreen === 'argus' && { backgroundColor: `${colors.primary}18` },
              ]}
              onPress={() => handleNavigate('/(tabs)')}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.navIconBox,
                  { backgroundColor: activeScreen === 'argus' ? colors.primary : `${colors.textMuted}15` },
                ]}
              >
                <Ionicons
                  name="sparkles"
                  size={18}
                  color={activeScreen === 'argus' ? '#ffffff' : colors.textSecondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.navItemLabel,
                    {
                      color: activeScreen === 'argus' ? colors.primary : colors.text,
                      fontSize: scaleFont(13),
                      fontWeight: activeScreen === 'argus' ? '700' : '500',
                    },
                  ]}
                >
                  Command Deck
                </Text>
                <Text style={[styles.navItemDesc, { color: colors.textMuted, fontSize: scaleFont(10) }]}>
                  AI assistant & multimodal omnibar
                </Text>
              </View>
            </TouchableOpacity>

            {/* 2. Finance */}
            <TouchableOpacity
              style={[
                styles.navItem,
                activeScreen === 'finance' && { backgroundColor: `${colors.primary}18` },
              ]}
              onPress={() => handleNavigate('/(tabs)/expenses')}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.navIconBox,
                  { backgroundColor: activeScreen === 'finance' ? colors.primary : `${colors.textMuted}15` },
                ]}
              >
                <MaterialCommunityIcons
                  name="credit-card-outline"
                  size={18}
                  color={activeScreen === 'finance' ? '#ffffff' : colors.textSecondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.navItemLabel,
                    {
                      color: activeScreen === 'finance' ? colors.primary : colors.text,
                      fontSize: scaleFont(13),
                      fontWeight: activeScreen === 'finance' ? '700' : '500',
                    },
                  ]}
                >
                  Finance
                </Text>
                <Text style={[styles.navItemDesc, { color: colors.textMuted, fontSize: scaleFont(10) }]}>
                  Live ledger, budgets & bank SMS
                </Text>
              </View>
            </TouchableOpacity>

            {/* 3. Vault */}
            <TouchableOpacity
              style={[
                styles.navItem,
                activeScreen === 'vault' && { backgroundColor: `${colors.primary}18` },
              ]}
              onPress={() => handleNavigate('/(tabs)/vault')}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.navIconBox,
                  { backgroundColor: activeScreen === 'vault' ? colors.primary : `${colors.textMuted}15` },
                ]}
              >
                <Ionicons
                  name="folder-outline"
                  size={18}
                  color={activeScreen === 'vault' ? '#ffffff' : colors.textSecondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.navItemLabel,
                    {
                      color: activeScreen === 'vault' ? colors.primary : colors.text,
                      fontSize: scaleFont(13),
                      fontWeight: activeScreen === 'vault' ? '700' : '500',
                    },
                  ]}
                >
                  Vault
                </Text>
                <Text style={[styles.navItemDesc, { color: colors.textMuted, fontSize: scaleFont(10) }]}>
                  Plans, geofences & telemetry
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Preferences & System */}
          <View style={styles.navSection}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted, fontSize: scaleFont(10) }]}>
              SYSTEM & CONFIGURATION
            </Text>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => handleNavigate('/modal')}
              activeOpacity={0.7}
            >
              <View style={[styles.navIconBox, { backgroundColor: `${colors.textMuted}15` }]}>
                <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.navItemLabel, { color: colors.text, fontSize: scaleFont(13) }]}>
                  Settings
                </Text>
                <Text style={[styles.navItemDesc, { color: colors.textMuted, fontSize: scaleFont(10) }]}>
                  Appearance, rules & security
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Footer Branding */}
          <View style={styles.footer}>
            <View style={[styles.footerBadge, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
              <Text style={[styles.footerText, { color: colors.textSecondary, fontSize: scaleFont(10) }]}>
                Argus v1.2.0 • On-Device Runtime
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  drawerContainer: {
    height: '100%',
    paddingHorizontal: 16,
    elevation: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
  },
  title: {
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontWeight: '500',
    marginTop: 2,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    alignSelf: 'flex-start',
    gap: 6,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  profileText: {
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  navSection: {
    gap: 4,
  },
  sectionLabel: {
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginLeft: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    gap: 12,
  },
  navIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navItemLabel: {
    letterSpacing: 0.1,
  },
  navItemDesc: {
    marginTop: 2,
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingTop: 16,
  },
  footerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  footerText: {
    fontWeight: '600',
  },
});
