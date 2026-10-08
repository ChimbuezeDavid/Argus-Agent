package com.argus.agent.monitors

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * Boot & Package Replace Receiver for Argus Agent.
 * Ensures the persistent Voice Daemon runs automatically on device boot or update,
 * even if the user hasn't explicitly launched the Argus application (VLC-style background persistence).
 */
class ArgusBootReceiver : BroadcastReceiver() {

    companion object {
        const val TAG = "ArgusBootReceiver"
        const val PREFS_NAME = "argus_voice_prefs"
        const val KEY_DAEMON_ENABLED = "voice_daemon_enabled"
        const val KEY_IS_RUNNING = "voice_daemon_is_running"
        const val KEY_CUSTOM_WAKE_WORD = "custom_wake_word"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        Log.i(TAG, "ArgusBootReceiver received action: $action")

        if (action == Intent.ACTION_BOOT_COMPLETED ||
            action == Intent.ACTION_MY_PACKAGE_REPLACED ||
            action == "android.intent.action.QUICKBOOT_POWERON" ||
            action == "com.htc.intent.action.QUICKBOOT_POWERON"
        ) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val isEnabled = prefs.getBoolean(KEY_DAEMON_ENABLED, true)

            if (isEnabled) {
                val savedWakeWord = prefs.getString(KEY_CUSTOM_WAKE_WORD, "Hey Argus") ?: "Hey Argus"
                Log.i(TAG, "Auto-starting ArgusVoiceDaemonService on boot with wake word '$savedWakeWord'")

                val serviceIntent = Intent(context, ArgusVoiceDaemonService::class.java).apply {
                    putExtra("custom_wake_word", savedWakeWord)
                }

                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(serviceIntent)
                    } else {
                        context.startService(serviceIntent)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to start ArgusVoiceDaemonService on boot: ${e.message}")
                }
            } else {
                Log.i(TAG, "Voice daemon auto-start skipped (disabled by user settings)")
            }
        }
    }
}
