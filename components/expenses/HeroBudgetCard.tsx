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

  return (
    <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Top Header Row */}
      <View style={styles.heroTopRow}>
        <Text style={[styles.heroTitle, { color: colors.textMuted, fontSize: scaleFont(11) }]}>MONTHLY OVERVIEW</Text>
        <View
          style={[
            styles.statusBadge,
            isConfigured
              ? budgetSummary.status === 'healthy'
                ? { backgroundColor: colors.successBg, borderColor: colors.success }
                : budgetSummary.status === 'warning'
                ? { backgroundColor: colors.warningBg, borderColor: colors.warning }
                : { backgroundColor: colors.dangerBg, borderColor: colors.danger }
              : { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.statusBadgeText,
              {
                color: isConfigured
                  ? budgetSummary.status === 'healthy'
                    ? colors.success
                    : budgetSummary.status === 'warning'
                    ? colors.warning
                    : colors.danger
                  : colors.textMuted,
                fontSize: scaleFont(10),
              },
            ]}
          >
            {isConfigured
              ? budgetSummary.status === 'healthy'
                ? 'On Track'
                : budgetSummary.status === 'warning'
                ? '80%+ Used'
                : 'Exceeded'
              : 'Unset'}
          </Text>
        </View>
      </View>

      {/* Main Amount Line */}
      <Text style={[styles.heroAmount, { color: colors.text, fontSize: scaleFont(22) }]}>
        {isConfigured
          ? `${formatNaira(budgetSummary.totalSpentThisMonth)} / ${formatNaira(budgetSummary.totalMonthlyBudget)}`
          : `${formatNaira(budgetSummary.totalSpentThisMonth)} / No Limit`}
      </Text>

      {/* Subtitle Telemetry */}
      <Text style={[styles.heroSubtitle, { color: colors.textSecondary, fontSize: scaleFont(12) }]}>
        Argus auto-tracks SMS from GTBank, OPay & Kuda.
      </Text>

      {/* Progress Bar (if configured) */}
      {isConfigured && (
        <View style={[styles.progressBarBackground, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressBarFill,
              {
                backgroundColor: budgetSummary.status === 'warning' ? colors.warning : budgetSummary.status === 'exceeded' ? colors.danger : colors.primary,
                width: `${Math.min(100, Math.max(4, budgetSummary.overallPercentage))}%`,
              },
            ]}
          />
        </View>
      )}

      {/* Action Buttons Row */}
      <View style={styles.heroActionsRow}>
        <TouchableOpacity
          style={[styles.heroSetBudgetButton, { backgroundColor: colors.primary }]}
          onPress={() => {
            triggerHaptic('selection');
            onEditBudget(budgetSummary.totalMonthlyBudget || 0);
          }}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="target" size={16} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={[styles.heroSetBudgetText, { fontSize: scaleFont(13) }]}>Set Budget</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.heroLogSpendButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => {
            triggerHaptic('selection');
            onLogExpense();
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={16} color={colors.text} style={{ marginRight: 6 }} />
          <Text style={[styles.heroLogSpendText, { color: colors.text, fontSize: scaleFont(13) }]}>Log Spend</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heroTitle: {
    fontWeight: '800',
    letterSpacing: 1,
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
  heroAmount: {
    fontWeight: '800',
    marginBottom: 4,
  },
  heroSubtitle: {
    marginBottom: 16,
    lineHeight: 17,
  },
  progressBarBackground: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  heroActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroSetBudgetButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  heroSetBudgetText: {
    fontWeight: '700',
    color: '#ffffff',
  },
  heroLogSpendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  heroLogSpendText: {
    fontWeight: '700',
  },
});
