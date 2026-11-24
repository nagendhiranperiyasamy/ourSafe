import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Compass,
  Lock,
  MapPin,
  Mic,
  MicOff,
  Phone,
  Radio,
  Send,
  ShieldAlert,
  Volume2,
  WifiOff,
} from 'lucide-react';
import { GlobalVoiceControllerState } from '../../hooks/useGlobalVoiceController';
import { formatTimeShort } from '../../utils/storage';

interface AiVoiceAssistantPageProps {
  voiceController: GlobalVoiceControllerState;
  isOnline: boolean;
  secretVoiceCode?: string;
  onManualSos: () => void;
  onDualCallNow: () => void;
  onTriggerVoiceSos?: (phrase: string) => void;
}

const SAMPLE_VOICE_COMMANDS = [
  'Balaji (Secret SOS Trigger)',
  'Go to SOS and Call Guardian and Police',
  'Activate Threat Mode',
  'Share My Location with Guardian and Police',
  'Find Nearby Police Numbers',
  'Open Travel Mode',
  'Open Lock Shield',
  'Start a Fake Call from Mom',
  'Deactivate Threat Mode',
];

export const AiVoiceAssistantPage: React.FC<AiVoiceAssistantPageProps> = ({
  voiceController,
  isOnline,
  secretVoiceCode = 'Balaji',
  onManualSos,
  onDualCallNow,
  onTriggerVoiceSos,
}) => {
  const {
    liveStatus,
    liveError,
    isSpeaking,
    textBusy,
    entries,
    startLiveVoice,
    disconnectLiveVoice,
    runTextCommand,
  } = voiceController;

  const [textInput, setTextInput] = useState('');
  const listEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [entries]);

  return (
    <div className="space-y-6">
      {/* Live Voice Controller Hero Card */}
      <section className="bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 sm:p-8 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="text-[#3E5632]">
                OurSafe AI Voice Controller · Persistent Across Every Screen
              </span>
              <span aria-hidden="true" className="text-[#78886F]">
                ·
              </span>
              <span
                className={
                  liveStatus === 'connected'
                    ? 'text-emerald-700'
                    : liveStatus === 'connecting'
                      ? 'text-amber-700'
                      : 'text-[#54634D]'
                }
              >
                {liveStatus === 'connected'
                  ? isSpeaking
                    ? 'Full-App Voice ON · Assistant Speaking'
                    : 'Full-App Voice ON · Listening Everywhere'
                  : liveStatus === 'connecting'
                    ? 'Connecting to Live Voice...'
                    : 'Standby'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-semibold text-[#182215] tracking-tight">
              100% Hands-Free Voice Control for the Entire App
            </h1>
            <p className="text-sm text-[#465340] leading-relaxed">
              Once Live Voice is turned ON, it stays connected even as you switch to SOS, Threat Mode, Travel Mode, or Nearby Police. Simply speak &ldquo;Go to SOS&rdquo;, &ldquo;Activate Threat Mode&rdquo; (auto-records video &amp; audio), or &ldquo;Share my location&rdquo; (sends live GPS to both Guardian &amp; Police).
            </p>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-3">
            {liveStatus === 'connected' || liveStatus === 'connecting' ? (
              <button
                type="button"
                onClick={disconnectLiveVoice}
                className="w-full min-h-[54px] px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
              >
                <MicOff className="w-5 h-5" />
                <span>Turn Off Live Voice Control</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={startLiveVoice}
                className="w-full min-h-[54px] px-6 py-3 rounded-2xl bg-[#2F4526] hover:bg-[#23351C] text-[#F6F9F2] text-sm font-bold flex items-center justify-center gap-2.5 shadow-sm transition-colors cursor-pointer"
              >
                <Mic className="w-5 h-5" />
                <span>Start Full-App Live Voice Control</span>
              </button>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onDualCallNow}
                className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Phone className="w-4 h-4" />
                <span>Call Guardian &amp; Police</span>
              </button>
              <button
                type="button"
                onClick={onManualSos}
                className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Instant SOS</span>
              </button>
            </div>
          </div>
        </div>

        {!isOnline && (
          <div className="mt-5 rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0 text-amber-700" />
            <span>
              You are currently offline. Live AI Voice needs an active internet connection; use the SOS page for offline guardian numbers and direct dialers.
            </span>
          </div>
        )}

        {liveError && (
          <div
            role="alert"
            className="mt-5 rounded-2xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-800 flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{liveError}</span>
          </div>
        )}
      </section>

      {/* Quick Executable Commands + Live Conversation Feed */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 space-y-4">
          <div>
            <p className="text-xs font-semibold text-[#3E5632]">
              Automated Voice &amp; One-Tap Commands
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#182215]">
              Say or Tap Any Safety Command
            </h2>
            <p className="mt-1 text-xs text-[#54634D]">
              Every command automatically opens the right screen and triggers the protection workflow without manual steps.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
            {SAMPLE_VOICE_COMMANDS.map((cmd) => {
              const lower = cmd.toLowerCase();
              const isUrgent =
                lower.includes('sos') ||
                lower.includes('threat') && !lower.includes('deactivate');
              return (
                <button
                  key={cmd}
                  type="button"
                  disabled={textBusy}
                  onClick={() => {
                    const norm = cmd.toLowerCase();
                    const normCode = (secretVoiceCode || 'balaji').toLowerCase();
                    if (norm.includes('balaji') || norm.includes(normCode)) {
                      onTriggerVoiceSos ? onTriggerVoiceSos(cmd) : onManualSos();
                      return;
                    }
                    void runTextCommand(cmd);
                  }}
                  className={`min-h-[44px] px-4 py-2.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer disabled:opacity-60 ${
                    isUrgent
                      ? 'bg-red-50/70 hover:bg-red-100 border-red-200 text-red-800'
                      : 'bg-[#F4F7EF] hover:bg-[#E7EFE0] border-[#CFD9C3] text-[#182215]'
                  }`}
                >
                  <span>&ldquo;{cmd}&rdquo;</span>
                  {lower.includes('travel') ? (
                    <Compass className="w-3.5 h-3.5 shrink-0 text-[#2F4526]" />
                  ) : lower.includes('lock') ? (
                    <Lock className="w-3.5 h-3.5 shrink-0 text-[#2F4526]" />
                  ) : lower.includes('nearby') ? (
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-[#2F4526]" />
                  ) : lower.includes('location') ? (
                    <Radio className="w-3.5 h-3.5 shrink-0 text-[#2F4526]" />
                  ) : lower.includes('threat') ? (
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                  ) : lower.includes('fake') ? (
                    <Phone className="w-3.5 h-3.5 shrink-0 text-[#2F4526]" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-red-600" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Live Transcript & Action Execution Log */}
        <div className="lg:col-span-7 bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 flex flex-col">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-semibold text-[#3E5632]">
                Real-Time Transcript &amp; Automated Actions
              </p>
              <h2 className="mt-0.5 text-lg font-semibold text-[#182215]">
                Voice Conversation Log
              </h2>
            </div>
            {liveStatus === 'connected' && (
              <span className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1.5">
                <Volume2 className="w-4 h-4" />
                <span>Live Audio Active</span>
              </span>
            )}
          </div>

          <div className="rounded-2xl bg-[#F4F7EF] border border-[#CFD9C3] p-4 h-[350px] overflow-y-auto space-y-3">
            {entries.map((item) => (
              <div
                key={item.id}
                className={`flex flex-col ${
                  item.role === 'user'
                    ? 'items-end'
                    : item.role === 'action'
                      ? 'items-center'
                      : 'items-start'
                }`}
              >
                {item.role === 'action' ? (
                  <div className="w-full rounded-xl bg-[#E7EFE0] border border-[#C3D0B4] px-3.5 py-2 text-xs font-semibold text-[#1E2E18] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#2F4526] shrink-0" />
                    <span>{item.text}</span>
                  </div>
                ) : (
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      item.role === 'user'
                        ? 'bg-[#2F4526] text-[#F6F9F2]'
                        : 'bg-[#FCFDF9] border border-[#CFD9C3] text-[#182215]'
                    }`}
                  >
                    {item.role === 'assistant' && (
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#3E5632] mb-1">
                        <Bot className="w-3.5 h-3.5" />
                        <span>OurSafe AI Controller</span>
                      </div>
                    )}
                    <p>{item.text}</p>
                  </div>
                )}
                <span className="mt-1 text-[11px] text-[#5C6B55] tabular-nums px-1">
                  {formatTimeShort(item.timestamp)}
                </span>
              </div>
            ))}
            <div ref={listEndRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const cmd = textInput.trim();
              if (!cmd) return;
              setTextInput('');
              const norm = cmd.toLowerCase();
              const normCode = (secretVoiceCode || 'balaji').toLowerCase();
              if (norm === normCode || norm.includes('balaji') || norm.includes(normCode)) {
                onTriggerVoiceSos ? onTriggerVoiceSos(cmd) : onManualSos();
                return;
              }
              void runTextCommand(cmd);
            }}
            className="mt-4 flex items-center gap-2.5"
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              disabled={textBusy}
              placeholder='Speak or type (e.g. "Go to SOS", "Share my location")...'
              aria-label="Send a voice or text app command"
              className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm text-[#182215] placeholder:text-[#6B7A63] focus:bg-white focus:border-[#2F4526] focus:outline-none"
            />
            <button
              type="submit"
              disabled={textBusy || !textInput.trim()}
              className="min-h-[46px] px-5 py-2.5 rounded-xl bg-[#2F4526] hover:bg-[#23351C] disabled:opacity-50 text-[#F6F9F2] text-sm font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{textBusy ? 'Running...' : 'Send'}</span>
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};
