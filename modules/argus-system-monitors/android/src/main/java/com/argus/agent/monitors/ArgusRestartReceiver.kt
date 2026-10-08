package com.argus.agent.monitors

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * Resurrects ArgusVoiceDaemonService if Android OS kills the process after
 * task removal from recent apps or low memory conditions.
 */
class ArgusRestartReceiver : BroadcastReceiver() {

    companion object {
        const val TAG = "ArgusRestartReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        Log.i(TAG, "ArgusRestartReceiver triggered to resurrect Voice Daemon in background")
        val prefs = context.getSharedPreferences(ArgusBootReceiver.PREFS_NAME, Context.MODE_PRIVATE)
        val isEnabled = prefs.getBoolean(ArgusBootReceiver.KEY_DAEMON_ENABLED, true)

        if (isEnabled) {
            val savedWakeWord = prefs.getString(ArgusBootReceiver.KEY_CUSTOM_WAKE_WORD, "Hey Argus") ?: "Hey Argus"
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
                Log.e(TAG, "Failed to resurrect ArgusVoiceDaemonService: ${e.message}")
            }
        }
    }
}
