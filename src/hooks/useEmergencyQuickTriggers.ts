import { useCallback, useEffect, useRef, useState } from 'react';
import {
  QuickTriggerEvent,
  QuickTriggerKind,
  SafetyPreferences,
} from '../types/safety';

interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

interface DeviceMotionWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
}

export interface EmergencyQuickTriggersOptions {
  preferences: SafetyPreferences;
  /** True when full-screen Lock-Screen / Pocket Standby Shield is visible */
  isLockScreenActive: boolean;
  /** Temporarily pause global tap/voice capture when SOS overlay or AI Voice Live mic is active */
  suspended?: boolean;
  /** When Alert Mode or Threat Mode is active, locks the microphone steadily on */
  alertModeActive?: boolean;
  onTriggerSos: (event: QuickTriggerEvent) => void;
  /** Fired when the user says the "OurSafe" wake word (Hey-Google style hands-free launch) */
  onWakeWordDetected?: (payload: {
    spokenText: string;
    followUpCommand: string;
  }) => void;
}

export interface EmergencyQuickTriggersState {
  // 1. Shake state
  shakeCount: number;
  shakeSensorSupported: boolean;
  motionPermissionState: 'granted' | 'prompt' | 'denied' | 'unsupported';
  requestMotionPermission: () => Promise<boolean>;
  simulateShakeImpulse: () => void;

  // 2. Voice Secret Code + "OurSafe" Wake Word state
  voiceSupported: boolean;
  voiceListening: boolean;
  voiceError: string;
  lastHeardTranscript: string;
  startVoiceWakeListener: () => void;
  stopVoiceWakeListener: () => void;
  toggleVoiceWakeListener: () => void;
  testSecretVoicePhrase: (spokenText: string) => {
    matched: boolean;
    normalizedHeard: string;
  };
  testWakeWordPhrase: (spokenText?: string) => {
    matched: boolean;
    followUpCommand: string;
  };

  // 3. Screen Tap state
  tapCount: number;
  requiredTaps: 2 | 3;
  registerSensorTap: () => void;

  // Screen Wake Lock (keeps Lock-Screen Standby Shield alive)
  wakeLockActive: boolean;
  requestWakeLock: () => Promise<boolean>;
  releaseWakeLock: () => Promise<void>;
}

const SHAKE_WINDOW_MS = 3200;
const SHAKE_COOLDOWN_MS = 240;
const SHAKE_THRESHOLD = 11.5;
const TAP_WINDOW_MS = 2200;
const TAP_MAX_DISTANCE_PX = 140;
const TRIGGER_COOLDOWN_MS = 3500;

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function triggerHapticPattern(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore unsupported environments
  }
}

export function playEmergencyTriggerTone() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const freqs = [880, 1175, 880];
    freqs.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + index * 0.14);
      gain.gain.setValueAtTime(0.001, now + index * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.14, now + index * 0.14 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.14 + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + index * 0.14);
      osc.stop(now + index * 0.14 + 0.13);
    });
    window.setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 650);
  } catch {
    // Ignore autoplay restriction errors
  }
}

export function playWakeWordChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.001, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.11, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.15);
    });
    window.setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 500);
  } catch {
    // Ignore autoplay restriction
  }
}

export function useEmergencyQuickTriggers({
  preferences,
  isLockScreenActive,
  suspended = false,
  alertModeActive = false,
  onTriggerSos,
  onWakeWordDetected,
}: EmergencyQuickTriggersOptions): EmergencyQuickTriggersState {
  const [shakeCount, setShakeCount] = useState(0);
  const [tapCount, setTapCount] = useState(0);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [lastHeardTranscript, setLastHeardTranscript] = useState('');
  const [wakeLockActive, setWakeLockActive] = useState(false);

  const shakeSensorSupported =
    typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
  const voiceSupported = getSpeechRecognitionCtor() !== null;

  const [motionPermissionState, setMotionPermissionState] = useState<
    'granted' | 'prompt' | 'denied' | 'unsupported'
  >(() => {
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
      return 'unsupported';
    }
    const dm = window.DeviceMotionEvent as unknown as DeviceMotionWithPermission;
    return typeof dm?.requestPermission === 'function' ? 'prompt' : 'granted';
  });

  const lastTriggerAtRef = useRef<number>(0);
  const lastWakeWordAtRef = useRef<number>(0);
  const shakeTimestampsRef = useRef<number[]>([]);
  const lastShakeImpulseRef = useRef<number>(0);
  const lastAccelRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const shakeResetTimerRef = useRef<number | null>(null);

  const tapRecordsRef = useRef<Array<{ time: number; x: number; y: number }>>([]);
  const tapResetTimerRef = useRef<number | null>(null);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const shouldKeepVoiceRunningRef = useRef<boolean>(false);
  const voiceRestartTimerRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const autoArmedGestureRef = useRef<boolean>(false);

  const prefsRef = useRef(preferences);
  useEffect(() => {
    prefsRef.current = preferences;
  }, [preferences]);

  const lockScreenRef = useRef(isLockScreenActive);
  useEffect(() => {
    lockScreenRef.current = isLockScreenActive;
  }, [isLockScreenActive]);

  const suspendedRef = useRef(suspended);
  useEffect(() => {
    suspendedRef.current = suspended;
  }, [suspended]);

  const onTriggerRef = useRef(onTriggerSos);
  useEffect(() => {
    onTriggerRef.current = onTriggerSos;
  }, [onTriggerSos]);

  const onWakeWordRef = useRef(onWakeWordDetected);
  useEffect(() => {
    onWakeWordRef.current = onWakeWordDetected;
  }, [onWakeWordDetected]);

  const fireSosTrigger = useCallback(
    (kind: QuickTriggerKind, label: string, detail: string) => {
      if (suspendedRef.current) return;
      const now = Date.now();
      if (now - lastTriggerAtRef.current < TRIGGER_COOLDOWN_MS) return;
      lastTriggerAtRef.current = now;

      triggerHapticPattern([180, 80, 180, 80, 320]);
      if (prefsRef.current.soundAlarmEnabled) {
        playEmergencyTriggerTone();
      }

      onTriggerRef.current({
        id: `qtrig-${now}`,
        kind,
        label,
        detail,
        triggeredAt: new Date(now).toISOString(),
        fromLockScreen: lockScreenRef.current,
      });
    },
    []
  );

  // ==========================================================
  // 1. TRIPLE PHONE SHAKE DETECTOR (3 Shakes -> SOS Call)
  // ==========================================================
  const registerShakeImpulse = useCallback(() => {
    if (!prefsRef.current.shakeDetectionEnabled || suspendedRef.current) return;
    const now = Date.now();
    if (now - lastShakeImpulseRef.current < SHAKE_COOLDOWN_MS) return;
    lastShakeImpulseRef.current = now;

    const recent = shakeTimestampsRef.current.filter(
      (t) => now - t <= SHAKE_WINDOW_MS
    );
    recent.push(now);
    shakeTimestampsRef.current = recent;

    const count = recent.length;
    setShakeCount(count);
    triggerHapticPattern(45);

    if (shakeResetTimerRef.current !== null) {
      window.clearTimeout(shakeResetTimerRef.current);
    }

    if (count >= 3) {
      shakeTimestampsRef.current = [];
      setShakeCount(0);
      fireSosTrigger(
        'shake',
        '3x Phone Shake Emergency',
        'Detected 3 rapid phone shakes within 2.5 seconds. Launching emergency SOS call.'
      );
      return;
    }

    shakeResetTimerRef.current = window.setTimeout(() => {
      shakeTimestampsRef.current = [];
      setShakeCount(0);
    }, SHAKE_WINDOW_MS);
  }, [fireSosTrigger]);

  const requestMotionPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
      setMotionPermissionState('unsupported');
      return false;
    }
    const dm = window.DeviceMotionEvent as unknown as DeviceMotionWithPermission;
    if (typeof dm?.requestPermission !== 'function') {
      setMotionPermissionState('granted');
      return true;
    }
    try {
      const result = await dm.requestPermission();
      setMotionPermissionState(result === 'granted' ? 'granted' : 'denied');
      return result === 'granted';
    } catch {
      setMotionPermissionState('denied');
      return false;
    }
  }, []);

  useEffect(() => {
    if (!preferences.shakeDetectionEnabled || suspended) return;
    if (!shakeSensorSupported || motionPermissionState !== 'granted') return;

    const handleDeviceMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity ?? event.acceleration;
      if (!acc) return;
      const x = acc.x ?? 0;
      const y = acc.y ?? 0;
      const z = acc.z ?? 0;

      const prev = lastAccelRef.current;
      lastAccelRef.current = { x, y, z };
      if (!prev) return;

      const delta = Math.sqrt(
        (x - prev.x) ** 2 + (y - prev.y) ** 2 + (z - prev.z) ** 2
      );

      if (delta >= SHAKE_THRESHOLD) {
        registerShakeImpulse();
      }
    };

    window.addEventListener('devicemotion', handleDeviceMotion);
    return () => {
      window.removeEventListener('devicemotion', handleDeviceMotion);
      lastAccelRef.current = null;
    };
  }, [
    preferences.shakeDetectionEnabled,
    suspended,
    shakeSensorSupported,
    motionPermissionState,
    registerShakeImpulse,
  ]);

  // ==========================================================
  // 2. ALWAYS-ON SECRET CODE + "OURSAFE" WAKE WORD LISTENER ("Hey Google" Style)
  // ==========================================================
  const matchWakeWordAndExtract = useCallback(
    (normalizedHeard: string): { matched: boolean; followUpCommand: string } => {
      const rawWake = prefsRef.current.wakeWordPhrase?.trim() || 'OurSafe';
      const normalizedWake = normalizeText(rawWake);
      const candidates = [
        normalizedWake,
        'hey oursafe',
        'hey our safe',
        'ok oursafe',
        'ok our safe',
        'hey house safe',
        'ok house safe',
        'our safe',
        'oursafe',
        'house safe',
        'housesafe',
        'hour safe',
        'are safe',
        'how safe',
        'all safe',
        'ஹவுஸ் சேஃப்',
        'அவர் சேஃப்',
        'அவர்சேஃப்',
      ].filter(Boolean);

      for (const candidate of candidates) {
        const idx = normalizedHeard.indexOf(candidate);
        if (idx !== -1) {
          const after = normalizedHeard.slice(idx + candidate.length).trim();
          return { matched: true, followUpCommand: after };
        }
      }

      const compactHeard = normalizedHeard.replace(/\s+/g, '');
      const compactWake = normalizedWake.replace(/\s+/g, '');
      if (
        (compactWake && compactHeard.includes(compactWake)) ||
        compactHeard.includes('housesafe') ||
        compactHeard.includes('oursafe')
      ) {
        return { matched: true, followUpCommand: '' };
      }
      return { matched: false, followUpCommand: '' };
    },
    []
  );

  const evaluateSpokenPhrase = useCallback(
    (spokenText: string): { matched: boolean; normalizedHeard: string } => {
      const normalizedHeard = normalizeText(spokenText);
      const rawCode = prefsRef.current.voiceKeyword.trim() || 'Red Rose';
      const normalizedCode = normalizeText(rawCode);

      setLastHeardTranscript(spokenText.trim());

      if (!normalizedHeard) {
        return { matched: false, normalizedHeard };
      }

      // Priority 1: Emergency Secret Code ("Balaji", "Red Rose") -> Instant SOS Call + Live GPS Share
      if (normalizedCode && (prefsRef.current.voiceActivationEnabled || prefsRef.current.micAlwaysOn) && !suspendedRef.current) {
        const compactHeard = normalizedHeard.replace(/\s+/g, '');
        const compactCode = normalizedCode.replace(/\s+/g, '');
        let matchedCode =
          normalizedHeard.includes(normalizedCode) ||
          compactHeard.includes(compactCode);

        // Phonetic matching for Indian names like "Balaji", "Bala ji", "Balajee", "பாலாஜி"
        if (!matchedCode && (normalizedCode.includes('balaji') || normalizedCode.includes('bala'))) {
          if (
            normalizedHeard.includes('balaji') ||
            normalizedHeard.includes('bala') ||
            normalizedHeard.includes('balajee') ||
            normalizedHeard.includes('palani') ||
            normalizedHeard.includes('பாலாஜி') ||
            compactHeard.includes('balaji') ||
            compactHeard.includes('balajee')
          ) {
            matchedCode = true;
          }
        }

        if (matchedCode) {
          fireSosTrigger(
            'voice_code',
            `Secret Voice Code ("${rawCode}")`,
            `Heard secret emergency phrase "${spokenText.trim()}" matching code "${rawCode}". Automatically calling SOS & sharing live location.`
          );
          return { matched: true, normalizedHeard };
        }
      }

      // Priority 2: "OurSafe" Wake Word (Hey-Google style app launch & full voice control)
      if (prefsRef.current.wakeWordEnabled && !suspendedRef.current && onWakeWordRef.current) {
        const wakeCheck = matchWakeWordAndExtract(normalizedHeard);
        if (wakeCheck.matched) {
          const now = Date.now();
          if (now - lastWakeWordAtRef.current > 2400) {
            lastWakeWordAtRef.current = now;
            triggerHapticPattern([60, 40, 80]);
            playWakeWordChime();
            onWakeWordRef.current({
              spokenText: spokenText.trim(),
              followUpCommand: wakeCheck.followUpCommand,
            });
          }
          return { matched: true, normalizedHeard };
        }
      }

      return { matched: false, normalizedHeard };
    },
    [fireSosTrigger, matchWakeWordAndExtract]
  );

  const testWakeWordPhrase = useCallback(
    (spokenText?: string): { matched: boolean; followUpCommand: string } => {
      const phrase =
        spokenText?.trim() ||
        prefsRef.current.wakeWordPhrase?.trim() ||
        'OurSafe';
      const normalized = normalizeText(phrase);
      const wakeCheck = matchWakeWordAndExtract(normalized);
      if (wakeCheck.matched && prefsRef.current.wakeWordEnabled && onWakeWordRef.current) {
        lastWakeWordAtRef.current = Date.now();
        triggerHapticPattern([60, 40, 80]);
        playWakeWordChime();
        onWakeWordRef.current({
          spokenText: phrase,
          followUpCommand: wakeCheck.followUpCommand,
        });
      }
      return wakeCheck;
    },
    [matchWakeWordAndExtract]
  );

  const stopVoiceWakeListener = useCallback(() => {
    shouldKeepVoiceRunningRef.current = false;
    if (voiceRestartTimerRef.current !== null) {
      window.clearTimeout(voiceRestartTimerRef.current);
      voiceRestartTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
    }
    setVoiceListening(false);
  }, []);

  const startVoiceWakeListener = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setVoiceError(
        'Continuous browser speech recognition works best in Chrome, Edge, or Android browsers. Use the Voice Test buttons anytime.'
      );
      return;
    }

    if (
      !prefsRef.current.voiceActivationEnabled &&
      !prefsRef.current.wakeWordEnabled &&
      !prefsRef.current.micAlwaysOn
    ) {
      setVoiceError('Enable Secret Voice Code or "OurSafe" Wake Word in Settings first.');
      return;
    }

    setVoiceError('');
    shouldKeepVoiceRunningRef.current = true;

    const launchInstance = () => {
      if (!shouldKeepVoiceRunningRef.current || suspendedRef.current) return;
      try {
        const rec = new Ctor();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = prefsRef.current.voiceLanguage || 'en-IN';

        rec.onstart = () => {
          setVoiceListening(true);
          setVoiceError('');
        };

        rec.onresult = (event) => {
          let combined = '';
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            combined += ` ${event.results[i][0].transcript}`;
          }
          const snippet = combined.trim();
          if (snippet) {
            evaluateSpokenPhrase(snippet);
          }
        };

        rec.onerror = (ev) => {
          const code = ev?.error || 'unknown';
          if (code === 'not-allowed' || code === 'service-not-allowed') {
            shouldKeepVoiceRunningRef.current = false;
            setVoiceListening(false);
            setVoiceError(
              'Microphone permission was blocked. Allow mic access in browser settings to arm hands-free Secret Voice Code.'
            );
          } else if (code === 'audio-capture') {
            shouldKeepVoiceRunningRef.current = false;
            setVoiceListening(false);
            setVoiceError('No microphone detected on this device.');
          }
        };

        rec.onend = () => {
          if (
            shouldKeepVoiceRunningRef.current &&
            (prefsRef.current.voiceActivationEnabled ||
              prefsRef.current.wakeWordEnabled ||
              prefsRef.current.micAlwaysOn) &&
            !suspendedRef.current
          ) {
            voiceRestartTimerRef.current = window.setTimeout(() => {
              launchInstance();
            }, 350);
          } else {
            setVoiceListening(false);
          }
        };

        recognitionRef.current = rec;
        rec.start();
      } catch {
        setVoiceListening(false);
      }
    };

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
    }

    launchInstance();
  }, [evaluateSpokenPhrase]);

  const toggleVoiceWakeListener = useCallback(() => {
    if (voiceListening || shouldKeepVoiceRunningRef.current) {
      stopVoiceWakeListener();
    } else {
      startVoiceWakeListener();
    }
  }, [voiceListening, startVoiceWakeListener, stopVoiceWakeListener]);

  // Pause mic cleanly when voice features are disabled or suspended, and auto-resume when unsuspended
  useEffect(() => {
    const anyVoiceEnabled =
      preferences.voiceActivationEnabled || preferences.wakeWordEnabled || preferences.micAlwaysOn;

    if (preferences.micAlwaysOn && !suspended) {
      if (!recognitionRef.current) {
        startVoiceWakeListener();
      }
      return;
    }

    if (!anyVoiceEnabled || suspended) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch {
          // Ignore
        }
        recognitionRef.current = null;
      }
      setVoiceListening(false);
      return;
    }

    if (shouldKeepVoiceRunningRef.current && !recognitionRef.current) {
      startVoiceWakeListener();
    }
  }, [
    preferences.voiceActivationEnabled,
    preferences.wakeWordEnabled,
    preferences.micAlwaysOn,
    suspended,
    startVoiceWakeListener,
  ]);

  // Mic is strictly user-controlled: only starts when explicit action is initiated, never automatically on tap.
  // When Threat Mode is ON, threatMode.ensureMicAlwaysActive() keeps mic continuously active.

  // Restart recognition smoothly when voiceLanguage changes while listening
  useEffect(() => {
    if (voiceListening && shouldKeepVoiceRunningRef.current) {
      startVoiceWakeListener();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences.voiceLanguage]);

  // ==========================================================
  // 3. FINGERPRINT SENSOR & 3X BIOMETRIC TAP TRIGGER (Scroll-Proof)
  // ==========================================================
  const registerSensorTap = useCallback(() => {
    if (!prefsRef.current.screenTapSosEnabled || suspendedRef.current) return;
    const now = Date.now();
    const requiredTaps = prefsRef.current.screenTapCount === 2 ? 2 : 3;
    const recent = tapRecordsRef.current.filter((item) => now - item.time <= TAP_WINDOW_MS);
    recent.push({ time: now, x: 0, y: 0 });
    tapRecordsRef.current = recent;
    setTapCount(recent.length);
    triggerHapticPattern(55);

    if (tapResetTimerRef.current !== null) {
      window.clearTimeout(tapResetTimerRef.current);
    }

    if (recent.length >= requiredTaps) {
      tapRecordsRef.current = [];
      setTapCount(0);
      fireSosTrigger(
        'screen_tap',
        requiredTaps === 2
          ? 'Double-Tap Biometric Sensor Emergency'
          : '3x Biometric Sensor Tap Emergency',
        `Detected ${requiredTaps} rapid taps on Fingerprint Sensor. Launching emergency SOS call.`
      );
      return;
    }

    tapResetTimerRef.current = window.setTimeout(() => {
      tapRecordsRef.current = [];
      setTapCount(0);
    }, TAP_WINDOW_MS);
  }, [fireSosTrigger]);

  useEffect(() => {
    if (!preferences.screenTapSosEnabled || suspended) {
      setTapCount(0);
      tapRecordsRef.current = [];
      return;
    }

    const requiredTaps = preferences.screenTapCount === 2 ? 2 : 3;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;

      const target = event.target as HTMLElement | null;

      // Never trigger when interacting with explicitly ignored controls
      if (target?.closest('[data-ignore-sos-tap="true"]')) {
        return;
      }

      // If fingerprintSensorTapOnly is active and we are inside the main app (not on lock screen),
      // require the tap to be on the dedicated fingerprint sensor touch zone to prevent accidental scroll taps!
      if (preferences.fingerprintSensorTapOnly && !lockScreenRef.current) {
        if (!target?.closest('[data-fingerprint-sensor="true"]')) {
          return;
        }
      }

      // Inside normal app pages, ignore taps on interactive controls so typing never causes accidental SOS
      if (
        !lockScreenRef.current &&
        target?.closest(
          'button, a, input, textarea, select, label, [role="button"], [role="switch"]'
        ) &&
        !target?.closest('[data-fingerprint-sensor="true"]')
      ) {
        return;
      }

      const now = Date.now();
      const x = event.clientX;
      const y = event.clientY;

      const recent = tapRecordsRef.current.filter((item) => {
        const withinTime = now - item.time <= TAP_WINDOW_MS;
        const dist = Math.hypot(x - item.x, y - item.y);
        return withinTime && dist <= TAP_MAX_DISTANCE_PX;
      });

      recent.push({ time: now, x, y });
      tapRecordsRef.current = recent;
      setTapCount(recent.length);

      if (tapResetTimerRef.current !== null) {
        window.clearTimeout(tapResetTimerRef.current);
      }

      if (recent.length >= requiredTaps) {
        tapRecordsRef.current = [];
        setTapCount(0);
        fireSosTrigger(
          'screen_tap',
          requiredTaps === 2
            ? 'Double-Tap Screen Emergency'
            : '3x Biometric Sensor Tap Emergency',
          `Detected ${requiredTaps} rapid taps${
            lockScreenRef.current ? ' on Lock-Screen Shield' : ' on Fingerprint Sensor'
          }. Launching emergency SOS call.`
        );
        return;
      }

      tapResetTimerRef.current = window.setTimeout(() => {
        tapRecordsRef.current = [];
        setTapCount(0);
      }, TAP_WINDOW_MS);
    };

    const handlePointerMove = (event: PointerEvent) => {
      // If user is dragging or scrolling (pointer moves > 65px), cancel tap accumulation
      if (tapRecordsRef.current.length > 0) {
        const last = tapRecordsRef.current[tapRecordsRef.current.length - 1];
        if (Math.hypot(event.clientX - last.x, event.clientY - last.y) > 65) {
          tapRecordsRef.current = [];
          setTapCount(0);
        }
      }
    };

    const handleScroll = () => {
      // Any page scrolling immediately resets tap sequence so normal scrolling never triggers SOS
      if (tapRecordsRef.current.length > 0) {
        tapRecordsRef.current = [];
        setTapCount(0);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [
    preferences.screenTapSosEnabled,
    preferences.screenTapCount,
    preferences.fingerprintSensorTapOnly,
    suspended,
    fireSosTrigger,
  ]);

  // ==========================================================
  // 4. SCREEN WAKE LOCK (For Lock-Screen / Pocket Standby Shield)
  // ==========================================================
  const requestWakeLock = useCallback(async (): Promise<boolean> => {
    try {
      const nav = navigator as unknown as {
        wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
      };
      if (!nav.wakeLock) return false;
      const sentinel = await nav.wakeLock.request('screen');
      wakeLockRef.current = sentinel;
      setWakeLockActive(true);
      return true;
    } catch {
      setWakeLockActive(false);
      return false;
    }
  }, []);

  const releaseWakeLock = useCallback(async (): Promise<void> => {
    try {
      if (wakeLockRef.current && !wakeLockRef.current.released) {
        await wakeLockRef.current.release();
      }
    } catch {
      // Ignore
    } finally {
      wakeLockRef.current = null;
      setWakeLockActive(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVoiceWakeListener();
      void releaseWakeLock();
      if (shakeResetTimerRef.current !== null) {
        window.clearTimeout(shakeResetTimerRef.current);
      }
      if (tapResetTimerRef.current !== null) {
        window.clearTimeout(tapResetTimerRef.current);
      }
    };
  }, [stopVoiceWakeListener, releaseWakeLock]);

  return {
    shakeCount,
    shakeSensorSupported,
    motionPermissionState,
    requestMotionPermission,
    simulateShakeImpulse: registerShakeImpulse,
    voiceSupported,
    voiceListening,
    voiceError,
    lastHeardTranscript,
    startVoiceWakeListener,
    stopVoiceWakeListener,
    toggleVoiceWakeListener,
    testSecretVoicePhrase: evaluateSpokenPhrase,
    testWakeWordPhrase,
    tapCount,
    requiredTaps: preferences.screenTapCount === 2 ? 2 : 3,
    registerSensorTap,
    wakeLockActive,
    requestWakeLock,
    releaseWakeLock,
  };
}
