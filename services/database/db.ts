// Database connection management and automatic schema migration for Argus Agent
import * as SQLite from 'expo-sqlite';
import { INITIAL_SCHEMA } from './schema';

let databaseInstance: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Runs automatic non-destructive schema migrations for existing databases.
 */
async function runAutoMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  try {
    // 1. Enable WAL mode for high concurrency and zero-lock reads/writes
    await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

    // 2. Ensure initial schema base tables exist
    await db.execAsync(INITIAL_SCHEMA);

    // 3. Safely add missing columns to expenses table if upgraded from older DB versions
    try {
      const tableInfo = await db.getAllAsync<{ name: string }>('PRAGMA table_info(expenses);');
      const existingCols = new Set(tableInfo.map((c) => c.name));

      if (!existingCols.has('status')) {
        await db.execAsync("ALTER TABLE expenses ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed';");
      }
      if (!existingCols.has('raw_merchant')) {
        await db.execAsync('ALTER TABLE expenses ADD COLUMN raw_merchant TEXT;');
      }
      if (!existingCols.has('currency')) {
        await db.execAsync("ALTER TABLE expenses ADD COLUMN currency TEXT NOT NULL DEFAULT 'NGN';");
      }
      if (!existingCols.has('type')) {
        await db.execAsync("ALTER TABLE expenses ADD COLUMN type TEXT NOT NULL DEFAULT 'debit';");
      }

      const gfInfo = (await db.getAllAsync('PRAGMA table_info(geofences);')) as any[];
      const gfCols = new Set(gfInfo.map((c) => c.name));
      if (!gfCols.has('enter_habit')) {
        await db.execAsync("ALTER TABLE geofences ADD COLUMN enter_habit TEXT;");
      }
      if (!gfCols.has('exit_habit')) {
        await db.execAsync("ALTER TABLE geofences ADD COLUMN exit_habit TEXT;");
      }

      const plansInfo = (await db.getAllAsync('PRAGMA table_info(plans);')) as any[];
      const plansCols = new Set(plansInfo.map((c) => c.name));
      if (!plansCols.has('plan_type')) {
        await db.execAsync("ALTER TABLE plans ADD COLUMN plan_type TEXT NOT NULL DEFAULT 'task';");
      }
      if (!plansCols.has('days_duration')) {
        await db.execAsync("ALTER TABLE plans ADD COLUMN days_duration INTEGER DEFAULT 1;");
      }
      if (!plansCols.has('repeat_weekly')) {
        await db.execAsync("ALTER TABLE plans ADD COLUMN repeat_weekly INTEGER DEFAULT 0;");
      }
      if (!plansCols.has('schedule_data')) {
        await db.execAsync("ALTER TABLE plans ADD COLUMN schedule_data TEXT;");
      }
    } catch (colErr) {
      console.warn('[SQLite AutoMigration] Column check error:', colErr);
    }
    // 4. Ensure Context Vault has default memories populated
    try {
      const { contextVaultRepo } = require('./contextVaultRepo');
      await contextVaultRepo.seedDefaultsIfEmpty(db);
    } catch (e) {
      console.warn('[SQLite AutoMigration] Non-fatal default seed warning:', e);
    }
  } catch (err) {
    console.warn('[SQLite AutoMigration] Non-fatal migration warning:', err);
  }
}

/**
 * Returns the active SQLite database instance.
 * Guarantees single-flight initialization and avoids native NPE race conditions.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (databaseInstance) {
    return databaseInstance;
  }

  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      let lastErr: any = null;
      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          const db = await SQLite.openDatabaseAsync('argus.db');
          // Assign instance immediately so re-entrant calls within migrations resolve without deadlock
          databaseInstance = db;
          await runAutoMigrations(db);
          return db;
        } catch (err) {
          databaseInstance = null;
          lastErr = err;
          console.warn(`[SQLite] Initialization attempt ${attempt} failed:`, err);
          if (attempt < 4) {
            await new Promise((res) => setTimeout(res, 120 * attempt));
          }
        }
      }
      dbInitPromise = null;
      throw lastErr || new Error('Failed to initialize SQLite database');
    })();
  }

  return await dbInitPromise;
}

/**
 * Persists a key-value setting row with retry on lock/initialization.
 */
export async function saveSetting(key: string, value: string): Promise<boolean> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const db = await getDatabase();
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
      return true;
    } catch (err) {
      if (attempt === 3) {
        console.error(`[SQLite saveSetting] Failed to save setting "${key}":`, err);
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, 80 * attempt));
    }
  }
  return false;
}

/**
 * Initializes the database tables by executing the schema setup commands.
 */
export async function initializeDatabase(): Promise<void> {
  try {
    await getDatabase();
    console.log('[SQLite] Database schema verified and migrated successfully.');
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
    throw error;
  }
}
