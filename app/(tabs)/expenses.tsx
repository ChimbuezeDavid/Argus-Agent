// Standalone-grade Expense Tracking & Budgeting Suite for Argus Agent
// Features: Per-Month Budgets, HCI Popups, Vector Icons, Safe Area Insets, and Bank Notification Categorization Sync
import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
  View,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as expensesRepo from '@/services/database/expensesRepo';
import * as budgetRepo from '@/services/database/budgetRepo';
import { useSettingsStore } from '@/store/settingsStore';
import { useHCITheme } from '@/hooks/useHCITheme';
import { authenticateUser } from '@/services/security/securityService';

import {
  AddExpenseModal,
  SetBudgetModal,
  BudgetView,
  LedgerView,
  HeroBudgetCard,
  MonthNavHeader,
  UnconfirmedAlertsBanner,
} from '@/components/expenses';

const CATEGORIES = [
  'Food & Dining',
  'Transport / Fuel',
  'Airtime & Data',
  'Utilities & Bills',
  'Shopping',
  'Housing & Rent',
  'Entertainment',
  'Transfer / Sent',
  'Other',
];

type ViewMode = 'budget' | 'ledger';

export default function ExpensesScreen() {
  const settings = useSettingsStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, scaleFont, triggerHaptic } = useHCITheme();
  const [currentMonthKey, setCurrentMonthKey] = useState(budgetRepo.getCurrentMonthKey());
  const [expenses, setExpenses] = useState<expensesRepo.Expense[]>([]);
  const [budgetSummary, setBudgetSummary] = useState<budgetRepo.BudgetSummary | null>(null);
  const [unconfirmedList, setUnconfirmedList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('budget');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Manual Log Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('Food & Dining');
  const [descInput, setDescInput] = useState('');

  // Edit Budget Modal
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [totalBudgetInput, setTotalBudgetInput] = useState('');
  const [selectedBudgetCat, setSelectedBudgetCat] = useState('Food & Dining');
  const [catBudgetInput, setCatBudgetInput] = useState('');

  const fetchExpensesData = useCallback(async () => {
    setIsLoading(true);
    let success = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const [expenseList, bSummary, unconfirmed] = await Promise.all([
          expensesRepo.listExpenses(),
          budgetRepo.getBudgetSummaryForMonth(currentMonthKey),
          budgetRepo.getUnconfirmedExpenses(),
        ]);
        setExpenses(expenseList);
        setBudgetSummary(bSummary);
        setUnconfirmedList(unconfirmed);
        success = true;
        break;
      } catch (e: any) {
        if (attempt === 3) {
          console.warn('Error fetching expenses after 3 attempts:', e);
        } else {
          await new Promise((r) => setTimeout(r, 150 * attempt));
        }
      }
    }
    setIsLoading(false);
    setRefreshing(false);
  }, [currentMonthKey]);

  useFocusEffect(
    useCallback(() => {
      fetchExpensesData();
    }, [fetchExpensesData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchExpensesData();
  };

  const handlePrevMonth = () => {
    const [yStr, mStr] = currentMonthKey.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setCurrentMonthKey(`${y}-${String(m).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [yStr, mStr] = currentMonthKey.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setCurrentMonthKey(`${y}-${String(m).padStart(2, '0')}`);
  };

  const handleSaveExpense = async () => {
    const parsedAmount = parseFloat(amountInput.replace(/,/g, ''));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount greater than 0.');
      return;
    }

    try {
      await expensesRepo.addExpense(
        parsedAmount,
        categoryInput,
        descInput.trim() || undefined,
        settings.currency || 'NGN',
        new Date().toISOString(),
        undefined,
        'manual'
      );

      setModalVisible(false);
      setAmountInput('');
      setDescInput('');
      fetchExpensesData();
    } catch (e: any) {
      Alert.alert('Error', `Failed to log expense: ${e.message}`);
    }
  };

  const handleSaveBudgetLimits = async () => {
    try {
      if (totalBudgetInput.trim()) {
        const parsedTotal = parseFloat(totalBudgetInput.replace(/,/g, ''));
        if (!isNaN(parsedTotal) && parsedTotal > 0) {
          await budgetRepo.setTotalMonthlyBudget(currentMonthKey, parsedTotal);
        }
      }

      if (catBudgetInput.trim() && selectedBudgetCat) {
        const parsedCat = parseFloat(catBudgetInput.replace(/,/g, ''));
        if (!isNaN(parsedCat) && parsedCat > 0) {
          await budgetRepo.setCategoryBudget(currentMonthKey, selectedBudgetCat, parsedCat);
        }
      }

      setBudgetModalVisible(false);
      setTotalBudgetInput('');
      setCatBudgetInput('');
      await fetchExpensesData();
      Alert.alert(
        'Budget Updated',
        `Your budget limits for ${budgetSummary?.monthLabel || 'this month'} have been updated.`
      );
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleConfirmCategory = async (expenseId: number, category: string) => {
    try {
      await budgetRepo.confirmExpenseCategory(expenseId, category);
      await fetchExpensesData();
      Alert.alert('Categorized', `Transaction assigned to ${category}.`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDeleteExpense = (id: number) => {
    Alert.alert('Delete Expense', 'Are you sure you want to remove this expense record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await expensesRepo.deleteExpense(id);
          fetchExpensesData();
        },
      },
    ]);
  };

  const formatNaira = (num: number) => {
    return `₦${num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatLiveHelper = (raw: string) => {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    const val = parseFloat(cleaned);
    if (isNaN(val) || val <= 0) return null;
    return `₦${val.toLocaleString('en-NG')}`;
  };

  const handleExportCsv = async () => {
    try {
      if (settings.appLockEnabled) {
        const auth = await authenticateUser('Authenticate to Export Financial Statement');
        if (!auth.success) {
          Alert.alert('Authentication Required', 'Biometric or PIN authentication failed.');
          return;
        }
      }

      if (expenses.length === 0) {
        Alert.alert('No Records', 'No expenses available to export.');
        return;
      }
      const header = 'Date,Amount_NGN,Category,Description,Source\n';
      const rows = expenses
        .map(
          (e) =>
            `"${e.date}",${e.amount},"${e.category}","${(e.description || '').replace(/"/g, '""')}","${e.source}"`
        )
        .join('\n');
      await Share.share({
        title: `Argus_Expenses_${currentMonthKey}.csv`,
        message: header + rows,
      });
    } catch (e: any) {
      Alert.alert('Export Error', e.message);
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchMonth = e.date.startsWith(currentMonthKey);
      const matchSearch =
        !searchQuery.trim() ||
        e.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.category?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = !selectedCategory || e.category === selectedCategory;
      return matchMonth && matchSearch && matchCategory;
    });
  }, [expenses, currentMonthKey, searchQuery, selectedCategory]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 12) }]}>
      {/* Top Header Row (Finances + Settings Gear) */}
      <View style={styles.topHeaderRow}>
        <Text style={[styles.topHeaderTitle, { color: colors.text, fontSize: scaleFont(22) }]}>Finances</Text>
        <TouchableOpacity
          style={[styles.settingsCircleBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => {
            triggerHaptic('selection');
            router.push('/modal');
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="settings-sharp" size={17} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <MonthNavHeader
        monthLabel={budgetSummary?.monthLabel || 'Current Month'}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
      />

      <UnconfirmedAlertsBanner
        unconfirmedList={unconfirmedList}
        formatNaira={formatNaira}
        onConfirmCategory={handleConfirmCategory}
      />

      {/* Segmented View Switcher */}
      <View style={[styles.segmentedControl, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.segmentButton,
            viewMode === 'budget' && [styles.segmentActive, { backgroundColor: colors.primaryBg, borderColor: colors.primary }],
          ]}
          onPress={() => {
            triggerHaptic('selection');
            setViewMode('budget');
          }}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="target"
            size={16}
            color={viewMode === 'budget' ? colors.primary : colors.textMuted}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.segmentText,
              { color: viewMode === 'budget' ? colors.primary : colors.textMuted, fontSize: scaleFont(12) },
            ]}
          >
            Budget & Limits
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.segmentButton,
            viewMode === 'ledger' && [styles.segmentActive, { backgroundColor: colors.primaryBg, borderColor: colors.primary }],
          ]}
          onPress={() => {
            triggerHaptic('selection');
            setViewMode('ledger');
          }}
          activeOpacity={0.8}
        >
          <Ionicons
            name="document-text-outline"
            size={15}
            color={viewMode === 'ledger' ? colors.primary : colors.textMuted}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.segmentText,
              { color: viewMode === 'ledger' ? colors.primary : colors.textMuted, fontSize: scaleFont(12) },
            ]}
          >
            Transactions ({expenses.length})
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'budget' ? (
        <>
          <HeroBudgetCard
            budgetSummary={budgetSummary}
            formatNaira={formatNaira}
            onLogExpense={() => setModalVisible(true)}
            onEditBudget={(currentTotal) => {
              setTotalBudgetInput(currentTotal > 0 ? String(currentTotal) : '');
              setBudgetModalVisible(true);
            }}
            onExport={handleExportCsv}
          />
          <BudgetView
            budgetSummary={budgetSummary}
            refreshing={refreshing}
            onRefresh={onRefresh}
            formatNaira={formatNaira}
            onSelectCategory={(cat, budget) => {
              setSelectedBudgetCat(cat);
              setCatBudgetInput(budget > 0 ? String(budget) : '');
              setBudgetModalVisible(true);
            }}
          />
        </>
      ) : (
        <LedgerView
          expenses={filteredExpenses}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          categories={CATEGORIES}
          refreshing={refreshing}
          onRefresh={onRefresh}
          formatNaira={formatNaira}
          onDeleteExpense={handleDeleteExpense}
          monthLabel={budgetSummary?.monthLabel}
        />
      )}

      <AddExpenseModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveExpense}
        categories={CATEGORIES}
        liveFormatHelper={formatLiveHelper}
        amountInput={amountInput}
        setAmountInput={setAmountInput}
        categoryInput={categoryInput}
        setCategoryInput={setCategoryInput}
        descInput={descInput}
        setDescInput={setDescInput}
      />

      <SetBudgetModal
        visible={budgetModalVisible}
        onClose={() => setBudgetModalVisible(false)}
        onSave={handleSaveBudgetLimits}
        categories={CATEGORIES}
        liveFormatHelper={formatLiveHelper}
        totalBudgetInput={totalBudgetInput}
        setTotalBudgetInput={setTotalBudgetInput}
        selectedBudgetCat={selectedBudgetCat}
        setSelectedBudgetCat={setSelectedBudgetCat}
        catBudgetInput={catBudgetInput}
        setCatBudgetInput={setCatBudgetInput}
        monthLabel={budgetSummary?.monthLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  topHeaderTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f8fafc',
  },
  settingsCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 6,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  segmentActive: {
    backgroundColor: '#0c1a2e',
    borderWidth: 1,
    borderColor: '#0284c7',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  segmentTextActive: {
    color: '#38bdf8',
  },
});
