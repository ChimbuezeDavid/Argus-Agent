// Repository for Agent Self-Correction & Learned User Preferences
import { getDatabase } from './db';

export interface LearnedRule {
  id: number;
  rule_text: string;
  category: string;
  is_active: boolean;
  created_at: string;
}

/**
 * Adds a new learned rule or user preference.
 */
export async function addLearnedRule(ruleText: string, category: string = 'general'): Promise<LearnedRule> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const res = await db.runAsync(
    'INSERT INTO agent_learned_rules (rule_text, category, is_active, created_at) VALUES (?, ?, 1, ?)',
    ruleText.trim(),
    category.trim(),
    now
  );
  return {
    id: res.lastInsertRowId,
    rule_text: ruleText.trim(),
    category: category.trim(),
    is_active: true,
    created_at: now,
  };
}

/**
 * Lists all active learned rules to inject into the Agent system prompt.
 */
export async function listActiveLearnedRules(): Promise<LearnedRule[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    rule_text: string;
    category: string;
    is_active: number;
    created_at: string;
  }>('SELECT id, rule_text, category, is_active, created_at FROM agent_learned_rules WHERE is_active = 1 ORDER BY created_at DESC');

  return rows.map((r) => ({
    id: r.id,
    rule_text: r.rule_text,
    category: r.category,
    is_active: r.is_active === 1,
    created_at: r.created_at,
  }));
}

/**
 * Deletes a learned rule by ID.
 */
export async function deleteLearnedRule(id: number): Promise<boolean> {
  const db = await getDatabase();
  const res = await db.runAsync('DELETE FROM agent_learned_rules WHERE id = ?', id);
  return res.changes > 0;
}
