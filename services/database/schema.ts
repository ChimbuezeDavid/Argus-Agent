// SQLite Schema initialization scripts for Argus Agent
export const SCHEMA_VERSION = 2;

export const INITIAL_SCHEMA = `
PRAGMA foreign_keys = ON;

-- 1. Notes Table
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT DEFAULT '[]', -- JSON array of strings
  is_pinned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 2. Notification Events Table
CREATE TABLE IF NOT EXISTS notification_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  package_name TEXT NOT NULL,
  title TEXT,
  text TEXT,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  is_financial INTEGER DEFAULT 0,
  extracted_amount REAL,
  extracted_currency TEXT,
  extracted_category TEXT,
  processed_to_expense INTEGER DEFAULT 0
);

-- 3. Expenses Table (with Confirmation status for Bank alerts)
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  category TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source TEXT NOT NULL, -- 'manual', 'notification_extracted'
  status TEXT NOT NULL DEFAULT 'confirmed', -- 'confirmed', 'unconfirmed'
  raw_merchant TEXT,
  related_notification_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (related_notification_id) REFERENCES notification_events(id) ON DELETE SET NULL
);

-- 4. Monthly Budgets Table (Per-Month Budgets)
CREATE TABLE IF NOT EXISTS monthly_budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_key TEXT NOT NULL, -- Format: YYYY-MM (e.g. 2026-08)
  category TEXT NOT NULL,  -- 'TOTAL' or category name
  budget_limit REAL NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(month_key, category)
);

-- 5. Geofences Table (with Habit Stacking HS support)
CREATE TABLE IF NOT EXISTS geofences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT UNIQUE NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius REAL NOT NULL,
  notify_on_enter INTEGER DEFAULT 1,
  notify_on_exit INTEGER DEFAULT 1,
  enter_habit TEXT,
  exit_habit TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 6. Geofence Events Table
CREATE TABLE IF NOT EXISTS geofence_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  geofence_id INTEGER NOT NULL,
  event_type TEXT NOT NULL, -- 'enter', 'exit'
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (geofence_id) REFERENCES geofences(id) ON DELETE CASCADE
);

-- 7. App Usage Sessions Table
CREATE TABLE IF NOT EXISTS app_usage_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  package_name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 8. Chat Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT DEFAULT 'New Conversation',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 9. Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  role TEXT NOT NULL, -- 'user', 'model', 'system'
  content TEXT NOT NULL,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  tool_calls TEXT, -- JSON array of tool call requests
  tool_results TEXT, -- JSON array of tool results
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- 10. Settings Table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 11. Agent Learned Rules Table (Self-Correction & Feedback Memory)
CREATE TABLE IF NOT EXISTS agent_learned_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_text TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 12. Habit Stacking Completions Table
CREATE TABLE IF NOT EXISTS habit_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  geofence_id INTEGER,
  location_name TEXT NOT NULL,
  habit_text TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'enter', 'exit'
  completed_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 13. Executive Plans & Agenda Table
CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  due_time TEXT,
  priority TEXT NOT NULL DEFAULT 'normal', -- 'urgent', 'high', 'normal', 'low'
  status TEXT NOT NULL DEFAULT 'pending',   -- 'pending', 'completed'
  category TEXT DEFAULT 'task',             -- 'task', 'meeting', 'reminder'
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Default Settings Insertions
INSERT OR IGNORE INTO settings (key, value) VALUES ('gemini_model', 'gemini-3.7-flash');
INSERT OR IGNORE INTO settings (key, value) VALUES ('primary_currency', 'NGN');
INSERT OR IGNORE INTO settings (key, value) VALUES ('geofence_tracking_enabled', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('notifications_tracking_enabled', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('app_usage_tracking_enabled', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('theme_mode', 'system');
INSERT OR IGNORE INTO settings (key, value) VALUES ('text_scale', 'medium');
INSERT OR IGNORE INTO settings (key, value) VALUES ('high_contrast', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('push_notifications_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('alert_budget_warnings', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('alert_bank_transactions', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('alert_geofences', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('alert_daily_summary', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('notification_style', 'sound_and_vibe');
INSERT OR IGNORE INTO settings (key, value) VALUES ('haptic_feedback_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('sound_effects_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('reduce_motion', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('profile_name', 'Argus User');
INSERT OR IGNORE INTO settings (key, value) VALUES ('profile_email', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('analytics_enabled', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('ad_tracking_enabled', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('crash_reporting_enabled', '1');
`;
