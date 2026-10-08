package com.argus.agent.monitors

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import androidx.core.app.NotificationCompat
import java.util.Locale

/**
 * Argus Voice Daemon Service (Bixby-style persistent native background listener).
 * Runs as a sticky Android Foreground Service with FOREGROUND_SERVICE_TYPE_MICROPHONE.
 * Keeps listening for "Hey Argus" even when the app is minimized, closed, or screen is locked.
 */
class ArgusVoiceDaemonService : Service() {

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

        var onWakeWordCallback: ((String) -> Unit)? = null
    }

    private var speechRecognizer: SpeechRecognizer? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var isRestarting = false
    private var isDestroyed = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        instance = this
        Log.i(TAG, "ArgusVoiceDaemonService onCreate")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.i(TAG, "ArgusVoiceDaemonService onStartCommand")
        isRunning = true
        isDestroyed = false

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
                    acquire(10 * 60 * 1000L) // 10 minutes rolling timeout
                }
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

    private fun buildForegroundNotification(): Notification {
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

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Argus Voice Guard Active")
            .setContentText("Listening for 'Hey Argus' hands-free...")
            .setSmallIcon(iconRes)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)
            .build()
    }

    private fun startContinuousRecognizer() {
        if (isDestroyed) return

        mainHandler.post {
            try {
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
                            // On timeouts or no match, quietly restart
                            scheduleRecognizerRestart(450)
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
        val pattern = Regex("^(?:hey|hi|hello|ok|okay)?\\s*argus[\\s,]*(.*)$", RegexOption.IGNORE_CASE)
        val match = pattern.find(clean)

        if (match != null) {
            val command = match.groupValues.getOrNull(1)?.trim() ?: ""
            Log.i(TAG, "Wake word triggered! Command: '$command'")

            triggerHapticAlert()
            wakeUpAndExecute(command)
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

    private fun wakeUpAndExecute(command: String) {
        // 1. Notify static callback if React Native is attached
        onWakeWordCallback?.invoke(command)

        // 2. Launch or bring MainActivity to the foreground if closed
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

    override fun onDestroy() {
        super.onDestroy()
        Log.i(TAG, "ArgusVoiceDaemonService onDestroy")
        isDestroyed = true
        isRunning = false
        instance = null

        mainHandler.removeCallbacksAndMessages(null)
        releaseWakeLock()

        try {
            speechRecognizer?.cancel()
            speechRecognizer?.destroy()
            speechRecognizer = null
        } catch (e: Exception) {}
    }
}
