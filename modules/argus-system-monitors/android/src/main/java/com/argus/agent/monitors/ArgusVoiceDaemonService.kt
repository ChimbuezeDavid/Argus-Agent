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
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaRecorder
import kotlin.math.sqrt
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

    private var audioRecord: AudioRecord? = null
    private var audioRecordThread: Thread? = null
    @Volatile
    private var isAudioRecordRunning = false
    private var audioManager: AudioManager? = null
    private var activeAudioFocusRequest: AudioFocusRequest? = null

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
        audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager

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

        startPassiveAudioRecordStream()

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

    private fun startPassiveAudioRecordStream() {
        if (isDestroyed || isAudioRecordRunning) return

        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "RECORD_AUDIO permission not granted; passive listener paused")
            return
        }

        try {
            val sampleRate = 16000
            val channelConfig = AudioFormat.CHANNEL_IN_MONO
            val audioFormat = AudioFormat.ENCODING_PCM_16BIT
            val minBufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)
            val bufferSize = maxOf(minBufferSize, 4096)

            // Strategy 1: VOICE_RECOGNITION signals HAL to apply acoustic echo cancellation
            // and noise suppression without forcefully pre-empting ongoing media playback.
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                sampleRate,
                channelConfig,
                audioFormat,
                bufferSize
            )

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                Log.w(TAG, "AudioRecord failed to initialize with VOICE_RECOGNITION")
                return
            }

            audioRecord?.startRecording()
            isAudioRecordRunning = true
            Log.i(TAG, "Passive continuous AudioRecord stream running (VOICE_RECOGNITION, zero audio focus)")

            // Strategy 3: Single continuous stream on a dedicated background thread (no open/close churn)
            audioRecordThread = Thread({
                val audioBuffer = ShortArray(bufferSize / 2)
                var consecutiveVoiceFrames = 0
                var isTriggerHandled = false
                var triggerCooldownUntil = 0L

                while (isRunning && !isDestroyed && isAudioRecordRunning) {
                    val readCount = audioRecord?.read(audioBuffer, 0, audioBuffer.size) ?: 0
                    if (readCount > 0) {
                        val now = System.currentTimeMillis()
                        if (now < triggerCooldownUntil) {
                            continue
                        }

                        // Compute RMS acoustic energy of the PCM chunk
                        var sum = 0.0
                        for (i in 0 until readCount) {
                            val sample = audioBuffer[i].toDouble()
                            sum += sample * sample
                        }
                        val rms = sqrt(sum / readCount)

                        // Acoustic Voice Activity Detection (VAD)
                        // Hardware AEC suppresses background music from phone speakers;
                        // near-mic human vocal acoustics yield a distinct RMS envelope (> 650)
                        if (rms > 650.0) {
                            consecutiveVoiceFrames++
                            if (consecutiveVoiceFrames >= 3 && !isTriggerHandled) {
                                isTriggerHandled = true
                                triggerCooldownUntil = now + 4000L
                                consecutiveVoiceFrames = 0

                                mainHandler.post {
                                    handleAcousticHotwordTrigger()
                                }
                            }
                        } else {
                            if (consecutiveVoiceFrames > 0) {
                                consecutiveVoiceFrames--
                            }
                            isTriggerHandled = false
                        }
                    }
                }
            }, "ArgusPassiveAudioThread").apply {
                priority = Thread.NORM_PRIORITY
                start()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to start passive audio stream: ${e.message}")
        }
    }

    private fun stopPassiveAudioRecordStream() {
        isAudioRecordRunning = false
        try {
            audioRecordThread?.interrupt()
            audioRecordThread = null
        } catch (e: Exception) {}

        try {
            if (audioRecord?.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                audioRecord?.stop()
            }
            audioRecord?.release()
            audioRecord = null
        } catch (e: Exception) {}
    }

    // Strategy 2: Request transient focus with ducking ONLY during active interaction
    private fun requestActiveInteractionAudioFocus() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build()
                    )
                    .setOnAudioFocusChangeListener { /* handle changes */ }
                    .build()
                activeAudioFocusRequest = focusRequest
                audioManager?.requestAudioFocus(focusRequest)
            } else {
                @Suppress("DEPRECATION")
                audioManager?.requestAudioFocus(
                    null,
                    AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
                )
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to request interaction audio focus: ${e.message}")
        }
    }

    private fun abandonInteractionAudioFocus() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                activeAudioFocusRequest?.let { audioManager?.abandonAudioFocusRequest(it) }
                activeAudioFocusRequest = null
            } else {
                @Suppress("DEPRECATION")
                audioManager?.abandonAudioFocus(null)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to abandon interaction audio focus: ${e.message}")
        }
    }

    private fun handleAcousticHotwordTrigger() {
        Log.i(TAG, "Acoustic hotword/voice trigger activated!")
        triggerHapticAlert()

        // Softly duck running Spotify/VLC music to 20%
        requestActiveInteractionAudioFocus()

        // 1. Launch lightweight Ella transparent overlay session directly over active app
        val overlayTriggered = EllaVoiceInteractionService.triggerOverlaySession("")
        if (!overlayTriggered) {
            // Fallback to floating capsule overlay
            showBixbyFloatingCapsule("I'm listening...")
            wakeUpAndExecute("")
        }

        // Release audio ducking after interaction window completes
        mainHandler.postDelayed({
            abandonInteractionAudioFocus()
        }, 5000L)
    }


    private fun checkAndHandleWakeWord(transcript: String) {
        if (transcript.isBlank()) return

        val clean = transcript.trim().lowercase(Locale.ROOT)
        val trigger = customWakeWord.trim().lowercase(Locale.ROOT)
        val core = trigger.replace(Regex("^(?:hey|hi|hello|ok|okay)\\s+"), "")

        val patterns = listOf(
            Regex("^(?:hey|hi|hello|ok|okay)?\\s*${Regex.escape(trigger)}[\\s,]*(.*)$", RegexOption.IGNORE_CASE),
            Regex("^(?:hey|hi|hello|ok|okay)?\\s*${Regex.escape(core)}[\\s,]*(.*)$", RegexOption.IGNORE_CASE),
            Regex("^(?:hey|hi|hello|ok|okay)?\\s*ella[\\s,]*(.*)$", RegexOption.IGNORE_CASE),
            Regex("^(?:hey|hi|hello|ok|okay)?\\s*argus[\\s,]*(.*)$", RegexOption.IGNORE_CASE)
        )

        for (pattern in patterns) {
            val match = pattern.find(clean)
            if (match != null) {
                val command = match.groupValues.getOrNull(1)?.trim() ?: ""
                Log.i(TAG, "Voice hotword '$trigger' triggered! Command: '$command'")

                triggerHapticAlert()

                // 1. Launch lightweight Ella transparent overlay session directly over whatever app is active
                val overlayTriggered = EllaVoiceInteractionService.triggerOverlaySession(command)
                if (!overlayTriggered) {
                    // 2. Fallback to floating capsule overlay
                    showBixbyFloatingCapsule(command.ifEmpty { "I'm listening..." })
                    wakeUpAndExecute(command)
                }
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

        // 2. Launch or bring MainActivity to the foreground via direct intent & fullScreenIntent fallback
        try {
            val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                putExtra("wake_word_command", command)
                putExtra("from_voice_daemon", true)
            }
            if (launchIntent != null) {
                // Try direct launch
                try {
                    startActivity(launchIntent)
                } catch (e: Exception) {
                    Log.w(TAG, "Direct background startActivity blocked: ${e.message}")
                }

                // Android 10+ background launch bypass: dispatch fullScreenIntent notification
                val fullScreenPendingIntent = PendingIntent.getActivity(
                    this,
                    9003,
                    launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
                )

                val wakeChannelId = "argus_wake_alert_channel"
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val wakeChannel = NotificationChannel(
                        wakeChannelId,
                        "Argus Wake Triggers",
                        NotificationManager.IMPORTANCE_HIGH
                    ).apply {
                        description = "Immediate heads-up alert when hands-free wake word is spoken"
                        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                    }
                    val manager = getSystemService(NotificationManager::class.java)
                    manager?.createNotificationChannel(wakeChannel)
                }

                val wakeNotification = NotificationCompat.Builder(this, wakeChannelId)
                    .setSmallIcon(applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.ic_btn_speak_now)
                    .setContentTitle("Argus Awakened ($customWakeWord)")
                    .setContentText(if (command.isNotBlank()) "Command: \"$command\"" else "Listening for your voice instruction...")
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setAutoCancel(true)
                    .setContentIntent(fullScreenPendingIntent)
                    .setFullScreenIntent(fullScreenPendingIntent, true)
                    .build()

                val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                notificationManager?.notify(9003, wakeNotification)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to launch activity from background daemon: ${e.message}")
        }
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        Log.i(TAG, "onTaskRemoved: Recents swipe detected; scheduling immediate self-healing revival via AlarmManager")

        try {
            val prefs = getSharedPreferences(ArgusBootReceiver.PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putBoolean(ArgusBootReceiver.KEY_DAEMON_ENABLED, true).apply()
        } catch (e: Exception) {}

        acquireWakeLock()
        val notification = buildForegroundNotification()
        val manager = getSystemService(NotificationManager::class.java)
        manager?.notify(NOTIFICATION_ID, notification)

        // Reschedule restart via AlarmManager as self-healing insurance policy
        scheduleServiceRestart()
        scheduleRecognizerRestart(300)
    }

    private fun scheduleServiceRestart() {
        try {
            val restartIntent = Intent(applicationContext, ArgusVoiceDaemonService::class.java).apply {
                putExtra("custom_wake_word", customWakeWord)
            }
            val pendingIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                PendingIntent.getForegroundService(
                    this,
                    1,
                    restartIntent,
                    PendingIntent.FLAG_ONE_SHOT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
                )
            } else {
                PendingIntent.getService(
                    this,
                    1,
                    restartIntent,
                    PendingIntent.FLAG_ONE_SHOT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
                )
            }

            val alarmManager = getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val triggerTime = System.currentTimeMillis() + 1000

            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        triggerTime,
                        pendingIntent
                    )
                } else {
                    alarmManager.setExact(
                        AlarmManager.RTC_WAKEUP,
                        triggerTime,
                        pendingIntent
                    )
                }
            } catch (secEx: SecurityException) {
                Log.w(TAG, "Exact alarm restricted; falling back to setAndAllowWhileIdle: ${secEx.message}")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        triggerTime,
                        pendingIntent
                    )
                } else {
                    alarmManager.set(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
                }
            }

            // Dual insurance: Also arm BroadcastReceiver fallback
            val broadcastIntent = Intent(applicationContext, ArgusRestartReceiver::class.java)
            val broadcastPendingIntent = PendingIntent.getBroadcast(
                applicationContext,
                1001,
                broadcastIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
            )
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        triggerTime + 500,
                        broadcastPendingIntent
                    )
                }
            } catch (e: Exception) {}
        } catch (e: Exception) {
            Log.w(TAG, "scheduleServiceRestart failed: ${e.message}")
        }
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
        stopPassiveAudioRecordStream()
        abandonInteractionAudioFocus()
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
                Log.i(TAG, "Service destroyed by OS while enabled; executing self-healing resurrection")
                scheduleServiceRestart()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Resurrection alarm failed: ${e.message}")
        }
    }
}
