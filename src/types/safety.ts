export type ActiveScreen = 'login' | 'signup' | 'home';

export type AppPage =
  | 'home'
  | 'sos'
  | 'threat'
  | 'travel'
  | 'assistant'
  | 'nearby'
  | 'history';

export type ActiveModal =
  | null
  | 'contacts'
  | 'profile'
  | 'settings'
  | 'notifications'
  | 'fakecall';

export interface SosContact {
  id: string;
  name: string;
  phone: string;
  relation: string;
  isPrimary?: boolean;
}

export interface SafetyPreferences {
  travelCheckInReminders: boolean;
  guardianUpdates: boolean;
  soundAlarmEnabled: boolean;
  locationOnlyDuringEmergency: boolean;
  maskLockscreenPreviews: boolean;
  shakeDetectionEnabled: boolean;
  voiceActivationEnabled: boolean;
  voiceKeyword: string;
  voiceLanguage: 'en-IN' | 'en-US' | 'ta-IN';
  screenTapSosEnabled: boolean;
  screenTapCount: 2 | 3;
  autoDialOnTrigger: boolean;
  quickTriggerCountdownSec: 0 | 3;
  quickDialGuardianOnVoiceSos: boolean;
  wakeWordEnabled: boolean;
  wakeWordPhrase: string;
  micAlwaysOn: boolean;
  sensorPlacement: 'vivo_y16_side' | 'front_center' | 'hidden';
  lockScreenDisplayStyle: 'icon_only' | 'icon_and_name';
  autoShareLocationOnTrigger: boolean;
  alertModeEnabled: boolean;
  fingerprintSensorTapOnly: boolean;
  placeInLockShield: boolean;
}

export type QuickTriggerKind = 'shake' | 'voice_code' | 'screen_tap';

export interface QuickTriggerEvent {
  id: string;
  kind: QuickTriggerKind;
  label: string;
  detail: string;
  triggeredAt: string;
  fromLockScreen: boolean;
}

export interface UserProfile {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  age: number;
  guardianName: string;
  guardianPhone: string;
  password: string;
  photoDataUrl?: string;
  createdAt: string;
  sosContacts: SosContact[];
  preferences: SafetyPreferences;
}

export interface VehicleVerificationRecord {
  id: string;
  vehicleNumber: string;
  normalizedNumber: string;
  vehicleType: string;
  stateRegion: string;
  formatValid: boolean;
  authenticityStatus: 'format_verified' | 'suspicious_or_invalid' | 'unrecognized';
  riskWarnings: string[];
  summary: string;
  photoDataUrl?: string;
  extractedFromPhoto?: boolean;
  verifiedAt: string;
}

export interface TravelSession {
  active: boolean;
  startLocation: string;
  destination: string;
  guardianId: string;
  guardianName: string;
  guardianPhone: string;
  startedAt: string;
  lastCheckInAt: string;
  vehicleInfo?: VehicleVerificationRecord;
  routeDistanceKm?: number;
  routeDurationMin?: number;
  offRouteAlertActive?: boolean;
  offRouteDistanceMeters?: number;
}

export interface SafetyCheckInSession {
  active: boolean;
  label: string;
  guardianId: string;
  guardianName: string;
  guardianPhone: string;
  durationSeconds: number;
  startedAt: string;
  dueAt: string;
  status: 'active' | 'confirmed' | 'missed';
}

export interface LiveLocationShareSession {
  active: boolean;
  startedAt: string;
  durationMinutes: number;
  sharedWithNames: string[];
  sharedWithPolice?: boolean;
  nearestPoliceName?: string;
  nearestPolicePhone?: string;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastUpdatedAt: string;
}

export type AlertDeliveryStatus =
  | 'standby'
  | 'initiated'
  | 'delivered_demo'
  | 'queued_offline'
  | 'failed';

export interface SosAlertRecord {
  id: string;
  activatedAt: string;
  triggerSource: string;
  status: AlertDeliveryStatus;
  latitude: number | null;
  longitude: number | null;
  recipients: Array<{
    name: string;
    phone: string;
    status: 'initiated' | 'delivered_demo' | 'queued_offline' | 'failed';
  }>;
  note?: string;
}

export interface ThreatSessionState {
  active: boolean;
  sessionId: string;
  activatedAt: string;
  lastHeartbeatAt: string;
  lastLatitude: number | null;
  lastLongitude: number | null;
  batteryPercent: number | null;
  isOnline: boolean;
  recordingMode: 'none' | 'audio' | 'video';
  guardianNotificationStatus: AlertDeliveryStatus;
  interruptedUnexpectedly?: boolean;
}

export type EmergencyHistoryCategory =
  | 'sos'
  | 'threat'
  | 'location'
  | 'recording'
  | 'connectivity'
  | 'guardian'
  | 'checkin';

export interface EmergencyHistoryEntry {
  id: string;
  timestamp: string;
  category: EmergencyHistoryCategory;
  title: string;
  detail: string;
  statusLabel?: string;
  locationCoords?: string;
  recordingId?: string;
  recordingKind?: 'audio' | 'video';
}

export interface StoredRecordingMeta {
  id: string;
  userId: string;
  kind: 'audio' | 'video';
  mimeType: string;
  createdAt: string;
  durationSec: number;
  sizeBytes: number;
  sessionId?: string;
  locationCoords?: string;
  sharedWithGuardians?: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  category: 'travel' | 'sos' | 'account' | 'safety';
  read: boolean;
}

export interface UserReviewItem {
  id: string;
  author: string;
  role: string;
  rating: number;
  comment: string;
  createdAt: string;
  isSample: boolean;
}

export interface TeamInfoConfig {
  founderName: string;
  founderIntro: string;
  teamMembers: string;
  vision: string;
  mission: string;
}

export interface GeoLocationState {
  status: 'idle' | 'loading' | 'granted' | 'denied' | 'unsupported';
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  errorMessage?: string;
  updatedAt?: string;
}

export interface VoiceCommandAction {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface NearbyPoliceMapLink {
  title: string;
  uri: string;
}

export interface NearbyPoliceStationEntry {
  name: string;
  phone?: string;
  address?: string;
  mapsUri?: string;
}

export interface NearbyPoliceAiResult {
  summaryText: string;
  stations: NearbyPoliceStationEntry[];
  mapLinks: NearbyPoliceMapLink[];
  queriedAt: string;
  locationLabel: string;
}

export interface DualCallDispatchState {
  active: boolean;
  triggeredBy: string;
  triggeredAt: string;
  guardianName: string | null;
  guardianPhone: string | null;
  policeName: string;
  policePhone: string;
  nearestStationName?: string;
  nearestStationPhone?: string;
  guardianDialAttempted?: boolean;
  policeDialAttempted?: boolean;
}

