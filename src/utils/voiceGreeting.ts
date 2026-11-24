import { VoiceCommandAction } from '../types/safety';

/**
 * Speaks an audible voice response using the browser's native SpeechSynthesis API
 * so the user immediately hears confirmation like:
 * "OurSafe app is here, how can I help you?"
 */
export function speakAssistantGreeting(
  text: string,
  onDone?: () => void
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    globalThis.setTimeout(() => onDone?.(), 150);
    return;
  }

  let finished = false;
  const finishOnce = () => {
    if (finished) return;
    finished = true;
    onDone?.();
  };

  try {
    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN';
    utterance.rate = 0.98;
    utterance.pitch = 1.05;
    utterance.volume = 1.0;

    const voices = synth.getVoices();
    if (voices && voices.length > 0) {
      const preferred =
        voices.find(
          (v) =>
            /en-(IN|GB|US)/i.test(v.lang) &&
            /(female|samantha|victoria|google uk english female|google us english|heera|neerja|veena|aria|zira)/i.test(
              v.name
            )
        ) ||
        voices.find((v) => /en-(IN|GB|US)/i.test(v.lang)) ||
        voices[0];
      if (preferred) {
        utterance.voice = preferred;
      }
    }

    utterance.onend = () => finishOnce();
    utterance.onerror = () => finishOnce();

    // Safety fallback timer in case a mobile browser suppresses onend
    const estimatedMs = Math.min(5200, Math.max(2200, text.length * 78));
    window.setTimeout(() => finishOnce(), estimatedMs);

    synth.speak(utterance);
  } catch {
    finishOnce();
  }
}

export function cancelAssistantSpeech(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignore
  }
}

/**
 * Fast, deterministic client-side voice intent parser so full-app voice commands
 * work instantaneously (even offline or while Gemini Live is connecting).
 */
export function parseInstantVoiceIntent(
  rawText: string
): VoiceCommandAction | null {
  const text = rawText
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return null;

  const id = `local-voice-${Date.now()}`;

  // Dual call: guardian + police
  if (
    (text.includes('police') &&
      (text.includes('guardian') ||
        text.includes('family') ||
        text.includes('mom') ||
        text.includes('both'))) ||
    text.includes('call both') ||
    text.includes('dual call')
  ) {
    return { id, name: 'call_guardian_and_police', args: {} };
  }

  // Threat / Dread mode
  if (
    text.includes('deactivate threat') ||
    text.includes('stop threat') ||
    text.includes('turn off threat') ||
    text.includes('stop dread') ||
    text.includes('im safe') ||
    text.includes('i am safe')
  ) {
    return {
      id,
      name: 'deactivate_threat_mode',
      args: { note: 'Deactivated by voice command' },
    };
  }

  if (
    text.includes('threat') ||
    text.includes('dread') ||
    text.includes('record video') ||
    text.includes('record audio') ||
    text.includes('danger mode')
  ) {
    return {
      id,
      name: 'activate_threat_mode',
      args: { autoStartRecording: 'video' },
    };
  }

  // Live location sharing ("share my location", "share my business")
  if (
    text.includes('share my location') ||
    text.includes('share location') ||
    text.includes('live location') ||
    text.includes('send location') ||
    text.includes('share my business')
  ) {
    return {
      id,
      name: 'share_live_location',
      args: { durationMinutes: 30, includePolice: true },
    };
  }

  // Call police directly
  if (
    text.includes('call police') ||
    text.includes('dial police') ||
    text.includes('call 100') ||
    text.includes('call 112')
  ) {
    return { id, name: 'call_police', args: {} };
  }

  // Call guardian directly
  if (
    text.includes('call guardian') ||
    text.includes('call my guardian') ||
    text.includes('call mom') ||
    text.includes('call contact')
  ) {
    return { id, name: 'call_guardian', args: {} };
  }

  // SOS page / emergency help
  if (
    text.includes('sos') ||
    text.includes('emergency') ||
    text.includes('help me') ||
    text.includes('save me')
  ) {
    return {
      id,
      name: 'open_sos',
      args: {
        initiateAlert: true,
        callBothGuardianAndPolice: true,
        reason: rawText,
      },
    };
  }

  // Nearby police / restrooms
  if (text.includes('restroom') || text.includes('washroom') || text.includes('toilet')) {
    return {
      id,
      name: 'open_nearby_police',
      args: { category: 'restrooms' },
    };
  }

  if (
    text.includes('nearby police') ||
    text.includes('find police') ||
    text.includes('police station') ||
    text.includes('police number') ||
    text.includes('nearby')
  ) {
    return {
      id,
      name: 'open_nearby_police',
      args: { category: 'police' },
    };
  }

  // Travel mode & vehicle check
  if (
    text.includes('travel') ||
    text.includes('route') ||
    text.includes('verify auto') ||
    text.includes('verify cab') ||
    text.includes('vehicle') ||
    text.includes('auto number')
  ) {
    return { id, name: 'open_travel_mode', args: {} };
  }

  // Safety Check-In
  if (text.includes('check in') || text.includes('checkin') || text.includes('timer')) {
    return { id, name: 'start_safety_checkin', args: { minutes: 10 } };
  }

  // Fake call
  if (text.includes('fake call') || text.includes('pretend call')) {
    return { id, name: 'trigger_fake_call', args: { callerName: 'Mom' } };
  }

  // Lock shield
  if (text.includes('lock shield') || text.includes('lock screen')) {
    return {
      id,
      name: 'open_lock_shield',
      args: { surface: 'lock_screen' },
    };
  }

  // Settings
  if (
    text.includes('setting') ||
    text.includes('turn on shake') ||
    text.includes('turn off shake') ||
    text.includes('preferences')
  ) {
    return { id, name: 'open_settings', args: {} };
  }

  // Guardians / Contacts
  if (
    text.includes('guardian') ||
    text.includes('contact') ||
    text.includes('emergency number')
  ) {
    return { id, name: 'open_contacts', args: {} };
  }

  // History / Evidence
  if (text.includes('history') || text.includes('evidence') || text.includes('recording')) {
    return { id, name: 'navigate_page', args: { page: 'history' } };
  }

  // AI Voice page
  if (text.includes('voice page') || text.includes('assistant')) {
    return { id, name: 'navigate_page', args: { page: 'assistant' } };
  }

  // Home page
  if (text.includes('go home') || text.includes('open home') || text === 'home') {
    return { id, name: 'navigate_page', args: { page: 'home' } };
  }

  return null;
}
