import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHCITheme } from '@/hooks/useHCITheme';
import { NotificationStyle } from '@/store/settingsStore';
import { SectionCard, ToggleRow } from '@/components/shared';

interface NotificationsSectionProps {
  settings: any;
}

interface AlertDeliveryOption {
  id: NotificationStyle;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge: string;
}

const DELIVERY_STYLES: AlertDeliveryOption[] = [
  {
    id: 'sound_and_vibe',
    title: 'Sound & Haptic Vibration',
    subtitle: 'Audible chime with tactile vibration pulses for critical financial events',
    icon: 'volume-high-outline',
    badge: 'Recommended',
  },
  {
    id: 'vibe_only',
    title: 'Vibration Only',
    subtitle: 'Tactile vibration feedback without playing audio chimes',
    icon: 'phone-portrait-outline',
    badge: 'Discreet',
  },
  {
    id: 'sound_only',
    title: 'Sound Only',
    subtitle: 'Plays audio tone alert without vibrating phone motors',
    icon: 'notifications-outline',
    badge: 'Chime',
  },
  {
    id: 'silent',
    title: 'Completely Silent',
    subtitle: 'Posts quiet badges to Android notification drawer with zero sound or buzz',
    icon: 'notifications-off-outline',
    badge: 'Quiet',
  },
];

export function NotificationsSection({ settings }: NotificationsSectionProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  return (
    <View style={styles.container}>
      {/* 1. Master Alert Switch */}
      <SectionCard
        icon={<Ionicons name="notifications-outline" size={scaleFont(20)} color="#38bdf8" style={{ marginRight: 8 }} />}
        title="Push Notifications Master"
        subtitle="Control system-level notifications for budgets, bank transactions, and geofences."
      >
        <ToggleRow
          label="Allow System Notifications"
          description="Master switch for on-device status alerts and background notifications"
          value={settings.pushNotificationsEnabled}
          onValueChange={(val) => {
            triggerHaptic('selection');
            settings.togglePushNotifications(val);
          }}
        />

        {settings.pushNotificationsEnabled && (
          <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 10 }}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
              ALERT CATEGORIES
            </Text>

            <ToggleRow
              label="Budget Threshold Warnings"
              description="Alert when monthly spending reaches 80% and 100% of limits"
              value={settings.alertBudgetWarnings}
              onValueChange={(val) => {
                triggerHaptic('selection');
                settings.toggleAlertBudgetWarnings(val);
              }}
            />

            <ToggleRow
              label="Bank Transaction Intercepts"
              description="Notify immediately when a new credit or debit SMS alert is captured"
              value={settings.alertBankTransactions}
              onValueChange={(val) => {
                triggerHaptic('selection');
                settings.toggleAlertBankTransactions(val);
              }}
            />

            <ToggleRow
              label="Geofence Boundary Crossings"
              description="Alert when entering or departing active location perimeters"
              value={settings.alertGeofences}
              onValueChange={(val) => {
                triggerHaptic('selection');
                settings.toggleAlertGeofences(val);
              }}
            />

            <ToggleRow
              label="Daily Executive Briefing"
              description="Evening summary of total spend, screen time, and active plans"
              value={settings.alertDailySummary}
              onValueChange={(val) => {
                triggerHaptic('selection');
                settings.toggleAlertDailySummary(val);
              }}
            />
          </View>
        )}
      </SectionCard>

      {/* 2. Redesigned Alert Delivery Style Cards */}
      <SectionCard
        icon={<Ionicons name="sparkles-outline" size={scaleFont(20)} color="#f59e0b" style={{ marginRight: 8 }} />}
        title="Alert Delivery Style"
        subtitle="Choose how Argus signals notifications on your device."
      >
        <View style={styles.deliveryList}>
          {DELIVERY_STYLES.map((opt) => {
            const isSelected = settings.notificationStyle === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.deliveryCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isSelected ? '#f59e0b' : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  settings.setNotificationStyle(opt.id);
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.iconBox,
                    {
                      backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.15)' : colors.background,
                    },
                  ]}
                >
                  <Ionicons name={opt.icon} size={20} color={isSelected ? '#f59e0b' : colors.textSecondary} />
                </View>

                <View style={styles.deliveryMetaCol}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.deliveryTitle, { color: colors.text, fontSize: scaleFont(13) }]}>
                      {opt.title}
                    </Text>
                    <View style={[styles.styleBadge, { backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.2)' : colors.background }]}>
                      <Text style={[styles.styleBadgeText, { color: isSelected ? '#f59e0b' : colors.textMuted, fontSize: scaleFont(10) }]}>
                        {opt.badge}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.deliveryDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                    {opt.subtitle}
                  </Text>
                </View>

                <View style={styles.radioBox}>
                  {isSelected ? (
                    <Ionicons name="checkmark-circle" size={22} color="#f59e0b" />
                  ) : (
                    <View style={[styles.radioEmpty, { borderColor: colors.border }]} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  fieldLabel: {
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  deliveryList: {
    gap: 10,
  },
  deliveryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deliveryMetaCol: {
    flex: 1,
    marginRight: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  deliveryTitle: {
    fontWeight: '700',
  },
  styleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  styleBadgeText: {
    fontWeight: '700',
  },
  deliveryDesc: {
    lineHeight: 15,
  },
  radioBox: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioEmpty: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
});
