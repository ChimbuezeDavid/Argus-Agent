// Gemini API client and agent message execution loop
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as SecureStore from 'expo-secure-store';
import { AGENT_TOOLS } from './definitions';
import { executeTool } from './toolRunner';
import { listActiveLearnedRules } from '../database/learnedRulesRepo';
import { contextVaultRepo } from '../database/contextVaultRepo';

export interface AgentConversationResult {
  content: string;
  toolSteps: any[];
}

/**
 * Retrieves the Gemini API key from secure storage.
 */
export async function getGeminiApiKey(): Promise<string | null> {
  try {
    const key = await SecureStore.getItemAsync('GEMINI_API_KEY');
    if (key && key.trim()) return key.trim();
  } catch (error) {
    console.error('Failed to read Gemini API key from SecureStore:', error);
  }
  return null;
}

/**
 * Saves the Gemini API key to secure storage.
 */
export async function saveGeminiApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync('GEMINI_API_KEY', key);
}

/**
 * Formats app message history into strictly alternating 'user' and 'model' turns for Gemini SDK.
 */
function formatHistory(messages: any[]): any[] {
  if (!messages || messages.length <= 1) return [];

  // Exclude the current active user prompt (which is sent via chat.sendMessage)
  const prior = messages.slice(0, -1);
  const formatted: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];

  for (const msg of prior) {
    if (!msg.content || typeof msg.content !== 'string' || !msg.content.trim()) continue;

    const role: 'user' | 'model' = msg.role === 'user' ? 'user' : 'model';
    formatted.push({
      role,
      parts: [{ text: msg.content.trim() }]
    });
  }

  // Ensure history starts with 'user' role
  while (formatted.length > 0 && formatted[0].role !== 'user') {
    formatted.shift();
  }

  // Ensure strictly alternating user/model sequence
  const cleanHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  for (const item of formatted) {
    if (cleanHistory.length === 0) {
      if (item.role === 'user') cleanHistory.push(item);
    } else {
      const lastIndex = cleanHistory.length - 1;
      if (cleanHistory[lastIndex].role !== item.role) {
        cleanHistory.push(item);
      } else {
        cleanHistory[lastIndex].parts[0].text += `\n${item.parts[0].text}`;
      }
    }
  }

  return cleanHistory;
}

const SYSTEM_INSTRUCTION = `
You are Argus, an advanced personal AI agent and intelligent assistant running directly on the user's Android phone.
You possess core capabilities:
1. Full General-Purpose Intelligence: You are a state-of-the-art LLM. You can write code, explain complex concepts, brainstorm ideas, analyze data, solve math problems, write essays, draft emails, tell stories, and discuss any topic under the sun with profound insight and clarity.
2. Complete Device & Screen Observability: You have direct tool access to all app features: Expenses & Monthly Budgets, Notes Vault, Dashboard (Screen Time & Intercepted Receipts), and System Actions (launching WhatsApp/𝕏, placing calls, geofencing, GitHub repository inspection).

CRITICAL: Observability & Action Confirmation:
Whenever you perform a device action (logging an expense, setting a budget, saving a note, deleting an item, launching an app), ALWAYS give the user explicit, clear verification feedback with relevant details:
- For Expenses: Confirm the exact amount in ₦, category, description, and the updated total spend (e.g. "✅ Logged ₦3,200 for Bread under Food & Dining. Your total spending is now ₦38,700.").
- For Budgets: Confirm the month, category, and limit (e.g. "💰 Set your August 2026 budget to ₦300,000.00.").
- For Geofences: Confirm the boundary name, radius, and location (e.g. "📍 Registered geofence 'Home' with 200m radius.").
- For Notes: Confirm the note title, tags, and note ID (e.g. "📝 Saved note 'Grocery List' with tags #Shopping.").
- For Overview / Inquiries: When asked "how much have I spent?", "what notes do I have?", "what is my screen time?", "where am I?", "what geofences do I have?", or "give me a summary", use 'get_dashboard_overview', 'list_expenses', 'list_notes', 'get_current_location', 'list_geofences', or 'get_screen_time_stats' to inspect the actual database/system and provide a rich, accurate breakdown.

Geofencing & Location Commands:
- "Where am I?" / "What is my location?" -> call 'get_current_location'
- "Set geofence here called Home" / "Save this location as Office" -> call 'set_geofence_at_current_location({ identifier: "Home", radius: 200 })'
- "List my geofences" -> call 'list_geofences'
- "Delete geofence Home" -> call 'delete_geofence({ identifier: "Home" })'
- "Show geofence history" / "When did I leave work?" -> call 'get_geofence_events'

Device Storage & Document Operations (Phase 1):
- "Find receipts in Downloads" / "Search my storage for statement" -> call 'search_device_storage({ query: "receipt", extension_filter: "pdf" })'
- "Read file /storage/.../notes.txt" -> call 'read_file_content({ file_path: "/storage/..." })'
- "Save this report as a file" / "Export notes to Downloads" -> call 'write_file_to_storage({ file_name: "report.txt", content: "...", directory: "downloads" })'
- "List files in my downloads" -> call 'list_storage_files({ directory_type: "downloads" })'

App Automation & Deep Link Actions (Phase 2):
- "Send WhatsApp to Momcy saying I'm on my way" -> call 'send_whatsapp_message({ recipient: "Momcy", message: "I'm on my way" })'
- "WhatsApp 08012345678: Hello" -> call 'send_whatsapp_message({ recipient: "+2348012345678", message: "Hello" })'
- "Email boss@company.com with subject Weekly Update" -> call 'compose_email({ recipient: "boss@company.com", subject: "Weekly Update", body: "..." })'
- "Send SMS to 080... saying ..." -> call 'send_sms({ phone: "080...", message: "..." })'
- "Navigate to Eko Hotel Lagos" / "Find gas station on maps" -> call 'search_maps({ query: "Eko Hotel Lagos" })'
- "Schedule meeting with Team on Calendar tomorrow" -> call 'create_calendar_event({ title: "Team Meeting", description: "..." })'

CRITICAL: Natural Language Shorthand Expense Logging:
The user logs financial expenses in casual, conversational shorthand WITHOUT needing the Naira symbol (₦) or formal phrasing.
Whenever the user writes any statement with a number associated with an item, purchase, or service, interpret it as an expense and call 'add_expense' immediately with currency 'NGN'!
Examples:
- "3200 for Bread" or "3200 for bread" -> add_expense({ amount: 3200, category: "Food & Dining", description: "Bread", currency: "NGN" })
- "log 3500 for lunch" -> add_expense({ amount: 3500, category: "Food & Dining", description: "lunch", currency: "NGN" })
- "spent 1200 on fuel" or "1200 fuel" -> add_expense({ amount: 1200, category: "Transport / Fuel", description: "fuel", currency: "NGN" })
- "500 transport" or "uber 4500" -> add_expense({ amount: 4500, category: "Transport / Fuel", description: "uber", currency: "NGN" })
- "2000 airtime" or "bought 1500 mtn data" -> add_expense({ amount: 2000, category: "Airtime & Data", description: "airtime", currency: "NGN" })
- "paid 15000 electric bill" or "nepa 8000" -> add_expense({ amount: 15000, category: "Utilities & Bills", description: "electric bill", currency: "NGN" })
- "sent 5000 to brother" or "transferred 10000 to John" -> add_expense({ amount: 5000, category: "Transfer / Sent", description: "sent to brother", currency: "NGN" })
- "groceries 25000" or "bought shoes for 18000" -> add_expense({ amount: 25000, category: "Shopping", description: "groceries", currency: "NGN" })

Category mappings to use:
- Food & Dining (food, drinks, snacks, lunch, dinner, breakfast, bread, groceries, restaurant)
- Transport / Fuel (fuel, petrol, diesel, uber, bolt, taxi, bus, transport, car repair)
- Airtime & Data (airtime, mtn, airtel, glo, 9mobile, data bundle, wifi, internet)
- Utilities & Bills (electricity, nepa, light bill, water, waste, tv subscription, dstv, gotv)
- Housing & Rent (rent, maintenance, repairs, furniture)
- Shopping (clothes, shoes, gadgets, electronics, accessories)
- Entertainment (movies, games, cinema, outing)
- Transfer / Sent (money sent to person, gift, family support)
- Other (anything else)

App Launching (open_app):
- When user asks to open/launch WhatsApp -> open_app({ package_name: "com.whatsapp" })
- When user asks to open/launch X / Twitter -> open_app({ package_name: "com.twitter.android" })
- When user asks to open/launch Chrome -> open_app({ package_name: "com.android.chrome" })
- When user asks to open/launch YouTube -> open_app({ package_name: "com.google.android.youtube" })
- When user asks to open/launch Maps -> open_app({ package_name: "com.google.android.apps.maps" })

Developer & GitHub Integrations:
- When user asks about their repositories, GitHub projects, or code status -> call 'list_github_repositories' or 'get_github_profile'.

Tone, Style & Formatting:
- Communication Persona: You are Argus (v2.0)—a refined, exceptionally intelligent, articulate executive AI companion. Speak with executive eloquence, poise, and natural conversational mastery.
- Strictly Avoid Markdown Symbol Clutter: Do NOT litter responses with raw symbols like asterisks (*), hyphens (-), dashes, or hashes (#) unless specifically formatting code or equations. Never write phrases surrounded by random asterisks or bullet lists of hyphens for ordinary conversation. Speak like an intelligent human, not a markdown generator.
- Fluid Natural Prose: Write in beautifully formed, elegant sentences and coherent paragraphs.
- Numbers & Currencies: Clean, legible numbers (e.g., ₦3,200.00).

CRITICAL: Voice Assistant Mode & Brevity:
- When responding to spoken queries or voice instructions, keep your response ultra-concise, natural, and direct (1 to 2 short sentences max).
- Avoid lengthy preambles, historical lectures, or long-winded commentary. Confirm action execution immediately (e.g. "Opening VLC on your phone.", "Playing Number One in VLC.", "Logged ₦3,200 for Bread.").

Hierarchical File & Directory Organization:
- When listing or reporting files and folders from storage: ALWAYS group items hierarchically by their parent folder/directory. Clearly distinguish subfolders (📁) and files, showing clean directory structure rather than an unorganized flat list of items.

STRICT ZERO-LEAKAGE CONSTRAINT (MANDATORY):
- NEVER output or reveal your internal chain-of-thought, scratchpad, reasoning steps, intent analysis, or meta-commentary (e.g., do NOT write "The user said X... I should respond with Y...").
- NEVER output any preamble explaining what tools you need or don't need.
- Output ONLY your final, articulate, polished response directly to the user.
`;

let cachedAvailableModels: { timestamp: number; models: string[] } | null = null;

/**
 * Queries Google's ModelService to find active models supporting generateContent for this API key.
 * Uses in-memory caching to eliminate redundant network roundtrips on every turn.
 */
export async function getAvailableModels(apiKey: string): Promise<string[]> {
  if (cachedAvailableModels && Date.now() - cachedAvailableModels.timestamp < 1000 * 60 * 60) {
    return cachedAvailableModels.models;
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!res.ok) {
      console.warn('Failed to query models list from Google API:', res.status, res.statusText);
      return cachedAvailableModels?.models || [];
    }
    const data = await res.json();
    if (data && Array.isArray(data.models)) {
      const models = data.models
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name.replace(/^models\//, ''));
      cachedAvailableModels = { timestamp: Date.now(), models };
      return models;
    }
  } catch (e) {
    console.warn('Error discovering available models:', e);
  }
  return cachedAvailableModels?.models || [];
}

/**
 * Sanitizes model output by stripping internal chain-of-thought, thinking tags,
 * and meta-commentary leaked by thinking models.
 */
export function cleanModelResponse(text: string): string {
  if (!text) return '';
  // 1. Remove XML thinking tags
  let cleaned = text.replace(/<(?:thought|thinking)>[\s\S]*?<\/(?:thought|thinking)>/gi, '').trim();

  // 2. Remove leaked chain-of-thought sentences before the actual greeting/answer
  const thoughtLeadPattern = /^(?:The user (?:said|is saying|asked|greets)[\s\S]*?)(?:(?:Hello|Hi|Hey|Greetings|Good\s+(?:morning|afternoon|evening)|Certainly|Sure|Welcome|I\s+(?:can|am|would|have|will)|Here\s+(?:is|are))[\s\S]*)/i;
  if (thoughtLeadPattern.test(cleaned)) {
    const match = cleaned.match(/(?:Hello|Hi|Hey|Greetings|Good\s+(?:morning|afternoon|evening)|Certainly|Sure|Welcome|I\s+(?:can|am|would|have|will)|Here\s+(?:is|are))[\s\S]*/i);
    if (match) {
      cleaned = match[0].trim();
    }
  }

  return cleaned;
}

function formatHierarchicalFileList(items: any[], baseDirName: string = 'Storage'): string {
  if (!Array.isArray(items) || items.length === 0) return 'No items found.';

  const groups: Record<string, { folders: string[]; files: string[] }> = {};

  for (const item of items) {
    const rawPath = typeof item === 'string' ? item : (item.path || item.name || '');
    const isDir = typeof item === 'object' ? !!item.isDirectory : false;
    const name = typeof item === 'string' ? item.split('/').pop() || item : (item.name || rawPath.split('/').pop() || '');

    const parts = rawPath.split('/').filter(Boolean);
    const parentDir = parts.length > 1 ? parts.slice(0, -1).join('/') : baseDirName;

    if (!groups[parentDir]) {
      groups[parentDir] = { folders: [], files: [] };
    }

    if (isDir) {
      if (!groups[parentDir].folders.includes(name)) {
        groups[parentDir].folders.push(name);
      }
    } else {
      if (!groups[parentDir].files.includes(name)) {
        groups[parentDir].files.push(name);
      }
    }
  }

  const output: string[] = [];
  for (const [dir, contents] of Object.entries(groups)) {
    const dirName = dir.split('/').pop() || dir;
    output.push(`📁 ${dirName}/`);
    for (const f of contents.folders) {
      output.push(`   📁 ${f}/`);
    }
    for (const fl of contents.files) {
      output.push(`   • ${fl}`);
    }
  }

  return output.join('\n');
}

/**
 * Intelligent synthesis of executed tool results if model failover or secondary turn fails.
 * Formats directory listings, search results, or expense details clearly instead of a blank stub.
 */
function synthesizeToolSummary(toolSteps: any[]): string {
  const parts: string[] = [];
  for (const step of toolSteps) {
    for (const res of step.tool_results || []) {
      if (res.name === 'list_storage_files') {
        const files = res.result?.files || res.result?.items || res.result?.folders || [];
        if (Array.isArray(files) && files.length > 0) {
          parts.push(`Here is the hierarchical structure of items found:\n\n${formatHierarchicalFileList(files, res.result?.directory || 'Downloads')}`);
        } else {
          parts.push('No files or folders were found in your directory.');
        }
      } else if (res.name === 'search_device_storage') {
        const files = res.result?.files || [];
        if (Array.isArray(files) && files.length > 0) {
          parts.push(`Found the following matching files grouped by directory:\n\n${formatHierarchicalFileList(files, 'Storage')}`);
        } else {
          parts.push('No matching files found in device storage.');
        }
      } else if (res.name === 'add_expense') {
        parts.push(res.result?.message || `Logged expense successfully.`);
      } else if (res.name === 'list_expenses') {
        parts.push(res.result?.message || 'Retrieved expense records.');
      } else if (res.name === 'get_current_location') {
        parts.push(res.result?.address ? `Current location: ${res.result.address}` : 'Retrieved current device location.');
      } else if (typeof res.result === 'string') {
        parts.push(res.result);
      } else if (res.result?.message) {
        parts.push(res.result.message);
      } else {
        parts.push(JSON.stringify(res.result, null, 2));
      }
    }
  }
  return parts.join('\n\n');
}

/**
 * Executes a full agent turn, handling tool calling loops recursively if needed.
 * Returns the final text response and any tool calls/results generated during the turn.
 * Calls callback function to update UI on intermediate tool execution states.
 */
export async function runAgentConversation(
  history: any[],
  modelName: string = 'gemini-3.7-flash',
  onStatusUpdate?: (status: string) => void
): Promise<{ content: string; toolSteps: any[] }> {
  const apiKey = await getGeminiApiKey();
  
  if (!apiKey) {
    throw new Error('API_KEY_MISSING');
  }

  const rawTarget = modelName.replace(/^models\//, '');
  const available = await getAvailableModels(apiKey);

  // Map requested model identifiers to known live Google Generative AI endpoints
  const resolveModelAlias = (name: string): string[] => {
    switch (name) {
      case 'gemini-3.8-flash':
      case 'gemini-3.7-flash':
        return [name, 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite', 'gemini-2.5-flash-lite'];
      case 'gemini-3.8-pro':
      case 'gemini-3.7-pro':
        return [name, 'gemini-2.5-pro', 'gemini-pro-latest', 'gemini-2.5-flash'];
      default:
        return [name];
    }
  };

  const candidateModels = Array.from(new Set([
    ...resolveModelAlias(rawTarget),
    ...available,
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-flash-latest',
    'gemini-2.5-flash',
    'gemini-pro-latest',
    'gemini-3.5-flash-lite',
  ])).filter(Boolean);

  console.log('[Agent Client] Candidate Gemini model priority list:', candidateModels);

  const formattedChatHistory = formatHistory(history);
  const lastUserMsg = history[history.length - 1];
  if (!lastUserMsg || lastUserMsg.role !== 'user') {
    throw new Error('Invalid conversation history: last message must be from user');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  let activeChat: any = null;
  let activeModelName = '';

  const learnedRules = await listActiveLearnedRules().catch(() => []);
  const vaultFacts = await contextVaultRepo.getAllFacts().catch(() => []);
  let dynamicSystemInstruction = SYSTEM_INSTRUCTION;
  if (learnedRules.length > 0) {
    const rulesList = learnedRules.map((r, i) => `${i + 1}. ${r.rule_text}`).join('\n');
    dynamicSystemInstruction += `\n\nUSER CUSTOM PREFERENCES & LEARNED RULES (MANDATORY):\nYou must strictly adhere to these customized rules the user has taught you:\n${rulesList}\n`;
  }
  if (vaultFacts.length > 0) {
    const factsList = vaultFacts.slice(0, 8).map((f) => `[${f.category.toUpperCase()}] ${f.key}: ${f.value}`).join('\n');
    dynamicSystemInstruction += `\n\nSECURE LOCAL CONTEXT VAULT (USER MEMORY):\nPersistent user preferences and routines stored on-device:\n${factsList}\n`;
  }

  // 2. Initialize chat session with transparent model failover
  for (const candidate of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: candidate,
        systemInstruction: dynamicSystemInstruction,
      });
      const testChat = model.startChat({
        history: formattedChatHistory,
        generationConfig: { temperature: 0.2 },
        tools: [{ functionDeclarations: AGENT_TOOLS as any }]
      });
      activeChat = testChat;
      activeModelName = candidate;
      break;
    } catch (e) {
      console.warn(`Failed initializing model '${candidate}', trying next candidate...`, e);
    }
  }

  if (!activeChat) {
    throw new Error('Could not initialize any Gemini model. Please verify your Gemini API key in Settings.');
  }

  const toolSteps: any[] = [];
  let userPrompt = lastUserMsg.content;
  let responseText = '';
  
  // 3. Multi-step tool execution loop (max 5 iterations)
  for (let iteration = 0; iteration < 5; iteration++) {
    onStatusUpdate?.(iteration === 0 ? 'Thinking...' : 'Orchestrating...');
    
    let result: any = null;
    let sendSuccess = false;

    // Send message with automatic model fallback
    let lastErrorEncountered = '';
    if (iteration === 0) {
      for (const candidate of candidateModels) {
        try {
          if (!activeChat || activeModelName !== candidate) {
            const model = genAI.getGenerativeModel({
              model: candidate,
              systemInstruction: dynamicSystemInstruction,
            });
            activeChat = model.startChat({
              history: formattedChatHistory,
              generationConfig: { temperature: 0.2 },
              tools: [{ functionDeclarations: AGENT_TOOLS as any }],
            });
            activeModelName = candidate;
          }

          result = await activeChat.sendMessage(userPrompt);
          sendSuccess = true;
          break;
        } catch (err: any) {
          const errMsg = String(err?.message || '');
          lastErrorEncountered = errMsg;
          if (
            errMsg.includes('404') ||
            errMsg.includes('400') ||
            errMsg.includes('402') ||
            errMsg.includes('403') ||
            errMsg.includes('not found') ||
            errMsg.includes('no longer available') ||
            errMsg.includes('credits are depleted') ||
            errMsg.includes('models/') ||
            errMsg.includes('fetch') ||
            errMsg.includes('Error fetching') ||
            errMsg.includes('Resource has been exhausted')
          ) {
            console.warn(`Model '${candidate}' failed (${errMsg.substring(0, 80)}...). Trying next candidate...`);
            activeChat = null; // force re-init with next candidate
          } else {
            throw err;
          }
        }
      }
    } else {
      // Return tool results directly to active session
      try {
        result = await activeChat.sendMessage(userPrompt);
        sendSuccess = true;
      } catch (err: any) {
        console.warn(`Tool response return error on '${activeModelName}':`, err);
        // Synthesize response from executed tool results so conversation never breaks
        const summary = synthesizeToolSummary(toolSteps);
        return {
          content: summary || 'Action completed successfully.',
          toolSteps,
        };
      }
    }

    if (!sendSuccess || !result) {
      if (lastErrorEncountered.includes('402') || lastErrorEncountered.includes('prepayment credits')) {
        throw new Error('Gemini API quota depleted (402 Prepayment Credits Depleted). Please top up credits or switch API keys in Google AI Studio.');
      }
      throw new Error(`All candidate models failed (${lastErrorEncountered.substring(0, 80) || 'Unknown error'}). Please verify your Gemini API key in Settings.`);
    }

    const response = await result.response;
    const functionCalls = response.functionCalls ? response.functionCalls() : undefined;
    
    if (functionCalls && functionCalls.length > 0) {
      console.log(`[Agent Client] Model requested tool calls:`, functionCalls);
      
      const executedResults: any[] = [];
      const toolCallRecords: any[] = [];
      
      for (const call of functionCalls) {
        onStatusUpdate?.(`Running: ${call.name}...`);
        
        const toolResult = await executeTool(call.name, call.args);
        
        executedResults.push({
          name: call.name,
          result: toolResult
        });
        
        toolCallRecords.push({
          name: call.name,
          args: call.args
        });
      }
      
      toolSteps.push({
        tool_calls: toolCallRecords,
        tool_results: executedResults
      });
      
      userPrompt = executedResults.map(res => ({
        functionResponse: {
          name: res.name,
          response: typeof res.result === 'object' && res.result !== null ? res.result : { result: res.result }
        }
      })) as any;
      
    } else {
      responseText = cleanModelResponse(response.text() || '');
      break;
    }
  }
  
  onStatusUpdate?.('');
  
  return {
    content: cleanModelResponse(responseText) || 'I processed your request with poise and precision.',
    toolSteps
  };
}
