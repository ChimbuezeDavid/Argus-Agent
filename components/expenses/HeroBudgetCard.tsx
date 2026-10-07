import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { BudgetSummary } from '@/services/database/budgetRepo';
import { useHCITheme } from '@/hooks/useHCITheme';

interface HeroBudgetCardProps {
  budgetSummary: BudgetSummary | null;
  formatNaira: (num: number) => string;
  onLogExpense: () => void;
  onEditBudget: (currentTotal: number) => void;
  onExport: () => void;
}

export function HeroBudgetCard({
  budgetSummary,
  formatNaira,
  onLogExpense,
  onEditBudget,
  onExport,
}: HeroBudgetCardProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  if (!budgetSummary) return null;

  const isConfigured = budgetSummary.isConfigured && budgetSummary.totalMonthlyBudget > 0;
  const remainingRunway = Math.max(0, budgetSummary.totalMonthlyBudget - budgetSummary.totalSpentThisMonth);
  const isHealthy = budgetSummary.status === 'healthy';
  const isWarning = budgetSummary.status === 'warning';
  const isExceeded = budgetSummary.status === 'exceeded';

  return (
    <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* 1. Radical Trust Status & Security Beacon */}
      <View style={styles.trustHeaderRow}>
        <View style={[styles.trustBeacon, { backgroundColor: '#10b98115', borderColor: '#10b98140' }]}>
          <Ionicons name="shield-checkmark" size={13} color="#10b981" />
          <Text style={[styles.trustBeaconText, { fontSize: scaleFont(10) }]}>
            VERIFIED ON-DEVICE LEDGER
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            isConfigured
              ? isHealthy
                ? { backgroundColor: '#10b98120', borderColor: '#10b981' }
                : isWarning
                ? { backgroundColor: '#f59e0b20', borderColor: '#f59e0b' }
                : { backgroundColor: '#ef444420', borderColor: '#ef4444' }
              : { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.statusBadgeText,
              {
                color: isConfigured
                  ? isHealthy
                    ? '#10b981'
                    : isWarning
                    ? '#f59e0b'
                    : '#ef4444'
                  : colors.textMuted,
                fontSize: scaleFont(10),
              },
            ]}
          >
            {isConfigured
              ? isHealthy
                ? 'Solvent & On Track'
                : isWarning
                ? 'Approaching Cap'
                : 'Cap Exceeded'
              : 'Limit Unset'}
          </Text>
        </View>
      </View>

      {/* 2. Cognitive Simplification Headline: "What is my safe runway?" */}
      <View style={styles.headlineContainer}>
        <Text style={[styles.headlineSub, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
          {isConfigured ? 'SAFE DISCRETIONARY RUNWAY' : 'TOTAL MONTHLY OUTFLOW'}
        </Text>
        <Text style={[styles.headlineMain, { color: colors.text, fontSize: scaleFont(26) }]}>
          {isConfigured ? formatNaira(remainingRunway) : formatNaira(budgetSummary.totalSpentThisMonth)}
        </Text>
        <Text style={[styles.headlineCaption, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
          {isConfigured
            ? `${formatNaira(budgetSummary.totalSpentThisMonth)} spent of ${formatNaira(budgetSummary.totalMonthlyBudget)} cap`
            : 'No overall monthly spending ceiling set'}
        </Text>
      </View>

      {/* 3. Smooth Visual Proportion Gauge */}
      {isConfigured && (
        <View style={styles.gaugeContainer}>
          <View style={[styles.gaugeTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.gaugeFill,
                {
                  width: `${Math.min(100, Math.max(3, budgetSummary.overallPercentage))}%`,
                  backgroundColor: isExceeded ? '#ef4444' : isWarning ? '#f59e0b' : colors.primary,
                },
              ]}
            />
          </View>
          <View style={styles.gaugeMetaRow}>
            <Text style={[styles.gaugeMetaText, { color: colors.textMuted, fontSize: scaleFont(10) }]}>
              {budgetSummary.overallPercentage.toFixed(0)}% utilized
            </Text>
            <Text style={[styles.gaugeMetaText, { color: colors.textMuted, fontSize: scaleFont(10) }]}>
              {isExceeded ? 'Exceeded limit' : `${formatNaira(remainingRunway)} buffer remaining`}
            </Text>
          </View>
        </View>
      )}

      {/* 4. Radical Trust Privacy Micro-Badge */}
      <View style={[styles.privacyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="lock-closed" size={12} color={colors.textSecondary} style={{ marginRight: 6 }} />
        <Text style={[styles.privacyText, { color: colors.textSecondary, fontSize: scaleFont(10) }]}>
          Zero bank credentials stored. Monitored strictly via local Android SMS alerts.
        </Text>
      </View>

      {/* 5. Executive Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            triggerHaptic('selection');
            onLogExpense();
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={17} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={[styles.primaryActionBtnText, { fontSize: scaleFont(12) }]}>Log Outflow</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => {
            triggerHaptic('selection');
            onEditBudget(budgetSummary.totalMonthlyBudget || 0);
          }}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="target" size={16} color={colors.text} style={{ marginRight: 6 }} />
          <Text style={[styles.secondaryActionBtnText, { color: colors.text, fontSize: scaleFont(12) }]}>
            Set Limit
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => {
            triggerHaptic('selection');
            onExport();
          }}
          activeOpacity={0.8}
          accessibilityLabel="Export Ledger CSV Audit"
        >
          <Ionicons name="download-outline" size={17} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 14,
  },
  trustHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  trustBeacon: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    gap: 5,
  },
  trustBeaconText: {
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: 0.6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontWeight: '700',
  },
  headlineContainer: {
    marginBottom: 12,
  },
  headlineSub: {
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  headlineMain: {
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headlineCaption: {
    fontWeight: '500',
  },
  gaugeContainer: {
    marginBottom: 12,
  },
  gaugeTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 5,
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 4,
  },
  gaugeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gaugeMetaText: {
    fontWeight: '600',
  },
  privacyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
  },
  privacyText: {
    flex: 1,
    fontWeight: '500',
    lineHeight: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryActionBtnText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryActionBtnText: {
    fontWeight: '700',
  },
  iconActionBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
