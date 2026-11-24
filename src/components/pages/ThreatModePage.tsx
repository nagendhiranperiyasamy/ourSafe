import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Battery,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  LocateFixed,
  MapPin,
  Mic,
  Phone,
  Search,
  Shield,
  ShieldAlert,
  Square,
  Video,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  GeoLocationState,
  NearbyPoliceAiResult,
  SosContact,
  ThreatSessionState,
} from '../../types/safety';
import { saveRecordingToDb } from '../../utils/evidenceDb';
import { syncEvidenceMetaToFirebase } from '../../utils/firebaseSync';
import { formatDateTimeShort, formatPhoneForTel } from '../../utils/storage';

interface ThreatModePageProps {
  userId: string;
  contacts: SosContact[];
  threatSession: ThreatSessionState | null;
  recoveredInterruption: ThreatSessionState | null;
  geoLocation: GeoLocationState;
  isOnline: boolean;
  soundAllowed: boolean;
  nearbyPoliceResult: NearbyPoliceAiResult | null;
  nearbyPoliceLoading: boolean;
  nearbyPoliceError: string;
  onFetchNearbyPoliceAi: (areaQuery?: string) => void;
  onRequestLocation: () => void;
  onActivateThreatMode: (source?: string) => void;
  onDeactivateThreatMode: (note?: string) => void;
  onUpdateThreatSnapshot: (partial: Partial<ThreatSessionState>) => void;
  onRecordingSaved: (meta: {
    id: string;
    kind: 'audio' | 'video';
    durationSec: number;
    locationCoords?: string;
  }) => void;
  onSimulateConnectivityDrop: () => void;
  onDismissRecoveryBanner: () => void;
  onEscalateToSos: () => void;
  onOpenHistory: () => void;
  onWakeVoice?: () => void;
}

export const ThreatModePage: React.FC<ThreatModePageProps> = ({
  userId,
  contacts,
  threatSession,
  recoveredInterruption,
  geoLocation,
  isOnline,
  soundAllowed,
  nearbyPoliceResult,
  nearbyPoliceLoading,
  nearbyPoliceError,
  onFetchNearbyPoliceAi,
  onRequestLocation,
  onActivateThreatMode,
  onDeactivateThreatMode,
  onUpdateThreatSnapshot,
  onRecordingSaved,
  onSimulateConnectivityDrop,
  onDismissRecoveryBanner,
  onEscalateToSos,
  onOpenHistory,
  onWakeVoice,
}) => {
  const [elapsedText, setElapsedText] = useState('00:00');
  const [recordingMode, setRecordingMode] = useState<'none' | 'audio' | 'video'>(
    'none'
  );
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState('');
  const [recordingSavedNotice, setRecordingSavedNotice] = useState('');
  const [batteryPercent, setBatteryPercent] = useState<number | null>(null);
  const [alarmPlaying, setAlarmPlaying] = useState(false);
  const [manualAreaInput, setManualAreaInput] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartTimeRef = useRef<number>(0);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sirenTimerRef = useRef<number | null>(null);

  const primaryGuardian = contacts.find((c) => c.isPrimary) ?? contacts[0];
  const isActive = Boolean(threatSession?.active);
  const autoStartedSessionRef = useRef<string | null>(null);
  const recordingModeRef = useRef<'none' | 'audio' | 'video'>('none');

  useEffect(() => {
    recordingModeRef.current = recordingMode;
  }, [recordingMode]);

  // Read device battery status when supported
  useEffect(() => {
    const navWithBattery = navigator as Navigator & {
      getBattery?: () => Promise<{
        level: number;
        addEventListener: (ev: string, cb: () => void) => void;
      }>;
    };
    if (!navWithBattery.getBattery) return;
    let mounted = true;
    navWithBattery
      .getBattery()
      .then((battery) => {
        if (!mounted) return;
        const pct = Math.round(battery.level * 100);
        setBatteryPercent(pct);
        if (isActive) {
          onUpdateThreatSnapshot({ batteryPercent: pct });
        }
        battery.addEventListener('levelchange', () => {
          if (!mounted) return;
          const nextPct = Math.round(battery.level * 100);
          setBatteryPercent(nextPct);
        });
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [isActive, onUpdateThreatSnapshot]);

  // Active Threat Mode elapsed timer
  useEffect(() => {
    if (!threatSession?.active) {
      setElapsedText('00:00');
      return;
    }
    const update = () => {
      const diff = Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(threatSession.activatedAt).getTime()) / 1000
        )
      );
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setElapsedText(
        `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      );
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [threatSession]);

  // Recording elapsed timer
  useEffect(() => {
    if (recordingMode === 'none') {
      setRecordingSeconds(0);
      return;
    }
    const id = window.setInterval(() => {
      setRecordingSeconds(
        Math.max(1, Math.floor((Date.now() - recordStartTimeRef.current) / 1000))
      );
    }, 1000);
    return () => window.clearInterval(id);
  }, [recordingMode]);

  const stopAttentionTone = () => {
    if (sirenTimerRef.current !== null) {
      window.clearInterval(sirenTimerRef.current);
      sirenTimerRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setAlarmPlaying(false);
  };

  const toggleAttentionTone = () => {
    if (alarmPlaying) {
      stopAttentionTone();
      return;
    }
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctor();
      audioCtxRef.current = ctx;
      const pulse = (freq: number) => {
        if (!audioCtxRef.current) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.48);
      };
      let high = true;
      pulse(880);
      sirenTimerRef.current = window.setInterval(() => {
        high = !high;
        pulse(high ? 880 : 660);
      }, 520);
      setAlarmPlaying(true);
    } catch {
      setAlarmPlaying(false);
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    return () => {
      stopAttentionTone();
      stopRecording();
    };
  }, []);

  const startRecording = async (
    kind: 'audio' | 'video',
    options?: { allowAudioFallback?: boolean; skipActivate?: boolean }
  ) => {
    setRecordingError('');
    setRecordingSavedNotice('');

    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setRecordingError(
        'Media recording is not supported in this browser environment.'
      );
      return;
    }

    if (!isActive && !options?.skipActivate) {
      onActivateThreatMode(`Threat Mode ${kind} recording`);
    }

    stopRecording();

    let resolvedKind: 'audio' | 'video' = kind;
    let stream: MediaStream;

    try {
      stream = await navigator.mediaDevices.getUserMedia(
        kind === 'video'
          ? { audio: true, video: { facingMode: 'environment' } }
          : { audio: true }
      );
    } catch {
      if (kind === 'video' && options?.allowAudioFallback) {
        try {
          resolvedKind = 'audio';
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setRecordingError(
            'Camera unavailable — automatically switched to continuous Audio recording.'
          );
        } catch {
          setRecordingError(
            'Camera & microphone permissions were blocked by the browser. Allow mic/camera access so Threat Mode can auto-record continuously.'
          );
          return;
        }
      } else {
        setRecordingError(
          `Permission for ${kind === 'video' ? 'camera/microphone' : 'microphone'} was denied or device is unavailable.`
        );
        return;
      }
    }

    try {
      mediaStreamRef.current = stream;

      if (resolvedKind === 'video') {
        window.setTimeout(() => {
          if (videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = stream;
            videoPreviewRef.current.play().catch(() => {});
          }
        }, 50);
      }

      const preferredMime =
        resolvedKind === 'video'
          ? MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
            ? 'video/webm;codecs=vp8,opus'
            : 'video/webm'
          : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm';

      const recorder = new MediaRecorder(
        stream,
        MediaRecorder.isTypeSupported(preferredMime)
          ? { mimeType: preferredMime }
          : undefined
      );
      chunksRef.current = [];
      recordStartTimeRef.current = Date.now();

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        const durationSec = Math.max(
          1,
          Math.round((Date.now() - recordStartTimeRef.current) / 1000)
        );
        const blob = new Blob(chunksRef.current, {
          type:
            recorder.mimeType ||
            (resolvedKind === 'video' ? 'video/webm' : 'audio/webm'),
        });
        const recId = `rec-${Date.now()}`;
        const coords =
          geoLocation.status === 'granted' &&
          geoLocation.latitude !== null &&
          geoLocation.longitude !== null
            ? `${geoLocation.latitude.toFixed(5)}, ${geoLocation.longitude.toFixed(5)}`
            : undefined;

        try {
          await saveRecordingToDb({
            id: recId,
            userId,
            kind: resolvedKind,
            mimeType: blob.type,
            createdAt: new Date().toISOString(),
            durationSec,
            sizeBytes: blob.size,
            sessionId: threatSession?.sessionId,
            locationCoords: coords,
            sharedWithGuardians: false,
            blob,
          });
          onRecordingSaved({
            id: recId,
            kind: resolvedKind,
            durationSec,
            locationCoords: coords,
          });
          void syncEvidenceMetaToFirebase(userId, {
            id: recId,
            userId,
            kind: resolvedKind,
            mimeType: blob.type,
            createdAt: new Date().toISOString(),
            durationSec,
            sizeBytes: blob.size,
            sessionId: threatSession?.sessionId,
            locationCoords: coords,
            sharedWithGuardians: false,
          });
          setRecordingSavedNotice(
            `${resolvedKind === 'video' ? 'Video + Audio' : 'Audio'} evidence (${durationSec}s) saved securely to local Evidence History.`
          );
        } catch {
          setRecordingError(
            'Recording finished, but local IndexedDB storage was unavailable in this browser.'
          );
        }
        setRecordingMode('none');
        onUpdateThreatSnapshot({ recordingMode: 'none' });
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setRecordingMode(resolvedKind);
      onUpdateThreatSnapshot({ recordingMode: resolvedKind });
    } catch {
      setRecordingError(
        'Unable to initialize MediaRecorder in this browser.'
      );
    }
  };

  // Automatically start continuous Video + Audio recording (no manual confirmation) whenever Threat Mode activates
  useEffect(() => {
    const activeSessionId = threatSession?.active ? threatSession.sessionId : null;
    if (!activeSessionId) {
      autoStartedSessionRef.current = null;
      return;
    }
    if (
      autoStartedSessionRef.current === activeSessionId ||
      recordingModeRef.current !== 'none'
    ) {
      return;
    }
    autoStartedSessionRef.current = activeSessionId;
    void startRecording('video', {
      allowAudioFallback: true,
      skipActivate: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threatSession?.active, threatSession?.sessionId]);

  const handleDeactivate = () => {
    stopRecording();
    stopAttentionTone();
    onDeactivateThreatMode('Deactivated safely by user');
  };

  const handleAreaSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFetchNearbyPoliceAi(manualAreaInput.trim() || undefined);
  };

  return (
    <div className="space-y-6">
      {/* Recovered Unexpected Interruption Alert */}
      {recoveredInterruption && (
        <section
          role="alert"
          className="rounded-3xl bg-amber-50 border border-amber-300 p-5 flex flex-wrap items-start justify-between gap-4"
        >
          <div className="space-y-1 max-w-2xl">
            <p className="text-xs font-bold text-amber-900">
              Preserved Emergency Snapshot · Previous Threat Mode Interrupted Unexpectedly
            </p>
            <p className="text-sm text-amber-950 leading-relaxed">
              Your previous Threat Mode session (started{' '}
              <span className="font-mono tabular-nums">
                {formatDateTimeShort(recoveredInterruption.activatedAt)}
              </span>
              ) stopped communicating after{' '}
              <span className="font-mono tabular-nums">
                {formatDateTimeShort(recoveredInterruption.lastHeartbeatAt)}
              </span>
              . Last preserved GPS:{' '}
              <span className="font-mono tabular-nums">
                {recoveredInterruption.lastLatitude !== null &&
                recoveredInterruption.lastLongitude !== null
                  ? `${recoveredInterruption.lastLatitude.toFixed(5)}, ${recoveredInterruption.lastLongitude.toFixed(5)}`
                  : 'Unavailable'}
              </span>
              .
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenHistory}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-amber-900 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              View History
            </button>
            <button
              type="button"
              onClick={onDismissRecoveryBanner}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 text-xs font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </section>
      )}

      {/* Main Threat Mode Control Header */}
      <section
        className={`rounded-3xl border p-6 sm:p-8 shadow-sm transition-colors ${
          isActive
            ? 'bg-red-50 border-red-300'
            : 'bg-[#FCFDF9] border-[#B8C6A8]'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className={isActive ? 'text-red-700' : 'text-[#3E5632]'}>
                Intelligent Threat Mode
              </span>
              <span aria-hidden="true" className="text-[#78886F]">
                ·
              </span>
              <span className={isActive ? 'text-red-800' : 'text-[#54634D]'}>
                {isActive ? `ACTIVE (${elapsedText})` : 'Standby'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#182215] tracking-tight">
              {isActive
                ? 'Threat Protection Active'
                : 'Proactive Protection & AI Police Numbers'}
            </h1>
            <p className="text-sm text-[#465340] leading-relaxed">
              Activating Threat Mode <strong>automatically starts continuous Video &amp; Audio recording</strong> (zero extra confirmations), alerts your guardians, queries AI for nearby police station numbers around your location, and preserves GPS heartbeat snapshots every 10 seconds.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {onWakeVoice && (
              <button
                type="button"
                onClick={onWakeVoice}
                className="min-h-[48px] px-4 py-2.5 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shadow-xs"
                title="Speak voice commands directly inside Threat Mode (Call Police, Alert Guardians, etc.)"
              >
                <Mic className="w-4 h-4 text-emerald-300 animate-pulse" />
                <span>Voice Assistant</span>
              </button>
            )}

            {isActive ? (
              <>
                <button
                  type="button"
                  onClick={onEscalateToSos}
                  className="min-h-[48px] px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Escalate to SOS</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeactivate}
                  className="min-h-[48px] px-5 py-2.5 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm font-semibold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>I&apos;m Safe — Stop &amp; Save</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onActivateThreatMode('Threat Mode Page')}
                className="min-h-[50px] px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold inline-flex items-center gap-2 shadow-sm cursor-pointer whitespace-nowrap"
              >
                <AlertTriangle className="w-5 h-5" />
                <span>Activate Threat Mode (Auto-Record)</span>
              </button>
            )}
          </div>
        </div>

        {/* Continuous Auto-Recording Status Banner when Active */}
        {isActive && recordingMode !== 'none' && (
          <div className="mt-5 rounded-2xl bg-red-600 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping shrink-0" />
              <span>
                AUTO-RECORDING CONTINUOUSLY (
                {recordingMode === 'video' ? 'Video + Audio' : 'Audio Fallback'}) ·{' '}
                <span className="font-mono tabular-nums">
                  {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:
                  {String(recordingSeconds % 60).padStart(2, '0')}
                </span>
              </span>
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="px-3 py-1.5 rounded-xl bg-white text-red-700 text-xs font-extrabold cursor-pointer whitespace-nowrap"
            >
              Stop &amp; Save Clip Now
            </button>
          </div>
        )}

        {/* Active Session Metadata Row */}
        {isActive && threatSession && (
          <div className="mt-6 pt-5 border-t border-red-200/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="rounded-2xl bg-white border border-red-200/70 p-3.5">
              <p className="text-[#54634D]">Activated At</p>
              <p className="mt-1 font-mono font-bold text-[#182215] tabular-nums">
                {formatDateTimeShort(threatSession.activatedAt)}
              </p>
            </div>
            <div className="rounded-2xl bg-white border border-red-200/70 p-3.5">
              <p className="text-[#54634D]">Guardian Notification</p>
              <p className="mt-1 font-bold text-[#182215]">
                {threatSession.guardianNotificationStatus === 'queued_offline'
                  ? 'Queued (Offline)'
                  : `Alerted ${contacts.length} Guardian(s)`}
              </p>
            </div>
            <div className="rounded-2xl bg-white border border-red-200/70 p-3.5">
              <p className="text-[#54634D]">Last Preserved GPS</p>
              <p className="mt-1 font-mono font-bold text-[#182215] tabular-nums">
                {threatSession.lastLatitude !== null &&
                threatSession.lastLongitude !== null
                  ? `${threatSession.lastLatitude.toFixed(5)}, ${threatSession.lastLongitude.toFixed(5)}`
                  : 'Waiting for GPS'}
              </p>
            </div>
            <div className="rounded-2xl bg-white border border-red-200/70 p-3.5 flex items-center justify-between gap-2">
              <div>
                <p className="text-[#54634D]">Quick Deterrent</p>
                <p className="mt-1 font-bold text-[#182215]">
                  {alarmPlaying ? 'Tone Active' : 'Muted'}
                </p>
              </div>
              {soundAllowed && (
                <button
                  type="button"
                  onClick={toggleAttentionTone}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                    alarmPlaying
                      ? 'bg-red-600 text-white'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {alarmPlaying ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5" />
                      <span>Stop</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Siren</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* AI Nearby Police Stations & Verified Numbers (Threat Mode AI Grounding) */}
      <section className="bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 space-y-5 shadow-sm shadow-[#182215]/[0.03]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#3E5632]">
              AI Maps Grounding · Live Police Station Lookup
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#182215]">
              Nearby Police Station Numbers (AI)
            </h2>
            <p className="mt-1 text-xs text-[#4B5844] max-w-2xl">
              Uses Gemini with Google Maps grounding to find real nearby police stations and publicly listed contact numbers based on your GPS or entered area. Universal police emergency numbers are always available offline below.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="tel:100"
              className="min-h-[42px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Police (100)</span>
            </a>
            <a
              href="tel:112"
              className="min-h-[42px] px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Emergency (112)</span>
            </a>
          </div>
        </div>

        {/* GPS Lookup + Area Input Form */}
        <form
          onSubmit={handleAreaSearchSubmit}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
        >
          <div className="relative flex-1">
            <MapPin className="w-4 h-4 text-[#54634D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={manualAreaInput}
              onChange={(e) => setManualAreaInput(e.target.value)}
              placeholder={
                geoLocation.status === 'granted' && geoLocation.latitude !== null
                  ? `Using GPS (${geoLocation.latitude.toFixed(4)}, ${geoLocation.longitude?.toFixed(4)}) — or type a city/area`
                  : 'Enter your city or neighborhood (or grant GPS permission)'
              }
              aria-label="City or neighborhood for nearby police lookup"
              className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm text-[#182215] placeholder:text-[#6B7A63] focus:bg-white focus:border-[#2F4526] focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={onRequestLocation}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] text-[#24371D] text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <LocateFixed className="w-4 h-4" />
            <span>Use GPS</span>
          </button>

          <button
            type="submit"
            disabled={nearbyPoliceLoading || !isOnline}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-[#2F4526] hover:bg-[#23351C] disabled:opacity-50 text-[#F6F9F2] text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Search className="w-4 h-4" />
            <span>
              {nearbyPoliceLoading ? 'Searching Police...' : 'Find Police Numbers (AI)'}
            </span>
          </button>
        </form>

        {!isOnline && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
            AI station lookup needs an internet connection. Offline police emergency numbers (100, 112, 181) remain ready to dial above.
          </p>
        )}

        {nearbyPoliceError && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 font-medium">
            {nearbyPoliceError}
          </p>
        )}

        {nearbyPoliceResult && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#4B5844]">
              <span>
                Grounded results for{' '}
                <strong className="text-[#182215]">
                  {nearbyPoliceResult.locationLabel}
                </strong>
              </span>
              <span className="font-mono tabular-nums">
                Updated {formatDateTimeShort(nearbyPoliceResult.queriedAt)}
              </span>
            </div>

            {nearbyPoliceResult.stations.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {nearbyPoliceResult.stations.map((st, idx) => {
                  const dialTarget = st.phone
                    ? formatPhoneForTel(st.phone)
                    : '100';
                  return (
                    <div
                      key={`${st.name}-${idx}`}
                      className="rounded-2xl bg-[#F4F7EF] border border-[#CFD9C3] p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-[#182215]">
                          {st.name}
                        </p>
                        <p className="text-xs font-mono tabular-nums font-semibold text-[#2F4526]">
                          {st.phone
                            ? `Phone: ${st.phone}`
                            : 'Public direct number not listed · Dial 100 / 112'}
                        </p>
                        {st.address && (
                          <p className="text-xs text-[#4B5844] leading-relaxed">
                            {st.address}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`tel:${dialTarget}`}
                          className="flex-1 min-h-[40px] px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Call {st.phone || '100'}</span>
                        </a>
                        {st.mapsUri && (
                          <a
                            href={st.mapsUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[40px] px-3 py-2 rounded-xl bg-[#FCFDF9] hover:bg-[#E7EFE0] border border-[#C3D0B4] text-[#182215] text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap"
                          >
                            <span>Maps</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {nearbyPoliceResult.summaryText && (
              <div className="rounded-2xl bg-[#F4F7EF] border border-[#D4DFC8] p-4 text-xs text-[#384632] whitespace-pre-line leading-relaxed">
                {nearbyPoliceResult.summaryText}
              </div>
            )}

            {nearbyPoliceResult.mapLinks.length > 0 && (
              <div className="pt-2 border-t border-[#DCE5D1] space-y-1.5">
                <p className="text-[11px] font-semibold text-[#4B5844]">
                  Verified Google Maps Sources
                </p>
                <div className="flex flex-wrap gap-2">
                  {nearbyPoliceResult.mapLinks.map((link, idx) => (
                    <a
                      key={`${link.uri}-${idx}`}
                      href={link.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-[#2F4526] hover:underline inline-flex items-center gap-1"
                    >
                      <span>{link.title}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* A. Emergency Audio & Video Recording + B. Device Continuity Protection */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Emergency Evidence Recording */}
        <div className="lg:col-span-7 bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[#3E5632]">
                Emergency Evidence Capture · Local Browser Storage
              </p>
              <h2 className="mt-1 text-lg sm:text-xl font-semibold text-[#182215]">
                Audio &amp; Video Recording
              </h2>
            </div>
            <button
              type="button"
              onClick={onOpenHistory}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] text-[#24371D] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <History className="w-3.5 h-3.5" />
              <span>Evidence History</span>
            </button>
          </div>

          <p className="text-xs text-[#4B5844] leading-relaxed">
            Starts <strong>automatically without confirmation</strong> as soon as Threat Mode activates (Video + Audio, with automatic Audio fallback if camera is unavailable). All evidence saves privately to your device (IndexedDB) and can be reviewed, shared, or deleted in Evidence History.
          </p>

          {recordingError && (
            <p className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-700">
              {recordingError}
            </p>
          )}

          {recordingSavedNotice && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-medium text-emerald-800 flex items-center justify-between gap-2">
              <span>{recordingSavedNotice}</span>
              <button
                type="button"
                onClick={onOpenHistory}
                className="font-bold underline shrink-0 cursor-pointer"
              >
                Review
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {recordingMode === 'none' ? (
              <>
                <button
                  type="button"
                  onClick={() => startRecording('audio')}
                  className="flex-1 min-w-[160px] min-h-[48px] px-4 py-2.5 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-[#F6F9F2] text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Mic className="w-4 h-4" />
                  <span>Start Audio Recording</span>
                </button>
                <button
                  type="button"
                  onClick={() => startRecording('video')}
                  className="flex-1 min-w-[160px] min-h-[48px] px-4 py-2.5 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] border border-[#C3D0B4] text-[#24371D] text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Video className="w-4 h-4 text-[#2F4526]" />
                  <span>Start Video Recording</span>
                </button>
              </>
            ) : (
              <div className="w-full rounded-2xl bg-red-50 border border-red-200 p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-red-600" />
                  <div>
                    <p className="text-sm font-bold text-red-800">
                      Recording {recordingMode === 'video' ? 'Video + Audio' : 'Audio'}{' '}
                      ·{' '}
                      <span className="font-mono tabular-nums">
                        {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:
                        {String(recordingSeconds % 60).padStart(2, '0')}
                      </span>
                    </p>
                    <p className="text-xs text-red-700">
                      Captured securely locally until stopped
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop &amp; Save Evidence</span>
                </button>
              </div>
            )}
          </div>

          {recordingMode === 'video' && (
            <div className="rounded-2xl overflow-hidden bg-[#182215] border border-[#B8C6A8] aspect-video">
              <video
                ref={videoPreviewRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>

        {/* Device Continuity & Connectivity Preservation */}
        <div className="lg:col-span-5 bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 space-y-4">
          <div>
            <p className="text-xs font-semibold text-[#3E5632]">
              Device Continuity &amp; Disconnect Preservation
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#182215]">
              Connectivity &amp; Sudden Drop Protection
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-2xl bg-[#F4F7EF] border border-[#D4DFC8] p-3.5">
              <p className="text-[#54634D] flex items-center gap-1.5">
                {isOnline ? (
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                )}
                <span>Network State</span>
              </p>
              <p className="mt-1 font-bold text-[#182215]">
                {isOnline ? 'Connected' : 'Offline — Local Queue'}
              </p>
            </div>

            <div className="rounded-2xl bg-[#F4F7EF] border border-[#D4DFC8] p-3.5">
              <p className="text-[#54634D] flex items-center gap-1.5">
                <Battery className="w-3.5 h-3.5 text-[#2F4526]" />
                <span>Device Battery</span>
              </p>
              <p className="mt-1 font-bold font-mono tabular-nums text-[#182215]">
                {batteryPercent !== null ? `${batteryPercent}%` : 'Browser Restricted'}
              </p>
            </div>
          </div>

          <p className="text-xs text-[#465340] leading-relaxed">
            While Threat Mode is active, OurSafe saves a heartbeat snapshot (last GPS coordinates, battery level, and connectivity state) every 10 seconds so emergency data is preserved if connectivity drops unexpectedly.
          </p>

          <p className="text-[11px] text-[#54634D] leading-relaxed rounded-xl bg-[#F4F7EF] border border-[#D4DFC8] p-3">
            <strong>Honest technical limitation:</strong> Software cannot detect every type of physical phone damage or continue recording after complete power loss.
          </p>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onSimulateConnectivityDrop}
              className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] text-[#24371D] text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              Save Emergency Snapshot Now
            </button>

            {primaryGuardian && (
              <a
                href={`tel:${formatPhoneForTel(primaryGuardian.phone)}`}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FCFDF9] hover:bg-[#F4F7EF] border border-[#C3D0B4] text-[#182215] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Phone className="w-3.5 h-3.5 text-[#2F4526]" />
                <span>Call Guardian</span>
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
