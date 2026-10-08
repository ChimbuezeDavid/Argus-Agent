package com.argus.agent.monitors

import android.app.AppOpsManager
import android.app.SearchManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Process
import android.os.PowerManager
import android.provider.CalendarContract
import android.provider.Settings
import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.media.MediaRecorder
import android.util.Base64
import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.URLEncoder

class ArgusSystemMonitorsModule : Module() {
  private var speechRecognizer: SpeechRecognizer? = null
  private val mainHandler = Handler(Looper.getMainLooper())
  private var pendingSpeechPromise: Promise? = null
  private val SPEECH_REQUEST_CODE = 42101
  private var mediaRecorder: MediaRecorder? = null
  private var audioRecordingFile: File? = null

  override fun definition() = ModuleDefinition {
    Name("ArgusSystemMonitors")

    Events(
      "onSpeechPartialResults",
      "onSpeechResults",
      "onSpeechError",
      "onSpeechEnd",
      "onSpeechRmsChanged",
      "onWakeWordDetected"
    )

    // =========================================================================
    // 1. SYSTEM TELEMETRY & USAGE STATS
    // =========================================================================

    AsyncFunction("hasUsageStatsPermission") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        context.packageName
      )
      mode == AppOpsManager.MODE_ALLOWED
    }

    AsyncFunction("getAppUsageStats") { startTimeMs: Double, endTimeMs: Double ->
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Bundle>()
      val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      
      val statsList = usageStatsManager.queryUsageStats(
        UsageStatsManager.INTERVAL_DAILY,
        startTimeMs.toLong(),
        endTimeMs.toLong()
      )
      
      val result = ArrayList<Bundle>()
      for (stat in statsList) {
        if (stat.totalTimeInForeground > 0) {
          val bundle = Bundle().apply {
            putString("packageName", stat.packageName)
            putDouble("totalTimeVisible", stat.totalTimeInForeground.toDouble())
            putDouble("lastTimeUsed", stat.lastTimeUsed.toDouble())
          }
          result.add(bundle)
        }
      }
      result
    }

    AsyncFunction("hasNotificationListenerPermission") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val packageName = context.packageName
      try {
        val packageNames = NotificationManagerCompat.getEnabledListenerPackages(context)
        if (packageNames.contains(packageName)) {
          return@AsyncFunction true
        }
      } catch (e: Exception) {}

      val enabledListeners = Settings.Secure.getString(
        context.contentResolver,
        "enabled_notification_listeners"
      )
      enabledListeners != null && enabledListeners.contains(packageName)
    }

    AsyncFunction("openNotificationListenerSettings") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val intent = Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS").apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        true
      } catch (e: Exception) {
        try {
          val intent = Intent(Settings.ACTION_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          context.startActivity(intent)
          true
        } catch (err: Exception) {
          false
        }
      }
    }

    AsyncFunction("openAppNotificationSettings") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
            putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
        } else {
          Intent("android.settings.APP_NOTIFICATION_SETTINGS").apply {
            putExtra("app_package", context.packageName)
            putExtra("app_uid", context.applicationInfo.uid)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
        }
        context.startActivity(intent)
        true
      } catch (e: Exception) {
        false
      }
    }

    AsyncFunction("launchApp") { packageName: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val pm = context.packageManager
        var intent = pm.getLaunchIntentForPackage(packageName)
        if (intent == null) {
          // Dynamic fallback: match installed applications by display label or package suffix
          val cleanTarget = packageName.trim().lowercase()
          val installed = pm.getInstalledApplications(PackageManager.GET_META_DATA)
          for (appInfo in installed) {
            val label = pm.getApplicationLabel(appInfo).toString().lowercase()
            if (label == cleanTarget || label.contains(cleanTarget) || appInfo.packageName.lowercase().contains(cleanTarget)) {
              intent = pm.getLaunchIntentForPackage(appInfo.packageName)
              if (intent != null) break
            }
          }
        }
        if (intent != null) {
          intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          context.startActivity(intent)
          true
        } else {
          false
        }
      } catch (e: Exception) {
        false
      }
    }

    AsyncFunction("openMediaFile") { filePath: String, mimeType: String?, targetPackage: String? ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val cleanPath = if (filePath.startsWith("file://")) filePath.substring(7) else filePath
        val file = File(cleanPath)
        if (!file.exists()) {
          return@AsyncFunction false
        }

        // Relax StrictMode VmPolicy to prevent FileUriExposedException on Nougat+
        try {
          val builder = android.os.StrictMode.VmPolicy.Builder()
          android.os.StrictMode.setVmPolicy(builder.build())
        } catch (strictEx: Exception) {}

        val uri = Uri.fromFile(file)
        val determinedMime = mimeType ?: when {
          cleanPath.endsWith(".mp4", true) -> "video/mp4"
          cleanPath.endsWith(".mkv", true) -> "video/x-matroska"
          cleanPath.endsWith(".avi", true) -> "video/x-msvideo"
          cleanPath.endsWith(".mov", true) -> "video/quicktime"
          cleanPath.endsWith(".mp3", true) -> "audio/mpeg"
          cleanPath.endsWith(".wav", true) -> "audio/wav"
          cleanPath.endsWith(".flac", true) -> "audio/flac"
          cleanPath.endsWith(".aac", true) -> "audio/aac"
          cleanPath.endsWith(".m4a", true) -> "audio/mp4"
          cleanPath.endsWith(".pdf", true) -> "application/pdf"
          else -> "*/*"
        }

        val intent = Intent(Intent.ACTION_VIEW).apply {
          setDataAndType(uri, determinedMime)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

        if (!targetPackage.isNullOrBlank()) {
          val pm = context.packageManager
          val resolvedPkg = when (targetPackage.lowercase().trim()) {
            "vlc" -> "org.videolan.vlc"
            "mx player", "mxplayer" -> "com.mxtech.videoplayer.ad"
            else -> targetPackage.trim()
          }
          try {
            pm.getPackageInfo(resolvedPkg, 0)
            intent.setPackage(resolvedPkg)
          } catch (e: Exception) {
            intent.setPackage(null)
          }
        }

        context.startActivity(intent)
        true
      } catch (e: Exception) {
        false
      }
    }

    AsyncFunction("openUsageAccessSettings") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        true
      } catch (e: Exception) {
        false
      }
    }

    // =========================================================================
    // 2. PHASE 1: DEVICE STORAGE & FILE ACCESS
    // =========================================================================

    AsyncFunction("hasStoragePermission") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        Environment.isExternalStorageManager()
      } else {
        val read = ContextCompat.checkSelfPermission(context, android.Manifest.permission.READ_EXTERNAL_STORAGE)
        val write = ContextCompat.checkSelfPermission(context, android.Manifest.permission.WRITE_EXTERNAL_STORAGE)
        read == android.content.pm.PackageManager.PERMISSION_GRANTED && write == android.content.pm.PackageManager.PERMISSION_GRANTED
      }
    }

    AsyncFunction("openAllFilesAccessSettings") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
            data = Uri.parse("package:${context.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
        } else {
          Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.parse("package:${context.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
        }
        context.startActivity(intent)
        true
      } catch (e: Exception) {
        // Fallback to general settings
        try {
          val fallback = Intent(Settings.ACTION_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          context.startActivity(fallback)
          true
        } catch (e2: Exception) {
          false
        }
      }
    }

    AsyncFunction("getStorageDirectories") { ->
      val root = Environment.getExternalStorageDirectory()
      val map = Bundle().apply {
        putString("root", root?.absolutePath ?: "/storage/emulated/0")
        putString("downloads", Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)?.absolutePath ?: "/storage/emulated/0/Download")
        putString("documents", Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS)?.absolutePath ?: "/storage/emulated/0/Documents")
        putString("dcim", Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DCIM)?.absolutePath ?: "/storage/emulated/0/DCIM")
        putString("pictures", Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)?.absolutePath ?: "/storage/emulated/0/Pictures")
      }
      map
    }

    AsyncFunction("listFiles") { directoryPath: String, extensionFilter: String?, maxDepth: Int ->
      val result = ArrayList<Bundle>()
      val dir = File(directoryPath)
      if (!dir.exists() || !dir.isDirectory) {
        return@AsyncFunction result
      }

      val depthLimit = if (maxDepth <= 0) 2 else maxDepth

      fun traverse(currentDir: File, currentDepth: Int) {
        if (currentDepth > depthLimit || result.size >= 100) return
        val files = currentDir.listFiles() ?: return
        for (f in files) {
          if (result.size >= 100) break
          if (f.name.startsWith(".")) continue

          if (f.isDirectory) {
            val b = Bundle().apply {
              putString("name", f.name)
              putString("path", f.absolutePath)
              putBoolean("isDirectory", true)
              putDouble("size", 0.0)
              putDouble("lastModified", f.lastModified().toDouble())
            }
            result.add(b)
            traverse(f, currentDepth + 1)
          } else {
            if (extensionFilter.isNullOrBlank() || f.name.endsWith(extensionFilter, ignoreCase = true)) {
              val b = Bundle().apply {
                putString("name", f.name)
                putString("path", f.absolutePath)
                putBoolean("isDirectory", false)
                putDouble("size", f.length().toDouble())
                putDouble("lastModified", f.lastModified().toDouble())
              }
              result.add(b)
            }
          }
        }
      }

      traverse(dir, 1)
      result
    }

    AsyncFunction("searchFiles") { query: String, rootPath: String?, maxResults: Int ->
      val result = ArrayList<Bundle>()
      val limit = if (maxResults <= 0) 30 else maxResults
      val searchRoot = if (!rootPath.isNullOrBlank()) File(rootPath) else Environment.getExternalStorageDirectory()
      if (searchRoot == null || !searchRoot.exists()) return@AsyncFunction result

      val q = query.trim().lowercase()

      fun searchTraverse(currentDir: File, depth: Int) {
        if (depth > 4 || result.size >= limit) return
        val files = currentDir.listFiles() ?: return
        for (f in files) {
          if (result.size >= limit) break
          if (f.name.startsWith(".")) continue

          if (f.name.lowercase().contains(q)) {
            val b = Bundle().apply {
              putString("name", f.name)
              putString("path", f.absolutePath)
              putBoolean("isDirectory", f.isDirectory)
              putDouble("size", if (f.isDirectory) 0.0 else f.length().toDouble())
              putDouble("lastModified", f.lastModified().toDouble())
            }
            result.add(b)
          }

          if (f.isDirectory) {
            searchTraverse(f, depth + 1)
          }
        }
      }

      searchTraverse(searchRoot, 1)
      result
    }

    AsyncFunction("readFileContent") { filePath: String, maxBytes: Int ->
      val file = File(filePath)
      if (!file.exists() || file.isDirectory) {
        return@AsyncFunction ""
      }
      val limit = if (maxBytes <= 0) 100000 else maxBytes
      try {
        val fis = FileInputStream(file)
        val buffer = ByteArray(Math.min(file.length().toInt(), limit))
        val readBytes = fis.read(buffer)
        fis.close()
        if (readBytes > 0) {
          String(buffer, 0, readBytes, Charsets.UTF_8)
        } else {
          ""
        }
      } catch (e: Exception) {
        ""
      }
    }

    AsyncFunction("writeFileContent") { filePath: String, content: String, append: Boolean ->
      try {
        val file = File(filePath)
        file.parentFile?.mkdirs()
        val fos = FileOutputStream(file, append)
        fos.write(content.toByteArray(Charsets.UTF_8))
        fos.close()
        true
      } catch (e: Exception) {
        false
      }
    }

    AsyncFunction("deleteFile") { filePath: String ->
      try {
        val file = File(filePath)
        if (file.exists()) file.delete() else false
      } catch (e: Exception) {
        false
      }
    }

    // =========================================================================
    // 3. PHASE 2: APP DEEP LINKING & INTENT AUTOMATION
    // =========================================================================

    AsyncFunction("sendWhatsAppMessage") { phone: String?, message: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val encodedMsg = URLEncoder.encode(message, "UTF-8")
        val uriStr = if (!phone.isNullOrBlank()) {
          val cleanPhone = phone.replace(Regex("[^0-9+]"), "")
          "https://api.whatsapp.com/send?phone=$cleanPhone&text=$encodedMsg"
        } else {
          "https://api.whatsapp.com/send?text=$encodedMsg"
        }

        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uriStr)).apply {
          setPackage("com.whatsapp")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        // Try direct WhatsApp package first
        try {
          context.startActivity(intent)
          true
        } catch (e1: Exception) {
          // Fallback to WhatsApp Business or generic browser
          val fallback = Intent(Intent.ACTION_VIEW, Uri.parse(uriStr)).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          context.startActivity(fallback)
          true
        }
      } catch (e: Exception) {
        false
      }
    }

    AsyncFunction("sendEmail") { recipient: String?, subject: String?, body: String? ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val intent = Intent(Intent.ACTION_SENDTO).apply {
          data = Uri.parse("mailto:${recipient ?: ""}")
          if (!subject.isNullOrBlank()) putExtra(Intent.EXTRA_SUBJECT, subject)
          if (!body.isNullOrBlank()) putExtra(Intent.EXTRA_TEXT, body)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        true
      } catch (e: Exception) {
        false
      }
    }

    AsyncFunction("sendSMS") { phone: String?, message: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val intent = Intent(Intent.ACTION_SENDTO).apply {
          data = Uri.parse("smsto:${phone ?: ""}")
          putExtra("sms_body", message)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        true
      } catch (e: Exception) {
        false
      }
    }

    AsyncFunction("openMapLocation") { queryOrAddress: String?, lat: Double?, lon: Double? ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val uriStr = if (lat != null && lon != null) {
          val label = if (!queryOrAddress.isNullOrBlank()) URLEncoder.encode(queryOrAddress, "UTF-8") else ""
          "geo:$lat,$lon?q=$lat,$lon($label)"
        } else {
          val encoded = URLEncoder.encode(queryOrAddress ?: "", "UTF-8")
          "geo:0,0?q=$encoded"
        }

        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uriStr)).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        true
      } catch (e: Exception) {
        false
      }
    }

    AsyncFunction("openCalendarEvent") { title: String, startTimeMs: Double?, location: String?, description: String? ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val intent = Intent(Intent.ACTION_INSERT).apply {
          data = CalendarContract.Events.CONTENT_URI
          putExtra(CalendarContract.Events.TITLE, title)
          if (startTimeMs != null && startTimeMs > 0) {
            putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, startTimeMs.toLong())
          }
          if (!location.isNullOrBlank()) {
            putExtra(CalendarContract.Events.EVENT_LOCATION, location)
          }
          if (!description.isNullOrBlank()) {
            putExtra(CalendarContract.Events.DESCRIPTION, description)
          }
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        true
      } catch (e: Exception) {
        false
      }
    }

    AsyncFunction("openWebSearch") { query: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val intent = Intent(Intent.ACTION_WEB_SEARCH).apply {
          putExtra(SearchManager.QUERY, query)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        true
      } catch (e: Exception) {
        false
      }
    }

    // =========================================================================
    // 4. ACCESSIBILITY RPA AUTONOMOUS SCREEN CONTROLLER ("THE HANDS OF ARGUS")
    // =========================================================================

    AsyncFunction("hasAccessibilityPermission") { ->
      if (ArgusAccessibilityService.isServiceActive) {
        return@AsyncFunction true
      }
      val context = appContext.reactContext ?: return@AsyncFunction false
      val enabledServices = Settings.Secure.getString(
        context.contentResolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
      )
      enabledServices != null && enabledServices.contains(context.packageName)
    }

    AsyncFunction("openAccessibilitySettings") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        true
      } catch (e: Exception) {
        try {
          val fallbackIntent = Intent(Settings.ACTION_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          context.startActivity(fallbackIntent)
          true
        } catch (err: Exception) {
          false
        }
      }
    }

    AsyncFunction("inspectScreenNodes") { ->
      val service = ArgusAccessibilityService.instance
      if (service == null) {
        return@AsyncFunction emptyList<Bundle>()
      }

      val nodes = service.inspectScreenNodes()
      val resultList = ArrayList<Bundle>()

      for (node in nodes) {
        val bundle = Bundle().apply {
          putString("text", node["text"] as? String ?: "")
          putString("contentDescription", node["contentDescription"] as? String ?: "")
          putString("viewId", node["viewId"] as? String ?: "")
          putString("className", node["className"] as? String ?: "")
          putString("packageName", node["packageName"] as? String ?: "")
          putBoolean("isClickable", node["isClickable"] as? Boolean ?: false)
          putBoolean("isEditable", node["isEditable"] as? Boolean ?: false)
          putBoolean("isScrollable", node["isScrollable"] as? Boolean ?: false)
          putBoolean("isFocused", node["isFocused"] as? Boolean ?: false)
          putBoolean("isEnabled", node["isEnabled"] as? Boolean ?: false)

          val bounds = node["bounds"] as? Map<*, *>
          if (bounds != null) {
            val boundsBundle = Bundle().apply {
              putInt("left", (bounds["left"] as? Number)?.toInt() ?: 0)
              putInt("top", (bounds["top"] as? Number)?.toInt() ?: 0)
              putInt("right", (bounds["right"] as? Number)?.toInt() ?: 0)
              putInt("bottom", (bounds["bottom"] as? Number)?.toInt() ?: 0)
              putInt("centerX", (bounds["centerX"] as? Number)?.toInt() ?: 0)
              putInt("centerY", (bounds["centerY"] as? Number)?.toInt() ?: 0)
            }
            putBundle("bounds", boundsBundle)
          }
        }
        resultList.add(bundle)
      }

      resultList
    }

    AsyncFunction("clickScreenElement") { targetText: String, exactMatch: Boolean? ->
      val service = ArgusAccessibilityService.instance ?: return@AsyncFunction false
      service.clickByText(targetText, exactMatch ?: false)
    }

    AsyncFunction("clickScreenElementById") { viewId: String ->
      val service = ArgusAccessibilityService.instance ?: return@AsyncFunction false
      service.clickById(viewId)
    }

    AsyncFunction("typeTextIntoScreen") { text: String, viewId: String?, targetText: String? ->
      val service = ArgusAccessibilityService.instance ?: return@AsyncFunction false
      service.inputText(text, viewId, targetText)
    }

    AsyncFunction("tapScreenCoordinates") { x: Double, y: Double ->
      val service = ArgusAccessibilityService.instance ?: return@AsyncFunction false
      service.clickCoordinates(x.toFloat(), y.toFloat())
    }

    AsyncFunction("scrollScreen") { direction: String ->
      val service = ArgusAccessibilityService.instance ?: return@AsyncFunction false
      service.scrollScreen(direction)
    }

    AsyncFunction("performPhoneGlobalAction") { actionName: String ->
      val service = ArgusAccessibilityService.instance ?: return@AsyncFunction false
      service.executeGlobalAction(actionName)
    }

    // =========================================================================
    // 4. ON-DEVICE SPEECH RECOGNITION & VOICE ASSISTANT
    // =========================================================================

    AsyncFunction("isSpeechRecognitionAvailable") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      SpeechRecognizer.isRecognitionAvailable(context)
    }

    AsyncFunction("startSpeechRecognition") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      mainHandler.post {
        try {
          if (speechRecognizer != null) {
            try {
              speechRecognizer?.cancel()
              speechRecognizer?.destroy()
            } catch (e: Exception) {}
            speechRecognizer = null
          }

          speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
            setRecognitionListener(object : RecognitionListener {
              override fun onReadyForSpeech(params: Bundle?) {}
              override fun onBeginningOfSpeech() {}
              override fun onRmsChanged(rmsdB: Float) {
                sendEvent("onSpeechRmsChanged", Bundle().apply { putDouble("rms", rmsdB.toDouble()) })
              }
              override fun onBufferReceived(buffer: ByteArray?) {}
              override fun onEndOfSpeech() {
                sendEvent("onSpeechEnd", Bundle())
              }
              override fun onError(error: Int) {
                val errorMessage = when (error) {
                  SpeechRecognizer.ERROR_AUDIO -> "Audio recording error (microphone busy or locked)"
                  SpeechRecognizer.ERROR_CLIENT -> "Client error (SpeechRecognizer binding failed)"
                  SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission required"
                  SpeechRecognizer.ERROR_NETWORK -> "Network connection error"
                  SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout"
                  SpeechRecognizer.ERROR_NO_MATCH -> "No speech recognized"
                  SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Speech recognizer is busy"
                  SpeechRecognizer.ERROR_SERVER -> "Speech server error"
                  SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech detected (timeout)"
                  else -> "Speech error code: $error"
                }
                sendEvent("onSpeechError", Bundle().apply {
                  putInt("errorCode", error)
                  putString("message", errorMessage)
                })
              }
              override fun onResults(results: Bundle?) {
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val text = if (!matches.isNullOrEmpty()) matches[0] else ""
                sendEvent("onSpeechResults", Bundle().apply { putString("transcript", text) })
              }
              override fun onPartialResults(partialResults: Bundle?) {
                val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val text = if (!matches.isNullOrEmpty()) matches[0] else ""
                sendEvent("onSpeechPartialResults", Bundle().apply { putString("transcript", text) })
              }
              override fun onEvent(eventType: Int, params: Bundle?) {}
            })
          }

          val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)
          }

          speechRecognizer?.startListening(intent)
        } catch (e: Exception) {
          sendEvent("onSpeechError", Bundle().apply {
            putInt("errorCode", -1)
            putString("message", e.message ?: "Voice engine initialization error")
          })
        }
      }
      true
    }

    AsyncFunction("stopSpeechRecognition") { ->
      mainHandler.post {
        try {
          speechRecognizer?.stopListening()
        } catch (e: Exception) {}
      }
      true
    }

    AsyncFunction("cancelSpeechRecognition") { ->
      mainHandler.post {
        try {
          speechRecognizer?.cancel()
          speechRecognizer?.destroy()
          speechRecognizer = null
        } catch (e: Exception) {}
      }
      true
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode == SPEECH_REQUEST_CODE) {
        if (payload.resultCode == Activity.RESULT_OK && payload.data != null) {
          val results = payload.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
          val text = if (!results.isNullOrEmpty()) results[0] else ""
          sendEvent("onSpeechResults", Bundle().apply { putString("transcript", text) })
          pendingSpeechPromise?.resolve(text)
        } else {
          pendingSpeechPromise?.resolve("")
        }
        pendingSpeechPromise = null
      }
    }

    AsyncFunction("startVoiceDaemon") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val prefs = context.getSharedPreferences(ArgusBootReceiver.PREFS_NAME, Context.MODE_PRIVATE)
      prefs.edit().putBoolean(ArgusBootReceiver.KEY_DAEMON_ENABLED, true).apply()

      val intent = Intent(context, ArgusVoiceDaemonService::class.java).apply {
        putExtra("custom_wake_word", ArgusVoiceDaemonService.customWakeWord)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
      true
    }

    AsyncFunction("stopVoiceDaemon") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val prefs = context.getSharedPreferences(ArgusBootReceiver.PREFS_NAME, Context.MODE_PRIVATE)
      prefs.edit().putBoolean(ArgusBootReceiver.KEY_DAEMON_ENABLED, false).apply()

      val intent = Intent(context, ArgusVoiceDaemonService::class.java)
      context.stopService(intent)
      true
    }

    AsyncFunction("isVoiceDaemonRunning") { ->
      val context = appContext.reactContext
      if (context != null) {
        val prefs = context.getSharedPreferences(ArgusBootReceiver.PREFS_NAME, Context.MODE_PRIVATE)
        prefs.getBoolean(ArgusBootReceiver.KEY_IS_RUNNING, false) || ArgusVoiceDaemonService.isRunning
      } else {
        ArgusVoiceDaemonService.isRunning
      }
    }

    AsyncFunction("setCustomWakeWord") { word: String ->
      ArgusVoiceDaemonService.customWakeWord = word
      val context = appContext.reactContext
      if (context != null) {
        val prefs = context.getSharedPreferences(ArgusBootReceiver.PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(ArgusBootReceiver.KEY_CUSTOM_WAKE_WORD, word).apply()
      }
      true
    }

    AsyncFunction("hasOverlayPermission") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        Settings.canDrawOverlays(context)
      } else {
        true
      }
    }

    AsyncFunction("openOverlayPermissionSettings") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val intent = Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:${context.packageName}")
        ).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        true
      } else {
        false
      }
    }

    AsyncFunction("getLaunchWakeCommand") { ->
      val activity = appContext.currentActivity ?: return@AsyncFunction ""
      val cmd = activity.intent?.getStringExtra("wake_word_command") ?: ""
      activity.intent?.removeExtra("wake_word_command")
      cmd
    }

    AsyncFunction("isIgnoringBatteryOptimizations") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        powerManager?.isIgnoringBatteryOptimizations(context.packageName) ?: false
      } else {
        true
      }
    }

    AsyncFunction("requestIgnoreBatteryOptimizations") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
            data = Uri.parse("package:${context.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          context.startActivity(intent)
          true
        } else {
          true
        }
      } catch (e: Exception) {
        try {
          val fallback = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          context.startActivity(fallback)
          true
        } catch (e2: Exception) {
          false
        }
      }
    }

    AsyncFunction("openDefaultAssistantSettings") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val intent = Intent(Settings.ACTION_VOICE_INPUT_SETTINGS).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        true
      } catch (e: Exception) {
        try {
          val fallback = Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          context.startActivity(fallback)
          true
        } catch (e2: Exception) {
          false
        }
      }
    }

    OnCreate {
      ArgusVoiceDaemonService.onWakeWordCallback = { command ->
        sendEvent("onWakeWordDetected", Bundle().apply {
          putString("command", command)
        })
      }
    }

    OnDestroy {
      ArgusVoiceDaemonService.onWakeWordCallback = null
    }

    // =========================================================================
    // 5. HARDWARE MEDIA RECORDER & MULTIMODAL AUDIO CAPTURE
    // =========================================================================

    AsyncFunction("startAudioCapture") { ->
      val context = appContext.reactContext ?: return@AsyncFunction "{\"success\":false,\"error\":\"No context\"}"
      try {
        if (mediaRecorder != null) {
          try {
            mediaRecorder?.stop()
          } catch (e: Exception) {}
          try {
            mediaRecorder?.release()
          } catch (e: Exception) {}
          mediaRecorder = null
        }

        val cacheDir = context.cacheDir
        var audioFile = File(cacheDir, "argus_voice_${System.currentTimeMillis()}.m4a")
        audioRecordingFile = audioFile

        var recorder: MediaRecorder? = null
        var recordStarted = false

        // Attempt 1: Standard AAC / MPEG4
        try {
          recorder = @Suppress("DEPRECATION") MediaRecorder().apply {
            setAudioSource(MediaRecorder.AudioSource.MIC)
            setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            setOutputFile(audioFile.absolutePath)
            prepare()
            start()
          }
          recordStarted = true
        } catch (e1: Exception) {
          try {
            recorder?.release()
          } catch (e: Exception) {}
          recorder = null
        }

        // Attempt 2: Universal 3GPP / AMR_NB fallback for MediaTek/HiOS chips
        if (!recordStarted) {
          try {
            audioFile = File(cacheDir, "argus_voice_${System.currentTimeMillis()}.3gp")
            audioRecordingFile = audioFile
            recorder = @Suppress("DEPRECATION") MediaRecorder().apply {
              setAudioSource(MediaRecorder.AudioSource.MIC)
              setOutputFormat(MediaRecorder.OutputFormat.THREE_GPP)
              setAudioEncoder(MediaRecorder.AudioEncoder.AMR_NB)
              setOutputFile(audioFile.absolutePath)
              prepare()
              start()
            }
            recordStarted = true
          } catch (e2: Exception) {
            try {
              recorder?.release()
            } catch (e: Exception) {}
            recorder = null
            return@AsyncFunction "{\"success\":false,\"error\":\"Hardware audio initialization error: ${e2.message}\"}"
          }
        }

        mediaRecorder = recorder
        "{\"success\":true}"
      } catch (e: Exception) {
        "{\"success\":false,\"error\":\"${e.message}\"}"
      }
    }

    AsyncFunction("stopAudioCapture") { ->
      try {
        val recorder = mediaRecorder
        if (recorder != null) {
          try {
            recorder.stop()
          } catch (e: Exception) {}
          try {
            recorder.release()
          } catch (e: Exception) {}
          mediaRecorder = null
        }

        val file = audioRecordingFile
        if (file != null && file.exists() && file.length() > 0) {
          val bytes = file.readBytes()
          val mime = if (file.name.endsWith(".3gp")) "audio/3gpp" else "audio/mp4"
          file.delete()
          audioRecordingFile = null
          val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
          "$mime;$base64"
        } else {
          ""
        }
      } catch (e: Exception) {
        ""
      }
    }

    AsyncFunction("getAudioCaptureAmplitude") { ->
      try {
        mediaRecorder?.maxAmplitude ?: 0
      } catch (e: Exception) {
        0
      }
    }

    // =========================================================================
    // 5. DIRECT SMS INBOX ACCESS & BANK TRANSACTION EXTRACTION
    // =========================================================================

    AsyncFunction("hasSmsPermission") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.READ_SMS
      ) == PackageManager.PERMISSION_GRANTED
    }

    AsyncFunction("readBankSmsMessages") { limit: Int ->
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Bundle>()
      val resultList = mutableListOf<Bundle>()

      val hasPerm = ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.READ_SMS
      ) == PackageManager.PERMISSION_GRANTED

      if (!hasPerm) {
        return@AsyncFunction resultList
      }

      val maxRows = if (limit in 1..200) limit else 50
      val uri = Uri.parse("content://sms/inbox")
      val projection = arrayOf("_id", "address", "body", "date")
      val sortOrder = "date DESC LIMIT $maxRows"

      try {
        val cursor = context.contentResolver.query(uri, projection, null, null, sortOrder)
        cursor?.use { c ->
          val idIdx = c.getColumnIndex("_id")
          val addressIdx = c.getColumnIndex("address")
          val bodyIdx = c.getColumnIndex("body")
          val dateIdx = c.getColumnIndex("date")

          while (c.moveToNext()) {
            val id = if (idIdx >= 0) c.getString(idIdx) ?: "" else ""
            val address = if (addressIdx >= 0) c.getString(addressIdx) ?: "" else ""
            val body = if (bodyIdx >= 0) c.getString(bodyIdx) ?: "" else ""
            val dateLong = if (dateIdx >= 0) c.getLong(dateIdx) else 0L

            val bundle = Bundle().apply {
              putString("id", id)
              putString("address", address)
              putString("body", body)
              putDouble("timestamp", dateLong.toDouble())
            }
            resultList.add(bundle)
          }
        }
      } catch (e: Exception) {
        android.util.Log.e("ArgusSystemMonitors", "Error reading SMS inbox: ${e.message}")
      }

      resultList
    }
  }
}

