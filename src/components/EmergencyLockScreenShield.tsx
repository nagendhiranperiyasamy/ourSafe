import React, { useEffect, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Globe,
  Hand,
  Home,
  Image as ImageIcon,
  Info,
  KeyRound,
  Lock,
  MessageSquare,
  Mic,
  MicOff,
  Phone,
  Radio,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Unlock,
  Volume2,
  X,
} from 'lucide-react';
import { EmergencyQuickTriggersState } from '../hooks/useEmergencyQuickTriggers';
import { SafetyPreferences } from '../types/safety';
import {
  NativeShieldStatus,
  getNativeShieldStatus,
  openNativeAccessibilitySettings,
  requestNativeOverlayPermission,
} from '../utils/nativeShieldBridge';
import { BiometricSensorTrigger } from './BiometricSensorTrigger';

interface EmergencyLockScreenShieldProps {
  preferences: SafetyPreferences;
  guardianName?: string;
  guardianPhone?: string;
  userPassword?: string;
  triggers: EmergencyQuickTriggersState;
  initialSurface?: 'lock_screen' | 'home_screen';
  onQuickWidgetSos?: () => void;
  onExit: () => void;
}

const LOCK_SCREEN_SAFETY_TIPS = [
  {
    icon: '🛡️',
    title: 'Biometric 3× Sensor Tap SOS',
    tip: 'Triple tap the Fingerprint Sensor below to immediately trigger SOS and share live GPS coordinates with Guardians & Police.',
  },
  {
    icon: '🎙️',
    title: 'Hands-Free Secret Voice Code',
    tip: 'Even if your phone is snatched, saying your secret phrase places the emergency SOS call automatically.',
  },
  {
    icon: '📍',
    title: 'Travel Mode Route Tracking',
    tip: 'Travel Mode tracks your taxi/auto on Google Maps and notifies guardians if vehicle deviates 200m off route.',
  },
  {
    icon: '📞',
    title: 'Discreet Fake Call Exit',
    tip: 'Need an urgent excuse to leave an uncomfortable space? Trigger Fake Call to simulate a realistic incoming call.',
  },
  {
    icon: '⚡',
    title: 'Direct Helpline Numbers',
    tip: 'Dial 112 (All-in-One Emergency), 181 (Women Helpline), or 100 (Police Control Room) anytime without unlocking.',
  },
];

export const EmergencyLockScreenShield: React.FC<
  EmergencyLockScreenShieldProps
> = ({
  preferences,
  guardianName,
  guardianPhone,
  userPassword,
  triggers,
  initialSurface = 'lock_screen',
  onQuickWidgetSos,
  onExit,
}) => {
  const [surface, setSurface] = useState<'lock_screen' | 'home_screen'>(
    initialSurface
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());
  const [voiceTestMessage, setVoiceTestMessage] = useState('');
  const [nativeStatus, setNativeStatus] = useState<NativeShieldStatus | null>(
    null
  );

  // Safety Tips Carousel state
  const [safetyTipIndex, setSafetyTipIndex] = useState(0);

  // "How to Place on Real Phone Lock Screen" Guide state
  const [showPlacementGuide, setShowPlacementGuide] = useState(false);
  const [guideBrandTab, setGuideBrandTab] = useState<
    'samsung' | 'xiaomi' | 'vivo_oppo' | 'pixel'
  >('samsung');

  // Password / PIN protection for exiting lock screen or opening sensitive settings
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<'screen' | 'sos_table'>('screen');
  const [tablePasswordUnlocked, setTablePasswordUnlocked] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Auto-advance safety tip every 8 seconds
  useEffect(() => {
    const tipTimer = window.setInterval(() => {
      setSafetyTipIndex((prev) => (prev + 1) % LOCK_SCREEN_SAFETY_TIPS.length);
    }, 8000);
    return () => window.clearInterval(tipTimer);
  }, []);

  const handleAttemptUnlock = () => {
    setPasswordTarget('screen');
    if (userPassword) {
      setShowPasswordModal(true);
      setUnlockPassword('');
      setPasswordError('');
    } else {
      onExit();
    }
  };

  const handleVerifyPasswordAndExit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockPassword.trim()) {
      setPasswordError('Please enter your account password.');
      return;
    }
    if (userPassword && unlockPassword !== userPassword) {
      setPasswordError('Incorrect password. Please try again.');
      return;
    }
    if (passwordTarget === 'sos_table') {
      setTablePasswordUnlocked(true);
      setShowPasswordModal(false);
      setUnlockPassword('');
      setPasswordError('');
      return;
    }
    setShowPasswordModal(false);
    onExit();
  };

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void triggers.requestWakeLock();
    void getNativeShieldStatus().then(setNativeStatus);
    return () => {
      void triggers.releaseWakeLock();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const timeString = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const dateString = now.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const secretCode = preferences.voiceKeyword.trim() || 'Red Rose';
  const wakeWord = preferences.wakeWordPhrase?.trim() || 'OurSafe';
  const requiredTaps = preferences.screenTapCount === 2 ? 2 : 3;
  const isIconOnly = preferences.lockScreenDisplayStyle === 'icon_only';

  const armedCount = [
    preferences.shakeDetectionEnabled,
    preferences.voiceActivationEnabled,
    preferences.screenTapSosEnabled,
  ].filter(Boolean).length;

  const sampleHomeApps = [
    { name: 'Phone', icon: Phone, bg: 'bg-emerald-600' },
    { name: 'Messages', icon: MessageSquare, bg: 'bg-sky-600' },
    { name: 'Camera', icon: Camera, bg: 'bg-stone-700' },
    { name: 'Maps', icon: Compass, bg: 'bg-amber-600' },
    { name: 'Browser', icon: Globe, bg: 'bg-indigo-600' },
    { name: 'Photos', icon: ImageIcon, bg: 'bg-rose-600' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Phone Lock Screen and Home Screen with Minimal OurSafe SOS Icon"
      className={`fixed inset-0 z-[60] flex flex-col justify-between select-none overflow-hidden ${
        surface === 'lock_screen'
          ? 'oursafe-lock-wallpaper text-[#F5F9F2]'
          : 'bg-gradient-to-b from-[#172315] via-[#21311D] to-[#0E160C] text-[#F5F9F2]'
      }`}
    >
      {/* Top Minimal Phone Status Strip */}
      <div
        data-ignore-sos-tap="true"
        className="w-full max-w-xl mx-auto px-5 pt-4 pb-2 flex items-center justify-between gap-2 text-xs text-white/75"
      >
        <div className="flex items-center gap-2 font-medium">
          {surface === 'lock_screen' ? (
            <Lock className="w-3.5 h-3.5 text-[#A7C992]" />
          ) : (
            <Home className="w-3.5 h-3.5 text-[#A7C992]" />
          )}
          <span className="text-[11px] tracking-wide">
            {surface === 'lock_screen' ? 'Lock Screen' : 'Home Screen'}
          </span>
        </div>

        {/* Tiny non-intrusive status dot (never clutters wallpaper) */}
        <div className="flex items-center gap-2.5 text-[11px] font-mono">
          {triggers.voiceListening && (
            <span className="inline-flex items-center gap-1 text-emerald-300">
              <Radio className="w-3 h-3 animate-pulse" />
              <span className="hidden sm:inline">Voice ON</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 text-white/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{armedCount}/3 Armed</span>
          </span>
        </div>
      </div>

      {/* CENTER CLEAN PHONE SURFACE (Unobstructed — OurSafe does NOT capture the whole screen) */}
      {surface === 'lock_screen' ? (
        <div className="flex-1 flex flex-col items-center justify-start pt-14 sm:pt-20 px-6 text-center">
          <div className="space-y-1 pointer-events-none">
            <p className="text-xs sm:text-sm font-medium text-white/70 tracking-wide">
              {dateString}
            </p>
            <p className="text-7xl sm:text-8xl font-semibold tracking-tight font-mono tabular-nums text-white drop-shadow-sm">
              {timeString}
            </p>
          </div>

          {/* Live feedback ONLY appears when actively shaking or tapping */}
          <div className="mt-10 min-h-[44px] flex items-center justify-center pointer-events-none">
            {preferences.screenTapSosEnabled && triggers.tapCount > 0 ? (
              <div className="px-4 py-2 rounded-full bg-red-600/85 border border-red-300/60 text-white text-xs font-bold flex items-center gap-2 shadow-lg">
                <Hand className="w-4 h-4" />
                <span>
                  Tap {triggers.tapCount} / {requiredTaps} — SOS
                </span>
              </div>
            ) : preferences.shakeDetectionEnabled && triggers.shakeCount > 0 ? (
              <div className="px-4 py-2 rounded-full bg-red-600/85 border border-red-300/60 text-white text-xs font-bold flex items-center gap-2 shadow-lg">
                <Smartphone className="w-4 h-4" />
                <span>
                  Shake {triggers.shakeCount} / 3 — SOS
                </span>
              </div>
            ) : null}
          </div>

          {/* Minimal Icon-Only Mode: Only the clean phone clock and OurSafe emergency badge are shown */}
          {isIconOnly ? (
            <div className="my-auto flex flex-col items-center justify-center space-y-4 pointer-events-none">
              <div className="w-20 h-20 rounded-3xl bg-[#2F4526]/80 border-2 border-emerald-400/50 backdrop-blur-md flex items-center justify-center shadow-2xl shadow-emerald-950/60 pointer-events-auto">
                <ShieldCheck className="w-10 h-10 text-emerald-300 animate-pulse" />
              </div>
              <p className="text-xs font-semibold text-white/80 tracking-wider uppercase">
                OurSafe Active Protection
              </p>
              <button
                type="button"
                onClick={() => setShowPlacementGuide(true)}
                className="text-[11px] text-emerald-300 underline pointer-events-auto cursor-pointer"
              >
                Set on Real Lock Screen Guide
              </button>
            </div>
          ) : (
            <>
              {/* Safety Tips Banner on Lock Screen */}
              <div
                data-ignore-sos-tap="true"
                className="w-full max-w-sm mt-3 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 backdrop-blur-md text-left transition-all shadow-md select-none"
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300 mb-1">
                  <span className="flex items-center gap-1.5">
                    <span>{LOCK_SCREEN_SAFETY_TIPS[safetyTipIndex].icon}</span>
                    <span>{LOCK_SCREEN_SAFETY_TIPS[safetyTipIndex].title}</span>
                  </span>
                  <div className="flex items-center gap-1 text-white/60">
                    <button
                      type="button"
                      onClick={() =>
                        setSafetyTipIndex((prev) =>
                          prev === 0 ? LOCK_SCREEN_SAFETY_TIPS.length - 1 : prev - 1
                        )
                      }
                      className="p-1 hover:text-white cursor-pointer"
                      aria-label="Previous tip"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-mono">
                      {safetyTipIndex + 1}/{LOCK_SCREEN_SAFETY_TIPS.length}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSafetyTipIndex((prev) =>
                          (prev + 1) % LOCK_SCREEN_SAFETY_TIPS.length
                        )
                      }
                      className="p-1 hover:text-white cursor-pointer"
                      aria-label="Next tip"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-white/90 leading-relaxed">
                  {LOCK_SCREEN_SAFETY_TIPS[safetyTipIndex].tip}
                </p>
              </div>

              {/* SOS Quick Table on Lock Screen */}
              <div
                data-ignore-sos-tap="true"
                className="w-full max-w-sm mt-3 rounded-2xl bg-black/45 border border-white/15 backdrop-blur-md p-3.5 space-y-2 text-left shadow-lg select-none"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-red-400 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Lock-Screen SOS Table</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (tablePasswordUnlocked) {
                          setTablePasswordUnlocked(false);
                        } else if (userPassword) {
                          setPasswordTarget('sos_table');
                          setShowPasswordModal(true);
                          setUnlockPassword('');
                          setPasswordError('');
                        } else {
                          setTablePasswordUnlocked(true);
                        }
                      }}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                        tablePasswordUnlocked
                          ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
                          : 'bg-amber-500/20 text-amber-200 border border-amber-400/30 hover:bg-amber-500/30'
                      }`}
                      title={
                        tablePasswordUnlocked
                          ? 'Password verified. Click to lock SOS table.'
                          : 'Protected with password. Click to authenticate.'
                      }
                    >
                      {tablePasswordUnlocked ? (
                        <>
                          <Unlock className="w-2.5 h-2.5 text-emerald-300" />
                          <span>Unlocked</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-2.5 h-2.5 text-amber-300" />
                          <span>Password Table</span>
                        </>
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPlacementGuide(true)}
                    className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 underline cursor-pointer shrink-0"
                  >
                    Set on Real Lock Screen
                  </button>
                </div>

                <div className="divide-y divide-white/10 text-xs">
                  {guardianName && guardianPhone && (
                    <div className="py-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white flex items-center gap-1.5">
                          <span>{guardianName}</span>
                          {tablePasswordUnlocked && (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 inline" />
                          )}
                        </p>
                        <p className="text-[11px] text-white/60">
                          Guardian (
                          {tablePasswordUnlocked
                            ? guardianPhone
                            : `${guardianPhone.slice(0, 3)}•••••${guardianPhone.slice(-2)}`}
                          )
                        </p>
                      </div>
                      <a
                        href={`tel:${guardianPhone}`}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Phone className="w-3 h-3" />
                        <span>Call</span>
                      </a>
                    </div>
                  )}

                  <div className="py-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">Police Control Room</p>
                      <p className="text-[11px] text-white/60">National Emergency (100 / 112)</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <a
                        href="tel:100"
                        className="px-2.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <Phone className="w-3 h-3" />
                        <span>100</span>
                      </a>
                      <a
                        href="tel:112"
                        className="px-2.5 py-1.5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <Phone className="w-3 h-3" />
                        <span>112</span>
                      </a>
                    </div>
                  </div>

                  <div className="py-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">Women Safety Helpline</p>
                      <p className="text-[11px] text-white/60">24/7 Helpline (181)</p>
                    </div>
                    <a
                      href="tel:181"
                      className="px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <Phone className="w-3 h-3" />
                      <span>181</span>
                    </a>
                  </div>
                </div>
              </div>
            </>
          )}

          <p className="mt-auto mb-2 text-[11px] text-white/50 pointer-events-none">
            Tap anywhere {requiredTaps}x · Shake 3x · Say &ldquo;{secretCode}&rdquo; (SOS) or &ldquo;{wakeWord}&rdquo; (Voice App)
          </p>
        </div>
      ) : (
        <div className="flex-1 w-full max-w-md mx-auto px-6 py-8 flex flex-col justify-between">
          <div className="text-left pointer-events-none pt-2">
            <p className="text-4xl font-mono font-semibold text-white tabular-nums">
              {timeString}
            </p>
            <p className="text-xs text-white/70 mt-0.5">{dateString}</p>
          </div>

          {(triggers.tapCount > 0 || triggers.shakeCount > 0) && (
            <div className="px-4 py-2 rounded-full bg-red-600/85 border border-red-300/60 text-white text-xs font-bold text-center pointer-events-none">
              {triggers.tapCount > 0
                ? `Tap ${triggers.tapCount} / ${requiredTaps} — SOS`
                : `Shake ${triggers.shakeCount} / 3 — SOS`}
            </div>
          )}

          {/* Everyday Phone Home Screen Icons (Completely Unobstructed) */}
          <div className="grid grid-cols-3 gap-6 my-auto pointer-events-none">
            {sampleHomeApps.map((app) => {
              const Icon = app.icon;
              return (
                <div
                  key={app.name}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div
                    className={`w-14 h-14 rounded-2xl ${app.bg} text-white flex items-center justify-center shadow-lg opacity-90`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-medium text-white/85">
                    {app.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BOTTOM MINIMAL LOCK-SCREEN BAR: Only subtle Unlock/Tools on left + Compact SOS Icon / OurSafe Badge on right */}
      <div
        data-ignore-sos-tap="true"
        className="w-full max-w-xl mx-auto px-5 pb-7 pt-3 flex items-end justify-between gap-4"
      >
        {/* Left: Quiet Tools & Unlock Icons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAttemptUnlock}
            aria-label="Unlock and return to OurSafe"
            title="Unlock & return to OurSafe"
            className="w-11 h-11 rounded-full bg-white/12 hover:bg-white/22 border border-white/20 backdrop-blur-md text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <Unlock className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setDrawerOpen((prev) => !prev)}
            aria-label="Toggle lock-screen test controls"
            title="Test triggers & surface switcher"
            className="min-h-[44px] px-3.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md text-white/90 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{drawerOpen ? 'Hide' : 'Test / Switch'}</span>
          </button>
        </div>

        {/* Right: Fingerprint Biometric Sensor Trigger (3x Tap) + Minimal Floating SOS Icon */}
        <div className="flex items-center gap-2">
          {preferences.screenTapSosEnabled && (
            <BiometricSensorTrigger
              tapCount={triggers.tapCount}
              requiredTaps={requiredTaps}
              onSensorTap={triggers.registerSensorTap}
              compact
            />
          )}

          <button
            type="button"
            onClick={onQuickWidgetSos}
            aria-label="OurSafe Emergency SOS Icon"
            title={`Tap for instant SOS (${guardianName || 'Police 100'})`}
            className={`group relative shadow-xl border-2 border-white/85 bg-red-600 hover:bg-red-700 active:scale-95 text-white transition-all cursor-pointer flex items-center justify-center ${
              isIconOnly
                ? 'w-14 h-14 rounded-full'
                : 'min-h-[52px] px-4 py-2 rounded-full gap-2'
            }`}
          >
            <span className="absolute -inset-1 rounded-full bg-red-500/30 animate-ping pointer-events-none" />
            <ShieldAlert className="relative w-5 h-5 shrink-0" />
            {!isIconOnly && (
              <span className="relative text-left leading-tight">
                <span className="block text-[11px] font-extrabold tracking-wide uppercase">
                  SOS
                </span>
                <span className="block text-[10px] font-semibold text-red-100">
                  OurSafe
                </span>
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Compact Test & Surface Drawer (Only shown when user taps "Test / Switch") */}
      {drawerOpen && (
        <div
          data-ignore-sos-tap="true"
          className="fixed inset-x-0 bottom-0 z-[65] px-4 pb-5 pt-2"
        >
          <div className="max-w-xl mx-auto rounded-3xl bg-[#111810]/95 border border-white/15 backdrop-blur-xl p-4 sm:p-5 shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSurface('lock_screen')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                    surface === 'lock_screen'
                      ? 'bg-[#2F4526] text-white'
                      : 'bg-white/10 text-white/75 hover:text-white'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Lock Screen</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSurface('home_screen')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                    surface === 'home_screen'
                      ? 'bg-[#2F4526] text-white'
                      : 'bg-white/10 text-white/75 hover:text-white'
                  }`}
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Home Screen</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close drawer"
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* 1. Shake */}
              <div className="rounded-2xl bg-white/6 border border-white/10 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-[#9BBF82]" />
                    <span>3x Shake</span>
                  </span>
                  <span className="font-mono text-[#9BBF82]">
                    {triggers.shakeCount}/3
                  </span>
                </div>
                {triggers.motionPermissionState === 'prompt' ? (
                  <button
                    type="button"
                    onClick={() => void triggers.requestMotionPermission()}
                    className="w-full min-h-[34px] px-2.5 py-1 rounded-xl bg-[#2F4526] hover:bg-[#3B5730] text-[11px] font-semibold text-white cursor-pointer"
                  >
                    Allow Motion
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!preferences.shakeDetectionEnabled}
                    onClick={triggers.simulateShakeImpulse}
                    className="w-full min-h-[34px] px-2.5 py-1 rounded-xl bg-[#2F4526] hover:bg-[#3B5730] disabled:opacity-40 text-[11px] font-semibold text-white cursor-pointer"
                  >
                    Simulate Shake ({triggers.shakeCount}/3)
                  </button>
                )}
              </div>

              {/* 2. Secret Code + OurSafe Wake Word */}
              <div className="rounded-2xl bg-white/6 border border-white/10 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5 truncate">
                    {triggers.voiceListening ? (
                      <Mic className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
                    ) : (
                      <MicOff className="w-3.5 h-3.5 text-[#9BBF82] shrink-0" />
                    )}
                    <span className="truncate">&ldquo;{secretCode}&rdquo;</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={triggers.toggleVoiceWakeListener}
                    className={`flex-1 min-h-[34px] px-2 py-1 rounded-xl text-[11px] font-semibold cursor-pointer ${
                      triggers.voiceListening
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-[#2F4526] hover:bg-[#3B5730] text-white'
                    }`}
                  >
                    {triggers.voiceListening ? 'Listening' : 'Arm Mic'}
                  </button>
                  <button
                    type="button"
                    disabled={!preferences.voiceActivationEnabled}
                    onClick={() => {
                      const res = triggers.testSecretVoicePhrase(secretCode);
                      setVoiceTestMessage(
                        res.matched
                          ? `Matched "${secretCode}"!`
                          : 'Secret voice code is OFF in Settings.'
                      );
                    }}
                    title={`Test saying "${secretCode}"`}
                    className="min-h-[34px] px-2.5 py-1 rounded-xl bg-red-600/80 hover:bg-red-600 text-[11px] font-semibold text-white cursor-pointer disabled:opacity-40"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 3. Hey-Google Style "OurSafe" Wake Test */}
              <div className="rounded-2xl bg-white/6 border border-white/10 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Say &ldquo;{wakeWord}&rdquo;</span>
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!preferences.wakeWordEnabled}
                  onClick={() => {
                    triggers.testWakeWordPhrase(wakeWord);
                    setDrawerOpen(false);
                  }}
                  className="w-full min-h-[34px] px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-[11px] font-semibold text-white cursor-pointer"
                >
                  Wake &ldquo;{wakeWord}&rdquo; Voice App
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/70 pt-1 border-t border-white/10">
              <span>
                Auto-SOS Target:{' '}
                <strong className="text-white">
                  {guardianName
                    ? `${guardianName} (${guardianPhone})`
                    : 'Police 100 / 112'}
                </strong>{' '}
                + Live GPS
              </span>

              {nativeStatus?.isNativeAndroid ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-300 inline-flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Android OS Armed</span>
                  </span>
                  {!nativeStatus.overlayPermissionGranted && (
                    <button
                      type="button"
                      onClick={() => void requestNativeOverlayPermission()}
                      className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-200 font-semibold cursor-pointer"
                    >
                      Allow Icon
                    </button>
                  )}
                  {!nativeStatus.accessibilityPermissionGranted && (
                    <button
                      type="button"
                      onClick={() => void openNativeAccessibilitySettings()}
                      className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-200 font-semibold cursor-pointer"
                    >
                      Allow Tap
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-[11px] text-white/50">
                  Phone Lock Screen Ready
                </span>
              )}
            </div>

            {(triggers.lastHeardTranscript ||
              triggers.voiceError ||
              voiceTestMessage) && (
              <p className="text-[11px] text-[#B8C9AE] truncate">
                {triggers.voiceError
                  ? triggers.voiceError
                  : triggers.lastHeardTranscript
                    ? `Heard: "${triggers.lastHeardTranscript}"`
                    : voiceTestMessage}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Password Unlock Prompt Modal */}
      {showPasswordModal && (
        <div
          data-ignore-sos-tap="true"
          className="fixed inset-0 z-[70] bg-[#182215]/75 backdrop-blur-md flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lock-password-modal-title"
        >
          <div className="w-full max-w-sm bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 shadow-2xl text-left space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#EAF0E2] text-[#2F4526] flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3
                    id="lock-password-modal-title"
                    className="text-sm font-bold text-[#182215]"
                  >
                    {passwordTarget === 'sos_table'
                      ? 'Unlock SOS Table Protection'
                      : 'Unlock OurSafe Lock Screen'}
                  </h3>
                  <p className="text-xs text-[#54634D]">
                    {passwordTarget === 'sos_table'
                      ? 'Enter password to reveal guardian numbers & manage safety controls'
                      : 'Enter your account password to return to OurSafe'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#54634D] hover:bg-[#EAF0E2] cursor-pointer"
                aria-label="Close unlock prompt"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {passwordError && (
              <p className="text-xs text-red-600 font-medium bg-red-50 p-2.5 rounded-xl border border-red-200">
                {passwordError}
              </p>
            )}

            <form onSubmit={handleVerifyPasswordAndExit} className="space-y-3">
              <input
                type="password"
                autoFocus
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                placeholder="Enter account password"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm text-[#182215] focus:bg-white focus:border-[#2F4526] focus:outline-none"
              />

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#54634D] hover:bg-[#EAF0E2] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] px-5 py-1.5 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-white text-xs font-bold cursor-pointer"
                >
                  {passwordTarget === 'sos_table' ? 'Unlock Table' : 'Unlock Screen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* "How to Place on Real Phone Lock Screen" Setup Guide Wizard */}
      {showPlacementGuide && (
        <div
          data-ignore-sos-tap="true"
          className="fixed inset-0 z-[70] bg-[#182215]/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lock-placement-title"
        >
          <div className="w-full max-w-lg bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 shadow-2xl my-auto text-left space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#EAF0E2] text-[#2F4526] flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#3E5632]">
                    Android Phone Setup
                  </p>
                  <h3
                    id="lock-placement-title"
                    className="text-lg font-semibold text-[#182215]"
                  >
                    Set on Real Android Lock Screen
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPlacementGuide(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#54634D] hover:bg-[#EAF0E2] cursor-pointer"
                aria-label="Close setup guide"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#54634D] leading-relaxed">
              To place OurSafe&apos;s SOS buttons and safety protection directly onto your actual phone&apos;s lock screen, choose your phone model below:
            </p>

            {/* Phone Brand Switcher Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-[#F4F7EF] rounded-2xl border border-[#DCE5D1] text-xs font-bold text-center">
              <button
                type="button"
                onClick={() => setGuideBrandTab('samsung')}
                className={`py-2 px-1 rounded-xl cursor-pointer transition-colors ${
                  guideBrandTab === 'samsung'
                    ? 'bg-[#2F4526] text-white'
                    : 'text-[#4B5844] hover:bg-[#EAF0E2]'
                }`}
              >
                Samsung
              </button>
              <button
                type="button"
                onClick={() => setGuideBrandTab('xiaomi')}
                className={`py-2 px-1 rounded-xl cursor-pointer transition-colors ${
                  guideBrandTab === 'xiaomi'
                    ? 'bg-[#2F4526] text-white'
                    : 'text-[#4B5844] hover:bg-[#EAF0E2]'
                }`}
              >
                Redmi / Poco
              </button>
              <button
                type="button"
                onClick={() => setGuideBrandTab('vivo_oppo')}
                className={`py-2 px-1 rounded-xl cursor-pointer transition-colors ${
                  guideBrandTab === 'vivo_oppo'
                    ? 'bg-[#2F4526] text-white'
                    : 'text-[#4B5844] hover:bg-[#EAF0E2]'
                }`}
              >
                Vivo / Oppo
              </button>
              <button
                type="button"
                onClick={() => setGuideBrandTab('pixel')}
                className={`py-2 px-1 rounded-xl cursor-pointer transition-colors ${
                  guideBrandTab === 'pixel'
                    ? 'bg-[#2F4526] text-white'
                    : 'text-[#4B5844] hover:bg-[#EAF0E2]'
                }`}
              >
                Pixel / Other
              </button>
            </div>

            {/* Brand Instructions */}
            <div className="rounded-2xl bg-[#F4F7EF] border border-[#DCE5D1] p-4 text-xs space-y-2.5 text-[#182215]">
              {guideBrandTab === 'samsung' && (
                <ol className="list-decimal list-inside space-y-2 leading-relaxed">
                  <li>
                    Open <strong>Settings &gt; Lock screen &amp; AOD</strong>.
                  </li>
                  <li>
                    Tap <strong>Shortcuts</strong> &gt; Select Left or Right shortcut &gt; choose <strong>OurSafe SOS</strong>.
                  </li>
                  <li>
                    Under <strong>Widgets</strong>, enable <strong>OurSafe Quick Widget</strong>.
                  </li>
                  <li>
                    Go to <strong>Settings &gt; Apps &gt; OurSafe &gt; Appear on top</strong> &gt; Turn ON to keep Floating SOS active over any lock screen.
                  </li>
                </ol>
              )}

              {guideBrandTab === 'xiaomi' && (
                <ol className="list-decimal list-inside space-y-2 leading-relaxed">
                  <li>
                    Open <strong>Settings &gt; Always-on display &amp; Lock screen</strong>.
                  </li>
                  <li>
                    Go to <strong>Settings &gt; Apps &gt; Manage apps &gt; OurSafe</strong>.
                  </li>
                  <li>
                    Tap <strong>Other permissions</strong> &gt; Enable:
                    <ul className="list-disc list-inside ml-4 mt-1 font-semibold text-[#2F4526]">
                      <li>Show on Lock screen (Accept)</li>
                      <li>Display pop-up windows while running in background</li>
                    </ul>
                  </li>
                  <li>
                    Lock your phone — OurSafe SOS will be accessible directly on the lock screen.
                  </li>
                </ol>
              )}

              {guideBrandTab === 'vivo_oppo' && (
                <ol className="list-decimal list-inside space-y-2 leading-relaxed">
                  <li>
                    Open <strong>Settings &gt; Home screen &amp; Lock screen &gt; Lock screen shortcut</strong>.
                  </li>
                  <li>
                    Select <strong>OurSafe</strong> as the primary corner shortcut.
                  </li>
                  <li>
                    Go to <strong>Settings &gt; Privacy / Special App Access &gt; Display over other apps</strong> &gt; Allow OurSafe.
                  </li>
                </ol>
              )}

              {guideBrandTab === 'pixel' && (
                <ol className="list-decimal list-inside space-y-2 leading-relaxed">
                  <li>
                    Open <strong>Settings &gt; Display &gt; Lock screen &gt; Shortcuts</strong>.
                  </li>
                  <li>
                    Set Left or Right shortcut to <strong>OurSafe</strong>.
                  </li>
                  <li>
                    In <strong>Notifications on lock screen</strong>, select <strong>&ldquo;Show all notification content&rdquo;</strong> to display the permanent interactive OurSafe SOS notification widget.
                  </li>
                </ol>
              )}
            </div>

            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-950 space-y-1">
              <p className="font-bold text-amber-900 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>Tip: Android App Pinning (Kiosk Lock Screen Mode)</span>
              </p>
              <p className="leading-relaxed">
                If you are walking alone at night, you can Pin OurSafe to your screen (Settings &gt; Security &gt; App Pinning). This locks the entire phone directly into OurSafe until you unlock with your fingerprint or PIN.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowPlacementGuide(false)}
                className="min-h-[44px] px-6 py-2 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-white text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
