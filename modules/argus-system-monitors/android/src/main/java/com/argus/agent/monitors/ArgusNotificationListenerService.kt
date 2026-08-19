package com.argus.agent.monitors

import android.app.Notification
import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.regex.Pattern

class ArgusNotificationListenerService : NotificationListenerService() {
  private val TAG = "ArgusNotificationListener"

  // Regex to extract numeric amounts with Nigerian Naira and common currency signs/codes
  private val amountPattern = Pattern.compile(
    "(?i)(?:₦|NGN|Naira|\\$|USD|€|EUR|£|GBP|¥|INR)\\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\\.[0-9]{1,2})?|[0-9]+(?:\\.[0-9]{1,2})?)|([0-9]{1,3}(?:,[0-9]{3})*(?:\\.[0-9]{1,2})?|[0-9]+(?:\\.[0-9]{1,2})?)\\s*(?:NGN|Naira|USD|EUR|GBP|INR)"
  )

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) return

    val packageName = sbn.packageName ?: ""
    val extras = sbn.notification.extras
    val title = extras?.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
    val text = extras?.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""

    // Skip empty notifications or self-notifications from Argus
    if (packageName == applicationContext.packageName || (title.isEmpty() && text.isEmpty())) {
      return
    }

    Log.d(TAG, "Notification received from $packageName: Title='$title', Text='$text'")

    // 1. Analyze for financial info
    val combinedText = "$title $text"
    val isFinancial = checkIsFinancial(combinedText)
    var extractedAmount: Double? = null
    var extractedCurrency = "NGN" // default to Nigerian Naira

    if (isFinancial) {
      val (amount, currency) = parseAmountAndCurrency(combinedText)
      extractedAmount = amount
      if (currency != null) {
        extractedCurrency = currency
      }
    }

    // 2. Write directly to SQLite database
    writeToDatabase(packageName, title, text, isFinancial, extractedAmount, extractedCurrency)
  }

  override fun onNotificationRemoved(sbn: StatusBarNotification?) {
    // Optional: Log or track when notification is dismissed
  }

  private fun checkIsFinancial(text: String): Boolean {
    val lowercase = text.lowercase(Locale.ROOT)
    val financialKeywords = arrayOf(
      "spent", "debited", "debited from", "charged", "paid", "purchase",
      "withdrew", "withdrawal", "transaction", "transfer", "received",
      "sent", "payment", "charge", "refund", "credit card", "bank alert",
      "credit alert", "debit alert", "acct:", "bal:", "airtime", "naira", "ngn",
      "opay", "palmpay", "kuda", "moniepoint", "gtbank", "zenith", "access bank"
    )
    
    // Check keyword presence
    val hasKeyword = financialKeywords.any { lowercase.contains(it) }
    
    // Also must contain a number to suggest an amount
    val hasNumber = lowercase.any { it.isDigit() }
    
    return hasKeyword && hasNumber
  }

  private fun parseAmountAndCurrency(text: String): Pair<Double?, String?> {
    val matcher = amountPattern.matcher(text)
    if (matcher.find()) {
      try {
        val matchStr = matcher.group(1) ?: matcher.group(2)
        if (matchStr != null) {
          val cleanAmount = matchStr.replace(",", "")
          val amount = cleanAmount.toDouble()
          
          val matchAll = matcher.group(0) ?: ""
          val currency = when {
            matchAll.contains("₦", ignoreCase = true) || matchAll.contains("NGN", ignoreCase = true) || matchAll.contains("Naira", ignoreCase = true) -> "NGN"
            matchAll.contains("$", ignoreCase = true) || matchAll.contains("USD", ignoreCase = true) -> "USD"
            matchAll.contains("€", ignoreCase = true) || matchAll.contains("EUR", ignoreCase = true) -> "EUR"
            matchAll.contains("£", ignoreCase = true) || matchAll.contains("GBP", ignoreCase = true) -> "GBP"
            matchAll.contains("¥", ignoreCase = true) -> "JPY"
            matchAll.contains("INR", ignoreCase = true) -> "INR"
            else -> "NGN"
          }
          return Pair(amount, currency)
        }
      } catch (e: Exception) {
        Log.e(TAG, "Failed parsing extracted amount", e)
      }
    }
    return Pair(null, null)
  }

  private fun writeToDatabase(
    packageName: String,
    title: String,
    text: String,
    isFinancial: Boolean,
    amount: Double?,
    currency: String
  ) {
    var db: SQLiteDatabase? = null
    try {
      val dbFile = applicationContext.getDatabasePath("argus.db")
      
      // Make sure database folder exists
      dbFile.parentFile?.mkdirs()

      db = SQLiteDatabase.openOrCreateDatabase(dbFile, null)
      
      // Create formatter for SQL timestamp
      val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
      sdf.timeZone = TimeZone.getTimeZone("UTC")
      val formattedDate = sdf.format(Date())

      val values = ContentValues().apply {
        put("package_name", packageName)
        put("title", title)
        put("text", text)
        put("timestamp", formattedDate)
        put("is_financial", if (isFinancial) 1 else 0)
        put("extracted_amount", amount)
        put("extracted_currency", currency)
        put("extracted_category", if (isFinancial) "Other" else null)
        put("processed_to_expense", 0)
      }

      val rowId = db.insert("notification_events", null, values)
      Log.d(TAG, "Successfully inserted notification event into SQLite. Row ID: $rowId")
    } catch (e: Exception) {
      Log.e(TAG, "Failed writing notification event to SQLite database", e)
    } finally {
      db?.close()
    }
  }
}
