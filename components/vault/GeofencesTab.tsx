import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as geofenceService from '@/services/observation/geofenceService';
import { useHCITheme } from '@/hooks/useHCITheme';

import { EmptyState } from '@/components/shared/EmptyState';
import { SectionCard } from '@/components/shared/SectionCard';
import { ModalSheet } from '@/components/shared/ModalSheet';
import { ToggleRow } from '@/components/shared/ToggleRow';

interface GeofencesTabProps {
  refreshSignal: number;
}

export default function GeofencesTab({ refreshSignal }: GeofencesTabProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();
  const [geofences, setGeofences] = useState<geofenceService.GeofenceRule[]>([]);
  const [geofenceEvents, setGeofenceEvents] = useState<geofenceService.GeofenceEventLog[]>([]);
  const [currentLocation, setCurrentLocation] = useState<geofenceService.CurrentLocationInfo | null>(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [locationPerms, setLocationPerms] = useState<geofenceService.GeofencePermissionStatus>({
    foregroundGranted: false,
    backgroundGranted: false,
    canMonitor: false,
  });
  const [refreshing, setRefreshing] = useState(false);

  // Geofence Modal Form State
  const [geofenceModalVisible, setGeofenceModalVisible] = useState(false);
  const [editingGeofenceId, setEditingGeofenceId] = useState<number | null>(null);
  const [gfNameInput, setGfNameInput] = useState('');
  const [gfLatInput, setGfLatInput] = useState('');
  const [gfLonInput, setGfLonInput] = useState('');
  const [gfRadiusInput, setGfRadiusInput] = useState(200);
  const [gfRadiusCustomInput, setGfRadiusCustomInput] = useState('200');
  const [gfNotifyEnter, setGfNotifyEnter] = useState(true);
  const [gfNotifyExit, setGfNotifyExit] = useState(true);
  const [gfEnterHabit, setGfEnterHabit] = useState('');
  const [gfExitHabit, setGfExitHabit] = useState('');

  const fetchGeofences = useCallback(async () => {
    try {
      const gfs = await geofenceService.listGeofences();
      setGeofences(gfs);

      const events = await geofenceService.getGeofenceEvents();
      setGeofenceEvents(events);

      const perms = await geofenceService.checkGeofencePermissions();
      setLocationPerms(perms);
    } catch (e) {
      console.warn('Error fetching geofences:', e);
    }
  }, []);

  useEffect(() => {
    fetchGeofences();
  }, [fetchGeofences, refreshSignal]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGeofences();
    setRefreshing(false);
  };

  const handleRequestLocationPerms = async () => {
    const res = await geofenceService.requestGeofencePermissions();
    setLocationPerms(res);
    if (!res.canMonitor) {
      Alert.alert(
        'Permissions Needed',
        'Argus requires "Allow all the time" background location permission to monitor geofences while your device is locked or the app is closed.'
      );
    }
  };

  const handleFetchCurrentLocation = async () => {
    setIsFetchingLocation(true);
    try {
      const loc = await geofenceService.getCurrentGPSLocation();
      if (loc) {
        setCurrentLocation(loc);
        setGfLatInput(loc.latitude.toFixed(6));
        setGfLonInput(loc.longitude.toFixed(6));
      } else {
        Alert.alert('Location Error', 'Unable to fetch current GPS coordinates. Ensure location services are active.');
      }
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const handleOpenCreateGeofence = () => {
    triggerHaptic('selection');
    setEditingGeofenceId(null);
    setGfNameInput('');
    setGfRadiusInput(200);
    setGfRadiusCustomInput('200');
    setGfNotifyEnter(true);
    setGfNotifyExit(true);
    setGfEnterHabit('');
    setGfExitHabit('');
    if (currentLocation) {
      setGfLatInput(currentLocation.latitude.toFixed(6));
      setGfLonInput(currentLocation.longitude.toFixed(6));
    } else {
      setGfLatInput('');
      setGfLonInput('');
    }
    setGeofenceModalVisible(true);
  };

  const handleOpenEditGeofence = (gf: geofenceService.GeofenceRule) => {
    triggerHaptic('selection');
    setEditingGeofenceId(gf.id || null);
    setGfNameInput(gf.identifier);
    setGfLatInput(String(gf.latitude));
    setGfLonInput(String(gf.longitude));
    setGfRadiusInput(gf.radius || 200);
    setGfRadiusCustomInput(String(gf.radius || 200));
    setGfNotifyEnter(gf.notify_on_enter);
    setGfNotifyExit(gf.notify_on_exit);
    setGfEnterHabit(gf.enter_habit || '');
    setGfExitHabit(gf.exit_habit || '');
    setGeofenceModalVisible(true);
  };

  const handleQuickGeofenceAtCurrentLocation = async (name: string = 'Current Spot') => {
    setIsFetchingLocation(true);
    try {
      const res = await geofenceService.createGeofenceAtCurrentLocation(name, 200, true, true);
      if (res.success) {
        Alert.alert('Geofence Created', res.message);
        fetchGeofences();
      } else {
        Alert.alert('Failed', res.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || String(e));
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const handleSaveGeofence = async () => {
    if (!gfNameInput.trim()) {
      Alert.alert('Validation', 'Please provide a name for this geofence (e.g. Home, Office).');
      return;
    }
    const lat = parseFloat(gfLatInput);
    const lon = parseFloat(gfLonInput);
    if (isNaN(lat) || isNaN(lon)) {
      Alert.alert('Validation', 'Please provide valid Latitude and Longitude coordinates.');
      return;
    }

    const rad = parseFloat(gfRadiusCustomInput) || gfRadiusInput || 200;

    try {
      if (editingGeofenceId) {
        // Edit existing geofence
        const success = await geofenceService.updateGeofence(editingGeofenceId, {
          identifier: gfNameInput.trim(),
          latitude: lat,
          longitude: lon,
          radius: rad,
          notify_on_enter: gfNotifyEnter,
          notify_on_exit: gfNotifyExit,
          enter_habit: gfEnterHabit.trim() || null,
          exit_habit: gfExitHabit.trim() || null,
          is_active: true,
        });

        if (success) {
          triggerHaptic('success');
          setGeofenceModalVisible(false);
          fetchGeofences();
          Alert.alert('Success', `Geofence "${gfNameInput.trim()}" updated successfully.`);
        } else {
          Alert.alert('Error', 'Failed to update geofence.');
        }
      } else {
        // Create new geofence
        const success = await geofenceService.createGeofence({
          identifier: gfNameInput.trim(),
          latitude: lat,
          longitude: lon,
          radius: rad,
          notify_on_enter: gfNotifyEnter,
          notify_on_exit: gfNotifyExit,
          enter_habit: gfEnterHabit.trim() || null,
          exit_habit: gfExitHabit.trim() || null,
          is_active: true,
        });

        if (success) {
          triggerHaptic('success');
          setGeofenceModalVisible(false);
          fetchGeofences();
          Alert.alert('Success', `Geofence "${gfNameInput.trim()}" registered with ${rad}m radius.`);
        } else {
          Alert.alert('Error', 'Failed to register geofence.');
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || String(e));
    }
  };

  const handleToggleGeofenceActive = async (gf: geofenceService.GeofenceRule) => {
    if (!gf.id) return;
    await geofenceService.toggleGeofenceActive(gf.id, !gf.is_active);
    fetchGeofences();
  };

  const handleDeleteGeofence = (gf: geofenceService.GeofenceRule) => {
    Alert.alert('Delete Geofence', `Are you sure you want to remove "${gf.identifier}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (gf.id) {
            await geofenceService.deleteGeofence(gf.id);
          } else {
            await geofenceService.deleteGeofence(gf.identifier);
          }
          fetchGeofences();
        },
      },
    ]);
  };

  const handleTestTrigger = async (gf: geofenceService.GeofenceRule, eventType: 'enter' | 'exit') => {
    const res = await geofenceService.testTriggerGeofence(gf.id || gf.identifier, eventType);
    if (res.success) {
      triggerHaptic('success');
      Alert.alert(res.alertTitle || '⚡ Boundary Alert', res.alertBody || res.message);
      fetchGeofences();
    } else {
      Alert.alert('Error', res.message);
    }
  };

  const handleClearGeofenceHistory = () => {
    Alert.alert('Clear History', 'Clear all logged geofence boundary events?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          await geofenceService.clearGeofenceHistory();
          fetchGeofences();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#60a5fa" />}
    >
      <SectionCard
        title="Background Geofence Monitoring"
        icon="navigate-circle"
        style={{ marginBottom: 14 }}
      >
        <Text style={styles.telemetrySubtitle}>
          Android OS location boundaries trigger automatic logging when you arrive or leave home, office, or client sites.
        </Text>

        <View style={styles.permRow}>
          <Text style={styles.permLabel}>Background Location</Text>
          <View style={[styles.permBadge, locationPerms.canMonitor ? styles.permBadgeOn : styles.permBadgeOff]}>
            <Text style={[styles.permBadgeText, locationPerms.canMonitor ? styles.permBadgeTextOn : styles.permBadgeTextOff]}>
              {locationPerms.canMonitor ? 'Active & Ready' : locationPerms.foregroundGranted ? 'Foreground Only' : 'Disabled'}
            </Text>
          </View>
        </View>

        {!locationPerms.canMonitor && (
          <TouchableOpacity
            style={[styles.openSettingsBtn, { marginTop: 12, borderColor: '#38bdf8' }]}
            onPress={handleRequestLocationPerms}
            activeOpacity={0.8}
          >
            <Ionicons name="location" size={15} color="#38bdf8" style={{ marginRight: 6 }} />
            <Text style={[styles.openSettingsBtnText, { color: '#38bdf8' }]}>
              Authorize Location Tracking
            </Text>
          </TouchableOpacity>
        )}
      </SectionCard>

      <View style={[styles.currentLocCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'transparent' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent' }}>
            <Ionicons name="pin" size={18} color="#34d399" style={{ marginRight: 6 }} />
            <Text style={[styles.currentLocTitle, { color: colors.text, fontSize: scaleFont(13) }]}>Current GPS Location</Text>
          </View>
          <TouchableOpacity
            style={[styles.refreshLocBtn, { backgroundColor: colors.surface }]}
            onPress={handleFetchCurrentLocation}
            disabled={isFetchingLocation}
            activeOpacity={0.8}
          >
            {isFetchingLocation ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons name="locate" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={[styles.refreshLocBtnText, { color: colors.primary, fontSize: scaleFont(11) }]}>Get GPS Fix</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {currentLocation ? (
          <View style={{ marginTop: 10, backgroundColor: 'transparent' }}>
            <Text style={[styles.currentAddressText, { color: colors.text, fontSize: scaleFont(13) }]}>{currentLocation.address}</Text>
            <Text style={[styles.currentCoordsText, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
              Lat: {currentLocation.latitude.toFixed(6)} • Lon: {currentLocation.longitude.toFixed(6)} (±{currentLocation.accuracy ? Math.round(currentLocation.accuracy) : 10}m)
            </Text>

            <TouchableOpacity
              style={styles.quickFenceBtn}
              onPress={() => handleQuickGeofenceAtCurrentLocation('My Current Spot')}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={15} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={[styles.quickFenceBtnText, { fontSize: scaleFont(12) }]}>Set 200m Geofence Here</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={[styles.currentLocPlaceholder, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
            Tap "Get GPS Fix" to detect your live location coordinates and resolve your street address.
          </Text>
        )}
      </View>

      <View style={[styles.actionHeader, { marginTop: 18, marginBottom: 14 }]}>
        <Text style={[styles.sectionHeaderTitle, { color: colors.textMuted, fontSize: scaleFont(11), marginBottom: 0 }]}>
          CONFIGURED GEOFENCES ({geofences.length})
        </Text>
        <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.primary }]} onPress={handleOpenCreateGeofence} activeOpacity={0.8}>
          <Ionicons name="add" size={16} color="#ffffff" style={{ marginRight: 4 }} />
          <Text style={[styles.createBtnText, { fontSize: scaleFont(12) }]}>New Geofence</Text>
        </TouchableOpacity>
      </View>

      {geofences.length === 0 ? (
        <EmptyState
          icon="earth-outline"
          title="No Geofences Configured"
          subtitle='Add boundary zones like "Home", "Office", or "Gym" to track entries and exits automatically.'
        />
      ) : (
        geofences.map((gf) => (
          <View key={gf.id || gf.identifier} style={[styles.geofenceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.geofenceHeader}>
              <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent' }}>
                  <Text style={[styles.geofenceName, { color: colors.text, fontSize: scaleFont(14) }]}>{gf.identifier}</Text>
                  <View style={styles.radiusBadge}>
                    <Text style={styles.radiusBadgeText}>{gf.radius}m</Text>
                  </View>
                </View>
                <Text style={[styles.geofenceCoords, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  Lat: {gf.latitude.toFixed(5)}, Lon: {gf.longitude.toFixed(5)}
                </Text>
              </View>

              <Switch
                value={gf.is_active}
                onValueChange={() => handleToggleGeofenceActive(gf)}
                trackColor={{ false: '#3f3f46', true: colors.primary }}
                thumbColor={gf.is_active ? '#ffffff' : '#a1a1aa'}
              />
            </View>

            {(gf.enter_habit || gf.exit_habit) && (
              <View style={[styles.hsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="sparkles" size={13} color={colors.primary} style={{ marginRight: 6 }} />
                <View style={{ flex: 1 }}>
                  {gf.enter_habit && (
                    <Text style={[styles.hsText, { color: colors.textSecondary, fontSize: scaleFont(11) }]} numberOfLines={1}>
                      <Text style={{ fontWeight: '700', color: colors.primary }}>HS Arrival: </Text>
                      {gf.enter_habit}
                    </Text>
                  )}
                  {gf.exit_habit && (
                    <Text style={[styles.hsText, { color: colors.textSecondary, fontSize: scaleFont(11), marginTop: gf.enter_habit ? 2 : 0 }]} numberOfLines={1}>
                      <Text style={{ fontWeight: '700', color: colors.warning }}>HS Departure: </Text>
                      {gf.exit_habit}
                    </Text>
                  )}
                </View>
              </View>
            )}

            <View style={styles.geofenceFooter}>
              <View style={{ flexDirection: 'row', gap: 6, backgroundColor: 'transparent' }}>
                {gf.notify_on_enter && (
                  <View style={[styles.triggerBadge, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.triggerBadgeText, { color: colors.textSecondary, fontSize: scaleFont(10) }]}>Enter: Alert</Text>
                  </View>
                )}
                {gf.notify_on_exit && (
                  <View style={[styles.triggerBadge, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.triggerBadgeText, { color: colors.textSecondary, fontSize: scaleFont(10) }]}>Exit: Alert</Text>
                  </View>
                )}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'transparent' }}>
                <TouchableOpacity
                  style={[styles.testTriggerBtn, { backgroundColor: colors.surface }]}
                  onPress={() => handleTestTrigger(gf, 'enter')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.testTriggerBtnText, { color: colors.primary, fontSize: scaleFont(10) }]}>⚡ Enter</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.testTriggerBtn, { backgroundColor: colors.surface }]}
                  onPress={() => handleTestTrigger(gf, 'exit')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.testTriggerBtnText, { color: colors.primary, fontSize: scaleFont(10) }]}>⚡ Exit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleOpenEditGeofence(gf)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="edit-2" size={15} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteGeofence(gf)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="trash-2" size={15} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))
      )}

      <View style={{ marginTop: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, backgroundColor: 'transparent' }}>
          <Text style={[styles.sectionHeaderTitle, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
            BOUNDARY CROSSINGS ({geofenceEvents.length})
          </Text>
          {geofenceEvents.length > 0 && (
            <TouchableOpacity onPress={handleClearGeofenceHistory} activeOpacity={0.8}>
              <Text style={{ fontSize: scaleFont(11), color: colors.danger, fontWeight: '600' }}>Clear Logs</Text>
            </TouchableOpacity>
          )}
        </View>

        {geofenceEvents.length === 0 ? (
          <EmptyState
            icon="footsteps-outline"
            title=""
            subtitle='No crossing events recorded yet. Tap "⚡ Enter" or "⚡ Exit" on any geofence to test!'
            style={{ paddingVertical: 20 }}
          />
        ) : (
          geofenceEvents.map((ev) => (
            <View key={`event_${ev.id}`} style={[styles.eventRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons
                name={ev.event_type === 'enter' ? 'enter-outline' : 'exit-outline'}
                size={16}
                color={ev.event_type === 'enter' ? '#34d399' : '#f59e0b'}
                style={{ marginRight: 10 }}
              />
              <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                <Text style={[styles.eventIdentifier, { color: colors.text, fontSize: scaleFont(13) }]}>{ev.identifier}</Text>
                <Text style={[styles.eventTimestamp, { color: colors.textMuted, fontSize: scaleFont(11) }]}>{new Date(ev.timestamp).toLocaleString()}</Text>
              </View>
              <View
                style={[
                  styles.eventTypeBadge,
                  ev.event_type === 'enter' ? styles.eventEnterBadge : styles.eventExitBadge,
                ]}
              >
                <Text
                  style={[
                    styles.eventTypeText,
                    { color: ev.event_type === 'enter' ? '#34d399' : '#f59e0b' },
                  ]}
                >
                  {ev.event_type.toUpperCase()}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <ModalSheet
        visible={geofenceModalVisible}
        onClose={() => setGeofenceModalVisible(false)}
        title={editingGeofenceId ? 'Edit Geofence' : 'Register Geofence'}
        style={{ maxHeight: '92%' }}
      >
        <Text style={[styles.modalContextSubtitle, { color: colors.textSecondary, fontSize: scaleFont(12) }]}>
          {editingGeofenceId
            ? 'Update boundary coordinates, custom radius, or habit stacking routines for this location.'
            : 'Geofences monitor on-device boundary entries and exits without transmitting location data off your device.'}
        </Text>

          <Text style={[styles.fieldLabelText, { color: colors.textMuted, fontSize: scaleFont(10), marginTop: 8 }]}>GEOFENCE NAME</Text>
          <TextInput
            style={[styles.modalInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, fontSize: scaleFont(13) }]}
            value={gfNameInput}
            onChangeText={setGfNameInput}
            placeholder="e.g. Home, Office, Lekki Mall, Fitness Gym"
            placeholderTextColor={colors.textMuted}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 6, backgroundColor: 'transparent' }}>
            <Text style={[styles.fieldLabelText, { color: colors.textMuted, fontSize: scaleFont(10) }]}>COORDINATES</Text>
            <TouchableOpacity
              onPress={handleFetchCurrentLocation}
              disabled={isFetchingLocation}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: scaleFont(11), color: colors.primary, fontWeight: '700' }}>
                📍 Use Live GPS
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, backgroundColor: 'transparent', marginBottom: 6 }}>
            <TextInput
              style={[styles.modalInput, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, fontSize: scaleFont(13) }]}
              value={gfLatInput}
              onChangeText={setGfLatInput}
              placeholder="Latitude"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.modalInput, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, fontSize: scaleFont(13) }]}
              value={gfLonInput}
              onChangeText={setGfLonInput}
              placeholder="Longitude"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />
          </View>

          <Text style={[styles.fieldLabelText, { color: colors.textMuted, fontSize: scaleFont(10) }]}>BOUNDARY RADIUS (METERS)</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <TextInput
              style={[styles.modalInput, { flex: 1, marginBottom: 0, backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, fontSize: scaleFont(13) }]}
              value={gfRadiusCustomInput}
              onChangeText={(txt) => {
                setGfRadiusCustomInput(txt);
                const num = parseFloat(txt);
                if (!isNaN(num)) setGfRadiusInput(num);
              }}
              placeholder="Custom radius in meters (e.g. 200)"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />
            <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: scaleFont(12) }}>meters</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14, backgroundColor: 'transparent' }}>
            {[100, 200, 500, 1000, 2500].map((rad) => (
              <TouchableOpacity
                key={rad}
                style={[
                  styles.radiusChip,
                  {
                    backgroundColor: gfRadiusInput === rad ? colors.primaryBg : colors.surface,
                    borderColor: gfRadiusInput === rad ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  setGfRadiusInput(rad);
                  setGfRadiusCustomInput(String(rad));
                }}
              >
                <Text
                  style={[
                    styles.radiusChipText,
                    {
                      color: gfRadiusInput === rad ? colors.primary : colors.textSecondary,
                      fontSize: scaleFont(10),
                      fontWeight: gfRadiusInput === rad ? '800' : '600',
                    },
                  ]}
                >
                  {rad >= 1000 ? `${rad / 1000}km` : `${rad}m`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Habit Stacking (HS) Inputs */}
          <Text style={[styles.fieldLabelText, { color: colors.textMuted, fontSize: scaleFont(10) }]}>
            HABIT STACKING (HS) ON ARRIVAL (OPTIONAL)
          </Text>
          <TextInput
            style={[styles.modalInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, fontSize: scaleFont(13) }]}
            value={gfEnterHabit}
            onChangeText={setGfEnterHabit}
            placeholder="e.g. Drink glass of water & review tasks"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.fieldLabelText, { color: colors.textMuted, fontSize: scaleFont(10) }]}>
            HABIT STACKING (HS) ON DEPARTURE (OPTIONAL)
          </Text>
          <TextInput
            style={[styles.modalInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, fontSize: scaleFont(13) }]}
            value={gfExitHabit}
            onChangeText={setGfExitHabit}
            placeholder="e.g. Check keys, wallet, phone & lock doors"
            placeholderTextColor={colors.textMuted}
          />

          <ToggleRow
            label="Alert on Entry"
            value={gfNotifyEnter}
            onValueChange={setGfNotifyEnter}
            style={{ marginBottom: 8 }}
          />

          <ToggleRow
            label="Alert on Exit"
            value={gfNotifyExit}
            onValueChange={setGfNotifyExit}
            style={{ marginBottom: 16 }}
          />

          <View style={styles.modalBtnRow}>
            <TouchableOpacity
              style={[styles.modalBtnCancel, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setGeofenceModalVisible(false)}
            >
              <Text style={[styles.modalBtnCancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtnConfirm, { backgroundColor: colors.primary }]}
              onPress={handleSaveGeofence}
            >
              <Text style={styles.modalBtnConfirmText}>
                {editingGeofenceId ? 'Save Changes' : 'Register Geofence'}
              </Text>
            </TouchableOpacity>
          </View>
      </ModalSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modalContextSubtitle: {
    lineHeight: 18,
    marginBottom: 10,
  },
  hsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  hsText: {
    fontWeight: '500',
  },
  telemetrySubtitle: {
    fontSize: 11,
    color: '#a1a1aa',
    lineHeight: 16,
    marginBottom: 12,
  },
  permRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  permLabel: {
    fontSize: 12,
    color: '#d4d4d8',
  },
  permBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  permBadgeOn: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
  },
  permBadgeOff: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  permBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  permBadgeTextOn: {
    color: '#34d399',
  },
  permBadgeTextOff: {
    color: '#f87171',
  },
  openSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27272a',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  openSettingsBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#60a5fa',
  },
  currentLocCard: {
    backgroundColor: '#18181b',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 14,
  },
  currentLocTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fafafa',
  },
  refreshLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  refreshLocBtnText: {
    fontSize: 11,
    color: '#60a5fa',
    fontWeight: '700',
  },
  currentAddressText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fafafa',
    marginBottom: 4,
  },
  currentCoordsText: {
    fontSize: 11,
    color: '#a1a1aa',
    marginBottom: 10,
  },
  quickFenceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 10,
    borderRadius: 8,
  },
  quickFenceBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  currentLocPlaceholder: {
    fontSize: 11,
    color: '#71717a',
    lineHeight: 16,
    marginTop: 8,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fafafa',
    marginBottom: 10,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  createBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  geofenceCard: {
    backgroundColor: '#18181b',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 10,
  },
  geofenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginBottom: 10,
  },
  geofenceName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fafafa',
    marginRight: 8,
  },
  radiusBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  radiusBadgeText: {
    fontSize: 10,
    color: '#38bdf8',
    fontWeight: '700',
  },
  geofenceCoords: {
    fontSize: 11,
    color: '#a1a1aa',
    marginTop: 2,
  },
  geofenceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginTop: 4,
  },
  triggerBadge: {
    backgroundColor: '#27272a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  triggerBadgeText: {
    fontSize: 10,
    color: '#a1a1aa',
  },
  testTriggerBtn: {
    backgroundColor: '#27272a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  testTriggerBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#60a5fa',
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 8,
  },
  eventIdentifier: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fafafa',
  },
  eventTimestamp: {
    fontSize: 11,
    color: '#a1a1aa',
    marginTop: 2,
  },
  eventTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  eventEnterBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
  },
  eventExitBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  eventTypeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  fieldLabelText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#71717a',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: '#27272a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#3f3f46',
    marginBottom: 10,
  },
  radiusChip: {
    backgroundColor: '#27272a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  radiusChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38bdf8',
  },
  radiusChipText: {
    fontSize: 12,
    color: '#a1a1aa',
    fontWeight: '600',
  },
  radiusChipTextActive: {
    color: '#38bdf8',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'transparent',
  },
  modalBtnCancel: {
    flex: 1,
    backgroundColor: '#27272a',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnCancelText: {
    color: '#a1a1aa',
    fontSize: 13,
    fontWeight: '600',
  },
  modalBtnConfirm: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnConfirmText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
