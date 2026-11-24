import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Hand,
  Home,
  Lock,
  Mic,
  MicOff,
  PhoneCall,
  Radio,
  ShieldAlert,
  Smartphone,
  Volume2,
} from 'lucide-react';
import { EmergencyQuickTriggersState } from '../../hooks/useEmergencyQuickTriggers';
import { SafetyPreferences } from '../../types/safety';
import {
  NativeShieldStatus,
  getNativeShieldStatus,
  openNativeAccessibilitySettings,
  requestNativeOverlayPermission,
} from '../../utils/nativeShieldBridge';
import { PWAInstallButton } from '../PWAInstallButton';

interface QuickSosTriggersCardProps {
  preferences: SafetyPreferences;
  triggers: EmergencyQuickTriggersState;
  onUpdatePreferences: (partial: Partial<SafetyPreferences>) => void;
  onOpenLockScreenShield: (surface?: 'lock_screen' | 'home_screen') => void;
}

const SECRET_CODE_PRESETS = ['Red Rose', 'Code 999', 'Help Me Now', 'Save Me'];

export const QuickSosTriggersCard: React.FC<QuickSosTriggersCardProps> = ({
  preferences,
  triggers,
  onUpdatePreferences,
  onOpenLockScreenShield,
}) => {
  const [codeDraft, setCodeDraft] = useState(preferences.voiceKeyword || 'Red Rose');
  const [codeSavedFeedback, setCodeSavedFeedback] = useState(false);
  const [voiceTestInput, setVoiceTestInput] = useState('');
  const [voiceTestStatus, setVoiceTestStatus] = useState('');
  const [nativeStatus, setNativeStatus] = useState<NativeShieldStatus | null>(
    null
  );

  useEffect(() => {
    void getNativeShieldStatus().then(setNativeStatus);
  }, []);

  const handleSaveSecretCode = (value?: string) => {
    const finalCode = (value ?? codeDraft).trim() || 'Red Rose';
    setCodeDraft(finalCode);
    onUpdatePreferences({ voiceKeyword: finalCode });
    setCodeSavedFeedback(true);
    window.setTimeout(() => setCodeSavedFeedback(false), 2000);
  };

  const handleTestVoicePhraseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const phrase = voiceTestInput.trim() || preferences.voiceKeyword || 'Red Rose';
    const res = triggers.testSecretVoicePhrase(phrase);
    if (res.matched) {
      setVoiceTestStatus(`Matched secret code "${preferences.voiceKeyword}" — launching SOS!`);
      setVoiceTestInput('');
    } else {
      setVoiceTestStatus(
        `Phrase "${phrase}" did not match your secret code "${preferences.voiceKeyword}".`
      );
    }
  };

  const requiredTaps = preferences.screenTapCount === 2 ? 2 : 3;

  return (
    <section
      aria-label="Hands-Free & Outside-App Emergency SOS Triggers"
      className="bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 sm:p-7 space-y-6 shadow-sm"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#3E5632]">
            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
            <span>Zero-Navigation Emergency Protection</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold text-[#182215] tracking-tight">
            Instant Automated SOS &amp; &ldquo;{preferences.wakeWordPhrase || 'OurSafe'}&rdquo; Voice Wake
          </h2>
          <p className="text-xs sm:text-sm text-[#4B5844] leading-relaxed">
            All 3 safety systems stay <strong className="text-[#182215]">always-on</strong> (switch ON/OFF anytime in Settings):{' '}
            <strong className="text-[#182215]">3x Phone Shake</strong>,{' '}
            <strong className="text-[#182215]">Secret Code (&ldquo;{preferences.voiceKeyword}&rdquo;)</strong> even from across the room, and{' '}
            <strong className="text-[#182215]">Triple/Double Screen Tap</strong> — automatically placing the SOS call AND sharing live GPS. Say{' '}
            <strong className="text-[#182215]">&ldquo;{preferences.wakeWordPhrase || 'OurSafe'}&rdquo;</strong> anytime like &ldquo;Hey Google&rdquo; to launch full voice app control.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => triggers.testWakeWordPhrase(preferences.wakeWordPhrase || 'OurSafe')}
            className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Mic className="w-4 h-4 shrink-0" />
            <span>Say &ldquo;{preferences.wakeWordPhrase || 'OurSafe'}&rdquo;</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenLockScreenShield('lock_screen')}
            className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-[#182215] hover:bg-[#24371D] text-[#F6F9F2] text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Lock className="w-4 h-4 text-[#B8D0A8]" />
            <span>Lock Icon Preview</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenLockScreenShield('home_screen')}
            className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-[#2F4526] hover:bg-[#23351C] text-[#F6F9F2] text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Home className="w-4 h-4 text-[#CDD7C1]" />
            <span>Home Screen</span>
          </button>
        </div>
      </div>

      {/* Real Phone Lock Screen & Home Screen Native Bridge / PWA Readiness Strip */}
      <div className="rounded-2xl bg-[#F4F7EF] border border-[#CFD9C3] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-bold text-[#182215] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#2F4526] shrink-0" />
            <span>
              {nativeStatus?.isNativeAndroid
                ? 'Native Android Lock-Screen & Home-Screen Service Connected'
                : 'Phone Home Screen Shortcut + Android Native Lock/Home Shield Ready'}
            </span>
          </p>
          <p className="text-xs text-[#465340] leading-relaxed">
            {nativeStatus?.isNativeAndroid
              ? 'OurSafe Foreground Service, Lock/Home Overlay, and Accessibility Tap Detector are synced with your triggers below.'
              : 'Install OurSafe to your Phone Home Screen right now for 1-tap Lock Shield launch. For real OS-level main Lock Screen & background Home Screen operation while the phone is locked, build the bundled Capacitor Android APK (Kotlin ForegroundService + Overlay + Tap Accessibility + Home Widget included).'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {nativeStatus?.isNativeAndroid ? (
            <>
              <button
                type="button"
                onClick={() => void requestNativeOverlayPermission()}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#2F4526] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                {nativeStatus.overlayPermissionGranted
                  ? 'Overlay Allowed'
                  : 'Allow Lock/Home Overlay'}
              </button>
              <button
                type="button"
                onClick={() => void openNativeAccessibilitySettings()}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#EAF0E2] border border-[#B8C6A8] text-[#24371D] text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                {nativeStatus.accessibilityPermissionGranted
                  ? 'Tap Service Active'
                  : 'Enable Lock/Home Tap Service'}
              </button>
            </>
          ) : (
            <PWAInstallButton />
          )}
        </div>
      </div>

      {/* 3 Trigger Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 1. TRIPLE SHAKE SOS */}
        <div className="rounded-2xl bg-[#F4F7EF] border border-[#CFD9C3] p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#2F4526] text-white flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#3E5632]">
                    Option 1
                  </p>
                  <h3 className="text-base font-bold text-[#182215]">
                    3x Phone Shake SOS
                  </h3>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-label="Toggle 3x Phone Shake SOS"
                aria-checked={preferences.shakeDetectionEnabled}
                onClick={() =>
                  onUpdatePreferences({
                    shakeDetectionEnabled: !preferences.shakeDetectionEnabled,
                  })
                }
                className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer flex items-center ${
                  preferences.shakeDetectionEnabled
                    ? 'bg-[#2F4526] justify-end'
                    : 'bg-[#C4D1B6] justify-start'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-white shadow-sm block" />
              </button>
            </div>

            <p className="text-xs text-[#465340] leading-relaxed">
              Shake your phone firmly <strong>3 times within 2.5 seconds</strong> to automatically launch the SOS emergency call &amp; live GPS alert.
            </p>

            {/* Live Shake Meter */}
            <div className="rounded-xl bg-white border border-[#D4DFC8] p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#182215]">Live Shake Meter</span>
                <span className="font-mono font-bold text-[#2F4526]">
                  {triggers.shakeCount} / 3
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`h-2 rounded-full transition-colors ${
                      triggers.shakeCount >= step ? 'bg-red-600' : 'bg-[#DCE5D1]'
                    }`}
                  />
                ))}
              </div>
              <p className="text-[11px] text-[#54634D]">
                {!preferences.shakeDetectionEnabled
                  ? 'Shake trigger is paused.'
                  : triggers.motionPermissionState === 'granted'
                    ? 'Accelerometer armed — shake your phone 3x now.'
                    : triggers.motionPermissionState === 'prompt'
                      ? 'Tap below to grant iOS/mobile motion sensor permission.'
                      : 'Use the test button below on desktop devices.'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {triggers.motionPermissionState === 'prompt' && (
              <button
                type="button"
                onClick={() => void triggers.requestMotionPermission()}
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-bold cursor-pointer"
              >
                Enable Phone Motion Sensor
              </button>
            )}
            <button
              type="button"
              disabled={!preferences.shakeDetectionEnabled}
              onClick={triggers.simulateShakeImpulse}
              className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#2F4526] hover:bg-[#23351C] disabled:opacity-45 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              <span>Test Shake (Click 3x · {triggers.shakeCount}/3)</span>
            </button>
          </div>
        </div>

        {/* 2. SECRET CODE VOICE TRIGGER (HEY GOOGLE STYLE) */}
        <div className="rounded-2xl bg-[#F4F7EF] border border-[#CFD9C3] p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#2F4526] text-white flex items-center justify-center shrink-0">
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#3E5632]">
                    Option 2
                  </p>
                  <h3 className="text-base font-bold text-[#182215]">
                    Secret Voice Code SOS
                  </h3>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-label="Toggle Secret Voice Code SOS"
                aria-checked={preferences.voiceActivationEnabled}
                onClick={() =>
                  onUpdatePreferences({
                    voiceActivationEnabled: !preferences.voiceActivationEnabled,
                  })
                }
                className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer flex items-center ${
                  preferences.voiceActivationEnabled
                    ? 'bg-[#2F4526] justify-end'
                    : 'bg-[#C4D1B6] justify-start'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-white shadow-sm block" />
              </button>
            </div>

            <p className="text-xs text-[#465340] leading-relaxed">
              Just like &ldquo;Hey Google&rdquo;, say your private secret code hands-free to instantly trigger SOS without touching your phone.
            </p>

            {/* Secret Code Input + Presets */}
            <div className="space-y-2">
              <label
                htmlFor="secret-voice-code-input"
                className="block text-[11px] font-bold text-[#182215]"
              >
                Your Secret Code Phrase
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="secret-voice-code-input"
                  type="text"
                  value={codeDraft}
                  onChange={(e) => setCodeDraft(e.target.value)}
                  placeholder="e.g. Red Rose or Code 999"
                  className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-[#C5D2B7] text-xs font-semibold text-[#182215] focus:border-[#2F4526] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleSaveSecretCode()}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] border border-[#B8C6A8] text-[#24371D] text-xs font-bold cursor-pointer"
                >
                  Save
                </button>
              </div>

              {codeSavedFeedback && (
                <p className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Secret code updated to &ldquo;{preferences.voiceKeyword}&rdquo;</span>
                </p>
              )}

              <div className="flex flex-wrap gap-1.5">
                {SECRET_CODE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleSaveSecretCode(preset)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                      preferences.voiceKeyword.toLowerCase() === preset.toLowerCase()
                        ? 'bg-[#2F4526] text-white'
                        : 'bg-white border border-[#CFD9C3] text-[#3E4C37] hover:bg-[#EAF0E2]'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <label
                  htmlFor="voice-code-lang"
                  className="text-[11px] font-semibold text-[#4B5844]"
                >
                  Voice Language
                </label>
                <select
                  id="voice-code-lang"
                  value={preferences.voiceLanguage}
                  onChange={(e) =>
                    onUpdatePreferences({
                      voiceLanguage: e.target.value as 'en-IN' | 'en-US' | 'ta-IN',
                    })
                  }
                  className="px-2.5 py-1 rounded-lg bg-white border border-[#C5D2B7] text-[11px] font-semibold text-[#182215] focus:outline-none"
                >
                  <option value="en-IN">English (India)</option>
                  <option value="en-US">English (US)</option>
                  <option value="ta-IN">Tamil (தமிழ்)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Live Mic Arming & Instant Phrase Tester */}
          <div className="space-y-2">
            <button
              type="button"
              disabled={!preferences.voiceActivationEnabled}
              onClick={triggers.toggleVoiceWakeListener}
              className={`w-full min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-45 ${
                triggers.voiceListening
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-[#2F4526] hover:bg-[#23351C] text-white'
              }`}
            >
              {triggers.voiceListening ? (
                <>
                  <Radio className="w-4 h-4 animate-pulse" />
                  <span>Listening for &ldquo;{preferences.voiceKeyword}&rdquo; (Stop)</span>
                </>
              ) : (
                <>
                  <MicOff className="w-4 h-4" />
                  <span>Arm Always-On Voice Mic</span>
                </>
              )}
            </button>

            <form onSubmit={handleTestVoicePhraseSubmit} className="flex items-center gap-1.5">
              <input
                type="text"
                value={voiceTestInput}
                onChange={(e) => setVoiceTestInput(e.target.value)}
                placeholder={`Type "${preferences.voiceKeyword}" to test`}
                className="flex-1 min-h-[36px] px-2.5 py-1 rounded-xl bg-white border border-[#C5D2B7] text-[11px] text-[#182215] focus:border-[#2F4526] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!preferences.voiceActivationEnabled}
                className="min-h-[36px] px-3 py-1 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] border border-[#B8C6A8] text-[#24371D] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-45 whitespace-nowrap"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Speak Test</span>
              </button>
            </form>

            {(triggers.voiceError || triggers.lastHeardTranscript || voiceTestStatus) && (
              <p className="text-[11px] text-[#465340] leading-snug">
                {triggers.voiceError ||
                  (triggers.lastHeardTranscript
                    ? `Live mic heard: "${triggers.lastHeardTranscript}"`
                    : voiceTestStatus)}
              </p>
            )}
          </div>
        </div>

        {/* 3. DOUBLE-TAP OR TRIPLE-TAP SCREEN SOS */}
        <div className="rounded-2xl bg-[#F4F7EF] border border-[#CFD9C3] p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#2F4526] text-white flex items-center justify-center shrink-0">
                  <Hand className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#3E5632]">
                    Option 3
                  </p>
                  <h3 className="text-base font-bold text-[#182215]">
                    Screen {requiredTaps === 2 ? 'Double-Tap' : 'Triple-Tap'} SOS
                  </h3>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-label="Toggle Double or Triple Screen Tap SOS"
                aria-checked={preferences.screenTapSosEnabled}
                onClick={() =>
                  onUpdatePreferences({
                    screenTapSosEnabled: !preferences.screenTapSosEnabled,
                  })
                }
                className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer flex items-center ${
                  preferences.screenTapSosEnabled
                    ? 'bg-[#2F4526] justify-end'
                    : 'bg-[#C4D1B6] justify-start'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-white shadow-sm block" />
              </button>
            </div>

            <p className="text-xs text-[#465340] leading-relaxed">
              Rapidly tap <strong>{requiredTaps} times</strong> on the Lock-Screen Shield, Login screen, or any open area of the screen to call SOS immediately.
            </p>

            {/* Double vs Triple Tap Selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onUpdatePreferences({ screenTapCount: 2 })}
                className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  preferences.screenTapCount === 2
                    ? 'bg-[#2F4526] text-white'
                    : 'bg-white border border-[#C5D2B7] text-[#24371D] hover:bg-[#EAF0E2]'
                }`}
              >
                Double Tap (2x)
              </button>
              <button
                type="button"
                onClick={() => onUpdatePreferences({ screenTapCount: 3 })}
                className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  preferences.screenTapCount === 3
                    ? 'bg-[#2F4526] text-white'
                    : 'bg-white border border-[#C5D2B7] text-[#24371D] hover:bg-[#EAF0E2]'
                }`}
              >
                Triple Tap (3x)
              </button>
            </div>
          </div>

          {/* Interactive Rapid-Tap Test Pad (uses real global pointerdown listener!) */}
          <div className="rounded-2xl border-2 border-dashed border-[#9DB08C] bg-white p-4 text-center space-y-2 select-none cursor-pointer">
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: requiredTaps }).map((_, idx) => (
                <span
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full transition-colors ${
                    triggers.tapCount > idx ? 'bg-red-600 scale-110' : 'bg-[#DCE5D1]'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs font-bold text-[#182215]">
              {preferences.screenTapSosEnabled
                ? `Tap Here Rapidly ${requiredTaps} Times to Test Live`
                : 'Enable Screen Tap SOS above to test'}
            </p>
            <p className="text-[11px] text-[#54634D]">
              Live taps detected: <span className="font-mono font-bold">{triggers.tapCount}/{requiredTaps}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Dispatch Behavior Bar */}
      <div className="pt-4 border-t border-[#DCE5D1] flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 font-semibold text-[#182215] cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.autoDialOnTrigger}
              onChange={(e) =>
                onUpdatePreferences({ autoDialOnTrigger: e.target.checked })
              }
              className="w-4 h-4 accent-[#2F4526] rounded cursor-pointer"
            />
            <PhoneCall className="w-3.5 h-3.5 text-[#2F4526]" />
            <span>Auto-launch Emergency Call immediately on trigger</span>
          </label>

          <div className="flex items-center gap-1.5">
            <span className="text-[#54634D] font-medium">Dispatch Delay:</span>
            <button
              type="button"
              onClick={() => onUpdatePreferences({ quickTriggerCountdownSec: 3 })}
              className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                preferences.quickTriggerCountdownSec === 3
                  ? 'bg-[#2F4526] text-white'
                  : 'bg-[#EAF0E2] text-[#24371D]'
              }`}
            >
              3s Cancel Window
            </button>
            <button
              type="button"
              onClick={() => onUpdatePreferences({ quickTriggerCountdownSec: 0 })}
              className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                preferences.quickTriggerCountdownSec === 0
                  ? 'bg-red-600 text-white'
                  : 'bg-[#EAF0E2] text-[#24371D]'
              }`}
            >
              0s Instant Call
            </button>
          </div>
        </div>

        <p className="text-[11px] text-[#54634D]">
          Keep Lock-Screen Shield open in your pocket for continuous Web Wake-Lock protection without entering the dashboard.
        </p>
      </div>
    </section>
  );
};
