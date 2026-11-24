import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Hand,
  MapPin,
  Mic,
  Phone,
  Send,
  Shield,
  ShieldAlert,
  Smartphone,
  X,
} from 'lucide-react';
import {
  GeoLocationState,
  QuickTriggerEvent,
  SosContact,
} from '../types/safety';
import { formatPhoneForTel } from '../utils/storage';

interface EmergencyTriggerOverlayProps {
  event: QuickTriggerEvent;
  userName: string;
  contacts: SosContact[];
  geoLocation: GeoLocationState;
  nearestPolicePhone?: string;
  nearestPoliceName?: string;
  vehicleNumber?: string;
  countdownSeconds: 0 | 3;
  autoDialOnTrigger: boolean;
  onDispatchSos: (event: QuickTriggerEvent) => void;
  onOpenFullSosPage?: () => void;
  onClose: () => void;
}

export const EmergencyTriggerOverlay: React.FC<EmergencyTriggerOverlayProps> = ({
  event,
  userName,
  contacts,
  geoLocation,
  nearestPolicePhone,
  nearestPoliceName,
  vehicleNumber,
  countdownSeconds,
  autoDialOnTrigger,
  onDispatchSos,
  onOpenFullSosPage,
  onClose,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(countdownSeconds);
  const [dispatched, setDispatched] = useState<boolean>(countdownSeconds === 0);
  const [autoDialAttempted, setAutoDialAttempted] = useState<boolean>(false);
  const dispatchedRef = useRef<boolean>(false);

  const primaryGuardian = contacts.find((c) => c.isPrimary) ?? contacts[0];
  const policeNumber = nearestPolicePhone?.trim() || '100';
  const policeLabel = nearestPoliceName?.trim() || 'Police Control Room';

  const hasCoords =
    geoLocation.status === 'granted' &&
    geoLocation.latitude !== null &&
    geoLocation.longitude !== null;

  const triggerDialer = (phone: string) => {
    const clean = formatPhoneForTel(phone);
    if (!clean) return;
    try {
      const link = document.createElement('a');
      link.href = `tel:${clean}`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      // Fallback ignored if browser blocks non-gesture tel: navigation
    }
  };

  const executeDispatchNow = () => {
    if (dispatchedRef.current) return;
    dispatchedRef.current = true;
    setDispatched(true);
    setSecondsLeft(0);
    // Defer parent notification to prevent "setState while rendering" React warning
    window.setTimeout(() => {
      onDispatchSos(event);
    }, 0);

    if (autoDialOnTrigger) {
      const targetPhone = primaryGuardian?.phone || policeNumber;
      setAutoDialAttempted(true);
      triggerDialer(targetPhone);
    }
  };

  useEffect(() => {
    if (countdownSeconds === 0) {
      const timer = window.setTimeout(() => {
        executeDispatchNow();
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          executeDispatchNow();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  const smsBody = encodeURIComponent(
    `EMERGENCY SOS from ${userName} via OurSafe (${event.label})! Please call me immediately.${
      vehicleNumber ? ` Vehicle: ${vehicleNumber}.` : ''
    }${
      hasCoords
        ? ` Live GPS: https://maps.google.com/?q=${geoLocation.latitude!.toFixed(
            6
          )},${geoLocation.longitude!.toFixed(6)}`
        : ''
    }`
  );

  const TriggerIcon =
    event.kind === 'shake'
      ? Smartphone
      : event.kind === 'voice_code'
        ? Mic
        : Hand;

  return (
    <div
      data-ignore-sos-tap="true"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="quick-sos-overlay-title"
      className="fixed inset-0 z-[70] bg-[#160707]/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="w-full max-w-xl rounded-3xl bg-[#FCFDF9] border-2 border-red-600 shadow-2xl overflow-hidden my-auto">
        {/* Urgent Red Header */}
        <div className="bg-red-600 text-white px-6 py-5 flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-100">
              <TriggerIcon className="w-4 h-4 shrink-0" />
              <span>{event.label}</span>
              {event.fromLockScreen && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>From Lock-Screen Shield</span>
                </>
              )}
            </div>
            <h2
              id="quick-sos-overlay-title"
              className="text-2xl sm:text-3xl font-bold tracking-tight"
            >
              {dispatched
                ? 'SOS Emergency Dispatched'
                : `Calling SOS in ${secondsLeft}s...`}
            </h2>
            <p className="text-xs sm:text-sm text-red-50/90 leading-relaxed">
              {event.detail}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close SOS alert overlay"
            className="min-w-[40px] min-h-[40px] rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {!dispatched ? (
            <div className="space-y-5 text-center py-2">
              <div className="mx-auto w-24 h-24 rounded-full bg-red-100 border-4 border-red-600 flex items-center justify-center">
                <span className="text-4xl font-extrabold font-mono tabular-nums text-red-700">
                  {secondsLeft}
                </span>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-bold text-[#182215]">
                  Preparing Emergency Call &amp; GPS Alert
                </p>
                <p className="text-xs text-[#54634D]">
                  Target: {primaryGuardian ? `${primaryGuardian.name} (${primaryGuardian.phone})` : `Police (${policeNumber})`} + Police Dispatch
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[52px] px-5 py-3 rounded-2xl bg-[#EAF0E2] hover:bg-[#DCE7D2] border border-[#B8C6A8] text-[#182215] text-sm font-bold cursor-pointer"
                >
                  Cancel (False Alarm)
                </button>
                <button
                  type="button"
                  onClick={executeDispatchNow}
                  className="min-h-[52px] px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Phone className="w-4 h-4" />
                  <span>Call Immediately Now</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Live Dispatch Confirmation */}
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-emerald-950">
                    Automatic Call + Guardian &amp; Police Alert Messages Dispatched
                  </p>
                  <p className="text-emerald-900/90 leading-relaxed">
                    {autoDialAttempted
                      ? `Emergency call triggered automatically for ${
                          primaryGuardian
                            ? `${primaryGuardian.name} (${primaryGuardian.phone})`
                            : `Police (${policeNumber})`
                        }, and automated SOS alert messages with live GPS${
                          vehicleNumber ? ` & vehicle ${vehicleNumber}` : ''
                        } were dispatched to ${contacts.length} guardian(s) + Police (${policeNumber}).`
                      : `Automated SOS alert messages dispatched to ${contacts.length} guardian(s) + Police (${policeNumber}). Tap below to place direct calls anytime.`}
                  </p>
                </div>
              </div>

              {/* Live GPS Coordinates */}
              <div className="rounded-2xl bg-[#F4F7EF] border border-[#CFD9C3] px-4 py-3 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-[#182215] font-semibold">
                  <MapPin className="w-4 h-4 text-[#2F4526] shrink-0" />
                  <span className="font-mono tabular-nums">
                    {hasCoords
                      ? `${geoLocation.latitude!.toFixed(5)}, ${geoLocation.longitude!.toFixed(5)}`
                      : 'Requesting live GPS coordinates...'}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-[#3E5632]">
                  {contacts.length} Guardian(s)
                </span>
              </div>

              {/* Dual Call Action Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {primaryGuardian ? (
                  <a
                    href={`tel:${formatPhoneForTel(primaryGuardian.phone)}`}
                    className="min-h-[60px] px-4 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white flex flex-col items-center justify-center gap-0.5 transition-colors shadow-sm"
                  >
                    <span className="text-sm font-extrabold flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      <span>Call {primaryGuardian.name}</span>
                    </span>
                    <span className="text-[11px] font-mono text-red-100">
                      {primaryGuardian.phone}
                    </span>
                  </a>
                ) : (
                  <a
                    href="tel:112"
                    className="min-h-[60px] px-4 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white flex flex-col items-center justify-center gap-0.5 transition-colors shadow-sm"
                  >
                    <span className="text-sm font-extrabold flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      <span>Call National SOS (112)</span>
                    </span>
                    <span className="text-[11px] text-red-100">
                      24/7 Emergency Helpline
                    </span>
                  </a>
                )}

                <a
                  href={`tel:${formatPhoneForTel(policeNumber)}`}
                  className="min-h-[60px] px-4 py-3 rounded-2xl bg-[#182215] hover:bg-[#24371D] text-white flex flex-col items-center justify-center gap-0.5 transition-colors shadow-sm"
                >
                  <span className="text-sm font-extrabold flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    <span>Call Police ({policeNumber})</span>
                  </span>
                  <span className="text-[11px] text-[#CDD7C1] truncate max-w-full px-2">
                    {policeLabel}
                  </span>
                </a>
              </div>

              {/* Quick SMS + 112 Row */}
              <div className="flex flex-wrap items-center gap-2.5">
                {primaryGuardian && (
                  <a
                    href={`sms:${formatPhoneForTel(primaryGuardian.phone)}?body=${smsBody}`}
                    className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send Live GPS SMS to {primaryGuardian.name}</span>
                  </a>
                )}
                <a
                  href="tel:112"
                  className="min-h-[46px] px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-extrabold flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Dial 112</span>
                </a>
              </div>

              {/* Footer Actions */}
              <div className="pt-2 border-t border-[#DCE5D1] flex flex-wrap items-center justify-between gap-2.5">
                {onOpenFullSosPage ? (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenFullSosPage();
                      onClose();
                    }}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] text-[#24371D] text-xs font-semibold cursor-pointer"
                  >
                    Open Full SOS Dashboard
                  </button>
                ) : (
                  <span className="text-xs text-[#54634D]">
                    Triggered without logging into dashboard
                  </span>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-[#C5D2B7] hover:bg-[#F4F7EF] text-[#182215] text-xs font-semibold cursor-pointer"
                >
                  I&apos;m Safe · Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
