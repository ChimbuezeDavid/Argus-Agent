// Voice Engine & Natural Spoken Interaction Subsystem for Argus Agent
import * as Speech from 'expo-speech';
import { Linking, Platform } from 'react-native';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { useVoiceStore } from '@/store/voiceStore';
import { useSettingsStore } from '@/store/settingsStore';
import { resolvePackageAlias } from '@/services/agent/toolRunner';
import ArgusSystemMonitors from '@/modules/argus-system-monitors';

export interface ParsedVoiceCommand {
  type:
    | 'launch_app'
    | 'make_call'
    | 'check_budget'
    | 'log_expense'
    | 'get_location'
    | 'set_geofence'
    | 'whatsapp_msg'
    | 'search_storage'
    | 'maps_navigate'
    | 'general_agent';
  target?: string;
  amount?: number;
  category?: string;
  recipient?: string;
  message?: string;
  query?: string;
  rawText: string;
}

/**
 * Speaks text using the device's native speech synthesis engine.
 */
export async function speak(text: string): Promise<void> {
  const store = useVoiceStore.getState();
  if (!text || !text.trim()) return;

  // Clean markdown syntax and emojis for smooth, human-like voice synthesis
  const cleanSpeechText = text
    .replace(/[*#_`~[\]]/g, '')
    .replace(/₦/g, ' Naira ')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^\w\s.,?!'-]/g, '')
    .trim();

  if (!cleanSpeechText) return;

  try {
    // Stop any active speech before starting new utterance
    await Speech.stop();
    store.setIsSpeaking(true);

    Speech.speak(cleanSpeechText, {
      pitch: store.voicePitch,
      rate: store.voiceRate,
      language: 'en-US',
      onDone: () => store.setIsSpeaking(false),
      onStopped: () => store.setIsSpeaking(false),
      onError: () => store.setIsSpeaking(false),
    });
  } catch (e) {
    store.setIsSpeaking(false);
  }
}

/**
 * Immediately stops any playing speech synthesis.
 */
export async function stopSpeaking(): Promise<void> {
  try {
    await Speech.stop();
  } catch (e) {}
  useVoiceStore.getState().setIsSpeaking(false);
}

/**
 * Starts on-device speech recognition session.
 */
export async function startSpeechRecognitionSession(
  onPartial: (text: string) => void,
  onFinal: (text: string) => void,
  onError?: (err: any) => void
): Promise<() => void> {
  const store = useVoiceStore.getState();
  store.setIsListening(true);

  const subPartial = ArgusSystemMonitors.addSpeechListener('onSpeechPartialResults', (data) => {
    if (data?.transcript) {
      store.setLastTranscript(data.transcript);
      onPartial(data.transcript);
    }
  });

  const subResults = ArgusSystemMonitors.addSpeechListener('onSpeechResults', (data) => {
    if (data?.transcript) {
      store.setLastTranscript(data.transcript);
      onFinal(data.transcript);
    }
  });

  const subError = ArgusSystemMonitors.addSpeechListener('onSpeechError', (data) => {
    store.setIsListening(false);
    if (onError) onError(data);
  });

  const subEnd = ArgusSystemMonitors.addSpeechListener('onSpeechEnd', () => {
    store.setIsListening(false);
  });

  await ArgusSystemMonitors.startSpeechRecognition();

  return () => {
    subPartial?.remove();
    subResults?.remove();
    subError?.remove();
    subEnd?.remove();
    ArgusSystemMonitors.stopSpeechRecognition();
    store.setIsListening(false);
  };
}

/**
 * Stops active speech recognition.
 */
export async function stopSpeechRecognitionSession(): Promise<void> {
  await ArgusSystemMonitors.stopSpeechRecognition();
  useVoiceStore.getState().setIsListening(false);
}

/**
 * Cancels active speech recognition.
 */
export async function cancelSpeechRecognitionSession(): Promise<void> {
  await ArgusSystemMonitors.cancelSpeechRecognition();
  useVoiceStore.getState().setIsListening(false);
}

/**
 * Prompts the built-in Android System Voice Assistant dialog.
 * This utilizes Android's native RecognizerIntent.ACTION_RECOGNIZE_SPEECH.
 */
export async function promptNativeAndroidVoice(): Promise<string> {
  try {
    return await ArgusSystemMonitors.promptAndroidVoiceAssistant();
  } catch (e) {
    console.warn('Native Android Voice Assistant prompt error:', e);
    return '';
  }
}

/**
 * Starts direct hardware audio recording via pure Kotlin ArgusSystemMonitors.
 */
export async function startHardwareAudioCapture(): Promise<{ success: boolean; error?: string }> {
  useVoiceStore.getState().setIsListening(true);
  try {
    const raw = await ArgusSystemMonitors.startAudioCapture();
    if (typeof raw === 'string' && raw.startsWith('{')) {
      return JSON.parse(raw);
    }
    return { success: !!raw };
  } catch (e: any) {
    return { success: false, error: e.message || 'Microphone recording failed' };
  }
}

/**
 * Stops audio recording and returns the Base64 audio string.
 */
export async function stopHardwareAudioCapture(): Promise<string> {
  useVoiceStore.getState().setIsListening(false);
  return await ArgusSystemMonitors.stopAudioCapture();
}

/**
 * Sends recorded audio directly to Gemini multimodal API for 100% accurate acoustic transcription and intent resolution.
 */
export async function transcribeAudioWithGemini(rawAudioPayload: string): Promise<string> {
  if (!rawAudioPayload || !rawAudioPayload.trim()) {
    return '';
  }

  let mimeType = 'audio/mp4';
  let base64Data = rawAudioPayload.trim();

  if (rawAudioPayload.includes(';')) {
    const parts = rawAudioPayload.split(';');
    mimeType = parts[0];
    base64Data = parts[1];
  }

  const apiKey = (process.env.EXPO_PUBLIC_GEMINI_API_KEY || useSettingsStore.getState().apiKey || '').trim();
  if (!apiKey) {
    throw new Error('Gemini API key is required for voice intelligence.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const selectedModel = useSettingsStore.getState().geminiModel;
  const targetModel = (selectedModel && !selectedModel.includes('1.5') && !selectedModel.includes('2.0') && !selectedModel.includes('3.5') && !selectedModel.includes('3.6'))
    ? selectedModel
    : 'gemini-3.7-flash';

  const model = genAI.getGenerativeModel({ model: targetModel });

  const prompt = `You are the acoustic speech ear of Argus Agent. Listen to this user audio recording.
Transcribe the user's spoken words verbatim into text.
Output ONLY the clean transcribed text without preamble, quotes, or explanations.
If no speech is detected in the audio, respond with an empty string.`;

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: mimeType as any,
        data: base64Data,
      },
    },
    { text: prompt },
  ]);

  const responseText = result.response.text();
  return responseText ? responseText.trim() : '';
}

/**
 * Initiates a phone call via the Android dialer / tel: intent.
 */
export async function executePhoneCall(target: string): Promise<{ success: boolean; message: string }> {
  const cleanTarget = target.trim();
  if (!cleanTarget) {
    return { success: false, message: 'Please specify a contact or phone number to call.' };
  }

  // Remove common words like "to", "dial"
  const phoneNumberOrContact = cleanTarget
    .replace(/^(call|dial|phone)\s+/i, '')
    .replace(/^to\s+/i, '')
    .trim();

  // If it's a numeric phone number (e.g. 08012345678, +234...)
  const isNumber = /^[+0-9\s\-()]+$/.test(phoneNumberOrContact);
  const telUrl = `tel:${encodeURIComponent(isNumber ? phoneNumberOrContact.replace(/\s+/g, '') : phoneNumberOrContact)}`;

  try {
    const canOpen = await Linking.canOpenURL(telUrl);
    if (canOpen) {
      await Linking.openURL(telUrl);
      return { success: true, message: `Calling ${phoneNumberOrContact}...` };
    } else {
      // Fallback direct open
      await Linking.openURL(telUrl);
      return { success: true, message: `Dialing ${phoneNumberOrContact}...` };
    }
  } catch (e) {
    return { success: false, message: `Could not launch dialer for ${phoneNumberOrContact}.` };
  }
}

/**
 * Parses natural language voice commands to execute instant device actions.
 */
export function parseVoiceCommand(transcript: string): ParsedVoiceCommand {
  const clean = transcript.trim().toLowerCase().replace(/^argus[,:\s]*/i, '');

  // 1. App Launching ("open whatsapp", "launch twitter", "start spotify")
  const openAppMatch = clean.match(/^(?:open|launch|start|go to)\s+([a-z0-9_\s]+)$/i);
  if (openAppMatch) {
    const rawAppName = openAppMatch[1].trim();
    const pkg = resolvePackageAlias(rawAppName);
    return {
      type: 'launch_app',
      target: pkg,
      rawText: transcript,
    };
  }

  // 2. Phone Calling ("call momcy", "dial 08012345678", "call dad")
  const callMatch = clean.match(/^(?:call|dial|phone)\s+(?:to\s+)?([a-z0-9_\s+]+)$/i);
  if (callMatch) {
    return {
      type: 'make_call',
      target: callMatch[1].trim(),
      rawText: transcript,
    };
  }

  // 3. Budget Status ("what is my budget", "budget status", "how much is remaining")
  if (/(?:what(?:'s| is) my budget|budget status|how much.*budget|remaining budget)/i.test(clean)) {
    return {
      type: 'check_budget',
      rawText: transcript,
    };
  }

  // 4. Geofencing & GPS ("where am I", "what is my location", "set geofence here called Home")
  if (/(?:where am i|what(?:'s| is) my location|my current location|current coordinates)/i.test(clean)) {
    return {
      type: 'get_location',
      rawText: transcript,
    };
  }
  const geofenceMatch = clean.match(/^(?:set|create|save|add)\s+geofence\s+(?:here\s+)?(?:(?:called|named|as)\s+)?(.+)$/i);
  if (geofenceMatch) {
    return {
      type: 'set_geofence',
      target: geofenceMatch[1].trim(),
      rawText: transcript,
    };
  }

  // 5. WhatsApp Message ("whatsapp momcy saying i am on my way", "send whatsapp to 080... saying hello")
  const waMatch = clean.match(/^(?:send\s+)?whatsapp\s+(?:to\s+)?([a-z0-9_\s+]+?)\s+(?:saying|that|with message)\s+(.+)$/i);
  if (waMatch) {
    return {
      type: 'whatsapp_msg',
      recipient: waMatch[1].trim(),
      message: waMatch[2].trim(),
      rawText: transcript,
    };
  }

  // 6. Device Storage Search ("find receipts in downloads", "search files for statement", "find my pdfs")
  const storageMatch = clean.match(/^(?:find|search|look for)\s+(?:my\s+)?(?:files?\s+(?:for|named)\s+)?([a-z0-9_]+)(?:\s+(?:in|inside)\s+(?:my\s+)?([a-z0-9_]+))?$/i);
  if (storageMatch) {
    const term = storageMatch[1].trim();
    return {
      type: 'search_storage',
      query: term,
      rawText: transcript,
    };
  }

  // 7. Navigation & Maps ("navigate to eko hotel", "directions to ikeja", "find gas station on maps")
  const mapsMatch = clean.match(/^(?:navigate to|directions to|take me to|find)\s+(.+?)(?:\s+on maps)?$/i);
  if (mapsMatch && (clean.includes('navigate') || clean.includes('directions') || clean.includes('maps'))) {
    return {
      type: 'maps_navigate',
      query: mapsMatch[1].trim(),
      rawText: transcript,
    };
  }

  // 8. Expense Shorthand ("log 3500 for fuel", "spent 2000 on lunch", "paid 15000 electric bill")
  const expenseMatch = clean.match(/^(?:log|spent|paid|record)\s+(?:₦|ngn)?\s*([0-9,]+(?:\.[0-9]{1,2})?)\s+(?:for|on)\s+(.+)$/i);
  if (expenseMatch) {
    const amt = parseFloat(expenseMatch[1].replace(/,/g, ''));
    return {
      type: 'log_expense',
      amount: amt,
      category: expenseMatch[2].trim(),
      rawText: transcript,
    };
  }

  return {
    type: 'general_agent',
    rawText: transcript,
  };
}
