import React, { useEffect } from 'react';
import {
  StyleSheet,
  Modal,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useHCITheme } from '@/hooks/useHCITheme';
import { recordHabitCompletion } from '@/services/database/habitRepo';

export interface HabitTakeoverData {
  locationName: string;
  habitText: string;
  eventType: 'enter' | 'exit';
  geofenceId?: number;
}

interface HabitStackTakeoverModalProps {
  visible: boolean;
  data: HabitTakeoverData | null;
  onClose: () => void;
}

export function HabitStackTakeoverModal({
  visible,
  data,
  onClose,
}: HabitStackTakeoverModalProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  useEffect(() => {
    if (visible && data?.habitText) {
      triggerHaptic('heavy');
      Speech.stop();
      Speech.speak(data.habitText, {
        language: 'en',
        pitch: 1.0,
        rate: 0.95,
      });
    }
    return () => {
      Speech.stop();
    };
  }, [visible, data]);

  if (!data) return null;

  const handleComplete = async () => {
    triggerHaptic('success');
    try {
      await recordHabitCompletion(
        data.locationName,
        data.habitText,
        data.eventType,
        data.geofenceId
      );
    } catch (e) {
      console.warn('Error recording habit completion:', e);
    }
    onClose();
  };

  const handleDismiss = () => {
    triggerHaptic('selection');
    onClose();
  };

  const isArrival = data.eventType === 'enter';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.primary,
            },
          ]}
        >
          {/* Header Tag */}
          <View
            style={[
              styles.tagBadge,
              {
                backgroundColor: isArrival ? '#10b98120' : '#f59e0b20',
                borderColor: isArrival ? '#10b981' : '#f59e0b',
              },
            ]}
          >
            <Ionicons
              name={isArrival ? 'log-in-outline' : 'log-out-outline'}
              size={16}
              color={isArrival ? '#10b981' : '#f59e0b'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.tagText,
                { color: isArrival ? '#10b981' : '#f59e0b', fontSize: scaleFont(12) },
              ]}
            >
              {isArrival ? 'LOCATION ARRIVAL' : 'LOCATION DEPARTURE'}
            </Text>
          </View>

          {/* Location Name */}
          <Text style={[styles.locationTitle, { color: colors.text, fontSize: scaleFont(22) }]}>
            📍 {data.locationName}
          </Text>

          <Text style={[styles.promptSubtitle, { color: colors.textSecondary, fontSize: scaleFont(13) }]}>
            Your registered Habit Stacking routine for this location:
          </Text>

          {/* Huge Habit Prompt Display */}
          <View style={[styles.habitBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="sparkles" size={28} color={colors.primary} style={{ marginBottom: 10 }} />
            <Text style={[styles.habitText, { color: colors.text, fontSize: scaleFont(20) }]}>
              "{data.habitText}"
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.dismissBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={handleDismiss}
              activeOpacity={0.8}
            >
              <Text style={[styles.dismissBtnText, { color: colors.textSecondary, fontSize: scaleFont(13) }]}>
                Dismiss
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.completeBtn, { backgroundColor: colors.primary }]}
              onPress={handleComplete}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-done" size={20} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={[styles.completeBtnText, { fontSize: scaleFont(14) }]}>
                Mark Completed
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 2,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  tagText: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  locationTitle: {
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
  },
  promptSubtitle: {
    textAlign: 'center',
    marginBottom: 18,
  },
  habitBox: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  habitText: {
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 28,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  dismissBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    fontWeight: '700',
  },
  completeBtn: {
    flex: 1.6,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBtnText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
