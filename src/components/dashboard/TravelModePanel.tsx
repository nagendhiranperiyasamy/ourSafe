import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Compass,
  LocateFixed,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import {
  GeoLocationState,
  SosContact,
  TravelSession,
  VehicleVerificationRecord,
} from '../../types/safety';
import { formatPhoneForTel, formatTimeShort } from '../../utils/storage';

interface TravelModePanelProps {
  contacts: SosContact[];
  travelSession: TravelSession | null;
  geoLocation: GeoLocationState;
  verifiedVehicle?: VehicleVerificationRecord | null;
  onDraftRouteChange?: (start: string, destination: string) => void;
  onRequestLocation: () => void;
  onStartTravel: (session: TravelSession) => void;
  onCheckInTravel: () => void;
  onEndTravel: () => void;
  onManageContacts: () => void;
}

export const TravelModePanel: React.FC<TravelModePanelProps> = ({
  contacts,
  travelSession,
  geoLocation,
  verifiedVehicle,
  onDraftRouteChange,
  onRequestLocation,
  onStartTravel,
  onCheckInTravel,
  onEndTravel,
  onManageContacts,
}) => {
  const [startLocation, setStartLocation] = useState('');
  const [destination, setDestination] = useState('');
  const [selectedGuardianId, setSelectedGuardianId] = useState(
    contacts[0]?.id ?? ''
  );
  const [formError, setFormError] = useState('');
  const [elapsedText, setElapsedText] = useState('00:00');
  const [arrivalNotice, setArrivalNotice] = useState('');

  useEffect(() => {
    if (
      contacts.length > 0 &&
      !contacts.some((c) => c.id === selectedGuardianId)
    ) {
      setSelectedGuardianId(contacts[0].id);
    }
  }, [contacts, selectedGuardianId]);

  useEffect(() => {
    if (!travelSession?.active) {
      setElapsedText('00:00');
      return;
    }

    const updateElapsed = () => {
      const diffMs = Math.max(
        0,
        Date.now() - new Date(travelSession.startedAt).getTime()
      );
      const totalSeconds = Math.floor(diffMs / 1000);
      const hrs = Math.floor(totalSeconds / 3600);
      const mins = Math.floor((totalSeconds % 3600) / 60);
      const secs = totalSeconds % 60;
      if (hrs > 0) {
        setElapsedText(
          `${String(hrs).padStart(2, '0')}:${String(mins).padStart(
            2,
            '0'
          )}:${String(secs).padStart(2, '0')}`
        );
      } else {
        setElapsedText(
          `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
        );
      }
    };

    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [travelSession]);

  const handleUseCurrentGps = () => {
    onRequestLocation();
    if (
      geoLocation.status === 'granted' &&
      geoLocation.latitude !== null &&
      geoLocation.longitude !== null
    ) {
      setStartLocation(
        `GPS ${geoLocation.latitude.toFixed(5)}, ${geoLocation.longitude.toFixed(5)}`
      );
    }
  };

  useEffect(() => {
    if (
      geoLocation.status === 'granted' &&
      geoLocation.latitude !== null &&
      geoLocation.longitude !== null &&
      !startLocation
    ) {
      setStartLocation(
        `GPS ${geoLocation.latitude.toFixed(5)}, ${geoLocation.longitude.toFixed(5)}`
      );
    }
  }, [
    geoLocation.status,
    geoLocation.latitude,
    geoLocation.longitude,
    startLocation,
  ]);

  useEffect(() => {
    onDraftRouteChange?.(startLocation, destination);
  }, [startLocation, destination, onDraftRouteChange]);

  const handleStartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setArrivalNotice('');

    if (!startLocation.trim()) {
      setFormError(
        'Enter your starting location or tap the GPS button to use live coordinates.'
      );
      return;
    }
    if (!destination.trim()) {
      setFormError('Enter your destination before starting Travel Mode.');
      return;
    }

    const guardian =
      contacts.find((c) => c.id === selectedGuardianId) ?? contacts[0];
    if (!guardian) {
      setFormError('Add at least one emergency guardian contact first.');
      return;
    }

    const now = new Date().toISOString();
    onStartTravel({
      active: true,
      startLocation: startLocation.trim(),
      destination: destination.trim(),
      guardianId: guardian.id,
      guardianName: guardian.name,
      guardianPhone: guardian.phone,
      startedAt: now,
      lastCheckInAt: now,
      vehicleInfo: verifiedVehicle ?? undefined,
    });
  };

  const handleSafeEnd = () => {
    const dest = travelSession?.destination ?? 'destination';
    onEndTravel();
    setArrivalNotice(`Travel Mode ended safely. Journey to ${dest} closed.`);
    setDestination('');
  };

  const activeVehicle = travelSession?.vehicleInfo ?? verifiedVehicle ?? null;

  const tripSmsBody = travelSession
    ? encodeURIComponent(
        `OurSafe Travel Update: Heading from ${travelSession.startLocation} to ${travelSession.destination}.${
          activeVehicle
            ? ` Vehicle: ${activeVehicle.normalizedNumber} (${activeVehicle.vehicleType}, ${activeVehicle.stateRegion}).`
            : ''
        }${
          geoLocation.status === 'granted' &&
          geoLocation.latitude !== null &&
          geoLocation.longitude !== null
            ? ` Live GPS: https://maps.google.com/?q=${geoLocation.latitude.toFixed(
                6
              )},${geoLocation.longitude.toFixed(6)}`
            : ''
        }`
      )
    : '';

  return (
    <section className="bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-5 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#54634D]">
            <span className="font-semibold text-[#3E5632]">Travel Mode</span>
            <span aria-hidden="true">·</span>
            <span
              className={
                travelSession?.active
                  ? 'font-semibold text-emerald-700'
                  : 'text-[#54634D]'
              }
            >
              {travelSession?.active ? 'Journey Active' : 'Standby'}
            </span>
          </div>
          <h3 className="mt-1 text-lg sm:text-xl font-semibold text-[#182215]">
            {travelSession?.active
              ? 'Active Journey Sharing'
              : 'Share your journey with a guardian'}
          </h3>
        </div>

        <button
          type="button"
          onClick={onManageContacts}
          className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] text-[#24371D] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Manage Contacts
        </button>
      </div>

      {arrivalNotice && !travelSession?.active && (
        <div className="mb-4 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-medium text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{arrivalNotice}</span>
        </div>
      )}

      {travelSession?.active ? (
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#F4F7EF] border border-[#CFD9C3] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#DCE5D1]">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#182215]">
                <Compass className="w-4 h-4 text-[#2F4526] shrink-0" />
                <span>Live Journey Tracking Active</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm font-mono font-bold text-[#24371D] tabular-nums">
                <Clock className="w-4 h-4" />
                <span>{elapsedText}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-[#54634D]">Starting Location</p>
                <p className="font-semibold text-[#182215] mt-0.5 break-words">
                  {travelSession.startLocation}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#54634D]">Destination</p>
                <p className="font-semibold text-[#182215] mt-0.5 break-words">
                  {travelSession.destination}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#DCE5D1] flex flex-wrap items-center justify-between gap-3 text-xs text-[#465340]">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-[#2F4526] shrink-0" />
                  <span>
                    Guardian:{' '}
                    <strong className="text-[#182215]">
                      {travelSession.guardianName}
                    </strong>{' '}
                    <span className="font-mono tabular-nums">
                      ({travelSession.guardianPhone})
                    </span>
                  </span>
                </span>
                {activeVehicle && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-[#EAF0E2] border border-[#C5D2B7] font-mono font-bold text-[#182215]">
                    Vehicle: {activeVehicle.normalizedNumber}
                  </span>
                )}
              </div>
              <span className="tabular-nums text-[#54634D]">
                Last check-in: {formatTimeShort(travelSession.lastCheckInAt)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onCheckInTravel}
              className="flex-1 min-w-[140px] min-h-[46px] px-4 py-2.5 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] text-[#24371D] text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-[#2F4526]" />
              <span>Log Safe Check-in</span>
            </button>

            <a
              href={`sms:${formatPhoneForTel(
                travelSession.guardianPhone
              )}?body=${tripSmsBody}`}
              className="min-h-[46px] px-4 py-2.5 rounded-xl bg-white hover:bg-[#F4F7EF] border border-[#C5D2B7] text-[#182215] text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <MessageSquare className="w-4 h-4 text-[#2F4526]" />
              <span>SMS Route</span>
            </a>

            <a
              href={`tel:${formatPhoneForTel(travelSession.guardianPhone)}`}
              className="min-h-[46px] px-4 py-2.5 rounded-xl bg-white hover:bg-[#F4F7EF] border border-[#C5D2B7] text-[#182215] text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <Phone className="w-4 h-4 text-[#2F4526]" />
              <span>Call Guardian</span>
            </a>

            <button
              type="button"
              onClick={handleSafeEnd}
              className="flex-1 min-w-[140px] min-h-[46px] px-4 py-2.5 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-[#F6F9F2] text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>End Travel</span>
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleStartSubmit} className="space-y-4">
          {formError && (
            <p className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-700">
              {formError}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="travel-start"
                className="block text-xs font-semibold text-[#182215] mb-1.5"
              >
                Starting Location
              </label>
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <MapPin className="w-4 h-4 text-[#5D6C55] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="travel-start"
                    type="text"
                    value={startLocation}
                    onChange={(e) => setStartLocation(e.target.value)}
                    placeholder="Current street or landmark"
                    className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm text-[#182215] placeholder:text-[#75856D] focus:bg-white focus:border-[#2F4526] focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleUseCurrentGps}
                  title="Fill using live GPS location"
                  aria-label="Fill starting location using GPS"
                  className="min-w-[44px] min-h-[44px] rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] text-[#2F4526] flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                >
                  <LocateFixed className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="travel-destination"
                className="block text-xs font-semibold text-[#182215] mb-1.5"
              >
                Destination
              </label>
              <div className="relative">
                <Navigation className="w-4 h-4 text-[#5D6C55] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="travel-destination"
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Where are you heading?"
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm text-[#182215] placeholder:text-[#75856D] focus:bg-white focus:border-[#2F4526] focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
            <div className="sm:col-span-7">
              <label
                htmlFor="travel-guardian"
                className="block text-xs font-semibold text-[#182215] mb-1.5"
              >
                Guardian Contact to Notify
              </label>
              <select
                id="travel-guardian"
                value={selectedGuardianId}
                onChange={(e) => setSelectedGuardianId(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm text-[#182215] focus:bg-white focus:border-[#2F4526] focus:outline-none"
              >
                {contacts.length === 0 ? (
                  <option value="">No emergency contacts added</option>
                ) : (
                  contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name} ({contact.phone})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="sm:col-span-5">
              <button
                type="submit"
                className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-[#F6F9F2] text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                <span>Start Travel</span>
              </button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
};
