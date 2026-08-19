// Repository for tracking completed Habit Stacking (HS) entries
import { getDatabase } from './db';

export interface HabitCompletion {
  id: number;
  geofence_id?: number;
  location_name: string;
  habit_text: string;
  event_type: 'enter' | 'exit';
  completed_at: string;
}

/**
 * Records a successful habit completion.
 */
export async function recordHabitCompletion(
  locationName: string,
  habitText: string,
  eventType: 'enter' | 'exit',
  geofenceId?: number
): Promise<HabitCompletion> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const res = await db.runAsync(
    `INSERT INTO habit_completions (geofence_id, location_name, habit_text, event_type, completed_at)
     VALUES (?, ?, ?, ?, ?)`,
    geofenceId ?? null,
    locationName,
    habitText,
    eventType,
    now
  );

  return {
    id: res.lastInsertRowId,
    geofence_id: geofenceId,
    location_name: locationName,
    habit_text: habitText,
    event_type: eventType,
    completed_at: now,
  };
}

/**
 * Lists the latest habit completions.
 */
export async function listHabitCompletions(limit: number = 30): Promise<HabitCompletion[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    geofence_id: number | null;
    location_name: string;
    habit_text: string;
    event_type: string;
    completed_at: string;
  }>('SELECT id, geofence_id, location_name, habit_text, event_type, completed_at FROM habit_completions ORDER BY completed_at DESC LIMIT ?', limit);

  return rows.map((r) => ({
    id: r.id,
    geofence_id: r.geofence_id || undefined,
    location_name: r.location_name,
    habit_text: r.habit_text,
    event_type: r.event_type as 'enter' | 'exit',
    completed_at: r.completed_at,
  }));
}
