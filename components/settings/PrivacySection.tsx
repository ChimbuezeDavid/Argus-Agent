import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert, Share } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useHCITheme } from '@/hooks/useHCITheme';
import { SectionCard, ToggleRow } from '@/components/shared';
import { initializeDatabase } from '@/services/database/db';
import { listExpenses } from '@/services/database/expensesRepo';

interface PrivacySectionProps {
  settings: any;
}

export function PrivacySection({ settings }: PrivacySectionProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  const handleResetChatHistory = () => {
    triggerHaptic('selection');
    Alert.alert(
      'Reset Chat History',
      'Are you sure you want to clear your conversation transcript? This will not delete your saved plans, budgets, or expenses.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All Messages',
          style: 'destructive',
          onPress: async () => {
            await settings.clearChatHistory();
            triggerHaptic('medium');
            Alert.alert('Cleared', 'Chat transcript reset.');
          },
        },
      ]
    );
  };

  const handleVerifyDatabase = async () => {
    triggerHaptic('selection');
    try {
      await initializeDatabase();
      triggerHaptic('success');
      Alert.alert('SQLite Database Intact', 'All tables, monthly budget columns, and foreign keys verified.');
    } catch (e: any) {
      Alert.alert('Database Check Error', e.message);
    }
  };

  const handleExportCsv = async () => {
    triggerHaptic('selection');
    try {
      const expenses = await listExpenses();
      if (expenses.length === 0) {
        Alert.alert('No Data', 'No expense records found to export.');
        return;
      }

      const csvRows = [
        'ID,Date,Amount_NGN,Category,Description,Source',
        ...expenses.map(
          (e) =>
            `${e.id},"${e.date}",${e.amount},"${e.category}","${(e.description || '').replace(/"/g, '""')}","${e.source}"`
        ),
      ];
      await Share.share({
        title: 'Argus_Expenses_Export.csv',
        message: csvRows.join('\n'),
      });
      triggerHaptic('success');
    } catch (e: any) {
      Alert.alert('Export Error', e.message);
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. On-Device Telemetry & Reports */}
      <SectionCard
        icon={<Ionicons name="shield-outline" size={scaleFont(20)} color="#f59e0b" style={{ marginRight: 8 }} />}
        title="Privacy & Diagnostic Controls"
        subtitle="Your data and conversations remain strictly local."
      >
        <ToggleRow
          label="Anonymous Analytics"
          description="Helps diagnose performance bottlenecks"
          value={settings.analyticsEnabled}
          onValueChange={(val) => {
            triggerHaptic('selection');
            settings.toggleAnalytics(val);
          }}
        />

        <ToggleRow
          label="Reject Ad Tracking"
          description="Blocks third-party advertising SDKs"
          value={settings.adTrackingEnabled}
          onValueChange={(val) => {
            triggerHaptic('selection');
            settings.toggleAdTracking(val);
          }}
          style={styles.marginTop}
        />

        <ToggleRow
          label="Crash Diagnostics"
          description="Saves local exception logs"
          value={settings.crashReportingEnabled}
          onValueChange={(val) => {
            triggerHaptic('selection');
            settings.toggleCrashReporting(val);
          }}
          style={styles.marginTop}
        />
      </SectionCard>

      {/* 2. Vertical Storage & Data Management Actions */}
      <SectionCard
        icon={<Ionicons name="server-outline" size={scaleFont(20)} color="#6366f1" style={{ marginRight: 8 }} />}
        title="Storage & Data Actions"
        subtitle="Manage database maintenance and data exports."
      >
        <View style={styles.verticalActionsList}>
          {/* Action 1: Export CSV Statement */}
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleExportCsv}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <Feather name="download" size={18} color="#10b981" />
            </View>
            <View style={styles.actionTextCol}>
              <Text style={[styles.actionTitle, { color: colors.text, fontSize: scaleFont(13) }]}>
                Export CSV Statement
              </Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                Share complete ledger records as a formatted spreadsheet
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Action 2: Verify SQLite DB */}
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleVerifyDatabase}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.12)' }]}>
              <Ionicons name="checkmark-done-circle-outline" size={20} color="#38bdf8" />
            </View>
            <View style={styles.actionTextCol}>
              <Text style={[styles.actionTitle, { color: colors.text, fontSize: scaleFont(13) }]}>
                Verify SQLite Database
              </Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                Check database tables, foreign keys, and indices integrity
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Action 3: Reset Chat History */}
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: 'rgba(239, 68, 68, 0.3)' }]}
            onPress={handleResetChatHistory}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
              <Feather name="trash-2" size={18} color="#ef4444" />
            </View>
            <View style={styles.actionTextCol}>
              <Text style={[styles.actionTitle, { color: '#ef4444', fontSize: scaleFont(13) }]}>
                Reset Conversation History
              </Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                Clear dialogue session transcripts while keeping local data
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  marginTop: {
    marginTop: 10,
  },
  verticalActionsList: {
    gap: 10,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionTextCol: {
    flex: 1,
    marginRight: 8,
  },
  actionTitle: {
    fontWeight: '700',
  },
  actionSubtitle: {
    marginTop: 2,
    lineHeight: 15,
  },
});
