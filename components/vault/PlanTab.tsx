import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useHCITheme } from '@/hooks/useHCITheme';
import { EmptyState } from '@/components/shared/EmptyState';
import { ModalSheet } from '@/components/shared/ModalSheet';
import {
  PlanItem,
  DaySchedule,
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
type PlanTypeMode = 'task' | 'schedule';

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export default function PlanTab({ refreshSignal }: PlanTabProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Mode Selection: Task vs Schedule
  const [planTypeMode, setPlanTypeMode] = useState<PlanTypeMode>('task');

  // Task Form inputs
  const [titleInput, setTitleInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [dueDateInput, setDueDateInput] = useState('');
  const [dueTimeInput, setDueTimeInput] = useState('');
  const [priorityInput, setPriorityInput] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [categoryInput, setCategoryInput] = useState('task');

  // Schedule Form inputs
  const [daysDuration, setDaysDuration] = useState<number>(7);
  const [repeatWeekly, setRepeatWeekly] = useState<boolean>(true);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [daySchedules, setDaySchedules] = useState<DaySchedule[]>([]);

  // New Block inputs
  const [newBlockTime, setNewBlockTime] = useState('08:00 AM');
  const [newBlockActivity, setNewBlockActivity] = useState('');

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

  const initDefaultSchedules = (numDays: number): DaySchedule[] => {
    return Array.from({ length: numDays }, (_, i) => ({
      dayName: DAYS_OF_WEEK[i % 7],
      blocks: [
        { id: `b_${i}_1`, time: '08:00 AM', activity: 'Morning Routine & Briefing' },
        { id: `b_${i}_2`, time: '02:00 PM', activity: 'Work Focus & Review' },
      ],
    }));
  };

  const handleOpenCreate = () => {
    triggerHaptic('selection');
    setEditingId(null);
    setPlanTypeMode('task');
    setTitleInput('');
    setDescInput('');
    const today = new Date().toISOString().split('T')[0];
    setDueDateInput(today);
    setDueTimeInput('12:00');
    setPriorityInput('normal');
    setCategoryInput('task');

    setDaysDuration(7);
    setRepeatWeekly(true);
    setSelectedDayIndex(0);
    setDaySchedules(initDefaultSchedules(7));
    setNewBlockTime('09:00 AM');
    setNewBlockActivity('');
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

    if (plan.plan_type === 'schedule') {
      setPlanTypeMode('schedule');
      setDaysDuration(plan.days_duration || 7);
      setRepeatWeekly(plan.repeat_weekly === 1);
      if (plan.schedule_data) {
        try {
          const parsed = JSON.parse(plan.schedule_data);
          setDaySchedules(Array.isArray(parsed) ? parsed : initDefaultSchedules(plan.days_duration || 7));
        } catch {
          setDaySchedules(initDefaultSchedules(plan.days_duration || 7));
        }
      } else {
        setDaySchedules(initDefaultSchedules(plan.days_duration || 7));
      }
    } else {
      setPlanTypeMode('task');
      setDaysDuration(7);
      setRepeatWeekly(true);
      setDaySchedules(initDefaultSchedules(7));
    }
    setModalVisible(true);
  };

  const handleAddBlockToCurrentDay = () => {
    if (!newBlockActivity.trim()) {
      Alert.alert('Required', 'Please enter an activity name.');
      return;
    }
    triggerHaptic('selection');
    const updated = [...daySchedules];
    if (!updated[selectedDayIndex]) {
      updated[selectedDayIndex] = {
        dayName: DAYS_OF_WEEK[selectedDayIndex % 7],
        blocks: [],
      };
    }
    updated[selectedDayIndex].blocks.push({
      id: `blk_${Date.now()}`,
      time: newBlockTime.trim() || '12:00 PM',
      activity: newBlockActivity.trim(),
    });
    setDaySchedules(updated);
    setNewBlockActivity('');
  };

  const handleRemoveBlock = (dayIdx: number, blockId: string) => {
    triggerHaptic('selection');
    const updated = [...daySchedules];
    if (updated[dayIdx]) {
      updated[dayIdx].blocks = updated[dayIdx].blocks.filter((b) => b.id !== blockId);
      setDaySchedules(updated);
    }
  };

  const handleDurationChange = (days: number) => {
    const clamped = Math.min(Math.max(days, 1), 7);
    setDaysDuration(clamped);
    if (daySchedules.length < clamped) {
      const added = Array.from({ length: clamped - daySchedules.length }, (_, i) => ({
        dayName: DAYS_OF_WEEK[(daySchedules.length + i) % 7],
        blocks: [],
      }));
      setDaySchedules([...daySchedules, ...added]);
    } else {
      setDaySchedules(daySchedules.slice(0, clamped));
    }
    if (selectedDayIndex >= clamped) {
      setSelectedDayIndex(0);
    }
  };

  const handleSave = async () => {
    if (!titleInput.trim()) {
      Alert.alert('Required', 'Please enter a title for this plan.');
      return;
    }

    try {
      const scheduleJson = planTypeMode === 'schedule' ? JSON.stringify(daySchedules) : null;
      if (editingId) {
        await updatePlan(editingId, {
          title: titleInput.trim(),
          description: descInput.trim(),
          due_date: planTypeMode === 'task' ? dueDateInput.trim() : undefined,
          due_time: planTypeMode === 'task' ? dueTimeInput.trim() : undefined,
          priority: priorityInput,
          category: categoryInput,
          plan_type: planTypeMode,
          days_duration: planTypeMode === 'schedule' ? daysDuration : 1,
          repeat_weekly: planTypeMode === 'schedule' ? (repeatWeekly ? 1 : 0) : 0,
          schedule_data: scheduleJson || undefined,
        });
      } else {
        await createPlan({
          title: titleInput.trim(),
          description: descInput.trim(),
          due_date: planTypeMode === 'task' ? dueDateInput.trim() : undefined,
          due_time: planTypeMode === 'task' ? dueTimeInput.trim() : undefined,
          priority: priorityInput,
          category: categoryInput,
          plan_type: planTypeMode,
          days_duration: planTypeMode === 'schedule' ? daysDuration : 1,
          repeat_weekly: planTypeMode === 'schedule' ? (repeatWeekly ? 1 : 0) : 0,
          schedule_data: scheduleJson || undefined,
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
        return '#0284c7';
    }
  };

  const setRelativeDueDate = (daysOffset: number) => {
    triggerHaptic('selection');
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    setDueDateInput(d.toISOString().split('T')[0]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 1. Header Toolbar */}
      <View style={styles.toolbarRow}>
        <View style={styles.filterGroup}>
          {(['all', 'pending', 'completed'] as const).map((tab) => {
            const isSelected = filter === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  setFilter(tab);
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Text
                  style={[
                    styles.filterText,
                    {
                      color: isSelected ? '#ffffff' : colors.textSecondary,
                      fontSize: scaleFont(12),
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
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="add" size={18} color="#ffffff" style={{ marginRight: 4 }} />
          <Text style={[styles.addBtnText, { fontSize: scaleFont(12.5) }]}>New Plan</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Plans List */}
      <ScrollView
        style={styles.scrollList}
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
      >
        {filteredPlans.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="No Plans or Routines"
            subtitle="Create actionable daily tasks or a 7-day recurring schedule to structure your workflow."
          />
        ) : (
          filteredPlans.map((plan) => {
            const isCompleted = plan.status === 'completed';
            const isSchedule = plan.plan_type === 'schedule';
            const pColor = getPriorityColor(plan.priority);

            let scheduleBlocksCount = 0;
            if (isSchedule && plan.schedule_data) {
              try {
                const parsed: DaySchedule[] = JSON.parse(plan.schedule_data);
                scheduleBlocksCount = parsed.reduce((sum, d) => sum + (d.blocks?.length || 0), 0);
              } catch {}
            }

            return (
              <View
                key={plan.id}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isCompleted ? colors.border : `${pColor}40`,
                    opacity: isCompleted ? 0.65 : 1,
                  },
                ]}
              >
                {/* Status Toggle Checkbox (44dp touch target) */}
                <TouchableOpacity
                  style={styles.checkboxTouchTarget}
                  onPress={() => handleToggleStatus(plan)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Toggle plan completion status"
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: isCompleted ? '#10b981' : colors.border,
                        backgroundColor: isCompleted ? '#10b981' : 'transparent',
                      },
                    ]}
                  >
                    {isCompleted && <Ionicons name="checkmark" size={16} color="#ffffff" />}
                  </View>
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

                    <View style={[styles.priorityBadge, { backgroundColor: `${pColor}20` }]}>
                      <Text style={[styles.priorityText, { color: pColor, fontSize: scaleFont(9.5) }]}>
                        {isSchedule ? 'ROUTINE' : plan.priority.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {plan.description ? (
                    <Text
                      style={[styles.planDesc, { color: colors.textSecondary, fontSize: scaleFont(11.5) }]}
                      numberOfLines={2}
                    >
                      {plan.description}
                    </Text>
                  ) : null}

                  {/* Metadata Row */}
                  <View style={styles.planMetaRow}>
                    {isSchedule ? (
                      <View style={styles.metaItem}>
                        <Ionicons name="repeat-outline" size={13} color="#10b981" style={{ marginRight: 4 }} />
                        <Text style={[styles.metaText, { color: '#10b981', fontSize: scaleFont(10.5) }]}>
                          {plan.days_duration || 7} Days {plan.repeat_weekly ? '• Weekly' : ''} ({scheduleBlocksCount} blocks)
                        </Text>
                      </View>
                    ) : (
                      <>
                        {plan.due_date && (
                          <View style={styles.metaItem}>
                            <Ionicons name="calendar-outline" size={13} color={colors.textMuted} style={{ marginRight: 4 }} />
                            <Text style={[styles.metaText, { color: colors.textMuted, fontSize: scaleFont(10.5) }]}>
                              {plan.due_date} {plan.due_time || ''}
                            </Text>
                          </View>
                        )}
                      </>
                    )}

                    <View style={[styles.categoryTag, { backgroundColor: colors.background }]}>
                      <Text style={[styles.categoryTagText, { color: colors.textMuted, fontSize: scaleFont(9.5) }]}>
                        {(isSchedule ? 'Schedule' : plan.category).toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Delete Button (44dp touch target) */}
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(plan.id)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityLabel="Delete plan"
                >
                  <Feather name="trash-2" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* 3. Create / Edit Plan Modal Sheet using Standard ModalSheet */}
      <ModalSheet
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={editingId ? 'Edit Plan' : 'Create New Plan'}
      >
        <View style={{ gap: 14 }}>
          {/* Mode Switcher: Single Task vs Multi-Day Routine (48dp height buttons) */}
          <View style={[styles.modeSelectorWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.modeOptionBtn,
                planTypeMode === 'task' && { backgroundColor: colors.primary },
              ]}
              onPress={() => {
                triggerHaptic('selection');
                setPlanTypeMode('task');
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="checkbox-outline"
                size={16}
                color={planTypeMode === 'task' ? '#ffffff' : colors.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.modeOptionText,
                  {
                    color: planTypeMode === 'task' ? '#ffffff' : colors.textSecondary,
                    fontSize: scaleFont(12.5),
                  },
                ]}
              >
                Single Task
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeOptionBtn,
                planTypeMode === 'schedule' && { backgroundColor: colors.primary },
              ]}
              onPress={() => {
                triggerHaptic('selection');
                setPlanTypeMode('schedule');
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={planTypeMode === 'schedule' ? '#ffffff' : colors.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.modeOptionText,
                  {
                    color: planTypeMode === 'schedule' ? '#ffffff' : colors.textSecondary,
                    fontSize: scaleFont(12.5),
                  },
                ]}
              >
                Schedule / Routine
              </Text>
            </TouchableOpacity>
          </View>

          {/* Title Input (48dp height) */}
          <View>
            <Text style={[styles.inputLabel, { color: colors.textSecondary, fontSize: scaleFont(11.5) }]}>
              {planTypeMode === 'schedule' ? 'ROUTINE / SCHEDULE NAME' : 'TASK TITLE'}
            </Text>
            <TextInput
              style={[
                styles.hciInputBox,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                  fontSize: scaleFont(13),
                },
              ]}
              placeholder={planTypeMode === 'schedule' ? 'e.g. Master Weekly Routine' : 'e.g. Executive Budget Review'}
              placeholderTextColor={colors.textMuted}
              value={titleInput}
              onChangeText={setTitleInput}
            />
          </View>

          {/* Description Input */}
          <View>
            <Text style={[styles.inputLabel, { color: colors.textSecondary, fontSize: scaleFont(11.5) }]}>
              NOTES / CONTEXT
            </Text>
            <TextInput
              style={[
                styles.hciInputBox,
                styles.multilineBox,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                  fontSize: scaleFont(13),
                },
              ]}
              placeholder="Details, purpose, or instructions..."
              placeholderTextColor={colors.textMuted}
              value={descInput}
              onChangeText={setDescInput}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Mode 1: Single Task Fields */}
          {planTypeMode === 'task' ? (
            <>
              {/* Due Date & Time */}
              <View style={styles.rowTwoInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary, fontSize: scaleFont(11.5) }]}>
                    DUE DATE (YYYY-MM-DD)
                  </Text>
                  <TextInput
                    style={[
                      styles.hciInputBox,
                      {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.border,
                        fontSize: scaleFont(13),
                      },
                    ]}
                    placeholder="2026-10-08"
                    placeholderTextColor={colors.textMuted}
                    value={dueDateInput}
                    onChangeText={setDueDateInput}
                  />
                </View>
                <View style={{ width: 120 }}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary, fontSize: scaleFont(11.5) }]}>
                    TIME
                  </Text>
                  <TextInput
                    style={[
                      styles.hciInputBox,
                      {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.border,
                        fontSize: scaleFont(13),
                      },
                    ]}
                    placeholder="14:00"
                    placeholderTextColor={colors.textMuted}
                    value={dueTimeInput}
                    onChangeText={setDueTimeInput}
                  />
                </View>
              </View>

              {/* Quick Date Helper Chips */}
              <View style={styles.quickDateRow}>
                <TouchableOpacity
                  style={[styles.quickDateChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => setRelativeDueDate(0)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                >
                  <Text style={[styles.quickDateText, { color: colors.primary, fontSize: scaleFont(11) }]}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickDateChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => setRelativeDueDate(1)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                >
                  <Text style={[styles.quickDateText, { color: colors.primary, fontSize: scaleFont(11) }]}>Tomorrow</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickDateChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => setRelativeDueDate(7)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                >
                  <Text style={[styles.quickDateText, { color: colors.primary, fontSize: scaleFont(11) }]}>+7 Days</Text>
                </TouchableOpacity>
              </View>

              {/* Priority Chips (44dp touch target) */}
              <View>
                <Text style={[styles.inputLabel, { color: colors.textSecondary, fontSize: scaleFont(11.5) }]}>
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
                        <Text style={[styles.selectChipText, { color: isSelected ? pColor : colors.textSecondary, fontSize: scaleFont(11.5) }]}>
                          {p.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Category Chips (44dp touch target) */}
              <View>
                <Text style={[styles.inputLabel, { color: colors.textSecondary, fontSize: scaleFont(11.5) }]}>
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
                        <Text style={[styles.selectChipText, { color: isSelected ? colors.primary : colors.textSecondary, fontSize: scaleFont(11.5) }]}>
                          {cat.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </>
          ) : (
            /* Mode 2: Multi-Day Schedule */
            <View style={styles.scheduleSection}>
              {/* Duration Selector */}
              <View>
                <View style={styles.durationHeaderRow}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary, fontSize: scaleFont(11.5), marginBottom: 0 }]}>
                    SCHEDULE DURATION
                  </Text>
                  <Text style={[styles.durationValPill, { color: colors.primary, fontSize: scaleFont(12) }]}>
                    {daysDuration} {daysDuration === 1 ? 'Day' : 'Days'}
                  </Text>
                </View>
                <View style={styles.daysPillRow}>
                  {[1, 2, 3, 4, 5, 6, 7].map((num) => {
                    const isSel = daysDuration === num;
                    return (
                      <TouchableOpacity
                        key={num}
                        style={[
                          styles.dayNumBtn,
                          {
                            backgroundColor: isSel ? colors.primary : colors.background,
                            borderColor: isSel ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => {
                          triggerHaptic('selection');
                          handleDurationChange(num);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.dayNumText,
                            {
                              color: isSel ? '#ffffff' : colors.textSecondary,
                              fontSize: scaleFont(12),
                            },
                          ]}
                        >
                          {num}d
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Repeat Weekly Toggle */}
              <View style={[styles.repeatToggleRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.repeatTitle, { color: colors.text, fontSize: scaleFont(12.5) }]}>
                    Repeat Weekly (Year-Round)
                  </Text>
                  <Text style={[styles.repeatDesc, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
                    Cycle through this routine every week automatically
                  </Text>
                </View>
                <Switch
                  value={repeatWeekly}
                  onValueChange={(val) => {
                    triggerHaptic('selection');
                    setRepeatWeekly(val);
                  }}
                  thumbColor="#ffffff"
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>

              {/* Day Picker Pills (Mon-Sun) */}
              <View>
                <Text style={[styles.inputLabel, { color: colors.textSecondary, fontSize: scaleFont(11.5) }]}>
                  CONFIGURE DAY TIMELINE
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {daySchedules.map((day, idx) => {
                    const isSelected = selectedDayIndex === idx;
                    return (
                      <TouchableOpacity
                        key={day.dayName + idx}
                        style={[
                          styles.dayTabPill,
                          {
                            backgroundColor: isSelected ? `${colors.primary}25` : colors.background,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => {
                          triggerHaptic('selection');
                          setSelectedDayIndex(idx);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.dayTabPillText,
                            {
                              color: isSelected ? colors.primary : colors.textSecondary,
                              fontSize: scaleFont(11.5),
                              fontWeight: isSelected ? '800' : '600',
                            },
                          ]}
                        >
                          {day.dayName.slice(0, 3)} ({day.blocks?.length || 0})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Selected Day Time Blocks Timeline */}
              <View style={[styles.dayTimelineCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.timelineHeader, { color: colors.text, fontSize: scaleFont(12.5) }]}>
                  {daySchedules[selectedDayIndex]?.dayName || 'Day'} Routine Blocks
                </Text>

                {daySchedules[selectedDayIndex]?.blocks.length === 0 ? (
                  <Text style={[styles.noBlocksText, { color: colors.textMuted, fontSize: scaleFont(11.5) }]}>
                    No activities defined for this day. Add time blocks below.
                  </Text>
                ) : (
                  daySchedules[selectedDayIndex]?.blocks.map((b) => (
                    <View key={b.id} style={[styles.blockItemRow, { borderColor: colors.border }]}>
                      <View style={[styles.timeBadge, { backgroundColor: `${colors.primary}18` }]}>
                        <Text style={[styles.timeBadgeText, { color: colors.primary, fontSize: scaleFont(10.5) }]}>
                          {b.time}
                        </Text>
                      </View>
                      <Text style={[styles.blockActivityText, { color: colors.text, fontSize: scaleFont(12.5) }]} numberOfLines={1}>
                        {b.activity}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleRemoveBlock(selectedDayIndex, b.id)}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        style={styles.blockDeleteBtn}
                      >
                        <Feather name="x" size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}

                {/* Quick Add Block Row (48dp height controls) */}
                <View style={styles.addBlockRow}>
                  <TextInput
                    style={[
                      styles.hciInputBox,
                      styles.timeInputBox,
                      { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border, fontSize: scaleFont(12) },
                    ]}
                    placeholder="08:00 AM"
                    placeholderTextColor={colors.textMuted}
                    value={newBlockTime}
                    onChangeText={setNewBlockTime}
                  />
                  <TextInput
                    style={[
                      styles.hciInputBox,
                      { flex: 1, backgroundColor: colors.surface, color: colors.text, borderColor: colors.border, fontSize: scaleFont(12.5) },
                    ]}
                    placeholder="Activity (e.g. Focus Sprint)"
                    placeholderTextColor={colors.textMuted}
                    value={newBlockActivity}
                    onChangeText={setNewBlockActivity}
                  />
                  <TouchableOpacity
                    style={[styles.addBlockBtn, { backgroundColor: colors.primary }]}
                    onPress={handleAddBlockToCurrentDay}
                    activeOpacity={0.8}
                    accessibilityLabel="Add activity block"
                  >
                    <Ionicons name="add" size={20} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Primary Save Action Button (52dp height) */}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary, marginTop: 10 }]}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={[styles.saveBtnText, { fontSize: scaleFont(14) }]}>
              {editingId ? 'Update Plan' : planTypeMode === 'schedule' ? 'Save Schedule' : 'Save Plan'}
            </Text>
          </TouchableOpacity>
        </View>
      </ModalSheet>
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
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterText: {
    fontWeight: '700',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
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
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
  },
  checkboxTouchTarget: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planBody: {
    flex: 1,
    marginRight: 6,
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
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
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
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  categoryTagText: {
    fontWeight: '700',
  },
  deleteBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSelectorWrap: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
  },
  modeOptionBtn: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  modeOptionText: {
    fontWeight: '700',
  },
  inputLabel: {
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  hciInputBox: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
  },
  multilineBox: {
    height: 76,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  rowTwoInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: -4,
  },
  quickDateChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  quickDateText: {
    fontWeight: '700',
  },
  chipSelectRow: {
    flexDirection: 'row',
    gap: 8,
  },
  selectChip: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
  },
  selectChipText: {
    fontWeight: '800',
  },
  scheduleSection: {
    gap: 14,
  },
  durationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  durationValPill: {
    fontWeight: '800',
  },
  daysPillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dayNumBtn: {
    flex: 1,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
  },
  dayNumText: {
    fontWeight: '800',
  },
  repeatToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  repeatTitle: {
    fontWeight: '700',
  },
  repeatDesc: {
    marginTop: 2,
    lineHeight: 14,
  },
  dayTabPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  dayTabPillText: {
    letterSpacing: 0.2,
  },
  dayTimelineCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
  },
  timelineHeader: {
    fontWeight: '800',
    marginBottom: 10,
  },
  noBlocksText: {
    marginBottom: 12,
    lineHeight: 16,
  },
  blockItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingVertical: 10,
    gap: 10,
  },
  timeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeBadgeText: {
    fontWeight: '800',
  },
  blockActivityText: {
    flex: 1,
    fontWeight: '600',
  },
  blockDeleteBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  timeInputBox: {
    width: 95,
    textAlign: 'center',
  },
  addBlockBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
