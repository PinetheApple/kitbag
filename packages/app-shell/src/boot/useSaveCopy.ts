import { useCallback, useRef } from 'react';

import { saveDatabaseCopyNotice } from './databaseGate';
import type { SetNotice } from './useNotice.ts';

export function useSaveCopy(setNotice: SetNotice): () => void {
  const saving = useRef(false);
  return useCallback(() => {
    if (saving.current) return;
    saving.current = true;
    setNotice(null);
    void saveDatabaseCopyNotice(new Date()).then((notice) => {
      saving.current = false;
      setNotice(notice);
    });
  }, [setNotice]);
}
