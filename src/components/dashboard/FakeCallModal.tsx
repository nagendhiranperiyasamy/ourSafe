import React, { useEffect, useRef, useState } from 'react';
import { MicOff, Phone, PhoneOff, User, Volume2 } from 'lucide-react';

interface FakeCallModalProps {
  callerName: string;
  onClose: () => void;
}

export const FakeCallModal: React.FC<FakeCallModalProps> = ({
  callerName,
  onClose,
}) => {
  const [phase, setPhase] = useState<'ringing' | 'connected'>('ringing');
  const [callSeconds, setCallSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const ringTimerRef = useRef<number | null>(null);

  const stopRingtone = () => {
    if (ringTimerRef.current !== null) {
      window.clearInterval(ringTimerRef.current);
      ringTimerRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  useEffect(() => {
    if (phase !== 'ringing') {
      stopRingtone();
      return;
    }

    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctor();
      audioCtxRef.current = ctx;

      const playRingBurst = () => {
        if (!audioCtxRef.current) return;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(440, ctx.currentTime);
        osc2.frequency.setValueAtTime(480, ctx.currentTime);
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.85);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 0.9);
        osc2.stop(ctx.currentTime + 0.9);
      };

      playRingBurst();
      ringTimerRef.current = window.setInterval(playRingBurst, 1900);
    } catch {
      // Browser blocked autoplay before interaction
    }

    return () => {
      stopRingtone();
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'connected') return;
    const id = window.setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  const mins = Math.floor(callSeconds / 60);
  const secs = callSeconds % 60;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#152014] text-white flex flex-col justify-between p-6 sm:p-10"
      role="dialog"
      aria-modal="true"
      aria-label={`Incoming call from ${callerName}`}
    >
      <div className="text-center pt-4 space-y-2">
        <p className="text-[11px] font-medium text-[#CDD7C1]/80">
          Mobile Call
        </p>
        <div className="w-24 h-24 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mx-auto mt-6">
          <User className="w-11 h-11 text-[#E6EFE0]" />
        </div>
        <h2 className="text-3xl font-semibold tracking-tight pt-3">{callerName}</h2>
        <p className="text-sm text-[#CDD7C1] font-mono tabular-nums">
          {phase === 'ringing'
            ? 'Incoming call...'
            : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`}
        </p>
      </div>

      {phase === 'connected' && (
        <div className="max-w-xs w-full mx-auto grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className={`min-h-[64px] rounded-2xl border flex flex-col items-center justify-center gap-1 text-xs font-semibold cursor-pointer ${
              muted
                ? 'bg-white text-[#152014] border-white'
                : 'bg-white/10 text-white border-white/15'
            }`}
          >
            <MicOff className="w-5 h-5" />
            <span>{muted ? 'Muted' : 'Mute'}</span>
          </button>
          <button
            type="button"
            onClick={() => setSpeaker((s) => !s)}
            className={`min-h-[64px] rounded-2xl border flex flex-col items-center justify-center gap-1 text-xs font-semibold cursor-pointer ${
              speaker
                ? 'bg-white text-[#152014] border-white'
                : 'bg-white/10 text-white border-white/15'
            }`}
          >
            <Volume2 className="w-5 h-5" />
            <span>Speaker</span>
          </button>
        </div>
      )}

      <div className="max-w-xs w-full mx-auto pb-6">
        {phase === 'ringing' ? (
          <div className="flex items-center justify-between gap-8">
            <button
              type="button"
              onClick={() => {
                stopRingtone();
                onClose();
              }}
              className="flex flex-col items-center gap-2 cursor-pointer"
            >
              <span className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-lg">
                <PhoneOff className="w-7 h-7 text-white" />
              </span>
              <span className="text-xs font-semibold text-[#E6EFE0]">Decline</span>
            </button>

            <button
              type="button"
              onClick={() => setPhase('connected')}
              className="flex flex-col items-center gap-2 cursor-pointer"
            >
              <span className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center shadow-lg">
                <Phone className="w-7 h-7 text-white" />
              </span>
              <span className="text-xs font-semibold text-[#E6EFE0]">Accept</span>
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onClose}
              className="flex flex-col items-center gap-2 cursor-pointer"
            >
              <span className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-lg">
                <PhoneOff className="w-7 h-7 text-white" />
              </span>
              <span className="text-xs font-semibold text-[#E6EFE0]">End Call</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
