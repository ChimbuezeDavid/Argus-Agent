// On-Device Always-On Wake-Word Service for "Hey Argus" / "Argus" Voice Triggers
import { Vibration, Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { useSettingsStore } from '@/store/settingsStore';

export const HOTWORD_PATTERNS = [
  /^(?:hey|hi|hello|ok|okay)\s+argus[,\s]*(.*)$/i,
  /^argus[,\s]+(.*)$/i,
  /^hey\s+agent[,\s]*(.*)$/i,
];

export interface HotwordDetectionResult {
  detected: boolean;
  command: string;
  matchedTrigger?: string;
}

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
  private onCommandCallback: ((command: string) => void) | null = null;

  public startListening(callback: (command: string) => void) {
    this.onCommandCallback = callback;
    this.isListening = true;
  }

  public stopListening() {
    this.isListening = false;
    this.onCommandCallback = null;
  }

  public handleLiveTranscript(transcript: string) {
    const isAlwaysOn = useSettingsStore.getState().alwaysOnVoiceEnabled;
    if (!isAlwaysOn && !this.isListening) return;

    const res = evaluateHotword(transcript);
    if (res.detected && this.onCommandCallback) {
      try {
        Vibration.vibrate(35);
      } catch {}
      this.onCommandCallback(res.command || transcript);
    }
  }

  public getStatus() {
    return { isListening: this.isListening };
  }
}

export const hotwordController = new HotwordController();
