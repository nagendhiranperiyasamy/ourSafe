import React, { useState } from 'react';
import {
  Building2,
  ExternalLink,
  LocateFixed,
  MapPin,
  Navigation,
  Phone,
  Search,
  Shield,
} from 'lucide-react';
import { GeoLocationState, NearbyPoliceAiResult } from '../../types/safety';
import { formatPhoneForTel } from '../../utils/storage';

interface NearbyLocationsSectionProps {
  geoLocation: GeoLocationState;
  isOnline: boolean;
  nearbyPoliceResult: NearbyPoliceAiResult | null;
  nearbyPoliceLoading: boolean;
  nearbyPoliceError: string;
  onFetchNearbyPoliceAi: (areaQuery?: string) => void;
  onRequestLocation: () => void;
  initialCategory?: 'police' | 'restrooms';
}

type NearbyCategory = 'police' | 'restrooms';

export const NearbyLocationsSection: React.FC<NearbyLocationsSectionProps> = ({
  geoLocation,
  isOnline,
  nearbyPoliceResult,
  nearbyPoliceLoading,
  nearbyPoliceError,
  onFetchNearbyPoliceAi,
  onRequestLocation,
  initialCategory = 'police',
}) => {
  const [category, setCategory] = useState<NearbyCategory>(initialCategory);
  const [areaInput, setAreaInput] = useState('');

  React.useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  const hasCoords =
    geoLocation.status === 'granted' &&
    geoLocation.latitude !== null &&
    geoLocation.longitude !== null;

  const queryTerm =
    category === 'police' ? 'police station' : 'public restroom';

  const mapsSearchUrl = hasCoords
    ? `https://www.google.com/maps/search/${encodeURIComponent(queryTerm)}/@${geoLocation.latitude},${geoLocation.longitude},15z`
    : `https://www.google.com/maps/search/${encodeURIComponent(queryTerm + ' near me')}`;

  const handleSearchPolice = (e: React.FormEvent) => {
    e.preventDefault();
    onFetchNearbyPoliceAi(areaInput.trim() || undefined);
  };

  return (
    <section className="bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-5 sm:p-6 shadow-sm space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#3E5632]">
            Verified Location Services · GPS &amp; Google Maps
          </p>
          <h3 className="mt-1 text-lg sm:text-xl font-semibold text-[#182215]">
            Nearby Police Stations &amp; Restrooms
          </h3>
        </div>

        {/* Category Filter Buttons */}
        <div
          role="tablist"
          aria-label="Nearby place type"
          className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#EAF0E2] border border-[#C5D2B7]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={category === 'police'}
            onClick={() => setCategory('police')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              category === 'police'
                ? 'bg-[#FCFDF9] text-[#182215] shadow-sm'
                : 'text-[#4B5844] hover:text-[#182215]'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Police Stations</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={category === 'restrooms'}
            onClick={() => setCategory('restrooms')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              category === 'restrooms'
                ? 'bg-[#FCFDF9] text-[#182215] shadow-sm'
                : 'text-[#4B5844] hover:text-[#182215]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Restrooms</span>
          </button>
        </div>
      </div>

      {/* Live GPS & Maps Action Banner */}
      <div className="relative rounded-2xl overflow-hidden border border-[#C5D2B7] bg-[#EAF0E2] min-h-[210px] flex items-center justify-center">
        <img
          src="/src/assets/images/map_grid_backdrop_1795271545558.jpg"
          alt="City street grid backdrop for nearby safety lookup"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#FCFDF9]/95 via-[#FCFDF9]/85 to-[#F4F7EF]/75" />

        <div className="relative z-10 p-5 sm:p-6 text-center max-w-lg space-y-3">
          <div className="w-11 h-11 rounded-2xl bg-[#2F4526] text-[#F6F9F2] flex items-center justify-center mx-auto shadow-sm">
            <MapPin className="w-5 h-5" />
          </div>

          <div>
            <p className="text-sm font-bold text-[#182215]">
              {category === 'police'
                ? 'Locate Nearest Police Stations & Numbers'
                : 'Find Verified Public Restrooms Nearby'}
            </p>
            <p className="mt-1 text-xs text-[#465340] leading-relaxed">
              {category === 'police'
                ? 'Use your live GPS or search any area below to pull verified nearby police stations, phone numbers, and Google Maps directions.'
                : 'Center your Google Maps search on your live GPS coordinates for verified nearby restrooms and safe transit facilities.'}
            </p>
          </div>

          {hasCoords ? (
            <p className="text-xs font-mono tabular-nums text-[#24371D] font-semibold">
              Your GPS: {geoLocation.latitude!.toFixed(5)},{' '}
              {geoLocation.longitude!.toFixed(5)}
            </p>
          ) : (
            <p className="text-xs text-[#54634D]">
              {geoLocation.status === 'loading'
                ? 'Reading device GPS location...'
                : 'Enable browser location to center your search accurately.'}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onRequestLocation}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-white hover:bg-[#F4F7EF] border border-[#B8C6A8] text-[#182215] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <LocateFixed className="w-3.5 h-3.5 text-[#2F4526]" />
              <span>{hasCoords ? 'Refresh GPS' : 'Use My Location'}</span>
            </button>

            <a
              href={mapsSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-[#F6F9F2] text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>
                Open {category === 'police' ? 'Police Stations' : 'Restrooms'} in Maps
              </span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Live AI Police Station Lookup Section when Police tab is active */}
      {category === 'police' ? (
        <div className="space-y-4">
          <form
            onSubmit={handleSearchPolice}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#54634D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={areaInput}
                onChange={(e) => setAreaInput(e.target.value)}
                placeholder={
                  hasCoords
                    ? 'Leave blank to use live GPS, or type any city / area...'
                    : 'Enter your city, area, or landmark (e.g. Koramangala, Bengaluru)...'
                }
                className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm text-[#182215] placeholder:text-[#6B7A63] focus:bg-white focus:border-[#2F4526] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={!isOnline || nearbyPoliceLoading}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#2F4526] hover:bg-[#23351C] disabled:opacity-50 text-[#F6F9F2] text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Shield className="w-4 h-4" />
              <span>
                {nearbyPoliceLoading ? 'Searching...' : 'Find Police Numbers (AI)'}
              </span>
            </button>
          </form>

          {nearbyPoliceError && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900">
              {nearbyPoliceError}
            </div>
          )}

          {nearbyPoliceResult && nearbyPoliceResult.stations.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {nearbyPoliceResult.stations.map((station, idx) => (
                <div
                  key={`${station.name}-${idx}`}
                  className="rounded-2xl bg-[#F4F7EF] border border-[#CFD9C3] p-4 flex flex-col justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-bold text-[#182215]">
                      {station.name}
                    </p>
                    {station.address && (
                      <p className="mt-1 text-xs text-[#4B5844] leading-relaxed">
                        {station.address}
                      </p>
                    )}
                    <p className="mt-1.5 text-xs font-mono tabular-nums font-semibold text-[#24371D]">
                      {station.phone
                        ? `Phone: ${station.phone}`
                        : 'Direct number unlisted — dial 100 or 112'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {station.phone ? (
                      <a
                        href={`tel:${formatPhoneForTel(station.phone)}`}
                        className="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-[#F6F9F2] text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Call Station</span>
                      </a>
                    ) : (
                      <a
                        href="tel:100"
                        className="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Call 100</span>
                      </a>
                    )}
                    {station.mapsUri && (
                      <a
                        href={station.mapsUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white hover:bg-[#EAF0E2] border border-[#C5D2B7] text-[#24371D] text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Directions</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {nearbyPoliceResult && nearbyPoliceResult.mapLinks.length > 0 && (
            <div className="rounded-2xl bg-[#F4F7EF] border border-[#D4DFC8] p-4 space-y-2">
              <p className="text-xs font-semibold text-[#3E5632]">
                Verified Google Maps Sources ({nearbyPoliceResult.locationLabel})
              </p>
              <div className="flex flex-wrap gap-2">
                {nearbyPoliceResult.mapLinks.map((link, idx) => (
                  <a
                    key={`${link.uri}-${idx}`}
                    href={link.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white hover:bg-[#EAF0E2] border border-[#C5D2B7] text-xs font-semibold text-[#24371D] inline-flex items-center gap-1.5"
                  >
                    <MapPin className="w-3.5 h-3.5 text-[#2F4526]" />
                    <span>{link.title}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="rounded-2xl bg-[#F4F7EF] border border-[#CFD9C3] p-4 flex flex-col justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#182215]">
                Nearest Public Restrooms
              </p>
              <p className="mt-1 text-xs text-[#4B5844]">
                {hasCoords
                  ? 'Centered directly on your current GPS position'
                  : 'Opens Google Maps restroom finder for your area'}
              </p>
            </div>
            <a
              href={mapsSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white hover:bg-[#EAF0E2] border border-[#C5D2B7] text-[#24371D] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Open Directions in Maps</span>
            </a>
          </div>

          <div className="rounded-2xl bg-[#F4F7EF] border border-[#CFD9C3] p-4 flex flex-col justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#182215]">
                Safe Transit Hub Facilities
              </p>
              <p className="mt-1 text-xs text-[#4B5844]">
                Locate well-lit malls, metro hubs, and 24-hour facilities near you
              </p>
            </div>
            <a
              href={
                hasCoords
                  ? `https://www.google.com/maps/search/${encodeURIComponent(
                      'public toilet'
                    )}/@${geoLocation.latitude},${geoLocation.longitude},14z`
                  : `https://www.google.com/maps/search/${encodeURIComponent(
                      'public toilet near me'
                    )}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white hover:bg-[#EAF0E2] border border-[#C5D2B7] text-[#24371D] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Find Verified Locations</span>
            </a>
          </div>
        </div>
      )}
    </section>
  );
};
