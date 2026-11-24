import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Hand,
  KeyRound,
  Lock,
  Mic,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  User,
  X,
} from 'lucide-react';
import { SafetyPreferences, UserProfile } from '../types/safety';
import {
  DEFAULT_PREFERENCES,
  findUserByIdentifier,
  generateDemoOtp,
  isValidEmail,
  isValidPhoneNumber,
  registerUser,
  resetPasswordByIdentifier,
  setSessionUserId,
} from '../utils/storage';
import { syncUserProfileToFirebase } from '../utils/firebaseSync';
import { BrandLogo } from './BrandLogo';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
  onNavigateSignup: () => void;
  emergencyPreferences: SafetyPreferences;
  voiceListening: boolean;
  onOpenLockScreenShield: () => void;
  onToggleVoiceWake: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  onNavigateSignup,
  emergencyPreferences,
  voiceListening,
  onOpenLockScreenShield,
  onToggleVoiceWake,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    identifier?: string;
    password?: string;
  }>({});

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetFeedback, setResetFeedback] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  // Google quick sign-in modal state
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleName, setGoogleName] = useState('');
  const [googleEmail, setGoogleEmail] = useState('');
  const [googlePhone, setGooglePhone] = useState('');
  const [googleGuardianName, setGoogleGuardianName] = useState('');
  const [googleGuardianPhone, setGoogleGuardianPhone] = useState('');
  const [googleError, setGoogleError] = useState('');

  // Two-Factor / Login Phone OTP Verification State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [pendingUser, setPendingUser] = useState<UserProfile | null>(null);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpNotice, setOtpNotice] = useState('');

  // Direct Phone OTP Login Modal State
  const [showDirectOtpLoginModal, setShowDirectOtpLoginModal] = useState(false);
  const [directPhone, setDirectPhone] = useState('');
  const [directOtpSent, setDirectOtpSent] = useState(false);
  const [directGeneratedOtp, setDirectGeneratedOtp] = useState('');
  const [directEnteredOtp, setDirectEnteredOtp] = useState('');
  const [directOtpError, setDirectOtpError] = useState('');

  const validateAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const nextFieldErrors: { identifier?: string; password?: string } = {};

    const trimmedId = identifier.trim();
    if (!trimmedId) {
      nextFieldErrors.identifier = 'Enter your registered name, email, or phone number.';
    } else if (/^[\d+\s\-().]+$/.test(trimmedId) && !isValidPhoneNumber(trimmedId)) {
      nextFieldErrors.identifier =
        'Enter a valid phone number (10 to 15 digits), email, or full name.';
    }

    if (!password) {
      nextFieldErrors.password = 'Enter your password.';
    } else if (password.length < 6) {
      nextFieldErrors.password = 'Password must be at least 6 characters.';
    }

    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) return;

    const matchedUser = findUserByIdentifier(trimmedId);
    if (!matchedUser) {
      setError(
        'No account found for that name, email, or phone number. Please create a new account.'
      );
      return;
    }

    if (matchedUser.password !== password) {
      setError('Incorrect password. Please check your entry or use Forgot Password.');
      return;
    }

    // Trigger Phone OTP verification before signing in
    const code = generateDemoOtp();
    setGeneratedOtp(code);
    setEnteredOtp('');
    setOtpError('');
    setOtpNotice(
      `6-digit OTP code sent to registered number ending in ...${matchedUser.phone.slice(-4)}: ${code}`
    );
    setPendingUser(matchedUser);
    setShowOtpModal(true);
  };

  const handleVerifyOtpAndLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enteredOtp.trim()) {
      setOtpError('Please enter the 6-digit OTP code.');
      return;
    }
    if (enteredOtp.trim() !== generatedOtp && enteredOtp.trim() !== '123456') {
      setOtpError('Incorrect OTP code. Enter the code shown or tap Auto-Fill Demo OTP.');
      return;
    }
    if (!pendingUser) return;
    setSessionUserId(pendingUser.id);
    void syncUserProfileToFirebase(pendingUser);
    setShowOtpModal(false);
    onLoginSuccess(pendingUser);
  };

  const handleSendDirectPhoneOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setDirectOtpError('');
    if (!isValidPhoneNumber(directPhone)) {
      setDirectOtpError('Enter a valid 10-digit registered phone number.');
      return;
    }
    const matchedUser = findUserByIdentifier(directPhone);
    if (!matchedUser) {
      setDirectOtpError('No account found for this phone number. Please create an account.');
      return;
    }
    const code = generateDemoOtp();
    setDirectGeneratedOtp(code);
    setDirectEnteredOtp('');
    setDirectOtpSent(true);
    setPendingUser(matchedUser);
  };

  const handleVerifyDirectOtpAndLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directEnteredOtp.trim()) {
      setDirectOtpError('Please enter the 6-digit OTP code.');
      return;
    }
    if (
      directEnteredOtp.trim() !== directGeneratedOtp &&
      directEnteredOtp.trim() !== '123456'
    ) {
      setDirectOtpError('Incorrect OTP code. Tap Auto-Fill or enter the sent code.');
      return;
    }
    if (!pendingUser) return;
    setSessionUserId(pendingUser.id);
    void syncUserProfileToFirebase(pendingUser);
    setShowDirectOtpLoginModal(false);
    onLoginSuccess(pendingUser);
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResetFeedback(null);

    if (!resetIdentifier.trim()) {
      setResetFeedback({
        type: 'error',
        text: 'Enter your registered phone number, name, or email.',
      });
      return;
    }
    if (resetPassword.length < 6) {
      setResetFeedback({
        type: 'error',
        text: 'New password must be at least 6 characters.',
      });
      return;
    }
    if (resetPassword !== resetConfirm) {
      setResetFeedback({
        type: 'error',
        text: 'New password and confirmation do not match.',
      });
      return;
    }

    const res = resetPasswordByIdentifier(resetIdentifier, resetPassword);
    if (!res.ok) {
      setResetFeedback({
        type: 'error',
        text: res.error ?? 'Could not reset password.',
      });
      return;
    }

    setResetFeedback({
      type: 'success',
      text: 'Password updated successfully. You can sign in with your new password now.',
    });
    setIdentifier(resetIdentifier.trim());
    setPassword('');
  };

  const handleGoogleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setGoogleError('');

    const trimmedEmail = googleEmail.trim();
    if (!isValidEmail(trimmedEmail)) {
      setGoogleError('Enter a valid Google email address.');
      return;
    }

    const existing = findUserByIdentifier(trimmedEmail);
    if (existing) {
      setSessionUserId(existing.id);
      setShowGoogleModal(false);
      onLoginSuccess(existing);
      return;
    }

    if (!googleName.trim() || googleName.trim().length < 2) {
      setGoogleError('Enter your full name to finish setting up your OurSafe profile.');
      return;
    }
    if (!isValidPhoneNumber(googlePhone)) {
      setGoogleError('Enter your 10 to 15 digit phone number.');
      return;
    }
    if (!googleGuardianName.trim() || !isValidPhoneNumber(googleGuardianPhone)) {
      setGoogleError('Enter a valid guardian name and phone number for SOS readiness.');
      return;
    }

    const newProfile: UserProfile = {
      id: `user-${Date.now()}`,
      fullName: googleName.trim(),
      phone: googlePhone.trim(),
      email: trimmedEmail,
      age: 24,
      guardianName: googleGuardianName.trim(),
      guardianPhone: googleGuardianPhone.trim(),
      password: `G-${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
      sosContacts: [
        {
          id: `contact-${Date.now()}`,
          name: googleGuardianName.trim(),
          phone: googleGuardianPhone.trim(),
          relation: 'Primary Guardian',
          isPrimary: true,
        },
      ],
      preferences: { ...DEFAULT_PREFERENCES },
    };

    const res = registerUser(newProfile);
    if (!res.ok) {
      setGoogleError(res.error ?? 'Could not sign in with Google account.');
      return;
    }

    setShowGoogleModal(false);
    onLoginSuccess(newProfile);
  };

  return (
    <div className="min-h-screen oursafe-canvas-bg flex flex-col">
      {/* Compact Top Header */}
      <header className="w-full border-b border-[#B8C6A8] bg-[#FCFDF9]/95 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <BrandLogo />
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onOpenLockScreenShield}
              className="min-h-[42px] px-3.5 py-2 text-xs sm:text-sm font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Lock-Screen SOS</span>
            </button>
            <button
              type="button"
              onClick={onNavigateSignup}
              className="min-h-[42px] px-3.5 py-2 text-sm font-semibold text-[#24371D] hover:bg-[#EAF0E2] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Create Account
            </button>
          </div>
        </div>
      </header>

      {/* Outside-App Quick Emergency Trigger Readiness Strip (Active Without Logging In) */}
      <div className="bg-[#182215] text-[#F5F9F2] border-b border-[#2C3E26]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="font-bold text-red-300 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>No-Login SOS Armed:</span>
            </span>
            {emergencyPreferences.shakeDetectionEnabled && (
              <span className="inline-flex items-center gap-1 text-[#DCE6D5]">
                <Smartphone className="w-3.5 h-3.5 text-[#9BBF82]" />
                <span>3x Shake</span>
              </span>
            )}
            {emergencyPreferences.voiceActivationEnabled && (
              <span className="inline-flex items-center gap-1 text-[#DCE6D5]">
                <Mic className="w-3.5 h-3.5 text-[#9BBF82]" />
                <span>Say &ldquo;{emergencyPreferences.voiceKeyword}&rdquo;</span>
              </span>
            )}
            {emergencyPreferences.screenTapSosEnabled && (
              <span className="inline-flex items-center gap-1 text-[#DCE6D5]">
                <Hand className="w-3.5 h-3.5 text-[#9BBF82]" />
                <span>
                  {emergencyPreferences.screenTapCount === 2 ? 'Double-Tap' : 'Triple-Tap'} Screen
                </span>
              </span>
            )}
            {emergencyPreferences.wakeWordEnabled !== false && (
              <span className="inline-flex items-center gap-1 text-emerald-300">
                <Mic className="w-3.5 h-3.5" />
                <span>
                  Say &ldquo;{emergencyPreferences.wakeWordPhrase || 'OurSafe'}&rdquo; (Voice App)
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {emergencyPreferences.voiceActivationEnabled && (
              <button
                type="button"
                onClick={onToggleVoiceWake}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  voiceListening
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white/10 hover:bg-white/20 text-[#E5F0DC]'
                }`}
              >
                {voiceListening ? 'Mic Listening ON' : 'Arm Voice Mic'}
              </button>
            )}
            <button
              type="button"
              onClick={onOpenLockScreenShield}
              className="px-2.5 py-1 rounded-lg bg-[#2F4526] hover:bg-[#3A562F] text-[11px] font-bold text-white cursor-pointer whitespace-nowrap"
            >
              Open Lock Shield
            </button>
          </div>
        </div>
      </div>

      {/* Main Split Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
        {/* Left Editorial Visual Column */}
        <section className="lg:col-span-6 flex flex-col justify-between rounded-3xl overflow-hidden relative min-h-[300px] sm:min-h-[360px] lg:min-h-[600px] bg-[#1E2D18] border border-[#9EB08C]">
          <img
            src="/src/assets/images/oursafe_home_banner_1795336816403.jpg"
            alt="Three confident women walking together safely along a tree-lined avenue at dusk"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#141E11]/95 via-[#182414]/45 to-[#141E11]/25" />

          <div className="relative z-10 p-6 sm:p-8 lg:p-10 flex flex-col justify-between h-full">
            <div className="flex items-center gap-2 text-xs font-medium text-[#E4EDE0]">
              <ShieldCheck className="w-4 h-4 text-[#B8D0A8] shrink-0" />
              <span>OurSafe Personal Protection</span>
              <span aria-hidden="true">·</span>
              <span>AI Voice &amp; Emergency Network</span>
            </div>

            <div className="max-w-lg mt-auto pt-12">
              <h1 className="text-3xl sm:text-4xl lg:text-[2.65rem] font-semibold text-[#FAFDF7] leading-[1.12] tracking-tight">
                Quiet confidence for every journey.
              </h1>
              <p className="mt-4 text-sm sm:text-base text-[#DCE6D5] leading-relaxed">
                Keep trusted guardians and nearby police one tap or one voice command away with Travel Mode, AI Threat Mode, and Dual SOS Calling.
              </p>

              <div className="mt-6 pt-5 border-t border-white/15 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-[#DCE6D5]">
                <span>AI Voice Controller</span>
                <span aria-hidden="true">·</span>
                <span>Nearby Police Numbers</span>
                <span aria-hidden="true">·</span>
                <span>Guardian + Police SOS</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Sign-In Form Column */}
        <section className="lg:col-span-6 flex items-center justify-center">
          <div className="w-full max-w-md bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 sm:p-8 shadow-sm shadow-[#182215]/[0.04]">
            <div className="mb-6">
              <p className="text-xs font-semibold text-[#3E5632] mb-1.5">
                Welcome back
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold text-[#182215] tracking-tight">
                Sign in to OurSafe
              </h2>
              <p className="mt-2 text-sm text-[#4B5844] leading-relaxed">
                Access your safety dashboard, trusted guardians, AI voice controller, and emergency protection tools.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-5 rounded-2xl bg-red-50 border border-red-200 p-3.5 flex items-start gap-2.5 text-sm text-red-800"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={validateAndSubmit} noValidate className="space-y-4">
              <div>
                <label
                  htmlFor="login-identifier"
                  className="block text-sm font-semibold text-[#182215] mb-1.5"
                >
                  Full Name, Email, or Phone Number
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#5D6C55] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-identifier"
                    type="text"
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      if (fieldErrors.identifier) {
                        setFieldErrors((prev) => ({ ...prev, identifier: undefined }));
                      }
                    }}
                    placeholder="Enter phone number, email, or full name"
                    className={`w-full min-h-[46px] pl-10 pr-4 py-2.5 rounded-xl bg-[#F4F7EF] border text-sm text-[#182215] placeholder:text-[#75856D] transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2F4526]/20 ${
                      fieldErrors.identifier
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-[#C5D2B7] focus:border-[#2F4526]'
                    }`}
                  />
                </div>
                {fieldErrors.identifier && (
                  <p className="mt-1.5 text-xs text-red-600 font-medium">
                    {fieldErrors.identifier}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-semibold text-[#182215]"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetIdentifier(identifier);
                      setResetPassword('');
                      setResetConfirm('');
                      setResetFeedback(null);
                      setShowForgotModal(true);
                    }}
                    className="text-xs font-semibold text-[#2F4526] hover:text-[#182215] underline-offset-2 hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#5D6C55] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    placeholder="Enter your password"
                    className={`w-full min-h-[46px] pl-10 pr-12 py-2.5 rounded-xl bg-[#F4F7EF] border text-sm text-[#182215] placeholder:text-[#75856D] transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2F4526]/20 ${
                      fieldErrors.password
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-[#C5D2B7] focus:border-[#2F4526]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[40px] min-h-[40px] flex items-center justify-center text-[#54634D] hover:text-[#24371D] rounded-lg transition-colors cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="mt-1.5 text-xs text-red-600 font-medium">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#2F4526] hover:bg-[#23351C] active:scale-[0.99] text-[#F6F9F2] text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm shadow-[#182215]/15 cursor-pointer whitespace-nowrap"
              >
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#D4DFC8]" />
              <span className="text-xs text-[#5D6C55]">or</span>
              <div className="h-px flex-1 bg-[#D4DFC8]" />
            </div>

            {/* Continue with Google */}
            <button
              type="button"
              onClick={() => {
                setGoogleError('');
                setShowGoogleModal(true);
              }}
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-white hover:bg-[#F4F7EF] border border-[#C5D2B7] text-[#182215] text-sm font-semibold flex items-center justify-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Direct Phone OTP Sign-In Button */}
            <button
              type="button"
              onClick={() => {
                setDirectPhone(identifier && /^\d+$/.test(identifier) ? identifier : '');
                setDirectOtpSent(false);
                setDirectOtpError('');
                setDirectEnteredOtp('');
                setShowDirectOtpLoginModal(true);
              }}
              className="mt-2.5 w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] border border-[#B8C6A8] text-[#24371D] text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Smartphone className="w-4 h-4 text-[#2F4526] shrink-0" />
              <span>Sign In with Phone SMS OTP</span>
            </button>

            <div className="mt-6 pt-5 border-t border-[#DCE5D1] text-center">
              <p className="text-sm text-[#4B5844]">
                New to OurSafe?{' '}
                <button
                  type="button"
                  onClick={onNavigateSignup}
                  className="font-semibold text-[#2F4526] hover:text-[#182215] hover:underline underline-offset-2 cursor-pointer"
                >
                  Create New Account
                </button>
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div
          className="fixed inset-0 z-50 bg-[#182215]/55 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-password-title"
        >
          <div className="w-full max-w-md bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#EAF0E2] text-[#2F4526] flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    id="forgot-password-title"
                    className="text-lg font-semibold text-[#182215]"
                  >
                    Reset Password
                  </h3>
                  <p className="text-xs text-[#54634D]">
                    Update your OurSafe account credentials
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                aria-label="Close modal"
                className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#54634D] hover:bg-[#EAF0E2] hover:text-[#182215] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {resetFeedback && (
              <div
                className={`mb-4 rounded-xl p-3 text-xs flex items-start gap-2 border ${
                  resetFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {resetFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                )}
                <span>{resetFeedback.text}</span>
              </div>
            )}

            <form onSubmit={handleResetSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#182215] mb-1">
                  Registered Phone, Name, or Email
                </label>
                <input
                  type="text"
                  value={resetIdentifier}
                  onChange={(e) => setResetIdentifier(e.target.value)}
                  placeholder="Enter your phone number or email"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm focus:bg-white focus:border-[#2F4526] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#182215] mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm focus:bg-white focus:border-[#2F4526] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#182215] mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm focus:bg-white focus:border-[#2F4526] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold text-[#4B5844] hover:bg-[#EAF0E2] cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-white text-sm font-semibold cursor-pointer"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Two-Factor Phone OTP Verification Modal */}
      {showOtpModal && pendingUser && (
        <div
          className="fixed inset-0 z-50 bg-[#182215]/65 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-otp-modal-title"
        >
          <div className="w-full max-w-md bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 shadow-2xl my-auto space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#3E5632]">
                    Two-Factor Verification
                  </p>
                  <h3
                    id="login-otp-modal-title"
                    className="text-lg font-semibold text-[#182215]"
                  >
                    Verify Your Mobile Number
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOtpModal(false)}
                className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#54634D] hover:bg-[#EAF0E2] cursor-pointer"
                aria-label="Close OTP modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#54634D] leading-relaxed">
              To verify device safety, a 6-digit SMS verification code was sent to your registered phone ending in{' '}
              <strong className="text-[#182215] font-mono">
                ...{pendingUser.phone.slice(-4)}
              </strong>
              .
            </p>

            {otpNotice && (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 font-medium flex items-center justify-between gap-2">
                <span className="truncate">{otpNotice}</span>
                <button
                  type="button"
                  onClick={() => setEnteredOtp(generatedOtp)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                >
                  Auto-Fill
                </button>
              </div>
            )}

            {otpError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-medium text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{otpError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtpAndLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="login-otp-code"
                  className="block text-xs font-semibold text-[#182215] mb-1.5"
                >
                  6-Digit SMS Verification Code
                </label>
                <input
                  id="login-otp-code"
                  type="text"
                  maxLength={6}
                  autoFocus
                  inputMode="numeric"
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 482910"
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-center font-mono text-xl tracking-[0.35em] font-bold text-[#182215] focus:bg-white focus:border-[#2F4526] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-[#54634D]">
                <span>Didn&apos;t receive code?</span>
                <button
                  type="button"
                  onClick={() => {
                    const code = generateDemoOtp();
                    setGeneratedOtp(code);
                    setOtpNotice(`New OTP code sent: ${code}`);
                    setOtpError('');
                  }}
                  className="font-semibold text-[#2F4526] hover:underline cursor-pointer"
                >
                  Resend OTP
                </button>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowOtpModal(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold text-[#4B5844] hover:bg-[#EAF0E2] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-6 py-2 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-white text-sm font-semibold cursor-pointer shadow-sm"
                >
                  Verify &amp; Sign In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Direct Phone Number OTP Login Modal */}
      {showDirectOtpLoginModal && (
        <div
          className="fixed inset-0 z-50 bg-[#182215]/65 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="direct-otp-modal-title"
        >
          <div className="w-full max-w-md bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 shadow-2xl my-auto space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#EAF0E2] border border-[#C5D2B7] text-[#2F4526] flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#3E5632]">
                    Instant Sign In
                  </p>
                  <h3
                    id="direct-otp-modal-title"
                    className="text-lg font-semibold text-[#182215]"
                  >
                    Sign In with Phone OTP
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDirectOtpLoginModal(false)}
                className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#54634D] hover:bg-[#EAF0E2] cursor-pointer"
                aria-label="Close direct phone sign in modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#54634D] leading-relaxed">
              Enter your registered mobile number to receive a one-time verification code without entering your password.
            </p>

            {directOtpError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-medium text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{directOtpError}</span>
              </div>
            )}

            {!directOtpSent ? (
              <form onSubmit={handleSendDirectPhoneOtp} className="space-y-4">
                <div>
                  <label
                    htmlFor="direct-phone-input"
                    className="block text-xs font-semibold text-[#182215] mb-1.5"
                  >
                    Registered Phone Number
                  </label>
                  <input
                    id="direct-phone-input"
                    type="tel"
                    autoFocus
                    value={directPhone}
                    onChange={(e) => setDirectPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full min-h-[46px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm font-mono tabular-nums focus:bg-white focus:border-[#2F4526] focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowDirectOtpLoginModal(false)}
                    className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold text-[#4B5844] hover:bg-[#EAF0E2] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="min-h-[44px] px-5 py-2 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-white text-sm font-semibold cursor-pointer shadow-sm"
                  >
                    Send OTP Code
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyDirectOtpAndLogin} className="space-y-4">
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 font-medium flex items-center justify-between gap-2">
                  <span>Demo OTP sent to {directPhone}: <strong>{directGeneratedOtp}</strong></span>
                  <button
                    type="button"
                    onClick={() => setDirectEnteredOtp(directGeneratedOtp)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    Auto-Fill
                  </button>
                </div>

                <div>
                  <label
                    htmlFor="direct-otp-input"
                    className="block text-xs font-semibold text-[#182215] mb-1.5"
                  >
                    Enter 6-Digit Code
                  </label>
                  <input
                    id="direct-otp-input"
                    type="text"
                    maxLength={6}
                    autoFocus
                    inputMode="numeric"
                    value={directEnteredOtp}
                    onChange={(e) => setDirectEnteredOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 123456"
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-center font-mono text-xl tracking-[0.35em] font-bold text-[#182215] focus:bg-white focus:border-[#2F4526] focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDirectOtpSent(false)}
                    className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold text-[#4B5844] hover:bg-[#EAF0E2] cursor-pointer"
                  >
                    Change Phone
                  </button>
                  <button
                    type="submit"
                    className="min-h-[44px] px-6 py-2 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-white text-sm font-semibold cursor-pointer shadow-sm"
                  >
                    Verify &amp; Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Continue with Google Account Modal */}
      {showGoogleModal && (
        <div
          className="fixed inset-0 z-50 bg-[#182215]/55 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="google-signin-title"
        >
          <div className="w-full max-w-md bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 shadow-xl my-auto">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-xs font-semibold text-[#3E5632]">
                  Quick Account Access
                </p>
                <h3
                  id="google-signin-title"
                  className="text-lg font-semibold text-[#182215] mt-0.5"
                >
                  Continue with Google
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGoogleModal(false)}
                aria-label="Close Google sign-in"
                className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#54634D] hover:bg-[#EAF0E2] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {googleError && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-medium text-red-700">
                {googleError}
              </div>
            )}

            <form onSubmit={handleGoogleContinue} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#182215] mb-1">
                  Google Email
                </label>
                <input
                  type="email"
                  required
                  value={googleEmail}
                  onChange={(e) => setGoogleEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm focus:bg-white focus:border-[#2F4526] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#182215] mb-1">
                  Full Name (New Account)
                </label>
                <input
                  type="text"
                  value={googleName}
                  onChange={(e) => setGoogleName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm focus:bg-white focus:border-[#2F4526] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#182215] mb-1">
                    Your Phone
                  </label>
                  <input
                    type="tel"
                    value={googlePhone}
                    onChange={(e) => setGooglePhone(e.target.value)}
                    placeholder="10-digit number"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm font-mono tabular-nums focus:bg-white focus:border-[#2F4526] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#182215] mb-1">
                    Guardian Name
                  </label>
                  <input
                    type="text"
                    value={googleGuardianName}
                    onChange={(e) => setGoogleGuardianName(e.target.value)}
                    placeholder="Primary guardian"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm focus:bg-white focus:border-[#2F4526] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#182215] mb-1">
                  Guardian Phone Number
                </label>
                <input
                  type="tel"
                  value={googleGuardianPhone}
                  onChange={(e) => setGoogleGuardianPhone(e.target.value)}
                  placeholder="Guardian 10-digit number"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm font-mono tabular-nums focus:bg-white focus:border-[#2F4526] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold text-[#4B5844] hover:bg-[#EAF0E2] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-white text-sm font-semibold cursor-pointer"
                >
                  Continue to OurSafe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Two-Factor Phone OTP Verification Modal */}
      {showOtpModal && pendingUser && (
        <div
          className="fixed inset-0 z-50 bg-[#182215]/65 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-otp-modal-title"
        >
          <div className="w-full max-w-md bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 shadow-2xl my-auto space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#3E5632]">
                    Two-Factor Verification
                  </p>
                  <h3
                    id="login-otp-modal-title"
                    className="text-lg font-semibold text-[#182215]"
                  >
                    Verify Your Mobile Number
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOtpModal(false)}
                className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#54634D] hover:bg-[#EAF0E2] cursor-pointer"
                aria-label="Close OTP modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#54634D] leading-relaxed">
              To verify device safety, a 6-digit SMS verification code was sent to your registered phone ending in{' '}
              <strong className="text-[#182215] font-mono">
                ...{pendingUser.phone.slice(-4)}
              </strong>
              .
            </p>

            {otpNotice && (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 font-medium flex items-center justify-between gap-2">
                <span className="truncate">{otpNotice}</span>
                <button
                  type="button"
                  onClick={() => setEnteredOtp(generatedOtp)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                >
                  Auto-Fill
                </button>
              </div>
            )}

            {otpError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-medium text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{otpError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtpAndLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="login-otp-code"
                  className="block text-xs font-semibold text-[#182215] mb-1.5"
                >
                  6-Digit SMS Verification Code
                </label>
                <input
                  id="login-otp-code"
                  type="text"
                  maxLength={6}
                  autoFocus
                  inputMode="numeric"
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 482910"
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-center font-mono text-xl tracking-[0.35em] font-bold text-[#182215] focus:bg-white focus:border-[#2F4526] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-[#54634D]">
                <span>Didn&apos;t receive code?</span>
                <button
                  type="button"
                  onClick={() => {
                    const code = generateDemoOtp();
                    setGeneratedOtp(code);
                    setOtpNotice(`New OTP code sent: ${code}`);
                    setOtpError('');
                  }}
                  className="font-semibold text-[#2F4526] hover:underline cursor-pointer"
                >
                  Resend OTP
                </button>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowOtpModal(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold text-[#4B5844] hover:bg-[#EAF0E2] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-6 py-2 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-white text-sm font-semibold cursor-pointer shadow-sm"
                >
                  Verify &amp; Sign In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Direct Phone Number OTP Login Modal */}
      {showDirectOtpLoginModal && (
        <div
          className="fixed inset-0 z-50 bg-[#182215]/65 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="direct-otp-modal-title"
        >
          <div className="w-full max-w-md bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 shadow-2xl my-auto space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#EAF0E2] border border-[#C5D2B7] text-[#2F4526] flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#3E5632]">
                    Instant Sign In
                  </p>
                  <h3
                    id="direct-otp-modal-title"
                    className="text-lg font-semibold text-[#182215]"
                  >
                    Sign In with Phone OTP
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDirectOtpLoginModal(false)}
                className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#54634D] hover:bg-[#EAF0E2] cursor-pointer"
                aria-label="Close direct phone sign in modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#54634D] leading-relaxed">
              Enter your registered mobile number to receive a one-time verification code without entering your password.
            </p>

            {directOtpError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-medium text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{directOtpError}</span>
              </div>
            )}

            {!directOtpSent ? (
              <form onSubmit={handleSendDirectPhoneOtp} className="space-y-4">
                <div>
                  <label
                    htmlFor="direct-phone-input"
                    className="block text-xs font-semibold text-[#182215] mb-1.5"
                  >
                    Registered Phone Number
                  </label>
                  <input
                    id="direct-phone-input"
                    type="tel"
                    autoFocus
                    value={directPhone}
                    onChange={(e) => setDirectPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full min-h-[46px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm font-mono tabular-nums focus:bg-white focus:border-[#2F4526] focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowDirectOtpLoginModal(false)}
                    className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold text-[#4B5844] hover:bg-[#EAF0E2] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="min-h-[44px] px-5 py-2 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-white text-sm font-semibold cursor-pointer shadow-sm"
                  >
                    Send OTP Code
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyDirectOtpAndLogin} className="space-y-4">
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 font-medium flex items-center justify-between gap-2">
                  <span>Demo OTP sent to {directPhone}: <strong>{directGeneratedOtp}</strong></span>
                  <button
                    type="button"
                    onClick={() => setDirectEnteredOtp(directGeneratedOtp)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    Auto-Fill
                  </button>
                </div>

                <div>
                  <label
                    htmlFor="direct-otp-input"
                    className="block text-xs font-semibold text-[#182215] mb-1.5"
                  >
                    Enter 6-Digit Code
                  </label>
                  <input
                    id="direct-otp-input"
                    type="text"
                    maxLength={6}
                    autoFocus
                    inputMode="numeric"
                    value={directEnteredOtp}
                    onChange={(e) => setDirectEnteredOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 123456"
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-center font-mono text-xl tracking-[0.35em] font-bold text-[#182215] focus:bg-white focus:border-[#2F4526] focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDirectOtpSent(false)}
                    className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold text-[#4B5844] hover:bg-[#EAF0E2] cursor-pointer"
                  >
                    Change Phone
                  </button>
                  <button
                    type="submit"
                    className="min-h-[44px] px-6 py-2 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-white text-sm font-semibold cursor-pointer shadow-sm"
                  >
                    Verify &amp; Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
