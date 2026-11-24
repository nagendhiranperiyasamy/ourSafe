import { QuickTriggerKind, SafetyPreferences } from '../types/safety';

export interface NativeShieldSyncPayload {
  enabled: boolean;
  shakeEnabled: boolean;
  shakeCountRequired: number;
  voiceCodeEnabled: boolean;
  secretVoiceCode: string;
  voiceLanguage: 'en-IN' | 'en-US' | 'ta-IN';
  wakeWordEnabled: boolean;
  wakeWordPhrase: string;
  screenTapEnabled: boolean;
  screenTapCount: 2 | 3;
  lockScreenDisplayStyle: 'icon_only' | 'icon_and_name';
  autoShareLocationOnTrigger: boolean;
  autoDialEnabled: boolean;
  countdownSeconds: 0 | 3;
  userName: string;
  guardianName: string;
  guardianPhone: string;
  policePhone: string;
}

export interface NativeShieldStatus {
  isNativeAndroid: boolean;
  serviceRunning: boolean;
  overlayPermissionGranted: boolean;
  accessibilityPermissionGranted: boolean;
  callPermissionGranted: boolean;
  micPermissionGranted: boolean;
}

interface OurSafeNativePlugin {
  syncConfig: (payload: NativeShieldSyncPayload) => Promise<{ ok: boolean }>;
  startLockAndHomeShield: (
    payload: NativeShieldSyncPayload
  ) => Promise<{ ok: boolean; serviceRunning: boolean }>;
  stopLockAndHomeShield: () => Promise<{ ok: boolean }>;
  getStatus: () => Promise<NativeShieldStatus>;
  requestOverlayPermission: () => Promise<{ granted: boolean }>;
  openAccessibilitySettings: () => Promise<void>;
  addListener?: (
    eventName: 'nativeSosTriggered',
    listenerFunc: (data: {
      kind: QuickTriggerKind;
      label: string;
      detail: string;
      surface: 'lock_screen' | 'home_screen';
    }) => void
  ) => Promise<{ remove: () => Promise<void> }>;
}

interface CapacitorWindow {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
    Plugins?: {
      OurSafeShield?: OurSafeNativePlugin;
    };
  };
}

function getNativePlugin(): OurSafeNativePlugin | null {
  if (typeof window === 'undefined') return null;
  const cap = (window as unknown as CapacitorWindow).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.OurSafeShield ?? null;
}

export function isRunningInNativeAndroidApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as CapacitorWindow).Capacitor;
  return Boolean(
    cap?.isNativePlatform?.() && cap?.getPlatform?.() === 'android'
  );
}

export function buildNativeSyncPayload(params: {
  preferences: SafetyPreferences;
  userName: string;
  guardianName?: string;
  guardianPhone?: string;
  policePhone?: string;
}): NativeShieldSyncPayload {
  return {
    enabled:
      params.preferences.shakeDetectionEnabled ||
      params.preferences.voiceActivationEnabled ||
      params.preferences.screenTapSosEnabled ||
      params.preferences.wakeWordEnabled,
    shakeEnabled: params.preferences.shakeDetectionEnabled,
    shakeCountRequired: 3,
    voiceCodeEnabled: params.preferences.voiceActivationEnabled,
    secretVoiceCode: params.preferences.voiceKeyword.trim() || 'Red Rose',
    voiceLanguage: params.preferences.voiceLanguage || 'en-IN',
    wakeWordEnabled: params.preferences.wakeWordEnabled,
    wakeWordPhrase: params.preferences.wakeWordPhrase.trim() || 'OurSafe',
    screenTapEnabled: params.preferences.screenTapSosEnabled,
    screenTapCount: params.preferences.screenTapCount === 2 ? 2 : 3,
    lockScreenDisplayStyle:
      params.preferences.lockScreenDisplayStyle || 'icon_and_name',
    autoShareLocationOnTrigger:
      params.preferences.autoShareLocationOnTrigger !== false,
    autoDialEnabled: params.preferences.autoDialOnTrigger,
    countdownSeconds: params.preferences.quickTriggerCountdownSec,
    userName: params.userName,
    guardianName: params.guardianName || '',
    guardianPhone: params.guardianPhone || '',
    policePhone: params.policePhone || '100',
  };
}

export async function syncNativeLockAndHomeShield(
  payload: NativeShieldSyncPayload
): Promise<boolean> {
  const plugin = getNativePlugin();
  if (!plugin) return false;
  try {
    const res = await plugin.syncConfig(payload);
    return Boolean(res?.ok);
  } catch {
    return false;
  }
}

export async function startNativeLockAndHomeShield(
  payload: NativeShieldSyncPayload
): Promise<boolean> {
  const plugin = getNativePlugin();
  if (!plugin) return false;
  try {
    const res = await plugin.startLockAndHomeShield(payload);
    return Boolean(res?.ok && res?.serviceRunning);
  } catch {
    return false;
  }
}

export async function stopNativeLockAndHomeShield(): Promise<boolean> {
  const plugin = getNativePlugin();
  if (!plugin) return false;
  try {
    const res = await plugin.stopLockAndHomeShield();
    return Boolean(res?.ok);
  } catch {
    return false;
  }
}

export async function getNativeShieldStatus(): Promise<NativeShieldStatus> {
  const plugin = getNativePlugin();
  if (!plugin) {
    return {
      isNativeAndroid: false,
      serviceRunning: false,
      overlayPermissionGranted: false,
      accessibilityPermissionGranted: false,
      callPermissionGranted: false,
      micPermissionGranted: false,
    };
  }
  try {
    return await plugin.getStatus();
  } catch {
    return {
      isNativeAndroid: isRunningInNativeAndroidApp(),
      serviceRunning: false,
      overlayPermissionGranted: false,
      accessibilityPermissionGranted: false,
      callPermissionGranted: false,
      micPermissionGranted: false,
    };
  }
}

export async function requestNativeOverlayPermission(): Promise<boolean> {
  const plugin = getNativePlugin();
  if (!plugin) return false;
  try {
    const res = await plugin.requestOverlayPermission();
    return Boolean(res?.granted);
  } catch {
    return false;
  }
}

export async function openNativeAccessibilitySettings(): Promise<void> {
  const plugin = getNativePlugin();
  if (!plugin) return;
  try {
    await plugin.openAccessibilitySettings();
  } catch {
    // Ignore
  }
}

export function subscribeNativeSosTriggers(
  onTrigger: (data: {
    kind: QuickTriggerKind;
    label: string;
    detail: string;
    surface: 'lock_screen' | 'home_screen';
  }) => void
): () => void {
  const plugin = getNativePlugin();
  if (!plugin?.addListener) return () => undefined;

  let handle: { remove: () => Promise<void> } | null = null;
  void plugin
    .addListener('nativeSosTriggered', onTrigger)
    .then((h) => {
      handle = h;
    })
    .catch(() => undefined);

  return () => {
    if (handle) {
      void handle.remove().catch(() => undefined);
    }
  };
}
