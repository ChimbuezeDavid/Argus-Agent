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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import ArgusSystemMonitors from '@/modules/argus-system-monitors';

import { EmptyState } from '@/components/shared/EmptyState';
import { useHCITheme } from '@/hooks/useHCITheme';

interface TelemetryTabProps {
  refreshSignal: number;
}

export default function TelemetryTab({ refreshSignal }: TelemetryTabProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();
  const [usageStats, setUsageStats] = useState<any[]>([]);
  const [hasUsagePerm, setHasUsagePerm] = useState(false);
  const [showAppBreakdown, setShowAppBreakdown] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTelemetry = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        const uPerm = await ArgusSystemMonitors?.hasUsageStatsPermission?.();
        setHasUsagePerm(!!uPerm);

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
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* 1. Hero Total Screen Time Card */}
      <View style={[styles.screenTimeHero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.heroHeaderRow}>
          <Ionicons name="time-outline" size={18} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.heroLabel, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
            TOTAL SCREEN TIME TODAY
          </Text>
        </View>

        <Text style={[styles.heroValue, { color: colors.primary, fontSize: scaleFont(36) }]}>
          {hasUsagePerm ? formatMs(totalScreenTimeMs) : '--'}
        </Text>

        <Text style={[styles.heroDesc, { color: colors.textMuted, fontSize: scaleFont(12) }]}>
          {hasUsagePerm
            ? `Tracked across ${usageStats.length} applications in the last 24h`
            : 'Usage access required to aggregate on-device screen time'}
        </Text>

        {!hasUsagePerm && Platform.OS === 'android' && (
          <TouchableOpacity
            style={[styles.grantPermBtn, { backgroundColor: colors.primary, marginTop: 14 }]}
            onPress={() => {
              triggerHaptic('selection');
              ArgusSystemMonitors.openUsageAccessSettings();
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="shield-checkmark-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={[styles.grantPermBtnText, { fontSize: scaleFont(12) }]}>
              Grant Usage Access in Settings
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 2. Dropdown Trigger for App Usage Breakdown */}
      <TouchableOpacity
        style={[styles.dropdownTrigger, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => {
          triggerHaptic('selection');
          setShowAppBreakdown((prev) => !prev);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.dropdownLeft}>
          <Ionicons
            name="apps-outline"
            size={18}
            color={showAppBreakdown ? colors.primary : colors.textSecondary}
            style={{ marginRight: 8 }}
          />
          <Text style={[styles.dropdownTitle, { color: colors.text, fontSize: scaleFont(13) }]}>
            Application Breakdown
          </Text>
          {sortedUsageStats.length > 0 && (
            <View style={[styles.appCountBadge, { backgroundColor: colors.primaryBg }]}>
              <Text style={[styles.appCountBadgeText, { color: colors.primary, fontSize: scaleFont(10) }]}>
                {sortedUsageStats.length} apps
              </Text>
            </View>
          )}
        </View>

        <Ionicons
          name={showAppBreakdown ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textSecondary}
        />
      </TouchableOpacity>

      {/* 3. Collapsible App List */}
      {showAppBreakdown && (
        <View style={styles.appListContainer}>
          {sortedUsageStats.length === 0 ? (
            <EmptyState
              icon="phone-portrait-outline"
              title="No App Usage Data"
              subtitle="Usage access is missing or no foreground apps recorded yet."
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
                  style={[styles.appUsageRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
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
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenTimeHero: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  heroLabel: {
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  heroValue: {
    fontWeight: '900',
    marginVertical: 4,
    letterSpacing: -0.5,
  },
  heroDesc: {
    textAlign: 'center',
  },
  grantPermBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  grantPermBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownTitle: {
    fontWeight: '700',
  },
  appCountBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  appCountBadgeText: {
    fontWeight: '700',
  },
  appListContainer: {
    marginTop: 10,
    gap: 8,
  },
  appUsageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  appUsageInfo: {
    flex: 1,
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
  },
  appTimeText: {
    fontWeight: '700',
  },
  appPercentText: {
    marginTop: 2,
  },
});
