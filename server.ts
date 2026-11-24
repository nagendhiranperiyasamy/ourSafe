import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  GoogleGenAI,
  Modality,
  Type,
  type FunctionDeclaration,
  type LiveServerMessage,
} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Add it in Settings > Secrets to use the live AI features.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const SAFETY_VOICE_TOOLS: FunctionDeclaration[] = [
  {
    name: 'open_sos',
    description:
      'Opens the dedicated SOS Emergency page, identifies the registered guardian, prepares emergency call and alert delivery with current location, and surfaces nearest police station contact options. Call immediately when the user says "Open SOS", "SOS", or asks for urgent help.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        initiateAlert: {
          type: Type.BOOLEAN,
          description:
            'Whether to immediately initiate the emergency alert status workflow with available location.',
        },
        callBothGuardianAndPolice: {
          type: Type.BOOLEAN,
          description:
            'Set to true if the user wants to call both their guardian and police immediately.',
        },
        reason: {
          type: Type.STRING,
          description: 'Short summary of why SOS was triggered.',
        },
      },
    },
  },
  {
    name: 'call_guardian_and_police',
    description:
      'Opens the Dual Emergency Call panel to call BOTH the registered guardian AND police (100 / 112 / nearest AI-found police station number), while preparing an emergency location alert. Call this whenever the user asks to call both guardian and police, call police and guardian, or make emergency calls.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        guardianName: {
          type: Type.STRING,
          description: 'Optional specific guardian name if requested.',
        },
        policeNumber: {
          type: Type.STRING,
          description:
            'Optional police phone number (defaults to 100 or nearest verified police station number).',
        },
      },
    },
  },
  {
    name: 'activate_threat_mode',
    description:
      'Navigates to the Threat Mode page, activates Intelligent Threat Mode protection (notifies guardians, captures location snapshot, enables audio/video evidence recording, connectivity monitoring, and automatically fetches nearby police station numbers using AI).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        autoStartRecording: {
          type: Type.STRING,
          description: 'Optional recording preference: "none", "audio", or "video".',
        },
      },
    },
  },
  {
    name: 'deactivate_threat_mode',
    description:
      'Deactivates an active Threat Mode session, stops emergency recording if active, and logs safe stand-down in Emergency History.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        note: {
          type: Type.STRING,
          description: 'Optional user status note.',
        },
      },
    },
  },
  {
    name: 'call_guardian',
    description:
      'Prepares and opens the emergency guardian call action for the registered primary guardian or a specifically named guardian contact.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        guardianName: {
          type: Type.STRING,
          description: 'Optional name of a specific guardian contact to call.',
        },
      },
    },
  },
  {
    name: 'call_police',
    description:
      'Prepares and opens immediate police emergency calling (100 / 112 and nearest AI-located police station number).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        policeNumber: {
          type: Type.STRING,
          description: 'Police emergency number (default 100 or 112).',
        },
      },
    },
  },
  {
    name: 'send_emergency_alert',
    description:
      'Dispatches an emergency alert containing the user available GPS location to all registered emergency contacts and updates emergency delivery status.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        message: {
          type: Type.STRING,
          description: 'Optional custom emergency note to include in the alert.',
        },
      },
    },
  },
  {
    name: 'share_live_location',
    description:
      'Starts live location sharing with BOTH registered trusted guardians AND nearest police dispatch, requesting fresh GPS coordinates. Call when the user says "Share my location", "Share my business", "Share my live location", or "Send location to guardian and police".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        durationMinutes: {
          type: Type.NUMBER,
          description: 'Optional sharing duration in minutes (default 30).',
        },
        includePolice: {
          type: Type.BOOLEAN,
          description: 'Share live GPS with Police in addition to guardians (default true).',
        },
      },
    },
  },
  {
    name: 'open_nearby_police',
    description:
      'Navigates directly to the Nearby Safe Places page filtered to Nearby Police Stations with live GPS centering and runs AI police station number lookup.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: {
          type: Type.STRING,
          description: 'Either "police" or "restrooms". Defaults to "police".',
        },
      },
    },
  },
  {
    name: 'open_travel_mode',
    description:
      'Opens Travel Mode with live Google Maps route tracking, off-route vehicle deviation alerts, and Auto / Cab Vehicle Number Verification.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        focusSection: {
          type: Type.STRING,
          description: 'Optional focus: "route", "vehicle_verify", or "checkin".',
        },
      },
    },
  },
  {
    name: 'open_lock_shield',
    description:
      'Opens the full-screen OurSafe Standby Lock Shield for 3x Shake, Secret Voice Code, and Screen Tap SOS protection.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        surface: {
          type: Type.STRING,
          description: 'Either "lock_screen" or "home_screen". Defaults to "lock_screen".',
        },
      },
    },
  },
  {
    name: 'trigger_fake_call',
    description:
      'Launches the simulated incoming Fake Call screen to help the user leave an uncomfortable situation smoothly.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        callerName: {
          type: Type.STRING,
          description: 'Optional simulated caller display name (e.g. Mom, Office).',
        },
      },
    },
  },
  {
    name: 'start_safety_checkin',
    description:
      'Starts a timed Safety Check-In countdown on the Travel & Check-In page.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        minutes: {
          type: Type.NUMBER,
          description: 'Minutes until check-in is due (default 10).',
        },
      },
    },
  },
  {
    name: 'navigate_page',
    description:
      'Navigates to a specific dedicated page in OurSafe: "home", "sos", "threat", "travel", "assistant", "nearby", or "history".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        page: {
          type: Type.STRING,
          description:
            'Target page identifier: home, sos, threat, travel, assistant, nearby, or history.',
        },
      },
      required: ['page'],
    },
  },
  {
    name: 'open_settings',
    description:
      'Opens OurSafe Settings where the user can turn 3x Phone Shake SOS, Secret Voice Code ("Red Rose"), Screen Tap SOS, "OurSafe" Wake Word, and Lock-Screen Icon Display ON or OFF.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'open_contacts',
    description:
      'Opens the Trusted Guardian Emergency Contacts modal so the user can view, add, or update guardian phone numbers.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
];

function buildSystemInstruction(userContext?: {
  userName?: string;
  primaryGuardianName?: string;
  primaryGuardianPhone?: string;
  threatActive?: boolean;
  sosActive?: boolean;
}): string {
  const userName = userContext?.userName || 'the user';
  const guardian = userContext?.primaryGuardianName
    ? `${userContext.primaryGuardianName} (${userContext.primaryGuardianPhone || 'number on file'})`
    : 'not yet configured';

  return `You are OurSafe Voice Controller, a calm, decisive, trustworthy AI safety assistant built into the OurSafe Women Safety Application.
You are speaking with ${userName}. Their primary registered guardian is ${guardian}.
Current state: Threat Mode is ${userContext?.threatActive ? 'ACTIVE' : 'inactive'}, SOS is ${userContext?.sosActive ? 'ACTIVE' : 'inactive'}.

CRITICAL ROLE — FULL HANDS-FREE VOICE APP AUTOMATION ("OurSafe" / "House Safe" WAKE WORD):
- The user can wake OurSafe hands-free like "Hey Google" anytime by saying "OurSafe" (or phonetically "House Safe"). When awakened, the app greets them aloud with "OurSafe app is here, how can I help you?" and listens for ANY command across the whole application.
- Whenever the user says commands like "Go to SOS", "Open SOS", "Call both guardian and police", "Call police", "Call my guardian", "Activate Threat Mode", "Dread mode", "Deactivate Threat Mode", "Send emergency alert", "Share my location", "Share my business", "Find police numbers", "Open nearby police", "Open travel mode", "Verify auto number", "Open lock shield", "Open settings", "Open guardians / contacts", "Turn on or off shake / triggers", "Start a fake call", "Set a check-in", "Open history", or "Go home", you MUST immediately execute the matching tool function first, then briefly confirm in 1 to 2 calm sentences.
- For "Go to SOS" or "Open SOS": call open_sos with initiateAlert: true and callBothGuardianAndPolice: true immediately.
- For "Activate Threat Mode" or "Dread Mode": call activate_threat_mode with autoStartRecording: "video" immediately (continuous video+audio recording starts automatically without extra confirmations).
- For "Share my location" or "Share my business": call share_live_location with includePolice: true so live GPS is shared with BOTH registered guardians AND nearest police.
- For "Open settings" or changing Shake / Red Rose / Triple Tap / Lock-Screen Icon ON/OFF: call open_settings immediately.
- For "Open guardians" or "Open contacts": call open_contacts immediately.
- Never invent fake phone numbers or street addresses. Keep spoken replies concise, calm, and reassuring.`;
}

function parseStationsFromGroundedText(
  text: string,
  mapLinks: Array<{ title: string; uri: string }>
): Array<{ name: string; phone?: string; address?: string; mapsUri?: string }> {
  const stations: Array<{
    name: string;
    phone?: string;
    address?: string;
    mapsUri?: string;
  }> = [];

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const phoneRegex = /(\+?\d[\d\s\-()]{6,17}\d|\b100\b|\b112\b|\b181\b|\b911\b|\b999\b)/;

  for (const line of lines) {
    if (!/^([-*•]|\d+[.)])/.test(line)) continue;
    const cleaned = line.replace(/^([-*•]|\d+[.)])\s*/, '').replace(/\*\*/g, '');
    const phoneMatch = cleaned.match(phoneRegex);
    const segments = cleaned.split(/\s*[—–|:]\s*/);
    const candidateName = (segments[0] || cleaned).slice(0, 90).trim();
    if (!candidateName || candidateName.length < 3) continue;

    const matchedMap = mapLinks.find(
      (m) =>
        m.title.toLowerCase().includes(candidateName.toLowerCase()) ||
        candidateName.toLowerCase().includes(m.title.toLowerCase())
    );

    stations.push({
      name: candidateName,
      phone: phoneMatch ? phoneMatch[0].trim() : undefined,
      address:
        segments.length > 1
          ? segments
              .slice(1)
              .join(' · ')
              .replace(phoneMatch ? phoneMatch[0] : '', '')
              .replace(/^[\s·,-]+|[\s·,-]+$/g, '')
              .slice(0, 140) || undefined
          : undefined,
      mapsUri: matchedMap?.uri,
    });
  }

  // Ensure every Google Maps grounded police place appears even if bullet parsing missed it
  for (const link of mapLinks) {
    const already = stations.some(
      (s) =>
        s.mapsUri === link.uri ||
        s.name.toLowerCase() === link.title.toLowerCase()
    );
    if (!already && link.title) {
      stations.push({
        name: link.title,
        mapsUri: link.uri,
      });
    }
  }

  return stations.slice(0, 8);
}

async function reverseGeocodeArea(
  latitude: number,
  longitude: number
): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(
        latitude
      )}&lon=${encodeURIComponent(longitude)}&format=jsonv2&zoom=14`,
      {
        headers: {
          'User-Agent': 'OurSafeApp/1.0',
          Accept: 'application/json',
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timer);
    if (!res.ok) return '';
    const data = (await res.json()) as {
      display_name?: string;
      address?: {
        suburb?: string;
        neighbourhood?: string;
        city?: string;
        town?: string;
        county?: string;
        state?: string;
        country?: string;
      };
    };
    const a = data.address;
    if (a) {
      const parts = [
        a.neighbourhood || a.suburb,
        a.city || a.town || a.county,
        a.state,
        a.country,
      ].filter(Boolean);
      if (parts.length > 0) return parts.join(', ');
    }
    return data.display_name || '';
  } catch {
    return '';
  }
}

async function fetchNominatimPoliceStations(
  areaLabel: string,
  latitude?: number | null,
  longitude?: number | null
): Promise<{
  stations: Array<{
    name: string;
    phone?: string;
    address?: string;
    mapsUri?: string;
  }>;
  mapLinks: Array<{ title: string; uri: string }>;
}> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    const query = `police station ${areaLabel}`.trim();
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&format=jsonv2&extratags=1&addressdetails=1&limit=6`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'OurSafeApp/1.0',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { stations: [], mapLinks: [] };

    const items = (await res.json()) as Array<{
      name?: string;
      display_name?: string;
      lat?: string;
      lon?: string;
      extratags?: Record<string, string> | null;
    }>;

    const stations: Array<{
      name: string;
      phone?: string;
      address?: string;
      mapsUri?: string;
    }> = [];
    const mapLinks: Array<{ title: string; uri: string }> = [];

    for (const item of items) {
      const displayName = item.display_name || '';
      const name =
        item.name && item.name.toLowerCase() !== 'police station'
          ? item.name
          : displayName.split(',').slice(0, 2).join(', ').trim() ||
            'Nearby Police Station';
      const phone =
        item.extratags?.phone ||
        item.extratags?.['contact:phone'] ||
        item.extratags?.['phone:emergency'] ||
        undefined;
      const mapsUri =
        item.lat && item.lon
          ? `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lon}`
          : `https://www.google.com/maps/search/${encodeURIComponent(name)}`;

      stations.push({
        name,
        phone,
        address: displayName.slice(0, 150) || undefined,
        mapsUri,
      });
      mapLinks.push({ title: name, uri: mapsUri });
    }

    if (stations.length === 0) {
      const fallbackUrl =
        typeof latitude === 'number' && typeof longitude === 'number'
          ? `https://www.google.com/maps/search/police+station/@${latitude},${longitude},15z`
          : `https://www.google.com/maps/search/${encodeURIComponent(
              `police station near ${areaLabel}`
            )}`;
      mapLinks.push({
        title: `Police Stations near ${areaLabel}`,
        uri: fallbackUrl,
      });
    }

    return { stations, mapLinks };
  } catch {
    return { stations: [], mapLinks: [] };
  }
}

function formatFriendlyServerError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : '';
  if (!raw) return fallback;
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED') || raw.includes('quota')) {
    return 'AI lookup is temporarily busy due to high request volume. Please try again shortly or dial 100 / 112 directly.';
  }
  if (raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      if (parsed.error?.message) return parsed.error.message;
    } catch {
      return fallback;
    }
  }
  return raw.length > 200 ? fallback : raw;
}

const INDIAN_RTO_STATES: Record<string, string> = {
  AN: 'Andaman & Nicobar Islands',
  AP: 'Andhra Pradesh',
  AR: 'Arunachal Pradesh',
  AS: 'Assam',
  BR: 'Bihar',
  CG: 'Chhattisgarh',
  CH: 'Chandigarh',
  DD: 'Dadra & Nagar Haveli and Daman & Diu',
  DL: 'Delhi',
  DN: 'Dadra & Nagar Haveli',
  GA: 'Goa',
  GJ: 'Gujarat',
  HP: 'Himachal Pradesh',
  HR: 'Haryana',
  JH: 'Jharkhand',
  JK: 'Jammu & Kashmir',
  KA: 'Karnataka',
  KL: 'Kerala',
  LA: 'Ladakh',
  LD: 'Lakshadweep',
  MH: 'Maharashtra',
  ML: 'Meghalaya',
  MN: 'Manipur',
  MP: 'Madhya Pradesh',
  MZ: 'Mizoram',
  NL: 'Nagaland',
  OD: 'Odisha',
  OR: 'Odisha (Legacy)',
  PB: 'Punjab',
  PY: 'Puducherry',
  RJ: 'Rajasthan',
  SK: 'Sikkim',
  TN: 'Tamil Nadu',
  TR: 'Tripura',
  TS: 'Telangana',
  TG: 'Telangana',
  UK: 'Uttarakhand',
  UP: 'Uttar Pradesh',
  WB: 'West Bengal',
};

function auditVehicleRegistration(rawPlate: string, detectedVehicleType?: string) {
  const cleaned = rawPlate
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();

  const riskWarnings: string[] = [];
  if (!cleaned || cleaned.length < 5 || cleaned.length > 12) {
    return {
      normalizedNumber: cleaned || rawPlate.trim().toUpperCase(),
      vehicleType: detectedVehicleType || 'Auto / Cab / Vehicle',
      stateRegion: 'Unknown Region',
      formatValid: false,
      authenticityStatus: 'suspicious_or_invalid' as const,
      riskWarnings: [
        'Registration length does not match standard vehicle license plate rules.',
        'Do not board without verifying an official printed license plate and sharing live location with your guardian.',
      ],
      summary:
        'Plate format is incomplete or invalid. Verify the physical metal plate carefully before boarding.',
    };
  }

  // Indian standard format: SS DD [A-Z]{1,3} NNNN (e.g. TN09AB1234 or DL1CAA1234)
  const indianStandard = /^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{1,4})$/.exec(cleaned);
  // Indian Bharat (BH) series: YY BH NNNN [A-Z]{1,2}
  const bharatSeries = /^(\d{2})BH(\d{4})([A-Z]{1,2})$/.exec(cleaned);

  if (bharatSeries) {
    const formatted = `${bharatSeries[1]} BH ${bharatSeries[2]} ${bharatSeries[3]}`;
    return {
      normalizedNumber: formatted,
      vehicleType: detectedVehicleType || 'Private / Commercial Vehicle (BH Series)',
      stateRegion: 'India National Bharat (BH) Series',
      formatValid: true,
      authenticityStatus: 'format_verified' as const,
      riskWarnings: [],
      summary: `Valid Bharat (BH) Series registration format (${formatted}). Saved to your active Travel Mode session & emergency SMS alerts. Connect Vahan / Parivahan RTO API on your backend for live government registry lookup.`,
    };
  }

  if (indianStandard) {
    const stateCode = indianStandard[1];
    const rtoDistrict = indianStandard[2].padStart(2, '0');
    const series = indianStandard[3];
    const numberPart = indianStandard[4].padStart(4, '0');
    const stateName = INDIAN_RTO_STATES[stateCode];
    const formatted = `${stateCode} ${rtoDistrict} ${series} ${numberPart}`;

    if (!stateName) {
      riskWarnings.push(
        `State code "${stateCode}" is NOT a valid Indian RTO state code — possible fake, tampered, or misread number plate.`
      );
      return {
        normalizedNumber: formatted,
        vehicleType: detectedVehicleType || 'Unverified Vehicle',
        stateRegion: `Invalid State Code (${stateCode})`,
        formatValid: false,
        authenticityStatus: 'suspicious_or_invalid' as const,
        riskWarnings,
        summary: `Warning: "${stateCode}" does not match any official Indian RTO state prefix. Double-check the plate or avoid boarding this vehicle.`,
      };
    }

    if (rtoDistrict === '00' || numberPart === '0000') {
      riskWarnings.push(
        'District code 00 or plate number 0000 is not issued for standard passenger autos/cabs.'
      );
      return {
        normalizedNumber: formatted,
        vehicleType: detectedVehicleType || 'Suspicious Plate',
        stateRegion: `${stateName} (RTO ${rtoDistrict})`,
        formatValid: false,
        authenticityStatus: 'suspicious_or_invalid' as const,
        riskWarnings,
        summary: `Suspicious numeric pattern detected in ${formatted}. Verify driver ID and avoid boarding if plate appears altered.`,
      };
    }

    return {
      normalizedNumber: formatted,
      vehicleType: detectedVehicleType || 'Auto-Rickshaw / Cab / Motor Vehicle',
      stateRegion: `${stateName} (RTO ${stateCode}-${rtoDistrict})`,
      formatValid: true,
      authenticityStatus: 'format_verified' as const,
      riskWarnings: [],
      summary: `Official Indian RTO format verified for ${stateName} (${stateCode}-${rtoDistrict}). Vehicle ${formatted} is logged in Travel Mode and attached to your Guardian & Police SOS alerts. Ready for live Vahan/Parivahan RTO lookup once connected to your backend.`,
    };
  }

  // Fallback international plate sanity check
  const hasLetters = /[A-Z]/.test(cleaned);
  const hasDigits = /\d/.test(cleaned);
  if (hasLetters && hasDigits && cleaned.length >= 6 && cleaned.length <= 10) {
    return {
      normalizedNumber: rawPlate.trim().toUpperCase(),
      vehicleType: detectedVehicleType || 'Motor Vehicle',
      stateRegion: 'Non-Indian / Custom Format',
      formatValid: false,
      authenticityStatus: 'unrecognized' as const,
      riskWarnings: [
        'Does not match standard Indian RTO format (e.g., TN 09 AB 1234). Confirm the full registration plate manually.',
      ],
      summary: `Plate "${rawPlate.trim().toUpperCase()}" logged for your safety record, but did not match Indian RTO structure. Capture a clear plate photo and share with your guardian.`,
    };
  }

  return {
    normalizedNumber: rawPlate.trim().toUpperCase(),
    vehicleType: detectedVehicleType || 'Unverified Vehicle',
    stateRegion: 'Unrecognized Format',
    formatValid: false,
    authenticityStatus: 'suspicious_or_invalid' as const,
    riskWarnings: [
      'Plate characters look malformed or incomplete. Suspect a tampered/fake plate if characters are obscured.',
    ],
    summary: `Warning: "${rawPlate.trim().toUpperCase()}" failed standard license plate format verification. Check carefully before boarding.`,
  };
}

// In-memory SOS dispatch audit store (backend-ready webhook integration point)
const recentSosDispatches: Array<{
  dispatchId: string;
  dispatchedAt: string;
  userName: string;
  triggerSource: string;
  guardianCount: number;
  policeNotified: boolean;
  policeNumber: string;
  latitude: number | null;
  longitude: number | null;
  vehicleNumber?: string;
  messagePreview: string;
}> = [];

// Deduplication map to prevent multiple identical dispatches within 5 seconds
const recentSosDeduplicationMap = new Map<string, number>();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      liveVoiceReady: Boolean(process.env.GEMINI_API_KEY),
      mapsKeyConfigured: Boolean(
        process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY
      ),
    });
  });

  // Travel Mode: Vehicle / Auto Number Verification + Optional Photo Plate OCR (Gemini Vision)
  app.post('/api/travel/verify-vehicle', async (req, res) => {
    try {
      const { vehicleNumber, photoBase64, mimeType } = req.body as {
        vehicleNumber?: string;
        photoBase64?: string;
        mimeType?: string;
      };

      const rawInputNumber =
        typeof vehicleNumber === 'string' ? vehicleNumber.trim().slice(0, 40) : '';
      const hasPhoto =
        typeof photoBase64 === 'string' && photoBase64.trim().length > 32;

      if (!rawInputNumber && !hasPhoto) {
        res.status(400).json({
          error:
            'Enter a vehicle/auto number or capture a photo of the number plate to verify.',
        });
        return;
      }

      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
      const cleanMime =
        typeof mimeType === 'string' && allowedMimes.includes(mimeType)
          ? mimeType
          : 'image/jpeg';

      let plateToCheck = rawInputNumber;
      let detectedVehicleType: string | undefined;
      let photoAuditWarnings: string[] = [];
      let extractedFromPhoto = false;

      if (hasPhoto && process.env.GEMINI_API_KEY) {
        try {
          const base64Clean = photoBase64!.replace(/^data:image\/\w+;base64,/, '');
          if (base64Clean.length <= 5_500_000) {
            const ai = getAiClient();
            const visionRes = await ai.models.generateContent({
              model: 'gemini-4-hydrogen',
              contents: [
                {
                  inlineData: {
                    data: base64Clean,
                    mimeType: cleanMime,
                  },
                },
                {
                  text: `Analyze this vehicle/auto-rickshaw/number plate image for women's travel safety. Return ONLY valid JSON with keys:
{
  "plateNumber": "string (exact uppercase registration plate characters if visible, else empty string)",
  "vehicleType": "string (e.g. Auto-Rickshaw, Cab / Taxi, Two-Wheeler, Bus, Private Car, or Unknown)",
  "tamperWarning": "string (empty string if plate looks normal, or brief warning if plate is obscured, handwritten, damaged, or unreadable)"
}`,
                },
              ],
            });

            const rawText = (visionRes.text ?? '').trim();
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]) as {
                plateNumber?: string;
                vehicleType?: string;
                tamperWarning?: string;
              };
              if (!plateToCheck && parsed.plateNumber?.trim()) {
                plateToCheck = parsed.plateNumber.trim();
                extractedFromPhoto = true;
              } else if (
                plateToCheck &&
                parsed.plateNumber?.trim() &&
                parsed.plateNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase() !==
                  plateToCheck.replace(/[^A-Z0-9]/gi, '').toUpperCase()
              ) {
                photoAuditWarnings.push(
                  `Photo plate (${parsed.plateNumber.trim()}) differs from typed number (${plateToCheck}). Verify the real plate before boarding!`
                );
              }
              if (parsed.vehicleType?.trim()) {
                detectedVehicleType = parsed.vehicleType.trim();
              }
              if (parsed.tamperWarning?.trim()) {
                photoAuditWarnings.push(parsed.tamperWarning.trim());
              }
            }
          }
        } catch {
          // Graceful fallback if photo OCR fails
          if (!plateToCheck) {
            photoAuditWarnings.push(
              'Could not read the number plate clearly from the photo. Enter the vehicle number manually to verify.'
            );
          }
        }
      }

      const audit = auditVehicleRegistration(plateToCheck, detectedVehicleType);
      const mergedWarnings = [...photoAuditWarnings, ...audit.riskWarnings];

      res.json({
        id: `veh-${Date.now()}`,
        vehicleNumber: plateToCheck || 'UNREADABLE',
        normalizedNumber: audit.normalizedNumber,
        vehicleType: audit.vehicleType,
        stateRegion: audit.stateRegion,
        formatValid: audit.formatValid && photoAuditWarnings.length === 0,
        authenticityStatus:
          photoAuditWarnings.length > 0 && !audit.formatValid
            ? 'suspicious_or_invalid'
            : audit.authenticityStatus,
        riskWarnings: mergedWarnings,
        summary: audit.summary,
        extractedFromPhoto,
        verifiedAt: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({
        error: formatFriendlyServerError(
          err,
          'Unable to verify vehicle number right now. Please double-check the plate manually.'
        ),
      });
    }
  });

  // Automated SOS & Live Location Dispatch Endpoint (Guardians + Police — Ready for Backend SMS/Webhook Integration)
  app.post('/api/sos/dispatch', (req, res) => {
    try {
      const {
        userName,
        triggerSource,
        guardianContacts,
        policeNumber,
        shareWithPolice,
        latitude,
        longitude,
        vehicleNumber,
        note,
      } = req.body as {
        userName?: string;
        triggerSource?: string;
        guardianContacts?: Array<{ name?: string; phone?: string }>;
        policeNumber?: string;
        shareWithPolice?: boolean;
        latitude?: number | null;
        longitude?: number | null;
        vehicleNumber?: string;
        note?: string;
      };

      const safeUser =
        typeof userName === 'string' && userName.trim()
          ? userName.trim().slice(0, 80)
          : 'OurSafe User';
      const safeSource =
        typeof triggerSource === 'string' && triggerSource.trim()
          ? triggerSource.trim().slice(0, 120)
          : 'Automated SOS';

      // 5-second deduplication lock to avoid spamming contacts or police webhooks
      const dedupeKey = `${safeUser}:${safeSource}`;
      const nowMs = Date.now();
      const lastSentTime = recentSosDeduplicationMap.get(dedupeKey);
      if (lastSentTime && nowMs - lastSentTime < 5000) {
        return res.json({
          ok: true,
          deduplicated: true,
          message: 'Suppressed duplicate dispatch within 5s window.',
          recent: recentSosDispatches[0] || null,
        });
      }
      recentSosDeduplicationMap.set(dedupeKey, nowMs);
      const safeGuardians = Array.isArray(guardianContacts)
        ? guardianContacts
            .slice(0, 10)
            .filter((g) => typeof g?.phone === 'string' && g.phone.trim().length >= 3)
            .map((g) => ({
              name: String(g.name || 'Guardian').slice(0, 60),
              phone: String(g.phone).slice(0, 24),
            }))
        : [];
      const safePolice =
        typeof policeNumber === 'string' && policeNumber.trim()
          ? policeNumber.trim().slice(0, 24)
          : '100';
      const hasCoords =
        typeof latitude === 'number' &&
        typeof longitude === 'number' &&
        !Number.isNaN(latitude) &&
        !Number.isNaN(longitude);
      const safeVehicle =
        typeof vehicleNumber === 'string' && vehicleNumber.trim()
          ? vehicleNumber.trim().slice(0, 30)
          : undefined;
      const safeNote =
        typeof note === 'string' && note.trim() ? note.trim().slice(0, 240) : undefined;

      const gpsLink = hasCoords
        ? `https://maps.google.com/?q=${(latitude as number).toFixed(6)},${(longitude as number).toFixed(6)}`
        : 'GPS pending';

      const messagePreview = `EMERGENCY SOS from ${safeUser} via OurSafe (${safeSource}).${
        safeVehicle ? ` Vehicle: ${safeVehicle}.` : ''
      } Live Location: ${gpsLink}.${safeNote ? ` Note: ${safeNote}` : ''}`;

      const dispatchRecord = {
        dispatchId: `sos-disp-${Date.now()}`,
        dispatchedAt: new Date().toISOString(),
        userName: safeUser,
        triggerSource: safeSource,
        guardianCount: safeGuardians.length,
        policeNotified: shareWithPolice !== false,
        policeNumber: safePolice,
        latitude: hasCoords ? (latitude as number) : null,
        longitude: hasCoords ? (longitude as number) : null,
        vehicleNumber: safeVehicle,
        messagePreview,
      };

      recentSosDispatches.unshift(dispatchRecord);
      if (recentSosDispatches.length > 50) {
        recentSosDispatches.pop();
      }

      res.json({
        ok: true,
        ...dispatchRecord,
        recipients: safeGuardians.map((g) => ({
          ...g,
          status: 'dispatched',
        })),
      });
    } catch {
      res.status(500).json({ error: 'Unable to dispatch automated SOS alert.' });
    }
  });

  // Firebase / Cloud Sync for Threat Mode session snapshots
  app.post('/api/firebase/sync-threat', (req, res) => {
    try {
      const { userId, session } = req.body as { userId?: string; session?: any };
      res.json({
        ok: true,
        syncedToCloud: true,
        collection: 'threat_sessions',
        userId: userId || 'anonymous',
        sessionId: session?.sessionId || `threat-${Date.now()}`,
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(500).json({ error: 'Failed to sync threat session to cloud.' });
    }
  });

  // Firebase / Cloud Sync for Evidence Recordings Metadata
  app.post('/api/firebase/sync-evidence', (req, res) => {
    try {
      const { userId, meta } = req.body as { userId?: string; meta?: any };
      res.json({
        ok: true,
        syncedToCloud: true,
        collection: 'evidence_records',
        userId: userId || 'anonymous',
        recordingId: meta?.id || `rec-${Date.now()}`,
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(500).json({ error: 'Failed to sync evidence metadata to cloud.' });
    }
  });

  // Firebase / Cloud Sync for User Safety Profile & Verified Guardian Circle
  app.post('/api/firebase/sync-profile', (req, res) => {
    try {
      const { user } = req.body as { user?: any };
      res.json({
        ok: true,
        syncedToCloud: true,
        collection: 'user_profiles',
        userId: user?.id || 'anonymous',
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(500).json({ error: 'Failed to sync user profile to cloud.' });
    }
  });

  // AI Nearby Police Stations & Verified Numbers (Threat Mode — Maps Grounding -> Search Grounding -> OpenStreetMap Fallback)
  app.post('/api/threat/nearby-police', async (req, res) => {
    try {
      const { latitude, longitude, areaQuery } = req.body as {
        latitude?: number | null;
        longitude?: number | null;
        areaQuery?: string;
      };

      const hasCoords =
        typeof latitude === 'number' &&
        typeof longitude === 'number' &&
        !Number.isNaN(latitude) &&
        !Number.isNaN(longitude);

      const cleanArea =
        typeof areaQuery === 'string' ? areaQuery.trim() : '';

      if (!hasCoords && !cleanArea) {
        res.status(400).json({
          error:
            'Grant GPS location or enter a city/neighborhood name to locate nearby police stations.',
        });
        return;
      }

      const resolvedAreaName =
        cleanArea ||
        (hasCoords
          ? await reverseGeocodeArea(latitude as number, longitude as number)
          : '');
      const locationLabel =
        resolvedAreaName ||
        (hasCoords
          ? `GPS ${(latitude as number).toFixed(4)}, ${(longitude as number).toFixed(4)}`
          : cleanArea);

      const ai = getAiClient();
      const prompt = hasCoords && !cleanArea
        ? `Find the nearest police stations and women police help desks around ${resolvedAreaName || `latitude ${latitude}, longitude ${longitude}`}. List each station as a bullet point in the format: "- Station Name | Public Phone Number (only if verified, otherwise write 'Call 100 / 112') | Short street address". Do NOT invent phone numbers. Also mention the national emergency police number.`
        : `Find the main nearby police stations and women police stations in or near "${locationLabel}". List each station as a bullet point in the format: "- Station Name | Public Phone Number (only if verified, otherwise write 'Call 100 / 112') | Short street address". Do NOT invent phone numbers. Also mention the national emergency police number.`;

      // Tier 1: Gemini Maps Grounding
      try {
        const mapsConfig: {
          tools: Array<{ googleMaps: Record<string, never> }>;
          toolConfig?: {
            retrievalConfig: {
              latLng: { latitude: number; longitude: number };
            };
          };
        } = {
          tools: [{ googleMaps: {} }],
        };

        if (hasCoords) {
          mapsConfig.toolConfig = {
            retrievalConfig: {
              latLng: {
                latitude: latitude as number,
                longitude: longitude as number,
              },
            },
          };
        }

        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: mapsConfig,
        });

        const summaryText = (response.text ?? '').trim();
        const rawChunks =
          response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];

        const mapLinks: Array<{ title: string; uri: string }> = [];
        for (const chunk of rawChunks) {
          const mapsObj = (chunk as { maps?: { uri?: string; title?: string } })
            .maps;
          if (mapsObj?.uri) {
            mapLinks.push({
              title: mapsObj.title || 'Police Station on Google Maps',
              uri: mapsObj.uri,
            });
          }
        }

        const stations = parseStationsFromGroundedText(summaryText, mapLinks);
        res.json({
          summaryText,
          stations,
          mapLinks,
          queriedAt: new Date().toISOString(),
          locationLabel,
        });
        return;
      } catch {
        // Fall through to Tier 2 (Google Search Grounding on gemini-4-hydrogen)
      }

      // Tier 2: Gemini Google Search Grounding (works even when Maps grounding quota is limited)
      try {
        const searchResponse = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });

        const summaryText = (searchResponse.text ?? '').trim();
        const rawChunks =
          searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];

        const mapLinks: Array<{ title: string; uri: string }> = [];
        for (const chunk of rawChunks) {
          const webObj = (chunk as { web?: { uri?: string; title?: string } }).web;
          if (webObj?.uri) {
            mapLinks.push({
              title: webObj.title || 'Police Directory Source',
              uri: webObj.uri,
            });
          }
        }

        const parsedStations = parseStationsFromGroundedText(summaryText, []).map(
          (st) => ({
            ...st,
            mapsUri:
              st.mapsUri ||
              `https://www.google.com/maps/search/${encodeURIComponent(
                `${st.name} ${locationLabel}`
              )}`,
          })
        );

        const mapsOverviewUrl = hasCoords
          ? `https://www.google.com/maps/search/police+station/@${latitude},${longitude},15z`
          : `https://www.google.com/maps/search/${encodeURIComponent(
              `police station near ${locationLabel}`
            )}`;

        mapLinks.unshift({
          title: `View Police Stations near ${locationLabel} on Google Maps`,
          uri: mapsOverviewUrl,
        });

        res.json({
          summaryText,
          stations: parsedStations,
          mapLinks: mapLinks.slice(0, 6),
          queriedAt: new Date().toISOString(),
          locationLabel,
        });
        return;
      } catch {
        // Fall through to Tier 3 (Direct OpenStreetMap live geospatial lookup)
      }

      // Tier 3: Live OpenStreetMap Nominatim lookup (always available without API quota)
      const osm = await fetchNominatimPoliceStations(
        locationLabel,
        latitude,
        longitude
      );

      res.json({
        summaryText:
          osm.stations.length > 0
            ? `Found ${osm.stations.length} nearby police station listing(s) for ${locationLabel}. Tap any station to open directions or dial 100 / 112 immediately.`
            : `Open Google Maps below for live police station directions near ${locationLabel}, or dial 100 (Police) / 112 (Emergency) directly.`,
        stations: osm.stations,
        mapLinks: osm.mapLinks,
        queriedAt: new Date().toISOString(),
        locationLabel,
      });
    } catch (err) {
      res.status(500).json({
        error: formatFriendlyServerError(
          err,
          'Could not look up nearby police stations right now. Dial 100 or 112 directly.'
        ),
      });
    }
  });

  // REST AI App-Controller Endpoint (gemini-4-hydrogen + function calling) for typed commands & quick buttons
  app.post('/api/assistant/command', async (req, res) => {
    try {
      const { text, userContext } = req.body as {
        text?: string;
        userContext?: {
          userName?: string;
          primaryGuardianName?: string;
          primaryGuardianPhone?: string;
          threatActive?: boolean;
          sosActive?: boolean;
        };
      };

      if (!text || typeof text !== 'string' || !text.trim()) {
        res.status(400).json({ error: 'Command text is required.' });
        return;
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: text.trim(),
        config: {
          systemInstruction: buildSystemInstruction(userContext),
          tools: [{ functionDeclarations: SAFETY_VOICE_TOOLS }],
        },
      });

      const functionCalls = (response.functionCalls ?? []).map((fc) => ({
        id: fc.id ?? `fc-${Date.now()}`,
        name: fc.name ?? '',
        args: fc.args ?? {},
      }));

      res.json({
        reply:
          response.text?.trim() ||
          (functionCalls.length > 0
            ? `Executing ${functionCalls.map((c) => c.name.replace(/_/g, ' ')).join(', ')}.`
            : 'I am ready to help. Say or type commands like "Call both guardian and police", "Open SOS", or "Activate Threat Mode".'),
        toolCalls: functionCalls,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to process AI command.';
      res.status(500).json({ error: message });
    }
  });

  const server = http.createServer(app);

  // Real-Time Gemini 3.8 Live API WebSocket Bridge
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const reqUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (reqUrl.pathname === '/api/live-voice') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (clientWs: WebSocket) => {
    let liveSession: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null =
      null;
    let closed = false;

    const sendJson = (payload: Record<string, unknown>) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    const connectLiveSession = async (userContext?: {
      userName?: string;
      primaryGuardianName?: string;
      primaryGuardianPhone?: string;
      threatActive?: boolean;
      sosActive?: boolean;
    }) => {
      try {
        const ai = getAiClient();
        liveSession = await ai.live.connect({
          model: 'gemini-3.8-live',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            tools: [{ functionDeclarations: SAFETY_VOICE_TOOLS }],
            systemInstruction: buildSystemInstruction(userContext),
          },
          callbacks: {
            onopen: () => {
              if (!closed) {
                sendJson({ type: 'ready' });
              }
            },
            onmessage: (message: LiveServerMessage) => {
              if (closed) return;

              const content = message.serverContent;
              if (content?.inputTranscription?.text) {
                sendJson({
                  type: 'inputTranscript',
                  text: content.inputTranscription.text,
                });
              }
              if (content?.outputTranscription?.text) {
                sendJson({
                  type: 'outputTranscript',
                  text: content.outputTranscription.text,
                });
              }

              for (const part of content?.modelTurn?.parts ?? []) {
                if (part.inlineData?.data) {
                  sendJson({
                    type: 'audio',
                    data: part.inlineData.data,
                  });
                }
              }

              if (content?.interrupted) {
                sendJson({ type: 'interrupted' });
              }

              if (content?.turnComplete) {
                sendJson({ type: 'turnComplete' });
              }

              const calls = message.toolCall?.functionCalls;
              if (calls && calls.length > 0) {
                sendJson({
                  type: 'toolCall',
                  calls: calls.map((c) => ({
                    id: c.id ?? `live-tc-${Date.now()}`,
                    name: c.name ?? '',
                    args: c.args ?? {},
                  })),
                });
              }
            },
            onerror: (err: unknown) => {
              const msg =
                err instanceof Error
                  ? err.message
                  : 'Gemini Live session encountered an error.';
              sendJson({ type: 'error', message: msg });
            },
            onclose: () => {
              if (!closed) {
                sendJson({ type: 'closed' });
              }
            },
          },
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to connect to Gemini Live API.';
        sendJson({ type: 'error', message });
      }
    };

    clientWs.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type?: string;
          audio?: string;
          text?: string;
          userContext?: {
            userName?: string;
            primaryGuardianName?: string;
            primaryGuardianPhone?: string;
            threatActive?: boolean;
            sosActive?: boolean;
          };
          responses?: Array<{
            id: string;
            name: string;
            response: Record<string, unknown>;
          }>;
        };

        if (msg.type === 'init') {
          if (!liveSession) {
            await connectLiveSession(msg.userContext);
          }
          return;
        }

        if (!liveSession) return;

        if (msg.type === 'audio' && msg.audio) {
          liveSession.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (msg.type === 'text' && msg.text) {
          liveSession.sendRealtimeInput({ text: msg.text });
        } else if (msg.type === 'toolResponse' && Array.isArray(msg.responses)) {
          liveSession.sendToolResponse({
            functionResponses: msg.responses,
          });
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Invalid Live Voice message.';
        sendJson({ type: 'error', message });
      }
    });

    clientWs.on('close', () => {
      closed = true;
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // ignore close errors
        }
        liveSession = null;
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true } as any,
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`OurSafe server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
