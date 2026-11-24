import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Car,
  CheckCircle2,
  FileSearch,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { VehicleVerificationRecord } from '../../types/safety';
import { formatTimeShort } from '../../utils/storage';

interface VehicleVerificationCardProps {
  verifiedVehicle?: VehicleVerificationRecord | null;
  onVehicleVerified: (record: VehicleVerificationRecord) => void;
  onClearVehicle?: () => void;
}

export const VehicleVerificationCard: React.FC<VehicleVerificationCardProps> = ({
  verifiedVehicle,
  onVehicleVerified,
  onClearVehicle,
}) => {
  const [plateInput, setPlateInput] = useState(
    verifiedVehicle?.normalizedNumber ?? ''
  );
  const [photoPreview, setPhotoPreview] = useState<string>(
    verifiedVehicle?.photoDataUrl ?? ''
  );
  const [photoMime, setPhotoMime] = useState<string>('image/jpeg');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<VehicleVerificationRecord | null>(
    verifiedVehicle ?? null
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('Please capture or upload an image file (JPG, PNG, or WebP).');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('Photo is too large (max 4 MB). Capture a closer plate photo.');
      return;
    }
    setPhotoMime(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!plateInput.trim() && !photoPreview) {
      setError(
        'Enter an auto / cab registration number (e.g., TN 09 AB 1234) or capture a plate photo.'
      );
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/travel/verify-vehicle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleNumber: plateInput.trim() || undefined,
          photoBase64: photoPreview || undefined,
          mimeType: photoMime,
        }),
      });

      const data = (await res.json()) as VehicleVerificationRecord & {
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || 'Could not verify vehicle number.');
      }

      const fullRecord: VehicleVerificationRecord = {
        ...data,
        photoDataUrl: photoPreview || undefined,
      };

      setResult(fullRecord);
      if (fullRecord.normalizedNumber) {
        setPlateInput(fullRecord.normalizedNumber);
      }
      onVehicleVerified(fullRecord);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Vehicle verification failed. Double-check the number plate manually.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    setPlateInput('');
    setPhotoPreview('');
    setResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClearVehicle?.();
  };

  const isSuspicious = result?.authenticityStatus === 'suspicious_or_invalid';
  const isVerified = result?.authenticityStatus === 'format_verified';

  return (
    <section className="bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#3E5632]">
            Pre-Ride Safety Audit · Auto / Cab Plate Verification &amp; Photo Log
          </p>
          <h2 className="mt-1 text-lg sm:text-xl font-semibold text-[#182215]">
            Verify Auto / Vehicle Number &amp; Capture Photo
          </h2>
          <p className="mt-1 text-xs text-[#4B5844] max-w-2xl leading-relaxed">
            Before boarding an auto-rickshaw, cab, or bike taxi, enter the registration number or snap a photo of the number plate. OurSafe reads the plate with AI, checks official Indian RTO state &amp; district codes for fake/tampered patterns, and automatically attaches the vehicle details to your guardian alerts &amp; SOS messages.
          </p>
        </div>

        {(result || photoPreview) && (
          <button
            type="button"
            onClick={handleReset}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] text-[#24371D] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Vehicle</span>
          </button>
        )}
      </div>

      <form onSubmit={handleVerifySubmit} className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-end">
          <div className="lg:col-span-5">
            <label
              htmlFor="vehicle-plate-input"
              className="block text-xs font-semibold text-[#182215] mb-1.5"
            >
              Auto / Cab Registration Number
            </label>
            <div className="relative">
              <Car className="w-4 h-4 text-[#5D6C55] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="vehicle-plate-input"
                type="text"
                value={plateInput}
                onChange={(e) => setPlateInput(e.target.value.toUpperCase())}
                placeholder="e.g. TN 09 AB 1234 or KA 01 MJ 4521"
                className="w-full min-h-[46px] pl-9 pr-3 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm font-mono font-bold tracking-wider uppercase text-[#182215] placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:normal-case placeholder:text-[#75856D] focus:bg-white focus:border-[#2F4526] focus:outline-none"
              />
            </div>
          </div>

          <div className="lg:col-span-4">
            <label className="block text-xs font-semibold text-[#182215] mb-1.5">
              Number Plate / Auto Photo (AI OCR)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              className="hidden"
              id="vehicle-photo-upload"
            />
            <div className="flex gap-2">
              <label
                htmlFor="vehicle-photo-upload"
                className="flex-1 min-h-[46px] px-3.5 py-2 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] border border-[#C5D2B7] text-[#24371D] text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Camera className="w-4 h-4 text-[#2F4526]" />
                <span>{photoPreview ? 'Retake Plate Photo' : 'Snap / Upload Photo'}</span>
              </label>
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt="Captured vehicle plate"
                  className="w-12 h-[46px] rounded-xl object-cover border border-[#B8C6A8] shrink-0"
                />
              )}
            </div>
          </div>

          <div className="lg:col-span-3">
            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#2F4526] hover:bg-[#23351C] disabled:opacity-60 text-[#F6F9F2] text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <FileSearch className="w-4 h-4" />
              <span>{busy ? 'Verifying...' : 'Verify Vehicle'}</span>
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-700">
            {error}
          </p>
        )}
      </form>

      {/* Verification Audit Result */}
      {result && (
        <div
          className={`rounded-2xl border p-4 sm:p-5 space-y-3 ${
            isSuspicious
              ? 'bg-red-50 border-red-300'
              : isVerified
                ? 'bg-emerald-50/80 border-emerald-300'
                : 'bg-amber-50 border-amber-300'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              {isSuspicious ? (
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              ) : isVerified ? (
                <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              ) : (
                <Upload className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              )}
              <div>
                <p
                  className={`text-xs font-bold uppercase tracking-wider ${
                    isSuspicious
                      ? 'text-red-700'
                      : isVerified
                        ? 'text-emerald-800'
                        : 'text-amber-800'
                  }`}
                >
                  {isSuspicious
                    ? 'Warning · Suspicious or Invalid Plate Format'
                    : isVerified
                      ? 'RTO Registration Format Verified'
                      : 'Unrecognized Plate Format — Verify Manually'}
                  {result.extractedFromPhoto ? ' · Extracted via AI Photo OCR' : ''}
                </p>
                <p className="mt-1 text-xl font-extrabold font-mono tracking-wider text-[#182215]">
                  {result.normalizedNumber}
                </p>
              </div>
            </div>

            <span className="text-[11px] font-mono tabular-nums text-[#4B5844]">
              Checked {formatTimeShort(result.verifiedAt)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="rounded-xl bg-white/80 border border-[#D4DFC8] px-3 py-2">
              <span className="text-[#54634D]">RTO State / Region: </span>
              <strong className="text-[#182215]">{result.stateRegion}</strong>
            </div>
            <div className="rounded-xl bg-white/80 border border-[#D4DFC8] px-3 py-2">
              <span className="text-[#54634D]">Vehicle Type: </span>
              <strong className="text-[#182215]">{result.vehicleType}</strong>
            </div>
          </div>

          <p className="text-xs text-[#2D3B27] leading-relaxed">
            {result.summary}
          </p>

          {result.riskWarnings.length > 0 && (
            <div className="rounded-xl bg-red-100/80 border border-red-200 p-3 space-y-1">
              {result.riskWarnings.map((warn, i) => (
                <p
                  key={i}
                  className="text-xs font-semibold text-red-900 flex items-start gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-700" />
                  <span>{warn}</span>
                </p>
              ))}
            </div>
          )}

          {isVerified && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Attached to Travel Mode &amp; automatically included in Guardian SMS and SOS emergency alerts.
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
