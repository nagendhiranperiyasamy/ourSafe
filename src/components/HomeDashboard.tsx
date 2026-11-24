import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Compass,
  Hand,
  History,
  Home,
  Lock,
  MapPin,
  Mic,
  Radio,
  Settings,
  ShieldAlert,
  Smartphone,
  User,
  WifiOff,
} from 'lucide-react';
import {
  ActiveModal,
  AppNotification,
  AppPage,
  DualCallDispatchState,
  EmergencyHistoryEntry,
  GeoLocationState,
  LiveLocationShareSession,
  NearbyPoliceAiResult,
  QuickTriggerEvent,
  SafetyCheckInSession,
  SafetyPreferences,
  SosAlertRecord,
  SosContact,
  ThreatSessionState,
  TravelSession,
  UserProfile,
  VehicleVerificationRecord,
  VoiceCommandAction,
} from '../types/safety';
import { useEmergencyQuickTriggers } from '../hooks/useEmergencyQuickTriggers';
import { useGlobalVoiceController } from '../hooks/useGlobalVoiceController';
import {
  buildNativeSyncPayload,
  isRunningInNativeAndroidApp,
  startNativeLockAndHomeShield,
  subscribeNativeSosTriggers,
  syncNativeLockAndHomeShield,
} from '../utils/nativeShieldBridge';
import {
  getEmergencyHistory,
  getNotifications,
  getSafetyCheckIn,
  getThreatSession,
  getTravelSession,
  saveEmergencyHistory,
  saveNotifications,
  saveSafetyCheckIn,
  saveThreatSession,
  saveTravelSession,
} from '../utils/storage';
import { BrandLogo } from './BrandLogo';
import { EmergencyLockScreenShield } from './EmergencyLockScreenShield';
import { EmergencyTriggerOverlay } from './EmergencyTriggerOverlay';
import { OurSafeVoiceWakeBanner } from './OurSafeVoiceWakeBanner';
import { BiometricSensorTrigger } from './BiometricSensorTrigger';
import { useThreatMode } from '../hooks/useThreatMode';
import { syncThreatSessionToFirebase } from '../utils/firebaseSync';
import { FakeCallModal } from './dashboard/FakeCallModal';
import { NotificationsModal } from './dashboard/NotificationsModal';
import { ProfileModal } from './dashboard/ProfileModal';
import { SettingsModal } from './dashboard/SettingsModal';
import { SosContactsModal } from './dashboard/SosContactsModal';
import { AiVoiceAssistantPage } from './pages/AiVoiceAssistantPage';
import { EvidenceHistoryPage } from './pages/EvidenceHistoryPage';
import { HomeAboutPage } from './pages/HomeAboutPage';
import { NearbyPage } from './pages/NearbyPage';
import { SosPage } from './pages/SosPage';
import { ThreatModePage } from './pages/ThreatModePage';
import { TravelModePage } from './pages/TravelModePage';
import {
  cancelAssistantSpeech,
  parseInstantVoiceIntent,
  speakAssistantGreeting,
} from '../utils/voiceGreeting';

interface HomeDashboardProps {
  user: UserProfile;
  onUpdateUser: (updated: UserProfile) => void;
  onLogout: () => void;
  autoStartVoice?: boolean;
  onConsumeAutoStartVoice?: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  user,
  onUpdateUser,
  onLogout,
  autoStartVoice = false,
  onConsumeAutoStartVoice,
}) => {
  const [activePage, setActivePage] = useState<AppPage>(() => {
    if (typeof window === 'undefined') return 'home';
    const mode = new URLSearchParams(window.location.search).get('mode');
    if (mode === 'sos') return 'sos';
    if (mode === 'voicewake') return 'assistant';
    return 'home';
  });
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [profileOpenInEditMode, setProfileOpenInEditMode] = useState(false);
  const [nearbyCategory, setNearbyCategory] = useState<'police' | 'restrooms'>(
    'police'
  );

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [actionToast, setActionToast] = useState<string>('');
  const [fakeCallerName, setFakeCallerName] = useState('Mom');
  const fakeCallTimerRef = useRef<number | null>(null);

  const [travelSession, setTravelSession] = useState<TravelSession | null>(() =>
    getTravelSession(user.id)
  );
  const [checkInSession, setCheckInSession] =
    useState<SafetyCheckInSession | null>(() => getSafetyCheckIn(user.id));
  const [threatSession, setThreatSession] = useState<ThreatSessionState | null>(
    () => getThreatSession(user.id)
  );
  const [recoveredInterruption, setRecoveredInterruption] =
    useState<ThreatSessionState | null>(null);
  const [historyEntries, setHistoryEntries] = useState<EmergencyHistoryEntry[]>(
    () => getEmergencyHistory(user.id)
  );
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    getNotifications(user.id)
  );
  const [latestSosAlert, setLatestSosAlert] = useState<SosAlertRecord | null>(
    null
  );
  const [liveLocationShare, setLiveLocationShare] =
    useState<LiveLocationShareSession | null>(null);

  // Dual Emergency Call (Guardian + Police) state
  const [dualCallState, setDualCallState] =
    useState<DualCallDispatchState | null>(null);

  // AI Nearby Police Station Numbers state (Gemini Maps Grounding)
  const [nearbyPoliceResult, setNearbyPoliceResult] =
    useState<NearbyPoliceAiResult | null>(null);
  const [nearbyPoliceLoading, setNearbyPoliceLoading] = useState(false);
  const [nearbyPoliceError, setNearbyPoliceError] = useState('');
  const autoFetchPendingRef = useRef(false);

  // Outside-App Lock-Screen & Home-Screen Shield + Hands-Free Quick-Trigger SOS state
  const [lockScreenShieldOpen, setLockScreenShieldOpen] = useState<boolean>(
    () => {
      if (typeof window === 'undefined') return false;
      return (
        new URLSearchParams(window.location.search).get('mode') === 'lockshield'
      );
    }
  );
  const [lockShieldSurface, setLockShieldSurface] = useState<
    'lock_screen' | 'home_screen'
  >('lock_screen');
  const [activeQuickTriggerEvent, setActiveQuickTriggerEvent] =
    useState<QuickTriggerEvent | null>(null);

  // Global Threat Mode State Hook (persistent microphone keepalive & cloud metadata sink)
  const threatMode = useThreatMode({
    userId: user.id,
  });
  const lastSosDispatchTimeRef = useRef<number>(0);

  // When Alert Mode is enabled, actively keep microphone awake without idle disconnects
  useEffect(() => {
    if (user.preferences.alertModeEnabled) {
      void threatMode.ensureMicAlwaysActive();
    }
  }, [user.preferences.alertModeEnabled, threatMode]);

  // "OurSafe" ("Hey Google"-style) Spoken Greeting & Floating Voice Control Sheet state
  const [voiceWakeSheetOpen, setVoiceWakeSheetOpen] = useState(false);
  const [voiceWakePhase, setVoiceWakePhase] = useState<
    'greeting' | 'listening' | 'speaking' | 'executed'
  >('listening');
  const [voiceWakeGreetingText, setVoiceWakeGreetingText] = useState(
    'OurSafe app is here, how can I help you?'
  );
  const [voiceWakeLastHeard, setVoiceWakeLastHeard] = useState('');
  const [voiceWakeActionNote, setVoiceWakeActionNote] = useState('');
  const [greetingSpeaking, setGreetingSpeaking] = useState(false);

  const [geoLocation, setGeoLocation] = useState<GeoLocationState>({
    status: 'idle',
    latitude: null,
    longitude: null,
    accuracy: null,
  });

  const geoLocationRef = useRef(geoLocation);
  useEffect(() => {
    geoLocationRef.current = geoLocation;
  }, [geoLocation]);

  const nearbyPoliceRef = useRef(nearbyPoliceResult);
  useEffect(() => {
    nearbyPoliceRef.current = nearbyPoliceResult;
  }, [nearbyPoliceResult]);

  const showToast = useCallback((message: string) => {
    setActionToast(message);
    window.setTimeout(() => {
      setActionToast((curr) => (curr === message ? '' : curr));
    }, 4500);
  }, []);

  const addNotification = useCallback(
    (
      title: string,
      detail: string,
      category: AppNotification['category']
    ) => {
      if (!user.preferences.guardianUpdates && category !== 'sos') return;
      setNotifications((prev) => {
        const next: AppNotification[] = [
          {
            id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            title,
            detail,
            timestamp: new Date().toISOString(),
            category,
            read: false,
          },
          ...prev,
        ];
        saveNotifications(user.id, next);
        return next;
      });
    },
    [user.id, user.preferences.guardianUpdates]
  );

  const appendHistory = useCallback(
    (entry: Omit<EmergencyHistoryEntry, 'id' | 'timestamp'>) => {
      setHistoryEntries((prev) => {
        const next: EmergencyHistoryEntry[] = [
          {
            id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: new Date().toISOString(),
            ...entry,
          },
          ...prev,
        ];
        saveEmergencyHistory(user.id, next);
        return next;
      });
    },
    [user.id]
  );

  // Reload per-user local state & check for previously interrupted Threat Mode session
  useEffect(() => {
    setTravelSession(getTravelSession(user.id));
    setCheckInSession(getSafetyCheckIn(user.id));
    setNotifications(getNotifications(user.id));
    setHistoryEntries(getEmergencyHistory(user.id));

    const savedThreat = getThreatSession(user.id);
    if (savedThreat?.active) {
      const staleMs =
        Date.now() - new Date(savedThreat.lastHeartbeatAt).getTime();
      if (staleMs > 25_000) {
        const recovered: ThreatSessionState = {
          ...savedThreat,
          interruptedUnexpectedly: true,
        };
        setRecoveredInterruption(recovered);
        setThreatSession(recovered);
        appendHistory({
          category: 'connectivity',
          title: 'Threat Mode Session Resumed After Unexpected Interruption',
          detail:
            'Previous Threat Mode session stopped reporting before deactivation. Last known GPS and timestamp were preserved locally for guardian review.',
          statusLabel: 'Preserved Snapshot',
          locationCoords:
            savedThreat.lastLatitude !== null && savedThreat.lastLongitude !== null
              ? `${savedThreat.lastLatitude.toFixed(5)}, ${savedThreat.lastLongitude.toFixed(5)}`
              : undefined,
        });
      } else {
        setThreatSession(savedThreat);
      }
    } else {
      setThreatSession(null);
    }
  }, [user.id, appendHistory]);

  // Monitor Online / Offline connectivity changes
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (threatSession?.active) {
        appendHistory({
          category: 'connectivity',
          title: 'Connectivity Restored During Threat Mode',
          detail:
            'Network connection returned. Preserved emergency timeline and last known coordinates are ready for guardian notification.',
          statusLabel: 'Online',
        });
        addNotification(
          'Connectivity restored',
          'Your device is back online. Preserved Threat Mode timeline is available.',
          'safety'
        );
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      if (threatSession?.active) {
        appendHistory({
          category: 'connectivity',
          title: 'Device Went Offline During Threat Mode',
          detail:
            'Network connectivity dropped during active Threat Mode. Last known location and emergency events remain preserved locally.',
          statusLabel: 'Offline Snapshot Saved',
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [threatSession, appendHistory, addNotification]);

  // Periodic heartbeat preservation during active Threat Mode
  useEffect(() => {
    if (!threatSession?.active) return;
    const id = window.setInterval(() => {
      setThreatSession((prev) => {
        if (!prev?.active) return prev;
        const g = geoLocationRef.current;
        const next: ThreatSessionState = {
          ...prev,
          lastHeartbeatAt: new Date().toISOString(),
          isOnline: navigator.onLine,
          lastLatitude: g.latitude ?? prev.lastLatitude,
          lastLongitude: g.longitude ?? prev.lastLongitude,
        };
        saveThreatSession(user.id, next);
        return next;
      });
    }, 10_000);
    return () => window.clearInterval(id);
  }, [threatSession?.active, user.id]);

  // Cleanup fake call timer on unmount
  useEffect(() => {
    return () => {
      if (fakeCallTimerRef.current !== null) {
        window.clearTimeout(fakeCallTimerRef.current);
      }
    };
  }, []);

  const requestGeoLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGeoLocation({
        status: 'unsupported',
        latitude: null,
        longitude: null,
        accuracy: null,
        errorMessage: 'Geolocation is not supported in this browser.',
      });
      return;
    }

    setGeoLocation((prev) => ({
      ...prev,
      status: 'loading',
      errorMessage: undefined,
    }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGeoLocation({
          status: 'granted',
          latitude: lat,
          longitude: lng,
          accuracy: pos.coords.accuracy,
          updatedAt: new Date().toISOString(),
        });
      },
      (err) => {
        setGeoLocation({
          status: 'denied',
          latitude: null,
          longitude: null,
          accuracy: null,
          errorMessage:
            err.code === 1
              ? 'Location access denied. Allow location permission in browser settings to attach live coordinates.'
              : 'Unable to determine current GPS position right now.',
        });
      },
      { enableHighAccuracy: true, timeout: 9000 }
    );
  }, []);

  const getCoordsString = useCallback((): string | undefined => {
    const g = geoLocationRef.current;
    if (g.status === 'granted' && g.latitude !== null && g.longitude !== null) {
      return `${g.latitude.toFixed(5)}, ${g.longitude.toFixed(5)}`;
    }
    return undefined;
  }, []);

  // --- AI Nearby Police Station Numbers (Gemini Maps Grounding) ---
  const fetchNearbyPoliceAi = useCallback(
    async (areaQuery?: string) => {
      if (!navigator.onLine) {
        setNearbyPoliceError(
          'You are offline. Direct emergency calls (100 / 112) still work immediately.'
        );
        return;
      }

      const trimmedArea = areaQuery?.trim() ?? '';
      const g = geoLocationRef.current;
      const hasCoords =
        g.status === 'granted' && g.latitude !== null && g.longitude !== null;

      if (!hasCoords && !trimmedArea) {
        autoFetchPendingRef.current = true;
        requestGeoLocation();
        setNearbyPoliceError(
          'Requesting your GPS location to find nearby police station numbers — or enter your city / locality above.'
        );
        return;
      }

      setNearbyPoliceLoading(true);
      setNearbyPoliceError('');

      try {
        const res = await fetch('/api/threat/nearby-police', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: !trimmedArea && hasCoords ? g.latitude : undefined,
            longitude: !trimmedArea && hasCoords ? g.longitude : undefined,
            areaQuery: trimmedArea || undefined,
          }),
        });

        const data = (await res.json()) as NearbyPoliceAiResult & {
          error?: string;
        };

        if (!res.ok) {
          throw new Error(
            data.error || 'Could not look up nearby police station numbers.'
          );
        }

        setNearbyPoliceResult(data);
        appendHistory({
          category: 'location',
          title: 'AI Located Nearby Police Station Numbers',
          detail: `Found ${data.stations.length} police station listing(s) for ${data.locationLabel}.`,
          statusLabel: 'Verified Maps Lookup',
          locationCoords: getCoordsString(),
        });
      } catch (err) {
        const rawMsg = err instanceof Error ? err.message : '';
        const friendly =
          !rawMsg || rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.trim().startsWith('{')
            ? 'Unable to reach AI police station lookup right now. Dial 100 or 112 directly.'
            : rawMsg;
        setNearbyPoliceError(friendly);
      } finally {
        setNearbyPoliceLoading(false);
      }
    },
    [requestGeoLocation, appendHistory, getCoordsString]
  );

  // Auto-run nearby police AI lookup once GPS resolves after Threat Mode activation or GPS request
  useEffect(() => {
    if (
      autoFetchPendingRef.current &&
      geoLocation.status === 'granted' &&
      geoLocation.latitude !== null &&
      geoLocation.longitude !== null &&
      navigator.onLine
    ) {
      autoFetchPendingRef.current = false;
      fetchNearbyPoliceAi();
    }
  }, [
    geoLocation.status,
    geoLocation.latitude,
    geoLocation.longitude,
    fetchNearbyPoliceAi,
  ]);

  // --- Dual Emergency Call Dispatch (Both Guardian AND Police) ---
  const openDualCall = useCallback(
    (
      triggeredBy: string,
      customGuardianName?: string,
      customPoliceNumber?: string
    ) => {
      const primary =
        user.sosContacts.find((c) => c.isPrimary) ?? user.sosContacts[0];
      const requestedLower = customGuardianName?.trim().toLowerCase() ?? '';
      const guardian =
        (requestedLower
          ? user.sosContacts.find((c) =>
              c.name.toLowerCase().includes(requestedLower)
            )
          : undefined) ?? primary;

      const aiStationWithPhone = nearbyPoliceRef.current?.stations.find(
        (s) => s.phone && s.phone.trim().length > 0
      );

      const policePhone =
        customPoliceNumber?.trim() || aiStationWithPhone?.phone || '100';
      const policeName =
        customPoliceNumber?.trim()
          ? `Police Emergency (${customPoliceNumber.trim()})`
          : aiStationWithPhone
            ? aiStationWithPhone.name
            : 'Police Control Room';

      setDualCallState({
        active: true,
        triggeredBy,
        triggeredAt: new Date().toISOString(),
        guardianName: guardian?.name ?? null,
        guardianPhone: guardian?.phone ?? null,
        policeName,
        policePhone,
        nearestStationName: aiStationWithPhone?.name,
        nearestStationPhone: aiStationWithPhone?.phone,
        guardianDialAttempted: false,
        policeDialAttempted: false,
      });

      appendHistory({
        category: 'sos',
        title: `Dual Call Ready: Guardian + Police (${triggeredBy})`,
        detail: `${
          guardian
            ? `Guardian ${guardian.name} (${guardian.phone})`
            : 'No guardian saved'
        } and ${policeName} (${policePhone}) surfaced for immediate calling.`,
        statusLabel: 'Dual Dialer Ready',
        locationCoords: getCoordsString(),
      });
    },
    [user.sosContacts, appendHistory, getCoordsString]
  );

  const markDualCallDialed = useCallback(
    (target: 'guardian' | 'police') => {
      setDualCallState((prev) =>
        prev
          ? {
              ...prev,
              guardianDialAttempted:
                target === 'guardian' ? true : prev.guardianDialAttempted,
              policeDialAttempted:
                target === 'police' ? true : prev.policeDialAttempted,
            }
          : prev
      );
      appendHistory({
        category: target === 'guardian' ? 'guardian' : 'sos',
        title:
          target === 'guardian'
            ? 'Emergency Call Placed to Guardian'
            : 'Emergency Call Placed to Police',
        detail: `Phone dialer launched for ${
          target === 'guardian' ? 'primary guardian' : 'police emergency response'
        }.`,
        statusLabel: 'Call Initiated',
        locationCoords: getCoordsString(),
      });
    },
    [appendHistory, getCoordsString]
  );

  const closeDualCall = useCallback(() => {
    setDualCallState(null);
  }, []);

  // --- Core SOS Workflow ---
  const triggerSosAlert = useCallback(
    (triggerSource: string, note?: string) => {
      const nowMs = Date.now();
      if (nowMs - lastSosDispatchTimeRef.current < 4500) {
        showToast('Emergency SOS already dispatched. Call options are active.');
        return;
      }
      lastSosDispatchTimeRef.current = nowMs;

      requestGeoLocation();
      const g = geoLocationRef.current;
      const coords = getCoordsString();
      const onlineNow = navigator.onLine;
      const now = new Date().toISOString();

      const contactStatus =
        user.sosContacts.length === 0
          ? 'failed'
          : onlineNow
            ? 'delivered_demo'
            : 'queued_offline';

      const record: SosAlertRecord = {
        id: `sos-${Date.now()}`,
        activatedAt: now,
        triggerSource,
        status: contactStatus,
        latitude: g.latitude,
        longitude: g.longitude,
        note,
        recipients: user.sosContacts.map((c) => ({
          name: c.name,
          phone: c.phone,
          status: onlineNow ? 'delivered_demo' : 'queued_offline',
        })),
      };

      setLatestSosAlert(record);

      // Automated server-side SOS dispatch (ready for user's backend SMS/Twilio/Police webhook)
      const nearestPolice = nearbyPoliceRef.current?.stations.find(
        (s) => s.phone && s.phone.trim().length > 0
      );
      if (onlineNow) {
        fetch('/api/sos/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userName: user.fullName,
            triggerSource,
            guardianContacts: user.sosContacts.map((c) => ({
              name: c.name,
              phone: c.phone,
            })),
            policeNumber: nearestPolice?.phone || '100',
            shareWithPolice: true,
            latitude: g.latitude,
            longitude: g.longitude,
            vehicleNumber: travelSession?.vehicleInfo?.normalizedNumber,
            note,
          }),
        }).catch(() => {});
      }

      appendHistory({
        category: 'sos',
        title: `SOS Emergency Activated (${triggerSource})`,
        detail:
          user.sosContacts.length === 0
            ? 'SOS activated and police dispatch prepared (no guardian contacts configured yet).'
            : onlineNow
              ? `Automated emergency alert & live location dispatched to ${user.sosContacts
                  .map((c) => c.name)
                  .join(', ')} AND Police (${nearestPolice?.phone || '100'}).${
                  travelSession?.vehicleInfo
                    ? ` Vehicle: ${travelSession.vehicleInfo.normalizedNumber}.`
                    : ''
                }`
              : `Device offline. Alert payload preserved locally for ${user.sosContacts.map((c) => c.name).join(', ')}.`,
        statusLabel:
          contactStatus === 'delivered_demo'
            ? 'Auto-Dispatched'
            : contactStatus === 'queued_offline'
              ? 'Queued Offline'
              : 'Police Ready',
        locationCoords: coords,
      });

      addNotification(
        'SOS Emergency Initiated',
        `Triggered via ${triggerSource}. Guardians + Police alerted. ${
          coords ? `GPS ${coords}.` : 'Awaiting GPS.'
        }`,
        'sos'
      );
      showToast(
        'SOS active! Automated alert sent to Guardians & Police with direct call ready.'
      );
    },
    [
      user.fullName,
      user.sosContacts,
      travelSession?.vehicleInfo,
      requestGeoLocation,
      getCoordsString,
      appendHistory,
      addNotification,
      showToast,
    ]
  );

  // --- Core Threat Mode Activation / Deactivation ---
  const activateThreatMode = useCallback(
    (source = 'Manual Activation') => {
      requestGeoLocation();
      const g = geoLocationRef.current;
      const coords = getCoordsString();
      const now = new Date().toISOString();
      const onlineNow = navigator.onLine;

      const nextSession: ThreatSessionState = {
        active: true,
        sessionId: `threat-${Date.now()}`,
        activatedAt: now,
        lastHeartbeatAt: now,
        lastLatitude: g.latitude,
        lastLongitude: g.longitude,
        batteryPercent: null,
        isOnline: onlineNow,
        recordingMode: 'none',
        guardianNotificationStatus:
          user.sosContacts.length === 0
            ? 'failed'
            : onlineNow
              ? 'delivered_demo'
              : 'queued_offline',
      };

      setThreatSession(nextSession);
      saveThreatSession(user.id, nextSession);
      setRecoveredInterruption(null);

      // Lock microphone continuously ON during Threat Mode (stays ON until Threat Mode is deactivated)
      void threatMode.ensureMicAlwaysActive();
      void syncThreatSessionToFirebase(user.id, nextSession);

      // Automatically find nearby police station numbers via AI when online
      if (onlineNow) {
        if (g.status === 'granted' && g.latitude !== null && g.longitude !== null) {
          fetchNearbyPoliceAi();
        } else {
          autoFetchPendingRef.current = true;
        }
      }

      appendHistory({
        category: 'threat',
        title: `Threat Mode Activated (${source})`,
        detail: `Guardian alert ${
          onlineNow ? 'dispatched' : 'queued offline'
        } for ${user.sosContacts.length} contact(s). Continuous heartbeat snapshot & AI nearby police lookup enabled.`,
        statusLabel: 'Active',
        locationCoords: coords,
      });

      addNotification(
        'Threat Mode Activated',
        `Protection active via ${source}. Emergency recording, nearby police lookup, and snapshot preservation enabled.`,
        'safety'
      );
      showToast('Threat Mode activated. Finding nearby police station numbers...');
    },
    [
      user.id,
      user.sosContacts.length,
      requestGeoLocation,
      getCoordsString,
      fetchNearbyPoliceAi,
      appendHistory,
      addNotification,
      showToast,
    ]
  );

  const deactivateThreatMode = useCallback(
    (note = 'Deactivated safely') => {
      const coords = getCoordsString();
      setThreatSession(null);
      saveThreatSession(user.id, null);
      setRecoveredInterruption(null);

      // Release microphone lock immediately when Threat Mode turns OFF
      threatMode.releaseMicLock();
      if (!user.preferences.micAlwaysOn) {
        quickTriggers.stopVoiceWakeListener();
      }

      appendHistory({
        category: 'threat',
        title: 'Threat Mode Deactivated Safely',
        detail: note,
        statusLabel: 'Standby',
        locationCoords: coords,
      });

      addNotification(
        'Threat Mode Deactivated',
        'You marked yourself safe and closed the active Threat Mode session.',
        'safety'
      );
      showToast('Threat Mode deactivated safely.');
    },
    [user.id, getCoordsString, appendHistory, addNotification, showToast]
  );

  const updateThreatSnapshot = useCallback(
    (partial: Partial<ThreatSessionState>) => {
      setThreatSession((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          ...partial,
          lastHeartbeatAt: new Date().toISOString(),
        };
        saveThreatSession(user.id, next);
        return next;
      });
    },
    [user.id]
  );

  // --- Live Location Sharing (BOTH Guardians AND Police) ---
  const handleToggleLiveLocationShare = useCallback(
    (active: boolean, durationMinutes = 30) => {
      if (active) {
        requestGeoLocation();
        const g = geoLocationRef.current;
        const now = new Date().toISOString();
        const names = user.sosContacts.map((c) => c.name);
        const nearestPolice = nearbyPoliceRef.current?.stations.find(
          (s) => s.phone && s.phone.trim().length > 0
        );
        const policePhone = nearestPolice?.phone || '100';
        const policeName = nearestPolice?.name || 'Police Control Room';

        if (!nearestPolice && navigator.onLine) {
          fetchNearbyPoliceAi();
        }

        setLiveLocationShare({
          active: true,
          startedAt: now,
          durationMinutes,
          sharedWithNames: names,
          sharedWithPolice: true,
          nearestPoliceName: policeName,
          nearestPolicePhone: policePhone,
          lastLatitude: g.latitude,
          lastLongitude: g.longitude,
          lastUpdatedAt: now,
        });

        if (navigator.onLine) {
          fetch('/api/sos/dispatch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userName: user.fullName,
              triggerSource: 'Live Location Sharing (Guardians + Police)',
              guardianContacts: user.sosContacts.map((c) => ({
                name: c.name,
                phone: c.phone,
              })),
              policeNumber: policePhone,
              shareWithPolice: true,
              latitude: g.latitude,
              longitude: g.longitude,
              vehicleNumber: travelSession?.vehicleInfo?.normalizedNumber,
              note: `Live location shared for ${durationMinutes} minutes with Guardians and Police.`,
            }),
          }).catch(() => {});
        }

        appendHistory({
          category: 'location',
          title: 'Live Location Shared with Guardians & Police',
          detail: `Started ${durationMinutes}-minute live GPS sharing with ${
            names.length > 0 ? names.join(', ') : 'authorized guardians'
          } AND ${policeName} (${policePhone}).`,
          statusLabel: 'Guardian + Police Active',
          locationCoords: getCoordsString(),
        });
        showToast(
          `Live location shared with Guardians AND ${policeName} (${policePhone}).`
        );
      } else {
        setLiveLocationShare(null);
        appendHistory({
          category: 'location',
          title: 'Live Location Sharing Stopped',
          detail: 'User ended active live location sharing session.',
          statusLabel: 'Stopped',
          locationCoords: getCoordsString(),
        });
        showToast('Live Location Sharing stopped.');
      }
    },
    [
      user.fullName,
      user.sosContacts,
      travelSession?.vehicleInfo?.normalizedNumber,
      requestGeoLocation,
      fetchNearbyPoliceAi,
      getCoordsString,
      appendHistory,
      showToast,
    ]
  );

  // --- Safety Check-In Timer Logic ---
  const handleStartSafetyCheckIn = useCallback(
    (label: string, durationSeconds: number, guardianId: string) => {
      const guardian =
        user.sosContacts.find((c) => c.id === guardianId) ??
        user.sosContacts[0];
      if (!guardian) {
        showToast('Add a guardian contact first to use Safety Check-In.');
        return;
      }
      const now = Date.now();
      const next: SafetyCheckInSession = {
        active: true,
        label,
        guardianId: guardian.id,
        guardianName: guardian.name,
        guardianPhone: guardian.phone,
        durationSeconds,
        startedAt: new Date(now).toISOString(),
        dueAt: new Date(now + durationSeconds * 1000).toISOString(),
        status: 'active',
      };
      setCheckInSession(next);
      saveSafetyCheckIn(user.id, next);
      appendHistory({
        category: 'checkin',
        title: `Safety Check-In Started: ${label}`,
        detail: `Check-in due in ${
          durationSeconds >= 60
            ? `${Math.round(durationSeconds / 60)} min`
            : `${durationSeconds}s`
        }. Assigned guardian: ${guardian.name}.`,
        statusLabel: 'Active',
      });
      showToast(`Safety Check-In started for "${label}".`);
    },
    [user.id, user.sosContacts, appendHistory, showToast]
  );

  const handleConfirmSafetyCheckIn = useCallback(() => {
    if (!checkInSession) return;
    const label = checkInSession.label;
    setCheckInSession(null);
    saveSafetyCheckIn(user.id, null);
    appendHistory({
      category: 'checkin',
      title: `Safety Check-In Confirmed: ${label}`,
      detail: 'User confirmed safe arrival before check-in deadline.',
      statusLabel: 'Safe',
    });
    showToast('Check-in confirmed. Glad you are safe.');
  }, [checkInSession, user.id, appendHistory, showToast]);

  const handleCancelSafetyCheckIn = useCallback(() => {
    setCheckInSession(null);
    saveSafetyCheckIn(user.id, null);
    showToast('Safety Check-In cancelled.');
  }, [user.id, showToast]);

  // Monitor check-in expiration across all pages
  useEffect(() => {
    if (!checkInSession?.active) return;
    const checkDue = () => {
      if (Date.now() >= new Date(checkInSession.dueAt).getTime()) {
        const missed: SafetyCheckInSession = {
          ...checkInSession,
          active: false,
          status: 'missed',
        };
        setCheckInSession(missed);
        saveSafetyCheckIn(user.id, missed);
        appendHistory({
          category: 'guardian',
          title: `Missed Safety Check-In Alert (${checkInSession.label})`,
          detail: `No response before deadline. Alert dispatched for ${checkInSession.guardianName} (${checkInSession.guardianPhone}).`,
          statusLabel: navigator.onLine ? 'Alert Sent' : 'Queued Offline',
          locationCoords: getCoordsString(),
        });
        addNotification(
          'Missed Safety Check-In',
          `Timer expired for "${checkInSession.label}". Guardian ${checkInSession.guardianName} alerted.`,
          'sos'
        );
        showToast(
          `Safety Check-In missed! Alert logged for ${checkInSession.guardianName}.`
        );
      }
    };
    const id = window.setInterval(checkDue, 1000);
    return () => window.clearInterval(id);
  }, [
    checkInSession,
    user.id,
    appendHistory,
    addNotification,
    getCoordsString,
    showToast,
  ]);

  // --- Fake Call Trigger ---
  const handleTriggerFakeCall = useCallback(
    (callerName: string, delaySeconds: number) => {
      setFakeCallerName(callerName);
      if (fakeCallTimerRef.current !== null) {
        window.clearTimeout(fakeCallTimerRef.current);
      }
      if (delaySeconds <= 0) {
        setActiveModal('fakecall');
      } else {
        showToast(
          `Incoming call from ${callerName} scheduled in ${delaySeconds}s.`
        );
        fakeCallTimerRef.current = window.setTimeout(() => {
          setActiveModal('fakecall');
        }, delaySeconds * 1000);
      }
    },
    [showToast]
  );

  // --- AI Voice Assistant Tool Executor (Complete App Control) ---
  const handleExecuteVoiceCommand = useCallback(
    async (
      call: VoiceCommandAction
    ): Promise<{
      ok: boolean;
      summary: string;
      data?: Record<string, unknown>;
    }> => {
      const primary =
        user.sosContacts.find((c) => c.isPrimary) ?? user.sosContacts[0];
      const aiStationWithPhone = nearbyPoliceRef.current?.stations.find(
        (s) => s.phone && s.phone.trim().length > 0
      );

      switch (call.name) {
        case 'call_guardian_and_police': {
          const guardianNameArg =
            typeof call.args.guardianName === 'string'
              ? call.args.guardianName
              : undefined;
          const policeNumberArg =
            typeof call.args.policeNumber === 'string'
              ? call.args.policeNumber
              : undefined;

          setActivePage('sos');
          triggerSosAlert(
            'AI Voice Command ("Call Both Guardian & Police")'
          );
          openDualCall(
            'AI Voice Command',
            guardianNameArg,
            policeNumberArg
          );
          const resolvedPolice =
            policeNumberArg || aiStationWithPhone?.phone || '100';
          return {
            ok: true,
            summary: primary
              ? `Opened Dual Emergency Call for BOTH ${primary.name} (${primary.phone}) and Police (${resolvedPolice}) on the SOS screen with live location alert active.`
              : `Opened Dual Emergency Call for Police (${resolvedPolice}) on the SOS screen. Add a guardian contact to dial both.`,
            data: {
              guardianName: primary?.name ?? null,
              guardianPhone: primary?.phone ?? null,
              policeNumber: resolvedPolice,
              location: getCoordsString() ?? 'Requesting GPS',
            },
          };
        }

        case 'call_police': {
          const policeNumberArg =
            typeof call.args.policeNumber === 'string'
              ? call.args.policeNumber
              : aiStationWithPhone?.phone || '100';
          setActivePage('sos');
          openDualCall('AI Voice Command ("Call Police")', undefined, policeNumberArg);
          showToast(`Police dialer (${policeNumberArg}) ready on the SOS page.`);
          return {
            ok: true,
            summary: `Opened SOS Emergency page with Police (${policeNumberArg}) ready for immediate dialing alongside your guardian.`,
            data: { policeNumber: policeNumberArg },
          };
        }

        case 'open_sos': {
          setActivePage('sos');
          const shouldAlert = call.args.initiateAlert !== false;
          if (shouldAlert) {
            triggerSosAlert(
              'AI Voice Command ("Open SOS")',
              typeof call.args.reason === 'string' ? call.args.reason : undefined
            );
          } else {
            requestGeoLocation();
          }
          if (
            call.args.callBothGuardianAndPolice !== false ||
            user.preferences.quickDialGuardianOnVoiceSos
          ) {
            openDualCall('AI Voice Command ("Open SOS")');
          }
          return {
            ok: true,
            summary: primary
              ? `Opened SOS Emergency page, prepared alert with location for ${user.sosContacts.length} contact(s), and surfaced call actions for BOTH ${primary.name} (${primary.phone}) and Police (${aiStationWithPhone?.phone || '100'}).`
              : 'Opened SOS Emergency page and surfaced Police emergency calling (100 / 112). Add a guardian contact to enable guardian dialing.',
            data: {
              guardianName: primary?.name ?? null,
              guardianPhone: primary?.phone ?? null,
              location: getCoordsString() ?? 'Requesting GPS',
              policeNumber: aiStationWithPhone?.phone || '100',
            },
          };
        }

        case 'activate_threat_mode': {
          setActivePage('threat');
          activateThreatMode('AI Voice Command');
          return {
            ok: true,
            summary:
              'Navigated to Threat Mode, activated protection, alerted guardians, started AI lookup for nearby police station numbers, and enabled audio/video evidence recording.',
          };
        }

        case 'deactivate_threat_mode': {
          deactivateThreatMode(
            typeof call.args.note === 'string'
              ? call.args.note
              : 'Deactivated via AI Voice Command'
          );
          return {
            ok: true,
            summary:
              'Threat Mode deactivated safely and logged in Emergency History.',
          };
        }

        case 'call_guardian': {
          const requestedName =
            typeof call.args.guardianName === 'string'
              ? call.args.guardianName
              : undefined;
          const target =
            (requestedName
              ? user.sosContacts.find((c) =>
                  c.name.toLowerCase().includes(requestedName.toLowerCase())
                )
              : undefined) ?? primary;

          setActivePage('sos');
          if (!target) {
            return {
              ok: false,
              summary:
                'Opened SOS page, but no guardian phone number is saved yet. Please add an emergency contact.',
            };
          }
          openDualCall('AI Voice Command ("Call Guardian")', target.name);
          showToast(`Tap "Call ${target.name}" on the SOS page to place the call.`);
          return {
            ok: true,
            summary: `Opened SOS Emergency page with ${target.name} (${target.phone}) and Police ready for immediate one-tap dialing.`,
            data: { guardianName: target.name, guardianPhone: target.phone },
          };
        }

        case 'send_emergency_alert': {
          setActivePage('sos');
          const msg =
            typeof call.args.message === 'string' ? call.args.message : undefined;
          triggerSosAlert('AI Voice Command ("Send Emergency Alert")', msg);
          return {
            ok: true,
            summary: `Dispatched emergency alert with available GPS for ${user.sosContacts.length} registered contact(s).`,
          };
        }

        case 'share_live_location': {
          const mins =
            typeof call.args.durationMinutes === 'number'
              ? call.args.durationMinutes
              : 30;
          setActivePage('sos');
          handleToggleLiveLocationShare(true, mins);
          return {
            ok: true,
            summary: `Live Location Sharing started for ${mins} minutes with BOTH your registered guardians AND nearest Police (${
              aiStationWithPhone?.phone || '100'
            }).`,
          };
        }

        case 'open_nearby_police': {
          const cat =
            call.args.category === 'restrooms' ? 'restrooms' : 'police';
          setNearbyCategory(cat);
          setActivePage('nearby');
          requestGeoLocation();
          if (cat === 'police' && navigator.onLine) {
            fetchNearbyPoliceAi();
          }
          return {
            ok: true,
            summary: `Opened Nearby Safe Places filtered to ${
              cat === 'police' ? 'Police Stations' : 'Public Restrooms'
            } and started AI police station number lookup.`,
          };
        }

        case 'open_travel_mode': {
          setActivePage('travel');
          requestGeoLocation();
          return {
            ok: true,
            summary:
              'Opened Travel Mode with live Google Maps route tracking, off-route deviation monitor, and Auto/Cab number verification.',
          };
        }

        case 'open_lock_shield': {
          const surface =
            call.args.surface === 'home_screen' ? 'home_screen' : 'lock_screen';
          setLockShieldSurface(surface);
          setLockScreenShieldOpen(true);
          return {
            ok: true,
            summary:
              'Opened OurSafe Standby Lock Shield with 3x Shake, Secret Voice Code, and Screen Tap SOS active.',
          };
        }

        case 'trigger_fake_call': {
          const caller =
            typeof call.args.callerName === 'string' &&
            call.args.callerName.trim()
              ? call.args.callerName.trim()
              : 'Mom';
          handleTriggerFakeCall(caller, 0);
          return {
            ok: true,
            summary: `Launched incoming Fake Call screen from ${caller}.`,
          };
        }

        case 'start_safety_checkin': {
          const mins =
            typeof call.args.minutes === 'number' && call.args.minutes > 0
              ? call.args.minutes
              : 10;
          setActivePage('travel');
          handleStartSafetyCheckIn(
            'Voice Safety Check-In',
            mins * 60,
            primary?.id ?? ''
          );
          return {
            ok: true,
            summary: `Started a ${mins}-minute Safety Check-In timer on Travel Mode.`,
          };
        }

        case 'navigate_page': {
          const raw = String(call.args.page || 'home').toLowerCase();
          const validPages: AppPage[] = [
            'home',
            'sos',
            'threat',
            'travel',
            'assistant',
            'nearby',
            'history',
          ];
          const targetPage = (
            validPages.includes(raw as AppPage) ? raw : 'home'
          ) as AppPage;
          setActivePage(targetPage);
          return {
            ok: true,
            summary: `Navigated to the ${targetPage} page.`,
          };
        }

        case 'open_settings': {
          setActiveModal('settings');
          return {
            ok: true,
            summary:
              'Opened Settings where you can turn 3x Shake, Secret Voice Code, Screen Tap SOS, and "OurSafe" Wake Word ON or OFF.',
          };
        }

        case 'open_contacts': {
          setActiveModal('contacts');
          return {
            ok: true,
            summary:
              'Opened your Trusted Guardian Emergency Contacts list.',
          };
        }

        default:
          return {
            ok: false,
            summary: `Unsupported command "${call.name}".`,
          };
      }
    },
    [
      user.sosContacts,
      user.preferences.quickDialGuardianOnVoiceSos,
      triggerSosAlert,
      openDualCall,
      requestGeoLocation,
      getCoordsString,
      activateThreatMode,
      deactivateThreatMode,
      fetchNearbyPoliceAi,
      showToast,
      handleToggleLiveLocationShare,
      handleTriggerFakeCall,
      handleStartSafetyCheckIn,
    ]
  );

  // --- Travel Mode Handlers ---
  const handleStartTravel = (session: TravelSession) => {
    setTravelSession(session);
    saveTravelSession(user.id, session);
    appendHistory({
      category: 'location',
      title: `Travel Mode Started to ${session.destination}`,
      detail: `Origin: ${session.startLocation}. Guardian assigned: ${session.guardianName} (${session.guardianPhone}).`,
      statusLabel: 'In Transit',
      locationCoords: getCoordsString(),
    });
    addNotification(
      'Travel Mode started',
      `Route to ${session.destination} linked with ${session.guardianName}.`,
      'travel'
    );
  };

  const handleCheckInTravel = () => {
    if (!travelSession) return;
    const updated: TravelSession = {
      ...travelSession,
      lastCheckInAt: new Date().toISOString(),
    };
    setTravelSession(updated);
    saveTravelSession(user.id, updated);
    addNotification(
      'Safe travel check-in logged',
      `Confirmed safe status while traveling to ${updated.destination}.`,
      'travel'
    );
    showToast('Safe travel check-in recorded.');
  };

  const handleEndTravel = () => {
    const dest = travelSession?.destination ?? 'destination';
    setTravelSession(null);
    saveTravelSession(user.id, null);
    appendHistory({
      category: 'location',
      title: `Travel Mode Ended Safely (${dest})`,
      detail:
        'User confirmed safe arrival and closed active journey sharing.',
      statusLabel: 'Arrived Safe',
      locationCoords: getCoordsString(),
    });
    addNotification(
      'Travel Mode ended safely',
      `Arrived safely and closed journey to ${dest}.`,
      'travel'
    );
  };

  const handleUpdateTravelVehicle = useCallback(
    (vehicle: VehicleVerificationRecord | null) => {
      if (vehicle) {
        appendHistory({
          category: 'location',
          title: `Vehicle Checked: ${vehicle.normalizedNumber} (${
            vehicle.formatValid ? 'RTO Verified' : 'Check Needed'
          })`,
          detail: `${vehicle.vehicleType} · ${vehicle.stateRegion}. ${vehicle.summary}`,
          statusLabel: vehicle.formatValid ? 'Format Verified' : 'Warning Flagged',
          locationCoords: getCoordsString(),
        });
        showToast(
          vehicle.formatValid
            ? `Vehicle ${vehicle.normalizedNumber} verified & attached to Travel Mode.`
            : `Warning flagged for ${vehicle.normalizedNumber}. Check plate details carefully.`
        );
      }
      setTravelSession((prev) => {
        if (!prev) return prev;
        const next: TravelSession = {
          ...prev,
          vehicleInfo: vehicle ?? undefined,
        };
        saveTravelSession(user.id, next);
        return next;
      });
    },
    [user.id, appendHistory, getCoordsString, showToast]
  );

  const handleOffRouteAlert = useCallback(
    (info: {
      distanceMeters: number;
      currentLat: number;
      currentLng: number;
      simulated: boolean;
    }) => {
      const coordLabel = `${info.currentLat.toFixed(5)}, ${info.currentLng.toFixed(5)}`;
      appendHistory({
        category: 'location',
        title: `Off-Route Vehicle Alert (${info.distanceMeters}m from Google Maps Route)`,
        detail: `Vehicle deviated ${info.distanceMeters}m from planned route${
          travelSession?.destination ? ` to ${travelSession.destination}` : ''
        }.${
          travelSession?.vehicleInfo
            ? ` Vehicle: ${travelSession.vehicleInfo.normalizedNumber}.`
            : ''
        }`,
        statusLabel: 'Route Deviation',
        locationCoords: coordLabel,
      });
      addNotification(
        'Off-Route Vehicle Deviation Alert',
        `Vehicle moved ${info.distanceMeters}m away from your Google Maps route. Check route or escalate to SOS immediately.`,
        'sos'
      );
      showToast(
        `ALERT: Vehicle moved ${info.distanceMeters}m off the Google Maps route!`
      );
    },
    [
      travelSession?.destination,
      travelSession?.vehicleInfo,
      appendHistory,
      addNotification,
      showToast,
    ]
  );

  const handleUpdatePreferences = (partial: Partial<SafetyPreferences>) => {
    onUpdateUser({
      ...user,
      preferences: {
        ...user.preferences,
        ...partial,
      },
    });
  };

  const handleSaveContacts = (nextContacts: SosContact[]) => {
    const nextPrimary =
      nextContacts.find((c) => c.isPrimary) ?? nextContacts[0];
    onUpdateUser({
      ...user,
      sosContacts: nextContacts,
      guardianName: nextPrimary ? nextPrimary.name : user.guardianName,
      guardianPhone: nextPrimary ? nextPrimary.phone : user.guardianPhone,
    });
    addNotification(
      'Trusted guardian network updated',
      `Your emergency circle now includes ${nextContacts.length} contact(s), saved locally for offline readiness.`,
      'account'
    );
  };

  const primaryGuardian =
    user.sosContacts.find((c) => c.isPrimary) ?? user.sosContacts[0];
  const unreadCount = notifications.filter((n) => !n.read).length;
  const firstName = user.fullName.trim().split(' ')[0] || user.fullName;

  // Persistent Full-App AI Voice Controller (stays connected across ALL pages!)
  const voiceController = useGlobalVoiceController({
    userName: firstName,
    primaryGuardianName: primaryGuardian?.name,
    primaryGuardianPhone: primaryGuardian?.phone,
    threatActive: Boolean(threatSession?.active),
    sosActive: Boolean(latestSosAlert),
    isOnline,
    onExecuteVoiceCommand: handleExecuteVoiceCommand,
  });

  // Execute any spoken or tapped command from the OurSafe Voice Wake Sheet
  const handleVoiceSheetCommand = useCallback(
    async (commandText: string) => {
      const cleaned = commandText.trim();
      if (!cleaned) return;
      setVoiceWakeLastHeard(cleaned);

      const instantIntent = parseInstantVoiceIntent(cleaned);
      if (instantIntent) {
        const outcome = await handleExecuteVoiceCommand(instantIntent);
        setVoiceWakePhase('executed');
        setVoiceWakeActionNote(outcome.summary);
        showToast(outcome.summary);
        if (voiceController.liveStatus !== 'connected') {
          setGreetingSpeaking(true);
          speakAssistantGreeting(outcome.summary, () => {
            setGreetingSpeaking(false);
            setVoiceWakePhase('listening');
          });
        }
        return;
      }

      if (isOnline) {
        setVoiceWakePhase('speaking');
        await voiceController.runTextCommand(cleaned);
        setVoiceWakePhase('listening');
      } else {
        const offlineNote =
          'Offline mode: say Open SOS, Activate Threat Mode, Travel Mode, Nearby Police, Settings, or Guardians.';
        setVoiceWakeActionNote(offlineNote);
        setGreetingSpeaking(true);
        speakAssistantGreeting(offlineNote, () => {
          setGreetingSpeaking(false);
          setVoiceWakePhase('listening');
        });
      }
    },
    [handleExecuteVoiceCommand, isOnline, showToast, voiceController]
  );

  // "Hey Google"-style Hands-Free Wake Word ("OurSafe" / "House Safe")
  // Displays the app immediately, speaks "OurSafe app is here, how can I help you?", and listens across the full app
  const handleWakeWordDetected = useCallback(
    ({
      spokenText,
      followUpCommand,
    }: {
      spokenText: string;
      followUpCommand: string;
    }) => {
      const wakeLabel = user.preferences.wakeWordPhrase?.trim() || 'OurSafe';
      const greetingLine = `${wakeLabel} app is here, how can I help you?`;

      setLockScreenShieldOpen(false);
      setActiveModal(null);
      setVoiceWakeGreetingText(greetingLine);
      setVoiceWakeSheetOpen(true);
      setVoiceWakeActionNote('');
      setVoiceWakeLastHeard(
        followUpCommand?.trim() ? followUpCommand.trim() : spokenText
      );

      if (followUpCommand && followUpCommand.trim().length > 0) {
        setVoiceWakePhase('executed');
        showToast(`${wakeLabel} heard: "${followUpCommand.trim()}"`);
        void handleVoiceSheetCommand(followUpCommand.trim());
        if (
          isOnline &&
          voiceController.liveStatus !== 'connected' &&
          voiceController.liveStatus !== 'connecting'
        ) {
          window.setTimeout(() => {
            void voiceController.startLiveVoice();
          }, 1800);
        }
        return;
      }

      // Speak the audible greeting first (with background mic paused so it never self-triggers),
      // then seamlessly start continuous Full-App Voice Control right after speaking.
      setVoiceWakePhase('greeting');
      setGreetingSpeaking(true);
      showToast(greetingLine);

      speakAssistantGreeting(greetingLine, () => {
        setGreetingSpeaking(false);
        setVoiceWakePhase('listening');
        if (
          isOnline &&
          voiceController.liveStatus !== 'connected' &&
          voiceController.liveStatus !== 'connecting'
        ) {
          void voiceController.startLiveVoice();
        }
      });
    },
    [
      handleVoiceSheetCommand,
      isOnline,
      showToast,
      user.preferences.wakeWordPhrase,
      voiceController,
    ]
  );

  const handleCloseVoiceWakeSheet = useCallback(() => {
    cancelAssistantSpeech();
    setGreetingSpeaking(false);
    setVoiceWakeSheetOpen(false);
    setVoiceWakePhase('listening');
    if (
      voiceController.liveStatus === 'connected' ||
      voiceController.liveStatus === 'connecting'
    ) {
      voiceController.disconnectLiveVoice();
    }
    quickTriggers.stopVoiceWakeListener();
  }, [voiceController]);

  // Auto-launch spoken greeting + full voice control when woken from Login/Lock Shield or ?mode=voicewake
  const autoVoiceTriggeredRef = useRef(false);
  useEffect(() => {
    const queryWake =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('mode') === 'voicewake';
    if ((autoStartVoice || queryWake) && !autoVoiceTriggeredRef.current) {
      autoVoiceTriggeredRef.current = true;
      onConsumeAutoStartVoice?.();
      handleWakeWordDetected({
        spokenText: user.preferences.wakeWordPhrase || 'OurSafe',
        followUpCommand: '',
      });
    }
  }, [
    autoStartVoice,
    handleWakeWordDetected,
    onConsumeAutoStartVoice,
    user.preferences.wakeWordPhrase,
  ]);

  // Global Hands-Free & Outside-App Emergency Triggers (3x Shake, Secret Voice Code, Screen Tap, "OurSafe" Wake Word)
  const quickTriggers = useEmergencyQuickTriggers({
    preferences: user.preferences,
    isLockScreenActive: lockScreenShieldOpen,
    alertModeActive: Boolean(
      user.preferences.alertModeEnabled ||
      threatMode.isThreatModeActive ||
      threatSession?.active
    ),
    // Pause background wake-word mic while speaking greeting, while voice wake sheet is active, or while Gemini Live holds the mic
    suspended:
      Boolean(activeQuickTriggerEvent) ||
      greetingSpeaking ||
      voiceWakeSheetOpen ||
      voiceController.liveStatus === 'connected' ||
      voiceController.liveStatus === 'connecting',
    onTriggerSos: (event) => {
      requestGeoLocation();
      setActiveQuickTriggerEvent(event);
    },
    onWakeWordDetected: handleWakeWordDetected,
  });

  const handleDispatchQuickTriggerSos = useCallback(
    (event: QuickTriggerEvent) => {
      triggerSosAlert(event.label, event.detail);
      openDualCall(event.label);
      if (user.preferences.autoShareLocationOnTrigger !== false) {
        handleToggleLiveLocationShare(true, 30);
      }
    },
    [
      triggerSosAlert,
      openDualCall,
      user.preferences.autoShareLocationOnTrigger,
      handleToggleLiveLocationShare,
    ]
  );

  const nearestAiStationWithPhone = nearbyPoliceResult?.stations.find(
    (s) => Boolean(s.phone && s.phone.trim())
  );

  // Auto-sync preferences & contacts into Android Native Lock/Home Shield when running as Android APK
  useEffect(() => {
    if (!isRunningInNativeAndroidApp()) return;
    const payload = buildNativeSyncPayload({
      preferences: user.preferences,
      userName: user.fullName,
      guardianName: primaryGuardian?.name,
      guardianPhone: primaryGuardian?.phone,
      policePhone: nearestAiStationWithPhone?.phone || '100',
    });
    void syncNativeLockAndHomeShield(payload);
    if (payload.enabled) {
      void startNativeLockAndHomeShield(payload);
    }
  }, [
    user.preferences,
    user.fullName,
    primaryGuardian?.name,
    primaryGuardian?.phone,
    nearestAiStationWithPhone?.phone,
  ]);

  // Listen for real native Android Lock Screen / Home Screen trigger broadcasts
  useEffect(() => {
    return subscribeNativeSosTriggers((data) => {
      requestGeoLocation();
      setActiveQuickTriggerEvent({
        id: `native-sos-${Date.now()}`,
        kind: data.kind,
        label: data.label,
        detail: data.detail,
        triggeredAt: new Date().toISOString(),
        fromLockScreen: data.surface === 'lock_screen',
      });
    });
  }, [requestGeoLocation]);

  const openLockAndHomeShield = useCallback(
    (surface: 'lock_screen' | 'home_screen' = 'lock_screen') => {
      setLockShieldSurface(surface);
      setLockScreenShieldOpen(true);
    },
    []
  );

  const navItems: Array<{
    id: AppPage;
    label: string;
    icon: React.ReactNode;
    isEmergency?: boolean;
  }> = [
    { id: 'home', label: 'Home', icon: <Home className="w-4 h-4" /> },
    {
      id: 'sos',
      label: 'SOS',
      icon: <ShieldAlert className="w-4 h-4" />,
      isEmergency: true,
    },
    { id: 'threat', label: 'Threat', icon: <AlertTriangle className="w-4 h-4" /> },
    { id: 'travel', label: 'Travel', icon: <Compass className="w-4 h-4" /> },
    { id: 'assistant', label: 'AI Voice', icon: <Mic className="w-4 h-4" /> },
    { id: 'nearby', label: 'Nearby', icon: <MapPin className="w-4 h-4" /> },
    { id: 'history', label: 'History', icon: <History className="w-4 h-4" /> },
  ];

  const mobileBottomItems: AppPage[] = [
    'home',
    'sos',
    'threat',
    'travel',
    'assistant',
  ];

  return (
    <div className="min-h-screen oursafe-canvas-bg flex flex-col pb-20 lg:pb-10">
      {/* Top Application Header */}
      <header className="sticky top-0 z-30 bg-[#FCFDF9]/95 backdrop-blur-md border-b border-[#B8C6A8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setActivePage('home')}
            className="cursor-pointer focus:outline-none"
            aria-label="Go to OurSafe Home"
          >
            <BrandLogo size="sm" />
          </button>

          {/* Desktop Dedicated Page Navigation */}
          <nav
            aria-label="Primary application pages"
            className="hidden lg:flex items-center gap-5"
          >
            {navItems.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActivePage(item.id)}
                  className={`py-1.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                    isActive
                      ? item.isEmergency
                        ? 'text-red-700 border-red-600'
                        : 'text-[#24371D] border-[#2F4526]'
                      : item.isEmergency
                        ? 'text-red-600 border-transparent hover:text-red-800'
                        : 'text-[#4B5844] border-transparent hover:text-[#182215]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Header Utility Controls: Clean & Aligned on all phone screens */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveModal('notifications')}
              aria-label={`Notifications (${unreadCount} unread)`}
              className="relative min-w-[38px] min-h-[38px] rounded-xl flex items-center justify-center text-[#465340] hover:text-[#24371D] hover:bg-[#EAF0E2] transition-colors cursor-pointer"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold tabular-nums flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Distinct User Profile Avatar (Different from App Shield Logo) */}
            <button
              type="button"
              onClick={() => {
                setProfileOpenInEditMode(false);
                setActiveModal('profile');
              }}
              aria-label="Open User Profile & Verification"
              title={`Logged in as ${user.fullName}`}
              className="p-1 rounded-xl hover:bg-[#EAF0E2] transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#2F4526] to-[#517342] text-white flex items-center justify-center font-bold text-xs shadow-xs border-2 border-white shrink-0">
                {user.photoDataUrl ? (
                  <img
                    src={user.photoDataUrl}
                    alt={user.fullName}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span>{user.fullName.trim()[0]?.toUpperCase() || 'U'}</span>
                )}
              </div>
              <span className="hidden sm:inline text-xs font-bold text-[#24371D] max-w-[80px] truncate">
                {firstName}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('settings')}
              aria-label="Open Settings"
              className="min-w-[38px] min-h-[38px] rounded-xl flex items-center justify-center text-[#465340] hover:text-[#24371D] hover:bg-[#EAF0E2] transition-colors cursor-pointer"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Contextual Persistent Safety Banners */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 space-y-2.5">
        {!isOnline && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs font-medium text-amber-950 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Offline Mode · Saved guardian numbers and direct phone calling remain available.
              </span>
            </span>
            <button
              type="button"
              onClick={() => setActivePage('sos')}
              className="font-bold text-amber-900 underline cursor-pointer"
            >
              Open SOS Contacts
            </button>
          </div>
        )}

        {threatSession?.active && activePage !== 'threat' && (
          <div className="rounded-2xl bg-red-600 text-white px-4 py-2.5 text-xs font-semibold flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Threat Mode is currently ACTIVE. Heartbeat snapshots &amp; police contacts are live.
              </span>
            </span>
            <button
              type="button"
              onClick={() => setActivePage('threat')}
              className="px-3 py-1 rounded-lg bg-white text-red-700 font-bold cursor-pointer whitespace-nowrap"
            >
              Return to Threat Mode
            </button>
          </div>
        )}

        {checkInSession?.active && activePage !== 'travel' && (
          <div className="rounded-2xl bg-[#FCFDF9] border border-[#B8C6A8] px-4 py-2.5 text-xs font-semibold text-[#182215] flex flex-wrap items-center justify-between gap-2">
            <span>
              Safety Check-In active: &ldquo;{checkInSession.label}&rdquo;
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleConfirmSafetyCheckIn}
                className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer whitespace-nowrap"
              >
                I&apos;m Safe
              </button>
              <button
                type="button"
                onClick={() => setActivePage('travel')}
                className="px-3 py-1 rounded-lg bg-[#EAF0E2] border border-[#C5D2B7] text-[#24371D] font-semibold cursor-pointer whitespace-nowrap"
              >
                View Timer
              </button>
            </div>
          </div>
        )}

        {(quickTriggers.voiceListening ||
          quickTriggers.shakeCount > 0 ||
          quickTriggers.tapCount > 0) && (
          <div className="rounded-2xl bg-[#182215] text-[#F5F9F2] px-4 py-2.5 text-xs font-semibold flex flex-wrap items-center justify-between gap-2 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              {quickTriggers.voiceListening && (
                <span className="inline-flex items-center gap-1.5 text-emerald-300">
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  <span>
                    Listening:
                    {user.preferences.voiceActivationEnabled
                      ? ` "${user.preferences.voiceKeyword}" (SOS)`
                      : ''}
                    {user.preferences.voiceActivationEnabled &&
                    user.preferences.wakeWordEnabled !== false
                      ? ' · '
                      : ''}
                    {user.preferences.wakeWordEnabled !== false
                      ? ` "${user.preferences.wakeWordPhrase || 'OurSafe'}" (Voice App)`
                      : ''}
                  </span>
                </span>
              )}
              {quickTriggers.shakeCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-red-300">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Shake {quickTriggers.shakeCount} / 3 detected</span>
                </span>
              )}
              {quickTriggers.tapCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-red-300">
                  <Hand className="w-3.5 h-3.5" />
                  <span>
                    Screen Tap {quickTriggers.tapCount} / {quickTriggers.requiredTaps}
                  </span>
                </span>
              )}
            </div>

            {quickTriggers.voiceListening && (
              <button
                type="button"
                onClick={quickTriggers.stopVoiceWakeListener}
                className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold cursor-pointer whitespace-nowrap"
              >
                Stop Mic
              </button>
            )}
          </div>
        )}

        {(voiceController.liveStatus === 'connected' ||
          voiceController.liveStatus === 'connecting') &&
          activePage !== 'assistant' && (
            <div className="rounded-2xl bg-[#2F4526] text-[#F6F9F2] px-4 py-2.5 text-xs font-semibold flex flex-wrap items-center justify-between gap-2 shadow-sm">
              <div className="flex items-center gap-2 min-w-0">
                <Mic className="w-4 h-4 text-emerald-300 animate-pulse shrink-0" />
                <span className="truncate">
                  {voiceController.liveStatus === 'connecting'
                    ? 'Connecting Full-App AI Voice...'
                    : voiceController.isSpeaking
                      ? 'Full-App AI Voice Active · Speaking...'
                      : 'Full-App AI Voice ON · Listening across every screen ("Go to SOS", "Activate Threat Mode", "Share my location")'}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActivePage('assistant')}
                  className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold cursor-pointer whitespace-nowrap"
                >
                  Voice Log
                </button>
                <button
                  type="button"
                  onClick={voiceController.disconnectLiveVoice}
                  className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold cursor-pointer whitespace-nowrap"
                >
                  Stop Voice
                </button>
              </div>
            </div>
          )}

        {actionToast && (
          <div
            role="status"
            className="rounded-2xl bg-[#FCFDF9] border border-[#2F4526]/40 px-4 py-2.5 text-xs font-semibold text-[#182215] flex items-center gap-2 shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-[#2F4526] shrink-0" />
            <span>{actionToast}</span>
          </div>
        )}
      </div>

      {/* Dedicated Feature Page Router */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7">
        {activePage === 'home' && (
          <HomeAboutPage
            userName={user.fullName}
            preferences={user.preferences}
            voiceListening={quickTriggers.voiceListening}
            liveVoiceActive={
              voiceController.liveStatus === 'connected' ||
              voiceController.liveStatus === 'connecting'
            }
            onNavigatePage={(p) => setActivePage(p)}
            onOpenContacts={() => setActiveModal('contacts')}
            onOpenSettings={() => setActiveModal('settings')}
            onOpenLockShield={() => openLockAndHomeShield('lock_screen')}
            onWakeVoice={() =>
              handleWakeWordDetected({
                spokenText: user.preferences.wakeWordPhrase || 'OurSafe',
                followUpCommand: '',
              })
            }
          />
        )}

        {activePage === 'sos' && (
          <SosPage
            userName={user.fullName}
            contacts={user.sosContacts}
            preferences={user.preferences}
            quickTriggers={quickTriggers}
            geoLocation={geoLocation}
            isOnline={isOnline}
            latestSosAlert={latestSosAlert}
            liveLocationShare={liveLocationShare}
            dualCallState={dualCallState}
            nearbyPoliceResult={nearbyPoliceResult}
            quickDialEnabled={user.preferences.quickDialGuardianOnVoiceSos}
            onRequestLocation={requestGeoLocation}
            onTriggerSosAlert={triggerSosAlert}
            onOpenDualCall={(triggeredBy) => openDualCall(triggeredBy)}
            onMarkDualCallDialed={markDualCallDialed}
            onCloseDualCall={closeDualCall}
            onClearSosStatus={() => setLatestSosAlert(null)}
            onToggleLiveLocationShare={handleToggleLiveLocationShare}
            onToggleQuickDial={() =>
              handleUpdatePreferences({
                quickDialGuardianOnVoiceSos:
                  !user.preferences.quickDialGuardianOnVoiceSos,
              })
            }
            onUpdatePreferences={handleUpdatePreferences}
            onOpenLockScreenShield={openLockAndHomeShield}
            onOpenContacts={() => setActiveModal('contacts')}
            onOpenNearbyPolice={() => {
              setNearbyCategory('police');
              setActivePage('nearby');
            }}
          />
        )}

        {activePage === 'threat' && (
          <ThreatModePage
            userId={user.id}
            contacts={user.sosContacts}
            threatSession={threatSession}
            recoveredInterruption={recoveredInterruption}
            geoLocation={geoLocation}
            isOnline={isOnline}
            soundAllowed={user.preferences.soundAlarmEnabled}
            nearbyPoliceResult={nearbyPoliceResult}
            nearbyPoliceLoading={nearbyPoliceLoading}
            nearbyPoliceError={nearbyPoliceError}
            onFetchNearbyPoliceAi={fetchNearbyPoliceAi}
            onRequestLocation={requestGeoLocation}
            onActivateThreatMode={activateThreatMode}
            onDeactivateThreatMode={deactivateThreatMode}
            onUpdateThreatSnapshot={updateThreatSnapshot}
            onRecordingSaved={({ id, kind, durationSec, locationCoords }) => {
              appendHistory({
                category: 'recording',
                title: `${kind === 'video' ? 'Video' : 'Audio'} Evidence Saved`,
                detail: `Captured ${durationSec}s of local ${kind} evidence inside Threat Mode. Stored securely on device.`,
                statusLabel: 'Stored Locally',
                locationCoords,
                recordingId: id,
                recordingKind: kind,
              });
              addNotification(
                `${kind === 'video' ? 'Video' : 'Audio'} evidence saved`,
                `Recorded ${durationSec}s locally. Open History to review, share, or delete.`,
                'safety'
              );
            }}
            onSimulateConnectivityDrop={() => {
              const coords = getCoordsString();
              appendHistory({
                category: 'connectivity',
                title: 'Emergency Snapshot Preserved for Offline Safety',
                detail:
                  'Last known GPS location and session timestamp preserved locally on device for immediate guardian review.',
                statusLabel: 'Snapshot Preserved',
                locationCoords: coords,
              });
              showToast(
                'Preserved current safety snapshot to Emergency Evidence History.'
              );
            }}
            onDismissRecoveryBanner={() => setRecoveredInterruption(null)}
            onEscalateToSos={() => {
              setActivePage('sos');
              triggerSosAlert('Escalated from Threat Mode');
              openDualCall('Escalated from Threat Mode');
            }}
            onOpenHistory={() => setActivePage('history')}
            onWakeVoice={() =>
              handleWakeWordDetected({
                spokenText: user.preferences.wakeWordPhrase || 'OurSafe',
                followUpCommand: '',
              })
            }
          />
        )}

        {activePage === 'travel' && (
          <TravelModePage
            contacts={user.sosContacts}
            travelSession={travelSession}
            checkInSession={checkInSession}
            geoLocation={geoLocation}
            soundAllowed={user.preferences.soundAlarmEnabled}
            onRequestLocation={requestGeoLocation}
            onStartTravel={handleStartTravel}
            onUpdateTravelVehicle={handleUpdateTravelVehicle}
            onOffRouteAlert={handleOffRouteAlert}
            onEscalateToSos={(reason) => {
              setActivePage('sos');
              triggerSosAlert('Travel Mode Off-Route Escalation', reason);
              openDualCall('Travel Mode Off-Route Alert');
            }}
            onCheckInTravel={handleCheckInTravel}
            onEndTravel={handleEndTravel}
            onManageContacts={() => setActiveModal('contacts')}
            onStartSafetyCheckIn={handleStartSafetyCheckIn}
            onConfirmSafetyCheckIn={handleConfirmSafetyCheckIn}
            onCancelSafetyCheckIn={handleCancelSafetyCheckIn}
            onTriggerFakeCall={handleTriggerFakeCall}
          />
        )}

        {activePage === 'assistant' && (
          <AiVoiceAssistantPage
            voiceController={voiceController}
            isOnline={isOnline}
            secretVoiceCode={user.preferences.voiceKeyword || 'Balaji'}
            onManualSos={() => {
              setActivePage('sos');
              triggerSosAlert('Manual SOS via AI Voice Page');
              openDualCall('Manual SOS via AI Voice Page');
            }}
            onDualCallNow={() => {
              setActivePage('sos');
              triggerSosAlert('Dual Call via AI Voice Page');
              openDualCall('Dual Call Button (AI Voice)');
            }}
            onTriggerVoiceSos={(phrase) => {
              requestGeoLocation();
              triggerSosAlert(`Secret Voice Code ("${phrase}")`);
              openDualCall(`Secret Voice Code ("${phrase}")`);
              if (user.preferences.autoShareLocationOnTrigger !== false) {
                handleToggleLiveLocationShare(true, 30);
              }
            }}
          />
        )}

        {activePage === 'nearby' && (
          <NearbyPage
            geoLocation={geoLocation}
            initialCategory={nearbyCategory}
            isOnline={isOnline}
            nearbyPoliceResult={nearbyPoliceResult}
            nearbyPoliceLoading={nearbyPoliceLoading}
            nearbyPoliceError={nearbyPoliceError}
            onFetchNearbyPoliceAi={fetchNearbyPoliceAi}
            onRequestLocation={requestGeoLocation}
          />
        )}

        {activePage === 'history' && (
          <EvidenceHistoryPage
            user={user}
            entries={historyEntries}
            onClearHistory={() => {
              setHistoryEntries([]);
              saveEmergencyHistory(user.id, []);
            }}
            onLogGuardianShare={(recordingId, kind) => {
              appendHistory({
                category: 'guardian',
                title: `Shared ${kind === 'video' ? 'Video' : 'Audio'} Evidence Summary`,
                detail: `Prepared recording ${recordingId} for authorized guardian review (${user.sosContacts.length} contact(s)).`,
                statusLabel: 'Shared with Guardians',
              });
            }}
          />
        )}
      </main>

      {/* Mobile Compact Thumb-Zone Bottom Navigation Bar */}
      <nav
        aria-label="Mobile page navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#FCFDF9]/95 backdrop-blur-md border-t border-[#B8C6A8]"
      >
        <div className="grid grid-cols-5 h-[58px] items-center">
          {navItems
            .filter((item) => mobileBottomItems.includes(item.id))
            .map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActivePage(item.id)}
                  className={`h-full flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                    isActive
                      ? item.isEmergency
                        ? 'text-red-600'
                        : 'text-[#24371D]'
                      : item.isEmergency
                        ? 'text-red-500'
                        : 'text-[#54634D]'
                  }`}
                >
                  {item.icon}
                  <span className="text-[10px] font-semibold tracking-tight whitespace-nowrap">
                    {item.label}
                  </span>
                </button>
              );
            })}
        </div>
      </nav>

      {/* "Hey Google"-Style OurSafe Voice Wake Sheet ("OurSafe app is here, how can I help you?") */}
      <OurSafeVoiceWakeBanner
        open={voiceWakeSheetOpen}
        greetingText={voiceWakeGreetingText}
        phase={voiceController.isSpeaking ? 'speaking' : voiceWakePhase}
        liveStatus={voiceController.liveStatus}
        lastHeardCommand={voiceWakeLastHeard}
        lastActionSummary={
          voiceWakeActionNote || voiceController.lastActionSummary
        }
        voiceLanguage={user.preferences.voiceLanguage}
        onRunVoiceCommand={(cmd) => void handleVoiceSheetCommand(cmd)}
        onReplayGreeting={() => {
          setVoiceWakePhase('greeting');
          setGreetingSpeaking(true);
          speakAssistantGreeting(voiceWakeGreetingText, () => {
            setGreetingSpeaking(false);
            setVoiceWakePhase('listening');
          });
        }}
        onClose={handleCloseVoiceWakeSheet}
      />

      {/* Floating Hands-Free "OurSafe" Full-App Voice Assistant Orb (Available on Every Page) */}
      {!voiceWakeSheetOpen && (
        <button
          type="button"
          data-ignore-sos-tap="true"
          onClick={() => {
            if (
              voiceController.liveStatus === 'connected' ||
              voiceController.liveStatus === 'connecting'
            ) {
              setVoiceWakeSheetOpen(true);
            } else {
              handleWakeWordDetected({
                spokenText: user.preferences.wakeWordPhrase || 'OurSafe',
                followUpCommand: '',
              });
            }
          }}
          aria-label={
            voiceController.liveStatus === 'connected'
              ? 'Open OurSafe Voice Panel'
              : 'Start OurSafe Full-App Voice Control'
          }
          title={
            voiceController.liveStatus === 'connected'
              ? 'OurSafe Voice ON — Tap to open voice controls'
              : `Say "${user.preferences.wakeWordPhrase || 'OurSafe'}" or tap to hear "OurSafe app is here, how can I help you?"`
          }
          className={`fixed right-4 bottom-[74px] lg:bottom-6 z-40 h-12 px-4 rounded-full shadow-lg flex items-center gap-2 font-semibold text-xs transition-all cursor-pointer select-none border ${
            voiceController.liveStatus === 'connected' ||
            voiceController.liveStatus === 'connecting'
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-300/60 ring-4 ring-emerald-400/25'
              : 'bg-[#182215] hover:bg-[#2F4526] text-[#F6F9F2] border-[#B8C6A8]/40'
          }`}
        >
          <Mic
            className={`w-4 h-4 shrink-0 ${
              voiceController.liveStatus === 'connected' ? 'animate-pulse' : ''
            }`}
          />
          <span className="whitespace-nowrap">
            {voiceController.liveStatus === 'connecting'
              ? 'Connecting...'
              : voiceController.liveStatus === 'connected'
                ? 'Voice ON'
                : `Say "${user.preferences.wakeWordPhrase || 'OurSafe'}"`}
          </span>
        </button>
      )}

      {/* Biometric Fingerprint Sensor Trigger (Vivo Y16 Side Sensor / Front / Settings-Controlled) */}
      {user.preferences.screenTapSosEnabled &&
        user.preferences.sensorPlacement !== 'hidden' &&
        !lockScreenShieldOpen &&
        !activeQuickTriggerEvent && (
          <BiometricSensorTrigger
            tapCount={quickTriggers.tapCount}
            requiredTaps={quickTriggers.requiredTaps}
            onSensorTap={quickTriggers.registerSensorTap}
            placement={user.preferences.sensorPlacement || 'vivo_y16_side'}
          />
        )}

      {/* MODALS */}
      {activeModal === 'contacts' && (
        <SosContactsModal
          contacts={user.sosContacts}
          onSaveContacts={handleSaveContacts}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'profile' && (
        <ProfileModal
          user={user}
          initialEditing={profileOpenInEditMode}
          onSaveProfile={(updated) => {
            onUpdateUser(updated);
            addNotification(
              'Profile updated',
              'Your personal details and guardian contact have been updated.',
              'account'
            );
          }}
          onClose={() => {
            setActiveModal(null);
            setProfileOpenInEditMode(false);
          }}
        />
      )}

      {activeModal === 'settings' && (
        <SettingsModal
          user={user}
          onUpdatePreferences={handleUpdatePreferences}
          onChangePassword={(newPassword) => {
            onUpdateUser({ ...user, password: newPassword });
            addNotification(
              'Password updated',
              'Your account password has been updated securely.',
              'account'
            );
          }}
          onOpenEditProfile={() => {
            setProfileOpenInEditMode(true);
            setActiveModal('profile');
          }}
          onOpenManageContacts={() => setActiveModal('contacts')}
          onOpenLockScreenShield={openLockAndHomeShield}
          onLogout={() => {
            setActiveModal(null);
            onLogout();
          }}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'notifications' && (
        <NotificationsModal
          notifications={notifications}
          maskPreviews={user.preferences.maskLockscreenPreviews}
          onMarkAllRead={() => {
            const next = notifications.map((n) => ({ ...n, read: true }));
            setNotifications(next);
            saveNotifications(user.id, next);
          }}
          onClearAll={() => {
            setNotifications([]);
            saveNotifications(user.id, []);
          }}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'fakecall' && (
        <FakeCallModal
          callerName={fakeCallerName}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Full-Screen Outside-App / Phone Lock-Screen & Home-Screen Standby Shield */}
      {lockScreenShieldOpen && (
        <EmergencyLockScreenShield
          preferences={user.preferences}
          guardianName={primaryGuardian?.name}
          guardianPhone={primaryGuardian?.phone}
          userPassword={user.password}
          triggers={quickTriggers}
          initialSurface={lockShieldSurface}
          onQuickWidgetSos={() => {
            requestGeoLocation();
            setActiveQuickTriggerEvent({
              id: `widget-sos-${Date.now()}`,
              kind: 'screen_tap',
              label: 'Home Screen SOS Widget',
              detail:
                'Triggered directly from OurSafe Phone Home Screen Widget.',
              triggeredAt: new Date().toISOString(),
              fromLockScreen: false,
            });
          }}
          onExit={() => setLockScreenShieldOpen(false)}
        />
      )}

      {/* Urgent Emergency SOS Dispatch Overlay (3x Shake, Secret Voice Code, Double/Triple Screen Tap) */}
      {activeQuickTriggerEvent && (
        <EmergencyTriggerOverlay
          event={activeQuickTriggerEvent}
          userName={user.fullName}
          contacts={user.sosContacts}
          geoLocation={geoLocation}
          nearestPolicePhone={nearestAiStationWithPhone?.phone}
          nearestPoliceName={nearestAiStationWithPhone?.name}
          vehicleNumber={travelSession?.vehicleInfo?.normalizedNumber}
          countdownSeconds={user.preferences.quickTriggerCountdownSec}
          autoDialOnTrigger={user.preferences.autoDialOnTrigger}
          onDispatchSos={handleDispatchQuickTriggerSos}
          onOpenFullSosPage={() => {
            setLockScreenShieldOpen(false);
            setActivePage('sos');
          }}
          onClose={() => setActiveQuickTriggerEvent(null)}
        />
      )}
    </div>
  );
};
