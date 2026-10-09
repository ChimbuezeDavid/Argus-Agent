package com.argus.agent.monitors

import android.os.Bundle
import android.service.voice.VoiceInteractionSession
import android.service.voice.VoiceInteractionSessionService

/**
 * Service that instantiates EllaVoiceInteractionSession whenever the user invokes Ella
 * via Assist intent, gesture, power button, or background hotword trigger.
 */
class EllaVoiceInteractionSessionService : VoiceInteractionSessionService() {
    override fun onNewSession(args: Bundle?): VoiceInteractionSession {
        return EllaVoiceInteractionSession(this)
    }
}
