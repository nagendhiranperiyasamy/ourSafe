import React, { useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact }) => {
  const { isInstallable, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        title="Add OurSafe + Lock-Screen Shield shortcut to your Phone Home Screen"
        className={
          compact
            ? 'min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] border border-[#B8C6A8] text-[#24371D] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0'
            : 'min-h-[44px] px-4 py-2 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] border border-[#B8C6A8] text-[#24371D] text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap'
        }
      >
        <Download className="w-3.5 h-3.5 text-[#2F4526] shrink-0" />
        <span>{compact ? 'Add to Home' : 'Install on Phone Home Screen'}</span>
      </button>

      {showGuideModal && (
        <div
          data-ignore-sos-tap="true"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-guide-title"
          className="fixed inset-0 z-[75] bg-[#182215]/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-3xl bg-[#FCFDF9] border border-[#B8C6A8] p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#EAF0E2] text-[#2F4526] flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#3E5632]">
                    Phone Home Screen Installation
                  </p>
                  <h3
                    id="pwa-install-guide-title"
                    className="text-lg font-semibold text-[#182215]"
                  >
                    Add OurSafe to Home Screen
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Close installation guide"
                className="min-w-[36px] min-h-[36px] rounded-xl flex items-center justify-center text-[#54634D] hover:bg-[#EAF0E2] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-2.5 text-sm text-[#3E4C37] list-decimal pl-5">
                <li>
                  Tap the{' '}
                  <span className="inline-flex items-center gap-1 font-semibold text-[#182215]">
                    <Share className="w-3.5 h-3.5" /> Share
                  </span>{' '}
                  button in Safari&apos;s toolbar.
                </li>
                <li>
                  Scroll down and tap{' '}
                  <strong className="text-[#182215]">Add to Home Screen</strong>.
                </li>
                <li>
                  Tap <strong className="text-[#182215]">Add</strong> to place
                  OurSafe directly on your iPhone Home Screen.
                </li>
              </ol>
            ) : (
              <ol className="space-y-2.5 text-sm text-[#3E4C37] list-decimal pl-5">
                <li>
                  Open the browser menu (<strong>⋮</strong>) and tap{' '}
                  <strong className="text-[#182215]">
                    Install App / Add to Home Screen
                  </strong>
                  .
                </li>
                <li>
                  Once added, long-press the OurSafe icon on your Phone Home
                  Screen to launch{' '}
                  <strong className="text-[#182215]">
                    Lock-Screen SOS Shield
                  </strong>{' '}
                  or <strong className="text-[#182215]">SOS Call</strong>{' '}
                  directly.
                </li>
              </ol>
            )}

            <div className="rounded-2xl bg-[#F4F7EF] border border-[#D4DFC8] p-3.5 text-xs text-[#465340] leading-relaxed">
              <p className="font-bold text-[#182215] mb-1">
                For Real Android Main Lock Screen &amp; Always-On Home Overlay:
              </p>
              <p>
                Build the included Capacitor Android APK (native Foreground
                Service + Overlay + Accessibility Tap + Home Widget are pre-wired
                in this project).
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full min-h-[44px] rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-white text-sm font-semibold cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
