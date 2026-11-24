import React, { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Fingerprint,
  KeyRound,
  Lock,
  LogOut,
  Shield,
  Smartphone,
  User,
  Users,
  X,
} from 'lucide-react';
import { SafetyPreferences, UserProfile } from '../../types/safety';

interface SettingsModalProps {
  user: UserProfile;
  onUpdatePreferences: (partial: Partial<SafetyPreferences>) => void;
  onChangePassword: (newPassword: string) => void;
  onOpenEditProfile: () => void;
  onOpenManageContacts: () => void;
  onOpenLockScreenShield?: (surface?: 'lock_screen' | 'home_screen') => void;
  onLogout: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  user,
  onUpdatePreferences,
  onChangePassword,
  onOpenEditProfile,
  onOpenManageContacts,
  onOpenLockScreenShield,
  onLogout,
  onClose,
}) => {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdFeedback, setPwdFeedback] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPwdFeedback(null);

    if (currentPwd !== user.password) {
      setPwdFeedback({ type: 'error', text: 'Current password is incorrect.' });
      return;
    }
    if (newPwd.length < 6) {
      setPwdFeedback({
        type: 'error',
        text: 'New password must be at least 6 characters.',
      });
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdFeedback({
        type: 'error',
        text: 'New password and confirmation do not match.',
      });
      return;
    }

    onChangePassword(newPwd);
    setCurrentPwd('');
    setNewPwd('');
    setConfirmPwd('');
    setPwdFeedback({
      type: 'success',
      text: 'Password updated successfully.',
    });
  };

  const ToggleRow: React.FC<{
    label: string;
    description: string;
    checked: boolean;
    onToggle: () => void;
  }> = ({ label, description, checked, onToggle }) => (
    <div className="py-3 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#182215]">{label}</p>
        <p className="text-xs text-[#54634D]">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 cursor-pointer flex items-center ${
          checked ? 'bg-[#2F4526] justify-end' : 'bg-[#C4D1B6] justify-start'
        }`}
      >
        <span className="w-5 h-5 rounded-full bg-white shadow-sm block" />
      </button>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-[#182215]/55 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="w-full max-w-xl bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 sm:p-7 shadow-2xl my-auto max-h-[92vh] overflow-y-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#3E5632]">
              Account &amp; Safety Configuration
            </p>
            <h2
              id="settings-modal-title"
              className="text-xl font-semibold text-[#182215] mt-0.5"
            >
              Settings
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#54634D] hover:bg-[#EAF0E2] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Account Shortcuts */}
        <div className="divide-y divide-[#DCE5D1] rounded-2xl border border-[#CFD9C3] overflow-hidden">
          <button
            type="button"
            onClick={onOpenEditProfile}
            className="w-full min-h-[56px] px-4 py-3 bg-white hover:bg-[#F4F7EF] flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#EAF0E2] text-[#2F4526] flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#182215]">Edit Profile</p>
                <p className="text-xs text-[#54634D]">
                  Update your name, phone, email, age, or guardian details
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#5D6C55] shrink-0" />
          </button>

          <button
            type="button"
            onClick={onOpenManageContacts}
            className="w-full min-h-[56px] px-4 py-3 bg-white hover:bg-[#F4F7EF] flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#EAF0E2] text-[#2F4526] flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#182215]">
                  Manage Emergency Contacts
                </p>
                <p className="text-xs text-[#54634D]">
                  {user.sosContacts.length} contact(s) configured for SOS and Travel Mode
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#5D6C55] shrink-0" />
          </button>

          <div className="bg-white">
            <button
              type="button"
              onClick={() => {
                setShowPasswordForm((prev) => !prev);
                setPwdFeedback(null);
              }}
              className="w-full min-h-[56px] px-4 py-3 hover:bg-[#F4F7EF] flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#EAF0E2] text-[#2F4526] flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#182215]">
                    Change Password
                  </p>
                  <p className="text-xs text-[#54634D]">
                    Update the password for your account and Evidence Vault
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-[#2F4526]">
                {showPasswordForm ? 'Hide' : 'Open'}
              </span>
            </button>

            {showPasswordForm && (
              <form
                onSubmit={handlePasswordSubmit}
                className="px-4 pb-4 pt-2 bg-[#F4F7EF] border-t border-[#DCE5D1] space-y-3"
              >
                {pwdFeedback && (
                  <div
                    className={`rounded-xl px-3 py-2 text-xs font-medium flex items-center gap-2 ${
                      pwdFeedback.type === 'success'
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border border-red-200 text-red-700'
                    }`}
                  >
                    {pwdFeedback.type === 'success' && (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{pwdFeedback.text}</span>
                  </div>
                )}

                <input
                  type="password"
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  placeholder="Current password"
                  aria-label="Current password"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#C5D2B7] text-sm focus:border-[#2F4526] focus:outline-none"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder="New password (min 6)"
                    aria-label="New password"
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#C5D2B7] text-sm focus:border-[#2F4526] focus:outline-none"
                  />
                  <input
                    type="password"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    placeholder="Confirm new password"
                    aria-label="Confirm new password"
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#C5D2B7] text-sm focus:border-[#2F4526] focus:outline-none"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="min-h-[40px] px-4 py-1.5 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-[#F6F9F2] text-xs font-semibold cursor-pointer"
                  >
                    Save New Password
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Always-On 3 Safety Systems + "OurSafe" Voice Wake Word (ON / OFF Center) */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-[#182215]">
              <Smartphone className="w-4 h-4 text-[#2F4526]" />
              <span>Always-On Safety Systems (On / Off)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onUpdatePreferences({
                    shakeDetectionEnabled: true,
                    voiceActivationEnabled: true,
                    screenTapSosEnabled: true,
                    wakeWordEnabled: true,
                    autoDialOnTrigger: true,
                    autoShareLocationOnTrigger: true,
                  })
                }
                className="px-2.5 py-1 rounded-lg bg-[#2F4526] hover:bg-[#23351C] text-white text-[11px] font-bold cursor-pointer"
              >
                All ON
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdatePreferences({
                    shakeDetectionEnabled: false,
                    voiceActivationEnabled: false,
                    screenTapSosEnabled: false,
                    wakeWordEnabled: false,
                  })
                }
                className="px-2.5 py-1 rounded-lg bg-[#EAF0E2] hover:bg-[#DCE7D2] border border-[#C5D2B7] text-[#24371D] text-[11px] font-bold cursor-pointer"
              >
                All OFF
              </button>
            </div>
          </div>

          <div className="divide-y divide-[#DCE5D1] rounded-2xl bg-[#F4F7EF] border border-[#CFD9C3] px-4">
            {/* Place on Phone Lock Screen (Standby Shield) */}
            <div className="py-3 space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#182215] flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#2F4526]" />
                    <span>Place on Phone Lock Screen (Standby Shield)</span>
                  </p>
                  <p className="text-xs text-[#54634D]">
                    Arms OurSafe on your Android lock screen so 3x tap and voice triggers work without unlocking phone
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(user.preferences.placeInLockShield)}
                  onClick={() =>
                    onUpdatePreferences({
                      placeInLockShield: !user.preferences.placeInLockShield,
                    })
                  }
                  className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 cursor-pointer flex items-center ${
                    user.preferences.placeInLockShield
                      ? 'bg-[#2F4526] justify-end'
                      : 'bg-[#C4D1B6] justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm block" />
                </button>
              </div>
              {onOpenLockScreenShield && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenLockScreenShield('lock_screen');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-[#F6F9F2] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Lock className="w-3.5 h-3.5 text-[#B8D0A8]" />
                    <span>Preview &amp; Place on Lock Screen Now</span>
                  </button>
                </div>
              )}
            </div>

            {/* Alert Mode (Always-On Mic Lock - No Auto ON/OFF Cycling) */}
            <ToggleRow
              label="Alert Mode (Steady Always-On Mic Lock)"
              description="Locks microphone steadily ON without auto-cycling or background deactivation on Android"
              checked={Boolean(user.preferences.alertModeEnabled)}
              onToggle={() =>
                onUpdatePreferences({
                  alertModeEnabled: !user.preferences.alertModeEnabled,
                })
              }
            />

            {/* Mic Always ON (24/7 Background Listening for Commands & Secret Word) */}
            <ToggleRow
              label="Mic Always ON (எப்போதும் மைக் இயங்கு நிலை)"
              description="Keep microphone active 24/7 across every screen so speaking your Secret Voice Code ('Balaji' / 'Red Rose') triggers SOS instantly without touching any button"
              checked={Boolean(user.preferences.micAlwaysOn)}
              onToggle={() =>
                onUpdatePreferences({
                  micAlwaysOn: !user.preferences.micAlwaysOn,
                  voiceActivationEnabled: true,
                })
              }
            />

            {/* Fingerprint Sensor Placement: Vivo Y16 Side Sensor vs Front Center vs Hidden */}
            <div className="py-3 space-y-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#182215] flex items-center gap-1.5">
                  <Fingerprint className="w-3.5 h-3.5 text-[#2F4526]" />
                  <span>Fingerprint Sensor Placement (கைரேகை சென்சார் அமைவிடம்)</span>
                </p>
                <p className="text-xs text-[#54634D]">
                  Configure the position of the 3x Tap SOS sensor to match your phone&apos;s physical fingerprint hardware
                </p>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() =>
                    onUpdatePreferences({
                      sensorPlacement: 'vivo_y16_side',
                      screenTapSosEnabled: true,
                    })
                  }
                  className={`p-2 rounded-xl border text-center transition-colors cursor-pointer ${
                    (user.preferences.sensorPlacement || 'vivo_y16_side') ===
                    'vivo_y16_side'
                      ? 'bg-[#2F4526] text-white border-[#2F4526]'
                      : 'bg-white text-[#4B5844] border-[#CFD9C3] hover:bg-[#EAF0E2]'
                  }`}
                >
                  Vivo Y16 (Side)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdatePreferences({
                      sensorPlacement: 'front_center',
                      screenTapSosEnabled: true,
                    })
                  }
                  className={`p-2 rounded-xl border text-center transition-colors cursor-pointer ${
                    user.preferences.sensorPlacement === 'front_center'
                      ? 'bg-[#2F4526] text-white border-[#2F4526]'
                      : 'bg-white text-[#4B5844] border-[#CFD9C3] hover:bg-[#EAF0E2]'
                  }`}
                >
                  Front (In-Display)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdatePreferences({ sensorPlacement: 'hidden' })
                  }
                  className={`p-2 rounded-xl border text-center transition-colors cursor-pointer ${
                    user.preferences.sensorPlacement === 'hidden'
                      ? 'bg-[#2F4526] text-white border-[#2F4526]'
                      : 'bg-white text-[#4B5844] border-[#CFD9C3] hover:bg-[#EAF0E2]'
                  }`}
                >
                  Hidden
                </button>
              </div>
            </div>

            {/* Lock Screen Style: Icon Only vs Full Details */}
            <div className="py-3 space-y-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#182215] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#2F4526]" />
                  <span>Lock Screen Style (லாக் ஸ்கிரீன் வடிவம்)</span>
                </p>
                <p className="text-xs text-[#54634D]">
                  Choose whether your phone lock screen shows only the minimal OurSafe Logo Icon or the full emergency table
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() =>
                    onUpdatePreferences({ lockScreenDisplayStyle: 'icon_only' })
                  }
                  className={`p-2 rounded-xl border text-center transition-colors cursor-pointer ${
                    (user.preferences.lockScreenDisplayStyle || 'icon_only') ===
                    'icon_only'
                      ? 'bg-[#2F4526] text-white border-[#2F4526]'
                      : 'bg-white text-[#4B5844] border-[#CFD9C3] hover:bg-[#EAF0E2]'
                  }`}
                >
                  Logo / Icon Only
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdatePreferences({
                      lockScreenDisplayStyle: 'icon_and_name',
                    })
                  }
                  className={`p-2 rounded-xl border text-center transition-colors cursor-pointer ${
                    user.preferences.lockScreenDisplayStyle === 'icon_and_name'
                      ? 'bg-[#2F4526] text-white border-[#2F4526]'
                      : 'bg-white text-[#4B5844] border-[#CFD9C3] hover:bg-[#EAF0E2]'
                  }`}
                >
                  Full Safety Table
                </button>
              </div>
            </div>

            {/* Fingerprint Sensor Tap Only (Scroll-Proof SOS) */}
            <ToggleRow
              label="Biometric Fingerprint Sensor Tap Only (Scroll-Proof)"
              description="Requires 3 taps on the fingerprint sensor zone to call SOS. Normal scrolling will never trigger calls"
              checked={user.preferences.fingerprintSensorTapOnly !== false}
              onToggle={() =>
                onUpdatePreferences({
                  fingerprintSensorTapOnly:
                    user.preferences.fingerprintSensorTapOnly === false,
                })
              }
            />

            <ToggleRow
              label="1. 3x Phone Shake SOS (Always-On)"
              description="Shake your phone 3 times without opening the app to call SOS & share live location automatically"
              checked={user.preferences.shakeDetectionEnabled}
              onToggle={() =>
                onUpdatePreferences({
                  shakeDetectionEnabled: !user.preferences.shakeDetectionEnabled,
                })
              }
            />

            <div className="py-3 space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#182215]">
                    2. Secret Voice Code SOS (&ldquo;{user.preferences.voiceKeyword}&rdquo;)
                  </p>
                  <p className="text-xs text-[#54634D]">
                    Even if your phone is across the room, saying your secret code automatically places the SOS call &amp; shares live GPS
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={user.preferences.voiceActivationEnabled}
                  onClick={() =>
                    onUpdatePreferences({
                      voiceActivationEnabled: !user.preferences.voiceActivationEnabled,
                    })
                  }
                  className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 cursor-pointer flex items-center ${
                    user.preferences.voiceActivationEnabled
                      ? 'bg-[#2F4526] justify-end'
                      : 'bg-[#C4D1B6] justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm block" />
                </button>
              </div>
              {user.preferences.voiceActivationEnabled && (
                <div className="space-y-1.5 pt-1">
                  <input
                    type="text"
                    value={user.preferences.voiceKeyword}
                    onChange={(e) =>
                      onUpdatePreferences({ voiceKeyword: e.target.value })
                    }
                    placeholder="Secret voice phrase (e.g. Balaji, Red Rose)"
                    aria-label="Secret voice code phrase"
                    className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-[#C5D2B7] text-xs font-semibold text-[#182215] focus:border-[#2F4526] focus:outline-none"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-[#54634D]">Quick Presets:</span>
                    {['Balaji', 'Red Rose', 'Emergency'].map((phrase) => (
                      <button
                        key={phrase}
                        type="button"
                        onClick={() => onUpdatePreferences({ voiceKeyword: phrase })}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                          user.preferences.voiceKeyword.toLowerCase() === phrase.toLowerCase()
                            ? 'bg-[#2F4526] text-white'
                            : 'bg-[#EAF0E2] text-[#2F4526] hover:bg-[#DCE7D2]'
                        }`}
                      >
                        {phrase}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="py-3 space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#182215]">
                    3. Screen {user.preferences.screenTapCount === 2 ? 'Double-Tap' : 'Triple-Tap'} SOS (Always-On)
                  </p>
                  <p className="text-xs text-[#54634D]">
                    Tap rapidly {user.preferences.screenTapCount} times on the phone lock screen or open screen to trigger SOS + live GPS
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={user.preferences.screenTapSosEnabled}
                  onClick={() =>
                    onUpdatePreferences({
                      screenTapSosEnabled: !user.preferences.screenTapSosEnabled,
                    })
                  }
                  className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 cursor-pointer flex items-center ${
                    user.preferences.screenTapSosEnabled
                      ? 'bg-[#2F4526] justify-end'
                      : 'bg-[#C4D1B6] justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm block" />
                </button>
              </div>
              {user.preferences.screenTapSosEnabled && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdatePreferences({ screenTapCount: 2 })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      user.preferences.screenTapCount === 2
                        ? 'bg-[#2F4526] text-white'
                        : 'bg-white border border-[#C5D2B7] text-[#24371D]'
                    }`}
                  >
                    Double Tap (2x)
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdatePreferences({ screenTapCount: 3 })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      user.preferences.screenTapCount === 3
                        ? 'bg-[#2F4526] text-white'
                        : 'bg-white border border-[#C5D2B7] text-[#24371D]'
                    }`}
                  >
                    Triple Tap (3x)
                  </button>
                </div>
              )}
            </div>

            {/* "OurSafe" Hey-Google Style Wake Word */}
            <div className="py-3 space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#182215]">
                    &ldquo;{user.preferences.wakeWordPhrase || 'OurSafe'}&rdquo; Hands-Free App Wake Word
                  </p>
                  <p className="text-xs text-[#54634D]">
                    Just like &ldquo;Hey Google&rdquo;, say &ldquo;{user.preferences.wakeWordPhrase || 'OurSafe'}&rdquo; anytime to automatically launch the app and control every feature by voice
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={user.preferences.wakeWordEnabled}
                  onClick={() =>
                    onUpdatePreferences({
                      wakeWordEnabled: !user.preferences.wakeWordEnabled,
                    })
                  }
                  className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 cursor-pointer flex items-center ${
                    user.preferences.wakeWordEnabled
                      ? 'bg-[#2F4526] justify-end'
                      : 'bg-[#C4D1B6] justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm block" />
                </button>
              </div>
              {user.preferences.wakeWordEnabled && (
                <input
                  type="text"
                  value={user.preferences.wakeWordPhrase || 'OurSafe'}
                  onChange={(e) =>
                    onUpdatePreferences({ wakeWordPhrase: e.target.value })
                  }
                  placeholder="Wake word (default: OurSafe)"
                  aria-label="App wake word phrase"
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-[#C5D2B7] text-xs font-semibold text-[#182215] focus:border-[#2F4526] focus:outline-none"
                />
              )}
            </div>

            {/* Automatic Call + Live GPS Location Sharing */}
            <ToggleRow
              label="Auto-Call & Share Live GPS on Trigger"
              description="Automatically dial Guardian/Police AND start live GPS location sharing whenever Shake, Secret Code, or Tap triggers"
              checked={
                user.preferences.autoDialOnTrigger &&
                user.preferences.autoShareLocationOnTrigger !== false
              }
              onToggle={() => {
                const next = !(
                  user.preferences.autoDialOnTrigger &&
                  user.preferences.autoShareLocationOnTrigger !== false
                );
                onUpdatePreferences({
                  autoDialOnTrigger: next,
                  autoShareLocationOnTrigger: next,
                });
              }}
            />

            {/* Minimal Lock-Screen Appearance */}
            <div className="py-3 space-y-2">
              <div>
                <p className="text-sm font-semibold text-[#182215]">
                  Phone Lock-Screen Display Style
                </p>
                <p className="text-xs text-[#54634D]">
                  Never captures your full lock screen — shows only a minimal floating SOS icon or compact OurSafe badge
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onUpdatePreferences({ lockScreenDisplayStyle: 'icon_only' })
                  }
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                    user.preferences.lockScreenDisplayStyle === 'icon_only'
                      ? 'bg-[#2F4526] text-white'
                      : 'bg-white border border-[#C5D2B7] text-[#24371D]'
                  }`}
                >
                  SOS Icon Only
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdatePreferences({ lockScreenDisplayStyle: 'icon_and_name' })
                  }
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                    user.preferences.lockScreenDisplayStyle !== 'icon_only'
                      ? 'bg-[#2F4526] text-white'
                      : 'bg-white border border-[#C5D2B7] text-[#24371D]'
                  }`}
                >
                  SOS Icon + OurSafe Name
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-bold text-[#182215]">
            <Bell className="w-4 h-4 text-[#2F4526]" />
            <span>Notification Preferences</span>
          </div>
          <div className="divide-y divide-[#DCE5D1] rounded-2xl bg-[#F4F7EF] border border-[#CFD9C3] px-4">
            <ToggleRow
              label="Travel Check-in Reminders"
              description="Remind me to confirm safe progress during active Travel Mode"
              checked={user.preferences.travelCheckInReminders}
              onToggle={() =>
                onUpdatePreferences({
                  travelCheckInReminders: !user.preferences.travelCheckInReminders,
                })
              }
            />
            <ToggleRow
              label="Guardian Activity Log"
              description="Record safety notifications when contacts or alerts update"
              checked={user.preferences.guardianUpdates}
              onToggle={() =>
                onUpdatePreferences({
                  guardianUpdates: !user.preferences.guardianUpdates,
                })
              }
            />
            <ToggleRow
              label="Threat Mode Attention Alarm"
              description="Enable the manual siren tone option inside Threat Mode"
              checked={user.preferences.soundAlarmEnabled}
              onToggle={() =>
                onUpdatePreferences({
                  soundAlarmEnabled: !user.preferences.soundAlarmEnabled,
                })
              }
            />
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-bold text-[#182215]">
            <Shield className="w-4 h-4 text-[#2F4526]" />
            <span>Privacy Settings</span>
          </div>
          <div className="divide-y divide-[#DCE5D1] rounded-2xl bg-[#F4F7EF] border border-[#CFD9C3] px-4">
            <ToggleRow
              label="GPS Only During Active Safety Actions"
              description="Request GPS location only when opening SOS, Threat, Travel, or Nearby"
              checked={user.preferences.locationOnlyDuringEmergency}
              onToggle={() =>
                onUpdatePreferences({
                  locationOnlyDuringEmergency:
                    !user.preferences.locationOnlyDuringEmergency,
                })
              }
            />
            <ToggleRow
              label="Discreet Notification Text"
              description="Hide detailed alert text inside notification previews"
              checked={user.preferences.maskLockscreenPreviews}
              onToggle={() =>
                onUpdatePreferences({
                  maskLockscreenPreviews: !user.preferences.maskLockscreenPreviews,
                })
              }
            />
          </div>
        </div>

        {/* Logout */}
        <div className="pt-2 border-t border-[#DCE5D1] flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#54634D]">
            Your safety profile stays saved so you can sign back in anytime.
          </p>
          <button
            type="button"
            onClick={onLogout}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
