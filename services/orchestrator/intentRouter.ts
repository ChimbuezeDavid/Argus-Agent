// Hybrid Intent Router & Orchestrator (Ella vs. Gemini)
// Routes deterministic device commands to Ella Local (<50ms, zero server dependency)
// and routes reasoning/intelligence tasks to Gemini Cloud API.
//
// Enhanced with:
// 1. Multi-Turn Clarification and Repair (slot disambiguation state machine)
// 2. Autonomous Cross-App Task Chaining (Action Macros via macroChains)
// 3. Secure Local Context Vault & Memory Search
// 4. Multimodal Screen Awareness & Accessibility Vision
// 5. Deterministic Local Fallback (offline resilience when cloud is unreachable)

import { executeOfflineAction, OfflineActionResult } from '../actions/offlineDeviceActions';
import { runAgentConversation, AgentConversationResult } from '../agent/client';
import { macroChains, MacroExecutionResult } from './macroChains';
import { contextVaultRepo } from '../database/contextVaultRepo';
import ArgusSystemMonitors from '@/modules/argus-system-monitors';

export type RoutingEngine = 'ella_local' | 'gemini_cloud';
export type RoutingMode = 'auto' | 'ella_local' | 'gemini_cloud';

export interface RoutedCommandResult {
  engine: RoutingEngine;
  handled: boolean;
  content: string;
  latencyMs: number;
  actionType?: string;
  data?: any;
  toolCalls?: any[];
  toolResults?: any[];
}

export interface PendingClarification {
  originalQuery: string;
  actionType: string;
  missingField: string;
  candidates?: string[];
  timestamp: number;
}

// In-memory slot clarification state machine
let pendingClarification: PendingClarification | null = null;

export function getPendingClarification(): PendingClarification | null {
  if (pendingClarification && Date.now() - pendingClarification.timestamp > 45000) {
    pendingClarification = null; // Expire after 45 seconds
  }
  return pendingClarification;
}

export function clearPendingClarification(): void {
  pendingClarification = null;
}

/**
 * Normalizes input text and strips leading wake words or assistant names.
 */
export function normalizeVoiceQuery(text: string): string {
  return text
    .trim()
    .replace(/^(?:hey|hi|hello|ok|okay)?\s*(?:ella|argus|assistant|agent)[,:\s]*/i, '')
    .trim();
}

/**
 * Fast-path check: returns true if query matches a deterministic on-device action
 * or action macro without executing it. Execution latency is sub-1ms.
 */
export function isLocalDeviceIntent(text: string): boolean {
  const clean = normalizeVoiceQuery(text).toLowerCase();
  if (!clean) return false;

  // 1. Action Macros
  if (
    clean.includes('prepare for my meeting') ||
    clean.includes('meeting prep') ||
    clean.includes('meeting mode') ||
    clean.includes('commute mode') ||
    clean.includes('heading home') ||
    clean.includes('navigate home') ||
    clean.includes('focus mode') ||
    clean.includes('deep work') ||
    clean.includes('night routine') ||
    clean.includes('evening debrief')
  ) {
    return true;
  }

  // 2. Multimodal Screen Awareness
  if (
    clean.includes('on my screen') ||
    clean.includes('read screen') ||
    clean.includes('summarize screen') ||
    clean.includes('what am i looking at') ||
    clean.includes('reply with eta')
  ) {
    return true;
  }

  // 3. Music & Media Playback
  if (
    clean.includes('play music') ||
    clean.includes('play audio') ||
    clean.includes('play song') ||
    clean.includes('from vlc') ||
    clean.includes('on vlc') ||
    clean.startsWith('play vlc') ||
    clean.includes('spotify')
  ) {
    return true;
  }

  // 4. Hardware Voice Recording
  if (
    clean.includes('record audio') ||
    clean.includes('start recording') ||
    clean.includes('help me record') ||
    clean.includes('record voice') ||
    clean.includes('record my voice') ||
    clean.includes('stop recording') ||
    clean.includes('finish recording') ||
    clean.includes('save recording')
  ) {
    return true;
  }

  // 5. App Launching
  if (/^(?:open|launch|start|go to)\s+([a-z0-9_\s]+)$/i.test(clean)) {
    return true;
  }

  // 6. Phone Calling
  if (/^(?:call|dial|phone)\s+(?:to\s+)?([a-z0-9_\s+]+)$/i.test(clean)) {
    return true;
  }

  // 7. Notes & Knowledge Vault
  if (
    /^(?:take|save|write|create|make)\s+(?:a\s+)?note(?:\s*:\s*|\s+(?:called|saying|that)\s+)(.+)$/i.test(clean) ||
    /(?:show|list|get|read)\s+(?:my\s+)?notes/i.test(clean) ||
    clean === 'notes'
  ) {
    return true;
  }

  // 8. Budget & Financial Ledger
  if (
    /(?:what(?:'s| is) my budget|budget status|how much.*budget|remaining budget|how much have i spent|total spending)/i.test(clean) ||
    /^(?:log|spent|paid|record)\s+(?:₦|ngn)?\s*([0-9,]+(?:\.[0-9]{1,2})?)\s+(?:for|on)\s+(.+)$/i.test(clean)
  ) {
    return true;
  }

  // 9. Location & Coordinates
  if (/(?:where am i|what(?:'s| is) my location|my current location|current coordinates)/i.test(clean)) {
    return true;
  }

  // 10. System Quick Actions
  if (clean.includes('torch') || clean.includes('flashlight') || clean.includes('screenshot') || clean.includes('alarm') || clean.includes('timer')) {
    return true;
  }

  return false;
}

/**
 * Unified Hybrid Execution Pipeline:
 * 1. Resolves pending multi-turn clarifications if user is replying to a prompt.
 * 2. Checks routing mode (auto, ella_local, gemini_cloud).
 * 3. In auto mode, evaluates Ella Local Intent Classifier (<50ms).
 * 4. Executes action macros (meeting, commute, focus, night) with zero cloud dependency.
 * 5. Injects local Context Vault memories into queries.
 * 6. If cloud fails due to offline connectivity, falls back gracefully to local deterministic response.
 */
export async function routeAndExecuteCommand(
  rawQuery: string,
  mode: RoutingMode = 'auto',
  conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [],
  activeModel: string = 'gemini-3.7-flash'
): Promise<RoutedCommandResult> {
  const startTime = Date.now();
  const cleanQuery = normalizeVoiceQuery(rawQuery);

  // -------------------------------------------------------------
  // STEP 1: Multi-Turn Clarification Resolution
  // -------------------------------------------------------------
  const activeClarification = getPendingClarification();
  if (activeClarification) {
    clearPendingClarification();
    const resolvedTarget = cleanQuery;
    const latencyMs = Math.max(1, Date.now() - startTime);

    if (activeClarification.actionType === 'call') {
      const offlineResult = await executeOfflineAction(`call ${resolvedTarget}`);
      return {
        engine: 'ella_local',
        handled: true,
        content: `Clarification resolved. ${offlineResult.message}`,
        latencyMs,
        actionType: 'call_resolved',
      };
    }

    if (activeClarification.actionType === 'expense') {
      const offlineResult = await executeOfflineAction(`log ${resolvedTarget}`);
      return {
        engine: 'ella_local',
        handled: true,
        content: `Clarification resolved. ${offlineResult.message}`,
        latencyMs,
        actionType: 'expense_resolved',
      };
    }
  }

  // -------------------------------------------------------------
  // STEP 2: Ambiguity / Incomplete Slot Check (Clarification Trigger)
  // -------------------------------------------------------------
  if (cleanQuery === 'call' || cleanQuery === 'phone' || cleanQuery === 'dial') {
    pendingClarification = {
      originalQuery: cleanQuery,
      actionType: 'call',
      missingField: 'recipient',
      timestamp: Date.now(),
    };
    return {
      engine: 'ella_local',
      handled: true,
      content: 'Who would you like to call?',
      latencyMs: Math.max(1, Date.now() - startTime),
      actionType: 'clarification_prompt',
    };
  }

  if (cleanQuery === 'log expense' || cleanQuery === 'record expense' || cleanQuery === 'add expense') {
    pendingClarification = {
      originalQuery: cleanQuery,
      actionType: 'expense',
      missingField: 'amount_and_category',
      timestamp: Date.now(),
    };
    return {
      engine: 'ella_local',
      handled: true,
      content: 'How much did you spend and on what? (e.g. "5000 on groceries")',
      latencyMs: Math.max(1, Date.now() - startTime),
      actionType: 'clarification_prompt',
    };
  }

  // -------------------------------------------------------------
  // STEP 3: Action Macros (Cross-App Multi-Step Workflows)
  // -------------------------------------------------------------
  if (cleanQuery.includes('prepare for my meeting') || cleanQuery.includes('meeting prep') || cleanQuery.includes('meeting mode')) {
    const macroResult: MacroExecutionResult = await macroChains.executeMeetingPrep();
    const latencyMs = Math.max(1, Date.now() - startTime);
    return {
      engine: 'ella_local',
      handled: true,
      content: macroResult.message,
      latencyMs,
      actionType: 'macro_meeting_prep',
      data: macroResult.data,
      toolCalls: ['macro_meeting_prep'],
    };
  }

  if (cleanQuery.includes('commute mode') || cleanQuery.includes('heading home') || cleanQuery.includes('navigate home')) {
    const macroResult: MacroExecutionResult = await macroChains.executeCommuteMode();
    const latencyMs = Math.max(1, Date.now() - startTime);
    return {
      engine: 'ella_local',
      handled: true,
      content: macroResult.message,
      latencyMs,
      actionType: 'macro_commute_mode',
      data: macroResult.data,
      toolCalls: ['macro_commute_mode'],
    };
  }

  if (cleanQuery.includes('focus mode') || cleanQuery.includes('deep work')) {
    const macroResult: MacroExecutionResult = await macroChains.executeFocusMode();
    const latencyMs = Math.max(1, Date.now() - startTime);
    return {
      engine: 'ella_local',
      handled: true,
      content: macroResult.message,
      latencyMs,
      actionType: 'macro_focus_mode',
      toolCalls: ['macro_focus_mode'],
    };
  }

  if (cleanQuery.includes('night routine') || cleanQuery.includes('evening debrief')) {
    const macroResult: MacroExecutionResult = await macroChains.executeNightRoutine();
    const latencyMs = Math.max(1, Date.now() - startTime);
    return {
      engine: 'ella_local',
      handled: true,
      content: macroResult.message,
      latencyMs,
      actionType: 'macro_night_routine',
      data: macroResult.data,
      toolCalls: ['macro_night_routine'],
    };
  }

  // -------------------------------------------------------------
  // STEP 4: Multimodal Screen Awareness
  // -------------------------------------------------------------
  if (
    cleanQuery.includes('on my screen') ||
    cleanQuery.includes('read screen') ||
    cleanQuery.includes('summarize screen') ||
    cleanQuery.includes('what am i looking at')
  ) {
    try {
      const nodes = await ArgusSystemMonitors.inspectScreenNodes();
      const visibleTexts = nodes
        .map((n) => n.text || n.contentDescription)
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 2);

      const latencyMs = Math.max(1, Date.now() - startTime);
      if (visibleTexts.length === 0) {
        return {
          engine: 'ella_local',
          handled: true,
          content: 'Inspected screen. No readable text elements detected. (Ensure Accessibility RPA Service is enabled).',
          latencyMs,
          actionType: 'screen_read',
        };
      }

      const summary = `Screen content detected (${visibleTexts.length} elements):\n${visibleTexts.slice(0, 8).map((t) => `• ${t}`).join('\n')}`;
      return {
        engine: 'ella_local',
        handled: true,
        content: summary,
        latencyMs,
        actionType: 'screen_read',
        data: { count: visibleTexts.length },
      };
    } catch (e) {
      // Fallback
    }
  }

  // -------------------------------------------------------------
  // STEP 5: Ella Local Offline Intent Engine (<50ms)
  // -------------------------------------------------------------
  if (mode === 'ella_local' || mode === 'auto') {
    const isLocal = isLocalDeviceIntent(cleanQuery);
    if (isLocal || mode === 'ella_local') {
      try {
        const offlineResult: OfflineActionResult = await executeOfflineAction(cleanQuery);
        if (offlineResult.handled) {
          const latencyMs = Math.max(1, Date.now() - startTime);
          return {
            engine: 'ella_local',
            handled: true,
            content: offlineResult.message,
            latencyMs,
            actionType: offlineResult.actionType,
            data: offlineResult.data,
            toolCalls: offlineResult.actionType ? [offlineResult.actionType] : undefined,
          };
        }
      } catch (err: any) {
        console.warn('Ella local execution error:', err);
      }

      if (mode === 'ella_local') {
        const latencyMs = Math.max(1, Date.now() - startTime);
        return {
          engine: 'ella_local',
          handled: false,
          content: 'Ella Local Mode is active (offline device controls only). This prompt requires cloud intelligence. Switch to Auto Route or Gemini AI to process reasoning tasks.',
          latencyMs,
        };
      }
    }
  }

  // -------------------------------------------------------------
  // STEP 6: Context Vault Injection & Gemini Cloud Routing
  // -------------------------------------------------------------
  try {
    // Retrieve relevant context facts from SQLite Context Vault
    const relevantFacts = await contextVaultRepo.searchRelevantFacts(cleanQuery, 3);
    const contextPrefix = relevantFacts.length > 0
      ? `[User Context Vault Memory: ${relevantFacts.map((f) => `${f.key}: ${f.value}`).join('; ')}]\n`
      : '';

    const fullHistory = [
      ...conversationHistory,
      { role: 'user' as const, content: `${contextPrefix}${rawQuery}` },
    ];
    const geminiResponse: AgentConversationResult = await runAgentConversation(
      fullHistory,
      activeModel
    );

    const latencyMs = Math.max(1, Date.now() - startTime);
    return {
      engine: 'gemini_cloud',
      handled: true,
      content: geminiResponse.content,
      latencyMs,
      toolCalls: geminiResponse.toolSteps?.map((s: any) => s.toolCall),
      toolResults: geminiResponse.toolSteps?.map((s: any) => s.result),
    };
  } catch (cloudErr: any) {
    // -------------------------------------------------------------
    // STEP 7: Deterministic Local Fallback (Offline Resilience)
    // -------------------------------------------------------------
    const latencyMs = Math.max(1, Date.now() - startTime);
    console.warn('Cloud API failed or network offline. Falling back to local deterministic engine:', cloudErr);

    // Check if query can be partially answered from local storage
    const localFacts = await contextVaultRepo.searchRelevantFacts(cleanQuery, 4);
    if (localFacts.length > 0) {
      return {
        engine: 'ella_local',
        handled: true,
        content: `⚡ Ella Local (Offline Memory Fallback):\nInternet connection is unavailable. Here is what I know from your local Context Vault:\n${localFacts.map((f) => `• ${f.value}`).join('\n')}`,
        latencyMs,
        actionType: 'offline_memory_fallback',
      };
    }

    return {
      engine: 'ella_local',
      handled: true,
      content: '⚡ Ella Local (Offline Resilience Fallback):\nNetwork connection is currently unavailable. Core device controls, calls, VLC playback, notes, expenses, and action macros continue to work 100% offline.',
      latencyMs,
      actionType: 'offline_fallback',
    };
  }
}
