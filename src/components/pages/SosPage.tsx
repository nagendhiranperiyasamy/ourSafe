import React, { useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  LocateFixed,
  MapPin,
  Phone,
  Radio,
  Send,
  Shield,
  ShieldAlert,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  AlertDeliveryStatus,
  DualCallDispatchState,
  GeoLocationState,
  LiveLocationShareSession,
  NearbyPoliceAiResult,
  SafetyPreferences,
  SosAlertRecord,
  SosContact,
} from '../../types/safety';
import { EmergencyQuickTriggersState } from '../../hooks/useEmergencyQuickTriggers';
import { formatDateTimeShort, formatPhoneForTel } from '../../utils/storage';
import { QuickSosTriggersCard } from '../dashboard/QuickSosTriggersCard';

interface SosPageProps {
  userName: string;
  contacts: SosContact[];
  preferences: SafetyPreferences;
  quickTriggers: EmergencyQuickTriggersState;
  geoLocation: GeoLocationState;
  isOnline: boolean;
  latestSosAlert: SosAlertRecord | null;
  liveLocationShare: LiveLocationShareSession | null;
  dualCallState: DualCallDispatchState | null;
  nearbyPoliceResult: NearbyPoliceAiResult | null;
  quickDialEnabled: boolean;
  onRequestLocation: () => void;
  onTriggerSosAlert: (triggerSource: string, note?: string) => void;
  onOpenDualCall: (triggeredBy: string) => void;
  onMarkDualCallDialed: (target: 'guardian' | 'police') => void;
  onCloseDualCall: () => void;
  onClearSosStatus: () => void;
  onToggleLiveLocationShare: (active: boolean, durationMinutes?: number) => void;
  onToggleQuickDial: () => void;
  onUpdatePreferences: (partial: Partial<SafetyPreferences>) => void;
  onOpenLockScreenShield: (surface?: 'lock_screen' | 'home_screen') => void;
  onOpenContacts: () => void;
  onOpenNearbyPolice: () => void;
}

const STATUS_LABELS: Record<AlertDeliveryStatus, { text: string; tone: string }> = {
  standby: { text: 'Standby — Ready', tone: 'text-[#4B5844]' },
  initiated: { text: 'Initiated — Preparing Dispatch', tone: 'text-amber-700' },
  delivered_demo: {
    text: 'SOS Alert Active — Direct Call & SMS Ready',
    tone: 'text-emerald-700',
  },
  queued_offline: {
    text: 'Offline — Preserved Locally (Direct Call & SMS Ready)',
    tone: 'text-amber-800',
  },
  failed: { text: 'Action Required — Add Guardian Contacts', tone: 'text-red-700' },
};

export const SosPage: React.FC<SosPageProps> = ({
  userName,
  contacts,
  preferences,
  quickTriggers,
  geoLocation,
  isOnline,
  latestSosAlert,
  liveLocationShare,
  dualCallState,
  nearbyPoliceResult,
  quickDialEnabled,
  onRequestLocation,
  onTriggerSosAlert,
  onOpenDualCall,
  onMarkDualCallDialed,
  onCloseDualCall,
  onClearSosStatus,
  onToggleLiveLocationShare,
  onToggleQuickDial,
  onUpdatePreferences,
  onOpenLockScreenShield,
  onOpenContacts,
  onOpenNearbyPolice,
}) => {
  const primaryGuardian = contacts.find((c) => c.isPrimary) ?? contacts[0];
  const hasCoords =
    geoLocation.status === 'granted' &&
    geoLocation.latitude !== null &&
    geoLocation.longitude !== null;

  const nearestAiStationWithPhone = nearbyPoliceResult?.stations.find(
    (s) => Boolean(s.phone)
  );

  useEffect(() => {
    if (geoLocation.status === 'idle') {
      onRequestLocation();
    }
  }, [geoLocation.status, onRequestLocation]);

  const currentStatus: AlertDeliveryStatus = latestSosAlert?.status ?? 'standby';
  const statusMeta = STATUS_LABELS[currentStatus];

  return (
    <div className="space-y-6">
      {/* Dual Emergency Call Panel (Voice Controller -> Call BOTH Guardian & Police) */}
      {dualCallState?.active && (
        <section
          role="region"
          aria-label="Dual Emergency Call Controller"
          className="rounded-3xl bg-[#FCFDF9] border-2 border-red-500 p-6 shadow-md space-y-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-red-700">
                Dual Emergency Call Dispatch · Triggered via {dualCallState.triggeredBy}
              </p>
              <h2 className="mt-1 text-xl sm:text-2xl font-semibold text-[#182215]">
                Call Both Your Guardian &amp; Police Now
              </h2>
              <p className="mt-1 text-xs text-[#465340] max-w-2xl">
                Browser security requires one tap per phone dialer action. Tap both emergency buttons below to initiate calls to your guardian and police immediately.
              </p>
            </div>
            <button
              type="button"
              onClick={onCloseDualCall}
              aria-label="Close dual call panel"
              className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#54634D] hover:bg-[#F4F7EF] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1: Guardian Call */}
            <div className="rounded-2xl bg-red-50/70 border border-red-200 p-4 flex flex-col justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-red-800">
                  1. Registered Guardian
                  {dualCallState.guardianDialAttempted ? ' · Dialer Opened' : ''}
                </p>
                <p className="mt-1 text-lg font-bold text-[#182215]">
                  {dualCallState.guardianName || 'No Guardian Added'}
                </p>
                <p className="text-xs font-mono tabular-nums text-[#465340]">
                  {dualCallState.guardianPhone || 'Add a guardian contact first'}
                </p>
              </div>

              {dualCallState.guardianPhone ? (
                <a
                  href={`tel:${formatPhoneForTel(dualCallState.guardianPhone)}`}
                  onClick={() => onMarkDualCallDialed('guardian')}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                >
                  <Phone className="w-4 h-4" />
                  <span>Call {dualCallState.guardianName}</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={onOpenContacts}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#2F4526] text-white text-sm font-semibold cursor-pointer"
                >
                  Add Guardian Number
                </button>
              )}
            </div>

            {/* Step 2: Police Call */}
            <div className="rounded-2xl bg-red-50/70 border border-red-200 p-4 flex flex-col justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-red-800">
                  2. Police Dispatch
                  {dualCallState.policeDialAttempted ? ' · Dialer Opened' : ''}
                </p>
                <p className="mt-1 text-lg font-bold text-[#182215]">
                  {dualCallState.nearestStationName || dualCallState.policeName}
                </p>
                <p className="text-xs font-mono tabular-nums text-[#465340]">
                  Direct: {dualCallState.nearestStationPhone || dualCallState.policePhone}{' '}
                  · National Emergency: 112
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <a
                  href={`tel:${formatPhoneForTel(
                    dualCallState.nearestStationPhone || dualCallState.policePhone
                  )}`}
                  onClick={() => onMarkDualCallDialed('police')}
                  className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                >
                  <Phone className="w-4 h-4" />
                  <span>
                    Call Police (
                    {dualCallState.nearestStationPhone || dualCallState.policePhone})
                  </span>
                </a>
                <a
                  href="tel:112"
                  onClick={() => onMarkDualCallDialed('police')}
                  className="min-h-[48px] px-4 py-2.5 rounded-xl bg-white hover:bg-red-50 border border-red-300 text-red-700 text-sm font-bold flex items-center justify-center whitespace-nowrap"
                >
                  112
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Top Emergency Hero Banner */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 rounded-3xl bg-red-600 text-white p-6 sm:p-8 flex flex-col justify-between gap-6 shadow-md shadow-red-900/15">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-red-100">
              <span>OurSafe SOS Emergency Controller</span>
              <span aria-hidden="true">·</span>
              <span>{isOnline ? 'Online' : 'Offline Mode Active'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Immediate Emergency Assistance
            </h1>
            <p className="text-sm text-red-50/90 leading-relaxed max-w-xl">
              Trigger SOS manually or by saying &ldquo;Open SOS&rdquo; or &ldquo;Call both guardian and police&rdquo; to the AI Voice Assistant. Captures live GPS, prepares guardian alerts, and launches dual guardian + police dialing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                onTriggerSosAlert('Manual SOS Page Button');
                onOpenDualCall('Manual SOS Activation');
              }}
              className="flex-1 min-w-[210px] min-h-[54px] px-6 py-3 rounded-2xl bg-white hover:bg-red-50 active:scale-[0.99] text-red-700 text-base font-extrabold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer whitespace-nowrap"
            >
              <ShieldAlert className="w-5 h-5" />
              <span>Trigger SOS &amp; Dual Call</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenDualCall('Dual Emergency Call Button')}
              className="min-h-[54px] px-5 py-3 rounded-2xl bg-red-800/80 hover:bg-red-900 border border-white/25 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Phone className="w-4 h-4" />
              <span>Call Guardian &amp; Police</span>
            </button>
          </div>
        </div>

        {/* Emergency Status Tracker */}
        <div className="lg:col-span-5 bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 flex flex-col justify-between gap-4 shadow-sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#3E5632]">
                Emergency Status Tracker
              </p>
              {latestSosAlert && (
                <button
                  type="button"
                  onClick={onClearSosStatus}
                  className="text-xs font-semibold text-[#54634D] hover:text-[#182215] cursor-pointer"
                >
                  Reset Status
                </button>
              )}
            </div>

            <div>
              <p className={`text-base font-bold ${statusMeta.tone}`}>
                {statusMeta.text}
              </p>
              {latestSosAlert ? (
                <p className="mt-1 text-xs text-[#54634D] flex items-center gap-1.5 tabular-nums">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    Activated {formatDateTimeShort(latestSosAlert.activatedAt)} via{' '}
                    {latestSosAlert.triggerSource}
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-xs text-[#54634D]">
                  No active SOS dispatch. Press the red SOS button or use voice command &ldquo;Call both guardian and police&rdquo;.
                </p>
              )}
            </div>

            {latestSosAlert && (
              <div className="rounded-2xl bg-[#F4F7EF] border border-[#CFD9C3] p-3.5 space-y-2.5 text-xs">
                <p className="font-semibold text-[#182215]">
                  Emergency Message Ready for {latestSosAlert.recipients.length} Contact(s)
                </p>
                <p className="font-mono text-[11px] text-[#3E4C37] leading-relaxed">
                  &ldquo;SOS from {userName} via OurSafe. Need immediate assistance. GPS:{' '}
                  {latestSosAlert.latitude !== null && latestSosAlert.longitude !== null
                    ? `${latestSosAlert.latitude.toFixed(5)}, ${latestSosAlert.longitude.toFixed(5)}`
                    : 'Location unavailable'}
                  .&rdquo;
                </p>
                {latestSosAlert.recipients.length > 0 && (
                  <div className="pt-2 border-t border-[#DCE5D1] space-y-1.5">
                    {latestSosAlert.recipients.map((r, i) => {
                      const smsBody = encodeURIComponent(
                        `SOS from ${userName} via OurSafe! I need immediate help.${
                          latestSosAlert.latitude !== null &&
                          latestSosAlert.longitude !== null
                            ? ` My live location: https://maps.google.com/?q=${latestSosAlert.latitude.toFixed(
                                6
                              )},${latestSosAlert.longitude.toFixed(6)}`
                            : ''
                        }`
                      );
                      return (
                        <div
                          key={`${r.phone}-${i}`}
                          className="flex items-center justify-between gap-2 text-[11px]"
                        >
                          <span className="font-semibold text-[#182215]">
                            {r.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-700 font-semibold">
                              {r.status === 'queued_offline' ? 'Queued' : 'Dispatched'}
                            </span>
                            <a
                              href={`sms:${formatPhoneForTel(r.phone)}?body=${smsBody}`}
                              className="px-2 py-1 rounded-lg bg-[#2F4526] text-white font-semibold hover:bg-[#23351C] transition-colors"
                            >
                              Send SMS
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#DCE5D1] flex items-center justify-between gap-3">
            <div className="text-xs text-[#465340]">
              <p className="font-semibold text-[#182215]">
                Voice SOS Dual-Call Priority
              </p>
              <p className="text-[11px] text-[#54634D]">
                Surface guardian + police dialers automatically on voice SOS
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={quickDialEnabled}
              onClick={onToggleQuickDial}
              className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer flex items-center ${
                quickDialEnabled
                  ? 'bg-[#2F4526] justify-end'
                  : 'bg-[#C4D1B6] justify-start'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-sm block" />
            </button>
          </div>
        </div>
      </section>

      {/* Hands-Free & Outside-App Quick SOS Triggers (3x Shake, Secret Voice Code, 2x/3x Screen Tap) */}
      <QuickSosTriggersCard
        preferences={preferences}
        triggers={quickTriggers}
        onUpdatePreferences={onUpdatePreferences}
        onOpenLockScreenShield={onOpenLockScreenShield}
      />

      {/* Live Location Sharing + Nearest Police Station */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[#3E5632]">
                Live Location Sharing
              </p>
              <h2 className="text-lg font-semibold text-[#182215] mt-0.5">
                Current GPS Coordinates
              </h2>
            </div>
            <button
              type="button"
              onClick={onRequestLocation}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] text-[#24371D] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <LocateFixed className="w-3.5 h-3.5" />
              <span>Refresh GPS</span>
            </button>
          </div>

          <div className="rounded-2xl bg-[#F4F7EF] border border-[#D4DFC8] p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#182215]">
              <MapPin className="w-4 h-4 text-[#2F4526]" />
              <span className="font-mono tabular-nums">
                {hasCoords
                  ? `${geoLocation.latitude!.toFixed(6)}, ${geoLocation.longitude!.toFixed(6)}`
                  : geoLocation.status === 'loading'
                    ? 'Locating device...'
                    : 'Location permission needed'}
              </span>
            </div>
            <p className="text-xs text-[#54634D]">
              {hasCoords
                ? `Accuracy ±${Math.round(geoLocation.accuracy ?? 0)}m · Ready to attach to emergency alerts`
                : geoLocation.errorMessage ||
                  'Grant browser location permission to share exact coordinates with guardians.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="text-xs text-[#465340]">
              <p className="font-semibold text-[#182215] flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-[#2F4526]" />
                <span>
                  {liveLocationShare?.active
                    ? `Sharing Live to ${liveLocationShare.sharedWithNames.length} Guardian(s) + Police (${
                        liveLocationShare.nearestPolicePhone || '100'
                      })`
                    : 'Live Location Sharing (Guardians + Police)'}
                </span>
              </p>
              <p className="text-[11px] text-[#54634D] mt-0.5">
                {liveLocationShare?.active
                  ? `Started ${formatDateTimeShort(liveLocationShare.startedAt)} · Guardians & ${
                      liveLocationShare.nearestPoliceName || 'Police Control Room'
                    } notified`
                  : 'Shares your exact live GPS coordinates with both registered guardians and nearest police dispatch.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                onToggleLiveLocationShare(!liveLocationShare?.active, 30)
              }
              className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                liveLocationShare?.active
                  ? 'bg-red-50 hover:bg-red-100 border border-red-200 text-red-700'
                  : 'bg-[#2F4526] hover:bg-[#23351C] text-[#F6F9F2]'
              }`}
            >
              {liveLocationShare?.active
                ? 'Stop Location Share'
                : 'Share to Guardian & Police'}
            </button>
          </div>

          {liveLocationShare?.active && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 space-y-2.5 text-xs">
              <p className="font-bold text-emerald-900">
                Live GPS Ready for Both Guardian &amp; Police Dispatch
              </p>
              <div className="flex flex-wrap gap-2">
                {primaryGuardian && (
                  <a
                    href={`sms:${formatPhoneForTel(primaryGuardian.phone)}?body=${encodeURIComponent(
                      `OurSafe Live Location from ${userName}: ${
                        hasCoords
                          ? `https://maps.google.com/?q=${geoLocation.latitude!.toFixed(
                              6
                            )},${geoLocation.longitude!.toFixed(6)}`
                          : 'GPS locating...'
                      }`
                    )}`}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-white font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>SMS Guardian ({primaryGuardian.name})</span>
                  </a>
                )}
                <a
                  href={`sms:${formatPhoneForTel(
                    liveLocationShare.nearestPolicePhone ||
                      nearestAiStationWithPhone?.phone ||
                      '100'
                  )}?body=${encodeURIComponent(
                    `EMERGENCY Live Location from ${userName} via OurSafe: ${
                      hasCoords
                        ? `https://maps.google.com/?q=${geoLocation.latitude!.toFixed(
                            6
                          )},${geoLocation.longitude!.toFixed(6)}`
                        : 'GPS locating...'
                    }`
                  )}`}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>
                    SMS Police (
                    {liveLocationShare.nearestPolicePhone ||
                      nearestAiStationWithPhone?.phone ||
                      '100'}
                    )
                  </span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Nearest Police Station & Authorities */}
        <div className="lg:col-span-6 bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#3E5632]">
              Immediate Law Enforcement Access
            </p>
            <h2 className="text-lg font-semibold text-[#182215]">
              Contact Nearest Police Station
            </h2>
            <p className="text-xs text-[#4B5844] leading-relaxed">
              {nearestAiStationWithPhone
                ? `AI located ${nearestAiStationWithPhone.name} (${nearestAiStationWithPhone.phone}). Dial directly below or call national dispatch.`
                : 'Reach official emergency dispatch immediately via your phone dialer, or open Nearby Police Stations centered on your live GPS.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href={`tel:${formatPhoneForTel(
                nearestAiStationWithPhone?.phone || '100'
              )}`}
              className="min-h-[48px] px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <Phone className="w-4 h-4" />
              <span>
                Call Police ({nearestAiStationWithPhone?.phone || '100'})
              </span>
            </a>
            <a
              href="tel:112"
              className="min-h-[48px] px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 text-sm font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <Shield className="w-4 h-4" />
              <span>Emergency (112)</span>
            </a>
          </div>

          <button
            type="button"
            onClick={onOpenNearbyPolice}
            className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] text-[#24371D] text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <MapPin className="w-4 h-4 text-[#2F4526]" />
            <span>Open Nearby Police Stations</span>
          </button>
        </div>
      </section>

      {/* Trusted Guardian Network & Offline Support Notice */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[#3E5632]">
                Trusted Guardian Network ({contacts.length})
              </p>
              <h2 className="text-lg font-semibold text-[#182215] mt-0.5">
                Registered Emergency Contacts
              </h2>
            </div>
            <button
              type="button"
              onClick={onOpenContacts}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] text-[#24371D] text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Manage Network</span>
            </button>
          </div>

          {contacts.length === 0 ? (
            <div className="rounded-2xl bg-[#F4F7EF] border border-[#D4DFC8] p-5 text-center space-y-3">
              <p className="text-sm text-[#4B5844]">
                No emergency contacts registered yet.
              </p>
              <button
                type="button"
                onClick={onOpenContacts}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#2F4526] text-white text-xs font-semibold cursor-pointer"
              >
                Add Trusted Guardian
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#DCE5D1] border border-[#CFD9C3] rounded-2xl overflow-hidden">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="p-4 bg-[#FCFDF9] flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#182215]">
                      {c.name}
                      {c.isPrimary ? ' · Primary Guardian' : ''}
                    </p>
                    <p className="text-xs text-[#54634D] font-mono tabular-nums mt-0.5">
                      {c.phone} · {c.relation || 'Emergency Contact'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onTriggerSosAlert(`Direct Alert to ${c.name}`)
                      }
                      className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] text-[#24371D] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Alert</span>
                    </button>
                    <a
                      href={`tel:${formatPhoneForTel(c.phone)}`}
                      className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Emergency Offline Support Card */}
        <div className="lg:col-span-5 bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[#3E5632]">
                Emergency Offline Support
              </p>
              <h2 className="text-lg font-semibold text-[#182215] mt-0.5">
                Connectivity &amp; Offline Readiness
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#182215]">
              {isOnline ? (
                <>
                  <Wifi className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-amber-600" />
                  <span className="text-amber-700">Offline</span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="rounded-2xl bg-[#F4F7EF] border border-[#D4DFC8] p-4 space-y-1.5">
              <p className="font-bold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Available Offline (Cached Locally)</span>
              </p>
              <p className="text-[#465340] leading-relaxed">
                Saved guardian numbers, direct <code className="font-mono">tel:</code> emergency calling (112, 181, 100, 108, 1098), Threat Mode audio/video recording, local Evidence History, and Fake Call.
              </p>
            </div>

            <div className="rounded-2xl bg-[#F4F7EF] border border-[#D4DFC8] p-4 space-y-1.5">
              <p className="font-bold text-[#182215]">
                Requires Internet Connection
              </p>
              <p className="text-[#4B5844] leading-relaxed">
                Real-time Gemini Live Voice AI, AI nearby police station lookup, online Maps searches, and future cloud SMS alerts.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
