import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useHCITheme } from '@/hooks/useHCITheme';

interface BankAlertsViewProps {
  unconfirmedList: any[];
  formatNaira: (num: number) => string;
  onConfirmCategory: (expenseId: number, category: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
  onSyncSms?: () => void;
  isSyncingSms?: boolean;
}

const COMMON_CATEGORIES = [
  'Food & Dining',
  'Transport / Fuel',
  'Airtime & Data',
  'Utilities & Bills',
  'Shopping',
  'Transfer / Sent',
];

export function BankAlertsView({
  unconfirmedList,
  formatNaira,
  onConfirmCategory,
  refreshing,
  onRefresh,
  onSyncSms,
  isSyncingSms = false,
}: BankAlertsViewProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* 1. Radical Trust Shield Banner */}
      <View style={[styles.trustCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.trustHeaderRow}>
          <View style={[styles.beaconDot, { backgroundColor: '#10b981' }]} />
          <Text style={[styles.trustTitle, { color: colors.text, fontSize: scaleFont(13) }]}>
            Direct SMS Inbox Interceptor Active
          </Text>
        </View>
        <Text style={[styles.trustDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
          Argus directly reads bank alerts from your on-device SMS inbox (GTBank, OPay, Kuda, PalmPay, Zenith, Access). 100% offline, privacy-first ledger.
        </Text>
        <View style={styles.banksRow}>
          {['OPay', 'GTBank', 'Kuda', 'PalmPay', 'Access', 'Zenith'].map((bank) => (
            <View key={bank} style={[styles.bankPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.bankPillText, { color: colors.textMuted, fontSize: scaleFont(10) }]}>
                {bank}
              </Text>
            </View>
          ))}
        </View>

        {onSyncSms && (
          <TouchableOpacity
            style={[styles.syncSmsBtn, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}
            onPress={() => {
              triggerHaptic('medium');
              onSyncSms();
            }}
            disabled={isSyncingSms}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbox-ellipses-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.syncSmsBtnText, { color: colors.primary, fontSize: scaleFont(12) }]}>
              {isSyncingSms ? 'Scanning SMS Inbox...' : 'Scan SMS Inbox For Bank Alerts'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 2. Pending Verification Section */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
          PENDING AUDIT ({unconfirmedList.length})
        </Text>
      </View>

      {unconfirmedList.length === 0 ? (
        <View style={[styles.allClearCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.checkCircle, { backgroundColor: '#10b98115', borderColor: '#10b981' }]}>
            <Ionicons name="checkmark-done" size={32} color="#10b981" />
          </View>
          <Text style={[styles.allClearTitle, { color: colors.text, fontSize: scaleFont(16) }]}>
            All Bank Alerts Reconciled
          </Text>
          <Text style={[styles.allClearDesc, { color: colors.textSecondary, fontSize: scaleFont(12) }]}>
            Zero unreconciled transactions. Every detected Nigerian bank SMS has been verified into your ledger.
          </Text>
        </View>
      ) : (
        <View style={styles.alertsList}>
          {unconfirmedList.map((item) => {
            const dateObj = new Date(item.date);
            const dateFormatted = isNaN(dateObj.getTime())
              ? item.date
              : dateObj.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

            return (
              <View
                key={item.id}
                style={[styles.alertCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                {/* Header: Bank & Amount */}
                <View style={styles.alertTopRow}>
                  <View style={styles.bankBadge}>
                    <Ionicons name="notifications" size={13} color="#f59e0b" style={{ marginRight: 4 }} />
                    <Text style={[styles.bankBadgeText, { fontSize: scaleFont(11) }]}>
                      Detected Alert
                    </Text>
                  </View>
                  <Text style={[styles.alertAmount, { color: colors.text, fontSize: scaleFont(17) }]}>
                    -{formatNaira(item.amount)}
                  </Text>
                </View>

                {/* Raw SMS Snippet for Transparency */}
                <Text style={[styles.rawText, { color: colors.textSecondary, fontSize: scaleFont(12) }]}>
                  {item.description || 'Nigerian Bank SMS Debit Alert'}
                </Text>
                <Text style={[styles.timeText, { color: colors.textMuted, fontSize: scaleFont(10) }]}>
                  Received: {dateFormatted}
                </Text>

                {/* Quick 1-Tap Category Assignment */}
                <Text style={[styles.assignLabel, { color: colors.textMuted, fontSize: scaleFont(10) }]}>
                  ONE-TAP CATEGORIZE & VERIFY:
                </Text>
                <View style={styles.categoriesWrap}>
                  {COMMON_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.catBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={() => {
                        triggerHaptic('selection');
                        onConfirmCategory(item.id, cat);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.catBtnText, { color: colors.primary, fontSize: scaleFont(11) }]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  trustCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  trustHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  beaconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  trustTitle: {
    fontWeight: '800',
  },
  trustDesc: {
    lineHeight: 16,
    marginBottom: 12,
  },
  banksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  bankPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  bankPillText: {
    fontWeight: '700',
  },
  sectionHeaderRow: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  allClearCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  checkCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  allClearTitle: {
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  allClearDesc: {
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  alertsList: {
    gap: 12,
  },
  alertCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  alertTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bankBadgeText: {
    color: '#f59e0b',
    fontWeight: '700',
  },
  alertAmount: {
    fontWeight: '900',
  },
  rawText: {
    lineHeight: 17,
    marginBottom: 4,
  },
  timeText: {
    marginBottom: 12,
  },
  assignLabel: {
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  categoriesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  catBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  catBtnText: {
    fontWeight: '700',
  },
  syncSmsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
  },
  syncSmsBtnText: {
    fontWeight: '700',
  },
});
