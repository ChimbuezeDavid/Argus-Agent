import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Animated,
  View,
  Text,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as voiceService from '@/services/voice/voiceService';
import { useHCITheme } from '@/hooks/useHCITheme';
import ArgusSystemMonitors from '@/modules/argus-system-monitors';

interface VoiceAssistantModalProps {
  visible: boolean;
  onClose: () => void;
  insetsBottom: number;
  pulseAnim: Animated.Value;
  onExecuteVoiceAction: (transcript: string) => void;
}

export function VoiceAssistantModal({
  visible,
  onClose,
  insetsBottom,
  pulseAnim,
  onExecuteVoiceAction,
}: VoiceAssistantModalProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Listening... Speak now');
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);

  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speechDetectedRef = useRef<boolean>(false);
  const silenceStartTimeRef = useRef<number | null>(null);
  const isExecutingRef = useRef<boolean>(false);
  const ambientFloorRef = useRef<number>(150);
  const calibrationCountRef = useRef<number>(0);
  const speechStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (visible) {
      isExecutingRef.current = false;
      startRecording();
    } else {
      stopRecording();
      setMicPermissionDenied(false);
    }
    return () => {
      clearAllTimers();
      voiceService.stopHardwareAudioCapture();
    };
  }, [visible]);

  const clearAllTimers = () => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
  };

  const requestMicPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'Argus Agent requires microphone access to record and execute your voice instructions.',
            buttonPositive: 'Allow Microphone',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Microphone permission request error:', err);
        return false;
      }
    }
    return true;
  };

  const startRecording = async () => {
    triggerHaptic('medium');
    voiceService.stopSpeaking();
    setLiveTranscript('');
    setIsTranscribing(false);
    clearAllTimers();
    speechDetectedRef.current = false;
    silenceStartTimeRef.current = null;
    isExecutingRef.current = false;
    ambientFloorRef.current = 150;
    calibrationCountRef.current = 0;
    speechStartTimeRef.current = null;

    const hasPermission = await requestMicPermission();
    if (!hasPermission) {
      setIsRecording(false);
      setMicPermissionDenied(true);
      setStatusMessage('Microphone permission required');
      return;
    }
    setMicPermissionDenied(false);

    try {
      const res = await voiceService.startHardwareAudioCapture();
      if (res.success) {
        setIsRecording(true);
        setStatusMessage('🎙️ Listening... Speak naturally.');

        // 1. Adaptive Voice Activity Detection (VAD) & Silence Auto-Stop Loop
        const SILENCE_DURATION_MS = 1200; // 1.2s of post-speech silence auto-completes utterance

        vadIntervalRef.current = setInterval(async () => {
          if (isExecutingRef.current) return;
          try {
            const rawAmp = await ArgusSystemMonitors.getAudioCaptureAmplitude();
            const amp = typeof rawAmp === 'number' ? rawAmp : 0;

            // Calibration phase (first 3 intervals ~ 450ms)
            if (calibrationCountRef.current < 3) {
              if (amp > 0) {
                ambientFloorRef.current = Math.min(ambientFloorRef.current, amp);
              }
              calibrationCountRef.current++;
              return;
            }

            // Adaptive dynamic speech threshold: at least 2.2x ambient floor or min 600
            const dynamicSpeechThreshold = Math.max(ambientFloorRef.current * 2.2, 600);

            if (amp > dynamicSpeechThreshold) {
              if (!speechDetectedRef.current) {
                speechStartTimeRef.current = Date.now();
              }
              speechDetectedRef.current = true;
              silenceStartTimeRef.current = null;
              setStatusMessage('🗣️ Hearing you speak...');
            } else if (speechDetectedRef.current) {
              const now = Date.now();

              // Maximum speech utterance window safeguard: auto-complete after 6 seconds of speech
              if (speechStartTimeRef.current && now - speechStartTimeRef.current >= 6000) {
                console.log('[VAD] Maximum speech duration reached. Auto-submitting...');
                isExecutingRef.current = true;
                clearAllTimers();
                handleFinishAndTranscribe();
                return;
              }

              if (!silenceStartTimeRef.current) {
                silenceStartTimeRef.current = now;
              } else if (now - silenceStartTimeRef.current >= SILENCE_DURATION_MS) {
                // Natural pause detected after speaking - automatically complete without manual tap
                console.log('[VAD] End-of-speech silence detected. Auto-completing recording...');
                isExecutingRef.current = true;
                clearAllTimers();
                handleFinishAndTranscribe();
              }
            }
          } catch (e) {}
        }, 150);

        // 2. Safety timeout fallback (10s maximum recording window)
        recordingTimeoutRef.current = setTimeout(() => {
          if (!isExecutingRef.current) {
            isExecutingRef.current = true;
            handleFinishAndTranscribe();
          }
        }, 10000);
      } else {
        setStatusMessage(res.error || 'Could not start microphone');
      }
    } catch (e: any) {
      console.warn('Audio capture error:', e);
      setStatusMessage(e.message || 'Microphone initialization error');
    }
  };

  const stopRecording = async () => {
    clearAllTimers();
    setIsRecording(false);
    await voiceService.stopHardwareAudioCapture();
  };

  const handleFinishAndTranscribe = async () => {
    clearAllTimers();
    isExecutingRef.current = true;
    triggerHaptic('selection');
    setIsRecording(false);
    setIsTranscribing(true);
    setStatusMessage('🧠 Understanding your voice instruction...');

    try {
      const base64Audio = await voiceService.stopHardwareAudioCapture();
      if (!base64Audio || !base64Audio.trim()) {
        setIsTranscribing(false);
        setStatusMessage('No audio captured. Tap microphone to try again.');
        return;
      }

      const transcript = await voiceService.transcribeAudioWithGemini(base64Audio);
      setIsTranscribing(false);

      if (transcript && transcript.trim()) {
        setLiveTranscript(transcript);
        setStatusMessage('Captured! Executing...');
        triggerHaptic('success');

        setTimeout(() => {
          onClose();
          onExecuteVoiceAction(transcript.trim());
        }, 500);
      } else {
        setStatusMessage('No speech was detected in audio. Please speak louder and tap again.');
      }
    } catch (e: any) {
      console.warn('Transcription error:', e);
      setIsTranscribing(false);
      setStatusMessage(e.message || 'Transcription error. Check your Gemini API key in Settings.');
    }
  };

  const handleMicToggle = () => {
    if (isRecording) {
      handleFinishAndTranscribe();
    } else {
      startRecording();
    }
  };

  const handleLaunchNativeAssistant = async () => {
    triggerHaptic('selection');
    await stopRecording();
    try {
      const text = await voiceService.promptNativeAndroidVoice();
      if (text && text.trim()) {
        triggerHaptic('success');
        onClose();
        onExecuteVoiceAction(text.trim());
      } else {
        setStatusMessage('No voice input received from system dialog');
      }
    } catch (e) {
      console.warn('Native assistant error:', e);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[styles.voiceModalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.voiceCard,
                {
                  backgroundColor: colors.card,
                  borderTopColor: colors.border,
                  paddingBottom: Math.max(insetsBottom, 32),
                },
              ]}
            >
              <View style={styles.sheetHandle} />

              {/* Header */}
              <View style={styles.voiceHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={[
                      styles.pulseDot,
                      { backgroundColor: isRecording ? '#ef4444' : isTranscribing ? '#eab308' : colors.primary },
                    ]}
                  />
                  <Text style={[styles.voiceHeaderTitle, { color: colors.primary, fontSize: scaleFont(11) }]}>
                    ARGUS VOICE ASSISTANCE
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Glowing Animated Orb */}
              <View style={styles.orbContainer}>
                <Animated.View
                  style={[
                    styles.glowingOrbOuter,
                    {
                      borderColor: isRecording ? '#ef4444' : isTranscribing ? '#eab308' : colors.primary,
                      backgroundColor: colors.primaryBg,
                      transform: [{ scale: isRecording ? pulseAnim : 1 }],
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.glowingOrbInner,
                      { backgroundColor: isRecording ? '#ef4444' : isTranscribing ? '#eab308' : colors.primary },
                    ]}
                    onPress={handleMicToggle}
                    activeOpacity={0.85}
                    disabled={isTranscribing}
                  >
                    {isTranscribing ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Ionicons
                        name={isRecording ? 'stop' : 'mic'}
                        size={38}
                        color="#ffffff"
                      />
                    )}
                  </TouchableOpacity>
                </Animated.View>

                {/* Acoustic Visualizer Waveform */}
                {isRecording && (
                  <View style={styles.waveformRow}>
                    <View style={[styles.waveBar, { backgroundColor: colors.primary, height: 12 }]} />
                    <View style={[styles.waveBar, { backgroundColor: colors.primary, height: 22 }]} />
                    <View style={[styles.waveBar, { backgroundColor: '#ef4444', height: 30 }]} />
                    <View style={[styles.waveBar, { backgroundColor: colors.primary, height: 22 }]} />
                    <View style={[styles.waveBar, { backgroundColor: colors.primary, height: 12 }]} />
                  </View>
                )}

                <Text style={[styles.orbStatusText, { color: colors.text, fontSize: scaleFont(16) }]}>
                  {statusMessage}
                </Text>

                <Text style={[styles.orbSubText, { color: colors.textSecondary, fontSize: scaleFont(13) }]}>
                  {liveTranscript
                    ? `"${liveTranscript}"`
                    : isRecording
                    ? 'Speak clearly, then tap the Red Stop button when finished.'
                    : 'Tap the microphone to speak your command.'}
                </Text>

                {micPermissionDenied && (
                  <TouchableOpacity
                    style={[styles.permissionBtn, { backgroundColor: colors.primary }]}
                    onPress={() => Linking.openSettings()}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Open App Settings to grant microphone permission"
                  >
                    <Ionicons name="settings-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={[styles.permissionBtnText, { fontSize: scaleFont(13) }]}>
                      Open App Settings
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Control Buttons */}
              <View style={styles.controlRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={onClose}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.textSecondary, fontSize: scaleFont(13) }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                {isRecording && (
                  <TouchableOpacity
                    style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                    onPress={handleFinishAndTranscribe}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-circle" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={[styles.submitBtnText, { fontSize: scaleFont(13) }]}>
                      Finish & Execute
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  voiceModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#52525b',
    alignSelf: 'center',
    marginBottom: 14,
  },
  voiceCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderTopWidth: 1,
  },
  voiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  voiceHeaderTitle: {
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  orbContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  glowingOrbOuter: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    marginBottom: 12,
  },
  glowingOrbInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 32,
    marginBottom: 10,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
  },
  orbStatusText: {
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  orbSubText: {
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 16,
    minHeight: 38,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 10,
  },
  cancelBtn: {
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 20,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontWeight: '700',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 20,
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  permissionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 12,
  },
  permissionBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
