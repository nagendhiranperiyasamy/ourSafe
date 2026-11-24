import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileAudio,
  FileVideo,
  Lock,
  Share2,
  ShieldCheck,
  Trash2,
  Unlock,
} from 'lucide-react';
import {
  EmergencyHistoryCategory,
  EmergencyHistoryEntry,
  UserProfile,
} from '../../types/safety';
import {
  clearUserRecordings,
  deleteRecordingFromDb,
  listUserRecordings,
  StoredRecordingRecord,
  updateRecordingSharedFlag,
} from '../../utils/evidenceDb';
import { formatDateTimeShort } from '../../utils/storage';

interface EvidenceHistoryPageProps {
  user: UserProfile;
  entries: EmergencyHistoryEntry[];
  onClearHistory: () => void;
  onLogGuardianShare: (recordingId: string, kind: 'audio' | 'video') => void;
}

const FILTER_OPTIONS: Array<{
  id: 'all' | EmergencyHistoryCategory;
  label: string;
}> = [
  { id: 'all', label: 'All Events' },
  { id: 'sos', label: 'SOS' },
  { id: 'threat', label: 'Threat Mode' },
  { id: 'recording', label: 'Recordings' },
  { id: 'location', label: 'Location' },
  { id: 'connectivity', label: 'Connectivity' },
  { id: 'guardian', label: 'Guardian' },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const EvidenceHistoryPage: React.FC<EvidenceHistoryPageProps> = ({
  user,
  entries,
  onClearHistory,
  onLogGuardianShare,
}) => {
  const [unlocked, setUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [unlockError, setUnlockError] = useState('');

  const [filter, setFilter] = useState<'all' | EmergencyHistoryCategory>('all');
  const [recordings, setRecordings] = useState<
    Array<StoredRecordingRecord & { objectUrl: string }>
  >([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const loadRecordings = useCallback(async () => {
    setLoadingRecs(true);
    try {
      const items = await listUserRecordings(user.id);
      setRecordings((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.objectUrl));
        return items.map((item) => ({
          ...item,
          objectUrl: URL.createObjectURL(item.blob),
        }));
      });
    } catch {
      // IndexedDB unavailable
    } finally {
      setLoadingRecs(false);
    }
  }, [user.id]);

  useEffect(() => {
    if (unlocked) {
      loadRecordings();
    }
    return () => {
      setRecordings((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.objectUrl));
        return [];
      });
    };
  }, [unlocked, loadRecordings]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError('');
    if (passwordInput !== user.password) {
      setUnlockError(
        'Incorrect account password. Access to recordings and emergency history is restricted to the authorized account holder.'
      );
      return;
    }
    setUnlocked(true);
    setPasswordInput('');
  };

  const handleDeleteRecording = async (id: string) => {
    try {
      await deleteRecordingFromDb(id);
      setRecordings((prev) => {
        const target = prev.find((p) => p.id === id);
        if (target) URL.revokeObjectURL(target.objectUrl);
        return prev.filter((p) => p.id !== id);
      });
      setStatusMessage('Recording permanently deleted from device storage.');
      window.setTimeout(() => setStatusMessage(''), 3000);
    } catch {
      setStatusMessage('Unable to delete recording.');
    }
  };

  const handleShareRecording = async (
    rec: StoredRecordingRecord & { objectUrl: string }
  ) => {
    await updateRecordingSharedFlag(rec.id, true);
    setRecordings((prev) =>
      prev.map((item) =>
        item.id === rec.id ? { ...item, sharedWithGuardians: true } : item
      )
    );
    onLogGuardianShare(rec.id, rec.kind);

    const shareSummary = `OurSafe ${rec.kind === 'video' ? 'Video' : 'Audio'} Evidence (${rec.durationSec}s) captured at ${formatDateTimeShort(rec.createdAt)}${
      rec.locationCoords ? ` · GPS: ${rec.locationCoords}` : ''
    }`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'OurSafe Emergency Evidence Summary',
          text: shareSummary,
        });
      } catch {
        // User dismissed native share sheet
      }
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareSummary).catch(() => {});
    }

    setStatusMessage(
      `Guardian evidence summary ready for ${user.sosContacts.length} authorized contact(s).`
    );
    window.setTimeout(() => setStatusMessage(''), 3500);
  };

  const handleClearAllData = async () => {
    await clearUserRecordings(user.id).catch(() => {});
    recordings.forEach((r) => URL.revokeObjectURL(r.objectUrl));
    setRecordings([]);
    onClearHistory();
    setStatusMessage('All emergency history and recordings have been erased.');
    window.setTimeout(() => setStatusMessage(''), 3500);
  };

  const handleExportTimeline = () => {
    const payload = {
      app: 'OurSafe',
      exportedAt: new Date().toISOString(),
      accountHolder: user.fullName,
      guardians: user.sosContacts.map((c) => ({
        name: c.name,
        phone: c.phone,
        relation: c.relation,
      })),
      recordingsCount: recordings.length,
      timeline: entries,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `oursafe-emergency-history-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredEntries =
    filter === 'all' ? entries : entries.filter((e) => e.category === filter);

  if (!unlocked) {
    return (
      <section className="max-w-lg mx-auto bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#EAF0E2] text-[#2F4526] flex items-center justify-center shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#3E5632]">
              Privacy &amp; Access Protection
            </p>
            <h1 className="text-xl font-semibold text-[#182215]">
              Emergency Evidence History Locked
            </h1>
          </div>
        </div>

        <p className="text-sm text-[#465340] leading-relaxed">
          To protect your privacy, access to audio/video recordings, GPS timelines, and emergency alerts requires your account password before viewing.
        </p>

        {unlockError && (
          <p className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-700">
            {unlockError}
          </p>
        )}

        <form onSubmit={handleUnlock} className="space-y-3.5">
          <div>
            <label
              htmlFor="history-unlock-password"
              className="block text-xs font-semibold text-[#182215] mb-1"
            >
              Account Password
            </label>
            <input
              id="history-unlock-password"
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Enter your OurSafe password"
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm focus:bg-white focus:border-[#2F4526] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-[#F6F9F2] text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Unlock className="w-4 h-4" />
            <span>Unlock Evidence History</span>
          </button>
        </form>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Data Management Bar */}
      <section className="bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 flex flex-wrap items-start justify-between gap-4 shadow-sm">
        <div>
          <p className="text-xs font-semibold text-[#3E5632]">
            Authorized Access Unlocked · Private Evidence Vault
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[#182215]">
            Emergency Evidence &amp; Timeline History
          </h1>
          <p className="mt-1 text-xs text-[#4B5844]">
            Review Threat Mode activations, SOS alerts, GPS snapshots, connectivity events, and saved audio/video recordings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportTimeline}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] text-[#24371D] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </button>
          <button
            type="button"
            onClick={handleClearAllData}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Erase All Data</span>
          </button>
          <button
            type="button"
            onClick={() => setUnlocked(false)}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white hover:bg-[#F4F7EF] border border-[#C5D2B7] text-[#182215] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Lock</span>
          </button>
        </div>
      </section>

      {statusMessage && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-medium text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Recorded Audio / Video Evidence Vault */}
      <section className="bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#3E5632]">
              Secure Media Vault ({recordings.length})
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-[#182215]">
              Threat Mode Audio &amp; Video Recordings
            </h2>
          </div>
        </div>

        {loadingRecs ? (
          <p className="text-xs text-[#54634D]">Loading saved recordings...</p>
        ) : recordings.length === 0 ? (
          <div className="rounded-2xl bg-[#F4F7EF] border border-[#D4DFC8] p-5 text-xs text-[#54634D]">
            No audio or video recordings saved yet. Start a recording inside Threat Mode to capture evidence.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recordings.map((rec) => (
              <div
                key={rec.id}
                className="rounded-2xl bg-[#F4F7EF] border border-[#CFD9C3] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#182215]">
                    {rec.kind === 'video' ? (
                      <FileVideo className="w-4 h-4 text-[#2F4526] shrink-0" />
                    ) : (
                      <FileAudio className="w-4 h-4 text-[#2F4526] shrink-0" />
                    )}
                    <span>
                      {rec.kind === 'video' ? 'Video Evidence' : 'Audio Evidence'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-[#54634D]">
                    {rec.durationSec}s · {formatBytes(rec.sizeBytes)}
                  </span>
                </div>

                <p className="text-xs text-[#4B5844] tabular-nums">
                  Captured {formatDateTimeShort(rec.createdAt)}
                  {rec.locationCoords ? ` · GPS ${rec.locationCoords}` : ''}
                </p>

                {rec.kind === 'video' ? (
                  <video
                    src={rec.objectUrl}
                    controls
                    className="w-full rounded-xl bg-black max-h-48"
                  />
                ) : (
                  <audio src={rec.objectUrl} controls className="w-full" />
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleShareRecording(rec)}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white hover:bg-[#EAF0E2] border border-[#C5D2B7] text-[#24371D] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>
                      {rec.sharedWithGuardians
                        ? 'Shared with Guardians'
                        : 'Share with Guardians'}
                    </span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <a
                      href={rec.objectUrl}
                      download={`oursafe-${rec.kind}-${rec.id}.webm`}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white hover:bg-[#EAF0E2] border border-[#C5D2B7] text-[#182215] text-xs font-semibold inline-flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteRecording(rec.id)}
                      aria-label="Delete recording permanently"
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Complete Emergency Event Timeline */}
      <section className="bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#3E5632]">
              Chronological Event Log ({filteredEntries.length})
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-[#182215]">
              Emergency Activity Timeline
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#EAF0E2] border border-[#C5D2B7]">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFilter(opt.id)}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  filter === opt.id
                    ? 'bg-[#FCFDF9] text-[#182215] shadow-sm'
                    : 'text-[#4B5844] hover:text-[#182215]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="rounded-2xl bg-[#F4F7EF] border border-[#D4DFC8] p-6 text-center text-xs text-[#54634D]">
            No events recorded for this filter yet. Activating Threat Mode, triggering SOS, or running a Safety Check-In logs full timestamps and status updates here.
          </div>
        ) : (
          <div className="divide-y divide-[#DCE5D1] border border-[#CFD9C3] rounded-2xl overflow-hidden">
            {filteredEntries.map((item) => (
              <div key={item.id} className="p-4 bg-white space-y-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#2F4526] shrink-0" />
                    <span className="text-sm font-bold text-[#182215]">
                      {item.title}
                    </span>
                    {item.statusLabel && (
                      <span className="text-xs font-semibold text-[#3E5632]">
                        · {item.statusLabel}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-mono tabular-nums text-[#54634D]">
                    {formatDateTimeShort(item.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-[#465340] leading-relaxed">
                  {item.detail}
                </p>
                {item.locationCoords && (
                  <p className="text-[11px] font-mono tabular-nums text-[#54634D]">
                    Location snapshot: {item.locationCoords}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
