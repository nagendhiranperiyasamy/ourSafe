import {
  AppNotification,
  EmergencyHistoryEntry,
  SafetyCheckInSession,
  SafetyPreferences,
  TeamInfoConfig,
  ThreatSessionState,
  TravelSession,
  UserProfile,
  UserReviewItem,
} from '../types/safety';

const USERS_KEY = 'aurasafe_users_v1';
const SESSION_KEY = 'aurasafe_session_v1';
const TRAVEL_KEY_PREFIX = 'aurasafe_travel_v1_';
const CHECKIN_KEY_PREFIX = 'aurasafe_checkin_v1_';
const THREAT_KEY_PREFIX = 'aurasafe_threat_v1_';
const HISTORY_KEY_PREFIX = 'aurasafe_history_v1_';
const NOTIFICATIONS_KEY_PREFIX = 'aurasafe_notifications_v1_';
const REVIEWS_KEY = 'aurasafe_reviews_v1';
const TEAM_KEY = 'aurasafe_team_v1';

export const DEFAULT_PREFERENCES: SafetyPreferences = {
  travelCheckInReminders: true,
  guardianUpdates: true,
  soundAlarmEnabled: true,
  locationOnlyDuringEmergency: true,
  maskLockscreenPreviews: false,
  shakeDetectionEnabled: true,
  voiceActivationEnabled: true,
  voiceKeyword: 'Balaji',
  voiceLanguage: 'en-IN',
  screenTapSosEnabled: true,
  screenTapCount: 3,
  autoDialOnTrigger: true,
  quickTriggerCountdownSec: 0,
  quickDialGuardianOnVoiceSos: true,
  wakeWordEnabled: true,
  wakeWordPhrase: 'OurSafe',
  micAlwaysOn: false,
  sensorPlacement: 'vivo_y16_side',
  lockScreenDisplayStyle: 'icon_only',
  autoShareLocationOnTrigger: true,
  alertModeEnabled: false,
  fingerprintSensorTapOnly: true,
  placeInLockShield: false,
};

export const DEMO_ACCOUNT_CREDENTIALS = {
  fullName: 'Maya Sharma',
  phone: '9876543210',
  password: 'Safe@1234',
};

export const DEFAULT_TEAM_INFO: TeamInfoConfig = {
  founderName: 'OurSafe Safety Collective',
  founderIntro:
    'Founded with a singular focus on everyday dignity and personal security, OurSafe brings together calm human-centered design, real-time AI voice command control, and rapid guardian + law-enforcement coordination so women can move freely at any hour.',
  teamMembers:
    'Product & Safety Architecture · Real-Time AI Voice Engineering · Emergency Dispatch & Geospatial Systems · Community Safety Research',
  vision:
    'A world where every woman can commute, travel, and move freely at any hour with immediate, reliable protection and trusted guardian support.',
  mission:
    'Combine real-time voice-controlled emergency actions, AI-located nearby police contacts, proactive threat evidence preservation, and privacy-first personal safety tools into one calm, dependable companion.',
};

const INITIAL_REVIEWS: UserReviewItem[] = [
  {
    id: 'rev-1',
    author: 'Riya K.',
    role: 'Evening Commuter',
    rating: 5,
    comment:
      'Having separate, uncluttered screens for Travel Mode, Threat Mode, and SOS makes it easy to reach the right safety control without panic.',
    createdAt: '2026-10-12T18:30:00.000Z',
    isSample: false,
  },
  {
    id: 'rev-2',
    author: 'Neha M.',
    role: 'University Student',
    rating: 5,
    comment:
      'The AI voice controller calling both my guardian and police—and the discreet Fake Call screen—give me real peace of mind on late-night walks.',
    createdAt: '2026-10-28T20:15:00.000Z',
    isSample: false,
  },
  {
    id: 'rev-3',
    author: 'Kavitha R.',
    role: 'Software Engineer',
    rating: 5,
    comment:
      'Seeing nearby police station numbers immediately inside Threat Mode and keeping my emergency evidence timeline locked behind my password feels thoughtfully engineered.',
    createdAt: '2026-11-05T09:45:00.000Z',
    isSample: false,
  },
];

function createDemoUser(): UserProfile {
  return {
    id: 'demo-user-maya',
    fullName: DEMO_ACCOUNT_CREDENTIALS.fullName,
    phone: DEMO_ACCOUNT_CREDENTIALS.phone,
    email: 'maya.sharma@oursafe.app',
    age: 26,
    guardianName: 'Priya Sharma',
    guardianPhone: '9820112233',
    password: DEMO_ACCOUNT_CREDENTIALS.password,
    createdAt: new Date().toISOString(),
    sosContacts: [
      {
        id: 'contact-primary-demo',
        name: 'Priya Sharma',
        phone: '9820112233',
        relation: 'Primary Guardian',
        isPrimary: true,
      },
      {
        id: 'contact-secondary-demo',
        name: 'Ananya Verma',
        phone: '9811445566',
        relation: 'Trusted Friend',
      },
    ],
    preferences: { ...DEFAULT_PREFERENCES },
  };
}

function hydrateUser(u: UserProfile): UserProfile {
  const existingPrefs = (u.preferences ?? {}) as Partial<SafetyPreferences>;
  const isLegacyPrefs = typeof existingPrefs.screenTapSosEnabled !== 'boolean';
  return {
    ...u,
    preferences: {
      ...DEFAULT_PREFERENCES,
      ...existingPrefs,
      ...(isLegacyPrefs
        ? {
            shakeDetectionEnabled: true,
            voiceActivationEnabled: true,
            voiceKeyword:
              existingPrefs.voiceKeyword && existingPrefs.voiceKeyword !== 'Help me now'
                ? existingPrefs.voiceKeyword
                : DEFAULT_PREFERENCES.voiceKeyword,
            screenTapSosEnabled: true,
            screenTapCount: 3,
            autoDialOnTrigger: true,
            quickTriggerCountdownSec: 0,
            quickDialGuardianOnVoiceSos: true,
            wakeWordEnabled: true,
            wakeWordPhrase: 'OurSafe',
            micAlwaysOn: false,
            sensorPlacement: 'vivo_y16_side',
            lockScreenDisplayStyle: 'icon_only',
            autoShareLocationOnTrigger: true,
          }
        : {}),
    },
    sosContacts: Array.isArray(u.sosContacts) ? u.sosContacts : [],
  };
}

export function normalizePhone(value: string): string {
  return value.replace(/[\s\-().]/g, '');
}

export function isValidPhoneNumber(value: string): boolean {
  const cleaned = normalizePhone(value);
  return /^\+?\d{10,15}$/.test(cleaned);
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function formatPhoneForTel(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

export function generateDemoOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function getUsers(): UserProfile[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) {
      const seeded = [createDemoUser()];
      localStorage.setItem(USERS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seeded = [createDemoUser()];
      localStorage.setItem(USERS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return (parsed as UserProfile[]).map(hydrateUser);
  } catch {
    return [createDemoUser()];
  }
}

export function saveUsers(users: UserProfile[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function findUserByIdentifier(identifier: string): UserProfile | undefined {
  const trimmed = identifier.trim();
  const normalizedPhone = normalizePhone(trimmed);
  const lower = trimmed.toLowerCase();
  return getUsers().find(
    (u) =>
      normalizePhone(u.phone) === normalizedPhone ||
      u.fullName.trim().toLowerCase() === lower ||
      u.email.trim().toLowerCase() === lower
  );
}

export function registerUser(newUser: UserProfile): { ok: boolean; error?: string } {
  const users = getUsers();
  const normalizedPhone = normalizePhone(newUser.phone);
  const existsPhone = users.some((u) => normalizePhone(u.phone) === normalizedPhone);
  if (existsPhone) {
    return {
      ok: false,
      error: 'An account with this phone number already exists. Please sign in instead.',
    };
  }
  const existsEmail = users.some(
    (u) => u.email.trim().toLowerCase() === newUser.email.trim().toLowerCase()
  );
  if (existsEmail) {
    return {
      ok: false,
      error: 'An account with this email address already exists. Please sign in instead.',
    };
  }
  const updated = [...users, hydrateUser(newUser)];
  saveUsers(updated);
  setSessionUserId(newUser.id);
  return { ok: true };
}

export function updateUserProfile(updatedUser: UserProfile): UserProfile {
  const hydrated = hydrateUser(updatedUser);
  const users = getUsers();
  const next = users.map((u) => (u.id === hydrated.id ? hydrated : u));
  saveUsers(next);
  return hydrated;
}

export function resetPasswordByIdentifier(
  identifier: string,
  newPassword: string
): { ok: boolean; error?: string } {
  const users = getUsers();
  const target = findUserByIdentifier(identifier);
  if (!target) {
    return {
      ok: false,
      error: 'No account matches that phone number, name, or email.',
    };
  }
  const next = users.map((u) =>
    u.id === target.id ? { ...u, password: newPassword } : u
  );
  saveUsers(next);
  return { ok: true };
}

export function setSessionUserId(userId: string): void {
  localStorage.setItem(SESSION_KEY, userId);
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function getActiveSessionUser(): UserProfile | null {
  try {
    const id = localStorage.getItem(SESSION_KEY);
    if (!id) return null;
    const users = getUsers();
    return users.find((u) => u.id === id) ?? null;
  } catch {
    return null;
  }
}

export function getEmergencyFallbackUser(): UserProfile {
  const active = getActiveSessionUser();
  if (active) return active;
  const users = getUsers();
  return users[users.length - 1] ?? createDemoUser();
}

export function getTravelSession(userId: string): TravelSession | null {
  try {
    const raw = localStorage.getItem(`${TRAVEL_KEY_PREFIX}${userId}`);
    if (!raw) return null;
    return JSON.parse(raw) as TravelSession;
  } catch {
    return null;
  }
}

export function saveTravelSession(userId: string, session: TravelSession | null): void {
  if (!session) {
    localStorage.removeItem(`${TRAVEL_KEY_PREFIX}${userId}`);
    return;
  }
  localStorage.setItem(`${TRAVEL_KEY_PREFIX}${userId}`, JSON.stringify(session));
}

export function getSafetyCheckIn(userId: string): SafetyCheckInSession | null {
  try {
    const raw = localStorage.getItem(`${CHECKIN_KEY_PREFIX}${userId}`);
    if (!raw) return null;
    return JSON.parse(raw) as SafetyCheckInSession;
  } catch {
    return null;
  }
}

export function saveSafetyCheckIn(
  userId: string,
  session: SafetyCheckInSession | null
): void {
  if (!session) {
    localStorage.removeItem(`${CHECKIN_KEY_PREFIX}${userId}`);
    return;
  }
  localStorage.setItem(`${CHECKIN_KEY_PREFIX}${userId}`, JSON.stringify(session));
}

export function getThreatSession(userId: string): ThreatSessionState | null {
  try {
    const raw = localStorage.getItem(`${THREAT_KEY_PREFIX}${userId}`);
    if (!raw) return null;
    return JSON.parse(raw) as ThreatSessionState;
  } catch {
    return null;
  }
}

export function saveThreatSession(
  userId: string,
  session: ThreatSessionState | null
): void {
  if (!session) {
    localStorage.removeItem(`${THREAT_KEY_PREFIX}${userId}`);
    return;
  }
  localStorage.setItem(`${THREAT_KEY_PREFIX}${userId}`, JSON.stringify(session));
}

export function getEmergencyHistory(userId: string): EmergencyHistoryEntry[] {
  try {
    const raw = localStorage.getItem(`${HISTORY_KEY_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as EmergencyHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveEmergencyHistory(
  userId: string,
  entries: EmergencyHistoryEntry[]
): void {
  localStorage.setItem(
    `${HISTORY_KEY_PREFIX}${userId}`,
    JSON.stringify(entries.slice(0, 120))
  );
}

export function getNotifications(userId: string): AppNotification[] {
  try {
    const raw = localStorage.getItem(`${NOTIFICATIONS_KEY_PREFIX}${userId}`);
    if (!raw) {
      return [
        {
          id: 'welcome-notif',
          title: 'Safety profile ready',
          detail:
            'Your trusted guardian circle is cached locally for offline readiness. Try the AI Voice Controller or dedicated safety modes anytime.',
          timestamp: new Date().toISOString(),
          category: 'account',
          read: false,
        },
      ];
    }
    return JSON.parse(raw) as AppNotification[];
  } catch {
    return [];
  }
}

export function saveNotifications(
  userId: string,
  notifications: AppNotification[]
): void {
  localStorage.setItem(
    `${NOTIFICATIONS_KEY_PREFIX}${userId}`,
    JSON.stringify(notifications.slice(0, 40))
  );
}

export function getReviews(): UserReviewItem[] {
  try {
    const raw = localStorage.getItem(REVIEWS_KEY);
    if (!raw) {
      localStorage.setItem(REVIEWS_KEY, JSON.stringify(INITIAL_REVIEWS));
      return INITIAL_REVIEWS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return INITIAL_REVIEWS;
    }
    return (parsed as UserReviewItem[]).map((item) => ({
      ...item,
      role: item.role.replace(/\s*\(Sample Prototype Review\)/gi, ''),
      isSample: false,
    }));
  } catch {
    return INITIAL_REVIEWS;
  }
}

export function saveReviews(reviews: UserReviewItem[]): void {
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
}

export function getTeamInfo(): TeamInfoConfig {
  try {
    const raw = localStorage.getItem(TEAM_KEY);
    if (!raw) return DEFAULT_TEAM_INFO;
    const parsed = JSON.parse(raw) as Partial<TeamInfoConfig>;
    if (
      parsed.founderName?.includes('Click Edit to Customize') ||
      parsed.founderIntro?.includes('Placeholder founder bio')
    ) {
      localStorage.setItem(TEAM_KEY, JSON.stringify(DEFAULT_TEAM_INFO));
      return DEFAULT_TEAM_INFO;
    }
    return { ...DEFAULT_TEAM_INFO, ...parsed };
  } catch {
    return DEFAULT_TEAM_INFO;
  }
}

export function saveTeamInfo(info: TeamInfoConfig): void {
  localStorage.setItem(TEAM_KEY, JSON.stringify(info));
}

export function formatTimeShort(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function formatDateTimeShort(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}
