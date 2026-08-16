/**
 * Mobile login + PIN-lock provider — owns the lock state for the whole app
 * (mirrors the web/desktop PinGate from @munim/ui). Renders the lock screen
 * while the app is locked and exposes verify/unlock/change/disable/enable/
 * reset/logout via context so the Settings screen can manage the lock with
 * live status.
 */
import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {PinLockScreen} from '../screens/PinLockScreen';
import {OnboardingScreen} from '../screens/OnboardingScreen';
import {ResetConfigScreen} from '../screens/ResetConfigScreen';
import {getSavedAppSetup} from './app-config';
import * as pin from './pin';

export type PinContextValue = {
  status: pin.PinStatus;
  /** True while the lock is PERSISTED-enabled (see PinSnapshot). */
  lockEnabled: boolean;
  isTestAccount: boolean;
  /** Normalized account email (for display in Settings). */
  accountEmail: string;
  verifyCredentials: (email: string, password: string) => Promise<boolean>;
  unlock: (pinValue: string) => Promise<boolean>;
  changePassword: (current: string, next: string) => Promise<string | null>;
  changePin: (current: string, next: string) => Promise<string | null>;
  disable: (current: string) => Promise<string | null>;
  enable: (next: string) => Promise<string | null>;
  resetToTest: () => Promise<void>;
  lockNow: () => Promise<void>;
};

const PinContext = createContext<PinContextValue | null>(null);

export function usePinLock(): PinContextValue {
  const ctx = useContext(PinContext);
  if (!ctx) throw new Error('usePinLock must be used within PinProvider');
  return ctx;
}

type SetupPhase = 'checking' | 'onboarding' | 'reset' | 'gate';

export function PinProvider({children}: {children: React.ReactNode}) {
  const [status, setStatus] = useState<pin.PinStatus>('loading');
  const [lockEnabled, setLockEnabled] = useState(false);
  const [isTestAccount, setIsTestAccount] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');
  const [phase, setPhase] = useState<SetupPhase>('checking');

  useEffect(() => {
    let active = true;
    void (async () => {
      // Setup gate: first launch (no saved DB URL) → onboarding flow first.
      const setup = await getSavedAppSetup();
      if (!active) return;
      setPhase(setup ? 'gate' : 'onboarding');
      let s: pin.PinSnapshot;
      try {
        s = await pin.initializePin();
      } catch {
        // Storage failure — fall back to unlocked so the app still opens.
        if (!active) return;
        setStatus('unlocked');
        setLockEnabled(false);
        return;
      }
      if (!active) return;
      setStatus(s.status);
      setLockEnabled(s.lockEnabled);
      setIsTestAccount(s.isTestAccount);
      setAccountEmail(s.accountEmail);
    })();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<PinContextValue>(
    () => ({
      status,
      lockEnabled,
      isTestAccount,
      accountEmail,
      verifyCredentials: async (email: string, password: string) => {
        return pin.verifyCredentials(email, password);
      },
      unlock: async (pinValue: string) => {
        const ok = await pin.unlockPin(pinValue);
        if (ok) setStatus('unlocked');
        return ok;
      },
      changePassword: async (current: string, next: string) => {
        const err = await pin.changePassword(current, next);
        if (err === null) setIsTestAccount(false);
        return err;
      },
      changePin: async (current: string, next: string) => {
        const err = await pin.changePin(current, next);
        if (err === null) setIsTestAccount(false);
        return err;
      },
      disable: async (current: string) => {
        const err = await pin.disablePin(current);
        if (err === null) {
          setLockEnabled(false);
          setStatus('unlocked');
        }
        return err;
      },
      enable: async (next: string) => {
        const err = await pin.enablePin(next);
        if (err === null) {
          setIsTestAccount(false);
          setLockEnabled(true);
        }
        return err;
      },
      resetToTest: async () => {
        const s = await pin.resetPinToTest();
        setStatus(s.status);
        setLockEnabled(s.lockEnabled);
        setIsTestAccount(s.isTestAccount);
        setAccountEmail(s.accountEmail);
      },
      lockNow: async () => {
        await pin.lockNow();
        setStatus('locked');
      },
    }),
    [status, lockEnabled, isTestAccount, accountEmail],
  );

  if (phase === 'checking' || status === 'loading') return null;
  if (phase === 'onboarding') {
    return (
      <OnboardingScreen
        onComplete={() => {
          setPhase('gate');
          // Re-check the lock now that setup exists (fresh install: locked).
          void pin.initializePin().then(s => {
            setStatus(s.status);
            setLockEnabled(s.lockEnabled);
            setIsTestAccount(s.isTestAccount);
            setAccountEmail(s.accountEmail);
          });
        }}
      />
    );
  }
  if (phase === 'reset') {
    return (
      <ResetConfigScreen
        onCleared={() => setPhase('onboarding')}
        onCancel={() => setPhase('gate')}
      />
    );
  }
  if (status === 'locked') {
    return <PinLockScreen lock={value} onOpenConnectionSettings={() => setPhase('reset')} />;
  }
  return <PinContext.Provider value={value}>{children}</PinContext.Provider>;
}
