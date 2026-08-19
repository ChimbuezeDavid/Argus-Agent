// Repository layer for expenses management in SQLite
import { getDatabase } from './db';

export interface Expense {
  id: number;
  amount: number;
  currency: string;
  category: string;
  description: string | null;
  date: string;
  source: string;
  related_notification_id: number | null;
  created_at: string;
}

export interface ExpenseSummaryItem {
  category: string;
  total_amount: number;
  count: number;
}

export interface ExpenseSummary {
  items: ExpenseSummaryItem[];
  grand_total: number;
}

/**
 * Records a new expense in the database.
 */
export async function addExpense(
  amount: number,
  category: string,
  description: string = '',
  currency: string = 'USD',
  date?: string,
  relatedNotificationId?: number,
  source: string = 'manual'
): Promise<Expense> {
  const db = await getDatabase();
  
  const formattedDate = date || new Date().toISOString();
  const notificationId = relatedNotificationId || null;
  
  const result = await db.runAsync(
    `INSERT INTO expenses (amount, currency, category, description, date, source, related_notification_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    amount,
    currency,
    category,
    description,
    formattedDate,
    source,
    notificationId
  );
  
  const createdExpense = await db.getFirstAsync<any>(
    'SELECT * FROM expenses WHERE id = ?',
    result.lastInsertRowId
  );
  
  if (!createdExpense) {
    throw new Error('Failed to retrieve newly created expense');
  }
  
  return createdExpense;
}

/**
 * Retrieves expenses list, optionally filtered by category or date ranges.
 */
export async function listExpenses(
  category?: string,
  startDate?: string,
  endDate?: string,
  limit: number = 100
): Promise<Expense[]> {
  const db = await getDatabase();
  let sql = 'SELECT * FROM expenses WHERE 1=1';
  const params: any[] = [];
  
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  
  if (startDate) {
    sql += ' AND date >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    sql += ' AND date <= ?';
    params.push(endDate);
  }
  
  sql += ' ORDER BY date DESC';
  
  if (limit > 0) {
    sql += ' LIMIT ?';
    params.push(limit);
  }
  
  const rawExpenses = await db.getAllAsync<any>(sql, ...params);
  return rawExpenses;
}

/**
 * Generates an aggregated summary of expenses within a date range, grouped by category.
 */
export async function getExpenseSummary(
  startDate?: string,
  endDate?: string
): Promise<ExpenseSummary> {
  const db = await getDatabase();
  let sql = `
    SELECT category, SUM(amount) as total_amount, COUNT(id) as count
    FROM expenses
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (startDate) {
    sql += ' AND date >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    sql += ' AND date <= ?';
    params.push(endDate);
  }
  
  sql += ' GROUP BY category ORDER BY total_amount DESC';
  
  const items = await db.getAllAsync<ExpenseSummaryItem>(sql, ...params);
  
  const grandTotal = items.reduce((sum, item) => sum + item.total_amount, 0);
  
  return {
    items,
    grand_total: grandTotal
  };
}

/**
 * Deletes an expense by its ID.
 */
export async function deleteExpense(id: number): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.runAsync('DELETE FROM expenses WHERE id = ?', id);
  return result.changes > 0;
}
