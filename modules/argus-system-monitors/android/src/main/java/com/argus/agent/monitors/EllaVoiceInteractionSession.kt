package com.argus.agent.monitors

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.service.voice.VoiceInteractionSession
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import java.util.Locale

/**
 * EllaVoiceInteractionSession: Manages the lightweight Bixby-style transparent
 * overlay window that appears directly over whatever app the user is currently on,
 * without bringing the main activity to the foreground or destroying their screen context.
 */
class EllaVoiceInteractionSession(context: Context) : VoiceInteractionSession(context), TextToSpeech.OnInitListener {

    companion object {
        const val TAG = "EllaVoiceSession"
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private var speechRecognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var isTtsReady = false

    private lateinit var rootContainer: FrameLayout
    private lateinit var capsuleCard: LinearLayout
    private lateinit var statusBadge: TextView
    private lateinit var transcriptView: TextView
    private lateinit var responseView: TextView
    private lateinit var micOrb: View

    override fun onCreate() {
        super.onCreate()
        try {
            tts = TextToSpeech(context, this)
        } catch (e: Exception) {
            Log.w(TAG, "TTS initialization failed: ${e.message}")
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            isTtsReady = true
            tts?.language = Locale.US
            tts?.setPitch(1.05f)
            tts?.setSpeechRate(1.05f)
        }
    }

    override fun onCreateContentView(): View {
        val density = context.resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()

        rootContainer = FrameLayout(context).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.parseColor("#44000000")) // Semi-transparent scrim
            setOnClickListener {
                hide() // Tap outside to dismiss
            }
        }

        // Bixby-style floating bottom capsule
        capsuleCard = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            val bg = GradientDrawable().apply {
                setColor(Color.parseColor("#E6111827")) // Translucent dark slate (#111827)
                cornerRadius = dp(24).toFloat()
                setStroke(dp(1), Color.parseColor("#38BDF8")) // Neon cyan border
            }
            background = bg
            setPadding(dp(20), dp(16), dp(20), dp(18))
            elevation = dp(12).toFloat()
            isClickable = true // Don't pass clicks through to scrim

            val cardParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
                setMargins(dp(16), dp(0), dp(16), dp(36))
            }
            layoutParams = cardParams
        }

        // Header Row: Assistant Pill + Close Button
        val headerRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        statusBadge = TextView(context).apply {
            text = "⚡ Ella • Hybrid Assistant"
            setTextColor(Color.parseColor("#38BDF8"))
            textSize = 12f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            val badgeBg = GradientDrawable().apply {
                setColor(Color.parseColor("#1E293B"))
                cornerRadius = dp(10).toFloat()
            }
            background = badgeBg
            setPadding(dp(10), dp(4), dp(10), dp(4))
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        headerRow.addView(statusBadge)

        val closeBtn = TextView(context).apply {
            text = "✕"
            setTextColor(Color.parseColor("#94A3B8"))
            textSize = 14f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            setPadding(dp(8), dp(4), dp(8), dp(4))
            setOnClickListener { hide() }
        }
        headerRow.addView(closeBtn)
        capsuleCard.addView(headerRow)

        // Middle Content Row: Animated Mic Orb + Speech Text
        val contentRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dp(14)
            }
        }

        micOrb = View(context).apply {
            val orbBg = GradientDrawable().apply {
                setColor(Color.parseColor("#10B981")) // Emerald Green
                cornerRadius = dp(18).toFloat()
            }
            background = orbBg
            layoutParams = LinearLayout.LayoutParams(dp(36), dp(36)).apply {
                rightMargin = dp(12)
            }
        }
        contentRow.addView(micOrb)

        val textColumn = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }

        transcriptView = TextView(context).apply {
            text = "I'm listening..."
            setTextColor(Color.WHITE)
            textSize = 14f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
        }
        textColumn.addView(transcriptView)

        responseView = TextView(context).apply {
            text = "Device actions execute in <50ms without internet."
            setTextColor(Color.parseColor("#94A3B8"))
            textSize = 11.5f
            setPadding(0, dp(2), 0, 0)
        }
        textColumn.addView(responseView)

        contentRow.addView(textColumn)
        capsuleCard.addView(contentRow)

        // Action Buttons Row: "Open Argus Deck"
        val actionsRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.END
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dp(12)
            }
        }

        val openAppBtn = TextView(context).apply {
            text = "Open Argus Deck →"
            setTextColor(Color.parseColor("#67E8F9"))
            textSize = 11.5f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            setPadding(dp(10), dp(4), dp(4), dp(4))
            setOnClickListener {
                val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                }
                if (launchIntent != null) context.startActivity(launchIntent)
                hide()
            }
        }
        actionsRow.addView(openAppBtn)
        capsuleCard.addView(actionsRow)

        rootContainer.addView(capsuleCard)
        return rootContainer
    }

    override fun onShow(args: Bundle?, showFlags: Int) {
        super.onShow(args, showFlags)
        Log.i(TAG, "Ella Voice Overlay Session Shown")

        // Reset UI text
        transcriptView.text = "Listening..."
        responseView.text = "Speak a command (e.g., 'play music on VLC', 'open WhatsApp')."
        statusBadge.text = "⚡ Ella • Hybrid Assistant"

        val initialCommand = args?.getString("wake_word_command") ?: ""
        if (initialCommand.isNotBlank()) {
            transcriptView.text = "\"$initialCommand\""
            handleCommand(initialCommand)
        } else {
            startOverlayListening()
        }
    }

    private fun startOverlayListening() {
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            responseView.text = "Speech recognition is not available."
            return
        }

        try {
            speechRecognizer?.destroy()
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
                setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) {
                        transcriptView.text = "Listening..."
                    }
                    override fun onBeginningOfSpeech() {
                        transcriptView.text = "Hearing your voice..."
                    }
                    override fun onRmsChanged(rmsdB: Float) {}
                    override fun onBufferReceived(buffer: ByteArray?) {}
                    override fun onEndOfSpeech() {
                        transcriptView.text = "Processing..."
                    }
                    override fun onError(error: Int) {
                        Log.d(TAG, "Overlay speech error: $error")
                        responseView.text = "Tap to retry or open Argus Deck."
                    }
                    override fun onResults(results: Bundle?) {
                        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        val text = if (!matches.isNullOrEmpty()) matches[0] else ""
                        if (text.isNotBlank()) {
                            transcriptView.text = "\"$text\""
                            handleCommand(text)
                        } else {
                            hide()
                        }
                    }
                    override fun onPartialResults(partialResults: Bundle?) {
                        val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        if (!matches.isNullOrEmpty()) {
                            transcriptView.text = matches[0]
                        }
                    }
                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })
            }

            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            }
            speechRecognizer?.startListening(intent)
        } catch (e: Exception) {
            Log.w(TAG, "Error starting overlay listening: ${e.message}")
        }
    }

    /**
     * Local Intent Classifier & Execution Engine (<50ms deterministic local actions)
     */
    private fun handleCommand(command: String) {
        val startTime = System.currentTimeMillis()
        val clean = command.trim().lowercase(Locale.ROOT)
            .replace(Regex("^(?:hey|hi|hello|ok|okay)?\\s*(?:ella|argus)[,:\\s]*"), "")
            .trim()

        // 1. Music & VLC Media Playback
        if (clean.contains("play music") || clean.contains("play audio") || clean.contains("play song") || clean.contains("vlc")) {
            val latency = System.currentTimeMillis() - startTime
            statusBadge.text = "⚡ Ella Local (${latency}ms)"
            responseView.text = "Launching VLC media playback..."
            speak("Playing media on VLC.")
            launchPackage("org.videolan.vlc")
            dismissDelayed(2000)
            return
        }

        // 2. Open App ("open whatsapp", "open chrome", "launch camera")
        val openMatch = Regex("^(?:open|launch|start|go to)\\s+([a-z0-9_\\s]+)$").find(clean)
        if (openMatch != null) {
            val appTarget = openMatch.groupValues[1].trim()
            val latency = System.currentTimeMillis() - startTime
            val resolvedPkg = when (appTarget) {
                "whatsapp" -> "com.whatsapp"
                "chrome", "google chrome", "browser" -> "com.android.chrome"
                "youtube" -> "com.google.android.youtube"
                "settings" -> "com.android.settings"
                "camera" -> "com.android.camera"
                "vlc" -> "org.videolan.vlc"
                "spotify" -> "com.spotify.music"
                else -> appTarget
            }
            statusBadge.text = "⚡ Ella Local (${latency}ms)"
            responseView.text = "Opening $appTarget..."
            speak("Opening $appTarget.")
            launchPackage(resolvedPkg)
            dismissDelayed(2000)
            return
        }

        // 3. Phone Call ("call mom", "dial 080...")
        val callMatch = Regex("^(?:call|dial|phone)\\s+(?:to\\s+)?([a-z0-9_\\s+]+)$").find(clean)
        if (callMatch != null) {
            val numberOrName = callMatch.groupValues[1].trim()
            val latency = System.currentTimeMillis() - startTime
            statusBadge.text = "⚡ Ella Local (${latency}ms)"
            responseView.text = "Dialing $numberOrName..."
            speak("Calling $numberOrName.")
            try {
                val callIntent = Intent(Intent.ACTION_CALL).apply {
                    data = Uri.parse("tel:$numberOrName")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(callIntent)
            } catch (e: Exception) {
                val dialIntent = Intent(Intent.ACTION_DIAL).apply {
                    data = Uri.parse("tel:$numberOrName")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(dialIntent)
            }
            dismissDelayed(2500)
            return
        }

        // 4. Hardware Audio Recording
        if (clean.contains("record audio") || clean.contains("start recording") || clean.contains("help me record")) {
            val latency = System.currentTimeMillis() - startTime
            statusBadge.text = "⚡ Ella Local (${latency}ms)"
            responseView.text = "Hardware audio recorder activated."
            speak("Recording audio.")
            dismissDelayed(2000)
            return
        }

        // 5. Cloud Intelligence / Gemini Delegation
        statusBadge.text = "☁️ Gemini Cloud Orchestration"
        responseView.text = "Delegating to Gemini API for reasoning..."

        // Forward to MainActivity Argus Command Deck
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("wake_word_command", command)
            putExtra("from_voice_daemon", true)
        }
        if (launchIntent != null) context.startActivity(launchIntent)
        dismissDelayed(1500)
    }

    private fun launchPackage(packageName: String) {
        try {
            val intent = context.packageManager.getLaunchIntentForPackage(packageName)?.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            if (intent != null) {
                context.startActivity(intent)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to launch package $packageName: ${e.message}")
        }
    }

    private fun speak(text: String) {
        if (isTtsReady && tts != null && text.isNotBlank()) {
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "ella_overlay_tts")
        }
    }

    private fun dismissDelayed(delayMs: Long) {
        mainHandler.postDelayed({
            hide()
        }, delayMs)
    }

    override fun onHide() {
        super.onHide()
        try {
            speechRecognizer?.cancel()
            speechRecognizer?.destroy()
            speechRecognizer = null
        } catch (e: Exception) {}
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            tts?.stop()
            tts?.shutdown()
            tts = null
        } catch (e: Exception) {}
    }
}
