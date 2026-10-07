import { getDatabase } from './db';

export interface ScheduleTimeBlock {
  id: string;
  time: string; // e.g. "08:00 AM"
  activity: string; // e.g. "Standup & Daily Planning"
}

export interface DaySchedule {
  dayName: string; // "Monday", "Tuesday", etc.
  blocks: ScheduleTimeBlock[];
}

export interface PlanItem {
  id: number;
  title: string;
  description?: string | null;
  due_date?: string | null;
  due_time?: string | null;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  status: 'pending' | 'completed';
  category: string;
  plan_type?: 'task' | 'schedule';
  days_duration?: number;
  repeat_weekly?: number;
  schedule_data?: string | null; // JSON string of DaySchedule[]
  created_at: string;
  updated_at: string;
}

export interface CreatePlanInput {
  title: string;
  description?: string;
  due_date?: string;
  due_time?: string;
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  category?: string;
  plan_type?: 'task' | 'schedule';
  days_duration?: number;
  repeat_weekly?: number;
  schedule_data?: string;
}

/**
 * Creates a new plan item in SQLite.
 */
export async function createPlan(input: CreatePlanInput): Promise<PlanItem> {
  const db = await getDatabase();
  const title = input.title.trim();
  const description = input.description?.trim() || null;
  const dueDate = input.due_date || null;
  const dueTime = input.due_time || null;
  const priority = input.priority || 'normal';
  const category = input.category || 'task';
  const planType = input.plan_type || 'task';
  const daysDuration = Math.min(Math.max(input.days_duration || 1, 1), 7);
  const repeatWeekly = input.repeat_weekly ? 1 : 0;
  const scheduleData = input.schedule_data || null;

  const result = await db.runAsync(
    `INSERT INTO plans (title, description, due_date, due_time, priority, status, category, plan_type, days_duration, repeat_weekly, schedule_data)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
    [title, description, dueDate, dueTime, priority, category, planType, daysDuration, repeatWeekly, scheduleData]
  );

  const row = await db.getFirstAsync<PlanItem>(
    'SELECT * FROM plans WHERE id = ?',
    [result.lastInsertRowId]
  );

  if (!row) {
    throw new Error('Failed to retrieve newly created plan.');
  }

  return row;
}

/**
 * Lists all plans with optional status filtering.
 */
export async function listPlans(statusFilter?: 'pending' | 'completed'): Promise<PlanItem[]> {
  const db = await getDatabase();
  if (statusFilter) {
    return await db.getAllAsync<PlanItem>(
      'SELECT * FROM plans WHERE status = ? ORDER BY CASE priority WHEN "urgent" THEN 1 WHEN "high" THEN 2 WHEN "normal" THEN 3 ELSE 4 END, due_date ASC, id DESC',
      [statusFilter]
    );
  }

  return await db.getAllAsync<PlanItem>(
    'SELECT * FROM plans ORDER BY CASE status WHEN "pending" THEN 0 ELSE 1 END, CASE priority WHEN "urgent" THEN 1 WHEN "high" THEN 2 WHEN "normal" THEN 3 ELSE 4 END, due_date ASC, id DESC'
  );
}

/**
 * Toggles a plan between 'pending' and 'completed'.
 */
export async function togglePlanStatus(id: number, currentStatus: string): Promise<void> {
  const db = await getDatabase();
  const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';
  await db.runAsync(
    'UPDATE plans SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [nextStatus, id]
  );
}

/**
 * Updates a plan item's attributes.
 */
export async function updatePlan(
  id: number,
  updates: Partial<CreatePlanInput & { status: 'pending' | 'completed' }>
): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = [];
  const params: any[] = [];

  if (updates.title !== undefined) {
    sets.push('title = ?');
    params.push(updates.title.trim());
  }
  if (updates.description !== undefined) {
    sets.push('description = ?');
    params.push(updates.description.trim() || null);
  }
  if (updates.due_date !== undefined) {
    sets.push('due_date = ?');
    params.push(updates.due_date || null);
  }
  if (updates.due_time !== undefined) {
    sets.push('due_time = ?');
    params.push(updates.due_time || null);
  }
  if (updates.priority !== undefined) {
    sets.push('priority = ?');
    params.push(updates.priority);
  }
  if (updates.status !== undefined) {
    sets.push('status = ?');
    params.push(updates.status);
  }
  if (updates.category !== undefined) {
    sets.push('category = ?');
    params.push(updates.category);
  }
  if (updates.plan_type !== undefined) {
    sets.push('plan_type = ?');
    params.push(updates.plan_type);
  }
  if (updates.days_duration !== undefined) {
    sets.push('days_duration = ?');
    params.push(Math.min(Math.max(updates.days_duration, 1), 7));
  }
  if (updates.repeat_weekly !== undefined) {
    sets.push('repeat_weekly = ?');
    params.push(updates.repeat_weekly ? 1 : 0);
  }
  if (updates.schedule_data !== undefined) {
    sets.push('schedule_data = ?');
    params.push(updates.schedule_data);
  }

  if (sets.length === 0) return;

  sets.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  await db.runAsync(
    `UPDATE plans SET ${sets.join(', ')} WHERE id = ?`,
    params
  );
}

/**
 * Deletes a plan item from SQLite.
 */
export async function deletePlan(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM plans WHERE id = ?', [id]);
}
