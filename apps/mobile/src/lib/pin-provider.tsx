/**
 * Mobile PIN-lock provider — owns the lock state for the whole app (mirrors
 * the web/desktop PinGate from @munim/ui). Renders the lock screen while the
 * app is locked and exposes unlock/change/disable/enable/reset via context so
 * the Settings screen can manage the lock with live status.
 */
import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {PinLockScreen} from '../screens/PinLockScreen';
import * as pin from './pin';

export type PinContextValue = {
  status: pin.PinStatus;
  /** True while the lock is PERSISTED-enabled (see PinSnapshot). */
  lockEnabled: boolean;
  isTestAccount: boolean;
  unlock: (pinValue: string) => Promise<boolean>;
  changePin: (current: string, next: string) => Promise<string | null>;
  disable: (current: string) => Promise<string | null>;
  enable: (next: string) => Promise<string | null>;
  resetToTest: () => Promise<void>;
};

const PinContext = createContext<PinContextValue | null>(null);

export function usePinLock(): PinContextValue {
  const ctx = useContext(PinContext);
  if (!ctx) throw new Error('usePinLock must be used within PinProvider');
  return ctx;
}

export function PinProvider({children}: {children: React.ReactNode}) {
  const [status, setStatus] = useState<pin.PinStatus>('loading');
  const [lockEnabled, setLockEnabled] = useState(false);
  const [isTestAccount, setIsTestAccount] = useState(false);

  useEffect(() => {
    let active = true;
    pin
      .initializePin()
      .then(s => {
        if (!active) return;
        setStatus(s.status);
        setLockEnabled(s.lockEnabled);
        setIsTestAccount(s.isTestAccount);
      })
      .catch(() => {
        // Storage failure — fall back to unlocked so the app still opens.
        if (!active) return;
        setStatus('unlocked');
        setLockEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<PinContextValue>(
    () => ({
      status,
      lockEnabled,
      isTestAccount,
      unlock: async (pinValue: string) => {
        const ok = await pin.unlockPin(pinValue);
        if (ok) setStatus('unlocked');
        return ok;
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
      },
    }),
    [status, lockEnabled, isTestAccount],
  );

  if (status === 'loading') return null;
  if (status === 'locked') return <PinLockScreen lock={value} />;
  return <PinContext.Provider value={value}>{children}</PinContext.Provider>;
}
