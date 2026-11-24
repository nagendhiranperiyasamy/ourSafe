import { useCallback, useEffect, useRef, useState } from 'react';
import { ThreatSessionState } from '../types/safety';
import { getThreatSession, saveThreatSession } from '../utils/storage';

export interface UseThreatModeOptions {
  userId: string;
  onActivated?: (session: ThreatSessionState) => void;
  onDeactivated?: (note: string) => void;
  onError?: (err: Error) => void;
}

export interface UseThreatModeReturn {
  threatSession: ThreatSessionState | null;
  isThreatModeActive: boolean;
  isMicLocked: boolean;
  audioTrackActive: boolean;
  activateThreatMode: (source?: string, coords?: { latitude: number | null; longitude: number | null }) => Promise<ThreatSessionState>;
  deactivateThreatMode: (note?: string) => void;
  updateThreatSnapshot: (partial: Partial<ThreatSessionState>) => void;
  ensureMicAlwaysActive: () => Promise<boolean>;
  releaseMicLock: () => void;
}

/**
 * useThreatMode
 * Manages the global state of 'Threat Mode'.
 * Includes logic to acquire and lock the device microphone when toggled on,
 * actively blocking any automatic microphone deactivation, idle timeouts, or background suspensions.
 */
export function useThreatMode({
  userId,
  onActivated,
  onDeactivated,
  onError,
}: UseThreatModeOptions): UseThreatModeReturn {
  const [threatSession, setThreatSession] = useState<ThreatSessionState | null>(() =>
    getThreatSession(userId)
  );
  const [isMicLocked, setIsMicLocked] = useState<boolean>(() =>
    Boolean(getThreatSession(userId)?.active)
  );
  const [audioTrackActive, setAudioTrackActive] = useState<boolean>(false);

  const micStreamRef = useRef<MediaStream | null>(null);
  const micKeepAliveIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isActivatingRef = useRef<boolean>(false);

  // Sync state if userId changes
  useEffect(() => {
    const session = getThreatSession(userId);
    setThreatSession(session);
    if (session?.active) {
      void ensureMicAlwaysActive();
    }
  }, [userId]);

  /**
   * Acquire a persistent audio capture stream and attach a keepalive dummy processor
   * so the browser or mobile OS does not pause or suspend audio collection.
   */
  const ensureMicAlwaysActive = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }

    try {
      // Check if existing tracks are still live
      const existingLiveTrack = micStreamRef.current
        ?.getAudioTracks()
        .find((t) => t.readyState === 'live' && t.enabled);

      if (existingLiveTrack) {
        setIsMicLocked(true);
        setAudioTrackActive(true);
        return true;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      micStreamRef.current = stream;
      setIsMicLocked(true);
      setAudioTrackActive(true);

      // Create an AudioContext sink to actively consume the stream and block power-save idle deactivation
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (AudioCtx) {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new AudioCtx();
        }
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        const source = audioContextRef.current.createMediaStreamSource(stream);
        // Connect to a 0-gain node so it drains samples continuously without playing back into speaker
        const gainNode = audioContextRef.current.createGain();
        gainNode.gain.value = 0.00001;
        source.connect(gainNode);
        gainNode.connect(audioContextRef.current.destination);
      }

      // Keepalive pulse to re-arm any tracks if mobile OS dims or tries to sleep audio
      if (micKeepAliveIntervalRef.current !== null) {
        window.clearInterval(micKeepAliveIntervalRef.current);
      }
      micKeepAliveIntervalRef.current = window.setInterval(() => {
        const tracks = micStreamRef.current?.getAudioTracks() ?? [];
        tracks.forEach((track) => {
          if (!track.enabled) {
            track.enabled = true; // force-unmute if external interrupt tried to mute
          }
        });
        if (audioContextRef.current?.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
        }
      }, 2500);

      return true;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      onError?.(errorObj);
      setAudioTrackActive(false);
      return false;
    }
  }, [onError]);

  const releaseMicLock = useCallback(() => {
    if (micKeepAliveIntervalRef.current !== null) {
      window.clearInterval(micKeepAliveIntervalRef.current);
      micKeepAliveIntervalRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      micStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    setIsMicLocked(false);
    setAudioTrackActive(false);
  }, []);

  const activateThreatMode = useCallback(
    async (
      source = 'Manual Activation',
      coords?: { latitude: number | null; longitude: number | null }
    ): Promise<ThreatSessionState> => {
      if (isActivatingRef.current) {
        const existing = getThreatSession(userId);
        if (existing) return existing;
      }
      isActivatingRef.current = true;

      const now = new Date().toISOString();
      const onlineNow = typeof navigator !== 'undefined' ? navigator.onLine : true;

      const newSession: ThreatSessionState = {
        active: true,
        sessionId: `threat-${Date.now()}`,
        activatedAt: now,
        lastHeartbeatAt: now,
        lastLatitude: coords?.latitude ?? null,
        lastLongitude: coords?.longitude ?? null,
        batteryPercent: null,
        isOnline: onlineNow,
        recordingMode: 'none',
        guardianNotificationStatus: onlineNow ? 'delivered_demo' : 'queued_offline',
      };

      setThreatSession(newSession);
      saveThreatSession(userId, newSession);

      // Lock microphone strictly in active state (blocking auto-deactivation)
      await ensureMicAlwaysActive();

      isActivatingRef.current = false;
      onActivated?.(newSession);
      return newSession;
    },
    [userId, ensureMicAlwaysActive, onActivated]
  );

  const deactivateThreatMode = useCallback(
    (note = 'Deactivated safely') => {
      setThreatSession(null);
      saveThreatSession(userId, null);
      releaseMicLock();
      onDeactivated?.(note);
    },
    [userId, releaseMicLock, onDeactivated]
  );

  const updateThreatSnapshot = useCallback(
    (partial: Partial<ThreatSessionState>) => {
      setThreatSession((prev) => {
        if (!prev) return prev;
        const next: ThreatSessionState = {
          ...prev,
          ...partial,
          lastHeartbeatAt: new Date().toISOString(),
        };
        saveThreatSession(userId, next);
        return next;
      });
    },
    [userId]
  );

  // Auto-acquire mic lock if threat mode was already restored on mount
  useEffect(() => {
    if (threatSession?.active) {
      void ensureMicAlwaysActive();
    }
    return () => {
      // Clean up keepalive on unmount
      if (micKeepAliveIntervalRef.current !== null) {
        window.clearInterval(micKeepAliveIntervalRef.current);
      }
    };
  }, [threatSession?.active, ensureMicAlwaysActive]);

  return {
    threatSession,
    isThreatModeActive: Boolean(threatSession?.active),
    isMicLocked,
    audioTrackActive,
    activateThreatMode,
    deactivateThreatMode,
    updateThreatSnapshot,
    ensureMicAlwaysActive,
    releaseMicLock,
  };
}
