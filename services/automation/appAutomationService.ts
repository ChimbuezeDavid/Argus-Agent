// App Deep Linking & Intent Automation Service for Argus Agent
// Dispatches automated actions to third-party apps (WhatsApp, Gmail, Maps, SMS, Calendar, Search)
import ArgusSystemMonitors from '@/modules/argus-system-monitors';

export interface AppActionResult {
  success: boolean;
  targetApp: string;
  action: string;
  message: string;
  details?: any;
}

// Well-known phone contacts map for shorthand voice resolution
const KNOWN_ALIASES: Record<string, string> = {
  momcy: '+2348000000001',
  mum: '+2348000000001',
  dad: '+2348000000002',
  boss: '+2348000000003',
  manager: '+2348000000003',
};

/**
 * Normalizes contact names or phone numbers to digits
 */
export function resolvePhoneNumber(target: string): string {
  const clean = (target || '').trim().toLowerCase();
  if (KNOWN_ALIASES[clean]) {
    return KNOWN_ALIASES[clean];
  }
  // Strip non-digit characters except +
  return target.replace(/[^0-9+]/g, '');
}

/**
 * Dispatch automated message via WhatsApp
 */
export async function dispatchWhatsApp(
  recipient: string | undefined | null,
  message: string
): Promise<AppActionResult> {
  const phone = recipient ? resolvePhoneNumber(recipient) : null;
  const msg = (message || '').trim();

  if (!msg) {
    return {
      success: false,
      targetApp: 'WhatsApp',
      action: 'send_message',
      message: 'Message content cannot be empty for WhatsApp dispatch',
    };
  }

  try {
    const ok = await ArgusSystemMonitors.sendWhatsAppMessage(phone, msg);
    return {
      success: ok,
      targetApp: 'WhatsApp',
      action: 'send_message',
      message: ok
        ? `Launched WhatsApp with message: "${msg.slice(0, 40)}${msg.length > 40 ? '...' : ''}"`
        : 'Failed to open WhatsApp. Ensure WhatsApp is installed.',
      details: { recipient: phone || 'direct_share', messageLength: msg.length },
    };
  } catch (e: any) {
    return {
      success: false,
      targetApp: 'WhatsApp',
      action: 'send_message',
      message: `WhatsApp dispatch error: ${e.message || e}`,
    };
  }
}

/**
 * Dispatch email composition via default email client (Gmail)
 */
export async function dispatchEmail(
  recipient?: string | null,
  subject?: string | null,
  body?: string | null
): Promise<AppActionResult> {
  try {
    const ok = await ArgusSystemMonitors.sendEmail(recipient, subject, body);
    return {
      success: ok,
      targetApp: 'Gmail / Email',
      action: 'compose_email',
      message: ok
        ? `Opened email client for: ${recipient || 'new recipient'} with subject "${subject || '(no subject)'}"`
        : 'Failed to launch email application.',
      details: { recipient, subject, bodyLength: body?.length || 0 },
    };
  } catch (e: any) {
    return {
      success: false,
      targetApp: 'Email',
      action: 'compose_email',
      message: `Email dispatch error: ${e.message || e}`,
    };
  }
}

/**
 * Dispatch SMS message composition
 */
export async function dispatchSMS(
  phone: string | undefined | null,
  message: string
): Promise<AppActionResult> {
  const cleanPhone = phone ? resolvePhoneNumber(phone) : null;
  try {
    const ok = await ArgusSystemMonitors.sendSMS(cleanPhone, message);
    return {
      success: ok,
      targetApp: 'Messages (SMS)',
      action: 'send_sms',
      message: ok
        ? `Pre-filled SMS to ${cleanPhone || 'recipient'}`
        : 'Failed to open SMS application.',
      details: { phone: cleanPhone, messageLength: message.length },
    };
  } catch (e: any) {
    return {
      success: false,
      targetApp: 'Messages (SMS)',
      action: 'send_sms',
      message: `SMS dispatch error: ${e.message || e}`,
    };
  }
}

/**
 * Open Google Maps navigation or location search
 */
export async function dispatchMapNavigation(
  queryOrAddress?: string | null,
  lat?: number | null,
  lon?: number | null
): Promise<AppActionResult> {
  try {
    const ok = await ArgusSystemMonitors.openMapLocation(queryOrAddress, lat, lon);
    const dest = queryOrAddress || (lat && lon ? `${lat}, ${lon}` : 'current area');
    return {
      success: ok,
      targetApp: 'Google Maps',
      action: 'navigate_map',
      message: ok ? `Navigating to ${dest}` : 'Failed to launch Maps application.',
      details: { destination: dest, lat, lon },
    };
  } catch (e: any) {
    return {
      success: false,
      targetApp: 'Google Maps',
      action: 'navigate_map',
      message: `Maps dispatch error: ${e.message || e}`,
    };
  }
}

/**
 * Dispatch Calendar event creation
 */
export async function dispatchCalendarEvent(
  title: string,
  startTimeMs?: number | null,
  location?: string | null,
  description?: string | null
): Promise<AppActionResult> {
  try {
    const ok = await ArgusSystemMonitors.openCalendarEvent(title, startTimeMs, location, description);
    return {
      success: ok,
      targetApp: 'Calendar',
      action: 'create_event',
      message: ok ? `Opened calendar to schedule "${title}"` : 'Failed to open Calendar.',
      details: { title, location, description },
    };
  } catch (e: any) {
    return {
      success: false,
      targetApp: 'Calendar',
      action: 'create_event',
      message: `Calendar dispatch error: ${e.message || e}`,
    };
  }
}

/**
 * Dispatch Web Search
 */
export async function dispatchWebSearch(query: string): Promise<AppActionResult> {
  try {
    const ok = await ArgusSystemMonitors.openWebSearch(query);
    return {
      success: ok,
      targetApp: 'Browser',
      action: 'web_search',
      message: ok ? `Searching web for: "${query}"` : 'Failed to launch web browser.',
      details: { query },
    };
  } catch (e: any) {
    return {
      success: false,
      targetApp: 'Browser',
      action: 'web_search',
      message: `Web search error: ${e.message || e}`,
    };
  }
}
