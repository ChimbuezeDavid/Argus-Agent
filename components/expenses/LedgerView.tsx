// Re-designed Executive Transaction Ledger for Argus Finances
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { CategoryIcon } from '@/components/CategoryIcon';
import { SearchBar } from '@/components/shared/SearchBar';
import { EmptyState } from '@/components/shared/EmptyState';
import { useHCITheme } from '@/hooks/useHCITheme';
import type { Expense } from '@/services/database/expensesRepo';

interface LedgerViewProps {
  expenses: Expense[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: string | null;
  setSelectedCategory: (c: string | null) => void;
  categories: string[];
  refreshing: boolean;
  onRefresh: () => void;
  formatNaira: (num: number) => string;
  onDeleteExpense: (id: number) => void;
  monthLabel?: string;
}

export function LedgerView({
  expenses,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  categories,
  refreshing,
  onRefresh,
  formatNaira,
  onDeleteExpense,
  monthLabel,
}: LedgerViewProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  const allCategories = useMemo(
    () => [{ id: 'All', label: 'All' }, ...categories.map((c) => ({ id: c, label: c }))],
    [categories]
  );

  // Filtered total calculation
  const filteredTotal = useMemo(() => {
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const getSourceBadge = (source: string, desc?: string | null) => {
    const s = (source || '').toLowerCase();
    const d = (desc || '').toLowerCase();

    if (d.includes('opay') || s.includes('opay')) {
      return { label: 'OPAY', bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' };
    }
    if (d.includes('gtbank') || s.includes('gtbank')) {
      return { label: 'GTBANK', bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316' };
    }
    if (d.includes('kuda') || s.includes('kuda')) {
      return { label: 'KUDA', bg: 'rgba(168, 85, 247, 0.15)', text: '#a855f7' };
    }
    if (s.includes('notification') || s.includes('auto')) {
      return { label: 'AUTO', bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8' };
    }
    return { label: 'MANUAL', bg: colors.surface, text: colors.textSecondary };
  };

  return (
    <View style={styles.container}>
      {/* 1. Sleek Search Omnibar */}
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search merchant, notes, amount..."
        style={{ marginHorizontal: 16, marginBottom: 10 }}
      />

      {/* 2. Modern Category Filters (Horizontal Scroll) */}
      <View style={styles.categoryScrollContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={allCategories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.categoryChipsContent}
          renderItem={({ item }) => {
            const isSelected = (selectedCategory === null && item.id === 'All') || selectedCategory === item.id;
            return (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected ? colors.primaryBg : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  setSelectedCategory(item.id === 'All' ? null : item.id);
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: isSelected ? colors.primary : colors.textSecondary,
                      fontSize: scaleFont(12),
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* 3. Summary Ledger Metric Bar */}
      <View style={[styles.summaryMetricBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.metricItem}>
          <Text style={[styles.metricLabel, { color: colors.textMuted, fontSize: scaleFont(10) }]}>
            TRANSACTIONS
          </Text>
          <Text style={[styles.metricValue, { color: colors.text, fontSize: scaleFont(14) }]}>
            {expenses.length}
          </Text>
        </View>
        <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
        <View style={styles.metricItem}>
          <Text style={[styles.metricLabel, { color: colors.textMuted, fontSize: scaleFont(10) }]}>
            TOTAL FILTERED
          </Text>
          <Text style={[styles.metricValue, { color: colors.primary, fontSize: scaleFont(14) }]}>
            {formatNaira(filteredTotal)}
          </Text>
        </View>
      </View>

      {/* 4. Executive Transaction Card Stream */}
      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.transactionsList}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <EmptyState
            icon="wallet-outline"
            title={`No Transactions for ${monthLabel || 'this period'}`}
            subtitle={
              searchQuery
                ? 'No expenses matched your search query.'
                : "Say '3,200 for bread' in Argus Chat or tap 'Log Spend' above to record an expense."
            }
          />
        }
        renderItem={({ item }) => {
          const badge = getSourceBadge(item.source, item.description);
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
              style={[
                styles.transactionCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              {/* Left Column: Category Icon with Tinted Rounded Box */}
              <View style={[styles.iconContainer, { backgroundColor: colors.surface }]}>
                <CategoryIcon category={item.category} size={20} />
              </View>

              {/* Middle Column: Merchant/Description, Source Badge, and Timestamp */}
              <View style={styles.infoColumn}>
                <Text style={[styles.itemTitle, { color: colors.text, fontSize: scaleFont(14) }]} numberOfLines={1}>
                  {item.description || item.category}
                </Text>

                <View style={styles.metaRow}>
                  <View style={[styles.sourceBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.sourceBadgeText, { color: badge.text, fontSize: scaleFont(9) }]}>
                      {badge.label}
                    </Text>
                  </View>
                  <Text style={[styles.timestampText, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
                    {dateFormatted}
                  </Text>
                </View>
              </View>

              {/* Right Column: Bold Amount & Subtle Delete Action */}
              <View style={styles.amountColumn}>
                <Text style={[styles.amountText, { color: colors.text, fontSize: scaleFont(14) }]}>
                  -{formatNaira(item.amount)}
                </Text>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => {
                    triggerHaptic('warning');
                    onDeleteExpense(item.id);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
                  <Text style={[styles.deleteText, { color: colors.danger, fontSize: scaleFont(11) }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  categoryScrollContainer: {
    marginBottom: 10,
  },
  categoryChipsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  filterChipText: {
    fontWeight: '700',
  },
  summaryMetricBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  metricValue: {
    fontWeight: '800',
  },
  metricDivider: {
    width: 1,
    height: 24,
  },
  transactionsList: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 8,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  itemTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sourceBadgeText: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timestampText: {
    fontWeight: '500',
  },
  amountColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 8,
  },
  amountText: {
    fontWeight: '800',
    marginBottom: 4,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  deleteText: {
    fontWeight: '600',
  },
});
