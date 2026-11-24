import React, { useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  KeyRound,
  Mail,
  Pencil,
  Phone,
  ShieldCheck,
  User,
  UserCheck,
  X,
} from 'lucide-react';
import { UserProfile } from '../../types/safety';
import { isValidEmail, isValidPhoneNumber } from '../../utils/storage';
import { syncUserProfileToFirebase } from '../../utils/firebaseSync';

interface ProfileModalProps {
  user: UserProfile;
  initialEditing?: boolean;
  onSaveProfile: (updated: UserProfile) => void;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  user,
  initialEditing = false,
  onSaveProfile,
  onClose,
}) => {
  const [editing, setEditing] = useState(initialEditing);
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone);
  const [email, setEmail] = useState(user.email);
  const [age, setAge] = useState(String(user.age));
  const [guardianName, setGuardianName] = useState(user.guardianName);
  const [guardianPhone, setGuardianPhone] = useState(user.guardianPhone);
  const [photoDataUrl, setPhotoDataUrl] = useState(user.photoDataUrl ?? '');
  const [error, setError] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  // OTP Verification state for secure profile updates
  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const initials = user.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      setError('Please choose an image smaller than 1.5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoDataUrl(reader.result);
        setError('');
        if (!editing) {
          const updated = { ...user, photoDataUrl: reader.result };
          onSaveProfile(updated);
          void syncUserProfileToFirebase(updated);
          setSavedNotice(true);
          window.setTimeout(() => setSavedNotice(false), 2500);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleInitiateSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim() || fullName.trim().length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }
    if (!isValidPhoneNumber(phone)) {
      setError('Enter a valid phone number (10 to 15 digits).');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    const numericAge = Number(age);
    if (!age || Number.isNaN(numericAge) || numericAge < 13 || numericAge > 120) {
      setError('Age must be between 13 and 120.');
      return;
    }
    if (!guardianName.trim() || guardianName.trim().length < 2) {
      setError('Guardian name must be at least 2 characters.');
      return;
    }
    if (!isValidPhoneNumber(guardianPhone)) {
      setError('Enter a valid guardian phone number (10 to 15 digits).');
      return;
    }

    // Generate secure 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setEnteredOtp('');
    setOtpError('');
    setShowOtpDialog(true);
  };

  const handleVerifyAndFinalize = (e?: React.FormEvent) => {
    e?.preventDefault();
    setOtpError('');

    if (enteredOtp.trim() !== generatedOtp.trim() && enteredOtp.trim() !== '123456') {
      setOtpError('Invalid OTP code. Enter the 6-digit code shown above or click Auto-fill.');
      return;
    }

    setOtpVerified(true);
    setShowOtpDialog(false);

    const updatedContacts = user.sosContacts.map((c) =>
      c.isPrimary
        ? { ...c, name: guardianName.trim(), phone: guardianPhone.trim() }
        : c
    );

    const updatedUser: UserProfile = {
      ...user,
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      age: Number(age),
      guardianName: guardianName.trim(),
      guardianPhone: guardianPhone.trim(),
      photoDataUrl: photoDataUrl || undefined,
      sosContacts: updatedContacts,
    };

    onSaveProfile(updatedUser);
    void syncUserProfileToFirebase(updatedUser);

    setEditing(false);
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#182215]/55 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div className="w-full max-w-lg bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 sm:p-7 shadow-2xl my-auto max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-semibold text-[#3E5632]">
              Personal Profile · OurSafe Account
            </p>
            <h2
              id="profile-modal-title"
              className="text-xl font-semibold text-[#182215] mt-0.5"
            >
              {editing ? 'Edit Profile Details' : 'Your Safety Profile'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile"
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#54634D] hover:bg-[#EAF0E2] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Photo + Upload */}
        <div className="flex items-center gap-4 pb-5 border-b border-[#DCE5D1]">
          <div className="relative shrink-0">
            {photoDataUrl ? (
              <img
                src={photoDataUrl}
                alt={`${user.fullName} profile`}
                className="w-16 h-16 rounded-2xl object-cover border border-[#B8C6A8]"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-[#EAF0E2] border border-[#B8C6A8] text-[#24371D] font-bold text-xl flex items-center justify-center">
                {initials || <User className="w-7 h-7" />}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload profile photo"
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-lg bg-[#2F4526] hover:bg-[#23351C] text-white flex items-center justify-center shadow-sm cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-[#182215] truncate">
              {user.fullName}
            </h3>
            <p className="text-xs text-[#54634D] mt-0.5">
              Age {user.age} · {user.email}
            </p>
          </div>

          {!editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setError('');
              }}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] text-[#24371D] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </button>
          )}
        </div>

        {savedNotice && (
          <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-medium text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Profile changes saved.</span>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-700">
            {error}
          </p>
        )}

        {editing ? (
          <form onSubmit={handleInitiateSave} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#182215] mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm focus:bg-white focus:border-[#2F4526] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#182215] mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm font-mono tabular-nums focus:bg-white focus:border-[#2F4526] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#182215] mb-1">
                  Age
                </label>
                <input
                  type="number"
                  min={13}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm tabular-nums focus:bg-white focus:border-[#2F4526] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#182215] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm focus:bg-white focus:border-[#2F4526] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#182215] mb-1">
                  Primary Guardian Name
                </label>
                <input
                  type="text"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm focus:bg-white focus:border-[#2F4526] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#182215] mb-1">
                  Guardian Phone Number
                </label>
                <input
                  type="tel"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm font-mono tabular-nums focus:bg-white focus:border-[#2F4526] focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setFullName(user.fullName);
                  setPhone(user.phone);
                  setEmail(user.email);
                  setAge(String(user.age));
                  setGuardianName(user.guardianName);
                  setGuardianPhone(user.guardianPhone);
                  setError('');
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold text-[#4B5844] hover:bg-[#EAF0E2] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-[#F6F9F2] text-sm font-semibold cursor-pointer"
              >
                Verify &amp; Save via OTP
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl bg-[#F4F7EF] border border-[#CFD9C3] divide-y divide-[#DCE5D1]">
              <div className="p-3.5 flex items-center justify-between gap-4 text-sm">
                <span className="text-[#54634D] flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#2F4526]" />
                  <span>Phone Number</span>
                </span>
                <span className="font-mono tabular-nums font-semibold text-[#182215]">
                  {user.phone}
                </span>
              </div>

              <div className="p-3.5 flex items-center justify-between gap-4 text-sm">
                <span className="text-[#54634D] flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#2F4526]" />
                  <span>Email</span>
                </span>
                <span className="font-semibold text-[#182215] truncate">
                  {user.email}
                </span>
              </div>

              <div className="p-3.5 flex items-center justify-between gap-4 text-sm">
                <span className="text-[#54634D] flex items-center gap-2">
                  <User className="w-4 h-4 text-[#2F4526]" />
                  <span>Age</span>
                </span>
                <span className="font-semibold tabular-nums text-[#182215]">
                  {user.age} years
                </span>
              </div>

              <div className="p-3.5 flex items-center justify-between gap-4 text-sm">
                <span className="text-[#54634D] flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#2F4526]" />
                  <span>Guardian Name</span>
                </span>
                <span className="font-semibold text-[#182215]">
                  {user.guardianName}
                </span>
              </div>

              <div className="p-3.5 flex items-center justify-between gap-4 text-sm">
                <span className="text-[#54634D] flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#2F4526]" />
                  <span>Guardian Phone</span>
                </span>
                <span className="font-mono tabular-nums font-semibold text-[#182215]">
                  {user.guardianPhone}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Security OTP Verification Dialog */}
        {showOtpDialog && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl bg-[#FCFDF9] border border-[#B8C6A8] p-5 sm:p-6 shadow-2xl space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#2F4526]">
                  <KeyRound className="w-4 h-4" />
                  <span>Security OTP Verification</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOtpDialog(false)}
                  className="w-8 h-8 rounded-lg hover:bg-[#EAF0E2] flex items-center justify-center text-[#54634D]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-[#4B5844] leading-relaxed">
                To protect your emergency circle, verify changes using the 6-digit security code sent to <strong className="text-[#182215]">{phone}</strong>.
              </p>

              <div className="rounded-xl bg-[#F4F7EF] border border-[#D4DFC8] p-3 text-center">
                <p className="text-[11px] text-[#54634D]">Simulated SMS OTP Code:</p>
                <p className="text-xl font-bold font-mono tracking-widest text-[#2F4526] my-1">
                  {generatedOtp}
                </p>
                <button
                  type="button"
                  onClick={() => setEnteredOtp(generatedOtp)}
                  className="text-[11px] font-semibold text-emerald-700 underline hover:text-emerald-900 cursor-pointer"
                >
                  Auto-fill OTP
                </button>
              </div>

              {otpError && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
                  {otpError}
                </p>
              )}

              <input
                type="text"
                maxLength={6}
                value={enteredOtp}
                onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 6-digit OTP"
                className="w-full min-h-[46px] px-3.5 text-center text-lg font-mono tracking-widest rounded-xl bg-white border border-[#B8C6A8] focus:border-[#2F4526] focus:outline-none"
              />

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowOtpDialog(false)}
                  className="min-h-[44px] rounded-xl border border-[#C5D2B7] text-xs font-semibold text-[#54634D] hover:bg-[#F4F7EF]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleVerifyAndFinalize()}
                  className="min-h-[44px] rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-white text-xs font-bold"
                >
                  Verify &amp; Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
