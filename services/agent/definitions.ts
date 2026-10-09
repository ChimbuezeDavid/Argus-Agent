// Definition of tools exposed to the Gemini Agent
// We use JSON-serializable structures compatible with @google/generative-ai.

export const AGENT_TOOLS = [
  {
    name: 'create_note',
    description: 'Creates a new personal note or draft. Returns the created note.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: {
          type: 'STRING',
          description: 'The title of the note'
        },
        content: {
          type: 'STRING',
          description: 'The main text body content of the note'
        },
        tags: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'Optional tags to categorize the note'
        },
        is_pinned: {
          type: 'BOOLEAN',
          description: 'Optional flag to pin the note to the top'
        }
      },
      required: ['title', 'content']
    }
  },
  {
    name: 'list_notes',
    description: 'Searches and retrieves a list of notes. Sorts pinned notes first, then by last updated.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Optional search keyword to match against title or content'
        },
        tags: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'Optional list of tags the note must contain'
        },
        limit: {
          type: 'INTEGER',
          description: 'Maximum number of notes to return (default 20, max 100)'
        }
      }
    }
  },
  {
    name: 'update_note',
    description: 'Updates an existing note by ID. Provide only the fields that need modification. Returns updated note.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'INTEGER',
          description: 'The ID of the note to update'
        },
        title: {
          type: 'STRING',
          description: 'New title for the note'
        },
        content: {
          type: 'STRING',
          description: 'New content body'
        },
        tags: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'New tags array (overwrites existing tags)'
        },
        is_pinned: {
          type: 'BOOLEAN',
          description: 'Set pin status'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'delete_note',
    description: 'Deletes a note permanently from the database. Returns confirmation status.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'INTEGER',
          description: 'The ID of the note to delete'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'add_expense',
    description: 'Records a new financial expense. Returns the created expense record.',
    parameters: {
      type: 'OBJECT',
      properties: {
        amount: {
          type: 'NUMBER',
          description: 'The amount of money spent'
        },
        category: {
          type: 'STRING',
          description: 'The category of the expense (e.g. food, transport, housing, shopping, entertainment, other)'
        },
        description: {
          type: 'STRING',
          description: 'Description of what was bought or paid for'
        },
        currency: {
          type: 'STRING',
          description: 'The 3-letter currency code (default: NGN)'
        },
        date: {
          type: 'STRING',
          description: 'ISO 8601 date string when the expense occurred (defaults to current time)'
        },
        related_notification_id: {
          type: 'INTEGER',
          description: 'Optional ID of the push notification from which this expense was extracted'
        }
      },
      required: ['amount', 'category']
    }
  },
  {
    name: 'list_expenses',
    description: 'Retrieves history of recorded expenses, optionally filtered by category or date range.',
    parameters: {
      type: 'OBJECT',
      properties: {
        category: {
          type: 'STRING',
          description: 'Filter by expense category'
        },
        start_date: {
          type: 'STRING',
          description: 'Filter expenses starting on this date (ISO 8601 string or YYYY-MM-DD)'
        },
        end_date: {
          type: 'STRING',
          description: 'Filter expenses ending on this date (ISO 8601 string or YYYY-MM-DD)'
        },
        limit: {
          type: 'INTEGER',
          description: 'Maximum number of items to return (default 50)'
        }
      }
    }
  },
  {
    name: 'get_expense_summary',
    description: 'Retrieves an aggregated summary of expenses grouped by category, and shows total spend.',
    parameters: {
      type: 'OBJECT',
      properties: {
        start_date: {
          type: 'STRING',
          description: 'Starting date for the summary range (ISO 8601 string or YYYY-MM-DD)'
        },
        end_date: {
          type: 'STRING',
          description: 'Ending date for the summary range (ISO 8601 string or YYYY-MM-DD)'
        }
      }
    }
  },
  {
    name: 'open_app',
    description: 'Launches an installed application on the user\'s phone by package name.',
    parameters: {
      type: 'OBJECT',
      properties: {
        package_name: {
          type: 'STRING',
          description: 'The Android package name of the app (e.g. "com.android.chrome", "com.google.android.youtube", "com.whatsapp")'
        }
      },
      required: ['package_name']
    }
  },
  // --- Plans & Schedule Tools ---
  {
    name: 'create_plan',
    description: 'Creates a new plan, task, or daily schedule/routine in the SQLite database.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: {
          type: 'STRING',
          description: 'The title or objective of the plan or task (e.g. "Review quarterly budget", "Morning workout routine")'
        },
        description: {
          type: 'STRING',
          description: 'Optional detailed description or steps of the plan'
        },
        due_date: {
          type: 'STRING',
          description: 'Optional due date in YYYY-MM-DD format (e.g. "2026-10-10")'
        },
        due_time: {
          type: 'STRING',
          description: 'Optional due time (e.g. "09:00 AM", "14:30")'
        },
        priority: {
          type: 'STRING',
          description: 'Priority level: "urgent", "high", "normal", or "low". Defaults to "normal".'
        },
        category: {
          type: 'STRING',
          description: 'Category tag (e.g. "task", "work", "fitness", "finance", "routine")'
        },
        plan_type: {
          type: 'STRING',
          description: 'Type of plan: "task" for standalone tasks or "schedule" for multi-day routines'
        },
        days_duration: {
          type: 'NUMBER',
          description: 'Duration in days (1 to 7) for schedule routines'
        }
      },
      required: ['title']
    }
  },
  {
    name: 'list_plans',
    description: 'Lists all stored plans, tasks, and routines from the local database with optional status filtering.',
    parameters: {
      type: 'OBJECT',
      properties: {
        status: {
          type: 'STRING',
          description: 'Optional status filter: "pending" or "completed". If omitted, returns all plans.'
        }
      }
    }
  },
  {
    name: 'update_plan',
    description: 'Updates properties of an existing plan or task in the database.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'NUMBER',
          description: 'The numeric ID of the plan to update'
        },
        title: {
          type: 'STRING',
          description: 'Optional new title'
        },
        description: {
          type: 'STRING',
          description: 'Optional updated description'
        },
        due_date: {
          type: 'STRING',
          description: 'Optional updated due date (YYYY-MM-DD)'
        },
        due_time: {
          type: 'STRING',
          description: 'Optional updated due time'
        },
        priority: {
          type: 'STRING',
          description: 'Optional updated priority ("urgent", "high", "normal", "low")'
        },
        status: {
          type: 'STRING',
          description: 'Optional updated status ("pending", "completed")'
        },
        category: {
          type: 'STRING',
          description: 'Optional updated category'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'toggle_plan_status',
    description: 'Toggles a plan or task status between pending and completed.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'NUMBER',
          description: 'The numeric ID of the plan to toggle'
        },
        current_status: {
          type: 'STRING',
          description: 'The current status ("pending" or "completed"). If unsure, pass "pending".'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'delete_plan',
    description: 'Permanently deletes a plan or task by its numeric ID.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'NUMBER',
          description: 'The numeric ID of the plan to delete'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'create_geofence',
    description: 'Registers a circular geofence boundary with Android background monitoring. Trigger event logging upon crossing.',
    parameters: {
      type: 'OBJECT',
      properties: {
        identifier: {
          type: 'STRING',
          description: 'Unique name/label for the geofence location (e.g. "Home", "Office", "Supermarket")'
        },
        latitude: {
          type: 'NUMBER',
          description: 'Latitude coordinates'
        },
        longitude: {
          type: 'NUMBER',
          description: 'Longitude coordinates'
        },
        radius: {
          type: 'NUMBER',
          description: 'Radius in meters (default is 100 meters)'
        },
        notify_on_enter: {
          type: 'BOOLEAN',
          description: 'Trigger logs when user enters the geofence (default true)'
        },
        notify_on_exit: {
          type: 'BOOLEAN',
          description: 'Trigger logs when user exits the geofence (default true)'
        }
      },
      required: ['identifier', 'latitude', 'longitude', 'radius']
    }
  },
  {
    name: 'list_geofences',
    description: 'Lists all currently active geofences set on the device.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'delete_expense',
    description: 'Deletes an expense entry by its ID. Returns confirmation status.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'INTEGER',
          description: 'The unique ID of the expense to delete'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'get_dashboard_overview',
    description: 'Retrieves a complete panoramic overview across all screens: total expenses in ₦, recent notes, intercepted bank receipts, screen time, and active geofences.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'get_screen_time_stats',
    description: 'Retrieves today\'s app usage statistics and screen time breakdown across installed apps.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'list_intercepted_receipts',
    description: 'Retrieves recent push notifications and financial alerts intercepted from Nigerian banks and apps.',
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: {
          type: 'INTEGER',
          description: 'Maximum number of alerts to return (default 20)'
        }
      }
    }
  },
  {
    name: 'delete_geofence',
    description: 'Removes a geofence by its unique name/identifier or database ID.',
    parameters: {
      type: 'OBJECT',
      properties: {
        identifier: {
          type: 'STRING',
          description: 'The unique name or ID of the geofence to delete'
        }
      },
      required: ['identifier']
    }
  },
  {
    name: 'set_geofence_at_current_location',
    description: 'Captures the user\'s live GPS coordinates on their phone and creates a geofence boundary around it.',
    parameters: {
      type: 'OBJECT',
      properties: {
        identifier: {
          type: 'STRING',
          description: 'Unique name/label for the current location (e.g. "Home", "Office", "Gym", "Lekki Market")'
        },
        radius: {
          type: 'NUMBER',
          description: 'Radius boundary in meters (default 200 meters)'
        },
        notify_on_enter: {
          type: 'BOOLEAN',
          description: 'Notify when entering boundary (default true)'
        },
        notify_on_exit: {
          type: 'BOOLEAN',
          description: 'Notify when exiting boundary (default true)'
        }
      },
      required: ['identifier']
    }
  },
  {
    name: 'get_current_location',
    description: 'Retrieves the user\'s live GPS coordinates, reverse-geocoded street address, city, and state on their Android device.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'get_geofence_events',
    description: 'Retrieves chronological entry and exit history logs across all configured geofences.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'test_trigger_geofence',
    description: 'Simulates/manually triggers an enter or exit event for a geofence to test background boundary automation.',
    parameters: {
      type: 'OBJECT',
      properties: {
        identifier: {
          type: 'STRING',
          description: 'The name or ID of the geofence to test'
        },
        event_type: {
          type: 'STRING',
          description: 'Event type to trigger: "enter" or "exit"'
        }
      },
      required: ['identifier', 'event_type']
    }
  },

  {
    name: 'list_github_repositories',
    description: 'Retrieves active GitHub code repositories, stars, forks, and languages for the user or a target organization.',
    parameters: {
      type: 'OBJECT',
      properties: {
        username: {
          type: 'STRING',
          description: 'Optional GitHub username to fetch repositories for'
        }
      }
    }
  },
  {
    name: 'get_github_profile',
    description: 'Retrieves authenticated or public GitHub profile details including bio, public repos, and follower count.',
    parameters: {
      type: 'OBJECT',
      properties: {
        username: {
          type: 'STRING',
          description: 'Optional GitHub username to query'
        }
      }
    }
  },
  {
    name: 'set_monthly_budget',
    description: 'Sets the total monthly financial budget limit in Naira for the user for the current or specified month.',
    parameters: {
      type: 'OBJECT',
      properties: {
        amount: {
          type: 'NUMBER',
          description: 'The total monthly budget limit amount in Naira (e.g. 250000)'
        },
        month_key: {
          type: 'STRING',
          description: 'Optional month identifier formatted as YYYY-MM (e.g. "2026-08"). Defaults to current month.'
        }
      },
      required: ['amount']
    }
  },
  {
    name: 'set_category_budget',
    description: 'Sets a specific spending limit for an expense category for the current or specified month.',
    parameters: {
      type: 'OBJECT',
      properties: {
        category: {
          type: 'STRING',
          description: 'The category to set limit for (e.g. "Food & Dining", "Transport / Fuel", "Airtime & Data", "Utilities & Bills", "Shopping", "Housing & Rent", "Entertainment")'
        },
        amount: {
          type: 'NUMBER',
          description: 'The category limit amount in Naira (e.g. 60000)'
        },
        month_key: {
          type: 'STRING',
          description: 'Optional month identifier formatted as YYYY-MM (e.g. "2026-08"). Defaults to current month.'
        }
      },
      required: ['category', 'amount']
    }
  },
  {
    name: 'get_budget_status',
    description: 'Retrieves the real-time budget utilization, total limit, total spent, remaining balance, and category breakdown for the month.',
    parameters: {
      type: 'OBJECT',
      properties: {
        month_key: {
          type: 'STRING',
          description: 'Optional month key formatted as YYYY-MM. Defaults to current month.'
        }
      }
    }
  },
  {
    name: 'make_phone_call',
    description: 'Initiates a phone call or opens the device phone dialer for a specified contact or phone number.',
    parameters: {
      type: 'OBJECT',
      properties: {
        target: {
          type: 'STRING',
          description: 'The phone number or contact name to call (e.g. "08012345678", "Momcy", "John")'
        }
      },
      required: ['target']
    }
  },
  // Phase 1: Storage & Document Tools
  {
    name: 'search_device_storage',
    description: 'Searches device storage (Downloads, Documents, etc.) for files matching a keyword query or extension (e.g. receipts, pdf, csv, statement).',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'The keyword to search for in file names (e.g. "receipt", "invoice", "statement", "budget")'
        },
        extension_filter: {
          type: 'STRING',
          description: 'Optional file extension filter without dot (e.g. "pdf", "csv", "txt", "png")'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'read_file_content',
    description: 'Reads the text content of a file located on phone storage (txt, csv, md, json, log files).',
    parameters: {
      type: 'OBJECT',
      properties: {
        file_path: {
          type: 'STRING',
          description: 'The absolute path to the file on device storage (e.g. "/storage/emulated/0/Download/statement.csv")'
        },
        max_bytes: {
          type: 'INTEGER',
          description: 'Optional max character/byte limit to read (default: 50000)'
        }
      },
      required: ['file_path']
    }
  },
  {
    name: 'write_file_to_storage',
    description: 'Creates or saves a text, markdown, or CSV document directly to the phone storage (defaults to Downloads directory).',
    parameters: {
      type: 'OBJECT',
      properties: {
        file_name: {
          type: 'STRING',
          description: 'The name of the file to save (e.g. "financial_report_2026.csv", "meeting_notes.md")'
        },
        content: {
          type: 'STRING',
          description: 'The full text, markdown, or CSV string content to write'
        },
        directory: {
          type: 'STRING',
          description: 'Optional target sub-directory: "downloads", "documents", or "root" (default: "downloads")'
        }
      },
      required: ['file_name', 'content']
    }
  },
  {
    name: 'list_storage_files',
    description: 'Lists files and folders in standard device storage directories (Downloads, Documents, DCIM, Pictures), or specific nested subfolders.',
    parameters: {
      type: 'OBJECT',
      properties: {
        directory_type: {
          type: 'STRING',
          description: 'The directory to inspect: "downloads", "documents", "dcim", or "pictures"'
        },
        path: {
          type: 'STRING',
          description: 'Optional subfolder path or relative directory path to list (e.g. "Invoices", "receipts/2026")'
        },
        extension_filter: {
          type: 'STRING',
          description: 'Optional extension to filter by (e.g. "pdf", "jpg", "csv")'
        }
      },
      required: ['directory_type']
    }
  },
  // Phase 2: App Deep Linking & Intent Automation Tools
  {
    name: 'send_whatsapp_message',
    description: 'Dispatches an automated message via WhatsApp. Pre-fills the recipient and message and launches WhatsApp.',
    parameters: {
      type: 'OBJECT',
      properties: {
        recipient: {
          type: 'STRING',
          description: 'Optional phone number with country code (e.g. "+2348012345678") or contact name (e.g. "Momcy")'
        },
        message: {
          type: 'STRING',
          description: 'The message body text to send'
        }
      },
      required: ['message']
    }
  },
  {
    name: 'compose_email',
    description: 'Opens the device email client (Gmail) with pre-filled recipient, subject line, and body content.',
    parameters: {
      type: 'OBJECT',
      properties: {
        recipient: {
          type: 'STRING',
          description: 'Email address of the recipient (e.g. "finance@company.com")'
        },
        subject: {
          type: 'STRING',
          description: 'Subject line of the email'
        },
        body: {
          type: 'STRING',
          description: 'Body text content of the email'
        }
      },
      required: ['subject', 'body']
    }
  },
  {
    name: 'send_sms',
    description: 'Opens SMS messenger with a pre-filled recipient number and message text.',
    parameters: {
      type: 'OBJECT',
      properties: {
        phone: {
          type: 'STRING',
          description: 'Recipient phone number (e.g. "08012345678")'
        },
        message: {
          type: 'STRING',
          description: 'SMS message text'
        }
      },
      required: ['phone', 'message']
    }
  },
  {
    name: 'search_maps',
    description: 'Launches Google Maps with navigation to a destination or coordinates.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Address, business name, or landmark to search on maps (e.g. "Eko Hotel Lagos", "gas station near me")'
        },
        latitude: {
          type: 'NUMBER',
          description: 'Optional target latitude'
        },
        longitude: {
          type: 'NUMBER',
          description: 'Optional target longitude'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'create_calendar_event',
    description: 'Launches device Calendar to schedule an event or meeting with title, time, location, and description.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: {
          type: 'STRING',
          description: 'Title of the event or meeting'
        },
        start_time_ms: {
          type: 'NUMBER',
          description: 'Optional epoch timestamp in milliseconds for event start'
        },
        location: {
          type: 'STRING',
          description: 'Optional event location or venue'
        },
        description: {
          type: 'STRING',
          description: 'Optional notes or description for the event'
        }
      },
      required: ['title']
    }
  },
  {
    name: 'inspect_current_screen_nodes',
    description: 'Autonomous RPA: Inspects the UI node tree, buttons, text fields, and interactive elements currently visible on the active phone screen.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'click_screen_element',
    description: 'Autonomous RPA: Clicks a button, tab, link, or view on the foreground screen matching the specified label or text.',
    parameters: {
      type: 'OBJECT',
      properties: {
        target_text: {
          type: 'STRING',
          description: 'The visible label, button text, or content description to click (e.g. "Send", "Transfer", "Confirm", "Search", "Order")'
        },
        exact_match: {
          type: 'BOOLEAN',
          description: 'If true, requires exact case-insensitive match instead of partial substring match'
        }
      },
      required: ['target_text']
    }
  },
  {
    name: 'click_screen_element_by_id',
    description: 'Autonomous RPA: Clicks an on-screen element matching an Android view resource ID (e.g. "com.whatsapp:id/send_button").',
    parameters: {
      type: 'OBJECT',
      properties: {
        view_id: {
          type: 'STRING',
          description: 'The resource ID name of the view to click'
        }
      },
      required: ['view_id']
    }
  },
  {
    name: 'type_into_screen_element',
    description: 'Autonomous RPA: Types text into an editable input box on the active foreground screen.',
    parameters: {
      type: 'OBJECT',
      properties: {
        text: {
          type: 'STRING',
          description: 'The text to type into the input field'
        },
        view_id: {
          type: 'STRING',
          description: 'Optional target input view ID'
        },
        target_text: {
          type: 'STRING',
          description: 'Optional placeholder or label of the target text box'
        }
      },
      required: ['text']
    }
  },
  {
    name: 'scroll_screen',
    description: 'Autonomous RPA: Scrolls the active foreground screen up or down.',
    parameters: {
      type: 'OBJECT',
      properties: {
        direction: {
          type: 'STRING',
          description: 'Scroll direction: "UP" or "DOWN" (default is "DOWN")'
        }
      }
    }
  },
  {
    name: 'perform_phone_action',
    description: 'Autonomous RPA: Executes global navigation on the phone (HOME, BACK, RECENTS, NOTIFICATIONS, QUICK_SETTINGS, LOCK_SCREEN).',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: {
          type: 'STRING',
          description: 'The global navigation action: "HOME", "BACK", "RECENTS", "NOTIFICATIONS", "QUICK_SETTINGS", or "LOCK_SCREEN"'
        }
      },
      required: ['action']
    }
  },
  {
    name: 'tap_screen_coordinates',
    description: 'Autonomous RPA: Injects a touch gesture tap at exact pixel coordinates (x, y) on the phone screen.',
    parameters: {
      type: 'OBJECT',
      properties: {
        x: {
          type: 'NUMBER',
          description: 'X coordinate in screen pixels'
        },
        y: {
          type: 'NUMBER',
          description: 'Y coordinate in screen pixels'
        }
      },
      required: ['x', 'y']
    }
  },
  {
    name: 'open_storage_folder',
    description: 'Opens a specific folder on the phone storage in the native file manager (downloads, documents, movies, pictures, or custom path).',
    parameters: {
      type: 'OBJECT',
      properties: {
        folder_type: {
          type: 'STRING',
          description: 'Folder type: "downloads", "documents", "movies", "pictures", "dcim", or "music"'
        },
        custom_path: {
          type: 'STRING',
          description: 'Optional direct storage path'
        }
      }
    }
  },
  {
    name: 'play_video_media',
    description: 'Starts video or media playback on device using the default Android media player.',
    parameters: {
      type: 'OBJECT',
      properties: {
        file_path_or_url: {
          type: 'STRING',
          description: 'File URI (e.g. file:///storage/...) or online media URL to play'
        },
        title: {
          type: 'STRING',
          description: 'Optional video title'
        }
      },
      required: ['file_path_or_url']
    }
  },
  {
    name: 'post_to_x',
    description: 'Composes and posts a tweet/update to 𝕏 (Twitter) using the connected account or Android Twitter deep-link.',
    parameters: {
      type: 'OBJECT',
      properties: {
        content: {
          type: 'STRING',
          description: 'The text content of the post / tweet'
        }
      },
      required: ['content']
    }
  },
  {
    name: 'search_vault_memory',
    description: 'Full-text semantic search across all Notes, Expenses, Geofences, and Past Conversations. Use when asked to find past info.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'The search query or keyword'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'learn_user_preference',
    description: 'Saves a persistent rule, correction, or preference learned from user feedback so Argus follows it in all future turns.',
    parameters: {
      type: 'OBJECT',
      properties: {
        rule_text: {
          type: 'STRING',
          description: 'The exact directive or correction the user specified'
        },
        category: {
          type: 'STRING',
          description: 'Category for the rule (e.g. formatting, personality, actions, expenses)'
        }
      },
      required: ['rule_text']
    }
  },
  {
    name: 'list_learned_rules',
    description: 'Lists all persistent rules and preferences Argus has learned from user feedback.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'delete_learned_rule',
    description: 'Deletes a learned rule by its ID.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'INTEGER',
          description: 'The ID of the rule to delete'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'run_background_sync',
    description: 'Runs a background synchronization and diagnostic scan for intercepted bank alerts, pending geofence triggers, and system logs.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  }
];
