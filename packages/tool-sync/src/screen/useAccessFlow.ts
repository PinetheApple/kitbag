import { getMediaSessionsStore, useMediaSessions } from '@kitbag/core-state';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

export interface AccessFlow {
  readonly askedForAccess: boolean;
  readonly declined: boolean;
  readonly openAccess: () => void;
  readonly notNow: () => void;
  readonly explainAgain: () => void;
}

const FOREGROUND = 'active';

function useStillOffOnReturn(
  awaiting: boolean,
  onReturn: (stillOff: boolean) => void,
): void {
  useEffect(() => {
    if (!awaiting) return;
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== FOREGROUND) return;
      const sessions = getMediaSessionsStore();
      void sessions
        .getState()
        .refresh()
        .then(() => {
          onReturn(sessions.getState().access === false);
        });
    });
    return () => {
      listener.remove();
    };
  }, [awaiting, onReturn]);
}

export function useAccessFlow(): AccessFlow {
  const openSettings = useMediaSessions((s) => s.openSettings);
  const [awaiting, setAwaiting] = useState(false);
  const [askedForAccess, setAskedForAccess] = useState(false);
  const explainerDeclined = useMediaSessions((s) => s.explainerDeclined);
  const declineExplainer = useMediaSessions((s) => s.declineExplainer);
  const [reopened, setReopened] = useState(false);
  const declined = explainerDeclined && !reopened;

  const onReturn = useCallback((stillOff: boolean) => {
    setAwaiting(false);
    setAskedForAccess(stillOff);
  }, []);
  useStillOffOnReturn(awaiting, onReturn);

  const openAccess = useCallback(() => {
    setAwaiting(true);
    openSettings().catch(() => undefined);
  }, [openSettings]);
  const notNow = useCallback(() => {
    setReopened(false);
    declineExplainer();
  }, [declineExplainer]);
  const explainAgain = useCallback(() => {
    setReopened(true);
    setAskedForAccess(false);
  }, []);

  return { askedForAccess, declined, openAccess, notNow, explainAgain };
}
