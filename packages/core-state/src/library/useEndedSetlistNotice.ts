import { useEffect } from 'react';

import type { LeftSetlist } from './setlistSession.ts';
import { useLibrary } from './useLibrary.ts';

export function useEndedSetlistNotice(show: (left: LeftSetlist) => void) {
  const ended = useLibrary((s) => s.endedSetlist);
  const dismiss = useLibrary((s) => s.dismissEndedSetlist);
  useEffect(() => {
    if (ended === null) return;
    show(ended);
    dismiss();
  }, [ended, dismiss, show]);
}
