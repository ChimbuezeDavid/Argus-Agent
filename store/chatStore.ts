// Zustand store for managing chat history, conversations, and agent execution loop
import { create } from 'zustand';
import { getDatabase } from '../services/database/db';
import { runAgentConversation } from '../services/agent/client';

export interface Message {
  id?: number;
  conversation_id: number;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: string;
  tool_calls?: string; // JSON string representing array of { name: string, args: any }
  tool_results?: string; // JSON string representing array of { name: string, result: any }
}

export interface Conversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: number | null;
  messages: Message[];
  statusMessage: string; // 'Thinking...', 'Running tool_name...', etc.
  isLoading: boolean;
  
  // Actions
  loadConversations: () => Promise<void>;
  selectConversation: (id: number) => Promise<void>;
  startNewConversation: () => Promise<number>;
  deleteConversation: (id: number) => Promise<void>;
  sendMessage: (content: string, geminiModel: string) => Promise<void>;
  clearActiveConversation: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  statusMessage: '',
  isLoading: false,

  loadConversations: async () => {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<Conversation>(
        'SELECT * FROM conversations ORDER BY updated_at DESC'
      );
      set({ conversations: rows });
      
      // If there are conversations but no active one, auto-select the latest
      if (rows.length > 0 && get().activeConversationId === null) {
        await get().selectConversation(rows[0].id);
      } else if (rows.length === 0) {
        // Automatically start a new one if none exists
        await get().startNewConversation();
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  },

  selectConversation: async (id: number) => {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<any>(
        'SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC',
        id
      );
      
      const formattedMessages = rows.map(r => ({
        ...r,
        // Ensure field names match interface
      }));
      
      set({ activeConversationId: id, messages: formattedMessages });
    } catch (error) {
      console.error(`Failed to load messages for conversation ${id}:`, error);
    }
  },

  startNewConversation: async () => {
    try {
      const db = await getDatabase();
      const result = await db.runAsync(
        'INSERT INTO conversations (title, created_at, updated_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        'New Conversation'
      );
      
      const newId = result.lastInsertRowId;
      await get().loadConversations();
      await get().selectConversation(newId);
      return newId;
    } catch (error) {
      console.error('Failed to create new conversation:', error);
      throw error;
    }
  },

  deleteConversation: async (id: number) => {
    try {
      const db = await getDatabase();
      await db.runAsync('DELETE FROM conversations WHERE id = ?', id);
      
      let nextActiveId: number | null = null;
      const updatedConversations = get().conversations.filter(c => c.id !== id);
      
      if (updatedConversations.length > 0) {
        nextActiveId = updatedConversations[0].id;
      }
      
      set({ conversations: updatedConversations, activeConversationId: nextActiveId });
      
      if (nextActiveId !== null) {
        await get().selectConversation(nextActiveId);
      } else {
        await get().startNewConversation();
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  },

  sendMessage: async (content: string, geminiModel: string) => {
    let convId = get().activeConversationId;
    if (convId === null) {
      convId = await get().startNewConversation();
    }
    
    const db = await getDatabase();
    
    // 1. Create and save User Message
    const userMsgSql = `
      INSERT INTO messages (conversation_id, role, content, timestamp)
      VALUES (?, 'user', ?, CURRENT_TIMESTAMP)
    `;
    const userMsgResult = await db.runAsync(userMsgSql, convId, content);
    const userMessage: Message = {
      id: userMsgResult.lastInsertRowId,
      conversation_id: convId,
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    };
    
    // Update store state with user message immediately
    const updatedMessages = [...get().messages, userMessage];
    set({ messages: updatedMessages, isLoading: true });
    
    // Update conversation title if it was the first message
    if (updatedMessages.filter(m => m.role === 'user').length === 1) {
      const title = content.slice(0, 30) + (content.length > 30 ? '...' : '');
      await db.runAsync('UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', title, convId);
      await get().loadConversations();
    } else {
      await db.runAsync('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', convId);
    }
    
    try {
      // 2. Run agent interaction (includes tool calling loop)
      const agentResult = await runAgentConversation(
        updatedMessages,
        geminiModel,
        (status) => set({ statusMessage: status })
      );
      
      // 3. Save Assistant Message (combining text response and tool execution steps)
      let toolCallsJson = '';
      let toolResultsJson = '';
      
      if (agentResult.toolSteps.length > 0) {
        // Aggregate all tool calls and results across turns
        const allCalls = agentResult.toolSteps.flatMap(step => step.tool_calls);
        const allResults = agentResult.toolSteps.flatMap(step => step.tool_results);
        
        toolCallsJson = JSON.stringify(allCalls);
        toolResultsJson = JSON.stringify(allResults);
      }
      
      const assistantMsgSql = `
        INSERT INTO messages (conversation_id, role, content, tool_calls, tool_results, timestamp)
        VALUES (?, 'model', ?, ?, ?, CURRENT_TIMESTAMP)
      `;
      const assistantMsgResult = await db.runAsync(
        assistantMsgSql,
        convId,
        agentResult.content,
        toolCallsJson || null,
        toolResultsJson || null
      );
      
      const assistantMessage: Message = {
        id: assistantMsgResult.lastInsertRowId,
        conversation_id: convId,
        role: 'model',
        content: agentResult.content,
        tool_calls: toolCallsJson || undefined,
        tool_results: toolResultsJson || undefined,
        timestamp: new Date().toISOString()
      };
      
      set({
        messages: [...get().messages, assistantMessage],
        statusMessage: '',
        isLoading: false
      });
      
    } catch (error: any) {
      console.error('Error during agent execution:', error);
      
      let errorMessage = 'An error occurred while communicating with Gemini.';
      if (error.message === 'API_KEY_MISSING') {
        errorMessage = 'Please set your Gemini API key in Settings (tap the ⚙️ icon in the top right).';
      } else if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('API key not valid')) {
        errorMessage = 'Invalid Gemini API Key. Please verify the key you pasted in Settings.';
      } else if (error.message?.includes('404') || error.message?.includes('models/')) {
        errorMessage = `Model '${geminiModel}' not found or unavailable. Please check the Model Identifier in Settings (e.g. gemini-1.5-flash).`;
      } else if (error.message) {
        errorMessage = `Gemini Error: ${error.message}`;
      }
      
      const errorMsgSql = `
        INSERT INTO messages (conversation_id, role, content, timestamp)
        VALUES (?, 'model', ?, CURRENT_TIMESTAMP)
      `;
      const errorMsgResult = await db.runAsync(errorMsgSql, convId, errorMessage);
      
      const assistantMessage: Message = {
        id: errorMsgResult.lastInsertRowId,
        conversation_id: convId,
        role: 'model',
        content: errorMessage,
        timestamp: new Date().toISOString()
      };
      
      set({
        messages: [...get().messages, assistantMessage],
        statusMessage: '',
        isLoading: false
      });
    }
  },

  clearActiveConversation: () => {
    set({ activeConversationId: null, messages: [] });
  }
}));
