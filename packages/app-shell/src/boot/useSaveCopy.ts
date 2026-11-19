import { useCallback, useRef, useState } from 'react';

import { saveDatabaseCopyNotice } from './databaseGate';
import type { SetNotice } from './useNotice.ts';

export interface SaveCopy {
  readonly saving: boolean;
  readonly saveCopy: () => void;
}

export async function runSaveCopy(
  setSaving: (saving: boolean) => void,
  setNotice: SetNotice,
): Promise<void> {
  setSaving(true);
  setNotice(null);
  try {
    setNotice(await saveDatabaseCopyNotice(new Date()));
  } finally {
    setSaving(false);
  }
}

export function useSaveCopy(setNotice: SetNotice): SaveCopy {
  const [saving, setSavingState] = useState(false);
  const inFlight = useRef(false);
  const setSaving = useCallback((next: boolean) => {
    inFlight.current = next;
    setSavingState(next);
  }, []);
  const saveCopy = useCallback(() => {
    if (inFlight.current) return;
    runSaveCopy(setSaving, setNotice).catch((error: unknown) => {
      console.warn('[kitbag] database copy not saved', error);
    });
  }, [setSaving, setNotice]);
  return { saving, saveCopy };
}
