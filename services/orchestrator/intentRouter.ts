// Hybrid Intent Router & Orchestrator (Ella vs. Gemini)
// Routes deterministic device commands to Ella Local (<50ms, zero server dependency)
// and routes reasoning/intelligence tasks to Gemini Cloud API.
import { executeOfflineAction, OfflineActionResult } from '../actions/offlineDeviceActions';
import { runAgentConversation, AgentConversationResult } from '../agent/client';
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
 * without executing it. Execution latency is sub-1ms.
 */
export function isLocalDeviceIntent(text: string): boolean {
  const clean = normalizeVoiceQuery(text).toLowerCase();
  if (!clean) return false;

  // 1. Music & Media Playback
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

  // 2. Hardware Voice Recording
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

  // 3. App Launching
  if (/^(?:open|launch|start|go to)\s+([a-z0-9_\s]+)$/i.test(clean)) {
    return true;
  }

  // 4. Phone Calling
  if (/^(?:call|dial|phone)\s+(?:to\s+)?([a-z0-9_\s+]+)$/i.test(clean)) {
    return true;
  }

  // 5. Notes & Knowledge Vault
  if (
    /^(?:take|save|write|create|make)\s+(?:a\s+)?note(?:\s*:\s*|\s+(?:called|saying|that)\s+)(.+)$/i.test(clean) ||
    /(?:show|list|get|read)\s+(?:my\s+)?notes/i.test(clean) ||
    clean === 'notes'
  ) {
    return true;
  }

  // 6. Budget & Financial Ledger
  if (
    /(?:what(?:'s| is) my budget|budget status|how much.*budget|remaining budget|how much have i spent|total spending)/i.test(clean) ||
    /^(?:log|spent|paid|record)\s+(?:₦|ngn)?\s*([0-9,]+(?:\.[0-9]{1,2})?)\s+(?:for|on)\s+(.+)$/i.test(clean)
  ) {
    return true;
  }

  // 7. Location & Coordinates
  if (/(?:where am i|what(?:'s| is) my location|my current location|current coordinates)/i.test(clean)) {
    return true;
  }

  // 8. System Quick Actions
  if (clean.includes('torch') || clean.includes('flashlight') || clean.includes('screenshot')) {
    return true;
  }

  return false;
}

/**
 * Unified Hybrid Execution Pipeline:
 * 1. Checks routing mode (auto, ella_local, gemini_cloud).
 * 2. In auto mode, evaluates Ella Local Intent Classifier first (<50ms).
 * 3. If matched, executes locally with zero server dependency and sub-50ms latency.
 * 4. If not matched, delegates query payload to Gemini Cloud API.
 */
export async function routeAndExecuteCommand(
  rawQuery: string,
  mode: RoutingMode = 'auto',
  conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [],
  activeModel: string = 'gemini-3.7-flash'
): Promise<RoutedCommandResult> {
  const startTime = Date.now();
  const cleanQuery = normalizeVoiceQuery(rawQuery);

  // Mode: ELLA LOCAL ONLY or AUTO (attempt local first)
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

      // If user strictly selected ella_local and it couldn't be parsed:
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

  // Mode: AUTO fallback or GEMINI CLOUD DIRECT
  try {
    const fullHistory = [
      ...conversationHistory,
      { role: 'user' as const, content: rawQuery },
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
    const latencyMs = Math.max(1, Date.now() - startTime);
    throw cloudErr;
  }
}
