import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHCITheme } from '@/hooks/useHCITheme';
import { NotificationStyle } from '@/store/settingsStore';
import { SectionCard, ToggleRow, ChipSelector, ChipOption } from '@/components/shared';

interface NotificationsSectionProps {
  settings: any;
}

export function NotificationsSection({ settings }: NotificationsSectionProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  const styleOptions: ChipOption<NotificationStyle>[] = [
    { id: 'sound_and_vibe', label: 'Vibe & Sound' },
    { id: 'sound_only', label: 'Sound Only' },
    { id: 'vibe_only', label: 'Vibe Only' },
    { id: 'silent', label: 'Silent' },
  ];

  return (
    <SectionCard
      icon={<Ionicons name="notifications-outline" size={scaleFont(20)} color="#38bdf8" style={{ marginRight: 8 }} />}
      title="Notifications & Alerts"
      subtitle="Control push notifications, customize specific category alerts, and set sound / vibration style."
    >
      <ToggleRow
        label="Allow Push Alerts"
        description="Global master switch for all Argus on-device system alarms"
        value={settings.pushNotificationsEnabled}
        onValueChange={(val) => {
          triggerHaptic('selection');
          settings.togglePushNotifications(val);
        }}
      />

      {settings.pushNotificationsEnabled && (
        <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 10 }}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted, fontSize: scaleFont(11) }]}>ALERT CATEGORIES</Text>

          <ToggleRow
            label="Budget Limit Warnings"
            description="Alert when spending reaches 80% and 100% of monthly budget"
            value={settings.alertBudgetWarnings}
            onValueChange={(val) => {
              triggerHaptic('selection');
              settings.toggleAlertBudgetWarnings(val);
            }}
          />

          <ToggleRow
            label="Bank Intercepts"
            description="Notify when a new bank debit or credit SMS is parsed"
            value={settings.alertBankTransactions}
            onValueChange={(val) => {
              triggerHaptic('selection');
              settings.toggleAlertBankTransactions(val);
            }}
          />

          <ToggleRow
            label="Geofence Crossings"
            description="Notify when arriving or departing registered geofence zones"
            value={settings.alertGeofences}
            onValueChange={(val) => {
              triggerHaptic('selection');
              settings.toggleAlertGeofences(val);
            }}
          />

          <ToggleRow
            label="Daily AI Briefing"
            description="Morning summary of budget, screen time, and tasks"
            value={settings.alertDailySummary}
            onValueChange={(val) => {
              triggerHaptic('selection');
              settings.toggleAlertDailySummary(val);
            }}
          />

          <Text style={[styles.fieldLabel, { color: colors.textMuted, fontSize: scaleFont(11), marginTop: 8 }]}>
            ALERT DELIVERY STYLE
          </Text>
          <ChipSelector<NotificationStyle>
            options={styleOptions}
            selectedId={settings.notificationStyle}
            onSelect={(id) => {
              triggerHaptic('selection');
              settings.setNotificationStyle(id);
            }}
          />
        </View>
      )}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
});
