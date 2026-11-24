/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { EmergencyLockScreenShield } from './components/EmergencyLockScreenShield';
import { EmergencyTriggerOverlay } from './components/EmergencyTriggerOverlay';
import { HomeDashboard } from './components/HomeDashboard';
import { LoginScreen } from './components/LoginScreen';
import { SignupScreen } from './components/SignupScreen';
import { useEmergencyQuickTriggers } from './hooks/useEmergencyQuickTriggers';
import {
  ActiveScreen,
  GeoLocationState,
  QuickTriggerEvent,
  UserProfile,
} from './types/safety';
import {
  clearSession,
  getActiveSessionUser,
  getEmergencyFallbackUser,
  getEmergencyHistory,
  saveEmergencyHistory,
  updateUserProfile,
} from './utils/storage';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() =>
    getActiveSessionUser()
  );
  const [screen, setScreen] = useState<ActiveScreen>(() =>
    getActiveSessionUser() ? 'home' : 'login'
  );

  // Pre-login / Outside-App Emergency Shield & Trigger State
  const [preLoginLockShieldOpen, setPreLoginLockShieldOpen] = useState<boolean>(
    () => {
      if (typeof window === 'undefined') return false;
      return (
        new URLSearchParams(window.location.search).get('mode') === 'lockshield'
      );
    }
  );
  const [autoStartVoice, setAutoStartVoice] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      new URLSearchParams(window.location.search).get('mode') === 'voicewake'
    );
  });
  const [preLoginTriggerEvent, setPreLoginTriggerEvent] =
    useState<QuickTriggerEvent | null>(null);
  const [preLoginGeo, setPreLoginGeo] = useState<GeoLocationState>({
    status: 'idle',
    latitude: null,
    longitude: null,
    accuracy: null,
  });

  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    };
  }, []);

  const fallbackUser = getEmergencyFallbackUser();
  const isLoggedOut = !(screen === 'home' && currentUser);

  const requestPreLoginLocation = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    setPreLoginGeo((prev) => ({ ...prev, status: 'loading' }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPreLoginGeo({
          status: 'granted',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          updatedAt: new Date().toISOString(),
        });
      },
      () => {
        setPreLoginGeo((prev) => ({ ...prev, status: 'denied' }));
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const preLoginTriggers = useEmergencyQuickTriggers({
    preferences: fallbackUser.preferences,
    isLockScreenActive: preLoginLockShieldOpen,
    // Only run pre-login trigger engine while NOT inside HomeDashboard (which runs its own full engine)
    suspended: !isLoggedOut || Boolean(preLoginTriggerEvent),
    onTriggerSos: (event) => {
      requestPreLoginLocation();
      setPreLoginTriggerEvent(event);
    },
    onWakeWordDetected: () => {
      // Saying "OurSafe" from Login or Lock Shield automatically opens the app into hands-free voice mode
      setPreLoginLockShieldOpen(false);
      setPreLoginTriggerEvent(null);
      setAutoStartVoice(true);
      setCurrentUser(fallbackUser);
      setScreen('home');
    },
  });

  const handlePreLoginDispatchSos = useCallback(
    (event: QuickTriggerEvent) => {
      const existing = getEmergencyHistory(fallbackUser.id);
      const next = [
        {
          id: `hist-${Date.now()}`,
          timestamp: new Date().toISOString(),
          category: 'sos' as const,
          title: `Outside-App SOS Activated (${event.label})`,
          detail: `${event.detail} Triggered without signing into the dashboard. Automatic call & alert dispatch sent to guardians and police.`,
          statusLabel: navigator.onLine ? 'Auto-Dispatched' : 'Queued Offline',
          locationCoords:
            preLoginGeo.latitude !== null && preLoginGeo.longitude !== null
              ? `${preLoginGeo.latitude.toFixed(5)}, ${preLoginGeo.longitude.toFixed(5)}`
              : undefined,
        },
        ...existing,
      ];
      saveEmergencyHistory(fallbackUser.id, next);

      if (navigator.onLine) {
        fetch('/api/sos/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userName: fallbackUser.fullName,
            triggerSource: event.label,
            guardianContacts: fallbackUser.sosContacts.map((c) => ({
              name: c.name,
              phone: c.phone,
            })),
            policeNumber: '100',
            shareWithPolice: true,
            latitude: preLoginGeo.latitude,
            longitude: preLoginGeo.longitude,
            note: event.detail,
          }),
        }).catch(() => {});
      }
    },
    [
      fallbackUser.id,
      fallbackUser.fullName,
      fallbackUser.sosContacts,
      preLoginGeo.latitude,
      preLoginGeo.longitude,
    ]
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [screen]);

  const handleLoginSuccess = (user: UserProfile) => {
    setPreLoginLockShieldOpen(false);
    setPreLoginTriggerEvent(null);
    setCurrentUser(user);
    setScreen('home');
  };

  const handleSignupComplete = (user: UserProfile) => {
    setPreLoginLockShieldOpen(false);
    setPreLoginTriggerEvent(null);
    setCurrentUser(user);
    setScreen('home');
  };

  const handleUpdateUser = (updated: UserProfile) => {
    const saved = updateUserProfile(updated);
    setCurrentUser(saved);
  };

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
    setScreen('login');
  };

  const quotaBanner = mapsQuotaExceeded ? (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
      <span>
        Google Maps Platform quota reached. If you are the app owner, visit{' '}
        <a
          href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-semibold text-amber-950 hover:text-amber-800"
        >
          maps developer site
        </a>{' '}
        for instructions to update your account.
      </span>
    </div>
  ) : null;

  if (screen === 'home' && currentUser) {
    return (
      <>
        {quotaBanner}
        <HomeDashboard
          user={currentUser}
          onUpdateUser={handleUpdateUser}
          onLogout={handleLogout}
          autoStartVoice={autoStartVoice}
          onConsumeAutoStartVoice={() => setAutoStartVoice(false)}
        />
      </>
    );
  }

  const primaryGuardian =
    fallbackUser.sosContacts.find((c) => c.isPrimary) ??
    fallbackUser.sosContacts[0];

  return (
    <>
      {quotaBanner}
      {screen === 'signup' ? (
        <SignupScreen
          onSignupComplete={handleSignupComplete}
          onNavigateLogin={() => setScreen('login')}
        />
      ) : (
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          onNavigateSignup={() => setScreen('signup')}
          emergencyPreferences={fallbackUser.preferences}
          voiceListening={preLoginTriggers.voiceListening}
          onOpenLockScreenShield={() => setPreLoginLockShieldOpen(true)}
          onToggleVoiceWake={preLoginTriggers.toggleVoiceWakeListener}
        />
      )}

      {preLoginLockShieldOpen && (
        <EmergencyLockScreenShield
          preferences={fallbackUser.preferences}
          guardianName={primaryGuardian?.name}
          guardianPhone={primaryGuardian?.phone}
          triggers={preLoginTriggers}
          onQuickWidgetSos={() => {
            requestPreLoginLocation();
            setPreLoginTriggerEvent({
              id: `pre-widget-sos-${Date.now()}`,
              kind: 'screen_tap',
              label: 'Home Screen SOS Widget',
              detail:
                'Triggered directly from OurSafe Phone Home Screen Widget without signing in.',
              triggeredAt: new Date().toISOString(),
              fromLockScreen: false,
            });
          }}
          onExit={() => setPreLoginLockShieldOpen(false)}
        />
      )}

      {preLoginTriggerEvent && (
        <EmergencyTriggerOverlay
          event={preLoginTriggerEvent}
          userName={fallbackUser.fullName}
          contacts={fallbackUser.sosContacts}
          geoLocation={preLoginGeo}
          countdownSeconds={fallbackUser.preferences.quickTriggerCountdownSec}
          autoDialOnTrigger={fallbackUser.preferences.autoDialOnTrigger}
          onDispatchSos={handlePreLoginDispatchSos}
          onClose={() => setPreLoginTriggerEvent(null)}
        />
      )}
    </>
  );
}
