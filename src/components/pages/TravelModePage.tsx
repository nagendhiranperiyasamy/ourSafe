import React, { useCallback, useEffect, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Clock,
  PhoneIncoming,
  ShieldCheck,
} from 'lucide-react';
import {
  GeoLocationState,
  SafetyCheckInSession,
  SosContact,
  TravelSession,
  VehicleVerificationRecord,
} from '../../types/safety';
import { TravelModePanel } from '../dashboard/TravelModePanel';
import { TravelRouteMap } from '../dashboard/TravelRouteMap';
import { VehicleVerificationCard } from '../dashboard/VehicleVerificationCard';

interface TravelModePageProps {
  contacts: SosContact[];
  travelSession: TravelSession | null;
  checkInSession: SafetyCheckInSession | null;
  geoLocation: GeoLocationState;
  soundAllowed?: boolean;
  onRequestLocation: () => void;
  onStartTravel: (session: TravelSession) => void;
  onUpdateTravelVehicle: (vehicle: VehicleVerificationRecord | null) => void;
  onOffRouteAlert: (info: {
    distanceMeters: number;
    currentLat: number;
    currentLng: number;
    simulated: boolean;
  }) => void;
  onEscalateToSos: (reason: string) => void;
  onCheckInTravel: () => void;
  onEndTravel: () => void;
  onManageContacts: () => void;
  onStartSafetyCheckIn: (
    label: string,
    durationSeconds: number,
    guardianId: string
  ) => void;
  onConfirmSafetyCheckIn: () => void;
  onCancelSafetyCheckIn: () => void;
  onTriggerFakeCall: (callerName: string, delaySeconds: number) => void;
}

export const TravelModePage: React.FC<TravelModePageProps> = ({
  contacts,
  travelSession,
  checkInSession,
  geoLocation,
  soundAllowed = true,
  onRequestLocation,
  onStartTravel,
  onUpdateTravelVehicle,
  onOffRouteAlert,
  onEscalateToSos,
  onCheckInTravel,
  onEndTravel,
  onManageContacts,
  onStartSafetyCheckIn,
  onConfirmSafetyCheckIn,
  onCancelSafetyCheckIn,
  onTriggerFakeCall,
}) => {
  const [draftStart, setDraftStart] = useState('');
  const [draftDest, setDraftDest] = useState('');
  const [verifiedVehicle, setVerifiedVehicle] =
    useState<VehicleVerificationRecord | null>(travelSession?.vehicleInfo ?? null);

  const [checkInLabel, setCheckInLabel] = useState('Walking home');
  const [checkInSeconds, setCheckInSeconds] = useState(600);
  const [checkInGuardianId, setCheckInGuardianId] = useState(
    contacts[0]?.id ?? ''
  );
  const [remainingSec, setRemainingSec] = useState(0);

  const [fakeCallerName, setFakeCallerName] = useState('Mom');
  const [fakeCallDelay, setFakeCallDelay] = useState(0);
  const [scheduledDelayCountdown, setScheduledDelayCountdown] = useState<
    number | null
  >(null);

  useEffect(() => {
    if (travelSession?.vehicleInfo) {
      setVerifiedVehicle(travelSession.vehicleInfo);
    }
  }, [travelSession?.vehicleInfo]);

  useEffect(() => {
    if (contacts.length > 0 && !contacts.some((c) => c.id === checkInGuardianId)) {
      setCheckInGuardianId(contacts[0].id);
    }
  }, [contacts, checkInGuardianId]);

  useEffect(() => {
    if (!checkInSession || !checkInSession.active) {
      setRemainingSec(0);
      return;
    }

    const updateRemaining = () => {
      const rem = Math.max(
        0,
        Math.ceil((new Date(checkInSession.dueAt).getTime() - Date.now()) / 1000)
      );
      setRemainingSec(rem);
    };
    updateRemaining();
    const id = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(id);
  }, [checkInSession]);

  const handleDraftRouteChange = useCallback((start: string, dest: string) => {
    setDraftStart(start);
    setDraftDest(dest);
  }, []);

  const handleLaunchFakeCall = (e: React.FormEvent) => {
    e.preventDefault();
    const name = fakeCallerName.trim() || 'Mom';
    if (fakeCallDelay <= 0) {
      onTriggerFakeCall(name, 0);
      return;
    }
    setScheduledDelayCountdown(fakeCallDelay);
    onTriggerFakeCall(name, fakeCallDelay);
  };

  useEffect(() => {
    if (scheduledDelayCountdown === null) return;
    if (scheduledDelayCountdown <= 0) {
      setScheduledDelayCountdown(null);
      return;
    }
    const id = window.setTimeout(
      () => setScheduledDelayCountdown((c) => (c !== null ? c - 1 : null)),
      1000
    );
    return () => window.clearTimeout(id);
  }, [scheduledDelayCountdown]);

  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;

  const activeStart = travelSession?.active
    ? travelSession.startLocation
    : draftStart;
  const activeDest = travelSession?.active
    ? travelSession.destination
    : draftDest;
  const primaryGuardian = contacts.find((c) => c.isPrimary) ?? contacts[0];

  return (
    <div className="space-y-6">
      {/* 1. Dedicated Travel Mode Start / Active Journey Panel */}
      <TravelModePanel
        contacts={contacts}
        travelSession={travelSession}
        geoLocation={geoLocation}
        verifiedVehicle={verifiedVehicle}
        onDraftRouteChange={handleDraftRouteChange}
        onRequestLocation={onRequestLocation}
        onStartTravel={onStartTravel}
        onCheckInTravel={onCheckInTravel}
        onEndTravel={onEndTravel}
        onManageContacts={onManageContacts}
      />

      {/* 2. Live Google Maps Route + Real-Time Off-Route Deviation Guard */}
      <TravelRouteMap
        startLocation={activeStart}
        destination={activeDest}
        isJourneyActive={Boolean(travelSession?.active)}
        geoLocation={geoLocation}
        guardianName={travelSession?.guardianName ?? primaryGuardian?.name}
        guardianPhone={travelSession?.guardianPhone ?? primaryGuardian?.phone}
        vehicleNumber={
          travelSession?.vehicleInfo?.normalizedNumber ??
          verifiedVehicle?.normalizedNumber
        }
        soundAllowed={soundAllowed}
        onOffRouteDetected={onOffRouteAlert}
        onEscalateToSos={onEscalateToSos}
      />

      {/* 3. Auto / Cab Number Verification & Photo Plate Audit */}
      <VehicleVerificationCard
        verifiedVehicle={verifiedVehicle}
        onVehicleVerified={(record) => {
          setVerifiedVehicle(record);
          onUpdateTravelVehicle(record);
        }}
        onClearVehicle={() => {
          setVerifiedVehicle(null);
          onUpdateTravelVehicle(null);
        }}
      />

      {/* 4. Safety Check-In Timer & Discreet Fake Call Tool */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Safety Check-In Timer */}
        <section className="lg:col-span-7 bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 space-y-4 shadow-sm">
          <div>
            <p className="text-xs font-semibold text-[#3E5632]">
              Proactive Prevention · Timed Safety Check-In
            </p>
            <h2 className="mt-1 text-lg sm:text-xl font-semibold text-[#182215]">
              Safety Check-In Timer
            </h2>
            <p className="mt-1 text-xs text-[#4B5844] leading-relaxed">
              Set a check-in window before commuting or meeting someone new. If you do not tap &ldquo;I&apos;m Safe&rdquo; before time runs out, OurSafe automatically alerts your chosen guardian.
            </p>
          </div>

          {checkInSession?.active ? (
            <div className="rounded-2xl bg-[#F4F7EF] border border-[#CFD9C3] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#24371D]">
                    Check-In Active · {checkInSession.label}
                  </p>
                  <p className="text-xs text-[#465340] mt-0.5">
                    Guardian on standby: <strong>{checkInSession.guardianName}</strong>{' '}
                    ({checkInSession.guardianPhone})
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-2xl font-bold font-mono tabular-nums text-[#24371D]">
                  <Clock className="w-5 h-5" />
                  <span>
                    {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onConfirmSafetyCheckIn}
                  className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>I&apos;m Safe — Confirm Check-In</span>
                </button>
                <button
                  type="button"
                  onClick={onCancelSafetyCheckIn}
                  className="min-h-[46px] px-4 py-2.5 rounded-xl bg-white hover:bg-[#EAF0E2] border border-[#C5D2B7] text-[#182215] text-xs font-semibold cursor-pointer"
                >
                  Cancel Timer
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onStartSafetyCheckIn(
                  checkInLabel.trim() || 'Safety Check-In',
                  checkInSeconds,
                  checkInGuardianId
                );
              }}
              className="space-y-3.5"
            >
              {checkInSession?.status === 'missed' && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-800 flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-red-600 shrink-0" />
                  <span>
                    Previous check-in expired without confirmation. Guardian alert has been logged in Emergency History.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#182215] mb-1">
                    Activity Label
                  </label>
                  <input
                    type="text"
                    value={checkInLabel}
                    onChange={(e) => setCheckInLabel(e.target.value)}
                    placeholder="e.g. Evening bus commute"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm focus:bg-white focus:border-[#2F4526] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#182215] mb-1">
                    Check-In Window
                  </label>
                  <select
                    value={checkInSeconds}
                    onChange={(e) => setCheckInSeconds(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm focus:bg-white focus:border-[#2F4526] focus:outline-none"
                  >
                    <option value={30}>30 seconds</option>
                    <option value={300}>5 minutes</option>
                    <option value={600}>10 minutes</option>
                    <option value={900}>15 minutes</option>
                    <option value={1800}>30 minutes</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-7">
                  <label className="block text-xs font-semibold text-[#182215] mb-1">
                    Notify Guardian If Missed
                  </label>
                  <select
                    value={checkInGuardianId}
                    onChange={(e) => setCheckInGuardianId(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm focus:bg-white focus:border-[#2F4526] focus:outline-none"
                  >
                    {contacts.length === 0 ? (
                      <option value="">No guardian contacts saved</option>
                    ) : (
                      contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.phone})
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="sm:col-span-5">
                  <button
                    type="submit"
                    disabled={contacts.length === 0}
                    className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#2F4526] hover:bg-[#23351C] disabled:opacity-50 text-[#F6F9F2] text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Start Check-In</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </section>

        {/* Discreet Fake Call Tool */}
        <section className="lg:col-span-5 bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 space-y-4 shadow-sm">
          <div>
            <p className="text-xs font-semibold text-[#3E5632]">
              Discreet Exit Tool · Works Offline
            </p>
            <h2 className="mt-1 text-lg sm:text-xl font-semibold text-[#182215]">
              Discreet Fake Call
            </h2>
            <p className="mt-1 text-xs text-[#4B5844] leading-relaxed">
              Trigger a realistic incoming call screen with ringtone so you can step away politely from an uncomfortable situation.
            </p>
          </div>

          <form onSubmit={handleLaunchFakeCall} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#182215] mb-1">
                Caller Display Name
              </label>
              <input
                type="text"
                value={fakeCallerName}
                onChange={(e) => setFakeCallerName(e.target.value)}
                placeholder="e.g. Mom, Dad, Office Manager"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm focus:bg-white focus:border-[#2F4526] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#182215] mb-1">
                Ring Delay
              </label>
              <select
                value={fakeCallDelay}
                onChange={(e) => setFakeCallDelay(Number(e.target.value))}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm focus:bg-white focus:border-[#2F4526] focus:outline-none"
              >
                <option value={0}>Ring Immediately</option>
                <option value={5}>Ring in 5 seconds</option>
                <option value={10}>Ring in 10 seconds</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#182215] hover:bg-[#24371D] text-[#F6F9F2] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <PhoneIncoming className="w-4 h-4" />
              <span>
                {scheduledDelayCountdown !== null
                  ? `Ringing in ${scheduledDelayCountdown}s...`
                  : 'Trigger Incoming Call'}
              </span>
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};
