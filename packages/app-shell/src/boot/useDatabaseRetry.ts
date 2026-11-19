import type { DatabaseOpenError } from '@kitbag/core-db';
import { useCallback, useEffect, useState } from 'react';

import { DATABASE_ERROR_TEXT } from './databaseErrorCopy.ts';
import { reopenDatabase } from './databaseGate';

export type ReopenOutcome =
  | { readonly kind: 'relaunching' }
  | { readonly kind: 'failed'; readonly error: DatabaseOpenError }
  | { readonly kind: 'relaunchFailed' };

export type SetNotice = (notice: string | null) => void;

export interface DatabaseRetry {
  readonly error: DatabaseOpenError;
  readonly retrying: boolean;
  readonly retry: () => void;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

// The open blocks the JS thread; one frame first lets the progress bar lay out and sweep.
export async function reopenAfterFrame(): Promise<ReopenOutcome> {
  await nextFrame();
  try {
    const error = await reopenDatabase();
    return error === undefined
      ? { kind: 'relaunching' }
      : { kind: 'failed', error };
  } catch (error) {
    console.warn('[kitbag] relaunch after the database opened failed', error);
    return { kind: 'relaunchFailed' };
  }
}

export function retryNotice(outcome: ReopenOutcome): string | null {
  if (outcome.kind === 'failed') return DATABASE_ERROR_TEXT.stillFailing;
  if (outcome.kind === 'relaunchFailed')
    return DATABASE_ERROR_TEXT.relaunchFailed;
  return null;
}

export function useDatabaseRetry(
  launchError: DatabaseOpenError,
  setNotice: SetNotice,
): DatabaseRetry {
  const [error, setError] = useState(launchError);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!retrying) return;
    let live = true;
    void reopenAfterFrame().then((outcome) => {
      if (!live || outcome.kind === 'relaunching') return;
      if (outcome.kind === 'failed') setError(outcome.error);
      setNotice(retryNotice(outcome));
      setRetrying(false);
    });
    return () => {
      live = false;
    };
  }, [retrying, setNotice]);

  const retry = useCallback(() => {
    setNotice(null);
    setRetrying(true);
  }, [setNotice]);

  return { error, retrying, retry };
}
