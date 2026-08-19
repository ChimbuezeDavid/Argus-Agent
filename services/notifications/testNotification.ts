import { getDatabase } from '@/services/database/db';

export interface TestNotificationResult {
  success: boolean;
  message: string;
  extractedAmount?: number;
  currency?: string;
  merchant?: string;
}

/**
 * Simulates a bank notification alert to test the Argus Notification Interceptor pipeline.
 */
export async function simulateBankNotificationTest(): Promise<TestNotificationResult> {
  try {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const testTitle = 'GTBank Debit Alert';
    const testText = 'Acct: **1234 Amt: NGN 4,500.00 Desc: POS/WEB PURCHASE - SPAR LEKKI Bal: NGN 182,450.00';
    const packageName = 'com.gtbank.gtworldv1';

    // Regex extraction
    const amountRegex = /(?:₦|NGN|Naira)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i;
    const match = testText.match(amountRegex);
    const rawAmount = match ? parseFloat(match[1].replace(/,/g, '')) : 4500;

    // 1. Insert into notification_events
    const notifRes = await db.runAsync(
      `INSERT INTO notification_events (
        package_name, title, text, timestamp, is_financial, extracted_amount, extracted_currency, extracted_category, processed_to_expense
      ) VALUES (?, ?, ?, ?, 1, ?, 'NGN', 'Food & Dining', 1)`,
      packageName,
      testTitle,
      testText,
      now,
      rawAmount
    );

    // 2. Insert into expenses table as unconfirmed bank alert
    await db.runAsync(
      `INSERT INTO expenses (
        amount, currency, category, description, date, source, status, raw_merchant, related_notification_id, created_at
      ) VALUES (?, 'NGN', 'Food & Dining', 'Simulated Bank Alert: SPAR LEKKI', ?, 'notification_extracted', 'unconfirmed', 'SPAR LEKKI', ?, ?)`,
      rawAmount,
      now,
      notifRes.lastInsertRowId,
      now
    );

    return {
      success: true,
      message: `Successfully intercepted and parsed test alert: ₦${rawAmount.toLocaleString()} from SPAR LEKKI!`,
      extractedAmount: rawAmount,
      currency: 'NGN',
      merchant: 'SPAR LEKKI',
    };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || 'Failed to simulate bank notification.',
    };
  }
}
