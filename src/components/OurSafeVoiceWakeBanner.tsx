import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Radio,
  ShieldAlert,
  Volume2,
  X,
} from 'lucide-react';

interface BrowserSpeechRecEvent {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

interface BrowserSpeechRec {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onresult: ((ev: BrowserSpeechRecEvent) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecCtor = new () => BrowserSpeechRec;

function getSpeechRecCtor(): SpeechRecCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecCtor;
    webkitSpeechRecognition?: SpeechRecCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface OurSafeVoiceWakeBannerProps {
  open: boolean;
  greetingText: string;
  phase: 'greeting' | 'listening' | 'speaking' | 'executed';
  liveStatus: 'idle' | 'connecting' | 'connected' | 'error';
  lastHeardCommand: string;
  lastActionSummary: string;
  voiceLanguage: string;
  onRunVoiceCommand: (commandText: string) => void;
  onReplayGreeting: () => void;
  onClose: () => void;
}

const QUICK_COMMANDS = [
  'Open SOS',
  'Activate Threat Mode',
  'Share my location',
  'Open Travel Mode',
  'Find police numbers',
  'Open Settings',
];

export const OurSafeVoiceWakeBanner: React.FC<OurSafeVoiceWakeBannerProps> = ({
  open,
  greetingText,
  phase,
  liveStatus,
  lastHeardCommand,
  lastActionSummary,
  voiceLanguage,
  onRunVoiceCommand,
  onReplayGreeting,
  onClose,
}) => {
  const [fallbackMicActive, setFallbackMicActive] = useState(false);
  const [interimSpoken, setInterimSpoken] = useState('');
  const recRef = useRef<BrowserSpeechRec | null>(null);
  const onRunRef = useRef(onRunVoiceCommand);
  useEffect(() => {
    onRunRef.current = onRunVoiceCommand;
  }, [onRunVoiceCommand]);

  // Browser Web Speech command capture fallback whenever the sheet is open in listening phase
  // and Gemini Live WebSocket is NOT actively holding the mic (e.g. offline or fallback mode)
  const shouldUseFallbackMic =
    open &&
    phase !== 'greeting' &&
    liveStatus !== 'connected' &&
    liveStatus !== 'connecting';

  useEffect(() => {
    if (!shouldUseFallbackMic) {
      if (recRef.current) {
        try {
          recRef.current.onend = null;
          recRef.current.stop();
        } catch {
          // Ignore
        }
        recRef.current = null;
      }
      setFallbackMicActive(false);
      return;
    }

    const Ctor = getSpeechRecCtor();
    if (!Ctor) return;

    let cancelled = false;
    const startRec = () => {
      if (cancelled) return;
      try {
        const rec = new Ctor();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = voiceLanguage || 'en-IN';

        rec.onstart = () => setFallbackMicActive(true);
        rec.onresult = (event) => {
          let finalTranscript = '';
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const chunk = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += ` ${chunk}`;
            } else {
              interim += ` ${chunk}`;
            }
          }
          if (interim.trim()) {
            setInterimSpoken(interim.trim());
          }
          if (finalTranscript.trim()) {
            setInterimSpoken('');
            onRunRef.current(finalTranscript.trim());
          }
        };
        rec.onerror = () => {
          setFallbackMicActive(false);
        };
        rec.onend = () => {
          setFallbackMicActive(false);
          if (!cancelled) {
            window.setTimeout(startRec, 350);
          }
        };
        recRef.current = rec;
        rec.start();
      } catch {
        setFallbackMicActive(false);
      }
    };

    startRec();

    return () => {
      cancelled = true;
      if (recRef.current) {
        try {
          recRef.current.onend = null;
          recRef.current.stop();
        } catch {
          // Ignore
        }
        recRef.current = null;
      }
      setFallbackMicActive(false);
    };
  }, [shouldUseFallbackMic, voiceLanguage]);

  if (!open) return null;

  const isListeningLive =
    liveStatus === 'connected' || fallbackMicActive;

  return (
    <div
      data-ignore-sos-tap="true"
      role="dialog"
      aria-label="OurSafe Hands-Free Voice Assistant"
      className="fixed inset-x-3 sm:inset-x-auto sm:right-6 bottom-[70px] lg:bottom-20 z-50 sm:w-[430px] rounded-3xl bg-[#162113]/96 backdrop-blur-xl border border-[#7DA269]/40 text-[#F6F9F2] shadow-2xl shadow-black/35 overflow-hidden"
    >
      {/* Top Active Voice Bar */}
      <div className="px-5 pt-4 pb-3.5 border-b border-white/10 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              phase === 'greeting' || phase === 'speaking'
                ? 'bg-emerald-500 text-white'
                : isListeningLive
                  ? 'bg-[#3C662B] text-emerald-200 ring-4 ring-emerald-400/20'
                  : 'bg-white/10 text-[#C8DAB9]'
            }`}
          >
            {phase === 'greeting' || phase === 'speaking' ? (
              <Volume2 className="w-5 h-5" />
            ) : isListeningLive ? (
              <Mic className="w-5 h-5" />
            ) : (
              <Radio className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-emerald-300">
              {phase === 'greeting'
                ? 'Speaking Voice Greeting'
                : liveStatus === 'connecting'
                  ? 'Connecting Full-App Voice Control'
                  : isListeningLive
                    ? 'Listening Across Entire App'
                    : 'OurSafe Voice Ready'}
            </p>
            <p className="mt-0.5 text-sm sm:text-[15px] font-semibold text-white leading-snug">
              &ldquo;{greetingText}&rdquo;
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close OurSafe Voice Assistant"
          className="min-w-[36px] min-h-[36px] rounded-xl bg-white/10 hover:bg-white/20 text-white/85 flex items-center justify-center transition-colors cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Transcript & Status Area */}
      <div className="px-5 py-3.5 space-y-3">
        {(interimSpoken || lastHeardCommand || lastActionSummary) && (
          <div className="rounded-2xl bg-white/[0.06] border border-white/10 px-3.5 py-2.5 space-y-1 text-xs">
            {(interimSpoken || lastHeardCommand) && (
              <p className="text-[#DCE8D3]">
                <span className="text-white/55 font-semibold">Heard: </span>
                <span className="font-medium">
                  &ldquo;{interimSpoken || lastHeardCommand}&rdquo;
                </span>
              </p>
            )}
            {lastActionSummary && (
              <p className="text-emerald-300 leading-relaxed">
                {lastActionSummary}
              </p>
            )}
          </div>
        )}

        {/* Quick Voice Command Controls */}
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-white/65">
            Speak any command or tap below to control the full app:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_COMMANDS.map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => onRunVoiceCommand(cmd)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  cmd === 'Open SOS'
                    ? 'bg-red-600/90 hover:bg-red-600 text-white inline-flex items-center gap-1'
                    : 'bg-white/10 hover:bg-white/20 text-[#ECF4E6]'
                }`}
              >
                {cmd === 'Open SOS' && <ShieldAlert className="w-3 h-3" />}
                <span>{cmd}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Utility Row */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onReplayGreeting}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-[#E8F1E1] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Volume2 className="w-3.5 h-3.5 text-emerald-300" />
            <span>Speak Greeting Again</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-red-600/85 hover:bg-red-600 text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <MicOff className="w-3.5 h-3.5" />
            <span>Stop Voice</span>
          </button>
        </div>
      </div>
    </div>
  );
};
