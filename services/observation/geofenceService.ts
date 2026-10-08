// Geofencing background observer using expo-location and expo-task-manager
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as SQLite from 'expo-sqlite';
import { getDatabase } from '../database/db';

export const GEOFENCE_TASK_NAME = 'GEOFENCE_TASK';

export interface GeofenceRule {
  id?: number;
  identifier: string;
  latitude: number;
  longitude: number;
  radius: number;
  notify_on_enter: boolean;
  notify_on_exit: boolean;
  enter_habit?: string | null;
  exit_habit?: string | null;
  is_active: boolean;
}

export interface GeofenceEventLog {
  id: number;
  geofence_id: number;
  event_type: 'enter' | 'exit';
  timestamp: string;
  identifier: string; // From joined table
}

export interface CurrentLocationInfo {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  altitude?: number | null;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  postalCode?: string;
}

export interface GeofencePermissionStatus {
  foregroundGranted: boolean;
  backgroundGranted: boolean;
  canMonitor: boolean;
}

/**
 * Defines the background task that Android triggers when location boundaries are crossed.
 * This runs in a separate context when the app is suspended.
 */
TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error(`[Geofence TaskManager] Task error: ${error.message}`);
    return;
  }
  
  if (data) {
    const { eventType, region } = data;
    const geofenceIdentifier = region.identifier;
    const typeStr = eventType === Location.GeofencingEventType.Enter ? 'enter' : 'exit';
    
    console.log(`[Geofence TaskManager] Crossed boundary: ${typeStr} for geofence: ${geofenceIdentifier}`);
    
    try {
      // Direct open connection since getDatabase might not be initialized in background task context
      const db = await SQLite.openDatabaseAsync('argus.db');
      
      // Find internal database ID for this identifier
      const row = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM geofences WHERE identifier = ?',
        geofenceIdentifier
      );
      
      if (row) {
        // Insert event record
        await db.runAsync(
          'INSERT INTO geofence_events (geofence_id, event_type, timestamp) VALUES (?, ?, CURRENT_TIMESTAMP)',
          row.id,
          typeStr
        );
        console.log(`[Geofence TaskManager] Successfully logged geofence event in DB for ID: ${row.id}`);
      } else {
        console.warn(`[Geofence TaskManager] Received trigger for unknown geofence ID: ${geofenceIdentifier}`);
      }
    } catch (dbError) {
      console.error('[Geofence TaskManager] SQLite execution failed:', dbError);
    }
  }
});

/**
 * Checks current location permission state.
 */
export async function checkGeofencePermissions(): Promise<GeofencePermissionStatus> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    const bg = await Location.getBackgroundPermissionsAsync();
    return {
      foregroundGranted: fg.granted,
      backgroundGranted: bg.granted,
      canMonitor: fg.granted && bg.granted,
    };
  } catch (e) {
    return {
      foregroundGranted: false,
      backgroundGranted: false,
      canMonitor: false,
    };
  }
}

/**
 * Requests necessary location permissions from the user.
 */
export async function requestGeofencePermissions(requestBackground: boolean = false): Promise<GeofencePermissionStatus> {
  try {
    let fg = await Location.getForegroundPermissionsAsync();
    if (!fg.granted) {
      fg = await Location.requestForegroundPermissionsAsync();
    }

    let bgGranted = false;
    if (fg.granted && requestBackground) {
      let bg = await Location.getBackgroundPermissionsAsync();
      if (!bg.granted) {
        bg = await Location.requestBackgroundPermissionsAsync();
      }
      bgGranted = bg.granted;
    } else if (fg.granted) {
      const bgCheck = await Location.getBackgroundPermissionsAsync().catch(() => ({ granted: false }));
      bgGranted = bgCheck.granted;
    }

    return {
      foregroundGranted: fg.granted,
      backgroundGranted: bgGranted,
      canMonitor: fg.granted && bgGranted,
    };
  } catch (e) {
    console.error('[Geofence Service] Permission request failed:', e);
    return {
      foregroundGranted: false,
      backgroundGranted: false,
      canMonitor: false,
    };
  }
}

/**
 * Retrieves the device's live GPS coordinates and reverses geocode into human readable address.
 * Never triggers permission dialogs spontaneously; returns null if not permitted.
 */
export async function getCurrentGPSLocation(): Promise<CurrentLocationInfo | null> {
  try {
    const perm = await checkGeofencePermissions();
    if (!perm.foregroundGranted) {
      return null;
    }

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    let address = '';
    let city = '';
    let region = '';
    let country = '';
    let postalCode = '';

    try {
      const rev = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });

      if (rev && rev.length > 0) {
        const place = rev[0];
        city = place.city || place.subregion || '';
        region = place.region || '';
        country = place.country || '';
        postalCode = place.postalCode || '';
        
        const street = place.street || place.name || '';
        address = [street, city, region, country].filter(Boolean).join(', ');
      }
    } catch (revErr) {
      console.warn('[Geofence Service] Reverse geocode fallback:', revErr);
    }

    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      altitude: pos.coords.altitude,
      address: address || `Lat: ${pos.coords.latitude.toFixed(4)}, Lon: ${pos.coords.longitude.toFixed(4)}`,
      city,
      region,
      country,
      postalCode,
    };
  } catch (e) {
    console.error('[Geofence Service] Failed to get GPS position:', e);
    return null;
  }
}

/**
 * Syncs the active geofences in the SQLite database with the Android OS background location service.
 */
export async function syncGeofencesWithOS(): Promise<void> {
  try {
    const db = await getDatabase();
    
    // Check permission
    const backgroundPermission = await Location.getBackgroundPermissionsAsync();
    if (!backgroundPermission.granted) {
      console.log('[Geofence Service] Cannot sync geofences: Background location permission not granted.');
      // Stop tracking if active
      const isRunning = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
      if (isRunning) {
        await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
      }
      return;
    }

    // Load active geofences from DB
    const activeGeofences = await db.getAllAsync<any>(
      'SELECT * FROM geofences WHERE is_active = 1'
    );

    if (activeGeofences.length === 0) {
      // Stop monitoring if no geofences
      const isRunning = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
      if (isRunning) {
        await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
      }
      console.log('[Geofence Service] No active geofences. Monitoring stopped.');
      return;
    }

    // Map to Expo Location regions
    const regions: Location.LocationRegion[] = activeGeofences.map(gf => ({
      identifier: gf.identifier,
      latitude: gf.latitude,
      longitude: gf.longitude,
      radius: gf.radius,
      notifyOnEnter: gf.notify_on_enter === 1,
      notifyOnExit: gf.notify_on_exit === 1,
    }));

    // Start background tracking
    await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, regions);
    console.log(`[Geofence Service] Successfully synced ${regions.length} geofences with background location monitor.`);
  } catch (error) {
    console.error('[Geofence Service] Failed to sync geofences:', error);
  }
}

/**
 * Creates and registers a new geofence.
 */
export async function createGeofence(gf: GeofenceRule): Promise<boolean> {
  const db = await getDatabase();
  try {
    await db.runAsync(
      `INSERT OR REPLACE INTO geofences (identifier, latitude, longitude, radius, notify_on_enter, notify_on_exit, enter_habit, exit_habit, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      gf.identifier.trim(),
      gf.latitude,
      gf.longitude,
      gf.radius || 200,
      gf.notify_on_enter !== false ? 1 : 0,
      gf.notify_on_exit !== false ? 1 : 0,
      gf.enter_habit?.trim() || null,
      gf.exit_habit?.trim() || null
    );
    
    // Resync location listeners
    await syncGeofencesWithOS();
    return true;
  } catch (error) {
    console.error(`Failed to create geofence: ${gf.identifier}`, error);
    return false;
  }
}

/**
 * Convenience method to capture current GPS location and create a geofence.
 */
export async function createGeofenceAtCurrentLocation(
  identifier: string,
  radiusMeters: number = 200,
  notifyOnEnter: boolean = true,
  notifyOnExit: boolean = true,
  enterHabit?: string | null,
  exitHabit?: string | null
): Promise<{ success: boolean; location?: CurrentLocationInfo; message: string }> {
  try {
    const loc = await getCurrentGPSLocation();
    if (!loc) {
      return {
        success: false,
        message: 'Could not obtain current GPS coordinates. Please ensure location services are enabled.',
      };
    }

    const success = await createGeofence({
      identifier,
      latitude: loc.latitude,
      longitude: loc.longitude,
      radius: radiusMeters,
      notify_on_enter: notifyOnEnter,
      notify_on_exit: notifyOnExit,
      enter_habit: enterHabit,
      exit_habit: exitHabit,
      is_active: true,
    });

    if (success) {
      return {
        success: true,
        location: loc,
        message: `Registered geofence "${identifier}" at current location (${loc.address}) with ${radiusMeters}m radius.`,
      };
    }

    return {
      success: false,
      message: `Failed to save geofence "${identifier}" into database.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Error creating geofence: ${err?.message || String(err)}`,
    };
  }
}

/**
 * Toggles a geofence between active and inactive.
 */
export async function toggleGeofenceActive(id: number, isActive: boolean): Promise<boolean> {
  const db = await getDatabase();
  try {
    await db.runAsync('UPDATE geofences SET is_active = ? WHERE id = ?', isActive ? 1 : 0, id);
    await syncGeofencesWithOS();
    return true;
  } catch (error) {
    console.error(`Failed to toggle geofence id ${id}:`, error);
    return false;
  }
}

/**
 * Deletes a geofence.
 */
export async function deleteGeofence(identifierOrId: string | number): Promise<boolean> {
  const db = await getDatabase();
  try {
    let result;
    if (typeof identifierOrId === 'number') {
      result = await db.runAsync('DELETE FROM geofences WHERE id = ?', identifierOrId);
    } else {
      result = await db.runAsync('DELETE FROM geofences WHERE identifier = ?', identifierOrId);
    }
    await syncGeofencesWithOS();
    return (result.changes ?? 0) > 0;
  } catch (error) {
    console.error(`Failed to delete geofence: ${identifierOrId}`, error);
    return false;
  }
}

/**
 * Retrieves geofence rules from database.
 */
export async function listGeofences(): Promise<GeofenceRule[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>('SELECT * FROM geofences ORDER BY id DESC');
  return rows.map(r => ({
    id: r.id,
    identifier: r.identifier,
    latitude: r.latitude,
    longitude: r.longitude,
    radius: r.radius,
    notify_on_enter: r.notify_on_enter === 1,
    notify_on_exit: r.notify_on_exit === 1,
    enter_habit: r.enter_habit,
    exit_habit: r.exit_habit,
    is_active: r.is_active === 1
  }));
}

/**
 * Retrieves geofence trigger history logs.
 */
export async function getGeofenceEvents(): Promise<GeofenceEventLog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(`
    SELECT ge.id, ge.geofence_id, ge.event_type, ge.timestamp, g.identifier
    FROM geofence_events ge
    JOIN geofences g ON ge.geofence_id = g.id
    ORDER BY ge.timestamp DESC
    LIMIT 100
  `);
  return rows;
}

export const listGeofenceEvents = getGeofenceEvents;

/**
 * Clears geofence event logs.
 */
export async function clearGeofenceHistory(): Promise<boolean> {
  const db = await getDatabase();
  try {
    await db.runAsync('DELETE FROM geofence_events');
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Updates an existing geofence.
 */
export async function updateGeofence(id: number, gf: Partial<GeofenceRule>): Promise<boolean> {
  const db = await getDatabase();
  try {
    const existing = await db.getFirstAsync<any>('SELECT * FROM geofences WHERE id = ?', id);
    if (!existing) return false;

    const identifier = gf.identifier !== undefined ? gf.identifier.trim() : existing.identifier;
    const latitude = gf.latitude !== undefined ? gf.latitude : existing.latitude;
    const longitude = gf.longitude !== undefined ? gf.longitude : existing.longitude;
    const radius = gf.radius !== undefined ? gf.radius : existing.radius;
    const notify_on_enter = gf.notify_on_enter !== undefined ? (gf.notify_on_enter ? 1 : 0) : existing.notify_on_enter;
    const notify_on_exit = gf.notify_on_exit !== undefined ? (gf.notify_on_exit ? 1 : 0) : existing.notify_on_exit;
    const enter_habit = gf.enter_habit !== undefined ? gf.enter_habit : existing.enter_habit;
    const exit_habit = gf.exit_habit !== undefined ? gf.exit_habit : existing.exit_habit;
    const is_active = gf.is_active !== undefined ? (gf.is_active ? 1 : 0) : existing.is_active;

    await db.runAsync(
      `UPDATE geofences SET
        identifier = ?, latitude = ?, longitude = ?, radius = ?,
        notify_on_enter = ?, notify_on_exit = ?,
        enter_habit = ?, exit_habit = ?, is_active = ?
       WHERE id = ?`,
      identifier, latitude, longitude, radius,
      notify_on_enter, notify_on_exit,
      enter_habit, exit_habit, is_active,
      id
    );

    await syncGeofencesWithOS();
    return true;
  } catch (error) {
    console.error(`Failed to update geofence ${id}:`, error);
    return false;
  }
}

export interface HabitTakeoverPayload {
  locationName: string;
  habitText: string;
  eventType: 'enter' | 'exit';
  geofenceId?: number;
}

type HabitTriggerListener = (payload: HabitTakeoverPayload) => void;
const habitListeners = new Set<HabitTriggerListener>();

export function subscribeHabitTrigger(listener: HabitTriggerListener) {
  habitListeners.add(listener);
  return () => {
    habitListeners.delete(listener);
  };
}

export function emitHabitTrigger(payload: HabitTakeoverPayload) {
  habitListeners.forEach((fn) => {
    try {
      fn(payload);
    } catch (err) {
      console.warn('Error in habit trigger listener:', err);
    }
  });
}

/**
 * Manually logs/simulates a geofence trigger for instantaneous testing.
 */
export async function testTriggerGeofence(
  identifierOrId: string | number,
  eventType: 'enter' | 'exit'
): Promise<{ success: boolean; message: string; alertTitle?: string; alertBody?: string }> {
  const db = await getDatabase();
  try {
    let row: any;
    if (typeof identifierOrId === 'number') {
      row = await db.getFirstAsync<any>(
        'SELECT * FROM geofences WHERE id = ?',
        identifierOrId
      );
    } else {
      row = await db.getFirstAsync<any>(
        'SELECT * FROM geofences WHERE identifier = ?',
        identifierOrId
      );
    }

    if (!row) {
      return { success: false, message: `Geofence "${identifierOrId}" not found in database.` };
    }

    await db.runAsync(
      'INSERT INTO geofence_events (geofence_id, event_type, timestamp) VALUES (?, ?, CURRENT_TIMESTAMP)',
      row.id,
      eventType
    );

    const isEnter = eventType === 'enter';
    const habit = isEnter ? row.enter_habit : row.exit_habit;
    const alertTitle = isEnter ? `📍 Arrived at ${row.identifier}` : `🚪 Departed from ${row.identifier}`;
    const alertBody = habit
      ? `Habit Stack: ${habit}`
      : `Boundary ${eventType.toUpperCase()} event registered (${row.radius}m radius).`;

    if (habit && habit.trim()) {
      emitHabitTrigger({
        locationName: row.identifier,
        habitText: habit.trim(),
        eventType,
        geofenceId: row.id,
      });
    }

    return {
      success: true,
      message: `Triggered ${eventType.toUpperCase()} event for geofence "${row.identifier}".`,
      alertTitle,
      alertBody,
    };
  } catch (e: any) {
    return { success: false, message: `Failed to trigger geofence event: ${e?.message || String(e)}` };
  }
}
