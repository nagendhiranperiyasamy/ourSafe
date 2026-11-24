import React, { useState } from 'react';
import { Fingerprint, ShieldAlert, Sparkles } from 'lucide-react';

interface BiometricSensorTriggerProps {
  tapCount: number;
  requiredTaps?: number;
  onSensorTap: () => void;
  placement?: 'vivo_y16_side' | 'front_center' | 'bottom_right' | 'hidden';
  compact?: boolean;
}

/**
 * BiometricSensorTrigger
 * Mobile-First Fingerprint Biometric Sensor Trigger (Vivo Y16 side-sensor & iPhone/front sensor).
 * Tap 3x on this sensor to immediately call emergency contacts & police,
 * completely scroll-proof and protected against accidental pocket touches.
 */
export const BiometricSensorTrigger: React.FC<BiometricSensorTriggerProps> = ({
  tapCount,
  requiredTaps = 3,
  onSensorTap,
  placement,
  compact = false,
}) => {
  const [pressed, setPressed] = useState(false);

  if (placement === 'hidden') {
    return null;
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPressed(true);
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(tapCount === requiredTaps - 1 ? [80, 50, 120] : 45);
      }
    } catch {
      // ignore
    }
    onSensorTap();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPressed(false);
  };

  // Special Vivo Y16 Side Sensor (Right screen edge vertical thumb sensor)
  if (placement === 'vivo_y16_side') {
    return (
      <div
        data-fingerprint-sensor="true"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        role="button"
        tabIndex={0}
        aria-label={`Vivo Y16 Side Fingerprint Sensor: ${tapCount} of ${requiredTaps} taps`}
        title="Vivo Y16 Side Fingerprint Sensor: Tap 3 times for SOS Call"
        className={`fixed right-0 top-[48%] -translate-y-1/2 z-50 select-none touch-manipulation cursor-pointer transition-all flex flex-col items-center justify-center w-11 min-h-[96px] rounded-l-2xl border-l border-y shadow-2xl backdrop-blur-md ${
          tapCount > 0
            ? 'bg-red-600 text-white border-red-400 ring-4 ring-red-500/40 animate-pulse'
            : pressed
              ? 'bg-[#182215] text-emerald-300 border-emerald-400 scale-95'
              : 'bg-[#2F4526]/90 text-emerald-300 border-[#6B8A5A] hover:bg-[#25391E]'
        }`}
      >
        <Fingerprint className={`w-5 h-5 shrink-0 ${tapCount > 0 ? 'animate-bounce text-white' : ''}`} />
        <span className="text-[10px] font-black font-mono tracking-tighter mt-1">
          {tapCount > 0 ? `${tapCount}/${requiredTaps}` : '3×'}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/75 mt-0.5 [writing-mode:vertical-lr] rotate-180">
          Sensor
        </span>
      </div>
    );
  }

  // Front Center Sensor (iPhone / in-display scanner phones)
  if (placement === 'front_center') {
    return (
      <div
        data-fingerprint-sensor="true"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        role="button"
        tabIndex={0}
        aria-label={`Front Fingerprint Sensor: ${tapCount} of ${requiredTaps} taps`}
        title="Front Fingerprint Sensor: Tap 3 times for SOS Call"
        className={`fixed bottom-[74px] left-1/2 -translate-x-1/2 z-50 select-none touch-manipulation cursor-pointer transition-all flex items-center justify-center gap-2 px-4 py-2 rounded-full border shadow-2xl backdrop-blur-md ${
          tapCount > 0
            ? 'bg-red-600 text-white border-red-400 ring-4 ring-red-500/40 scale-105'
            : pressed
              ? 'bg-[#182215] text-emerald-300 border-emerald-400 scale-95'
              : 'bg-[#2F4526]/90 text-white border-[#6B8A5A] hover:bg-[#25391E]'
        }`}
      >
        <Fingerprint className={`w-5 h-5 shrink-0 ${tapCount > 0 ? 'animate-bounce text-white' : 'text-emerald-300'}`} />
        <span className="text-xs font-bold font-mono">
          {tapCount > 0 ? `Tap ${tapCount}/${requiredTaps} for SOS` : '3× Tap Sensor SOS'}
        </span>
      </div>
    );
  }

  if (compact) {
    return (
      <button
        type="button"
        data-fingerprint-sensor="true"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        title="Tap 3 times on this fingerprint sensor for SOS"
        aria-label="Fingerprint Sensor SOS Trigger (3x tap)"
        className={`relative select-none touch-manipulation transition-all cursor-pointer flex items-center justify-center rounded-2xl min-h-[44px] min-w-[44px] px-3 py-2 border shadow-md ${
          tapCount > 0
            ? 'bg-red-600 text-white border-red-500 ring-4 ring-red-500/30 scale-95'
            : pressed
              ? 'bg-[#182215] text-emerald-400 border-emerald-500 scale-95'
              : 'bg-[#FCFDF9] text-[#24371D] border-[#B8C6A8] hover:bg-[#EAF0E2]'
        }`}
      >
        <Fingerprint className={`w-5 h-5 shrink-0 ${tapCount > 0 ? 'animate-bounce' : ''}`} />
        <span className="ml-1.5 text-xs font-bold font-mono">
          {tapCount > 0 ? `${tapCount}/${requiredTaps}` : 'Sensor'}
        </span>
      </button>
    );
  }

  return (
    <div
      data-fingerprint-sensor="true"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      role="button"
      tabIndex={0}
      aria-label={`Fingerprint Sensor Emergency Trigger: ${tapCount} of ${requiredTaps} taps`}
      className={`group relative select-none touch-manipulation rounded-3xl p-4 sm:p-5 border transition-all cursor-pointer overflow-hidden ${
        tapCount > 0
          ? 'bg-red-950/90 text-white border-red-600 ring-4 ring-red-500/30'
          : pressed
            ? 'bg-[#1B2917] text-emerald-300 border-emerald-500'
            : 'bg-[#FCFDF9] text-[#182215] border-[#B8C6A8] hover:border-[#2F4526] shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
              tapCount > 0
                ? 'bg-red-600 text-white'
                : pressed
                  ? 'bg-emerald-600 text-white ring-4 ring-emerald-400/30'
                  : 'bg-[#EAF0E2] text-[#2F4526]'
            }`}
          >
            <Fingerprint className="w-6 h-6 animate-pulse" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#3E5632]">
                Biometric Sensor Zone
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EAF0E2] text-[#24371D] font-semibold">
                Vivo Y16 / Side Edge
              </span>
            </div>
            <p className="text-sm sm:text-base font-semibold leading-snug truncate">
              {tapCount > 0
                ? `Emergency Tap ${tapCount} of ${requiredTaps} Recorded!`
                : '3× Tap Fingerprint Sensor for SOS'}
            </p>
            <p className="text-xs text-[#54634D] leading-relaxed">
              Tapping this sensor 3 times calls SOS and shares live GPS location.
            </p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div
            className={`text-xl sm:text-2xl font-black font-mono tabular-nums px-3 py-1.5 rounded-xl border ${
              tapCount > 0
                ? 'bg-red-600 text-white border-red-400 animate-pulse'
                : 'bg-[#F4F7EF] text-[#2F4526] border-[#D4DFC8]'
            }`}
          >
            {tapCount}/{requiredTaps}
          </div>
          <span className="text-[10px] text-[#54634D] block mt-1">Tap 3x</span>
        </div>
      </div>

      {tapCount > 0 && (
        <div className="mt-3 pt-3 border-t border-red-700/40 flex items-center justify-between text-xs text-red-200">
          <span className="flex items-center gap-1.5 font-bold">
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            <span>Tap {requiredTaps - tapCount} more time{requiredTaps - tapCount > 1 ? 's' : ''} to dispatch call</span>
          </span>
          <span className="text-[11px] font-mono">Window: 2.2s</span>
        </div>
      )}
    </div>
  );
};
