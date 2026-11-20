import { usePracticeHistory } from '@kitbag/core-state';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { practiceTileSubtext } from './subtext.ts';

export function usePracticeTileText(shown: boolean): string {
  const sessions = usePracticeHistory((s) => s.sessions);
  const refresh = usePracticeHistory((s) => s.refresh);
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      if (!shown) return;
      setNow(new Date());
      void refresh();
    }, [shown, refresh]),
  );
  return useMemo(() => practiceTileSubtext(sessions, now), [sessions, now]);
}
