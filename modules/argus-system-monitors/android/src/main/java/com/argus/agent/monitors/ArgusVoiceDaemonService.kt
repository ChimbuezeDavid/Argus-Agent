package com.argus.agent.monitors

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import androidx.core.content.ContextCompat
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import java.util.Locale

/**
 * Argus Voice Daemon Service (Bixby-style persistent native background listener & overlay).
 * Runs as a sticky Android Foreground Service with FOREGROUND_SERVICE_TYPE_MICROPHONE.
 * Features:
 * 1. Persistent background microphone acoustic recognition loop.
 * 2. Customizable wake-word spotting ("Hey Argus", "Hey Dave", "Dave", "Hey Gee", "Siri").
 * 3. Bixby-style floating heads-up capsule overlay (SYSTEM_ALERT_WINDOW).
 * 4. Native on-device Text-to-Speech (TTS) audio feedback.
 */
class ArgusVoiceDaemonService : Service(), TextToSpeech.OnInitListener {

    companion object {
        const val TAG = "ArgusVoiceDaemon"
        const val CHANNEL_ID = "argus_voice_daemon_channel"
        const val NOTIFICATION_ID = 9002

        @Volatile
        var isRunning: Boolean = false
            private set

        @Volatile
        var instance: ArgusVoiceDaemonService? = null
            private set

        @Volatile
        var customWakeWord: String = "Hey Argus"

        var onWakeWordCallback: ((String) -> Unit)? = null
    }

    private var speechRecognizer: SpeechRecognizer? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false

    private val mainHandler = Handler(Looper.getMainLooper())
    private var isRestarting = false
    private var isDestroyed = false

    private var windowManager: WindowManager? = null
    private var floatingCapsuleView: View? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        instance = this
        Log.i(TAG, "ArgusVoiceDaemonService onCreate")

        // Load saved wake word from persistent storage
        try {
            val prefs = getSharedPreferences(ArgusBootReceiver.PREFS_NAME, Context.MODE_PRIVATE)
            val savedWord = prefs.getString(ArgusBootReceiver.KEY_CUSTOM_WAKE_WORD, null)
            if (!savedWord.isNullOrBlank()) {
                customWakeWord = savedWord
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to load saved wake word: ${e.message}")
        }

        windowManager = getSystemService(Context.WINDOW_SERVICE) as? WindowManager

        try {
            tts = TextToSpeech(this, this)
        } catch (e: Exception) {
            Log.w(TAG, "TTS initialization failed: ${e.message}")
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            ttsReady = true
            tts?.language = Locale.US
            tts?.setPitch(1.0f)
            tts?.setSpeechRate(1.05f)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.i(TAG, "ArgusVoiceDaemonService onStartCommand (VLC-style background guard)")
        isRunning = true
        isDestroyed = false

        // Mark daemon as actively enabled in persistent storage
        try {
            val prefs = getSharedPreferences(ArgusBootReceiver.PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putBoolean(ArgusBootReceiver.KEY_DAEMON_ENABLED, true)
                .putBoolean(ArgusBootReceiver.KEY_IS_RUNNING, true)
                .apply()

            val incomingWakeWord = intent?.getStringExtra("custom_wake_word")
            if (!incomingWakeWord.isNullOrBlank()) {
                customWakeWord = incomingWakeWord.trim()
                prefs.edit().putString(ArgusBootReceiver.KEY_CUSTOM_WAKE_WORD, customWakeWord).apply()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to persist daemon state: ${e.message}")
        }

        acquireWakeLock()
        createNotificationChannel()

        val notification = buildForegroundNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        startContinuousRecognizer()

        // START_STICKY ensures Android OS resurrects the service if killed for memory
        return START_STICKY
    }

    private fun acquireWakeLock() {
        try {
            if (wakeLock == null) {
                val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
                wakeLock = powerManager?.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "argus:VoiceDaemonWakeLock"
                )?.apply {
                    setReferenceCounted(false)
                    acquire() // Indefinite background wake lock while service is running
                }
            } else if (wakeLock?.isHeld == false) {
                wakeLock?.acquire()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to acquire wake lock: ${e.message}")
        }
    }

    private fun releaseWakeLock() {
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
            wakeLock = null
        } catch (e: Exception) {
            Log.w(TAG, "Failed to release wake lock: ${e.message}")
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Argus Voice Guard",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps Argus hands-free voice control active in the background"
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    fun updateNotification(title: String, text: String) {
        try {
            val notification = buildForegroundNotification(title, text)
            val manager = getSystemService(NotificationManager::class.java)
            manager?.notify(NOTIFICATION_ID, notification)
        } catch (e: Exception) {}
    }

    private fun buildForegroundNotification(
        title: String = "Argus Voice Active",
        text: String = "Listening for '$customWakeWord' hands-free..."
    ): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = if (launchIntent != null) {
            PendingIntent.getActivity(
                this,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
            )
        } else null

        val iconRes = applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.ic_btn_speak_now

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(iconRes)
            .setOngoing(true)
            .setAutoCancel(false)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
        }

        return builder.build()
    }

    private fun startContinuousRecognizer() {
        if (isDestroyed) return

        mainHandler.post {
            try {
                if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    Log.w(TAG, "RECORD_AUDIO permission not granted, pausing continuous recognizer")
                    scheduleRecognizerRestart(3000)
                    return@post
                }

                if (speechRecognizer != null) {
                    try {
                        speechRecognizer?.cancel()
                        speechRecognizer?.destroy()
                    } catch (e: Exception) {}
                    speechRecognizer = null
                }

                if (!SpeechRecognizer.isRecognitionAvailable(this)) {
                    Log.w(TAG, "Speech recognition not available on this device")
                    return@post
                }

                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this).apply {
                    setRecognitionListener(object : RecognitionListener {
                        override fun onReadyForSpeech(params: Bundle?) {}
                        override fun onBeginningOfSpeech() {}
                        override fun onRmsChanged(rmsdB: Float) {}
                        override fun onBufferReceived(buffer: ByteArray?) {}
                        override fun onEndOfSpeech() {
                            scheduleRecognizerRestart(350)
                        }
                        override fun onError(error: Int) {
                            Log.d(TAG, "SpeechRecognizer ambient error code: $error")
                            if (error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY) {
                                try {
                                    speechRecognizer?.cancel()
                                    speechRecognizer?.destroy()
                                } catch (e: Exception) {}
                                speechRecognizer = null
                                scheduleRecognizerRestart(800)
                            } else if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
                                updateNotification("Argus Voice Paused", "Microphone access requires Assistant permission")
                                scheduleRecognizerRestart(3000)
                            } else {
                                scheduleRecognizerRestart(450)
                            }
                        }
                        override fun onResults(results: Bundle?) {
                            val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            val text = if (!matches.isNullOrEmpty()) matches[0] else ""
                            checkAndHandleWakeWord(text)
                            scheduleRecognizerRestart(350)
                        }
                        override fun onPartialResults(partialResults: Bundle?) {
                            val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            val text = if (!matches.isNullOrEmpty()) matches[0] else ""
                            checkAndHandleWakeWord(text)
                        }
                        override fun onEvent(eventType: Int, params: Bundle?) {}
                    })
                }

                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
                    putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toString())
                }

                speechRecognizer?.startListening(intent)
            } catch (e: Exception) {
                Log.w(TAG, "Error starting speech recognizer: ${e.message}")
                scheduleRecognizerRestart(1500)
            }
        }
    }

    private fun scheduleRecognizerRestart(delayMs: Long) {
        if (isDestroyed || isRestarting) return
        isRestarting = true

        mainHandler.postDelayed({
            isRestarting = false
            if (!isDestroyed && isRunning) {
                startContinuousRecognizer()
            }
        }, delayMs)
    }

    private fun checkAndHandleWakeWord(transcript: String) {
        if (transcript.isBlank()) return

        val clean = transcript.trim().lowercase(Locale.ROOT)
        val trigger = customWakeWord.trim().lowercase(Locale.ROOT)
        val core = trigger.replace(Regex("^(?:hey|hi|hello|ok|okay)\\s+"), "")

        val patterns = listOf(
            Regex("^(?:hey|hi|hello|ok|okay)?\\s*${Regex.escape(trigger)}[\\s,]*(.*)$", RegexOption.IGNORE_CASE),
            Regex("^(?:hey|hi|hello|ok|okay)?\\s*${Regex.escape(core)}[\\s,]*(.*)$", RegexOption.IGNORE_CASE),
            Regex("^(?:hey|hi|hello|ok|okay)?\\s*argus[\\s,]*(.*)$", RegexOption.IGNORE_CASE)
        )

        for (pattern in patterns) {
            val match = pattern.find(clean)
            if (match != null) {
                val command = match.groupValues.getOrNull(1)?.trim() ?: ""
                Log.i(TAG, "Custom wake word '$trigger' triggered! Command: '$command'")

                triggerHapticAlert()
                showBixbyFloatingCapsule(command.ifEmpty { "I'm listening..." })
                wakeUpAndExecute(command)
                return
            }
        }
    }

    private fun triggerHapticAlert() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator?.vibrate(
                    VibrationEffect.createWaveform(longArrayOf(0, 50, 70, 50), -1)
                )
            } else {
                @Suppress("DEPRECATION")
                val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 50, 70, 50), -1))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator?.vibrate(longArrayOf(0, 50, 70, 50), -1)
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Vibration failed: ${e.message}")
        }
    }

    /**
     * Bixby-Style Floating Heads-Up Capsule Overlay
     * Displays a compact, sleek frosted pill over the current screen.
     */
    private fun showBixbyFloatingCapsule(message: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            return
        }

        mainHandler.post {
            try {
                removeFloatingCapsule()

                val context = this
                val wmParams = WindowManager.LayoutParams().apply {
                    type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                    } else {
                        @Suppress("DEPRECATION")
                        WindowManager.LayoutParams.TYPE_PHONE
                    }
                    format = PixelFormat.TRANSLUCENT
                    flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                    width = WindowManager.LayoutParams.WRAP_CONTENT
                    height = WindowManager.LayoutParams.WRAP_CONTENT
                    gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
                    y = 120 // 120px above bottom bar
                }

                val capsule = LinearLayout(context).apply {
                    orientation = LinearLayout.HORIZONTAL
                    setPadding(36, 20, 36, 20)
                    background = GradientDrawable().apply {
                        cornerRadius = 50f
                        setColor(Color.parseColor("#1e1b4b"))
                        setStroke(2, Color.parseColor("#6366f1"))
                    }

                    // Dot indicator
                    val dot = View(context).apply {
                        background = GradientDrawable().apply {
                            shape = GradientDrawable.OVAL
                            setColor(Color.parseColor("#34d399"))
                        }
                    }
                    val dotParams = LinearLayout.LayoutParams(16, 16).apply {
                        gravity = Gravity.CENTER_VERTICAL
                        rightMargin = 16
                    }
                    addView(dot, dotParams)

                    // Text label
                    val label = TextView(context).apply {
                        text = "Argus • $message"
                        setTextColor(Color.WHITE)
                        textSize = 13f
                        gravity = Gravity.CENTER_VERTICAL
                    }
                    val labelParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {
                        gravity = Gravity.CENTER_VERTICAL
                    }
                    addView(label, labelParams)

                    setOnClickListener {
                        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                        }
                        if (launchIntent != null) startActivity(launchIntent)
                        removeFloatingCapsule()
                    }
                }

                floatingCapsuleView = capsule
                windowManager?.addView(capsule, wmParams)

                // Auto-dismiss after 4 seconds
                mainHandler.postDelayed({
                    removeFloatingCapsule()
                }, 4000)
            } catch (e: Exception) {
                Log.w(TAG, "Floating capsule display error: ${e.message}")
            }
        }
    }

    private fun removeFloatingCapsule() {
        try {
            if (floatingCapsuleView != null) {
                windowManager?.removeView(floatingCapsuleView)
                floatingCapsuleView = null
            }
        } catch (e: Exception) {}
    }

    /**
     * Speaks audio feedback directly through native Text-to-Speech.
     */
    fun speakFeedback(text: String) {
        if (ttsReady && tts != null && text.isNotBlank()) {
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "argus_daemon_tts")
        }
    }

    private fun wakeUpAndExecute(command: String) {
        // 1. Notify static callback if React Native is attached
        onWakeWordCallback?.invoke(command)

        // 2. Launch or bring MainActivity to the foreground
        try {
            val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                putExtra("wake_word_command", command)
                putExtra("from_voice_daemon", true)
            }
            if (launchIntent != null) {
                startActivity(launchIntent)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to launch activity from background daemon: ${e.message}")
        }
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        Log.i(TAG, "onTaskRemoved: App task swiped from recents; preserving Voice Daemon in background like VLC")

        try {
            val prefs = getSharedPreferences(ArgusBootReceiver.PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putBoolean(ArgusBootReceiver.KEY_DAEMON_ENABLED, true).apply()
        } catch (e: Exception) {}

        acquireWakeLock()
        val notification = buildForegroundNotification()
        val manager = getSystemService(NotificationManager::class.java)
        manager?.notify(NOTIFICATION_ID, notification)

        // Arm AlarmManager fallback to resurrect the daemon after 1000ms if OS aggressively terminates the process
        try {
            val restartIntent = Intent(applicationContext, ArgusRestartReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(
                applicationContext,
                1001,
                restartIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
            )
            val alarmManager = getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            val triggerAt = SystemClock.elapsedRealtime() + 1000
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager?.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pendingIntent)
            } else {
                alarmManager?.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pendingIntent)
            }
        } catch (e: Exception) {
            Log.w(TAG, "AlarmManager restart fallback failed: ${e.message}")
        }

        scheduleRecognizerRestart(300)
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.i(TAG, "ArgusVoiceDaemonService onDestroy")
        isDestroyed = true
        isRunning = false
        instance = null

        try {
            val prefs = getSharedPreferences(ArgusBootReceiver.PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putBoolean(ArgusBootReceiver.KEY_IS_RUNNING, false).apply()
        } catch (e: Exception) {}

        mainHandler.removeCallbacksAndMessages(null)
        removeFloatingCapsule()
        releaseWakeLock()

        try {
            speechRecognizer?.cancel()
            speechRecognizer?.destroy()
            speechRecognizer = null
        } catch (e: Exception) {}

        try {
            tts?.stop()
            tts?.shutdown()
            tts = null
            ttsReady = false
        } catch (e: Exception) {}

        // If the service was destroyed by OS while still enabled in persistent settings, resurrect it!
        try {
            val prefs = getSharedPreferences(ArgusBootReceiver.PREFS_NAME, Context.MODE_PRIVATE)
            if (prefs.getBoolean(ArgusBootReceiver.KEY_DAEMON_ENABLED, false)) {
                Log.i(TAG, "Service destroyed by OS while enabled; arming resurrection alarm")
                val restartIntent = Intent(applicationContext, ArgusRestartReceiver::class.java)
                val pendingIntent = PendingIntent.getBroadcast(
                    applicationContext,
                    1002,
                    restartIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
                )
                val alarmManager = getSystemService(Context.ALARM_SERVICE) as? AlarmManager
                val triggerAt = SystemClock.elapsedRealtime() + 1500
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager?.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pendingIntent)
                } else {
                    alarmManager?.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pendingIntent)
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Resurrection alarm failed: ${e.message}")
        }
    }
}
