import React from 'react';
import { Phone, Shield } from 'lucide-react';
import { GeoLocationState, NearbyPoliceAiResult } from '../../types/safety';
import { NearbyLocationsSection } from '../dashboard/NearbyLocationsSection';

interface NearbyPageProps {
  geoLocation: GeoLocationState;
  initialCategory: 'police' | 'restrooms';
  isOnline: boolean;
  nearbyPoliceResult: NearbyPoliceAiResult | null;
  nearbyPoliceLoading: boolean;
  nearbyPoliceError: string;
  onFetchNearbyPoliceAi: (areaQuery?: string) => void;
  onRequestLocation: () => void;
}

export const NearbyPage: React.FC<NearbyPageProps> = ({
  geoLocation,
  initialCategory,
  isOnline,
  nearbyPoliceResult,
  nearbyPoliceLoading,
  nearbyPoliceError,
  onFetchNearbyPoliceAi,
  onRequestLocation,
}) => {
  return (
    <div className="space-y-6">
      <section className="bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div>
          <p className="text-xs font-semibold text-[#3E5632]">
            Nearby Safe Places · Live AI &amp; Maps Lookup
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[#182215]">
            Police Stations &amp; Public Restrooms
          </h1>
          <p className="mt-1 text-xs text-[#4B5844] max-w-2xl">
            Find nearby police station phone numbers with AI Maps Grounding or open verified directions centered on your live GPS.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="tel:100"
            className="min-h-[42px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Call Police (100)</span>
          </a>
          <a
            href="tel:112"
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] text-[#24371D] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Shield className="w-3.5 h-3.5 text-[#2F4526]" />
            <span>Emergency (112)</span>
          </a>
        </div>
      </section>

      <NearbyLocationsSection
        geoLocation={geoLocation}
        isOnline={isOnline}
        nearbyPoliceResult={nearbyPoliceResult}
        nearbyPoliceLoading={nearbyPoliceLoading}
        nearbyPoliceError={nearbyPoliceError}
        onFetchNearbyPoliceAi={onFetchNearbyPoliceAi}
        onRequestLocation={onRequestLocation}
        initialCategory={initialCategory}
      />
    </div>
  );
};
