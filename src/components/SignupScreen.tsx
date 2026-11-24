import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
  Smartphone,
  UserCheck,
} from 'lucide-react';
import { UserProfile } from '../types/safety';
import {
  DEFAULT_PREFERENCES,
  generateDemoOtp,
  isValidEmail,
  isValidPhoneNumber,
  normalizePhone,
  registerUser,
} from '../utils/storage';
import { syncUserProfileToFirebase } from '../utils/firebaseSync';
import { BrandLogo } from './BrandLogo';

interface SignupScreenProps {
  onSignupComplete: (user: UserProfile) => void;
  onNavigateLogin: () => void;
}

interface OtpState {
  generatedCode: string | null;
  enteredCode: string;
  verified: boolean;
  verifiedForPhone: string | null;
  feedback: string;
  error: string;
}

const INITIAL_OTP: OtpState = {
  generatedCode: null,
  enteredCode: '',
  verified: false,
  verifiedForPhone: null,
  feedback: '',
  error: '',
};

export const SignupScreen: React.FC<SignupScreenProps> = ({
  onSignupComplete,
  onNavigateLogin,
}) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [age, setAge] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [userOtp, setUserOtp] = useState<OtpState>(INITIAL_OTP);
  const [guardianOtp, setGuardianOtp] = useState<OtpState>(INITIAL_OTP);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [createdUser, setCreatedUser] = useState<UserProfile | null>(null);

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    if (
      userOtp.verifiedForPhone &&
      normalizePhone(value) !== normalizePhone(userOtp.verifiedForPhone)
    ) {
      setUserOtp(INITIAL_OTP);
    }
    if (errors.phone) setErrors((p) => ({ ...p, phone: '' }));
  };

  const handleGuardianPhoneChange = (value: string) => {
    setGuardianPhone(value);
    if (
      guardianOtp.verifiedForPhone &&
      normalizePhone(value) !== normalizePhone(guardianOtp.verifiedForPhone)
    ) {
      setGuardianOtp(INITIAL_OTP);
    }
    if (errors.guardianPhone) setErrors((p) => ({ ...p, guardianPhone: '' }));
  };

  const handleSendOtp = (target: 'user' | 'guardian') => {
    const numberToVerify = target === 'user' ? phone : guardianPhone;
    const setter = target === 'user' ? setUserOtp : setGuardianOtp;

    if (!isValidPhoneNumber(numberToVerify)) {
      setter((prev) => ({
        ...prev,
        error: 'Enter a valid 10 to 15 digit phone number before requesting OTP.',
        feedback: '',
      }));
      return;
    }

    if (
      target === 'guardian' &&
      isValidPhoneNumber(phone) &&
      normalizePhone(phone) === normalizePhone(guardianPhone)
    ) {
      setter((prev) => ({
        ...prev,
        error: 'Guardian phone number must be different from your own phone number.',
        feedback: '',
      }));
      return;
    }

    const code = generateDemoOtp();
    setter({
      generatedCode: code,
      enteredCode: '',
      verified: false,
      verifiedForPhone: null,
      error: '',
      feedback: `6-digit verification code dispatched for ${numberToVerify.trim()}.`,
    });
  };

  const handleVerifyOtp = (target: 'user' | 'guardian') => {
    const state = target === 'user' ? userOtp : guardianOtp;
    const numberToVerify = target === 'user' ? phone : guardianPhone;
    const setter = target === 'user' ? setUserOtp : setGuardianOtp;

    if (!state.generatedCode) {
      setter((prev) => ({
        ...prev,
        error: 'Click "Send OTP" first to receive your 6-digit verification code.',
      }));
      return;
    }

    if (state.enteredCode.trim() !== state.generatedCode) {
      setter((prev) => ({
        ...prev,
        error: 'Incorrect 6-digit OTP code. Please check the code and try again.',
      }));
      return;
    }

    setter((prev) => ({
      ...prev,
      verified: true,
      verifiedForPhone: numberToVerify.trim(),
      error: '',
      feedback: 'Phone number verified.',
    }));
    setErrors((prev) => ({
      ...prev,
      [target === 'user' ? 'userOtp' : 'guardianOtp']: '',
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    const nextErrors: Record<string, string> = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      nextErrors.fullName = 'Enter your full name (at least 2 characters).';
    }
    if (!isValidPhoneNumber(phone)) {
      nextErrors.phone = 'Enter a valid phone number (10 to 15 digits).';
    }
    if (!isValidEmail(email)) {
      nextErrors.email = 'Enter a valid email address.';
    }
    const numericAge = Number(age);
    if (!age || Number.isNaN(numericAge) || numericAge < 13 || numericAge > 120) {
      nextErrors.age = 'Enter a valid age between 13 and 120.';
    }
    if (!guardianName.trim() || guardianName.trim().length < 2) {
      nextErrors.guardianName = 'Enter your primary guardian name.';
    }
    if (!isValidPhoneNumber(guardianPhone)) {
      nextErrors.guardianPhone = 'Enter a valid guardian phone number (10 to 15 digits).';
    } else if (
      isValidPhoneNumber(phone) &&
      normalizePhone(phone) === normalizePhone(guardianPhone)
    ) {
      nextErrors.guardianPhone =
        'Guardian phone number must be different from your phone number.';
    }
    if (password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters.';
    }
    if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }
    if (!userOtp.verified) {
      nextErrors.userOtp = 'Complete OTP verification for your phone number.';
    }
    if (!guardianOtp.verified) {
      nextErrors.guardianOtp = 'Complete OTP verification for your guardian phone number.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSubmitError('Please review the highlighted fields and complete both OTP verifications.');
      return;
    }

    const profile: UserProfile = {
      id: `user-${Date.now()}`,
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      age: numericAge,
      guardianName: guardianName.trim(),
      guardianPhone: guardianPhone.trim(),
      password,
      createdAt: new Date().toISOString(),
      sosContacts: [
        {
          id: `contact-${Date.now()}`,
          name: guardianName.trim(),
          phone: guardianPhone.trim(),
          relation: 'Primary Guardian',
          isPrimary: true,
        },
      ],
      preferences: { ...DEFAULT_PREFERENCES },
    };

    const result = registerUser(profile);
    if (!result.ok) {
      setSubmitError(result.error ?? 'Could not complete registration.');
      return;
    }

    void syncUserProfileToFirebase(profile);
    setCreatedUser(profile);
  };

  if (createdUser) {
    return (
      <div className="min-h-screen oursafe-canvas-bg flex flex-col">
        <header className="w-full border-b border-[#B8C6A8] bg-[#FCFDF9]/95 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <BrandLogo />
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-lg bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 sm:p-10 shadow-sm text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <p className="text-xs font-semibold text-emerald-700">
              Registration Complete · Safety Profile Active
            </p>
            <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-[#182215]">
              Welcome to OurSafe, {createdUser.fullName}
            </h1>
            <p className="mt-3 text-sm text-[#4B5844] leading-relaxed">
              Your personal profile and primary guardian ({createdUser.guardianName}) are verified and ready across SOS, Threat Mode, Travel Mode, and AI Voice Control.
            </p>

            <div className="mt-6 rounded-2xl bg-[#F4F7EF] border border-[#D4DFC8] p-4 text-left space-y-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#4B5844]">Your Phone</span>
                <span className="font-mono tabular-nums font-semibold text-[#182215]">
                  {createdUser.phone}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#4B5844]">Primary Guardian</span>
                <span className="font-semibold text-[#182215]">
                  {createdUser.guardianName}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#4B5844]">Guardian Phone</span>
                <span className="font-mono tabular-nums font-semibold text-[#182215]">
                  {createdUser.guardianPhone}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSignupComplete(createdUser)}
              className="mt-7 w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-[#F6F9F2] text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Continue to OurSafe Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen oursafe-canvas-bg flex flex-col">
      {/* Top Bar */}
      <header className="w-full border-b border-[#B8C6A8] bg-[#FCFDF9]/95 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <BrandLogo />
          <button
            type="button"
            onClick={onNavigateLogin}
            className="min-h-[44px] px-4 py-2 text-sm font-semibold text-[#24371D] hover:bg-[#EAF0E2] rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Sign In</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Context Summary */}
          <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
            <div className="bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 space-y-4">
              <p className="text-xs font-semibold text-[#3E5632]">
                OurSafe Onboarding
              </p>
              <h1 className="text-2xl sm:text-3xl font-semibold text-[#182215] leading-tight">
                Create your personal safety profile
              </h1>
              <p className="text-sm text-[#4B5844] leading-relaxed">
                Register your details and verify a trusted primary guardian so Travel Mode, Threat Mode, AI Police Lookup, and Dual SOS Calling are ready immediately.
              </p>

              <div className="rounded-2xl bg-[#F4F7EF] border border-[#D4DFC8] p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#182215]">
                  <ShieldCheck className="w-4 h-4 text-[#2F4526] shrink-0" />
                  <span>Privacy-First Protection</span>
                </div>
                <p className="text-xs text-[#465340] leading-relaxed">
                  Your profile, emergency circle, and evidence vault stay under your control and remain accessible offline for immediate emergency calling.
                </p>
              </div>
            </div>
          </aside>

          {/* Right Full Registration Form */}
          <section className="lg:col-span-8 bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 sm:p-8 shadow-sm shadow-[#182215]/[0.03]">
            {submitError && (
              <div
                role="alert"
                className="mb-6 rounded-2xl bg-red-50 border border-red-200 p-4 flex items-start gap-2.5 text-sm text-red-800"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-8">
              {/* Section 1: Personal Details */}
              <div>
                <h2 className="text-lg font-semibold text-[#182215]">
                  1. Personal Details
                </h2>
                <p className="text-xs text-[#54634D] mt-0.5">
                  Used for your dashboard profile and emergency identification
                </p>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="reg-fullname"
                      className="block text-sm font-semibold text-[#182215] mb-1.5"
                    >
                      Full Name
                    </label>
                    <input
                      id="reg-fullname"
                      type="text"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (errors.fullName) setErrors((p) => ({ ...p, fullName: '' }));
                      }}
                      placeholder="Enter your full name"
                      className={`w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#F4F7EF] border text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2F4526]/20 ${
                        errors.fullName
                          ? 'border-red-400'
                          : 'border-[#C5D2B7] focus:border-[#2F4526]'
                      }`}
                    />
                    {errors.fullName && (
                      <p className="mt-1 text-xs text-red-600 font-medium">{errors.fullName}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="reg-phone"
                      className="block text-sm font-semibold text-[#182215] mb-1.5"
                    >
                      Phone Number
                    </label>
                    <input
                      id="reg-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className={`w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#F4F7EF] border text-sm font-mono tabular-nums focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2F4526]/20 ${
                        errors.phone
                          ? 'border-red-400'
                          : 'border-[#C5D2B7] focus:border-[#2F4526]'
                      }`}
                    />
                    {errors.phone && (
                      <p className="mt-1 text-xs text-red-600 font-medium">{errors.phone}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="reg-age"
                      className="block text-sm font-semibold text-[#182215] mb-1.5"
                    >
                      Age
                    </label>
                    <input
                      id="reg-age"
                      type="number"
                      min={13}
                      max={120}
                      value={age}
                      onChange={(e) => {
                        setAge(e.target.value);
                        if (errors.age) setErrors((p) => ({ ...p, age: '' }));
                      }}
                      placeholder="e.g. 24"
                      className={`w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#F4F7EF] border text-sm tabular-nums focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2F4526]/20 ${
                        errors.age
                          ? 'border-red-400'
                          : 'border-[#C5D2B7] focus:border-[#2F4526]'
                      }`}
                    />
                    {errors.age && (
                      <p className="mt-1 text-xs text-red-600 font-medium">{errors.age}</p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="reg-email"
                      className="block text-sm font-semibold text-[#182215] mb-1.5"
                    >
                      Email Address
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) setErrors((p) => ({ ...p, email: '' }));
                      }}
                      placeholder="you@domain.com"
                      className={`w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#F4F7EF] border text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2F4526]/20 ${
                        errors.email
                          ? 'border-red-400'
                          : 'border-[#C5D2B7] focus:border-[#2F4526]'
                      }`}
                    />
                    {errors.email && (
                      <p className="mt-1 text-xs text-red-600 font-medium">{errors.email}</p>
                    )}
                  </div>
                </div>
              </div>

              <hr className="border-[#DCE5D1]" />

              {/* Section 2: Primary Guardian Details */}
              <div>
                <h2 className="text-lg font-semibold text-[#182215]">
                  2. Primary Guardian Information
                </h2>
                <p className="text-xs text-[#54634D] mt-0.5">
                  Automatically linked as your primary SOS and Travel Mode emergency contact
                </p>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="reg-guardian-name"
                      className="block text-sm font-semibold text-[#182215] mb-1.5"
                    >
                      Guardian Name
                    </label>
                    <input
                      id="reg-guardian-name"
                      type="text"
                      value={guardianName}
                      onChange={(e) => {
                        setGuardianName(e.target.value);
                        if (errors.guardianName)
                          setErrors((p) => ({ ...p, guardianName: '' }));
                      }}
                      placeholder="Trusted family member or friend"
                      className={`w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#F4F7EF] border text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2F4526]/20 ${
                        errors.guardianName
                          ? 'border-red-400'
                          : 'border-[#C5D2B7] focus:border-[#2F4526]'
                      }`}
                    />
                    {errors.guardianName && (
                      <p className="mt-1 text-xs text-red-600 font-medium">
                        {errors.guardianName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="reg-guardian-phone"
                      className="block text-sm font-semibold text-[#182215] mb-1.5"
                    >
                      Guardian Phone Number
                    </label>
                    <input
                      id="reg-guardian-phone"
                      type="tel"
                      value={guardianPhone}
                      onChange={(e) => handleGuardianPhoneChange(e.target.value)}
                      placeholder="e.g. 9820112233"
                      className={`w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#F4F7EF] border text-sm font-mono tabular-nums focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2F4526]/20 ${
                        errors.guardianPhone
                          ? 'border-red-400'
                          : 'border-[#C5D2B7] focus:border-[#2F4526]'
                      }`}
                    />
                    {errors.guardianPhone && (
                      <p className="mt-1 text-xs text-red-600 font-medium">
                        {errors.guardianPhone}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <hr className="border-[#DCE5D1]" />

              {/* Section 3: Phone Number OTP Verification */}
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold text-[#182215]">
                    3. Phone Number Verification
                  </h2>
                  <span className="text-xs font-medium text-[#3E5632]">
                    6-Digit Security Code
                  </span>
                </div>
                <p className="text-xs text-[#54634D] mt-1">
                  Verify both your phone number and your guardian&apos;s phone number to activate emergency calling and alerts.
                </p>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* User Phone OTP */}
                  <div className="rounded-2xl bg-[#F4F7EF] border border-[#C5D2B7] p-4 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-[#182215] flex items-center gap-1.5">
                          <Smartphone className="w-4 h-4 text-[#2F4526] shrink-0" />
                          <span>User Phone OTP</span>
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            userOtp.verified ? 'text-emerald-700' : 'text-[#54634D]'
                          }`}
                        >
                          {userOtp.verified ? 'Verified' : 'Pending'}
                        </span>
                      </div>

                      <p className="text-xs text-[#4B5844] mt-1 font-mono tabular-nums">
                        {phone.trim() || 'Enter your phone number above'}
                      </p>

                      {userOtp.generatedCode && !userOtp.verified && (
                        <div className="mt-2.5 rounded-xl bg-[#EAF0E2] border border-[#B8C6A8] px-3 py-2 text-xs text-[#182215] flex items-center justify-between gap-2">
                          <span>
                            Verification Code:{' '}
                            <span className="font-mono font-bold tracking-wider tabular-nums">
                              {userOtp.generatedCode}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setUserOtp((p) => ({
                                ...p,
                                enteredCode: p.generatedCode ?? '',
                                error: '',
                              }))
                            }
                            className="text-[11px] font-semibold text-[#2F4526] underline cursor-pointer"
                          >
                            Auto-fill
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          disabled={userOtp.verified}
                          value={userOtp.enteredCode}
                          onChange={(e) =>
                            setUserOtp((prev) => ({
                              ...prev,
                              enteredCode: e.target.value.replace(/\D/g, ''),
                              error: '',
                            }))
                          }
                          placeholder="6-digit OTP"
                          aria-label="User phone OTP"
                          className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white border border-[#C5D2B7] text-sm font-mono tabular-nums focus:border-[#2F4526] focus:outline-none disabled:bg-[#EAF0E2]/60 disabled:text-[#54634D]"
                        />
                        <button
                          type="button"
                          onClick={() => handleSendOtp('user')}
                          disabled={userOtp.verified}
                          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] text-[#24371D] text-xs font-semibold whitespace-nowrap shrink-0 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {userOtp.generatedCode ? 'Resend' : 'Send OTP'}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleVerifyOtp('user')}
                        disabled={userOtp.verified}
                        className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-[#F6F9F2] text-xs font-semibold transition-colors disabled:bg-emerald-600 disabled:cursor-default cursor-pointer"
                      >
                        {userOtp.verified ? 'User Phone Verified' : 'Verify User OTP'}
                      </button>

                      {userOtp.error && (
                        <p className="text-xs text-red-600 font-medium">{userOtp.error}</p>
                      )}
                      {errors.userOtp && !userOtp.error && (
                        <p className="text-xs text-red-600 font-medium">{errors.userOtp}</p>
                      )}
                      {userOtp.feedback && !userOtp.error && (
                        <p className="text-xs text-emerald-700 font-medium">
                          {userOtp.feedback}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Guardian Phone OTP */}
                  <div className="rounded-2xl bg-[#F4F7EF] border border-[#C5D2B7] p-4 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-[#182215] flex items-center gap-1.5">
                          <UserCheck className="w-4 h-4 text-[#2F4526] shrink-0" />
                          <span>Guardian Phone OTP</span>
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            guardianOtp.verified ? 'text-emerald-700' : 'text-[#54634D]'
                          }`}
                        >
                          {guardianOtp.verified ? 'Verified' : 'Pending'}
                        </span>
                      </div>

                      <p className="text-xs text-[#4B5844] mt-1 font-mono tabular-nums">
                        {guardianPhone.trim() || 'Enter guardian phone number above'}
                      </p>

                      {guardianOtp.generatedCode && !guardianOtp.verified && (
                        <div className="mt-2.5 rounded-xl bg-[#EAF0E2] border border-[#B8C6A8] px-3 py-2 text-xs text-[#182215] flex items-center justify-between gap-2">
                          <span>
                            Verification Code:{' '}
                            <span className="font-mono font-bold tracking-wider tabular-nums">
                              {guardianOtp.generatedCode}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setGuardianOtp((p) => ({
                                ...p,
                                enteredCode: p.generatedCode ?? '',
                                error: '',
                              }))
                            }
                            className="text-[11px] font-semibold text-[#2F4526] underline cursor-pointer"
                          >
                            Auto-fill
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          disabled={guardianOtp.verified}
                          value={guardianOtp.enteredCode}
                          onChange={(e) =>
                            setGuardianOtp((prev) => ({
                              ...prev,
                              enteredCode: e.target.value.replace(/\D/g, ''),
                              error: '',
                            }))
                          }
                          placeholder="6-digit OTP"
                          aria-label="Guardian phone OTP"
                          className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white border border-[#C5D2B7] text-sm font-mono tabular-nums focus:border-[#2F4526] focus:outline-none disabled:bg-[#EAF0E2]/60 disabled:text-[#54634D]"
                        />
                        <button
                          type="button"
                          onClick={() => handleSendOtp('guardian')}
                          disabled={guardianOtp.verified}
                          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] text-[#24371D] text-xs font-semibold whitespace-nowrap shrink-0 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {guardianOtp.generatedCode ? 'Resend' : 'Send OTP'}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleVerifyOtp('guardian')}
                        disabled={guardianOtp.verified}
                        className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-[#F6F9F2] text-xs font-semibold transition-colors disabled:bg-emerald-600 disabled:cursor-default cursor-pointer"
                      >
                        {guardianOtp.verified
                          ? 'Guardian Phone Verified'
                          : 'Verify Guardian OTP'}
                      </button>

                      {guardianOtp.error && (
                        <p className="text-xs text-red-600 font-medium">{guardianOtp.error}</p>
                      )}
                      {errors.guardianOtp && !guardianOtp.error && (
                        <p className="text-xs text-red-600 font-medium">
                          {errors.guardianOtp}
                        </p>
                      )}
                      {guardianOtp.feedback && !guardianOtp.error && (
                        <p className="text-xs text-emerald-700 font-medium">
                          {guardianOtp.feedback}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <hr className="border-[#DCE5D1]" />

              {/* Section 4: Account Security */}
              <div>
                <h2 className="text-lg font-semibold text-[#182215]">
                  4. Account Security
                </h2>
                <p className="text-xs text-[#54634D] mt-0.5">
                  Set a password to protect your profile and Emergency Evidence History
                </p>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="reg-password"
                      className="block text-sm font-semibold text-[#182215] mb-1.5"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="reg-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (errors.password) setErrors((p) => ({ ...p, password: '' }));
                        }}
                        placeholder="At least 6 characters"
                        className={`w-full min-h-[46px] pl-4 pr-11 py-2.5 rounded-xl bg-[#F4F7EF] border text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2F4526]/20 ${
                          errors.password
                            ? 'border-red-400'
                            : 'border-[#C5D2B7] focus:border-[#2F4526]'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[40px] min-h-[40px] flex items-center justify-center text-[#54634D] hover:text-[#24371D] rounded-lg cursor-pointer"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="mt-1 text-xs text-red-600 font-medium">
                        {errors.password}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="reg-confirm-password"
                      className="block text-sm font-semibold text-[#182215] mb-1.5"
                    >
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        id="reg-confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (errors.confirmPassword)
                            setErrors((p) => ({ ...p, confirmPassword: '' }));
                        }}
                        placeholder="Re-enter password"
                        className={`w-full min-h-[46px] pl-4 pr-11 py-2.5 rounded-xl bg-[#F4F7EF] border text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2F4526]/20 ${
                          errors.confirmPassword
                            ? 'border-red-400'
                            : 'border-[#C5D2B7] focus:border-[#2F4526]'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((p) => !p)}
                        aria-label={
                          showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                        }
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[40px] min-h-[40px] flex items-center justify-center text-[#54634D] hover:text-[#24371D] rounded-lg cursor-pointer"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="mt-1 text-xs text-red-600 font-medium">
                        {errors.confirmPassword}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs text-[#54634D]">
                  Already registered?{' '}
                  <button
                    type="button"
                    onClick={onNavigateLogin}
                    className="font-semibold text-[#2F4526] hover:underline cursor-pointer"
                  >
                    Sign in here
                  </button>
                </p>
                <button
                  type="submit"
                  className="w-full sm:w-auto min-h-[48px] px-7 py-3 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-[#F6F9F2] text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm shadow-[#182215]/15 cursor-pointer whitespace-nowrap"
                >
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
};
