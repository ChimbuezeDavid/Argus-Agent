// Offline Native Device Action Engine for Argus Agent
// Executes device automations directly on-device with zero internet connectivity required.
import { Linking } from 'react-native';
import ArgusSystemMonitors from '@/modules/argus-system-monitors';
import { openApp, placeCall, resolvePackageAlias } from './phoneActions';
import * as notesRepo from '../database/notesRepo';
import * as expensesRepo from '../database/expensesRepo';
import * as budgetRepo from '../database/budgetRepo';
import * as geofenceService from '../observation/geofenceService';
import * as voiceService from '../voice/voiceService';

export interface OfflineActionResult {
  handled: boolean;
  message: string;
  actionType?: string;
  data?: any;
}

/**
 * Normalizes input text by trimming and stripping leading wake words/agent names.
 */
function cleanCommandText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/^(?:hey|hi|hello|ok|okay)?\s*(?:argus|agent)[,:\s]*/i, '')
    .trim();
}

/**
 * Matches and executes offline-capable actions on the Android device.
 * Returns handled: true if an on-device action was successfully performed.
 */
export async function executeOfflineAction(rawText: string): Promise<OfflineActionResult> {
  const clean = cleanCommandText(rawText);
  if (!clean) {
    return { handled: false, message: '' };
  }

  // 1. Music & VLC Media Playback
  if (
    clean.includes('play music') ||
    clean.includes('play audio') ||
    clean.includes('play song') ||
    clean.includes('from vlc') ||
    clean.includes('on vlc') ||
    clean.startsWith('play vlc')
  ) {
    if (clean.includes('vlc')) {
      await openApp('org.videolan.vlc');
      return {
        handled: true,
        actionType: 'media_vlc',
        message: 'Playing media with VLC Player.',
      };
    }
    if (clean.includes('spotify')) {
      await openApp('com.spotify.music');
      return {
        handled: true,
        actionType: 'media_spotify',
        message: 'Opening Spotify to resume your music.',
      };
    }
    // Default to VLC or system music
    await openApp('org.videolan.vlc');
    return {
      handled: true,
      actionType: 'media_player',
      message: 'Launching VLC media playback.',
    };
  }

  // 2. Hardware Audio Recording ("help me record", "start recording", "record audio")
  if (
    clean.includes('help me record') ||
    clean.includes('start recording') ||
    clean.includes('record audio') ||
    clean.includes('record voice') ||
    clean.includes('record my voice')
  ) {
    const res = await voiceService.startHardwareAudioCapture();
    if (res.success) {
      return {
        handled: true,
        actionType: 'audio_record_start',
        message: 'Audio recording started. Say "stop recording" when you are finished.',
      };
    }
    return {
      handled: true,
      actionType: 'audio_record_start',
      message: `Could not start recording: ${res.error || 'Microphone unavailable'}.`,
    };
  }

  // Stop Audio Recording
  if (
    clean.includes('stop recording') ||
    clean.includes('finish recording') ||
    clean.includes('save recording') ||
    clean.includes('end recording')
  ) {
    const audioData = await voiceService.stopHardwareAudioCapture();
    return {
      handled: true,
      actionType: 'audio_record_stop',
      message: audioData
        ? 'Voice recording captured and saved to device memory.'
        : 'Recording stopped.',
    };
  }

  // 3. App Launching ("open whatsapp", "launch chrome", "open camera")
  const openAppMatch = clean.match(/^(?:open|launch|start|go to)\s+([a-z0-9_\s]+)$/i);
  if (openAppMatch) {
    const appName = openAppMatch[1].trim();
    const pkg = resolvePackageAlias(appName);
    await openApp(pkg);
    return {
      handled: true,
      actionType: 'launch_app',
      message: `Opening ${appName.charAt(0).toUpperCase() + appName.slice(1)} on your phone.`,
    };
  }

  // 4. Phone Calling ("call momcy", "dial 08012345678", "call 090...")
  const callMatch = clean.match(/^(?:call|dial|phone)\s+(?:to\s+)?([a-z0-9_\s+]+)$/i);
  if (callMatch) {
    const target = callMatch[1].trim();
    const callRes = await voiceService.executePhoneCall(target);
    return {
      handled: true,
      actionType: 'make_call',
      message: callRes.message,
    };
  }

  // 5. Notes & Vault Management
  const noteSaveMatch = clean.match(/^(?:take|save|write|create|make)\s+(?:a\s+)?note(?:\s*:\s*|\s+(?:called|saying|that)\s+)(.+)$/i);
  if (noteSaveMatch) {
    const content = noteSaveMatch[1].trim();
    const title = content.length > 25 ? `${content.slice(0, 25)}...` : content;
    const note = await notesRepo.createNote(title, content, ['voice', 'quick'], false);
    return {
      handled: true,
      actionType: 'create_note',
      data: note,
      message: `Saved note to your Vault: "${content}".`,
    };
  }

  if (/(?:show|list|get|read)\s+(?:my\s+)?notes/i.test(clean) || clean === 'notes') {
    const list = await notesRepo.listNotes('', undefined, 5);
    if (!list || list.length === 0) {
      return {
        handled: true,
        actionType: 'list_notes',
        message: 'Your Vault has no saved notes yet. Say "take a note: ..." to save one.',
      };
    }
    const titles = list.map((n, i) => `${i + 1}. ${n.title}`).join('\n');
    return {
      handled: true,
      actionType: 'list_notes',
      message: `Here are your recent notes:\n${titles}`,
    };
  }

  // 6. Budget & Financial Overview
  if (/(?:what(?:'s| is) my budget|budget status|how much.*budget|remaining budget|how much have i spent|total spending)/i.test(clean)) {
    const summary = await budgetRepo.getBudgetSummaryForMonth();
    const totalSpent = summary?.totalSpentThisMonth || 0;
    const totalBudget = summary?.totalMonthlyBudget || 0;
    const remaining = summary?.totalRemaining || 0;

    let msg = `You have spent ₦${totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    if (totalBudget > 0) {
      msg += ` out of your ₦${totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })} budget (₦${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })} remaining).`;
    } else {
      msg += ' this month. No overall budget limit is currently set.';
    }

    return {
      handled: true,
      actionType: 'check_budget',
      message: msg,
    };
  }

  // 7. Shorthand Expense Logging ("log 3500 for fuel", "spent 2000 on lunch", "paid 15000 electric bill")
  const expenseMatch = clean.match(/^(?:log|spent|paid|record)\s+(?:₦|ngn)?\s*([0-9,]+(?:\.[0-9]{1,2})?)\s+(?:for|on)\s+(.+)$/i);
  if (expenseMatch) {
    const amount = parseFloat(expenseMatch[1].replace(/,/g, ''));
    const desc = expenseMatch[2].trim();

    // Map description to category
    let category = 'Other';
    const lowerDesc = desc.toLowerCase();
    if (/food|bread|lunch|dinner|breakfast|snack|drink|restaurant|shawarma|groceries/i.test(lowerDesc)) {
      category = 'Food & Dining';
    } else if (/fuel|petrol|diesel|gas|transport|bus|uber|bolt|taxi|fare/i.test(lowerDesc)) {
      category = 'Transport / Fuel';
    } else if (/airtime|recharge|data|mtn|airtel|glo|9mobile|internet/i.test(lowerDesc)) {
      category = 'Airtime & Data';
    } else if (/electric|nepa|power|light|water|waste|dstv|gotv|subscription/i.test(lowerDesc)) {
      category = 'Utilities & Bills';
    } else if (/clothes|shoe|shoes|shirt|trouser|phone|laptop|gadget/i.test(lowerDesc)) {
      category = 'Shopping';
    }

    const exp = await expensesRepo.addExpense(
      amount,
      category,
      desc,
      'NGN',
      new Date().toISOString(),
      undefined,
      'manual'
    );

    return {
      handled: true,
      actionType: 'log_expense',
      data: exp,
      message: `Logged ₦${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} for ${desc} under ${category}.`,
    };
  }

  // 8. GPS / Live Location
  if (/(?:where am i|what(?:'s| is) my location|my current location|current coordinates)/i.test(clean)) {
    const coords = await geofenceService.getCurrentGPSLocation();
    if (coords) {
      return {
        handled: true,
        actionType: 'get_location',
        message: `Your current coordinates are ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}.`,
      };
    }
    return {
      handled: true,
      actionType: 'get_location',
      message: 'Could not determine location. Please verify that GPS location permissions are granted.',
    };
  }

  return { handled: false, message: '' };
}
