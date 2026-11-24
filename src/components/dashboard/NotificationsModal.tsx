import React from 'react';
import { Bell, CheckCheck, Trash2, X } from 'lucide-react';
import { AppNotification } from '../../types/safety';
import { formatTimeShort } from '../../utils/storage';

interface NotificationsModalProps {
  notifications: AppNotification[];
  maskPreviews: boolean;
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onClose: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  notifications,
  maskPreviews,
  onMarkAllRead,
  onClearAll,
  onClose,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-[#182215]/55 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notifications-modal-title"
    >
      <div className="w-full max-w-md bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#EAF0E2] text-[#2F4526] flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="notifications-modal-title"
                className="text-lg font-semibold text-[#182215]"
              >
                Safety Activity Log
              </h2>
              <p className="text-xs text-[#54634D]">
                Session notifications ({notifications.length})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#54634D] hover:bg-[#EAF0E2] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {notifications.length > 0 && (
          <div className="flex items-center justify-end gap-2 mb-3">
            <button
              type="button"
              onClick={onMarkAllRead}
              className="min-h-[36px] px-3 py-1 rounded-lg bg-[#EAF0E2] hover:bg-[#DCE7D2] text-[#24371D] text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark All Read</span>
            </button>
            <button
              type="button"
              onClick={onClearAll}
              className="min-h-[36px] px-3 py-1 rounded-lg hover:bg-red-50 text-[#54634D] hover:text-red-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
          {notifications.length === 0 ? (
            <div className="rounded-2xl bg-[#F4F7EF] border border-[#CFD9C3] p-6 text-center text-xs text-[#54634D]">
              No safety notifications recorded yet.
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl p-3.5 border text-sm ${
                  item.read
                    ? 'bg-white border-[#DCE5D1]'
                    : 'bg-[#F4F7EF] border-[#B8C6A8]'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-bold text-[#182215] text-xs">
                    {item.title}
                  </p>
                  <span className="text-[11px] font-mono tabular-nums text-[#5D6C55] shrink-0">
                    {formatTimeShort(item.timestamp)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#465340] leading-relaxed">
                  {maskPreviews
                    ? 'Discreet preview enabled in Privacy Settings.'
                    : item.detail}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
