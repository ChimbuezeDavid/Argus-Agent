// On-Device Always-On Wake-Word Engine for "Hey Argus" Hands-Free Activation
import { Vibration, Platform } from 'react-native';
import ArgusSystemMonitors from '@/modules/argus-system-monitors';
import { useSettingsStore } from '@/store/settingsStore';
import { useVoiceStore } from '@/store/voiceStore';

export const HOTWORD_PATTERNS = [
  /^(?:hey|hi|hello|ok|okay)\s+argus[,\s]*(.*)$/i,
  /^argus[,\s]+(.*)$/i,
  /^hey\s+agent[,\s]*(.*)$/i,
  /^argus$/i,
];

export interface HotwordDetectionResult {
  detected: boolean;
  command: string;
  matchedTrigger?: string;
}

/**
 * Checks a speech transcript against wake-word patterns.
 */
export function evaluateHotword(speechTranscript: string): HotwordDetectionResult {
  if (!speechTranscript || typeof speechTranscript !== 'string') {
    return { detected: false, command: '' };
  }

  const clean = speechTranscript.trim();

  for (const pattern of HOTWORD_PATTERNS) {
    const match = clean.match(pattern);
    if (match) {
      const remainingCommand = match[1]?.trim() || '';
      return {
        detected: true,
        command: remainingCommand,
        matchedTrigger: 'Hey Argus',
      };
    }
  }

  return {
    detected: false,
    command: clean,
  };
}

class HotwordController {
  private isListening = false;
  private isPaused = false;
  private isRestarting = false;
  private onCommandCallback: ((command: string) => void) | null = null;
  private listeners: { remove: () => void }[] = [];
  private restartTimeout: any = null;

  /**
   * Starts the continuous background acoustic listener for the "Hey Argus" wake word.
   */
  public async startListening(callback: (command: string) => void): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    this.onCommandCallback = callback;
    this.isListening = true;
    this.isPaused = false;

    this.cleanupListeners();

    try {
      // 1. Partial results: inspect streaming speech for instant wake word trigger
      const subPartial = ArgusSystemMonitors.addSpeechListener('onSpeechPartialResults', (data) => {
        if (!this.isListening || this.isPaused) return;
        if (data?.transcript) {
          this.processTranscript(data.transcript);
        }
      });
      if (subPartial) this.listeners.push(subPartial);

      // 2. Final results
      const subResults = ArgusSystemMonitors.addSpeechListener('onSpeechResults', (data) => {
        if (!this.isListening || this.isPaused) return;
        if (data?.transcript) {
          this.processTranscript(data.transcript);
        }
        this.scheduleRestart(300);
      });
      if (subResults) this.listeners.push(subResults);

      // 3. On speech end: restart listening loop
      const subEnd = ArgusSystemMonitors.addSpeechListener('onSpeechEnd', () => {
        if (!this.isListening || this.isPaused) return;
        this.scheduleRestart(400);
      });
      if (subEnd) this.listeners.push(subEnd);

      // 4. On speech error (e.g. timeout / no match): quietly restart
      const subError = ArgusSystemMonitors.addSpeechListener('onSpeechError', () => {
        if (!this.isListening || this.isPaused) return;
        this.scheduleRestart(500);
      });
      if (subError) this.listeners.push(subError);

      // Kick off native speech recognition
      await ArgusSystemMonitors.startSpeechRecognition();
      console.log('[HotwordController] Continuous wake-word listener activated.');
      return true;
    } catch (e) {
      console.warn('[HotwordController] Failed to initialize continuous listener:', e);
      return false;
    }
  }

  /**
   * Stops the continuous wake word listener.
   */
  public async stopListening(): Promise<void> {
    this.isListening = false;
    this.isPaused = false;
    this.onCommandCallback = null;

    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    this.cleanupListeners();

    try {
      await ArgusSystemMonitors.stopSpeechRecognition();
    } catch {}
    console.log('[HotwordController] Continuous wake-word listener stopped.');
  }

  /**
   * Temporarily pauses wake word detection (e.g., when agent is speaking or recording).
   */
  public pause() {
    this.isPaused = true;
    try {
      ArgusSystemMonitors.stopSpeechRecognition();
    } catch {}
  }

  /**
   * Resumes wake word detection after pause.
   */
  public resume() {
    if (!this.isListening) return;
    this.isPaused = false;
    this.scheduleRestart(200);
  }

  private processTranscript(transcript: string) {
    // Avoid processing if the app is currently speaking out loud
    if (useVoiceStore.getState().isSpeaking) return;

    const res = evaluateHotword(transcript);
    if (res.detected && this.onCommandCallback) {
      console.log(`[HotwordController] Wake-word detected! Command: "${res.command}"`);
      try {
        Vibration.vibrate([0, 50, 70, 50]);
      } catch {}

      // Temporarily pause while executing command
      this.pause();

      const cmd = res.command.trim();
      this.onCommandCallback(cmd || 'hey argus');

      // Auto resume listening after command dispatch
      setTimeout(() => {
        this.resume();
      }, 2500);
    }
  }

  private scheduleRestart(delayMs: number) {
    if (!this.isListening || this.isPaused || this.isRestarting) return;
    if (this.restartTimeout) clearTimeout(this.restartTimeout);

    this.restartTimeout = setTimeout(async () => {
      if (!this.isListening || this.isPaused) return;

      // Don't restart if app is actively outputting speech synthesis
      if (useVoiceStore.getState().isSpeaking) {
        this.scheduleRestart(1000);
        return;
      }

      this.isRestarting = true;
      try {
        await ArgusSystemMonitors.startSpeechRecognition();
      } catch (e) {
        // Retry gently
        this.scheduleRestart(1500);
      } finally {
        this.isRestarting = false;
      }
    }, delayMs);
  }

  private cleanupListeners() {
    for (const listener of this.listeners) {
      try {
        listener.remove();
      } catch {}
    }
    this.listeners = [];
  }

  public getStatus() {
    return {
      isListening: this.isListening,
      isPaused: this.isPaused,
    };
  }
}

export const hotwordController = new HotwordController();
