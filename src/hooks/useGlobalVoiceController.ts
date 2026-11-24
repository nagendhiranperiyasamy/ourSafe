import { useCallback, useEffect, useRef, useState } from 'react';
import { VoiceCommandAction } from '../types/safety';

export interface VoiceTranscriptItem {
  id: string;
  role: 'user' | 'assistant' | 'action';
  text: string;
  timestamp: string;
}

export interface GlobalVoiceControllerState {
  liveStatus: 'idle' | 'connecting' | 'connected' | 'error';
  liveError: string;
  isSpeaking: boolean;
  textBusy: boolean;
  entries: VoiceTranscriptItem[];
  lastActionSummary: string;
  startLiveVoice: () => Promise<void>;
  disconnectLiveVoice: () => void;
  runTextCommand: (commandText: string) => Promise<void>;
}

interface UseGlobalVoiceControllerOptions {
  userName: string;
  primaryGuardianName?: string;
  primaryGuardianPhone?: string;
  threatActive: boolean;
  sosActive: boolean;
  isOnline: boolean;
  onExecuteVoiceCommand: (
    call: VoiceCommandAction
  ) => Promise<{ ok: boolean; summary: string; data?: Record<string, unknown> }>;
}

function float32ToPcm16Base64(float32: Float32Array): string {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i += 1) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64Pcm16ToFloat32(base64: string): Float32Array<ArrayBuffer> {
  const binary = atob(base64);
  const byteLength = binary.length;
  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const sampleCount = Math.floor(byteLength / 2);
  const float32 = new Float32Array(new ArrayBuffer(sampleCount * 4));
  for (let i = 0; i < sampleCount; i += 1) {
    float32[i] = view.getInt16(i * 2, true) / 32768;
  }
  return float32;
}

export function useGlobalVoiceController({
  userName,
  primaryGuardianName,
  primaryGuardianPhone,
  threatActive,
  sosActive,
  isOnline,
  onExecuteVoiceCommand,
}: UseGlobalVoiceControllerOptions): GlobalVoiceControllerState {
  const [liveStatus, setLiveStatus] = useState<
    'idle' | 'connecting' | 'connected' | 'error'
  >('idle');
  const [liveError, setLiveError] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [textBusy, setTextBusy] = useState(false);
  const [lastActionSummary, setLastActionSummary] = useState('');
  const [entries, setEntries] = useState<VoiceTranscriptItem[]>([
    {
      id: 'init-voice',
      role: 'assistant',
      text: `Ready, ${userName}. Tap "Start Live Voice" to control the entire OurSafe app hands-free across every screen. Say "Go to SOS", "Activate Threat Mode", "Share my location", "Open Travel Mode", or "Find police numbers".`,
      timestamp: new Date().toISOString(),
    },
  ]);

  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const liveConnectedRef = useRef<boolean>(false);
  const executeCommandRef = useRef(onExecuteVoiceCommand);

  useEffect(() => {
    executeCommandRef.current = onExecuteVoiceCommand;
  }, [onExecuteVoiceCommand]);

  const appendEntry = useCallback(
    (role: VoiceTranscriptItem['role'], text: string) => {
      const cleaned = text.trim();
      if (!cleaned) return;
      if (role === 'action') {
        setLastActionSummary(cleaned);
      }
      setEntries((prev) => {
        const last = prev[prev.length - 1];
        if (
          last &&
          last.role === role &&
          role !== 'action' &&
          Date.now() - new Date(last.timestamp).getTime() < 2600
        ) {
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              text: `${last.text} ${cleaned}`.replace(/\s+/g, ' ').trim(),
              timestamp: new Date().toISOString(),
            },
          ];
        }
        return [
          ...prev,
          {
            id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            role,
            text: cleaned,
            timestamp: new Date().toISOString(),
          },
        ];
      });
    },
    []
  );

  const stopPlaybackQueue = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {
        // ignore
      }
    });
    activeSourcesRef.current = [];
    if (outputCtxRef.current) {
      nextStartTimeRef.current = outputCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
    setIsSpeaking(false);
  }, []);

  const schedulePcmPlayback = useCallback((base64Pcm: string) => {
    const outCtx = outputCtxRef.current;
    if (!outCtx) return;
    if (outCtx.state === 'suspended') {
      outCtx.resume().catch(() => {});
    }

    const floatData = base64Pcm16ToFloat32(base64Pcm);
    if (floatData.length === 0) return;

    const audioBuffer = outCtx.createBuffer(1, floatData.length, 24000);
    audioBuffer.copyToChannel(floatData, 0);

    const source = outCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(outCtx.destination);

    const now = outCtx.currentTime;
    const startAt = Math.max(now + 0.01, nextStartTimeRef.current);
    nextStartTimeRef.current = startAt + audioBuffer.duration;

    setIsSpeaking(true);
    activeSourcesRef.current.push(source);
    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter(
        (s) => s !== source
      );
      if (activeSourcesRef.current.length === 0) {
        setIsSpeaking(false);
      }
    };
    source.start(startAt);
  }, []);

  const disconnectLiveVoice = useCallback(() => {
    liveConnectedRef.current = false;
    stopPlaybackQueue();

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (inputCtxRef.current) {
      inputCtxRef.current.close().catch(() => {});
      inputCtxRef.current = null;
    }
    if (outputCtxRef.current) {
      outputCtxRef.current.close().catch(() => {});
      outputCtxRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
    setLiveStatus('idle');
  }, [stopPlaybackQueue]);

  useEffect(() => {
    return () => {
      disconnectLiveVoice();
    };
  }, [disconnectLiveVoice]);

  const startLiveVoice = useCallback(async () => {
    setLiveError('');
    if (!isOnline) {
      setLiveError(
        'Live AI Voice requires an internet connection. Offline emergency calling and SOS contacts remain available on the SOS page.'
      );
      setLiveStatus('error');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setLiveError('Microphone capture is not supported in this browser.');
      setLiveStatus('error');
      return;
    }

    disconnectLiveVoice();
    setLiveStatus('connecting');

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      micStreamRef.current = micStream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;

      const inputCtx = new AudioCtx({ sampleRate: 16000 });
      const outputCtx = new AudioCtx({ sampleRate: 24000 });
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${wsProtocol}//${window.location.host}/api/live-voice`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'init',
            userContext: {
              userName,
              primaryGuardianName,
              primaryGuardianPhone,
              threatActive,
              sosActive,
            },
          })
        );
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data) as {
            type: string;
            data?: string;
            text?: string;
            message?: string;
            calls?: VoiceCommandAction[];
          };

          if (msg.type === 'ready') {
            liveConnectedRef.current = true;
            setLiveStatus('connected');
            appendEntry(
              'action',
              'Full-App AI Voice Controller connected — stays active as you navigate between SOS, Threat, Travel, and Nearby pages.'
            );

            if (inputCtxRef.current && micStreamRef.current) {
              const source = inputCtxRef.current.createMediaStreamSource(
                micStreamRef.current
              );
              const processor = inputCtxRef.current.createScriptProcessor(
                4096,
                1,
                1
              );
              processorRef.current = processor;

              processor.onaudioprocess = (audioEvent) => {
                if (
                  !liveConnectedRef.current ||
                  !wsRef.current ||
                  wsRef.current.readyState !== WebSocket.OPEN
                ) {
                  return;
                }
                const channelData = audioEvent.inputBuffer.getChannelData(0);
                const pcmBase64 = float32ToPcm16Base64(channelData);
                wsRef.current.send(
                  JSON.stringify({ type: 'audio', audio: pcmBase64 })
                );
              };

              source.connect(processor);
              processor.connect(inputCtxRef.current.destination);
            }
          } else if (msg.type === 'audio' && msg.data) {
            schedulePcmPlayback(msg.data);
          } else if (msg.type === 'interrupted') {
            stopPlaybackQueue();
          } else if (msg.type === 'inputTranscript' && msg.text) {
            appendEntry('user', msg.text);
          } else if (msg.type === 'outputTranscript' && msg.text) {
            appendEntry('assistant', msg.text);
          } else if (msg.type === 'toolCall' && Array.isArray(msg.calls)) {
            const responses = [];
            for (const call of msg.calls) {
              const outcome = await executeCommandRef.current(call);
              appendEntry('action', outcome.summary);
              responses.push({
                id: call.id,
                name: call.name,
                response: {
                  result: outcome.summary,
                  ok: outcome.ok,
                  ...(outcome.data ?? {}),
                },
              });
            }
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({ type: 'toolResponse', responses })
              );
            }
          } else if (msg.type === 'error') {
            setLiveError(msg.message || 'Live voice session encountered an error.');
            setLiveStatus('error');
            disconnectLiveVoice();
          } else if (msg.type === 'closed') {
            disconnectLiveVoice();
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onerror = () => {
        setLiveError(
          'Unable to connect to the live voice server. Check connectivity and try again.'
        );
        setLiveStatus('error');
        disconnectLiveVoice();
      };

      ws.onclose = () => {
        if (liveConnectedRef.current) {
          disconnectLiveVoice();
        }
      };
    } catch {
      setLiveError(
        'Microphone permission denied or unavailable. You can still run any command via text or quick buttons.'
      );
      setLiveStatus('error');
      disconnectLiveVoice();
    }
  }, [
    isOnline,
    disconnectLiveVoice,
    userName,
    primaryGuardianName,
    primaryGuardianPhone,
    threatActive,
    sosActive,
    appendEntry,
    schedulePcmPlayback,
    stopPlaybackQueue,
  ]);

  const runTextCommand = useCallback(
    async (commandText: string) => {
      const trimmed = commandText.trim();
      if (!trimmed) return;

      setLiveError('');
      appendEntry('user', trimmed);

      if (
        liveStatus === 'connected' &&
        wsRef.current &&
        wsRef.current.readyState === WebSocket.OPEN
      ) {
        wsRef.current.send(JSON.stringify({ type: 'text', text: trimmed }));
        return;
      }

      if (!isOnline) {
        setLiveError(
          'AI command processing requires internet connectivity. Use the dedicated SOS or Threat Mode tabs offline.'
        );
        return;
      }

      setTextBusy(true);
      try {
        const res = await fetch('/api/assistant/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: trimmed,
            userContext: {
              userName,
              primaryGuardianName,
              primaryGuardianPhone,
              threatActive,
              sosActive,
            },
          }),
        });
        const data = (await res.json()) as {
          reply?: string;
          toolCalls?: VoiceCommandAction[];
          error?: string;
        };

        if (!res.ok) {
          throw new Error(data.error || 'AI command failed.');
        }

        if (Array.isArray(data.toolCalls) && data.toolCalls.length > 0) {
          for (const call of data.toolCalls) {
            const outcome = await executeCommandRef.current(call);
            appendEntry('action', outcome.summary);
          }
        }

        if (data.reply) {
          appendEntry('assistant', data.reply);
        }
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Could not reach the AI command endpoint.';
        setLiveError(msg);
      } finally {
        setTextBusy(false);
      }
    },
    [
      liveStatus,
      isOnline,
      userName,
      primaryGuardianName,
      primaryGuardianPhone,
      threatActive,
      sosActive,
      appendEntry,
    ]
  );

  return {
    liveStatus,
    liveError,
    isSpeaking,
    textBusy,
    entries,
    lastActionSummary,
    startLiveVoice,
    disconnectLiveVoice,
    runTextCommand,
  };
}
