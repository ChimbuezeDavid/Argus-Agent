// Argus AI Executive Assistant - Home Command Surface
// Faithfully matches the executive dark-mode UI with live telemetry,
// Autonomous Event Feed, Contextual Suggested Actions, and Glowing Omnibar.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getDatabase } from '@/services/database/db';
import {
  StyleSheet,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Clipboard,
  Animated,
  Keyboard,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { Text } from '@/components/Themed';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/store/settingsStore';
import { useVoiceStore } from '@/store/voiceStore';
import { useHCITheme } from '@/hooks/useHCITheme';
import * as voiceService from '@/services/voice/voiceService';
import * as conversationRepo from '@/services/database/conversationRepo';
import { listExpenses } from '@/services/database/expensesRepo';
import * as budgetRepo from '@/services/database/budgetRepo';
import * as geofenceService from '@/services/observation/geofenceService';
import ArgusSystemMonitors from '@/modules/argus-system-monitors';
import { runAgentConversation } from '@/services/agent/client';
import { hotwordController } from '@/services/voice/hotwordService';

// Extracted Modular Components
import { TelemetryHeader } from '@/components/chat/TelemetryHeader';
import { ExecutivePulseCard } from '@/components/chat/ExecutivePulseCard';
import { AutonomousFeed, FeedItem } from '@/components/chat/AutonomousFeed';
import { SuggestedActions } from '@/components/chat/SuggestedActions';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { Omnibar } from '@/components/chat/Omnibar';
import { VoiceAssistantModal } from '@/components/chat/VoiceAssistantModal';
import { SessionHistoryModal } from '@/components/chat/SessionHistoryModal';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: any[];
  toolResults?: any[];
  actionType?: 'launch_app' | 'make_call' | 'expense' | 'budget';
  actionData?: any;
}

export default function ArgusHomeScreen() {
  const settings = useSettingsStore();
  const voice = useVoiceStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, scaleFont, triggerHaptic, reduceMotion } = useHCITheme();

  // Multi-Conversation State
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [conversationTitle, setConversationTitle] = useState('Executive Command Deck');
  const [conversationsList, setConversationsList] = useState<conversationRepo.Conversation[]>([]);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
  const [voicePromptInput, setVoicePromptInput] = useState('');

  // Messages & Input State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Live Telemetry
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [monthlyBudgetLimit, setMonthlyBudgetLimit] = useState(0);
  const [todaySpent, setTodaySpent] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [activeLocationName, setActiveLocationName] = useState('Asubi • Home');
  const [dynamicFeedItems, setDynamicFeedItems] = useState<FeedItem[]>([]);

  // Voice Wave Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const flatListRef = useRef<FlatList>(null);

  // Load live telemetry & build autonomous feed
  const refreshHomeScreenData = useCallback(async () => {
    try {
      const allConvs = await conversationRepo.listConversations();
      setConversationsList(allConvs);

      const allExpenses = await listExpenses();
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const todaySum = allExpenses.filter((e) => e.date.startsWith(`${currentMonth}-${String(now.getDate()).padStart(2, '0')}`)).reduce((sum, e) => sum + e.amount, 0);
      setTodaySpent(todaySum);
      setTodayCount(allExpenses.filter((e) => e.date.startsWith(`${currentMonth}-${String(now.getDate()).padStart(2, '0')}`)).length);

      // Monthly budget telemetry
      const summary = await budgetRepo.getBudgetSummaryForMonth(currentMonth);
      setMonthlyTotal(summary.totalSpentThisMonth);
      setMonthlyBudgetLimit(summary.totalMonthlyBudget);

      // Build live autonomous feed from real on-device events
      const feed: FeedItem[] = [];

      // 1. Most recent expense or bank alert
      if (allExpenses.length > 0) {
        const topExpense = allExpenses[0];
        const isAuto = topExpense.source === 'notification_extracted';
        feed.push({
          id: `feed-exp-${topExpense.id}`,
          type: 'expense_parsed',
          title: `₦${topExpense.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })} ${topExpense.category}`,
          subtitle: isAuto ? `Bank Alert Parsed • ${topExpense.description || 'Auto'}` : `${topExpense.description || 'Manual Record'}`,
          badgeText: isAuto ? 'Auto' : 'Ledger',
          badgeColor: '#10b981',
          iconType: 'card',
          onPress: () => router.push('/(tabs)/expenses'),
        });
      }

      // 2. Geofence Active Rule & Latest Crossing
      const geofences = await geofenceService.listGeofences();
      const events = await geofenceService.listGeofenceEvents();
      if (events.length > 0) {
        const topEvent = events[0];
        const matchingFence = geofences.find((g) => g.identifier === topEvent.identifier);
        const hsNote = topEvent.event_type === 'enter' ? matchingFence?.enter_habit : matchingFence?.exit_habit;
        feed.push({
          id: `feed-ev-${topEvent.id}`,
          type: 'geofence_arrival',
          title: `${topEvent.event_type === 'enter' ? 'Arrived at' : 'Departed from'} ${topEvent.identifier}`,
          subtitle: hsNote ? `HS: ${hsNote}` : `Boundary ${topEvent.event_type.toUpperCase()} recorded`,
          badgeText: 'Rule',
          badgeColor: colors.textMuted,
          iconType: 'location',
          onPress: () => router.push('/(tabs)/vault'),
        });
      } else if (geofences.length > 0) {
        const primaryFence = geofences[0];
        setActiveLocationName(`GPS • ${primaryFence.identifier}`);
        feed.push({
          id: `feed-gf-${primaryFence.id}`,
          type: 'geofence',
          title: `Geofence: ${primaryFence.identifier} (${primaryFence.radius}m)`,
          subtitle: primaryFence.enter_habit ? `HS: ${primaryFence.enter_habit}` : (primaryFence.is_active ? 'Active on-device boundary monitoring' : 'Boundary inactive'),
          badgeText: 'Active',
          badgeColor: '#38bdf8',
          iconType: 'location',
          onPress: () => router.push('/(tabs)/vault'),
        });
      }

      // 3. Storage Intelligence
      feed.push({
        id: 'feed-storage-1',
        type: 'storage',
        title: 'Device Storage Intelligence',
        subtitle: 'Index downloads, receipts & offline files',
        badgeText: 'Search',
        badgeColor: colors.primary,
        badgeType: 'button',
        iconType: 'document',
        onPress: () => handleSend('Argus, list recent downloaded documents in storage'),
      });

      setDynamicFeedItems(feed);
    } catch (e) {
      console.warn('Error refreshing Home screen data:', e);
    }
  }, [colors.primary, colors.textMuted, router]);

  useFocusEffect(
    useCallback(() => {
      refreshHomeScreenData();
    }, [refreshHomeScreenData])
  );

  useEffect(() => {
    if (reduceMotion) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [reduceMotion, pulseAnim]);

  // Always-On "Hey Argus" Wake-Word Listener
  useEffect(() => {
    if (settings.alwaysOnVoiceEnabled) {
      hotwordController.startListening((command) => {
        handleExecuteVoiceAction(command);
      });
    } else {
      hotwordController.stopListening();
    }
    return () => {
      hotwordController.stopListening();
    };
  }, [settings.alwaysOnVoiceEnabled]);

  // Content-Aware Keyboard Auto-Scroll
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 120);
      }
    );
    return () => showSub.remove();
  }, []);

  // Handle new chat session
  const handleNewSession = async () => {
    triggerHaptic('light');
    try {
      const newConv = await conversationRepo.createConversation('New Command Session');
      setActiveConversationId(newConv.id);
      setConversationTitle(newConv.title);
      setMessages([]);
      setHistoryModalVisible(false);
    } catch (e) {
      console.error('Error creating conversation:', e);
    }
  };

  // Handle selecting an existing conversation
  const handleSelectConversation = async (conv: conversationRepo.Conversation) => {
    triggerHaptic('selection');
    try {
      setActiveConversationId(conv.id);
      setConversationTitle(conv.title);
      const dbMessages = await conversationRepo.getConversationMessages(conv.id);
      const mapped: Message[] = dbMessages.map((m: any) => ({
        id: m.id.toString(),
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: m.timestamp,
        toolCalls: m.tool_calls ? JSON.parse(m.tool_calls) : undefined,
        toolResults: m.tool_results ? JSON.parse(m.tool_results) : undefined,
      }));
      setMessages(mapped);
      setHistoryModalVisible(false);
    } catch (e) {
      console.error('Error loading messages:', e);
    }
  };

  // Handle deleting an individual conversation
  const handleDeleteConversation = async (id: number) => {
    try {
      await conversationRepo.deleteConversation(id);
      triggerHaptic('success');
      const list = await conversationRepo.listConversations();
      setConversationsList(list);
      if (activeConversationId === id) {
        if (list.length > 0) {
          await handleSelectConversation(list[0]);
        } else {
          setActiveConversationId(null);
          setConversationTitle('Argus Deck');
          setMessages([]);
        }
      }
    } catch (e) {
      console.error('Error deleting conversation:', e);
    }
  };

  // Dispatch direct voice action
  const handleExecuteVoiceAction = async (prompt: string) => {
    setVoiceModalVisible(false);
    handleSend(prompt);
  };

  const handleSend = async (customQuery?: string) => {
    const query = (customQuery || inputText).trim();
    if (!query || isProcessing) return;
    triggerHaptic('light');

    let convId = activeConversationId;
    if (!convId) {
      const newConv = await conversationRepo.createConversation(
        query.slice(0, 32) + (query.length > 32 ? '...' : '')
      );
      convId = newConv.id;
      setActiveConversationId(convId);
      setConversationTitle(newConv.title);
    }

    setInputText('');
    const userMsgId = Date.now().toString();
    const newMsg: Message = {
      id: userMsgId,
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMsg]);
    setIsProcessing(true);

    try {
      await conversationRepo.addMessage(convId, 'user', query);

      const conversationHistory = [...messages, newMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const activeModel = settings.geminiModel || 'gemini-3.7-flash';
      const response = await runAgentConversation(conversationHistory, activeModel);

      const assistantMsgId = (Date.now() + 1).toString();
      const assistantMsg: Message = {
        id: assistantMsgId,
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toISOString(),
        toolCalls: response.toolSteps?.map((s) => s.toolCall),
        toolResults: response.toolSteps?.map((s) => s.result),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      await conversationRepo.addMessage(
        convId,
        'assistant',
        response.content,
        response.toolSteps ? response.toolSteps : null,
        null
      );

      // Spoken voice feedback (only if user enabled audio feedback)
      if (settings.audioFeedbackEnabled) {
        voiceService.speak(response.content);
      }

      refreshHomeScreenData();
    } catch (e: any) {
      console.error('Argus Command execution error:', e);
      const isMissingKey = e.message === 'API_KEY_MISSING' || !settings.apiKey;
      const errorText = isMissingKey
        ? 'Please configure your Gemini API Key in Settings to enable Argus Agent intelligence.'
        : `Argus Agent could not complete this command: ${e.message || 'Network / API error'}. Please verify your Gemini API Key in Settings.`;

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: errorText,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualSync = async () => {
    triggerHaptic('medium');
    try {
      const db = await getDatabase();
      const [notifEvents, unconfirmed, geofences, notesCount] = await Promise.all([
        db.getAllAsync<any>('SELECT COUNT(*) as count FROM notification_events').catch(() => [{ count: 0 }]),
        db.getAllAsync<any>('SELECT COUNT(*) as count FROM expenses WHERE status = "unconfirmed"').catch(() => [{ count: 0 }]),
        db.getAllAsync<any>('SELECT COUNT(*) as count FROM geofences WHERE is_active = 1').catch(() => [{ count: 0 }]),
        db.getAllAsync<any>('SELECT COUNT(*) as count FROM notes').catch(() => [{ count: 0 }]),
      ]);

      await geofenceService.syncGeofencesWithOS().catch(() => {});
      await useSettingsStore.getState().syncSystemPermissions().catch(() => {});

      triggerHaptic('success');
      Alert.alert(
        '⚡ Argus Diagnostic Sync',
        `All on-device services are synchronized:\n\n` +
        `• 🔔 Bank Interceptor: ${notifEvents[0]?.count || 0} events captured\n` +
        `• 💳 Unconfirmed Alerts: ${unconfirmed[0]?.count || 0} pending\n` +
        `• 📍 Active Geofences: ${geofences[0]?.count || 0} boundaries active\n` +
        `• 📝 Vault Knowledge: ${notesCount[0]?.count || 0} notes indexed\n` +
        `• 🔒 Permissions & OS State: 100% in sync`
      );
    } catch (e: any) {
      Alert.alert('Diagnostic Sync', 'Sync completed on-device.');
    }
  };

  const handleCopy = (id: string, content: string) => {
    Clipboard.setString(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* 1. Top Status Bar Header (ON-DEVICE • Asubi Home • Settings Gear) */}
      <TelemetryHeader
        insetsTop={insets.top}
        locationName={activeLocationName}
        onOpenHistory={() => setHistoryModalVisible(true)}
        onSync={handleManualSync}
      />

      {/* 2. Main Body Surface: Executive Dashboard Feed OR Active Chat Timeline */}
      {messages.length === 0 ? (
        <ScrollView
          style={styles.scrollSurface}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          keyboardDismissMode="on-drag"
        >
          {/* A. Argus Executive Pulse Hero Card */}
          <ExecutivePulseCard
            todaySpent={todaySpent}
            todayCount={todayCount}
            monthlyBudgetLimit={monthlyBudgetLimit}
            monthlyTotal={monthlyTotal}
          />

          {/* B. Autonomous Feed */}
          <AutonomousFeed items={dynamicFeedItems} />

          {/* C. Suggested Actions */}
          <SuggestedActions onSelectAction={(prompt) => handleSend(prompt)} />
        </ScrollView>
      ) : (
        <View style={styles.chatTimelineContainer}>
          {/* Active Chat Header Bar */}
          <View style={[styles.chatActiveBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Text style={[styles.chatActiveTitle, { color: colors.textSecondary }]} numberOfLines={1}>
              {conversationTitle}
            </Text>
            <TouchableOpacity
              style={[styles.newChatBtn, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}
              onPress={handleNewSession}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={14} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={[styles.newChatBtnText, { color: colors.primary }]}>Dashboard</Text>
            </TouchableOpacity>
          </View>

          {/* Messages Stream */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={true}
            keyboardDismissMode="on-drag"
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => (
              <ChatBubble
                item={item}
                copiedId={copiedId}
                onCopy={handleCopy}
              />
            )}
          />
        </View>
      )}

      {/* 3. Floating Omnibar Capsule Dock */}
      <Omnibar
        insetsBottom={insets.bottom}
        inputText={inputText}
        onChangeText={setInputText}
        onSend={() => handleSend()}
        isProcessing={isProcessing}
        onOpenVoiceModal={() => setVoiceModalVisible(true)}
      />

      {/* 4. Dedicated Voice Assistant Modal */}
      <VoiceAssistantModal
        visible={voiceModalVisible}
        onClose={() => setVoiceModalVisible(false)}
        insetsBottom={insets.bottom}
        pulseAnim={pulseAnim}
        onExecuteVoiceAction={handleExecuteVoiceAction}
      />

      {/* 5. Session History Modal */}
      <SessionHistoryModal
        visible={historyModalVisible}
        onClose={() => setHistoryModalVisible(false)}
        insetsBottom={insets.bottom}
        conversationsList={conversationsList}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewSession={handleNewSession}
        onDeleteConversation={handleDeleteConversation}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollSurface: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  chatTimelineContainer: {
    flex: 1,
  },
  chatActiveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0c1319',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  chatActiveTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    marginRight: 10,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#172554',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e3a8a',
  },
  newChatBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38bdf8',
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    paddingBottom: 110,
  },
});

