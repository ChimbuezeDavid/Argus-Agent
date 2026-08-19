import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/Themed';
import { useRouter } from 'expo-router';
import { useHCITheme } from '@/hooks/useHCITheme';

interface ExecutivePulseCardProps {
  todaySpent: number;
  todayCount: number;
  monthlyBudgetLimit: number;
  monthlyTotal: number;
}

export function ExecutivePulseCard({
  todaySpent,
  todayCount,
  monthlyBudgetLimit,
  monthlyTotal,
}: ExecutivePulseCardProps) {
  const router = useRouter();
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const remainingBudget = Math.max(0, monthlyBudgetLimit - monthlyTotal);

  const formatShortCurrency = (amount: number) => {
    if (amount >= 1000000) return `₦${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `₦${(amount / 1000).toFixed(1)}k`;
    return `₦${amount.toLocaleString()}`;
  };

  const formatNaira = (amount: number) => {
    return `₦${amount.toLocaleString()}`;
  };

  const budgetPercent = monthlyBudgetLimit > 0
    ? Math.min(100, Math.round((monthlyTotal / monthlyBudgetLimit) * 100 * 10) / 10)
    : 0;

  return (
    <TouchableOpacity
      style={[
        styles.cardContainer,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
      onPress={() => {
        triggerHaptic('selection');
        router.push('/(tabs)/expenses');
      }}
      activeOpacity={0.9}
    >
      {/* Pulse Badge Row */}
      <View style={styles.badgeRow}>
        <View style={styles.pulseDot} />
        <Text style={[styles.badgeText, { fontSize: scaleFont(11) }]}>ARGUS EXECUTIVE PULSE</Text>
      </View>

      {/* Main Headline */}
      <Text style={[styles.headline, { color: colors.text, fontSize: scaleFont(18) }]}>
        {getGreeting()}. All systems clear.
      </Text>

      {/* Subtitle Telemetry */}
      <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: scaleFont(13) }]}>
        {todayCount > 0
          ? `${formatNaira(todaySpent)} spent today across ${todayCount} transaction${todayCount > 1 ? 's' : ''}.`
          : '₦0 spent today. No active budget alerts.'}
      </Text>

      {/* Budget Metrics & Progress */}
      <View style={styles.budgetRow}>
        <Text style={[styles.budgetText, { color: colors.textSecondary, fontSize: scaleFont(13) }]}>
          Budget: <Text style={[styles.budgetAmountText, { color: colors.primary }]}>{formatShortCurrency(remainingBudget)} left</Text>
        </Text>
        <Text style={[styles.percentText, { color: colors.textMuted, fontSize: scaleFont(12) }]}>{budgetPercent}%</Text>
      </View>

      {/* Progress Bar */}
      <View style={[styles.progressBarTrack, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.progressBarFill,
            {
              backgroundColor: colors.primary,
              width: `${Math.min(100, Math.max(4, budgetPercent))}%`,
            },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 8,
  },
  badgeText: {
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: 1.1,
  },
  headline: {
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 14,
    lineHeight: 18,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  budgetText: {
    fontWeight: '600',
  },
  budgetAmountText: {
    fontWeight: '700',
  },
  percentText: {
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
