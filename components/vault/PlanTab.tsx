import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useHCITheme } from '@/hooks/useHCITheme';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  PlanItem,
  listPlans,
  createPlan,
  togglePlanStatus,
  deletePlan,
  updatePlan,
} from '@/services/database/plansRepo';

interface PlanTabProps {
  refreshSignal: number;
}

type FilterTab = 'all' | 'pending' | 'completed';

export default function PlanTab({ refreshSignal }: PlanTabProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form inputs
  const [titleInput, setTitleInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [dueDateInput, setDueDateInput] = useState('');
  const [dueTimeInput, setDueTimeInput] = useState('');
  const [priorityInput, setPriorityInput] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [categoryInput, setCategoryInput] = useState('task');

  const fetchPlans = useCallback(async () => {
    try {
      const data = await listPlans();
      setPlans(data);
    } catch (e) {
      console.warn('Error fetching plans:', e);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans, refreshSignal]);

  const filteredPlans = useMemo(() => {
    if (filter === 'pending') return plans.filter((p) => p.status === 'pending');
    if (filter === 'completed') return plans.filter((p) => p.status === 'completed');
    return plans;
  }, [plans, filter]);

  const handleOpenCreate = () => {
    triggerHaptic('selection');
    setEditingId(null);
    setTitleInput('');
    setDescInput('');
    const today = new Date().toISOString().split('T')[0];
    setDueDateInput(today);
    setDueTimeInput('12:00');
    setPriorityInput('normal');
    setCategoryInput('task');
    setModalVisible(true);
  };

  const handleOpenEdit = (plan: PlanItem) => {
    triggerHaptic('selection');
    setEditingId(plan.id);
    setTitleInput(plan.title);
    setDescInput(plan.description || '');
    setDueDateInput(plan.due_date || '');
    setDueTimeInput(plan.due_time || '');
    setPriorityInput((plan.priority as any) || 'normal');
    setCategoryInput(plan.category || 'task');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!titleInput.trim()) {
      Alert.alert('Required', 'Please enter a plan title.');
      return;
    }

    try {
      if (editingId) {
        await updatePlan(editingId, {
          title: titleInput,
          description: descInput,
          due_date: dueDateInput,
          due_time: dueTimeInput,
          priority: priorityInput,
          category: categoryInput,
        });
      } else {
        await createPlan({
          title: titleInput,
          description: descInput,
          due_date: dueDateInput,
          due_time: dueTimeInput,
          priority: priorityInput,
          category: categoryInput,
        });
      }
      triggerHaptic('success');
      setModalVisible(false);
      fetchPlans();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save plan.');
    }
  };

  const handleToggleStatus = async (plan: PlanItem) => {
    triggerHaptic('medium');
    try {
      await togglePlanStatus(plan.id, plan.status);
      fetchPlans();
    } catch (e) {
      console.warn('Error toggling plan status:', e);
    }
  };

  const handleDelete = (id: number) => {
    triggerHaptic('warning');
    Alert.alert('Delete Plan', 'Are you sure you want to remove this plan item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deletePlan(id);
          triggerHaptic('success');
          fetchPlans();
        },
      },
    ]);
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'urgent':
        return '#ef4444';
      case 'high':
        return '#f97316';
      default:
        return '#38bdf8';
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Header Toolbar with Filter Chips & Add Button */}
      <View style={styles.toolbarRow}>
        <View style={styles.filterGroup}>
          {(['all', 'pending', 'completed'] as FilterTab[]).map((tab) => {
            const isActive = filter === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? colors.primary : colors.surface,
                    borderColor: isActive ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  setFilter(tab);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterText,
                    {
                      color: isActive ? '#ffffff' : colors.textSecondary,
                      fontSize: scaleFont(11),
                    },
                  ]}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={handleOpenCreate}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={18} color="#ffffff" style={{ marginRight: 4 }} />
          <Text style={[styles.addBtnText, { fontSize: scaleFont(12) }]}>New Plan</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Plans List Surface */}
      <ScrollView
        style={styles.scrollList}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        {filteredPlans.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="No Plans Recorded"
            subtitle="Tap 'New Plan' above to schedule executive tasks, agendas, or reminders."
          />
        ) : (
          filteredPlans.map((plan) => {
            const isCompleted = plan.status === 'completed';
            const priorityColor = getPriorityColor(plan.priority);
            return (
              <View
                key={plan.id}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isCompleted ? colors.border : colors.border,
                    opacity: isCompleted ? 0.65 : 1,
                  },
                ]}
              >
                {/* Status Checkbox */}
                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    {
                      borderColor: isCompleted ? '#10b981' : colors.border,
                      backgroundColor: isCompleted ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                    },
                  ]}
                  onPress={() => handleToggleStatus(plan)}
                  activeOpacity={0.7}
                >
                  {isCompleted && <Ionicons name="checkmark" size={16} color="#10b981" />}
                </TouchableOpacity>

                {/* Plan Content */}
                <TouchableOpacity
                  style={styles.planBody}
                  onPress={() => handleOpenEdit(plan)}
                  activeOpacity={0.7}
                >
                  <View style={styles.planTitleRow}>
                    <Text
                      style={[
                        styles.planTitle,
                        {
                          color: colors.text,
                          fontSize: scaleFont(14),
                          textDecorationLine: isCompleted ? 'line-through' : 'none',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {plan.title}
                    </Text>
                    <View style={[styles.priorityBadge, { backgroundColor: `${priorityColor}18` }]}>
                      <Text style={[styles.priorityText, { color: priorityColor, fontSize: scaleFont(9) }]}>
                        {plan.priority.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {!!plan.description && (
                    <Text
                      style={[styles.planDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]}
                      numberOfLines={2}
                    >
                      {plan.description}
                    </Text>
                  )}

                  <View style={styles.planMetaRow}>
                    {!!plan.due_date && (
                      <View style={styles.metaItem}>
                        <Ionicons name="time-outline" size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
                        <Text style={[styles.metaText, { color: colors.textMuted, fontSize: scaleFont(10) }]}>
                          {plan.due_date} {plan.due_time || ''}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.categoryTag, { backgroundColor: colors.background }]}>
                      <Text style={[styles.categoryTagText, { color: colors.textSecondary, fontSize: scaleFont(9) }]}>
                        {plan.category.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Delete Button */}
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(plan.id)}
                  activeOpacity={0.7}
                >
                  <Feather name="trash-2" size={15} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* 3. Create / Edit Plan Modal Sheet */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text, fontSize: scaleFont(16) }]}>
                {editingId ? 'Edit Plan' : 'Create New Plan'}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: 14 }}>
              <View>
                <Text style={[styles.inputLabel, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
                  PLAN TITLE
                </Text>
                <TextInput
                  style={[styles.inputBox, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g. Executive Quarterly Budget Review"
                  placeholderTextColor={colors.textMuted}
                  value={titleInput}
                  onChangeText={setTitleInput}
                />
              </View>

              <View>
                <Text style={[styles.inputLabel, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
                  NOTES / AGENDA DETAILS
                </Text>
                <TextInput
                  style={[
                    styles.inputBox,
                    styles.multilineBox,
                    { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
                  ]}
                  placeholder="Details, sub-tasks, or notes..."
                  placeholderTextColor={colors.textMuted}
                  value={descInput}
                  onChangeText={setDescInput}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.rowTwoInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
                    DUE DATE (YYYY-MM-DD)
                  </Text>
                  <TextInput
                    style={[styles.inputBox, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                    placeholder="2026-10-08"
                    placeholderTextColor={colors.textMuted}
                    value={dueDateInput}
                    onChangeText={setDueDateInput}
                  />
                </View>
                <View style={{ width: 110 }}>
                  <Text style={[styles.inputLabel, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
                    TIME
                  </Text>
                  <TextInput
                    style={[styles.inputBox, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                    placeholder="14:00"
                    placeholderTextColor={colors.textMuted}
                    value={dueTimeInput}
                    onChangeText={setDueTimeInput}
                  />
                </View>
              </View>

              {/* Priority Chips */}
              <View>
                <Text style={[styles.inputLabel, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
                  PRIORITY
                </Text>
                <View style={styles.chipSelectRow}>
                  {(['normal', 'high', 'urgent'] as const).map((p) => {
                    const isSelected = priorityInput === p;
                    const pColor = getPriorityColor(p);
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[
                          styles.selectChip,
                          {
                            backgroundColor: isSelected ? `${pColor}20` : colors.background,
                            borderColor: isSelected ? pColor : colors.border,
                          },
                        ]}
                        onPress={() => {
                          triggerHaptic('selection');
                          setPriorityInput(p);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.selectChipText, { color: isSelected ? pColor : colors.textSecondary, fontSize: scaleFont(11) }]}>
                          {p.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Category Chips */}
              <View>
                <Text style={[styles.inputLabel, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
                  CATEGORY
                </Text>
                <View style={styles.chipSelectRow}>
                  {(['task', 'meeting', 'reminder'] as const).map((cat) => {
                    const isSelected = categoryInput === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.selectChip,
                          {
                            backgroundColor: isSelected ? `${colors.primary}20` : colors.background,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => {
                          triggerHaptic('selection');
                          setCategoryInput(cat);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.selectChipText, { color: isSelected ? colors.primary : colors.textSecondary, fontSize: scaleFont(11) }]}>
                          {cat.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Save CTA */}
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary, marginTop: 10 }]}
                onPress={handleSave}
                activeOpacity={0.8}
              >
                <Text style={[styles.saveBtnText, { fontSize: scaleFont(13) }]}>
                  {editingId ? 'Update Plan' : 'Save Plan'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  filterGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterText: {
    fontWeight: '700',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  addBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  scrollList: {
    flex: 1,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  planBody: {
    flex: 1,
    marginRight: 8,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  planTitle: {
    fontWeight: '700',
    flex: 1,
    marginRight: 6,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityText: {
    fontWeight: '800',
  },
  planDesc: {
    lineHeight: 16,
    marginBottom: 6,
  },
  planMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontWeight: '600',
  },
  categoryTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryTagText: {
    fontWeight: '700',
  },
  deleteBtn: {
    padding: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontWeight: '800',
  },
  inputLabel: {
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputBox: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  multilineBox: {
    height: 70,
    textAlignVertical: 'top',
  },
  rowTwoInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  chipSelectRow: {
    flexDirection: 'row',
    gap: 8,
  },
  selectChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  selectChipText: {
    fontWeight: '800',
  },
  saveBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
