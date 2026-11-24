import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  Map as GoogleMap,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  Navigation,
  Phone,
  Radio,
  ShieldAlert,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { GeoLocationState } from '../../types/safety';

interface LatLngPoint {
  lat: number;
  lng: number;
}

interface TravelRouteMapProps {
  startLocation: string;
  destination: string;
  isJourneyActive: boolean;
  geoLocation: GeoLocationState;
  guardianName?: string;
  guardianPhone?: string;
  vehicleNumber?: string;
  soundAllowed?: boolean;
  onRouteComputed?: (summary: {
    distanceKm: number;
    durationMin: number;
  }) => void;
  onOffRouteDetected?: (info: {
    distanceMeters: number;
    currentLat: number;
    currentLng: number;
    simulated: boolean;
  }) => void;
  onEscalateToSos?: (reason: string) => void;
}

const DEFAULT_CENTER: LatLngPoint = { lat: 13.0827, lng: 80.2707 };
const OFF_ROUTE_THRESHOLD_METERS = 200;

function parseGpsString(input: string): LatLngPoint | string {
  const cleaned = input.replace(/^gps\s*/i, '').trim();
  const match = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/.exec(cleaned);
  if (match) {
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (
      !Number.isNaN(lat) &&
      !Number.isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      return { lat, lng };
    }
  }
  return input.trim();
}

function haversineMeters(a: LatLngPoint, b: LatLngPoint): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function pointToSegmentDistanceMeters(
  p: LatLngPoint,
  a: LatLngPoint,
  b: LatLngPoint
): number {
  const latRad = (p.lat * Math.PI) / 180;
  const kx = 111320 * Math.cos(latRad);
  const ky = 110540;

  const px = p.lng * kx;
  const py = p.lat * ky;
  const ax = a.lng * kx;
  const ay = a.lat * ky;
  const bx = b.lng * kx;
  const by = b.lat * ky;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return haversineMeters(p, a);
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const proj: LatLngPoint = {
    lat: a.lat + t * (b.lat - a.lat),
    lng: a.lng + t * (b.lng - a.lng),
  };
  return haversineMeters(p, proj);
}

function minDistanceToPolylineMeters(
  point: LatLngPoint,
  path: LatLngPoint[]
): number {
  if (path.length === 0) return 0;
  if (path.length === 1) return haversineMeters(point, path[0]);
  let minMeters = Infinity;
  for (let i = 0; i < path.length - 1; i += 1) {
    const dist = pointToSegmentDistanceMeters(point, path[i], path[i + 1]);
    if (dist < minMeters) minMeters = dist;
  }
  return minMeters;
}

interface GmpLatLng {
  lat(): number;
  lng(): number;
}

interface GmpPolyline {
  setOptions(opts: Record<string, unknown>): void;
  setMap(map: unknown): void;
  getPath?: () => { getArray?: () => GmpLatLng[] };
}

interface GmpLatLngBounds {
  extend(point: LatLngPoint): void;
}

interface GmpWindowNamespace {
  google?: {
    maps?: {
      Polyline?: new (opts: Record<string, unknown>) => GmpPolyline;
      LatLngBounds?: new () => GmpLatLngBounds;
    };
  };
}

interface RouteOverlayProps {
  origin: string;
  destination: string;
  liveVehiclePos: LatLngPoint | null;
  isOffRoute: boolean;
  onRouteReady: (data: {
    path: LatLngPoint[];
    startPoint: LatLngPoint | null;
    endPoint: LatLngPoint | null;
    distanceKm: number;
    durationMin: number;
  }) => void;
  onRouteError: (msg: string) => void;
  onRouteLoading: (loading: boolean) => void;
}

const ModernRoutesLayer: React.FC<RouteOverlayProps> = ({
  origin,
  destination,
  liveVehiclePos,
  isOffRoute,
  onRouteReady,
  onRouteError,
  onRouteLoading,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<GmpPolyline[]>([]);
  const [startMarkerPos, setStartMarkerPos] = useState<LatLngPoint | null>(null);
  const [endMarkerPos, setEndMarkerPos] = useState<LatLngPoint | null>(null);

  const onRouteReadyRef = useRef(onRouteReady);
  const onRouteErrorRef = useRef(onRouteError);
  const onRouteLoadingRef = useRef(onRouteLoading);

  useEffect(() => {
    onRouteReadyRef.current = onRouteReady;
    onRouteErrorRef.current = onRouteError;
    onRouteLoadingRef.current = onRouteLoading;
  }, [onRouteReady, onRouteError, onRouteLoading]);

  useEffect(() => {
    if (!routesLib || !map || !origin.trim() || !destination.trim()) return;

    let cancelled = false;

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    onRouteErrorRef.current('');
    onRouteLoadingRef.current(true);

    const request = {
      origin: parseGpsString(origin),
      destination: parseGpsString(destination),
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs'],
    };

    const routeClass = (
      routesLib as unknown as {
        Route?: {
          computeRoutes?: (req: Record<string, unknown>) => Promise<{
            routes?: Array<{
              path?: Array<GmpLatLng | LatLngPoint>;
              distanceMeters?: number;
              durationMillis?: number;
              viewport?: GmpLatLngBounds;
              legs?: Array<{
                startLocation?: { latLng?: GmpLatLng };
                endLocation?: { latLng?: GmpLatLng };
              }>;
              createPolylines?: () => GmpPolyline[];
            }>;
          }>;
        };
      }
    ).Route;

    if (!routeClass || typeof routeClass.computeRoutes !== 'function') {
      onRouteLoadingRef.current(false);
      onRouteErrorRef.current(
        'Google Maps Routes library is initializing. Retry in a moment.'
      );
      return;
    }

    routeClass
      .computeRoutes(request)
      .then((response) => {
        if (cancelled) return;
        onRouteLoadingRef.current(false);

        const primaryRoute = response?.routes?.[0];
        if (!primaryRoute) {
          onRouteErrorRef.current(
            'Could not find a driving route between those two locations. Try adding the city name.'
          );
          return;
        }

        const extractedPath: LatLngPoint[] = [];
        const gmpWindow = window as unknown as GmpWindowNamespace;

        if (typeof primaryRoute.createPolylines === 'function') {
          const created = primaryRoute.createPolylines();
          created.forEach((poly) => {
            poly.setOptions({
              strokeColor: '#2F4526',
              strokeOpacity: 0.92,
              strokeWeight: 6,
            });
            poly.setMap(map);
            const pathArr = poly.getPath?.()?.getArray?.() ?? [];
            pathArr.forEach((pt: GmpLatLng) => {
              extractedPath.push({ lat: pt.lat(), lng: pt.lng() });
            });
          });
          polylinesRef.current = created;
        } else if (Array.isArray(primaryRoute.path)) {
          primaryRoute.path.forEach((pt) => {
            if (typeof (pt as GmpLatLng).lat === 'function') {
              extractedPath.push({
                lat: (pt as GmpLatLng).lat(),
                lng: (pt as GmpLatLng).lng(),
              });
            } else {
              const lit = pt as LatLngPoint;
              extractedPath.push({ lat: lit.lat, lng: lit.lng });
            }
          });
          if (extractedPath.length > 0 && gmpWindow.google?.maps?.Polyline) {
            const poly = new gmpWindow.google.maps.Polyline({
              path: extractedPath,
              geodesic: true,
              strokeColor: '#2F4526',
              strokeOpacity: 0.92,
              strokeWeight: 6,
              map,
            });
            polylinesRef.current = [poly];
          }
        }

        const startPoint =
          extractedPath[0] ??
          (primaryRoute.legs?.[0]?.startLocation?.latLng
            ? {
                lat: primaryRoute.legs[0].startLocation.latLng.lat(),
                lng: primaryRoute.legs[0].startLocation.latLng.lng(),
              }
            : null);

        const endPoint =
          extractedPath[extractedPath.length - 1] ??
          (primaryRoute.legs?.[0]?.endLocation?.latLng
            ? {
                lat: primaryRoute.legs[0].endLocation.latLng.lat(),
                lng: primaryRoute.legs[0].endLocation.latLng.lng(),
              }
            : null);

        setStartMarkerPos(startPoint);
        setEndMarkerPos(endPoint);

        const mapWithBounds = map as unknown as {
          fitBounds?: (bounds: GmpLatLngBounds, padding?: number) => void;
        };

        if (primaryRoute.viewport && typeof mapWithBounds.fitBounds === 'function') {
          mapWithBounds.fitBounds(primaryRoute.viewport, 48);
        } else if (
          startPoint &&
          endPoint &&
          gmpWindow.google?.maps?.LatLngBounds &&
          typeof mapWithBounds.fitBounds === 'function'
        ) {
          const bounds = new gmpWindow.google.maps.LatLngBounds();
          bounds.extend(startPoint);
          bounds.extend(endPoint);
          mapWithBounds.fitBounds(bounds, 48);
        }

        const distanceKm = Number(
          ((primaryRoute.distanceMeters ?? 0) / 1000).toFixed(2)
        );
        const durationMin = Math.max(
          1,
          Math.round((primaryRoute.durationMillis ?? 0) / 60000)
        );

        onRouteReadyRef.current({
          path: extractedPath,
          startPoint,
          endPoint,
          distanceKm,
          durationMin,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        onRouteLoadingRef.current(false);
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('OVER_QUERY_LIMIT') ||
          msg.includes('OverQuota') ||
          msg.includes('429')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onRouteErrorRef.current(
          'Unable to plot route for those addresses. Enter clearer street/city names or check connectivity.'
        );
      });

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [routesLib, map, origin, destination]);

  return (
    <>
      {startMarkerPos && (
        <AdvancedMarker position={startMarkerPos} title="Start Location">
          <Pin
            background="#2F4526"
            borderColor="#FFFFFF"
            glyphColor="#FFFFFF"
            glyph="A"
          />
        </AdvancedMarker>
      )}
      {endMarkerPos && (
        <AdvancedMarker position={endMarkerPos} title="Destination">
          <Pin
            background="#DC2626"
            borderColor="#FFFFFF"
            glyphColor="#FFFFFF"
            glyph="B"
          />
        </AdvancedMarker>
      )}
      {liveVehiclePos && (
        <AdvancedMarker
          position={liveVehiclePos}
          title={isOffRoute ? 'OFF-ROUTE VEHICLE ALERT' : 'Your Live Vehicle GPS'}
        >
          <div className="relative flex items-center justify-center">
            <span
              className={`absolute w-10 h-10 rounded-full animate-ping opacity-70 ${
                isOffRoute ? 'bg-red-500' : 'bg-emerald-500'
              }`}
            />
            <span
              className={`relative w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-extrabold text-white ${
                isOffRoute ? 'bg-red-600' : 'bg-emerald-600'
              }`}
            >
              {isOffRoute ? '!' : '●'}
            </span>
          </div>
        </AdvancedMarker>
      )}
    </>
  );
};

export const TravelRouteMap: React.FC<TravelRouteMapProps> = ({
  startLocation,
  destination,
  isJourneyActive,
  geoLocation,
  guardianName,
  guardianPhone,
  vehicleNumber,
  soundAllowed = true,
  onRouteComputed,
  onOffRouteDetected,
  onEscalateToSos,
}) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  const [routePath, setRoutePath] = useState<LatLngPoint[]>([]);
  const [routeSummary, setRouteSummary] = useState<{
    distanceKm: number;
    durationMin: number;
  } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');

  const [liveVehiclePos, setLiveVehiclePos] = useState<LatLngPoint | null>(
    geoLocation.latitude !== null && geoLocation.longitude !== null
      ? { lat: geoLocation.latitude, lng: geoLocation.longitude }
      : null
  );
  const [deviationMeters, setDeviationMeters] = useState<number>(0);
  const [isOffRoute, setIsOffRoute] = useState<boolean>(false);
  const [isSimulatedOffRoute, setIsSimulatedOffRoute] = useState<boolean>(false);
  const [alarmMuted, setAlarmMuted] = useState<boolean>(false);

  const lastAlertTimestampRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sirenTimerRef = useRef<number | null>(null);

  const stopDeviationTone = useCallback(() => {
    if (sirenTimerRef.current !== null) {
      window.clearInterval(sirenTimerRef.current);
      sirenTimerRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  const startDeviationTone = useCallback(() => {
    if (!soundAllowed || alarmMuted || sirenTimerRef.current !== null) return;
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctor();
      audioCtxRef.current = ctx;

      const beep = (freq: number) => {
        if (!audioCtxRef.current) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.38);
      };

      let high = true;
      beep(920);
      sirenTimerRef.current = window.setInterval(() => {
        high = !high;
        beep(high ? 920 : 680);
      }, 650);
    } catch {
      // Audio playback blocked before gesture
    }
  }, [soundAllowed, alarmMuted]);

  useEffect(() => {
    return () => stopDeviationTone();
  }, [stopDeviationTone]);

  useEffect(() => {
    if (isOffRoute && !alarmMuted) {
      startDeviationTone();
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate([300, 150, 300, 150, 400]);
        } catch {
          // ignore
        }
      }
    } else {
      stopDeviationTone();
    }
  }, [isOffRoute, alarmMuted, startDeviationTone, stopDeviationTone]);

  // Real-time GPS watchPosition during active Travel Mode
  useEffect(() => {
    if (!isJourneyActive || isSimulatedOffRoute || !('geolocation' in navigator)) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const pt: LatLngPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setLiveVehiclePos(pt);

        if (routePath.length >= 2) {
          const dist = Math.round(minDistanceToPolylineMeters(pt, routePath));
          setDeviationMeters(dist);
          if (dist > OFF_ROUTE_THRESHOLD_METERS) {
            setIsOffRoute(true);
            const now = Date.now();
            if (now - lastAlertTimestampRef.current > 20_000) {
              lastAlertTimestampRef.current = now;
              onOffRouteDetected?.({
                distanceMeters: dist,
                currentLat: pt.lat,
                currentLng: pt.lng,
                simulated: false,
              });
            }
          } else {
            setIsOffRoute(false);
          }
        }
      },
      () => {
        // Keep last known position if GPS temporarily fluctuates
      },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isJourneyActive, isSimulatedOffRoute, routePath, onOffRouteDetected]);

  const handleRouteReady = useCallback(
    (data: {
      path: LatLngPoint[];
      startPoint: LatLngPoint | null;
      endPoint: LatLngPoint | null;
      distanceKm: number;
      durationMin: number;
    }) => {
      setRoutePath(data.path);
      setRouteSummary({
        distanceKm: data.distanceKm,
        durationMin: data.durationMin,
      });
      if (data.startPoint && !liveVehiclePos) {
        setLiveVehiclePos(data.startPoint);
      }
      onRouteComputed?.({
        distanceKm: data.distanceKm,
        durationMin: data.durationMin,
      });
    },
    [liveVehiclePos, onRouteComputed]
  );

  const handleSimulateDeviation = () => {
    const midIdx = Math.floor(routePath.length / 2);
    const anchor = routePath[midIdx] ??
      liveVehiclePos ??
      (geoLocation.latitude !== null && geoLocation.longitude !== null
        ? { lat: geoLocation.latitude, lng: geoLocation.longitude }
        : DEFAULT_CENTER);

    // Offset ~460 meters perpendicular to the route corridor
    const deviatedPt: LatLngPoint = {
      lat: anchor.lat + 0.0042,
      lng: anchor.lng + 0.0021,
    };

    const dist =
      routePath.length >= 2
        ? Math.round(minDistanceToPolylineMeters(deviatedPt, routePath))
        : 480;

    setIsSimulatedOffRoute(true);
    setLiveVehiclePos(deviatedPt);
    setDeviationMeters(dist);
    setAlarmMuted(false);
    setIsOffRoute(true);
    onOffRouteDetected?.({
      distanceMeters: dist,
      currentLat: deviatedPt.lat,
      currentLng: deviatedPt.lng,
      simulated: true,
    });
  };

  const handleResetDeviation = () => {
    setIsSimulatedOffRoute(false);
    setIsOffRoute(false);
    setDeviationMeters(0);
    stopDeviationTone();
    if (routePath.length > 0) {
      setLiveVehiclePos(routePath[0]);
    }
  };

  const defaultCenter: LatLngPoint =
    geoLocation.latitude !== null && geoLocation.longitude !== null
      ? { lat: geoLocation.latitude, lng: geoLocation.longitude }
      : DEFAULT_CENTER;

  const hasBothLocations = Boolean(startLocation.trim() && destination.trim());

  const offRouteSmsBody = encodeURIComponent(
    `ROUTE DEVIATION ALERT from OurSafe! Vehicle moved ${deviationMeters}m OFF my Google Maps route (${startLocation} -> ${destination}).${
      vehicleNumber ? ` Vehicle: ${vehicleNumber}.` : ''
    }${
      liveVehiclePos
        ? ` Current GPS: https://maps.google.com/?q=${liveVehiclePos.lat.toFixed(
            6
          )},${liveVehiclePos.lng.toFixed(6)}`
        : ''
    }`
  );

  return (
    <section className="bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#3E5632]">
            Google Maps Live Route Guard · Off-Route Deviation Monitor
          </p>
          <h3 className="mt-1 text-lg sm:text-xl font-semibold text-[#182215]">
            Live Route &amp; Deviation Protection
          </h3>
          <p className="mt-0.5 text-xs text-[#4B5844]">
            Continuously compares your live GPS against the official Google Maps route. Alerts you and your guardian immediately if the vehicle moves more than {OFF_ROUTE_THRESHOLD_METERS}m off-route.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {routeSummary && (
            <div className="px-3 py-1.5 rounded-xl bg-[#EAF0E2] border border-[#C5D2B7] text-xs font-semibold text-[#24371D] font-mono tabular-nums">
              {routeSummary.distanceKm} km · ~{routeSummary.durationMin} min
            </div>
          )}

          {hasBothLocations && !isOffRoute && (
            <button
              type="button"
              onClick={handleSimulateDeviation}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
              <span>Test Off-Route Alert</span>
            </button>
          )}
        </div>
      </div>

      {/* Urgent Off-Route Deviation Alert Banner */}
      {isOffRoute && (
        <div
          role="alert"
          className="rounded-2xl bg-red-600 text-white p-4 sm:p-5 space-y-3.5 shadow-md"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-red-100">
                  Off-Route Deviation Alert · Vehicle Left Planned Route
                </p>
                <h4 className="text-lg font-extrabold mt-0.5">
                  Vehicle is {deviationMeters}m away from Google Maps route!
                </h4>
                <p className="text-xs text-red-50/95 mt-1 leading-relaxed">
                  {vehicleNumber ? `Logged Vehicle: ${vehicleNumber} · ` : ''}
                  Route guard detected an unexpected detour away from your{' '}
                  <strong>{destination}</strong> corridor.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAlarmMuted((m) => !m)}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              {alarmMuted ? (
                <>
                  <VolumeX className="w-4 h-4" />
                  <span>Unmute</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  <span>Mute Alarm</span>
                </>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onEscalateToSos && (
              <button
                type="button"
                onClick={() =>
                  onEscalateToSos(
                    `Off-Route Deviation (${deviationMeters}m off route to ${destination}${
                      vehicleNumber ? `, Vehicle ${vehicleNumber}` : ''
                    })`
                  )
                }
                className="min-h-[44px] px-4 py-2 rounded-xl bg-white hover:bg-red-50 text-red-700 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Escalate to SOS (Call Guardian + Police)</span>
              </button>
            )}

            {guardianPhone && (
              <a
                href={`sms:${guardianPhone.replace(/[^\d+]/g, '')}?body=${offRouteSmsBody}`}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-red-800 hover:bg-red-900 text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Phone className="w-4 h-4" />
                <span>SMS {guardianName || 'Guardian'} Live Location</span>
              </a>
            )}

            <button
              type="button"
              onClick={handleResetDeviation}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              I&apos;m Safe · Back on Route
            </button>
          </div>
        </div>
      )}

      {/* Route Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs rounded-2xl bg-[#F4F7EF] border border-[#D4DFC8] px-4 py-2.5">
        <div className="flex items-center gap-2 font-semibold text-[#182215]">
          {isOffRoute ? (
            <>
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span className="text-red-700">
                Off-Route Deviation Detected ({deviationMeters}m from corridor)
              </span>
            </>
          ) : isJourneyActive ? (
            <>
              <Radio className="w-4 h-4 text-emerald-600 animate-pulse shrink-0" />
              <span className="text-emerald-800">
                Live GPS Corridor Monitoring Active · On Planned Route
                {deviationMeters > 0 ? ` (${deviationMeters}m variance)` : ''}
              </span>
            </>
          ) : hasBothLocations ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-[#2F4526] shrink-0" />
              <span>
                Route plotted: {startLocation} → {destination}
              </span>
            </>
          ) : (
            <>
              <Compass className="w-4 h-4 text-[#2F4526] shrink-0" />
              <span>
                Enter Starting Location and Destination above to preview your live Google Maps route.
              </span>
            </>
          )}
        </div>

        {routeLoading && (
          <span className="text-[#3E5632] font-semibold">
            Computing Google Maps route...
          </span>
        )}
      </div>

      {routeError && (
        <p className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs font-medium text-amber-900">
          {routeError}
        </p>
      )}

      {/* Interactive Google Map Container (explicit height required by CF2) */}
      {apiKey ? (
        <div className="w-full h-[360px] sm:h-[420px] rounded-2xl overflow-hidden border border-[#B8C6A8] bg-[#E7EFE0]">
          <APIProvider apiKey={apiKey} language="en" region="IN">
            <GoogleMap
              defaultCenter={defaultCenter}
              defaultZoom={13}
              mapId="DEMO_MAP_ID"
              gestureHandling="greedy"
              streetViewControl={false}
              mapTypeControl={false}
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              style={{ width: '100%', height: '100%' }}
            >
              {hasBothLocations && (
                <ModernRoutesLayer
                  origin={startLocation}
                  destination={destination}
                  liveVehiclePos={liveVehiclePos}
                  isOffRoute={isOffRoute}
                  onRouteReady={handleRouteReady}
                  onRouteError={setRouteError}
                  onRouteLoading={setRouteLoading}
                />
              )}

              {!hasBothLocations && liveVehiclePos && (
                <AdvancedMarker
                  position={liveVehiclePos}
                  title="Your Current GPS Location"
                >
                  <Pin
                    background="#2F4526"
                    borderColor="#FFFFFF"
                    glyphColor="#FFFFFF"
                  />
                </AdvancedMarker>
              )}
            </GoogleMap>
          </APIProvider>
        </div>
      ) : (
        <div className="w-full h-[260px] rounded-2xl border border-[#C5D2B7] bg-[#F4F7EF] flex flex-col items-center justify-center p-6 text-center space-y-2.5">
          <Navigation className="w-8 h-8 text-[#2F4526]" />
          <p className="text-sm font-bold text-[#182215]">
            Google Maps API Key Pending Reload
          </p>
          <p className="text-xs text-[#4B5844] max-w-md">
            Your Google Maps key is provisioned via environment secrets. Restart or refresh the app preview once secrets sync to display the live interactive Google Maps corridor.
          </p>
        </div>
      )}
    </section>
  );
};
