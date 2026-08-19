// Per-Month Budget & Spending Limits repository for Argus Agent
// User-driven budgeting: No preset numbers; amounts are entered manually or via AI voice/text commands.
import { getDatabase } from './db';

export interface CategoryBudget {
  category: string;
  budget: number;
  spent: number;
  remaining: number;
  percentage: number;
  status: 'healthy' | 'warning' | 'exceeded';
}

export interface BudgetSummary {
  monthKey: string; // e.g. '2026-08'
  monthLabel: string; // e.g. 'August 2026'
  isConfigured: boolean; // true if user has set a total budget > 0 or category limits
  totalMonthlyBudget: number;
  totalSpentThisMonth: number;
  totalRemaining: number;
  overallPercentage: number;
  status: 'healthy' | 'warning' | 'exceeded';
  categories: CategoryBudget[];
  unconfirmedCount: number;
}

export const ALL_EXPENSE_CATEGORIES = [
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

export function getMonthLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const monthIdx = parseInt(monthStr, 10) - 1;
  const d = new Date(year, monthIdx, 1);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Gets the budget summary for a specific calendar month (e.g. '2026-08').
 * No preset budgets: Returns isConfigured: false and totalMonthlyBudget: 0 if unset.
 */
export async function getBudgetSummaryForMonth(targetMonthKey?: string): Promise<BudgetSummary> {
  const db = await getDatabase();
  const monthKey = targetMonthKey || getCurrentMonthKey();
  const monthLabel = getMonthLabel(monthKey);

  // 1. Fetch total budget for this specific month (0 if unset)
  const totalRow = await db.getFirstAsync<{ budget_limit: number }>(
    'SELECT budget_limit FROM monthly_budgets WHERE month_key = ? AND category = ?',
    monthKey,
    'TOTAL'
  );
  const totalMonthlyBudget = totalRow ? totalRow.budget_limit : 0;

  // 2. Query all expenses for this specific month
  const expenseRows = await db.getAllAsync<{ category: string; spent: number }>(
    `SELECT category, SUM(amount) as spent 
     FROM expenses 
     WHERE date LIKE ? 
     GROUP BY category`,
    `${monthKey}%`
  );

  const spentMap: Record<string, number> = {};
  let totalSpentThisMonth = 0;

  expenseRows.forEach(row => {
    spentMap[row.category] = row.spent;
    totalSpentThisMonth += row.spent;
  });

  // 4. Count unconfirmed transactions needing category clarification
  const unconfirmedRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM expenses WHERE status = 'unconfirmed' AND date LIKE ?`,
    `${monthKey}%`
  );
  const unconfirmedCount = unconfirmedRow?.count || 0;

  // 5. Query saved category budgets for this month
  const catRows = await db.getAllAsync<{ category: string; budget_limit: number }>(
    'SELECT category, budget_limit FROM monthly_budgets WHERE month_key = ? AND category != ?',
    monthKey,
    'TOTAL'
  );

  const customCatBudgets: Record<string, number> = {};
  catRows.forEach(row => {
    customCatBudgets[row.category] = row.budget_limit;
  });

  const isConfigured = totalMonthlyBudget > 0 || catRows.length > 0;

  const categories: CategoryBudget[] = ALL_EXPENSE_CATEGORIES.map(cat => {
    const budget = customCatBudgets[cat] !== undefined ? customCatBudgets[cat] : 0;
    const spent = spentMap[cat] || 0;
    const remaining = budget > 0 ? Math.max(0, budget - spent) : 0;
    const percentage = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;

    let status: 'healthy' | 'warning' | 'exceeded' = 'healthy';
    if (budget > 0) {
      if (spent >= budget) {
        status = 'exceeded';
      } else if (percentage >= 80) {
        status = 'warning';
      }
    }

    return {
      category: cat,
      budget,
      spent,
      remaining,
      percentage,
      status,
    };
  });

  const totalRemaining = totalMonthlyBudget > 0 ? Math.max(0, totalMonthlyBudget - totalSpentThisMonth) : 0;
  const overallPercentage = totalMonthlyBudget > 0
    ? Math.min(100, Math.round((totalSpentThisMonth / totalMonthlyBudget) * 100))
    : 0;

  let overallStatus: 'healthy' | 'warning' | 'exceeded' = 'healthy';
  if (totalMonthlyBudget > 0) {
    if (totalSpentThisMonth >= totalMonthlyBudget) {
      overallStatus = 'exceeded';
    } else if (overallPercentage >= 80) {
      overallStatus = 'warning';
    }
  }

  return {
    monthKey,
    monthLabel,
    isConfigured,
    totalMonthlyBudget,
    totalSpentThisMonth,
    totalRemaining,
    overallPercentage,
    status: overallStatus,
    categories,
    unconfirmedCount,
  };
}

/**
 * Updates the total monthly budget for a specific month.
 */
export async function setTotalMonthlyBudget(monthKey: string, amount: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO monthly_budgets (month_key, category, budget_limit)
     VALUES (?, 'TOTAL', ?)
     ON CONFLICT(month_key, category) DO UPDATE SET budget_limit = excluded.budget_limit`,
    monthKey,
    amount
  );
}

/**
 * Updates a specific category budget for a specific month.
 */
export async function setCategoryBudget(monthKey: string, category: string, amount: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO monthly_budgets (month_key, category, budget_limit)
     VALUES (?, ?, ?)
     ON CONFLICT(month_key, category) DO UPDATE SET budget_limit = excluded.budget_limit`,
    monthKey,
    category,
    amount
  );
}

/**
 * Retrieves all unconfirmed expenses that were intercepted via bank alerts but require category assignment.
 */
export async function getUnconfirmedExpenses(): Promise<any[]> {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT * FROM expenses WHERE status = 'unconfirmed' ORDER BY date DESC LIMIT 20`
  );
}

/**
 * Confirms and assigns a category to an unconfirmed intercepted transaction.
 */
export async function confirmExpenseCategory(expenseId: number, category: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE expenses SET category = ?, status = 'confirmed' WHERE id = ?`,
    category,
    expenseId
  );
}
