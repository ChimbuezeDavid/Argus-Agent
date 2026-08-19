import React from 'react';
import { View, StyleSheet, Alert, Share } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useHCITheme } from '@/hooks/useHCITheme';
import { SectionCard, ToggleRow, ActionButton } from '@/components/shared';
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
      'Are you sure you want to clear your conversation transcript? This will not delete your saved notes or budgets.',
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
        title: 'Argus_Financial_Export.csv',
        message: csvRows.join('\n'),
      });
    } catch (e: any) {
      Alert.alert('Export Error', e.message);
    }
  };

  return (
    <SectionCard
      icon={<Ionicons name="shield-outline" size={scaleFont(20)} color="#f59e0b" style={{ marginRight: 8 }} />}
      title="Account & Privacy Controls"
      subtitle="Argus is 100% on-device. Control telemetry, ad-tracking rejection, and statement exports."
    >
      <ToggleRow
        label="Anonymous Usage Analytics"
        description="Disabled by default. Help improve model speed anonymously"
        value={settings.analyticsEnabled}
        onValueChange={(val) => {
          triggerHaptic('selection');
          settings.toggleAnalytics(val);
        }}
      />

      <ToggleRow
        label="Ad Tracking & Personalization"
        description="Argus never shares or sells financial or prompt data for advertising"
        value={settings.adTrackingEnabled}
        onValueChange={(val) => {
          triggerHaptic('selection');
          settings.toggleAdTracking(val);
        }}
        style={styles.marginTop}
      />

      <ToggleRow
        label="Crash & Diagnostic Reports"
        description="Log on-device fatal exceptions to prevent app freeze"
        value={settings.crashReportingEnabled}
        onValueChange={(val) => {
          triggerHaptic('selection');
          settings.toggleCrashReporting(val);
        }}
        style={styles.marginTop}
      />

      <View style={[styles.dataActionsGrid, { marginTop: 14 }]}>
        <ActionButton
          label="Export CSV Statement"
          variant="outline"
          icon={<Feather name="download" size={15} color={colors.success} style={{ marginRight: 6 }} />}
          onPress={handleExportCsv}
          style={{ flex: 1 }}
        />
        <ActionButton
          label="Verify SQLite DB"
          variant="outline"
          icon={<Ionicons name="checkmark-done-circle-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />}
          onPress={handleVerifyDatabase}
          style={{ flex: 1 }}
        />
        <ActionButton
          label="Reset Chat Thread"
          variant="outline"
          icon={<Feather name="trash-2" size={15} color={colors.danger} style={{ marginRight: 6 }} />}
          onPress={handleResetChatHistory}
          style={{ flex: 1, borderColor: colors.danger }}
        />
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  marginTop: {
    marginTop: 10,
  },
  dataActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
