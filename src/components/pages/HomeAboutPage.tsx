import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Compass,
  Hand,
  History,
  Lock,
  MapPin,
  Mic,
  Pencil,
  Phone,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Star,
  Users,
} from 'lucide-react';
import {
  AppPage,
  SafetyPreferences,
  TeamInfoConfig,
  UserReviewItem,
} from '../../types/safety';
import {
  formatTimeShort,
  getReviews,
  getTeamInfo,
  saveReviews,
  saveTeamInfo,
} from '../../utils/storage';

interface HomeAboutPageProps {
  userName: string;
  preferences?: SafetyPreferences;
  voiceListening?: boolean;
  liveVoiceActive?: boolean;
  onNavigatePage: (page: AppPage) => void;
  onOpenContacts: () => void;
  onOpenSettings?: () => void;
  onOpenLockShield?: () => void;
  onWakeVoice?: () => void;
}

const EMERGENCY_HELP_NUMBERS = [
  {
    number: '112',
    label: 'Emergency Response',
    detail: 'All-in-one national emergency helpline',
  },
  {
    number: '181',
    label: 'Women Helpline',
    detail: '24/7 support for women in distress',
  },
  {
    number: '100',
    label: 'Police',
    detail: 'Direct police control room dispatch',
  },
  {
    number: '108',
    label: 'Ambulance',
    detail: 'Emergency medical & ambulance care',
  },
  {
    number: '1098',
    label: 'Child Helpline',
    detail: '24/7 protection & emergency care',
  },
];

const FEATURE_OVERVIEW: Array<{
  title: string;
  description: string;
  page: AppPage;
  icon: React.ReactNode;
}> = [
  {
    title: 'AI Voice App Controller',
    description:
      'Speak naturally to open SOS, call both your guardian and police, activate Threat Mode, or locate nearby police stations.',
    page: 'assistant',
    icon: <Mic className="w-5 h-5" />,
  },
  {
    title: 'SOS Emergency Workflow',
    description:
      'Instant emergency actions with guardian & police calling, live location sharing, delivery status tracking, and offline readiness.',
    page: 'sos',
    icon: <ShieldAlert className="w-5 h-5" />,
  },
  {
    title: 'Intelligent Threat Mode',
    description:
      'AI-powered nearby police station numbers, audio/video evidence recording, guardian alerts, and sudden-disconnect snapshots.',
    page: 'threat',
    icon: <AlertTriangle className="w-5 h-5" />,
  },
  {
    title: 'Travel Mode & Check-In',
    description:
      'Share journey details, set timed safety check-ins that alert guardians if missed, and trigger a discreet Fake Call anytime.',
    page: 'travel',
    icon: <Compass className="w-5 h-5" />,
  },
  {
    title: 'Nearby Police & Safe Places',
    description:
      'Find verified nearby police stations and public restrooms centered on your live GPS coordinates.',
    page: 'nearby',
    icon: <MapPin className="w-5 h-5" />,
  },
  {
    title: 'Emergency Evidence History',
    description:
      'Password-protected timeline for Threat Mode sessions, SOS alerts, GPS snapshots, connectivity events, and local recordings.',
    page: 'history',
    icon: <History className="w-5 h-5" />,
  },
];

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Create Profile & Link Guardian',
    detail:
      'Set up your personal profile and verify your primary guardian details locally.',
  },
  {
    step: '02',
    title: 'Build Trusted Guardian Circle',
    detail:
      'Save multiple emergency contacts offline so numbers stay accessible without internet.',
  },
  {
    step: '03',
    title: 'Turn On Travel & Check-In',
    detail:
      'Log destinations, set timed check-ins, or use Fake Call for a calm social exit.',
  },
  {
    step: '04',
    title: 'Activate Threat Mode Early',
    detail:
      'Fetch nearby police numbers with AI, record audio/video evidence, and preserve GPS snapshots.',
  },
  {
    step: '05',
    title: 'Voice-Control SOS & Dual Call',
    detail:
      'Say "Call both guardian and police" or "Open SOS" for rapid protection and response.',
  },
];

export const HomeAboutPage: React.FC<HomeAboutPageProps> = ({
  userName,
  preferences,
  voiceListening = false,
  liveVoiceActive = false,
  onNavigatePage,
  onOpenContacts,
  onOpenSettings,
  onOpenLockShield,
  onWakeVoice,
}) => {
  const [reviews, setReviews] = useState<UserReviewItem[]>(() => getReviews());
  const [reviewAuthor, setReviewAuthor] = useState(userName);
  const [reviewRole, setReviewRole] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewFeedback, setReviewFeedback] = useState('');

  const [teamInfo, setTeamInfo] = useState<TeamInfoConfig>(() => getTeamInfo());
  const [editingTeam, setEditingTeam] = useState(false);
  const [teamDraft, setTeamDraft] = useState<TeamInfoConfig>(teamInfo);

  const averageRating =
    reviews.length > 0
      ? (
          reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        ).toFixed(1)
      : '0.0';

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewAuthor.trim() || !reviewComment.trim()) return;
    const nextItem: UserReviewItem = {
      id: `user-rev-${Date.now()}`,
      author: reviewAuthor.trim(),
      role: reviewRole.trim() || 'App User Feedback',
      rating: reviewRating,
      comment: reviewComment.trim(),
      createdAt: new Date().toISOString(),
      isSample: false,
    };
    const next = [nextItem, ...reviews];
    setReviews(next);
    saveReviews(next);
    setReviewComment('');
    setReviewRole('');
    setReviewFeedback('Thank you. Your feedback has been saved locally.');
    window.setTimeout(() => setReviewFeedback(''), 3500);
  };

  const handleSaveTeam = (e: React.FormEvent) => {
    e.preventDefault();
    setTeamInfo(teamDraft);
    saveTeamInfo(teamDraft);
    setEditingTeam(false);
  };

  return (
    <div className="space-y-8">
      {/* 1. FIRST VISUAL ANCHOR: Full-Width Women's Safety Editorial Hero Image */}
      <section className="relative rounded-3xl overflow-hidden border border-[#A9B998] bg-[#1B2817] min-h-[300px] sm:min-h-[390px] lg:min-h-[450px] flex flex-col justify-end shadow-sm shadow-[#182215]/10">
        <img
          src="/src/assets/images/women_safety_hero_1795440817803.jpg"
          alt="Confident woman walking safely along a warmly lit tree-lined city avenue at twilight"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#10180E]/92 via-[#10180E]/42 to-[#10180E]/12"
        />

        <div className="relative z-10 p-6 sm:p-8 lg:p-10 max-w-3xl space-y-4">
          <p className="text-xs sm:text-sm font-semibold text-[#CBE0BC] tracking-wide">
            OurSafe Women&apos;s Safety Companion · 24/7 Hands-Free Protection
          </p>
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-white leading-[1.08] tracking-tight"
            style={{ textWrap: 'balance' }}
          >
            Walk every street with calm, unshakable confidence.
          </h1>
          <p className="text-sm sm:text-base text-[#E2ECDC] leading-relaxed max-w-2xl">
            Just say &ldquo;{preferences?.wakeWordPhrase || 'OurSafe'}&rdquo; anytime—your companion responds aloud with &ldquo;{preferences?.wakeWordPhrase || 'OurSafe'} app is here, how can I help you?&rdquo; and puts every safety tool at your voice.
          </p>

          <div className="pt-1 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onWakeVoice ?? (() => onNavigatePage('assistant'))}
              className="min-h-[46px] px-5 py-2.5 rounded-xl bg-[#FCFDF9] hover:bg-[#EAF0E2] text-[#182215] text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer shadow-sm"
            >
              <Mic className="w-4 h-4 text-[#2F4526]" />
              <span>Say &ldquo;{preferences?.wakeWordPhrase || 'OurSafe'}&rdquo; · Voice Control</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigatePage('sos')}
              className="min-h-[46px] px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer shadow-sm"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Open SOS</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Calm, Intelligent Protection + Always-On Systems + Women's Safety Emblem */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 sm:p-8 lg:p-10 flex flex-col justify-between gap-6 shadow-sm shadow-[#182215]/[0.04]">
          <div className="space-y-4">
            <p className="text-xs font-semibold text-[#3E5632]">
              Welcome to OurSafe · Prevention · Protection · Response
            </p>
            <h2
              className="text-2xl sm:text-3xl lg:text-[2.35rem] font-semibold text-[#182215] leading-[1.14] tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              Calm, intelligent protection built for every step you take.
            </h2>
            <p className="text-sm sm:text-base text-[#465340] leading-relaxed max-w-2xl">
              OurSafe is an AI-powered women&apos;s safety companion designed to remove hesitation during critical moments. Speak naturally to reach both your guardian and police, locate nearby police station numbers in Threat Mode, and preserve vital emergency evidence safely.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigatePage('assistant')}
                className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-[#F6F9F2] text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Mic className="w-4 h-4" />
                <span>AI Voice Controller</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigatePage('travel')}
                className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#EAF0E2] hover:bg-[#DDE7D2] text-[#24371D] text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                <span>Travel Mode</span>
              </button>
              <button
                type="button"
                onClick={onOpenContacts}
                className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#EAF0E2] hover:bg-[#DDE7D2] text-[#24371D] text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>Guardians</span>
              </button>
            </div>

            {/* Always-On Hands-Free Automation Strip */}
            {preferences && (
              <div className="rounded-2xl bg-[#F4F7EF] border border-[#CFD9C3] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#182215]">
                    Always-On Hands-Free Safety Systems
                  </span>
                  <div className="flex items-center gap-2">
                    {onOpenLockShield && (
                      <button
                        type="button"
                        onClick={onOpenLockShield}
                        className="px-2.5 py-1 rounded-lg bg-[#182215] hover:bg-[#2F4526] text-white text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Lock className="w-3 h-3" />
                        <span>Lock Icon</span>
                      </button>
                    )}
                    {onOpenSettings && (
                      <button
                        type="button"
                        onClick={onOpenSettings}
                        className="px-2.5 py-1 rounded-lg bg-[#EAF0E2] hover:bg-[#DCE6D1] text-[#24371D] text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Settings className="w-3 h-3" />
                        <span>On / Off in Settings</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="rounded-xl bg-[#FCFDF9] border border-[#D4DFC8] px-2.5 py-2 flex items-center justify-between gap-1.5">
                    <span className="inline-flex items-center gap-1 font-semibold text-[#182215] truncate">
                      <Smartphone className="w-3.5 h-3.5 text-[#2F4526] shrink-0" />
                      <span>3x Shake</span>
                    </span>
                    <span
                      className={`font-bold shrink-0 ${
                        preferences.shakeDetectionEnabled
                          ? 'text-emerald-700'
                          : 'text-[#7A8774]'
                      }`}
                    >
                      {preferences.shakeDetectionEnabled ? 'ON' : 'OFF'}
                    </span>
                  </div>

                  <div className="rounded-xl bg-[#FCFDF9] border border-[#D4DFC8] px-2.5 py-2 flex items-center justify-between gap-1.5">
                    <span className="inline-flex items-center gap-1 font-semibold text-[#182215] truncate">
                      <Mic className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      <span className="truncate">&ldquo;{preferences.voiceKeyword}&rdquo;</span>
                    </span>
                    <span
                      className={`font-bold shrink-0 ${
                        preferences.voiceActivationEnabled
                          ? 'text-emerald-700'
                          : 'text-[#7A8774]'
                      }`}
                    >
                      {preferences.voiceActivationEnabled ? 'ON' : 'OFF'}
                    </span>
                  </div>

                  <div className="rounded-xl bg-[#FCFDF9] border border-[#D4DFC8] px-2.5 py-2 flex items-center justify-between gap-1.5">
                    <span className="inline-flex items-center gap-1 font-semibold text-[#182215] truncate">
                      <Hand className="w-3.5 h-3.5 text-[#2F4526] shrink-0" />
                      <span>{preferences.screenTapCount}x Tap</span>
                    </span>
                    <span
                      className={`font-bold shrink-0 ${
                        preferences.screenTapSosEnabled
                          ? 'text-emerald-700'
                          : 'text-[#7A8774]'
                      }`}
                    >
                      {preferences.screenTapSosEnabled ? 'ON' : 'OFF'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={onWakeVoice}
                    className="rounded-xl bg-[#FCFDF9] hover:bg-[#EAF0E2] border border-[#D4DFC8] px-2.5 py-2 flex items-center justify-between gap-1.5 transition-colors cursor-pointer text-left"
                  >
                    <span className="inline-flex items-center gap-1 font-semibold text-[#182215] truncate">
                      <Mic className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span className="truncate">
                        &ldquo;{preferences.wakeWordPhrase || 'OurSafe'}&rdquo;
                      </span>
                    </span>
                    <span
                      className={`font-bold shrink-0 ${
                        liveVoiceActive || (preferences.wakeWordEnabled !== false && voiceListening)
                          ? 'text-emerald-700'
                          : preferences.wakeWordEnabled !== false
                            ? 'text-[#2F4526]'
                            : 'text-[#7A8774]'
                      }`}
                    >
                      {liveVoiceActive
                        ? 'LIVE'
                        : preferences.wakeWordEnabled !== false
                          ? 'ON'
                          : 'OFF'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-[#DCE5D1] flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#54634D]">
              <span>Auto-Call &amp; Live GPS on Trigger</span>
              <span aria-hidden="true">·</span>
              <span>&ldquo;OurSafe&rdquo; Whole-App Voice Control</span>
              <span aria-hidden="true">·</span>
              <span>Minimal Lock-Screen Icon Overlay</span>
            </div>
          </div>
        </div>

        {/* Right Showcase Card: Bespoke Women's Safety Emblem */}
        <div className="lg:col-span-5 bg-[#F4F7EF] rounded-3xl border border-[#B8C6A8] p-6 sm:p-8 flex flex-col items-center justify-between text-center gap-4 shadow-sm shadow-[#182215]/[0.04]">
          <div className="w-full flex items-center justify-between text-xs text-[#4B5844]">
            <span className="font-semibold text-[#2F4526]">OurSafe Emblem</span>
            <span>Strength &amp; Dignity</span>
          </div>

          <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-3xl overflow-hidden border border-[#CFD9C3] bg-[#E8EFE0] flex items-center justify-center shrink-0">
            <img
              src="/src/assets/images/oursafe_women_emblem_1795336816745.jpg"
              alt="OurSafe women safety shield and botanical olive emblem"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="max-w-xs space-y-1">
            <p
              className="text-lg font-semibold text-[#182215]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Safe Mobility, Every Hour
            </p>
            <p className="text-xs text-[#4B5844] leading-relaxed">
              Thoughtful personal protection combining trusted family networks, verified police numbers, and hands-free voice control.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Women's Safety Across Everyday Moments (Curated Editorial Photography Showcase) */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#3E5632]">
              Designed for Real-World Confidence
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-[#182215]">
              Protection That Moves With You
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#4B5844]">
            Hands-free voice control, live route monitoring, and guardian solidarity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Story Card 1: Hands-Free Voice */}
          <article className="bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] overflow-hidden flex flex-col justify-between shadow-sm shadow-[#182215]/[0.04]">
            <div>
              <div className="aspect-[4/3] w-full bg-[#DCE6D1] overflow-hidden">
                <img
                  src="/src/assets/images/voice_safety_companion_1795440791502.jpg"
                  alt="Woman activating hands-free voice safety companion while phone rests on desk"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300"
                />
              </div>
              <div className="p-5 space-y-2">
                <p className="text-xs font-semibold text-[#3E5632]">
                  Hands-Free Voice · Zero Taps Needed
                </p>
                <h3 className="text-lg font-semibold text-[#182215] leading-snug">
                  Just Say &ldquo;{preferences?.wakeWordPhrase || 'OurSafe'}&rdquo; From Across the Room
                </h3>
                <p className="text-xs sm:text-sm text-[#4B5844] leading-relaxed">
                  OurSafe replies aloud—&ldquo;OurSafe app is here, how can I help you?&rdquo;—and lets you open SOS, share live GPS, or start Threat Mode completely by voice.
                </p>
              </div>
            </div>
            <div className="px-5 pb-5">
              <button
                type="button"
                onClick={onWakeVoice ?? (() => onNavigatePage('assistant'))}
                className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] text-[#24371D] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Test Voice Greeting Now</span>
              </button>
            </div>
          </article>

          {/* Story Card 2: Safe Evening Commute */}
          <article className="bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] overflow-hidden flex flex-col justify-between shadow-sm shadow-[#182215]/[0.04]">
            <div>
              <div className="aspect-[4/3] w-full bg-[#DCE6D1] overflow-hidden">
                <img
                  src="/src/assets/images/safe_night_commute_1795440675672.jpg"
                  alt="Confident woman checking her live route inside a well-lit evening cab commute"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300"
                />
              </div>
              <div className="p-5 space-y-2">
                <p className="text-xs font-semibold text-[#3E5632]">
                  Travel Mode · Live Google Maps Guard
                </p>
                <h3 className="text-lg font-semibold text-[#182215] leading-snug">
                  Verified Rides &amp; Automatic Off-Route Alerts
                </h3>
                <p className="text-xs sm:text-sm text-[#4B5844] leading-relaxed">
                  Verify any auto or cab license plate before boarding, track your exact Google Maps route, and receive instant alerts if the vehicle deviates off-course.
                </p>
              </div>
            </div>
            <div className="px-5 pb-5">
              <button
                type="button"
                onClick={() => onNavigatePage('travel')}
                className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] text-[#24371D] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Open Travel &amp; Plate Verify</span>
              </button>
            </div>
          </article>

          {/* Story Card 3: Guardian Network */}
          <article className="bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] overflow-hidden flex flex-col justify-between shadow-sm shadow-[#182215]/[0.04]">
            <div>
              <div className="aspect-[4/3] w-full bg-[#DCE6D1] overflow-hidden">
                <img
                  src="/src/assets/images/guardian_solidarity_1795440678144.jpg"
                  alt="Women friends and family walking together smiling along a sunlit tree-lined avenue"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300"
                />
              </div>
              <div className="p-5 space-y-2">
                <p className="text-xs font-semibold text-[#3E5632]">
                  Guardian Circle · Instant Dual Dispatch
                </p>
                <h3 className="text-lg font-semibold text-[#182215] leading-snug">
                  Your Family &amp; Local Police Connected Together
                </h3>
                <p className="text-xs sm:text-sm text-[#4B5844] leading-relaxed">
                  One trigger—3x Shake, &ldquo;{preferences?.voiceKeyword || 'Red Rose'}&rdquo;, or Triple Tap—automatically dials for help and shares live GPS with guardians and police.
                </p>
              </div>
            </div>
            <div className="px-5 pb-5">
              <button
                type="button"
                onClick={onOpenContacts}
                className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] text-[#24371D] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Manage Trusted Guardians</span>
              </button>
            </div>
          </article>
        </div>
      </section>

      {/* 2. Emergency Help Numbers Strip (Immediate Priority Access) */}
      <section className="bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 sm:p-7 shadow-sm shadow-[#182215]/[0.03]">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-semibold text-red-700">
              Direct Emergency Assistance · Works Offline via Phone Dialer
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-[#182215]">
              Emergency Help Numbers
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigatePage('threat')}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] text-[#24371D] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <AlertTriangle className="w-4 h-4 text-[#2F4526]" />
            <span>AI Police Lookup in Threat Mode</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {EMERGENCY_HELP_NUMBERS.map((item) => (
            <div
              key={item.number}
              className="rounded-2xl bg-[#F4F7EF] border border-[#CFD9C3] p-4 flex flex-col justify-between gap-3.5"
            >
              <div>
                <p className="text-2xl font-bold font-mono tabular-nums text-[#182215]">
                  {item.number}
                </p>
                <p className="mt-1 text-sm font-bold text-[#24371D]">
                  {item.label}
                </p>
                <p className="mt-1 text-xs text-[#4E5C48] leading-relaxed">
                  {item.detail}
                </p>
              </div>

              <a
                href={`tel:${item.number}`}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#FCFDF9] hover:bg-red-600 hover:text-white hover:border-red-600 border border-[#C3D0B4] text-[#182215] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call {item.number}</span>
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Dedicated Safety Modules Grid */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#2F4526]">
              Dedicated Feature Pages
            </p>
            <h2 className="mt-1 text-2xl sm:text-3xl font-semibold text-[#182215]">
              Application Features
            </h2>
          </div>
          <p className="text-xs text-[#3C4A36]">
            Each safety capability lives on its own focused screen
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURE_OVERVIEW.map((feat) => (
            <button
              key={feat.title}
              type="button"
              onClick={() => onNavigatePage(feat.page)}
              className="group text-left bg-[#FCFDF9] hover:bg-[#F4F7EF] rounded-2xl border border-[#B8C6A8] p-5 flex flex-col justify-between gap-4 transition-colors cursor-pointer"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#E7EFE0] text-[#2F4526] flex items-center justify-center">
                  {feat.icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#182215] group-hover:text-[#2F4526] transition-colors">
                    {feat.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-[#4B5844] leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2F4526]">
                <span>Open Module</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 4. Editorial Visual + Problems Solved & How It Works */}
      <section className="bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 sm:p-8 space-y-8 shadow-sm shadow-[#182215]/[0.03]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-6 rounded-2xl overflow-hidden border border-[#CFD9C3] bg-[#E8EFE0] min-h-[240px]">
            <img
              src="/src/assets/images/oursafe_home_banner_1795336816403.jpg"
              alt="Three confident women walking safely along an illuminated botanical evening path"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="lg:col-span-6 flex flex-col justify-center space-y-4">
            <p className="text-xs font-semibold text-[#3E5632]">
              Why OurSafe Exists
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-[#182215]">
              Built to Solve Real Everyday Safety Challenges
            </h2>
            <div className="space-y-3 text-sm text-[#465340]">
              <div className="rounded-2xl bg-[#F4F7EF] border border-[#D4DFC8] p-4">
                <p className="font-semibold text-[#182215]">
                  Prevention Before Escalation
                </p>
                <p className="mt-1 text-xs leading-relaxed">
                  Travel Mode, timed Safety Check-Ins, and Discreet Fake Calls provide calm, practical exits before discomfort becomes danger.
                </p>
              </div>
              <div className="rounded-2xl bg-[#F4F7EF] border border-[#D4DFC8] p-4">
                <p className="font-semibold text-[#182215]">
                  Zero-Friction Voice &amp; AI Assistance
                </p>
                <p className="mt-1 text-xs leading-relaxed">
                  In urgent moments, users can speak naturally to call both guardians and police while AI surfaces verified nearby police station numbers.
                </p>
              </div>
              <div className="rounded-2xl bg-[#F4F7EF] border border-[#D4DFC8] p-4">
                <p className="font-semibold text-[#182215]">
                  Preserved Evidence &amp; Connectivity Resilience
                </p>
                <p className="mt-1 text-xs leading-relaxed">
                  Local audio/video recording, heartbeat GPS snapshots, and offline-cached guardian contacts protect critical information even if signal drops.
                </p>
              </div>
            </div>
          </div>
        </div>

        <hr className="border-[#DCE5D1]" />

        {/* Step-by-Step Workflow */}
        <div>
          <div className="mb-5">
            <p className="text-xs font-semibold text-[#3E5632]">
              Step-by-Step Workflow
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-[#182215]">
              How OurSafe Works
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
            {WORKFLOW_STEPS.map((item) => (
              <div
                key={item.step}
                className="rounded-2xl bg-[#F4F7EF] border border-[#D4DFC8] p-4 flex flex-col gap-2"
              >
                <span className="text-xs font-mono font-bold text-[#2F4526] tabular-nums">
                  {item.step}.
                </span>
                <h3 className="text-sm font-semibold text-[#182215] leading-snug">
                  {item.title}
                </h3>
                <p className="text-xs text-[#4B5844] leading-relaxed">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. User Reviews & Submit Feedback */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 sm:p-7 space-y-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[#3E5632]">
                Community Feedback · Verified User Reviews
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-[#182215]">
                User Reviews &amp; Ratings
              </h2>
            </div>
            <div className="text-sm font-bold text-[#182215] tabular-nums flex items-center gap-1.5">
              <Star className="w-4 h-4 fill-amber-500 text-amber-600" />
              <span>{averageRating} / 5.0</span>
              <span className="text-xs font-normal text-[#54634D]">
                ({reviews.length} reviews)
              </span>
            </div>
          </div>

          <div className="divide-y divide-[#DCE5D1]">
            {reviews.map((rev) => (
              <article key={rev.id} className="py-4 first:pt-0 last:pb-0 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-[#182215]">
                      {rev.author}
                    </p>
                    <p className="text-xs text-[#54634D]">
                      {rev.role}
                      {' · '}
                      {formatTimeShort(rev.createdAt)}
                    </p>
                  </div>
                  <div
                    aria-label={`${rev.rating} out of 5 stars`}
                    className="flex items-center gap-0.5 text-amber-500"
                  >
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Star
                        key={idx}
                        className={`w-3.5 h-3.5 ${
                          idx < rev.rating
                            ? 'fill-amber-500 text-amber-600'
                            : 'text-[#CFD9C3]'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-[#465340] leading-relaxed">
                  &ldquo;{rev.comment}&rdquo;
                </p>
              </article>
            ))}
          </div>
        </div>

        {/* Submit Feedback Form */}
        <div className="lg:col-span-5 bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 sm:p-7 space-y-4">
          <div>
            <p className="text-xs font-semibold text-[#3E5632]">
              Share Your Thoughts
            </p>
            <h3 className="mt-1 text-xl font-semibold text-[#182215]">
              Share Your Feedback
            </h3>
          </div>

          {reviewFeedback && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-medium text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{reviewFeedback}</span>
            </div>
          )}

          <form onSubmit={handleReviewSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#182215] mb-1">
                Your Name
              </label>
              <input
                type="text"
                required
                value={reviewAuthor}
                onChange={(e) => setReviewAuthor(e.target.value)}
                placeholder="Enter your name"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm focus:bg-white focus:border-[#2F4526] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#182215] mb-1">
                Role or Context (Optional)
              </label>
              <input
                type="text"
                value={reviewRole}
                onChange={(e) => setReviewRole(e.target.value)}
                placeholder="e.g. Daily Commuter, Student, Parent"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm focus:bg-white focus:border-[#2F4526] focus:outline-none"
              />
            </div>

            <div>
              <span className="block text-xs font-semibold text-[#182215] mb-1.5">
                Rating
              </span>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    aria-label={`Rate ${star} stars`}
                    className="min-w-[40px] min-h-[40px] rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] flex items-center justify-center hover:bg-[#E7EFE0] cursor-pointer"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        star <= reviewRating
                          ? 'fill-amber-500 text-amber-600'
                          : 'text-[#B8C6A8]'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#182215] mb-1">
                Feedback Comment
              </label>
              <textarea
                rows={3}
                required
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Tell us what helped most or what you would like added..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm focus:bg-white focus:border-[#2F4526] focus:outline-none resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-[#F6F9F2] text-sm font-semibold transition-colors cursor-pointer"
            >
              Post Feedback
            </button>
          </form>
        </div>
      </section>

      {/* 6. Founder & Team Details */}
      <section className="bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 sm:p-8 shadow-sm shadow-[#182215]/[0.03]">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-semibold text-[#3E5632]">
              Founder, Team &amp; Mission
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-[#182215]">
              Founder &amp; Project Team
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              setTeamDraft(teamInfo);
              setEditingTeam((prev) => !prev);
            }}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#EAF0E2] hover:bg-[#DCE7D2] text-[#24371D] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>{editingTeam ? 'Cancel Editing' : 'Edit Team Details'}</span>
          </button>
        </div>

        {editingTeam ? (
          <form onSubmit={handleSaveTeam} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#182215] mb-1">
                  Founder Name
                </label>
                <input
                  type="text"
                  value={teamDraft.founderName}
                  onChange={(e) =>
                    setTeamDraft((p) => ({ ...p, founderName: e.target.value }))
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm focus:bg-white focus:border-[#2F4526] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#182215] mb-1">
                  Project Team Details
                </label>
                <input
                  type="text"
                  value={teamDraft.teamMembers}
                  onChange={(e) =>
                    setTeamDraft((p) => ({ ...p, teamMembers: e.target.value }))
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm focus:bg-white focus:border-[#2F4526] focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-[#182215] mb-1">
                  Founder Introduction
                </label>
                <textarea
                  rows={2}
                  value={teamDraft.founderIntro}
                  onChange={(e) =>
                    setTeamDraft((p) => ({ ...p, founderIntro: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm focus:bg-white focus:border-[#2F4526] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#182215] mb-1">
                  Project Vision
                </label>
                <textarea
                  rows={2}
                  value={teamDraft.vision}
                  onChange={(e) =>
                    setTeamDraft((p) => ({ ...p, vision: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm focus:bg-white focus:border-[#2F4526] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#182215] mb-1">
                  Project Mission
                </label>
                <textarea
                  rows={2}
                  value={teamDraft.mission}
                  onChange={(e) =>
                    setTeamDraft((p) => ({ ...p, mission: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm focus:bg-white focus:border-[#2F4526] focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-[#F6F9F2] text-sm font-semibold cursor-pointer"
              >
                Save Team Details
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-[#F4F7EF] border border-[#D4DFC8] p-5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#3E5632]">
                <ShieldCheck className="w-4 h-4" />
                <span>Founder</span>
              </div>
              <h3 className="text-base font-semibold text-[#182215]">
                {teamInfo.founderName}
              </h3>
              <p className="text-xs text-[#465340] leading-relaxed">
                {teamInfo.founderIntro}
              </p>
            </div>

            <div className="rounded-2xl bg-[#F4F7EF] border border-[#D4DFC8] p-5 space-y-2">
              <p className="text-xs font-semibold text-[#3E5632]">
                Project Team
              </p>
              <p className="text-sm font-semibold text-[#182215] leading-relaxed">
                {teamInfo.teamMembers}
              </p>
            </div>

            <div className="rounded-2xl bg-[#F4F7EF] border border-[#D4DFC8] p-5 space-y-3">
              <div>
                <p className="text-xs font-semibold text-[#3E5632]">Vision</p>
                <p className="mt-1 text-xs text-[#465340] leading-relaxed">
                  {teamInfo.vision}
                </p>
              </div>
              <div className="pt-2.5 border-t border-[#D4DFC8]">
                <p className="text-xs font-semibold text-[#3E5632]">Mission</p>
                <p className="mt-1 text-xs text-[#465340] leading-relaxed">
                  {teamInfo.mission}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
