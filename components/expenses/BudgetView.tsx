import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { CategoryIcon } from '@/components/CategoryIcon';
import type { BudgetSummary } from '@/services/database/budgetRepo';
import { useHCITheme } from '@/hooks/useHCITheme';

interface BudgetViewProps {
  budgetSummary: BudgetSummary | null;
  refreshing: boolean;
  onRefresh: () => void;
  formatNaira: (num: number) => string;
  onSelectCategory: (category: string, budget: number) => void;
}

export function BudgetView({
  budgetSummary,
  refreshing,
  onRefresh,
  formatNaira,
  onSelectCategory,
}: BudgetViewProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  return (
    <ScrollView
      contentContainerStyle={styles.budgetListContainer}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Text style={[styles.sectionHeaderTitle, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
        CATEGORIES
      </Text>

      <View style={styles.categoryStack}>
        {budgetSummary?.categories.map((cat) => (
          <TouchableOpacity
            key={cat.category}
            style={[styles.catBudgetCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              triggerHaptic('selection');
              onSelectCategory(cat.category, cat.budget);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.catBudgetTop}>
              <View style={styles.leftInfoRow}>
                <CategoryIcon category={cat.category} size={18} containerStyle={{ marginRight: 12 }} />
                <View>
                  <Text style={[styles.catBudgetName, { color: colors.text, fontSize: scaleFont(14) }]}>{cat.category}</Text>
                  <Text style={[styles.catBudgetSub, { color: colors.textSecondary, fontSize: scaleFont(12) }]}>
                    {cat.budget > 0
                      ? `${formatNaira(cat.spent)} spent • Limit: ${formatNaira(cat.budget)}`
                      : `${formatNaira(cat.spent)} spent • No limit`}
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  styles.catRemainingText,
                  { fontSize: scaleFont(12) },
                  cat.budget === 0 && { color: colors.primary },
                  cat.status === 'exceeded' && { color: colors.danger },
                  cat.status === 'warning' && { color: colors.warning },
                ]}
              >
                {cat.budget === 0
                  ? '+ Set Limit'
                  : cat.status === 'exceeded'
                  ? 'Over Budget'
                  : `${formatNaira(cat.remaining)} left`}
              </Text>
            </View>

            {cat.budget > 0 && (
              <View style={[styles.progressBarBackground, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      backgroundColor: cat.status === 'warning' ? colors.warning : cat.status === 'exceeded' ? colors.danger : colors.primary,
                      width: `${Math.min(100, Math.max(4, cat.percentage))}%`,
                    },
                  ]}
                />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  budgetListContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionHeaderTitle: {
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  categoryStack: {
    gap: 10,
  },
  catBudgetCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  catBudgetTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  catBudgetName: {
    fontWeight: '700',
    marginBottom: 2,
  },
  catBudgetSub: {},
  catRemainingText: {
    fontWeight: '700',
  },
  progressBarBackground: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 10,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
});
