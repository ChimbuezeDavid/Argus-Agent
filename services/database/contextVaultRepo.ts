import { getDatabase } from './db';
import type { SQLiteDatabase } from 'expo-sqlite';

export interface ContextVaultItem {
  id: number;
  category: 'preference' | 'routine' | 'entity' | 'fact' | 'macro';
  key: string;
  value: string;
  confidence: number;
  reference_count: number;
  last_accessed_at: string;
  created_at: string;
}

/**
 * ContextVaultRepository
 * Manages secure on-device local memory, preferences, routines, and entities.
 * Stored locally in SQLite with zero cloud leakage.
 */
export const contextVaultRepo = {
  /**
   * Stores or updates a contextual memory fact.
   */
  async storeFact(
    category: 'preference' | 'routine' | 'entity' | 'fact' | 'macro',
    key: string,
    value: string,
    confidence: number = 1.0
  ): Promise<boolean> {
    try {
      const db = await getDatabase();
      await db.runAsync(
        `INSERT INTO context_vault (category, key, value, confidence, reference_count, last_accessed_at)
         VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           category = excluded.category,
           confidence = excluded.confidence,
           reference_count = reference_count + 1,
           last_accessed_at = CURRENT_TIMESTAMP`,
        [category, key.trim().toLowerCase(), value.trim(), confidence]
      );
      return true;
    } catch (e) {
      console.warn('Failed to store context vault fact:', e);
      return false;
    }
  },

  /**
   * Retrieves a single fact by key.
   */
  async getFact(key: string): Promise<ContextVaultItem | null> {
    try {
      const db = await getDatabase();
      const row = await db.getFirstAsync<ContextVaultItem>(
        'SELECT * FROM context_vault WHERE key = ?',
        [key.trim().toLowerCase()]
      );
      if (row) {
        await db.runAsync(
          'UPDATE context_vault SET reference_count = reference_count + 1, last_accessed_at = CURRENT_TIMESTAMP WHERE id = ?',
          [row.id]
        );
      }
      return row || null;
    } catch (e) {
      console.warn('Failed to get context vault fact:', e);
      return null;
    }
  },

  /**
   * Searches for context facts relevant to a given query string (sub-5ms local matching).
   */
  async searchRelevantFacts(query: string, limit: number = 6): Promise<ContextVaultItem[]> {
    try {
      const db = await getDatabase();
      const clean = query.trim().toLowerCase();
      const words = clean.split(/\s+/).filter((w) => w.length > 2);

      if (words.length === 0) {
        return await db.getAllAsync<ContextVaultItem>(
          'SELECT * FROM context_vault ORDER BY reference_count DESC LIMIT ?',
          [limit]
        );
      }

      // SQLite text match across key, value, and category
      const likeClauses = words.map(() => '(key LIKE ? OR value LIKE ? OR category LIKE ?)').join(' OR ');
      const params: string[] = [];
      for (const w of words) {
        const pattern = `%${w}%`;
        params.push(pattern, pattern, pattern);
      }
      params.push(String(limit));

      const rows = await db.getAllAsync<ContextVaultItem>(
        `SELECT * FROM context_vault WHERE ${likeClauses} ORDER BY reference_count DESC LIMIT ?`,
        params
      );
      return rows;
    } catch (e) {
      console.warn('Failed to search context vault:', e);
      return [];
    }
  },

  /**
   * Retrieves all items in the vault, optionally filtered by category.
   */
  async getAllFacts(category?: string): Promise<ContextVaultItem[]> {
    try {
      const db = await getDatabase();
      if (category) {
        return await db.getAllAsync<ContextVaultItem>(
          'SELECT * FROM context_vault WHERE category = ? ORDER BY reference_count DESC',
          [category]
        );
      }
      return await db.getAllAsync<ContextVaultItem>(
        'SELECT * FROM context_vault ORDER BY reference_count DESC'
      );
    } catch (e) {
      console.warn('Failed to get all context vault facts:', e);
      return [];
    }
  },

  /**
   * Deletes a fact by key.
   */
  async deleteFact(key: string): Promise<boolean> {
    try {
      const db = await getDatabase();
      await db.runAsync('DELETE FROM context_vault WHERE key = ?', [key.trim().toLowerCase()]);
      return true;
    } catch (e) {
      console.warn('Failed to delete context vault fact:', e);
      return false;
    }
  },

  /**
   * Seeds foundational default user routines & preferences if empty.
   */
  async seedDefaultsIfEmpty(dbParam?: SQLiteDatabase): Promise<void> {
    try {
      const db = dbParam || (await getDatabase());
      const count = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM context_vault'
      );
      if (count && count.count > 0) return;

      const defaults = [
        {
          category: 'preference' as const,
          key: 'music_player',
          value: 'Prefers VLC Media Player for music and audio playback.',
        },
        {
          category: 'routine' as const,
          key: 'evening_commute',
          value: 'Leaves office around 6:00 PM on weekdays. Commutes home with music.',
        },
        {
          category: 'routine' as const,
          key: 'meeting_prep',
          value: 'Prioritize Do Not Disturb, pull calendar agenda, and prepare meeting notes.',
        },
        {
          category: 'preference' as const,
          key: 'currency',
          value: 'Default currency is NGN (₦). Track daily expense thresholds.',
        },
      ];

      for (const item of defaults) {
        await db.runAsync(
          `INSERT INTO context_vault (category, key, value, confidence, reference_count, last_accessed_at)
           VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
           ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             category = excluded.category,
             confidence = excluded.confidence,
             reference_count = reference_count + 1,
             last_accessed_at = CURRENT_TIMESTAMP`,
          [item.category, item.key.trim().toLowerCase(), item.value.trim(), 1.0]
        );
      }
    } catch (e) {
      console.warn('Failed to seed context vault defaults:', e);
    }
  },
};
