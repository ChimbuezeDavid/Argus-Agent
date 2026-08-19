import React from 'react';
import { StyleSheet, Modal, TouchableWithoutFeedback, TouchableOpacity, FlatList, View, Text, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as conversationRepo from '@/services/database/conversationRepo';
import { useHCITheme } from '@/hooks/useHCITheme';

interface SessionHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  insetsBottom: number;
  conversationsList: conversationRepo.Conversation[];
  activeConversationId: number | null;
  onSelectConversation: (conv: conversationRepo.Conversation) => void;
  onNewSession: () => void;
  onDeleteConversation?: (id: number) => void;
}

export function SessionHistoryModal({
  visible,
  onClose,
  insetsBottom,
  conversationsList,
  activeConversationId,
  onSelectConversation,
  onNewSession,
  onDeleteConversation,
}: SessionHistoryModalProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.historySheet,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  paddingBottom: Math.max(insetsBottom, 24),
                },
              ]}
            >
              {/* Top Handle Pill */}
              <View style={[styles.handleBar, { backgroundColor: colors.border }]} />

              {/* Header */}
              <View style={styles.sheetHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.headerIconCircle, { backgroundColor: colors.primaryBg }]}>
                    <Ionicons name="time" size={16} color={colors.primary} />
                  </View>
                  <Text style={[styles.sheetTitle, { color: colors.text, fontSize: scaleFont(16) }]}>
                    Command History
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    triggerHaptic('light');
                    onClose();
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Conversations List */}
              <FlatList
                data={conversationsList}
                keyExtractor={(c) => c.id.toString()}
                contentContainerStyle={{ paddingVertical: 6 }}
                renderItem={({ item }) => {
                  const isActive = activeConversationId === item.id;
                  return (
                    <View
                      style={[
                        styles.historyItem,
                        {
                          backgroundColor: isActive ? colors.primaryBg : colors.surface,
                          borderColor: isActive ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}
                        onPress={() => {
                          triggerHaptic('selection');
                          onSelectConversation(item);
                        }}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.itemIconBox,
                            {
                              backgroundColor: isActive ? colors.primary : colors.background,
                            },
                          ]}
                        >
                          <Ionicons
                            name="chatbubble-ellipses"
                            size={15}
                            color={isActive ? '#ffffff' : colors.textSecondary}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text
                              style={[
                                styles.historyItemTitle,
                                {
                                  color: isActive ? colors.primary : colors.text,
                                  fontSize: scaleFont(13),
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {item.title}
                            </Text>
                            {isActive && (
                              <View style={[styles.activePill, { backgroundColor: colors.primary }]}>
                                <Text style={[styles.activePillText, { fontSize: scaleFont(9) }]}>Active</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.historyItemDate, { color: colors.textSecondary, fontSize: scaleFont(10) }]}>
                            {new Date(item.updated_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* Delete Individual Session Action */}
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => {
                          triggerHaptic('medium');
                          Alert.alert(
                            'Delete Command Session',
                            `Are you sure you want to remove "${item.title}"?`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: () => onDeleteConversation?.(item.id),
                              },
                            ]
                          );
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="chatbox-outline" size={32} color={colors.textMuted} style={{ marginBottom: 8 }} />
                    <Text style={[styles.emptyHistoryText, { color: colors.textSecondary, fontSize: scaleFont(12) }]}>
                      No past command sessions found.
                    </Text>
                  </View>
                }
              />

              {/* Start Fresh Session CTA */}
              <TouchableOpacity
                style={[styles.newSessionBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  triggerHaptic('medium');
                  onNewSession();
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={[styles.newSessionBtnText, { fontSize: scaleFont(13) }]}>
                  Start Fresh Command Session
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  historySheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontWeight: '800',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    gap: 10,
  },
  itemIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyItemTitle: {
    fontWeight: '700',
    flex: 1,
  },
  historyItemDate: {
    marginTop: 2,
  },
  activePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6,
  },
  activePillText: {
    color: '#ffffff',
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyHistoryText: {
    fontWeight: '500',
  },
  newSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 8,
  },
  newSessionBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
