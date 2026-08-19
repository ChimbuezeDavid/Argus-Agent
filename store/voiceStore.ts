// Zustand Store for Voice Assistant State & Speech Synthesis Settings
import { create } from 'zustand';

export interface VoiceState {
  isListening: boolean;
  isSpeaking: boolean;
  autoSpeakResponse: boolean;
  voicePitch: number;
  voiceRate: number;
  lastTranscript: string;
  
  // Actions
  setIsListening: (listening: boolean) => void;
  setIsSpeaking: (speaking: boolean) => void;
  setAutoSpeakResponse: (enabled: boolean) => void;
  setVoicePitch: (pitch: number) => void;
  setVoiceRate: (rate: number) => void;
  setLastTranscript: (transcript: string) => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  isListening: false,
  isSpeaking: false,
  autoSpeakResponse: true,
  voicePitch: 1.0,
  voiceRate: 1.0,
  lastTranscript: '',

  setIsListening: (isListening) => set({ isListening }),
  setIsSpeaking: (isSpeaking) => set({ isSpeaking }),
  setAutoSpeakResponse: (autoSpeakResponse) => set({ autoSpeakResponse }),
  setVoicePitch: (voicePitch) => set({ voicePitch }),
  setVoiceRate: (voiceRate) => set({ voiceRate }),
  setLastTranscript: (lastTranscript) => set({ lastTranscript }),
}));
