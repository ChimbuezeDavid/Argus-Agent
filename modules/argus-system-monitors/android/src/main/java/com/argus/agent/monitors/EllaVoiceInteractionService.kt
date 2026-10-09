package com.argus.agent.monitors

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.service.voice.VoiceInteractionService
import android.service.voice.VoiceInteractionSession
import android.util.Log

/**
 * EllaVoiceInteractionService: Registered as the Android system assistant handler.
 * Runs in the background and can launch lightweight overlay sessions directly
 * without bringing MainActivity to the foreground.
 */
class EllaVoiceInteractionService : VoiceInteractionService() {

    companion object {
        const val TAG = "EllaVoiceInteraction"

        @Volatile
        var instance: EllaVoiceInteractionService? = null
            private set

        fun triggerOverlaySession(command: String? = null): Boolean {
            val service = instance ?: return false
            return try {
                val args = Bundle().apply {
                    if (!command.isNullOrBlank()) {
                        putString("wake_word_command", command)
                    }
                }
                service.showSession(args, VoiceInteractionSession.SHOW_WITH_ASSIST)
                true
            } catch (e: Exception) {
                Log.w(TAG, "Failed to show voice session: ${e.message}")
                false
            }
        }
    }

    override fun onReady() {
        super.onReady()
        instance = this
        Log.i(TAG, "EllaVoiceInteractionService is ready as system default assistant")

        // Ensure Argus continuous voice daemon is running alongside
        try {
            val daemonIntent = Intent(this, ArgusVoiceDaemonService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(daemonIntent)
            } else {
                startService(daemonIntent)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not start voice daemon from interaction service: ${e.message}")
        }
    }

    override fun onShutdown() {
        super.onShutdown()
        instance = null
        Log.i(TAG, "EllaVoiceInteractionService shutdown")
    }
}
