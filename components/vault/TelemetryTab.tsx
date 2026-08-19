import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  RefreshControl,
  AppState,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import ArgusSystemMonitors from '@/modules/argus-system-monitors';
import { simulateBankNotificationTest } from '@/services/notifications/testNotification';

import { EmptyState } from '@/components/shared/EmptyState';
import { SectionCard } from '@/components/shared/SectionCard';
import { openAccessibilitySettings, isAccessibilityEnabled } from '@/services/rpa/accessibilityService';
import { useHCITheme } from '@/hooks/useHCITheme';

interface TelemetryTabProps {
  refreshSignal: number;
}

export default function TelemetryTab({ refreshSignal }: TelemetryTabProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();
  const [usageStats, setUsageStats] = useState<any[]>([]);
  const [hasUsagePerm, setHasUsagePerm] = useState(false);
  const [hasNotificationPerm, setHasNotificationPerm] = useState(false);
  const [hasAccessibilityPerm, setHasAccessibilityPerm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isTestingNotif, setIsTestingNotif] = useState(false);

  const fetchTelemetry = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        const [uPerm, nPerm, aPerm] = await Promise.all([
          ArgusSystemMonitors?.hasUsageStatsPermission?.(),
          ArgusSystemMonitors?.hasNotificationListenerPermission?.(),
          isAccessibilityEnabled(),
        ]);
        setHasUsagePerm(!!uPerm);
        setHasNotificationPerm(!!nPerm);
        setHasAccessibilityPerm(!!aPerm);

        if (uPerm) {
          const now = Date.now();
          const stats = await ArgusSystemMonitors.getAppUsageStats(now - 86400000, now);
          if (Array.isArray(stats)) {
            setUsageStats(stats.filter((s: any) => s.totalTimeVisible > 60000));
          }
        }
      }
    } catch (e) {
      console.error('Error fetching telemetry:', e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchTelemetry();
    }, [fetchTelemetry])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        fetchTelemetry();
      }
    });
    return () => sub.remove();
  }, [fetchTelemetry]);

  useEffect(() => {
    if (refreshSignal > 0) {
      fetchTelemetry();
    }
  }, [refreshSignal, fetchTelemetry]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTelemetry();
  };

  const handleTestNotification = async () => {
    triggerHaptic('medium');
    setIsTestingNotif(true);
    try {
      const res = await simulateBankNotificationTest();
      if (res.success) {
        triggerHaptic('success');
        Alert.alert(
          '🔔 Interceptor Test Success',
          res.message + '\n\nCheck the Expenses tab to view the unconfirmed bank transaction.'
        );
      } else {
        Alert.alert('Test Result', res.message);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed test simulation');
    } finally {
      setIsTestingNotif(false);
    }
  };

  const formatMs = (ms: number) => {
    const totalMins = Math.floor(ms / (1000 * 60));
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  const totalScreenTimeMs = useMemo(() => {
    return usageStats.reduce((acc, curr) => acc + (curr.totalTimeVisible || 0), 0);
  }, [usageStats]);

  const sortedUsageStats = useMemo(() => {
    if (!Array.isArray(usageStats)) return [];
    return [...usageStats]
      .filter((s) => s && typeof s.totalTimeVisible === 'number')
      .sort((a, b) => (b.totalTimeVisible || 0) - (a.totalTimeVisible || 0));
  }, [usageStats]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <SectionCard
        title="Observer & RPA Permissions"
        icon="shield-checkmark"
        style={{ marginBottom: 14 }}
      >
        <Text style={[styles.telemetrySubtitle, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
          Argus operates strictly on-device. Accessibility RPA grants Argus the power to tap buttons, navigate apps, and execute tasks on your behalf.
        </Text>

        <View style={styles.permRow}>
          <Text style={[styles.permLabel, { color: colors.text, fontSize: scaleFont(12) }]}>
            Accessibility RPA Controller
          </Text>
          <View style={[styles.permBadge, hasAccessibilityPerm ? styles.permBadgeOn : styles.permBadgeOff]}>
            <Text style={[styles.permBadgeText, hasAccessibilityPerm ? styles.permBadgeTextOn : styles.permBadgeTextOff]}>
              {hasAccessibilityPerm ? 'Active' : 'Disabled'}
            </Text>
          </View>
        </View>

        <View style={[styles.permRow, { marginTop: 8 }]}>
          <Text style={[styles.permLabel, { color: colors.text, fontSize: scaleFont(12) }]}>
            Usage Stats Access
          </Text>
          <View style={[styles.permBadge, hasUsagePerm ? styles.permBadgeOn : styles.permBadgeOff]}>
            <Text style={[styles.permBadgeText, hasUsagePerm ? styles.permBadgeTextOn : styles.permBadgeTextOff]}>
              {hasUsagePerm ? 'Granted' : 'Missing'}
            </Text>
          </View>
        </View>

        <View style={[styles.permRow, { marginTop: 8 }]}>
          <Text style={[styles.permLabel, { color: colors.text, fontSize: scaleFont(12) }]}>
            Notification Listener
          </Text>
          <View style={[styles.permBadge, hasNotificationPerm ? styles.permBadgeOn : styles.permBadgeOff]}>
            <Text style={[styles.permBadgeText, hasNotificationPerm ? styles.permBadgeTextOn : styles.permBadgeTextOff]}>
              {hasNotificationPerm ? 'Active' : 'Disabled'}
            </Text>
          </View>
        </View>

        {Platform.OS === 'android' && (
          <View style={{ marginTop: 12, gap: 8 }}>
            {!hasAccessibilityPerm && (
              <TouchableOpacity
                style={[styles.openSettingsBtn, { backgroundColor: '#064e3b', borderColor: '#059669' }]}
                onPress={() => {
                  triggerHaptic('selection');
                  openAccessibilitySettings();
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="finger-print-outline" size={15} color="#34d399" style={{ marginRight: 6 }} />
                <Text style={[styles.openSettingsBtnText, { color: '#34d399', fontWeight: '800' }]}>
                  Enable Argus RPA Accessibility Service
                </Text>
              </TouchableOpacity>
            )}

            {!hasNotificationPerm && (
              <TouchableOpacity
                style={[styles.openSettingsBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => {
                  triggerHaptic('selection');
                  ArgusSystemMonitors.openNotificationListenerSettings();
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="notifications-outline" size={15} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.openSettingsBtnText, { color: colors.primary }]}>
                  Grant Notification Listener Access
                </Text>
              </TouchableOpacity>
            )}

            {!hasUsagePerm && (
              <TouchableOpacity
                style={[styles.openSettingsBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => {
                  triggerHaptic('selection');
                  ArgusSystemMonitors.openUsageAccessSettings();
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="hardware-chip-outline" size={15} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.openSettingsBtnText, { color: colors.primary }]}>
                  Grant Usage Access
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.openSettingsBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => {
                triggerHaptic('selection');
                ArgusSystemMonitors.openAppNotificationSettings();
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="settings-outline" size={15} color={colors.textSecondary} style={{ marginRight: 6 }} />
              <Text style={[styles.openSettingsBtnText, { color: colors.textSecondary }]}>
                App Push Notification Settings
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.openSettingsBtn, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}
              onPress={handleTestNotification}
              disabled={isTestingNotif}
              activeOpacity={0.8}
            >
              <Ionicons name="flash-outline" size={15} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.openSettingsBtnText, { color: colors.primary, fontWeight: '700' }]}>
                {isTestingNotif ? 'Simulating Interception...' : '⚡ Test Notification Interceptor'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </SectionCard>

      <View style={[styles.screenTimeHero, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.heroLabel, { color: colors.textMuted, fontSize: scaleFont(10) }]}>
          TODAY'S FOREGROUND USAGE
        </Text>
        <Text style={[styles.heroValue, { color: colors.primary, fontSize: scaleFont(28) }]}>
          {formatMs(totalScreenTimeMs)}
        </Text>
        <Text style={[styles.heroDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
          Aggregated across {usageStats.length} active apps in past 24 hours
        </Text>
      </View>

      <Text style={[styles.sectionHeaderTitle, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
        TOP APPLICATIONS TODAY
      </Text>
      {sortedUsageStats.length === 0 ? (
        <EmptyState
          icon="phone-portrait-outline"
          title="No App Usage Data"
          subtitle="Grant Usage Access permission to allow Argus to summarize screen time telemetry."
        />
      ) : (
        sortedUsageStats.map((stat, idx) => {
          const rawPkg = String(stat?.packageName || `app_${idx}`);
          const pkgClean = rawPkg.includes('.') ? (rawPkg.split('.').pop() || rawPkg) : rawPkg;
          const timeMs = Number(stat?.totalTimeVisible) || 0;
          const percent = totalScreenTimeMs > 0 ? (timeMs / totalScreenTimeMs) * 100 : 0;
          return (
            <View
              key={`usage_${rawPkg}_${idx}`}
              style={[styles.appUsageRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.appUsageInfo}>
                <Text style={[styles.appName, { color: colors.text, fontSize: scaleFont(13) }]}>
                  {pkgClean}
                </Text>
                <Text style={[styles.appPkg, { color: colors.textMuted, fontSize: scaleFont(10) }]} numberOfLines={1}>
                  {rawPkg}
                </Text>
              </View>
              <View style={styles.appUsageMetric}>
                <Text style={[styles.appTimeText, { color: colors.primary, fontSize: scaleFont(12) }]}>
                  {formatMs(timeMs)}
                </Text>
                <Text style={[styles.appPercentText, { color: colors.textMuted, fontSize: scaleFont(10) }]}>
                  {percent.toFixed(0)}%
                </Text>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  telemetrySubtitle: {
    lineHeight: 16,
    marginBottom: 12,
  },
  permRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  permLabel: {
    fontWeight: '600',
  },
  permBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  permBadgeOn: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
  },
  permBadgeOff: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  permBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  permBadgeTextOn: {
    color: '#34d399',
  },
  permBadgeTextOff: {
    color: '#f87171',
  },
  openSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  openSettingsBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  screenTimeHero: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  heroLabel: {
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroValue: {
    fontWeight: '900',
    marginBottom: 4,
  },
  heroDesc: {},
  sectionHeaderTitle: {
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  appUsageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  appUsageInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  appName: {
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  appPkg: {
    marginTop: 2,
  },
  appUsageMetric: {
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
  },
  appTimeText: {
    fontWeight: '700',
  },
  appPercentText: {
    marginTop: 2,
  },
});
