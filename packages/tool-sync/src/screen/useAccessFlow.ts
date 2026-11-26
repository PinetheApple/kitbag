import { useMediaSessions } from '@kitbag/core-state';
import { useCallback, useState } from 'react';

export interface AccessFlow {
  readonly askedForAccess: boolean;
  readonly declined: boolean;
  readonly openAccess: () => void;
  readonly notNow: () => void;
  readonly explainAgain: () => void;
}

export function useAccessFlow(): AccessFlow {
  const openSettings = useMediaSessions((s) => s.openSettings);
  const [askedForAccess, setAskedForAccess] = useState(false);
  const [declined, setDeclined] = useState(false);

  const openAccess = useCallback(() => {
    setAskedForAccess(true);
    openSettings().catch(() => undefined);
  }, [openSettings]);
  const notNow = useCallback(() => {
    setDeclined(true);
  }, []);
  const explainAgain = useCallback(() => {
    setDeclined(false);
    setAskedForAccess(false);
  }, []);

  return { askedForAccess, declined, openAccess, notNow, explainAgain };
}
