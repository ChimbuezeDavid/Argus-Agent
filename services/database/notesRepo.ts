// Repository layer for notes management in SQLite
import { getDatabase } from './db';

export interface Note {
  id: number;
  title: string;
  content: string;
  tags: string[]; // Decoded JSON array
  is_pinned: boolean; // Mapped from 0/1
  created_at: string;
  updated_at: string;
}

/**
 * Creates a new note in the database.
 */
export async function createNote(
  title: string,
  content: string,
  tags: string[] = [],
  isPinned: boolean = false
): Promise<Note> {
  const db = await getDatabase();
  const tagsJson = JSON.stringify(tags);
  const pinValue = isPinned ? 1 : 0;
  
  const result = await db.runAsync(
    `INSERT INTO notes (title, content, tags, is_pinned, created_at, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    title,
    content,
    tagsJson,
    pinValue
  );
  
  const createdNote = await db.getFirstAsync<any>(
    'SELECT * FROM notes WHERE id = ?',
    result.lastInsertRowId
  );
  
  if (!createdNote) {
    throw new Error('Failed to retrieve newly created note');
  }
  
  return {
    ...createdNote,
    tags: JSON.parse(createdNote.tags || '[]'),
    is_pinned: createdNote.is_pinned === 1,
  };
}

/**
 * Retrieves notes filtered by query (search title/content) or tags.
 */
export async function listNotes(
  query?: string,
  tags?: string[],
  limit: number = 50
): Promise<Note[]> {
  const db = await getDatabase();
  let sql = 'SELECT * FROM notes WHERE 1=1';
  const params: any[] = [];
  
  if (query) {
    sql += ' AND (title LIKE ? OR content LIKE ?)';
    const searchPattern = `%${query}%`;
    params.push(searchPattern, searchPattern);
  }
  
  const rawNotes = await db.getAllAsync<any>(sql, ...params);
  
  // Convert and filter by tags if specified (simple client-side check or SQL JSON check)
  let notes: Note[] = rawNotes.map(row => ({
    ...row,
    tags: JSON.parse(row.tags || '[]'),
    is_pinned: row.is_pinned === 1,
  }));
  
  if (tags && tags.length > 0) {
    notes = notes.filter(note => 
      tags.every(tag => note.tags.includes(tag))
    );
  }
  
  // Sort: pinned first, then updated_at descending
  notes.sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) {
      return a.is_pinned ? -1 : 1;
    }
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
  
  return notes.slice(0, limit);
}

/**
 * Updates an existing note.
 */
export async function updateNote(
  id: number,
  fields: {
    title?: string;
    content?: string;
    tags?: string[];
    isPinned?: boolean;
  }
): Promise<Note | null> {
  const db = await getDatabase();
  const sets: string[] = [];
  const params: any[] = [];
  
  if (fields.title !== undefined) {
    sets.push('title = ?');
    params.push(fields.title);
  }
  if (fields.content !== undefined) {
    sets.push('content = ?');
    params.push(fields.content);
  }
  if (fields.tags !== undefined) {
    sets.push('tags = ?');
    params.push(JSON.stringify(fields.tags));
  }
  if (fields.isPinned !== undefined) {
    sets.push('is_pinned = ?');
    params.push(fields.isPinned ? 1 : 0);
  }
  
  if (sets.length === 0) {
    // Nothing to update
    const current = await db.getFirstAsync<any>('SELECT * FROM notes WHERE id = ?', id);
    if (!current) return null;
    return {
      ...current,
      tags: JSON.parse(current.tags || '[]'),
      is_pinned: current.is_pinned === 1,
    };
  }
  
  sets.push('updated_at = CURRENT_TIMESTAMP');
  
  const sql = `UPDATE notes SET ${sets.join(', ')} WHERE id = ?`;
  params.push(id);
  
  await db.runAsync(sql, ...params);
  
  const updatedNote = await db.getFirstAsync<any>('SELECT * FROM notes WHERE id = ?', id);
  if (!updatedNote) return null;
  
  return {
    ...updatedNote,
    tags: JSON.parse(updatedNote.tags || '[]'),
    is_pinned: updatedNote.is_pinned === 1,
  };
}

/**
 * Deletes a note permanently.
 */
export async function deleteNote(id: number): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.runAsync('DELETE FROM notes WHERE id = ?', id);
  return result.changes > 0;
}
