// Unified Omni-Search & Semantic Memory service for Argus Agent
import { getDatabase } from '@/services/database/db';

export interface OmniSearchResult {
  notes: any[];
  expenses: any[];
  geofences: any[];
  messages: any[];
  totalMatches: number;
}

/**
 * Searches across all database tables (notes, expenses, geofences, conversations) matching the query.
 */
export async function searchOmniVault(query: string, limit: number = 15): Promise<OmniSearchResult> {
  const db = await getDatabase();
  const cleanQ = `%${query.trim()}%`;

  const [notes, expenses, geofences, messages] = await Promise.all([
    // Search Notes
    db.getAllAsync<any>(
      `SELECT id, title, content, tags, is_pinned, updated_at 
       FROM notes 
       WHERE title LIKE ? OR content LIKE ? OR tags LIKE ? 
       ORDER BY updated_at DESC LIMIT ?`,
      cleanQ,
      cleanQ,
      cleanQ,
      limit
    ),

    // Search Expenses
    db.getAllAsync<any>(
      `SELECT id, amount, currency, category, description, date, raw_merchant 
       FROM expenses 
       WHERE description LIKE ? OR category LIKE ? OR raw_merchant LIKE ? 
       ORDER BY date DESC LIMIT ?`,
      cleanQ,
      cleanQ,
      cleanQ,
      limit
    ),

    // Search Geofences
    db.getAllAsync<any>(
      `SELECT id, identifier, radius, enter_habit, exit_habit, is_active 
       FROM geofences 
       WHERE identifier LIKE ? OR enter_habit LIKE ? OR exit_habit LIKE ? 
       ORDER BY created_at DESC LIMIT ?`,
      cleanQ,
      cleanQ,
      cleanQ,
      limit
    ),

    // Search Past Messages
    db.getAllAsync<any>(
      `SELECT m.id, m.conversation_id, m.role, m.content, m.timestamp, c.title as conversation_title
       FROM messages m
       LEFT JOIN conversations c ON c.id = m.conversation_id
       WHERE m.content LIKE ?
       ORDER BY m.timestamp DESC LIMIT ?`,
      cleanQ,
      limit
    ),
  ]);

  const totalMatches = notes.length + expenses.length + geofences.length + messages.length;

  return {
    notes,
    expenses,
    geofences,
    messages,
    totalMatches,
  };
}
