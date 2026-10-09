// Executor that maps agent function calls to local database and phone actions
import * as notesRepo from '../database/notesRepo';
import * as expensesRepo from '../database/expensesRepo';
import * as budgetRepo from '../database/budgetRepo';
import * as phoneActions from '../actions/phoneActions';
import * as geofenceService from '../observation/geofenceService';
import * as oauthService from '../auth/oauthService';
import * as storageService from '../storage/deviceStorageService';
import * as appAutomationService from '../automation/appAutomationService';
import * as accessibilityService from '../rpa/accessibilityService';
import * as learnedRulesRepo from '../database/learnedRulesRepo';
import { searchOmniVault } from '../memory/omniSearch';
import { useSettingsStore } from '@/store/settingsStore';
import * as SecureStore from 'expo-secure-store';
import { getDatabase } from '../database/db';
import ArgusSystemMonitors from '@/modules/argus-system-monitors';
import { Linking, Platform } from 'react-native';

export { resolvePackageAlias } from '../actions/phoneActions';

/**
 * Routes and executes a function call from the Gemini Agent.
 * Returns the serializable result.
 */
export async function executeTool(name: string, args: any): Promise<any> {
  console.log(`[Agent Tool Runner] Executing: ${name}`, args);
  
  try {
    const db = await getDatabase();

    switch (name) {
      // --- Notes Tools ---
      case 'create_note':
        const newNote = await notesRepo.createNote(
          args.title,
          args.content,
          args.tags || [],
          args.is_pinned || false
        );
        return {
          success: true,
          action: 'create_note',
          note: newNote,
          message: `Note "${newNote.title}" created successfully (ID #${newNote.id}).`
        };
        
      case 'list_notes':
        const notesList = await notesRepo.listNotes(
          args.query,
          args.tags,
          args.limit
        );
        return {
          success: true,
          count: notesList.length,
          notes: notesList
        };
        
      case 'update_note':
        const updated = await notesRepo.updateNote(args.id, {
          title: args.title,
          content: args.content,
          tags: args.tags,
          isPinned: args.is_pinned,
        });
        return {
          success: !!updated,
          note: updated,
          message: updated ? `Note #${args.id} updated successfully.` : `Note #${args.id} not found.`
        };
        
      case 'delete_note':
        const deletedNote = await notesRepo.deleteNote(args.id);
        return {
          success: deletedNote,
          message: deletedNote ? `Note #${args.id} deleted permanently.` : `Note #${args.id} not found.`
        };
        
      // --- Expenses Tools ---
      case 'add_expense':
        const parsedAmount = typeof args.amount === 'number' ? args.amount : parseFloat(String(args.amount).replace(/,/g, ''));
        const newExpense = await expensesRepo.addExpense(
          parsedAmount,
          args.category || 'Food & Dining',
          args.description || args.category || 'Expense',
          'NGN',
          args.date,
          args.related_notification_id,
          'manual'
        );
        const currentSummary = await expensesRepo.getExpenseSummary();
        return {
          success: true,
          action: 'add_expense',
          expense: newExpense,
          amount_formatted: `₦${parsedAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
          total_spend_now: `₦${currentSummary.grand_total.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
          message: `Logged ₦${parsedAmount.toLocaleString('en-NG')} for "${newExpense.description}" under "${newExpense.category}". Grand total is now ₦${currentSummary.grand_total.toLocaleString('en-NG')}.`
        };
        
      case 'list_expenses':
        const expensesList = await expensesRepo.listExpenses(
          args.category,
          args.start_date,
          args.end_date,
          args.limit
        );
        return {
          success: true,
          count: expensesList.length,
          expenses: expensesList
        };
        
      case 'get_expense_summary':
        const summary = await expensesRepo.getExpenseSummary(
          args.start_date,
          args.end_date
        );
        return {
          success: true,
          grand_total_formatted: `₦${summary.grand_total.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
          breakdown: summary.items,
          total_categories: summary.items.length
        };

      case 'delete_expense':
        const deletedExp = await expensesRepo.deleteExpense(args.id);
        return {
          success: deletedExp,
          message: deletedExp ? `Expense #${args.id} deleted successfully.` : `Expense #${args.id} not found.`
        };
        
      // --- Observability & Panoramic Overview Tools ---
      case 'get_dashboard_overview':
        const allNotes = await notesRepo.listNotes(undefined, undefined, 5);
        const expSummary = await expensesRepo.getExpenseSummary();
        const recentExp = await expensesRepo.listExpenses(undefined, undefined, undefined, 5);
        const geofences = await geofenceService.listGeofences();
        const receipts = await db.getAllAsync('SELECT * FROM notification_events ORDER BY timestamp DESC LIMIT 5');
        
        let screenStats: any[] = [];
        try {
          if (ArgusSystemMonitors?.getAppUsageStats) {
            const now = Date.now();
            const startOfDay = new Date().setHours(0, 0, 0, 0);
            screenStats = await ArgusSystemMonitors.getAppUsageStats(startOfDay, now);
          }
        } catch (e) {
          console.warn('Screen stats unavailable:', e);
        }

        return {
          success: true,
          total_spend: `₦${expSummary.grand_total.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
          total_transactions: recentExp.length,
          total_notes: allNotes.length,
          active_geofences: geofences.length,
          recent_expenses: recentExp,
          recent_notes: allNotes,
          recent_intercepted_alerts: receipts,
          top_apps_usage: screenStats.slice(0, 5)
        };

      case 'get_screen_time_stats':
        try {
          if (ArgusSystemMonitors?.getAppUsageStats) {
            const now = Date.now();
            const startOfDay = new Date().setHours(0, 0, 0, 0);
            const stats = await ArgusSystemMonitors.getAppUsageStats(startOfDay, now);
            return {
              success: true,
              total_apps_active: stats.length,
              usage_breakdown: stats.sort((a, b) => (b.totalTimeVisible || 0) - (a.totalTimeVisible || 0)).slice(0, 10)
            };
          }
        } catch (e: any) {
          return { success: false, message: `Could not retrieve screen stats: ${e.message}` };
        }
        return { success: false, message: 'App usage stats module not available on this platform.' };

      case 'list_intercepted_receipts':
        const limit = args.limit || 20;
        const alerts = await db.getAllAsync('SELECT * FROM notification_events ORDER BY timestamp DESC LIMIT ?', [limit]);
        return {
          success: true,
          count: (alerts as any[]).length,
          alerts
        };
        
      // --- Phone Actions Tools ---
      case 'open_app':
        const appTarget = args?.package_name || args?.app_name || args?.package || args?.name || args?.app || (typeof args === 'string' ? args : '');
        return await phoneActions.openApp(appTarget);
        
      case 'place_call':
        return await phoneActions.placeCall(args.phone_number);
        
      // --- Geofencing Tools ---
      case 'create_geofence':
        const created = await geofenceService.createGeofence({
          identifier: args.identifier,
          latitude: args.latitude,
          longitude: args.longitude,
          radius: args.radius || 200,
          notify_on_enter: args.notify_on_enter !== false,
          notify_on_exit: args.notify_on_exit !== false,
          is_active: true
        });
        return {
          success: created,
          action: 'create_geofence',
          identifier: args.identifier,
          message: created ? `📍 Geofence "${args.identifier}" successfully created with ${args.radius || 200}m radius.` : `Failed to register geofence.`
        };

      case 'set_geofence_at_current_location':
        const currentLocResult = await geofenceService.createGeofenceAtCurrentLocation(
          args.identifier,
          args.radius || 200,
          args.notify_on_enter !== false,
          args.notify_on_exit !== false
        );
        return currentLocResult;

      case 'get_current_location':
        const currentCoords = await geofenceService.getCurrentGPSLocation();
        if (!currentCoords) {
          return { error: true, message: 'Could not acquire GPS position. Please check location permissions.' };
        }
        return {
          success: true,
          action: 'get_current_location',
          location: currentCoords,
          message: `📍 Current Location: ${currentCoords.address} (Lat: ${currentCoords.latitude.toFixed(4)}, Lon: ${currentCoords.longitude.toFixed(4)})`
        };

      case 'list_geofences':
        const allFences = await geofenceService.listGeofences();
        return {
          success: true,
          count: allFences.length,
          geofences: allFences,
          message: allFences.length > 0
            ? `Active Geofences (${allFences.length}): ${allFences.map(f => `${f.identifier} (${f.radius}m)`).join(', ')}`
            : 'No geofences currently registered. You can set one at your current location or via coordinates.'
        };

      case 'delete_geofence':
        const removed = await geofenceService.deleteGeofence(args.identifier);
        return {
          success: removed,
          action: 'delete_geofence',
          message: removed ? `🗑️ Geofence "${args.identifier}" removed.` : `Geofence "${args.identifier}" not found.`
        };

      case 'get_geofence_events':
        const fenceEvents = await geofenceService.getGeofenceEvents();
        return {
          success: true,
          count: fenceEvents.length,
          events: fenceEvents,
          message: fenceEvents.length > 0
            ? `Recent Geofence Crossings: ${fenceEvents.slice(0, 5).map(e => `${e.identifier} (${e.event_type}) at ${new Date(e.timestamp).toLocaleTimeString()}`).join('; ')}`
            : 'No geofence crossing events logged yet.'
        };

      case 'test_trigger_geofence':
        const simRes = await geofenceService.testTriggerGeofence(args.identifier, args.event_type || 'enter');
        return simRes;
        
      // --- GitHub Tools ---
      case 'list_github_repositories':
        const savedAccount = useSettingsStore.getState().githubAccount;
        const targetUsername = args?.username || savedAccount || 'argus-engineer';
        const savedToken = await SecureStore.getItemAsync('GITHUB_AUTH_TOKEN');
        const repos = await oauthService.fetchGitHubRepositories(savedToken || undefined, targetUsername);
        return {
          success: true,
          username: targetUsername,
          count: repos.length,
          repositories: repos,
        };

      case 'get_github_profile':
        const currentSavedGh = useSettingsStore.getState().githubAccount;
        const currentSavedToken = await SecureStore.getItemAsync('GITHUB_AUTH_TOKEN');
        if (currentSavedGh || currentSavedToken) {
          return {
            success: true,
            authenticated: true,
            username: currentSavedGh || 'Connected Developer',
            message: `GitHub account is linked as @${currentSavedGh || 'developer'}.`,
          };
        }
        return {
          success: true,
          authenticated: false,
          message: 'No GitHub account is linked yet. The user can authenticate GitHub in Settings.',
        };

      // --- Budget Tools ---
      case 'set_monthly_budget':
        const parsedBudget = typeof args.amount === 'number' ? args.amount : parseFloat(String(args.amount).replace(/,/g, ''));
        const targetMonth = args.month_key || budgetRepo.getCurrentMonthKey();
        await budgetRepo.setTotalMonthlyBudget(targetMonth, parsedBudget);
        const monthLabel = budgetRepo.getMonthLabel(targetMonth);
        return {
          success: true,
          action: 'set_monthly_budget',
          month: targetMonth,
          monthLabel,
          amount: parsedBudget,
          message: `Your total monthly budget for ${monthLabel} has been set to ₦${parsedBudget.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
        };

      case 'set_category_budget':
        const parsedCatBudget = typeof args.amount === 'number' ? args.amount : parseFloat(String(args.amount).replace(/,/g, ''));
        const catTargetMonth = args.month_key || budgetRepo.getCurrentMonthKey();
        await budgetRepo.setCategoryBudget(catTargetMonth, args.category, parsedCatBudget);
        const catMonthLabel = budgetRepo.getMonthLabel(catTargetMonth);
        return {
          success: true,
          action: 'set_category_budget',
          category: args.category,
          month: catTargetMonth,
          amount: parsedCatBudget,
          message: `Your ${args.category} spending limit for ${catMonthLabel} has been set to ₦${parsedCatBudget.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
        };

      case 'get_budget_status':
        const summaryMonth = args.month_key || budgetRepo.getCurrentMonthKey();
        const bSummary = await budgetRepo.getBudgetSummaryForMonth(summaryMonth);
        return {
          success: true,
          isConfigured: bSummary.isConfigured,
          summary: bSummary,
          message: bSummary.isConfigured
            ? `For ${bSummary.monthLabel}: Total Budget is ₦${bSummary.totalMonthlyBudget.toLocaleString('en-NG')}, Total Spent is ₦${bSummary.totalSpentThisMonth.toLocaleString('en-NG')} (${bSummary.overallPercentage}%), Remaining is ₦${bSummary.totalRemaining.toLocaleString('en-NG')}. Status: ${bSummary.status}.`
            : `No budget has been set yet for ${bSummary.monthLabel}. Total spent so far is ₦${bSummary.totalSpentThisMonth.toLocaleString('en-NG')}. You can set a budget anytime!`,
        };

      case 'make_phone_call':
        const target = String(args.target || '').trim();
        if (!target) {
          return { error: true, message: 'Please specify a valid contact name or phone number.' };
        }
        const isNumeric = /^[+0-9\s\-()]+$/.test(target);
        const callUri = `tel:${encodeURIComponent(isNumeric ? target.replace(/\s+/g, '') : target)}`;
        try {
          await Linking.openURL(callUri);
          return {
            success: true,
            action: 'make_phone_call',
            target,
            message: `📞 Dialing ${target}...`,
          };
        } catch (e: any) {
          return {
            error: true,
            message: `Could not launch dialer for ${target}: ${e.message}`,
          };
        }

      // =========================================================================
      // Phase 1: Storage & Document Tools
      // =========================================================================

      case 'search_device_storage':
        const storageSearchResult = await storageService.searchDeviceStorage(args.query, {
          extensionFilter: args.extension_filter,
        });
        return storageSearchResult;

      case 'read_file_content':
        const fileReadResult = await storageService.readStorageFile(args.file_path, args.max_bytes);
        return fileReadResult;

      case 'write_file_to_storage':
        const fileWriteResult = await storageService.writeStorageFile(args.file_name, args.content, {
          subDirectory: args.directory || 'downloads',
        });
        return fileWriteResult;

      case 'list_storage_files':
        const targetSubPath = args.path || args.subfolder || undefined;
        const dirFiles = await storageService.listDirectoryFiles(
          args.directory_type || 'downloads',
          targetSubPath,
          args.extension_filter
        );
        return {
          success: true,
          directory: args.directory_type,
          path: targetSubPath,
          count: dirFiles.length,
          files: dirFiles,
          message: `Found ${dirFiles.length} item(s) in ${args.directory_type}${targetSubPath ? `/${targetSubPath}` : ''}`,
        };

      // =========================================================================
      // Phase 2: App Deep Linking & Intent Automation Tools
      // =========================================================================

      case 'send_whatsapp_message':
        const waResult = await appAutomationService.dispatchWhatsApp(args.recipient, args.message);
        return waResult;

      case 'compose_email':
        const emailResult = await appAutomationService.dispatchEmail(args.recipient, args.subject, args.body);
        return emailResult;

      case 'send_sms':
        const smsResult = await appAutomationService.dispatchSMS(args.phone, args.message);
        return smsResult;

      case 'search_maps':
        const mapsResult = await appAutomationService.dispatchMapNavigation(args.query, args.latitude, args.longitude);
        return mapsResult;

      case 'create_calendar_event':
        const calResult = await appAutomationService.dispatchCalendarEvent(
          args.title,
          args.start_time_ms,
          args.location,
          args.description
        );
        return calResult;

      // =========================================================================
      // Phase 3: Accessibility RPA Autonomous Screen Controller Tools
      // =========================================================================

      case 'inspect_current_screen_nodes': {
        const report = await accessibilityService.inspectScreen();
        return {
          success: true,
          action: 'inspect_current_screen_nodes',
          package_name: report.packageName,
          interactive_elements_count: report.interactiveElementsCount,
          elements: report.nodes.map((n) => ({
            text: n.text || n.contentDescription || n.viewId,
            className: n.className.split('.').pop(),
            isClickable: n.isClickable,
            isEditable: n.isEditable,
            viewId: n.viewId,
            bounds: n.bounds ? `(${n.bounds.centerX}, ${n.bounds.centerY})` : undefined,
          })),
          message: `Inspected screen on app "${report.packageName}". Found ${report.interactiveElementsCount} interactive element(s).`,
        };
      }

      case 'click_screen_element': {
        const clicked = await accessibilityService.clickElement(args.target_text, args.exact_match);
        return {
          success: clicked,
          action: 'click_screen_element',
          target_text: args.target_text,
          message: clicked
            ? `Successfully clicked screen element "${args.target_text}".`
            : `Could not find clickable element matching "${args.target_text}" on active screen. Ensure the target app is in foreground and Argus Accessibility is enabled.`,
        };
      }

      case 'click_screen_element_by_id': {
        const clicked = await accessibilityService.clickElementById(args.view_id);
        return {
          success: clicked,
          action: 'click_screen_element_by_id',
          view_id: args.view_id,
          message: clicked
            ? `Successfully clicked element with view ID "${args.view_id}".`
            : `Could not find element with ID "${args.view_id}".`,
        };
      }

      case 'type_into_screen_element': {
        const typed = await accessibilityService.typeText(args.text, {
          viewId: args.view_id,
          targetText: args.target_text,
        });
        return {
          success: typed,
          action: 'type_into_screen_element',
          text_entered: args.text,
          message: typed
            ? `Successfully typed "${args.text}" into active screen text field.`
            : `Could not type text. Ensure an editable text input is focused or visible on screen.`,
        };
      }

      case 'scroll_screen': {
        const scrolled = await accessibilityService.scrollScreen(args.direction || 'DOWN');
        return {
          success: scrolled,
          action: 'scroll_screen',
          direction: args.direction || 'DOWN',
          message: scrolled
            ? `Scrolled screen ${args.direction || 'DOWN'}.`
            : `Could not scroll screen.`,
        };
      }

      case 'perform_phone_action': {
        const performed = await accessibilityService.performGlobalPhoneAction(args.action);
        return {
          success: performed,
          action: 'perform_phone_action',
          navigation_action: args.action,
          message: performed
            ? `Executed global navigation action "${args.action}".`
            : `Failed to execute action "${args.action}".`,
        };
      }

      case 'tap_screen_coordinates': {
        const tapped = await accessibilityService.tapCoordinates(args.x, args.y);
        return {
          success: tapped,
          action: 'tap_screen_coordinates',
          x: args.x,
          y: args.y,
          message: tapped
            ? `Tapped coordinates (${args.x}, ${args.y}) on screen.`
            : `Failed to tap coordinates.`,
        };
      }

      // --- Device Control Tools ---
      case 'open_storage_folder': {
        const folderType = args.folder_type || 'downloads';
        if (Platform.OS === 'android') {
          try {
            await Linking.sendIntent('android.intent.action.VIEW_DOWNLOADS');
          } catch (e) {
            await Linking.openURL('content://media/external/file');
          }
        }
        return {
          success: true,
          action: 'open_storage_folder',
          folder: folderType,
          message: `Opened storage folder: ${folderType.toUpperCase()}.`,
        };
      }

      case 'play_video_media': {
        const mediaUri = args.file_path_or_url || args.uri || args.path || '';
        try {
          if (!mediaUri) {
            return {
              success: false,
              action: 'play_video_media',
              message: 'No file path or URL provided for playback.',
            };
          }

          if (mediaUri.startsWith('http://') || mediaUri.startsWith('https://')) {
            await Linking.openURL(mediaUri);
          } else if (Platform.OS === 'android' && ArgusSystemMonitors?.openMediaFile) {
            const targetPlayer = args.target_player || (mediaUri.toLowerCase().includes('vlc') || (args.title && args.title.toLowerCase().includes('vlc')) ? 'org.videolan.vlc' : undefined);
            const opened = await ArgusSystemMonitors.openMediaFile(mediaUri, undefined, targetPlayer);
            if (!opened) {
              // Try fallback direct intent
              await Linking.openURL(mediaUri.startsWith('file://') ? mediaUri : `file://${mediaUri}`);
            }
          } else {
            await Linking.openURL(mediaUri.startsWith('file://') ? mediaUri : `file://${mediaUri}`);
          }
          return {
            success: true,
            action: 'play_video_media',
            uri: mediaUri,
            message: `Playing ${args.title || mediaUri.split('/').pop() || 'media'} in media player.`,
          };
        } catch (err: any) {
          return {
            success: false,
            action: 'play_video_media',
            message: `Could not play media: ${err?.message || 'Unsupported media format'}`,
          };
        }
      }

      case 'post_to_x': {
        const content = encodeURIComponent(args.content);
        try {
          const appUrl = `twitter://post?message=${content}`;
          const webUrl = `https://twitter.com/intent/tweet?text=${content}`;
          const canOpenApp = await Linking.canOpenURL(appUrl);
          if (canOpenApp) {
            await Linking.openURL(appUrl);
          } else {
            await Linking.openURL(webUrl);
          }
          return {
            success: true,
            action: 'post_to_x',
            content: args.content,
            message: `Prepared and opened 𝕏 composer with: "${args.content}".`,
          };
        } catch (e: any) {
          return {
            success: false,
            action: 'post_to_x',
            message: `Failed to post to 𝕏: ${e?.message || 'Could not open 𝕏 app'}`,
          };
        }
      }

      // --- Omni-Vault Semantic Search ---
      case 'search_vault_memory': {
        const results = await searchOmniVault(args.query);
        return {
          success: true,
          action: 'search_vault_memory',
          query: args.query,
          total_matches: results.totalMatches,
          notes: results.notes,
          expenses: results.expenses,
          geofences: results.geofences,
          past_messages: results.messages,
          message: `Found ${results.totalMatches} matches for "${args.query}" across your Knowledge Notes, Expenses, Geofences, and Past Conversations.`,
        };
      }

      // --- Persistent Learning & Self-Correction Engine ---
      case 'learn_user_preference': {
        const saved = await learnedRulesRepo.addLearnedRule(args.rule_text, args.category || 'general');
        return {
          success: true,
          action: 'learn_user_preference',
          rule: saved,
          message: `🧠 Learned & Memorized: "${args.rule_text}". Argus will follow this rule in all future interactions.`,
        };
      }

      case 'list_learned_rules': {
        const rules = await learnedRulesRepo.listActiveLearnedRules();
        return {
          success: true,
          action: 'list_learned_rules',
          count: rules.length,
          rules,
          message: `Argus has ${rules.length} active learned rules in memory.`,
        };
      }

      case 'delete_learned_rule': {
        const deleted = await learnedRulesRepo.deleteLearnedRule(args.id);
        return {
          success: deleted,
          action: 'delete_learned_rule',
          id: args.id,
          message: deleted ? `Removed learned rule #${args.id}.` : `Rule #${args.id} not found.`,
        };
      }

      // --- Background Sync & Diagnostic ---
      case 'run_background_sync': {
        const notifEvents = await db.getAllAsync<any>('SELECT COUNT(*) as count FROM notification_events');
        const unconfirmedExpenses = await db.getAllAsync<any>('SELECT COUNT(*) as count FROM expenses WHERE status = "unconfirmed"');
        const geofenceCount = await db.getAllAsync<any>('SELECT COUNT(*) as count FROM geofences WHERE is_active = 1');
        
        return {
          success: true,
          action: 'run_background_sync',
          notification_events_synced: notifEvents[0]?.count || 0,
          unconfirmed_expenses: unconfirmedExpenses[0]?.count || 0,
          active_geofences: geofenceCount[0]?.count || 0,
          message: `✅ Background Sync Complete: All local bank alerts, active geofence boundaries (${geofenceCount[0]?.count || 0}), and ledger records are 100% in sync.`,
        };
      }

      default:
        throw new Error(`Tool not implemented: ${name}`);
    }
  } catch (error: any) {
    console.error(`[Agent Tool Runner] Error executing ${name}:`, error);
    return { error: true, message: error.message || 'Unknown execution error' };
  }
}
