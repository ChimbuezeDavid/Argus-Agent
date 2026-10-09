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
import { executeOfflineAction } from '@/services/actions/offlineDeviceActions';
import { routeAndExecuteCommand, RoutingMode } from '@/services/orchestrator/intentRouter';

// Extracted Modular Components
import { TelemetryHeader } from '@/components/chat/TelemetryHeader';
import { ExecutivePulseCard } from '@/components/chat/ExecutivePulseCard';
import { AutonomousFeed, FeedItem } from '@/components/chat/AutonomousFeed';
import { SuggestedActions } from '@/components/chat/SuggestedActions';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { Omnibar } from '@/components/chat/Omnibar';
import { VoiceAssistantModal } from '@/components/chat/VoiceAssistantModal';
import { SessionHistoryModal } from '@/components/chat/SessionHistoryModal';
import { NavigationDrawer } from '@/components/navigation';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  engine?: 'ella_local' | 'gemini_cloud';
  latencyMs?: number;
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
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [voicePromptInput, setVoicePromptInput] = useState('');

  // Messages & Input State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [routingMode, setRoutingMode] = useState<RoutingMode>('auto');

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
        if (!command || command.toLowerCase() === 'hey argus' || command.toLowerCase() === 'argus') {
          // Awakened without command: open Voice Modal and prompt
          setVoiceModalVisible(true);
          if (settings.audioFeedbackEnabled) {
            voiceService.speak("I'm listening.");
          }
        } else {
          // Hands-free command received: execute directly
          handleExecuteVoiceAction(command);
        }
      });
    } else {
      hotwordController.stopListening();
    }
    return () => {
      hotwordController.stopListening();
    };
  }, [settings.alwaysOnVoiceEnabled, settings.audioFeedbackEnabled]);

  // Pause wake-word listener while voice modal is active to prevent mic conflicts
  useEffect(() => {
    if (voiceModalVisible) {
      hotwordController.pause();
    } else if (settings.alwaysOnVoiceEnabled) {
      hotwordController.resume();
    }
  }, [voiceModalVisible, settings.alwaysOnVoiceEnabled]);

  // Check if awakened by background Voice Daemon
  useEffect(() => {
    ArgusSystemMonitors.getLaunchWakeCommand()
      .then((cmd) => {
        if (cmd && cmd.trim()) {
          const cleanCmd = cmd.trim();
          const customWord = (settings.customWakeWord || 'Hey Argus').toLowerCase().trim();
          const cleanLower = cleanCmd.toLowerCase();
          const isJustWakeWord =
            cleanLower === 'hey argus' ||
            cleanLower === 'argus' ||
            cleanLower === customWord ||
            cleanLower === customWord.replace(/^(?:hey|hi|hello|ok|okay)\s+/i, '');

          if (isJustWakeWord) {
            setVoiceModalVisible(true);
            if (settings.audioFeedbackEnabled) {
              voiceService.speak("I'm listening.");
            }
          } else {
            handleExecuteVoiceAction(cleanCmd);
          }
        }
      })
      .catch(() => {});
  }, []);

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

      // Unified Hybrid Execution Pipeline (Ella vs. Gemini)
      const conversationHistory = [...messages, newMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const activeModel = settings.geminiModel || 'gemini-3.7-flash';
      const routed = await routeAndExecuteCommand(
        query,
        routingMode,
        conversationHistory,
        activeModel
      );

      const assistantMsgId = (Date.now() + 1).toString();
      const assistantMsg: Message = {
        id: assistantMsgId,
        role: 'assistant',
        content: routed.content,
        timestamp: new Date().toISOString(),
        engine: routed.engine,
        latencyMs: routed.latencyMs,
        toolCalls: routed.toolCalls,
        toolResults: routed.toolResults,
        actionType: routed.actionType as any,
        actionData: routed.data,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      await conversationRepo.addMessage(
        convId,
        'assistant',
        routed.content,
        routed.toolCalls ? routed.toolCalls : null,
        null
      );

      // Spoken voice feedback (only if user enabled audio feedback)
      if (settings.audioFeedbackEnabled) {
        voiceService.speak(routed.content);
      }

      refreshHomeScreenData();
    } catch (e: any) {
      console.error('Argus Command execution error:', e);
      const isMissingKey = e.message === 'API_KEY_MISSING' || !settings.apiKey;
      const isNetworkError =
        e.message?.toLowerCase().includes('network') ||
        e.message?.toLowerCase().includes('fetch failed') ||
        e.message?.toLowerCase().includes('connection') ||
        e.message?.toLowerCase().includes('internet');

      let errorText = `Argus Agent encountered an error: ${e.message || 'Execution error'}.`;
      if (isMissingKey) {
        errorText = 'Gemini API key is not configured. Please open Settings ➔ AI Engine & Models to enter and save your Gemini API key.';
      } else if (isNetworkError) {
        errorText = 'You are currently offline. Local device automations (play music on VLC, start audio recording, call contacts, log expenses, take notes, or open apps) remain available without internet.';
      }

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

  // Live GPS & Geofence location resolution
  const updateCurrentLocation = useCallback(async () => {
    try {
      const coords = await geofenceService.getCurrentGPSLocation();
      if (coords) {
        const geofences = await geofenceService.listGeofences();
        let insideFenceName: string | null = null;
        for (const fence of geofences) {
          const latDiff = Math.abs(coords.latitude - fence.latitude);
          const lonDiff = Math.abs(coords.longitude - fence.longitude);
          const approxRadiusDeg = Math.max(fence.radius / 111000, 0.001);
          if (latDiff <= approxRadiusDeg && lonDiff <= approxRadiusDeg) {
            insideFenceName = fence.identifier;
            break;
          }
        }

        if (insideFenceName) {
          setActiveLocationName(insideFenceName);
        } else if (coords.city && coords.region) {
          setActiveLocationName(`${coords.city}, ${coords.region}`);
        } else if (coords.city) {
          setActiveLocationName(coords.city);
        } else if (coords.region) {
          setActiveLocationName(coords.region);
        } else if (coords.address) {
          // Shorten long street addresses to first 2 segments (e.g. "Adetokunbo Ademola St • Victoria Island")
          const parts = coords.address.split(',').map((p) => p.trim()).filter(Boolean);
          const shortAddress = parts.slice(0, 2).join(' • ');
          setActiveLocationName(shortAddress || coords.address);
        } else {
          setActiveLocationName(`GPS (${coords.latitude.toFixed(2)}, ${coords.longitude.toFixed(2)})`);
        }
      }
    } catch (e) {
      // Background location fallback
    }
  }, []);

  // Periodic location updater every 45 seconds
  useEffect(() => {
    updateCurrentLocation();
    const interval = setInterval(updateCurrentLocation, 45000);
    return () => clearInterval(interval);
  }, [updateCurrentLocation]);

  // Sync Toast State (3-second popup feedback without icons)
  const [syncToastVisible, setSyncToastVisible] = useState(false);
  const [syncToastMessage, setSyncToastMessage] = useState('Argus synced on-device');
  const toastTimeoutRef = useRef<any>(null);

  const handleManualSync = async () => {
    triggerHaptic('selection');
    try {
      await Promise.all([
        geofenceService.syncGeofencesWithOS().catch(() => {}),
        useSettingsStore.getState().syncSystemPermissions().catch(() => {}),
        refreshHomeScreenData().catch(() => {}),
        updateCurrentLocation().catch(() => {}),
      ]);
      triggerHaptic('success');
      setSyncToastMessage('Argus synced on-device');
      setSyncToastVisible(true);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        setSyncToastVisible(false);
      }, 3000);
    } catch (e: any) {
      setSyncToastMessage('Argus synced on-device');
      setSyncToastVisible(true);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        setSyncToastVisible(false);
      }, 3000);
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
        onOpenDrawer={() => setDrawerVisible(true)}
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

      {/* 3. Multi-Level Omnibar Capsule Dock */}
      <Omnibar
        insetsBottom={insets.bottom}
        inputText={inputText}
        onChangeText={setInputText}
        onSend={() => handleSend()}
        isProcessing={isProcessing}
        routingMode={routingMode}
        onSelectRoutingMode={setRoutingMode}
        onOpenVoiceModal={async () => {
          try {
            const overlayShown = await ArgusSystemMonitors.triggerEllaOverlay();
            if (!overlayShown) {
              setVoiceModalVisible(true);
            }
          } catch {
            setVoiceModalVisible(true);
          }
        }}
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

      {/* 6. Navigation Drawer */}
      <NavigationDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        activeScreen="argus"
      />

      {/* 7. Non-intrusive 3-second Sync Toast Feedback (Pure Text) */}
      {syncToastVisible && (
        <View
          style={[
            styles.floatingToast,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              top: Math.max(insets.top, 16) + 48,
            },
          ]}
        >
          <Text style={[styles.floatingToastText, { color: colors.text, fontSize: scaleFont(12) }]}>
            {syncToastMessage}
          </Text>
        </View>
      )}
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
  floatingToast: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    zIndex: 999,
  },
  floatingToastText: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

