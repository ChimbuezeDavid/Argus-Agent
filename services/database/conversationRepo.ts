// Conversation and message history repository for Argus Agent
// Strictly adheres to Standard Chat Lifecycle: Unsent/Empty drafts are never persisted.
import { getDatabase } from './db';

export interface Conversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_message?: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: any[];
  toolResults?: any[];
}

/**
 * Creates a new conversation thread in the database.
 * Only called when the first message is actually sent.
 */
export async function createConversation(title: string = 'New Conversation'): Promise<Conversation> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO conversations (title, created_at, updated_at) VALUES (?, ?, ?)`,
    title,
    now,
    now
  );

  return {
    id: result.lastInsertRowId,
    title,
    created_at: now,
    updated_at: now,
    message_count: 0,
    last_message: '',
  };
}

/**
 * Lists all active conversations that have at least 1 message, ordered by most recently updated.
 * Automatically cleans up any empty ghost conversations.
 */
export async function listConversations(limit: number = 50): Promise<Conversation[]> {
  const db = await getDatabase();

  // Prune any empty ghost conversations with 0 messages
  try {
    await db.runAsync(`
      DELETE FROM conversations 
      WHERE id NOT IN (SELECT DISTINCT conversation_id FROM messages)
    `);
  } catch (e) {
    // ignore
  }

  const rows = await db.getAllAsync<{
    id: number;
    title: string;
    created_at: string;
    updated_at: string;
    message_count: number;
    last_message: string | null;
  }>(`
    SELECT 
      c.id, 
      c.title, 
      c.created_at, 
      c.updated_at,
      COUNT(m.id) as message_count,
      (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY timestamp DESC LIMIT 1) as last_message
    FROM conversations c
    INNER JOIN messages m ON m.conversation_id = c.id
    GROUP BY c.id
    ORDER BY c.updated_at DESC
    LIMIT ?
  `, limit);

  return rows.map(r => ({
    id: r.id,
    title: r.title || 'Conversation',
    created_at: r.created_at,
    updated_at: r.updated_at,
    message_count: r.message_count || 0,
    last_message: r.last_message || undefined,
  }));
}

/**
 * Retrieves all messages for a specific conversation ID.
 */
export async function getConversationMessages(conversationId: number): Promise<ConversationMessage[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    conversation_id: number;
    role: string;
    content: string;
    timestamp: string;
    tool_calls: string | null;
    tool_results: string | null;
  }>(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC',
    conversationId
  );

  return rows.map(r => ({
    id: r.id.toString(),
    conversation_id: r.conversation_id,
    role: r.role === 'model' || r.role === 'assistant' ? 'assistant' : 'user',
    content: r.content,
    timestamp: r.timestamp,
    toolCalls: r.tool_calls ? JSON.parse(r.tool_calls) : undefined,
    toolResults: r.tool_results ? JSON.parse(r.tool_results) : undefined,
  }));
}

/**
 * Adds a message to a conversation.
 */
export async function addMessage(
  conversationId: number,
  role: 'user' | 'assistant',
  content: string,
  toolCalls?: any,
  toolResults?: any
): Promise<ConversationMessage> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const dbRole = role === 'assistant' ? 'model' : 'user';

  // Ensure parent conversation row exists to satisfy FOREIGN KEY constraint
  const existingConv = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM conversations WHERE id = ?',
    conversationId
  );
  if (!existingConv) {
    const defaultTitle = content.slice(0, 32).trim() + (content.length > 32 ? '...' : '') || 'New Conversation';
    await db.runAsync(
      'INSERT OR IGNORE INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
      conversationId,
      defaultTitle,
      now,
      now
    );
  }

  const result = await db.runAsync(
    `INSERT INTO messages (conversation_id, role, content, timestamp, tool_calls, tool_results) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    conversationId,
    dbRole,
    content,
    now,
    toolCalls ? JSON.stringify(toolCalls) : null,
    toolResults ? JSON.stringify(toolResults) : null
  );

  // Update conversation updated_at
  await db.runAsync(
    'UPDATE conversations SET updated_at = ? WHERE id = ?',
    now,
    conversationId
  );

  // Auto-generate title from first user message if title is still 'New Conversation'
  if (role === 'user') {
    const conv = await db.getFirstAsync<{ title: string }>(
      'SELECT title FROM conversations WHERE id = ?',
      conversationId
    );
    if (conv && (conv.title === 'New Conversation' || !conv.title)) {
      const generatedTitle = content.slice(0, 32).trim() + (content.length > 32 ? '...' : '');
      await db.runAsync(
        'UPDATE conversations SET title = ? WHERE id = ?',
        generatedTitle,
        conversationId
      );
    }
  }

  return {
    id: result.lastInsertRowId.toString(),
    conversation_id: conversationId,
    role,
    content,
    timestamp: now,
    toolCalls,
    toolResults,
  };
}

/**
 * Gets the latest active conversation that has messages, or null if none exist.
 */
export async function getLatestActiveConversation(): Promise<Conversation | null> {
  const db = await getDatabase();
  const latest = await db.getFirstAsync<{
    id: number;
    title: string;
    created_at: string;
    updated_at: string;
  }>(`
    SELECT c.id, c.title, c.created_at, c.updated_at 
    FROM conversations c
    INNER JOIN messages m ON m.conversation_id = c.id
    ORDER BY c.updated_at DESC 
    LIMIT 1
  `);

  return latest || null;
}

/**
 * Deletes a conversation and its messages.
 */
export async function deleteConversation(conversationId: number): Promise<boolean> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM messages WHERE conversation_id = ?', conversationId);
  const res = await db.runAsync('DELETE FROM conversations WHERE id = ?', conversationId);
  return res.changes > 0;
}
