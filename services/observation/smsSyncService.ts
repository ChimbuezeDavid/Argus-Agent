// Service to sync and parse Nigerian bank SMS messages directly from on-device SMS inbox
import { Platform, PermissionsAndroid } from 'react-native';
import ArgusSystemMonitors, { SmsMessage } from '@/modules/argus-system-monitors';
import { getDatabase } from '@/services/database/db';

export interface ParsedBankAlert {
  isFinancial: boolean;
  amount: number | null;
  currency: string;
  category: string;
  merchant: string;
  type: 'debit' | 'credit' | 'other';
  rawText: string;
}

// Known Nigerian bank sender IDs and keywords
const BANK_SENDERS = [
  'gtbank', 'gtb', 'zenith', 'access', 'accessbank', 'firstbank', 'uba',
  'opay', 'palmpay', 'kuda', 'moniepoint', 'stanbic', 'sterling', 'wema',
  'alat', 'fidelity', 'ecobank', 'fcmb', 'polaris', 'keystone', 'jaiz', 'taj'
];

const FINANCIAL_KEYWORDS = [
  'debited', 'credited', 'acct:', 'acc:', 'amt:', 'bal:', 'dr:', 'cr:',
  'naira', 'ngn', 'transfer', 'pos purchase', 'web purchase', 'atm wdl', 'debit alert', 'credit alert'
];

/**
 * Checks if sender or SMS content matches financial institution or bank alert patterns.
 */
export function isLikelyBankMessage(address: string, body: string): boolean {
  const cleanAddr = (address || '').toLowerCase();
  const cleanBody = (body || '').toLowerCase();

  const isBankSender = BANK_SENDERS.some((bank) => cleanAddr.includes(bank));
  const hasFinancialKeyword = FINANCIAL_KEYWORDS.some((kw) => cleanBody.includes(kw));

  // Must have numbers (amount/account info)
  const hasDigit = /\d/.test(cleanBody);

  return (isBankSender || hasFinancialKeyword) && hasDigit;
}

/**
 * Parses raw SMS text from Nigerian banks into structured financial transaction details.
 */
export function parseNigerianBankSms(body: string, sender: string): ParsedBankAlert {
  const cleanBody = (body || '').trim();
  const lowerBody = cleanBody.toLowerCase();

  // 1. Determine alert type
  let type: 'debit' | 'credit' | 'other' = 'other';
  if (
    lowerBody.includes('debit') ||
    lowerBody.includes('dr:') ||
    lowerBody.includes('debited') ||
    lowerBody.includes('dr alert')
  ) {
    type = 'debit';
  } else if (
    lowerBody.includes('credit') ||
    lowerBody.includes('cr:') ||
    lowerBody.includes('credited') ||
    lowerBody.includes('cr alert')
  ) {
    type = 'credit';
  }

  // 2. Extract numeric amount with Naira or NGN
  const amountRegex = /(?:₦|NGN|Naira|amt:?\s*(?:ngn|₦)?)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i;
  const match = cleanBody.match(amountRegex);

  let amount: number | null = null;
  if (match && match[1]) {
    const rawVal = match[1].replace(/,/g, '');
    const parsed = parseFloat(rawVal);
    if (!isNaN(parsed) && parsed > 0) {
      amount = parsed;
    }
  }

  // Fallback regex for pure digits following currency indicators
  if (!amount) {
    const altRegex = /([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s*(?:NGN|Naira)/i;
    const altMatch = cleanBody.match(altRegex);
    if (altMatch && altMatch[1]) {
      const parsed = parseFloat(altMatch[1].replace(/,/g, ''));
      if (!isNaN(parsed) && parsed > 0) {
        amount = parsed;
      }
    }
  }

  // 3. Extract Merchant / Description
  let merchant = sender || 'Bank Alert';
  // Check for common POS / WEB / Transfer indicators
  const descMatch = cleanBody.match(/(?:desc:|narration:|remarks:|to:|at:)\s*([^.;\n\r]+)/i);
  if (descMatch && descMatch[1]) {
    merchant = descMatch[1].trim();
  } else {
    // If sender has bank name, extract clean title
    const foundBank = BANK_SENDERS.find((b) => sender.toLowerCase().includes(b));
    if (foundBank) {
      merchant = foundBank.toUpperCase();
    }
  }

  // 4. Infer category
  let category = 'Other';
  const lowerMerchant = (merchant + ' ' + cleanBody).toLowerCase();
  if (
    lowerMerchant.includes('eat') ||
    lowerMerchant.includes('food') ||
    lowerMerchant.includes('restaurant') ||
    lowerMerchant.includes('chowdeck') ||
    lowerMerchant.includes('kfc') ||
    lowerMerchant.includes('spar') ||
    lowerMerchant.includes('supermarket') ||
    lowerMerchant.includes('groceries')
  ) {
    category = 'Food & Dining';
  } else if (
    lowerMerchant.includes('uber') ||
    lowerMerchant.includes('bolt') ||
    lowerMerchant.includes('fuel') ||
    lowerMerchant.includes('total') ||
    lowerMerchant.includes('nnpc') ||
    lowerMerchant.includes('conoil')
  ) {
    category = 'Transport / Fuel';
  } else if (
    lowerMerchant.includes('airtime') ||
    lowerMerchant.includes('data') ||
    lowerMerchant.includes('mtn') ||
    lowerMerchant.includes('airtel') ||
    lowerMerchant.includes('glo') ||
    lowerMerchant.includes('9mobile')
  ) {
    category = 'Airtime & Data';
  } else if (
    lowerMerchant.includes('nepa') ||
    lowerMerchant.includes('ikedc') ||
    lowerMerchant.includes('ekedc') ||
    lowerMerchant.includes('dstv') ||
    lowerMerchant.includes('gotv') ||
    lowerMerchant.includes('startimes')
  ) {
    category = 'Utilities & Bills';
  } else if (
    lowerMerchant.includes('trf') ||
    lowerMerchant.includes('transfer') ||
    lowerMerchant.includes('nip/')
  ) {
    category = 'Transfer / Sent';
  }

  return {
    isFinancial: !!amount,
    amount,
    currency: 'NGN',
    category,
    merchant,
    type,
    rawText: cleanBody,
  };
}

/**
 * Requests Android READ_SMS runtime permission.
 * Native standard permission dialog appears on Tecno / Android 13/14 without "Restricted settings" block.
 */
export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      {
        title: 'SMS Bank Alert Access',
        message: 'Argus needs permission to read your incoming bank SMS alerts to automatically track and verify your financial budget 100% on-device.',
        buttonNeutral: 'Ask Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'Allow',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('Error requesting SMS permission:', err);
    return false;
  }
}

export interface SyncSmsResult {
  scannedCount: number;
  importedCount: number;
  skippedDuplicatesCount: number;
}

/**
 * Scans on-device SMS inbox, parses bank messages, and saves unconfirmed transactions into SQLite.
 */
export async function syncBankSmsInbox(limit: number = 60): Promise<SyncSmsResult> {
  if (Platform.OS !== 'android') {
    return { scannedCount: 0, importedCount: 0, skippedDuplicatesCount: 0 };
  }

  const hasPerm = await ArgusSystemMonitors.hasSmsPermission();
  if (!hasPerm) {
    const requested = await requestSmsPermission();
    if (!requested) {
      return { scannedCount: 0, importedCount: 0, skippedDuplicatesCount: 0 };
    }
  }

  const messages: SmsMessage[] = await ArgusSystemMonitors.readBankSmsMessages(limit);
  if (!messages || messages.length === 0) {
    return { scannedCount: 0, importedCount: 0, skippedDuplicatesCount: 0 };
  }

  const db = await getDatabase();
  let importedCount = 0;
  let skippedDuplicatesCount = 0;

  for (const msg of messages) {
    if (!isLikelyBankMessage(msg.address, msg.body)) {
      continue;
    }

    const parsed = parseNigerianBankSms(msg.body, msg.address);
    if (!parsed.isFinancial || !parsed.amount) {
      continue;
    }

    // Check if this notification/SMS was already imported (deduplicate by exact text and timestamp)
    const existing = await db.getFirstAsync<any>(
      `SELECT id FROM notification_events WHERE text = ? LIMIT 1`,
      [msg.body]
    );

    if (existing) {
      skippedDuplicatesCount++;
      continue;
    }

    const msgDate = msg.timestamp
      ? new Date(msg.timestamp).toISOString()
      : new Date().toISOString();

    // 1. Insert into notification_events
    const notifRes = await db.runAsync(
      `INSERT INTO notification_events (
        package_name, title, text, timestamp, is_financial, extracted_amount, extracted_currency, extracted_category, processed_to_expense
      ) VALUES (?, ?, ?, ?, 1, ?, 'NGN', ?, 1)`,
      [msg.address || 'SMS_INBOX', `Bank Alert (${msg.address})`, msg.body, msgDate, parsed.amount, parsed.category]
    );

    // 2. Insert into expenses as unconfirmed bank alert
    await db.runAsync(
      `INSERT INTO expenses (
        amount, currency, category, description, date, source, status, raw_merchant, related_notification_id, created_at
      ) VALUES (?, 'NGN', ?, ?, ?, 'notification_extracted', 'unconfirmed', ?, ?, CURRENT_TIMESTAMP)`,
      [
        parsed.amount,
        parsed.category,
        parsed.merchant ? `Bank Alert: ${parsed.merchant}` : `Bank Alert (${msg.address})`,
        msgDate,
        parsed.merchant,
        notifRes.lastInsertRowId,
      ]
    );

    importedCount++;
  }

  return {
    scannedCount: messages.length,
    importedCount,
    skippedDuplicatesCount,
  };
}
